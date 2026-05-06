/**
 * diag-home-navigation.ts
 * トップページ → 患者検索 → トップページ戻りの白画面を Playwright で再現・診断する。
 */
import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";

const EXEC_URL = "https://script.google.com/macros/s/AKfycbxODNWJNcCJVQnDXHzzWck237hnUIIXR_Ilt8SS5P5zodfF2dnmKeqso8BL8hcinVEBrQ/exec";
const authFile = path.join(__dirname, "../auth.json");
const TIMEOUT  = 20_000;

async function getFrameContent(page: import("@playwright/test").Page): Promise<string> {
  const frames = page.frames();
  for (const f of frames) {
    const text = await f.locator("body").innerText({ timeout: 5000 }).catch(() => "");
    if (text.trim()) return text.replace(/\s+/g, " ").substring(0, 200);
  }
  return "(empty)";
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx     = await browser.newContext({ storageState: authFile });
  const page    = await ctx.newPage();

  const consoleErrors: string[] = [];
  page.on("console", m => { if (m.type() === "error") consoleErrors.push(m.text()); });

  // ── Step 1: /exec を開く ──────────────────────────────────────────
  console.log("\n─── Step 1: /exec を開く ───");
  await page.goto(EXEC_URL, { waitUntil: "domcontentloaded", timeout: TIMEOUT });
  const url1 = page.url();
  const title1 = await page.title().catch(() => "");
  const content1 = await getFrameContent(page);
  console.log(`URL: ${url1.substring(0, 80)}`);
  console.log(`Title: ${title1}`);
  console.log(`Content: ${content1}`);

  if (url1.includes("accounts.google.com")) {
    console.error("❌ 認証リダイレクト。save-auth を再実行してください。");
    await browser.close(); process.exit(1);
  }

  // ── Step 2: 「患者検索」カードをクリック ──────────────────────────
  console.log("\n─── Step 2: 「患者検索」カードをクリック ───");
  const innerFrame = page.frameLocator("iframe").first().frameLocator("iframe").first();

  // 「患者検索」リンクの href を取得してログ
  const searchLink = innerFrame.locator("a").filter({ hasText: "患者検索" }).first();
  const searchHref = await searchLink.getAttribute("href", { timeout: TIMEOUT }).catch(() => "");
  console.log(`患者検索リンク href: ${searchHref}`);

  await searchLink.click({ timeout: TIMEOUT });
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2000);

  const url2   = page.url();
  const title2 = await page.title().catch(() => "");
  const content2 = await getFrameContent(page);
  const frames2 = page.frames();
  console.log(`URL: ${url2.substring(0, 80)}`);
  console.log(`Title: ${title2}`);
  console.log(`Frames: ${frames2.length}`);
  console.log(`Content: ${content2}`);

  // ── Step 3: 「← Web ホームへ」リンクをクリック ──────────────────
  console.log("\n─── Step 3: 「← Web ホームへ」をクリック ───");
  const innerFrame2 = page.frameLocator("iframe").first().frameLocator("iframe").first();
  const homeLink = innerFrame2.locator("a").filter({ hasText: "Web ホームへ" }).first();
  const homeHref = await homeLink.getAttribute("href", { timeout: TIMEOUT }).catch(() => "not found");
  const homeTarget = await homeLink.getAttribute("target", { timeout: TIMEOUT }).catch(() => "(なし)");
  console.log(`「Web ホームへ」リンク href: ${homeHref}`);
  console.log(`「Web ホームへ」リンク target: ${homeTarget}`);

  await homeLink.click({ timeout: TIMEOUT });
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(2000);

  const url3    = page.url();
  const title3  = await page.title().catch(() => "");
  const frames3 = page.frames();
  const content3 = await getFrameContent(page);
  console.log(`URL: ${url3.substring(0, 80)}`);
  console.log(`Title: ${title3}`);
  console.log(`Frames after back: ${frames3.length}`);
  console.log(`Content: ${content3}`);

  // ── 判定 ─────────────────────────────────────────────────────────
  console.log("\n─── 診断結果 ───");
  const isWhiteScreen = content3.trim().length === 0 || content3.includes("(empty)");
  const isHomeShown   = content3.includes("JREC-01") || title3.includes("JREC-01");
  console.log(`白画面: ${isWhiteScreen ? "❌ YES（再現）" : "✅ NO"}`);
  console.log(`ホーム表示: ${isHomeShown ? "✅ YES" : "❌ NO（ホームが表示されていない）"}`);
  if (consoleErrors.length) console.log(`Console errors: ${consoleErrors.slice(0, 5).join("; ")}`);

  await browser.close();
})().catch(e => { console.error("Fatal:", e.message); process.exit(1); });
