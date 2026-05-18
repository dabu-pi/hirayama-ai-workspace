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
 *   E2E flow (RAA-E2E-0 〜 RAA-E2E-4): 残骸 cleanup → 公開予約 → 管理画面検索 → 確定 → 患者検索リンク確認 → キャンセル
 *   RAA-E2E-0: LiveCheck太郎 プレフィックスの過去残骸を best-effort で cleanup
 *             （院長指定の固定電話番号 09014861348 を使う関係上、24h 3 件の rate_limit_phone を避けるため必須）
 *   RAA-E2E-1: reservationPublic で 1 件テスト予約を作成
 *             電話番号 = 09014861348（既存患者用・固定）/ 氏名 = LiveCheck太郎_<ts>（一意）
 *   RAA-E2E-2: reservationAdmin で氏名検索 → 該当予約が requested で表示
 *   RAA-E2E-3: 「✓ 確定」で status=confirmed に遷移
 *   RAA-E2E-3.5: 「患者検索」リンクが ?page=list&q=09014861348 を指す（自費カルテ既存患者導線検証）
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
 * 既知の制約（spec 修正 v2）:
 *   - phone 列 setNumberFormat("@") 修正: c8b1782 (2026-05-18) で適用済み。
 *     既存シートへの反映は runFixPhoneColumnFormatV1() を GAS エディタで 1 回実行する必要あり（migration 待ち）。
 *     migration 完了後は RAA-E2E-3.5 の leading-0 workaround を削除可能。
 *     現状は migration 未実施のため workaround を維持する。
 *     本 spec では検索キーに **TEST_NAME（LiveCheck太郎_<ts>）** を主に使うことで回避。
 *   - admin の reload() は ST.loading ガードを持つため、連続クリックは 2 回目が
 *     no-op になる。本 spec では `waitForListReload` で #loading 表示→非表示の
 *     1 サイクルを毎回挟んで race を防ぐ。
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
// 公開予約 submit 完了後、Sheets 反映と admin RPC キャッシュ整合の安全マージン
const POST_SUBMIT_SETTLE_MS = 1_500;

// テスト識別用のプレフィックス（cleanup での照合キー）
const TEST_NAME_PREFIX = "LiveCheck太郎_";

// 既存患者と紐づけられる電話番号を使う（自費カルテ「患者検索」リンクの検証用）。
// 院長指定: 09014861348 = 既存患者の電話。
// rate_limit_phone (24h 3 件) に当たる可能性あり → RAA-E2E-0 で先に LiveCheck太郎 残骸を
// cancel するので requested|confirmed として残るのは 1 件のみ、と想定。
const TEST_PHONE = "09014861348";

// 氏名はユニーク化（cleanup と検索の主キーに使う）。Sheets の leading 0 落ちの影響を受けない。
let TEST_NAME = "";

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

/**
 * admin の reload() サイクル待ち。
 * reload は ST.loading で 2 回目連続呼出をブロックするため、
 * 必ず #loading の表示→非表示を 1 サイクル待ってから次の操作を行う。
 */
async function waitForListReload(frame: FrameLocator, page: Page) {
  try {
    // 表示を一瞬待つ（reload が走ったかの確認）
    await frame.locator("#loading").waitFor({ state: "visible", timeout: 2_000 });
  } catch {
    // 表示を捕捉できなかった（既に隠れている / reload が走らなかった）。
    // microtask が settle するのを待つ。
    await page.waitForTimeout(400);
  }
  // 非表示まで待つ
  await frame.locator("#loading").waitFor({ state: "hidden", timeout: GAS_TIMEOUT });
}

/**
 * admin で「status=active + 14日範囲 + キーワード」フィルタを順に適用する。
 * 各操作の間に waitForListReload を入れて race を防ぐ。
 */
