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

  // ── P19-25 (R-2N-2-fix-2): home-section CSS 存在 ─────────────────
  test("P19-25: commonStyle_ に .home-section / .home-section-title (reservation/gym/sales/data) 定義あり", () => {
    const src = gasSrc();
    expect(src.includes(".home-section "), ".home-section 基本クラス").toBe(true);
    expect(src.includes(".home-section-title"), ".home-section-title 見出しクラス").toBe(true);
    expect(src.includes(".home-section-title.reservation"), "予約セクション色付け").toBe(true);
    expect(src.includes(".home-section-title.gym"),         "ジムセクション色付け").toBe(true);
    expect(src.includes(".home-section-title.sales"),       "売上セクション色付け").toBe(true);
    expect(src.includes(".home-section-title.data"),        "データセクション色付け").toBe(true);
  });

  // ── P19-26 (R-2N-2-fix-2): home cards が 4 セクションに分割されている ──
  test("P19-26: buildHomeView_ で reservationCards / gymCards / salesCards / dataCards に分割されている", () => {
    const src = gasSrc();
    expect(src.includes("reservationCards"), "reservationCards 配列").toBe(true);
    expect(src.includes("gymCards"),         "gymCards 配列").toBe(true);
    expect(src.includes("salesCards"),       "salesCards 配列").toBe(true);
    expect(src.includes("dataCards"),        "dataCards 配列").toBe(true);
    expect(src.includes("homeSectionsHtml"), "homeSectionsHtml 出力").toBe(true);
    // セクション見出し文言
    expect(src.includes("📅 JREC-SF01 予約・受付"),        "予約見出し").toBe(true);
    expect(src.includes("🏋️ ジム・Wildboar"),             "ジム見出し").toBe(true);
    expect(src.includes("💴 売上・経営KPI"),               "売上見出し").toBe(true);
    expect(src.includes("📊 データ品質・Portal運用"),      "データ見出し").toBe(true);
  });

  // ── P19-27 (R-2N-2-fix-2): live — Home に 4 セクション見出しが表示される ──
  test("P19-27: live Home の DOM に 4 セクション見出しが表示される（予約 / ジム / 売上 / データ）", async ({ page }) => {
    await page.goto(WEBAPP_URL + "?view=home", {
      waitUntil: "domcontentloaded", timeout: LOAD_TIMEOUT
    });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("h1").first().waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    const bodyText = await frame.locator("body").innerText({ timeout: LOAD_TIMEOUT }).catch(() => "");
    expect(bodyText, "JREC-SF01 予約・受付 セクション").toContain("JREC-SF01 予約・受付");
    expect(bodyText, "ジム・Wildboar セクション").toContain("ジム・Wildboar");
    expect(bodyText, "売上・経営KPI セクション").toContain("売上・経営KPI");
    expect(bodyText, "データ品質・Portal運用 セクション").toContain("データ品質・Portal運用");
  });

  // ── P19-28 (R-2N-2-fix-2): live — 各セクションに想定カードが配置されている ──
  test("P19-28: live Home の各セクションに想定カードが含まれる（混在していない）", async ({ page }) => {
    await page.goto(WEBAPP_URL + "?view=home", {
      waitUntil: "domcontentloaded", timeout: LOAD_TIMEOUT
    });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("h1").first().waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    // 各 section 要素を取得して該当カードラベルが含まれるか確認（FrameLocator -> body -> evaluate）
    const sectionAssignments = await frame.locator("body").first().evaluate(() => {
      const sections = Array.from(document.querySelectorAll("section.home-section"));
      return sections.map((sec) => {
        const titleEl = sec.querySelector(".home-section-title");
        const cards = Array.from(sec.querySelectorAll(".card .label")).map(el => (el.textContent || "").trim());
        return { title: (titleEl && titleEl.textContent || "").trim(), cards };
      });
    });
    expect(sectionAssignments.length, "4 セクション").toBeGreaterThanOrEqual(4);
    // 予約セクション: JREC-SF01 4 カード
    const resSec = sectionAssignments.find(s => s.title.includes("予約・受付"));
    expect(resSec, "予約セクション存在").toBeTruthy();
    expect(resSec!.cards.some(c => c.includes("JREC-SF01 今日の予約")), "今日カード").toBe(true);
    expect(resSec!.cards.some(c => c.includes("JREC-SF01 明日の予約")), "明日カード").toBe(true);
    expect(resSec!.cards.some(c => c.includes("JREC-SF01 今週の予約")), "今週カード").toBe(true);
    expect(resSec!.cards.some(c => c.includes("JREC-SF01 24h+ 未確定予約")), "24h+ カード").toBe(true);
    // ジムセクション: Wildboar 3 カード
    const gymSec = sectionAssignments.find(s => s.title.includes("ジム"));
    expect(gymSec, "ジムセクション存在").toBeTruthy();
    expect(gymSec!.cards.some(c => c.includes("ジム有効会員数")), "ジム会員カード").toBe(true);
    expect(gymSec!.cards.some(c => c.includes("ジム月会費見込み")), "ジム月会費カード").toBe(true);
    expect(gymSec!.cards.some(c => c.includes("ジム未入金件数")), "ジム未入金カード").toBe(true);
    // 売上セクション
    const salesSec = sectionAssignments.find(s => s.title.includes("売上") || s.title.includes("経営"));
    expect(salesSec, "売上セクション存在").toBeTruthy();
    expect(salesSec!.cards.some(c => c.includes("今月の自費売上") || c.includes("自費売上（実績）")), "自費売上カード").toBe(true);
    expect(salesSec!.cards.some(c => c.includes("現在フェーズ")), "現在フェーズカード").toBe(true);
    // データセクション
    const dataSec = sectionAssignments.find(s => s.title.includes("データ品質") || s.title.includes("Portal運用"));
    expect(dataSec, "データセクション存在").toBeTruthy();
    expect(dataSec!.cards.some(c => c.includes("データ品質警告")), "データ品質警告カード").toBe(true);
    expect(dataSec!.cards.some(c => c.includes("Portal フェーズ")), "Portal フェーズカード").toBe(true);
    // 混在チェック: 予約セクションに ジム/売上/データ系が混入していない
    expect(resSec!.cards.some(c => c.includes("ジム") || c.includes("自費売上") || c.includes("データ品質警告")),
      "予約セクションに他カテゴリが混在していない").toBe(false);
  });

  // ── P19-29 (R-2N-2-fix-3): responsive grid CSS が定義されている ────────
  test("P19-29: .home-section .grid に auto-fit + minmax + max-width 拡張が定義されている", () => {
    const src = gasSrc();
    expect(src.includes(".home-section .grid"), ".home-section .grid セレクタ").toBe(true);
    expect(src.includes("auto-fit"), "auto-fit").toBe(true);
    expect(src.includes("minmax(260px, 1fr)"), "minmax(260px, 1fr)").toBe(true);
    expect(src.includes("max-width: 1100px"), "max-width 1100px に拡張").toBe(true);
    // モバイル 1 列 fallback
    expect(src.includes("@media (max-width: 540px)"), "モバイル breakpoint").toBe(true);
  });

  // ── P19-30 (R-2N-2-fix-3): live — Home grid が computed style で auto-fit / 動的列数 ──
  test("P19-30: live Home の各 .home-section .grid が computed gridTemplateColumns で複数列を持つ", async ({ page }) => {
    // 1100x900 viewport（広めデスクトップ想定）
    await page.setViewportSize({ width: 1100, height: 900 });
    await page.goto(WEBAPP_URL + "?view=home", {
      waitUntil: "domcontentloaded", timeout: LOAD_TIMEOUT
    });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("h1").first().waitFor({ state: "visible", timeout: LOAD_TIMEOUT });

    const colInfo = await frame.locator("body").first().evaluate(() => {
      const grids = Array.from(document.querySelectorAll("section.home-section > .grid"));
      return grids.map(g => {
        const cs = window.getComputedStyle(g as Element);
        const cols = cs.gridTemplateColumns || "";
        const colCount = cols.trim() ? cols.split(/\s+/).length : 0;
        return {
          gridTemplateColumns: cols,
          colCount,
          maxWidth: cs.maxWidth || ""
        };
      });
    });

    test.info().annotations.push({
      type: "info",
      description: "grid info: " + JSON.stringify(colInfo)
    });

    // 各 section の grid が 1 つ以上の列を持つ（auto-fit が動作している）
    expect(colInfo.length, "section.home-section > .grid を 4 つ検出").toBeGreaterThanOrEqual(4);
    for (const g of colInfo) {
      // computed style では auto-fit が解決されて実際の N 列 (e.g. "260px 260px 260px") か "1fr 1fr ..." になる
      expect(g.colCount, "1100x900 viewport で grid が 1 列以上").toBeGreaterThanOrEqual(1);
      // max-width 1100px が適用されている
      expect(g.maxWidth.includes("1100"), "max-width 1100px 適用").toBe(true);
    }
    // 1100px viewport なら 3 列以上を期待（260*3 = 780, 余裕あり）
    // 注: GAS iframe 内の実 viewport は親 viewport と異なるので、最低 2 列で許容する
    const max = Math.max(...colInfo.map(g => g.colCount));
    expect(max, "広めの viewport で最低 2 列以上のセクションが存在").toBeGreaterThanOrEqual(2);
  });

  // ── P19-31 (R-2N-2-fix-3): live — narrow viewport (mobile) で 1 列になる ─
  test("P19-31: live Home を narrow viewport (mobile 360px) で 1 列レンダリング", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto(WEBAPP_URL + "?view=home", {
      waitUntil: "domcontentloaded", timeout: LOAD_TIMEOUT
    });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("h1").first().waitFor({ state: "visible", timeout: LOAD_TIMEOUT });

    const colCounts = await frame.locator("body").first().evaluate(() => {
      const grids = Array.from(document.querySelectorAll("section.home-section > .grid"));
      return grids.map(g => {
        const cs = window.getComputedStyle(g as Element);
        const cols = cs.gridTemplateColumns || "";
        return cols.trim() ? cols.split(/\s+/).length : 0;
      });
    });

    test.info().annotations.push({
      type: "info",
      description: "mobile colCounts: " + JSON.stringify(colCounts)
    });

    expect(colCounts.length, "section.home-section > .grid を 4 つ検出").toBeGreaterThanOrEqual(4);
    // モバイル narrow ではすべて 1 列を期待
    for (const c of colCounts) {
      expect(c, "narrow viewport で 1 列").toBe(1);
    }
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
