/**
 * jrec-sf01 home-reservation-summary-r2m.spec.ts
 *
 * Phase R-2M-home-summary (2026-05-21): JREC-SF01 トップページの予約状況
 * サマリーカード検証。
 *
 * 検証ポイント:
 *   - `?page=home` が HTTP 200 で表示される
 *   - `calMonth is not defined` が再発していない
 *   - `#res-summary-card` / `#res-summary-body` が DOM に存在
 *   - `getReservationHomeSummary()` が ok=true / 必須フィールドを返す
 *   - 返却値に PII（電話番号 / patientName / phone / 住所）が含まれない
 *   - 「予約管理カレンダーを開く」リンクが ?page=reservationAdmin を指す
 *   - R-2J / R-2K / R-2L / R-2M-admin-calendar は壊れていない
 *
 * READ-only: RPC は集計のみ、書き込みなし。
 */
import { test, expect, type Page, type FrameLocator } from "@playwright/test";
import path from "path";
import fs from "fs";
import config from "./config.json";

const DEV_URL = config.devUrl;
const HOME_URL  = DEV_URL + "?page=home";
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

type SummaryRes = {
  ok: boolean;
  generatedAt: string;
  horizonDays: number;
  today: { date: string; reserved: number; available: number; blocked: number; attention: number; urgent: number };
  tomorrow: { date: string; reserved: number; available: number; blocked: number; attention: number; urgent: number };
  week: { from: string; to: string; reserved: number; available: number; blocked: number; attention: number; urgent: number };
  month: { from: string; to: string; reserved: number; available: number; blocked: number; attention: number; urgent: number; truncated: boolean };
  horizon: { from: string; to: string; totalSlots: number; reserved: number; available: number; blocked: number; attention: number; urgent: number };
  nextOpen: { date: string; startTime: string; endTime: string } | null;
};

test.describe(`JREC-SF01 R-2M-home-summary トップ予約状況サマリー [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test.beforeEach(async ({ page }) => { page.setDefaultTimeout(LOAD_TIMEOUT); });

  test("HS-1: トップページ ?page=home が表示され #res-summary-card が DOM に存在", async ({ page }) => {
    const res = await page.goto(HOME_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    expect(res?.status()).toBeLessThan(400);
    const frame = gasAppFrame(page);
    await frame.locator("#res-summary-card").first().waitFor({ state: "attached", timeout: LOAD_TIMEOUT });
    await expect(frame.locator("#res-summary-body").first()).toBeAttached();
  });

  test("HS-2: calMonth is not defined エラーが再発していない", async ({ page }) => {
    await page.goto(HOME_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#res-summary-card").first().waitFor({ state: "attached", timeout: LOAD_TIMEOUT });
    const body = await frame.locator("body").first().innerText();
    expect(body, "ページ本文に 'calMonth is not defined' を含むべきでない").not.toContain("calMonth is not defined");
    expect(body, "ページ本文に 'テンプレート描画エラー' を含むべきでない").not.toContain("テンプレート描画エラー");
  });

  test("HS-3: getReservationHomeSummary() が ok=true / 必須フィールドを返す", async ({ page }) => {
    await page.goto(HOME_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#res-summary-card").first().waitFor({ state: "attached", timeout: LOAD_TIMEOUT });
    const r = (await callRpc(frame, "getReservationHomeSummary", [])) as SummaryRes;
    expect(r.ok).toBe(true);
    expect(r.horizonDays).toBeGreaterThanOrEqual(1);
    expect(r.today).toBeDefined();
    expect(r.today.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.tomorrow.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.week.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.week.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.month.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.horizon.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.horizon.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(typeof r.horizon.totalSlots).toBe("number");
    expect(typeof r.today.reserved).toBe("number");
    expect(typeof r.today.available).toBe("number");
    expect(typeof r.today.urgent).toBe("number");
    expect(typeof r.today.attention).toBe("number");
  });

  test("HS-4: 返却値に PII（patientName / phone / 電話番号文字列）が含まれていない", async ({ page }) => {
    await page.goto(HOME_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#res-summary-card").first().waitFor({ state: "attached", timeout: LOAD_TIMEOUT });
    const r = (await callRpc(frame, "getReservationHomeSummary", [])) as Record<string, unknown>;
    const json = JSON.stringify(r);
    expect(json, "patientName を含まない").not.toMatch(/patientName/i);
    expect(json, "phone を含まない").not.toMatch(/phone/i);
    expect(json, "patientNameKana を含まない").not.toMatch(/patientNameKana/i);
    expect(json, "symptoms 全文を含まない（badges の reason はキーワード抜粋のみ許容だが、本 RPC は badges を返さない）").not.toMatch(/symptoms/i);
    expect(json, "notes を含まない").not.toMatch(/notes/i);
    expect(json, "linkedPatientId は集計値のみ返すため含まない").not.toMatch(/linkedPatientId/i);
    // 日本のハイフン区切り電話番号パターン
    expect(json, "電話番号パターンを含まない").not.toMatch(/0\d{1,3}-\d{2,4}-\d{4}/);
  });

  test("HS-5: 「予約管理カレンダーを開く」リンク要素が DOM に存在", async ({ page }) => {
    await page.goto(HOME_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#res-summary-card").first().waitFor({ state: "attached", timeout: LOAD_TIMEOUT });
    const linkBtn = frame.locator(".res-summary-link").first();
    await expect(linkBtn).toBeAttached();
    const onclick = await linkBtn.getAttribute("onclick");
    expect(onclick || "").toContain("reservationAdmin");
  });

  test("HS-6: 既存 ?page=reservationAdmin / R-2M-admin-calendar が壊れていない", async ({ page }) => {
    const res = await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    expect(res?.status()).toBeLessThan(400);
    const frame = gasAppFrame(page);
    await frame.locator("#cal-section").first().waitFor({ state: "attached", timeout: LOAD_TIMEOUT });
    await expect(frame.locator("#cal-grid").first()).toBeAttached();
    await expect(frame.locator("#list-section").first()).toBeAttached();
  });
});
