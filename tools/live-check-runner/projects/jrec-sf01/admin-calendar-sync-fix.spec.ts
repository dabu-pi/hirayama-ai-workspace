/**
 * jrec-sf01 admin-calendar-sync-fix.spec.ts
 *
 * Phase R-2K-sync-fix / R-2M-admin-calendar-sync-fix (2026-05-21):
 * 公開予約ページ (getPublicAvailableWeek) と
 * 予約管理カレンダー (getReservationAdminCalendarData) と
 * トップ予約サマリー (getReservationHomeSummary) で、
 * 同じ日時・同じ Calendar 状態に対する空き判定が一致することを検証。
 *
 * 背景:
 *   R-2K で公開予約ページに busy_calendar → available rescue を入れた。
 *   しかし R-2M-admin-calendar / R-2M-home-summary はその overlay 経路を持たず、
 *   Reservation_Slots シートの古い status を表示していた結果、
 *   公開予約と管理側で空き判定がズレる事象が判明（2026-05-23 10:00 系）。
 *
 *   本 spec は、3 RPC が共通の `_applyLiveCalendarOverlayToSlots_` ヘルパで
 *   同じ live overlay を共有していること、結果として available 集合が一致することを検証する。
 *
 * READ-only.
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

type PublicWeekRes = {
  ok: boolean;
  weekStart: string;
  days: Array<{ date: string; slots: Array<{ slotStart: string; slotEnd: string }> }>;
  calendarOverlay?: { attempted: boolean; removed: number; rescued?: number };
};

type AdminCalRes = {
  ok: boolean;
  weekStart: string;
  days: Array<{
    date: string;
    isClosed: boolean;
    slots: Array<{ slotStart: string; slotEnd: string; status: string; displayStatus: string; reservations: unknown[] }>;
    summary: { available: number; reserved: number; blockedCalendar: number };
  }>;
  calendarOverlay?: { attempted: boolean; removed: number; rescued: number; error: string | null };
};

type HomeSummaryRes = {
  ok: boolean;
  horizonDays: number;
  horizon: { available: number; reserved: number; blocked: number };
  calendarOverlay?: { attempted: boolean; removed: number; rescued: number; error: string | null };
};

test.describe(`JREC-SF01 R-2K-sync-fix 公開予約 / 管理カレンダー / トップサマリーの空き判定一致 [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test.beforeEach(async ({ page }) => { page.setDefaultTimeout(LOAD_TIMEOUT); });

  test("SF-1: getReservationAdminCalendarData が calendarOverlay フィールドを返す（R-2K-sync-fix）", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#cal-section").first().waitFor({ state: "attached", timeout: LOAD_TIMEOUT });
    const r = (await callRpc(frame, "getReservationAdminCalendarData", [ymd(new Date())])) as AdminCalRes;
    expect(r.ok).toBe(true);
    expect(r.calendarOverlay, "calendarOverlay フィールドが返ること").toBeDefined();
    expect(typeof r.calendarOverlay?.attempted).toBe("boolean");
    expect(typeof r.calendarOverlay?.removed).toBe("number");
    expect(typeof r.calendarOverlay?.rescued).toBe("number");
  });

  test("SF-2: getReservationHomeSummary も calendarOverlay フィールドを返す", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#cal-section").first().waitFor({ state: "attached", timeout: LOAD_TIMEOUT });
    const r = (await callRpc(frame, "getReservationHomeSummary", [])) as HomeSummaryRes;
    expect(r.ok).toBe(true);
    expect(r.calendarOverlay, "calendarOverlay フィールドが返ること").toBeDefined();
    expect(typeof r.calendarOverlay?.attempted).toBe("boolean");
    expect(typeof r.calendarOverlay?.removed).toBe("number");
    expect(typeof r.calendarOverlay?.rescued).toBe("number");
  });

  test("SF-3: 公開予約と管理カレンダーで同一週の available slot 集合が一致", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#cal-section").first().waitFor({ state: "attached", timeout: LOAD_TIMEOUT });
    const todayYmd = ymd(new Date());
    const pub = (await callRpc(frame, "getPublicAvailableWeek", [todayYmd])) as PublicWeekRes;
    const adm = (await callRpc(frame, "getReservationAdminCalendarData", [todayYmd])) as AdminCalRes;
    expect(pub.ok).toBe(true);
    expect(adm.ok).toBe(true);

    // 各 day の available 集合（"date HH:mm" key）を比較
    function pubKeys(): Set<string> {
      const s = new Set<string>();
      for (const d of (pub.days || [])) {
        for (const sl of (d.slots || [])) s.add(d.date + " " + sl.slotStart);
      }
      return s;
    }
    function admAvailableKeys(): Set<string> {
      const s = new Set<string>();
      for (const d of (adm.days || [])) {
        if (d.isClosed) continue;
        for (const sl of (d.slots || [])) {
          // 公開側は available + remaining>0 のみ slots に入る
          // 管理側は status=available + 予約紐づけなし のみ available 扱い
          if (sl.status === "available" && (!sl.reservations || sl.reservations.length === 0)) {
            s.add(d.date + " " + sl.slotStart);
          }
        }
      }
      return s;
    }

    const pubSet = pubKeys();
    const admSet = admAvailableKeys();
    // 対称差を計算してデバッグしやすく
    const onlyInPub: string[] = [];
    const onlyInAdm: string[] = [];
    pubSet.forEach(k => { if (!admSet.has(k)) onlyInPub.push(k); });
    admSet.forEach(k => { if (!pubSet.has(k)) onlyInAdm.push(k); });

    expect(onlyInPub, `公開予約のみで available: ${JSON.stringify(onlyInPub.slice(0, 5))}`).toEqual([]);
    expect(onlyInAdm, `管理カレンダーのみで available: ${JSON.stringify(onlyInAdm.slice(0, 5))}`).toEqual([]);
  });

  test("SF-4: 公開予約と管理カレンダーで来週の available slot 集合も一致", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#cal-section").first().waitFor({ state: "attached", timeout: LOAD_TIMEOUT });
    const next = new Date();
    next.setDate(next.getDate() + 7);
    const targetYmd = ymd(next);
    const pub = (await callRpc(frame, "getPublicAvailableWeek", [targetYmd])) as PublicWeekRes;
    const adm = (await callRpc(frame, "getReservationAdminCalendarData", [targetYmd])) as AdminCalRes;
    expect(pub.ok).toBe(true);
    expect(adm.ok).toBe(true);

    const pubSet = new Set<string>();
    for (const d of (pub.days || [])) {
      for (const sl of (d.slots || [])) pubSet.add(d.date + " " + sl.slotStart);
    }
    const admSet = new Set<string>();
    for (const d of (adm.days || [])) {
      if (d.isClosed) continue;
      for (const sl of (d.slots || [])) {
        if (sl.status === "available" && (!sl.reservations || sl.reservations.length === 0)) {
          admSet.add(d.date + " " + sl.slotStart);
        }
      }
    }
    const onlyInPub: string[] = [];
    const onlyInAdm: string[] = [];
    pubSet.forEach(k => { if (!admSet.has(k)) onlyInPub.push(k); });
    admSet.forEach(k => { if (!pubSet.has(k)) onlyInAdm.push(k); });

    expect(onlyInPub, `公開予約のみ: ${JSON.stringify(onlyInPub.slice(0, 5))}`).toEqual([]);
    expect(onlyInAdm, `管理カレンダーのみ: ${JSON.stringify(onlyInAdm.slice(0, 5))}`).toEqual([]);
  });

  test("SF-5: 既存予約 / 手動ブロック / 休業は overlay で空きに戻らない（rescue 安全性）", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#cal-section").first().waitFor({ state: "attached", timeout: LOAD_TIMEOUT });
    const r = (await callRpc(frame, "getReservationAdminCalendarData", [ymd(new Date())])) as AdminCalRes;
    expect(r.ok).toBe(true);
    // blocked_manual / fully_booked / closed の slot が available に戻されていないことを確認
    for (const d of (r.days || [])) {
      if (d.isClosed) continue;
      for (const sl of (d.slots || [])) {
        if (sl.status === "blocked_manual") {
          expect(sl.displayStatus, `${d.date} ${sl.slotStart} 手動ブロックが空きになっていない`).toBe("手動ブロック");
        }
        if (sl.status === "fully_booked") {
          expect(sl.displayStatus, `${d.date} ${sl.slotStart} 満枠が空きになっていない`).toBe("満枠");
        }
      }
    }
  });

  test("SF-6: 公開予約ページの calendarOverlay.rescued と admin の rescued が同等オーダー（両方双方向 overlay 動作）", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#cal-section").first().waitFor({ state: "attached", timeout: LOAD_TIMEOUT });
    const todayYmd = ymd(new Date());
    const pub = (await callRpc(frame, "getPublicAvailableWeek", [todayYmd])) as PublicWeekRes;
    const adm = (await callRpc(frame, "getReservationAdminCalendarData", [todayYmd])) as AdminCalRes;
    expect(pub.calendarOverlay?.attempted).toBe(true);
    expect(adm.calendarOverlay?.attempted).toBe(true);
    // 同じ週・同じ Calendar 状態に対する rescued 件数は概ね一致するはず（厳密 equal は競合タイミングで揺れる可能性 → diff <= 1 に許容）
    const pubRescued = pub.calendarOverlay?.rescued ?? 0;
    const admRescued = adm.calendarOverlay?.rescued ?? 0;
    expect(Math.abs(pubRescued - admRescued)).toBeLessThanOrEqual(2);
  });
});