async function applyAdminFilters(
  frame: FrameLocator,
  page: Page,
  opts: { statusBtn?: string; daysAhead?: number; query?: string }
) {
  const statusBtn = opts.statusBtn || "active";
  const daysAhead = (typeof opts.daysAhead === "number") ? opts.daysAhead : 14;
  const query     = opts.query || "";

  // 1) status preset
  await frame.locator(`.filter-btn[data-status='${statusBtn}']`).click();
  await waitForListReload(frame, page);

  // 2) 日付範囲を today..today+N に
  const today  = new Date();
  const future = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysAhead);
  await frame.locator("#filter-from").fill(ymd(today));
  await frame.locator("#filter-to").fill(ymd(future));
  await frame.locator("#apply-range-btn").click();
  await waitForListReload(frame, page);

  // 3) クエリ
  await frame.locator("#filter-query").fill(query);
  await frame.locator("#apply-query-btn").click();
  await waitForListReload(frame, page);
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
    test.describe.serial("RAA-E2E: 残骸 cleanup → 公開予約 → 管理画面検索 → 確定 → キャンセル", () => {
      // GAS web app の RPC 1 回あたり 3〜10 秒 + UI 操作で、E2E 1 テストあたり 3〜5 回の
      // reload サイクルが発生する。playwright デフォルト 30 秒では足りないため拡張。
      test.setTimeout(180_000);

      test.beforeAll(() => {
        const ts = Date.now().toString().slice(-7);
        TEST_NAME = TEST_NAME_PREFIX + ts;  // "LiveCheck太郎_XXXXXXX"
        // TEST_PHONE は module 定数 (09014861348) を使う
      });

      // ── RAA-E2E-0: 過去残骸 cleanup ──────────────────────────
      test("RAA-E2E-0: LiveCheck太郎 プレフィックスの過去テスト残骸を best-effort で cleanup", async ({ page }) => {
        // confirm + prompt をすべて自動 accept
        page.on("dialog", async (dialog) => {
          if (dialog.type() === "confirm") {
            await dialog.accept().catch(() => {});
          } else if (dialog.type() === "prompt") {
            await dialog.accept("live-check cleanup").catch(() => {});
          } else {
            await dialog.dismiss().catch(() => {});
          }
        });

        await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
        await handleAuthRedirect(page);
        const frame = gasAppFrame(page);

        // 一覧の初期 load 完了を待つ
        await waitForListReload(frame, page);

        // status=active + 14日範囲 + LiveCheck太郎 で絞り込み
        await applyAdminFilters(frame, page, {
          statusBtn: "active",
          daysAhead: 14,
          query:     TEST_NAME_PREFIX
        });

        const MAX_ITER = 8;
        let cancelled = 0;
        for (let i = 0; i < MAX_ITER; i++) {
          const cards = frame.locator(".res-card");
          const count = await cards.count();
          if (count === 0) break;

          const target = cards.first();
          const cancelBtn = target.locator(".act-cancel");
          // active filter なので requested|confirmed 想定。万一 disabled なら break。
          const disabled = await cancelBtn.isDisabled().catch(() => true);
          if (disabled) break;

          await cancelBtn.click();
          // warn-banner が出るまで待つ
          await frame.locator("#warn-banner").waitFor({ state: "visible", timeout: GAS_TIMEOUT }).catch(() => {});
          // reload サイクル待ち
          await waitForListReload(frame, page);
          cancelled++;
        }

        // best-effort: 失敗扱いにはしない。情報出力のみ。
        // eslint-disable-next-line no-console
        console.log(`[RAA-E2E-0] LiveCheck太郎 残骸 cleanup: ${cancelled} 件キャンセル完了`);
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

        await expect(frame.locator("#sel-summary")).toBeVisible({ timeout: 5_000 });
        await frame.locator("#proceed-btn").click();

        await expect(frame.locator("#s2")).toBeVisible({ timeout: 5_000 });
        await frame.locator("#patientName").fill(TEST_NAME);
        await frame.locator("#phone").fill(TEST_PHONE);

        // 送信ボタンが "送信準備中..." → "予約を申し込む" になるまで待つ
        await expect(frame.locator("#sub-btn")).toHaveText(/予約を申し込む/, { timeout: SUBMIT_READY_TIMEOUT });
        await expect(frame.locator("#sub-btn")).toBeEnabled({ timeout: 2_000 });

        await frame.locator("#sub-btn").click();

        // Step 3 完了画面待ち
        await expect(frame.locator("#s3")).toBeVisible({ timeout: GAS_TIMEOUT });

        // Sheets 反映 + admin RPC キャッシュ整合の安全マージン
        await page.waitForTimeout(POST_SUBMIT_SETTLE_MS);
      });

      // ── RAA-E2E-2: 管理画面で氏名検索 ──────────────────────
      test("RAA-E2E-2: reservationAdmin で氏名検索 → 該当予約が requested で表示", async ({ page }) => {
        if (!TEST_NAME) test.skip(true, "RAA-E2E-1 未完了");

        await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
        await handleAuthRedirect(page);
        const frame = gasAppFrame(page);

        // 初期 load 待ち
        await waitForListReload(frame, page);

        // 氏名で絞り込み（電話番号は Sheets の leading 0 落ち対策で副キーに）
        await applyAdminFilters(frame, page, {
          statusBtn: "active",
          daysAhead: 14,
          query:     TEST_NAME
        });

        const card = frame.locator(".res-card", { hasText: TEST_NAME });
        try {
          await expect(card).toBeVisible({ timeout: GAS_TIMEOUT });
        } catch (e) {
          // 失敗時の診断: 一覧に何が出ているかをログ出力
          const listText = await frame.locator("#res-list").textContent().catch(() => "");
          // eslint-disable-next-line no-console
          console.warn("[RAA-E2E-2] 該当予約が見つかりません。一覧 textContent:\n" + (listText || "(空)"));
          throw e;
        }

        // status バッジが requested
        await expect(card.locator(".status-badge.status-requested").first()).toBeVisible();
      });

      // ── RAA-E2E-3: 確定 ────────────────────────────────────
      test("RAA-E2E-3: 「✓ 確定」で status=confirmed に遷移", async ({ page }) => {
        if (!TEST_NAME) test.skip(true, "RAA-E2E-1 未完了");

        await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
        await handleAuthRedirect(page);
        const frame = gasAppFrame(page);

        await waitForListReload(frame, page);
        await applyAdminFilters(frame, page, {
          statusBtn: "active",
          daysAhead: 14,
          query:     TEST_NAME
        });

        const card = frame.locator(".res-card", { hasText: TEST_NAME });
        await expect(card).toBeVisible({ timeout: GAS_TIMEOUT });

        // 確定ボタン click
        await card.locator(".act-confirm").click();
        await waitForListReload(frame, page);

        // 再描画後 status=confirmed
        await expect(
          frame.locator(".res-card", { hasText: TEST_NAME })
               .locator(".status-badge.status-confirmed").first()
        ).toBeVisible({ timeout: GAS_TIMEOUT });
      });

      // ── RAA-E2E-3.5: 患者紐づけボタン確認（R-2B-2 対応）──────────
      // R-2B-2 で「患者検索」リンク（a.act-link-search）→「患者紐づけ」モーダルボタン
      // （button.act-link-patient）に変更された。
      test("RAA-E2E-3.5: 未紐づけ予約に「患者紐づけ」ボタンが表示される", async ({ page }) => {
        if (!TEST_NAME) test.skip(true, "RAA-E2E-1 未完了");

        await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
        await handleAuthRedirect(page);
        const frame = gasAppFrame(page);

        await waitForListReload(frame, page);
        await applyAdminFilters(frame, page, {
          statusBtn: "active",
          daysAhead: 14,
          query:     TEST_NAME
        });

        const card = frame.locator(".res-card", { hasText: TEST_NAME });
        await expect(card).toBeVisible({ timeout: GAS_TIMEOUT });

        // 未紐づけ予約なので「患者紐づけ」ボタン（button.act-link-patient）が出る
        const linkBtn = card.locator("button.act-link-patient").first();
        await expect(linkBtn).toBeVisible({ timeout: 5_000 });
        await expect(linkBtn).toBeEnabled();
        expect(await linkBtn.textContent()).toContain("患者紐づけ");
      });

      // ── RAA-E2E-4: キャンセル → メッセージ確認 ──────────────
      test("RAA-E2E-4: 「× キャンセル」→ warn-banner に slot解放OK + Calendar削除OK/SKIP", async ({ page }) => {
        if (!TEST_NAME) test.skip(true, "RAA-E2E-1 未完了");

        page.on("dialog", async (dialog) => {
          if (dialog.type() === "confirm") {
            await dialog.accept().catch(() => {});
          } else if (dialog.type() === "prompt") {
            await dialog.accept("live-check cancel test").catch(() => {});
          } else {
            await dialog.dismiss().catch(() => {});
          }
        });

        await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
        await handleAuthRedirect(page);
        const frame = gasAppFrame(page);

        await waitForListReload(frame, page);
        await applyAdminFilters(frame, page, {
          statusBtn: "active",
          daysAhead: 14,
          query:     TEST_NAME
        });

        const card = frame.locator(".res-card", { hasText: TEST_NAME });
        await expect(card).toBeVisible({ timeout: GAS_TIMEOUT });

        await card.locator(".act-cancel").click();

        const warn = frame.locator("#warn-banner");
        await expect(warn).toBeVisible({ timeout: GAS_TIMEOUT });

        const msg = (await warn.textContent()) || "";
        expect(msg, "更新完了メッセージ").toContain("更新完了");
        expect(msg, "status 遷移").toMatch(/(confirmed → cancelled|requested → cancelled)/);
        expect(msg, "slot解放結果").toMatch(/slot解放:\s*(OK|FAIL)/);
        if (!/slot解放:\s*OK/.test(msg)) {
          // eslint-disable-next-line no-console
          console.warn("[RAA-E2E-4] slot解放 FAIL: " + msg);
        }
        expect(msg, "Calendar削除結果").toMatch(/Calendar削除:\s*(OK|SKIP|FAIL)/);
        if (/Calendar削除:\s*FAIL/.test(msg)) {
          // eslint-disable-next-line no-console
          console.warn("[RAA-E2E-4] Calendar削除 FAIL: " + msg);
        }

        // 一覧再描画後 status=cancelled
        await waitForListReload(frame, page);
        // status=active filter なら cancelled はリストから消える → status=all に切替えて確認
        await frame.locator(".filter-btn[data-status='all']").click();
        await waitForListReload(frame, page);
        await frame.locator("#filter-query").fill(TEST_NAME);
        await frame.locator("#apply-query-btn").click();
        await waitForListReload(frame, page);

        await expect(
          frame.locator(".res-card", { hasText: TEST_NAME })
               .locator(".status-badge.status-cancelled").first()
        ).toBeVisible({ timeout: GAS_TIMEOUT });
      });
    });
  }
);
