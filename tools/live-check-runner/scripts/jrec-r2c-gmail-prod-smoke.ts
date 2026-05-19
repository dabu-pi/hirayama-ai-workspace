/**
 * jrec-r2c-gmail-prod-smoke.ts
 *
 * Phase R-2C-gmail @79 production smoke.
 *
 * Read-only checks against prod /exec:
 *   - SCOPE_PROBE: r2cGmailAuthorizeSendMail returns quota (script.send_mail scope live in prod)
 *   - CONFIG_GUARD: mode=dry_run + recipient=pinshanka24@gmail.com (production guard rail intact)
 *   - CRON_PRESERVED: triggers count=1 / handler matches (cron untouched by deploy)
 *
 * Does NOT call MailApp.sendEmail to avoid spam. The dev-time gmail-verify
 * already sent + received one email; this smoke just confirms the
 * production-side state is correct after deploy.
 */
import { chromium, type Page, type FrameLocator } from "@playwright/test";

const PROD_URL =
  "https://script.google.com/macros/s/AKfycbyOtef10SuH7R1SaDVMBZS7L9yZIBYpEIVmNdS_fhz3hUtc1b0PSKvtzwRxQ6I43YObEA/exec?page=reservationAdmin";
const CDP_URL = "http://localhost:9222";
const TIMEOUT = 25_000;
const RPC_TIMEOUT = 40_000;
const EXPECTED_RECIPIENT = "pinshanka24@gmail.com";

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
  console.log("  jrec-r2c-gmail-prod-smoke — Phase R-2C-gmail @79 prod check");
  console.log("═══════════════════════════════════════════════════════════");

  const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 5000 });
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  page.setDefaultTimeout(TIMEOUT);
  await page.goto(PROD_URL, { waitUntil: "domcontentloaded" });
  const frame = gasAppFrame(page);
  await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: TIMEOUT });

  // 1) scope
  try {
    const r = (await Promise.race([
      callRpc(frame, "r2cGmailAuthorizeSendMail", []),
      timeoutAfter(RPC_TIMEOUT, "scope timeout"),
    ])) as { ok: boolean; quota: number };
    record("SCOPE_PROBE", !!r?.ok && typeof r.quota === "number", `quota=${r?.quota}`);
  } catch (e) { record("SCOPE_PROBE", false, "exception: " + (e as Error).message); }

  // 2) config guard
  try {
    const r = (await Promise.race([
      callRpc(frame, "runDebugNotificationConfigV1", []),
      timeoutAfter(RPC_TIMEOUT, "config timeout"),
    ])) as { ok: boolean; mode: string; recipient: string };
    const ok = !!r?.ok && r.mode === "dry_run" && r.recipient === EXPECTED_RECIPIENT;
    record("CONFIG_GUARD", ok, `mode=${r?.mode} recipient=${r?.recipient}`);
  } catch (e) { record("CONFIG_GUARD", false, "exception: " + (e as Error).message); }

  // 3) cron preserved
  try {
    const r = (await Promise.race([
      callRpc(frame, "listSlotsRegenTriggers", []),
      timeoutAfter(RPC_TIMEOUT, "triggers timeout"),
    ])) as { ok: boolean; count: number; triggers: Array<{ handler: string }> };
    const handlerMatch = (r?.triggers || []).every((t) => t.handler === "runRegenerateReservationSlotsWithLog");
    record("CRON_PRESERVED", !!r?.ok && r.count === 1 && handlerMatch, `count=${r?.count} handler-match=${handlerMatch}`);
  } catch (e) { record("CRON_PRESERVED", false, "exception: " + (e as Error).message); }

  console.log("\n═══════════════════════════════════════════════════════════");
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log(`  total=${results.length}  pass=${passed}  fail=${failed}`);
  if (failed > 0) {
    console.log("\n❌ FAIL — R-2C-gmail prod state uncertain.");
    process.exit(1);
  }
  console.log("\n✅ ALL PASS — @79 prod: send_mail scope live, mode=dry_run guard intact, cron count=1 preserved");
  process.exit(0);
}

main().catch((e) => { console.error("[gmail-prod-smoke] 例外: " + (e?.message || e)); process.exit(1); });
