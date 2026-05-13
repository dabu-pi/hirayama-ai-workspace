/**
 * jrec-sf01 gym-referral.spec.ts
 * TASK-JREC-1C-001: gym_referral フラグ群（SelfPayChart 13〜22 列）UI / 保存 自動確認
 *
 * 自動確認項目（DOM のみ・migration や保存処理は手動確認）:
 *   GYM-1: visitForm に #gymReferralSection が存在する
 *   GYM-2: 5つの boolean checkbox が存在する
 *   GYM-3: #gymReferralStatus セレクトに 8 個の状態オプションが揃っている
 *   GYM-4: 理由 / 次回アクション / メモ textarea/input が存在する
 *   GYM-5: 回帰 — AI-4.5 #aiAssistCard が維持
 *   GYM-6: 回帰 — AI-5 #aiTrendCard が維持
 *   GYM-7: 回帰 — Chart-Ref-2 quoteToField 関数残存
 *   GYM-PROD-1: production /exec で #gymReferralSection 表示
 *
 * 人間確認項目（このスペック対象外）:
 *   GYM-H1: GAS エディタから migrateAddGymReferralFields() を実行し、SelfPayChart に 10 列追加（冪等）
 *           もしくは `?action=migrateGymReferral` URL を開く
 *   GYM-H2: 新規 visit にチェック / 状態 / 理由を入力 → 保存 → 編集モードで再表示時に復元
 *   GYM-H3: 既存 visit（migration 前に作成）を開いて gym_referral 部分が安全に空表示
 *   GYM-H4: `?action=gymReferralKpiSummary&targetMonth=YYYY-MM` の JSON が正しく返る
 *   GYM-H5: 既存 AI-4.5 saved banner / Chart-Ref / 引用ボタン / 会計が壊れていない
 *
 * 実行コマンド: npm run test:jrec:gym-referral
 */

import { test, expect, Page } from "@playwright/test";
import fs from "fs";
import path from "path";
import config from "./config.json";

const DEV_URL      = config.devUrl;
const PROD_URL     = (config as any).prodUrl as string | undefined;
const AUTH_FILE    = path.join(__dirname, "../../auth.json");
const HAS_AUTH     = fs.existsSync(AUTH_FILE);
const LOAD_TIMEOUT = 25_000;

const TEST_PATIENT_ID = config.testData.patientIdForVisitForm;

function gasAppFrame(page: Page) {
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
        : "Google 認証が必要です。npm run save-auth を実行して auth.json を作成してください。"
    );
  }
}

function skipIfNoPatientId() {
  if (!TEST_PATIENT_ID) {
    test.skip(true, "GYM テストは config.json の testData.patientIdForVisitForm に有効な患者IDが必要です。");
  }
}

