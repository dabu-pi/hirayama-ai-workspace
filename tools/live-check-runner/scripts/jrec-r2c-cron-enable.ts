/**
 * jrec-r2c-cron-enable.ts
 *
 * Phase R-2C-cron-enable: install the Reservation_Slots auto-regen daily
 * trigger in production via google.script.run over CDP.
 *
 * Unlike jrec-r2c-deep-verify.ts (which uninstalls at the end to leave
 * production clean), this script INTENTIONALLY LEAVES THE TRIGGER ACTIVE.
 * Use only when you intend cron to be live.
 *
 * What it does:
 *   1. Pre-list  : assert current triggers count for the handler == 0
 *   2. Install   : installSlotsRegenTrigger({hour: 2}) → count=1
 *   3. Idempotency: installSlotsRegenTrigger({hour: 2}) again → removes
 *                   prior, installs new, count stays 1
 *   4. Post-list : confirm exactly 1 trigger active
 *
 * Side effects:
 *   - 1 daily time-based trigger remains installed at the end
 *   - 2× SLOTS_CRON_INSTALL rows appear in Run_Log
 *
 * Disable procedure (record in PROJECT_STATUS when activating cron):
 *   Option A (CDP, recommended):
 *     - Open the same CDP Chrome (port 9222) used here
 *     - Run scripts/jrec-r2c-cron-disable.ts (companion script)
 *   Option B (Apps Script editor):
 *     - https://script.google.com/d/1-1opRkAFbFQz96Uqlgy3sWjgAs_PKS_1Eg9Pz7_6geTFztHx_5APSj2G/edit
 *     - JREC_SF01_Reservation.gs → uninstallSlotsRegenTrigger → Run
 *     - Confirm Logger: SLOTS_CRON_UNINSTALL removed=1
 *
 * Exit codes:
 *   0 = trigger active, count=1, idempotency OK
 *   1 = anything else (do NOT trust cron state)
 */
import { chromium, type Page, type FrameLocator } from "@playwright/test";

const DEV_URL =
  "https://script.google.com/macros/s/AKfycbzJWJAKCxStP82lfFl8eEHei98dWh7f6cgtEM33r3M5/dev?page=reservationAdmin";
const CDP_URL = "http://localhost:9222";
const TIMEOUT = 25_000;
const RPC_TIMEOUT = 40_000;
const TARGET_HOUR = 2; // 02:00 JST daily

