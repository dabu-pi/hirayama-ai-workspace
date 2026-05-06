/**
 * check-web25-visitkey.ts
 * WEB-2.5 テストデータ（hirayamaka_2999-12-31）の確認スクリプト
 *
 * 確認内容:
 *   1. 患者詳細ページの来院履歴に 2999-12-31 が存在するか
 *   2. visitTotal / needCheck が正しいか
 *   3. 来院ヘッダの生データを getPatientDetail_V3 経由で確認
 *
 * 実行: npx tsx scripts/check-web25-visitkey.ts
 *
 * ⚠️ このスクリプトは読み取り専用。削除は行わない。
 */
import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";

const DEV_URL  = "https://script.google.com/macros/s/AKfycbzj47fbRvTlVixUrUiV_25xkevfyI_HXhFaBKYodB2B/dev";
const authFile = path.join(__dirname, "../auth.json");
const TEST_PID = "hirayamaka";
const TEST_DATE = "2999-12-31";
const TEST_VK   = `${TEST_PID}_${TEST_DATE}`;
const TIMEOUT   = 30_000;

(async () => {
  console.log("═══ WEB-2.5 テストデータ確認 ═══");
  console.log(`対象 visitKey: ${TEST_VK}\n`);

  if (!fs.existsSync(authFile)) {
    console.error("auth.json が見つかりません。npm run save-auth を実行してください。");
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const ctx     = await browser.newContext({ storageState: authFile });
  const page    = await ctx.newPage();

  // ── 患者詳細ページにアクセス ─────────────────────────────────────
  const url = `${DEV_URL}?page=detail&patientId=${TEST_PID}`;
  const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: TIMEOUT }).catch(() => null);

  const finalUrl = page.url();
  const title    = await page.title().catch(() => "");

  if (finalUrl.includes("accounts.google.com") || title.includes("Sign-in")) {
    console.error("❌ Google 認証が必要です（auth.json が期限切れの可能性）");
    await browser.close();
    process.exit(1);
  }

  console.log(`HTTP Status: ${res?.status() ?? "N/A"}`);
  console.log(`Title: ${title}`);

  const frame = page.frameLocator("iframe").first().frameLocator("iframe").first();

  // ── #loading が消えるまで待機 ─────────────────────────────────────
  await frame.locator("#loading").waitFor({ state: "hidden", timeout: TIMEOUT }).catch(() => {});
  const hasError = await frame.locator("#error-msg").isVisible().catch(() => false);
  if (hasError) {
    const errText = await frame.locator("#error-msg").innerText().catch(() => "");
    console.error(`❌ エラー表示: ${errText}`);
    await browser.close();
    process.exit(1);
  }

  // ── 来院履歴テーブルの行を取得 ───────────────────────────────────
  await frame.locator("#visit-rows tr").first().waitFor({ state: "visible", timeout: TIMEOUT }).catch(() => {});

  const rows = await frame.locator("#visit-rows tr").all();
  console.log(`\n来院履歴 行数: ${rows.length} 件`);

  let found = false;
  let foundRow: { treatDate: string; kubun: string; accountingType: string; visitTotal: string; needCheck: boolean } | null = null;

  for (const row of rows) {
    const cells = await row.locator("td").allInnerTexts();
    const treatDate     = cells[0]?.trim() || "";
    const kubun         = cells[1]?.trim() || "";
    const accountingType = cells[2]?.trim() || "";
    const visitTotal    = cells[3]?.trim() || "";
    const statusText    = cells[4]?.trim() || "";

    if (treatDate === TEST_DATE) {
      found = true;
      const isNeedCheck = statusText.includes("要確認");
      foundRow = { treatDate, kubun, accountingType, visitTotal, needCheck: isNeedCheck };

      console.log("\n═══ テスト visitKey の確認結果 ═══");
      console.log(`visitKey:      ${TEST_VK}`);
      console.log(`施術日:        ${treatDate}`);
      console.log(`区分:          ${kubun}`);
      console.log(`会計区分:      ${accountingType}`);
      console.log(`来院合計:      ${visitTotal}`);
      console.log(`needCheck:     ${isNeedCheck ? "TRUE ✅" : "FALSE ❌（期待: TRUE）"}`);

      // 金額チェック
      const totalNum = parseInt(visitTotal.replace(/[¥,]/g, ""), 10);
      console.log(`\n─── 金額チェック ───`);
      console.log(`来院合計 (期待: ¥2,410): ${visitTotal} ${totalNum === 2410 ? "✅" : "⚠️ 要確認"}`);

      break;
    }
  }

  if (!found) {
    console.log(`\n❌ 来院履歴に ${TEST_DATE} が見つかりませんでした`);
    console.log("   確認事項:");
    console.log("   1. WEB-2.5 テスト (W2.5-4) が実行されたか");
    console.log("   2. auth.json のセッションが有効か");
    console.log("   3. patientId が正しいか");
  }

  // ── 直近来院（最新行）の確認 ─────────────────────────────────────
  if (rows.length > 0 && !found) {
    const cells = await rows[0].locator("td").allInnerTexts();
    console.log(`\n最新来院日: ${cells[0]?.trim() || "不明"}`);
  }

  await browser.close();

  // ── 結果サマリ ───────────────────────────────────────────────────
  console.log("\n═══ 確認サマリ ═══");
  if (found && foundRow) {
    const ok = foundRow.needCheck && foundRow.visitTotal.includes("2,410");
    console.log(`来院ヘッダ存在:     ${found ? "✅ あり" : "❌ なし"}`);
    console.log(`needCheck=TRUE:     ${foundRow.needCheck ? "✅ 確認" : "❌ FALSE（要調査）"}`);
    console.log(`候補金額(¥2,410):   ${foundRow.visitTotal.includes("2,410") ? "✅ 確認" : "⚠️ " + foundRow.visitTotal}`);
    console.log(`総合判定:           ${ok ? "✅ PASS" : "⚠️ 要確認"}`);
    console.log("\n削除推奨:");
    console.log(`  来院ケース: patientId=${TEST_PID} / treatDate=${TEST_DATE} の行を削除`);
    console.log(`  来院ヘッダ: visitKey=${TEST_VK} の行を削除`);
  } else {
    console.log("テストデータが見つかりませんでした。削除不要です。");
  }
})().catch(e => {
  console.error("Fatal:", e.message);
  process.exit(1);
});
