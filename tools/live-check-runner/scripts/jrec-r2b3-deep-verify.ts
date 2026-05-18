/**
 * jrec-r2b3-deep-verify.ts
 *
 * Phase R-2B-3 server-side RPC deep verification.
 *
 * What this exercises (beyond reservation-admin.spec.ts which only covers UI scaffolding):
 *   - linkReservationToPatient → linkedPatientId stored
 *   - createVisitFromReservation → SelfPayVisits + SelfPayChart created, linkedVisitKey written
 *   - createVisitFromReservation 2nd call → idempotent (alreadyExists:true, same vk)
 *   - getReservationForAdmin → linkedPatientId / linkedVisitKey reflected
 *
 * Strategy:
 *   - Connects via Playwright connectOverCDP to a Chrome instance you've launched with
 *     `--remote-debugging-port=9222 --user-data-dir=.chrome-cdp-profile` (Google logged in).
 *   - Uses any existing reservation matching "LiveCheck太郎" prefix in active|all filter
 *     (created earlier by reservation-admin.spec.ts E2E-1, then cancelled by E2E-4).
 *   - Issues google.script.run calls from inside the GAS HtmlService sandbox iframe.
 *   - Best-effort trashVisit cleanup for the created SelfPayVisit (the SelfPayChart row remains
 *     intentionally; SelfPayChart has no cleanup RPC and chiefComplaint placeholder marks it
 *     clearly as test data).
 *
 * Pollution per run:
 *   - 1 SelfPayVisits row marked isDeleted=true after run (chiefComplaint placeholder)
 *   - 1 SelfPayChart row (no cleanup; placeholder identifies as test)
 *   - 1 Reservations row gains linkedPatientId / linkedVisitKey + staffMemo entries
 *
 * Exit codes:
 *   0 = all PASS
 *   1 = any FAIL (deploy is BLOCKED)
 *
 * Usage:
 *   npx tsx scripts/jrec-r2b3-deep-verify.ts
 *   (Chrome with CDP 9222 must already be running with a valid Google session)
 *
 * This script is NOT wired into npm scripts intentionally — it's a one-off verification
 * helper used at R-2B-3 deploy gate. Keep around for future R-2B-* deploys.
 */

import { chromium, type FrameLocator, type Page } from "@playwright/test";

const DEV_URL =
  "https://script.google.com/macros/s/AKfycbzJWJAKCxStP82lfFl8eEHei98dWh7f6cgtEM33r3M5/dev";
const ADMIN_URL = DEV_URL + "?page=reservationAdmin";
const CDP_URL = "http://localhost:9222";
const GAS_TIMEOUT = 25_000;
const RPC_TIMEOUT = 40_000;
const TEST_PATIENT_ID = "P0001"; // 院長指定の既存テスト患者

interface Result {
  name: string;
  ok: boolean;
  detail: string;
}
const results: Result[] = [];

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log((ok ? "✅ PASS" : "❌ FAIL") + "  [" + name + "]  " + detail);
}

function gasAppFrame(page: Page): FrameLocator {
  return page.frameLocator("iframe").first().frameLocator("iframe").first();
}

