/**
 * jrec-r2c-trigger-probe.ts
 *
 * Minimal one-off: probe /dev for the exact error message when calling
 * listSlotsRegenTriggers. Used to differentiate:
 *   - "script.scriptapp scope not granted yet" → user must re-auth
 *   - "scope granted, but /dev cache is stale" → user must re-open /dev
 *   - "everything works" → proceed to install/uninstall verify
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

async function main() {
  const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 5000 });
  const ctx = browser.contexts()[0];

  // Force a fresh /dev tab (close any existing /dev tabs first)
  for (const p of ctx.pages()) {
    if (p.url().includes("/dev?page=reservationAdmin")) {
      try { await p.close(); } catch {}
    }
  }
  const page = await ctx.newPage();
  page.setDefaultTimeout(TIMEOUT);
  await page.goto(DEV_URL, { waitUntil: "networkidle" });
  const frame = gasAppFrame(page);
  await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: TIMEOUT });

  console.log("[probe] page loaded; calling listSlotsRegenTriggers()…");

  const result = await frame.locator("body").first().evaluate(
    (_el: Element) => {
      return new Promise((resolve) => {
        const g = (window as unknown as { google?: { script?: { run?: Record<string, unknown> } } }).google;
        if (!g?.script?.run) { resolve({ ok: false, kind: "no-google-script-run" }); return; }
        const runner = g.script.run as Record<string, unknown>;
        const ws = (runner["withSuccessHandler"] as (h: (r: unknown) => void) => unknown)((r) => resolve({ ok: true, kind: "success", result: r }));
        const wf = ((ws as Record<string, unknown>)["withFailureHandler"] as (h: (e: { message?: string }) => void) => unknown)((e) => resolve({ ok: false, kind: "failure", message: e?.message || "" }));
        const fn = (wf as Record<string, unknown>)["listSlotsRegenTriggers"] as () => void;
        if (typeof fn !== "function") { resolve({ ok: false, kind: "fn-not-found" }); return; }
        try { fn(); } catch (e) { resolve({ ok: false, kind: "throw", message: String(e) }); }
      });
    }
  );

  console.log("\n[probe] result:");
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch((e) => { console.error("[probe] exception: " + (e?.message || e)); process.exit(1); });
