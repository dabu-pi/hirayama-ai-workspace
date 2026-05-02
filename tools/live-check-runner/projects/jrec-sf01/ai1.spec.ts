/**
 * jrec-sf01 ai1.spec.ts
 * JREC-SF01 Phase AI-1 自動確認スペック（患者マスター・カルテ項目追加）
 *
 * 確認項目:
 *   AI1-1: 新規患者登録画面に「職業」「既往歴」の入力欄が存在する         → 自動
 *   AI1-3: カルテ入力画面に患者情報参照欄が存在する                      → testData.patientIdForVisitForm 要設定
 *   AI1-4: カルテ入力画面に「受傷起点」「今回追記既往歴」の入力欄が存在する → testData.patientIdForVisitForm 要設定
 *   AI1-7: 会計導線ページ（dailyCheckout）に到達できる                  → 自動
 *   AI1-8: 既存レポートページ到達 → smoke.spec.ts で確認済み             → skip(参照)
 *   AI1-9: モバイル表示崩れなし → smoke.spec.ts で確認済み               → skip(参照)
 *
 * 人間確認項目（このスペック対象外）:
 *   AI1-2: 既存患者編集・復元（データ依存）
 *   AI1-5: カルテ再編集・復元（データ依存）
 *   AI1-6: 既存データ互換（データ依存）
 *
 * 実行コマンド: npm run test:jrec:ai1
 *
 * GAS /dev のフレーム構造（error-context.md スナップショットにより確定）:
 *   page (top)
 *   └─ Google 警告テーブル
 *   └─ iframe (outer)           ← page.frameLocator('iframe').first()
 *      └─ iframe (inner)        ← .frameLocator('iframe').first()
 *         └─ GAS アプリ本体     ← ここに #occupation 等が存在
 *
 *   → DOM アクセスは gasAppFrame(page).locator() を使う
 *   → page.locator() はフレームを越えられないため不可
 *   → handleAuthRedirect は外側ページの URL/title で判定するため page.url() を使う（変更不要）
 *
 * auth.json がない場合・期限切れの場合は全テスト SKIP（エラーなし）
 * visitForm (AI1-3/AI1-4) は patientId 必須（Main.gs: idParam なし → renderError_）
 *   → testData.patientIdForVisitForm が空の場合は SKIP
 */

import { test, expect, Page } from "@playwright/test";
import fs from "fs";
import path from "path";
import config from "./config.json";

const DEV_URL      = config.devUrl;
const AUTH_FILE    = path.join(__dirname, "../../auth.json");
const HAS_AUTH     = fs.existsSync(AUTH_FILE);
const LOAD_TIMEOUT = 25_000;

// config.json の testData.patientIdForVisitForm を参照（visitForm テスト用）
const TEST_PATIENT_ID = config.testData.patientIdForVisitForm;

// ── フレームヘルパー ────────────────────────────────────────────────

/**
 * GAS /dev の実際の2段 iframe 構造に対応したフレームロケーター
 *
 * 構造: page > iframe[outer] > iframe[inner] > GAS コンテンツ
 * page.frameLocator('iframe').first() → 外側 iframe
 * .frameLocator('iframe').first()     → 内側 iframe（GAS 本体）
 */
function gasAppFrame(page: Page) {
  return page.frameLocator("iframe").first().frameLocator("iframe").first();
}

// ── 認証チェック ────────────────────────────────────────────────────

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
        : "Google 認証が必要です。npm run save-auth を実行して auth.json を作成してください。\n詳細: docs/GAS_LIVE_CHECK_NOTES.md"
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

// ── AI1-1: 新規患者登録画面 ─────────────────────────────────────────

