/**
 * jrec-r2c-gmail-set-recipient.ts
 *
 * Phase R-2C-gmail: set Reservation_Settings.notification_recipient_email via
 * google.script.run. Uses only the spreadsheets scope (already granted), so
 * this does NOT require the new script.send_mail scope.
 *
 * Usage:
 *   npx tsx scripts/jrec-r2c-gmail-set-recipient.ts <email>
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
  const email = process.argv[2];
  if (!email || email.indexOf("@") < 0) {
    console.error("usage: npx tsx scripts/jrec-r2c-gmail-set-recipient.ts <email>");
    process.exit(2);
  }

  const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 5000 });
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  page.setDefaultTimeout(TIMEOUT);
  await page.goto(DEV_URL, { waitUntil: "domcontentloaded" });
  const frame = gasAppFrame(page);
  await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: TIMEOUT });

  console.log("[set-recipient] writing notification_recipient_email = " + email);
  const setRes = (await Promise.race([
    callRpc(frame, "runSetNotificationRecipientV1", [email]),
    timeoutAfter(RPC_TIMEOUT, "set timeout"),
  ])) as { ok: boolean; recipient?: string; error?: string };
  console.log("[set-recipient] result: " + JSON.stringify(setRes));

  // Read back to confirm
  const cfgRes = (await Promise.race([
    callRpc(frame, "runDebugNotificationConfigV1", []),
    timeoutAfter(RPC_TIMEOUT, "config timeout"),
  ])) as { ok: boolean; mode: string; recipient: string };
  console.log("[set-recipient] readback: " + JSON.stringify(cfgRes));

  const ok = setRes?.ok && cfgRes?.recipient === email && cfgRes?.mode === "dry_run";
  if (ok) {
    console.log("\n✅ PASS — recipient set; mode remains 'dry_run' (no auto Gmail send yet)");
    process.exit(0);
  }
  console.log("\n❌ FAIL — recipient set unexpected; investigate before proceeding");
  process.exit(1);
}

main().catch((e) => { console.error("[set-recipient] 例外: " + (e?.message || e)); process.exit(1); });
