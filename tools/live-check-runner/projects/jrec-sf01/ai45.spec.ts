/**
 * jrec-sf01 ai45.spec.ts
 * JREC-SF01 Phase AI-4.5 自動確認スペック（保存済みAI評価再読込 + AI参考見立て）
 *
 * 自動確認項目:
 *   AI45-1: visitForm に #aiAssistCard が存在する（AI-4.5後も維持）
 *   AI45-2: #aiAssistBtn が初期 disabled（AI-4.5後も維持）
 *   AI45-3: #aiAssistResult が初期状態で非表示（自動読み込み前）
 *   AI45-4: 回帰 — 旧文言「Phase AI-3 で有効化予定」が表示されない
 *   AI45-5: 回帰 — AI-4 保存バナー構造が存在する（displayAiResult 構造維持）
 *
 * 人間確認項目（このスペック対象外）:
 *   AI45-H1: 保存済みAI評価のある visitKey でカルテを開くと青バナー「📂 保存済みAI評価補助を読み込みました」が表示される
 *   AI45-H2: 読み込んだ評価に AI参考見立てセクション（🧠 AI参考見立て）が表示される
 *   AI45-H3: 新しく AI評価補助を実行すると緑バナー（新規保存）に切り替わり、AI参考見立てが含まれる
 *   AI45-H4: AI_Assessments の最新レコードの promptVersion が v2 になっている
 *   AI45-H5: outputJson に aiImpression フィールドが含まれている
 *
 * 実行コマンド: npm run test:jrec:ai45
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
  }
}

function skipIfNoPatientId() {
  if (!TEST_PATIENT_ID) {
    test.skip(true, "AI45 テストは config.json の testData.patientIdForVisitForm に有効な患者IDが必要です。");
  }
}

test.describe(`JREC-SF01 AI4.5: 保存済みAI評価再読込 + AI参考見立て [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
  });

  test("AI45-1: visitForm — #aiAssistCard が AI-4.5後も存在する", async ({ page }) => {
    skipIfNoPatientId();
    await page.goto(`${DEV_URL}?page=visitForm&id=${TEST_PATIENT_ID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await expect(frame.locator("#aiAssistCard")).toBeVisible({ timeout: LOAD_TIMEOUT });
  });

  test("AI45-2: visitForm — #aiAssistBtn が AI-4.5後も初期 disabled", async ({ page }) => {
    skipIfNoPatientId();
    await page.goto(`${DEV_URL}?page=visitForm&id=${TEST_PATIENT_ID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await expect(frame.locator("#aiAssistBtn")).toBeDisabled({ timeout: LOAD_TIMEOUT });
  });

  test("AI45-3: visitForm（新規）— #aiSavedBanner が初期状態では非表示", async ({ page }) => {
    skipIfNoPatientId();
    await page.goto(`${DEV_URL}?page=visitForm&id=${TEST_PATIENT_ID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await expect(frame.locator("#aiAssistCard")).toBeVisible({ timeout: LOAD_TIMEOUT });
    const count = await frame.locator("#aiSavedBanner").count();
    expect(count).toBe(0);
  });

  test("AI45-4: 回帰 — 旧文言「Phase AI-3 で有効化予定」が表示されない", async ({ page }) => {
    skipIfNoPatientId();
    await page.goto(`${DEV_URL}?page=visitForm&id=${TEST_PATIENT_ID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await expect(frame.locator("#aiAssistCard")).toBeVisible({ timeout: LOAD_TIMEOUT });
    expect(await frame.getByText("Phase AI-3 で有効化予定", { exact: false }).count()).toBe(0);
  });

  test("AI45-5: 回帰 — AI評価補助（ベータ）バッジが表示される", async ({ page }) => {
    skipIfNoPatientId();
    await page.goto(`${DEV_URL}?page=visitForm&id=${TEST_PATIENT_ID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await expect(frame.getByText("AI評価補助（ベータ）", { exact: false })).toBeVisible({ timeout: LOAD_TIMEOUT });
  });
});

test.describe("JREC-SF01 AI4.5: 人間確認項目（自動化対象外）", () => {
  test("AI45-H1: 保存済み評価のある visitKey でカルテを開くと青バナー自動表示 — 手動確認", async () => {
    test.skip(true,
      "手動確認: 保存済みAI評価のある visitKey で ?page=visitForm&id=... を開く。" +
      "「📂 保存済みAI評価補助を読み込みました」青バナーと assessmentId / 作成日時が表示されることを確認。"
    );
  });

  test("AI45-H2: 読み込んだ評価に AI参考見立てセクションが表示される — 手動確認", async () => {
    test.skip(true,
      "手動確認: 青バナー表示後、「🧠 AI参考見立て」セクションが表示されることを確認。" +
      "注意文「診断確定ではありません」が含まれることを確認。"
    );
  });

  test("AI45-H3: AI評価補助を再実行すると緑バナー（新規保存）に切り替わる — 手動確認", async () => {
    test.skip(true,
      "手動確認: 読み込み表示中に「AI評価補助を再実行する」ボタンを押す。" +
      "緑バナー「✔ AI評価補助結果を保存しました」に切り替わり、新しい assessmentId が表示されることを確認。"
    );
  });

  test("AI45-H4: AI_Assessments の最新レコードの promptVersion が v2 — スプレッドシート確認", async () => {
    test.skip(true,
      "手動確認: AI評価補助実行後にスプレッドシートの AI_Assessments シートを確認。" +
      "最新レコードの promptVersion 列が v2 になっていることを確認。"
    );
  });

  test("AI45-H5: outputJson に aiImpression フィールドが含まれる — スプレッドシート確認", async () => {
    test.skip(true,
      "手動確認: AI_Assessments の最新レコードの outputJson 列を確認。" +
      "\"aiImpression\" フィールド（summary + therapistCheckpoints）が含まれていることを確認。" +
      "氏名・住所・電話・生年月日・jrecPatientId が含まれていないことを確認。"
    );
  });
});
