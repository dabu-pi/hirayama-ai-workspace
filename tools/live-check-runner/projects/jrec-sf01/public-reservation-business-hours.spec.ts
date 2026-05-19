/**
 * jrec-sf01 public-reservation-business-hours.spec.ts
 *
 * Phase R-2I: read-only assertions confirming the v2.2 business hours
 * are reflected in getPublicAvailableWeek.
 *
 * Expected (treatment_minutes=60, slot_step_minutes=60):
 *   Weekday and Saturday share the same windows now:
 *     morning   09:00 / 10:00 / 11:00 (11:00 last)
 *     afternoon 15:30 / 16:30 / 17:30 (17:30 last)
 *     never:    11:30+, 15:00, 18:00+
 *   Sunday / holiday: closed
 *
 * Strictly READ-ONLY (calls getPublicAvailableWeek, no reservation submit).
 * Safe to run while notification_mode=gmail is LIVE.
 *
 * Note on Calendar busy overlay (R-2F):
 *   The slot list returned by getPublicAvailableWeek already has live
 *   calendar busy slots filtered out. So a "missing slot" could mean either
 *   "outside business hours" OR "Calendar busy at that time". For positive
 *   tests (expected slot present), we look across the entire 2-week range
 *   and accept if at least ONE eligible weekday/Saturday has it. For
 *   negative tests (e.g. 11:30 must never appear), we check across the
 *   whole range — calendar busy can only REMOVE slots, never add them, so
 *   negative tests are unaffected by overlay.
 */
import { test, expect, type Page, type FrameLocator } from "@playwright/test";
import path from "path";
import fs from "fs";
import config from "./config.json";

const DEV_URL = config.devUrl;
const ADMIN_URL = DEV_URL + "?page=reservationAdmin";
const AUTH_FILE = path.join(__dirname, "../../auth.json");
const HAS_AUTH = fs.existsSync(AUTH_FILE);
const LOAD_TIMEOUT = 30_000;
const RPC_TIMEOUT = 60_000;

function gasAppFrame(page: Page): FrameLocator {
  return page.frameLocator("iframe").first().frameLocator("iframe").first();
}

async function handleAuthRedirect(page: Page) {
  const url = page.url();
  const title = await page.title().catch(() => "");
  if (
    url.includes("accounts.google.com") ||
    url.includes("ServiceLogin") ||
    title.includes("Sign in") ||
    title.includes("Google Drive: Sign-in")
  ) {
    test.skip(
      true,
      HAS_AUTH
        ? "auth.json のセッションが期限切れです。npm run save-auth を再実行してください。"
        : "Google 認証が必要です。npm run save-auth を実行してください。"
    );
  }
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

type SlotsRes = {
  ok: boolean;
  weekStart: string;
  weekEnd: string;
  days: Array<{
    date: string;
    dow: number;
    isToday: boolean;
    isPast: boolean;
    slots: Array<{ slotStart: string; slotEnd: string; remaining: number }>;
  }>;
};

async function fetchTwoWeeks(frame: FrameLocator): Promise<SlotsRes[]> {
  const today = new Date();
  const ymd =
    today.getFullYear() + "-" +
    ("0" + (today.getMonth() + 1)).slice(-2) + "-" +
    ("0" + today.getDate()).slice(-2);
  const next = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 7);
  const nextYmd =
    next.getFullYear() + "-" +
    ("0" + (next.getMonth() + 1)).slice(-2) + "-" +
    ("0" + next.getDate()).slice(-2);
  const w1 = (await callRpc(frame, "getPublicAvailableWeek", [ymd])) as SlotsRes;
  const w2 = (await callRpc(frame, "getPublicAvailableWeek", [nextYmd])) as SlotsRes;
  return [w1, w2];
}

function allDays(weeks: SlotsRes[]) {
  const out: SlotsRes["days"] = [];
  for (const w of weeks) {
    for (const d of (w.days || [])) out.push(d);
  }
  return out;
}

function anyDayHasSlot(weeks: SlotsRes[], dowFilter: (dow: number) => boolean, slotStart: string): boolean {
  for (const d of allDays(weeks)) {
    if (d.isPast) continue;
    if (!dowFilter(d.dow)) continue;
    if ((d.slots || []).some((s) => s.slotStart === slotStart)) return true;
  }
  return false;
}

function anyDayHasForbiddenSlot(weeks: SlotsRes[], dowFilter: (dow: number) => boolean, slotStart: string): string | null {
  for (const d of allDays(weeks)) {
    if (d.isPast) continue;
    if (!dowFilter(d.dow)) continue;
    if ((d.slots || []).some((s) => s.slotStart === slotStart)) return d.date;
  }
  return null;
}

const isWeekday = (dow: number) => dow >= 1 && dow <= 5;
const isSaturday = (dow: number) => dow === 6;
const isWeekdayOrSat = (dow: number) => dow >= 1 && dow <= 6;

