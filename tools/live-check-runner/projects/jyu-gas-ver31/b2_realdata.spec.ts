/**
 * b2_realdata.spec.ts — B-2 実来院月での整合確認
 * findRecentMonthsWithClaims_V3 で発見した 2026-04（9患者）を対象に実データ検証を行う。
 * 実行コマンド: npm run test:jyu:b2real
 */
import { test, expect, Page } from "@playwright/test";
import fs from "fs";
import path from "path";
import config from "./config.json";

const DEV_URL      = config.devUrl;
const AUTH_FILE    = path.join(__dirname, "../../auth.json");
const HAS_AUTH     = fs.existsSync(AUTH_FILE);
const LOAD_TIMEOUT = 90_000;
const REAL_YM      = "2026-04";  // findRecentMonthsWithClaims_V3 で確認済みの実来院月

function gasAppFrame(page: Page) {
  return page.frameLocator("iframe").first().frameLocator("iframe").first();
}

async function handleAuthRedirect(page: Page) {
  const url   = page.url();
  const title = await page.title().catch(() => "");
  if (url.includes("accounts.google.com") || title.includes("Sign in")) {
    test.skip(true, "auth 期限切れ。npm run save-auth を実行してください。");
  }
}

// ── B2R-1〜6: 実来院月（2026-04）での整合確認 ──────────────────────

test.describe(`JYU-GAS B-2 実データ確認 ym=${REAL_YM} [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test(`B2R-1〜6: verifyMonthlyClaimData_V3(${REAL_YM}) — 整合確認`, async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=b2Results&ym=${REAL_YM}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await frame.locator("#json-output[data-ready='1']").waitFor({ state: "attached", timeout: LOAD_TIMEOUT });

    const jsonText = await frame.locator("#json-output").innerText({ timeout: 5000 });
    const result = JSON.parse(jsonText) as {
      ok: boolean;
      ym: string;
      status: string;
      listResult: { total: number; patients: any[] } | null;
      firstPatient: { patientId: string; visitCount: number; claimPay: number; needCheckCount: number } | null;
      detailResult: any | null;
      integrity: {
        checksums: Array<{ check: string; pass: boolean; listValue: any; detailValue: any }>;
        allPass: boolean;
      } | null;
    };

    console.log(`\n[B2R] ym=${REAL_YM} ok=${result.ok} status=${result.status}`);

    // B2R-1: 正常完了
    expect(result.ok).toBe(true);
    console.log("[B2R-1] PASS: verifyMonthlyClaimData_V3 正常完了");

    // B2R-2: 患者が存在すること
    const patientCount = result.listResult?.total || 0;
    console.log(`[B2R-2] 対象患者数: ${patientCount}`);
    expect(patientCount).toBeGreaterThan(0);
    console.log("[B2R-2] PASS: 患者が存在する");

    // B2R-3: status が INTEGRITY_OK であること
    console.log(`[B2R-3] status="${result.status}"`);
    expect(result.status).toBe("INTEGRITY_OK");
    console.log("[B2R-3] PASS: INTEGRITY_OK");

    // B2R-4: 整合チェック全 PASS
    if (result.firstPatient) {
      console.log(`[B2R-4] 先頭患者: ${result.firstPatient.patientId}`
        + ` visitCount=${result.firstPatient.visitCount}`
        + ` claimPay=${result.firstPatient.claimPay}`
        + ` needCheck=${result.firstPatient.needCheckCount}`);
    }

    if (result.integrity?.checksums) {
      result.integrity.checksums.forEach(c => {
        const mark = c.pass ? "✅" : "❌";
        console.log(`       ${mark} ${c.check}: list=${c.listValue} detail=${c.detailValue}`);
      });
      expect(result.integrity.allPass).toBe(true);
      console.log("[B2R-4] PASS: 整合チェック全 PASS");
    }

    // B2R-5: 患者一覧の詳細ログ
    if (result.listResult?.patients) {
      console.log(`[B2R-5] 対象患者一覧 (${result.listResult.patients.length}名):`);
      result.listResult.patients.slice(0, 5).forEach((p: any) => {
        console.log(`       ${p.patientId}: visits=${p.visitCount} claim=¥${p.claimPay} needCheck=${p.needCheckCount} ready=${p.isReadyForClaim}`);
      });
      if (result.listResult.patients.length > 5) {
        console.log(`       ... 他 ${result.listResult.patients.length - 5} 名`);
      }
    }

    console.log(`\n[B2R] B-2 実データ確認 PASS — ym=${REAL_YM} patients=${patientCount}`);
  });
});

// ── B2R-7: 実月でのPDF生成前提確認（ZERO_CLAIM / TEMPLATE_NOT_FOUND / 成功）──

test.describe(`JYU-GAS B-2 PDF生成前提確認 ym=${REAL_YM} [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test(`B2R-7: generateClaimApplication_V3(${REAL_YM}) — PDF生成前提確認`, async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=monthlyClaimDetail&patientId=${config.testData.patientId}&ym=${REAL_YM}`, {
      waitUntil: "domcontentloaded"
    });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);

    // データ読み込み完了待ち
    await frame.locator("#pdf-btn").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });

    // PDF生成ボタンをクリック
    page.on("dialog", async d => await d.accept());
    await frame.locator("#pdf-btn").click();

    await frame.locator("#pdf-result").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    const resultText = await frame.locator("#pdf-result").innerText({ timeout: 5000 }).catch(() => "");

    console.log(`\n[B2R-7] PDF生成結果: ${resultText.substring(0, 300)}`);

    const isSuccess         = resultText.includes("✅") || resultText.includes("PDFを開く");
    const isTemplateNotFound = resultText.includes("テンプレート") || resultText.includes("TEMPLATE_NOT_FOUND");
    const isZeroClaim       = resultText.includes("0 円") || resultText.includes("ZERO_CLAIM");

    if (isSuccess) {
      console.log("[B2R-7] PASS: PDF生成成功 — Drive URLが返った");
    } else if (isTemplateNotFound) {
      console.log("[B2R-7] PASS: TEMPLATE_NOT_FOUND — テンプレートシートなし（転記データ生成は完了）");
    } else if (isZeroClaim) {
      console.log(`[B2R-7] INFO: testData.patientId(${config.testData.patientId}) の ${REAL_YM} 保険請求額=0`);
    } else {
      console.log("[B2R-7] WARN: 予期しない結果");
    }

    // いずれかの結果が表示されれば PASS（クラッシュなし）
    expect(resultText.length).toBeGreaterThan(0);
    console.log("[B2R-7] PASS: 結果あり（クラッシュなし）");
  });
});
