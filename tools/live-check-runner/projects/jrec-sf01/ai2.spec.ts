/**
 * jrec-sf01 ai2.spec.ts
 * JREC-SF01 Phase AI-2 自動確認スペック（AI評価補助UI枠追加）
 *
 * 確認項目:
 *   AI2-1: visitForm に AI評価補助セクション（#aiAssistCard）が存在する → testData.patientIdForVisitForm 要設定
 *   AI2-2: visitForm にAI補助の免責文が存在する                        → testData.patientIdForVisitForm 要設定
 *   AI2-3: visitForm にAI評価補助ボタンが存在し、初期状態で disabled である → testData.patientIdForVisitForm 要設定
 *   AI2-4: visitForm にAI出力プレースホルダー（評価観点・鑑別・危険サイン等）が存在する → testData.patientIdForVisitForm 要設定
 *
 * 人間確認項目（このスペック対象外）:
 *   AI2-H1: カルテ保存後にボタンが有効化されること
 *   AI2-H2: ボタンクリック後に「Phase AI-3 有効化予定」メッセージが表示されること
 *
 * 実行コマンド: npm run test:jrec:ai2
 *
 * GAS /dev のフレーム構造（2段 iframe）:
 *   page > iframe(outer) > iframe(inner) > GAS コンテンツ
 *   → gasAppFrame(page) ヘルパーを使用
 *
 * visitForm は patientId 必須（Main.gs: idParam なし → renderError_）
 *   → testData.patientIdForVisitForm が空の場合は全テスト SKIP
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

// ── フレームヘルパー ────────────────────────────────────────────────

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

// ── patientId ガード ────────────────────────────────────────────────

function skipIfNoPatientId() {
  if (!TEST_PATIENT_ID) {
    test.skip(
      true,
      "AI2 の visitForm テストは config.json の testData.patientIdForVisitForm に有効な患者IDが必要です。\n" +
      "JREC 患者一覧から既存の患者IDを確認して設定してください。"
    );
  }
}

// ── AI2-1〜AI2-4: visitForm AI評価補助UI確認 ─────────────────────────

test.describe(`JREC-SF01 AI2: AI評価補助UI — visitForm 確認 [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
  });

  test("AI2-1: visitForm — AI評価補助セクション(#aiAssistCard)が存在する", async ({ page }) => {
    skipIfNoPatientId();
    await page.goto(`${DEV_URL}?page=visitForm&id=${TEST_PATIENT_ID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await expect(frame.locator("#aiAssistCard")).toBeVisible({ timeout: LOAD_TIMEOUT });
  });

  test("AI2-2: visitForm — AI補助の免責文「参考情報」が存在する", async ({ page }) => {
    skipIfNoPatientId();
    await page.goto(`${DEV_URL}?page=visitForm&id=${TEST_PATIENT_ID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await expect(frame.getByText("参考情報", { exact: false })).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(frame.getByText("診断の確定ではありません", { exact: false })).toBeVisible();
  });

  test("AI2-3: visitForm — AI評価補助ボタン(#aiAssistBtn)が存在し disabled である", async ({ page }) => {
    skipIfNoPatientId();
    await page.goto(`${DEV_URL}?page=visitForm&id=${TEST_PATIENT_ID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    const btn = frame.locator("#aiAssistBtn");
    await expect(btn).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(btn).toBeDisabled();
  });

  test("AI2-4: visitForm — AI出力プレースホルダー（評価観点・鑑別・危険サイン等）が存在する", async ({ page }) => {
    skipIfNoPatientId();
    await page.goto(`${DEV_URL}?page=visitForm&id=${TEST_PATIENT_ID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await expect(frame.getByText("評価の観点整理", { exact: false })).toBeVisible({ timeout: LOAD_TIMEOUT });
    await expect(frame.getByText("鑑別の方向性", { exact: false })).toBeVisible();
    await expect(frame.getByText("危険サイン確認", { exact: false })).toBeVisible();
    await expect(frame.getByText("追加問診候補", { exact: false })).toBeVisible();
    await expect(frame.getByText("施術方針案", { exact: false })).toBeVisible();
    await expect(frame.getByText("受診勧奨の目安", { exact: false })).toBeVisible();
    await expect(frame.getByText("カルテ下書き", { exact: false })).toBeVisible();
  });
});

// ── AI2-H1/H2: 人間確認項目 ──────────────────────────────────────────

test.describe("JREC-SF01 AI2: 人間確認項目（自動化対象外）", () => {
  test("AI2-H1: カルテ保存後にAIボタンが有効化される — 手動確認", async () => {
    test.skip(true, "手動確認: カルテ入力 → 保存 → aiAssistBtn が enabled になることを目視確認してください。");
  });

  test("AI2-H2: ボタンクリック後に「Phase AI-3 有効化予定」メッセージが表示される — 手動確認", async () => {
    test.skip(true, "手動確認: ボタンクリック後に #aiAssistResult に「Phase AI-3 で有効化予定」メッセージが表示されることを目視確認してください。");
  });
});
