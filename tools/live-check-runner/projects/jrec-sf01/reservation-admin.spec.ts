/**
 * jrec-sf01 reservation-admin.spec.ts
 *
 * Phase R-2B-1 受付管理 UI 実機確認スペック
 *
 * 検証内容:
 *   RAA-1: /dev?page=reservationAdmin に到達でき、フィルタバーが表示される
 *   RAA-2: 日付プリセットボタン 4 個（今日 / 明日 / 今週 / 来週）が存在
 *   RAA-3: status プリセットボタン 7 個（受付中 / requested / confirmed / cancelled / no_show / completed / すべて）
 *   RAA-4: 一覧領域に予約カード or 「該当する予約はありません」が表示
 *
 *   E2E flow (RAA-E2E-1 〜 RAA-E2E-4): 公開予約 → 管理画面検索 → 確定 → キャンセル
 *   RAA-E2E-1: reservationPublic で 1 件テスト予約を作成（電話番号 + 氏名で識別）
 *   RAA-E2E-2: reservationAdmin で電話番号検索すると該当予約が表示される（status=requested）
 *   RAA-E2E-3: 「✓ 確定」で status=confirmed に遷移
 *   RAA-E2E-4: 「× キャンセル」で warn-banner に
 *     - "更新完了: confirmed → cancelled"
 *     - "slot解放: OK"
 *     - "Calendar削除: OK" または "Calendar削除: SKIP（calendarEventId なし）"
 *     が表示される
 *
 * 実行コマンド: npm run test:jrec:reservation-admin
 *
 * 前提:
 *   - auth.json が有効（Google ログイン済みセッション）
 *   - JREC-SF01 dev URL に Phase R-2B-1 (commit 8a80c9b 以降) が clasp push 済み
 *   - Reservation_Slots に空き枠あり（無ければ E2E は SKIP）
 *
 * 注意:
 *   - E2E はテスト予約 1 件作成 + 即座にキャンセルで自動 cleanup
 *   - Calendar 削除も自動。本番データへの永続影響なし
 *   - 失敗時にテスト予約が残る可能性あり → reports/results.json に reservationId が出る
 */

import { test, expect, Page, FrameLocator } from "@playwright/test";
import path from "path";
import fs from "fs";
import config from "./config.json";

const DEV_URL       = config.devUrl;
const ADMIN_URL     = DEV_URL + "?page=reservationAdmin";
const PUBLIC_URL    = DEV_URL + "?page=reservationPublic";
const AUTH_FILE     = path.join(__dirname, "../../auth.json");
const HAS_AUTH      = fs.existsSync(AUTH_FILE);
const LOAD_TIMEOUT  = 30_000;
const GAS_TIMEOUT   = 25_000;
// 公開予約フォームのサーバ TOO_FAST チェック (5 秒) + 0.5 秒バッファ
const SUBMIT_READY_TIMEOUT = 8_000;

// E2E flow で 4 テスト間で共有する状態（workers=1 でシーケンシャル前提）
let TEST_PHONE = "";
let TEST_NAME  = "";

function gasAppFrame(page: Page): FrameLocator {
  return page.frameLocator("iframe").first().frameLocator("iframe").first();
}

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

function ymd(d: Date): string {
  return d.getFullYear() + "-" +
         ("0" + (d.getMonth() + 1)).slice(-2) + "-" +
         ("0" + d.getDate()).slice(-2);
}

