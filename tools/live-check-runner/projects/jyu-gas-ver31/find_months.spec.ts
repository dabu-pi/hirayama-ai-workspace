/**
 * find_months.spec.ts — 実来院月スキャン（B-2 実データ確認準備）
 * 直近12か月で保険来院がある月を検索して結果を出力する。
 * 実行コマンド: npm run test:jyu:findmonths
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
  if (url.includes("accounts.google.com") || title.includes("Sign in")) {
    test.skip(true, "auth 期限切れ");
  }
}

test.describe(`実来院月スキャン [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test("findRecentMonthsWithClaims_V3 — 直近12か月の保険来院月を列挙", async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=findMonths&lookback=12`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await frame.locator("#json-output[data-ready='1']").waitFor({ state: "attached", timeout: LOAD_TIMEOUT });

    const jsonText = await frame.locator("#json-output").innerText({ timeout: 5000 });
    const result = JSON.parse(jsonText) as {
      ok: boolean;
      months: Array<{ ym: string; patientCount: number }>;
      message?: string;
    };

    console.log(`\n[月スキャン] ok=${result.ok} 件数=${(result.months || []).length}`);
    if (result.months && result.months.length > 0) {
      result.months.forEach(m => {
        console.log(`  FOUND: ${m.ym} — ${m.patientCount} 患者`);
      });
    } else {
      console.log("  直近12か月に保険来院がある月なし");
    }

    expect(result.ok).toBe(true);
    // 月の有無に関わらず PASS（情報収集目的）
  });
});