test.describe(`JREC-SF01 R-2I 営業時間 v2.2 [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test.beforeEach(async ({ page }) => { page.setDefaultTimeout(LOAD_TIMEOUT); });

  test("BH-1: 公開予約ページが /dev で表示される", async ({ page }) => {
    const url = DEV_URL + "?page=reservationPublic";
    const res = await page.goto(url, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    expect(res?.status()).toBeLessThan(400);
    const frame = gasAppFrame(page);
    await frame.locator("#week-grid").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
  });

  test("BH-2: 平日に 11:00 開始枠が存在（少なくとも 1 日）", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    const weeks = await fetchTwoWeeks(frame);
    const found = anyDayHasSlot(weeks, isWeekday, "11:00");
    expect(found, "平日のいずれかに 11:00 開始枠が必要").toBe(true);
  });

  test("BH-3: 土曜日に 11:00 開始枠が存在", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    const weeks = await fetchTwoWeeks(frame);
    const found = anyDayHasSlot(weeks, isSaturday, "11:00");
    expect(found, "土曜日に 11:00 開始枠が必要").toBe(true);
  });

  test("BH-4: 11:30 以降の午前枠は平日・土曜どこにも存在しない", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    const weeks = await fetchTwoWeeks(frame);
    const offending = ["11:30", "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00"];
    for (const slot of offending) {
      const day = anyDayHasForbiddenSlot(weeks, isWeekdayOrSat, slot);
      expect(day, slot + " の枠は出現してはならない（出現した日: " + day + "）").toBeNull();
    }
  });

  test("BH-5: 平日・土曜に 15:30 開始枠が存在", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    const weeks = await fetchTwoWeeks(frame);
    expect(anyDayHasSlot(weeks, isWeekday, "15:30"), "平日のいずれかに 15:30 開始枠が必要").toBe(true);
    expect(anyDayHasSlot(weeks, isSaturday, "15:30"), "土曜のいずれかに 15:30 開始枠が必要").toBe(true);
  });

  test("BH-6: 15:00 開始枠は存在しない（平日・土曜とも）", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    const weeks = await fetchTwoWeeks(frame);
    const day = anyDayHasForbiddenSlot(weeks, isWeekdayOrSat, "15:00");
    expect(day, "15:00 枠は出現してはならない（出現した日: " + day + "）").toBeNull();
  });

  test("BH-7: 平日・土曜に 17:30 開始枠が存在", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    const weeks = await fetchTwoWeeks(frame);
    expect(anyDayHasSlot(weeks, isWeekday, "17:30"), "平日のいずれかに 17:30 開始枠が必要").toBe(true);
    expect(anyDayHasSlot(weeks, isSaturday, "17:30"), "土曜のいずれかに 17:30 開始枠が必要").toBe(true);
  });

  test("BH-8: 18:00 以降の枠は存在しない（18:00 / 18:30 / 19:00）", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    const weeks = await fetchTwoWeeks(frame);
    for (const slot of ["18:00", "18:30", "19:00", "19:30"]) {
      const day = anyDayHasForbiddenSlot(weeks, isWeekdayOrSat, slot);
      expect(day, slot + " の枠は出現してはならない（出現した日: " + day + "）").toBeNull();
    }
  });

  test("BH-9: R-2F overlay の calendarOverlay メタが返る（live overlay 維持）", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    const today = new Date();
    const ymd =
      today.getFullYear() + "-" +
      ("0" + (today.getMonth() + 1)).slice(-2) + "-" +
      ("0" + today.getDate()).slice(-2);
    const r = (await callRpc(frame, "getPublicAvailableWeek", [ymd])) as { ok: boolean; calendarOverlay?: { attempted: boolean } };
    expect(r.ok).toBe(true);
    expect(r.calendarOverlay).toBeDefined();
    expect(r.calendarOverlay?.attempted).toBe(true);
  });

  test("BH-10: getPublicAvailableWeek レスポンスは PII 不透過（event 詳細なし）", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    const today = new Date();
    const ymd =
      today.getFullYear() + "-" +
      ("0" + (today.getMonth() + 1)).slice(-2) + "-" +
      ("0" + today.getDate()).slice(-2);
    const r = (await callRpc(frame, "getPublicAvailableWeek", [ymd])) as Record<string, unknown>;
    const json = JSON.stringify(r);
    expect(json).not.toMatch(/eventTitle/i);
    expect(json).not.toMatch(/eventDescription/i);
    expect(json).not.toMatch(/eventLocation/i);
    expect(json).not.toMatch(/attendees/i);
  });

  test("BH-11: Gmail mode + cron count=1 維持", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    const cfg = (await callRpc(frame, "runDebugNotificationConfigV1", [])) as { ok: boolean; mode: string };
    const triggers = (await callRpc(frame, "listSlotsRegenTriggers", [])) as { ok: boolean; count: number };
    expect(cfg.ok).toBe(true);
    expect(cfg.mode).toBe("gmail");
    expect(triggers.ok).toBe(true);
    expect(triggers.count).toBe(1);
  });
});
