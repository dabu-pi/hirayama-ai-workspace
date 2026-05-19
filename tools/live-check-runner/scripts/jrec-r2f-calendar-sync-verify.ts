/**
 * jrec-r2f-calendar-sync-verify.ts
 *
 * Phase R-2F: end-to-end calendar sync verification on /dev.
 *
 * Flow:
 *   1. MIGRATE_SETTINGS   runMigrateCalendarSyncSettingsV1 (idempotent)
 *   2. STATUS             runDebugCalendarSyncStatusV1: sync on, live filter on, calendar reachable
 *   3. BASELINE_SLOTS     getPublicAvailableWeek for next week, pick a target slot
 *   4. CREATE_BUSY_EVENT  runDebugCreateR2fTestBusyEventV1 on the target window
 *   5. AFTER_BUSY_SLOTS   getPublicAvailableWeek again: target slot must be GONE
 *   6. CLEANUP_DELETE_EVENT  runDebugDeleteR2fTestBusyEventV1 (in finally, always)
 *   7. RESTORED_SLOTS     getPublicAvailableWeek again: target slot must be BACK
 *
 * PII guarantees:
 *   - The test event title is "R-2F-test (do not book)" — no patient info
 *   - getPublicAvailableWeek never returns event titles / descriptions / locations
 *   - This script never logs the title; only the event id (opaque)
 *
 * Side effects:
 *   - One R-2F-test event is created and DELETED in finally even on failure
 *   - Run_Log gains R2F_TEST_BUSY_CREATE + R2F_TEST_BUSY_DELETE
 *
 * Safe to run while notification_mode=gmail (no reservation submit).
 */
import { chromium, type Page, type FrameLocator } from "@playwright/test";

const DEV_URL =
  "https://script.google.com/macros/s/AKfycbzJWJAKCxStP82lfFl8eEHei98dWh7f6cgtEM33r3M5/dev?page=reservationAdmin";
const CDP_URL = "http://localhost:9222";
const TIMEOUT = 25_000;
const RPC_TIMEOUT = 60_000;

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

type SlotsRes = {
  ok: boolean;
  weekStart: string;
  weekEnd: string;
  capacity: number;
  calendarOverlay?: { attempted: boolean; removed: number; error: string | null };
  days: Array<{
    date: string;
    isPast: boolean;
    slots: Array<{ slotStart: string; slotEnd: string; remaining: number }>;
  }>;
};

function pickFutureSlot(res: SlotsRes): { date: string; slotStart: string; slotEnd: string } | null {
  for (const d of (res.days || [])) {
    if (d.isPast) continue;
    if (!d.slots || d.slots.length === 0) continue;
    // pick a slot that's at least ~2h in the future to give Calendar time to settle
    const now = Date.now();
    for (const s of d.slots) {
      const startMs = Date.parse(d.date + "T" + s.slotStart + ":00+09:00");
      if (startMs > now + 2 * 60 * 60 * 1000) return { date: d.date, slotStart: s.slotStart, slotEnd: s.slotEnd };
    }
  }
  return null;
}

