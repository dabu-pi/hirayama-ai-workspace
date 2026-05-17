/**
 * jrec-sf01 reservation-public.spec.ts
 *
 * Phase R-2A — 患者向け公開予約 UI 実機確認スペック
 *
 * 検証内容:
 *   R2A-1: /dev?page=reservationPublic に HTTP 200 で到達できる
 *   R2A-2: Step 1 日付グリッドが描画される（.date-btn または .empty-msg）
 *   R2A-3: 空き枠がある場合、有効な日付ボタンが存在する
 *   R2A-4: 時間ボタンに 1899 / GMT / 日本標準時 などが含まれない（時刻型 Date 変換バグ確認）
 *   R2A-5: 時間ボタンが HH:mm 形式を含む
 *   R2A-6: 時間ボタンクリックで Step 3 フォームが表示される
 *   R2A-7: Step 3 フォームに必須入力項目（氏名 / 電話 / 来院歴）が存在する
 *   R2A-8: テスト送信 → Step 4 完了画面が表示される（SKIP: 手動確認推奨）
 *   R2A-9: Reservations シートに行追加を確認（SKIP: 手動確認）
 *
 * 実行コマンド: npm run test:jrec:reservation-public
 *
 * 注意:
 *   - /dev URL は Google ログイン済み auth.json が必要（deployer アカウント）
 *   - GAS の google.script.run 呼び出しに 3〜10 秒かかる場合がある
 *   - Reservation_Slots に空き枠がない場合、R2A-3〜R2A-7 は SKIP になる
 *     → 院長が runRegenerateReservationSlots を実行後に再チェックすること
 *   - R2A-8/R2A-9 は本番データへの影響を避けるため手動確認に分類
 */

import { test, expect, Page } from "@playwright/test";
import fs from "fs";
import path from "path";
import config from "./config.json";

const DEV_URL      = config.devUrl;
const PAGE_URL     = DEV_URL + "?page=reservationPublic";
const AUTH_FILE    = path.join(__dirname, "../../auth.json");
const HAS_AUTH     = fs.existsSync(AUTH_FILE);
const LOAD_TIMEOUT = 40_000;
const GAS_TIMEOUT  = 20_000; // GAS google.script.run の最大待機

// 時刻型 Date が文字列化されたときに出る禁止パターン
const FORBIDDEN_TIME_PATTERNS = [
  "GMT", "1899", "Japan Standard Time", "日本標準時",
  "Sat Dec", "Sun Dec", "Mon Dec", "Tue Dec", "Wed Dec", "Thu Dec", "Fri Dec"
];

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
        : "Google 認証が必要です。npm run save-auth を実行してください。"
    );
  }
}

