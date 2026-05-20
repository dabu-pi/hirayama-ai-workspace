/**
 * portal18b-v2-flag-driver.ts
 * Portal-18-B v2 feature flag driver:
 *   - check  : 現在 flag 状態を JSON で出力
 *   - enable : flag ON にする
 *   - disable: flag OFF にする
 *   - fetch  : fetchChronicPainKpi action を叩き、レスポンス source 文字列を表示（serial / v2 parallel 判別用）
 *
 * 使い方:
 *   npx tsx scripts/portal18b-v2-flag-driver.ts check
 *   npx tsx scripts/portal18b-v2-flag-driver.ts enable
 *   npx tsx scripts/portal18b-v2-flag-driver.ts disable
 *   npx tsx scripts/portal18b-v2-flag-driver.ts fetch
 *
 * 要 auth.json（Google ログイン storageState）。
 */

import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";

const ROOT      = path.join(__dirname, "..");
const AUTH_FILE = path.join(ROOT, "auth.json");
const BASE = "https://script.google.com/macros/s/AKfycbw20tWvhR5nnRzCiUAMybtfrebRg-BK-EgDamvZYt-clSwf4TK9FGTKNZRmsO3wj7QSiQ/exec";

const ACTION_MAP: Record<string, string> = {
  check:   `${BASE}?action=portal18BV2ParallelStatus`,
  enable:  `${BASE}?action=enablePortal18BV2Parallel`,
  disable: `${BASE}?action=disablePortal18BV2Parallel`,
  fetch:   `${BASE}?action=fetchChronicPainKpi`,
};

async function main() {
  const cmd = (process.argv[2] || "check").toLowerCase();
  const url = ACTION_MAP[cmd];
  if (!url) {
    console.error(`Unknown command: ${cmd}. Use one of: ${Object.keys(ACTION_MAP).join(", ")}`);
    process.exit(2);
  }
  if (!fs.existsSync(AUTH_FILE)) {
    console.error(`auth.json not found at ${AUTH_FILE}. Run npm run save-auth first.`);
    process.exit(3);
  }

  const t0 = Date.now();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ storageState: AUTH_FILE });
  const page = await ctx.newPage();
  const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const status = resp?.status();
  // GAS WebApp JSON は <pre> 内に raw text として配置される（ContentService.MimeType.JSON）
  // ただし Google Apps Script は MIME を HTML として返すケースもあるので <pre> 探索 → 失敗時は body text fall back
  let body = await page.locator("pre").first().textContent().catch(() => null);
  if (!body) {
    body = await page.locator("body").innerText().catch(() => "");
  }
  await browser.close();

  const ms = Date.now() - t0;
  console.log(`[portal18b-v2-flag-driver] cmd=${cmd} status=${status} ms=${ms} url=${url}`);
  console.log("---");
  console.log((body || "").substring(0, 1500));
}

main().catch(e => {
  console.error("[portal18b-v2-flag-driver] error:", (e && e.message) ? e.message : e);
  process.exit(1);
});
