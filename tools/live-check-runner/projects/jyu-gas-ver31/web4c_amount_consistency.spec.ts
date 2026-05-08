/**
 * jyu-gas-ver31 web4c_amount_consistency.spec.ts
 * JYU-GAS Ver3.1 Phase WEB-4C: Step1 実行後 KPI が転記データ金額に更新されることを確認
 *
 * 背景:
 *   来院ヘッダの visitTotal と V3TR_buildTransferDataForMonth_ による月合計に 5円差がある。
 *   原因: 来院都度の候補金額計算 vs 施術明細からの月単位再計算 の丸め差。
 *   B案申請書は転記データ（月合計）を正とする。
 *   修正: Step1 成功後に KPI を転記データ金額で上書きする（UI のみの変更）。
 *
 * 確認項目:
 *   W4C-1: Step1「申請書転記データを生成」が成功する
 *   W4C-2: Step1 成功後、KPI 来院合計が転記データと一致する（4363円）
 *   W4C-3: Step1 成功後、KPI 保険請求が転記データと一致する（3053円）
 *   W4C-4: Step1 成功後、「申請額（転記データより更新済み）」注記が表示される
 *   W4C-5: B案生成ボタンは引き続き存在する
 *
 * 注意:
 *   W4C-2/3 は "B案 Excel の期待値" を正とする。実データが変われば期待値も変わる。
 *   現時点の確認値: total=4363, copay=1310, claim=3053 (2026-04-19 確認済み)
 *
 * 実行コマンド: npm run test:jyu:web4c
 */

import { test, expect, Page } from "@playwright/test";
import fs from "fs";
import path from "path";
import config from "./config.json";

const DEV_URL      = config.devUrl;
const AUTH_FILE    = path.join(__dirname, "../../auth.json");
const HAS_AUTH     = fs.existsSync(AUTH_FILE);
const LOAD_TIMEOUT = 45_000;
const GAS_TIMEOUT  = 60_000;
const TEST_PID     = config.testData.patientId;
const TEST_YM      = "2026-04";

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
    test.skip(true, "Google 認証が必要。auth.json を save-auth で更新してください。");
  }
}

async function loadDetailAndWaitForData(page: Page) {
  const url = `${DEV_URL}?page=monthlyClaimDetail&patientId=${TEST_PID}&ym=${TEST_YM}`;
  await page.goto(url, { timeout: LOAD_TIMEOUT });
  await handleAuthRedirect(page);
  const frame = gasAppFrame(page);
  await frame.locator("#main-content").waitFor({ state: "visible", timeout: GAS_TIMEOUT });
  await page.waitForTimeout(2000);
  return frame;
}

// W4C-1: Step1 が成功する
test("W4C-1: Step1「申請書転記データを生成」が成功する", async ({ page }) => {
  if (!HAS_AUTH) {
    test.skip(true, "auth.json が存在しません。save-auth で認証を保存してください。");
  }
  const frame = await loadDetailAndWaitForData(page);

  page.once("dialog", async (d) => { await d.accept(); });
  await frame.locator("#transfer-btn").click();

  const result = frame.locator("#transfer-result");
  await result.waitFor({ state: "visible", timeout: GAS_TIMEOUT });
  const text = await result.innerText();
  expect(text).toContain("申請書転記データを生成しました");
  expect(text).toContain("当月合計");
});

// W4C-2: Step1 後 KPI 来院合計が転記データ金額に更新される
test("W4C-2: Step1 後 KPI 来院合計が転記データと一致する", async ({ page }) => {
  if (!HAS_AUTH) {
    test.skip(true, "auth.json が存在しません。save-auth で認証を保存してください。");
  }
  const frame = await loadDetailAndWaitForData(page);

  page.once("dialog", async (d) => { await d.accept(); });
  await frame.locator("#transfer-btn").click();
  const result = frame.locator("#transfer-result");
  await result.waitFor({ state: "visible", timeout: GAS_TIMEOUT });
  await page.waitForTimeout(1000);

  // 転記データの来院合計を result から取得
  const resultText = await result.innerText();
  const totalMatch = resultText.match(/当月合計: ¥([\d,]+)/);
  const transferTotal = totalMatch ? parseInt(totalMatch[1].replace(/,/g,""), 10) : NaN;

  // KPI 来院合計が転記データと一致するか
  const kpiVt = await frame.locator("#kpi-vt").innerText();
  const kpiTotal = parseInt(kpiVt.replace(/[^\d]/g,""), 10);

  expect(transferTotal).toBeGreaterThan(0);
  expect(kpiTotal).toBe(transferTotal);
});

// W4C-3: Step1 後 KPI 保険請求が転記データと一致する
test("W4C-3: Step1 後 KPI 保険請求が転記データと一致する", async ({ page }) => {
  if (!HAS_AUTH) {
    test.skip(true, "auth.json が存在しません。save-auth で認証を保存してください。");
  }
  const frame = await loadDetailAndWaitForData(page);

  page.once("dialog", async (d) => { await d.accept(); });
  await frame.locator("#transfer-btn").click();
  const result = frame.locator("#transfer-result");
  await result.waitFor({ state: "visible", timeout: GAS_TIMEOUT });
  await page.waitForTimeout(1000);

  const resultText = await result.innerText();
  const claimMatch = resultText.match(/請求: ¥([\d,]+)/);
  const transferClaim = claimMatch ? parseInt(claimMatch[1].replace(/,/g,""), 10) : NaN;

  const kpiCp = await frame.locator("#kpi-cp").innerText();
  const kpiClaim = parseInt(kpiCp.replace(/[^\d]/g,""), 10);

  expect(transferClaim).toBeGreaterThan(0);
  expect(kpiClaim).toBe(transferClaim);
});

// W4C-4: Step1 後「申請額（転記データより更新済み）」注記が表示される
test("W4C-4: Step1 後 申請額注記が表示される", async ({ page }) => {
  if (!HAS_AUTH) {
    test.skip(true, "auth.json が存在しません。save-auth で認証を保存してください。");
  }
  const frame = await loadDetailAndWaitForData(page);

  page.once("dialog", async (d) => { await d.accept(); });
  await frame.locator("#transfer-btn").click();
  const result = frame.locator("#transfer-result");
  await result.waitFor({ state: "visible", timeout: GAS_TIMEOUT });
  await page.waitForTimeout(1000);

  const note = frame.locator("#transfer-kpi-note");
  await expect(note).toBeVisible();
  const noteText = await note.innerText();
  expect(noteText).toContain("申請書転記データより更新済み");
});

// W4C-5: B案生成ボタンは引き続き存在する
test("W4C-5: B案申請書生成ボタンが引き続き存在する", async ({ page }) => {
  if (!HAS_AUTH) {
    test.skip(true, "auth.json が存在しません。save-auth で認証を保存してください。");
  }
  const frame = await loadDetailAndWaitForData(page);
  const btn = frame.locator("#appgen-b-btn");
  await expect(btn).toBeVisible();
  await expect(btn).not.toBeDisabled();
});
