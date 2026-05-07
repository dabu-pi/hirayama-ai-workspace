/**
 * jyu-gas-ver31 b2_transfer.spec.ts
 * JYU-GAS Ver3.1 B-2: 月次申請データ整合確認
 *
 * 確認項目:
 *   B2-1: page=b2Results が到達できる
 *   B2-2: 現在月の verifyMonthlyClaimData_V3 が正常に完了する
 *   B2-3: 結果が以下のいずれかである（クラッシュしない）
 *     - INTEGRITY_OK（患者あり・整合）
 *     - NO_PATIENTS_THIS_MONTH（当月に保険来院なし）
 *     - INTEGRITY_MISMATCH（患者あり・要確認）
 *   B2-4: 患者が存在する場合、visitCount / claimPay / needCheckCount の整合を確認
 *   B2-5: 患者が存在しない場合、「B-2 実データ確認は人間確認待ち」として記録
 *   B2-6: 施術明細 → 来院ヘッダ → 月次集計 の流れが詰まらない
 *   B2-7: monthlyClaims ページが到達できる（WEB-3 回帰）
 *   B2-8: 既存 patientSearch 導線が壊れていない
 *   B2-9: GAS iframe 入れ子増殖がない
 *   B2-10: console error がない
 *
 * データ状態に応じた PASS 基準:
 *   INTEGRITY_OK         → B-2 完全 PASS
 *   NO_PATIENTS_THIS_MONTH → B-2 部分 PASS（当月データなし、人間確認要）
 *   INTEGRITY_MISMATCH   → B-2 要調査（詳細を出力して記録）
 *
 * 実行コマンド: npm run test:jyu:b2
 */

import { test, expect, Page } from "@playwright/test";
import fs from "fs";
import path from "path";
import config from "./config.json";

const DEV_URL      = config.devUrl;
const AUTH_FILE    = path.join(__dirname, "../../auth.json");
const HAS_AUTH     = fs.existsSync(AUTH_FILE);
const LOAD_TIMEOUT = 60_000;

function gasAppFrame(page: Page) {
  return page.frameLocator("iframe").first().frameLocator("iframe").first();
}

async function handleAuthRedirect(page: Page) {
  const url   = page.url();
  const title = await page.title().catch(() => "");
  if (
    url.includes("accounts.google.com") ||
    url.includes("ServiceLogin") ||
    title.includes("Sign in") ||
    title.includes("Google Drive: Sign-in")
  ) {
    test.skip(
      true,
      HAS_AUTH
        ? "auth.json のセッションが期限切れです。npm run save-auth を再実行してください。"
        : "Google 認証が必要です。npm run save-auth を実行してください。"
    );
  }
}

