/**
 * jyu-gas-ver31 web6_nav.spec.ts
 * JYU-GAS Ver3.1 Phase WEB-6: 共通グローバルナビ確認
 *
 * 確認項目:
 *   W6-1: page=home に .web-nav が表示される
 *   W6-2: page=search に .web-nav が表示される
 *   W6-3: page=monthlyClaims に .web-nav が表示される
 *   W6-4: page=monthlyClaimDetail に .web-nav が表示される
 *   W6-5: 全ナビリンクに target="_top" が付いている
 *   W6-6: HOMEリンクが正しい href を持つ
 *   W6-7: 月次申請リンクが正しい href を持つ
 *   W6-8: monthlyClaimDetail でB案Excel生成ボタンが引き続き存在する（後退なし）
 *   W6-9: iframe 入れ子増殖がない（白画面バグ再発なし）
 *
 * 実行コマンド: npm run test:jyu:web6
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

async function loadPage(page: Page, params: string) {
  await page.goto(`${DEV_URL}${params}`, { timeout: LOAD_TIMEOUT });
  await handleAuthRedirect(page);
  const frame = gasAppFrame(page);
  await frame.locator("body").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
  await page.waitForTimeout(1500);
  return frame;
}

// W6-1: page=home に .web-nav が表示される
test("W6-1: page=home に .web-nav が表示される", async ({ page }) => {
  if (!HAS_AUTH) test.skip(true, "auth.json が存在しません。save-auth で更新してください。");
  const frame = await loadPage(page, "?page=home");
  const nav = frame.locator(".web-nav");
  await expect(nav).toBeVisible({ timeout: LOAD_TIMEOUT });
  // HOME が active になっている
  const activeLink = frame.locator(".web-nav a.active");
  await expect(activeLink).toBeVisible();
  const activeText = await activeLink.innerText();
  expect(activeText).toContain("HOME");
});

// W6-2: page=search に .web-nav が表示される
test("W6-2: page=search に .web-nav が表示される", async ({ page }) => {
  if (!HAS_AUTH) test.skip(true, "auth.json が存在しません。save-auth で更新してください。");
  const frame = await loadPage(page, "?page=search");
  const nav = frame.locator(".web-nav");
  await expect(nav).toBeVisible({ timeout: LOAD_TIMEOUT });
  const activeLink = frame.locator(".web-nav a.active");
  const activeText = await activeLink.innerText().catch(() => "");
  expect(activeText).toContain("患者検索");
});

// W6-3: page=monthlyClaims に .web-nav が表示される
test("W6-3: page=monthlyClaims に .web-nav が表示される", async ({ page }) => {
  if (!HAS_AUTH) test.skip(true, "auth.json が存在しません。save-auth で更新してください。");
  const frame = await loadPage(page, "?page=monthlyClaims");
  const nav = frame.locator(".web-nav");
  await expect(nav).toBeVisible({ timeout: LOAD_TIMEOUT });
  const activeLink = frame.locator(".web-nav a.active");
  const activeText = await activeLink.innerText().catch(() => "");
  expect(activeText).toContain("月次申請");
});

// W6-4: page=monthlyClaimDetail に .web-nav が表示される
test("W6-4: page=monthlyClaimDetail に .web-nav が表示される", async ({ page }) => {
  if (!HAS_AUTH) test.skip(true, "auth.json が存在しません。save-auth で更新してください。");
  const frame = await loadPage(page, `?page=monthlyClaimDetail&patientId=${TEST_PID}&ym=${TEST_YM}`);
  // #main-content が表示されるまで待つ（非同期ロード）
  await frame.locator("#main-content").waitFor({ state: "visible", timeout: LOAD_TIMEOUT }).catch(() => {});
  const nav = frame.locator(".web-nav");
  await expect(nav).toBeVisible({ timeout: LOAD_TIMEOUT });
  const activeLink = frame.locator(".web-nav a.active");
  const activeText = await activeLink.innerText().catch(() => "");
  expect(activeText).toContain("月次申請");
});

// W6-5: 全ナビリンクに target="_top" が付いている（home ページで確認）
test("W6-5: 全ナビリンクに target=\"_top\" が付いている", async ({ page }) => {
  if (!HAS_AUTH) test.skip(true, "auth.json が存在しません。save-auth で更新してください。");
  const frame = await loadPage(page, "?page=home");
  const links = frame.locator(".web-nav a");
  const count = await links.count();
  expect(count).toBeGreaterThanOrEqual(3);
  for (let i = 0; i < count; i++) {
    const target = await links.nth(i).getAttribute("target");
    expect(target).toBe("_top");
  }
});

// W6-6: HOME リンクが ?page=home を含む href を持つ
test("W6-6: HOMEリンクの href が ?page=home を含む", async ({ page }) => {
  if (!HAS_AUTH) test.skip(true, "auth.json が存在しません。save-auth で更新してください。");
  const frame = await loadPage(page, "?page=search");
  const homeLink = frame.locator(".web-nav a").filter({ hasText: "HOME" });
  const href = await homeLink.getAttribute("href").catch(() => "");
  expect(href).toContain("page=home");
});

// W6-7: 月次申請リンクが ?page=monthlyClaims を含む href を持つ
test("W6-7: 月次申請リンクの href が ?page=monthlyClaims を含む", async ({ page }) => {
  if (!HAS_AUTH) test.skip(true, "auth.json が存在しません。save-auth で更新してください。");
  const frame = await loadPage(page, "?page=home");
  const mcLink = frame.locator(".web-nav a").filter({ hasText: "月次申請" });
  const href = await mcLink.getAttribute("href").catch(() => "");
  expect(href).toContain("page=monthlyClaims");
});

// W6-8: monthlyClaimDetail でB案Excel生成ボタンが維持されている
test("W6-8: monthlyClaimDetail でB案Excel生成ボタンが引き続き存在する", async ({ page }) => {
  if (!HAS_AUTH) test.skip(true, "auth.json が存在しません。save-auth で更新してください。");
  const frame = await loadPage(page, `?page=monthlyClaimDetail&patientId=${TEST_PID}&ym=${TEST_YM}`);
  await frame.locator("#main-content").waitFor({ state: "visible", timeout: LOAD_TIMEOUT }).catch(() => {});
  const btn = frame.locator("#appgen-b-btn");
  await expect(btn).toBeVisible({ timeout: LOAD_TIMEOUT });
  await expect(btn).not.toBeDisabled();
});

// W6-9: iframe 入れ子増殖がない（ナビ遷移後）
test("W6-9: iframe 入れ子増殖がない（白画面バグ再発なし）", async ({ page }) => {
  if (!HAS_AUTH) test.skip(true, "auth.json が存在しません。save-auth で更新してください。");
  const frame = await loadPage(page, "?page=home");
  const nav = frame.locator(".web-nav");
  await expect(nav).toBeVisible({ timeout: LOAD_TIMEOUT });

  // iframe 深さを確認（3段以上にならないこと）
  const iframeCount = await page.frames().length;
  expect(iframeCount).toBeLessThan(5);

  // home ページ全体が表示されている
  const bodyText = await frame.locator("body").innerText().catch(() => "");
  expect(bodyText.length).toBeGreaterThan(10);
});
