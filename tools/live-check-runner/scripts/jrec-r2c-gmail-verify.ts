/**
 * jrec-r2c-gmail-verify.ts
 *
 * Phase R-2C-gmail end-to-end verification on /dev.
 *
 * What it does:
 *   1. SCOPE_PROBE: r2cGmailAuthorizeSendMail returns daily quota (no email
 *      sent). Confirms script.send_mail scope is live in the runtime.
 *   2. CONFIG_READ: runDebugNotificationConfigV1 returns mode=dry_run +
 *      recipient=pinshanka24@gmail.com. Asserts the production guard rail
 *      (no auto Gmail) is intact.
 *   3. TEST_SEND: runDebugNotificationGmailTestSendV1 sends one controlled
 *      test email. Subject explicitly labels it as a test.
 *   4. DRYRUN_REGRESSION: runDebugNotificationDryRunV1 confirms the
 *      reservation-event dispatch still uses dry_run.
 *
 * Exit codes: 0 all PASS, 1 any FAIL.
 *
 * Side effects (per run):
 *   - 1 real email sent to the configured recipient with subject
 *     "[JREC] R-2C-gmail test send (yyyy-MM-dd HH:mm)"
 *   - Run_Log gains: NOTIFY_TEST_SEND (1), NOTIFY_DRYRUN (1)
 */
import { chromium, type Page, type FrameLocator } from "@playwright/test";

const DEV_URL =
  "https://script.google.com/macros/s/AKfycbzJWJAKCxStP82lfFl8eEHei98dWh7f6cgtEM33r3M5/dev?page=reservationAdmin";
const CDP_URL = "http://localhost:9222";
const TIMEOUT = 25_000;
const RPC_TIMEOUT = 60_000;
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
  console.log("  jrec-r2c-gmail-verify — Phase R-2C-gmail E2E check");
  console.log("═══════════════════════════════════════════════════════════");

  const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 5000 });
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  page.setDefaultTimeout(TIMEOUT);
  await page.goto(DEV_URL, { waitUntil: "domcontentloaded" });
  const frame = gasAppFrame(page);
  await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: TIMEOUT });

  // 1) Scope probe — must succeed without throw, quota numeric
  try {
    const r = (await Promise.race([
      callRpc(frame, "r2cGmailAuthorizeSendMail", []),
      timeoutAfter(RPC_TIMEOUT, "scope probe timeout"),
    ])) as { ok: boolean; quota: number };
    record("SCOPE_PROBE", !!r?.ok && typeof r.quota === "number", `quota=${r?.quota}`);
  } catch (e) { record("SCOPE_PROBE", false, "exception: " + (e as Error).message); }

  // 2) Config read — production guard: mode=dry_run, recipient set
  try {
    const r = (await Promise.race([
      callRpc(frame, "runDebugNotificationConfigV1", []),
      timeoutAfter(RPC_TIMEOUT, "config timeout"),
    ])) as { ok: boolean; mode: string; recipient: string };
    const ok = !!r?.ok && r.mode === "dry_run" && r.recipient === EXPECTED_RECIPIENT;
    record("CONFIG_READ_GUARD", ok, `mode=${r?.mode} recipient=${r?.recipient}`);
  } catch (e) { record("CONFIG_READ_GUARD", false, "exception: " + (e as Error).message); }

  // 3) Test send — one real email to the configured recipient
  try {
    const r = (await Promise.race([
      callRpc(frame, "runDebugNotificationGmailTestSendV1", [EXPECTED_RECIPIENT]),
      timeoutAfter(RPC_TIMEOUT, "test send timeout"),
    ])) as { ok: boolean; recipient?: string; subject?: string; error?: string };
    record(
      "TEST_SEND",
      !!r?.ok && r.recipient === EXPECTED_RECIPIENT && !!r.subject,
      `recipient=${r?.recipient} subject='${r?.subject}'` + (r?.error ? ` err=${r.error}` : "")
    );
  } catch (e) { record("TEST_SEND", false, "exception: " + (e as Error).message); }

  // 4) dry_run dispatch still routes through dry_run path (production guard)
  try {
    const r = (await Promise.race([
      callRpc(frame, "runDebugNotificationDryRunV1", []),
      timeoutAfter(RPC_TIMEOUT, "dryrun timeout"),
    ])) as { ok: boolean; mode: string; action: string };
    record(
      "DRYRUN_REGRESSION",
      !!r?.ok && r.mode === "dry_run" && r.action === "NOTIFY_DRYRUN",
      `mode=${r?.mode} action=${r?.action}`
    );
  } catch (e) { record("DRYRUN_REGRESSION", false, "exception: " + (e as Error).message); }

  console.log("\n═══════════════════════════════════════════════════════════");
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log(`  total=${results.length}  pass=${passed}  fail=${failed}`);
  if (failed > 0) {
    console.log("\n❌ FAIL — R-2C-gmail E2E uncertain.");
    process.exit(1);
  }
  console.log("\n✅ ALL PASS — script.send_mail scope live, 1 test email sent to " + EXPECTED_RECIPIENT);
  console.log("   notification_mode stays 'dry_run' (no auto Gmail in production).");
  process.exit(0);
}

main().catch((e) => { console.error("[gmail-verify] 例外: " + (e?.message || e)); process.exit(1); });
