/**
 * jyu-gas-ver31 mobile-field.spec.ts
 * JYU-GAS Ver3.1 スマホ相当確認（Playwright mobile project / Pixel 5 幅）
 *
 * 確認項目:
 *   A. 既存稼働導線 ─ page=search / selfPayWeb / 横スクロールなし
 *   B. WEB-1 ─ page=home / page=detail の表示・ボタン
 *   C. WEB-2.5 ─ visitNew フォーム・モーダル・警告文・キャンセル
 *   D. 成功画面（保存テスト 1 件）
 *
 * 実行: npm run test:jyu:mobile-field -- --project=mobile
 */

import { test, expect, Page } from "@playwright/test";
import fs from "fs";
import path from "path";
import config from "./config.json";

const DEV_URL      = config.devUrl;
const AUTH_FILE    = path.join(__dirname, "../../auth.json");
const HAS_AUTH     = fs.existsSync(AUTH_FILE);
const LOAD_TIMEOUT = 35_000;
const TEST_PID     = config.testData.patientId;
const TEST_DATE    = "2999-12-31";
const TEST_VK      = TEST_PID ? `${TEST_PID}_${TEST_DATE}` : "";

// ── ヘルパー ────────────────────────────────────────────────────────

function gasFrame(page: Page) {
  return page.frameLocator("iframe").first().frameLocator("iframe").first();
}

async function handleAuth(page: Page) {
  const url   = page.url();
  const title = await page.title().catch(() => "");
  if (url.includes("accounts.google.com") || title.includes("Sign-in")) {
    test.skip(true,
      HAS_AUTH ? "auth.json が期限切れ。npm run save-auth を再実行してください。"
               : "Google 認証が必要です。npm run save-auth を実行してください。");
  }
}

async function noHScroll(page: Page): Promise<boolean> {
  return page.evaluate(() =>
    document.documentElement.scrollWidth <= document.documentElement.clientWidth + 20
  );
}

// ── A. 既存稼働導線 ─────────────────────────────────────────────────
// デフォルト(page=home)変更後は ?page=search を明示して既存導線を確認

test.describe(`[Mobile] A-1: page=search 表示 [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test("A-1a: /exec がスマホ幅で到達できる", async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
    const res = await page.goto(DEV_URL, { waitUntil: "domcontentloaded" });
    await handleAuth(page);
    expect(res?.status()).toBeLessThan(400);
  });

  test("A-1b: /exec がデフォルトで page=home を表示する", async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(DEV_URL, { waitUntil: "domcontentloaded" });
    await handleAuth(page);
    const frame = gasFrame(page);
    await expect(frame.getByText("JREC-01", { exact: false })).toBeVisible({ timeout: LOAD_TIMEOUT });
  });

  test("A-1c: /exec?page=search — 検索欄 #keyword が表示される", async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=search`, { waitUntil: "domcontentloaded" });
    await handleAuth(page);
    const frame = gasFrame(page);
    await expect(frame.locator("#keyword")).toBeVisible({ timeout: LOAD_TIMEOUT });
  });

  test("A-1d: /exec?page=search — 横スクロールが出ない", async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=search`, { waitUntil: "domcontentloaded" });
    await handleAuth(page);
    expect(await noHScroll(page)).toBe(true);
  });
});

// ── B. WEB-1 ─────────────────────────────────────────────────────────

test.describe(`[Mobile] B-1: page=home 表示 [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test("B-1a: page=home が横スクロールなしで表示される", async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=home`, { waitUntil: "domcontentloaded" });
    await handleAuth(page);
    expect(await noHScroll(page)).toBe(true);
  });

  test("B-1b: 「患者検索」カードが表示される", async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=home`, { waitUntil: "domcontentloaded" });
    await handleAuth(page);
    const frame = gasFrame(page);
    await expect(frame.getByText("患者検索", { exact: false })).toBeVisible({ timeout: LOAD_TIMEOUT });
  });
});

test.describe(`[Mobile] B-2: page=detail 表示 [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test("B-2a: page=detail (patientId なし) がクラッシュしない", async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
    const res = await page.goto(`${DEV_URL}?page=detail`, { waitUntil: "domcontentloaded" });
    await handleAuth(page);
    expect(res?.status()).toBeLessThan(400);
  });

  test("B-2b: page=detail (testData.patientId) に患者情報または来院履歴が表示される", async ({ page }) => {
    if (!TEST_PID) { test.skip(true, "testData.patientId 未設定"); return; }
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=detail&patientId=${TEST_PID}`, { waitUntil: "domcontentloaded" });
    await handleAuth(page);
    const frame = gasFrame(page);
    const shown = await Promise.race([
      frame.locator("#pt-name").waitFor({ state: "visible", timeout: LOAD_TIMEOUT }).then(() => true).catch(() => false),
      frame.locator("#error-msg").waitFor({ state: "visible", timeout: LOAD_TIMEOUT }).then(() => true).catch(() => false),
    ]);
    expect(shown).toBe(true);
  });

  test("B-2c: 「来院記録を追加」ボタンが表示される", async ({ page }) => {
    if (!TEST_PID) { test.skip(true, "testData.patientId 未設定"); return; }
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=detail&patientId=${TEST_PID}`, { waitUntil: "domcontentloaded" });
    await handleAuth(page);
    const frame = gasFrame(page);
    await frame.locator("#pt-name").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    await expect(frame.locator("#btn-visit-new")).toBeVisible({ timeout: LOAD_TIMEOUT });
  });

  test("B-2d: page=detail が横スクロールなしで表示される", async ({ page }) => {
    if (!TEST_PID) { test.skip(true, "testData.patientId 未設定"); return; }
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=detail&patientId=${TEST_PID}`, { waitUntil: "domcontentloaded" });
    await handleAuth(page);
    expect(await noHScroll(page)).toBe(true);
  });
});

