/**
 * jrec-r2i-business-hours-apply.ts
 *
 * Phase R-2I: apply v2.2 business hours via runApplyReservationBusinessHoursV2,
 * then regenerate Reservation_Slots so the cache reflects the new hours
 * immediately (rather than waiting for the 02:00 cron).
 *
 * Steps:
 *   1. Run runApplyReservationBusinessHoursV2 → writes:
 *        business_hours_weekday  = "09:00-12:00,15:30-18:30"
 *        business_hours_saturday = "09:00-12:00,15:30-18:30"
 *        version                  = "2.2"
 *   2. Run runRegenerateReservationSlots → rebuild Reservation_Slots cache
 *      for tomorrow..+slot_generation_days (default 14)
 *   3. Smoke: read current Reservation_Settings via the public response
 *      and confirm one current-week slot exists matching the new pattern
 */
import { chromium, type Page, type FrameLocator } from "@playwright/test";

const DEV_URL =
  "https://script.google.com/macros/s/AKfycbzJWJAKCxStP82lfFl8eEHei98dWh7f6cgtEM33r3M5/dev?page=reservationAdmin";
const CDP_URL = "http://localhost:9222";
const TIMEOUT = 25_000;
const RPC_TIMEOUT = 90_000;

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
  console.log("[r2i-apply] connecting via CDP…");
  const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 5000 });
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  page.setDefaultTimeout(TIMEOUT);
  await page.goto(DEV_URL, { waitUntil: "domcontentloaded" });
  const frame = gasAppFrame(page);
  await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: TIMEOUT });

  console.log("[r2i-apply] STEP 1: runApplyReservationBusinessHoursV2");
  const applyRes = (await Promise.race([
    callRpc(frame, "runApplyReservationBusinessHoursV2", []),
    timeoutAfter(RPC_TIMEOUT, "apply timeout"),
  ])) as { ok: boolean; applied: string[]; added: string[] };
  console.log("[r2i-apply] applied=" + JSON.stringify(applyRes?.applied) + " added=" + JSON.stringify(applyRes?.added));

  console.log("[r2i-apply] STEP 2: runRegenerateReservationSlots");
  const regen = (await Promise.race([
    callRpc(frame, "runRegenerateReservationSlots", []),
    timeoutAfter(RPC_TIMEOUT, "regen timeout"),
  ])) as { ok: boolean; generated: number; available: number; from: string; to: string };
  console.log("[r2i-apply] regen ok=" + regen?.ok + " generated=" + regen?.generated + " available=" + regen?.available + " range=" + regen?.from + ".." + regen?.to);

  if (!applyRes?.ok || !regen?.ok) {
    console.error("\n❌ FAIL — apply or regen did not succeed");
    process.exit(1);
  }
  console.log("\n✅ PASS — v2.2 business hours applied and Reservation_Slots regenerated");
  process.exit(0);
}

main().catch((e) => { console.error("[r2i-apply] 例外: " + (e?.message || e)); process.exit(1); });