test.describe(`JREC-SF01 AI1-1: 新規患者登録 — 職業・既往歴欄 [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
  });

  test("AI1-1a: newPatient — #occupation 入力欄が存在する", async ({ page }) => {
    await page.goto(`${DEV_URL}?page=newPatient`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await expect(frame.locator("#occupation")).toBeVisible({ timeout: LOAD_TIMEOUT });
  });

  test("AI1-1b: newPatient — #medicalHistory 入力欄が存在する", async ({ page }) => {
    await page.goto(`${DEV_URL}?page=newPatient`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await expect(frame.locator("#medicalHistory")).toBeVisible({ timeout: LOAD_TIMEOUT });
  });

  test("AI1-1c: newPatient — 「AI補助判定用情報」セクションタイトルが存在する", async ({ page }) => {
    await page.goto(`${DEV_URL}?page=newPatient`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await expect(frame.getByText("AI補助判定用情報", { exact: false })).toBeVisible({ timeout: LOAD_TIMEOUT });
  });
});

// ── AI1-3: 患者情報参照欄（patientId 設定時のみ） ──────────────────────

test.describe(`JREC-SF01 AI1-3: カルテ入力 — 患者情報参照欄 [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test("AI1-3: visitForm — 患者情報参照欄の存在確認 [patientIdForVisitForm 要設定]", async ({ page }) => {
    if (!TEST_PATIENT_ID) {
      test.skip(
        true,
        "AI1-3 は config.json の testData.patientIdForVisitForm に有効な患者IDが必要です。\n" +
        "JREC 患者一覧から既存の患者IDを確認して設定してください。\n" +
        "または、患者一覧から手動でカルテ画面を開き、職業・既往歴参照欄の表示を目視確認してください。\n" +
        "注意: 参照欄は患者の occupation/gender/age/medicalHistory のいずれかが存在する場合のみ表示される。"
      );
      return;
    }

    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=visitForm&id=${TEST_PATIENT_ID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    // 患者情報参照ブロックは visit-form.html でテキスト「患者情報参照」として描画される
    // （ID/class なし・インラインスタイルのみ）
    // 患者に occupation/gender/age/medicalHistory のいずれかがないと表示されない
    const frame = gasAppFrame(page);
    await expect(frame.getByText("患者情報参照", { exact: false })).toBeVisible({ timeout: LOAD_TIMEOUT });
  });
});

// ── AI1-4: 受傷起点・今回追記既往歴欄 ─────────────────────────────────

test.describe(`JREC-SF01 AI1-4: カルテ入力 — 受傷起点・今回追記既往歴欄 [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
  });

  test("AI1-4a: visitForm — #injuryTrigger 入力欄が存在する [patientIdForVisitForm 要設定]", async ({ page }) => {
    if (!TEST_PATIENT_ID) {
      test.skip(
        true,
        "AI1-4 は visitForm に patientId が必要です（Main.gs: patientId なし → エラーページ）。\n" +
        "config.json の testData.patientIdForVisitForm に有効な患者IDを設定してください。"
      );
      return;
    }

    await page.goto(`${DEV_URL}?page=visitForm&id=${TEST_PATIENT_ID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await expect(frame.locator("#injuryTrigger")).toBeVisible({ timeout: LOAD_TIMEOUT });
  });

  test("AI1-4b: visitForm — #relatedHistoryNote 入力欄が存在する [patientIdForVisitForm 要設定]", async ({ page }) => {
    if (!TEST_PATIENT_ID) {
      test.skip(
        true,
        "AI1-4 は visitForm に patientId が必要です（Main.gs: patientId なし → エラーページ）。\n" +
        "config.json の testData.patientIdForVisitForm に有効な患者IDを設定してください。"
      );
      return;
    }

    await page.goto(`${DEV_URL}?page=visitForm&id=${TEST_PATIENT_ID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await expect(frame.locator("#relatedHistoryNote")).toBeVisible({ timeout: LOAD_TIMEOUT });
  });
});

// ── AI1-7: 会計導線 ──────────────────────────────────────────────────

test.describe(`JREC-SF01 AI1-7: 会計導線 — dailyCheckout 到達確認 [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
  });

  test("AI1-7: dailyCheckout — 日付フォーム(#dateForm)が描画される", async ({ page }) => {
    await page.goto(`${DEV_URL}?page=dailyCheckout`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    // #dateForm は daily-checkout.html 固有の要素（会計画面が正常描画された証拠）
    const frame = gasAppFrame(page);
    await expect(frame.locator("#dateForm")).toBeVisible({ timeout: LOAD_TIMEOUT });
  });

  test("AI1-7: 「会計入力へ進む」ボタンは保存後に出現（手動確認推奨）", async () => {
    // カルテ保存後に「会計入力へ進む」ボタンが出現するため、保存を伴わない自動化では確認困難
    // 手動確認: 1) 患者選択 → 2) カルテ入力 → 3) 保存 → 4) 「会計入力へ進む」ボタンの表示確認
    test.skip(true, "「会計入力へ進む」ボタンはカルテ保存後に表示されるため手動確認推奨。dailyCheckout 到達確認は上記テストで実施済み。");
  });
});

// ── AI1-8/AI1-9: smoke.spec.ts 参照 ─────────────────────────────────

test.describe("JREC-SF01 AI1-8/AI1-9: smoke.spec.ts で確認済み", () => {
  test("AI1-8: 既存レポートページ到達 — smoke.spec.ts 参照", async () => {
    test.skip(
      true,
      "AI1-8 は smoke.spec.ts の home/dailyCheckout/monthlyReport/menuSalesReport/outstandingReport テストで確認済み。\n" +
      "実行: npm run test:jrec"
    );
  });

  test("AI1-9: モバイル表示崩れなし — smoke.spec.ts 参照", async () => {
    test.skip(
      true,
      "AI1-9 は smoke.spec.ts の「モバイル幅でページが壊れていない」テストで確認済み。\n" +
      "実行: npm run test:jrec"
    );
  });
});