// ── C. WEB-2.5 フォーム確認 ──────────────────────────────────────────

test.describe(`[Mobile] C-1: visitNew フォーム表示 [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test("C-1a: page=visitNew が横スクロールなしで表示される", async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=visitNew`, { waitUntil: "domcontentloaded" });
    await handleAuth(page);
    expect(await noHScroll(page)).toBe(true);
  });

  test("C-1b: patient-chip に「未指定」が表示される (patientId なし)", async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=visitNew`, { waitUntil: "domcontentloaded" });
    await handleAuth(page);
    const frame = gasFrame(page);
    await expect(frame.locator("#patient-chip")).toContainText("未指定", { timeout: LOAD_TIMEOUT });
  });

  test("C-1c: 必須フォーム要素がすべて表示される", async ({ page }) => {
    if (!TEST_PID) { test.skip(true, "testData.patientId 未設定"); return; }
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=visitNew&patientId=${TEST_PID}`, { waitUntil: "domcontentloaded" });
    await handleAuth(page);
    const frame = gasFrame(page);
    for (const sel of ["#visitDate", "#accountingType", "#kubun", "#bodyPart", "#disease"]) {
      await expect(frame.locator(sel)).toBeVisible({ timeout: LOAD_TIMEOUT });
    }
  });

  test("C-1d: patient-chip にpatinetId が表示される", async ({ page }) => {
    if (!TEST_PID) { test.skip(true, "testData.patientId 未設定"); return; }
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=visitNew&patientId=${TEST_PID}`, { waitUntil: "domcontentloaded" });
    await handleAuth(page);
    const frame = gasFrame(page);
    await expect(frame.locator("#patient-chip")).toContainText(TEST_PID, { timeout: LOAD_TIMEOUT });
  });

  test("C-1e: 前回引き継ぎボタンが表示される", async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=visitNew`, { waitUntil: "domcontentloaded" });
    await handleAuth(page);
    const frame = gasFrame(page);
    await expect(frame.locator("#inheritBtn")).toBeVisible({ timeout: LOAD_TIMEOUT });
  });

  test("C-1f: 保存ボタンが表示される", async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=visitNew`, { waitUntil: "domcontentloaded" });
    await handleAuth(page);
    const frame = gasFrame(page);
    await expect(frame.locator(".btn-save")).toBeVisible({ timeout: LOAD_TIMEOUT });
  });
});

test.describe(`[Mobile] C-2: 必須バリデーション [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test("C-2: 必須未入力で保存ボタン → モーダルが開かない", async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=visitNew`, { waitUntil: "domcontentloaded" });
    await handleAuth(page);
    const frame = gasFrame(page);
    await frame.locator(".btn-save").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    page.on("dialog", async (d) => await d.accept());
    await frame.locator(".btn-save").click();
    const opened = await frame.locator(".modal-overlay.open").isVisible({ timeout: 3000 }).catch(() => false);
    expect(opened).toBe(false);
  });
});

test.describe(`[Mobile] C-3: 確認モーダル [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test("C-3a: 全必須入力後にモーダルが開く", async ({ page }) => {
    if (!TEST_PID) { test.skip(true, "testData.patientId 未設定"); return; }
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=visitNew&patientId=${TEST_PID}`, { waitUntil: "domcontentloaded" });
    await handleAuth(page);
    const frame = gasFrame(page);
    await frame.locator(".btn-save").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    await frame.locator("#bodyPart").fill("腰部");
    await frame.locator("#disease").fill("捻挫");
    await frame.locator(".btn-save").click();
    await expect(frame.locator("#confirmModal")).toHaveClass(/open/, { timeout: LOAD_TIMEOUT });
  });

  test("C-3b: モーダルに「自動判定」が表示される", async ({ page }) => {
    if (!TEST_PID) { test.skip(true, "testData.patientId 未設定"); return; }
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=visitNew&patientId=${TEST_PID}`, { waitUntil: "domcontentloaded" });
    await handleAuth(page);
    const frame = gasFrame(page);
    await frame.locator(".btn-save").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    await frame.locator("#bodyPart").fill("腰部");
    await frame.locator("#disease").fill("捻挫");
    await frame.locator(".btn-save").click();
    await expect(frame.locator("#confirmModal")).toHaveClass(/open/, { timeout: LOAD_TIMEOUT });
    await expect(frame.locator("#confirmTable")).toContainText("自動判定", { timeout: 5000 });
  });

  test("C-3c: モーダルに「請求確定ではありません」が表示される", async ({ page }) => {
    if (!TEST_PID) { test.skip(true, "testData.patientId 未設定"); return; }
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=visitNew&patientId=${TEST_PID}`, { waitUntil: "domcontentloaded" });
    await handleAuth(page);
    const frame = gasFrame(page);
    await frame.locator(".btn-save").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    await frame.locator("#bodyPart").fill("腰部");
    await frame.locator("#disease").fill("捻挫");
    await frame.locator(".btn-save").click();
    await expect(frame.locator("#confirmModal")).toHaveClass(/open/, { timeout: LOAD_TIMEOUT });
    await expect(frame.locator(".modal-box .warn-box")).toContainText("請求確定ではありません", { timeout: 5000 });
  });

  test("C-3d: キャンセルボタンでモーダルが閉じる", async ({ page }) => {
    if (!TEST_PID) { test.skip(true, "testData.patientId 未設定"); return; }
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=visitNew&patientId=${TEST_PID}`, { waitUntil: "domcontentloaded" });
    await handleAuth(page);
    const frame = gasFrame(page);
    await frame.locator(".btn-save").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    await frame.locator("#bodyPart").fill("腰部");
    await frame.locator("#disease").fill("捻挫");
    await frame.locator(".btn-save").click();
    await expect(frame.locator("#confirmModal")).toHaveClass(/open/, { timeout: LOAD_TIMEOUT });
    await frame.locator(".btn-cancel").click();
    const stillOpen = await frame.locator(".modal-overlay.open").isVisible({ timeout: 3000 }).catch(() => false);
    expect(stillOpen).toBe(false);
  });

  test("C-3e: コンソール重大エラーなし", async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const t = msg.text();
        if (!t.includes("google") && !t.includes("gstatic") && !t.includes("frame") &&
            !t.includes("ResizeObserver") && !t.includes("favicon")) {
          errors.push(t);
        }
      }
    });
    await page.goto(`${DEV_URL}?page=visitNew`, { waitUntil: "domcontentloaded" });
    await handleAuth(page);
    await page.waitForTimeout(2000);
    if (errors.length) console.log("[C-3e] console errors:", errors);
    expect(errors.length).toBe(0);
  });
});