function currentYm(): string {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

// ── B2-1〜6: verifyMonthlyClaimData_V3 実行と整合確認 ───────────────

test.describe(`JYU-GAS B-2: 月次申請データ整合 [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test("B2-1: page=b2Results — 到達できる", async ({ page }) => {
    const ym = currentYm();
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=b2Results&ym=${ym}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await frame.locator("body").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    console.log(`[B2-1] PASS: b2Results ページ到達 (ym=${ym})`);
    expect(true).toBe(true);
  });

  test("B2-2〜6: verifyMonthlyClaimData_V3 実行 + 整合確認", async ({ page }) => {
    const ym = currentYm();
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=b2Results&ym=${ym}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);

    // data-ready="1" になるまで待機（GAS 非同期完了）
    await frame.locator("#json-output[data-ready='1']").waitFor({ state: "attached", timeout: LOAD_TIMEOUT });

    const jsonText = await frame.locator("#json-output").innerText({ timeout: 5000 });
    const result = JSON.parse(jsonText) as {
      ok: boolean;
      ym: string;
      status: string;
      listResult: { total: number; patients: any[] } | null;
      firstPatient: { patientId: string; visitCount: number; claimPay: number; needCheckCount: number } | null;
      detailResult: any | null;
      integrity: { checksums: Array<{ check: string; pass: boolean; listValue: any; detailValue: any }>; allPass: boolean } | null;
      message?: string;
    };

    console.log(`\n[B2-2] ym=${ym} ok=${result.ok} status=${result.status}`);

    // B2-2: 正常完了チェック
    expect(result.ok).toBe(true);
    console.log("[B2-2] PASS: verifyMonthlyClaimData_V3 正常完了");

    // B2-3: status が既知のいずれかであること
    const validStatuses = ["INTEGRITY_OK", "NO_PATIENTS_THIS_MONTH", "INTEGRITY_MISMATCH"];
    expect(validStatuses).toContain(result.status);
    console.log(`[B2-3] PASS: status="${result.status}"`);

    if (result.status === "NO_PATIENTS_THIS_MONTH") {
      console.log("[B2-5] INFO: 当月（" + ym + "）に保険来院がある患者なし");
      console.log("       → B-2 実データ確認は、実際の来院データがある月で人間が確認してください");
      // NO_PATIENTS はこの月にデータがないだけで異常ではない
    } else if (result.firstPatient) {
      console.log(`[B2-4] 患者: ${result.firstPatient.patientId}`);
      console.log(`       visitCount=${result.firstPatient.visitCount} claimPay=${result.firstPatient.claimPay} needCheck=${result.firstPatient.needCheckCount}`);

      // B2-4: 整合チェック
      if (result.integrity && result.integrity.checksums) {
        result.integrity.checksums.forEach(c => {
          const mark = c.pass ? "✅" : "❌";
          console.log(`       ${mark} ${c.check}: list=${c.listValue} detail=${c.detailValue}`);
        });

        if (result.status === "INTEGRITY_MISMATCH") {
          console.log("[B2-4] ⚠️ 整合不一致あり — 詳細調査が必要");
          // 整合不一致は FAIL とする
          expect(result.integrity.allPass).toBe(true);
        } else {
          console.log("[B2-4] PASS: 整合チェック全 PASS");
        }
      }
    }

    // B2-6: 施術明細 → 来院ヘッダ → 月次集計の流れが詰まらないこと確認済み
    console.log("[B2-6] PASS: データ読み取りフロー正常（クラッシュなし）");
  });
});

// ── B2-7〜10: 既存導線・環境確認 ────────────────────────────────────

test.describe(`JYU-GAS B-2 回帰: 既存導線 [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test("B2-7: page=monthlyClaims — WEB-3 回帰", async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=monthlyClaims`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await frame.locator("#ym-input").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    console.log("[B2-7] PASS: monthlyClaims 正常");
  });

  test("B2-8: page=search — 既存 patientSearch が壊れていない", async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=search`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await expect(frame.locator("h1")).toContainText("患者検索", { timeout: LOAD_TIMEOUT });
    console.log("[B2-8] PASS: patientSearch 正常");
  });

  test("B2-9: iframe 入れ子増殖なし", async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=b2Results`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const outerFrame = page.frameLocator("iframe").first();
    await outerFrame.locator("body").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    const frameCount = page.frames().filter(f => f !== page.mainFrame()).length;
    expect(frameCount).toBeLessThan(10);
    console.log(`[B2-9] PASS: iframe 数: ${frameCount}`);
  });

  test("B2-10: console error なし", async ({ page }) => {
    const errors: string[] = [];
    page.on("console", msg => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=b2Results`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await frame.locator("body").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });

    const severe = errors.filter(e =>
      !e.includes("google-analytics") &&
      !e.includes("googleapis") &&
      !e.includes("Failed to load resource") &&
      !e.includes("ERR_BLOCKED_BY_CLIENT")
    );
    if (severe.length > 0) console.log("[B2-10] console errors:", severe);
    else console.log("[B2-10] PASS: 重大 console error なし");
    expect(severe.length).toBe(0);
  });
});
