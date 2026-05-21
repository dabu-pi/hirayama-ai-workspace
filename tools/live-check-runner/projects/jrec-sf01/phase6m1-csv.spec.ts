/**
 * jrec-sf01 phase6m1-csv.spec.ts
 *
 * Phase 6-M-1: visitDate 軸 CSV 出力の実装整合性検証。
 *
 * テスト方針:
 *   - DOC / SRC 系（CSV 関数 / action / HTML ボタンの presence）は auth 不要・常時 PASS
 *   - LIVE 系（実際の CSV エンドポイント fetch）は auth.json 必須
 *     auth.json なし or 期限切れ → SKIP
 *
 * 検証観点:
 *   - 6-M-1 設計 docs が存在する
 *   - GAS 側に 4 つの buildXxxCsv_ 関数が定義されている
 *   - GAS 側に 4 つの exportXxxCsv action 分岐が定義されている
 *   - 4 つの HTML に CSV ダウンロードリンクが追加されている
 *   - LIVE: dev URL から CSV を fetch し、BOM / CRLF / ヘッダー行を含む
 *
 * 実行: npm run test:jrec:phase6m1
 */

import { test, expect, request as pwRequest } from "@playwright/test";
import fs from "fs";
import path from "path";
import config from "./config.json";

const DEV_URL   = (config as any).devUrl as string;
const AUTH_FILE = path.join(__dirname, "../../auth.json");
const HAS_AUTH  = fs.existsSync(AUTH_FILE);

const REPO_ROOT = path.resolve(__dirname, "../../../../gas-projects/jrec-sf01-selfpay");
const BILLING_GS = path.join(REPO_ROOT, "JREC_SF01_Billing.gs");
const MAIN_GS    = path.join(REPO_ROOT, "JREC_SF01_Main.gs");
const HTML_DAILY = path.join(REPO_ROOT, "daily-checkout.html");
const HTML_MONTH = path.join(REPO_ROOT, "monthly-report.html");
const HTML_MENU  = path.join(REPO_ROOT, "menu-sales-report.html");
const HTML_OS    = path.join(REPO_ROOT, "outstanding-report.html");
const DESIGN_DOC = path.join(REPO_ROOT, "docs/PHASE_6M_AUDIT_REPORT_2026-05-21.md");

// ─────────────────────────────────────────────────────────────
// DOC / SRC tests（常時実行・auth 不要）
// ─────────────────────────────────────────────────────────────

