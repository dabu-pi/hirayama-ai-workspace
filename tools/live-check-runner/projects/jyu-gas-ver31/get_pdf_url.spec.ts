/**
 * get_pdf_url.spec.ts — 修正後 PDF の Drive URL を取得する
 * 実行コマンド: npm run test:jyu:getpdfurl
 */
import { test, expect, Page } from "@playwright/test";
import fs from "fs";
import path from "path";
import config from "./config.json";

const DEV_URL      = config.devUrl;
const AUTH_FILE    = path.join(__dirname, "../../auth.json");
const HAS_AUTH     = fs.existsSync(AUTH_FILE);
const LOAD_TIMEOUT = 90_000;

function gasAppFrame(page: Page) {
  return page.frameLocator("iframe").first().frameLocator("iframe").first();
}

async function handleAuthRedirect(page: Page) {
  const url   = page.url();
  const title = await page.title().catch(() => "");
  if (url.includes("accounts.google.com") || title.includes("Sign in") || title.includes("Google Drive: Sign-in")) {
    test.skip(true, "auth 期限切れ。npm run save-auth を実行してください。");
  }
}

test.describe(`PDF Drive URL 取得 [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test("修正後 PDF の Drive URL を取得する (hirayamaka / 2026-04)", async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);

    await page.goto(
      `${DEV_URL}?page=monthlyClaimDetail&patientId=${config.testData.patientId}&ym=2026-04`,
      { waitUntil: "domcontentloaded" }
    );
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    // ページ読み込み待機
    await frame.locator("body").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    await frame.locator("#pdf-btn").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });

    page.on("dialog", async d => await d.accept());
    await frame.locator("#pdf-btn").click();

    await frame.locator("#pdf-result").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });

    // href 属性から Drive URL を取得
    const pdfLink = frame.locator("#pdf-result a.pdf-link");
    const href = await pdfLink.getAttribute("href", { timeout: 30000 }).catch(() => "");
    const resultText = await frame.locator("#pdf-result").innerText({ timeout: 5000 }).catch(() => "");

    console.log(`\n[PDF URL] result: ${resultText.substring(0, 500)}`);
    console.log(`[PDF URL] href: ${href}`);

    if (href) {
      console.log(`\n=== Drive URL ===\n${href}\n=================`);
    }

    expect(resultText).toContain("✅");
    expect(href).toBeTruthy();
  });
});
