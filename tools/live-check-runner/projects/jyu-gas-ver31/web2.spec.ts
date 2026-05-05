/**
 * jyu-gas-ver31 web2.spec.ts
 * JYU-GAS Ver3.1 Phase WEB-2 来院記録登録フォーム確認
 *
 * 確認項目:
 *   W2-1: page=visitNew が表示される
 *   W2-2: フォーム要素（visitDate / kubun / bodyPart / disease）が存在する
 *   W2-3: patientId が引き継がれる (#patient-chip に ID が表示される)
 *   W2-4: 「前回引き継ぎ」ボタンが存在する
 *   W2-5: 必須項目未入力で保存ボタン押下 → モーダルが開かない (バリデーション)
 *   W2-6: 全必須項目入力後に保存ボタン押下 → 確認モーダルが開く
 *   W2-7: 確認モーダルの「修正する」ボタンでキャンセルできる
 *   W2-8: コンソールに重大エラーが出ない
 *
 * ⚠️ 保存禁止:
 *   W2-6 でモーダルを開くが「登録する」ボタンは押さない。
 *   saveVisitFromWeb_V3 は実行しない（本番シートへの書き込みを防ぐ）。
 *
 * 「前回引き継ぎ」テスト (W2-4b):
 *   testData.patientId が設定された場合に実行。
 *   GAS API 呼び出し (getPrevVisitData_V3) の応答を確認する。
 *   前回データがない場合はアラートが出るが PASS とする。
 *
 * 実行コマンド: npm run test:jyu:web2
 */

import { test, expect, Page } from "@playwright/test";
import fs from "fs";
import path from "path";
import config from "./config.json";

const DEV_URL      = config.devUrl;
const AUTH_FILE    = path.join(__dirname, "../../auth.json");
const HAS_AUTH     = fs.existsSync(AUTH_FILE);
const LOAD_TIMEOUT = 30_000;
const TEST_PID     = config.testData.patientId;

// ── フレームヘルパー ─────────────────────────────────────────────

function gasAppFrame(page: Page) {
  return page.frameLocator("iframe").first().frameLocator("iframe").first();
}

// ── 認証チェック ─────────────────────────────────────────────────

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
    return;
  }
  if (
    url.includes("accounts.google.com/o/oauth2") ||
    title.includes("hasn't been verified") ||
    title.includes("確認されていません")
  ) {
    test.skip(
      true,
      "GAS OAuth 警告画面が表示されています。\n" +
      "ブラウザで手動アクセスして「詳細」→「安全でないページに移動」を選択し、auth.json を再保存してください。"
    );
  }
}

// ── W2-1: page=visitNew ページ到達確認 ────────────────────────────

