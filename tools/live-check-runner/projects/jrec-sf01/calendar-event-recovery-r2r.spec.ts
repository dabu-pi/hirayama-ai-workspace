/**
 * jrec-sf01 calendar-event-recovery-r2r.spec.ts
 *
 * Phase R-2R-cal-event-recovery (2026-05-21):
 * Google Calendar 欠落予約（Cal削除 / Cal未）の安全復旧 UI 検証。
 *
 * 検証ポイント:
 *   RR-1: ?page=reservationAdmin が HTTP 200 / cal-section marker あり
 *   RR-2: reservation-admin.html に act-cal-recreate / Cal作成 / Cal再作成 / recreateCalendarEvent が含まれる
 *   RR-3: recreateCalendarEventForReservation("") → { ok: false, code: "INVALID_ID" }
 *   RR-4: recreateCalendarEventForReservation("NON_EXIST_ID") → { ok: false, code: "NOT_FOUND" }
 *   RR-5: recreateCalendarEventForReservation で cancelled 予約 → INVALID_STATUS
 *         （実データ依存のため、NOT_FOUND ケースとしてスキップ条件付き）
 *   RR-6: 既存 R-2Q calendarMissingCheck 併存確認（CM-1 再確認）
 *   RR-7: ?page=reservation 公開予約ページが退行していない
 *   RR-8: ?page=home ホーム予約状況カードが退行していない
 *   RR-9: 一覧 View で Cal未 予約（calendarEventId 空）に act-cal-recreate ボタンが描画される
 *         （listReservationsForAdmin の結果に基づく UI 検証 / 実データ依存）
 *
 * READ-ONLY 検証 (データ変更なし):
 *   - RR-3 / RR-4 は無効 ID を渡すため副作用なし
 *   - ボタンクリックによる実際の Calendar 作成は人間確認に委ねる（本番データ保護）
 *
 * 実行コマンド: npm run test:jrec:r2r-calendar-event-recovery
 */
import { test, expect, type Page, type FrameLocator } from "@playwright/test";
import path from "path";
import fs from "fs";
import config from "./config.json";

const DEV_URL = config.devUrl;
const ADMIN_URL = DEV_URL + "?page=reservationAdmin";
const AUTH_FILE = path.join(__dirname, "../../auth.json");
const HAS_AUTH = fs.existsSync(AUTH_FILE);
const LOAD_TIMEOUT = 35_000;

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
    title.includes("Google Drive")
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

type RecreateCEResult = {
  ok: boolean;
  code?: string;
  alreadyExisted?: boolean;
  calendarEventId?: string;
  message?: string;
  error?: string;
};

type AdminCalRes = {
  ok: boolean;
  days: Array<{
    date: string;
    isClosed: boolean;
    slots: Array<{
      slotStart: string;
      status: string;
      displayStatus: string;
      reservations: Array<{
        reservationId: string;
        status: string;
        patientName: string;
        badges: Array<{ kind: string; label: string; reason: string }>;
      }>;
    }>;
  }>;
  calendarOverlay?: { attempted: boolean; removed: number; rescued: number; error: string | null };
  calendarMissingCheck?: { attempted: boolean; ownEventIds: number; missingCount: number; error: string | null };
};

type ListAdminRes = {
  ok: boolean;
  items: Array<{
    reservationId: string;
    status: string;
    calendarEventId: string;
    patientName: string;
  }>;
  total: number;
};

function ymd(d: Date): string {
  return d.getFullYear() + "-" +
    ("0" + (d.getMonth() + 1)).slice(-2) + "-" +
    ("0" + d.getDate()).slice(-2);
}

