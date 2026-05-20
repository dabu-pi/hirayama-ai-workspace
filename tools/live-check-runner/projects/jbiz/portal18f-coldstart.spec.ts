/**
 * jbiz portal18f-coldstart.spec.ts
 * Portal-18-F: cold start TTI 計測 spec（baseline 取得 + Portal-18-B v2 並列化前後比較用）
 *
 * 設計: docs/PORTAL_18B_V2_FETCHALL_PARALLELIZATION_2026-05-20.md § 8
 * 改訂: 2026-05-20（v2 / view 別 marker + contentVisibleMs 追加）
 *
 * 計測対象:
 *   home / chronicpain / alerts / selfpay detail / insurance detail
 *
 * 計測項目:
 *   - DOMContentLoaded (ms): page.goto({ waitUntil: "domcontentloaded" }) 完了までの ms
 *     （= 外側 iframe HTML 取得まで。GAS WebApp の場合は内部 sandbox iframe の fetch 完了は含まない）
 *   - contentVisibleMs (ms): view 別 marker が **内部 iframe 内に visible** になるまでの ms
 *     （= 実 TTI に近い。GAS 側の全 fetch + render + iframe injection を含む）
 *
 * 注意:
 *   - GAS 側 CacheService は外部から invalidate できないため、本 spec は warm cache 計測。
 *   - cold は 5 分以上の TTL 経過後に再実行する。`COLD_RUN_LABEL` 環境変数で run 識別子を付けられる。
 *   - 閾値は緩めに設定（spec が「壊れない計測」として機能することを優先）。
 *
 * 実行コマンド: npm run test:jbiz:portal18f
 * cold 単独実行: COLD_RUN_LABEL="cold-OFF" npx playwright test projects/jbiz/portal18f-coldstart.spec.ts -g "chronicpain"
 */

import { test, expect, Page } from "@playwright/test";
import fs from "fs";
import path from "path";

const JBIZ_PROD_URL =
  "https://script.google.com/macros/s/AKfycbw20tWvhR5nnRzCiUAMybtfrebRg-BK-EgDamvZYt-clSwf4TK9FGTKNZRmsO3wj7QSiQ/exec";
const AUTH_FILE    = path.join(__dirname, "../../auth.json");
const HAS_AUTH     = fs.existsSync(AUTH_FILE);
const LOAD_TIMEOUT = 90_000;
const RUN_LABEL    = process.env.COLD_RUN_LABEL || "";

// view 別 marker: GAS 内部 iframe の最終 HTML 内で、サーバ側 fetch / 集計が完了して初めて出る文字列を選ぶ
// すべて exact: false（部分一致）/ frame 内 visibility 判定
const VIEW_MARKERS: Record<string, string> = {
  home:                  "Portal @36",                     // B16 由来。Dashboard sheet 読込完了後に表示
  chronicpain:           "§ 1 自費転換ファネル",           // buildChronicPainFunnelSection_ → 3 fetch 完了後
  alerts:                "🚨 アラート一覧",                  // collectPortalAlerts_ → 2 fetch 完了後
  "business-selfpay":    "Portal-12: JREC-SF01 ジム紹介 KPI",// selfpay detail / chronicpain 経由（3 fetch）
  "business-insurance":  "保険来院件数",                    // insurance KPI 表示（fetchInsuranceKpi_ 完了後）
};

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
  marker: string;
  domContentLoadedMs: number;
  contentVisibleMs: number | null;
  runLabel: string;
}

const results: Timing[] = [];

