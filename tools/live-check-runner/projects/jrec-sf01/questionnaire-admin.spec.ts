/**
 * jrec-sf01 questionnaire-admin.spec.ts
 *
 * Phase Q-1A admin-base UI 実機確認スペック
 *
 * 検証内容:
 *   QA-SETUP-1: q1aTestInsert でテスト行を SelfPayQuestionnaires に投入できる
 *   QA-1: questionnaireAdmin ページが構築エラーなく表示される
 *   QA-2: filter ボタン 5 個が存在する
 *   QA-3: filter=all でテスト行が一覧に表示される
 *   QA-4: questionnaireDetail ページが構築エラーなく表示される
 *   QA-5: q1aTestMemo で staffMemo が保存される (ok=true)
 *   QA-6: QUESTIONNAIRE_MEMO が Run_Log に記録される
 *   QA-7: q1aTestTrash でゴミ箱に移動できる (ok=true)
 *   QA-8: QUESTIONNAIRE_TRASH が Run_Log に記録 / trashedAt が入る
 *   QA-9: filter=trashed でゴミ箱行が表示される
 *   QA-CLEANUP: テスト行を q1aTestCleanup で削除できる
 *
 * 実行コマンド: npm run test:jrec:questionnaire-admin
 *
 * 前提:
 *   - auth.json が有効であること (Google 認証済みセッション)
 *   - SelfPayQuestionnaires シートが migration 済みであること (Q-1A CLOSED)
 *   - dev URL の HEAD に Q-1A + テストアクションが push 済みであること
 */

import { test, expect, Page } from "@playwright/test";
import path from "path";
import fs from "fs";
import config from "./config.json";

const DEV_URL   = config.devUrl;
const AUTH_FILE = path.join(__dirname, "../../auth.json");
const HAS_AUTH  = fs.existsSync(AUTH_FILE);
const LOAD_TIMEOUT  = 30_000;
const FETCH_TIMEOUT = 25_000;

// module-level: workers=1 でシーケンシャル実行のため共有可
let TEST_QUESTIONNAIRE_ID = "";

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
        : "Google 認証が必要です。npm run save-auth を実行してください。"
    );
  }
}

/**
 * dev URL で action endpoint を呼び出して JSON を返す。
 * ContentService.createTextOutput(json) は body に JSON テキストを表示する。
 */
async function callTestAction(
  page: Page,
  action: string,
  params: Record<string, string> = {}
): Promise<any> {
  const qs = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  const url = `${DEV_URL}?action=${action}${qs ? "&" + qs : ""}`;
  await page.goto(url, { timeout: FETCH_TIMEOUT });
  await handleAuthRedirect(page);
  const bodyText = (await page.locator("body").textContent({ timeout: FETCH_TIMEOUT })) || "";
  try {
    return JSON.parse(bodyText.trim());
  } catch {
    return { ok: false, rawBody: bodyText.slice(0, 500) };
  }
}