// ── D. 成功画面確認（保存テスト / テスト用固定日付）──────────────────

test.describe(`[Mobile] D-1: 成功画面 (保存テスト) [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test("D-1: 保存成功 → 候補金額・「請求確定ではありません」が表示される", async ({ page }) => {
    if (!TEST_PID) { test.skip(true, "testData.patientId 未設定"); return; }
    page.setDefaultTimeout(45_000);
    await page.goto(`${DEV_URL}?page=visitNew&patientId=${TEST_PID}`, { waitUntil: "domcontentloaded" });
    await handleAuth(page);
    const frame = gasFrame(page);
    await frame.locator(".btn-save").waitFor({ state: "visible", timeout: 35_000 });

    // テスト用固定日付
    await frame.locator("#visitDate").fill(TEST_DATE);
    await frame.locator("#bodyPart").fill("腰部");
    await frame.locator("#disease").fill("捻挫");
    await frame.locator("#injuryDate").fill("2999-12-01");
    await frame.locator("#warm").check();

    page.on("dialog", async (d) => await d.accept());

    await frame.locator(".btn-save").click();
    await expect(frame.locator("#confirmModal")).toHaveClass(/open/, { timeout: 35_000 });
    await frame.locator(".btn-confirm").click();

    await frame.locator("#result-panel").waitFor({ state: "visible", timeout: 45_000 });
    const text = await frame.locator("#result-panel").innerText({ timeout: 45_000 }).catch(() => "");
    console.log(`[D-1] 結果パネル:\n${text}`);

    const isSuccess   = text.includes("✅");
    const isDuplicate = text.includes("❌") && (text.includes("DUPLICATE") || text.includes("既に登録"));

    if (isSuccess) {
      console.log(`[D-1] 新規保存 PASS  TEST_VK: ${TEST_VK}`);
      expect(text).toContain(TEST_DATE);
      expect(text.includes("¥") || text.includes("候補")).toBe(true);
      expect(text).toContain("請求確定ではありません");
    } else if (isDuplicate) {
      console.log(`[D-1] DUPLICATE_VISIT（前回テストデータ残存）TEST_VK: ${TEST_VK}`);
    } else {
      expect(isSuccess || isDuplicate).toBe(true);
    }
  });
});
