/**
 * wildboar/source-probe.spec.ts
 * 元データ会員名簿2026 への read アクセス可否を確認するだけの probe
 *
 * 重要:
 *   - 個人情報をログ / レポートに出さない
 *   - 件数・アクセス可否・タイトル先頭文字 のみ記録
 *   - 書込みは絶対にしない（試しもしない）
 *
 * 実行: npx playwright test projects/wildboar/source-probe.spec.ts --project=chromium
 */

import { test, expect, Page } from "@playwright/test";

const SOURCE_URL =
  "https://docs.google.com/spreadsheets/d/1bz95Vy2FnTxWq1PHvb-cqT5UZpRWkNMQQ_-OXmgG9Qs/edit?gid=676663641";

test.describe("WILDBOAR W-SRC: 元データ会員名簿2026 アクセス確認", () => {
  test.setTimeout(120_000);

  test("W-SRC-1: 元データ URL が読める / ログイン必須でない", async ({ page }) => {
    await page.goto(SOURCE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    // タイトルを取得（個人情報含まないことを期待）
    const title = await page.title();
    const isLoginPage =
      /Sign in|ログイン|Accounts|accounts\.google\.com/i.test(title) ||
      page.url().includes("accounts.google.com");

    // 出力は「title length」だけ・タイトル本文は記録しない
    test.info().annotations.push({
      type: "source-access",
      description: JSON.stringify({
        urlFinal: page.url().split("?")[0],
        titleLen: title.length,
        loginRedirect: isLoginPage,
      }),
    });

    if (isLoginPage) {
      // 認証が無い場合 — ここで止める
      throw new Error("source spreadsheet redirected to login — auth required");
    }

    expect(isLoginPage, "should not redirect to login").toBe(false);

    // Sheets の編集 UI ロード待ち（grid container 出現）
    // 「Untitled spreadsheet」等の汎用文字列で検出する代わりに、Sheets の安定セレクタを使う
    const gridSelector = "div.docs-titlebar-buttons, div[id^='docs-toolbar']";
    await page.waitForSelector(gridSelector, { timeout: 30_000 });

    // ページが Sheets editor であることだけ確認（個人情報は読まない）
    const isSheets = page.url().includes("/spreadsheets/d/");
    expect(isSheets, "URL is a Google Sheets editor").toBe(true);
  });

  test("W-SRC-2: 対象 gid のシートが表示される", async ({ page }) => {
    await page.goto(SOURCE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });

    // 認証チェック
    if (page.url().includes("accounts.google.com")) {
      throw new Error("login required");
    }

    // タブのテキストや行内容を取得すると個人情報が出るため、
    // 「URLに gid=676663641 が保持されていること」だけで対象シート表示を判定
    await page.waitForTimeout(8_000); // Sheets 安定待ち

    const finalUrl = page.url();
    const hasGid = finalUrl.includes("gid=676663641");
    test.info().annotations.push({
      type: "gid-match",
      description: hasGid ? "gid=676663641 retained" : "gid not retained — sheet switched",
    });

    expect(hasGid, "target gid retained in URL").toBe(true);
  });
});