test.describe(`JREC-SF01 TASK-JREC-1C-001: gym_referral UI / 回帰 [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(LOAD_TIMEOUT);
  });

  test("GYM-1: visitForm — #gymReferralSection が存在する", async ({ page }) => {
    skipIfNoPatientId();
    await page.goto(`${DEV_URL}?page=visitForm&id=${TEST_PATIENT_ID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await expect(frame.locator("#gymReferralSection")).toBeAttached({ timeout: LOAD_TIMEOUT });
  });

  test("GYM-2: visitForm — 5つの gym checkbox が存在する", async ({ page }) => {
    skipIfNoPatientId();
    await page.goto(`${DEV_URL}?page=visitForm&id=${TEST_PATIENT_ID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await expect(frame.locator("#gymReferralCandidate")).toBeAttached();
    await expect(frame.locator("#gymReferralRecommended")).toBeAttached();
    await expect(frame.locator("#gymTrialProposed")).toBeAttached();
    await expect(frame.locator("#gymTrialBooked")).toBeAttached();
    await expect(frame.locator("#gymJoined")).toBeAttached();
  });

  test("GYM-3: visitForm — #gymReferralStatus セレクトに 8 状態オプション", async ({ page }) => {
    skipIfNoPatientId();
    await page.goto(`${DEV_URL}?page=visitForm&id=${TEST_PATIENT_ID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await expect(frame.locator("#gymReferralStatus")).toBeAttached();
    const values = await frame.locator("#gymReferralStatus option").evaluateAll((opts: any[]) =>
      opts.map((o) => o.value)
    );
    for (const v of ["not_applicable", "candidate", "recommended", "trial_proposed", "trial_booked", "joined", "declined", "follow_up"]) {
      expect(values).toContain(v);
    }
  });

  test("GYM-4: visitForm — 理由 / 次回アクション / メモ 入力欄が存在する", async ({ page }) => {
    skipIfNoPatientId();
    await page.goto(`${DEV_URL}?page=visitForm&id=${TEST_PATIENT_ID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await expect(frame.locator("#gymReferralReason")).toBeAttached();
    await expect(frame.locator("#gymReferralNextAction")).toBeAttached();
    await expect(frame.locator("#gymReferralNote")).toBeAttached();
  });

  test("GYM-5: 回帰 — AI-4.5 #aiAssistCard が維持されている", async ({ page }) => {
    skipIfNoPatientId();
    await page.goto(`${DEV_URL}?page=visitForm&id=${TEST_PATIENT_ID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await expect(frame.locator("#aiAssistCard")).toBeVisible({ timeout: LOAD_TIMEOUT });
  });

  test("GYM-6: 回帰 — AI-5 #aiTrendCard が維持されている", async ({ page }) => {
    skipIfNoPatientId();
    await page.goto(`${DEV_URL}?page=visitForm&id=${TEST_PATIENT_ID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await expect(frame.locator("#aiTrendCard")).toBeVisible({ timeout: LOAD_TIMEOUT });
  });

  test("GYM-7: 回帰 — Chart-Ref-2 quoteToField 関数残存", async ({ page }) => {
    skipIfNoPatientId();
    await page.goto(`${DEV_URL}?page=visitForm&id=${TEST_PATIENT_ID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await expect(frame.locator("#gymReferralSection")).toBeAttached({ timeout: LOAD_TIMEOUT });
    const hasQuoteFn = await frame.locator("script").evaluateAll((els: any[]) =>
      els.some((s) => s.textContent && s.textContent.indexOf("function quoteToField") >= 0)
    );
    expect(hasQuoteFn).toBe(true);
  });
});

test.describe("JREC-SF01 TASK-JREC-1C-001: 本番 /exec 回帰確認", () => {
  test("GYM-PROD-1: production /exec で #gymReferralSection が存在する", async ({ page }) => {
    skipIfNoPatientId();
    if (!PROD_URL) test.skip(true, "config.json に prodUrl が設定されていません。");
    await page.goto(`${PROD_URL}?page=visitForm&id=${TEST_PATIENT_ID}`, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await expect(frame.locator("#gymReferralSection")).toBeAttached({ timeout: LOAD_TIMEOUT });
  });
});

test.describe("JREC-SF01 TASK-JREC-1C-001: 人間確認項目（自動化対象外）", () => {
  test("GYM-H1: migration 実行 — GAS エディタ or ?action=migrateGymReferral", async () => {
    test.skip(true,
      "手動: GAS エディタで migrateAddGymReferralFields() を実行、または ?action=migrateGymReferral を開く。" +
      "返却 JSON の added_columns / already_exists を確認。冪等性を確認（2回目以降は added_columns=[]）。"
    );
  });

  test("GYM-H2: 新規 visit に入力 → 保存 → 編集モード再表示で復元 — 手動確認", async () => {
    test.skip(true,
      "手動: 新規カルテで gym_referral セクションを開き、checkbox / select / textarea を入力。保存後に編集モードで開き直し、" +
      "値が復元されることを確認。"
    );
  });

  test("GYM-H3: migration 前の既存 visit が壊れずに開ける — 手動確認", async () => {
    test.skip(true,
      "手動: migration 実行前に作成された既存 visit を開く。gym_referral 部分は空表示で、フォームは白画面にならない。"
    );
  });

  test("GYM-H4: ?action=gymReferralKpiSummary の JSON が返る — 手動確認", async () => {
    test.skip(true,
      "手動: /exec?action=gymReferralKpiSummary&targetMonth=YYYY-MM を開く。" +
      "ok:true / selfpay_visit_count / 各カウント / referral_rate を含む JSON が返る。" +
      "migration 未実行時は data_quality_warnings に 'gym_referral カラム未追加' が入る。"
    );
  });

  test("GYM-H5: 既存 AI-4.5 / Chart-Ref / 会計が壊れていない — 手動確認", async () => {
    test.skip(true,
      "手動: 過去カルテのある patient の visitForm を開いて AI-4.5 青バナー / Chart-Ref 表示 / 引用ボタンが動作することを確認。" +
      "会計画面（?page=billing）が開けることを確認。"
    );
  });
});
