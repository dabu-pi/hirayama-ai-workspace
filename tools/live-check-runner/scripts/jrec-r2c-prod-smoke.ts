/**
 * jrec-r2c-prod-smoke.ts
 *
 * @77 production smoke for R-2C-A.
 *
 * What this verifies on prod /exec (not /dev):
 *   - runMigrateNotificationSettingsV1 is callable and idempotent (already-migrated -> all skipped)
 *   - runDebugBuildNotificationContentV1 returns the 4-event sample and masked phone
 *   - runDebugNotificationDryRunV1 returns ok with mode=dry_run, action=NOTIFY_DRYRUN
 *
 * NOT exercised in prod (intentional):
 *   - submitPublicReservation (would create a real prod reservation)
 *   - listSlotsRegenTriggers / installSlotsRegenTrigger (PENDING_SCOPE for R-2C-B)
 *
 * Connects to Chrome CDP 9222 (--user-data-dir=.chrome-cdp-profile).
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
  console.log("  jrec-r2c-prod-smoke — R-2C-A @77 prod smoke");
  console.log("═══════════════════════════════════════════════════════════");

  const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 5000 });
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  page.setDefaultTimeout(TIMEOUT);

  await page.goto(PROD_URL, { waitUntil: "domcontentloaded" });
  const frame = gasAppFrame(page);
  await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: TIMEOUT });

  // Migration: already migrated on /dev (shared spreadsheet)? expect added=0, skipped=5
  try {
    const r = (await Promise.race([
      callRpc(frame, "runMigrateNotificationSettingsV1", []),
      timeoutAfter(RPC_TIMEOUT, "migrate timeout"),
    ])) as { ok: boolean; added: string[]; skipped: string[]; total: number };
    record("MIGRATE_SETTINGS", !!r?.ok && (r.skipped?.length || 0) === 5 && (r.added?.length || 0) === 0,
      `added=${r?.added?.length} skipped=${r?.skipped?.length}`);
  } catch (e) { record("MIGRATE_SETTINGS", false, "exception: " + (e as Error).message); }

  // Content builder
  try {
    const r = (await Promise.race([
      callRpc(frame, "runDebugBuildNotificationContentV1", []),
      timeoutAfter(RPC_TIMEOUT, "content timeout"),
    ])) as { ok: boolean; samples: Record<string, { subject: string; body: string }>; maskedPhoneSample: string };
    const events = ["RESERVATION_CREATED", "RESERVATION_CONFIRMED", "RESERVATION_CANCELLED", "RESERVATION_NO_SHOW"];
    const allBuilt = events.every((e) => !!r?.samples?.[e]?.subject);
    const maskOk = r?.maskedPhoneSample === "090****1348";
    record("NOTIFY_CONTENT", !!r?.ok && allBuilt && maskOk, `all-built=${allBuilt} maskedPhoneSample='${r?.maskedPhoneSample}'`);
  } catch (e) { record("NOTIFY_CONTENT", false, "exception: " + (e as Error).message); }

  // Dry-run dispatch
  try {
    const r = (await Promise.race([
      callRpc(frame, "runDebugNotificationDryRunV1", []),
      timeoutAfter(RPC_TIMEOUT, "dryrun timeout"),
    ])) as { ok: boolean; mode: string; action: string; eventType: string };
    record("NOTIFY_DRYRUN", !!r?.ok && r.mode === "dry_run" && r.action === "NOTIFY_DRYRUN",
      `ok=${r?.ok} mode=${r?.mode} action=${r?.action} eventType=${r?.eventType}`);
  } catch (e) { record("NOTIFY_DRYRUN", false, "exception: " + (e as Error).message); }

  // Summary
  console.log("\n═══════════════════════════════════════════════════════════");
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log(`  total=${results.length}  pass=${passed}  fail=${failed}`);
  if (failed > 0) {
    console.log("\n❌ FAIL — R-2C-A prod is not behaving as expected.");
    process.exit(1);
  }
  console.log("\n✅ ALL PASS — R-2C-A @77 prod alive");
  process.exit(0);
}

main().catch((e) => { console.error("[smoke] 例外: " + (e?.message || e)); process.exit(1); });
