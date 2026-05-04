/**
 * custom-exercise-add.spec.ts
 *
 * カスタムセッション + ユーザー独自種目の追加 — R1〜R8 live check
 *
 * 対象バグ: ADD API が user_exercises を token client (RLS enabled) で
 * 参照していたため "Exercise was not found." エラーが発生していた。
 * 修正: admin client + explicit .eq("user_id", userId) で参照するよう変更。
 *
 * 前提:
 *   TRAINING_TEST_EMAIL    ログイン用テストユーザーのメールアドレス
 *   TRAINING_TEST_PASSWORD テストユーザーのパスワード
 *   ※ 未設定の場合、全テストをスキップします。
 *
 * テストユーザー要件:
 *   - Supabase Auth ユーザーとして登録済み
 *   - membership_status は null (なし) 又は "active" でもOK
 *   - 実行後、in_progress セッションとユーザー種目が残るが再実行は安全
 *     (POST /api/workout-sessions/custom は冪等、種目は別名で作成)
 */

import { test, expect, type Page } from "@playwright/test";
import config from "./config.json";

const BASE_URL = (config.prodUrl || config.localUrl || "").replace(/\/$/, "");
const TEST_EMAIL = process.env.TRAINING_TEST_EMAIL ?? "";
const TEST_PASSWORD = process.env.TRAINING_TEST_PASSWORD ?? "";

const TS = Date.now();
const EXERCISE_NAME = `テスト種目_${TS}`;
// R8b is a separate test that also creates a user_exercise, so use a distinct name
// to avoid strict-mode violations when both exercises appear in the modal list.
const EXERCISE_NAME_R8B = `テスト種目_R8B_${TS}`;

function skipIfMissing() {
  if (!BASE_URL || !TEST_EMAIL || !TEST_PASSWORD) {
    test.skip(true,
      "TRAINING_TEST_EMAIL / TRAINING_TEST_PASSWORD が未設定のためスキップ。" +
      " env を設定して再実行してください。"
    );
  }
}

async function login(page: Page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  // Login redirects / → /programs (server-side redirect via RSC).
  // The URL may never stabilize at "/" so wait for it to leave /login instead.
  await page.waitForURL((url) => url.pathname !== "/login", { timeout: 20_000 });
}