test.describe(
  `JREC-SF01 R-2A 公開予約UI実機確認 [auth: ${HAS_AUTH ? "あり" : "なし"}]`,
  () => {
    test.beforeEach(async ({ page }) => {
      page.setDefaultTimeout(LOAD_TIMEOUT);
    });

    // ── R2A-1: ページ到達確認 ─────────────────────────────────────────
    test("R2A-1: /dev?page=reservationPublic に HTTP 200 で到達できる", async ({ page }) => {
      const res = await page.goto(PAGE_URL, { waitUntil: "domcontentloaded" });
      await handleAuthRedirect(page);
      expect(res?.status()).toBeLessThan(400);
      // エラーページでないことを確認
      const body = await page.locator("body").textContent();
      expect(body).not.toContain("JREC-SF01 エラー");
    });

    // ── R2A-2: Step 1 日付グリッド描画確認 ──────────────────────────────
    test("R2A-2: Step 1 日付グリッドが描画される", async ({ page }) => {
      await page.goto(PAGE_URL, { waitUntil: "domcontentloaded" });
      await handleAuthRedirect(page);

      // google.script.run 完了まで待つ（#loading が消えるか、date-grid に何か入るまで）
      await page.waitForSelector(
        "#date-grid .date-btn, #date-grid .empty-msg",
        { timeout: GAS_TIMEOUT }
      );

      // #s1 が表示されていること
      const s1 = page.locator("#s1");
      await expect(s1).toBeVisible();

      // #date-grid に何かある
      const grid = page.locator("#date-grid");
      const content = await grid.textContent();
      expect(content && content.trim().length).toBeGreaterThan(0);
    });

    // ── R2A-3: 有効な日付ボタン存在確認 ─────────────────────────────────
    test("R2A-3: 空き枠がある日付ボタンが存在する（なければ SKIP）", async ({ page }) => {
      await page.goto(PAGE_URL, { waitUntil: "domcontentloaded" });
      await handleAuthRedirect(page);

      await page.waitForSelector(
        "#date-grid .date-btn, #date-grid .empty-msg",
        { timeout: GAS_TIMEOUT }
      );

      // 有効なボタン（disabled でない .date-btn）を探す
      const enabledBtns = page.locator("#date-grid .date-btn:not(.date-btn-disabled)");
      const count = await enabledBtns.count();

      if (count === 0) {
        test.skip(
          true,
          "Reservation_Slots に空き枠がありません。\n" +
          "GAS エディタで runRegenerateReservationSlots を実行後に再チェックしてください。\n" +
          "エディタ: https://script.google.com/d/1-1opRkAFbFQz96Uqlgy3sWjgAs_PKS_1Eg9Pz7_6geTFztHx_5APSj2G/edit"
        );
        return;
      }

      expect(count).toBeGreaterThan(0);
    });

    // ── R2A-4/5: 時間表示フォーマット確認（1899 バグ再発防止）──────────────
    test("R2A-4/5: 時間ボタンが HH:mm 形式で表示され、1899/GMT が含まれない", async ({ page }) => {
      await page.goto(PAGE_URL, { waitUntil: "domcontentloaded" });
      await handleAuthRedirect(page);

      await page.waitForSelector(
        "#date-grid .date-btn, #date-grid .empty-msg",
        { timeout: GAS_TIMEOUT }
      );

      const enabledBtns = page.locator("#date-grid .date-btn:not(.date-btn-disabled)");
      const count = await enabledBtns.count();
      if (count === 0) {
        test.skip(true, "空き枠なし — runRegenerateReservationSlots 実行後に再テスト");
        return;
      }

      // 最初の有効な日付ボタンをクリック
      await enabledBtns.first().click();

      // Step 2 の slot-grid に何か入るまで待つ
      await page.waitForSelector(
        "#slot-grid .slot-btn, #slot-grid .empty-msg",
        { timeout: GAS_TIMEOUT }
      );

      const slotGrid = page.locator("#slot-grid");
      const slotText = (await slotGrid.textContent()) || "";

      // 空き枠なしの場合は SKIP
      if (slotText.includes("空き枠がありません")) {
        test.skip(true, "選択した日に空き枠なし — 別の日を選んで確認");
        return;
      }

      // R2A-4: 禁止パターンが含まれないこと
      for (const pattern of FORBIDDEN_TIME_PATTERNS) {
        expect(slotText, `時間表示に "${pattern}" が含まれています（Date 変換バグの可能性）`).not.toContain(pattern);
      }

      // R2A-5: HH:mm パターンが含まれること
      const hasHHmm = /\d{1,2}:\d{2}/.test(slotText);
      expect(hasHHmm, "時間ボタンに HH:mm 形式が含まれていません").toBe(true);
    });

    // ── R2A-6/7: Step 3 フォーム表示確認 ──────────────────────────────
    test("R2A-6/7: 時間クリック後に Step 3 フォームが表示される", async ({ page }) => {
      await page.goto(PAGE_URL, { waitUntil: "domcontentloaded" });
      await handleAuthRedirect(page);

      await page.waitForSelector(
        "#date-grid .date-btn, #date-grid .empty-msg",
        { timeout: GAS_TIMEOUT }
      );

      const enabledBtns = page.locator("#date-grid .date-btn:not(.date-btn-disabled)");
      if (await enabledBtns.count() === 0) {
        test.skip(true, "空き枠なし — runRegenerateReservationSlots 実行後に再テスト");
        return;
      }
      await enabledBtns.first().click();

      await page.waitForSelector(
        "#slot-grid .slot-btn, #slot-grid .empty-msg",
        { timeout: GAS_TIMEOUT }
      );

      const slotBtns = page.locator("#slot-grid .slot-btn");
      if (await slotBtns.count() === 0) {
        test.skip(true, "選択した日に slot-btn なし");
        return;
      }

      // 最初の時間ボタンをクリック → Step 3 へ
      await slotBtns.first().click();

      // Step 3 が表示されること
      const s3 = page.locator("#s3");
      await expect(s3).toBeVisible({ timeout: 5_000 });

      // 必須フォーム項目の存在確認
      await expect(page.locator("#patientName")).toBeVisible(); // 氏名
      await expect(page.locator("#phone")).toBeVisible();       // 電話番号
      await expect(page.locator("input[name=isFirst]")).toHaveCount(2); // 来院歴ラジオ
      await expect(page.locator("#sub-btn")).toBeVisible();    // 送信ボタン
    });

    // ── R2A-8: テスト送信（手動確認推奨のため SKIP）────────────────────
    test.skip("R2A-8: テスト送信 → Step 4 完了画面（手動確認）", async () => {
      /*
       * 手動確認手順:
       * 1. /dev?page=reservationPublic を開く
       * 2. 日付 → 時間 → フォーム入力（テスト用氏名: テスト太郎 / 電話: 00000000001）
       * 3. 送信 → Step 4「受付が完了しました」表示を確認
       * 4. Reservations シートに status=requested 行が追加されたか確認
       * 5. 確認後、そのテスト行を手動削除
       */
    });

    // ── R2A-9: Reservations シート確認（手動確認）────────────────────
    test.skip("R2A-9: Reservations シートに予約行が追加される（手動確認）", async () => {
      /*
       * 手動確認手順:
       * スプレッドシート: https://docs.google.com/spreadsheets/d/15O2AIWv1OyZAXdCOWoz1-OxVukuFttHoZydsCDlYPX0/edit
       * → Reservations シート → 最終行に status=requested の行があることを確認
       * → テスト行は手動削除またはステータスを cancelled に変更
       */
    });
  }
);