test.describe("Phase 6-M-1 — design docs / source presence (always runs)", () => {
  test("6M1-DOC-1: 設計 docs が存在する", () => {
    expect(fs.existsSync(DESIGN_DOC), `design doc not found: ${DESIGN_DOC}`).toBe(true);
  });

  test("6M1-DOC-2: 設計 docs に 6-M-1 の確定仕様が含まれている", () => {
    const c = fs.readFileSync(DESIGN_DOC, "utf-8");
    expect(c.includes("6-M-1")).toBe(true);
    expect(c.includes("buildDailyCheckoutCsv_")).toBe(true);
    expect(c.includes("buildMonthlyRevenueCsv_")).toBe(true);
    expect(c.includes("buildMenuSalesCsv_")).toBe(true);
    expect(c.includes("buildOutstandingCsv_")).toBe(true);
  });

  test("6M1-SRC-1: Billing.gs に 4 つの CSV ビルダー関数が定義されている", () => {
    const c = fs.readFileSync(BILLING_GS, "utf-8");
    expect(c).toMatch(/function\s+buildDailyCheckoutCsv_\s*\(/);
    expect(c).toMatch(/function\s+buildMonthlyRevenueCsv_\s*\(/);
    expect(c).toMatch(/function\s+buildMenuSalesCsv_\s*\(/);
    expect(c).toMatch(/function\s+buildOutstandingCsv_\s*\(/);
    expect(c).toMatch(/function\s+escapeCsvField_\s*\(/);
    expect(c).toMatch(/function\s+buildCsvContent_\s*\(/);
  });

  test("6M1-SRC-2: Billing.gs CSV ビルダーは UTF-8 BOM + CRLF を採用している", () => {
    const c = fs.readFileSync(BILLING_GS, "utf-8");
    // BOM 定数（"﻿"）の存在
    expect(c.includes("CSV_BOM_")).toBe(true);
    expect(c).toMatch(/CSV_BOM_\s*=\s*"﻿"/);
    // CRLF 定数
    expect(c.includes("CSV_NEWLINE_")).toBe(true);
    expect(c).toMatch(/CSV_NEWLINE_\s*=\s*"\\r\\n"/);
  });

  test("6M1-SRC-3: Main.gs に 4 つの exportXxxCsv action 分岐が追加されている", () => {
    const c = fs.readFileSync(MAIN_GS, "utf-8");
    expect(c).toMatch(/action\s*===\s*"exportDailyCheckoutCsv"/);
    expect(c).toMatch(/action\s*===\s*"exportMonthlyRevenueCsv"/);
    expect(c).toMatch(/action\s*===\s*"exportMenuSalesCsv"/);
    expect(c).toMatch(/action\s*===\s*"exportOutstandingCsv"/);
  });

  test("6M1-SRC-4: Main.gs の CSV 分岐は ContentService.MimeType.CSV を返している", () => {
    const c = fs.readFileSync(MAIN_GS, "utf-8");
    // 全文で MimeType.CSV が 4 回以上出現すること（4 アクション × 1 = 最低 4）
    const count = (c.match(/ContentService\.MimeType\.CSV/g) || []).length;
    expect(count).toBeGreaterThanOrEqual(4);
  });

  test("6M1-HTML-1: daily-checkout.html に CSV ダウンロード <a> がある", () => {
    const c = fs.readFileSync(HTML_DAILY, "utf-8");
    expect(c.includes("exportDailyCheckoutCsv")).toBe(true);
    expect(c).toMatch(/target="_blank"/);
  });

  test("6M1-HTML-2: monthly-report.html に CSV ダウンロード <a> がある", () => {
    const c = fs.readFileSync(HTML_MONTH, "utf-8");
    expect(c.includes("exportMonthlyRevenueCsv")).toBe(true);
    expect(c).toMatch(/target="_blank"/);
  });

  test("6M1-HTML-3: menu-sales-report.html に CSV ダウンロード <a> がある", () => {
    const c = fs.readFileSync(HTML_MENU, "utf-8");
    expect(c.includes("exportMenuSalesCsv")).toBe(true);
    expect(c).toMatch(/target="_blank"/);
  });

  test("6M1-HTML-4: outstanding-report.html に CSV ダウンロード <a> がある", () => {
    const c = fs.readFileSync(HTML_OS, "utf-8");
    expect(c.includes("exportOutstandingCsv")).toBe(true);
    expect(c).toMatch(/target="_blank"/);
  });
});

// ─────────────────────────────────────────────────────────────
// LIVE tests（auth.json 必須・GAS /dev に直接 fetch）
// auth.json なし / 期限切れ → SKIP
// ─────────────────────────────────────────────────────────────

function skipIfNoAuth() {
  if (!HAS_AUTH) {
    test.skip(
      true,
      "auth.json なし。CSV エンドポイントの実 fetch には Google ログインセッションが必要です。\n" +
      "tsx scripts/setup-auth.ts の手順に従ってセッションを作成してください。"
    );
  }
}

test.describe("Phase 6-M-1 — live CSV endpoint fetch (auth required)", () => {
  test("6M1-LIVE-1: exportDailyCheckoutCsv が CSV (BOM + CRLF + header) を返す", async () => {
    skipIfNoAuth();
    const ctx = await pwRequest.newContext({ storageState: AUTH_FILE });
    const url = `${DEV_URL}?action=exportDailyCheckoutCsv&date=2026-05-02`;
    const res = await ctx.get(url, { maxRedirects: 5, timeout: 30000 });
    await ctx.dispose();

    // Google ログインリダイレクトに引っかかった場合は skip
    const finalUrl = res.url();
    if (finalUrl.includes("accounts.google.com") || finalUrl.includes("ServiceLogin")) {
      test.skip(true, "セッション期限切れ — accounts.google.com にリダイレクト");
      return;
    }

    expect(res.status()).toBeLessThan(400);
    const body = await res.text();
    // BOM 先頭
    expect(body.charCodeAt(0)).toBe(0xFEFF);
    // ヘッダー行
    expect(body).toContain("date,selfPayVisitKey,patientId,patientName");
    // CRLF
    expect(body.indexOf("\r\n")).toBeGreaterThanOrEqual(0);
  });

  test("6M1-LIVE-2: exportMonthlyRevenueCsv が CSV (BOM + summary + 日別 header) を返す", async () => {
    skipIfNoAuth();
    const ctx = await pwRequest.newContext({ storageState: AUTH_FILE });
    const url = `${DEV_URL}?action=exportMonthlyRevenueCsv&year=2026&month=5`;
    const res = await ctx.get(url, { maxRedirects: 5, timeout: 30000 });
    await ctx.dispose();

    const finalUrl = res.url();
    if (finalUrl.includes("accounts.google.com") || finalUrl.includes("ServiceLogin")) {
      test.skip(true, "セッション期限切れ");
      return;
    }

    expect(res.status()).toBeLessThan(400);
    const body = await res.text();
    expect(body.charCodeAt(0)).toBe(0xFEFF);
    expect(body).toContain("# 年月,対象月の来院件数,請求合計,入金合計,未収残高");
    expect(body).toContain("date,visitCount,unbilledCount");
    expect(body.indexOf("\r\n")).toBeGreaterThanOrEqual(0);
  });

  test("6M1-LIVE-3: exportMenuSalesCsv が CSV (BOM + header) を返す", async () => {
    skipIfNoAuth();
    const ctx = await pwRequest.newContext({ storageState: AUTH_FILE });
    const url = `${DEV_URL}?action=exportMenuSalesCsv&year=2026&month=5`;
    const res = await ctx.get(url, { maxRedirects: 5, timeout: 30000 });
    await ctx.dispose();

    const finalUrl = res.url();
    if (finalUrl.includes("accounts.google.com") || finalUrl.includes("ServiceLogin")) {
      test.skip(true, "セッション期限切れ");
      return;
    }

    expect(res.status()).toBeLessThan(400);
    const body = await res.text();
    expect(body.charCodeAt(0)).toBe(0xFEFF);
    expect(body).toContain("year,month,menuCode,menuName");
  });

  test("6M1-LIVE-4: exportOutstandingCsv が CSV (BOM + header) を返す", async () => {
    skipIfNoAuth();
    const ctx = await pwRequest.newContext({ storageState: AUTH_FILE });
    const url = `${DEV_URL}?action=exportOutstandingCsv`;
    const res = await ctx.get(url, { maxRedirects: 5, timeout: 30000 });
    await ctx.dispose();

    const finalUrl = res.url();
    if (finalUrl.includes("accounts.google.com") || finalUrl.includes("ServiceLogin")) {
      test.skip(true, "セッション期限切れ");
      return;
    }

    expect(res.status()).toBeLessThan(400);
    const body = await res.text();
    expect(body.charCodeAt(0)).toBe(0xFEFF);
    expect(body).toContain("selfPayVisitKey,patientId,patientName,visitDate,chiefComplaint");
    expect(body).toContain("daysOverdue");
  });
});
