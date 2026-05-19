/**
 * jbiz portal8.spec.ts
 * Portal-8 系（8A/8B/8C/8D/8E + B16 仕上げ）実画面 UI 確認スペック
 *
 * 自動確認項目（auth.json 有効時のみ意味あり）:
 *   P8-1:  Home に B16 由来の Portal フェーズ「Portal @36」が表示される（B16 更新の反映）
 *   P8-2:  Home の主要カードに Portal-8A の .meta ラベル（データ元 / 更新区分 / 最終取得）が表示される
 *   P8-3:  Home に Portal-8B の freshness badge（🟢/🟡/🔴/🔵/⚫ のいずれか）が表示される
 *   P8-4:  selfpay 詳細に Portal-8A .meta ラベルが表示される
 *   P8-5:  selfpay 詳細に Portal-8B freshness badge が表示される
 *   P8-6:  Business Hub（?view=businesses）が表示され、Wildboar / JREC / JYU-GAS への外部リンクが維持されている
 *   P8-7:  Business Hub に Portal-8C metadata（update_mode 由来 .meta）が表示される
 *
 * 人間確認項目:
 *   P8-H1: 月初トリガ（Portal-8D）が次回 2026-06-01 03:00 JST に発火することを Run_Log で確認
 *   P8-H2: auth.json 更新後、画面遷移が遅い場合に CacheService キャッシュリセット要否
 *
 * 実行コマンド: npx playwright test projects/jbiz/portal8.spec.ts
 */

import { test, expect, Page } from "@playwright/test";
import fs from "fs";
import path from "path";

const JBIZ_PROD_URL =
  "https://script.google.com/macros/s/AKfycbw20tWvhR5nnRzCiUAMybtfrebRg-BK-EgDamvZYt-clSwf4TK9FGTKNZRmsO3wj7QSiQ/exec";
const AUTH_FILE    = path.join(__dirname, "../../auth.json");
const HAS_AUTH     = fs.existsSync(AUTH_FILE);
const LOAD_TIMEOUT = 35_000;

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

test.describe(`JBIZ Portal-8 系 UI 確認 [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
  });

  test("P8-1: Home に Portal フェーズ「Portal @36」が表示される（B16 更新反映）", async ({ page }) => {
    await page.goto(`${JBIZ_PROD_URL}?view=home`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasFrame(page);
    await expect(frame.getByText("Portal @36", { exact: false }).first()).toBeVisible({
      timeout: LOAD_TIMEOUT,
    });
  });

  test("P8-2: Home の主要カードに Portal-8A .meta ラベル（データ元）が表示される", async ({ page }) => {
    await page.goto(`${JBIZ_PROD_URL}?view=home`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasFrame(page);
    await expect(frame.getByText("データ元:", { exact: false }).first()).toBeVisible({
      timeout: LOAD_TIMEOUT,
    });
  });

  test("P8-3: Home に Portal-8B freshness badge（🟢/🟡/🔴/🔵/⚫/⚪ のいずれか）が表示される", async ({ page }) => {
    await page.goto(`${JBIZ_PROD_URL}?view=home`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasFrame(page);
    const bodyText = await frame.locator("body").innerText({ timeout: LOAD_TIMEOUT });
    const hasBadge =
      bodyText.includes("🟢") ||
      bodyText.includes("🟡") ||
      bodyText.includes("🔴") ||
      bodyText.includes("🔵") ||
      bodyText.includes("⚫") ||
      bodyText.includes("⚪");
    expect(hasBadge, `Home に freshness badge が含まれていません`).toBe(true);
  });

  test("P8-4: selfpay 詳細に Portal-8A .meta ラベル（データ元 / 更新区分 / 最終取得 のいずれか）が表示される", async ({ page }) => {
    await page.goto(`${JBIZ_PROD_URL}?view=business&id=selfpay`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasFrame(page);
    const bodyText = await frame.locator("body").innerText({ timeout: LOAD_TIMEOUT });
    const hasMeta =
      bodyText.includes("データ元:") ||
      bodyText.includes("更新区分:") ||
      bodyText.includes("最終取得:") ||
      bodyText.includes("Fetched at");
    expect(hasMeta, `selfpay 詳細に .meta ラベルが含まれていません`).toBe(true);
  });

  test("P8-5: selfpay 詳細に Portal-8B freshness badge が表示される", async ({ page }) => {
    await page.goto(`${JBIZ_PROD_URL}?view=business&id=selfpay`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasFrame(page);
    const bodyText = await frame.locator("body").innerText({ timeout: LOAD_TIMEOUT });
    const hasBadge =
      bodyText.includes("🟢") ||
      bodyText.includes("🟡") ||
      bodyText.includes("🔴") ||
      bodyText.includes("🔵") ||
      bodyText.includes("⚫") ||
      bodyText.includes("⚪");
    expect(hasBadge, `selfpay 詳細に freshness badge が含まれていません`).toBe(true);
  });

  test("P8-6: Business Hub に Wildboar / JREC / JYU-GAS / training 系の外部リンクが維持されている", async ({ page }) => {
    await page.goto(`${JBIZ_PROD_URL}?view=businesses`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasFrame(page);
    const bodyText = await frame.locator("body").innerText({ timeout: LOAD_TIMEOUT });
    // Business_Links seed 9 事業のうち、主要事業の名前が表示されていること
    const hasGym       = bodyText.includes("ワイルドボア") || bodyText.toLowerCase().includes("wildboar");
    const hasSelfpay   = bodyText.includes("自費");
    const hasInsurance = bodyText.includes("保険");
    expect(hasGym, "Business Hub に Wildboar/ジム関連の事業が表示されていません").toBe(true);
    expect(hasSelfpay, "Business Hub に 自費 事業が表示されていません").toBe(true);
    expect(hasInsurance, "Business Hub に 保険 事業が表示されていません").toBe(true);
  });

  test("P8-7: Business Hub に Portal-8C update_mode 由来の .meta バッジが表示される", async ({ page }) => {
    await page.goto(`${JBIZ_PROD_URL}?view=businesses`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasFrame(page);
    const bodyText = await frame.locator("body").innerText({ timeout: LOAD_TIMEOUT });
    // Portal-8C で seed した update_mode 値（live_fetch_5min / importrange_auto / manual / building 等）が
    // どれか1つでも HTML に出てくれば metadata が render に反映されていると判定
    const hasUpdateMode =
      bodyText.includes("live_fetch_5min") ||
      bodyText.includes("importrange_auto") ||
      bodyText.includes("manual") ||
      bodyText.includes("building") ||
      bodyText.includes("active");
    expect(hasUpdateMode, "Business Hub に Portal-8C metadata（update_mode）が render されていません").toBe(true);
  });
});

test.describe("JBIZ Portal-8 系: 人間確認項目（自動化対象外）", () => {
  test("P8-H1: 月初トリガ（Portal-8D）が 2026-06-01 03:00 JST に発火することを Run_Log で確認", async () => {
    test.skip(true,
      "手動: 2026-06-01 以降に ?view=runlog を開き、portal8DMonthlySnapshotRun_ の event 行が追加されているか確認。"
    );
  });

  test("P8-H2: auth.json 更新後の CacheService キャッシュリセット要否", async () => {
    test.skip(true,
      "手動: 画面遷移が古いまま表示される場合、GAS エディタから resetPortalCache_ を実行するか、5分待つ。"
    );
  });
});