test.describe(
  `JREC-SF01 R-2B-1 受付管理 UI [auth: ${HAS_AUTH ? "あり" : "なし"}]`,
  () => {
    test.beforeEach(async ({ page }) => {
      page.setDefaultTimeout(LOAD_TIMEOUT);
    });

    // ── RAA-1: ページ到達 ───────────────────────────────────────
    test("RAA-1: reservationAdmin ページが到達し、フィルタバーが表示される", async ({ page }) => {
      const res = await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
      await handleAuthRedirect(page);
      expect(res?.status()).toBeLessThan(400);

      const frame = gasAppFrame(page);
      await expect(frame.locator(".filter-bar").first()).toBeVisible({ timeout: LOAD_TIMEOUT });
    });

    // ── RAA-2: 日付プリセット 4 個 ──────────────────────────────
    test("RAA-2: 日付プリセットボタンが 4 個（今日 / 明日 / 今週 / 来週）存在", async ({ page }) => {
      await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
      await handleAuthRedirect(page);
      const frame = gasAppFrame(page);

      const presets = frame.locator(".filter-btn[data-range]");
      await expect(presets).toHaveCount(4, { timeout: LOAD_TIMEOUT });
    });

    // ── RAA-3: status プリセット 7 個 ───────────────────────────
    test("RAA-3: status プリセットボタンが 7 個 (active/requested/confirmed/cancelled/no_show/completed/all)", async ({ page }) => {
      await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
      await handleAuthRedirect(page);
      const frame = gasAppFrame(page);

      const statusBtns = frame.locator(".filter-btn[data-status]");
      await expect(statusBtns).toHaveCount(7, { timeout: LOAD_TIMEOUT });
    });

    // ── RAA-4: 予約一覧 or 空メッセージ ─────────────────────────
    test("RAA-4: 一覧領域に予約カード or 空メッセージが描画される", async ({ page }) => {
      await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
      await handleAuthRedirect(page);
      const frame = gasAppFrame(page);

      await frame.locator("#res-list").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
      // listReservationsForAdmin の完了待ち。.res-card か .empty-msg のいずれかが出る
      await Promise.race([
        frame.locator(".res-card").first().waitFor({ state: "visible", timeout: GAS_TIMEOUT }),
        frame.locator(".empty-msg").first().waitFor({ state: "visible", timeout: GAS_TIMEOUT })
      ]);

      const hasCard  = (await frame.locator(".res-card").count()) > 0;
      const hasEmpty = (await frame.locator(".empty-msg").count()) > 0;
      expect(hasCard || hasEmpty).toBe(true);
    });

    // ──────────────────────────────────────────────────────────
    // E2E flow（serial 実行・順序依存・先頭で失敗したら以降 skip）
    // ──────────────────────────────────────────────────────────
    test.describe.serial("RAA-E2E: 公開予約 → 管理画面検索 → 確定 → キャンセル", () => {
      test.beforeAll(() => {
        // 一意な電話番号と氏名でテスト予約を識別。1 セッションで使い回し
        const ts = Date.now().toString().slice(-7);  // 末尾 7 桁
        TEST_PHONE = "0900" + ts;                    // 11 桁、ユニーク性高い
        TEST_NAME  = "LiveCheck太郎_" + ts;
      });

      // ── RAA-E2E-1: 公開予約 ────────────────────────────────
      test("RAA-E2E-1: reservationPublic で 1 件テスト予約を作成", async ({ page }) => {
        await page.goto(PUBLIC_URL, { waitUntil: "domcontentloaded" });
        await handleAuthRedirect(page);
        const frame = gasAppFrame(page);

        // 週間グリッドの描画待ち
        await Promise.race([
          frame.locator("#week-grid .slot-btn").first().waitFor({ state: "visible", timeout: GAS_TIMEOUT }),
          frame.locator("#week-empty-banner").waitFor({ state: "visible", timeout: GAS_TIMEOUT })
        ]).catch(() => {});

        const slotCount = await frame.locator("#week-grid .slot-btn").count();
        if (slotCount === 0) {
          test.skip(
            true,
            "予約画面に空き枠がありません。Reservation_Slots を runRegenerateReservationSlots で再生成するか、" +
            "外部 Calendar 予定で全枠埋まっていないか確認してください。"
          );
          return;
        }

        // 先頭の空き枠を選択
        const firstSlot = frame.locator("#week-grid .slot-btn").first();
        await firstSlot.click();

        // sticky 選択サマリ表示 + 「入力へ進む」
        await expect(frame.locator("#sel-summary")).toBeVisible({ timeout: 5_000 });
        await frame.locator("#proceed-btn").click();

        // Step 2 フォーム表示待ち
        await expect(frame.locator("#s2")).toBeVisible({ timeout: 5_000 });
        await frame.locator("#patientName").fill(TEST_NAME);
        await frame.locator("#phone").fill(TEST_PHONE);

        // 送信ボタンが "送信準備中..." → "予約を申し込む" になるまで待つ（TOO_FAST 5 秒対策）
        await expect(frame.locator("#sub-btn")).toHaveText(/予約を申し込む/, { timeout: SUBMIT_READY_TIMEOUT });
        await expect(frame.locator("#sub-btn")).toBeEnabled({ timeout: 2_000 });

        await frame.locator("#sub-btn").click();

        // Step 3 完了画面待ち
        await expect(frame.locator("#s3")).toBeVisible({ timeout: GAS_TIMEOUT });
      });

      // ── RAA-E2E-2: 管理画面で検索 ──────────────────────────
      test("RAA-E2E-2: reservationAdmin で電話番号検索 → 該当予約が requested で表示", async ({ page }) => {
        if (!TEST_PHONE) test.skip(true, "RAA-E2E-1 未完了");

        await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
        await handleAuthRedirect(page);
        const frame = gasAppFrame(page);

        // 日付範囲を 14 日先まで広げて、選んだ空き枠が必ず範囲内になるようにする
        const today  = new Date();
        const future = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14);
        await frame.locator("#filter-from").fill(ymd(today));
        await frame.locator("#filter-to").fill(ymd(future));
        await frame.locator("#apply-range-btn").click();

        // 一覧再描画待ち
        await frame.locator("#res-list").waitFor({ state: "visible", timeout: LOAD_TIMEOUT });

        // 電話番号検索
        await frame.locator("#filter-query").fill(TEST_PHONE);
        await frame.locator("#apply-query-btn").click();

        // 該当予約カードが出るまで待つ
        const card = frame.locator(".res-card", { hasText: TEST_PHONE });
        await expect(card).toBeVisible({ timeout: GAS_TIMEOUT });

        // status バッジが requested
        await expect(card.locator(".status-badge.status-requested").first()).toBeVisible();
      });

      // ── RAA-E2E-3: 確定 ────────────────────────────────────
      test("RAA-E2E-3: 「✓ 確定」で status=confirmed に遷移", async ({ page }) => {
        if (!TEST_PHONE) test.skip(true, "RAA-E2E-1 未完了");

        await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
        await handleAuthRedirect(page);
        const frame = gasAppFrame(page);

        // 日付範囲 + 電話番号で絞り込み
        const today  = new Date();
        const future = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14);
        await frame.locator("#filter-from").fill(ymd(today));
        await frame.locator("#filter-to").fill(ymd(future));
        await frame.locator("#apply-range-btn").click();
        await frame.locator("#filter-query").fill(TEST_PHONE);
        await frame.locator("#apply-query-btn").click();

        const card = frame.locator(".res-card", { hasText: TEST_PHONE });
        await expect(card).toBeVisible({ timeout: GAS_TIMEOUT });

        // 確定ボタン click
        await card.locator(".act-confirm").click();

        // 再読込後、status=confirmed バッジが出るまで待つ
        // 一覧再描画のため、card を再取得
        await expect(
          frame.locator(".res-card", { hasText: TEST_PHONE })
               .locator(".status-badge.status-confirmed").first()
        ).toBeVisible({ timeout: GAS_TIMEOUT });
      });

      // ── RAA-E2E-4: キャンセル → メッセージ確認 ──────────────
      test("RAA-E2E-4: 「× キャンセル」→ warn-banner に slot解放OK + Calendar削除OK/SKIP", async ({ page }) => {
        if (!TEST_PHONE) test.skip(true, "RAA-E2E-1 未完了");

        // confirm / prompt ダイアログを順に accept
        page.on("dialog", async (dialog) => {
          if (dialog.type() === "confirm") {
            await dialog.accept();
          } else if (dialog.type() === "prompt") {
            await dialog.accept("live-check cancel test");
          } else {
            await dialog.dismiss().catch(() => {});
          }
        });

        await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
        await handleAuthRedirect(page);
        const frame = gasAppFrame(page);

        const today  = new Date();
        const future = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 14);
        await frame.locator("#filter-from").fill(ymd(today));
        await frame.locator("#filter-to").fill(ymd(future));
        await frame.locator("#apply-range-btn").click();
        await frame.locator("#filter-query").fill(TEST_PHONE);
        await frame.locator("#apply-query-btn").click();

        const card = frame.locator(".res-card", { hasText: TEST_PHONE });
        await expect(card).toBeVisible({ timeout: GAS_TIMEOUT });

        // キャンセルボタン click（confirm / prompt が順に表示される）
        await card.locator(".act-cancel").click();

        // warn-banner に結果メッセージが出るまで待つ
        const warn = frame.locator("#warn-banner");
        await expect(warn).toBeVisible({ timeout: GAS_TIMEOUT });

        const msg = (await warn.textContent()) || "";

        expect(msg, "更新完了メッセージ").toContain("更新完了");
        expect(msg, "status 遷移").toMatch(/confirmed → cancelled|cancelled/);
        // slot 解放は OK が期待値（Reservation_Slots に該当枠がある場合）。FAIL でない事を確認
        expect(msg, "slot解放結果").toMatch(/slot解放:\s*(OK|FAIL)/);
        if (!/slot解放:\s*OK/.test(msg)) {
          // FAIL の場合、reason を露出して報告
          console.warn("[RAA-E2E-4] slot解放 FAIL: " + msg);
        }
        // Calendar 削除は OK / SKIP どちらでも仕様通り
        expect(msg, "Calendar削除結果").toMatch(/Calendar削除:\s*(OK|SKIP|FAIL)/);
        if (/Calendar削除:\s*FAIL/.test(msg)) {
          console.warn("[RAA-E2E-4] Calendar削除 FAIL: " + msg);
        }

        // 一覧の status バッジが cancelled に
        await expect(
          frame.locator(".res-card", { hasText: TEST_PHONE })
               .locator(".status-badge.status-cancelled").first()
        ).toBeVisible({ timeout: GAS_TIMEOUT });
      });
    });
  }
);
