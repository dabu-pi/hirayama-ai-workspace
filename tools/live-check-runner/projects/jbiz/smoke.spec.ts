/**
 * jbiz smoke.spec.ts
 * JBIZ 平山ビジネスポータル 基本確認
 *
 * Portal-2 フェーズの確認対象:
 *   1. Portal-0 構想書が存在する（ローカル fs チェック）
 *   2. Portal-1 設計書が存在する（ローカル fs チェック）
 *   3. Portal-2 設計書が存在する（ローカル fs チェック）
 *   4. PROJECT_STATUS.md に Portal-2 記録がある（テキスト検索）
 *   5. GAS スクリプト portal-gateway-v1.gs が存在する（ローカル fs チェック）
 *   6. config.json の spreadsheetId が正本 ID（整合確認）
 *   7. 管理表 URL に到達できる（認証あり時のみ）
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

test("Portal-2 設計書が存在する", async () => {
  const filePath = jbizPath(config.localDocs.portal2);
  expect(
    fs.existsSync(filePath),
    `Portal-2 設計書が見つかりません: ${filePath}`
  ).toBe(true);
});

test("PROJECT_STATUS.md に Portal-2 記録がある", async () => {
  const filePath = jbizPath(config.localDocs.projectStatus);
  const content = fs.readFileSync(filePath, "utf-8");
  expect(
    content.includes("Portal-2"),
    "PROJECT_STATUS.md に Portal-2 の記録がありません"
  ).toBe(true);
});

test("GAS gateway スクリプトが存在する", async () => {
  const filePath = jbizPath(config.localDocs.portalGateway);
  expect(
    fs.existsSync(filePath),
    `portal-gateway-v1.gs が見つかりません: ${filePath}`
  ).toBe(true);
});

test("config の spreadsheetId が正本 ID", async () => {
  const CORRECT_ID = "1FnJdALwFSv48WiD6NWr0DzG78kwB692R2pFeiTcZlCc";
  expect(
    config.spreadsheetId,
    `spreadsheetId が正本 ID ではありません: ${config.spreadsheetId}`
  ).toBe(CORRECT_ID);
});

test("Portal-3 設計書が存在する", async () => {
  const filePath = jbizPath(config.localDocs.portal3);
  expect(
    fs.existsSync(filePath),
    `Portal-3 設計書が見つかりません: ${filePath}`
  ).toBe(true);
});

test("GAS スクリプトに doGet が存在する", async () => {
  const filePath = jbizPath(config.localDocs.portalGateway);
  const content = fs.readFileSync(filePath, "utf-8");
  expect(
    content.includes("function doGet("),
    "portal-gateway-v1.gs に doGet 関数がありません"
  ).toBe(true);
});

test("GAS スクリプトに appendPortal2ToRunLog が存在する", async () => {
  const filePath = jbizPath(config.localDocs.portalGateway);
  const content = fs.readFileSync(filePath, "utf-8");
  expect(
    content.includes("function appendPortal2ToRunLog("),
    "portal-gateway-v1.gs に appendPortal2ToRunLog 関数がありません"
  ).toBe(true);
});

test("PROJECT_STATUS.md に Portal-3 記録がある", async () => {
  const filePath = jbizPath(config.localDocs.projectStatus);
  const content = fs.readFileSync(filePath, "utf-8");
  expect(
    content.includes("Portal-3"),
    "PROJECT_STATUS.md に Portal-3 の記録がありません"
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
