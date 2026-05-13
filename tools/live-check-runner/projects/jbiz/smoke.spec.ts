/**
 * jbiz smoke.spec.ts
 * JBIZ 平山ビジネスポータル 基本確認
 *
 * Portal-2 フェーズの確認対象:
 *   1. Portal-0 構想書が存在する（ローカル fs チェック）
 *   2. Portal-1 設計書が存在する（ローカル fs チェック）
 *   3. Portal-2 設計書が存在する（ローカル fs チェック）
 *   4. PROJECT_STATUS.md に Portal-2 記録がある（テキスト検索）
 *   5. GAS スクリプト portal-gateway-v1.gs が存在する（ローカル fs チェック）
 *   6. config.json の spreadsheetId が正本 ID（整合確認）
 *   7. 管理表 URL に到達できる（認証あり時のみ）
 *
 * 認証状態による動作:
 *   auth.json あり → Google ログイン済みセッションで Sheets URL を確認 → PASS 期待
 *   auth.json なし → Sheets の URL 到達チェックはスキップ / fs チェックは実施
 */

import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import config from "./config.json";

const JBIZ_REPO = path.resolve(
  __dirname,
  "../../../../hirayama-jyusei-strategy"
);
const AUTH_FILE = path.join(__dirname, "../../auth.json");
const HAS_AUTH = fs.existsSync(AUTH_FILE);

function jbizPath(relativePath: string): string {
  return path.join(JBIZ_REPO, relativePath);
}

// ── ローカル fs チェック ─────────────────────────────────────

test("Portal-0 構想書が存在する", async () => {
  const filePath = jbizPath(config.localDocs.portal0);
  expect(
    fs.existsSync(filePath),
    `Portal-0 構想書が見つかりません: ${filePath}`
  ).toBe(true);
});

test("Portal-1 設計書が存在する", async () => {
  const filePath = jbizPath(config.localDocs.portal1);
  expect(
    fs.existsSync(filePath),
    `Portal-1 設計書が見つかりません: ${filePath}`
  ).toBe(true);
});

test("PROJECT_STATUS.md に Portal-1 記録がある", async () => {
  const filePath = jbizPath(config.localDocs.projectStatus);
  expect(
    fs.existsSync(filePath),
    `PROJECT_STATUS.md が見つかりません: ${filePath}`
  ).toBe(true);
  const content = fs.readFileSync(filePath, "utf-8");
  expect(
    content.includes("Portal-1"),
    "PROJECT_STATUS.md に Portal-1 の記録がありません"
  ).toBe(true);
});

test("NEXT_ACTIONS.md が存在する", async () => {
  const filePath = jbizPath(config.localDocs.nextActions);
  expect(
    fs.existsSync(filePath),
    `NEXT_ACTIONS.md が見つかりません: ${filePath}`
  ).toBe(true);
});

test("Portal-2 設計書が存在する", async () => {
  const filePath = jbizPath(config.localDocs.portal2);
  expect(
    fs.existsSync(filePath),
    `Portal-2 設計書が見つかりません: ${filePath}`
  ).toBe(true);
});

test("PROJECT_STATUS.md に Portal-2 記録がある", async () => {
  const filePath = jbizPath(config.localDocs.projectStatus);
  const content = fs.readFileSync(filePath, "utf-8");
  expect(
    content.includes("Portal-2"),
    "PROJECT_STATUS.md に Portal-2 の記録がありません"
  ).toBe(true);
});

test("GAS gateway スクリプトが存在する", async () => {
  const filePath = jbizPath(config.localDocs.portalGateway);
  expect(
    fs.existsSync(filePath),
    `portal-gateway-v1.gs が見つかりません: ${filePath}`
  ).toBe(true);
});

test("config の spreadsheetId が正本 ID", async () => {
  const CORRECT_ID = "1FnJdALwFSv48WiD6NWr0DzG78kwB692R2pFeiTcZlCc";
  expect(
    config.spreadsheetId,
    `spreadsheetId が正本 ID ではありません: ${config.spreadsheetId}`
  ).toBe(CORRECT_ID);
});

