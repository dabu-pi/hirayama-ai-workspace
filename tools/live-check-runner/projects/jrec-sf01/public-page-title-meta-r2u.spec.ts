/**
 * jrec-sf01 public-page-title-meta-r2u.spec.ts
 *
 * Phase R-2U (2026-05-22):
 *   患者向け公開ページの外側 title / meta を患者向けに修正 + 初めての方の問診票案内追加。
 *
 * 背景:
 *   - 公開予約ページ ?page=reservation を LINE / SNS で共有したとき、リンクプレビューの
 *     タイトルが内部システム名「JREC-SF01 自費カルテ・会計」と表示されていた。
 *   - 原因: JREC_SF01_Main.gs の doGet 末尾 .setTitle("JREC-SF01 自費カルテ・会計") が
 *     全ページに一括適用されており、公開予約ページが個別に setTitle されていなかった。
 *   - 修正: buildPage_ 内の reservation / reservationQrNotice / questionnairePublic 分岐に
 *           per-page .setTitle() + .addMetaTag("description", ...) を追加。
 *   - reservation-public.html に「初めての方へ」問診票案内（静的案内 / Option A）追加。
 *
 * 検証ポイント:
 *   RU-1: ?page=reservation の document.title が「平山接骨院 予約ページ」になっている（LINE preview 用）
 *   RU-2: ?page=reservation の DOM に first-visit-guide が表示される + 「問診票」「初めて」文言を含む
 *   RU-3: ?page=reservation の DOM に first-visit-guide リンク（外部 URL）が貼られていない（token URL は admin 発行のため）
 *   RU-4: ?page=reservationQrNotice の document.title が「予約QR掲示 — 平山接骨院」になっている
 *   RU-5: ?page=home の document.title は引き続き「JREC-SF01 自費カルテ・会計」（管理者向け既定維持）
 *   RU-6: ?page=reservation の 患者向け文言・PII 非露出維持（R-2S RS-13 同等の防御）
 *   RU-7: コードレベル: JREC_SF01_Main.gs に per-page setTitle 3 件 + first-visit-guide 文言
 *
 * 認証:
 *   ?page=reservation / ?page=reservationQrNotice は ANYONE_ANONYMOUS（auth 不要）
 *   ?page=home は staff URL（@103 staff = ログイン必要 / auth.json）
 *
 * 実行コマンド: npm run test:jrec:r2u-public-page-title-meta
 */
import { test, expect, type Page, type FrameLocator } from "@playwright/test";
import fs from "fs";
import path from "path";
import config from "./config.json";

// R-2U 実装は staff URL @103（AKfycbxZbwHxD...）に deploy 済。
// 公開ページ ?page=reservation / ?page=reservationQrNotice は ANYONE_ANONYMOUS で
// この URL から auth 不要で開ける。
const R2U_PROD_EXEC = "https://script.google.com/macros/s/AKfycbxZbwHxDstE1sikW5ow7tyz99PMtg1S3uyAFq099E744f5lKlPbNzl_8fFA39KUMAZWyA/exec";

const URL_RESERVATION   = R2U_PROD_EXEC + "?page=reservation";
const URL_QR_NOTICE     = R2U_PROD_EXEC + "?page=reservationQrNotice";
const URL_HOME          = R2U_PROD_EXEC + "?page=home";

const AUTH_FILE = path.join(__dirname, "../../auth.json");
const HAS_AUTH  = fs.existsSync(AUTH_FILE);

const REPO_ROOT     = path.resolve(__dirname, "../../../../gas-projects/jrec-sf01-selfpay");
const MAIN_GS_PATH  = path.join(REPO_ROOT, "JREC_SF01_Main.gs");
const RES_PUB_PATH  = path.join(REPO_ROOT, "reservation-public.html");

const LOAD_TIMEOUT = 35_000;

// JREC-SF01 public pages use double-nested iframe (FrameLocator chain), same as R-2T spec.
function gasAppFrame(page: Page): FrameLocator {
  return page.frameLocator("iframe").first().frameLocator("iframe").first();
}

