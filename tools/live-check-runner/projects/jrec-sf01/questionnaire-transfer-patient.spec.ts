/**
 * jrec-sf01 questionnaire-transfer-patient.spec.ts
 *
 * Phase Q-1B — 問診票 → 新規患者登録転記 実機確認スペック
 *
 * 検証内容:
 *   QB-SETUP-1: q1bTestInsertTransfer でテスト行を投入できる
 *   QB-1: preview mode が candidatePatient / duplicateCandidates / canCreate を返す
 *   QB-2: 重複候補なしのとき canCreate=true になる
 *   QB-3: create mode で ok=true / patientId が返る
 *   QB-4: SelfPayQuestionnaires に linkedPatientId / transferToPatientAt / status=transferred が記録される
 *   QB-5: Run_Log に QUESTIONNAIRE_TRANSFER_PATIENT_CREATE が記録される
 *   QB-6: 転記済み問診票の二重転記が ALREADY_TRANSFERRED でブロックされる
 *   QB-DUP-1: 重複患者を挿入して duplicate guard が DUPLICATE_PATIENT_CANDIDATE でブロックする
 *   QB-DUP-2: Run_Log に QUESTIONNAIRE_TRANSFER_BLOCKED_DUPLICATE が記録される
 *   QB-LINK-1: linkExisting mode で既存患者に紐付けられる
 *   QB-DOC-1~2: 設計 doc / GS 実装確認
 *   QB-CLEANUP: テストデータを削除できる
 *
 * 実行コマンド: npm run test:jrec:questionnaire-transfer
 */

import { test, expect, Page } from "@playwright/test";
import path from "path";
import fs from "fs";
import config from "./config.json";

const DEV_URL   = config.devUrl;
const AUTH_FILE = path.join(__dirname, "../../auth.json");
const HAS_AUTH  = fs.existsSync(AUTH_FILE);
const FETCH_TIMEOUT = 25_000;
const LOAD_TIMEOUT  = 30_000;

let TEST_QUESTIONNAIRE_ID   = "";
let TEST_PATIENT_ID_CREATED = "";  // create mode で作成された patientId
let DUP_QUESTIONNAIRE_ID    = "";  // 重複テスト用 questionnaire

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