test("Portal-3 設計書が存在する", async () => {
  const filePath = jbizPath(config.localDocs.portal3);
  expect(
    fs.existsSync(filePath),
    `Portal-3 設計書が見つかりません: ${filePath}`
  ).toBe(true);
});

test("GAS スクリプトに doGet が存在する", async () => {
  const filePath = jbizPath(config.localDocs.portalGateway);
  const content = fs.readFileSync(filePath, "utf-8");
  expect(
    content.includes("function doGet("),
    "portal-gateway-v1.gs に doGet 関数がありません"
  ).toBe(true);
});

test("GAS スクリプトに appendPortal2ToRunLog が存在する", async () => {
  const filePath = jbizPath(config.localDocs.portalGateway);
  const content = fs.readFileSync(filePath, "utf-8");
  expect(
    content.includes("function appendPortal2ToRunLog("),
    "portal-gateway-v1.gs に appendPortal2ToRunLog 関数がありません"
  ).toBe(true);
});

test("PROJECT_STATUS.md に Portal-3 記録がある", async () => {
  const filePath = jbizPath(config.localDocs.projectStatus);
  const content = fs.readFileSync(filePath, "utf-8");
  expect(
    content.includes("Portal-3"),
    "PROJECT_STATUS.md に Portal-3 の記録がありません"
  ).toBe(true);
});

test("Portal-4 設計書が存在する", async () => {
  const filePath = jbizPath(config.localDocs.portal4);
  expect(
    fs.existsSync(filePath),
    `Portal-4 設計書が見つかりません: ${filePath}`
  ).toBe(true);
});

test("GAS スクリプトに isSheetError_ が存在する", async () => {
  const filePath = jbizPath(config.localDocs.portalGateway);
  const content = fs.readFileSync(filePath, "utf-8");
  expect(content.includes("function isSheetError_"), "isSheetError_ がありません").toBe(true);
});

test("GAS スクリプトに safeValue_ が存在する", async () => {
  const filePath = jbizPath(config.localDocs.portalGateway);
  const content = fs.readFileSync(filePath, "utf-8");
  expect(content.includes("function safeValue_"), "safeValue_ がありません").toBe(true);
});

test("GAS スクリプトに appendPortal4ToRunLog が存在する", async () => {
  const filePath = jbizPath(config.localDocs.portalGateway);
  const content = fs.readFileSync(filePath, "utf-8");
  expect(content.includes("function appendPortal4ToRunLog("), "appendPortal4ToRunLog がありません").toBe(true);
});

test("PROJECT_STATUS.md に Portal-4 記録がある", async () => {
  const filePath = jbizPath(config.localDocs.projectStatus);
  const content = fs.readFileSync(filePath, "utf-8");
  expect(content.includes("Portal-4"), "PROJECT_STATUS.md に Portal-4 がありません").toBe(true);
});

test("Portal-5 設計書が存在する", async () => {
  const filePath = jbizPath(config.localDocs.portal5);
  expect(
    fs.existsSync(filePath),
    `Portal-5 設計書が見つかりません: ${filePath}`
  ).toBe(true);
});

test("GAS スクリプトに readRunLog_ が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("function readRunLog_"), "readRunLog_ がありません").toBe(true);
});

test("GAS スクリプトに readTaskQueue_ が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("function readTaskQueue_"), "readTaskQueue_ がありません").toBe(true);
});

test("GAS スクリプトに setupPortal5 が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("function setupPortal5("), "setupPortal5 がありません").toBe(true);
});

test("PROJECT_STATUS.md に Portal-5 記録がある", async () => {
  const filePath = jbizPath(config.localDocs.projectStatus);
  const content = fs.readFileSync(filePath, "utf-8");
  expect(content.includes("Portal-5"), "PROJECT_STATUS.md に Portal-5 がありません").toBe(true);
});

// ── Portal-6 チェック ──────────────────────────────────────

test("Portal-6 設計書が存在する", async () => {
  const filePath = jbizPath((config as any).localDocs.portal6);
  expect(
    fs.existsSync(filePath),
    `Portal-6 設計書が見つかりません: ${filePath}`
  ).toBe(true);
});

