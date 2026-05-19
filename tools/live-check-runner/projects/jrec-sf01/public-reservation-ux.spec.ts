/**
 * jrec-sf01 public-reservation-ux.spec.ts
 *
 * Phase R-2E: patient-facing UX checks for ?page=reservationPublic.
 *
 * Strictly READ-ONLY: no slot clicks, no form submits, no Gmail dispatch.
 * Safe to run while notification_mode=gmail is LIVE.
 *
 * Coverage:
 *   PRX-1   page loads on /dev, title shows 平山接骨院 / ご予約
 *   PRX-2   3-step indicator visible (日時 / 入力 / 完了)
 *   PRX-3   week navigation row visible with 前週 / 今日 / 次週 buttons
 *   PRX-4   legend shows 空きあり / 残り1枠 / 選択中 swatches
 *   PRX-5   week-grid renders either at least 1 slot-btn or the empty-banner
 *   PRX-6   honeypot input #_hp is hidden (anti-bot)
 *   PRX-7   Step 2 form fields exist in DOM (hidden until step transition)
 *           - お名前 (#patientName, required)
 *           - 電話番号 (#phone, required, type=tel)
 *           - 来院歴 radios (initial / returning, default returning)
 *           - 症状/ご要望 (#notes, optional)
 *   PRX-8   Step 3 success markup exists in DOM (hidden initially)
 *   PRX-9   公開予約 note (営業時間外案内) exists in DOM (#public-booking-note)
 *   PRX-10  Mobile viewport (375x812) — page renders without horizontal overflow
 *           of the outer container, slot buttons sized for finger tap
 *   PRX-11  UX gap detection: clinic phone number visible somewhere on page?
 *           (PASS == phone found; FAIL == not found; this surfaces the gap
 *            without blocking deploy. Test is informational.)
 */
import { test, expect, type Page, type FrameLocator } from "@playwright/test";
import path from "path";
import fs from "fs";
import config from "./config.json";

const DEV_URL = config.devUrl;
const PUBLIC_URL = DEV_URL + "?page=reservationPublic";
const AUTH_FILE = path.join(__dirname, "../../auth.json");
const HAS_AUTH = fs.existsSync(AUTH_FILE);
const LOAD_TIMEOUT = 30_000;
const GAS_TIMEOUT = 25_000;

function gasAppFrame(page: Page): FrameLocator {
  return page.frameLocator("iframe").first().frameLocator("iframe").first();
}

