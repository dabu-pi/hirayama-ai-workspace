/**
 * jyu-gas-ver31 web4d_detail_display_alignment.spec.ts
 * JYU-GAS Ver3.1 Phase WEB-4D: Step1後に明細テーブル合計行も転記データ金額に更新される確認
 *
 * 背景:
 *   WEB-4C でKPI集計欄は更新されたが、tfoot合計行の更新チェックが
 *   `cells.length >= 6` と誤っていたため実際には更新されなかった（実際のcells数は5）。
 *   WEB-4D でチェックを >= 4 に修正し、tfoot合計行も正しく更新されるようにした。
 *   また、テーブル下部に「合計行は確定額、日別明細は記録値」の注記を追加した。
 *
 * 確認項目:
 *   W4D-1: Step1 後 tfoot 合計 来院合計が転記データと一致する
 *   W4D-2: Step1 後 tfoot 合計 保険請求が転記データと一致する
 *   W4D-3: Step1 後「合計行は確定額」注記が表示される
 *   W4D-4: KPI 集計欄も転記データ金額（WEB-4C からの継続確認）
 *   W4D-5: B案生成ボタンが引き続き存在する
 *
 * 実行コマンド: npm run test:jyu:web4d
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

async function runStep1(page: Page, frame: ReturnType<typeof gasAppFrame>) {
  page.once("dialog", async (d) => { await d.accept(); });
  await frame.locator("#transfer-btn").click();
  const result = frame.locator("#transfer-result");
  await result.waitFor({ state: "visible", timeout: GAS_TIMEOUT });
  await page.waitForTimeout(1000);

  const resultText = await result.innerText();
  const totalMatch = resultText.match(/当月合計: ¥([\d,]+)/);
  const claimMatch = resultText.match(/請求: ¥([\d,]+)/);
  const transferTotal = totalMatch ? parseInt(totalMatch[1].replace(/,/g,""), 10) : NaN;
  const transferClaim = claimMatch ? parseInt(claimMatch[1].replace(/,/g,""), 10) : NaN;
  return { transferTotal, transferClaim };
}

// W4D-1: Step1 後 tfoot 合計 来院合計が転記データと一致する
test("W4D-1: Step1 後 tfoot合計の来院合計が転記データと一致する", async ({ page }) => {
  if (!HAS_AUTH) {
    test.skip(true, "auth.json が存在しません。save-auth で認証を保存してください。");
  }
  const frame = await loadDetailAndWaitForData(page);
  const { transferTotal } = await runStep1(page, frame);

  // tfoot の来院合計セル(cells[1]) を確認
  // DOM構造: cells[0]=合計(colspan=3), [1]=来院合計, [2]=窓口, [3]=請求, [4]=空(colspan=2)
  const tfootRow = frame.locator("#visit-tfoot tr").first();
  const vtCell = tfootRow.locator("td").nth(1);
  const vtText = await vtCell.innerText();
  const vtValue = parseInt(vtText.replace(/[^\d]/g, ""), 10);

  expect(transferTotal).toBeGreaterThan(0);
  expect(vtValue).toBe(transferTotal);
});

// W4D-2: Step1 後 tfoot 合計 保険請求が転記データと一致する
test("W4D-2: Step1 後 tfoot合計の保険請求が転記データと一致する", async ({ page }) => {
  if (!HAS_AUTH) {
    test.skip(true, "auth.json が存在しません。save-auth で認証を保存してください。");
  }
  const frame = await loadDetailAndWaitForData(page);
  const { transferClaim } = await runStep1(page, frame);

  const tfootRow = frame.locator("#visit-tfoot tr").first();
  const cpCell = tfootRow.locator("td").nth(3);
  const cpText = await cpCell.innerText();
  const cpValue = parseInt(cpText.replace(/[^\d]/g, ""), 10);

  expect(transferClaim).toBeGreaterThan(0);
  expect(cpValue).toBe(transferClaim);
});

// W4D-3: Step1 後「合計行は確定額」注記が表示される
test("W4D-3: Step1 後「合計行は確定額」注記が表示される", async ({ page }) => {
  if (!HAS_AUTH) {
    test.skip(true, "auth.json が存在しません。save-auth で認証を保存してください。");
  }
  const frame = await loadDetailAndWaitForData(page);
  await runStep1(page, frame);

  const note = frame.locator("#transfer-table-note");
  await expect(note).toBeVisible();
  const noteText = await note.innerText();
  expect(noteText).toContain("合計行は申請書転記データの確定額");
});

// W4D-4: KPI 集計欄も転記データ金額（WEB-4C 継続確認）
test("W4D-4: Step1 後 KPI 来院合計が転記データと一致する（WEB-4C継続）", async ({ page }) => {
  if (!HAS_AUTH) {
    test.skip(true, "auth.json が存在しません。save-auth で認証を保存してください。");
  }
  const frame = await loadDetailAndWaitForData(page);
  const { transferTotal } = await runStep1(page, frame);

  const kpiVt = await frame.locator("#kpi-vt").innerText();
  const kpiTotal = parseInt(kpiVt.replace(/[^\d]/g,""), 10);

  expect(transferTotal).toBeGreaterThan(0);
  expect(kpiTotal).toBe(transferTotal);
});

// W4D-5: B案生成ボタンが引き続き存在する
test("W4D-5: B案申請書生成ボタンが引き続き存在する", async ({ page }) => {
  if (!HAS_AUTH) {
    test.skip(true, "auth.json が存在しません。save-auth で認証を保存してください。");
  }
  const frame = await loadDetailAndWaitForData(page);
  const btn = frame.locator("#appgen-b-btn");
  await expect(btn).toBeVisible();
  await expect(btn).not.toBeDisabled();
});
