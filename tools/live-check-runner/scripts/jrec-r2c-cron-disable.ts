/**
 * jrec-r2c-cron-disable.ts
 *
 * Phase R-2C-cron-enable companion: remove all production cron triggers
 * for runRegenerateReservationSlotsWithLog via google.script.run over CDP.
 *
 * Use when you want to deactivate the daily Reservation_Slots auto-regen.
 * Safe to re-run (idempotent: returns count=0 / removed=0 if nothing to do).
 *
 * Side effects:
 *   - All triggers with handler == runRegenerateReservationSlotsWithLog are deleted
 *   - 1 SLOTS_CRON_UNINSTALL row appended to Run_Log
 *
 * Exit codes:
 *   0 = post-state count=0 (no cron active)
 *   1 = anything else
 */
import { chromium, type Page, type FrameLocator } from "@playwright/test";

const DEV_URL =
  "https://script.google.com/macros/s/AKfycbzJWJAKCxStP82lfFl8eEHei98dWh7f6cgtEM33r3M5/dev?page=reservationAdmin";
const CDP_URL = "http://localhost:9222";
const TIMEOUT = 25_000;
const RPC_TIMEOUT = 40_000;

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
  console.log("  jrec-r2c-cron-disable — deactivate Reservation_Slots cron");
  console.log("═══════════════════════════════════════════════════════════");

  const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 5000 });
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  page.setDefaultTimeout(TIMEOUT);
  await page.goto(DEV_URL, { waitUntil: "domcontentloaded" });
  const frame = gasAppFrame(page);
  await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: TIMEOUT });

  // Pre-list
  try {
    const r = (await Promise.race([
      callRpc(frame, "listSlotsRegenTriggers", []),
      timeoutAfter(RPC_TIMEOUT, "list-pre timeout"),
    ])) as { ok: boolean; count: number; handler: string };
    record("PRE_LIST", !!r?.ok, `count=${r?.count} handler=${r?.handler}`);
  } catch (e) { record("PRE_LIST", false, "exception: " + (e as Error).message); }

  // Uninstall
  try {
    const r = (await Promise.race([
      callRpc(frame, "uninstallSlotsRegenTrigger", []),
      timeoutAfter(RPC_TIMEOUT, "uninstall timeout"),
    ])) as { ok: boolean; removed: number; handler: string; error?: string };
    record("UNINSTALL", !!r?.ok, `removed=${r?.removed} handler=${r?.handler}` + (r?.error ? ` err=${r.error}` : ""));
  } catch (e) { record("UNINSTALL", false, "exception: " + (e as Error).message); }

  // Post-list: must be 0
  try {
    const r = (await Promise.race([
      callRpc(frame, "listSlotsRegenTriggers", []),
      timeoutAfter(RPC_TIMEOUT, "list-post timeout"),
    ])) as { ok: boolean; count: number };
    record("POST_LIST", !!r?.ok && r.count === 0, `count=${r?.count}`);
  } catch (e) { record("POST_LIST", false, "exception: " + (e as Error).message); }

  console.log("\n═══════════════════════════════════════════════════════════");
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log(`  total=${results.length}  pass=${passed}  fail=${failed}`);
  if (failed > 0) {
    console.log("\n❌ FAIL — cron disable state uncertain. Open Apps Script editor and check.");
    process.exit(1);
  }
  console.log("\n✅ ALL PASS — cron is DISABLED. Production triggers = 0.");
  process.exit(0);
}

main().catch((e) => { console.error("[cron-disable] 例外: " + (e?.message || e)); process.exit(1); });
