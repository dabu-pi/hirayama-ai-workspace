/**
 * jrec-sf01 ai4.spec.ts
 * JREC-SF01 Phase AI-4 自動確認スペック（AI評価補助 結果保存・レビュー）
 *
 * 自動確認項目:
 *   AI4-1: visitForm に #aiAssistCard が存在する（AI-4後も維持）
 *   AI4-2: #aiAssistBtn が存在し初期 disabled（AI-4後も維持）
 *   AI4-3: #aiSavedBanner が初期状態では非表示（結果未取得時）
 *   AI4-4: AI-3 回帰 — 旧文言「Phase AI-3 で有効化予定」が表示されない
 *
 * 人間確認項目（このスペック対象外）:
 *   AI4-H1: runMigrateAddAIAssessmentsSheet を GAS エディタで実行して AI_Assessments シートが作成されること
 *   AI4-H2: カルテ保存 → AIボタン押下 → 保存バナー（✔ AI評価補助結果を保存しました / ID: ASMNT_xxx / レビュー未確認）が表示される
 *   AI4-H3: AI_Assessments シートに1行追記されていることをスプレッドシートで確認
 *   AI4-H4: 保存される outputJson に氏名・住所・電話・生年月日・jrecPatientId が含まれていないことを確認
 *
 * 実行コマンド: npm run test:jrec:ai4
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
}

function skipIfNoPatientId() {
  if (!TEST_PATIENT_ID) {
    test.skip(true, "AI4 の visitForm テストは config.json の testData.patientIdForVisitForm に有効な患者IDが必要です。");
  }
}

test.describe(`JREC-SF01 AI4: AI評価補助 結果保存 — visitForm 確認 [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
  });

  test("AI4-1: visitForm — #aiAssistCard が AI-4後も存在する", async ({ page }) => {
    skipIfNoPatientId();
    await page.goto(`${DEV_URL}?page=visitForm&id=${TEST_PATIENT_ID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await expect(frame.locator("#aiAssistCard")).toBeVisible({ timeout: LOAD_TIMEOUT });
  });

  test("AI4-2: visitForm — #aiAssistBtn が AI-4後も初期 disabled", async ({ page }) => {
    skipIfNoPatientId();
    await page.goto(`${DEV_URL}?page=visitForm&id=${TEST_PATIENT_ID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    const btn = frame.locator("#aiAssistBtn");
    await expect(btn).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(btn).toBeDisabled();
  });

  test("AI4-3: visitForm — #aiSavedBanner が初期状態では非表示", async ({ page }) => {
    skipIfNoPatientId();
    await page.goto(`${DEV_URL}?page=visitForm&id=${TEST_PATIENT_ID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await expect(frame.locator("#aiAssistCard")).toBeVisible({ timeout: LOAD_TIMEOUT });
    // #aiSavedBanner は AI実行後にのみ生成される（初期は DOM に存在しない）
    const count = await frame.locator("#aiSavedBanner").count();
    expect(count).toBe(0);
  });

  test("AI4-4: 回帰 — 旧文言「Phase AI-3 で有効化予定」が表示されない", async ({ page }) => {
    skipIfNoPatientId();
    await page.goto(`${DEV_URL}?page=visitForm&id=${TEST_PATIENT_ID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await expect(frame.locator("#aiAssistCard")).toBeVisible({ timeout: LOAD_TIMEOUT });
    const count = await frame.getByText("Phase AI-3 で有効化予定", { exact: false }).count();
    expect(count).toBe(0);
  });
});

test.describe("JREC-SF01 AI4: 人間確認項目（自動化対象外）", () => {
  test("AI4-H1: runMigrateAddAIAssessmentsSheet で AI_Assessments シートが作成される — GAS エディタ確認", async () => {
    test.skip(true,
      "手動確認: GAS エディタ → runMigrateAddAIAssessmentsSheet を実行。" +
      "スプレッドシートに AI_Assessments シートが追加されることを確認。"
    );
  });

  test("AI4-H2: カルテ保存 → AIボタン押下 → 保存バナー表示 — 手動確認", async () => {
    test.skip(true,
      "手動確認: カルテを保存 → AIボタン押下 → 結果カード上部に " +
      "「✔ AI評価補助結果を保存しました / ID: ASMNT_xxx / レビュー未確認」バナーが表示されることを確認。"
    );
  });

  test("AI4-H3: AI_Assessments シートに1行追記される — スプレッドシート確認", async () => {
    test.skip(true,
      "手動確認: AI実行後にスプレッドシートの AI_Assessments シートを開き、" +
      "assessmentId / visitKey / outputJson / reviewStatus=unreviewed が記録されていることを確認。"
    );
  });

  test("AI4-H4: 保存データに個人情報が含まれない — outputJson 確認", async () => {
    test.skip(true,
      "手動確認: AI_Assessments の outputJson 列に氏名・住所・電話番号・生年月日・jrecPatientId が含まれていないことを確認。" +
      "visitKey / patientId（内部キー）のみ記録されていること。"
    );
  });
});
