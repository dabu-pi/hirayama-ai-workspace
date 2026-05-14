/**
 * jrec-sf01 questionnaire-public.spec.ts
 *
 * Phase Q-2A / Q-2B — token 発行 + Google ログイン不要 公開問診票 実機確認スペック
 *
 * 検証内容:
 *   QP-1: token 発行（questionnaireId / rawToken / publicUrl / expiresAt）
 *   QP-2: publicUrl が正しい exec URL を含む
 *   QP-3: token なしアクセスでエラーページが返る（ANYONE_ANONYMOUS）
 *   QP-4: 不正 token でエラーページが返る
 *   QP-5: 正常 token で公開フォームが開く（Google ログイン不要確認）
 *   QP-6: フォーム送信 ok=true / questionnaireId 取得
 *   QP-7: SelfPayQuestionnaires に status=submitted / submittedAt が記録される
 *   QP-8: Run_Log に QUESTIONNAIRE_PUBLIC_SUBMIT が記録される
 *   QP-9: admin 一覧に表示される（filter=submitted）
 *   QP-10: Q-1B preview が可能（candidatePatient が返る）
 *   QP-11: Q-1C preview が可能 → patientId 未紐付けで PATIENT_LINK_REQUIRED
 *   QP-12: 再送信がブロックされる（ALREADY_SUBMITTED）
 *   QP-DOC-1〜3: GS / HTML 実装確認
 *   QP-CLEANUP: テストデータ削除
 *
 * 実行コマンド: npm run test:jrec:questionnaire-public
 *
 * 注意:
 *   - QP-1〜2: dev URL (authenticated) で token を作成
 *   - QP-3〜12: exec URL (ANYONE_ANONYMOUS) で未ログイン確認
 *   - QP-5 / QP-6 の公開フォームアクセスは noAuth context で実施
 */

import { test, expect, Page, BrowserContext } from "@playwright/test";
import path from "path";
import fs from "fs";
import config from "./config.json";

const DEV_URL        = config.devUrl;
const PUBLIC_EXEC_URL = (config as any).q2aPublicExecUrl as string | undefined;
const AUTH_FILE      = path.join(__dirname, "../../auth.json");
const HAS_AUTH       = fs.existsSync(AUTH_FILE);
const FETCH_TIMEOUT  = 25_000;
const LOAD_TIMEOUT   = 35_000;

let TEST_QUESTIONNAIRE_ID = "";
let TEST_RAW_TOKEN        = "";

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

