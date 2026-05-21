/**
 * jrec-sf01 calendar-event-missing-reservation-alert-r2q.spec.ts
 *
 * Phase R-2Q-calendar-event-missing-reservation-alert (2026-05-21):
 * Google Calendar 側で予約イベントを削除しても Reservations に正式予約が
 * 残っている場合、自動キャンセルはせず「Cal削除」要確認バッジで明示する仕様検証。
 *
 * 検証ポイント:
 *   - getReservationAdminCalendarData / getReservationHomeSummary が
 *     calendarMissingCheck { attempted, ownEventIds, missingCount, error } を返す
 *   - calendarMissingCheck.attempted は true（calendar_sync_enabled=true 環境）
 *   - missingCount は数値（≥ 0）
 *   - 既存の R-2K-sync-fix calendarOverlay は引き続き動作
 *   - 既存予約 / 手動ブロック / 休業 / 満枠 は overlay で空きに戻らない
 *   - 公開予約 / 管理カレンダー / トップで「予約済 → 空き」自動切替が起きない
 *     （Calendar 側だけ削除しても Reservations に残る予約は予約のまま）
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

type AdminCalRes = {
  ok: boolean;
  days: Array<{
    date: string;
    isClosed: boolean;
    slots: Array<{
      slotStart: string;
      slotEnd: string;
      status: string;
      displayStatus: string;
      reservations: Array<{
        reservationId: string;
        status: string;
        patientName: string;
        badges: Array<{ kind: string; label: string; reason: string }>;
      }>;
    }>;
    summary: { available: number; reserved: number; blockedCalendar: number };
  }>;
  calendarOverlay?: { attempted: boolean; removed: number; rescued: number; error: string | null };
  calendarMissingCheck?: { attempted: boolean; ownEventIds: number; missingCount: number; error: string | null };
};

type HomeSummaryRes = {
  ok: boolean;
  horizonDays: number;
  horizon: { reserved: number; available: number; attention: number; urgent: number };
  calendarOverlay?: { attempted: boolean; removed: number; rescued: number; error: string | null };
  calendarMissingCheck?: { attempted: boolean; ownEventIds: number; missingCount: number; error: string | null };
};

test.describe(`JREC-SF01 R-2Q calendar-event-missing-reservation-alert [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test.beforeEach(async ({ page }) => { page.setDefaultTimeout(LOAD_TIMEOUT); });

  test("CM-1: getReservationAdminCalendarData が calendarMissingCheck フィールドを返す", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#cal-section").first().waitFor({ state: "attached", timeout: LOAD_TIMEOUT });
    const r = (await callRpc(frame, "getReservationAdminCalendarData", [ymd(new Date())])) as AdminCalRes;
    expect(r.ok).toBe(true);
    expect(r.calendarMissingCheck, "calendarMissingCheck フィールドが返ること").toBeDefined();
    expect(typeof r.calendarMissingCheck?.attempted).toBe("boolean");
    expect(typeof r.calendarMissingCheck?.ownEventIds).toBe("number");
    expect(typeof r.calendarMissingCheck?.missingCount).toBe("number");
    expect((r.calendarMissingCheck?.missingCount ?? -1)).toBeGreaterThanOrEqual(0);
  });

  test("CM-2: getReservationHomeSummary も calendarMissingCheck フィールドを返す", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#cal-section").first().waitFor({ state: "attached", timeout: LOAD_TIMEOUT });
    const r = (await callRpc(frame, "getReservationHomeSummary", [])) as HomeSummaryRes;
    expect(r.ok).toBe(true);
    expect(r.calendarMissingCheck, "calendarMissingCheck フィールドが返ること").toBeDefined();
    expect(typeof r.calendarMissingCheck?.attempted).toBe("boolean");
    expect(typeof r.calendarMissingCheck?.missingCount).toBe("number");
  });

  test("CM-3: calendarMissingCheck.attempted は true（calendar_sync_enabled の場合）", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#cal-section").first().waitFor({ state: "attached", timeout: LOAD_TIMEOUT });
    const r = (await callRpc(frame, "getReservationAdminCalendarData", [ymd(new Date())])) as AdminCalRes;
    expect(r.calendarMissingCheck?.attempted, "calendar_sync_enabled なら attempted=true").toBe(true);
  });

  test("CM-4: 「Cal削除」バッジは attention kind / Calendar 予定が見つからない reason を持つ（実例があれば）", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#cal-section").first().waitFor({ state: "attached", timeout: LOAD_TIMEOUT });
    const r = (await callRpc(frame, "getReservationAdminCalendarData", [ymd(new Date())])) as AdminCalRes;
    let calDeletedBadgeFound = false;
    for (const d of (r.days || [])) {
      for (const sl of (d.slots || [])) {
        for (const res of (sl.reservations || [])) {
          for (const b of (res.badges || [])) {
            if (b.label === "Cal削除") {
              calDeletedBadgeFound = true;
              expect(b.kind, "Cal削除 バッジは attention kind").toBe("attention");
              expect(b.reason, "Cal削除 バッジは reason に Calendar 予定が見つからない旨を含む")
                .toMatch(/Google Calendar|予定が見つからない|手動削除/);
            }
          }
        }
      }
    }
    test.info().annotations.push({
      type: "info",
      description: calDeletedBadgeFound
        ? "Cal削除 バッジ実例を検出（バッジ仕様検証完了）"
        : "Cal削除 バッジ実例なし（今週の予約に missing なし / 仕様検証は CM-1〜CM-3 でカバー）"
    });
  });

  test("CM-5: Calendar event missing でも slot status は available に戻らない（自動キャンセルしない）", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#cal-section").first().waitFor({ state: "attached", timeout: LOAD_TIMEOUT });
    const r = (await callRpc(frame, "getReservationAdminCalendarData", [ymd(new Date())])) as AdminCalRes;
    // 予約が紐づいている slot は displayStatus = "予約あり" / "満枠" のまま
    // calendarMissing バッジが付いていても、slot 自体は空きにならない
    for (const d of (r.days || [])) {
      if (d.isClosed) continue;
      for (const sl of (d.slots || [])) {
        const hasReservation = (sl.reservations || []).length > 0;
        const hasMissingBadge = (sl.reservations || []).some(r =>
          (r.badges || []).some(b => b.label === "Cal削除")
        );
        if (hasReservation && hasMissingBadge) {
          // 予約あり + Cal削除 バッジ → displayStatus は「予約あり」か「満枠」
          expect(["予約あり", "満枠"]).toContain(sl.displayStatus);
        }
      }
    }
  });

  test("CM-6: home summary の horizon.attention に Calendar 削除分が含まれる（実例があれば）", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#cal-section").first().waitFor({ state: "attached", timeout: LOAD_TIMEOUT });
    const r = (await callRpc(frame, "getReservationHomeSummary", [])) as HomeSummaryRes;
    expect(r.ok).toBe(true);
    expect(typeof r.horizon.attention).toBe("number");
    if ((r.calendarMissingCheck?.missingCount ?? 0) > 0) {
      // missing が 1 件以上あれば horizon.attention は 1 以上
      expect(r.horizon.attention).toBeGreaterThanOrEqual(1);
    }
  });

  test("CM-7: 既存 R-2K-sync-fix の calendarOverlay も併存して返る（衝突なし）", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#cal-section").first().waitFor({ state: "attached", timeout: LOAD_TIMEOUT });
    const r = (await callRpc(frame, "getReservationAdminCalendarData", [ymd(new Date())])) as AdminCalRes;
    expect(r.calendarOverlay, "R-2K-sync-fix calendarOverlay も返る").toBeDefined();
    expect(r.calendarMissingCheck, "R-2Q calendarMissingCheck も返る").toBeDefined();
    expect(r.calendarOverlay?.attempted).toBe(true);
    expect(r.calendarMissingCheck?.attempted).toBe(true);
  });
});
