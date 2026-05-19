/**
 * jbiz portal18f-coldstart.spec.ts
 * Portal-18-F: cold start TTI 計測 spec（baseline 取得 + Portal-18-B v2 並列化前後比較用）
 *
 * 設計: docs/PORTAL_18B_V2_FETCHALL_PARALLELIZATION_2026-05-20.md § 8
 *
 * 計測対象:
 *   home / chronicpain / alerts / selfpay detail / insurance detail
 *
 * 計測項目:
 *   - DOMContentLoaded (ms): page.goto({ waitUntil: "domcontentloaded" }) 完了までの ms
 *   - Portal h1 visible (ms): iframe 内 "平山ビジネスポータル" タイトル可視化までの ms
 *
 * 注意:
 *   - GAS 側 CacheService は外部から invalidate できないため、本 spec は warm cache 計測。
 *     cold 計測は 5 分以上の間隔をあけて手動実行するか、TTL 経過後に再実行する。
 *   - 閾値は緩めに設定（spec が「壊れない計測」として機能することを優先）。
 *   - 数値は test の console.log に出力。手動で docs に転記して baseline / after 比較する。
 *
 * 実行コマンド: npm run test:jbiz:portal18f
 */

import { test, expect, Page } from "@playwright/test";
import fs from "fs";
import path from "path";

const JBIZ_PROD_URL =
  "https://script.google.com/macros/s/AKfycbw20tWvhR5nnRzCiUAMybtfrebRg-BK-EgDamvZYt-clSwf4TK9FGTKNZRmsO3wj7QSiQ/exec";
const AUTH_FILE    = path.join(__dirname, "../../auth.json");
const HAS_AUTH     = fs.existsSync(AUTH_FILE);
const LOAD_TIMEOUT = 60_000;

function gasFrame(page: Page) {
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
        : "Google 認証が必要です。npm run save-auth を実行して auth.json を作成してください。"
    );
  }
}

interface Timing {
  view: string;
  url: string;
  domContentLoadedMs: number;
  portalH1VisibleMs: number | null;
}

const results: Timing[] = [];

async function measureView(page: Page, view: string, query: string) {
  const url = `${JBIZ_PROD_URL}${query}`;
  const t0 = Date.now();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: LOAD_TIMEOUT });
  const tDom = Date.now();
  await handleAuthRedirect(page);

  const frame = gasFrame(page);
  let portalH1Visible: number | null = null;
  try {
    // 内側 iframe 内に Portal h1 / title が見えるまで待つ
    await frame.getByText("平山ビジネスポータル", { exact: false }).first().waitFor({
      state: "visible",
      timeout: LOAD_TIMEOUT,
    });
    portalH1Visible = Date.now() - t0;
  } catch (e) {
    portalH1Visible = null;
  }

  const timing: Timing = {
    view,
    url,
    domContentLoadedMs: tDom - t0,
    portalH1VisibleMs: portalH1Visible,
  };
  results.push(timing);
  console.log(`[portal18f] ${view.padEnd(20)} dom=${String(timing.domContentLoadedMs).padStart(5)}ms portalH1=${timing.portalH1VisibleMs != null ? String(timing.portalH1VisibleMs).padStart(5) + "ms" : "  -  "} url=${url}`);
}

test.describe(`JBIZ Portal-18-F cold start TTI 計測 [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  // Portal-18-F: cold start で chronicpain / selfpay は 3 fetch 直列のため 30s 超過する可能性あり。
  // playwright default test timeout (30s) を 120s に拡張する。
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
  });

  test("P18F-1: home view を計測", async ({ page }) => {
    await measureView(page, "home", "?view=home");
    expect(results.length).toBeGreaterThan(0);
    expect(results[results.length - 1].domContentLoadedMs).toBeLessThan(30_000);
  });

  test("P18F-2: chronicpain view を計測（3 fetch 直列ボトルネック）", async ({ page }) => {
    await measureView(page, "chronicpain", "?view=chronicpain");
    expect(results[results.length - 1].domContentLoadedMs).toBeLessThan(60_000);
  });

  test("P18F-3: alerts view を計測（2 fetch 直列ボトルネック）", async ({ page }) => {
    await measureView(page, "alerts", "?view=alerts");
    expect(results[results.length - 1].domContentLoadedMs).toBeLessThan(60_000);
  });

  test("P18F-4: selfpay detail view を計測（chronicpain と同じ 3 fetch 経由）", async ({ page }) => {
    await measureView(page, "business&id=selfpay", "?view=business&id=selfpay");
    expect(results[results.length - 1].domContentLoadedMs).toBeLessThan(60_000);
  });

  test("P18F-5: insurance detail view を計測（1 fetch のみ・並列化対象外）", async ({ page }) => {
    await measureView(page, "business&id=insurance", "?view=business&id=insurance");
    expect(results[results.length - 1].domContentLoadedMs).toBeLessThan(60_000);
  });

  test.afterAll(async () => {
    console.log("\n[portal18f] ─── 計測サマリ ─────────────────────────────");
    console.log("[portal18f] view                  dom (ms)  portalH1 (ms)");
    for (const r of results) {
      const h1 = r.portalH1VisibleMs != null ? String(r.portalH1VisibleMs).padStart(8) + "ms" : "       -";
      console.log(`[portal18f] ${r.view.padEnd(22)} ${String(r.domContentLoadedMs).padStart(6)}ms  ${h1}`);
    }
    console.log("[portal18f] ──────────────────────────────────────────────");
    console.log("[portal18f] → docs/PORTAL_18B_V2_FETCHALL_PARALLELIZATION_2026-05-20.md §11 に転記");
  });
});