test("GAS スクリプトに buildNavigation_ が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("function buildNavigation_"), "buildNavigation_ がありません").toBe(true);
});

test("GAS スクリプトに readAllRunLog_ が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("function readAllRunLog_"), "readAllRunLog_ がありません").toBe(true);
});

test("GAS スクリプトに readAllTaskQueue_ が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("function readAllTaskQueue_"), "readAllTaskQueue_ がありません").toBe(true);
});

test("GAS スクリプトに readKpiDetail_ が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("function readKpiDetail_"), "readKpiDetail_ がありません").toBe(true);
});

test("GAS スクリプトに readRoadmapDetail_ が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("function readRoadmapDetail_"), "readRoadmapDetail_ がありません").toBe(true);
});

test("GAS スクリプトに buildHomeView_ が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("function buildHomeView_"), "buildHomeView_ がありません").toBe(true);
});

test("GAS スクリプトに buildRunLogView_ が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("function buildRunLogView_"), "buildRunLogView_ がありません").toBe(true);
});

test("GAS スクリプトに buildTaskQueueView_ が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("function buildTaskQueueView_"), "buildTaskQueueView_ がありません").toBe(true);
});

test("GAS スクリプトに buildKpiView_ が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("function buildKpiView_"), "buildKpiView_ がありません").toBe(true);
});

test("GAS スクリプトに buildRoadmapView_ が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("function buildRoadmapView_"), "buildRoadmapView_ がありません").toBe(true);
});

test("GAS スクリプトに setupPortal6 が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("function setupPortal6("), "setupPortal6 がありません").toBe(true);
});

test("GAS スクリプトに appendPortal6ToRunLog が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("function appendPortal6ToRunLog("), "appendPortal6ToRunLog がありません").toBe(true);
});

test("GAS スクリプトに updateTask action が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("action === 'updateTask'"), "updateTask アクションがありません").toBe(true);
});

test("GAS スクリプトに view 切替が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("case 'runlog'"), "view=runlog 切替がありません").toBe(true);
  expect(content.includes("case 'tasks'"), "view=tasks 切替がありません").toBe(true);
  expect(content.includes("case 'kpi'"), "view=kpi 切替がありません").toBe(true);
  expect(content.includes("case 'roadmap'"), "view=roadmap 切替がありません").toBe(true);
});

test("gas/ と scripts/ の portal-gateway-v1.gs が同一", async () => {
  const gasPath = jbizPath((config as any).localDocs.portalGatewayClasp);
  const scriptsPath = jbizPath(config.localDocs.portalGateway);
  const gasContent = fs.readFileSync(gasPath, "utf-8");
  const scriptsContent = fs.readFileSync(scriptsPath, "utf-8");
  expect(
    gasContent === scriptsContent,
    "gas/portal-gateway-v1.gs と scripts/portal-gateway-v1.gs の内容が異なります"
  ).toBe(true);
});

test("PROJECT_STATUS.md に Portal-6 記録がある", async () => {
  const filePath = jbizPath(config.localDocs.projectStatus);
  const content = fs.readFileSync(filePath, "utf-8");
  expect(content.includes("Portal-6"), "PROJECT_STATUS.md に Portal-6 がありません").toBe(true);
});

// ── Portal-7 チェック ──────────────────────────────────────

test("Portal-7 設計書が存在する", async () => {
  const filePath = jbizPath((config as any).localDocs.portal7);
  expect(
    fs.existsSync(filePath),
    `Portal-7 設計書が見つかりません: ${filePath}`
  ).toBe(true);
});

test("GAS スクリプトに readBusinessLinks_ が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("function readBusinessLinks_"), "readBusinessLinks_ がありません").toBe(true);
});

test("GAS スクリプトに ensureBusinessLinksSheet_ が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("function ensureBusinessLinksSheet_"), "ensureBusinessLinksSheet_ がありません").toBe(true);
});

test("GAS スクリプトに seedBusinessLinks_ が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("function seedBusinessLinks_"), "seedBusinessLinks_ がありません").toBe(true);
});