async function callAction(
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
  `JREC-SF01 Q-1B 問診票→患者転記 実機確認 [auth: ${HAS_AUTH ? "あり" : "なし"}]`,
  () => {
    test.beforeEach(async ({ page }) => {
      page.setDefaultTimeout(LOAD_TIMEOUT);
    });

    // ----------------------------------------------------------------
    // セットアップ
    // ----------------------------------------------------------------
    test("QB-SETUP-1: q1bTestInsertTransfer でテスト行を投入できる", async ({ page }) => {
      // まず既存の QTEST1B_ データをクリーンアップ（前回の残骸対策）
      await callAction(page, "q1bTestCleanup");

      const res = await callAction(page, "q1bTestInsertTransfer");
      expect(res.ok, `insert failed: ${JSON.stringify(res)}`).toBe(true);
      expect(res.questionnaireId, "should start with QTEST1B_").toMatch(/^QTEST1B_\d{14}$/);
      TEST_QUESTIONNAIRE_ID = res.questionnaireId;
    });

    // ----------------------------------------------------------------
    // preview mode
    // ----------------------------------------------------------------
    test("QB-1: preview mode が candidatePatient / duplicateCandidates / canCreate を返す", async ({ page }) => {
      if (!TEST_QUESTIONNAIRE_ID) test.skip(true, "QB-SETUP-1 未完了");
      const res = await callAction(page, "transferQuestionnaireToPatient", {
        mode: "preview",
        id:   TEST_QUESTIONNAIRE_ID,
      });
      expect(res.ok, `preview failed: ${JSON.stringify(res)}`).toBe(true);
      expect(res.mode).toBe("preview");
      expect(res.candidatePatient).toBeTruthy();
      expect(typeof res.candidatePatient.name).toBe("string");
      expect(Array.isArray(res.duplicateCandidates)).toBe(true);
      expect(typeof res.canCreate).toBe("boolean");
    });

    test("QB-2: 重複候補なしのとき canCreate=true / candidatePatient に name/phone が入る", async ({ page }) => {
      if (!TEST_QUESTIONNAIRE_ID) test.skip(true, "QB-SETUP-1 未完了");
      const res = await callAction(page, "transferQuestionnaireToPatient", {
        mode: "preview",
        id:   TEST_QUESTIONNAIRE_ID,
      });
      expect(res.ok).toBe(true);
      // テスト用電話番号 090-0001-9999 を持つ患者がいなければ重複なし
      expect(res.duplicateCandidates.length, "should have no duplicates at this point").toBe(0);
      expect(res.canCreate).toBe(true);
      expect(res.candidatePatient.name).toBe("Q1Bテスト患者");
      expect(res.candidatePatient.phone).toBeTruthy();
    });

    // ----------------------------------------------------------------
    // create mode
    // ----------------------------------------------------------------
    test("QB-3: create mode で ok=true / patientId が返る", async ({ page }) => {
      if (!TEST_QUESTIONNAIRE_ID) test.skip(true, "QB-SETUP-1 未完了");
      const res = await callAction(page, "transferQuestionnaireToPatient", {
        mode: "create",
        id:   TEST_QUESTIONNAIRE_ID,
      });
      expect(res.ok, `create failed: ${JSON.stringify(res)}`).toBe(true);
      expect(res.mode).toBe("create");
      expect(typeof res.patientId).toBe("string");
      expect(res.patientId.length, "patientId should not be empty").toBeGreaterThan(0);
      expect(res.transferredAt).toBeTruthy();
      TEST_PATIENT_ID_CREATED = res.patientId;
    });

    test("QB-4: SelfPayQuestionnaires に linkedPatientId / transferToPatientAt / status=transferred が記録される", async ({ page }) => {
      if (!TEST_QUESTIONNAIRE_ID) test.skip(true, "QB-SETUP-1 未完了");
      if (!TEST_PATIENT_ID_CREATED) test.skip(true, "QB-3 未完了（create 未実行）");
      const res = await callAction(page, "q1bTestCheck", { id: TEST_QUESTIONNAIRE_ID });
      expect(res.ok).toBe(true);
      const row = res.row?.data;
      expect(row?.linkedPatientId, "linkedPatientId should be set").toBe(TEST_PATIENT_ID_CREATED);
      expect(row?.transferToPatientAt, "transferToPatientAt should not be empty").toBeTruthy();
      expect(row?.status, "status should be transferred").toBe("transferred");
    });

    test("QB-5: Run_Log に QUESTIONNAIRE_TRANSFER_PATIENT_CREATE が記録される", async ({ page }) => {
      if (!TEST_QUESTIONNAIRE_ID) test.skip(true, "QB-SETUP-1 未完了");
      const res = await callAction(page, "q1bTestCheck", { id: TEST_QUESTIONNAIRE_ID });
      expect(res.ok).toBe(true);
      expect(
        res.runLog?.hasCreate,
        `QUESTIONNAIRE_TRANSFER_PATIENT_CREATE not in Run_Log: ${JSON.stringify(res.runLog)}`
      ).toBe(true);
    });

    // ----------------------------------------------------------------
    // 二重転記防止
    // ----------------------------------------------------------------
    test("QB-6: 転記済み問診票の二重転記が ALREADY_TRANSFERRED でブロックされる", async ({ page }) => {
      if (!TEST_QUESTIONNAIRE_ID) test.skip(true, "QB-SETUP-1 未完了");
      const res = await callAction(page, "transferQuestionnaireToPatient", {
        mode: "create",
        id:   TEST_QUESTIONNAIRE_ID,
      });
      expect(res.ok, "double transfer should be blocked").toBe(false);
      expect(res.errorCode).toBe("ALREADY_TRANSFERRED");
      expect(res.patientId).toBe(TEST_PATIENT_ID_CREATED);
    });

    // ----------------------------------------------------------------
    // 重複ガード（別の questionnaire + 同電話番号患者）
    // ----------------------------------------------------------------
    test("QB-DUP-1: 重複患者挿入後の create が DUPLICATE_PATIENT_CANDIDATE でブロックされる", async ({ page }) => {
      // 別のテスト questionnaire を挿入（電話番号は同じ 090-0001-9999）
      const insertRes = await callAction(page, "q1bTestInsertTransfer");
      expect(insertRes.ok, `insert dup questionnaire failed: ${JSON.stringify(insertRes)}`).toBe(true);
      DUP_QUESTIONNAIRE_ID = insertRes.questionnaireId;

      // 同電話番号の重複患者を挿入
      const dupRes = await callAction(page, "q1bTestInsertDupPatient");
      expect(dupRes.ok, `insert dup patient failed: ${JSON.stringify(dupRes)}`).toBe(true);

      // create を試みる → 重複でブロックされるはず
      const createRes = await callAction(page, "transferQuestionnaireToPatient", {
        mode: "create",
        id:   DUP_QUESTIONNAIRE_ID,
      });
      expect(createRes.ok, "dup create should be blocked").toBe(false);
      expect(createRes.errorCode).toBe("DUPLICATE_PATIENT_CANDIDATE");
      expect(Array.isArray(createRes.duplicateCandidates)).toBe(true);
      expect(createRes.duplicateCandidates.length, "should have duplicate candidates").toBeGreaterThan(0);
    });

    test("QB-DUP-2: Run_Log に QUESTIONNAIRE_TRANSFER_BLOCKED_DUPLICATE が記録される", async ({ page }) => {
      if (!DUP_QUESTIONNAIRE_ID) test.skip(true, "QB-DUP-1 未完了");
      const res = await callAction(page, "q1bTestCheck", { id: DUP_QUESTIONNAIRE_ID });
      expect(res.ok).toBe(true);
      expect(
        res.runLog?.hasBlocked,
        `QUESTIONNAIRE_TRANSFER_BLOCKED_DUPLICATE not in Run_Log: ${JSON.stringify(res.runLog)}`
      ).toBe(true);
    });

    // ----------------------------------------------------------------
    // linkExisting mode
    // ----------------------------------------------------------------
    test("QB-LINK-1: linkExisting mode で既存患者 ID に紐付けられる", async ({ page }) => {
      if (!DUP_QUESTIONNAIRE_ID) test.skip(true, "QB-DUP-1 未完了（dup questionnaire なし）");
      if (!TEST_PATIENT_ID_CREATED) test.skip(true, "QB-3 未完了（既存患者なし）");
      const res = await callAction(page, "transferQuestionnaireToPatient", {
        mode:      "linkExisting",
        id:        DUP_QUESTIONNAIRE_ID,
        patientId: TEST_PATIENT_ID_CREATED,
      });
      expect(res.ok, `linkExisting failed: ${JSON.stringify(res)}`).toBe(true);
      expect(res.mode).toBe("linkExisting");
      expect(res.patientId).toBe(TEST_PATIENT_ID_CREATED);
      expect(res.transferredAt).toBeTruthy();
    });

    // ----------------------------------------------------------------
    // クリーンアップ
    // ----------------------------------------------------------------
    test("QB-CLEANUP: q1bTestCleanup でテストデータを削除できる", async ({ page }) => {
      const res = await callAction(page, "q1bTestCleanup");
      expect(res.ok, `cleanup failed: ${JSON.stringify(res)}`).toBe(true);
      expect(typeof res.deleted?.questionnaires).toBe("number");
      expect(typeof res.deleted?.patients).toBe("number");
      TEST_QUESTIONNAIRE_ID   = "";
      DUP_QUESTIONNAIRE_ID    = "";
      TEST_PATIENT_ID_CREATED = "";
    });
  }
);