test.describe(
  `JREC-SF01 Q-1A questionnaireAdmin 実機確認 [auth: ${HAS_AUTH ? "あり" : "なし"}]`,
  () => {
    test.beforeEach(async ({ page }) => {
      page.setDefaultTimeout(LOAD_TIMEOUT);
    });

    // ----------------------------------------------------------------
    // セットアップ: テスト行投入
    // ----------------------------------------------------------------
    test("QA-SETUP-1: q1aTestInsert でテスト行を投入できる", async ({ page }) => {
      const res = await callTestAction(page, "q1aTestInsert");
      expect(res.ok, `insert failed: ${JSON.stringify(res)}`).toBe(true);
      expect(typeof res.questionnaireId, "questionnaireId should be string").toBe("string");
      expect(res.questionnaireId, "questionnaireId should start with QTEST_").toMatch(/^QTEST_\d{14}$/);
      TEST_QUESTIONNAIRE_ID = res.questionnaireId;
    });

    // ----------------------------------------------------------------
    // admin 一覧ページ
    // ----------------------------------------------------------------
    test("QA-1: questionnaireAdmin ページが構築エラーなく表示される", async ({ page }) => {
      await page.goto(`${DEV_URL}?page=questionnaireAdmin&filter=all`, {
        waitUntil: "domcontentloaded",
        timeout: LOAD_TIMEOUT,
      });
      await handleAuthRedirect(page);
      const frame = gasAppFrame(page);
      await expect(frame.locator(".filter-bar")).toBeVisible({ timeout: LOAD_TIMEOUT });
    });

    test("QA-2: filter ボタン 5 個（pending/submitted/transferred/trashed/all）が存在する", async ({ page }) => {
      await page.goto(`${DEV_URL}?page=questionnaireAdmin&filter=all`, {
        waitUntil: "domcontentloaded",
        timeout: LOAD_TIMEOUT,
      });
      await handleAuthRedirect(page);
      const frame = gasAppFrame(page);
      await expect(frame.locator(".filter-btn")).toHaveCount(5, { timeout: LOAD_TIMEOUT });
    });

    test("QA-3: filter=all でテスト行が一覧に表示される", async ({ page }) => {
      if (!TEST_QUESTIONNAIRE_ID) {
        test.skip(true, "QA-SETUP-1 未完了（TEST_QUESTIONNAIRE_ID が空）");
      }
      await page.goto(`${DEV_URL}?page=questionnaireAdmin&filter=all`, {
        waitUntil: "domcontentloaded",
        timeout: LOAD_TIMEOUT,
      });
      await handleAuthRedirect(page);
      const frame = gasAppFrame(page);
      await expect(
        frame.locator(`text=${TEST_QUESTIONNAIRE_ID}`)
      ).toBeVisible({ timeout: LOAD_TIMEOUT });
    });

    // ----------------------------------------------------------------
    // detail ページ
    // ----------------------------------------------------------------
    test("QA-4: questionnaireDetail ページが構築エラーなく表示される", async ({ page }) => {
      if (!TEST_QUESTIONNAIRE_ID) {
        test.skip(true, "QA-SETUP-1 未完了");
      }
      await page.goto(
        `${DEV_URL}?page=questionnaireDetail&id=${encodeURIComponent(TEST_QUESTIONNAIRE_ID)}`,
        { waitUntil: "domcontentloaded", timeout: LOAD_TIMEOUT }
      );
      await handleAuthRedirect(page);
      const frame = gasAppFrame(page);
      // questionnaireId が表示される
      await expect(
        frame.locator(`text=${TEST_QUESTIONNAIRE_ID}`)
      ).toBeVisible({ timeout: LOAD_TIMEOUT });
      // staffMemo textarea が存在する
      await expect(
        frame.locator("#staffMemo")
      ).toBeVisible({ timeout: LOAD_TIMEOUT });
    });

    // ----------------------------------------------------------------
    // staffMemo 保存
    // ----------------------------------------------------------------
    test("QA-5: q1aTestMemo で staffMemo が保存される (ok=true)", async ({ page }) => {
      if (!TEST_QUESTIONNAIRE_ID) {
        test.skip(true, "QA-SETUP-1 未完了");
      }
      const res = await callTestAction(page, "q1aTestMemo", {
        id:   TEST_QUESTIONNAIRE_ID,
        memo: "Q1A自動検証スタッフメモ",
      });
      expect(res.ok, `staffMemo save failed: ${JSON.stringify(res)}`).toBe(true);
    });

    test("QA-6: staffMemo 保存後 Run_Log に QUESTIONNAIRE_MEMO が記録される", async ({ page }) => {
      if (!TEST_QUESTIONNAIRE_ID) {
        test.skip(true, "QA-SETUP-1 未完了");
      }
      const res = await callTestAction(page, "q1aTestCheck", { id: TEST_QUESTIONNAIRE_ID });
      expect(res.ok, `check failed: ${JSON.stringify(res)}`).toBe(true);
      expect(
        res.runLog?.hasMemo,
        `QUESTIONNAIRE_MEMO not found in Run_Log. runLog=${JSON.stringify(res.runLog)}`
      ).toBe(true);
    });

    // ----------------------------------------------------------------
    // ゴミ箱操作
    // ----------------------------------------------------------------
    test("QA-7: q1aTestTrash でゴミ箱に移動できる (ok=true)", async ({ page }) => {
      if (!TEST_QUESTIONNAIRE_ID) {
        test.skip(true, "QA-SETUP-1 未完了");
      }
      const res = await callTestAction(page, "q1aTestTrash", {
        id:     TEST_QUESTIONNAIRE_ID,
        reason: "Q-1A 自動検証",
      });
      expect(res.ok, `trash failed: ${JSON.stringify(res)}`).toBe(true);
    });

    test("QA-8: trash 後 Run_Log に QUESTIONNAIRE_TRASH が記録され trashedAt が入る", async ({ page }) => {
      if (!TEST_QUESTIONNAIRE_ID) {
        test.skip(true, "QA-SETUP-1 未完了");
      }
      const res = await callTestAction(page, "q1aTestCheck", { id: TEST_QUESTIONNAIRE_ID });
      expect(res.ok, `check failed: ${JSON.stringify(res)}`).toBe(true);
      expect(
        res.runLog?.hasTrash,
        `QUESTIONNAIRE_TRASH not found in Run_Log. runLog=${JSON.stringify(res.runLog)}`
      ).toBe(true);
      expect(
        res.row?.data?.trashedAt,
        "trashedAt should not be empty after trash"
      ).toBeTruthy();
    });

    test("QA-9: filter=trashed でゴミ箱行が一覧に表示される", async ({ page }) => {
      if (!TEST_QUESTIONNAIRE_ID) {
        test.skip(true, "QA-SETUP-1 未完了");
      }
      await page.goto(`${DEV_URL}?page=questionnaireAdmin&filter=trashed`, {
        waitUntil: "domcontentloaded",
        timeout: LOAD_TIMEOUT,
      });
      await handleAuthRedirect(page);
      const frame = gasAppFrame(page);
      await expect(
        frame.locator(`text=${TEST_QUESTIONNAIRE_ID}`)
      ).toBeVisible({ timeout: LOAD_TIMEOUT });
    });

    // ----------------------------------------------------------------
    // クリーンアップ
    // ----------------------------------------------------------------
    test("QA-CLEANUP: q1aTestCleanup でテスト行を削除できる", async ({ page }) => {
      const res = await callTestAction(page, "q1aTestCleanup");
      expect(res.ok, `cleanup failed: ${JSON.stringify(res)}`).toBe(true);
      expect(typeof res.deleted, "deleted should be number").toBe("number");
      // 削除後に該当 id が見つからないこと
      if (TEST_QUESTIONNAIRE_ID) {
        const checkRes = await callTestAction(page, "q1aTestCheck", { id: TEST_QUESTIONNAIRE_ID });
        expect(
          checkRes.row?.ok,
          `test row still exists after cleanup: ${TEST_QUESTIONNAIRE_ID}`
        ).toBe(false);
        TEST_QUESTIONNAIRE_ID = "";
      }
    });
  }
);