test("GAS スクリプトに buildBusinessHubView_ が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("function buildBusinessHubView_"), "buildBusinessHubView_ がありません").toBe(true);
});

test("GAS スクリプトに buildBusinessHubSection_ が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("function buildBusinessHubSection_"), "buildBusinessHubSection_ がありません").toBe(true);
});

test("GAS スクリプトに setupPortal7 が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("function setupPortal7("), "setupPortal7 がありません").toBe(true);
});

test("GAS スクリプトに appendPortal7ToRunLog が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("function appendPortal7ToRunLog("), "appendPortal7ToRunLog がありません").toBe(true);
});

test("GAS スクリプトに setupPortal7 action が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("action === 'setupPortal7'"), "setupPortal7 action ハンドラがありません").toBe(true);
});

test("GAS スクリプトに view=businesses 切替が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("case 'businesses'"), "view=businesses 切替がありません").toBe(true);
});

test("GAS スクリプトに BUSINESS_LINKS_HEADER 定義がある", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("BUSINESS_LINKS_HEADER"), "BUSINESS_LINKS_HEADER がありません").toBe(true);
});

test("PROJECT_STATUS.md に Portal-7 記録がある", async () => {
  const filePath = jbizPath(config.localDocs.projectStatus);
  const content = fs.readFileSync(filePath, "utf-8");
  expect(content.includes("Portal-7"), "PROJECT_STATUS.md に Portal-7 がありません").toBe(true);
});

// ── Portal-8 チェック ──────────────────────────────────────

test("Portal-8 設計書が存在する", async () => {
  const filePath = jbizPath((config as any).localDocs.portal8);
  expect(
    fs.existsSync(filePath),
    `Portal-8 設計書が見つかりません: ${filePath}`
  ).toBe(true);
});

test("GAS スクリプトに buildBusinessDetailView_ が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("function buildBusinessDetailView_"), "buildBusinessDetailView_ がありません").toBe(true);
});

test("GAS スクリプトに buildSelfpayBusinessDetail_ が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("function buildSelfpayBusinessDetail_"), "buildSelfpayBusinessDetail_ がありません").toBe(true);
});

test("GAS スクリプトに buildInsuranceBusinessDetail_ が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("function buildInsuranceBusinessDetail_"), "buildInsuranceBusinessDetail_ がありません").toBe(true);
});

test("GAS スクリプトに buildGenericBusinessDetail_ が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("function buildGenericBusinessDetail_"), "buildGenericBusinessDetail_ がありません").toBe(true);
});

test("GAS スクリプトに buildCommonBusinessDetail_ が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("function buildCommonBusinessDetail_"), "buildCommonBusinessDetail_ がありません").toBe(true);
});

test("GAS スクリプトに setupPortal8 が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("function setupPortal8("), "setupPortal8 がありません").toBe(true);
});

test("GAS スクリプトに appendPortal8ToRunLog が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("function appendPortal8ToRunLog("), "appendPortal8ToRunLog がありません").toBe(true);
});

test("GAS スクリプトに setupPortal8 action が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("action === 'setupPortal8'"), "setupPortal8 action ハンドラがありません").toBe(true);
});

test("GAS スクリプトに view=business 切替が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("case 'business'"), "view=business 切替がありません").toBe(true);
});

test("Business Hub カードに「詳細を見る」リンクがある", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("詳細を見る"), "「詳細を見る」リンクがありません").toBe(true);
});

test("PROJECT_STATUS.md に Portal-8 記録がある", async () => {
  const filePath = jbizPath(config.localDocs.projectStatus);
  const content = fs.readFileSync(filePath, "utf-8");
  expect(content.includes("Portal-8"), "PROJECT_STATUS.md に Portal-8 がありません").toBe(true);
});

// ── Portal-9 チェック ──────────────────────────────────────

test("Portal-9 設計書が存在する", async () => {
  const filePath = jbizPath((config as any).localDocs.portal9);
  expect(
    fs.existsSync(filePath),
    `Portal-9 設計書が見つかりません: ${filePath}`
  ).toBe(true);
});

