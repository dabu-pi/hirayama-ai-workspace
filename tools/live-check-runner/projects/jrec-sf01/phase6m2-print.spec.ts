/**
 * jrec-sf01 phase6m2-print.spec.ts
 *
 * Phase 6-M-2: 印刷用 @media print CSS の実装整合性検証。
 *
 * テスト方針:
 *   - SRC / HTML 系（@media print block / .print-only header presence）は auth 不要・常時 PASS
 *   - LIVE 系（Playwright emulateMedia('print') で実画面確認）は auth.json 必須
 *     auth.json なし or 期限切れ → SKIP
 *
 * 対象ページ: monthly-report.html / outstanding-report.html
 *
 * 実行: npm run test:jrec:phase6m2
 */

import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import config from "./config.json";

const DEV_URL   = (config as any).devUrl as string;
const AUTH_FILE = path.join(__dirname, "../../auth.json");
const HAS_AUTH  = fs.existsSync(AUTH_FILE);

const REPO_ROOT = path.resolve(__dirname, "../../../../gas-projects/jrec-sf01-selfpay");
const STYLES    = path.join(REPO_ROOT, "styles.html");
const HTML_MONTH = path.join(REPO_ROOT, "monthly-report.html");
const HTML_OS    = path.join(REPO_ROOT, "outstanding-report.html");
const DESIGN_DOC = path.join(REPO_ROOT, "docs/PHASE_6M_AUDIT_REPORT_2026-05-21.md");

// ─────────────────────────────────────────────────────────────
// SRC / HTML tests（常時実行・auth 不要）
// ─────────────────────────────────────────────────────────────

