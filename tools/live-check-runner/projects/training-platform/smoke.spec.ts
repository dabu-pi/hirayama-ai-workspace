/**
 * training-platform smoke.spec.ts
 * training-program-platform-jp 到達確認
 *
 * 注意:
 * - prodUrl が空の場合は localUrl を使う
 * - localUrl も空の場合は全テストをスキップ
 * - localUrl 使用時は先に npm run dev でサーバーを起動しておく
 */

import { test, expect } from "@playwright/test";
import config from "./config.json";

const BASE_URL = config.prodUrl || config.localUrl || "";

test.describe("training-platform smoke — ページ到達確認", () => {
  test.beforeAll(() => {
    if (!BASE_URL) {
      console.warn(
        "[training-platform] URL が設定されていません。\n" +
        "projects/training-platform/config.json の prodUrl または localUrl を設定してください。"
      );
    }
  });

  test("home: URL が到達可能", async ({ page }) => {
    if (!BASE_URL) {
      test.skip(true, "URL 未設定のためスキップします（config.json を参照）");
      return;
    }

    const response = await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    expect(response?.status()).toBeLessThan(400);
  });

  test("home: ページタイトルが存在する", async ({ page }) => {
    if (!BASE_URL) {
      test.skip(true, "URL 未設定のためスキップします");
      return;
    }

    await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
  });
});