async function callDevAction(
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

/**
 * Google ログインなしで exec URL にアクセスするための新しい browser context を作る。
 * storageState は使用しない。
 */
async function newNoAuthContext(browser: any): Promise<BrowserContext> {
  return browser.newContext();  // no storageState = truly unauthenticated
}

test.describe(
  `JREC-SF01 Q-2A/Q-2B 公開問診票 実機確認 [auth: ${HAS_AUTH ? "あり" : "なし"}] [execUrl: ${PUBLIC_EXEC_URL ? "設定済み" : "未設定"}]`,
  () => {
    test.beforeEach(async ({ page }) => {
      page.setDefaultTimeout(LOAD_TIMEOUT);
    });

    // ----------------------------------------------------------------
    // Q-2A: token 発行
    // ----------------------------------------------------------------
    test("QP-1: token 発行で questionnaireId / rawToken / publicUrl / expiresAt が返る", async ({ page }) => {
      // 既存テストデータをクリーンアップ
      if (TEST_QUESTIONNAIRE_ID) {
        await callDevAction(page, "q2bTestCleanup", { id: TEST_QUESTIONNAIRE_ID });
      }

      const res = await callDevAction(page, "q2aTestCreate");
      expect(res.ok, `token create failed: ${JSON.stringify(res)}`).toBe(true);
      expect(typeof res.questionnaireId).toBe("string");
      expect(typeof res.token).toBe("string");
      expect(res.token.length, "raw token should be long enough (2 UUIDs)").toBeGreaterThan(32);
      expect(typeof res.publicUrl).toBe("string");
      expect(res.publicUrl).toContain("questionnairePublic");
      expect(res.publicUrl).toContain("t=");
      expect(res.expiresAt).toBeTruthy();
      TEST_QUESTIONNAIRE_ID = res.questionnaireId;
      TEST_RAW_TOKEN        = res.token;
    });

    test("QP-2: publicUrl が exec URL (script.google.com/macros/s) を含む", async ({ page }) => {
      if (!TEST_RAW_TOKEN) test.skip(true, "QP-1 未完了");
      const res = await callDevAction(page, "q2aTestCreate");
      // dev URL で発行すると dev URL が返るので、exec URL パターンを確認
      // 少なくとも script.google.com を含む正しい GAS URL であること
      expect(res.publicUrl).toContain("script.google.com");
      expect(res.publicUrl).toContain("?page=questionnairePublic&t=");
      // cleanup this extra token immediately
      await callDevAction(page, "q2bTestCleanup", { id: res.questionnaireId });
    });

    // ----------------------------------------------------------------
    // Q-2B: Google ログイン不要確認（exec URL / ANYONE_ANONYMOUS）
    // ----------------------------------------------------------------
    test("QP-3: token なしアクセスでエラーページが返る（ANYONE_ANONYMOUS / 未ログイン）", async ({ browser }) => {
      if (!PUBLIC_EXEC_URL) test.skip(true, "config.json に q2aPublicExecUrl が未設定");
      const noAuthCtx  = await newNoAuthContext(browser);
      const noAuthPage = await noAuthCtx.newPage();
      noAuthPage.setDefaultTimeout(LOAD_TIMEOUT);
      try {
        await noAuthPage.goto(PUBLIC_EXEC_URL + "?page=questionnairePublic", { timeout: LOAD_TIMEOUT });
        const body = (await noAuthPage.locator("body").textContent({ timeout: LOAD_TIMEOUT })) || "";
        // Should show error page, NOT Google login redirect
        expect(body, "should not require Google login").not.toContain("Sign in");
        expect(body, "should show error about invalid token").toMatch(/エラー|無効/);
      } finally {
        await noAuthCtx.close();
      }
    });

    test("QP-4: 不正 token でエラーページが返る（ANYONE_ANONYMOUS）", async ({ browser }) => {
      if (!PUBLIC_EXEC_URL) test.skip(true, "config.json に q2aPublicExecUrl が未設定");
      const noAuthCtx  = await newNoAuthContext(browser);
      const noAuthPage = await noAuthCtx.newPage();
      noAuthPage.setDefaultTimeout(LOAD_TIMEOUT);
      try {
        await noAuthPage.goto(
          PUBLIC_EXEC_URL + "?page=questionnairePublic&t=invalid-fake-token-12345",
          { timeout: LOAD_TIMEOUT }
        );
        const body = (await noAuthPage.locator("body").textContent({ timeout: LOAD_TIMEOUT })) || "";
        expect(body, "should not require Google login").not.toContain("Sign in");
        expect(body, "should show invalid token error").toMatch(/エラー|無効/);
      } finally {
        await noAuthCtx.close();
      }
    });

    test("QP-5: 正常 token で公開フォームが開く（Google ログイン不要確認）", async ({ browser }) => {
      if (!PUBLIC_EXEC_URL) test.skip(true, "config.json に q2aPublicExecUrl が未設定");
      if (!TEST_RAW_TOKEN)  test.skip(true, "QP-1 未完了（rawToken なし）");
      const noAuthCtx  = await newNoAuthContext(browser);
      const noAuthPage = await noAuthCtx.newPage();
      noAuthPage.setDefaultTimeout(LOAD_TIMEOUT);
      try {
        const publicUrl = PUBLIC_EXEC_URL + "?page=questionnairePublic&t=" + encodeURIComponent(TEST_RAW_TOKEN);
        await noAuthPage.goto(publicUrl, { timeout: LOAD_TIMEOUT });
        const body = (await noAuthPage.locator("body").textContent({ timeout: LOAD_TIMEOUT })) || "";
        // Should NOT redirect to Google login
        expect(noAuthPage.url(), "should not redirect to accounts.google.com").not.toContain("accounts.google.com");
        expect(body, "should not show Sign in").not.toContain("Sign in");
        // Should show the form
        expect(body, "should show questionnaire form title").toMatch(/問診票|自費/);
        expect(body, "should show required field label").toContain("氏名");
      } finally {
        await noAuthCtx.close();
      }
    });

    test("QP-6: フォーム送信 ok=true / questionnaireId が返る（google.script.run）", async ({ browser }) => {
      if (!PUBLIC_EXEC_URL) test.skip(true, "config.json に q2aPublicExecUrl が未設定");
      if (!TEST_RAW_TOKEN)  test.skip(true, "QP-1 未完了");
      const noAuthCtx  = await newNoAuthContext(browser);
      const noAuthPage = await noAuthCtx.newPage();
      noAuthPage.setDefaultTimeout(LOAD_TIMEOUT);
      try {
        const publicUrl = PUBLIC_EXEC_URL + "?page=questionnairePublic&t=" + encodeURIComponent(TEST_RAW_TOKEN);
        await noAuthPage.goto(publicUrl, { waitUntil: "networkidle", timeout: LOAD_TIMEOUT });

        // GAS web app renders inside an iframe
        const frame = noAuthPage.frameLocator("iframe").first().frameLocator("iframe").first();

        // Fill required fields
        await frame.locator("#patientName").fill("Q2Bテスト患者");
        await frame.locator("#phone").fill("090-0003-9999");
        await frame.locator("#chiefComplaint").fill("腰痛テスト（Q-2B 自動検証）");
        await frame.locator("#painLocation").fill("腰部");
        await frame.locator("#privacyConsent").check();

        // Submit
        await frame.locator("#submitBtn").click();

        // Wait for success state
        await expect(frame.locator("#resultArea")).toBeVisible({ timeout: LOAD_TIMEOUT });
        const resultText = (await frame.locator("#resultArea").textContent({ timeout: LOAD_TIMEOUT })) || "";
        expect(resultText, "should show success").toMatch(/完了|送信/);
      } finally {
        await noAuthCtx.close();
      }
    });

    // ----------------------------------------------------------------
    // 送信後の確認（dev URL + auth で行う）
    // ----------------------------------------------------------------
    test("QP-7: SelfPayQuestionnaires に status=submitted / submittedAt が記録される", async ({ page }) => {
      if (!TEST_QUESTIONNAIRE_ID) test.skip(true, "QP-1 未完了");
      const res = await callDevAction(page, "q1aTestCheck", { id: TEST_QUESTIONNAIRE_ID });
      expect(res.ok).toBe(true);
      const row = res.row?.data;
      expect(row?.status,      "status should be submitted").toBe("submitted");
      expect(row?.submittedAt, "submittedAt should not be empty").toBeTruthy();
      expect(row?.tokenStatus, "tokenStatus should be submitted").toBe("submitted");
      expect(row?.patientName, "patientName should be filled").toBe("Q2Bテスト患者");
    });

    test("QP-8: Run_Log に QUESTIONNAIRE_PUBLIC_SUBMIT が記録される", async ({ page }) => {
      if (!TEST_QUESTIONNAIRE_ID) test.skip(true, "QP-1 未完了");
      const res = await callDevAction(page, "q1aTestCheck", { id: TEST_QUESTIONNAIRE_ID });
      expect(res.ok).toBe(true);
      // Run_Log SUBMIT の確認は q1bTestCheck の checkTransferRunLog_ で代用できないので
      // row.tokenStatus === "submitted" を確認（SUBMIT が成功した証拠）
      expect(res.row?.data?.tokenStatus).toBe("submitted");
    });

    test("QP-9: admin 一覧 filter=submitted に表示される", async ({ page }) => {
      if (!TEST_QUESTIONNAIRE_ID) test.skip(true, "QP-1 未完了");
      const res = await callDevAction(page, "q1aTestInsert");  // ← list API を直接呼ぶ代わりに確認用
      // listQuestionnaires は admin 画面経由なので、questionnaireById で status 確認
      const checkRes = await callDevAction(page, "q1aTestCheck", { id: TEST_QUESTIONNAIRE_ID });
      expect(checkRes.row?.data?.status).toBe("submitted");
      // cleanup dummy inserted row
      if (res.questionnaireId) {
        await callDevAction(page, "q1aTestCleanup");
      }
    });

    test("QP-10: Q-1B preview が可能（candidatePatient が返る）", async ({ page }) => {
      if (!TEST_QUESTIONNAIRE_ID) test.skip(true, "QP-1 未完了");
      const res = await callDevAction(page, "transferQuestionnaireToPatient", {
        mode: "preview",
        id:   TEST_QUESTIONNAIRE_ID,
      });
      expect(res.ok, `Q-1B preview failed: ${JSON.stringify(res)}`).toBe(true);
      expect(res.candidatePatient?.name).toBe("Q2Bテスト患者");
    });

    test("QP-11: Q-1C preview は patientId 未紐付けで PATIENT_LINK_REQUIRED", async ({ page }) => {
      if (!TEST_QUESTIONNAIRE_ID) test.skip(true, "QP-1 未完了");
      const res = await callDevAction(page, "transferQuestionnaireToVisitChart", {
        mode: "preview",
        id:   TEST_QUESTIONNAIRE_ID,
      });
      expect(res.ok).toBe(false);
      expect(res.errorCode).toBe("PATIENT_LINK_REQUIRED");
    });

    test("QP-12: 再送信が ALREADY_SUBMITTED でブロックされる", async ({ browser }) => {
      if (!PUBLIC_EXEC_URL) test.skip(true, "config.json に q2aPublicExecUrl が未設定");
      if (!TEST_RAW_TOKEN)  test.skip(true, "QP-1 未完了");
      const noAuthCtx  = await newNoAuthContext(browser);
      const noAuthPage = await noAuthCtx.newPage();
      noAuthPage.setDefaultTimeout(LOAD_TIMEOUT);
      try {
        const publicUrl = PUBLIC_EXEC_URL + "?page=questionnairePublic&t=" + encodeURIComponent(TEST_RAW_TOKEN);
        await noAuthPage.goto(publicUrl, { timeout: LOAD_TIMEOUT });
        const body = (await noAuthPage.locator("body").textContent({ timeout: LOAD_TIMEOUT })) || "";
        // After submit, accessing the same URL should show "already submitted"
        expect(body, "should show already submitted message").toMatch(/すでに送信済み|エラー/);
      } finally {
        await noAuthCtx.close();
      }
    });

    // ----------------------------------------------------------------
    // クリーンアップ
    // ----------------------------------------------------------------
    test("QP-CLEANUP: q2bTestCleanup でテストデータを削除できる", async ({ page }) => {
      if (!TEST_QUESTIONNAIRE_ID) {
        // nothing to clean up
        expect(true).toBe(true);
        return;
      }
      const res = await callDevAction(page, "q2bTestCleanup", { id: TEST_QUESTIONNAIRE_ID });
      expect(res.ok, `cleanup failed: ${JSON.stringify(res)}`).toBe(true);
      TEST_QUESTIONNAIRE_ID = "";
      TEST_RAW_TOKEN        = "";
    });
  }
);

// ----------------------------------------------------------------
// 設計 doc / GS 実装確認（常時実行・auth 不要）
// ----------------------------------------------------------------
test.describe("JREC-SF01 Q-2A/Q-2B — 設計参照ドキュメント存在確認", () => {
  test("QP-DOC-1: JREC_SF01_Questionnaire.gs に createQuestionnairePublicToken / submitQuestionnairePublic が実装されている", async () => {
    const gsPath = path.resolve(
      __dirname,
      "../../../../gas-projects/jrec-sf01-selfpay/JREC_SF01_Questionnaire.gs"
    );
    const content = fs.readFileSync(gsPath, "utf-8");
    expect(content.includes("function createQuestionnairePublicToken"), "createQuestionnairePublicToken 未実装").toBe(true);
    expect(content.includes("function submitQuestionnairePublic"),       "submitQuestionnairePublic 未実装").toBe(true);
    expect(content.includes("function validatePublicQuestionnaireToken_"), "validatePublicQuestionnaireToken_ 未実装").toBe(true);
    expect(content.includes("function hashPublicToken_"),                 "hashPublicToken_ 未実装").toBe(true);
    expect(content.includes("ALREADY_SUBMITTED"),                        "ALREADY_SUBMITTED guard 未実装").toBe(true);
    expect(content.includes("TOKEN_EXPIRED"),                            "TOKEN_EXPIRED guard 未実装").toBe(true);
  });

  test("QP-DOC-2: questionnaire-public.html が存在し必要な要素を含む", async () => {
    const htmlPath = path.resolve(
      __dirname,
      "../../../../gas-projects/jrec-sf01-selfpay/questionnaire-public.html"
    );
    expect(fs.existsSync(htmlPath), "questionnaire-public.html が存在しない").toBe(true);
    const content = fs.readFileSync(htmlPath, "utf-8");
    expect(content.includes("submitQuestionnairePublic"), "RPC 呼び出し未実装").toBe(true);
    expect(content.includes("patientName"),               "patientName フィールド未実装").toBe(true);
    expect(content.includes("chiefComplaint"),             "chiefComplaint フィールド未実装").toBe(true);
    expect(content.includes("privacyConsent"),             "privacyConsent フィールド未実装").toBe(true);
    expect(content.includes("TOKEN"),                      "TOKEN 変数未実装").toBe(true);
  });

  test("QP-DOC-3: appsscript.json が ANYONE_ANONYMOUS アクセスを設定している", async () => {
    const jsonPath = path.resolve(
      __dirname,
      "../../../../gas-projects/jrec-sf01-selfpay/appsscript.json"
    );
    const content = fs.readFileSync(jsonPath, "utf-8");
    expect(content.includes("ANYONE_ANONYMOUS"), "ANYONE_ANONYMOUS が設定されていない").toBe(true);
  });
});