async function measureView(page: Page, view: string, query: string) {
  const url = `${JBIZ_PROD_URL}${query}`;
  const marker = VIEW_MARKERS[view] || "平山ビジネスポータル";
  const t0 = Date.now();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: LOAD_TIMEOUT });
  const tDom = Date.now();
  await handleAuthRedirect(page);

  const frame = gasFrame(page);
  let contentVisible: number | null = null;
  try {
    await frame.getByText(marker, { exact: false }).first().waitFor({
      state: "visible",
      timeout: LOAD_TIMEOUT,
    });
    contentVisible = Date.now() - t0;
  } catch {
    contentVisible = null;
  }

  const timing: Timing = {
    view,
    url,
    marker,
    domContentLoadedMs: tDom - t0,
    contentVisibleMs: contentVisible,
    runLabel: RUN_LABEL,
  };
  results.push(timing);
  const cv = timing.contentVisibleMs != null ? String(timing.contentVisibleMs).padStart(5) + "ms" : "  -  ";
  console.log(`[portal18f]${RUN_LABEL ? "[" + RUN_LABEL + "]" : ""} ${view.padEnd(22)} dom=${String(timing.domContentLoadedMs).padStart(5)}ms content=${cv} marker="${marker}"`);
}

test.describe(`JBIZ Portal-18-F cold start TTI 計測 [auth: ${HAS_AUTH ? "あり" : "なし"}]${RUN_LABEL ? " run=" + RUN_LABEL : ""}`, () => {
  // cold start で chronicpain / selfpay は 3 fetch 直列のため 30s 超過する可能性あり。
  // 内部 iframe marker 待ちのため最大 LOAD_TIMEOUT (90s) かかる可能性も想定し test timeout を 180s に拡張。
  test.describe.configure({ timeout: 180_000 });

  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
  });

  test("P18F-1: home view を計測", async ({ page }) => {
    await measureView(page, "home", "?view=home");
    expect(results.length).toBeGreaterThan(0);
    expect(results[results.length - 1].domContentLoadedMs).toBeLessThan(60_000);
  });

  test("P18F-2: chronicpain view を計測（3 fetch 直列ボトルネック）", async ({ page }) => {
    await measureView(page, "chronicpain", "?view=chronicpain");
    expect(results[results.length - 1].domContentLoadedMs).toBeLessThan(90_000);
  });

  test("P18F-3: alerts view を計測（2 fetch 直列ボトルネック）", async ({ page }) => {
    await measureView(page, "alerts", "?view=alerts");
    expect(results[results.length - 1].domContentLoadedMs).toBeLessThan(90_000);
  });

  test("P18F-4: selfpay detail view を計測（chronicpain と同じ 3 fetch 経由）", async ({ page }) => {
    await measureView(page, "business-selfpay", "?view=business&id=selfpay");
    expect(results[results.length - 1].domContentLoadedMs).toBeLessThan(90_000);
  });

  test("P18F-5: insurance detail view を計測（1 fetch のみ・並列化対象外）", async ({ page }) => {
    await measureView(page, "business-insurance", "?view=business&id=insurance");
    expect(results[results.length - 1].domContentLoadedMs).toBeLessThan(90_000);
  });

  test.afterAll(async () => {
    console.log("\n[portal18f] ─── 計測サマリ" + (RUN_LABEL ? " (" + RUN_LABEL + ")" : "") + " ─────────────────");
    console.log("[portal18f] view                   dom (ms)  content (ms)");
    for (const r of results) {
      const cv = r.contentVisibleMs != null ? String(r.contentVisibleMs).padStart(8) + "ms" : "       -";
      console.log(`[portal18f] ${r.view.padEnd(22)} ${String(r.domContentLoadedMs).padStart(6)}ms  ${cv}`);
    }
    console.log("[portal18f] ──────────────────────────────────────────────");
    console.log("[portal18f] content (ms) = 内部 iframe marker が visible になるまで（=実 TTI に近い）");
    console.log("[portal18f] dom     (ms) = 外側 iframe DCL（GAS sandbox wrapper のみ）");
    console.log("[portal18f] → docs/PORTAL_18B_V2_IMPLEMENTATION_2026-05-20.md / PORTAL_18B_V2_FETCHALL_PARALLELIZATION_2026-05-20.md に転記");
  });
});
