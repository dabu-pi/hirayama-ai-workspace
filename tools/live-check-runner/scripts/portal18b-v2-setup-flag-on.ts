/**
 * portal18b-v2-setup-flag-on.ts
 * setupPortal18BV2FlagOn action を叩いて Task_Queue + Run_Log を反映する一回限りの driver。
 *
 * 用途: Portal-18-B v2 本番 flag ON 運用判断の Sheet 反映を確実に 1 度だけ実行する。
 * 関数自体は idempotent（task_id / 対象 で重複検出）なので複数回叩いても安全。
 *
 * 使い方: npx tsx scripts/portal18b-v2-setup-flag-on.ts
 */

import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";

const ROOT      = path.join(__dirname, "..");
const AUTH_FILE = path.join(ROOT, "auth.json");
const URL = "https://script.google.com/macros/s/AKfycbw20tWvhR5nnRzCiUAMybtfrebRg-BK-EgDamvZYt-clSwf4TK9FGTKNZRmsO3wj7QSiQ/exec?action=setupPortal18BV2FlagOn";

async function main() {
  if (!fs.existsSync(AUTH_FILE)) {
    console.error(`auth.json not found at ${AUTH_FILE}. Run npm run save-auth first.`);
    process.exit(3);
  }
  const t0 = Date.now();
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ storageState: AUTH_FILE });
  const page = await ctx.newPage();
  const resp = await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const status = resp?.status();
  const body = await page.locator("body").innerText().catch(() => "");
  await browser.close();
  console.log(`[setup-flag-on] status=${status} ms=${Date.now() - t0} url=${URL}`);
  console.log("---");
  console.log((body || "").substring(0, 3000));
}

main().catch(e => {
  console.error("[setup-flag-on] error:", (e && e.message) ? e.message : e);
  process.exit(1);
});
