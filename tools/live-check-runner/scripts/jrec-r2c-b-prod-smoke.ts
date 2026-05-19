/**
 * jrec-r2c-b-prod-smoke.ts
 *
 * @78 production smoke for R-2C-B.
 *
 * Verifies on prod /exec (NOT /dev):
 *   - R-2C-A dry_run notification still works (regression check)
 *   - listSlotsRegenTriggers is callable (scope live in prod deployment)
 *   - triggers count is 0 (no live cron in prod)
 *
 * Does NOT install or uninstall triggers — read-only smoke.
 */
import { chromium, type Page, type FrameLocator } from "@playwright/test";

const PROD_URL =
  "https://script.google.com/macros/s/AKfycbyOtef10SuH7R1SaDVMBZS7L9yZIBYpEIVmNdS_fhz3hUtc1b0PSKvtzwRxQ6I43YObEA/exec?page=reservationAdmin";
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
  console.log("  jrec-r2c-b-prod-smoke — R-2C-B @78 prod smoke");
  console.log("═══════════════════════════════════════════════════════════");

  const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 5000 });
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  page.setDefaultTimeout(TIMEOUT);

  await page.goto(PROD_URL, { waitUntil: "domcontentloaded" });
  const frame = gasAppFrame(page);
  await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: TIMEOUT });

  // R-2C-A regression: dry_run dispatch still works
  try {
    const r = (await Promise.race([
      callRpc(frame, "runDebugNotificationDryRunV1", []),
      timeoutAfter(RPC_TIMEOUT, "dryrun timeout"),
    ])) as { ok: boolean; mode: string; action: string };
    record("R2C_A_NOTIFY_DRYRUN", !!r?.ok && r.mode === "dry_run" && r.action === "NOTIFY_DRYRUN", `mode=${r?.mode} action=${r?.action}`);
  } catch (e) { record("R2C_A_NOTIFY_DRYRUN", false, "exception: " + (e as Error).message); }

  // R-2C-B: listSlotsRegenTriggers callable (scope live in prod), result ok and count=0
  try {
    const r = (await Promise.race([
      callRpc(frame, "listSlotsRegenTriggers", []),
      timeoutAfter(RPC_TIMEOUT, "list timeout"),
    ])) as { ok: boolean; count: number; handler: string; error?: string };
    record(
      "R2C_B_LIST_TRIGGERS_LIVE",
      !!r?.ok && r.count === 0 && r.handler === "runRegenerateReservationSlotsWithLog",
      `ok=${r?.ok} count=${r?.count} handler=${r?.handler}` + (r?.error ? ` err=${r.error}` : "")
    );
  } catch (e) { record("R2C_B_LIST_TRIGGERS_LIVE", false, "exception: " + (e as Error).message); }

  // R-2C-B: r2cBAuthorizeScriptApp callable + count=0 (read-only test of the auth helper itself)
  try {
    const r = (await Promise.race([
      callRpc(frame, "r2cBAuthorizeScriptApp", []),
      timeoutAfter(RPC_TIMEOUT, "auth helper timeout"),
    ])) as { ok: boolean; count: number };
    record("R2C_B_AUTH_HELPER_LIVE", !!r?.ok && r.count === 0, `ok=${r?.ok} count=${r?.count}`);
  } catch (e) { record("R2C_B_AUTH_HELPER_LIVE", false, "exception: " + (e as Error).message); }

  console.log("\n═══════════════════════════════════════════════════════════");
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log(`  total=${results.length}  pass=${passed}  fail=${failed}`);
  if (failed > 0) {
    console.log("\n❌ FAIL — R-2C-B prod is not behaving as expected.");
    process.exit(1);
  }
  console.log("\n✅ ALL PASS — R-2C-B @78 prod alive, no live cron in production");
  process.exit(0);
}

main().catch((e) => { console.error("[smoke] 例外: " + (e?.message || e)); process.exit(1); });
