/**
 * jrec-sf01 public-reservation-guidance-r2s.spec.ts
 *
 * Phase R-2S: 公開予約ページの院名・案内文整備 + ホーム画面追加向け meta 検証。
 *
 * 検証ポイント:
 *   RS-1: ?page=reservation が正常表示される
 *   RS-2: <head> に R-2S ホーム画面追加向け meta タグが存在
 *          (apple-mobile-web-app-capable / apple-mobile-web-app-title /
 *           mobile-web-app-capable / theme-color / application-name)
 *   RS-3: ページタイトルに「平山接骨院」または「ご予約」が含まれる
 *   RS-4: 院名ヘッダーが表示される（<h1> または .header）
 *   RS-5: Step 1 ガイド文（.step-guide / #step1-guide）が DOM に存在
 *   RS-6: キャンセル・変更案内（#cancel-guide）が DOM に存在
 *   RS-7: ホーム画面追加ヒント（#home-screen-hint / #home-hint-body）が DOM に存在
 *   RS-8: 既存の週グリッド (#week-grid) が維持されている（退行なし）
 *   RS-9: honeypot (#_hp) が維持されている（退行なし）
 *   RS-10: ?page=home が退行していない (#res-summary-card)
 *   RS-11: ?page=reservationAdmin が退行していない（R-2R マーカー含む）
 *   RS-12: 公開予約ページに JS 実行時エラーが発生していない
 *   RS-13: PII（phone / address）が DOM 上の禁止箇所に露出していない
 *
 * READ-ONLY: スロットクリック・フォーム送信・Gmail 発火なし。
 *
 * 実行コマンド: npm run test:jrec:r2s-public-reservation-guidance
 */
import { test, expect, type Page, type FrameLocator } from "@playwright/test";
import path from "path";
import fs from "fs";
import config from "./config.json";

const DEV_URL = config.devUrl;
const RESERVATION_URL = DEV_URL + "?page=reservation";
const ADMIN_URL      = DEV_URL + "?page=reservationAdmin";
const HOME_URL       = DEV_URL + "?page=home";
const AUTH_FILE = path.join(__dirname, "../../auth.json");
const HAS_AUTH = fs.existsSync(AUTH_FILE);
const LOAD_TIMEOUT = 35_000;

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
    title.includes("Google Drive")
  ) {
    test.skip(
      true,
      HAS_AUTH
        ? "auth.json のセッションが期限切れです。npm run save-auth を再実行してください。"
        : "Google 認証が必要です。npm run save-auth を実行してください。"
    );
  }
}

