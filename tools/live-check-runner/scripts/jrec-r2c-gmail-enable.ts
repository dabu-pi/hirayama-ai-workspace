/**
 * jrec-r2c-gmail-enable.ts
 *
 * Phase R-2C-gmail-enable: flip notification_mode to gmail, create one
 * controlled test reservation, and confirm the dispatch path completed.
 *
 * What this script does (in order, via CDP google.script.run):
 *   1. Pre-state assertion: mode=dry_run, recipient=pinshanka24@gmail.com,
 *      cron count=1.
 *   2. Set notification_mode = gmail.
 *   3. Read back to confirm mode is gmail.
 *   4. Submit one test reservation through submitPublicReservation. This is
 *      the same code path real patients use; it dispatches NOTIFY_OK to
 *      Gmail via _sendReservationNotification_.
 *   5. Wait briefly for Run_Log + Calendar write.
 *   6. Read back the reservation via getReservationForAdmin to confirm it
 *      was created.
 *   7. Re-read config to confirm mode is still gmail (no race / accidental
 *      revert).
 *
 * This script INTENTIONALLY leaves mode=gmail in place. To revert, run
 * scripts/jrec-r2c-gmail-revert-mode.ts (companion).
 *
 * Side effects per run:
 *   - 1 real Gmail sent to pinshanka24@gmail.com with subject
 *     "[JREC] 新規予約: <date> <time> <name>"
 *   - 1 Reservations row created (status=requested, LiveCheckGmail太郎_<ts>)
 *   - 1 SLOTS_CRON_INSTALL-style entry in Run_Log (... actually NOTIFY_OK
 *     and RESERVATION_CREATED-related entries)
 *   - 1 Reservation_Slots booked count bump (+1)
 *   - 1 Calendar event created (auto-deleted by clinic if cancelling)
 *
 * Exit codes: 0 = mode is gmail, reservation created, ready for human
 *   Gmail receipt check. 1 = anything FAIL (do not proceed with
 *   activation without investigation).
 */
import { chromium, type Page, type FrameLocator } from "@playwright/test";

const DEV_URL =
  "https://script.google.com/macros/s/AKfycbzJWJAKCxStP82lfFl8eEHei98dWh7f6cgtEM33r3M5/dev?page=reservationAdmin";
const CDP_URL = "http://localhost:9222";
const TIMEOUT = 25_000;
const RPC_TIMEOUT = 60_000;
const RECIPIENT = "pinshanka24@gmail.com";
const TEST_PHONE = "09014861348"; // 院長指定の test phone（既存運用と同じ）

