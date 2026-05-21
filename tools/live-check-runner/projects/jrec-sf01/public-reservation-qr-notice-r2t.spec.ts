/**
 * jrec-sf01 public-reservation-qr-notice-r2t.spec.ts
 *
 * Phase R-2T (2026-05-21): 院内QR掲示用ページ ?page=reservationQrNotice の検証。
 *
 * 検証ポイント:
 *   RT-1: ?page=reservationQrNotice が HTTP < 400 で到達できる（auth 不要 / ANYONE_ANONYMOUS）
 *   RT-2: userHtmlFrame が取得でき、十分なボディが描画される
 *   RT-3: 院名（平山接骨院 / .notice-clinic-name）が表示される
 *   RT-4: タグライン「📱 スマホでかんたん予約」が表示される（.notice-tagline）
 *   RT-5: 印刷ボタン（.print-btn）が存在し window.print() を呼ぶ
 *   RT-6: QR コード描画ターゲット (#qr-canvas-container / #qr-js-target) が存在し、
 *         数秒後に qrcode.js または Google Chart fallback の img/canvas が描画される
 *   RT-7: ?page=reservation への URL（RESERVATION_URL）が #url-text に出力される
 *   RT-8: キャンセル・変更案内 (.cancel-notice) が DOM に存在
 *   RT-9: ホーム画面追加ヒント (.home-screen-notice / iPhone/Android 文言) が DOM に存在
 *   RT-10: 公開予約ページ (?page=reservation) も @100 で HTTP < 400（QR 先のリンク切れ確認）
 *
 * 認証:
 *   ANYONE_ANONYMOUS — auth.json 不要。/exec 公開 URL を直接叩く。
 *
 * GAS iframe 構造（ANYONE_ANONYMOUS 公開ページ）:
 *   page (top: script.google.com)
 *   └─ iframe[name="userHtmlFrame"]  ← page.frame({ name: "userHtmlFrame" })
 *      └─ GAS アプリ本体（googleusercontent.com 内に reservation-qr-notice.html）
 *
 * READ-ONLY: スプレッドシート書き込み・Gmail 送信なし。
 *
 * 実行コマンド: npm run test:jrec:r2t-public-reservation-qr-notice
 */
import { test, expect, type Page, type Frame } from "@playwright/test";

// Phase R-2T が deploy された @100 production exec URL（bookmark URL）
// config.prodUrl は @67 staff UI を指しており reservationQrNotice ルートが無いため、
// R-2T テストは @100 を直接ハードコードする（docs/PHASE_R2T_PUBLIC_RESERVATION_QR_NOTICE_2026-05-21.md 参照）。
const R2T_EXEC_URL =
  "https://script.google.com/macros/s/AKfycbxZbwHxDstE1sikW5ow7tyz99PMtg1S3uyAFq099E744f5lKlPbNzl_8fFA39KUMAZWyA/exec";

const QR_NOTICE_URL    = R2T_EXEC_URL + "?page=reservationQrNotice";
const RESERVATION_URL  = R2T_EXEC_URL + "?page=reservation";

const FRAME_NAME       = "userHtmlFrame";
const FRAME_HOST_HINT  = "googleusercontent.com";
const FRAME_TIMEOUT_MS = 60_000;
const FRAME_MIN_BODY   = 500;
const QR_RENDER_WAIT_MS = 8_000; // qrcode.js CDN ロード + canvas 描画待ち

async function getReadyFrame(page: Page, minLen = FRAME_MIN_BODY): Promise<Frame | null> {
  const deadline = Date.now() + FRAME_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const frame = page.frame({ name: FRAME_NAME });
    if (frame && frame.url().includes(FRAME_HOST_HINT)) {
      try {
        const len = await frame.evaluate(() =>
          document.body ? document.body.innerHTML.length : 0
        );
        if (len > minLen) return frame;
      } catch (_) { /* frame detached — retry */ }
    }
    await page.waitForTimeout(800);
  }
  return null;
}

function isKnownGasWarning(text: string): boolean {
  return (
    text.includes("Framing") ||
    text.includes("ERR_BLOCKED_BY_ORB") ||
    text.includes("csp.withgoogle.com") ||
    text.includes("googleusercontent.com") ||
    text.includes("cdnjs.cloudflare.com")
  );
}