test.describe(`JREC-SF01 R-2U public-page-title-meta [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test.setTimeout(90_000);

  // ── RU-1: ?page=reservation の document.title ──────────────────────
  test("RU-1: ?page=reservation の document.title が「平山接骨院 予約ページ」になっている（LINE preview 用）", async ({ page }) => {
    await page.goto(URL_RESERVATION, { waitUntil: "domcontentloaded", timeout: LOAD_TIMEOUT });
    // GAS sandbox は init JS で document.title を setTitle 値で上書きする。少し待つ。
    await page.waitForTimeout(3000);
    const docTitle = await page.title();
    test.info().annotations.push({ type: "info", description: "outer document.title = " + docTitle });
    expect(docTitle, "外側 title が患者向け").toBe("平山接骨院 予約ページ");
  });

  // ── RU-2: first-visit-guide DOM 表示確認 ──────────────────────────
  test("RU-2: ?page=reservation の DOM に first-visit-guide が表示 + 「問診票」「初めて」文言を含む", async ({ page }) => {
    await page.goto(URL_RESERVATION, { waitUntil: "domcontentloaded", timeout: LOAD_TIMEOUT });
    // ANYONE_ANONYMOUS 公開ページは userHtmlFrame パターン
    const frame = gasAppFrame(page);
    await frame.locator("body").first().waitFor({ state: "attached", timeout: LOAD_TIMEOUT });
    const guideExists = await frame.locator("#first-visit-guide").count();
    expect(guideExists, "#first-visit-guide 存在").toBeGreaterThan(0);
    const guideText = await frame.locator("#first-visit-guide").first().textContent().catch(() => "");
    expect(guideText, "「初めて来院される方へ」").toContain("初めて来院される方へ");
    expect(guideText, "「問診票」").toContain("問診票");
    expect(guideText, "「予約後」").toContain("予約後");
  });

  // ── RU-3: first-visit-guide に外部リンクなし（token URL は admin 発行のため） ──
  test("RU-3: first-visit-guide 内に外部リンク <a href> が貼られていない（Option A: 静的案内のみ）", async ({ page }) => {
    await page.goto(URL_RESERVATION, { waitUntil: "domcontentloaded", timeout: LOAD_TIMEOUT });
    const frame = gasAppFrame(page);
    await frame.locator("#first-visit-guide").first().waitFor({ state: "attached", timeout: LOAD_TIMEOUT });
    const linkCount = await frame.locator("#first-visit-guide a[href]").count();
    expect(linkCount, "first-visit-guide 内に外部リンクなし（Option A）").toBe(0);
  });

  // ── RU-4: ?page=reservationQrNotice の document.title ────────────────
  test("RU-4: ?page=reservationQrNotice の document.title が「予約QR掲示 — 平山接骨院」", async ({ page }) => {
    await page.goto(URL_QR_NOTICE, { waitUntil: "domcontentloaded", timeout: LOAD_TIMEOUT });
    await page.waitForTimeout(3000);
    const docTitle = await page.title();
    test.info().annotations.push({ type: "info", description: "QR notice title = " + docTitle });
    expect(docTitle, "QR 掲示ページ title").toBe("予約QR掲示 — 平山接骨院");
  });

  // ── RU-5: ?page=home の document.title は管理者向け既定維持 ────────
  test("RU-5: ?page=home の document.title は引き続き「JREC-SF01 自費カルテ・会計」（管理者向け既定）", async ({ page }) => {
    if (!HAS_AUTH) {
      test.skip(true, "auth.json なし: home は staff URL のため skip");
      return;
    }
    await page.goto(URL_HOME, { waitUntil: "domcontentloaded", timeout: LOAD_TIMEOUT });
    // auth redirect 確認
    const cur = page.url();
    if (cur.includes("accounts.google.com") || cur.includes("ServiceLogin")) {
      test.skip(true, "auth 期限切れ");
      return;
    }
    await page.waitForTimeout(3000);
    const docTitle = await page.title();
    test.info().annotations.push({ type: "info", description: "home title = " + docTitle });
    expect(docTitle, "home title は管理者向け既定維持").toBe("JREC-SF01 自費カルテ・会計");
  });

  // ── RU-6: PII 非露出維持（reservation 公開ページ）─────────────────
  test("RU-6: ?page=reservation DOM に PII（patientName / phone / 患者名パターン）露出なし", async ({ page }) => {
    await page.goto(URL_RESERVATION, { waitUntil: "domcontentloaded", timeout: LOAD_TIMEOUT });
    const frame = gasAppFrame(page);
    await frame.locator("body").first().waitFor({ state: "attached", timeout: LOAD_TIMEOUT });
    const bodyText = await frame.locator("body").first().evaluate((el: Element) => (el as HTMLElement).innerText || "");
    const phoneRegex = /0\d{1,3}-\d{2,4}-\d{4}/;
    const nameRegex  = /[一-龠]{2,4}\s?(?:さま|様)/;
    const fieldRegex = /patientName|linkedPatientId|reservationId/;
    expect(phoneRegex.test(bodyText), "電話番号パターン露出なし").toBe(false);
    expect(nameRegex.test(bodyText), "患者名パターン露出なし").toBe(false);
    expect(fieldRegex.test(bodyText), "PII フィールド名露出なし").toBe(false);
  });

  // ── RU-7: コードレベル — JREC_SF01_Main.gs に per-page setTitle 3 件 + first-visit-guide 文言 ──
  test("RU-7: JREC_SF01_Main.gs に per-page setTitle + reservation-public.html に first-visit-guide", () => {
    const mainSrc = fs.readFileSync(MAIN_GS_PATH, "utf-8");
    expect(mainSrc.includes('.setTitle("平山接骨院 予約ページ")'),       "reservation 分岐に setTitle").toBe(true);
    expect(mainSrc.includes('.setTitle("予約QR掲示 — 平山接骨院")'),     "reservationQrNotice 分岐に setTitle").toBe(true);
    expect(mainSrc.includes('.setTitle("自費問診票 — 平山接骨院")'),     "questionnairePublic 分岐に setTitle").toBe(true);
    expect(mainSrc.includes('publicPagesNoOverride'),                    "doGet catch-all gate").toBe(true);
    // R-2U: addMetaTag(description/application-name) は ANYONE_ANONYMOUS context で rejected されるため使わない
    //   （viewport のみ既存通り）。OGP は GAS WebApp では outer page に反映不可。

    const resPubSrc = fs.readFileSync(RES_PUB_PATH, "utf-8");
    expect(resPubSrc.includes('id="first-visit-guide"'),                 "first-visit-guide 要素 ID").toBe(true);
    expect(resPubSrc.includes("初めて来院される方へ"),                    "案内見出し文言").toBe(true);
    expect(resPubSrc.includes(".first-visit-guide"),                     ".first-visit-guide CSS class").toBe(true);
    expect(resPubSrc.includes("one-time token") || resPubSrc.includes("お一人ずつの専用 URL"), "token 方式の説明").toBe(true);
  });

  // ── R-2U-2: 拡張 — token 自動発行 + 再来時 radio + 完了画面 CTA ──────────

  // RU-8: コードレベル: submitPublicReservation で createQuestionnairePublicToken を best-effort 呼び出し
  test("RU-8: JREC_SF01_Reservation.gs の submitPublicReservation に R-2U-2 token 自動発行ロジック", () => {
    const resGsPath = path.join(REPO_ROOT, "JREC_SF01_Reservation.gs");
    const src = fs.readFileSync(resGsPath, "utf-8");
    expect(src.includes("createQuestionnairePublicToken"),                  "token 発行関数呼出").toBe(true);
    expect(src.includes("revisitSamePart"),                                 "revisitSamePart 受取り").toBe(true);
    expect(src.includes("public_reservation_first"),                        "source=public_reservation_first").toBe(true);
    expect(src.includes('"different"') && src.includes('"unknown"'),        "対象条件 different/unknown").toBe(true);
    expect(src.includes("questionnaire:"),                                  "返り値 questionnaire field").toBe(true);
    // best-effort: 失敗時は予約成功を維持
    expect(src.includes("swallowed") || src.includes("// best-effort"),     "失敗時は握りつぶす").toBe(true);
  });

  // RU-9: コードレベル: reservation-public.html に R-2U-2 form + completion screen 要素
  test("RU-9: reservation-public.html に R-2U-2 form radio + completion CTA + 制御 JS", () => {
    const src = fs.readFileSync(RES_PUB_PATH, "utf-8");
    expect(src.includes('name="revisitSamePart"'),                          "再来時 radio name").toBe(true);
    expect(src.includes('value="same"') && src.includes('value="different"') && src.includes('value="unknown"'),
      "再来時 radio 3 値").toBe(true);
    expect(src.includes('id="revisit-symptom-group"'),                      "再来時 group id").toBe(true);
    expect(src.includes("function toggleRevisitGroup"),                     "toggle 関数").toBe(true);
    expect(src.includes('id="questionnaire-cta"'),                          "完了画面 CTA 要素").toBe(true);
    expect(src.includes('id="questionnaire-cta-btn"'),                      "完了画面ボタン").toBe(true);
    expect(src.includes('id="questionnaire-cta-fallback"'),                 "fallback 表示").toBe(true);
    expect(src.includes('res.questionnaire'),                               "完了 JS で res.questionnaire 読取").toBe(true);
  });

  // RU-10: live — 公開予約ページに R-2U-2 form radio + CTA 要素が描画される（auth 不要）
  test("RU-10: live — 公開予約ページに revisit radio + 完了画面 CTA 要素が DOM に存在", async ({ page }) => {
    await page.goto(URL_RESERVATION, { waitUntil: "domcontentloaded", timeout: LOAD_TIMEOUT });
    const frame = gasAppFrame(page);
    await frame.locator("body").first().waitFor({ state: "attached", timeout: LOAD_TIMEOUT });
    // revisit radio group は default 表示（再来 checked）
    const revisitGroupCount = await frame.locator("#revisit-symptom-group").count();
    expect(revisitGroupCount, "#revisit-symptom-group 要素").toBeGreaterThan(0);
    // 3 値 radio
    const sameRadioCount      = await frame.locator('input[name="revisitSamePart"][value="same"]').count();
    const differentRadioCount = await frame.locator('input[name="revisitSamePart"][value="different"]').count();
    const unknownRadioCount   = await frame.locator('input[name="revisitSamePart"][value="unknown"]').count();
    expect(sameRadioCount,      "same radio").toBeGreaterThan(0);
    expect(differentRadioCount, "different radio").toBeGreaterThan(0);
    expect(unknownRadioCount,   "unknown radio").toBeGreaterThan(0);
    // 完了画面 CTA 要素は display:none で DOM 内に存在
    const ctaCount = await frame.locator("#questionnaire-cta").count();
    expect(ctaCount, "#questionnaire-cta 要素 DOM").toBeGreaterThan(0);
    const ctaBtnCount = await frame.locator("#questionnaire-cta-btn").count();
    expect(ctaBtnCount, "#questionnaire-cta-btn 要素 DOM").toBeGreaterThan(0);
  });

  // RU-11: live — questionnaire-cta-btn の href デフォルト値は "#" で PII を含まない（token は submit 後に JS で設定）
  test("RU-11: questionnaire-cta-btn の初期 href は PII 含まず safe（token URL は submit 成功時に JS 設定）", async ({ page }) => {
    await page.goto(URL_RESERVATION, { waitUntil: "domcontentloaded", timeout: LOAD_TIMEOUT });
    const frame = gasAppFrame(page);
    await frame.locator("body").first().waitFor({ state: "attached", timeout: LOAD_TIMEOUT });
    const initHref = await frame.locator("#questionnaire-cta-btn").first().getAttribute("href").catch(() => "");
    // 初期値は # / 空 / safe URL のいずれか。患者 PII や token raw は含まない
    expect(initHref || "", "初期 href に PII / token 含まない").not.toContain("patientName");
    expect(initHref || "", "初期 href に phone 含まない").not.toContain("phone=");
    expect(initHref || "", "初期 href に admin URL 含まない").not.toContain("page=questionnaireIssue");
  });
});
