/**
 * jrec-sf01 public-reservation-rescue-r2k.spec.ts
 *
 * Phase R-2K (2026-05-21): R-2F overlay の双方向化と単日再同期関数の検証。
 *
 * 検証ポイント:
 *   - getPublicAvailableWeek が `calendarOverlay.rescued` を返す（R-2K の双方向 overlay）
 *   - `runResyncReservationSlotsForDate("YYYY-MM-DD")` が呼べ、当日範囲の Slots を再評価する
 *   - 不正日付は ok=false を返す
 *
 * READ-mostly: Reservation_Slots を再生成するため Slots シートに書き込みあり。
 * 既存予約・他日付の slot は壊さない。
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

test.describe(`JREC-SF01 R-2K 予約枠 R-2F overlay 双方向化 + 単日再同期 [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test.beforeEach(async ({ page }) => { page.setDefaultTimeout(LOAD_TIMEOUT); });

  test("RK-1: getPublicAvailableWeek が calendarOverlay.rescued を返す（R-2K overlay 双方向化）", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    const today = new Date();
    const ymd =
      today.getFullYear() + "-" +
      ("0" + (today.getMonth() + 1)).slice(-2) + "-" +
      ("0" + today.getDate()).slice(-2);
    const r = (await callRpc(frame, "getPublicAvailableWeek", [ymd])) as {
      ok: boolean;
      calendarOverlay?: { attempted: boolean; removed: number; rescued?: number };
    };
    expect(r.ok).toBe(true);
    expect(r.calendarOverlay).toBeDefined();
    expect(r.calendarOverlay?.attempted).toBe(true);
    expect(typeof r.calendarOverlay?.rescued).toBe("number");
    expect((r.calendarOverlay?.rescued ?? -1)).toBeGreaterThanOrEqual(0);
  });

  test("RK-2: runResyncReservationSlotsForDate(YYYY-MM-DD) が ok=true を返す", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    // 翌日を対象（既存予約に影響しにくく安全）
    const t = new Date();
    const target = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1);
    const ymd =
      target.getFullYear() + "-" +
      ("0" + (target.getMonth() + 1)).slice(-2) + "-" +
      ("0" + target.getDate()).slice(-2);
    const r = (await callRpc(frame, "runResyncReservationSlotsForDate", [ymd])) as {
      ok: boolean; date: string; generated?: number; available?: number; busyCalendar?: number; error?: string | null;
    };
    expect(r.ok).toBe(true);
    expect(r.date).toBe(ymd);
    expect(typeof r.generated).toBe("number");
    // 営業日なら generated > 0、日曜などなら 0 のこともある
    expect((r.generated ?? 0)).toBeGreaterThanOrEqual(0);
  });

  test("RK-3: runResyncReservationSlotsForDate('bad-date') は ok=false を返す（バリデーション）", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    const r = (await callRpc(frame, "runResyncReservationSlotsForDate", ["not-a-date"])) as {
      ok: boolean; date: string; error?: string;
    };
    expect(r.ok).toBe(false);
    expect(String(r.error || "")).toMatch(/YYYY-MM-DD/);
  });

  test("RK-4: 再同期後 getPublicAvailableWeek が新仕様の枠形式（45分・許容時刻）を維持", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: LOAD_TIMEOUT });

    const t = new Date();
    const target = new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1);
    const ymd =
      target.getFullYear() + "-" +
      ("0" + (target.getMonth() + 1)).slice(-2) + "-" +
      ("0" + target.getDate()).slice(-2);
    await callRpc(frame, "runResyncReservationSlotsForDate", [ymd]);

    const week = (await callRpc(frame, "getPublicAvailableWeek", [ymd])) as {
      ok: boolean;
      days?: Array<{ date: string; dow: number; slots: Array<{ slotStart: string; slotEnd: string }> }>;
    };
    expect(week.ok).toBe(true);
    const ALLOWED = new Set(["09:00", "10:00", "11:00", "15:30", "16:30", "17:30"]);
    for (const d of (week.days || [])) {
      for (const sl of (d.slots || [])) {
        expect(ALLOWED.has(sl.slotStart), `${d.date} の slotStart=${sl.slotStart} は R-2J 許容集合に含まれるべき`).toBe(true);
        // slotEnd は slotStart の 45 分後
        const [sH, sM] = sl.slotStart.split(":").map((n) => parseInt(n, 10));
        const [eH, eM] = sl.slotEnd.split(":").map((n) => parseInt(n, 10));
        const diff = (eH * 60 + eM) - (sH * 60 + sM);
        expect(diff, `${d.date} ${sl.slotStart}〜${sl.slotEnd} の diff=${diff} は 45 であるべき`).toBe(45);
      }
    }
  });

  test("RK-5: calendarOverlay.rescued は通常 0（live Calendar に整合した状態）か、ログ可能な数値であること", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    const today = new Date();
    const ymd =
      today.getFullYear() + "-" +
      ("0" + (today.getMonth() + 1)).slice(-2) + "-" +
      ("0" + today.getDate()).slice(-2);
    const r = (await callRpc(frame, "getPublicAvailableWeek", [ymd])) as {
      ok: boolean; calendarOverlay?: { attempted: boolean; removed: number; rescued?: number; error?: string | null };
    };
    expect(r.ok).toBe(true);
    expect(r.calendarOverlay?.attempted).toBe(true);
    // rescued は cron 焼付と現在 Calendar の差分次第。0 または正数。
    expect(r.calendarOverlay?.rescued).toBeDefined();
  });
});