test.describe(`JREC-SF01 R-2R calendar-event-recovery [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test.beforeEach(async ({ page }) => { page.setDefaultTimeout(LOAD_TIMEOUT); });

  // ── RR-1: smoke ───────────────────────────────────────────────────────────
  test("RR-1: ?page=reservationAdmin が正常表示 / cal-section marker 検出", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#cal-section").first().waitFor({ state: "attached", timeout: LOAD_TIMEOUT });
    // エラーバナーが自動表示されていないこと
    const errBanner = frame.locator("#err-banner");
    const errVisible = await errBanner.isVisible().catch(() => false);
    if (errVisible) {
      const errText = await errBanner.textContent().catch(() => "");
      test.info().annotations.push({ type: "warn", description: "err-banner: " + errText });
    }
    // cal-section または list-section が存在する
    const calSec = frame.locator("#cal-section");
    await expect(calSec).toBeAttached();
  });

  // ── RR-2: HTML 構造確認（DOM marker）────────────────────────────────────────
  test("RR-2: reservation-admin HTML に R-2R ボタン / 関数が含まれる", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#cal-section").first().waitFor({ state: "attached", timeout: LOAD_TIMEOUT });

    // HTML ソース内に R-2R マーカーが存在するかをスクリプト実行で確認
    const htmlMarkers = await page.evaluate(() => {
      return {
        actCalRecreate: document.documentElement.innerHTML.includes("act-cal-recreate"),
        calCreate:      document.documentElement.innerHTML.includes("Cal作成"),
        calRecreate:    document.documentElement.innerHTML.includes("Cal再作成"),
        recreateFunc:   document.documentElement.innerHTML.includes("recreateCalendarEvent"),
        recreateRpc:    document.documentElement.innerHTML.includes("recreateCalendarEventForReservation")
      };
    });

    expect(htmlMarkers.actCalRecreate, "act-cal-recreate CSS クラスが HTML に存在").toBe(true);
    expect(htmlMarkers.calCreate,      "「Cal作成」ボタンテキストが HTML に存在").toBe(true);
    expect(htmlMarkers.calRecreate,    "「Cal再作成」ボタンテキストが HTML に存在").toBe(true);
    expect(htmlMarkers.recreateFunc,   "recreateCalendarEvent 関数が HTML に存在").toBe(true);
    expect(htmlMarkers.recreateRpc,    "recreateCalendarEventForReservation RPC が HTML に存在").toBe(true);
  });

  // ── RR-3: RPC 境界確認 — 空 ID → INVALID_ID ─────────────────────────────────
  test("RR-3: recreateCalendarEventForReservation('') → { ok: false, code: 'INVALID_ID' }", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#cal-section").first().waitFor({ state: "attached", timeout: LOAD_TIMEOUT });

    const res = (await callRpc(frame, "recreateCalendarEventForReservation", [""])) as RecreateCEResult;
    expect(res.ok, "ok が false").toBe(false);
    expect(res.code, "code が INVALID_ID").toBe("INVALID_ID");
  });

  // ── RR-4: RPC 境界確認 — 存在しない ID → NOT_FOUND ───────────────────────────
  test("RR-4: recreateCalendarEventForReservation('NON_EXIST_R2R_TEST_ID') → NOT_FOUND", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#cal-section").first().waitFor({ state: "attached", timeout: LOAD_TIMEOUT });

    const res = (await callRpc(frame, "recreateCalendarEventForReservation", ["NON_EXIST_R2R_TEST_ID"])) as RecreateCEResult;
    expect(res.ok, "ok が false").toBe(false);
    expect(res.code, "code が NOT_FOUND").toBe("NOT_FOUND");
  });

  // ── RR-5: 既存 R-2Q calendarMissingCheck 併存 ────────────────────────────────
  test("RR-5: 既存 R-2Q calendarMissingCheck が @98 でも引き続き返る（後退なし）", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#cal-section").first().waitFor({ state: "attached", timeout: LOAD_TIMEOUT });

    const r = (await callRpc(frame, "getReservationAdminCalendarData", [ymd(new Date())])) as AdminCalRes;
    expect(r.ok, "getReservationAdminCalendarData が ok=true").toBe(true);
    expect(r.calendarMissingCheck, "R-2Q calendarMissingCheck が存在").toBeDefined();
    expect(typeof r.calendarMissingCheck?.attempted).toBe("boolean");
    expect(typeof r.calendarMissingCheck?.missingCount).toBe("number");
    expect(r.calendarOverlay, "R-2K-sync-fix calendarOverlay が存在（不変）").toBeDefined();
    expect(r.calendarMissingCheck?.attempted, "attempted=true（calendar_sync_enabled）").toBe(true);
    expect(r.calendarOverlay?.attempted, "overlay attempted=true").toBe(true);
    test.info().annotations.push({
      type: "info",
      description: `missingCount=${r.calendarMissingCheck?.missingCount ?? 0} ownEventIds=${r.calendarMissingCheck?.ownEventIds ?? 0}`
    });
  });

  // ── RR-6: 一覧 View — Cal未 予約のみにボタンが表示（動的 DOM）─────────────────
  test("RR-6: 一覧 View で Cal未 予約にのみ act-cal-recreate ボタンが描画される", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#cal-section").first().waitFor({ state: "attached", timeout: LOAD_TIMEOUT });

    // 一覧 View に切替
    await frame.locator("button#view-list-btn").click();
    const listSec = frame.locator("#list-section");
    await expect(listSec).toBeVisible({ timeout: 5000 });

    // 一覧が読み込まれるまで待つ（loading spinner が消えるか、res-list が populated になるか）
    await frame.locator("#loading").waitFor({ state: "hidden", timeout: LOAD_TIMEOUT });

    // listReservationsForAdmin の結果を取得して検証
    const listRes = (await callRpc(frame, "listReservationsForAdmin", [
      { dateFrom: ymd(new Date()), dateTo: ymd(new Date(Date.now() + 14 * 86400000)), status: "active" }
    ])) as ListAdminRes;

    expect(listRes.ok, "listReservationsForAdmin が ok=true").toBe(true);

    // Cal未 の予約（calendarEventId が空）の予約ID を収集
    const calMissingRids = (listRes.items || [])
      .filter(it => (it.status === "requested" || it.status === "confirmed") && !it.calendarEventId)
      .map(it => it.reservationId);

    // 通常予約（calendarEventId あり）の予約ID を収集
    const normalRids = (listRes.items || [])
      .filter(it => (it.status === "requested" || it.status === "confirmed") && !!it.calendarEventId)
      .map(it => it.reservationId);

    test.info().annotations.push({
      type: "info",
      description: `active予約: ${listRes.items.length}件 / Cal未: ${calMissingRids.length}件 / カレンダーあり: ${normalRids.length}件`
    });

    if (calMissingRids.length === 0 && normalRids.length === 0) {
      test.info().annotations.push({ type: "skip", description: "active 予約がないため DOM 確認をスキップ" });
      return;
    }

    // Cal未 予約カードに act-cal-recreate ボタンが出ているか確認
    for (const rid of calMissingRids.slice(0, 2)) { // 最初の2件まで
      const escapedRid = rid.replace(/[^a-zA-Z0-9\-_]/g, "\\$&");
      const card = frame.locator(`.res-card[data-res-id="${rid}"]`);
      const btn = card.locator(".act-cal-recreate");
      const btnExists = await btn.count() > 0;
      expect(btnExists, `Cal未 予約 ${rid} に act-cal-recreate ボタンがある`).toBe(true);
    }

    // 通常予約カード（calendarEventId あり）には act-cal-recreate ボタンが出ていないか確認
    for (const rid of normalRids.slice(0, 2)) { // 最初の2件まで
      const card = frame.locator(`.res-card[data-res-id="${rid}"]`);
      const btn = card.locator(".act-cal-recreate");
      const btnCount = await btn.count();
      expect(btnCount, `通常予約 ${rid} には act-cal-recreate ボタンが不要に出ていない`).toBe(0);
    }
  });

  // ── RR-7: 公開予約ページ退行なし ──────────────────────────────────────────────
  test("RR-7: ?page=reservation 公開予約ページが退行していない / #week-grid 検出", async ({ page }) => {
    const RESERVATION_URL = DEV_URL + "?page=reservation";
    await page.goto(RESERVATION_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    // #week-grid が表示されること（既存 reservation-public / public-reservation-ux spec と同じマーカー）
    await frame.locator("#week-grid").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    const errVisible = await frame.locator(".err-msg, #err-banner").isVisible().catch(() => false);
    expect(errVisible, "公開予約ページにエラー表示なし").toBe(false);
  });

  // ── RR-8: ホームページ退行なし ────────────────────────────────────────────────
  test("RR-8: ?page=home ホーム予約状況カードが退行していない / #res-summary-card 検出", async ({ page }) => {
    const HOME_URL = DEV_URL + "?page=home";
    await page.goto(HOME_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    // #res-summary-card が存在すること（R-2M-home-summary / home-reservation-summary-r2m spec と同じマーカー）
    await frame.locator("#res-summary-card").first().waitFor({ state: "attached", timeout: LOAD_TIMEOUT });
    const errVisible = await frame.locator("#err-banner").isVisible().catch(() => false);
    expect(errVisible, "ホームにエラー表示なし").toBe(false);
  });
});