test.describe("custom exercise add — R1〜R8", () => {
  let capturedSessionId: string | null = null;

  test("R1: テストユーザーでログインできる", async ({ page }) => {
    skipIfMissing();
    await login(page);
    expect(page.url()).toBe(`${BASE_URL}/`);
  });

  test("R2: /programs に「自由に作成」ボタンが存在する", async ({ page }) => {
    skipIfMissing();
    await login(page);
    await page.goto(`${BASE_URL}/programs`, { waitUntil: "domcontentloaded" });
    const btn = page.getByRole("button", { name: "自由に作成" });
    await expect(btn).toBeVisible({ timeout: 10_000 });
  });

  test("R3: 「自由に作成」押下でカスタムセッションが作成され /train に遷移する", async ({ page }) => {
    skipIfMissing();
    await login(page);
    await page.goto(`${BASE_URL}/programs`, { waitUntil: "domcontentloaded" });

    // POST /api/workout-sessions/custom のレスポンスを補足してセッションIDを記録
    page.on("response", (res) => {
      if (res.url().includes("/api/workout-sessions/custom") && res.request().method() === "POST") {
        res.json().then((data) => {
          if (data?.sessionId) capturedSessionId = data.sessionId;
        }).catch(() => {/* noop */});
      }
    });

    const btn = page.getByRole("button", { name: "自由に作成" });
    await btn.click();

    await page.waitForURL(`${BASE_URL}/train`, { timeout: 15_000 });
    expect(page.url()).toContain("/train");
  });

  test("R4: WorkoutScreen が表示され「＋ 種目追加」ボタンが存在する", async ({ page }) => {
    skipIfMissing();
    await login(page);
    // カスタムセッション作成（冪等）してから /train へ
    await page.goto(`${BASE_URL}/programs`, { waitUntil: "domcontentloaded" });
    page.on("response", (res) => {
      if (res.url().includes("/api/workout-sessions/custom") && res.request().method() === "POST") {
        res.json().then((d) => { if (d?.sessionId) capturedSessionId = d.sessionId; }).catch(() => {});
      }
    });
    await page.getByRole("button", { name: "自由に作成" }).click();
    await page.waitForURL(`${BASE_URL}/train`, { timeout: 15_000 });

    const addBtn = page.getByRole("button", { name: "＋ 種目追加" });
    await expect(addBtn).toBeVisible({ timeout: 10_000 });
  });

  test("R5: 「＋ 種目追加」でモーダルが開く", async ({ page }) => {
    skipIfMissing();
    await login(page);
    await page.goto(`${BASE_URL}/programs`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "自由に作成" }).click();
    await page.waitForURL(`${BASE_URL}/train`, { timeout: 15_000 });

    await page.getByRole("button", { name: "＋ 種目追加" }).click();
    const modal = page.getByRole("dialog", { name: "種目追加" });
    await expect(modal).toBeVisible({ timeout: 5_000 });
  });

  test("R6: モーダル内で「＋ 新しい種目を作成」を押すと作成フォームが出る", async ({ page }) => {
    skipIfMissing();
    await login(page);
    await page.goto(`${BASE_URL}/programs`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "自由に作成" }).click();
    await page.waitForURL(`${BASE_URL}/train`, { timeout: 15_000 });

    await page.getByRole("button", { name: "＋ 種目追加" }).click();
    await page.getByRole("dialog", { name: "種目追加" });
    await page.getByRole("button", { name: "＋ 新しい種目を作成" }).click();

    const nameInput = page.getByPlaceholder("種目名（必須）");
    await expect(nameInput).toBeVisible({ timeout: 5_000 });
  });

  test("R7: 新しい種目を作成して追加できる（エラーなし）", async ({ page }) => {
    skipIfMissing();
    await login(page);
    await page.goto(`${BASE_URL}/programs`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "自由に作成" }).click();
    await page.waitForURL(`${BASE_URL}/train`, { timeout: 15_000 });

    await page.getByRole("button", { name: "＋ 種目追加" }).click();
    await page.getByRole("button", { name: "＋ 新しい種目を作成" }).click();

    const nameInput = page.getByPlaceholder("種目名（必須）");
    await nameInput.fill(EXERCISE_NAME);
    await page.getByRole("button", { name: "作成して追加" }).click();

    // モーダルが閉じることを確認 ← これが成功の証拠
    // ADD 失敗時はモーダルが閉じずエラーが表示されたまま残る
    const modal = page.getByRole("dialog", { name: "種目追加" });
    await expect(modal).toBeHidden({ timeout: 10_000 });

    // "Exercise was not found." がページ内に表示されていないことを確認
    await expect(page.getByText("Exercise was not found.")).toHaveCount(0);
  });

  test("R8: 追加した種目ブロックが WorkoutScreen に表示される", async ({ page }) => {
    skipIfMissing();
    await login(page);
    await page.goto(`${BASE_URL}/programs`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "自由に作成" }).click();
    await page.waitForURL(`${BASE_URL}/train`, { timeout: 15_000 });

    await page.getByRole("button", { name: "＋ 種目追加" }).click();
    await page.getByRole("button", { name: "＋ 新しい種目を作成" }).click();

    const nameInput = page.getByPlaceholder("種目名（必須）");
    await nameInput.fill(EXERCISE_NAME);
    await page.getByRole("button", { name: "作成して追加" }).click();

    // モーダルが閉じた後、種目名が画面上に表示されるか確認
    await page.getByRole("dialog", { name: "種目追加" }).waitFor({ state: "hidden", timeout: 10_000 });
    await expect(page.getByText(EXERCISE_NAME)).toBeVisible({ timeout: 10_000 });
  });

  test(
    "R8b: 作成済みカスタム種目（「自分」ラベル）をモーダルから追加できる（バグ再現→修正確認）",
    async ({ page }) => {
      skipIfMissing();
      await login(page);
      await page.goto(`${BASE_URL}/programs`, { waitUntil: "domcontentloaded" });
      await page.getByRole("button", { name: "自由に作成" }).click();
      await page.waitForURL(`${BASE_URL}/train`, { timeout: 15_000 });

      // Step 1: カスタム種目を作成（モーダル経由）
      // R8 と名前が被らないよう EXERCISE_NAME_R8B (別の定数) を使う
      await page.getByRole("button", { name: "＋ 種目追加" }).click();
      await page.getByRole("button", { name: "＋ 新しい種目を作成" }).click();
      await page.getByPlaceholder("種目名（必須）").fill(EXERCISE_NAME_R8B);
      await page.getByRole("button", { name: "作成して追加" }).click();
      await page.getByRole("dialog", { name: "種目追加" }).waitFor({ state: "hidden", timeout: 10_000 });

      // Step 2: 再度モーダルを開き、作成した種目（「自分」ラベル）を選択して追加
      // これがバグ再現ケース: ADD API が user_exercises を RLS で弾いていた
      await page.getByRole("button", { name: "＋ 種目追加" }).click();
      const modal = page.getByRole("dialog", { name: "種目追加" });
      await expect(modal).toBeVisible({ timeout: 5_000 });

      // 種目名で絞り込んで「自分」ラベル付きのアイテムを探す
      await page.fill('input[type="search"]', EXERCISE_NAME_R8B);

      // 種目名ボタンをクリック（「自分」タグがついている）
      const exerciseBtn = modal.getByRole("button").filter({ hasText: EXERCISE_NAME_R8B }).first();
      await expect(exerciseBtn).toBeVisible({ timeout: 5_000 });
      await exerciseBtn.click();

      // モーダルが閉じる（追加成功）= バグ修正確認
      // ADD 失敗時はモーダルが閉じず "Exercise was not found." が表示されたまま
      await expect(modal).toBeHidden({ timeout: 10_000 });

      // "Exercise was not found." が出ていないことを確認
      await expect(page.getByText("Exercise was not found.")).toHaveCount(0);

      // 種目名がページに表示される
      await expect(page.getByText(EXERCISE_NAME_R8B).first()).toBeVisible({ timeout: 5_000 });
    }
  );
});
