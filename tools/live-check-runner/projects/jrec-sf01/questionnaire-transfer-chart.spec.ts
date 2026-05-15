/**
 * jrec-sf01 questionnaire-transfer-chart.spec.ts
 *
 * Phase Q-1C — 問診票 → 来院カルテ転記 実機確認スペック
 *
 * 検証内容:
 *   QC-SETUP-1: q1cTestSetup でテスト questionnaire + 患者を作成できる
 *   QC-1: preview mode が candidateChart / patientId / canCreateDraft を返す
 *   QC-2: preview の candidateChart に chiefComplaint / painLocation / onsetDate が入る
 *   QC-3: patientId 未紐付けの questionnaire は PATIENT_LINK_REQUIRED でブロックされる
 *   QC-4: createDraft mode で ok=true / selfPayVisitKey が返る
 *   QC-5: SelfPayQuestionnaires に linkedVisitKey / transferToVisitAt / status=transferred が記録される
 *   QC-6: Run_Log に QUESTIONNAIRE_CHART_DRAFT_CREATE が記録される
 *   QC-7: 転記済み問診票の二重転記が ALREADY_TRANSFERRED でブロックされる
 *   QC-DOC-1〜2: GS 実装 / HTML 実装確認
 *   QC-CLEANUP: テストデータを削除できる
 *
 * 実行コマンド: npm run test:jrec:questionnaire-chart-transfer
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

let TEST_QUESTIONNAIRE_ID = "";
let TEST_PATIENT_ID       = "";
let TEST_VISIT_KEY        = "";

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
  `JREC-SF01 Q-1C 問診票→カルテ転記 実機確認 [auth: ${HAS_AUTH ? "あり" : "なし"}]`,
  () => {
    test.beforeEach(async ({ page }) => {
      page.setDefaultTimeout(LOAD_TIMEOUT);
    });

    // ----------------------------------------------------------------
    // セットアップ
    // ----------------------------------------------------------------
    test("QC-SETUP-1: q1cTestSetup でテスト questionnaire + 患者を作成できる", async ({ page }) => {
      // 既存テストデータをまずクリーンアップ
      await callAction(page, "q1cTestCleanup");

      const res = await callAction(page, "q1cTestSetup");
      expect(res.ok, `setup failed: ${JSON.stringify(res)}`).toBe(true);
      expect(res.data?.questionnaireId, "questionnaireId should start with QTEST1C_").toMatch(/^QTEST1C_\d{14}$/);
      expect(typeof res.data?.patientId).toBe("string");
      TEST_QUESTIONNAIRE_ID = res.data.questionnaireId;
      TEST_PATIENT_ID       = res.data.patientId;
    });

    // ----------------------------------------------------------------
    // patientId 未紐付けガード
    // ----------------------------------------------------------------
    test("QC-3: patientId 未紐付けの questionnaire は PATIENT_LINK_REQUIRED でブロックされる", async ({ page }) => {
      // テスト用の未紐付け questionnaire を一時作成
      const insertRes = await callAction(page, "q1bTestInsertTransfer");
      if (!insertRes.ok) test.skip(true, "テスト行挿入失敗");
      const unlinkedId = insertRes.questionnaireId;

      const res = await callAction(page, "transferQuestionnaireToVisitChart", {
        mode: "preview",
        id:   unlinkedId,
      });
      expect(res.ok, "unlinked questionnaire should be blocked").toBe(false);
      expect(res.errorCode).toBe("PATIENT_LINK_REQUIRED");

      // 後片付け（QTEST1B_ は q1bTestCleanup で削除）
      await callAction(page, "q1bTestCleanup");
    });

    // ----------------------------------------------------------------
    // preview mode
    // ----------------------------------------------------------------
    test("QC-1: preview mode が candidateChart / patientId / canCreateDraft を返す", async ({ page }) => {
      if (!TEST_QUESTIONNAIRE_ID) test.skip(true, "QC-SETUP-1 未完了");
      const res = await callAction(page, "transferQuestionnaireToVisitChart", {
        mode: "preview",
        id:   TEST_QUESTIONNAIRE_ID,
      });
      expect(res.ok, `preview failed: ${JSON.stringify(res)}`).toBe(true);
      expect(res.mode).toBe("preview");
      expect(res.candidateChart).toBeTruthy();
      expect(res.patientId).toBe(TEST_PATIENT_ID);
      expect(res.canCreateDraft).toBe(true);
    });

    test("QC-2: preview の candidateChart に chiefComplaint / painLocation / onsetDate が入る", async ({ page }) => {
      if (!TEST_QUESTIONNAIRE_ID) test.skip(true, "QC-SETUP-1 未完了");
      const res = await callAction(page, "transferQuestionnaireToVisitChart", {
        mode: "preview",
        id:   TEST_QUESTIONNAIRE_ID,
      });
      expect(res.ok).toBe(true);
      const c = res.candidateChart;
      // chiefComplaint: 主訴 + painLocation が集約される（@65 仕様）
      expect(c.chiefComplaint, "chiefComplaint should be filled").toBeTruthy();
      expect(c.chiefComplaint).toContain("肩こり");
      expect(c.chiefComplaint, "painLocation は chiefComplaint に集約される（@65）").toContain("頸部");
      // findings は空（施術者記入欄 / 問診票から自動転記しない）
      expect(c.findings, "findings は施術者記入欄のため空（@65）").toBe("");
      // explanation は空（施術者説明記録欄 / 問診票から自動転記しない）
      expect(c.explanation, "explanation は施術者説明記録欄のため空（@65）").toBe("");
      // injuryTrigger から onsetDate を確認
      expect(c.injuryTrigger, "injuryTrigger should contain onsetDate").toContain("2026-05-01");
      // visitType
      expect(c.visitType).toBe("初診");
    });

    // ----------------------------------------------------------------
    // createDraft mode
    // ----------------------------------------------------------------
    test("QC-4: createDraft mode で ok=true / selfPayVisitKey が返る", async ({ page }) => {
      if (!TEST_QUESTIONNAIRE_ID) test.skip(true, "QC-SETUP-1 未完了");
      const res = await callAction(page, "transferQuestionnaireToVisitChart", {
        mode: "createDraft",
        id:   TEST_QUESTIONNAIRE_ID,
      });
      expect(res.ok, `createDraft failed: ${JSON.stringify(res)}`).toBe(true);
      expect(res.mode).toBe("createDraft");
      expect(typeof res.selfPayVisitKey).toBe("string");
      expect(res.selfPayVisitKey, "selfPayVisitKey should start with SPV_").toMatch(/^SPV_/);
      expect(res.patientId).toBe(TEST_PATIENT_ID);
      expect(res.transferredAt).toBeTruthy();
      TEST_VISIT_KEY = res.selfPayVisitKey;
    });

    test("QC-5: SelfPayQuestionnaires に linkedVisitKey / transferToVisitAt / status=transferred が記録される", async ({ page }) => {
      if (!TEST_QUESTIONNAIRE_ID || !TEST_VISIT_KEY) test.skip(true, "QC-SETUP-1 または QC-4 未完了");
      const res = await callAction(page, "q1cTestCheck", { id: TEST_QUESTIONNAIRE_ID });
      expect(res.ok).toBe(true);
      const row = res.row?.data;
      expect(row?.linkedVisitKey,    "linkedVisitKey should be set").toBe(TEST_VISIT_KEY);
      expect(row?.transferToVisitAt, "transferToVisitAt should not be empty").toBeTruthy();
      expect(row?.status,            "status should be transferred").toBe("transferred");
    });

    test("QC-6: Run_Log に QUESTIONNAIRE_CHART_DRAFT_CREATE が記録される", async ({ page }) => {
      if (!TEST_QUESTIONNAIRE_ID) test.skip(true, "QC-SETUP-1 未完了");
      const res = await callAction(page, "q1cTestCheck", { id: TEST_QUESTIONNAIRE_ID });
      expect(res.ok).toBe(true);
      expect(
        res.runLog?.hasDraft,
        `QUESTIONNAIRE_CHART_DRAFT_CREATE not in Run_Log: ${JSON.stringify(res.runLog)}`
      ).toBe(true);
    });

    // ----------------------------------------------------------------
    // 二重転記防止
    // ----------------------------------------------------------------
    test("QC-7: 転記済み問診票の二重転記が ALREADY_TRANSFERRED でブロックされる", async ({ page }) => {
      if (!TEST_QUESTIONNAIRE_ID) test.skip(true, "QC-SETUP-1 未完了");
      const res = await callAction(page, "transferQuestionnaireToVisitChart", {
        mode: "createDraft",
        id:   TEST_QUESTIONNAIRE_ID,
      });
      expect(res.ok, "double transfer should be blocked").toBe(false);
      expect(res.errorCode).toBe("ALREADY_TRANSFERRED");
      expect(res.visitKey).toBe(TEST_VISIT_KEY);
    });

    // ----------------------------------------------------------------
    // クリーンアップ
    // ----------------------------------------------------------------
    test("QC-CLEANUP: q1cTestCleanup でテストデータを削除できる", async ({ page }) => {
      const res = await callAction(page, "q1cTestCleanup");
      expect(res.ok, `cleanup failed: ${JSON.stringify(res)}`).toBe(true);
      expect(typeof res.deleted?.questionnaires).toBe("number");
      expect(typeof res.deleted?.patients).toBe("number");
      TEST_QUESTIONNAIRE_ID = "";
      TEST_PATIENT_ID       = "";
      TEST_VISIT_KEY        = "";
    });
  }
);

// ----------------------------------------------------------------
// 設計 doc / GS 実装確認（常時実行・auth 不要）
// ----------------------------------------------------------------
test.describe("JREC-SF01 Q-1C — 設計参照ドキュメント存在確認", () => {
  test("QC-DOC-1: JREC_SF01_Questionnaire.gs に transferQuestionnaireToVisitChart が実装されている", async () => {
    const gsPath = path.resolve(
      __dirname,
      "../../../../gas-projects/jrec-sf01-selfpay/JREC_SF01_Questionnaire.gs"
    );
    const content = fs.readFileSync(gsPath, "utf-8");
    expect(content.includes("function transferQuestionnaireToVisitChart"), "transferQuestionnaireToVisitChart 未実装").toBe(true);
    expect(content.includes("buildCandidateVisitChart_"),   "buildCandidateVisitChart_ 未実装").toBe(true);
    expect(content.includes("recordTransferToVisitChart_"), "recordTransferToVisitChart_ 未実装").toBe(true);
    expect(content.includes("PATIENT_LINK_REQUIRED"),        "PATIENT_LINK_REQUIRED guard 未実装").toBe(true);
    expect(content.includes("QUESTIONNAIRE_CHART_DRAFT_CREATE"), "Run_Log イベント未実装").toBe(true);
  });

  test("QC-DOC-2: questionnaire-detail.html に Q-1C カルテ転記 UI が実装されている", async () => {
    const htmlPath = path.resolve(
      __dirname,
      "../../../../gas-projects/jrec-sf01-selfpay/questionnaire-detail.html"
    );
    const content = fs.readFileSync(htmlPath, "utf-8");
    expect(content.includes("previewChartBtn"),          "previewChartBtn 未実装").toBe(true);
    expect(content.includes("createChartDraftBtn"),      "createChartDraftBtn 未実装").toBe(true);
    expect(content.includes("applyToVisitBtn"),          "applyToVisitBtn 未実装").toBe(true);
    expect(content.includes("transferQuestionnaireToVisitChart"), "JS 呼び出し未実装").toBe(true);
  });
});
