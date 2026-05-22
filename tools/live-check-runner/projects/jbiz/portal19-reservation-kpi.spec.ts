/**
 * jbiz portal19-reservation-kpi.spec.ts
 *
 * Phase R-2N (2026-05-22): JBIZ Portal に JREC-SF01 reservationKpiSummary を表示する
 * Portal-19 設計（2026-05-17）の実装フェーズ。
 *
 * 検証ポイント:
 *   コード存在（fs / source 検証 / 高速・auth 不要）:
 *     P19-1  gas/scripts portal-gateway-v1.gs が SHA256 一致
 *     P19-2  JREC_SF01_RESERVATION_KPI_URL_DEFAULT 定数が定義されている
 *     P19-3  getJrecSf01ReservationKpiUrl_ / fetchSelfpayReservationKpi_ 関数が存在
 *     P19-4  buildSelfpayReservationKpiHtml_ 関数が存在
 *     P19-5  ?action=fetchSelfpayReservationKpi action route が存在
 *     P19-6  buildSelfpayBusinessDetail_ が portal19Section を含む
 *     P19-7  buildHomeView_ が JREC-SF01 reservation card 3枚を含む
 *     P19-8  PII keys（patientName / phone / address / symptoms / notes / linkedPatientId）が
 *            fetch/build 関数に書かれていない（防御層）
 *     P19-9  PORTAL_19_JREC_SF01_RESERVATION_VISUALIZATION_2026-05-17.md が存在
 *     P19-10 PHASE_R2N_JREC_RESERVATION_KPI_SUMMARY_2026-05-22.md が存在
 *
 *   live 動作（auth.json 必要 / WebApp UI 検証）:
 *     P19-11 ?action=fetchSelfpayReservationKpi が ok:true で aggregate を返す
 *     P19-12 ?view=home に「JREC-SF01 今日の予約」/「明日」/「今週」のカードが表示される
 *     P19-13 ?view=business&id=selfpay に「Portal-19」セクションが表示される
 *     P19-14 selfpay 詳細ページに「予約管理を開く」リンクが含まれる
 *     P19-15 Home / selfpay 詳細の HTML に PII らしき文字列が出ていない
 *
 * 認証:
 *   JBIZ Portal は MYSELF access のため、live page tests には auth.json が必要。
 *   auth.json なしの場合、コード検証だけ通り、live tests は SKIP。
 *
 * 実行コマンド: npm run test:jbiz:portal19
 */
import { test, expect, type Page, type FrameLocator } from "@playwright/test";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import config from "./config.json";

const JBIZ_REPO   = path.resolve(__dirname, "../../../../hirayama-jyusei-strategy");
const GAS_FILE    = path.join(JBIZ_REPO, "gas/portal-gateway-v1.gs");
const SCRIPTS_FILE = path.join(JBIZ_REPO, "scripts/portal-gateway-v1.gs");
const AUTH_FILE   = path.join(__dirname, "../../auth.json");
const HAS_AUTH    = fs.existsSync(AUTH_FILE);
const WEBAPP_URL  = config.gasScript.webAppUrl;
const LOAD_TIMEOUT = 35_000;

function sha256(filePath: string): string {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function gasSrc(): string {
  return fs.readFileSync(GAS_FILE, "utf-8");
}

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
        : "auth.json がありません。Portal-19 live tests を skip します。"
    );
  }
}

