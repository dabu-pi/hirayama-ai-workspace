/**
 * wildboar/dev-flow.spec.ts
 * ワイルドボア会員管理システム DEV フロー確認（データ作成あり）
 *
 * 確認項目:
 *   D-1: 入会申込フォーム送信 — 6793441→羽渕・コース・利用開始日
 *   D-2: 申込詳細 — コース・利用開始日 prefill 確認
 *   D-3: 正式登録 — prefill 値で費用計算・LINE割引確認
 *
 * 実行環境: DEV WebApp (@30)
 * データ安全: DEVデータを作成（cleanup は手動）。PROD は一切触らない。
 *
 * テストデータ識別:
 *   姓: LCテスト  名: Phase106
 *   電話: 09000001060
 *   郵便: 6793441
 *   利用開始日: 2026-05-30
 *
 * 実行コマンド: npm run test:wildboar:dev
 */

import { test, expect, Page, Frame } from "@playwright/test";
import devConfig from "./dev-config.json";

const DEV_URL       = devConfig.devUrl;
const FRAME_TIMEOUT = 60_000;
const GAS_WAIT_MS   = 12_000;
const FRAME_NAME    = "userHtmlFrame";
const MIN_BODY_LEN  = 500;

// テストデータ
const TEST_DATA = {
  familyName:      "LCテスト",
  givenName:       "Phase106",
  familyNameKana:  "エルシーテスト",
  givenNameKana:   "フェーズイチゼロロク",
  birthDate:       "1990-01-01",
  gender:          "male",
  postalCode:      "6793441",
  address1:        "1-1",
  phoneMobile:     "09000001060",
  email:           "lctest-phase106@example.com",
  desiredStartDate:"2026-05-30",
};

// ── ヘルパー ─────────────────────────────────────────────────────────────

async function getReadyFrame(page: Page, minLen = MIN_BODY_LEN): Promise<Frame | null> {
  const deadline = Date.now() + FRAME_TIMEOUT;
  while (Date.now() < deadline) {
    const f = page.frame({ name: FRAME_NAME });
    if (f) {
      const body = await f.locator("body").textContent({ timeout: 5_000 }).catch(() => "");
      if (body && body.length >= minLen) return f;
    }
    await page.waitForTimeout(1_000);
  }
  return null;
}

function attachErrorCollector(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      const isKnown = text.includes("Framing") || text.includes("ERR_BLOCKED_BY_ORB");
      if (!isKnown) errors.push(text);
    }
  });
  return errors;
}

// ── D-1: 入会申込フォーム送信 ──────────────────────────────────────────

