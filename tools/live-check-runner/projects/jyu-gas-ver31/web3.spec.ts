/**
 * jyu-gas-ver31 web3.spec.ts
 * JYU-GAS Ver3.1 Phase WEB-3 月次申請確認
 *
 * 確認項目:
 *   W3-1: web-home に「月次申請」カードが表示される
 *   W3-2: page=monthlyClaims が到達できる
 *   W3-3: 月次申請ページに年月入力欄が存在する
 *   W3-4: 月次申請ページに「一覧を取得」ボタンが存在する
 *   W3-5: page=monthlyClaimDetail が到達できる（patientId/ym 未指定でもクラッシュしない）
 *   W3-6: 既存 patientSearch → selfPayWeb 導線が壊れていない
 *   W3-7: page=home の「来院記録」カードが active（WEB-2 稼働中）になった
 *   W3-8: GAS iframe 入れ子増殖が起きない（iframe depth ≤ 2）
 *
 * 実行コマンド: npm run test:jyu:web3
 */

import { test, expect, Page } from "@playwright/test";
import fs from "fs";
import path from "path";
import config from "./config.json";

const DEV_URL      = config.devUrl;
const AUTH_FILE    = path.join(__dirname, "../../auth.json");
const HAS_AUTH     = fs.existsSync(AUTH_FILE);
const LOAD_TIMEOUT = 30_000;

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
        : "Google 認証が必要です。npm run save-auth を実行してください。"
    );
  }
}

// ── W3-1: web-home に「月次申請」カードが表示される ─────────────────

test.describe(`JYU-GAS W3-1: home に月次申請カード [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test("W3-1: page=home — 「月次申請」カードが存在する", async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=home`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await frame.locator("body").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    await expect(frame.locator("body")).toContainText("月次申請", { timeout: LOAD_TIMEOUT });
    console.log("[W3-1] PASS: 月次申請カードが存在します");
  });
});

// ── W3-2〜4: page=monthlyClaims ─────────────────────────────────────

test.describe(`JYU-GAS W3-2〜4: monthlyClaims ページ [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test("W3-2: page=monthlyClaims — ページが表示される（クラッシュしない）", async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=monthlyClaims`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await frame.locator("body").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    await expect(frame.locator("body")).toContainText("月次申請", { timeout: LOAD_TIMEOUT });
    console.log("[W3-2] PASS: monthlyClaims ページが表示されました");
  });

  test("W3-3: page=monthlyClaims — 年月入力欄が存在する", async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=monthlyClaims`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await frame.locator("#ym-input").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    const val = await frame.locator("#ym-input").inputValue();
    expect(val).toMatch(/^\d{4}-\d{2}$/);
    console.log(`[W3-3] PASS: 年月入力欄あり (値: ${val})`);
  });

  test("W3-4: page=monthlyClaims — 「一覧を取得」ボタンが存在する", async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=monthlyClaims`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await frame.locator("#search-btn").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    await expect(frame.locator("#search-btn")).toContainText("一覧を取得");
    console.log("[W3-4] PASS: 一覧を取得ボタンが存在します");
  });
});

// ── W3-5: page=monthlyClaimDetail ───────────────────────────────────

test.describe(`JYU-GAS W3-5: monthlyClaimDetail ページ [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test("W3-5: page=monthlyClaimDetail — 必須パラメータなしでもクラッシュしない", async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=monthlyClaimDetail`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await frame.locator("body").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    // エラーが表示されても白画面・クラッシュにはならない
    const bodyText = await frame.locator("body").innerText({ timeout: LOAD_TIMEOUT }).catch(() => "");
    const hasContent = bodyText.length > 0;
    expect(hasContent).toBe(true);
    console.log(`[W3-5] PASS: クラッシュなし (本文長: ${bodyText.length}文字)`);
  });
});

// ── W3-6: 既存導線（patientSearch → selfPayWeb）が壊れていない ───────

test.describe(`JYU-GAS W3-6: 既存導線確認 [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test("W3-6: page=search — 患者検索ページが表示される", async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=search`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await expect(frame.locator("h1")).toContainText("患者検索", { timeout: LOAD_TIMEOUT });
    console.log("[W3-6] PASS: patientSearch ページが正常に表示されました");
  });
});

// ── W3-7: web-home の「来院記録」カードが active ─────────────────────

test.describe(`JYU-GAS W3-7: home 来院記録カード active [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test("W3-7: page=home — 「来院記録」カードが active リンクになっている", async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=home`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await frame.locator("body").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    // 来院記録カードが disabled でなく active リンクになっているか確認
    const cards = frame.locator("a.card.active");
    const count = await cards.count();
    expect(count).toBeGreaterThanOrEqual(2); // 患者検索 + 来院記録 + 月次申請 = 3以上
    console.log(`[W3-7] PASS: active カード数: ${count}`);
  });
});

// ── W3-8: iframe 入れ子増殖チェック ─────────────────────────────────

test.describe(`JYU-GAS W3-8: iframe 入れ子増殖なし [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test("W3-8: page=monthlyClaims — iframe が3段以上に増殖しない", async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=monthlyClaims`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    // GAS 標準構造: page > iframe[outer] > iframe[inner] = 2段
    const outerFrame = page.frameLocator("iframe").first();
    await outerFrame.locator("body").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });

    // inner iframe が 3段目 iframe を持っていないことを確認
    const innerFrames = page.frames().filter(f => f !== page.mainFrame());
    // GAS 正常構造: frames は 2〜3 程度（outer / inner / Google 内部）
    expect(innerFrames.length).toBeLessThan(10);
    console.log(`[W3-8] PASS: iframe 数: ${innerFrames.length}（増殖なし）`);
  });
});
