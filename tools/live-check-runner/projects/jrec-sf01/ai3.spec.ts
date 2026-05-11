/**
 * jrec-sf01 ai3.spec.ts
 * JREC-SF01 Phase AI-3 自動確認スペック（AI評価補助 OpenAI API連携）
 *
 * 自動確認項目:
 *   AI3-1: visitForm に #aiAssistCard が存在し、バッジが「AI評価補助（ベータ）」を含む
 *   AI3-2: visitForm の #aiAssistBtn が初期状態で disabled（保存前）
 *   AI3-3: 旧プレースホルダー文言「Phase AI-3 で有効化予定」が画面に表示されていない
 *
 * 人間確認項目（このスペック対象外）:
 *   AI3-H1: ScriptProperties に OPENAI_API_KEY を設定後、カルテ保存 → AIボタン押下で結果表示
 *   AI3-H2: 結果カードに「評価の観点整理」「鑑別の方向性」「危険サイン確認」「追加問診候補」
 *           「施術方針案」が表示される（API キー未設定時は SKIP）
 *   AI3-H3: 個人情報（氏名・住所・電話・生年月日）が API に送信されていないことを GAS 実行ログから確認
 *
 * 実行コマンド: npm run test:jrec:ai3
 */

import { test, expect, Page } from "@playwright/test";
import fs from "fs";
import path from "path";
import config from "./config.json";

const DEV_URL      = config.devUrl;
const AUTH_FILE    = path.join(__dirname, "../../auth.json");
const HAS_AUTH     = fs.existsSync(AUTH_FILE);
const LOAD_TIMEOUT = 25_000;

const TEST_PATIENT_ID = config.testData.patientIdForVisitForm;

function gasAppFrame(page: Page) {
  return page.frameLocator("iframe").first().frameLocator("iframe").first();
}

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
    test.skip(true, "GAS OAuth 警告画面が表示されています。手動で承認してから auth.json を再保存してください。");
  }
}

function skipIfNoPatientId() {
  if (!TEST_PATIENT_ID) {
    test.skip(
      true,
      "AI3 の visitForm テストは config.json の testData.patientIdForVisitForm に有効な患者IDが必要です。"
    );
  }
}

test.describe(`JREC-SF01 AI3: AI評価補助 API連携 — visitForm 確認 [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
  });

  test("AI3-1: visitForm — #aiAssistCard が存在し、バッジが「AI評価補助（ベータ）」", async ({ page }) => {
    skipIfNoPatientId();
    await page.goto(`${DEV_URL}?page=visitForm&id=${TEST_PATIENT_ID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await expect(frame.locator("#aiAssistCard")).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(frame.getByText("AI評価補助（ベータ）", { exact: false })).toBeVisible();
  });

  test("AI3-2: visitForm — #aiAssistBtn が存在し初期 disabled", async ({ page }) => {
    skipIfNoPatientId();
    await page.goto(`${DEV_URL}?page=visitForm&id=${TEST_PATIENT_ID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    const btn = frame.locator("#aiAssistBtn");
    await expect(btn).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(btn).toBeDisabled();
  });

  test("AI3-3: 旧文言「Phase AI-3 で有効化予定」が表示されていない", async ({ page }) => {
    skipIfNoPatientId();
    await page.goto(`${DEV_URL}?page=visitForm&id=${TEST_PATIENT_ID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await expect(frame.locator("#aiAssistCard")).toBeVisible({ timeout: LOAD_TIMEOUT });
    const count = await frame.getByText("Phase AI-3 で有効化予定", { exact: false }).count();
    expect(count).toBe(0);
  });
});

test.describe("JREC-SF01 AI3: 人間確認項目（自動化対象外）", () => {
  test("AI3-H1: OPENAI_API_KEY 設定後、カルテ保存 → AIボタン押下で結果表示 — 手動確認", async () => {
    test.skip(true,
      "手動確認: GAS エディタ → プロジェクトのプロパティ → スクリプトプロパティで OPENAI_API_KEY を設定。" +
      "カルテを保存 → AIボタン押下 → 数十秒後に #aiAssistResult に出力カードが表示されることを目視確認。"
    );
  });

  test("AI3-H2: 結果カードに7セクション（評価/鑑別/危険/問診/方針/勧奨/下書き）が表示される — 手動確認", async () => {
    test.skip(true,
      "手動確認: 結果表示後、評価の観点整理 / 鑑別の方向性 / 危険サイン確認 / 追加問診候補 / 施術方針案 / " +
      "（任意）受診勧奨の目安 / カルテ下書き の各セクションが表示されることを目視確認。"
    );
  });

  test("AI3-H3: 個人情報がAIに送信されていない — GAS 実行ログ確認", async () => {
    test.skip(true,
      "手動確認: GAS エディタ → 実行ログで [runAIAssessment] のログを確認。" +
      "氏名 / 住所 / 電話 / 生年月日 / jrecPatientId が含まれていないことを確認。"
    );
  });
});