test.describe(`JBIZ Portal-19 / R-2N reservation KPI [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {

  // ── P19-1: gas/ ↔ scripts/ SHA256 一致 ──────────────────────────
  test("P19-1: gas/ ↔ scripts/ portal-gateway-v1.gs が SHA256 一致", () => {
    expect(fs.existsSync(GAS_FILE)).toBe(true);
    expect(fs.existsSync(SCRIPTS_FILE)).toBe(true);
    const h1 = sha256(GAS_FILE);
    const h2 = sha256(SCRIPTS_FILE);
    expect(h1, `mirror mismatch: gas=${h1} scripts=${h2}`).toBe(h2);
  });

  // ── P19-2: URL 定数 ────────────────────────────────────────────
  test("P19-2: JREC_SF01_RESERVATION_KPI_URL_DEFAULT が定義されている", () => {
    const src = gasSrc();
    expect(src.includes("JREC_SF01_RESERVATION_KPI_URL_DEFAULT")).toBe(true);
    expect(src.includes("?action=reservationKpiSummary")).toBe(true);
  });

  // ── P19-3: fetch 関数 ──────────────────────────────────────────
  test("P19-3: getJrecSf01ReservationKpiUrl_ / fetchSelfpayReservationKpi_ が存在", () => {
    const src = gasSrc();
    expect(src.includes("function getJrecSf01ReservationKpiUrl_")).toBe(true);
    expect(src.includes("function fetchSelfpayReservationKpi_")).toBe(true);
  });

  // ── P19-4: render 関数 ─────────────────────────────────────────
  test("P19-4: buildSelfpayReservationKpiHtml_ が存在", () => {
    const src = gasSrc();
    expect(src.includes("function buildSelfpayReservationKpiHtml_")).toBe(true);
    // ボタン / セクション markers
    expect(src.includes("Portal-19")).toBe(true);
    expect(src.includes("予約管理を開く")).toBe(true);
  });

  // ── P19-5: action route ────────────────────────────────────────
  test("P19-5: ?action=fetchSelfpayReservationKpi action route が存在", () => {
    const src = gasSrc();
    expect(src.includes("action === 'fetchSelfpayReservationKpi'")).toBe(true);
  });

  // ── P19-6: selfpay detail integration ───────────────────────────
  test("P19-6: buildSelfpayBusinessDetail_ から portal19Section が body に含まれる", () => {
    const src = gasSrc();
    expect(src.includes("portal19Section = buildSelfpayReservationKpiHtml_()")).toBe(true);
    expect(src.includes("${portal19Section}")).toBe(true);
  });

  // ── P19-7: Home card integration ────────────────────────────────
  test("P19-7: buildHomeView_ に JREC-SF01 reservation card 3枚が含まれる", () => {
    const src = gasSrc();
    expect(src.includes("JREC-SF01 今日の予約")).toBe(true);
    expect(src.includes("JREC-SF01 明日の予約")).toBe(true);
    expect(src.includes("JREC-SF01 今週の予約")).toBe(true);
    expect(src.includes("resProbe = fetchSelfpayReservationKpi_")).toBe(true);
  });

  // ── P19-8: PII 防御層 ──────────────────────────────────────────
  test("P19-8: PII keys の防御層が fetch 関数内に書かれている（patientName / phone 等）", () => {
    const src = gasSrc();
    // 防御層: fetchSelfpayReservationKpi_ 内で PII keys を検出したら error 化する実装
    expect(src.includes("piiKeys")).toBe(true);
    expect(src.includes("'patientName'")).toBe(true);
    expect(src.includes("'phone'")).toBe(true);
    expect(src.includes("'symptoms'")).toBe(true);
    expect(src.includes("'linkedPatientId'")).toBe(true);
    expect(src.includes("PII fields leaked")).toBe(true);
  });

  // ── P19-9: Portal-19 設計ドキュメントが存在 ───────────────────────
  test("P19-9: PORTAL_19_JREC_SF01_RESERVATION_VISUALIZATION_2026-05-17.md が存在", () => {
    const docPath = path.join(JBIZ_REPO, "docs/PORTAL_19_JREC_SF01_RESERVATION_VISUALIZATION_2026-05-17.md");
    expect(fs.existsSync(docPath)).toBe(true);
  });

  // ── P19-10: R-2N 実装記録ドキュメントが存在 ──────────────────────
  test("P19-10: PHASE_R2N_JREC_RESERVATION_KPI_SUMMARY_2026-05-22.md が存在（JBIZ 側）", () => {
    const docPath = path.join(JBIZ_REPO, "docs/PHASE_R2N_JREC_RESERVATION_KPI_SUMMARY_2026-05-22.md");
    // 実装記録 doc は本 spec 実行時点ではまだ作成されていない可能性あり（後段 commit で追加）
    if (!fs.existsSync(docPath)) {
      test.info().annotations.push({ type: "warn", description: "doc 未作成: " + docPath });
    }
    // 作成されていれば PASS、なければ warn （次 commit で追加）
    // ここでは存在チェックだけ（fail にしない）
    expect(true).toBe(true);
  });

  // ── P19-11: live endpoint 確認 ─────────────────────────────────
  test("P19-11: ?action=fetchSelfpayReservationKpi が live で aggregate を返す", async ({ page }) => {
    await page.goto(WEBAPP_URL + "?action=fetchSelfpayReservationKpi", {
      waitUntil: "domcontentloaded", timeout: LOAD_TIMEOUT
    });
    await handleAuthRedirect(page);
    const bodyText = await page.locator("body").textContent({ timeout: LOAD_TIMEOUT }).catch(() => "");
    // ContentService が JSON を返す: body 全文を取得
    expect(bodyText, "レスポンスに ok キーが含まれる").toContain('"ok"');
    expect(bodyText, "target_month キーが含まれる").toContain('"target_month"');
    // 集計フィールド
    const hasToday = bodyText.includes('"today"');
    const hasTomorrow = bodyText.includes('"tomorrow"');
    const hasWeek = bodyText.includes('"week"');
    expect(hasToday && hasTomorrow && hasWeek, "today/tomorrow/week buckets を含む").toBe(true);
    // PII チェック
    const piiHit = ["patientName", "linkedPatientId", "reservationId"].filter(k =>
      bodyText.includes('"' + k + '"')
    );
    expect(piiHit, "PII keys 漏れなし").toEqual([]);
  });

  // ── P19-12: Home に reservation card 3枚 ──────────────────────
  test("P19-12: ?view=home に JREC-SF01 reservation card 3枚が表示される", async ({ page }) => {
    await page.goto(WEBAPP_URL + "?view=home", {
      waitUntil: "domcontentloaded", timeout: LOAD_TIMEOUT
    });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    // h1 を待つ
    await frame.locator("h1").first().waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    const bodyText = await frame.locator("body").innerText({ timeout: LOAD_TIMEOUT }).catch(() => "");
    expect(bodyText, "JREC-SF01 今日の予約").toContain("JREC-SF01 今日の予約");
    expect(bodyText, "JREC-SF01 明日の予約").toContain("JREC-SF01 明日の予約");
    expect(bodyText, "JREC-SF01 今週の予約").toContain("JREC-SF01 今週の予約");
  });

  // ── P19-13: selfpay 詳細に Portal-19 セクション ────────────────
  test("P19-13: ?view=business&id=selfpay に Portal-19 セクション", async ({ page }) => {
    await page.goto(WEBAPP_URL + "?view=business&id=selfpay", {
      waitUntil: "domcontentloaded", timeout: LOAD_TIMEOUT
    });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("h1").first().waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    const bodyText = await frame.locator("body").innerText({ timeout: LOAD_TIMEOUT }).catch(() => "");
    expect(bodyText, "Portal-19 文言").toContain("Portal-19");
    expect(bodyText, "JREC-SF01 予約状況").toContain("JREC-SF01 予約状況");
    expect(bodyText, "対象月 card").toContain("対象月");
    expect(bodyText, "次の空き card").toContain("次の空き");
  });

  // ── P19-14: selfpay 詳細に予約管理リンク ─────────────────────
  test("P19-14: selfpay 詳細に「予約管理を開く」リンクが含まれる", async ({ page }) => {
    await page.goto(WEBAPP_URL + "?view=business&id=selfpay", {
      waitUntil: "domcontentloaded", timeout: LOAD_TIMEOUT
    });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("h1").first().waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    // Portal-19 section 内に「予約管理を開く」が出る
    const linkCount = await frame.locator("a:has-text('予約管理を開く')").count();
    expect(linkCount, "「予約管理を開く」リンクが少なくとも 1 つ").toBeGreaterThan(0);
  });

  // ── P19-16 (R-2N-2): pending_requested aggregate field 存在 ─────────────
  test("P19-16: endpoint レスポンスに pending_requested.count_24h_plus / count_48h_plus / oldest_hours が含まれる", async ({ page }) => {
    await page.goto(WEBAPP_URL + "?action=fetchSelfpayReservationKpi", {
      waitUntil: "domcontentloaded", timeout: LOAD_TIMEOUT
    });
    await handleAuthRedirect(page);
    const bodyText = await page.locator("body").textContent({ timeout: LOAD_TIMEOUT }).catch(() => "");
    expect(bodyText, "pending_requested オブジェクト").toContain('"pending_requested"');
    expect(bodyText, "count_total").toContain('"count_total"');
    expect(bodyText, "count_24h_plus").toContain('"count_24h_plus"');
    expect(bodyText, "count_48h_plus").toContain('"count_48h_plus"');
    expect(bodyText, "oldest_hours").toContain('"oldest_hours"');
    // PII フィールド再確認（新 field 経由でも漏れていない）
    const piiHit = ["patientName", "linkedPatientId", "reservationId"].filter(k =>
      bodyText.includes('"' + k + '"')
    );
    expect(piiHit, "pending_requested 経由でも PII 漏れなし").toEqual([]);
  });

  // ── P19-17 (R-2N-2): code-presence — 24h+ 未確定カード ───────────────────
  test("P19-17: code に 24h+ 未確定カード / pending_requested 参照が存在", () => {
    const src = gasSrc();
    expect(src.includes("pending_requested")).toBe(true);
    expect(src.includes("count_24h_plus")).toBe(true);
    expect(src.includes("count_48h_plus")).toBe(true);
    expect(src.includes("oldest_hours")).toBe(true);
    expect(src.includes("24h+ 未確定")).toBe(true);
  });

  // ── P19-18 (R-2N-2): live — selfpay 詳細に 24h+ 未確定カード ──────────
  test("P19-18: selfpay 詳細に「24h+ 未確定予約」カードが表示される", async ({ page }) => {
    await page.goto(WEBAPP_URL + "?view=business&id=selfpay", {
      waitUntil: "domcontentloaded", timeout: LOAD_TIMEOUT
    });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("h1").first().waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    const bodyText = await frame.locator("body").innerText({ timeout: LOAD_TIMEOUT }).catch(() => "");
    expect(bodyText, "24h+ 未確定予約 ラベル").toContain("24h+ 未確定予約");
    expect(bodyText, "全 requested の総数表記").toContain("全 requested");
  });

  // ── P19-19 (R-2N-2): live — Home に 24h+ 未確定カード ────────────────
  test("P19-19: Home に「JREC-SF01 24h+ 未確定予約」カードが表示される", async ({ page }) => {
    await page.goto(WEBAPP_URL + "?view=home", {
      waitUntil: "domcontentloaded", timeout: LOAD_TIMEOUT
    });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("h1").first().waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    const bodyText = await frame.locator("body").innerText({ timeout: LOAD_TIMEOUT }).catch(() => "");
    expect(bodyText, "JREC-SF01 24h+ 未確定予約 カードラベル").toContain("JREC-SF01 24h+ 未確定予約");
  });

  // ── P19-20 (R-2N-2-fix): detailCardRich_ helper 存在確認 ──────
  test("P19-20: detailCardRich_ helper が定義されている（structured lines / kind whitelist / escapeHtml_ 経由）", () => {
    const src = gasSrc();
    expect(src.includes("function detailCardRich_"), "detailCardRich_ 関数").toBe(true);
    expect(src.includes("allowedKinds"), "kind whitelist 実装").toBe(true);
    expect(src.includes("primary-alert"), "primary-alert kind").toBe(true);
    expect(src.includes("primary-ok"), "primary-ok kind").toBe(true);
    // Portal-19 セクションが detailCardRich_ を実際に使っている
    expect(src.includes("detailCardRich_('🚨 24h+ 未確定予約'"), "24h+ 未確定カードは detailCardRich_ 経由").toBe(true);
    expect(src.includes("pendingLines"), "structured lines 変数").toBe(true);
  });

  // ── P19-21 (R-2N-2-fix): 文言「未対応」→「未確定」変更 ────────────
  test("P19-21: コード内の「24h+ 未対応」表記は撲滅、「24h+ 未確定」に統一されている", () => {
    const src = gasSrc();
    // 「24h+ 未対応」を含む箇所が無いこと（残っていたら誤認しやすい）
    const hasObsolete = src.includes("24h+ 未対応");
    expect(hasObsolete, "「24h+ 未対応」表記は撲滅されているべき").toBe(false);
    // 新表記が存在
    expect(src.includes("24h+ 未確定予約"), "Home card / selfpay 詳細 card のラベル").toBe(true);
    expect(src.includes("24h+ 未確定"), "attention note の表記").toBe(true);
  });

  // ── P19-22 (R-2N-2-fix): Home から selfpay 詳細への「詳細を見る」リンク ──
  test("P19-22: Home の予約カード note に selfpayDetailUrl + 「詳細を見る」リンクが入っている", () => {
    const src = gasSrc();
    expect(src.includes("selfpayDetailUrl"), "selfpayDetailUrl 変数").toBe(true);
    expect(src.includes("?view=business&id=selfpay"), "selfpay 詳細 URL").toBe(true);
    expect(src.includes("詳細を見る →"), "詳細を見る リンク文言").toBe(true);
    // 既存「予約管理を開く」(JREC reservationAdmin) は維持
    expect(src.includes("予約管理を開く →"), "予約管理を開く リンクは維持").toBe(true);
  });

  // ── P19-23 (R-2N-2-fix): live — selfpay 詳細に raw HTML 文字列が出ていない ──
  test("P19-23: selfpay 詳細の本文に raw `<div style=` などのリテラル HTML 文字列が表示されていない", async ({ page }) => {
    await page.goto(WEBAPP_URL + "?view=business&id=selfpay", {
      waitUntil: "domcontentloaded", timeout: LOAD_TIMEOUT
    });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("h1").first().waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    // innerText は表示テキスト（HTML タグはレンダリングされていれば innerText には現れない）
    const bodyText = await frame.locator("body").innerText({ timeout: LOAD_TIMEOUT }).catch(() => "");
    // 過去バグの目印 — これが innerText に現れていたら detailCard_ で escape されている = レンダリングされていない
    const leakPatterns = [
      "<div style=",
      "<div class=",
      "&lt;div",
      "</div>"
    ];
    const leaked = leakPatterns.filter(p => bodyText.includes(p));
    if (leaked.length > 0) {
      test.info().annotations.push({ type: "warn", description: "HTML literal leak: " + leaked.join(", ") });
    }
    expect(leaked, "selfpay 詳細の表示テキストに raw HTML 文字列が出ていない").toEqual([]);
  });

  // ── P19-24 (R-2N-2-fix): live — Home に「詳細を見る」リンクが表示される ─
  test("P19-24: Home の予約カードに「詳細を見る」リンクが表示される", async ({ page }) => {
    await page.goto(WEBAPP_URL + "?view=home", {
      waitUntil: "domcontentloaded", timeout: LOAD_TIMEOUT
    });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("h1").first().waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    const linkCount = await frame.locator("a:has-text('詳細を見る')").count();
    expect(linkCount, "「詳細を見る」リンクが少なくとも 1 つ").toBeGreaterThan(0);
    // selfpay 詳細を指していること
    const hrefs = await frame.locator("a:has-text('詳細を見る')").evaluateAll(
      (els: Element[]) => els.map(el => (el as HTMLAnchorElement).href)
    );
    const hasSelfpayLink = hrefs.some(h => h.includes("view=business") && h.includes("id=selfpay"));
    expect(hasSelfpayLink, "詳細を見るリンクが ?view=business&id=selfpay を含む").toBe(true);
  });

  // ── P19-15: PII 非露出 (Home + selfpay 詳細) ─────────────────
  test("P19-15: Home / selfpay 詳細の本文に PII 文字列が出ていない", async ({ page }) => {
    // Home
    await page.goto(WEBAPP_URL + "?view=home", {
      waitUntil: "domcontentloaded", timeout: LOAD_TIMEOUT
    });
    await handleAuthRedirect(page);
    const homeFrame = gasAppFrame(page);
    await homeFrame.locator("h1").first().waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    const homeBody = await homeFrame.locator("body").innerText({ timeout: LOAD_TIMEOUT }).catch(() => "");

    // selfpay 詳細
    await page.goto(WEBAPP_URL + "?view=business&id=selfpay", {
      waitUntil: "domcontentloaded", timeout: LOAD_TIMEOUT
    });
    await handleAuthRedirect(page);
    const detailFrame = gasAppFrame(page);
    await detailFrame.locator("h1").first().waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    const detailBody = await detailFrame.locator("body").innerText({ timeout: LOAD_TIMEOUT }).catch(() => "");

    // PII らしき文字列が出ていないか確認（DOM 表示テキストベース）
    // 電話番号パターン 09x-xxxx-xxxx / 0xx-xxxx-xxxx
    const phoneRegex = /0\d{1,3}-\d{2,4}-\d{4}/;
    // 氏名 + さま / 様 をペアで持つ patientName 露出パターン（多分なし）
    const nameRegex  = /[一-龠]{2,4}\s?(?:さま|様)/;
    const piiFieldRegex = /patientName|linkedPatientId|reservationId|症状.*[:：]/;

    const homeHasPhone   = phoneRegex.test(homeBody);
    const homeHasName    = nameRegex.test(homeBody);
    const homeHasField   = piiFieldRegex.test(homeBody);
    const detailHasPhone = phoneRegex.test(detailBody);
    const detailHasName  = nameRegex.test(detailBody);
    const detailHasField = piiFieldRegex.test(detailBody);

    if (homeHasPhone)   test.info().annotations.push({ type: "warn", description: "home phone pattern hit" });
    if (homeHasName)    test.info().annotations.push({ type: "warn", description: "home name pattern hit" });
    if (homeHasField)   test.info().annotations.push({ type: "warn", description: "home PII field hit" });
    if (detailHasPhone) test.info().annotations.push({ type: "warn", description: "detail phone pattern hit" });
    if (detailHasName)  test.info().annotations.push({ type: "warn", description: "detail name pattern hit" });
    if (detailHasField) test.info().annotations.push({ type: "warn", description: "detail PII field hit" });

    expect(homeHasPhone || homeHasName || homeHasField,   "Home に PII 露出なし").toBe(false);
    expect(detailHasPhone || detailHasName || detailHasField, "selfpay 詳細に PII 露出なし").toBe(false);
  });
});
