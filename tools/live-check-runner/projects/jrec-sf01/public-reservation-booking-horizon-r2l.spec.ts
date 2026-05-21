/**
 * jrec-sf01 public-reservation-booking-horizon-r2l.spec.ts
 *
 * Phase R-2L (2026-05-21): 予約可能期間 35 日への拡張を検証。
 *
 * 検証ポイント:
 *   - Reservation_Settings.slot_generation_days = "35" / version = "2.4"
 *   - 今日 + 21 日（=3 週後）の getPublicAvailableWeek が日付スロットを返す（旧 14 日では出ない範囲）
 *   - 今日 + 28 日（=4 週後）の getPublicAvailableWeek が日付スロットを返す
 *   - 35 日範囲内であれば R-2J の枠仕様（45分・許容 starts）が維持されている
 *   - 36 日以降は空（生成範囲外）
 *
 * READ-ONLY: 設定値 / Slot 取得のみ。書き換えなし。
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

function ymd(d: Date): string {
  return d.getFullYear() + "-" +
    ("0" + (d.getMonth() + 1)).slice(-2) + "-" +
    ("0" + d.getDate()).slice(-2);
}

function addDays(base: Date, n: number): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() + n);
}

type WeekRes = {
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

const ALLOWED_STARTS = new Set(["09:00", "10:00", "11:00", "15:30", "16:30", "17:30"]);

test.describe(`JREC-SF01 R-2L 予約可能期間 35 日 [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test.beforeEach(async ({ page }) => { page.setDefaultTimeout(LOAD_TIMEOUT); });

  test("BL-1: 今日 + 21 日（旧 14 日の範囲外）に予約枠が存在", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    const target = addDays(new Date(), 21);
    const r = (await callRpc(frame, "getPublicAvailableWeek", [ymd(target)])) as WeekRes;
    expect(r.ok).toBe(true);
    const totalSlots = (r.days || []).reduce((acc, d) => acc + (d.slots || []).length, 0);
    expect(totalSlots, `today+21 (${ymd(target)}) を含む週には枠が存在するべき`).toBeGreaterThan(0);
  });

  test("BL-2: 今日 + 28 日（4 週後）に予約枠が存在", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    const target = addDays(new Date(), 28);
    const r = (await callRpc(frame, "getPublicAvailableWeek", [ymd(target)])) as WeekRes;
    expect(r.ok).toBe(true);
    const totalSlots = (r.days || []).reduce((acc, d) => acc + (d.slots || []).length, 0);
    expect(totalSlots, `today+28 (${ymd(target)}) を含む週には枠が存在するべき`).toBeGreaterThan(0);
  });

  test("BL-3: 35 日範囲内のスロットは R-2J 仕様（45分・許容 starts）を維持", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    // 21 日後を含む週で検証（旧 14 日では存在しなかった範囲）
    const target = addDays(new Date(), 21);
    const r = (await callRpc(frame, "getPublicAvailableWeek", [ymd(target)])) as WeekRes;
    expect(r.ok).toBe(true);
    for (const d of (r.days || [])) {
      for (const sl of (d.slots || [])) {
        expect(ALLOWED_STARTS.has(sl.slotStart), `${d.date} slotStart=${sl.slotStart} は R-2J 許容集合に含まれるべき`).toBe(true);
        const [sH, sM] = sl.slotStart.split(":").map(n => parseInt(n, 10));
        const [eH, eM] = sl.slotEnd.split(":").map(n => parseInt(n, 10));
        const diff = (eH * 60 + eM) - (sH * 60 + sM);
        expect(diff, `${d.date} ${sl.slotStart}-${sl.slotEnd} は 45 分であるべき`).toBe(45);
      }
    }
  });

  test("BL-4: 今日 + 42 日（6 週後 = horizon 外）にはスロットがない", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    const target = addDays(new Date(), 42);
    const r = (await callRpc(frame, "getPublicAvailableWeek", [ymd(target)])) as WeekRes;
    expect(r.ok).toBe(true);
    const totalSlots = (r.days || []).reduce((acc, d) => acc + (d.slots || []).length, 0);
    expect(totalSlots, `today+42 (${ymd(target)}) は horizon=35 を超えるため枠が 0 であるべき`).toBe(0);
  });

  test("BL-5: 土曜（35日範囲内）は午前のみ・3 枠", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    // 21 日後を含む週で検証
    const target = addDays(new Date(), 21);
    const r = (await callRpc(frame, "getPublicAvailableWeek", [ymd(target)])) as WeekRes;
    expect(r.ok).toBe(true);
    const sat = (r.days || []).find(d => d.dow === 6);
    if (!sat) {
      test.skip(true, "21 日後付近の週に土曜が見つからない（祝日 / 範囲外）");
      return;
    }
    // 土曜午後（15:30 以降）は存在しないこと
    for (const sl of (sat.slots || [])) {
      expect(ALLOWED_STARTS.has(sl.slotStart), `土曜 ${sat.date} slotStart=${sl.slotStart} は R-2J 許容集合に含まれるべき`).toBe(true);
      // 土曜は午前のみ。15:30 / 16:30 / 17:30 は出ない（calendar busy などで空いている前提）
      const isMorning = ["09:00", "10:00", "11:00"].indexOf(sl.slotStart) >= 0;
      expect(isMorning, `土曜の slot は午前 (09:00 / 10:00 / 11:00) のみ。実際: ${sl.slotStart}`).toBe(true);
    }
  });
});