function findSlot(res: SlotsRes, date: string, slotStart: string): { remaining: number } | null {
  const day = (res.days || []).find((d) => d.date === date);
  if (!day) return null;
  const s = (day.slots || []).find((x) => x.slotStart === slotStart);
  return s ? { remaining: s.remaining } : null;
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  jrec-r2f-calendar-sync-verify");
  console.log("  ⚠ 1 件のテスト event を Calendar に作成 → 検証 → finally で必ず削除");
  console.log("═══════════════════════════════════════════════════════════");

  const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 5000 });
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  page.setDefaultTimeout(TIMEOUT);
  await page.goto(DEV_URL, { waitUntil: "domcontentloaded" });
  const frame = gasAppFrame(page);
  await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: TIMEOUT });

  // 1. migrate settings
  try {
    const r = (await Promise.race([
      callRpc(frame, "runMigrateCalendarSyncSettingsV1", []),
      timeoutAfter(RPC_TIMEOUT, "migrate timeout"),
    ])) as { ok: boolean; added: string[]; skipped: string[] };
    record("MIGRATE_SETTINGS", !!r?.ok, `added=${r?.added?.length} skipped=${r?.skipped?.length}`);
  } catch (e) { record("MIGRATE_SETTINGS", false, "exception: " + (e as Error).message); }

  // 2. status
  try {
    const r = (await Promise.race([
      callRpc(frame, "runDebugCalendarSyncStatusV1", []),
      timeoutAfter(RPC_TIMEOUT, "status timeout"),
    ])) as { ok: boolean; syncEnabled: boolean; liveFilterEnabled: boolean; calendarReachable: boolean; calendarId: string };
    const ok = !!r?.ok && r.syncEnabled && r.liveFilterEnabled && r.calendarReachable;
    record(
      "STATUS",
      ok,
      `sync=${r?.syncEnabled} liveFilter=${r?.liveFilterEnabled} reachable=${r?.calendarReachable} calendarId='${r?.calendarId || "(primary)"}'`
    );
  } catch (e) { record("STATUS", false, "exception: " + (e as Error).message); }

  // 3. baseline: pick a future slot in next week
  // Use next Sunday as weekStartYmd so we always look ahead
  const today = new Date();
  const nextSun = new Date(today.getFullYear(), today.getMonth(), today.getDate() + (7 - today.getDay()));
  const weekStartYmd =
    nextSun.getFullYear() + "-" +
    ("0" + (nextSun.getMonth() + 1)).slice(-2) + "-" +
    ("0" + nextSun.getDate()).slice(-2);

  let baseline: SlotsRes | null = null;
  let target: { date: string; slotStart: string; slotEnd: string } | null = null;
  try {
    const r = (await Promise.race([
      callRpc(frame, "getPublicAvailableWeek", [weekStartYmd]),
      timeoutAfter(RPC_TIMEOUT, "baseline slots timeout"),
    ])) as SlotsRes;
    baseline = r;
    target = pickFutureSlot(r);
    record(
      "BASELINE_SLOTS",
      !!r?.ok && !!target,
      `weekStart=${r?.weekStart} overlay.removed=${r?.calendarOverlay?.removed ?? "n/a"} target=${target ? target.date + " " + target.slotStart + "-" + target.slotEnd : "(none)"}`
    );
  } catch (e) { record("BASELINE_SLOTS", false, "exception: " + (e as Error).message); }

  if (!target) {
    console.log("\n⚠ No future slot available — cannot run busy/restore steps. Aborting cleanly.");
    process.exit(results.some((r) => !r.ok) ? 1 : 0);
  }

  let createdEventId = "";

  try {
    // 4. Create R-2F-test busy event on the target window
    const startIso = target.date + "T" + target.slotStart + ":00";
    const endIso = target.date + "T" + target.slotEnd + ":00";
    try {
      const r = (await Promise.race([
        callRpc(frame, "runDebugCreateR2fTestBusyEventV1", [startIso, endIso]),
        timeoutAfter(RPC_TIMEOUT, "create event timeout"),
      ])) as { ok: boolean; eventId?: string; reused?: boolean; error?: string };
      createdEventId = r?.eventId || "";
      record(
        "CREATE_BUSY_EVENT",
        !!r?.ok && !!createdEventId,
        `eventId=${createdEventId.slice(-12) || "(none)"} reused=${r?.reused ?? false}` + (r?.error ? ` err=${r.error}` : "")
      );
    } catch (e) { record("CREATE_BUSY_EVENT", false, "exception: " + (e as Error).message); }

    if (!createdEventId) throw new Error("Could not create test event; skipping busy/restore");

    // 5. After busy: target slot should be filtered out
    try {
      const r = (await Promise.race([
        callRpc(frame, "getPublicAvailableWeek", [weekStartYmd]),
        timeoutAfter(RPC_TIMEOUT, "after-busy slots timeout"),
      ])) as SlotsRes;
      const found = findSlot(r, target.date, target.slotStart);
      record(
        "AFTER_BUSY_SLOTS_FILTERED",
        !!r?.ok && found === null,
        `overlay.attempted=${r?.calendarOverlay?.attempted} overlay.removed=${r?.calendarOverlay?.removed} target-present=${found !== null}`
      );
    } catch (e) { record("AFTER_BUSY_SLOTS_FILTERED", false, "exception: " + (e as Error).message); }

  } finally {
    // 6. ALWAYS delete the test event
    if (createdEventId) {
      try {
        const r = (await Promise.race([
          callRpc(frame, "runDebugDeleteR2fTestBusyEventV1", [createdEventId]),
          timeoutAfter(RPC_TIMEOUT, "delete event timeout"),
        ])) as { ok: boolean; deleted: boolean; error?: string };
        record(
          "CLEANUP_DELETE_EVENT",
          !!r?.ok && r.deleted === true,
          `deleted=${r?.deleted}` + (r?.error ? ` err=${r.error}` : "")
        );
      } catch (e) { record("CLEANUP_DELETE_EVENT", false, "exception: " + (e as Error).message + " — VERIFY EVENT MANUALLY: " + createdEventId); }
    }
  }

  // 7. Restored: target slot should reappear
  if (target && createdEventId) {
    try {
      const r = (await Promise.race([
        callRpc(frame, "getPublicAvailableWeek", [weekStartYmd]),
        timeoutAfter(RPC_TIMEOUT, "restored slots timeout"),
      ])) as SlotsRes;
      const found = findSlot(r, target.date, target.slotStart);
      record(
        "RESTORED_SLOTS",
        !!r?.ok && found !== null,
        `target-present=${found !== null}`
      );
    } catch (e) { record("RESTORED_SLOTS", false, "exception: " + (e as Error).message); }
  }

  console.log("\n═══════════════════════════════════════════════════════════");
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log(`  total=${results.length}  pass=${passed}  fail=${failed}`);
  if (failed > 0) {
    console.log("\n❌ FAIL — Calendar sync verify did not fully pass.");
    process.exit(1);
  }
  console.log("\n✅ ALL PASS — Calendar live overlay filters busy slots; test event cleaned up.");
  process.exit(0);
}

main().catch((e) => { console.error("[verify] 例外: " + (e?.message || e)); process.exit(1); });
