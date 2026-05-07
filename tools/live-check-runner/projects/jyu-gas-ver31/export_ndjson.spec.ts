/**
 * export_ndjson.spec.ts — NDJSON を Drive に出力して URL を取得
 * 実行コマンド: npm run test:jyu:exportndjson
 */
import { test, expect, Page } from "@playwright/test";
import fs from "fs";
import path from "path";
import config from "./config.json";

const DEV_URL      = config.devUrl;
const AUTH_FILE    = path.join(__dirname, "../../auth.json");
const HAS_AUTH     = fs.existsSync(AUTH_FILE);
const LOAD_TIMEOUT = 90_000;
const PATIENT_ID   = config.testData.patientId;
const YM           = "2026-04";

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

test.describe(`NDJSON Drive 出力 [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test(`exportClaimNdjson_V3 — hirayamaka / ${YM}`, async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(
      `${DEV_URL}?page=monthlyClaimDetail&patientId=${PATIENT_ID}&ym=${YM}`,
      { waitUntil: "domcontentloaded" }
    );
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await frame.locator("body").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    await frame.locator("#ndjson-btn").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });

    // NDJSON 出力ボタンをクリック
    await frame.locator("#ndjson-btn").click();

    // 結果が出るまで待機
    await frame.locator("#ndjson-result").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });

    const resultText = await frame.locator("#ndjson-result").innerText({ timeout: 10000 }).catch(() => "");
    console.log(`\n[NDJSON] 結果:\n${resultText.substring(0, 600)}`);

    // Drive リンクの href を取得
    const linkEl = frame.locator("#ndjson-result a");
    const href = await linkEl.getAttribute("href", { timeout: 10000 }).catch(() => "");
    console.log(`\n[NDJSON] Drive URL: ${href}`);

    // ファイル名を取得
    const fileName = resultText.match(/ファイル名: (申請書_転記データ_[^\n]+)/)?.[1]?.trim() || "";
    console.log(`[NDJSON] ファイル名: ${fileName}`);

    expect(resultText).toContain("✅");
    expect(href).toBeTruthy();

    if (href) {
      console.log(`\n=== Drive URL ===\n${href}\n================`);
    }
    if (fileName) {
      console.log(`=== ファイル名 ===\n${fileName}\n================`);
    }
  });
});