// ----------------------------------------------------------------
// 設計 doc 存在確認（常時実行・auth 不要）
// ----------------------------------------------------------------
test.describe("JREC-SF01 Q-1A — 設計参照ドキュメント存在確認", () => {
  test("QA-DOC-1: PHASE_Q0_SELFPAY_QUESTIONNAIRE_DESIGN_2026-05-14.md が存在する", async () => {
    const docPath = path.resolve(
      __dirname,
      "../../../../gas-projects/jrec-sf01-selfpay/docs/PHASE_Q0_SELFPAY_QUESTIONNAIRE_DESIGN_2026-05-14.md"
    );
    expect(fs.existsSync(docPath), `Q-0 設計 doc が見つかりません: ${docPath}`).toBe(true);
  });

  test("QA-DOC-2: PHASE_Q1A_SELFPAY_QUESTIONNAIRE_ADMIN_BASE_2026-05-14.md が存在する", async () => {
    const docPath = path.resolve(
      __dirname,
      "../../../../gas-projects/jrec-sf01-selfpay/docs/PHASE_Q1A_SELFPAY_QUESTIONNAIRE_ADMIN_BASE_2026-05-14.md"
    );
    expect(fs.existsSync(docPath), `Q-1A 実装記録 doc が見つかりません: ${docPath}`).toBe(true);
  });

  test("QA-DOC-3: JREC_SF01_Questionnaire.gs が存在し Q-1A RPC 4 個が実装されている", async () => {
    const gsPath = path.resolve(
      __dirname,
      "../../../../gas-projects/jrec-sf01-selfpay/JREC_SF01_Questionnaire.gs"
    );
    expect(fs.existsSync(gsPath), `Questionnaire.gs が見つかりません`).toBe(true);
    const content = fs.readFileSync(gsPath, "utf-8");
    expect(content.includes("function listQuestionnaires"),    "listQuestionnaires 未実装").toBe(true);
    expect(content.includes("function getQuestionnaireById"),   "getQuestionnaireById 未実装").toBe(true);
    expect(content.includes("function trashQuestionnaire"),     "trashQuestionnaire 未実装").toBe(true);
    expect(content.includes("function saveQuestionnaireStaffMemo"), "saveQuestionnaireStaffMemo 未実装").toBe(true);
  });

  test("QA-DOC-4: SelfPayQuestionnaires に painLocation 列が定義されている", async () => {
    const gsPath = path.resolve(
      __dirname,
      "../../../../gas-projects/jrec-sf01-selfpay/JREC_SF01_Setup.gs"
    );
    expect(fs.existsSync(gsPath), `Setup.gs が見つかりません`).toBe(true);
    const content = fs.readFileSync(gsPath, "utf-8");
    expect(content.includes('"painLocation"'), "painLocation が QUESTIONNAIRE_HEADERS に未定義").toBe(true);
  });
});
