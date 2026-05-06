/**
 * delete-web25-testdata.ts
 * WEB-2.5 テストデータ（hirayamaka_2999-12-31）を削除する。
 */
import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";

const DEV_URL  = "https://script.google.com/macros/s/AKfycbzj47fbRvTlVixUrUiV_25xkevfyI_HXhFaBKYodB2B/dev";
const authFile = path.join(__dirname, "../auth.json");
const TIMEOUT  = 45_000;

(async () => {
  console.log("═══ WEB-2.5 テストデータ削除 ═══");
  console.log("対象 visitKey: hirayamaka_2999-12-31\n");

  const browser = await chromium.launch({ headless: true });
  const ctx     = await browser.newContext({ storageState: authFile });
  const page    = await ctx.newPage();

  const delUrl = `${DEV_URL}?page=_deleteTest_WEB25`;
  const res = await page.goto(delUrl, {
    waitUntil: "networkidle",
    timeout: TIMEOUT
  }).catch(e => { console.log("goto timeout:", e.message); return null; });

  const finalUrl = page.url();
  console.log(`最終URL: ${finalUrl.substring(0, 100)}`);
  console.log(`HTTP: ${res?.status() ?? "N/A"}`);

  if (finalUrl.includes("accounts.google.com")) {
    console.error("❌ Google 認証リダイレクト");
    await browser.close();
    process.exit(1);
  }

  // フレーム一覧
  const frames = page.frames();
  console.log(`\nフレーム数: ${frames.length}`);
  for (let i = 0; i < frames.length; i++) {
    const f = frames[i];
    const fUrl = f.url();
    const fText = await f.locator("body").innerText({ timeout: 5000 }).catch(() => "(空)");
    console.log(`Frame[${i}]: ${fUrl.substring(0, 60)}`);
    console.log(`  body: ${fText.replace(/\n/g, " ").substring(0, 120)}`);
  }

  // ページ全体の innerHTML も確認
  const pageContent = await page.content().catch(() => "");
  console.log(`\nページHTML (先頭500ch): ${pageContent.substring(0, 500)}`);

  await browser.close();
})().catch(e => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
