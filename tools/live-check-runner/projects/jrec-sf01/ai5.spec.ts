/**
 * jrec-sf01 ai5.spec.ts
 * JREC-SF01 Phase AI-5 自動確認スペック（過去評価比較・改善/悪化トレンド表示）
 *
 * 自動確認項目（DOM のみ・OpenAI 呼び出しは行わない）:
 *   AI5-1: visitForm に #aiTrendCard が存在する
 *   AI5-2: #aiTrendBtn が初期 disabled（カルテ未保存・新規モード）
 *   AI5-3: #aiTrendResult が初期状態で非表示
 *   AI5-4: 回帰 — #aiAssistCard（AI-4.5）が維持されている
 *   AI5-5: 回帰 — #aiAssistBtn（AI-3/AI-4.5）が維持されている
 *   AI5-6: 回帰 — Chart-Ref-1 / Chart-Ref-2 の qbtn ボタン仕組みが維持
 *   AI5-7: Phase AI-5（ベータ）バッジが表示される
 *
 * 人間確認項目（このスペック対象外）:
 *   AI5-H1: 過去カルテがある visitKey で AI参考比較ボタンが有効化される
 *   AI5-H2: 実行すると全体傾向バナー（改善/悪化/横ばい/混在/判定不能）が表示
 *   AI5-H3: 初回・前回比較・improvedSigns / worsenedSigns / stableAreas / cautionPoints
 *           / nextCheckPoints の各カードが表示
 *   AI5-H4: 「次回方針へ引用」ボタンで nextPlan に追記（既存上書きなし）
 *   AI5-H5: 結果が AI_Assessments に保存されていない（v1 read-only 設計）
 *   AI5-H6: AI-4.5 青バナー / Chart-Ref-1 read-only / Chart-Ref-2 引用ボタン 不変
 *
 * 実行コマンド: npm run test:jrec:ai5
 */

import { test, expect, Page } from "@playwright/test";
import fs from "fs";
import path from "path";
import config from "./config.json";

const DEV_URL      = config.devUrl;
const PROD_URL     = (config as any).prodUrl as string | undefined;
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
    test.skip(true, "AI5 テストは config.json の testData.patientIdForVisitForm に有効な患者IDが必要です。");
  }
}

