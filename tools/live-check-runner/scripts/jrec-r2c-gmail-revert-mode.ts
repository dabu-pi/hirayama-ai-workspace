/**
 * jrec-r2c-gmail-revert-mode.ts
 *
 * Phase R-2C-gmail-enable companion. Sets notification_mode back to dry_run
 * via CDP. Use to:
 *   - Roll back if gmail-enable verification fails
 *   - Suppress Gmail during regression spec runs
 *
 * Companion to jrec-r2c-gmail-enable.ts (which sets mode=gmail).
 *
 * Usage:
 *   npx tsx scripts/jrec-r2c-gmail-revert-mode.ts             # → dry_run
 *   npx tsx scripts/jrec-r2c-gmail-revert-mode.ts gmail       # → gmail (same as enable.ts but no test submit)
 *   npx tsx scripts/jrec-r2c-gmail-revert-mode.ts disabled    # → disabled (no notification at all)
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
  const target = (process.argv[2] || "dry_run").toLowerCase();
  if (["disabled", "dry_run", "gmail"].indexOf(target) < 0) {
    console.error("usage: npx tsx scripts/jrec-r2c-gmail-revert-mode.ts <disabled|dry_run|gmail>");
    process.exit(2);
  }

  console.log("[mode-set] target = " + target);

  const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 5000 });
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  page.setDefaultTimeout(TIMEOUT);
  await page.goto(DEV_URL, { waitUntil: "domcontentloaded" });
  const frame = gasAppFrame(page);
  await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: TIMEOUT });

  const setRes = (await Promise.race([
    callRpc(frame, "runSetNotificationModeV1", [target]),
    timeoutAfter(RPC_TIMEOUT, "set timeout"),
  ])) as { ok: boolean; mode?: string; previousMode?: string; error?: string };
  console.log("[mode-set] result: " + JSON.stringify(setRes));

  const cfgRes = (await Promise.race([
    callRpc(frame, "runDebugNotificationConfigV1", []),
    timeoutAfter(RPC_TIMEOUT, "config timeout"),
  ])) as { ok: boolean; mode: string; recipient: string };
  console.log("[mode-set] readback: " + JSON.stringify(cfgRes));

  const ok = setRes?.ok && cfgRes?.mode === target;
  if (ok) {
    console.log(`\n✅ PASS — notification_mode = ${target} (was ${setRes?.previousMode || "?"})`);
    process.exit(0);
  }
  console.log("\n❌ FAIL — investigate before proceeding");
  process.exit(1);
}

main().catch((e) => { console.error("[mode-set] 例外: " + (e?.message || e)); process.exit(1); });
