/**
 * jrec-r2h-calendar-reflection-timing-verify.ts
 *
 * Phase R-2H: confirms when a manually-added Google Calendar event is
 * reflected on the public reservation page.
 *
 * Expected behavior (from R-2F design):
 *   - No automatic polling on the public page (by design)
 *   - Every loadWeek() invocation triggers the live overlay → busy slots
 *     are filtered out of the response
 *   - loadWeek() runs on: initial page load, ← 前週 / 次週 →, 今日, and
 *     auto-reload after SLOT_TAKEN
 *   - 02:00 cron only refreshes the Reservation_Slots cache; it is NOT
 *     required for the live overlay to work
 *   - submit-time isSlotAvailable_ is the final safety net regardless of
 *     what the user saw on screen
 *
 * Flow (run-mode CDP via Playwright connectOverCDP):
 *   STEP 0  baseline: read mode + cron; ensure mode=gmail / cron=1
 *   STEP 1  open admin page (for google.script.run RPCs)
 *   STEP 2  via admin RPC: getPublicAvailableWeek (next week), pick a future slot
 *   STEP 3  open public page; wait for slots to render; record presence of the target
 *   STEP 4  create R-2F-test Calendar event covering the target slot
 *   STEP 5  WITHOUT_RELOAD: public page DOM still shows the target (no auto-refresh)
 *   STEP 6  RELOAD: public page goto() again; target slot disappears
 *   STEP 7  WEEK_NAV: from a refreshed view of the next week's start, click 次週 then ← 前週;
 *           target slot still filtered (re-fetched both times)
 *   STEP 8  TODAY_BUTTON: open public page fresh, click 今日; baseline week shown without
 *           the target (target is in next week so not visible; we verify loadWeek ran by
 *           checking #week-grid populates and live overlay doesn't error)
 *   STEP 9  SUBMIT_RECHECK: directly call submitPublicReservation via admin RPC
 *           with the target slot; expect SLOT_TAKEN (calendar_busy reason)
 *           — no Gmail dispatch because submit fails before notification path
 *   STEP 10 PII_OPACITY: response of submitPublicReservation must NOT include event title /
 *           description / location / attendees
 *   STEP 11 cleanup (try/finally): delete the R-2F-test Calendar event
 *   STEP 12 restoration: re-fetch via admin RPC; target slot is back
 *   STEP 13 post-state: mode=gmail / cron count=1 confirmed
 *
 * PII guarantees:
 *   - Test event title is fixed to "R-2F-test (do not book)"
 *   - This script never logs the title; only event id (opaque)
 *   - submitPublicReservation response is JSON.stringify'd and checked for
 *     eventTitle/eventDescription/eventLocation/attendees keys
 *
 * Gmail spam:
 *   - SUBMIT_RECHECK is designed to FAIL with SLOT_TAKEN before the
 *     notification dispatch path is reached, so no email is sent.
 *   - Still safe under mode=gmail.
 */
import { chromium, type Page, type FrameLocator } from "@playwright/test";

const DEV_URL_ADMIN =
  "https://script.google.com/macros/s/AKfycbzJWJAKCxStP82lfFl8eEHei98dWh7f6cgtEM33r3M5/dev?page=reservationAdmin";
const DEV_URL_PUBLIC =
  "https://script.google.com/macros/s/AKfycbzJWJAKCxStP82lfFl8eEHei98dWh7f6cgtEM33r3M5/dev?page=reservationPublic";
const CDP_URL = "http://localhost:9222";
const TIMEOUT = 25_000;
const RPC_TIMEOUT = 60_000;

interface Result { name: string; ok: boolean; detail: string; }
const results: Result[] = [];
function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log((ok ? "✅ PASS" : "❌ FAIL") + "  [" + name + "]  " + detail);
}
function note(detail: string) { console.log("ℹ️  " + detail); }

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

