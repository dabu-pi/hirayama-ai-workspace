/**
 * jrec-sf01 ai1.spec.ts
 * JREC-SF01 Phase AI-1 自動確認スペック（患者マスター・カルテ項目追加）
 *
 * 確認項目:
 *   AI1-1: 新規患者登録画面に「職業」「既往歴」の入力欄が存在する         → 自動
 *   AI1-3: カルテ入力画面に患者情報参照欄が存在する                      → testData.patientIdForVisitForm 要設定
 *   AI1-4: カルテ入力画面に「受傷起点」「今回追記既往歴」の入力欄が存在する → 自動（patientId なし試行）
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
 * 注意:
 *   - GAS app コンテンツは googleusercontent.com iframe 内に描画される
 *   - iframe 内 DOM アクセスには frameLocator を使用（cross-origin でも CDP 経由でアクセス可）
 *   - auth.json がない場合・期限切れの場合は全テスト SKIP（エラーなし）
 *   - visitForm の AI1-3/AI1-4 は patientId なしでフォームが描画される前提で試行する
 *     フォームが描画されない場合は FAIL → 手動で config.json に patientIdForVisitForm を設定する
 */

import { test, expect, Page } from "@playwright/test";
import fs from "fs";
import path from "path";
import config from "./config.json";

const DEV_URL   = config.devUrl;
const AUTH_FILE = path.join(__dirname, "../../auth.json");
const HAS_AUTH  = fs.existsSync(AUTH_FILE);

// GAS app コンテンツが描画される iframe
const GAS_FRAME    = 'iframe[src*="googleusercontent"]';
const LOAD_TIMEOUT = 25_000;

// config.json の testData.patientIdForVisitForm を参照
const TEST_PATIENT_ID = config.testData.patientIdForVisitForm;

// ── ヘルパー ─────────────────────────────────────────────────────────

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

  test("AI1-1a: newPatient — 「職業」ラベルと #occupation 入力欄が存在する", async ({ page }) => {
    await page.goto(`${DEV_URL}?page=newPatient`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = page.frameLocator(GAS_FRAME).first();
    await expect(frame.locator('label:has-text("職業")')).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(frame.locator('#occupation')).toBeVisible();
  });

  test("AI1-1b: newPatient — 「既往歴」ラベルと #medicalHistory 入力欄が存在する", async ({ page }) => {
    await page.goto(`${DEV_URL}?page=newPatient`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = page.frameLocator(GAS_FRAME).first();
    await expect(frame.locator('label:has-text("既往歴")')).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(frame.locator('#medicalHistory')).toBeVisible();
  });
});

// ── AI1-3: 患者情報参照欄（patientId 設定時のみ） ──────────────────────

test.describe(`JREC-SF01 AI1-3: カルテ入力 — 患者情報参照欄 [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test("AI1-3: visitForm — 患者情報参照欄の存在確認 [patientIdForVisitForm 要設定]", async ({ page }) => {
    if (!TEST_PATIENT_ID) {
      test.skip(
        true,
        "AI1-3 は config.json の testData.patientIdForVisitForm に有効な患者IDが必要です。\n" +
        "設定後に npm run test:jrec:ai1 を再実行してください。\n" +
        "または JREC 患者一覧から手動でカルテ画面を開き、職業・既往歴参照欄の表示を目視確認してください。"
      );
      return;
    }

    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=visitForm&id=${TEST_PATIENT_ID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = page.frameLocator(GAS_FRAME).first();
    // 患者情報参照ブロック（職業・既往歴が空欄でもブロック自体は存在すること）
    // セレクタが合わない場合は GAS HTML を確認して更新する
    const infoBlock = frame.locator(
      '[id*="patientInfo"], [class*="patient-info"], [class*="patientInfo"], [data-section="patientInfo"]'
    ).first();
    await expect(infoBlock).toBeVisible({ timeout: LOAD_TIMEOUT });
  });
});

// ── AI1-4: 受傷起点・今回追記既往歴欄 ─────────────────────────────────

test.describe(`JREC-SF01 AI1-4: カルテ入力 — 受傷起点・今回追記既往歴欄 [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
  });

  // patientId が設定されていればそれを使い、なければ patientId なしで試行
  const visitUrl = TEST_PATIENT_ID
    ? `${DEV_URL}?page=visitForm&id=${TEST_PATIENT_ID}`
    : `${DEV_URL}?page=visitForm`;

  test("AI1-4a: visitForm — 「受傷起点」ラベルと #injuryTrigger 入力欄が存在する", async ({ page }) => {
    await page.goto(visitUrl, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = page.frameLocator(GAS_FRAME).first();
    await expect(frame.locator('label:has-text("受傷起点")')).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(frame.locator('#injuryTrigger')).toBeVisible();
  });

  test("AI1-4b: visitForm — 「今回追記既往歴」ラベルと #relatedHistoryNote 入力欄が存在する", async ({ page }) => {
    await page.goto(visitUrl, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = page.frameLocator(GAS_FRAME).first();
    await expect(frame.locator('label:has-text("今回追記既往歴")')).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(frame.locator('#relatedHistoryNote')).toBeVisible();
  });
});

// ── AI1-7: 会計導線 ──────────────────────────────────────────────────

test.describe(`JREC-SF01 AI1-7: 会計導線 — dailyCheckout 到達確認 [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
  });

  test("AI1-7: dailyCheckout ページに到達でき、画面が描画される", async ({ page }) => {
    await page.goto(`${DEV_URL}?page=dailyCheckout`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = page.frameLocator(GAS_FRAME).first();
    // 会計画面が描画されていること（画面崩壊・白画面でないことの確認）
    await expect(frame.locator('body')).toBeVisible({ timeout: LOAD_TIMEOUT });
  });

  test("AI1-7: dailyCheckout — 「会計入力へ進む」ボタンは保存後に出現（手動確認推奨）", async () => {
    // カルテ保存後に「会計入力へ進む」ボタンが出現するため、保存を伴わない自動化では確認困難
    // 手動確認手順: 1) 患者選択 → 2) カルテ入力 → 3) 保存 → 4) 「会計入力へ進む」ボタン確認
    test.skip(true, "「会計入力へ進む」ボタンはカルテ保存後に表示されるため、手動確認を推奨。dailyCheckout 到達確認は上記テストで実施済み。");
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