/** RPC を Promise でラップして frame の page-context で評価 */
async function callRpc(
  frame: FrameLocator,
  rpcName: string,
  args: unknown[]
): Promise<unknown> {
  // Playwright の evaluate は 2 番目の引数を 1 つの値として渡す。
  // 関数側で { fn, args } オブジェクトとして受ける。
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

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  jrec-r2b3-deep-verify — R-2B-3 server RPC deep check");
  console.log("═══════════════════════════════════════════════════════════");

  let browser;
  try {
    browser = await chromium.connectOverCDP(CDP_URL, { timeout: 5000 });
  } catch (err) {
    console.error("\n❌ Chrome CDP に接続できません: " + (err as Error).message);
    console.error("   --remote-debugging-port=9222 で Chrome を起動してから再実行してください。");
    process.exit(1);
  }

  const ctx = browser.contexts()[0];
  if (!ctx) {
    console.error("❌ Browser context が見つかりません。");
    process.exit(1);
  }

  const page = await ctx.newPage();
  page.setDefaultTimeout(GAS_TIMEOUT);

  await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
  const frame = gasAppFrame(page);
  await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: GAS_TIMEOUT });

  // Step 1: listReservationsForAdmin で LiveCheck太郎 を 1 件取得
  let reservationId = "";
  try {
    const res = (await Promise.race([
      callRpc(frame, "listReservationsForAdmin", [
        {
          dateFrom: ymd(new Date(Date.now() - 7 * 86400_000)),
          dateTo: ymd(new Date(Date.now() + 14 * 86400_000)),
          status: "all",
          query: "LiveCheck太郎",
        },
      ]),
      timeoutAfter(RPC_TIMEOUT, "listReservationsForAdmin timeout"),
    ])) as { ok: boolean; items: Array<{ reservationId: string; status: string; linkedPatientId: string; linkedVisitKey: string }> };
    if (!res || !res.ok || !res.items || res.items.length === 0) {
      record("LIST_RES", false, "LiveCheck太郎 予約が見つかりません。spec を先に実行してください。");
      printSummaryAndExit();
      return;
    }
    // 末尾を採用（最も新しい予約）
    const target = res.items[res.items.length - 1];
    reservationId = target.reservationId;
    record(
      "LIST_RES",
      true,
      `target=${reservationId}  status=${target.status}  linkedPatientId='${target.linkedPatientId}'  linkedVisitKey='${target.linkedVisitKey}'`
    );
  } catch (err) {
    record("LIST_RES", false, "exception: " + (err as Error).message);
    printSummaryAndExit();
    return;
  }

  // Step 2: linkReservationToPatient(rid, P0001) — 既にリンク済みでも上書き可
  try {
    const res = (await Promise.race([
      callRpc(frame, "linkReservationToPatient", [reservationId, TEST_PATIENT_ID]),
      timeoutAfter(RPC_TIMEOUT, "linkReservationToPatient timeout"),
    ])) as { ok: boolean; patientId?: string; code?: string; error?: string; oldPatientId?: string };
    if (!res || !res.ok) {
      record("LINK_PATIENT", false, "code=" + (res && res.code) + " err=" + (res && res.error));
      printSummaryAndExit();
      return;
    }
    record(
      "LINK_PATIENT",
      res.patientId === TEST_PATIENT_ID,
      `linked → ${res.patientId} (old: ${res.oldPatientId || "—"})`
    );
  } catch (err) {
    record("LINK_PATIENT", false, "exception: " + (err as Error).message);
    printSummaryAndExit();
    return;
  }

  // Step 3: createVisitFromReservation — 1st call (creates visit)
  let firstVk = "";
  let firstAlreadyExists = false;
  try {
    const res = (await Promise.race([
      callRpc(frame, "createVisitFromReservation", [reservationId]),
      timeoutAfter(RPC_TIMEOUT, "createVisitFromReservation #1 timeout"),
    ])) as {
      ok: boolean;
      alreadyExists?: boolean;
      visitKey?: string;
      chartId?: string;
      patientId?: string;
      code?: string;
      error?: string;
    };
    if (!res || !res.ok || !res.visitKey) {
      record("CREATE_VISIT_1", false, "code=" + (res && res.code) + " err=" + (res && res.error));
      printSummaryAndExit();
      return;
    }
    firstVk = res.visitKey;
    firstAlreadyExists = !!res.alreadyExists;
    record(
      "CREATE_VISIT_1",
      true,
      `vk=${firstVk}  chartId=${res.chartId}  patientId=${res.patientId}  alreadyExists=${firstAlreadyExists}`
    );
  } catch (err) {
    record("CREATE_VISIT_1", false, "exception: " + (err as Error).message);
    printSummaryAndExit();
    return;
  }

  // Step 4: createVisitFromReservation — 2nd call (idempotent)
  let secondVk = "";
  try {
    const res = (await Promise.race([
      callRpc(frame, "createVisitFromReservation", [reservationId]),
      timeoutAfter(RPC_TIMEOUT, "createVisitFromReservation #2 timeout"),
    ])) as { ok: boolean; alreadyExists?: boolean; visitKey?: string; code?: string; error?: string };
    if (!res || !res.ok || !res.visitKey) {
      record("CREATE_VISIT_2_IDEMP", false, "code=" + (res && res.code) + " err=" + (res && res.error));
      printSummaryAndExit();
      return;
    }
    secondVk = res.visitKey;
    const isIdempotent = res.alreadyExists === true && secondVk === firstVk;
    record(
      "CREATE_VISIT_2_IDEMP",
      isIdempotent,
      `vk=${secondVk}  alreadyExists=${res.alreadyExists}  same-as-first=${secondVk === firstVk}`
    );
  } catch (err) {
    record("CREATE_VISIT_2_IDEMP", false, "exception: " + (err as Error).message);
  }

  // Step 5: getReservationForAdmin → linkedVisitKey 書き戻し確認
  try {
    const res = (await Promise.race([
      callRpc(frame, "getReservationForAdmin", [reservationId]),
      timeoutAfter(RPC_TIMEOUT, "getReservationForAdmin timeout"),
    ])) as { ok: boolean; item?: { linkedPatientId: string; linkedVisitKey: string; staffMemo: string } };
    if (!res || !res.ok || !res.item) {
      record("RES_REREAD", false, "fetch failed");
    } else {
      const ok =
        res.item.linkedPatientId === TEST_PATIENT_ID &&
        res.item.linkedVisitKey === firstVk &&
        res.item.staffMemo.indexOf("カルテ作成") >= 0;
      record(
        "RES_REREAD",
        ok,
        `linkedPatientId=${res.item.linkedPatientId}  linkedVisitKey=${res.item.linkedVisitKey}  memo-has-カルテ作成=${res.item.staffMemo.indexOf("カルテ作成") >= 0}`
      );
    }
  } catch (err) {
    record("RES_REREAD", false, "exception: " + (err as Error).message);
  }

  // Step 6: Cleanup — trashVisit
  try {
    const res = (await Promise.race([
      callRpc(frame, "trashVisit", [firstVk, "r2b3 deep verify cleanup"]),
      timeoutAfter(RPC_TIMEOUT, "trashVisit timeout"),
    ])) as { ok: boolean; error?: string };
    record("CLEANUP_TRASH_VISIT", res?.ok === true, res?.ok ? "trashed " + firstVk : "err=" + (res?.error || ""));
  } catch (err) {
    record("CLEANUP_TRASH_VISIT", false, "exception: " + (err as Error).message);
  }

  printSummaryAndExit();
}

function ymd(d: Date): string {
  return d.getFullYear() + "-" +
    ("0" + (d.getMonth() + 1)).slice(-2) + "-" +
    ("0" + d.getDate()).slice(-2);
}

function timeoutAfter<T>(ms: number, msg: string): Promise<T> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(msg)), ms));
}

function printSummaryAndExit() {
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  Summary");
  console.log("═══════════════════════════════════════════════════════════");
  const total = results.length;
  const passed = results.filter((r) => r.ok).length;
  const failed = total - passed;
  console.log(`  total=${total}  pass=${passed}  fail=${failed}`);
  if (failed > 0) {
    console.log("\n❌ FAIL があります。@76 deploy は BLOCKED です。");
    process.exit(1);
  }
  console.log("\n✅ ALL PASS — @76 deploy 可");
  process.exit(0);
}

main().catch((e) => {
  console.error("[verify] 予期しない例外: " + (e && e.message || e));
  process.exit(1);
});
