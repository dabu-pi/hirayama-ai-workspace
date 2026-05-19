/**
 * jrec-r2i-prod-smoke.ts
 *
 * Phase R-2I production smoke against deployment @85.
 *
 * Read-only checks against prod /exec:
 *   - DEPLOY_REACHABLE: prod page loads (filter-bar visible)
 *   - SLOT_PATTERN: getPublicAvailableWeek returns slots only in
 *       {09:00, 10:00, 11:00, 15:30, 16:30, 17:30} for weekdays + Saturday
 *     (this is the user-facing E2E that proves v2.2 hours are live in prod)
 *   - CONFIG_STATE: mode=gmail / recipient=pinshanka24@gmail.com
 *   - CRON_PRESERVED: triggers count=1
 *
 * Does NOT mutate state. Does NOT call MailApp.sendEmail.
 */
import { chromium, type Page, type FrameLocator } from "@playwright/test";

const PROD_URL =
  "https://script.google.com/macros/s/AKfycbxZbwHxDstE1sikW5ow7tyz99PMtg1S3uyAFq099E744f5lKlPbNzl_8fFA39KUMAZWyA/exec?page=reservationAdmin";
const CDP_URL = "http://localhost:9222";
const TIMEOUT = 25_000;
const RPC_TIMEOUT = 40_000;
const EXPECTED_RECIPIENT = "pinshanka24@gmail.com";
const ALLOWED_TIMES = new Set(["09:00", "10:00", "11:00", "15:30", "16:30", "17:30"]);

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
  console.log("  jrec-r2i-prod-smoke — Phase R-2I @85 prod check");
  console.log("═══════════════════════════════════════════════════════════");

  const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 5000 });
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  page.setDefaultTimeout(TIMEOUT);
  await page.goto(PROD_URL, { waitUntil: "domcontentloaded" });
  const frame = gasAppFrame(page);
  await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: TIMEOUT });
  record("DEPLOY_REACHABLE", true, "filter-bar visible at @85 /exec");

  // 1) slot pattern — fetch two weeks and check every slot.slotStart is in allowed set
  try {
    const today = new Date();
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    const w1 = (await Promise.race([
      callRpc(frame, "getPublicAvailableWeek", [iso(today)]),
      timeoutAfter(RPC_TIMEOUT, "week1 timeout"),
    ])) as { ok: boolean; days: Array<{ date: string; dow: number; isPast: boolean; slots: Array<{ slotStart: string }> }> };
    const next = new Date(today); next.setDate(next.getDate()+7);
    const w2 = (await Promise.race([
      callRpc(frame, "getPublicAvailableWeek", [iso(next)]),
      timeoutAfter(RPC_TIMEOUT, "week2 timeout"),
    ])) as { ok: boolean; days: Array<{ date: string; dow: number; isPast: boolean; slots: Array<{ slotStart: string }> }> };
    const all = [...(w1?.days || []), ...(w2?.days || [])];
    const offenders: string[] = [];
    let totalSlots = 0;
    for (const d of all) {
      if (d.isPast) continue;
      for (const s of d.slots || []) {
        totalSlots++;
        if (!ALLOWED_TIMES.has(s.slotStart)) offenders.push(`${d.date} ${s.slotStart}`);
      }
    }
    record(
      "SLOT_PATTERN",
      offenders.length === 0 && totalSlots > 0,
      `totalSlots=${totalSlots} offenders=${offenders.length}${offenders.length ? " ["+offenders.slice(0,5).join(", ")+"]" : ""}`
    );
  } catch (e) { record("SLOT_PATTERN", false, "exception: " + (e as Error).message); }

  // 2) config state — mode + recipient
  try {
    const r = (await Promise.race([
      callRpc(frame, "runDebugNotificationConfigV1", []),
      timeoutAfter(RPC_TIMEOUT, "config timeout"),
    ])) as { ok: boolean; mode: string; recipient: string };
    const ok = !!r?.ok && r.mode === "gmail" && r.recipient === EXPECTED_RECIPIENT;
    record("CONFIG_STATE", ok, `mode=${r?.mode}  recipient=${r?.recipient}`);
  } catch (e) { record("CONFIG_STATE", false, "exception: " + (e as Error).message); }

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
    console.log("\n❌ FAIL — R-2I prod state uncertain.");
    process.exit(1);
  }
  console.log("\n✅ ALL PASS — prod @85: only v2.2 slot times exposed, mode=gmail, cron count=1");
  process.exit(0);
}

main().catch((e) => { console.error("[r2i-prod-smoke] 例外: " + (e?.message || e)); process.exit(1); });
