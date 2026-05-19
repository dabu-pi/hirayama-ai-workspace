/**
 * jrec-r2e-clinic-phone-migrate.ts
 *
 * Phase R-2E: idempotent migration to add `Settings.clinic_phone` row (empty
 * value) via CDP google.script.run. Does NOT overwrite existing value if any.
 *
 * Also reports the current status (set / unset) without exposing the value
 * itself.
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
  console.log("[clinic-phone-migrate] migrating Settings.clinic_phone (idempotent)…");

  const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 5000 });
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  page.setDefaultTimeout(TIMEOUT);
  await page.goto(DEV_URL, { waitUntil: "domcontentloaded" });
  const frame = gasAppFrame(page);
  await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: TIMEOUT });

  const mig = (await Promise.race([
    callRpc(frame, "runMigrateClinicPhoneSettingV1", []),
    timeoutAfter(RPC_TIMEOUT, "migrate timeout"),
  ])) as { ok: boolean; added: boolean; currentValue: string };
  console.log("[clinic-phone-migrate] migration result: ok=" + mig?.ok + " added=" + mig?.added);

  const stat = (await Promise.race([
    callRpc(frame, "runDebugClinicPhoneStatusV1", []),
    timeoutAfter(RPC_TIMEOUT, "status timeout"),
  ])) as { ok: boolean; set: boolean; length: number };
  console.log("[clinic-phone-migrate] status: set=" + stat?.set + " length=" + stat?.length + " (value 内容は表示しない)");

  if (!mig?.ok) { console.log("\n❌ FAIL"); process.exit(1); }
  console.log("\n✅ PASS — Settings.clinic_phone row present (value 表示は意図的に省略 / PII 保護)");
  process.exit(0);
}

main().catch((e) => { console.error("[clinic-phone-migrate] 例外: " + (e?.message || e)); process.exit(1); });