function attachErrorCollector(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", msg => {
    if (msg.type() === "error" && !isKnownGasWarning(msg.text())) {
      errors.push("[CONSOLE] " + msg.text().slice(0, 160));
    }
  });
  page.on("pageerror", err => {
    errors.push("[PAGEERR] " + String(err.message).slice(0, 160));
  });
  return errors;
}

test.describe("JREC-SF01 R-2T public-reservation-qr-notice [auth: 不要 / ANYONE_ANONYMOUS]", () => {
  test.setTimeout(120_000);

  // ── RT-1: 到達確認 ─────────────────────────────────────────────────────
  test("RT-1: ?page=reservationQrNotice が HTTP < 400 で到達できる（auth 不要）", async ({ page }) => {
    const res = await page.goto(QR_NOTICE_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    expect(res?.status(), `HTTP status = ${res?.status()}`).toBeLessThan(400);
    // GAS で auth リダイレクトされていないこと
    expect(page.url(), "auth redirect されていない").not.toContain("accounts.google.com");
    expect(page.url(), "ServiceLogin に飛ばされていない").not.toContain("ServiceLogin");
  });

  // ── RT-2: userHtmlFrame が描画される ────────────────────────────────────
  test("RT-2: userHtmlFrame が取得でき、ボディが描画される", async ({ page }) => {
    await page.goto(QR_NOTICE_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const frame = await getReadyFrame(page);
    expect(frame, "userHtmlFrame が取得できない（白画面の可能性）").not.toBeNull();
    const bodyLen = await frame!.evaluate(() => document.body.innerHTML.length);
    expect(bodyLen, `body innerHTML length = ${bodyLen}`).toBeGreaterThan(FRAME_MIN_BODY);
  });

  // ── RT-3: 院名表示 ─────────────────────────────────────────────────────
  test("RT-3: .notice-clinic-name に「平山接骨院」が表示される", async ({ page }) => {
    await page.goto(QR_NOTICE_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const frame = await getReadyFrame(page);
    expect(frame).not.toBeNull();
    const clinicText = await frame!.locator(".notice-clinic-name").first().textContent().catch(() => "");
    expect(clinicText, "院名テキスト").toContain("平山接骨院");
  });

  // ── RT-4: タグライン ───────────────────────────────────────────────────
  test("RT-4: .notice-tagline に「スマホでかんたん予約」が表示される", async ({ page }) => {
    await page.goto(QR_NOTICE_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const frame = await getReadyFrame(page);
    expect(frame).not.toBeNull();
    const tagline = await frame!.locator(".notice-tagline").first().textContent().catch(() => "");
    expect(tagline, "タグラインテキスト").toContain("スマホでかんたん予約");
  });

  // ── RT-5: 印刷ボタン ───────────────────────────────────────────────────
  test("RT-5: .print-btn が存在し window.print() を呼ぶ onclick を持つ", async ({ page }) => {
    await page.goto(QR_NOTICE_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const frame = await getReadyFrame(page);
    expect(frame).not.toBeNull();
    const printBtnCount = await frame!.locator(".print-btn").count();
    expect(printBtnCount, "print-btn 個数").toBeGreaterThan(0);
    const printAttr = await frame!.locator(".print-btn").first().getAttribute("onclick").catch(() => "");
    expect(printAttr || "", "onclick に window.print() が含まれる").toContain("window.print()");
  });

  // ── RT-6: QR コード描画ターゲット ──────────────────────────────────────
  test("RT-6: #qr-canvas-container / #qr-js-target が存在し、QR が描画される", async ({ page }) => {
    await page.goto(QR_NOTICE_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const frame = await getReadyFrame(page);
    expect(frame).not.toBeNull();
    await expect(frame!.locator("#qr-canvas-container")).toHaveCount(1);
    await expect(frame!.locator("#qr-js-target")).toHaveCount(1);

    // qrcode.js CDN ロード + canvas 描画を待つ
    await page.waitForTimeout(QR_RENDER_WAIT_MS);

    // qrcode.js 成功時: #qr-js-target 内に canvas または img が描画される
    // fallback 時:      #qr-fallback-img が display:block になり #qr-img.src が設定される
    const qrState = await frame!.evaluate(() => {
      const jsTarget = document.getElementById("qr-js-target");
      const fallback = document.getElementById("qr-fallback-img");
      const fallbackImg = document.getElementById("qr-img") as HTMLImageElement | null;
      return {
        jsTargetChildCount: jsTarget ? jsTarget.children.length : 0,
        jsTargetHasCanvas:  jsTarget ? jsTarget.querySelector("canvas") !== null : false,
        jsTargetHasImg:     jsTarget ? jsTarget.querySelector("img") !== null : false,
        fallbackDisplay:    fallback ? (fallback as HTMLElement).style.display : "",
        fallbackImgSrc:     fallbackImg ? fallbackImg.src : "",
      };
    });

    const qrRenderedByLib = qrState.jsTargetHasCanvas || qrState.jsTargetHasImg || qrState.jsTargetChildCount > 0;
    const qrRenderedByFallback = qrState.fallbackDisplay !== "none" && qrState.fallbackImgSrc.length > 0;
    test.info().annotations.push({
      type: "info",
      description: `qrcode.js: ${qrRenderedByLib} / fallback: ${qrRenderedByFallback} / state=${JSON.stringify(qrState)}`,
    });
    expect(qrRenderedByLib || qrRenderedByFallback, "QR がいずれかの方式で描画される").toBe(true);
  });

  // ── RT-7: RESERVATION_URL 出力 ─────────────────────────────────────────
  test("RT-7: #url-text に ?page=reservation の URL が出力される", async ({ page }) => {
    await page.goto(QR_NOTICE_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const frame = await getReadyFrame(page);
    expect(frame).not.toBeNull();
    // textContent は JS で設定されるので少し待つ
    await page.waitForTimeout(2_000);
    const urlText = await frame!.locator("#url-text").first().textContent().catch(() => "");
    test.info().annotations.push({ type: "info", description: "#url-text = " + urlText });
    expect(urlText, "#url-text に script.google.com URL").toContain("script.google.com");
    expect(urlText, "#url-text に ?page=reservation").toContain("?page=reservation");
  });

  // ── RT-8: キャンセル・変更案内 ─────────────────────────────────────────
  test("RT-8: .cancel-notice にキャンセル・変更案内が含まれる", async ({ page }) => {
    await page.goto(QR_NOTICE_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const frame = await getReadyFrame(page);
    expect(frame).not.toBeNull();
    const cn = await frame!.locator(".cancel-notice").first().textContent().catch(() => "");
    expect(cn, "キャンセル文言").toContain("キャンセル");
  });

  // ── RT-9: ホーム画面追加ヒント ─────────────────────────────────────────
  test("RT-9: .home-screen-notice に iPhone/Android のホーム画面追加手順が含まれる", async ({ page }) => {
    await page.goto(QR_NOTICE_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const frame = await getReadyFrame(page);
    expect(frame).not.toBeNull();
    const hs = await frame!.locator(".home-screen-notice").first().textContent().catch(() => "");
    expect(hs, "iPhone 文言").toContain("iPhone");
    expect(hs, "Android 文言").toContain("Android");
    expect(hs, "ホーム画面追加 文言").toContain("ホーム画面に追加");
  });

  // ── RT-10: 公開予約ページ自体が落ちていない ────────────────────────────
  test("RT-10: ?page=reservation も HTTP < 400（QR 先リンク切れ確認）", async ({ page }) => {
    const res = await page.goto(RESERVATION_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    expect(res?.status(), `HTTP status = ${res?.status()}`).toBeLessThan(400);
    const frame = await getReadyFrame(page);
    expect(frame, "公開予約ページの userHtmlFrame が取得できる").not.toBeNull();
  });

  // ── RT-11: コンソール JS エラーなし ────────────────────────────────────
  test("RT-11: QR 掲示ページで JS コンソールエラーが発生していない（既知 GAS 警告除外）", async ({ page }) => {
    const errors = attachErrorCollector(page);
    await page.goto(QR_NOTICE_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const frame = await getReadyFrame(page);
    expect(frame).not.toBeNull();
    await page.waitForTimeout(QR_RENDER_WAIT_MS);
    if (errors.length > 0) {
      test.info().annotations.push({ type: "warn", description: "JS errors: " + errors.join(" / ") });
    }
    expect(errors, "アプリ JS エラーが 0 件").toHaveLength(0);
  });
});