interface Result { name: string; ok: boolean; detail: string; }
const results: Result[] = [];
function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log((ok ? "✅ PASS" : "❌ FAIL") + "  [" + name + "]  " + detail);
}
function gasAppFrame(page: Page): FrameLocator {
  return page.frameLocator("iframe").first().frameLocator("iframe").first();
}
async function callRpc(frame: FrameLocator, fn: string, args: unknown[]): Promise<unknown> {
  return await frame.locator("body").first().evaluate(
    (_el: Element, payload: { fn: string; args: unknown[] }) => {
      return new Promise((resolve, reject) => {
        const g = (window as unknown as { google?: { script?: { run?: Record<string, unknown> } } }).google;
        if (!g?.script?.run) { reject(new Error("google.script.run not available")); return; }
        const runner = g.script.run as Record<string, unknown>;
        const ws = (runner["withSuccessHandler"] as (h: (r: unknown) => void) => unknown)((r) => resolve(r));
        const wf = ((ws as Record<string, unknown>)["withFailureHandler"] as (h: (e: { message?: string }) => void) => unknown)((e) => reject(new Error("RPC failure: " + (e?.message || ""))));
        const fnRef = (wf as Record<string, unknown>)[payload.fn] as (...a: unknown[]) => unknown;
        if (typeof fnRef !== "function") { reject(new Error("RPC not found: " + payload.fn)); return; }
        fnRef.apply(null, payload.args);
      });
    },
    { fn, args }
  );
}
function timeoutAfter<T>(ms: number, msg: string): Promise<T> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(msg)), ms));
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  jrec-r2c-cron-enable — production cron activation");
  console.log("  ⚠ This script INTENTIONALLY leaves the trigger ACTIVE.");
  console.log("═══════════════════════════════════════════════════════════");

  const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 5000 });
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  page.setDefaultTimeout(TIMEOUT);
  await page.goto(DEV_URL, { waitUntil: "domcontentloaded" });
  const frame = gasAppFrame(page);
  await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: TIMEOUT });

  // 1) Pre-state: must be count=0 (verified-clean baseline from R-2C-B)
  try {
    const r = (await Promise.race([
      callRpc(frame, "listSlotsRegenTriggers", []),
      timeoutAfter(RPC_TIMEOUT, "list-pre timeout"),
    ])) as { ok: boolean; count: number; handler: string; error?: string };
    record("PRE_LIST", !!r?.ok && r.count === 0, `count=${r?.count} handler=${r?.handler}` + (r?.error ? ` err=${r.error}` : ""));
    if (!r?.ok || r.count !== 0) {
      console.error("\n❌ pre-state mismatch — expected count=0. abort activation.");
      process.exit(1);
    }
  } catch (e) { record("PRE_LIST", false, "exception: " + (e as Error).message); process.exit(1); }

  // 2) Install at hour=2
  let firstTriggerId = "";
  try {
    const r = (await Promise.race([
      callRpc(frame, "installSlotsRegenTrigger", [{ hour: TARGET_HOUR }]),
      timeoutAfter(RPC_TIMEOUT, "install timeout"),
    ])) as { ok: boolean; installed: boolean; triggerId?: string; hour: number; removed: number; error?: string };
    firstTriggerId = r?.triggerId || "";
    const ok = !!r?.ok && r.installed === true && r.hour === TARGET_HOUR && !!firstTriggerId;
    record(
      "INSTALL",
      ok,
      `ok=${r?.ok} installed=${r?.installed} hour=${r?.hour} triggerId=${firstTriggerId} removed=${r?.removed}` +
      (r?.error ? ` err=${r.error}` : "")
    );
    if (!ok) { process.exit(1); }
  } catch (e) { record("INSTALL", false, "exception: " + (e as Error).message); process.exit(1); }

  // 3) Idempotency: re-run install → removes prior, installs new, count stays 1
  let secondTriggerId = "";
  try {
    const r = (await Promise.race([
      callRpc(frame, "installSlotsRegenTrigger", [{ hour: TARGET_HOUR }]),
      timeoutAfter(RPC_TIMEOUT, "reinstall timeout"),
    ])) as { ok: boolean; installed: boolean; triggerId?: string; removed: number; hour: number };
    secondTriggerId = r?.triggerId || "";
    const removedAtLeast1 = (r?.removed ?? 0) >= 1;
    const newId = !!secondTriggerId && secondTriggerId !== firstTriggerId;
    record(
      "INSTALL_IDEMPOTENT",
      !!r?.ok && r.installed === true && removedAtLeast1 && newId,
      `removed=${r?.removed} newId=${newId} hour=${r?.hour}`
    );
  } catch (e) { record("INSTALL_IDEMPOTENT", false, "exception: " + (e as Error).message); }

  // 4) Post-list: exactly 1 active
  try {
    const r = (await Promise.race([
      callRpc(frame, "listSlotsRegenTriggers", []),
      timeoutAfter(RPC_TIMEOUT, "list-post timeout"),
    ])) as { ok: boolean; count: number; triggers: Array<{ id: string; handler: string; eventType: string; atHour: number | null }> };
    const handlerMatch = (r?.triggers || []).every((t) => t.handler === "runRegenerateReservationSlotsWithLog");
    record(
      "POST_LIST",
      !!r?.ok && r.count === 1 && handlerMatch,
      `count=${r?.count} handler-match=${handlerMatch} hours=${(r?.triggers || []).map((t) => t.atHour).join(",")}`
    );
  } catch (e) { record("POST_LIST", false, "exception: " + (e as Error).message); }

  // Summary
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  Summary");
  console.log("═══════════════════════════════════════════════════════════");
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log(`  total=${results.length}  pass=${passed}  fail=${failed}`);
  if (failed > 0) {
    console.log("\n❌ FAIL — cron activation state is uncertain.");
    console.log("   Run scripts/jrec-r2c-cron-disable.ts to remove any partial trigger,");
    console.log("   then investigate before retrying.");
    process.exit(1);
  }
  console.log("\n✅ ALL PASS — cron is LIVE at 02:00 JST daily.");
  console.log(`   triggerId: ${secondTriggerId}`);
  console.log("   handler:   runRegenerateReservationSlotsWithLog");
  console.log("   Disable:   npx tsx scripts/jrec-r2c-cron-disable.ts");
  process.exit(0);
}

main().catch((e) => { console.error("[cron-enable] 例外: " + (e?.message || e)); process.exit(1); });
