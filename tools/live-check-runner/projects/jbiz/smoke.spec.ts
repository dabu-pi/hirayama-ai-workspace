/**
 * jbiz smoke.spec.ts
 * JBIZ 平山ビジネスポータル 基本確認
 *
 * Portal-1 フェーズの確認対象:
 *   1. Portal-0 構想書が存在する（ローカル fs チェック）
 *   2. Portal-1 設計書が存在する（ローカル fs チェック）
 *   3. PROJECT_STATUS.md に Portal-1 記録がある（テキスト検索）
 *   4. 管理表 URL に到達できる（認証あり時のみ）
 *
 * 認証状態による動作:
 *   auth.json あり → Google ログイン済みセッションで Sheets URL を確認 → PASS 期待
 *   auth.json なし → Sheets の URL 到達チェックはスキップ / fs チェックは実施
 */

import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import config from "./config.json";

const JBIZ_REPO = path.resolve(
  __dirname,
  "../../../../hirayama-jyusei-strategy"
);
const AUTH_FILE = path.join(__dirname, "../../auth.json");
const HAS_AUTH = fs.existsSync(AUTH_FILE);

function jbizPath(relativePath: string): string {
  return path.join(JBIZ_REPO, relativePath);
}

// ── ローカル fs チェック ─────────────────────────────────────

test("Portal-0 構想書が存在する", async () => {
  const filePath = jbizPath(config.localDocs.portal0);
  expect(
    fs.existsSync(filePath),
    `Portal-0 構想書が見つかりません: ${filePath}`
  ).toBe(true);
});

test("Portal-1 設計書が存在する", async () => {
  const filePath = jbizPath(config.localDocs.portal1);
  expect(
    fs.existsSync(filePath),
    `Portal-1 設計書が見つかりません: ${filePath}`
  ).toBe(true);
});

test("PROJECT_STATUS.md に Portal-1 記録がある", async () => {
  const filePath = jbizPath(config.localDocs.projectStatus);
  expect(
    fs.existsSync(filePath),
    `PROJECT_STATUS.md が見つかりません: ${filePath}`
  ).toBe(true);
  const content = fs.readFileSync(filePath, "utf-8");
  expect(
    content.includes("Portal-1"),
    "PROJECT_STATUS.md に Portal-1 の記録がありません"
  ).toBe(true);
});

test("NEXT_ACTIONS.md が存在する", async () => {
  const filePath = jbizPath(config.localDocs.nextActions);
  expect(
    fs.existsSync(filePath),
    `NEXT_ACTIONS.md が見つかりません: ${filePath}`
  ).toBe(true);
});

// ── Sheets URL 到達確認（認証あり時のみ）────────────────────

test("管理表 URL に到達できる（auth ありの場合のみ）", async ({ page }) => {
  if (!HAS_AUTH) {
    test.skip(true, "auth.json がないため Sheets 到達確認をスキップします");
    return;
  }
  await page.goto(config.sheetsUrl, { timeout: 15000 });
  const url = page.url();

  if (
    url.includes("accounts.google.com") ||
    url.includes("ServiceLogin") ||
    (await page.title().catch(() => "")).includes("Sign in")
  ) {
    test.skip(true, "auth.json の期限切れ: ログイン画面にリダイレクトされました");
    return;
  }

  // Sheets が開けたことを確認（タイトルに管理表名または Sheets が含まれる）
  const title = await page.title();
  const isSheets =
    title.includes("Google スプレッドシート") ||
    title.includes("Google Sheets") ||
    title.includes("管理表") ||
    title.includes("慢性疼痛");
  expect(isSheets, `想定外のページが表示されました: ${title}`).toBe(true);
});
