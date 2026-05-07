/**
 * jyu-gas-ver31 tc_fixtures.spec.ts
 * JYU-GAS Ver3.1 B-1: TC01〜TC20 fixture テスト（算定ロジック検証）
 *
 * 確認項目:
 *   TC-ALL: page=fixtureResults を開いて全 fixture が PASS であることを確認
 *   TC-DETAIL: 個別テスト結果の詳細を出力（情報収集）
 *
 * テスト設計:
 *   - web-fixture-results.html が自動的に runFixtureSuiteWeb_V3() を呼び出す
 *   - google.script.run の結果を DOM (#json-output) に書き出す
 *   - Playwright は DOM から結果 JSON を読み取る
 *   - SpreadsheetApp 非依存の純粋計算テスト
 *
 * 実行コマンド: npm run test:jyu:fixtures
 */

import { test, expect, Page } from "@playwright/test";
import fs from "fs";
import path from "path";
import config from "./config.json";

const DEV_URL      = config.devUrl;
const AUTH_FILE    = path.join(__dirname, "../../auth.json");
const HAS_AUTH     = fs.existsSync(AUTH_FILE);
const LOAD_TIMEOUT = 90_000;  // fixture 全件実行のため長めに設定

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

// ── TC-ALL: 全 fixture スイート実行 ─────────────────────────────────

test.describe(`JYU-GAS B-1 TC-ALL: fixture スイート [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test("TC-ALL: 全 fixture PASS — page=fixtureResults 経由", async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=fixtureResults`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);

    // #json-output の data-ready 属性が "1" になるまで待機（GAS 非同期呼び出し完了）
    await frame.locator("#json-output[data-ready='1']").waitFor({ state: "attached", timeout: LOAD_TIMEOUT });

    const jsonText = await frame.locator("#json-output").innerText({ timeout: 5000 });
    const result = JSON.parse(jsonText) as {
      ok: boolean;
      passCount: number;
      failCount: number;
      total: number;
      results: Array<{ testId: string; pass: boolean; diff: string }>;
      summary: string;
    };

    // 結果を出力
    console.log(`\n[TC-ALL] ${result.summary}`);
    if (result.failCount > 0) {
      result.results.filter(r => !r.pass).forEach(f => {
        console.log(`  [FAIL] ${f.testId}: ${f.diff}`);
      });
    } else {
      console.log(`[TC-ALL] 全 ${result.passCount} テスト PASS ✅`);
    }

    // 検証
    expect(result.ok).toBe(true);
    expect(result.failCount).toBe(0);
  });
});

// ── TC-DETAIL: 個別テストの詳細確認 ─────────────────────────────────

test.describe(`JYU-GAS B-1 TC-DETAIL: fixture 詳細 [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test("TC-DETAIL: 全テスト詳細を出力（情報収集）", async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=fixtureResults`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await frame.locator("#json-output[data-ready='1']").waitFor({ state: "attached", timeout: LOAD_TIMEOUT });

    const jsonText = await frame.locator("#json-output").innerText({ timeout: 5000 });
    const result = JSON.parse(jsonText) as any;

    console.log("\n[TC-DETAIL] 全テスト詳細:");
    (result.results || []).forEach((r: { testId: string; pass: boolean; diff: string }) => {
      const status = r.pass ? "✅ PASS" : "❌ FAIL";
      console.log(`  ${status} ${r.testId}${r.diff ? ": " + r.diff : ""}`);
    });

    console.log(`\n[TC-DETAIL] 完了 — PASS: ${result.passCount} / FAIL: ${result.failCount} / TOTAL: ${result.total}`);
    expect(result.ok).toBe(true);
  });
});
