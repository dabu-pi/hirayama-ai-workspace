/**
 * jbiz portal12.spec.ts
 * Portal-12 JREC-SF01 chronic-pain / gym-referral KPI live connection 自動確認スペック
 *
 * 自動確認項目:
 *   P12-1: selfpay 詳細に Portal-12 セクションヘッダーが表示される
 *   P12-2: selfpay 詳細に「ジム紹介候補」「紹介率（案内 / visit）」「データ品質警告」カードが揃う
 *   P12-3: selfpay 詳細に Source / Fetched at が表示される
 *   P12-4: crosskpi に「Portal-12（live 接続）」紹介文が表示される
 *   P12-5: crosskpi の未接続 KPI 表で「接続済（Portal-12）」表示
 *   P12-6: 既存 home / businesses / crosskpi / runlog / tasks 表示が壊れていない
 *
 * 人間確認項目:
 *   P12-H1: setupPortal12 を action 経由で 1 回実行（または GAS エディタ）
 *   P12-H2: 「Run_Log」シートに Portal-12 セットアップが追記される
 *   P12-H3: 「Task_Queue」に TASK-PORTAL-12-001 = done が反映される
 *   P12-H4: JREC-SF01 endpoint URL 変更（ScriptProperties JREC_SF01_GYM_REFERRAL_URL）後にキャッシュリセット要否
 *
 * 実行コマンド: npm run test:jbiz:portal12
 */

import { test, expect, Page } from "@playwright/test";
import fs from "fs";
import path from "path";

const JBIZ_PROD_URL =
  "https://script.google.com/macros/s/AKfycbw20tWvhR5nnRzCiUAMybtfrebRg-BK-EgDamvZYt-clSwf4TK9FGTKNZRmsO3wj7QSiQ/exec";
const AUTH_FILE    = path.join(__dirname, "../../auth.json");
const HAS_AUTH     = fs.existsSync(AUTH_FILE);
const LOAD_TIMEOUT = 35_000;

function gasFrame(page: Page) {
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

test.describe(`JBIZ Portal-12: JREC-SF01 gym referral live connection [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
  });

  test("P12-1: selfpay 詳細に Portal-12 セクションヘッダーが表示される", async ({ page }) => {
    await page.goto(`${JBIZ_PROD_URL}?view=business&id=selfpay`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasFrame(page);
    await expect(frame.getByText("Portal-12: JREC-SF01 ジム紹介 KPI", { exact: false })).toBeVisible({
      timeout: LOAD_TIMEOUT,
    });
  });

  test("P12-2: selfpay 詳細に主要 KPI カードが揃う", async ({ page }) => {
    await page.goto(`${JBIZ_PROD_URL}?view=business&id=selfpay`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasFrame(page);
    await expect(frame.getByText("ジム紹介候補", { exact: false }).first()).toBeVisible();
    await expect(frame.getByText("紹介率（案内", { exact: false }).first()).toBeVisible();
    // データ品質警告は selfpay section と crosskpi table の両方に出るため .first() で selfpay section を対象にする
    await expect(frame.getByText("データ品質警告", { exact: false }).first()).toBeVisible();
  });

  test("P12-3: selfpay 詳細に Source / Fetched at が表示される", async ({ page }) => {
    await page.goto(`${JBIZ_PROD_URL}?view=business&id=selfpay`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasFrame(page);
    // gymReferralKpiSummary は selfpay section と crosskpi table 両方に出るため .first() で selfpay section を対象にする
    await expect(frame.getByText("gymReferralKpiSummary", { exact: false }).first()).toBeVisible();
    await expect(frame.getByText("Fetched at", { exact: false }).first()).toBeVisible();
  });

  test("P12-4: crosskpi に「Portal-12（live 接続）」紹介文が表示される", async ({ page }) => {
    await page.goto(`${JBIZ_PROD_URL}?view=crosskpi`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasFrame(page);
    await expect(frame.getByText("Portal-12（live 接続）", { exact: false })).toBeVisible();
  });

  test("P12-5: crosskpi の未接続 KPI 表で「接続済（Portal-12）」表示", async ({ page }) => {
    await page.goto(`${JBIZ_PROD_URL}?view=crosskpi`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasFrame(page);
    await expect(frame.getByText("接続済（Portal-12）", { exact: false }).first()).toBeVisible();
  });

  test("P12-6a: 回帰 — home が表示される", async ({ page }) => {
    await page.goto(`${JBIZ_PROD_URL}?view=home`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasFrame(page);
    await expect(frame.getByText("平山ビジネスポータル", { exact: false })).toBeVisible();
  });

  test("P12-6b: 回帰 — businesses が表示される", async ({ page }) => {
    await page.goto(`${JBIZ_PROD_URL}?view=businesses`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasFrame(page);
    await expect(frame.locator("body").getByText("事業", { exact: false }).first()).toBeVisible();
  });

  test("P12-6c: 回帰 — insurance 詳細が壊れていない", async ({ page }) => {
    await page.goto(`${JBIZ_PROD_URL}?view=business&id=insurance`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasFrame(page);
    await expect(frame.getByText("保険", { exact: false }).first()).toBeVisible();
  });
});

test.describe("JBIZ Portal-12: 人間確認項目（自動化対象外）", () => {
  test("P12-H1: setupPortal12 一度実行（GAS エディタ or ?action=setupPortal12）", async () => {
    test.skip(true,
      "手動: /exec?action=setupPortal12 を開く。Task_Queue に TASK-PORTAL-12-001 が done 登録され、Run_Log に Portal-12 セットアップが追記されることを確認。"
    );
  });

  test("P12-H2: Run_Log に Portal-12 セットアップが追記される", async () => {
    test.skip(true,
      "手動: ?view=runlog で「Portal-12 セットアップ」行を確認。"
    );
  });

  test("P12-H3: Task_Queue で TASK-PORTAL-12-001 = done を確認", async () => {
    test.skip(true,
      "手動: ?view=tasks で TASK-PORTAL-12-001 の status / notes を確認。"
    );
  });

  test("P12-H4: endpoint URL 上書き（ScriptProperties JREC_SF01_GYM_REFERRAL_URL）", async () => {
    test.skip(true,
      "手動: GAS エディタ → プロジェクト設定 → スクリプトプロパティ。" +
      "JREC_SF01_GYM_REFERRAL_URL を設定すると Portal-12 が新 URL を読みに行く。" +
      "CacheService 5 分キャッシュは時間経過か別 endpoint で自動切り替わる。"
    );
  });
});