test("GAS スクリプトに buildCrossBusinessKpiView_ が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("function buildCrossBusinessKpiView_"), "buildCrossBusinessKpiView_ がありません").toBe(true);
});

test("GAS スクリプトに readCrossBusinessKpi_ が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("function readCrossBusinessKpi_"), "readCrossBusinessKpi_ がありません").toBe(true);
});

test("GAS スクリプトに BUSINESS_CONNECTION_MAP 定義がある", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("BUSINESS_CONNECTION_MAP"), "BUSINESS_CONNECTION_MAP がありません").toBe(true);
});

test("GAS スクリプトに setupPortal9 が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("function setupPortal9("), "setupPortal9 がありません").toBe(true);
});

test("GAS スクリプトに appendPortal9ToRunLog が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("function appendPortal9ToRunLog("), "appendPortal9ToRunLog がありません").toBe(true);
});

test("GAS スクリプトに setupPortal9 action が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("action === 'setupPortal9'"), "setupPortal9 action ハンドラがありません").toBe(true);
});

test("GAS スクリプトに view=crosskpi 切替が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("case 'crosskpi'"), "view=crosskpi 切替がありません").toBe(true);
});

test("ナビゲーションに 横断KPI リンクがある", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("横断KPI"), "横断KPI ナビゲーションがありません").toBe(true);
});

test("PROJECT_STATUS.md に Portal-9 記録がある", async () => {
  const filePath = jbizPath(config.localDocs.projectStatus);
  const content = fs.readFileSync(filePath, "utf-8");
  expect(content.includes("Portal-9"), "PROJECT_STATUS.md に Portal-9 がありません").toBe(true);
});

// ── Portal-12 チェック ─────────────────────────────────────

test("Portal-12 設計書が存在する", async () => {
  const filePath = jbizPath((config as any).localDocs.portal12);
  expect(
    fs.existsSync(filePath),
    `Portal-12 設計書が見つかりません: ${filePath}`
  ).toBe(true);
});

test("GAS スクリプトに fetchSelfpayGymReferralKpi_ が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("function fetchSelfpayGymReferralKpi_"), "fetchSelfpayGymReferralKpi_ がありません").toBe(true);
});

test("GAS スクリプトに buildSelfpayGymReferralKpiHtml_ が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("function buildSelfpayGymReferralKpiHtml_"), "buildSelfpayGymReferralKpiHtml_ がありません").toBe(true);
});

test("GAS スクリプトに getSelfpayConnectionWithPortal12_ が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("function getSelfpayConnectionWithPortal12_"), "getSelfpayConnectionWithPortal12_ がありません").toBe(true);
});

test("GAS スクリプトに setupPortal12 が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("function setupPortal12("), "setupPortal12 がありません").toBe(true);
});

test("GAS スクリプトに appendPortal12ToRunLog が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("function appendPortal12ToRunLog("), "appendPortal12ToRunLog がありません").toBe(true);
});

test("GAS スクリプトに setupPortal12 action が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("action === 'setupPortal12'"), "setupPortal12 action ハンドラがありません").toBe(true);
});

test("GAS スクリプトに fetchSelfpayGymKpi action が存在する", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("action === 'fetchSelfpayGymKpi'"), "fetchSelfpayGymKpi action ハンドラがありません").toBe(true);
});

test("GAS スクリプトに JREC SF01 endpoint URL が定義されている", async () => {
  const content = fs.readFileSync(jbizPath(config.localDocs.portalGateway), "utf-8");
  expect(content.includes("JREC_SF01_GYM_REFERRAL_URL_DEFAULT"), "JREC_SF01_GYM_REFERRAL_URL_DEFAULT がありません").toBe(true);
  expect(content.includes("AKfycbz0EqGZOXWrKokzFN2x4SMo17cJojaHnWvmR2FAHXyQ1OLIdnWGwBSHIyylDAMqb8oACA"), "JREC-SF01 prod deployment ID への参照がありません").toBe(true);
});

test("appsscript.json に UrlFetch 用 oauthScope が追加されている", async () => {
  // gas/appsscript.json は localDocs に登録されていないので path 計算
  const filePath = jbizPath("gas/appsscript.json");
  const content = fs.readFileSync(filePath, "utf-8");
  expect(content.includes("script.external_request"), "script.external_request scope がありません").toBe(true);
});

