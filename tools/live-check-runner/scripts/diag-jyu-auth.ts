/**
 * diag-jyu-auth.ts
 * JYU-GAS auth 状態診断
 * authuser パラメータで Account Chooser をバイパス試行
 */
import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";

const EXEC_URL = "https://script.google.com/macros/s/AKfycbxODNWJNcCJVQnDXHzzWck237hnUIIXR_Ilt8SS5P5zodfF2dnmKeqso8BL8hcinVEBrQ/exec";
const DEV_URL  = "https://script.google.com/macros/s/AKfycbzj47fbRvTlVixUrUiV_25xkevfyI_HXhFaBKYodB2B/dev";
const authFile = path.join(__dirname, "../auth.json");
const TIMEOUT  = 20_000;

async function probe(label: string, url: string, stealth = false) {
  const launchOpts: Parameters<typeof chromium.launch>[0] = { headless: true };
  if (stealth) {
    launchOpts.args = [
      "--disable-blink-features=AutomationControlled",
      "--disable-features=IsolateOrigins,site-per-process",
    ];
  }
  const browser = await chromium.launch(launchOpts);
  const ctx     = await browser.newContext({ storageState: authFile });
  const page    = await ctx.newPage();

  const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: TIMEOUT })
    .catch(() => null);

  const finalUrl = page.url();
  const title    = await page.title().catch(() => "");
  const frames   = page.frames();
  const status   = res?.status() ?? "N/A";

  // Account Chooser か GAS か判定
  const isChooser  = finalUrl.includes("accountchooser") || title.includes("Sign-in");
  const isGAS      = finalUrl.includes("script.google.com") || frames.length >= 3;
  const isRejected = finalUrl.includes("rejected");
  const isLogin    = finalUrl.includes("accounts.google.com") && !isChooser;

  let resultIcon = "❓";
  if (isGAS && !isChooser) resultIcon = "✅ GAS到達";
  else if (isChooser)       resultIcon = "⚠️  Account Chooser";
  else if (isRejected)      resultIcon = "❌ Rejected";
  else if (isLogin)         resultIcon = "❌ Login required";

  console.log(`\n${resultIcon}  [${label}]`);
  console.log(`  URL(final): ${finalUrl.substring(0, 100)}`);
  console.log(`  Title: ${title}`);
  console.log(`  Status: ${status} | Frames: ${frames.length}`);

  // GAS に到達した場合: inner frame のテキストを確認
  if (isGAS && !isChooser && frames.length >= 3) {
    const inner = page.frameLocator("iframe").first().frameLocator("iframe").first();
    const h1    = await inner.locator("h1").first().innerText({ timeout: 10000 }).catch(() => "");
    if (h1) console.log(`  Inner h1: "${h1}"`);
  }

  await browser.close();
  return { isGAS: isGAS && !isChooser, finalUrl };
}

(async () => {
  console.log("═══ JYU-GAS auth 診断（authuser バリアント）═══\n");

  // 1. dev URL（通常）
  const r0 = await probe("dev (normal)", DEV_URL);

  // 2. exec + stealth（AutomationControlled 無効化）
  const r1 = await probe("exec (stealth)", EXEC_URL, true);

  // 3. dev + stealth
  const r2 = await probe("dev (stealth)", DEV_URL, true);

  // 4. exec + stealth + authuser=0
  const r3 = await probe("exec stealth ?authuser=0", `${EXEC_URL}?authuser=0`, true);

  // 5. exec + stealth + authuser=1
  const r4 = await probe("exec stealth ?authuser=1", `${EXEC_URL}?authuser=1`, true);

  console.log("\n═══ 診断サマリー ═══");
  const results = [
    { label: "dev (normal)",            ...r0 },
    { label: "exec (stealth)",          ...r1 },
    { label: "dev (stealth)",           ...r2 },
    { label: "exec stealth ?authuser=0",...r3 },
    { label: "exec stealth ?authuser=1",...r4 },
  ];
  results.forEach(r => {
    console.log(`  ${r.isGAS ? "✅ PASS" : "❌ FAIL"}  ${r.label}`);
  });
  console.log("\n成功したパターン: ", results.filter(r => r.isGAS).map(r => r.label).join(", ") || "なし");
})().catch(e => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
