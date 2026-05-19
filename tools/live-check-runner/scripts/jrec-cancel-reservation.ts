/**
 * jrec-cancel-reservation.ts
 *
 * One-off helper: cancel a specific reservation via google.script.run.
 * Useful for cleaning up test data after R-2C-gmail-enable verification.
 *
 * Usage:
 *   npx tsx scripts/jrec-cancel-reservation.ts <reservationId> [reason]
 */
import { chromium, type Page, type FrameLocator } from "@playwright/test";

const DEV_URL =
  "https://script.google.com/macros/s/AKfycbzJWJAKCxStP82lfFl8eEHei98dWh7f6cgtEM33r3M5/dev?page=reservationAdmin";
const CDP_URL = "http://localhost:9222";
const TIMEOUT = 25_000;
const RPC_TIMEOUT = 40_000;

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
  const rid = process.argv[2];
  const reason = process.argv[3] || "test cleanup";
  if (!rid) {
    console.error("usage: npx tsx scripts/jrec-cancel-reservation.ts <reservationId> [reason]");
    process.exit(2);
  }

  console.log("[cancel] target reservationId = " + rid);

  const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 5000 });
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  page.setDefaultTimeout(TIMEOUT);
  await page.goto(DEV_URL, { waitUntil: "domcontentloaded" });
  const frame = gasAppFrame(page);
  await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: TIMEOUT });

  const r = (await Promise.race([
    callRpc(frame, "updateReservationStatus", [rid, "cancelled", reason]),
    timeoutAfter(RPC_TIMEOUT, "cancel timeout"),
  ])) as { ok: boolean; oldStatus?: string; newStatus?: string; slotReleased?: boolean; calendarDeleted?: boolean; calendarDeleteReason?: string; error?: string };

  console.log("[cancel] result:");
  console.log(JSON.stringify(r, null, 2));

  if (!r?.ok) {
    console.log("\n❌ FAIL");
    process.exit(1);
  }
  console.log(`\n✅ PASS — ${r.oldStatus} → ${r.newStatus}, slot released=${r.slotReleased}, calendar deleted=${r.calendarDeleted ?? "skipped"}`);
  process.exit(0);
}

main().catch((e) => { console.error("[cancel] 例外: " + (e?.message || e)); process.exit(1); });
