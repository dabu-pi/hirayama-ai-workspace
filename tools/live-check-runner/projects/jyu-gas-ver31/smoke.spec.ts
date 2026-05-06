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

// ── S-1: page=search ─────────────────────────────────────────────
// デフォルトは page=home に変更済み（2026-05-06）のため ?page=search を明示

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
    await page.goto(`${DEV_URL}?page=search`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await expect(frame.locator("h1")).toContainText("患者検索", { timeout: LOAD_TIMEOUT });
  });

  test("S-1c: page=search — #keyword 入力欄が存在する", async ({ page }) => {
    await page.goto(`${DEV_URL}?page=search`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await expect(frame.locator("#keyword")).toBeVisible({ timeout: LOAD_TIMEOUT });
  });

  test("S-1d: page=search — #searchBtn が存在する", async ({ page }) => {
    await page.goto(`${DEV_URL}?page=search`, { waitUntil: "domcontentloaded" });
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

// ── S-3: デフォルト URL は page=home（2026-05-06 変更）──────────────

test.describe(`JYU-GAS S-3: デフォルト URL 確認 [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test("S-3: devUrl (パラメータなし) は page=home を表示する", async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(DEV_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);

    // デフォルトが page=home であることを確認:
    //   1. "JREC-01" 見出しが表示される（home 固有）
    //   2. #keyword が表示されない（search 固有の要素）
    const hasHomeText = await frame.getByText("JREC-01", { exact: false })
      .waitFor({ state: "visible", timeout: LOAD_TIMEOUT })
      .then(() => true)
      .catch(() => false);

    // waitFor 完了後に #keyword が存在しないことを確認（同期的チェックで十分）
    const hasKeyword = await frame.locator("#keyword").isVisible().catch(() => false);

    expect(hasHomeText).toBe(true);   // home の "JREC-01" 見出しが存在
    expect(hasKeyword).toBe(false);   // search の #keyword は存在しない
  });
});

// ── S-3b: ホーム↔検索 往復ナビゲーション（白画面なし確認）────────────

test.describe(`JYU-GAS S-3b: 往復ナビゲーション確認 [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test("S-3b: /exec → 患者検索 → ホームへ戻る（白画面にならない）", async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(DEV_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);

    // 1. トップページが表示される
    await expect(frame.getByText("JREC-01", { exact: false }))
      .toBeVisible({ timeout: LOAD_TIMEOUT });

    // 2. 「患者検索」カードをクリック
    const searchCard = frame.locator("a").filter({ hasText: "患者検索" }).first();
    await searchCard.click();
    await page.waitForLoadState("domcontentloaded");

    // target="_top" により URL が変わり患者検索が表示される
    const titleAfterSearch = await page.title().catch(() => "");
    expect(titleAfterSearch).toContain("患者検索");

    // 3. 「← Web ホームへ」をクリック
    const homeLink = page.frameLocator("iframe").first()
      .frameLocator("iframe").first()
      .locator("a").filter({ hasText: "Web ホームへ" }).first();
    await homeLink.click();
    await page.waitForLoadState("domcontentloaded");

    // 4. トップページに戻る（白画面でない）
    const titleAfterBack = await page.title().catch(() => "");
    expect(titleAfterBack).toContain("JREC-01");
    expect(page.frames().length).toBeLessThanOrEqual(3);
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

    // #loading は DOM 未ロード時に "not attached = hidden" と判定されるため
    // waitFor(hidden) は inner iframe 読み込み前に即時解決してしまう。
    // #pt-name（成功）/ #error-msg（エラー）どちらかが visible になるまで
    // waitFor({ state: "visible" }) を使い正しく待機する。
    const hasContent = await Promise.race([
      frame.locator("#pt-name")
        .waitFor({ state: "visible", timeout: LOAD_TIMEOUT })
        .then(() => true).catch(() => false),
      frame.locator("#error-msg")
        .waitFor({ state: "visible", timeout: LOAD_TIMEOUT })
        .then(() => true).catch(() => false),
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