test.describe(`JREC-SF01 AI-5: 過去評価比較・改善/悪化トレンド [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
  });

  test("AI5-1: visitForm — #aiTrendCard が存在する", async ({ page }) => {
    skipIfNoPatientId();
    await page.goto(`${DEV_URL}?page=visitForm&id=${TEST_PATIENT_ID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await expect(frame.locator("#aiTrendCard")).toBeVisible({ timeout: LOAD_TIMEOUT });
  });

  test("AI5-2: visitForm（新規）— #aiTrendBtn が初期 disabled", async ({ page }) => {
    skipIfNoPatientId();
    await page.goto(`${DEV_URL}?page=visitForm&id=${TEST_PATIENT_ID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await expect(frame.locator("#aiTrendBtn")).toBeDisabled({ timeout: LOAD_TIMEOUT });
  });

  test("AI5-3: visitForm（新規）— #aiTrendResult が初期状態で非表示", async ({ page }) => {
    skipIfNoPatientId();
    await page.goto(`${DEV_URL}?page=visitForm&id=${TEST_PATIENT_ID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await expect(frame.locator("#aiTrendCard")).toBeVisible({ timeout: LOAD_TIMEOUT });
    const display = await frame.locator("#aiTrendResult").evaluate((el: any) => el.style.display);
    expect(display).toBe("none");
  });

  test("AI5-4: 回帰 — #aiAssistCard（AI-4.5）が維持されている", async ({ page }) => {
    skipIfNoPatientId();
    await page.goto(`${DEV_URL}?page=visitForm&id=${TEST_PATIENT_ID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await expect(frame.locator("#aiAssistCard")).toBeVisible({ timeout: LOAD_TIMEOUT });
  });

  test("AI5-5: 回帰 — #aiAssistBtn（AI-3/AI-4.5）が維持されている", async ({ page }) => {
    skipIfNoPatientId();
    await page.goto(`${DEV_URL}?page=visitForm&id=${TEST_PATIENT_ID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await expect(frame.locator("#aiAssistBtn")).toBeAttached({ timeout: LOAD_TIMEOUT });
  });

  test("AI5-6: 回帰 — Chart-Ref-2 引用ボタン(.qbtn) クラスが残存している", async ({ page }) => {
    skipIfNoPatientId();
    await page.goto(`${DEV_URL}?page=visitForm&id=${TEST_PATIENT_ID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await expect(frame.locator("#aiTrendCard")).toBeVisible({ timeout: LOAD_TIMEOUT });
    // .qbtn ボタンは過去カルテがない初回でも CSS は読み込まれていることを styles 検査ではなく、
    // 関数 quoteToField がフロントに存在するかで判定する
    const hasQuoteFn = await frame.locator("script").evaluateAll((els) =>
      els.some((s) => s.textContent && s.textContent.indexOf("function quoteToField") >= 0)
    );
    expect(hasQuoteFn).toBe(true);
  });

  test("AI5-7: Phase AI-5（ベータ）バッジが表示される", async ({ page }) => {
    skipIfNoPatientId();
    await page.goto(`${DEV_URL}?page=visitForm&id=${TEST_PATIENT_ID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await expect(frame.getByText("Phase AI-5（ベータ）", { exact: false })).toBeVisible({ timeout: LOAD_TIMEOUT });
  });
});

test.describe("JREC-SF01 AI-5: 本番 /exec 回帰確認", () => {
  test("AI5-PROD-1: production /exec で #aiTrendCard が表示される", async ({ page }) => {
    skipIfNoPatientId();
    if (!PROD_URL) test.skip(true, "config.json に prodUrl が設定されていません。");
    await page.goto(`${PROD_URL}?page=visitForm&id=${TEST_PATIENT_ID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await expect(frame.locator("#aiTrendCard")).toBeVisible({ timeout: LOAD_TIMEOUT });
  });

  test("AI5-PROD-2: production /exec で #aiAssistCard（AI-4.5）が維持される", async ({ page }) => {
    skipIfNoPatientId();
    if (!PROD_URL) test.skip(true, "config.json に prodUrl が設定されていません。");
    await page.goto(`${PROD_URL}?page=visitForm&id=${TEST_PATIENT_ID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await expect(frame.locator("#aiAssistCard")).toBeVisible({ timeout: LOAD_TIMEOUT });
  });
});

test.describe("JREC-SF01 AI-5: 人間確認項目（自動化対象外）", () => {
  test("AI5-H1: 過去カルテがある visitKey で AI参考比較ボタンが有効化される — 手動確認", async () => {
    test.skip(true,
      "手動確認: ?page=visitForm&id=<patient>&visitKey=<2回目以降のkey> を開く。" +
      "AI参考比較ボタンが青色で有効化されることを確認。"
    );
  });

  test("AI5-H2: 実行すると全体傾向バナーが表示される — 手動確認", async () => {
    test.skip(true,
      "手動確認: AI参考比較ボタンを押す。10〜30秒後に全体傾向バナー" +
      "（改善/悪化/横ばい/混在/判定不能 のいずれか）と「未保存」タグが表示されることを確認。"
    );
  });

  test("AI5-H3: 全カードが表示される（improvedSigns / worsenedSigns / stableAreas / cautionPoints / nextCheckPoints） — 手動確認", async () => {
    test.skip(true,
      "手動確認: 📈改善傾向 / 📉悪化傾向 / ➖横ばい / ⚠️注意すべき変化 / 🔁次回確認ポイント が表示されることを確認。"
    );
  });

  test("AI5-H4: 「次回方針へ引用」ボタンで nextPlan に追記される — 手動確認", async () => {
    test.skip(true,
      "手動確認: 「📋 次回方針へ引用」ボタンを押すと nextPlan 入力欄に" +
      "「【🤖 AI参考比較・次回確認ポイントより引用】」プレフィックス付きで追記される。" +
      "既存入力は上書きされないこと（空行挟んで末尾追記）を確認。"
    );
  });

  test("AI5-H5: 結果が AI_Assessments に保存されていない（v1 read-only 設計） — スプレッドシート確認", async () => {
    test.skip(true,
      "手動確認: AI参考比較を実行した後に AI_Assessments シートを確認。" +
      "AI-5 用のレコード（promptVersion=ai5-v1 等）が追加されていないことを確認。" +
      "理由: 既存 AI-4.5 自動再読込ロジックの取得対象を汚染しないため、v1 は保存しない設計。"
    );
  });

  test("AI5-H6: AI-4.5 / Chart-Ref-1 / Chart-Ref-2 が壊れていない — 手動確認", async () => {
    test.skip(true,
      "手動確認: AI評価補助の青バナー（保存済みAI評価読み込み）が表示される。" +
      "過去カルテ参照カード（初回・前回）が read-only で表示される。" +
      "「📋 …へ引用」ボタンで手動引用が動作する。AI参考比較の追加で既存機能が壊れていないことを確認。"
    );
  });
});
