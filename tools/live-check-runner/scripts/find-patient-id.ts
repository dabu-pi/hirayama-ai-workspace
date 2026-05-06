/**
 * find-patient-id.ts
 * JYU-GAS 患者マスタから検証用患者IDを安全に取得する。
 *
 * 出力: 患者IDのみ（氏名・生年月日等の個人情報は一切ログしない）
 * 用途: config.json の testData.patientId 設定用
 *
 * 実行: npx tsx scripts/find-patient-id.ts
 */
import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";

const DEV_URL  = "https://script.google.com/macros/s/AKfycbzj47fbRvTlVixUrUiV_25xkevfyI_HXhFaBKYodB2B/dev";
const authFile = path.join(__dirname, "../auth.json");
const TIMEOUT  = 30_000;

// 試みるキーワード一覧（一般的な文字列から始める）
const SEARCH_KEYWORDS = ["P0", "P", "0", "1", "2", "3"];

(async () => {
  if (!fs.existsSync(authFile)) {
    console.error("auth.json が見つかりません。npm run save-auth を実行してください。");
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const ctx     = await browser.newContext({ storageState: authFile });
  const page    = await ctx.newPage();

  await page.goto(`${DEV_URL}?page=search`, { waitUntil: "domcontentloaded", timeout: TIMEOUT });

  // 認証チェック
  const url   = page.url();
  const title = await page.title().catch(() => "");
  if (url.includes("accounts.google.com") || title.includes("Sign-in")) {
    console.error("Google 認証が必要です。auth が期限切れの可能性があります。");
    await browser.close();
    process.exit(1);
  }

  const frame = page.frameLocator("iframe").first().frameLocator("iframe").first();

  // #keyword 入力欄が表示されるまで待機
  await frame.locator("#keyword").waitFor({ state: "visible", timeout: TIMEOUT });

  let foundId: string | null = null;

  for (const kw of SEARCH_KEYWORDS) {
    // キーワードを入力して検索
    await frame.locator("#keyword").clear();
    await frame.locator("#keyword").fill(kw);
    await frame.locator("#searchBtn").click();

    // 結果待機（最大10秒）
    const hasResult = await frame.locator("#resultList .card").first()
      .waitFor({ state: "visible", timeout: 10_000 })
      .then(() => true)
      .catch(() => false);

    if (!hasResult) {
      console.log(`keyword="${kw}" → 結果なし`);
      continue;
    }

    // card-sub の最初の span に患者IDが入っている
    // 出力: 患者IDのみ（氏名等は取得しない）
    const firstCardSub = await frame.locator("#resultList .card .card-sub span").first()
      .innerText({ timeout: 5000 })
      .catch(() => "");

    // card-sub は "患者ID　フリガナ　生年月日" の形式
    // 最初のトークン（スペース/全角スペース区切り前）が患者ID
    const candidateId = firstCardSub.split(/[\s　]+/)[0].trim();

    if (candidateId) {
      foundId = candidateId;
      console.log(`keyword="${kw}" → 患者ID候補: "${candidateId}" (${await frame.locator("#resultList .card").count()} 件ヒット)`);
      break;
    }
  }

  await browser.close();

  if (foundId) {
    console.log(`\n✅ 検証用患者ID: "${foundId}"`);
    console.log(`   config.json の testData.patientId に設定してください。`);
    // 標準出力に ID のみを最終行として出力（スクリプト呼び出し元がパース可能）
    process.stdout.write(`FOUND:${foundId}\n`);
  } else {
    console.log(`\n❌ 患者IDが見つかりませんでした。`);
    console.log(`   スプレッドシートに患者データが存在するか確認してください。`);
    process.stdout.write(`FOUND:\n`);
  }
})().catch(e => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
