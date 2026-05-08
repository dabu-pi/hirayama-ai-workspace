/**
 * jyu-gas-ver31 web4_application_b.spec.ts
 * JYU-GAS Ver3.1 Phase WEB-4A: Web UI B案申請書生成入口確認
 *
 * 確認項目:
 *   W4A-1: monthlyClaimDetail に「申請書Excelを生成」ボタンが存在する
 *   W4A-2: APPGEN_SECRET / APPGEN_ENDPOINT が画面 HTML に露出していない
 *   W4A-3: 「申請書Excelを生成」ボタンのハンドラが generateClaimApplicationBFromWeb_V3 を呼ぶ
 *   W4A-4: ボタン押下で確認ダイアログ → 「キャンセル」でボタンが disabled のままにならない
 *   W4A-5: 既存 Step 1 転記データ生成ボタン・NDJSON 出力ボタンが壊れていない
 *
 * 実行コマンド: npm run test:jyu:web4
 */

import { test, expect, Page } from "@playwright/test";
import fs from "fs";
import path from "path";
import config from "./config.json";

const DEV_URL      = config.devUrl;
const AUTH_FILE    = path.join(__dirname, "../../auth.json");
const HAS_AUTH     = fs.existsSync(AUTH_FILE);
const LOAD_TIMEOUT = 45_000;
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

async function loadMonthlyClaimDetail(page: Page) {
  const url = `${DEV_URL}?page=monthlyClaimDetail&patientId=${TEST_PID}&ym=${TEST_YM}`;
  await page.goto(url, { timeout: LOAD_TIMEOUT });
  await handleAuthRedirect(page);
  const frame = gasAppFrame(page);
  await frame.locator("body").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
  return frame;
}

// W4A-1: 「申請書Excelを生成」ボタンが存在する
test("W4A-1: monthlyClaimDetail に「申請書Excelを生成」ボタンが存在する", async ({ page }) => {
  if (!HAS_AUTH) {
    test.skip(true, "auth.json が存在しません。save-auth で認証を保存してください。");
  }
  const frame = await loadMonthlyClaimDetail(page);
  const btn = frame.locator("#appgen-b-btn");
  await expect(btn).toBeVisible({ timeout: LOAD_TIMEOUT });
  const text = await btn.textContent();
  expect(text).toContain("申請書Excelを生成");
});

// W4A-2: APPGEN_SECRET / APPGEN_ENDPOINT が HTML に露出していない
test("W4A-2: APPGEN_SECRET / APPGEN_ENDPOINT が画面 HTML に露出していない", async ({ page }) => {
  if (!HAS_AUTH) {
    test.skip(true, "auth.json が存在しません。save-auth で認証を保存してください。");
  }
  const frame = await loadMonthlyClaimDetail(page);
  await frame.locator("body").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });

  const html = await frame.locator("html").innerHTML();
  expect(html).not.toContain("APPGEN_SECRET");
  expect(html).not.toContain("jrec-appgen-server");
  expect(html).not.toContain("X-Secret-Key");
});

// W4A-3: ボタンのハンドラが generateClaimApplicationBFromWeb_V3 を呼ぶ（JSソース確認）
test("W4A-3: ボタンハンドラが generateClaimApplicationBFromWeb_V3 を呼ぶ（JSソース確認）", async ({ page }) => {
  if (!HAS_AUTH) {
    test.skip(true, "auth.json が存在しません。save-auth で認証を保存してください。");
  }
  const frame = await loadMonthlyClaimDetail(page);
  await frame.locator("body").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });

  // doAppgenB 関数が generateClaimApplicationBFromWeb_V3 を呼ぶことをソースで確認
  // 注: Step4(PDF) の doPdfGenerate が generateClaimApplication_V3(PATIENT_ID を使うため
  //     not.toContain チェックは使わず、正の確認のみ行う
  const pageSource = await page.content();
  expect(pageSource).toContain("generateClaimApplicationBFromWeb_V3");
  expect(pageSource).toContain("doAppgenB");
});

// W4A-4: ボタン押下で確認ダイアログ → キャンセルでボタンが有効に戻る
test("W4A-4: ボタン押下 → キャンセルでボタンが有効に戻る", async ({ page }) => {
  if (!HAS_AUTH) {
    test.skip(true, "auth.json が存在しません。save-auth で認証を保存してください。");
  }
  const frame = await loadMonthlyClaimDetail(page);
  const btn = frame.locator("#appgen-b-btn");
  await expect(btn).toBeVisible({ timeout: LOAD_TIMEOUT });

  // 確認ダイアログをキャンセル
  page.once("dialog", async (dialog) => {
    expect(dialog.message()).toContain("申請書Excel");
    await dialog.dismiss();
  });

  await btn.click();

  // キャンセル後: ボタンは disabled でない（元の状態に戻る）
  await expect(btn).not.toBeDisabled({ timeout: 5_000 });
  await expect(btn).toHaveText("申請書Excelを生成");
});

// W4A-5: 既存 Step 1・Step 2 ボタンが壊れていない
test("W4A-5: 既存 Step 1 転記データ生成ボタン・NDJSON 出力ボタンが壊れていない", async ({ page }) => {
  if (!HAS_AUTH) {
    test.skip(true, "auth.json が存在しません。save-auth で認証を保存してください。");
  }
  const frame = await loadMonthlyClaimDetail(page);
  await frame.locator("body").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });

  // Step 1: 転記データ生成ボタン
  const transferBtn = frame.locator("#transfer-btn");
  await expect(transferBtn).toBeVisible({ timeout: LOAD_TIMEOUT });
  await expect(transferBtn).not.toBeDisabled();

  // Step 2: NDJSON 出力ボタン
  const ndjsonBtn = frame.locator("#ndjson-btn");
  await expect(ndjsonBtn).toBeVisible({ timeout: LOAD_TIMEOUT });
  await expect(ndjsonBtn).not.toBeDisabled();
});
