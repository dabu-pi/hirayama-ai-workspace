/**
 * Run runRegenerateReservationSlots via CDP google.script.run.
 * Used by R-2C-B to clear stale "today already past" slots so the
 * reservation-admin regression spec can pick a non-past slot.
 *
 * Side effect: Reservation_Slots is fully regenerated for tomorrow..+14 days.
 * Existing reservations are untouched (bookedCount is recomputed from them).
 */
import { chromium, type Page, type FrameLocator } from "@playwright/test";

const DEV_URL = "https://script.google.com/macros/s/AKfycbzJWJAKCxStP82lfFl8eEHei98dWh7f6cgtEM33r3M5/dev?page=reservationAdmin";
const CDP_URL = "http://localhost:9222";

function gasAppFrame(page: Page): FrameLocator {
  return page.frameLocator("iframe").first().frameLocator("iframe").first();
}

async function main() {
  const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 5000 });
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  page.setDefaultTimeout(60_000);
  await page.goto(DEV_URL, { waitUntil: "domcontentloaded" });
  const frame = gasAppFrame(page);
  await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: 30_000 });

  console.log("[regen-slots] calling runRegenerateReservationSlots()…");

  const result = await frame.locator("body").first().evaluate(
    () => new Promise((resolve) => {
      const g = (window as unknown as { google?: { script?: { run?: Record<string, unknown> } } }).google;
      if (!g?.script?.run) { resolve({ ok: false, error: "google.script.run unavailable" }); return; }
      const runner = g.script.run as Record<string, unknown>;
      const ws = (runner["withSuccessHandler"] as (h: (r: unknown) => void) => unknown)((r) => resolve(r));
      const wf = ((ws as Record<string, unknown>)["withFailureHandler"] as (h: (e: { message?: string }) => void) => unknown)((e) => resolve({ ok: false, error: e?.message || "" }));
      const fn = (wf as Record<string, unknown>)["runRegenerateReservationSlots"] as () => void;
      if (typeof fn !== "function") { resolve({ ok: false, error: "fn not found" }); return; }
      fn();
    })
  );

  console.log("[regen-slots] result:");
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch((e) => { console.error("[regen-slots] exception: " + (e?.message || e)); process.exit(1); });
