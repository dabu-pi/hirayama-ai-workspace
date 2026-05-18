/**
 * jrec-r2c-deep-verify.ts
 *
 * Phase R-2C server-side verification.
 *
 * What this exercises (beyond regression spec):
 *   - runMigrateNotificationSettingsV1: idempotent settings migration
 *   - runDebugBuildNotificationContentV1: pure content builder (4 events, phone mask)
 *   - runDebugNotificationDryRunV1: notification dispatch via dry_run mode
 *   - listSlotsRegenTriggers / installSlotsRegenTrigger / uninstallSlotsRegenTrigger:
 *     idempotent trigger ops (install → reinstall with new hour → uninstall to 0)
 *
 * Strategy:
 *   - Connects via Playwright connectOverCDP to Chrome running on port 9222
 *     (started with --user-data-dir=.chrome-cdp-profile to reuse Google session).
 *   - Calls google.script.run RPCs from inside the GAS HtmlService sandbox iframe.
 *
 * Side effects per run (acceptable):
 *   - Run_Log gains 1× NOTIFY_DRYRUN, 2× SLOTS_CRON_INSTALL, 1× SLOTS_CRON_UNINSTALL
 *   - Reservation_Settings gains 5 notification rows on first run (idempotent thereafter)
 *   - Apps Script project triggers are temporarily mutated then restored to 0
 *   - runRegenerateReservationSlotsWithLog is NOT called (would mutate real Slots)
 *
 * Exit codes:
 *   0 = all PASS
 *   1 = any FAIL (deploy is BLOCKED)
 */

import { chromium, type FrameLocator, type Page } from "@playwright/test";

const DEV_URL =
  "https://script.google.com/macros/s/AKfycbzJWJAKCxStP82lfFl8eEHei98dWh7f6cgtEM33r3M5/dev";
const ADMIN_URL = DEV_URL + "?page=reservationAdmin";
const CDP_URL = "http://localhost:9222";
const GAS_TIMEOUT = 25_000;
const RPC_TIMEOUT = 40_000;

type ResultKind = "PASS" | "FAIL" | "PENDING";
interface Result {
  name: string;
  kind: ResultKind;
  detail: string;
}
const results: Result[] = [];

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, kind: ok ? "PASS" : "FAIL", detail });
  console.log((ok ? "✅ PASS" : "❌ FAIL") + "  [" + name + "]  " + detail);
}

/** scope 不足など、deploy gate を blocking しない既知の保留事項 */
function recordPending(name: string, detail: string) {
  results.push({ name, kind: "PENDING", detail });
  console.log("⏸  PENDING_SCOPE  [" + name + "]  " + detail);
}

/** R-2C: script.scriptapp スコープ未追加で発生する典型エラーかどうか */
function isScopeMissingError(msg: string): boolean {
  if (!msg) return false;
  return msg.indexOf("script.scriptapp") >= 0 ||
    msg.indexOf("PermissionError") >= 0 ||
    msg.indexOf("permitted") >= 0 ||
    msg.indexOf("権限では") >= 0 ||
    msg.indexOf("ScriptApp.getProjectTriggers") >= 0 ||
    msg.indexOf("必要な権限") >= 0;
}

function gasAppFrame(page: Page): FrameLocator {
  return page.frameLocator("iframe").first().frameLocator("iframe").first();
}

async function callRpc(
  frame: FrameLocator,
  rpcName: string,
  args: unknown[]
): Promise<unknown> {
  return await frame
    .locator("body")
    .first()
    .evaluate(
      (_el: Element, payload: { fn: string; args: unknown[] }) => {
        return new Promise((resolve, reject) => {
          const g = (window as unknown as {
            google?: { script?: { run?: Record<string, unknown> } };
          }).google;
          if (!g || !g.script || !g.script.run) {
            reject(new Error("google.script.run not available"));
            return;
          }
          const runner = g.script.run as Record<string, unknown>;
          const withSuccess = (
            runner["withSuccessHandler"] as (h: (r: unknown) => void) => unknown
          )((res) => resolve(res));
          const withFailure = (
            (withSuccess as Record<string, unknown>)["withFailureHandler"] as (
              h: (e: { message?: string }) => void
            ) => unknown
          )((err) => reject(new Error("RPC failure: " + (err && err.message || ""))));
          const fnRef = (withFailure as Record<string, unknown>)[payload.fn] as (
            ...a: unknown[]
          ) => unknown;
          if (typeof fnRef !== "function") {
            reject(new Error("RPC not found: " + payload.fn));
            return;
          }
          fnRef.apply(null, payload.args);
        });
      },
      { fn: rpcName, args }
    );
}

