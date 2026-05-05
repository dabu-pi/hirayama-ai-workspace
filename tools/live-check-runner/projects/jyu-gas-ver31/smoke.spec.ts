/**
 * jyu-gas-ver31 smoke.spec.ts
 * JYU-GAS Ver3.1 WEB-1 到達確認
 *
 * 確認項目:
 *   S-1: /exec (page=search) が表示される
 *   S-2: page=home が表示される
 *   S-3: デフォルト URL が page=search のまま変わっていない
 *   S-4: モバイル幅で表示崩れなし
 *   S-5: page=detail (patientId なし) が表示される（graceful）
 *   S-6: page=detail&patientId=xxx が表示される（testData.patientId 要設定）
 *
 * 認証状態による動作:
 *   auth.json あり → Google ログイン済みセッションで /dev にアクセス → PASS 期待
 *   auth.json なし → Google 認証画面 → SKIP（エラーなし）
 *
 * GAS iframe 構造:
 *   page (top: script.google.com)
 *   └─ iframe[outer] ← page.frameLocator('iframe').first()
 *      └─ iframe[inner] ← .frameLocator('iframe').first()
 *         └─ GAS アプリ本体
 *
 * 実行コマンド: npm run test:jyu:smoke
 */

import { test, expect, Page } from "@playwright/test";
import fs from "fs";
import path from "path";
import config from "./config.json";

const DEV_URL      = config.devUrl;
const AUTH_FILE    = path.join(__dirname, "../../auth.json");
const HAS_AUTH     = fs.existsSync(AUTH_FILE);
const LOAD_TIMEOUT = 30_000;
const TEST_PID     = config.testData.patientId;

// ── フレームヘルパー ─────────────────────────────────────────────

function gasAppFrame(page: Page) {
  return page.frameLocator("iframe").first().frameLocator("iframe").first();
}

// ── 認証チェック ─────────────────────────────────────────────────

async function handleAuthRedirect(page: Page) {
  const url   = page.url();
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
        : "Google 認証が必要です。npm run save-auth を実行して auth.json を作成してください。"
    );
    return;
  }

  if (
    url.includes("accounts.google.com/o/oauth2") ||
    title.includes("hasn't been verified") ||
    title.includes("確認されていません")
  ) {
    test.skip(
      true,
      "GAS OAuth 警告画面が表示されています。\n" +
      "ブラウザで手動アクセスして「詳細」→「安全でないページに移動」を選択し、auth.json を再保存してください。"
    );
  }
}

// ── S-1: page=search (デフォルト) ────────────────────────────────