test.describe("Phase 6-M-2 — design docs / source presence (always runs)", () => {
  test("6M2-DOC-1: 設計 docs に 6-M-2 印刷 CSS 仕様が含まれている", () => {
    const c = fs.readFileSync(DESIGN_DOC, "utf-8");
    expect(c.includes("6-M-2")).toBe(true);
    expect(c.includes("@media print")).toBe(true);
    expect(c.includes("A4")).toBe(true);
    expect(c.includes(".print-only")).toBe(true);
  });

  test("6M2-CSS-1: styles.html に @media print ブロックがある", () => {
    const c = fs.readFileSync(STYLES, "utf-8");
    expect(c).toMatch(/@media\s+print\s*\{/);
  });

  test("6M2-CSS-2: @media print で A4 portrait + margin が指定されている", () => {
    const c = fs.readFileSync(STYLES, "utf-8");
    expect(c).toMatch(/size:\s*A4\s+portrait/);
    expect(c).toMatch(/margin:\s*12mm\s+10mm/);
  });

  test("6M2-CSS-3: @media print で .app-header / .tab-nav / .btn / .month-nav-btn が非表示", () => {
    const c = fs.readFileSync(STYLES, "utf-8");
    // @media print ブロック内に display:none が複数回出現
    const printBlockMatch = c.match(/@media\s+print\s*\{[\s\S]*?\}\s*\n\s*\}/);
    expect(printBlockMatch, "@media print block not found").not.toBeNull();
    const block = printBlockMatch![0];
    expect(block).toContain(".app-header");
    expect(block).toContain(".tab-nav");
    expect(block).toContain(".btn");
    expect(block).toContain(".month-nav-btn");
    expect(block).toContain("display: none");
  });

  // Phase 6-M-2a 回帰: 日別内訳テーブルの日付列が印刷時に非表示にならないこと
  test("6M2A-CSS-1: @media print で .day-link-btn / .patient-name-btn が display:none セレクタリストに含まれていない", () => {
    const c = fs.readFileSync(STYLES, "utf-8");
    // CSS コメントを除去（コメント内のクラス名は対象外）
    const stripped = c.replace(/\/\*[\s\S]*?\*\//g, "");
    const printBlockMatch = stripped.match(/@media\s+print\s*\{[\s\S]*?\}\s*\n\s*\}/);
    expect(printBlockMatch).not.toBeNull();
    const block = printBlockMatch![0];
    const hideGroup = block.match(/[^}]*\{\s*display:\s*none\s*!important;\s*\}/);
    if (hideGroup) {
      expect(hideGroup[0]).not.toContain(".day-link-btn");
      expect(hideGroup[0]).not.toContain(".patient-name-btn");
    }
  });

  test("6M2A-CSS-2: @media print で .day-link-btn / .patient-name-btn は装飾を消すスタイルがある", () => {
    const c = fs.readFileSync(STYLES, "utf-8");
    const printBlockMatch = c.match(/@media\s+print\s*\{[\s\S]*?\}\s*\n\s*\}/);
    expect(printBlockMatch).not.toBeNull();
    const block = printBlockMatch![0];
    // .day-link-btn と .patient-name-btn をまとめたルールがあり、
    // text-decoration: none と color: #000 を含むこと
    expect(block).toMatch(/\.day-link-btn[\s\S]*?\.patient-name-btn\s*\{[\s\S]*?text-decoration:\s*none/);
    expect(block).toMatch(/\.day-link-btn[\s\S]*?\.patient-name-btn\s*\{[\s\S]*?color:\s*#000/);
  });

  test("6M2A-CSS-3: .screen-only / .print-date 出し分けクラスが定義されている", () => {
    const c = fs.readFileSync(STYLES, "utf-8");
    // デフォルト
    expect(c).toMatch(/\.screen-only\s*\{\s*display:\s*inline;?\s*\}/);
    expect(c).toMatch(/\.print-date\s*\{\s*display:\s*none;?\s*\}/);
    // @media print 内
    const printBlockMatch = c.match(/@media\s+print\s*\{[\s\S]*?\}\s*\n\s*\}/);
    expect(printBlockMatch).not.toBeNull();
    const block = printBlockMatch![0];
    expect(block).toMatch(/\.screen-only\s*\{\s*display:\s*none/);
    expect(block).toMatch(/\.print-date\s*\{\s*display:\s*inline/);
  });

  test("6M2A-HTML-1: monthly-report.html の日付セルに screen-only と print-date 二重表示がある", () => {
    const c = fs.readFileSync(HTML_MONTH, "utf-8");
    // 日付セル内に screen-only ("05-01" = _dt.slice(5)) と print-date ("2026-05-01" = _dt) が並ぶこと
    expect(c).toMatch(/class="screen-only"[^>]*>\s*<\?=\s*_dt\.slice\(5\)/);
    expect(c).toMatch(/class="print-date"[^>]*>\s*<\?=\s*_dt\s*\?>/);
  });

  test("6M2-CSS-4: .print-only クラスはデフォルトで display:none / @media print 内で display:block", () => {
    const c = fs.readFileSync(STYLES, "utf-8");
    // デフォルト
    expect(c).toMatch(/\.print-only\s*\{\s*display:\s*none;?\s*\}/);
    // @media print 内
    const printBlockMatch = c.match(/@media\s+print\s*\{[\s\S]*?\}\s*\n\s*\}/);
    expect(printBlockMatch).not.toBeNull();
    expect(printBlockMatch![0]).toMatch(/\.print-only\s*\{\s*display:\s*block/);
  });

  test("6M2-CSS-5: @media print で thead 繰り返し + tr 改ページ avoid が指定", () => {
    const c = fs.readFileSync(STYLES, "utf-8");
    const printBlockMatch = c.match(/@media\s+print\s*\{[\s\S]*?\}\s*\n\s*\}/);
    expect(printBlockMatch).not.toBeNull();
    const block = printBlockMatch![0];
    expect(block).toMatch(/thead\s*\{\s*display:\s*table-header-group/);
    expect(block).toMatch(/tr\s*\{[^}]*page-break-inside:\s*avoid/);
  });

  test("6M2-HTML-1: monthly-report.html に .print-only header が追加されている", () => {
    const c = fs.readFileSync(HTML_MONTH, "utf-8");
    expect(c).toMatch(/class="print-only print-header"/);
    expect(c).toContain("JREC-SF01 月次売上レポート");
    expect(c).toContain("printedAtMR");
  });

  test("6M2-HTML-2: outstanding-report.html に .print-only header が追加されている", () => {
    const c = fs.readFileSync(HTML_OS, "utf-8");
    expect(c).toMatch(/class="print-only print-header"/);
    expect(c).toContain("JREC-SF01 未収・回収管理レポート");
    expect(c).toContain("printedAtOR");
  });

  test("6M2-HTML-3: .print-only header に印刷日時を埋める JS がある", () => {
    const cMonth = fs.readFileSync(HTML_MONTH, "utf-8");
    const cOs    = fs.readFileSync(HTML_OS, "utf-8");
    expect(cMonth).toMatch(/toLocaleString\([^)]*'ja-JP'/);
    expect(cMonth).toContain("Asia/Tokyo");
    expect(cOs).toMatch(/toLocaleString\([^)]*'ja-JP'/);
    expect(cOs).toContain("Asia/Tokyo");
  });
});

// ─────────────────────────────────────────────────────────────
// LIVE tests（auth.json 必須・Playwright emulateMedia('print') で確認）
// ─────────────────────────────────────────────────────────────

function skipIfNoAuth() {
  if (!HAS_AUTH) {
    test.skip(
      true,
      "auth.json なし。Playwright で実画面の印刷スタイルを確認するには Google ログインセッションが必要です。"
    );
  }
}

test.describe("Phase 6-M-2 — live print emulation (auth required)", () => {
  test("6M2-LIVE-1: monthlyReport ページが print media で .tab-nav が非表示", async ({ page }) => {
    skipIfNoAuth();
    await page.goto(`${DEV_URL}?page=monthlyReport`, { waitUntil: "domcontentloaded" });

    const url = page.url();
    if (url.includes("accounts.google.com") || url.includes("ServiceLogin")) {
      test.skip(true, "セッション期限切れ");
      return;
    }

    // GAS WebApp は iframe で wrap されるため frameLocator を使う
    const frame = page.frameLocator("iframe").first();
    await page.emulateMedia({ media: "print" });

    // タブナビが見えないことを確認（display:none）
    const tabNav = frame.locator(".tab-nav").first();
    // GAS の場合、要素が存在しても hidden になっている可能性があるので isVisible で確認
    const isVisible = await tabNav.isVisible().catch(() => false);
    expect(isVisible, "tab-nav は @media print で非表示のはず").toBe(false);
  });

  test("6M2-LIVE-2: outstandingReport ページが print media で .print-only header を表示", async ({ page }) => {
    skipIfNoAuth();
    await page.goto(`${DEV_URL}?page=outstandingReport`, { waitUntil: "domcontentloaded" });

    const url = page.url();
    if (url.includes("accounts.google.com") || url.includes("ServiceLogin")) {
      test.skip(true, "セッション期限切れ");
      return;
    }

    const frame = page.frameLocator("iframe").first();
    await page.emulateMedia({ media: "print" });

    // .print-only ヘッダーが表示されている
    const printHeader = frame.locator(".print-only.print-header").first();
    const isVisible = await printHeader.isVisible().catch(() => false);
    expect(isVisible, "outstandingReport の print-header が表示されているはず").toBe(true);
  });

  test("6M2-LIVE-3: スクリーン表示では .print-only が非表示", async ({ page }) => {
    skipIfNoAuth();
    await page.goto(`${DEV_URL}?page=monthlyReport`, { waitUntil: "domcontentloaded" });

    const url = page.url();
    if (url.includes("accounts.google.com") || url.includes("ServiceLogin")) {
      test.skip(true, "セッション期限切れ");
      return;
    }

    const frame = page.frameLocator("iframe").first();
    await page.emulateMedia({ media: "screen" });

    // .print-only は通常画面では非表示
    const printOnly = frame.locator(".print-only").first();
    const isVisible = await printOnly.isVisible().catch(() => false);
    expect(isVisible, "通常画面では .print-only は非表示").toBe(false);
  });
});