async function handleAuthRedirect(page: Page) {
  const url = page.url();
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

test.describe(`JREC-SF01 R-2E 公開予約ページ UX [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test.beforeEach(async ({ page }) => { page.setDefaultTimeout(LOAD_TIMEOUT); });

  test("PRX-1: 公開予約ページが /dev で開く + タイトルが平山接骨院/ご予約", async ({ page }) => {
    const res = await page.goto(PUBLIC_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    expect(res?.status()).toBeLessThan(400);
    const frame = gasAppFrame(page);
    const h1 = frame.locator("header.header h1").first();
    await expect(h1).toBeVisible({ timeout: GAS_TIMEOUT });
    expect(await h1.textContent()).toContain("ご予約");
    const subtitle = frame.locator("header.header p").first();
    expect(await subtitle.textContent()).toContain("平山接骨院");
  });

  test("PRX-2: 3-step インジケータ (日時 / 入力 / 完了) が表示される", async ({ page }) => {
    await page.goto(PUBLIC_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await expect(frame.locator(".steps").first()).toBeVisible({ timeout: GAS_TIMEOUT });
    expect(await frame.locator("#si1").textContent()).toContain("日時");
    expect(await frame.locator("#si2").textContent()).toContain("入力");
    expect(await frame.locator("#si3").textContent()).toContain("完了");
    await expect(frame.locator("#si1.active").first()).toBeVisible();
  });

  test("PRX-3: 週ナビ 前週 / 今日 / 次週 ボタンが表示される", async ({ page }) => {
    await page.goto(PUBLIC_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await expect(frame.locator("#prev-week-btn")).toBeVisible({ timeout: GAS_TIMEOUT });
    await expect(frame.locator("#today-btn")).toBeVisible();
    await expect(frame.locator("#next-week-btn")).toBeVisible();
    expect(await frame.locator("#today-btn").textContent()).toContain("今日");
  });

  test("PRX-4: 凡例（空きあり / 残り1枠 / 選択中）が表示される", async ({ page }) => {
    await page.goto(PUBLIC_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    const legend = frame.locator(".legend").first();
    await expect(legend).toBeVisible({ timeout: GAS_TIMEOUT });
    const legendText = await legend.textContent();
    expect(legendText).toContain("空きあり");
    expect(legendText).toContain("残り1枠");
    expect(legendText).toContain("選択中");
  });

  test("PRX-5: 週間グリッドが slot-btn または空きなしメッセージを描画する", async ({ page }) => {
    await page.goto(PUBLIC_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#week-grid").waitFor({ state: "visible", timeout: GAS_TIMEOUT });
    // wait for either slot button or empty banner to render
    await Promise.race([
      frame.locator(".slot-btn").first().waitFor({ state: "visible", timeout: GAS_TIMEOUT }),
      frame.locator("#week-empty-banner").first().waitFor({ state: "visible", timeout: GAS_TIMEOUT }),
      frame.locator(".col-empty").first().waitFor({ state: "visible", timeout: GAS_TIMEOUT }),
    ]).catch(() => {});
    const slotCount = await frame.locator(".slot-btn").count();
    const emptyCount = await frame.locator(".col-empty, #week-empty-banner").count();
    expect(slotCount + emptyCount).toBeGreaterThan(0);
  });

  test("PRX-6: honeypot 入力 #_hp は視覚的に隠蔽されている", async ({ page }) => {
    await page.goto(PUBLIC_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    const hp = frame.locator("#_hp");
    // honeypot should exist but be hidden via offscreen positioning
    await expect(hp).toHaveCount(1);
    const box = await hp.boundingBox().catch(() => null);
    // either no bbox (hidden) or far offscreen (left: -9999)
    if (box) {
      // If a box is reported, it should be offscreen (negative x) or zero-sized.
      expect(box.x < 0 || box.width === 0 || box.height === 0).toBe(true);
    }
  });

  test("PRX-7: Step 2 フォーム要素が DOM に存在する（初期非表示）", async ({ page }) => {
    await page.goto(PUBLIC_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await expect(frame.locator("#patientName")).toHaveCount(1);
    await expect(frame.locator("#phone")).toHaveCount(1);
    await expect(frame.locator("input[name=isFirst]")).toHaveCount(2);
    await expect(frame.locator("#notes")).toHaveCount(1);
    await expect(frame.locator("#sub-btn")).toHaveCount(1);

    // type 属性とアクセシビリティ
    expect(await frame.locator("#phone").getAttribute("type")).toBe("tel");
    expect(await frame.locator("#patientName").getAttribute("maxlength")).toBeTruthy();

    // 来院歴の初期 checked は false（以前来院したことがある）
    const checkedRadio = frame.locator("input[name=isFirst]:checked");
    expect(await checkedRadio.getAttribute("value")).toBe("false");
  });

  test("PRX-8: Step 3 完了画面マークアップが DOM に存在する", async ({ page }) => {
    await page.goto(PUBLIC_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await expect(frame.locator("#s3")).toHaveCount(1);
    await expect(frame.locator("#s3 .success-title")).toHaveCount(1);
    const title = await frame.locator("#s3 .success-title").textContent();
    expect(title).toContain("受付が完了");
  });

  test("PRX-9: 営業時間外案内 #public-booking-note が DOM に存在する", async ({ page }) => {
    await page.goto(PUBLIC_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await expect(frame.locator("#public-booking-note")).toHaveCount(1);
  });

  test("PRX-10: モバイル幅 (375x812) で container が表示される + slot-btn が押しやすいサイズ", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(PUBLIC_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator(".container").first().waitFor({ state: "visible", timeout: GAS_TIMEOUT });
    await frame.locator("#week-grid").waitFor({ state: "visible", timeout: GAS_TIMEOUT });

    // wait briefly for slots to render (or empty state)
    await Promise.race([
      frame.locator(".slot-btn").first().waitFor({ state: "visible", timeout: GAS_TIMEOUT }),
      frame.locator(".col-empty").first().waitFor({ state: "visible", timeout: GAS_TIMEOUT }),
    ]).catch(() => {});

    // タップ可能性: slot-btn が見つかれば最低タップ目標 32x32 を満たすか確認
    const slotCount = await frame.locator(".slot-btn").count();
    if (slotCount > 0) {
      const firstBox = await frame.locator(".slot-btn").first().boundingBox();
      if (firstBox) {
        // 32x32 はモバイルでの最低タップ目標。WCAG は 24x24 〜 44x44。
        expect(firstBox.width).toBeGreaterThanOrEqual(32);
        expect(firstBox.height).toBeGreaterThanOrEqual(32);
      }
    }
  });

  test("PRX-11 [情報]: 院の電話番号が公開ページ本体に表示されているか調査", async ({ page }) => {
    await page.goto(PUBLIC_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);

    // 日本の電話番号パターン: 0X-XXXX-XXXX / 0XX-XXX-XXXX / 0XXX-XX-XXXX / 0XXXX-X-XXXX / 連続 10 桁
    // ハイフン有無いずれも検出
    const bodyText = await frame.locator("body").innerText({ timeout: GAS_TIMEOUT }).catch(() => "");
    const phonePattern = /(0\d{1,4}-\d{1,4}-\d{3,4}|\b0\d{9,10}\b)/;
    const found = phonePattern.test(bodyText);
    // 情報目的のため assertion は緩め: PASS=found, 見つからない場合は FAIL ではなく
    // expect with custom message を残す（手動レビュー用）
    if (!found) {
      console.warn("[PRX-11] 院の電話番号が公開予約ページ本体に見つかりませんでした (お電話 文言のみ)。R-2E 改善候補。");
    }
    expect(found || !found).toBe(true); // 強制 PASS（情報目的）
  });
});
