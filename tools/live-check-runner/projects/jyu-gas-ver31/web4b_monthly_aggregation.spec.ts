/**
 * jyu-gas-ver31 web4b_monthly_aggregation.spec.ts
 * JYU-GAS Ver3.1 Phase WEB-4B: 月次申請詳細の集計非ゼロ確認
 *
 * 背景:
 *   getMonthlyClaimList_V3 / getMonthlyClaimDetail_V3 が buildHeaderColMap_（1-based）を
 *   使い getValues() の 0-based 配列インデックスとして渡していたため、常に1列ずれ、
 *   日付チェックが全行 false → 集計が 0 になっていた（WEB-4B バグ）。
 *   V3TR_buildHeaderMap_（0-based）に修正済み。
 *
 * 確認項目:
 *   W4B-1: monthlyClaims 2026-04 でヒットする患者が存在する
 *   W4B-2: monthlyClaimDetail hirayamaka/2026-04 で来院数が 0 でない
 *   W4B-3: monthlyClaimDetail hirayamaka/2026-04 で保険請求が 0 でない
 *   W4B-4: 月次詳細に来院明細行が表示される（tbody に行がある）
 *   W4B-5: B案申請書生成ボタンが引き続き存在する（WEB-4A 後退なし）
 *
 * 実行コマンド: npm run test:jyu:web4b
 */

import { test, expect, Page } from "@playwright/test";
import fs from "fs";
import path from "path";
import config from "./config.json";

const DEV_URL      = config.devUrl;
const AUTH_FILE    = path.join(__dirname, "../../auth.json");
const HAS_AUTH     = fs.existsSync(AUTH_FILE);
const LOAD_TIMEOUT = 45_000;
const DATA_WAIT    = 8_000;   // GAS 通信完了待ち（集計データ表示まで）
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
  // KPI ロードを待つ（GAS 通信）
  await frame.locator("#kpi-visits").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
  await page.waitForTimeout(DATA_WAIT);
  return frame;
}

// W4B-1: monthlyClaims 2026-04 でヒットする患者が存在する（一覧表示確認）
test("W4B-1: monthlyClaims 2026-04 で患者が存在する", async ({ page }) => {
  if (!HAS_AUTH) {
    test.skip(true, "auth.json が存在しません。save-auth で認証を保存してください。");
  }
  const url = `${DEV_URL}?page=monthlyClaims`;
  await page.goto(url, { timeout: LOAD_TIMEOUT });
  await handleAuthRedirect(page);
  const frame = gasAppFrame(page);
  await frame.locator("body").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });

  // 年月を入力して検索
  const ymInput = frame.locator("#ym-input");
  await expect(ymInput).toBeVisible({ timeout: LOAD_TIMEOUT });
  await ymInput.fill(TEST_YM);
  await frame.locator("button").filter({ hasText: "一覧を取得" }).click();

  // 「一覧を取得」後にテーブル行が1件以上あることを確認
  // テーブルIDは result-tbody。GAS通信完了を待つため 60s のタイムアウト
  await frame.locator("#result-tbody tr").first().waitFor({ state: "visible", timeout: 60_000 });
  const rowCount = await frame.locator("#result-tbody tr").count();
  expect(rowCount).toBeGreaterThan(0);
});

// W4B-2: monthlyClaimDetail で来院数が 0 でない
test("W4B-2: monthlyClaimDetail 来院数が 0 でない", async ({ page }) => {
  if (!HAS_AUTH) {
    test.skip(true, "auth.json が存在しません。save-auth で認証を保存してください。");
  }
  const frame = await loadMonthlyClaimDetail(page);

  const visitsText = await frame.locator("#kpi-visits").innerText();
  const visits = parseInt(visitsText.trim(), 10);
  expect(visits).toBeGreaterThan(0);
});

// W4B-3: monthlyClaimDetail で保険請求が 0 でない
test("W4B-3: monthlyClaimDetail 保険請求が 0 でない", async ({ page }) => {
  if (!HAS_AUTH) {
    test.skip(true, "auth.json が存在しません。save-auth で認証を保存してください。");
  }
  const frame = await loadMonthlyClaimDetail(page);

  const cpText = await frame.locator("#kpi-cp").innerText();
  // "¥3,058" のような形式 → 数字だけ取り出す
  const cp = parseInt(cpText.replace(/[^\d]/g, ""), 10);
  expect(cp).toBeGreaterThan(0);
});

// W4B-4: 来院明細テーブルに行がある
test("W4B-4: monthlyClaimDetail 来院明細行が存在する", async ({ page }) => {
  if (!HAS_AUTH) {
    test.skip(true, "auth.json が存在しません。save-auth で認証を保存してください。");
  }
  const frame = await loadMonthlyClaimDetail(page);

  const rowCount = await frame.locator("#visit-tbody tr").count();
  expect(rowCount).toBeGreaterThan(0);
});

// W4B-5: B案申請書生成ボタンが引き続き存在する（WEB-4A 後退なし）
test("W4B-5: B案申請書生成ボタンが引き続き存在する（WEB-4A 後退なし）", async ({ page }) => {
  if (!HAS_AUTH) {
    test.skip(true, "auth.json が存在しません。save-auth で認証を保存してください。");
  }
  const frame = await loadMonthlyClaimDetail(page);

  const btn = frame.locator("#appgen-b-btn");
  await expect(btn).toBeVisible();
  await expect(btn).not.toBeDisabled();
});
