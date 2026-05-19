/**
 * jrec-sf01 public-reservation-link.spec.ts
 *
 * Phase R-2D: verify the "公開予約ページ" tab added to the clinic navigation.
 *
 * What it checks (all read-only / no Gmail dispatch / no reservation submit):
 *   PRL-1: A staff page (reservationAdmin) renders, nav is visible.
 *   PRL-2: The new tab button "🌐 公開予約ページ" exists.
 *   PRL-3: A copy-URL button "📋" exists right next to it.
 *   PRL-4: The clicked URL would target page=reservationPublic (inspected via
 *          the inline onclick attribute, NOT actually clicked — clicking
 *          opens a new tab which complicates assertion).
 *   PRL-5: The previous reservationAdmin nav button still exists (regression).
 *
 * This spec deliberately does NOT submit any reservation, so it does NOT
 * trigger Gmail. Safe to run while notification_mode=gmail is LIVE.
 */
import { test, expect, type Page, type FrameLocator } from "@playwright/test";
import path from "path";
import fs from "fs";
import config from "./config.json";

const DEV_URL = config.devUrl;
const ADMIN_URL = DEV_URL + "?page=reservationAdmin";
const AUTH_FILE = path.join(__dirname, "../../auth.json");
const HAS_AUTH = fs.existsSync(AUTH_FILE);
const LOAD_TIMEOUT = 30_000;
const GAS_TIMEOUT = 25_000;

function gasAppFrame(page: Page): FrameLocator {
  return page.frameLocator("iframe").first().frameLocator("iframe").first();
}

async function handleAuthRedirect(page: Page) {
  const url = page.url();
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
        : "Google 認証が必要です。npm run save-auth を実行してください。"
    );
  }
}

test.describe(`JREC-SF01 R-2D 公開予約ページ導線 [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test.beforeEach(async ({ page }) => { page.setDefaultTimeout(LOAD_TIMEOUT); });

  test("PRL-1: staff ナビが表示される", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await expect(frame.locator("nav.tab-nav").first()).toBeVisible({ timeout: LOAD_TIMEOUT });
  });

  test("PRL-2: 「公開予約ページ」タブ button.tab-public-reservation が存在する", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    const btn = frame.locator("nav.tab-nav button.tab-public-reservation").first();
    await expect(btn).toBeVisible({ timeout: GAS_TIMEOUT });
    expect(await btn.textContent()).toContain("公開予約ページ");
  });

  test("PRL-3: URL コピーボタン button.tab-public-reservation-copy が隣接配置されている", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    const copyBtn = frame.locator("nav.tab-nav button.tab-public-reservation-copy").first();
    await expect(copyBtn).toBeVisible({ timeout: GAS_TIMEOUT });
    expect(await copyBtn.textContent()).toContain("📋");
  });

  test("PRL-4: 「公開予約ページ」の onclick が page=reservationPublic に向いている", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    const onclick = await frame.locator("nav.tab-nav button.tab-public-reservation").first().getAttribute("onclick");
    expect(onclick || "").toContain("page=reservationPublic");
    expect(onclick || "").toContain("window.open");
    expect(onclick || "").toContain("_blank");
  });

  test("PRL-5: 既存の予約管理タブが壊れていない", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    const adminTab = frame.locator("nav.tab-nav button[data-page='reservationAdmin']").first();
    await expect(adminTab).toBeVisible({ timeout: GAS_TIMEOUT });
    expect(await adminTab.textContent()).toContain("予約管理");
  });

  test("PRL-6: 公開予約ページ自体が /dev で開ける（page=reservationPublic）", async ({ page }) => {
    const publicUrl = DEV_URL + "?page=reservationPublic";
    const res = await page.goto(publicUrl, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    expect(res?.status()).toBeLessThan(400);
    const frame = gasAppFrame(page);
    // 公開予約 UI に存在する要素: 週間カラム or 空メッセージ
    await Promise.race([
      frame.locator("#week-grid").first().waitFor({ state: "visible", timeout: GAS_TIMEOUT }),
      frame.locator("#week-empty-banner").first().waitFor({ state: "visible", timeout: GAS_TIMEOUT }),
      frame.locator("h1, h2").first().waitFor({ state: "visible", timeout: GAS_TIMEOUT }),
    ]).catch(() => {});
    // ページの何かしらが描画されていればよい（厳密な構造アサーションはしない）
    const bodyText = await frame.locator("body").innerText({ timeout: GAS_TIMEOUT }).catch(() => "");
    expect(bodyText.length).toBeGreaterThan(0);
  });
});