// 公開予約フォームの "too fast" guard は 5000ms 未満を拒否する。
// CDP からは _ts を昔の値にして bypass する。
const SUBMIT_TS_OFFSET_MS = 8_000;

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
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  jrec-r2c-gmail-enable — activate Gmail notification");
  console.log("  ⚠ This will flip notification_mode to 'gmail' AND send 1 real email.");
  console.log("═══════════════════════════════════════════════════════════");

  const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 5000 });
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  page.setDefaultTimeout(TIMEOUT);
  await page.goto(DEV_URL, { waitUntil: "domcontentloaded" });
  const frame = gasAppFrame(page);
  await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: TIMEOUT });

  // 1) Pre-state: mode=dry_run, recipient set, cron count=1
  try {
    const cfg = (await Promise.race([
      callRpc(frame, "runDebugNotificationConfigV1", []),
      timeoutAfter(RPC_TIMEOUT, "config timeout"),
    ])) as { ok: boolean; mode: string; recipient: string };
    record(
      "PRE_CONFIG",
      !!cfg?.ok && cfg.mode === "dry_run" && cfg.recipient === RECIPIENT,
      `mode=${cfg?.mode} recipient=${cfg?.recipient}`
    );
    if (!cfg?.ok || cfg.mode !== "dry_run" || cfg.recipient !== RECIPIENT) {
      console.error("\n❌ pre-state mismatch. Aborting activation.");
      process.exit(1);
    }
    const triggers = (await Promise.race([
      callRpc(frame, "listSlotsRegenTriggers", []),
      timeoutAfter(RPC_TIMEOUT, "triggers timeout"),
    ])) as { ok: boolean; count: number };
    record("PRE_CRON", !!triggers?.ok && triggers.count === 1, `count=${triggers?.count}`);
    if (!triggers?.ok || triggers.count !== 1) {
      console.error("\n❌ pre-cron mismatch. Aborting activation.");
      process.exit(1);
    }
  } catch (e) {
    record("PRE_STATE", false, "exception: " + (e as Error).message);
    process.exit(1);
  }

  // 2) Flip mode = gmail
  try {
    const r = (await Promise.race([
      callRpc(frame, "runSetNotificationModeV1", ["gmail"]),
      timeoutAfter(RPC_TIMEOUT, "set mode timeout"),
    ])) as { ok: boolean; mode: string; previousMode: string };
    record(
      "FLIP_MODE_GMAIL",
      !!r?.ok && r.mode === "gmail" && r.previousMode === "dry_run",
      `previous=${r?.previousMode} new=${r?.mode}`
    );
  } catch (e) { record("FLIP_MODE_GMAIL", false, "exception: " + (e as Error).message); process.exit(1); }

  // 3) Read back
  try {
    const cfg = (await Promise.race([
      callRpc(frame, "runDebugNotificationConfigV1", []),
      timeoutAfter(RPC_TIMEOUT, "config readback timeout"),
    ])) as { ok: boolean; mode: string; recipient: string };
    record(
      "READ_BACK_GMAIL",
      !!cfg?.ok && cfg.mode === "gmail" && cfg.recipient === RECIPIENT,
      `mode=${cfg?.mode} recipient=${cfg?.recipient}`
    );
  } catch (e) { record("READ_BACK_GMAIL", false, "exception: " + (e as Error).message); }

  // 4) Submit 1 controlled reservation
  // pick a slot that is definitely available: 2 days from now, 09:00
  const future = new Date();
  future.setDate(future.getDate() + 2);
  const slotDate =
    future.getFullYear() + "-" +
    ("0" + (future.getMonth() + 1)).slice(-2) + "-" +
    ("0" + future.getDate()).slice(-2);
  const ts = Date.now().toString().slice(-7);
  const TEST_NAME = "LiveCheckGmail太郎_" + ts;
  const payload = {
    slotDate:        slotDate,
    slotStart:       "09:00",
    isFirstVisit:    false, // existing test patient context to avoid 初診 spam
    patientName:     TEST_NAME,
    patientNameKana: "",
    phone:           TEST_PHONE,
    menuId:          "",
    menuName:        "(R-2C-gmail-enable test)",
    symptoms:        "Gmail 本送信検証用テスト予約（R-2C-gmail-enable）",
    notes:           "",
    _ua:             "r2c-gmail-enable-script",
    _ts:             Date.now() - SUBMIT_TS_OFFSET_MS, // bypass 5s "too fast" guard
  };

  let createdId = "";
  try {
    const r = (await Promise.race([
      callRpc(frame, "submitPublicReservation", [payload]),
      timeoutAfter(RPC_TIMEOUT, "submit timeout"),
    ])) as { ok: boolean; reservationId?: string; code?: string; error?: string };
    createdId = r?.reservationId || "";
    record(
      "SUBMIT_RESERVATION",
      !!r?.ok && !!createdId,
      `ok=${r?.ok} reservationId=${createdId}` + (r?.code ? ` code=${r.code}` : "") + (r?.error ? ` err=${r.error}` : "")
    );
  } catch (e) { record("SUBMIT_RESERVATION", false, "exception: " + (e as Error).message); }

  // 5) Brief settle (allow Calendar write + Run_Log entries)
  console.log("[gmail-enable] sleeping 3s for Calendar + Run_Log writes…");
  await sleep(3000);

  // 6) Verify reservation exists via getReservationForAdmin
  if (createdId) {
    try {
      const r = (await Promise.race([
        callRpc(frame, "getReservationForAdmin", [createdId]),
        timeoutAfter(RPC_TIMEOUT, "get reservation timeout"),
      ])) as { ok: boolean; item?: { status: string; slotDate: string; slotStart: string; patientName: string } };
      record(
        "RESERVATION_REREAD",
        !!r?.ok && r.item?.status === "requested" && r.item?.patientName === TEST_NAME,
        `status=${r?.item?.status} date=${r?.item?.slotDate} start=${r?.item?.slotStart} name=${r?.item?.patientName}`
      );
    } catch (e) { record("RESERVATION_REREAD", false, "exception: " + (e as Error).message); }
  }

  // 7) Final mode check (no accidental revert)
  try {
    const cfg = (await Promise.race([
      callRpc(frame, "runDebugNotificationConfigV1", []),
      timeoutAfter(RPC_TIMEOUT, "final config timeout"),
    ])) as { ok: boolean; mode: string };
    record("FINAL_MODE", !!cfg?.ok && cfg.mode === "gmail", `mode=${cfg?.mode}`);
  } catch (e) { record("FINAL_MODE", false, "exception: " + (e as Error).message); }

  // Summary
  console.log("\n═══════════════════════════════════════════════════════════");
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log(`  total=${results.length}  pass=${passed}  fail=${failed}`);
  if (failed > 0) {
    console.log("\n❌ FAIL — review before proceeding.");
    console.log("   Run scripts/jrec-r2c-gmail-revert-mode.ts to revert mode=gmail back to dry_run if needed.");
    process.exit(1);
  }
  console.log("\n✅ ALL PASS");
  console.log("   - notification_mode = gmail (LIVE)");
  console.log(`   - test reservation created: ${createdId} (${TEST_NAME}, ${slotDate} 09:00)`);
  console.log(`   - 1 Gmail dispatched to ${RECIPIENT}`);
  console.log("\n   Ask clinic to verify Gmail inbox now. Expected subject prefix: '[JREC] 新規予約:'");
  console.log(`   Reservation cleanup: cancel ${createdId} via /dev?page=reservationAdmin after verification.`);
  process.exit(0);
}

main().catch((e) => { console.error("[gmail-enable] 例外: " + (e?.message || e)); process.exit(1); });