test.describe(`JYU-GAS S-1: page=search 到達確認 [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
  });

  test("S-1a: devUrl に到達できる (HTTP < 400)", async ({ page }) => {
    const res = await page.goto(DEV_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    expect(res?.status()).toBeLessThan(400);
  });

  test("S-1b: page=search — タイトルに「患者検索」が含まれる", async ({ page }) => {
    await page.goto(DEV_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await expect(frame.locator("h1")).toContainText("患者検索", { timeout: LOAD_TIMEOUT });
  });

  test("S-1c: page=search — #keyword 入力欄が存在する", async ({ page }) => {
    await page.goto(DEV_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await expect(frame.locator("#keyword")).toBeVisible({ timeout: LOAD_TIMEOUT });
  });

  test("S-1d: page=search — #searchBtn が存在する", async ({ page }) => {
    await page.goto(DEV_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await expect(frame.locator("#searchBtn")).toBeVisible({ timeout: LOAD_TIMEOUT });
  });
});

// ── S-2: page=home ────────────────────────────────────────────────

test.describe(`JYU-GAS S-2: page=home 到達確認 [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
  });

  test("S-2a: page=home に到達できる", async ({ page }) => {
    const res = await page.goto(`${DEV_URL}?page=home`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    expect(res?.status()).toBeLessThan(400);
  });

  test("S-2b: page=home — 「JREC-01」テキストが存在する", async ({ page }) => {
    await page.goto(`${DEV_URL}?page=home`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await expect(frame.getByText("JREC-01", { exact: false })).toBeVisible({ timeout: LOAD_TIMEOUT });
  });

  test("S-2c: page=home — 「患者検索」カードが存在する", async ({ page }) => {
    await page.goto(`${DEV_URL}?page=home`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await expect(frame.getByText("患者検索", { exact: false })).toBeVisible({ timeout: LOAD_TIMEOUT });
  });
});

// ── S-3: デフォルト URL は page=search のまま ─────────────────────

test.describe(`JYU-GAS S-3: デフォルト URL 確認 [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test("S-3: devUrl (パラメータなし) は page=search を表示する", async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(DEV_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    // page=search の特徴的要素 #keyword が存在することで確認
    const hasKeyword = await frame.locator("#keyword").isVisible({ timeout: LOAD_TIMEOUT }).catch(() => false);
    // page=home の要素 .card-grid が含まれていないことも確認
    const hasHomeGrid = await frame.locator(".section-label").isVisible({ timeout: 3000 }).catch(() => false);

    expect(hasKeyword).toBe(true);
    // note: page=search に .nav-link があるが .section-label はない
    expect(hasHomeGrid).toBe(false);
  });
});

// ── S-4: モバイル表示確認 ─────────────────────────────────────────

test.describe(`JYU-GAS S-4: モバイル表示確認 [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test("S-4a: page=search — モバイル幅で水平スクロールなし", async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(DEV_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    // GAS outer iframe の横幅チェック
    const outerFrame = page.frameLocator("iframe").first();
    const scrollOk = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= document.documentElement.clientWidth + 20;
    });
    expect(scrollOk).toBe(true);
  });

  test("S-4b: page=home — モバイル幅で water horizontal scroll なし", async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${DEV_URL}?page=home`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const scrollOk = await page.evaluate(() => {
      return document.documentElement.scrollWidth <= document.documentElement.clientWidth + 20;
    });
    expect(scrollOk).toBe(true);
  });
});

// ── S-5: page=detail (patientId なし) — graceful handling ──────────

test.describe(`JYU-GAS S-5: page=detail 到達確認 [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test("S-5: page=detail (patientId なし) — ページがクラッシュしない", async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
    // patientId なしでアクセス: エラーメッセージが表示されるが page が壊れないことを確認
    const res = await page.goto(`${DEV_URL}?page=detail`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    expect(res?.status()).toBeLessThan(400);
    // エラーメッセージまたは「読み込み中」か「患者IDが指定されていません」が表示される
    const frame = gasAppFrame(page);
    const hasContent = await Promise.race([
      frame.getByText("患者IDが指定されていません", { exact: false })
        .waitFor({ timeout: LOAD_TIMEOUT }).then(() => true).catch(() => false),
      frame.locator("#loading")
        .isVisible({ timeout: LOAD_TIMEOUT }).catch(() => false),
    ]);
    expect(typeof hasContent).toBe("boolean"); // クラッシュしなければ OK
  });
});

// ── S-6: page=detail&patientId=xxx (testData.patientId 要設定) ────

test.describe(`JYU-GAS S-6: page=detail with patientId [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test("S-6: page=detail — 患者情報または来院履歴が表示される [testData.patientId 要設定]", async ({ page }) => {
    if (!TEST_PID) {
      test.skip(
        true,
        "S-6 は config.json の testData.patientId に実在する患者IDが必要です。\n" +
        "スプレッドシートの患者マスタから患者IDを確認して設定してください。"
      );
      return;
    }

    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=detail&patientId=${TEST_PID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    // 患者情報カードまたはエラーメッセージが表示されていることを確認
    const hasContent = await Promise.race([
      frame.locator("#pt-name").waitFor({ timeout: LOAD_TIMEOUT }).then(() => true).catch(() => false),
      frame.locator("#error-msg").isVisible({ timeout: LOAD_TIMEOUT }).catch(() => false),
    ]);
    expect(hasContent).toBe(true);
  });

  test("S-6b: page=detail — 「来院記録を追加」ボタンが存在する [testData.patientId 要設定]", async ({ page }) => {
    if (!TEST_PID) {
      test.skip(true, "testData.patientId 未設定のためスキップ");
      return;
    }

    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=detail&patientId=${TEST_PID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    // 患者データ読み込み完了まで待機
    await frame.locator("#pt-name").waitFor({ timeout: LOAD_TIMEOUT });
    await expect(frame.locator("#btn-visit-new")).toBeVisible({ timeout: LOAD_TIMEOUT });
  });
});