// ----------------------------------------------------------------
// 設計 doc / GS 実装確認（常時実行・auth 不要）
// ----------------------------------------------------------------
test.describe("JREC-SF01 Q-1B — 設計参照ドキュメント存在確認", () => {
  test("QB-DOC-1: JREC_SF01_Questionnaire.gs に transferQuestionnaireToPatient が実装されている", async () => {
    const gsPath = path.resolve(
      __dirname,
      "../../../../gas-projects/jrec-sf01-selfpay/JREC_SF01_Questionnaire.gs"
    );
    const content = fs.readFileSync(gsPath, "utf-8");
    expect(content.includes("function transferQuestionnaireToPatient"), "transferQuestionnaireToPatient 未実装").toBe(true);
    expect(content.includes("buildCandidatePatient_"),    "buildCandidatePatient_ 未実装").toBe(true);
    expect(content.includes("findDuplicateCandidates_"),  "findDuplicateCandidates_ 未実装").toBe(true);
    expect(content.includes("recordTransferToPatient_"),  "recordTransferToPatient_ 未実装").toBe(true);
    expect(content.includes("ALREADY_TRANSFERRED"),       "ALREADY_TRANSFERRED guard 未実装").toBe(true);
    expect(content.includes("DUPLICATE_PATIENT_CANDIDATE"), "DUPLICATE_PATIENT_CANDIDATE guard 未実装").toBe(true);
  });

  test("QB-DOC-2: questionnaire-detail.html に Q-1B 転記 UI が実装されている", async () => {
    const htmlPath = path.resolve(
      __dirname,
      "../../../../gas-projects/jrec-sf01-selfpay/questionnaire-detail.html"
    );
    const content = fs.readFileSync(htmlPath, "utf-8");
    expect(content.includes("previewPatientBtn"),   "previewPatientBtn 未実装").toBe(true);
    expect(content.includes("createPatientBtn"),    "createPatientBtn 未実装").toBe(true);
    expect(content.includes("linkExistingBtn"),     "linkExistingBtn 未実装").toBe(true);
    expect(content.includes("transferQuestionnaireToPatient"), "JS 呼び出し未実装").toBe(true);
  });
});