test.describe(`JYU-GAS W2-1: page=visitNew 到達確認 [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
  });

  test("W2-1a: page=visitNew に到達できる (HTTP < 400)", async ({ page }) => {
    const res = await page.goto(`${DEV_URL}?page=visitNew`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    expect(res?.status()).toBeLessThan(400);
  });

  test("W2-1b: page=visitNew — ページタイトルに「来院記録」が含まれる", async ({ page }) => {
    await page.goto(`${DEV_URL}?page=visitNew`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await expect(frame.getByText("来院記録", { exact: false })).toBeVisible({ timeout: LOAD_TIMEOUT });
  });
});

// ── W2-2: フォーム要素の存在確認 ──────────────────────────────────

test.describe(`JYU-GAS W2-2: フォーム要素確認 [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=visitNew`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
  });

  test("W2-2a: #visitDate — 来院日入力欄が存在する", async ({ page }) => {
    const frame = gasAppFrame(page);
    await expect(frame.locator("#visitDate")).toBeVisible({ timeout: LOAD_TIMEOUT });
  });

  test("W2-2b: #accountingType — 会計区分セレクトが存在する", async ({ page }) => {
    const frame = gasAppFrame(page);
    await expect(frame.locator("#accountingType")).toBeVisible({ timeout: LOAD_TIMEOUT });
  });

  test("W2-2c: #kubun — 区分セレクトが存在する", async ({ page }) => {
    const frame = gasAppFrame(page);
    await expect(frame.locator("#kubun")).toBeVisible({ timeout: LOAD_TIMEOUT });
  });

  test("W2-2d: #bodyPart — 部位入力欄が存在する", async ({ page }) => {
    const frame = gasAppFrame(page);
    await expect(frame.locator("#bodyPart")).toBeVisible({ timeout: LOAD_TIMEOUT });
  });

  test("W2-2e: #disease — 傷病名入力欄が存在する", async ({ page }) => {
    const frame = gasAppFrame(page);
    await expect(frame.locator("#disease")).toBeVisible({ timeout: LOAD_TIMEOUT });
  });

  test("W2-2f: #injuryDate — 受傷日入力欄が存在する", async ({ page }) => {
    const frame = gasAppFrame(page);
    await expect(frame.locator("#injuryDate")).toBeVisible({ timeout: LOAD_TIMEOUT });
  });

  test("W2-2g: .btn-save — 「来院を登録する」ボタンが存在する", async ({ page }) => {
    const frame = gasAppFrame(page);
    await expect(frame.locator(".btn-save")).toBeVisible({ timeout: LOAD_TIMEOUT });
  });
});

// ── W2-3: patientId 引き継ぎ確認 ─────────────────────────────────

test.describe(`JYU-GAS W2-3: patientId 引き継ぎ確認 [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test("W2-3a: patientId なし — #patient-chip に「未指定」が表示される", async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=visitNew`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await expect(frame.locator("#patient-chip")).toContainText("未指定", { timeout: LOAD_TIMEOUT });
  });

  test("W2-3b: patientId あり — #patient-chip に patientId が表示される [testData.patientId 要設定]", async ({ page }) => {
    if (!TEST_PID) {
      test.skip(true, "testData.patientId 未設定のためスキップ");
      return;
    }

    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=visitNew&patientId=${TEST_PID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await expect(frame.locator("#patient-chip")).toContainText(TEST_PID, { timeout: LOAD_TIMEOUT });
  });
});

// ── W2-4: 前回引き継ぎボタン ─────────────────────────────────────

test.describe(`JYU-GAS W2-4: 前回引き継ぎボタン [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test("W2-4a: #inheritBtn が存在する", async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=visitNew`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await expect(frame.locator("#inheritBtn")).toBeVisible({ timeout: LOAD_TIMEOUT });
  });

  test("W2-4b: 前回引き継ぎボタン押下 — エラーにならず応答する [testData.patientId 要設定]", async ({ page }) => {
    if (!TEST_PID) {
      test.skip(true, "testData.patientId 未設定のためスキップ");
      return;
    }

    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=visitNew&patientId=${TEST_PID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await frame.locator("#inheritBtn").waitFor({ timeout: LOAD_TIMEOUT });

    // ダイアログ（アラート）が発生した場合は自動で承認
    page.on("dialog", async (dialog) => {
      console.log(`[W2-4b] dialog: ${dialog.message()}`);
      await dialog.accept();
    });

    await frame.locator("#inheritBtn").click();

    // GAS API 呼び出し (getPrevVisitData_V3) の完了を待つ
    // ボタンが無効状態 → 有効状態に戻るまで待機（最大30秒）
    await frame.locator("#inheritBtn:not([disabled])").waitFor({ timeout: LOAD_TIMEOUT });
    // ここまで到達 = クラッシュせずに応答した
    expect(true).toBe(true);
  });
});

// ── W2-5: バリデーション確認 ─────────────────────────────────────

test.describe(`JYU-GAS W2-5: 必須項目バリデーション [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test("W2-5: 必須項目未入力で保存ボタン押下 — 確認モーダルが開かない", async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=visitNew`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await frame.locator(".btn-save").waitFor({ timeout: LOAD_TIMEOUT });

    // アラートを自動で承認
    page.on("dialog", async (dialog) => {
      console.log(`[W2-5] validation alert: "${dialog.message()}"`);
      await dialog.accept();
    });

    // 何も入力せずに保存ボタンを押す
    await frame.locator(".btn-save").click();

    // モーダルが開いていないことを確認
    const modalOpen = await frame.locator(".modal-overlay.open")
      .isVisible({ timeout: 3000 }).catch(() => false);
    expect(modalOpen).toBe(false);
  });
});

// ── W2-6 / W2-7: 確認モーダル確認 ───────────────────────────────

test.describe(`JYU-GAS W2-6/W2-7: 確認モーダル [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test("W2-6/W2-7: 全必須項目入力 → モーダル開く → キャンセルで閉じる [testData.patientId 要設定]", async ({ page }) => {
    if (!TEST_PID) {
      test.skip(true, "testData.patientId 未設定のためスキップ (patientId 未指定では「患者IDが未指定です」バリデーションで止まる)");
      return;
    }

    page.setDefaultTimeout(LOAD_TIMEOUT);
    await page.goto(`${DEV_URL}?page=visitNew&patientId=${TEST_PID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    const frame = gasAppFrame(page);
    await frame.locator(".btn-save").waitFor({ timeout: LOAD_TIMEOUT });

    // 来院日（今日の日付）は JS で自動セットされるので確認のみ
    const visitDateVal = await frame.locator("#visitDate").inputValue({ timeout: LOAD_TIMEOUT }).catch(() => "");
    expect(visitDateVal).toMatch(/^\d{4}-\d{2}-\d{2}$/);

    // 必須項目を入力
    await frame.locator("#kubun").selectOption("後療");
    await frame.locator("#bodyPart").fill("腰部");
    await frame.locator("#disease").fill("捻挫");

    // 保存ボタン押下
    await frame.locator(".btn-save").click();

    // W2-6: 確認モーダルが開く
    await expect(frame.locator("#confirmModal")).toHaveClass(/open/, { timeout: LOAD_TIMEOUT });

    // W2-7: 「修正する」ボタンでキャンセル (saveVisitFromWeb_V3 は呼ばない)
    await frame.locator(".btn-cancel").click();
    const modalStillOpen = await frame.locator(".modal-overlay.open")
      .isVisible({ timeout: 3000 }).catch(() => false);
    expect(modalStillOpen).toBe(false);
  });
});

// ── W2-8: コンソールエラー確認 ───────────────────────────────────

test.describe(`JYU-GAS W2-8: コンソールエラー確認 [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test("W2-8: page=visitNew — 重大なコンソールエラーがない", async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);

    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") {
        const text = msg.text();
        // GAS/Google ドメインの既知の警告は除外（フレーム間通信エラー等）
        if (
          !text.includes("Could not load content") &&
          !text.includes("ResizeObserver") &&
          !text.includes("favicon") &&
          !text.includes("google") &&
          !text.includes("gstatic") &&
          !text.includes("accounts.google") &&
          !text.includes("frame")
        ) {
          errors.push(text);
        }
      }
    });

    await page.goto(`${DEV_URL}?page=visitNew`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);

    // ページ読み込み後少し待機してエラーを収集
    await page.waitForTimeout(3000);

    if (errors.length > 0) {
      console.log("[W2-8] Console errors detected:", errors);
    }
    // GAS アプリの性質上、フレーム通信エラーなどは許容するが
    // アプリ固有の重大エラーは 0 件であるべき
    expect(errors.length).toBe(0);
  });
});