test("PROJECT_STATUS.md に Portal-12 記録がある", async () => {
  const filePath = jbizPath(config.localDocs.projectStatus);
  const content = fs.readFileSync(filePath, "utf-8");
  expect(content.includes("Portal-12"), "PROJECT_STATUS.md に Portal-12 がありません").toBe(true);
});

test("config に WebApp URL が記録されている", async () => {
  expect(
    config.gasScript && config.gasScript.webAppUrl && config.gasScript.webAppUrl.length > 0,
    "config.gasScript.webAppUrl が設定されていません"
  ).toBe(true);
});

test("config に GAS script ID が記録されている", async () => {
  expect(
    config.gasScript && config.gasScript.scriptId && config.gasScript.scriptId.length > 0,
    "config.gasScript.scriptId が設定されていません"
  ).toBe(true);
});

test("GAS WebApp URL に到達できる（auth 承認後のみ PASS）", async ({ page }) => {
  const webAppUrl = config.gasScript && config.gasScript.webAppUrl;
  if (!webAppUrl) {
    test.skip(true, "WebApp URL が config に設定されていません");
    return;
  }
  if (!HAS_AUTH) {
    test.skip(true, "auth.json がないため WebApp 確認をスキップします");
    return;
  }
  await page.goto(webAppUrl, { timeout: 30000, waitUntil: "domcontentloaded" });
  const url   = page.url();
  const title = await page.title().catch(() => "");

  // ログイン未済: accounts.google.com にリダイレクト
  if (url.includes("accounts.google.com") || url.includes("ServiceLogin") || title.includes("Sign in")) {
    test.skip(true, "auth.json 期限切れ: ログイン画面");
    return;
  }
  // 初回承認待ち
  if (title.includes("Authorization needed")) {
    test.skip(true, "GAS 承認待ち: ブラウザで setupUrl を開き Review Permissions を承認してください");
    return;
  }

  // 承認済みの場合: 外側ページ or iframe 内のいずれかに "ビジネスポータル" が含まれることを確認
  const outerHasPortal =
    title.includes("平山ビジネスポータル") ||
    title.includes("Hirayama Business Portal");

  let frameHasPortal = false;
  if (!outerHasPortal) {
    try {
      const frame = page.frameLocator("iframe").first().frameLocator("iframe").first();
      const bodyText = await frame.locator("body").innerText({ timeout: 20000 }).catch(() => "");
      frameHasPortal = bodyText.includes("平山ビジネスポータル");
    } catch {
      // iframe 取得に失敗した場合はトップフレームの h1 を確認
      const h1Text = await page.locator("h1").first().textContent().catch(() => "") || "";
      frameHasPortal = h1Text.includes("ビジネスポータル");
    }
  }

  expect(
    outerHasPortal || frameHasPortal,
    `Portal 画面が表示されません: title="${title}" url="${url}"`
  ).toBe(true);
});

// ── Sheets URL 到達確認（認証あり時のみ）────────────────────

test("管理表 URL に到達できる（auth ありの場合のみ）", async ({ page }) => {
  if (!HAS_AUTH) {
    test.skip(true, "auth.json がないため Sheets 到達確認をスキップします");
    return;
  }
  await page.goto(config.sheetsUrl, { timeout: 15000 });
  const url = page.url();

  if (
    url.includes("accounts.google.com") ||
    url.includes("ServiceLogin") ||
    (await page.title().catch(() => "")).includes("Sign in")
  ) {
    test.skip(true, "auth.json の期限切れ: ログイン画面にリダイレクトされました");
    return;
  }

  // Sheets が開けたことを確認（タイトルに管理表名または Sheets が含まれる）
  const title = await page.title();
  const isSheets =
    title.includes("Google スプレッドシート") ||
    title.includes("Google Sheets") ||
    title.includes("管理表") ||
    title.includes("慢性疼痛");
  expect(isSheets, `想定外のページが表示されました: ${title}`).toBe(true);
});