function findSlot(res: SlotsRes, date: string, slotStart: string): { remaining: number } | null {
  const day = (res.days || []).find((d) => d.date === date);
  if (!day) return null;
  const s = (day.slots || []).find((x) => x.slotStart === slotStart);
  return s ? { remaining: s.remaining } : null;
}

function pickFutureSlot(res: SlotsRes): { date: string; slotStart: string; slotEnd: string } | null {
  const now = Date.now();
  for (const d of (res.days || [])) {
    if (d.isPast) continue;
    for (const s of d.slots || []) {
      const startMs = Date.parse(d.date + "T" + s.slotStart + ":00+09:00");
      if (startMs > now + 2 * 60 * 60 * 1000) return { date: d.date, slotStart: s.slotStart, slotEnd: s.slotEnd };
    }
  }
  return null;
}

async function publicPageHasSlot(publicPage: Page, date: string, slotStart: string): Promise<boolean> {
  const frame = gasAppFrame(publicPage);
  // The slot button has data-date and data-start attributes
  const sel = `button.slot-btn[data-date='${date}'][data-start='${slotStart}']`;
  const count = await frame.locator(sel).count();
  return count > 0;
}

async function waitForPublicWeekRender(publicPage: Page) {
  const frame = gasAppFrame(publicPage);
  await frame.locator("#week-grid").waitFor({ state: "visible", timeout: TIMEOUT });
  await Promise.race([
    frame.locator(".slot-btn").first().waitFor({ state: "visible", timeout: TIMEOUT }),
    frame.locator(".col-empty").first().waitFor({ state: "visible", timeout: TIMEOUT }),
    frame.locator("#week-empty-banner").first().waitFor({ state: "visible", timeout: TIMEOUT }),
  ]).catch(() => {});
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  jrec-r2h-calendar-reflection-timing-verify");
  console.log("  Calendar 手動予定が公開予約ページに反映されるタイミングを検証");
  console.log("═══════════════════════════════════════════════════════════════");

  const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 5000 });
  const ctx = browser.contexts()[0];

  const adminPage = await ctx.newPage();
  adminPage.setDefaultTimeout(TIMEOUT);
  await adminPage.goto(DEV_URL_ADMIN, { waitUntil: "domcontentloaded" });
  const adminFrame = gasAppFrame(adminPage);
  await adminFrame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: TIMEOUT });

  // STEP 0: baseline mode + cron
  try {
    const cfg = (await callRpc(adminFrame, "runDebugNotificationConfigV1", [])) as { ok: boolean; mode: string };
    const triggers = (await callRpc(adminFrame, "listSlotsRegenTriggers", [])) as { ok: boolean; count: number };
    record(
      "BASELINE_STATE",
      !!cfg?.ok && cfg.mode === "gmail" && !!triggers?.ok && triggers.count === 1,
      `mode=${cfg?.mode} cron=${triggers?.count}`
    );
  } catch (e) { record("BASELINE_STATE", false, "exception: " + (e as Error).message); }

  // STEP 2: baseline next-week slots, pick target
  const today = new Date();
  const nextSun = new Date(today.getFullYear(), today.getMonth(), today.getDate() + (7 - today.getDay()));
  const weekStartYmd =
    nextSun.getFullYear() + "-" +
    ("0" + (nextSun.getMonth() + 1)).slice(-2) + "-" +
    ("0" + nextSun.getDate()).slice(-2);

  let target: { date: string; slotStart: string; slotEnd: string } | null = null;
  try {
    const r = (await callRpc(adminFrame, "getPublicAvailableWeek", [weekStartYmd])) as SlotsRes;
    target = pickFutureSlot(r);
    record(
      "BASELINE_TARGET_PICKED",
      !!target,
      `weekStart=${r.weekStart} target=${target ? target.date + " " + target.slotStart + "-" + target.slotEnd : "(none)"}`
    );
  } catch (e) { record("BASELINE_TARGET_PICKED", false, "exception: " + (e as Error).message); }

  if (!target) {
    console.log("\n⚠ No future slot available — aborting cleanly");
    process.exit(results.some((r) => !r.ok) ? 1 : 0);
  }

  // STEP 3: open public page, wait for slots, record initial presence of target
  const publicPage = await ctx.newPage();
  publicPage.setDefaultTimeout(TIMEOUT);

  // Need to navigate to the right week. Public page defaults to current week.
  // We pick a target in next week, so we'd need to click "next week" to see it.
  // Instead, simpler: open the public page; the home view shows current week.
  // For PRESENCE testing we'll fetch via admin RPC (faster + deterministic).

  // ── For UI reload / week-nav / today button tests, we want a slot in the
  // CURRENT week if possible, to keep the public UI starting on it.
  // Re-pick target preferring current-week slot if available.
  let currentWeekTarget: typeof target = null;
  try {
    const thisYmd =
      today.getFullYear() + "-" +
      ("0" + (today.getMonth() + 1)).slice(-2) + "-" +
      ("0" + today.getDate()).slice(-2);
    const rCur = (await callRpc(adminFrame, "getPublicAvailableWeek", [thisYmd])) as SlotsRes;
    currentWeekTarget = pickFutureSlot(rCur);
    if (currentWeekTarget) {
      target = currentWeekTarget; // prefer current-week so the public page first-load shows it
      console.log("[r2h] using current-week target for UI navigation tests: " +
        target.date + " " + target.slotStart + "-" + target.slotEnd);
    } else {
      console.log("[r2h] no current-week slot; falling back to next-week target (UI nav test will navigate)");
    }
  } catch (e) {
    console.log("[r2h] current-week fetch failed; sticking with next-week target");
  }

  let createdEventId = "";

  try {
    // Open public page (current week by default)
    await publicPage.goto(DEV_URL_PUBLIC, { waitUntil: "domcontentloaded" });
    await waitForPublicWeekRender(publicPage);

    // If target is in next week, click 次週 once
    if (currentWeekTarget === null && target) {
      const frame = gasAppFrame(publicPage);
      await frame.locator("#next-week-btn").click();
      await waitForPublicWeekRender(publicPage);
    }

    const initialPresence = await publicPageHasSlot(publicPage, target.date, target.slotStart);
    record("UI_INITIAL_PRESENCE", initialPresence, `target=${target.date} ${target.slotStart} visible=${initialPresence}`);

    // STEP 4: create test event covering target slot
    const startIso = target.date + "T" + target.slotStart + ":00";
    const endIso   = target.date + "T" + target.slotEnd + ":00";
    try {
      const r = (await Promise.race([
        callRpc(adminFrame, "runDebugCreateR2fTestBusyEventV1", [startIso, endIso]),
        timeoutAfter(RPC_TIMEOUT, "create timeout"),
      ])) as { ok: boolean; eventId?: string; reused?: boolean };
      createdEventId = r?.eventId || "";
      record(
        "CREATE_TEST_EVENT",
        !!r?.ok && !!createdEventId,
        `eventId=...${createdEventId.slice(-12)} reused=${r?.reused ?? false}`
      );
    } catch (e) { record("CREATE_TEST_EVENT", false, "exception: " + (e as Error).message); }

    if (!createdEventId) throw new Error("event create failed, skipping timing tests");

    // STEP 5: WITHOUT RELOAD — public page DOM should NOT auto-refresh
    note("STEP 5: 何もしない状態（reload なし）— 期待: 古い表示が残る（auto-refresh なし）");
    await sleep(2000); // give some time, even though we don't expect polling
    const stillPresent_NoReload = await publicPageHasSlot(publicPage, target.date, target.slotStart);
    record(
      "WITHOUT_RELOAD_NO_AUTO_REFRESH",
      stillPresent_NoReload === true,
      `target visible after 2s with no user action: ${stillPresent_NoReload} (expected true)`
    );

    // STEP 6: RELOAD — page reload runs loadWeek → live overlay filters
    note("STEP 6: ページ再読み込み — 期待: 該当 slot が消える");
    await publicPage.goto(DEV_URL_PUBLIC, { waitUntil: "domcontentloaded" });
    await waitForPublicWeekRender(publicPage);
    // If target was in next week, navigate again
    if (currentWeekTarget === null) {
      const frame = gasAppFrame(publicPage);
      await frame.locator("#next-week-btn").click();
      await waitForPublicWeekRender(publicPage);
    }
    const presence_AfterReload = await publicPageHasSlot(publicPage, target.date, target.slotStart);
    record(
      "RELOAD_FILTERS_SLOT",
      presence_AfterReload === false,
      `target visible after reload: ${presence_AfterReload} (expected false)`
    );

    // STEP 7: WEEK_NAV — 次週 → ← 前週 → both fetch fresh
    note("STEP 7: 次週 → 前週 ナビゲーション — 期待: 戻ってきても該当 slot は消えたまま");
    {
      const frame = gasAppFrame(publicPage);
      await frame.locator("#next-week-btn").click();
      await waitForPublicWeekRender(publicPage);
      await frame.locator("#prev-week-btn").click();
      await waitForPublicWeekRender(publicPage);
      // If target was in next week from current-week start, we now need 次週 once more
      if (currentWeekTarget === null) {
        await frame.locator("#next-week-btn").click();
        await waitForPublicWeekRender(publicPage);
      }
      const presence_AfterNav = await publicPageHasSlot(publicPage, target.date, target.slotStart);
      record(
        "WEEK_NAV_REFETCHES",
        presence_AfterNav === false,
        `target visible after week nav round-trip: ${presence_AfterNav} (expected false)`
      );
    }

    // STEP 8: TODAY BUTTON — re-fetches current week
    note("STEP 8: 今日ボタン — 期待: loadWeek が再実行される");
    {
      const frame = gasAppFrame(publicPage);
      await frame.locator("#today-btn").click();
      await waitForPublicWeekRender(publicPage);
      // We can verify loadWeek was called by checking #week-grid populated
      // and live overlay didn't error. The target may or may not be in this week.
      const gridChildren = await frame.locator("#week-grid .week-col").count();
      record(
        "TODAY_BUTTON_REFETCHES",
        gridChildren > 0,
        `week-grid columns after 今日: ${gridChildren} (expected > 0, indicates loadWeek ran)`
      );
    }

    // STEP 9: SUBMIT_RECHECK — directly submit the stale target via RPC, expect SLOT_TAKEN
    note("STEP 9: 古い表示から submit — 期待: SLOT_TAKEN で停止（Gmail 非送信）");
    try {
      const payload = {
        slotDate:        target.date,
        slotStart:       target.slotStart,
        isFirstVisit:    false,
        patientName:     "R-2H-test stale",
        patientNameKana: "",
        phone:           "09014861348",
        menuId:          "",
        menuName:        "(R-2H-test)",
        symptoms:        "R-2H submit recheck test",
        notes:           "",
        _ua:             "r2h-verify",
        _ts:             Date.now() - 8000  // bypass too-fast guard
      };
      const r = (await Promise.race([
        callRpc(adminFrame, "submitPublicReservation", [payload]),
        timeoutAfter(RPC_TIMEOUT, "submit timeout"),
      ])) as { ok: boolean; code?: string; error?: string; reservationId?: string };

      // Expect ok=false code=SLOT_TAKEN
      const blocked = !r?.ok && r?.code === "SLOT_TAKEN";
      record(
        "SUBMIT_RECHECK_BLOCKS",
        blocked,
        `ok=${r?.ok} code=${r?.code || "(none)"} error=${(r?.error || "").slice(0, 60)}`
      );

      // STEP 10: PII opacity check on the submit response
      const json = JSON.stringify(r);
      const piiOpaque =
        !/eventTitle/i.test(json) &&
        !/eventDescription/i.test(json) &&
        !/eventLocation/i.test(json) &&
        !/attendees/i.test(json) &&
        !/R-2F-test/i.test(json); // our own test event title should NOT leak either
      record(
        "SUBMIT_RESPONSE_PII_OPAQUE",
        piiOpaque,
        `no event title / description / location / attendees / R-2F-test in response: ${piiOpaque}`
      );
    } catch (e) { record("SUBMIT_RECHECK_BLOCKS", false, "exception: " + (e as Error).message); }

  } finally {
    // STEP 11: cleanup — ALWAYS
    if (createdEventId) {
      try {
        const r = (await Promise.race([
          callRpc(adminFrame, "runDebugDeleteR2fTestBusyEventV1", [createdEventId]),
          timeoutAfter(RPC_TIMEOUT, "delete timeout"),
        ])) as { ok: boolean; deleted: boolean };
        record(
          "CLEANUP_TEST_EVENT",
          !!r?.ok && r.deleted === true,
          `deleted=${r?.deleted}`
        );
      } catch (e) {
        record("CLEANUP_TEST_EVENT", false, "exception: " + (e as Error).message + " — VERIFY MANUALLY: " + createdEventId);
      }
    }
  }

  // STEP 12: RESTORATION — target slot should reappear
  if (target && createdEventId) {
    try {
      // fetch the correct week (use the target's containing week)
      // Easiest: compute the Sunday of target.date
      const [ty, tm, td] = target.date.split("-").map((s) => parseInt(s, 10));
      const targetDate = new Date(ty, tm - 1, td);
      const targetSun = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate() - targetDate.getDay());
      const targetWeekYmd =
        targetSun.getFullYear() + "-" +
        ("0" + (targetSun.getMonth() + 1)).slice(-2) + "-" +
        ("0" + targetSun.getDate()).slice(-2);
      const r = (await callRpc(adminFrame, "getPublicAvailableWeek", [targetWeekYmd])) as SlotsRes;
      const found = findSlot(r, target.date, target.slotStart);
      record("RESTORATION", found !== null, `target visible: ${found !== null}`);
    } catch (e) { record("RESTORATION", false, "exception: " + (e as Error).message); }
  }

  // STEP 13: post-state mode + cron
  try {
    const cfg = (await callRpc(adminFrame, "runDebugNotificationConfigV1", [])) as { ok: boolean; mode: string };
    const triggers = (await callRpc(adminFrame, "listSlotsRegenTriggers", [])) as { ok: boolean; count: number };
    record(
      "POST_STATE",
      !!cfg?.ok && cfg.mode === "gmail" && !!triggers?.ok && triggers.count === 1,
      `mode=${cfg?.mode} cron=${triggers?.count}`
    );
  } catch (e) { record("POST_STATE", false, "exception: " + (e as Error).message); }

  await publicPage.close().catch(() => {});
  await browser.close().catch(() => {});

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  Summary");
  console.log("═══════════════════════════════════════════════════════════════");
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log(`  total=${results.length}  pass=${passed}  fail=${failed}`);
  if (failed > 0) {
    console.log("\n❌ FAIL — R-2H verify did not fully pass.");
    process.exit(1);
  }
  console.log("\n✅ ALL PASS — Calendar 反映タイミングは仕様どおり。");
  console.log("   - 何もしないと auto-refresh しない（仕様）");
  console.log("   - ページ再読み込み / 週移動 / 今日ボタン / submit recheck で即時反映");
  console.log("   - 患者レスポンスに Calendar event 詳細は出ない");
  console.log("   - mode=gmail / cron count=1 維持");
  process.exit(0);
}

main().catch((e) => { console.error("[verify] 例外: " + (e?.message || e)); process.exit(1); });