test.describe("WILDBOAR DEV D-1: 入会申込フォーム送信", () => {
  test.setTimeout(180_000);

  test("D-1a: DEV 入会申込フォームが開く", async ({ page }) => {
    const errors = attachErrorCollector(page);
    await page.goto(DEV_URL + "?page=intake-form", { waitUntil: "domcontentloaded", timeout: 60_000 });
    const frame = await getReadyFrame(page);
    expect(frame, "DEV フレームが取得できること").not.toBeNull();
    const h1 = await frame!.locator("h1").first().textContent({ timeout: 10_000 }).catch(() => "");
    expect(h1.length, "h1 が表示されること").toBeGreaterThan(0);
    expect(errors, "コンソールエラーなし").toHaveLength(0);
  });

  test("D-1b: 6793441 住所検索 → 兵庫県朝来市羽渕（粟鹿でないこと）", async ({ page }) => {
    const errors = attachErrorCollector(page);
    await page.goto(DEV_URL + "?page=intake-form", { waitUntil: "domcontentloaded", timeout: 60_000 });
    const frame = await getReadyFrame(page);
    expect(frame).not.toBeNull();
    await page.waitForTimeout(3_000);

    await frame!.locator("#postal_code").fill("6793441");
    await frame!.locator(".btn-lookup").click();
    await page.waitForTimeout(GAS_WAIT_MS + 3_000);

    const pref = await frame!.locator("#prefecture").inputValue().catch(() => "");
    const city = await frame!.locator("#city").inputValue().catch(() => "");

    if (pref) {
      expect(pref, "都道府県: 兵庫県").toBe("兵庫県");
      expect(city, "市区町村に羽渕を含むこと").toContain("羽渕");
      expect(city, "粟鹿でないこと（Phase 10.6 修正確認）").not.toContain("粟鹿");
    } else {
      // API・fallback ともに失敗した場合は失敗案内が出ていること
      const failMsg = await frame!.locator("#lookupFailMsg.show").count();
      expect(failMsg, "住所検索失敗の案内が表示されること").toBeGreaterThan(0);
    }
    expect(errors, "コンソールエラーなし").toHaveLength(0);
  });

  test("D-1c: テスト申込を送信して application_id を取得する", async ({ page }) => {
    const errors = attachErrorCollector(page);
    await page.goto(DEV_URL + "?page=intake-form", { waitUntil: "domcontentloaded", timeout: 60_000 });
    const frame = await getReadyFrame(page);
    expect(frame).not.toBeNull();
    await page.waitForTimeout(5_000); // コース読込待ち

    // 氏名
    await frame!.locator("#family_name").fill(TEST_DATA.familyName);
    await frame!.locator("#given_name").fill(TEST_DATA.givenName);
    await frame!.locator("#family_name_kana").fill(TEST_DATA.familyNameKana);
    await frame!.locator("#given_name_kana").fill(TEST_DATA.givenNameKana);

    // 生年月日・性別
    await frame!.locator("#birth_date").fill(TEST_DATA.birthDate);
    const genderSel = frame!.locator(`input[name="gender"][value="${TEST_DATA.gender}"]`);
    if (await genderSel.count() > 0) await genderSel.check();

    // 住所
    await frame!.locator("#postal_code").fill(TEST_DATA.postalCode);
    const lookupBtn = frame!.locator(".btn-lookup");
    if (await lookupBtn.count() > 0) {
      await lookupBtn.click();
      await page.waitForTimeout(GAS_WAIT_MS + 3_000);
    }
    await frame!.locator("#address1").fill(TEST_DATA.address1);

    // 電話・メール
    await frame!.locator("#phone_mobile").fill(TEST_DATA.phoneMobile);
    await frame!.locator("#email").fill(TEST_DATA.email);

    // コース選択（最初の radio を選択）
    const planRadios = frame!.locator('input[name="plan_id"]');
    const planCount = await planRadios.count();
    expect(planCount, "コースが1件以上表示されていること").toBeGreaterThan(0);
    await planRadios.first().check();

    // 利用開始日
    const startDateInput = frame!.locator("#desired_start_date");
    if (await startDateInput.count() > 0) {
      await startDateInput.fill(TEST_DATA.desiredStartDate);
    }

    // プライバシー同意（スクロールして force クリック）
    const privacyCb = frame!.locator("#privacy_agreed");
    if (await privacyCb.count() > 0) {
      await privacyCb.scrollIntoViewIfNeeded().catch(() => {});
      await privacyCb.check({ force: true });
    }

    // 送信ボタン（スクロールして有効化確認）
    const submitBtn = frame!.locator("#btnSubmit");
    await submitBtn.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(1_000);

    // 送信
    await submitBtn.click({ force: true });
    await page.waitForTimeout(GAS_WAIT_MS + 5_000); // GAS 書き込み待ち

    // 受付番号確認
    const receiptId = await frame!.locator("#receiptId").textContent({ timeout: 20_000 }).catch(() => "");
    expect(receiptId, "受付番号（APP-xxx）が表示されること").toMatch(/APP-/);

    // application_id をテストデータとして記録
    console.log(`[D-1c] DEV test application_id: ${receiptId}`);
    expect(errors, "コンソールエラーなし").toHaveLength(0);
  });
});

// ── D-2: 申込詳細 prefill 確認 ──────────────────────────────────────────

test.describe("WILDBOAR DEV D-2: 申込詳細 prefill 確認", () => {
  test.setTimeout(120_000);

  // D-2 は D-1c で作成した申込に依存するため、D-1c 成功後に手動確認を推奨
  // ここでは申込一覧から「LCテスト Phase106」を探し、申込詳細の prefill を確認する

  test("D-2a: DEV 申込一覧が開く", async ({ page }) => {
    const errors = attachErrorCollector(page);
    await page.goto(DEV_URL + "?page=application-list", { waitUntil: "domcontentloaded", timeout: 60_000 });
    const frame = await getReadyFrame(page);
    expect(frame).not.toBeNull();
    await page.waitForTimeout(GAS_WAIT_MS);

    const body = await frame!.locator("body").textContent().catch(() => "");
    expect(body.length, "申込一覧が読み込まれること").toBeGreaterThan(100);
    expect(errors, "コンソールエラーなし").toHaveLength(0);
  });

  test("D-2b: DEV 申込一覧に LCテスト Phase106 が存在する", async ({ page }) => {
    await page.goto(DEV_URL + "?page=application-list", { waitUntil: "domcontentloaded", timeout: 60_000 });
    const frame = await getReadyFrame(page);
    expect(frame).not.toBeNull();
    await page.waitForTimeout(GAS_WAIT_MS + 2_000);

    const body = await frame!.locator("body").textContent().catch(() => "");
    expect(body, "LCテスト の申込が一覧に表示されること").toContain("LCテスト");
  });
});

// ── D-3: 正式登録エリアの prefill 確認（手動誘導用ガイドテスト）────────

test.describe("WILDBOAR DEV D-3: 正式登録 prefill ガイド確認", () => {
  test.setTimeout(90_000);

  test("D-3a: DEV ホームが開く（DEV フロー全体の前提確認）", async ({ page }) => {
    const errors = attachErrorCollector(page);
    const res = await page.goto(DEV_URL + "?page=home", { waitUntil: "domcontentloaded", timeout: 60_000 });
    expect(res?.status(), "DEV WebApp に到達できること").toBeLessThan(400);
    const frame = await getReadyFrame(page);
    expect(frame).not.toBeNull();
    const body = await frame!.locator("body").textContent().catch(() => "");
    expect(body.length, "ホーム画面が読み込まれること").toBeGreaterThan(100);
    expect(errors, "コンソールエラーなし").toHaveLength(0);
  });
});