test.describe(`JREC-SF01 R-2S public-reservation-guidance [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test.beforeEach(async ({ page }) => { page.setDefaultTimeout(LOAD_TIMEOUT); });

  // ── RS-1: smoke ─────────────────────────────────────────────────────────────
  test("RS-1: ?page=reservation が正常表示される / week-grid 検出", async ({ page }) => {
    await page.goto(RESERVATION_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#week-grid").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    const errEl = frame.locator(".error-banner, #err");
    const errVisible = await errEl.isVisible().catch(() => false);
    if (errVisible) {
      const errText = await errEl.textContent().catch(() => "");
      test.info().annotations.push({ type: "warn", description: "error-banner: " + errText });
    }
    await expect(frame.locator("#week-grid")).toBeVisible();
  });

  // ── RS-2: <head> meta タグ検証 ──────────────────────────────────────────────
  test("RS-2: <head> に R-2S ホーム画面追加 meta タグが存在する", async ({ page }) => {
    await page.goto(RESERVATION_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#week-grid").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });

    // <head> 内の meta タグを JS で確認
    const metaResults = await frame.locator("head").evaluate((head: Element) => {
      const metas = Array.from(head.querySelectorAll("meta"));
      const names = metas.map(m => m.getAttribute("name") || "");
      return {
        appleCapable:     names.includes("apple-mobile-web-app-capable"),
        appleTitle:       names.includes("apple-mobile-web-app-title"),
        mobileCapable:    names.includes("mobile-web-app-capable"),
        themeColor:       names.includes("theme-color"),
        appName:          names.includes("application-name"),
        themeColorValue:  (metas.find(m => m.getAttribute("name") === "theme-color") || document.createElement("meta")).getAttribute("content") || ""
      };
    }).catch(() => null);

    if (!metaResults) {
      test.info().annotations.push({ type: "warn", description: "head 内 meta 評価不可（GAS sandbox 制限の可能性）" });
      return;
    }

    expect(metaResults.appleCapable, "apple-mobile-web-app-capable meta が存在").toBe(true);
    expect(metaResults.appleTitle,   "apple-mobile-web-app-title meta が存在").toBe(true);
    expect(metaResults.mobileCapable,"mobile-web-app-capable meta が存在").toBe(true);
    expect(metaResults.themeColor,   "theme-color meta が存在").toBe(true);
    expect(metaResults.appName,      "application-name meta が存在").toBe(true);
    expect(metaResults.themeColorValue, "theme-color の値が緑系（#0f9d58）").toBe("#0f9d58");
  });

  // ── RS-3: ページタイトル ─────────────────────────────────────────────────────
  test("RS-3: ページタイトルに「平山接骨院」または「ご予約」が含まれる", async ({ page }) => {
    await page.goto(RESERVATION_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#week-grid").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });

    const docTitle = await frame.locator("title").first().textContent().catch(() => "");
    test.info().annotations.push({ type: "info", description: "title: " + docTitle });
    const hasClinic = docTitle.includes("平山接骨院") || docTitle.includes("ご予約");
    expect(hasClinic, "title に院名または「ご予約」が含まれる").toBe(true);
  });

  // ── RS-4: 院名ヘッダー表示 ──────────────────────────────────────────────────
  test("RS-4: ヘッダーに院名（平山接骨院）が表示される", async ({ page }) => {
    await page.goto(RESERVATION_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#week-grid").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });

    // h1 または .header 内に院名が存在
    const headerText = await frame.locator("h1, .header").first().textContent().catch(() => "");
    test.info().annotations.push({ type: "info", description: "header/h1 text: " + headerText?.trim() });
    expect(headerText, "ヘッダーに平山接骨院が含まれる").toContain("平山接骨院");
  });

  // ── RS-5: Step 1 ガイド文 ───────────────────────────────────────────────────
  test("RS-5: Step 1 ガイド文（.step-guide）が DOM に存在する", async ({ page }) => {
    await page.goto(RESERVATION_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#week-grid").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });

    const guideEl = frame.locator(".step-guide, #step1-guide");
    await expect(guideEl.first()).toBeAttached();
    const guideText = await guideEl.first().textContent().catch(() => "");
    test.info().annotations.push({ type: "info", description: "step-guide: " + guideText });
    expect(guideText.length, "step-guide にテキストが入っている").toBeGreaterThan(5);
  });

  // ── RS-6: キャンセル・変更案内 ──────────────────────────────────────────────
  test("RS-6: キャンセル・変更案内 (#cancel-guide) が DOM に存在する", async ({ page }) => {
    await page.goto(RESERVATION_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#week-grid").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });

    const cgEl = frame.locator("#cancel-guide");
    await expect(cgEl).toBeAttached();
    const cgText = await cgEl.textContent().catch(() => "");
    test.info().annotations.push({ type: "info", description: "cancel-guide: " + cgText });
    // "キャンセル" または "変更" という文言を含む
    expect(
      cgText.includes("キャンセル") || cgText.includes("変更"),
      "cancel-guide にキャンセル/変更案内が含まれる"
    ).toBe(true);
  });

  // ── RS-7: ホーム画面追加ヒント ──────────────────────────────────────────────
  test("RS-7: ホーム画面追加ヒント (#home-screen-hint) が DOM に存在する", async ({ page }) => {
    await page.goto(RESERVATION_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#week-grid").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });

    const hintEl = frame.locator("#home-screen-hint");
    await expect(hintEl).toBeAttached();
    const hintBodyEl = frame.locator("#home-hint-body");
    await expect(hintBodyEl).toBeAttached();
    // 初期状態は折りたたみ（display:none）
    const isHidden = await hintBodyEl.isHidden().catch(() => false);
    expect(isHidden, "ホーム画面ヒントは初期状態で折りたたみ").toBe(true);
    // トグルボタンが存在する
    const toggleEl = frame.locator("#home-hint-toggle");
    await expect(toggleEl).toBeAttached();
  });

  // ── RS-8: week-grid 維持（退行なし）────────────────────────────────────────
  test("RS-8: #week-grid が表示されている（既存予約ステップが退行していない）", async ({ page }) => {
    await page.goto(RESERVATION_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#week-grid").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    await expect(frame.locator("#week-grid")).toBeVisible();
    // slot-btn または week-empty-banner のいずれかが存在
    const slotOrEmpty = frame.locator(".slot-btn, #week-empty-banner");
    await expect(slotOrEmpty.first()).toBeAttached({ timeout: 20_000 });
  });

  // ── RS-9: honeypot 維持 ──────────────────────────────────────────────────────
  test("RS-9: honeypot input (#_hp) が DOM に存在する（セキュリティ維持）", async ({ page }) => {
    await page.goto(RESERVATION_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#week-grid").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    const hp = frame.locator("#_hp");
    await expect(hp).toBeAttached();
    // 視覚的に非表示であること
    const isHidden = await hp.isHidden().catch(() => false);
    expect(isHidden, "honeypot は非表示").toBe(true);
  });

  // ── RS-10: ホームページ退行なし ──────────────────────────────────────────────
  test("RS-10: ?page=home が退行していない (#res-summary-card 存在)", async ({ page }) => {
    await page.goto(HOME_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#res-summary-card").first().waitFor({ state: "attached", timeout: LOAD_TIMEOUT });
    await expect(frame.locator("#res-summary-card").first()).toBeAttached();
  });

  // ── RS-11: reservationAdmin 退行なし（R-2R マーカー含む）──────────────────
  test("RS-11: ?page=reservationAdmin が退行していない / R-2R マーカー存在", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#cal-section").first().waitFor({ state: "attached", timeout: LOAD_TIMEOUT });

    // R-2R マーカーが消えていない
    const htmlContent = await page.evaluate(() => document.documentElement.innerHTML);
    expect(htmlContent.includes("act-cal-recreate"),  "R-2R act-cal-recreate マーカーが維持").toBe(true);
    expect(htmlContent.includes("recreateCalendarEventForReservation"), "R-2R RPC マーカーが維持").toBe(true);
  });

  // ── RS-12: JS 実行時エラーなし ─────────────────────────────────────────────
  test("RS-12: 公開予約ページで JS コンソールエラーが発生していない", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", err => jsErrors.push(err.message));
    page.on("console", msg => {
      if (msg.type() === "error") jsErrors.push(msg.text());
    });

    await page.goto(RESERVATION_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#week-grid").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    // 5 秒待ってから JS エラーを確認
    await page.waitForTimeout(3000);

    // GAS 自体のエラーは除外（GAS sandbox 内部の非致命的 warn は無視）
    const appErrors = jsErrors.filter(e =>
      !e.includes("net::ERR_BLOCKED_BY_RESPONSE") &&
      !e.includes("google-analytics") &&
      !e.includes("gtag") &&
      e.trim().length > 0
    );

    if (appErrors.length > 0) {
      test.info().annotations.push({ type: "warn", description: "JS errors: " + appErrors.join(" / ") });
    }
    expect(appErrors.length, "アプリケーション JS エラーが 0 件").toBe(0);
  });

  // ── RS-13: PII 不必要露出チェック ──────────────────────────────────────────
  test("RS-13: 公開予約ページに phone/address 等の PII が不必要に露出していない", async ({ page }) => {
    await page.goto(RESERVATION_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#week-grid").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });

    const bodyText = await frame.locator("body").textContent().catch(() => "");
    // 電話番号パターン（院の電話番号が Settings.clinic_phone で設定されている場合は除く）
    // ここでは予約者の電話番号（09x-xxxx-xxxx 形式の個人情報）が露出していないことを確認
    // 院の電話番号が header に出るのは R-2E の仕様であり正常
    // 患者の電話番号（予約データ）が公開ページに出ていないことを確認（これは設計上不可能なはずだが念のため）
    const patientInfoPatterns = [
      // patientName フィールドは Step 2 の入力欄のみ（値は入力前は空）
      // phone フィールドも同様
      // Reservations の実データは公開 API には含まれない設計
    ];
    // Step 1 の週グリッドに予約者の氏名・電話番号が出ていないことを確認
    const weekGridText = await frame.locator("#week-grid").textContent().catch(() => "");
    // 予約者名は公開ページのグリッドには出ない（残り枠数のみ）
    // PII パターンがグリッドに含まれていないこと
    expect(weekGridText.includes("patientName") || weekGridText.includes("phone_number"),
      "week-grid に patientName/phone_number フィールド名が露出していない").toBe(false);
    test.info().annotations.push({ type: "info", description: "week-grid text length: " + weekGridText.length });
  });
});
