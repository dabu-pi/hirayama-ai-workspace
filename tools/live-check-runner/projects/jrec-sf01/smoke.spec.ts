/**
 * jrec-sf01 smoke.spec.ts
 * JREC-SF01 HEAD /dev 到達確認
 *
 * 注意:
 * - GAS /dev は Google ログイン済みセッションが必要
 * - 未認証の場合はログイン画面にリダイレクトされる → test.skip
 * - iframe 内 DOM へのアクセスは frameLocator を使う
 * - このスペックは「ページ到達確認」の土台。E2E は ai1.spec.ts で扱う
 */

import { test, expect } from "@playwright/test";
import config from "./config.json";

const DEV_URL = config.devUrl;

// ── ヘルパー ─────────────────────────────────────────────
/** Google 認証画面が出ていたら skip する */
async function skipIfLoginRequired(page: import("@playwright/test").Page) {
  const url = page.url();
  if (
    url.includes("accounts.google.com") ||
    url.includes("signin") ||
    url.includes("ServiceLogin")
  ) {
    test.skip(
      true,
      "Google ログイン画面にリダイレクトされました。\n" +
      "storageState に認証済みセッションを設定してから再実行してください。\n" +
      "詳細: docs/GAS_LIVE_CHECK_NOTES.md"
    );
  }
}

// ── テスト ────────────────────────────────────────────────

test.describe("JREC-SF01 smoke — ページ到達確認", () => {
  test.beforeEach(async ({ page }) => {
    // タイムアウトは GAS のロード時間を考慮して長めに設定
    page.setDefaultTimeout(20_000);
  });

  test("home: devUrl に到達できる", async ({ page }) => {
    const response = await page.goto(DEV_URL, { waitUntil: "domcontentloaded" });
    await skipIfLoginRequired(page);

    // HTTP ステータスが 2xx か 3xx であること（GAS は 200 で返す）
    expect(response?.status()).toBeLessThan(400);
  });

  test("home: タイトルが JREC-SF01 を含む", async ({ page }) => {
    await page.goto(DEV_URL, { waitUntil: "domcontentloaded" });
    await skipIfLoginRequired(page);

    const title = await page.title();
    // GAS テンプレートのタイトル: "JREC-SF01 自費カルテ・会計"
    expect(title).toContain("JREC");
  });

  test("dailyCheckout: ?page=dailyCheckout に到達できる", async ({ page }) => {
    const url = `${DEV_URL}?page=dailyCheckout`;
    const response = await page.goto(url, { waitUntil: "domcontentloaded" });
    await skipIfLoginRequired(page);

    expect(response?.status()).toBeLessThan(400);
  });

  test("monthlyReport: ?page=monthlyReport に到達できる", async ({ page }) => {
    const url = `${DEV_URL}?page=monthlyReport`;
    const response = await page.goto(url, { waitUntil: "domcontentloaded" });
    await skipIfLoginRequired(page);

    expect(response?.status()).toBeLessThan(400);
  });

  test("menuSalesReport: ?page=menuSalesReport に到達できる", async ({ page }) => {
    const url = `${DEV_URL}?page=menuSalesReport`;
    const response = await page.goto(url, { waitUntil: "domcontentloaded" });
    await skipIfLoginRequired(page);

    expect(response?.status()).toBeLessThan(400);
  });

  test("outstandingReport: ?page=outstandingReport に到達できる", async ({ page }) => {
    const url = `${DEV_URL}?page=outstandingReport`;
    const response = await page.goto(url, { waitUntil: "domcontentloaded" });
    await skipIfLoginRequired(page);

    expect(response?.status()).toBeLessThan(400);
  });
});

test.describe("JREC-SF01 smoke — モバイル表示確認", () => {
  test("home: モバイル幅でページが壊れていない", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14 Pro
    await page.goto(DEV_URL, { waitUntil: "domcontentloaded" });
    await skipIfLoginRequired(page);

    // 水平スクロールバーが出ていないことを確認
    const scrollWidth  = await page.evaluate(() => document.body.scrollWidth);
    const clientWidth  = await page.evaluate(() => document.body.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 20); // 20px の許容誤差
  });
});
