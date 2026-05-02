/**
 * jrec-sf01 smoke.spec.ts
 * JREC-SF01 HEAD /dev 到達確認
 *
 * 認証状態による動作:
 *   auth.json あり → Google ログイン済みセッションで GAS /dev にアクセス → PASS 期待
 *   auth.json なし → 未認証 → accounts.google.com にリダイレクト → SKIP（エラーなし）
 *
 * 注意:
 *   - GAS /dev コンテンツは googleusercontent.com iframe 内に表示される
 *   - iframe 内 DOM へのアクセスは frameLocator を使う（ai1.spec.ts で扱う）
 *   - このスペックは「ページ到達確認」の土台。E2E は ai1.spec.ts で扱う
 */

import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import config from "./config.json";

const DEV_URL   = config.devUrl;
const AUTH_FILE = path.join(__dirname, "../../auth.json");
const HAS_AUTH  = fs.existsSync(AUTH_FILE);

// ── ヘルパー ─────────────────────────────────────────────

/** 現在の URL とタイトルから認証状態を判定して skip または warn */
async function handleAuthRedirect(page: import("@playwright/test").Page) {
  const url   = page.url();
  const title = await page.title().catch(() => "");

  // Google ログイン画面
  if (
    url.includes("accounts.google.com") ||
    url.includes("ServiceLogin") ||
    title.includes("Sign in") ||
    title.includes("Google Drive: Sign-in")
  ) {
    if (HAS_AUTH) {
      // auth.json があるのにログイン画面 → セッション期限切れ
      test.skip(
        true,
        "auth.json のセッションが期限切れか、別アカウントでのログインが必要です。\n" +
        "tsx scripts/setup-auth.ts を実行してセッションを再作成してください。"
      );
    } else {
      // auth.json なし → 通常の skip
      test.skip(
        true,
        "Google ログイン画面にリダイレクトされました（auth.json なし）。\n" +
        "tsx scripts/setup-auth.ts の手順に従ってセッションを作成してください。\n" +
        "詳細: docs/GAS_LIVE_CHECK_NOTES.md"
      );
    }
    return;
  }

  // Google の「このアプリは確認されていません」警告画面
  if (
    url.includes("accounts.google.com/o/oauth2") ||
    title.includes("hasn't been verified") ||
    title.includes("確認されていません")
  ) {
    test.skip(
      true,
      "GAS OAuth 警告画面が表示されています。\n" +
      "ブラウザで手動アクセスして「詳細」→「安全でないページに移動」を選択してください。\n" +
      "その後 storageState を再保存してください。"
    );
  }
}

// ── テスト ────────────────────────────────────────────────

test.describe(`JREC-SF01 smoke — ページ到達確認 [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(20_000);
  });

  test("home: devUrl に到達できる", async ({ page }) => {
    const response = await page.goto(DEV_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    expect(response?.status()).toBeLessThan(400);
  });

  test("home: タイトルが JREC-SF01 を含む", async ({ page }) => {
    await page.goto(DEV_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const title = await page.title();
    expect(title).toContain("JREC");
  });

  test("newPatient: ?page=newPatient に到達できる", async ({ page }) => {
    const response = await page.goto(`${DEV_URL}?page=newPatient`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    expect(response?.status()).toBeLessThan(400);
  });

  test("dailyCheckout: ?page=dailyCheckout に到達できる", async ({ page }) => {
    const response = await page.goto(`${DEV_URL}?page=dailyCheckout`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    expect(response?.status()).toBeLessThan(400);
  });

  test("monthlyReport: ?page=monthlyReport に到達できる", async ({ page }) => {
    const response = await page.goto(`${DEV_URL}?page=monthlyReport`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    expect(response?.status()).toBeLessThan(400);
  });

  test("menuSalesReport: ?page=menuSalesReport に到達できる", async ({ page }) => {
    const response = await page.goto(`${DEV_URL}?page=menuSalesReport`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    expect(response?.status()).toBeLessThan(400);
  });

  test("outstandingReport: ?page=outstandingReport に到達できる", async ({ page }) => {
    const response = await page.goto(`${DEV_URL}?page=outstandingReport`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    expect(response?.status()).toBeLessThan(400);
  });
});

test.describe(`JREC-SF01 smoke — モバイル表示確認 [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test("home: モバイル幅でページが壊れていない", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(DEV_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
    const clientWidth = await page.evaluate(() => document.body.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 20);
  });
});
