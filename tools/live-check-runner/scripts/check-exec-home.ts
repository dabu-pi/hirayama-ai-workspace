/**
 * check-exec-home.ts
 * /exec の本番 URL が page=home を表示するか確認する。
 * clasp deploy -i 後の反映確認用。
 *
 * 実行: npx tsx scripts/check-exec-home.ts
 */
import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";

const EXEC_URL = "https://script.google.com/macros/s/AKfycbxODNWJNcCJVQnDXHzzWck237hnUIIXR_Ilt8SS5P5zodfF2dnmKeqso8BL8hcinVEBrQ/exec";
const authFile = path.join(__dirname, "../auth.json");
const TIMEOUT  = 30_000;

type CheckResult = { label: string; url: string; result: string; ok: boolean };

async function check(label: string, url: string, expectText: string): Promise<CheckResult> {
  const browser = await chromium.launch({ headless: true });
  const ctx     = await browser.newContext({ storageState: authFile });
  const page    = await ctx.newPage();

  const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: TIMEOUT }).catch(() => null);
  const finalUrl = page.url();

  if (finalUrl.includes("accounts.google.com")) {
    await browser.close();
    return { label, url, result: "AUTH_REDIRECT", ok: false };
  }

  // GAS 2段 iframe の内側フレームからテキストを取得
  const frame = page.frameLocator("iframe").first().frameLocator("iframe").first();
  const found = await frame.getByText(expectText, { exact: false })
    .waitFor({ state: "visible", timeout: TIMEOUT })
    .then(() => true)
    .catch(() => false);

  let detail = "";
  if (found) {
    detail = `✅  "${expectText}" を確認`;
  } else {
    // 実際に何が表示されているか確認
    const bodyText = await frame.locator("body").innerText({ timeout: 5000 }).catch(() => "");
    detail = `❌  "${expectText}" が見つからない (body: ${bodyText.replace(/\n/g, " ").substring(0, 80)})`;
  }

  await browser.close();
  return { label, url, result: detail, ok: found };
}

(async () => {
  console.log("═══ /exec 本番 URL 動作確認 ═══\n");

  const results: CheckResult[] = [];

  // /exec → page=home（JREC-01 が表示されること）
  results.push(await check("/exec (デフォルト → home)", EXEC_URL, "JREC-01"));

  // /exec?page=home → home
  results.push(await check("/exec?page=home", `${EXEC_URL}?page=home`, "JREC-01"));

  // /exec?page=search → 患者検索
  results.push(await check("/exec?page=search", `${EXEC_URL}?page=search`, "患者検索"));

  // /exec?page=visitNew → 来院記録
  results.push(await check("/exec?page=visitNew", `${EXEC_URL}?page=visitNew`, "来院記録"));

  console.log("│ URL                          │ 結果");
  console.log("├──────────────────────────────┤");
  for (const r of results) {
    console.log(`│ ${r.label.padEnd(28)} │ ${r.result}`);
  }
  console.log("└──────────────────────────────┘");

  const allOk = results.every(r => r.ok);
  console.log(`\n総合判定: ${allOk ? "✅ ALL PASS" : "❌ FAIL あり"}`);
  if (!allOk) process.exit(1);
})().catch(e => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