function timeoutAfter<T>(ms: number, msg: string): Promise<T> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(msg)), ms));
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  jrec-r2c-deep-verify — R-2C notifications + slots cron");
  console.log("═══════════════════════════════════════════════════════════");

  let browser;
  try {
    browser = await chromium.connectOverCDP(CDP_URL, { timeout: 5000 });
  } catch (err) {
    console.error("\n❌ Chrome CDP に接続できません: " + (err as Error).message);
    process.exit(1);
  }

  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  page.setDefaultTimeout(GAS_TIMEOUT);
  await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
  const frame = gasAppFrame(page);
  await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: GAS_TIMEOUT });

  // Step 1: migration
  try {
    const res = (await Promise.race([
      callRpc(frame, "runMigrateNotificationSettingsV1", []),
      timeoutAfter(RPC_TIMEOUT, "migrate timeout"),
    ])) as { ok: boolean; added: string[]; skipped: string[]; total: number };
    const totalCovered = (res?.added?.length || 0) + (res?.skipped?.length || 0);
    record(
      "MIGRATE_SETTINGS",
      !!res?.ok && totalCovered === res.total,
      `added=${res?.added?.length}  skipped=${res?.skipped?.length}  total=${res?.total}`
    );
  } catch (err) {
    record("MIGRATE_SETTINGS", false, "exception: " + (err as Error).message);
  }

  // Step 2: content builder pure check
  try {
    const res = (await Promise.race([
      callRpc(frame, "runDebugBuildNotificationContentV1", []),
      timeoutAfter(RPC_TIMEOUT, "build content timeout"),
    ])) as {
      ok: boolean;
      samples: Record<string, { subject: string; body: string }>;
      maskedPhoneSample: string;
    };
    const events = ["RESERVATION_CREATED", "RESERVATION_CONFIRMED", "RESERVATION_CANCELLED", "RESERVATION_NO_SHOW"];
    const allOk = events.every((e) => {
      const s = res?.samples?.[e];
      return !!(s && s.subject && s.body && s.subject.indexOf(e === "RESERVATION_CREATED" ? "新規予約" :
                                                              e === "RESERVATION_CONFIRMED" ? "予約確定" :
                                                              e === "RESERVATION_CANCELLED" ? "予約キャンセル" :
                                                              "no_show") >= 0);
    });
    // Mask check: 09014861348 → 090****1348
    const maskOk = res?.maskedPhoneSample === "090****1348";
    record(
      "NOTIFY_CONTENT",
      !!res?.ok && allOk && maskOk,
      `events=${events.length} all-built=${allOk}  maskedPhoneSample='${res?.maskedPhoneSample}' maskOk=${maskOk}`
    );
  } catch (err) {
    record("NOTIFY_CONTENT", false, "exception: " + (err as Error).message);
  }

  // Step 3: notification dry-run dispatch
  try {
    const res = (await Promise.race([
      callRpc(frame, "runDebugNotificationDryRunV1", []),
      timeoutAfter(RPC_TIMEOUT, "dry-run timeout"),
    ])) as { ok: boolean; mode: string; action: string; eventType: string };
    const ok = !!res?.ok && res.mode === "dry_run" && res.action === "NOTIFY_DRYRUN" && res.eventType === "RESERVATION_CREATED";
    record(
      "NOTIFY_DRYRUN",
      ok,
      `ok=${res?.ok}  mode=${res?.mode}  action=${res?.action}  eventType=${res?.eventType}`
    );
  } catch (err) {
    record("NOTIFY_DRYRUN", false, "exception: " + (err as Error).message);
  }

  // Step 4: Trigger ops — gracefully skip if script.scriptapp scope is missing.
  // 既存スコープ（spreadsheets / calendar / external_request）には script.scriptapp が含まれていない。
  // R-2C 段階では scope 追加 + 院長再認可を行わない方針なので、scope エラーは PENDING_SCOPE として扱う。
  let scopePending = false;
  let installedId1 = "";

  // Pre-list
  try {
    const res = (await Promise.race([
      callRpc(frame, "listSlotsRegenTriggers", []),
      timeoutAfter(RPC_TIMEOUT, "list pre timeout"),
    ])) as { ok: boolean; count: number; handler: string; error?: string };
    if (!res?.ok && isScopeMissingError(res?.error || "")) {
      scopePending = true;
      recordPending("TRIGGER_LIST_PRE", "script.scriptapp scope 未追加（R-2C-B 別フェーズで対応）");
    } else {
      record("TRIGGER_LIST_PRE", !!res?.ok, `count=${res?.count}  handler=${res?.handler}` + (res?.error ? `  err=${res.error}` : ""));
    }
  } catch (err) {
    const msg = (err as Error).message;
    if (isScopeMissingError(msg)) {
      scopePending = true;
      recordPending("TRIGGER_LIST_PRE", "script.scriptapp scope 未追加");
    } else {
      record("TRIGGER_LIST_PRE", false, "exception: " + msg);
    }
  }

  if (scopePending) {
    // 残り 5 件すべて PENDING で打ち切り（同じスコープ要件なので全部同じ理由で blocked）
    ["TRIGGER_INSTALL", "TRIGGER_LIST_POST", "TRIGGER_REINSTALL_IDEMP", "TRIGGER_LIST_POST_REINSTALL", "TRIGGER_UNINSTALL", "TRIGGER_LIST_FINAL"].forEach((n) => {
      recordPending(n, "script.scriptapp scope 未追加で skip");
    });
  } else {
    // Step 5: install at hour=2
    try {
      const res = (await Promise.race([
        callRpc(frame, "installSlotsRegenTrigger", [{ hour: 2 }]),
        timeoutAfter(RPC_TIMEOUT, "install timeout"),
      ])) as { ok: boolean; installed: boolean; triggerId?: string; hour: number; removed: number; error?: string };
      const ok = !!res?.ok && res.installed === true && res.hour === 2 && !!res.triggerId;
      installedId1 = res?.triggerId || "";
      record("TRIGGER_INSTALL", ok,
        `ok=${res?.ok}  installed=${res?.installed}  hour=${res?.hour}  triggerId=${installedId1}  removed=${res?.removed}` +
        (res?.error ? `  err=${res.error}` : ""));
    } catch (err) { record("TRIGGER_INSTALL", false, "exception: " + (err as Error).message); }

    // Step 6: list post
    try {
      const res = (await Promise.race([
        callRpc(frame, "listSlotsRegenTriggers", []),
        timeoutAfter(RPC_TIMEOUT, "list post timeout"),
      ])) as { ok: boolean; count: number; triggers: Array<{ handler: string }> };
      const handlerMatch = (res?.triggers || []).every((t) => t.handler === "runRegenerateReservationSlotsWithLog");
      record("TRIGGER_LIST_POST", !!res?.ok && res.count >= 1 && handlerMatch, `count=${res?.count}  handler-match=${handlerMatch}`);
    } catch (err) { record("TRIGGER_LIST_POST", false, "exception: " + (err as Error).message); }

    // Step 7: reinstall idempotency
    try {
      const res = (await Promise.race([
        callRpc(frame, "installSlotsRegenTrigger", [{ hour: 3 }]),
        timeoutAfter(RPC_TIMEOUT, "reinstall timeout"),
      ])) as { ok: boolean; installed: boolean; triggerId?: string; hour: number; removed: number };
      const installedId2 = res?.triggerId || "";
      const removedAtLeast1 = (res?.removed ?? 0) >= 1;
      const newId = !!installedId2 && installedId2 !== installedId1;
      record("TRIGGER_REINSTALL_IDEMP", !!res?.ok && res.installed === true && removedAtLeast1 && newId,
        `removed=${res?.removed}  newId=${newId}  hour=${res?.hour}`);
      const lst = (await callRpc(frame, "listSlotsRegenTriggers", [])) as { ok: boolean; count: number };
      record("TRIGGER_LIST_POST_REINSTALL", !!lst?.ok && lst.count === 1, `count=${lst?.count}`);
    } catch (err) { record("TRIGGER_REINSTALL_IDEMP", false, "exception: " + (err as Error).message); }

    // Step 8: uninstall → 0
    try {
      const res = (await Promise.race([
        callRpc(frame, "uninstallSlotsRegenTrigger", []),
        timeoutAfter(RPC_TIMEOUT, "uninstall timeout"),
      ])) as { ok: boolean; removed: number; error?: string };
      record("TRIGGER_UNINSTALL", !!res?.ok && (res.removed ?? 0) >= 1, `removed=${res?.removed}` + (res?.error ? `  err=${res.error}` : ""));
      const lst = (await callRpc(frame, "listSlotsRegenTriggers", [])) as { ok: boolean; count: number };
      record("TRIGGER_LIST_FINAL", !!lst?.ok && lst.count === 0, `count=${lst?.count}`);
    } catch (err) { record("TRIGGER_UNINSTALL", false, "exception: " + (err as Error).message); }
  }

  // Summary
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  Summary");
  console.log("═══════════════════════════════════════════════════════════");
  const total = results.length;
  const passed = results.filter((r) => r.kind === "PASS").length;
  const failed = results.filter((r) => r.kind === "FAIL").length;
  const pending = results.filter((r) => r.kind === "PENDING").length;
  console.log(`  total=${total}  pass=${passed}  fail=${failed}  pending=${pending}`);

  if (failed > 0) {
    console.log("\n❌ FAIL があります。@77 deploy は BLOCKED です。");
    process.exit(1);
  }
  if (pending > 0) {
    console.log("\n⏸  PENDING_SCOPE 項目があります（R-2C-B 別フェーズで対応想定）。");
    console.log("    通知 dry_run 系（migration / content builder / dispatch）は全 PASS。");
    console.log("    deploy 可否は、scope 追加方針を含めて呼出元で判断してください。");
    process.exit(0);
  }
  console.log("\n✅ ALL PASS — @77 deploy 可");
  process.exit(0);
}

main().catch((e) => {
  console.error("[verify] 予期しない例外: " + (e && e.message || e));
  process.exit(1);
});
