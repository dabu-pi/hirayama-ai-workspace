#!/usr/bin/env node

import {
  batchGetSheetValues,
  batchUpdateSpreadsheet,
  getAuthorizedContext,
  getSheetValues,
  getSpreadsheetMetadata,
  parseArgs,
  updateSheetValues,
} from './lib-sheets.mjs';

const LIVE_SPREADSHEET_ID = '1FnJdALwFSv48WiD6NWr0DzG78kwB692R2pFeiTcZlCc';
const WARNING_TEXT =
  'このシートは戦略管理用です。黄色セルを入力し、青/緑セルは自動計算として扱ってください。';

const SHEET = {
  DASHBOARD: '全体ダッシュボード',
  ROADMAP: 'ロードマップ進捗',
  INSURANCE: '保険・来院前提',
  NUMERIC: '数値前提',
  PRICING: '価格設定',
  KPI_REVERSE: 'KPI逆算',
  KPI: 'KPI目標',
  KPI_HISTORY: 'KPI実績履歴',
  KPI_REVERSE_HISTORY: 'KPI逆算履歴',
  OPEN_ITEMS: '未確定項目',
};

const TARGET_REBUILD_SHEETS = [
  SHEET.DASHBOARD,
  SHEET.INSURANCE,
  SHEET.NUMERIC,
  SHEET.PRICING,
  SHEET.KPI_REVERSE,
  SHEET.KPI,
  SHEET.KPI_HISTORY,
  SHEET.KPI_REVERSE_HISTORY,
];

const BACKUP_SHEETS = [
  SHEET.DASHBOARD,
  SHEET.INSURANCE,
  SHEET.NUMERIC,
  SHEET.PRICING,
  SHEET.KPI,
];

const SHEET_ORDER = [
  SHEET.DASHBOARD,
  SHEET.ROADMAP,
  SHEET.INSURANCE,
  SHEET.NUMERIC,
  SHEET.PRICING,
  SHEET.KPI_REVERSE,
  SHEET.KPI,
  SHEET.KPI_HISTORY,
  SHEET.KPI_REVERSE_HISTORY,
  SHEET.OPEN_ITEMS,
];

const SUPPORT_SHEETS = [SHEET.DASHBOARD, SHEET.ROADMAP, SHEET.OPEN_ITEMS];

function cell(rows, row, col) {
  return rows?.[row - 1]?.[col - 1] ?? '';
}

function asNumber(value, fallback = '') {
  if (value === '' || value === null || value === undefined) {
    return fallback;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function asPercentInput(value, fallbackText) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return fallbackText;
  }
  return `${(num * 100).toFixed(num * 100 % 1 === 0 ? 0 : 1)}%`;
}

function timestampForTitle(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const mi = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}${mm}${dd}-${hh}${mi}`;
}

function todayString(date = new Date()) {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}/${mm}/${dd}`;
}

async function sheetsFetch(url, { accessToken, method = 'GET', body } = {}) {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Sheets API error (${response.status}): ${text}`);
  }

  return response.json();
}

async function createSpreadsheet({ title, accessToken }) {
  return sheetsFetch('https://sheets.googleapis.com/v4/spreadsheets', {
    accessToken,
    method: 'POST',
    body: { properties: { title } },
  });
}

async function copySheetToSpreadsheet({
  sourceSpreadsheetId,
  sourceSheetId,
  destinationSpreadsheetId,
  accessToken,
}) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${sourceSpreadsheetId}/sheets/${sourceSheetId}:copyTo`;
  return sheetsFetch(url, {
    accessToken,
    method: 'POST',
    body: { destinationSpreadsheetId },
  });
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildDashboardSummaryRows() {
  return [
    ['■ 進捗サマリ（自動集計）', '', ''],
    ['現在フェーズ', `=IFERROR(INDEX('${SHEET.ROADMAP}'!B4:B9,MATCH("進行中",'${SHEET.ROADMAP}'!E4:E9,0)),"未設定")`, 'ロードマップ進捗シートを参照'],
    ['戦略完成度（%）', `=IFERROR(TEXT(COUNTIF('${SHEET.ROADMAP}'!E4:E9,"完了")/6,"0%"),"0%")`, '完了フェーズ数÷6'],
    ['数値確定度（%）', `=IFERROR(TEXT(COUNTIF('${SHEET.OPEN_ITEMS}'!F4:F14,"確定済み")/11,"0%"),"0%")`, '確定済み件数÷11'],
    ['未確定項目数（件）', `=IFERROR(COUNTIF('${SHEET.OPEN_ITEMS}'!F4:F14,"未確定")&"件","—")`, '未確定項目シートを参照'],
    ['月自費収益目標', `=IFERROR(TEXT(INDEX('${SHEET.KPI_REVERSE}'!C:C,MATCH("月次自費目標",'${SHEET.KPI_REVERSE}'!B:B,0)),"#,##0")&"円","要入力")`, 'KPI逆算シートを参照'],
    ['必要手技回数/月', `=IFERROR(TEXT(INDEX('${SHEET.KPI_REVERSE}'!C:C,MATCH("必要手技回数",'${SHEET.KPI_REVERSE}'!B:B,0)),"0.0")&"回","要入力")`, '自費目標 ÷ 主力手技価格'],
    ['必要手技回数/日', `=IFERROR(TEXT(INDEX('${SHEET.KPI_REVERSE}'!C:C,MATCH("必要手技回数/日",'${SHEET.KPI_REVERSE}'!B:B,0)),"0.0")&"回","要入力")`, '必要手技回数 ÷ 営業日数'],
    ['保険実人数', `=IFERROR(TEXT(INDEX('${SHEET.KPI_REVERSE}'!C:C,MATCH("保険実人数",'${SHEET.KPI_REVERSE}'!B:B,0)),"0")&"人","要入力")`, '入口KPI'],
    ['月次総保険売上', `=IFERROR(TEXT(INDEX('${SHEET.KPI_REVERSE}'!C:C,MATCH("月次総保険売上",'${SHEET.KPI_REVERSE}'!B:B,0)),"#,##0")&"円","要入力")`, '窓口負担 + 保険者支払分'],
    ['慢性候補人数', `=IFERROR(TEXT(INDEX('${SHEET.KPI_REVERSE}'!C:C,MATCH("慢性候補人数",'${SHEET.KPI_REVERSE}'!B:B,0)),"0.0")&"人","要入力")`, '保険実人数 × 慢性候補率'],
    ['手技回数', `=IFERROR(TEXT(INDEX('${SHEET.KPI_REVERSE}'!C:C,MATCH("手技回数",'${SHEET.KPI_REVERSE}'!B:B,0)),"0.0")&"回","要入力")`, '月次の見込み手技回数'],
    ['見込み自費売上', `=IFERROR(TEXT(INDEX('${SHEET.KPI_REVERSE}'!C:C,MATCH("自費売上",'${SHEET.KPI_REVERSE}'!B:B,0)),"#,##0")&"円","要入力")`, '手技回数 × 主力手技価格'],
    ['ジム体験人数', `=IFERROR(TEXT(INDEX('${SHEET.KPI_REVERSE}'!C:C,MATCH("ジム体験人数",'${SHEET.KPI_REVERSE}'!B:B,0)),"0.0")&"人","要入力")`, '手技患者数 × ジム体験誘導率'],
  ];
}

function buildDashboardHeaderValues(preserved) {
  return [
    [WARNING_TEXT, '', ''],
    ['平山接骨院 慢性疼痛強化プロジェクト ダッシュボード', '', ''],
    ['最終更新日', preserved.dashboardUpdatedAt || '', ''],
    ['今週のメモ', preserved.dashboardMemo || '', ''],
  ];
}

function buildRoadmapPlaceholderValues() {
  return [
    ['フェーズ', '概要', '開始条件', '完了条件', 'ステータス', '備考'],
    ['Phase1', '方針整理', '', '', '完了', ''],
    ['Phase2', '価格設計', '', '', '完了', ''],
    ['Phase3', 'KPI設計', '', '', '進行中', ''],
    ['Phase4', '導線構築', '', '', '未着手', ''],
    ['Phase5', '運用定着', '', '', '未着手', ''],
    ['Phase6', '拡張検討', '', '', '未着手', ''],
  ];
}

function buildOpenItemsPlaceholderValues() {
  return [
    ['No.', '項目名', 'カテゴリ', '優先度', '論点', '確定状況', '決める数値', '期限', '関連ファイル', '備考'],
    [1, '主力手技価格', '価格設定', '高', '案C 5,500円 / 案A 5,000円のどちらで正式確定するか', '未確定', '5,500円', '', 'pricing.md', '基準仮説=案C / 到達目標=案A'],
    [2, '慢性患者移行率', 'KPI', '高', '基準仮説・到達目標とも 50% を正式採用するか', '未確定', '50%', '', 'kpi.md', '差額 7,500円は微増で補完候補あり'],
    [3, '月平均来院回数', 'KPI', '高', '案C 3.5回 / 案A 4.0回 のどちらを正式値にするか', '未確定', '3.5回', '', 'kpi.md', '差額 7,500円は回数微増でも調整可能'],
    [4, '手技自費再来率', 'KPI', '中', '月平均来院回数の背景指標として監視', '未確定', '', '', 'kpi.md', ''],
    [5, 'ジム体験誘導率', 'KPI', '中', '初期導線の体験率', '未確定', '', '', 'kpi.md', ''],
    [6, 'ジム会員費（スタンダード月額）', '価格設定', '中', '月会員価格の確定', '未確定', '', '', 'pricing.md', ''],
    [7, 'ジム会員費（プレミアム月額）', '価格設定', '中', '月会員価格の確定', '未確定', '', '', 'pricing.md', ''],
    [8, '固定費の実数値', '数値前提', '高', '損益判断の基礎データ', '未確定', '', '', 'cost-structure.md', ''],
    [9, '月次保険売上・患者数ベースライン', '数値前提', '高', '入口KPIの前提確認', '未確定', '', '', 'profit-simulation.md', ''],
  ];
}

function buildInsuranceValues(preserved) {
  return [
    [WARNING_TEXT, '', '', ''],
    ['保険・来院前提（来院構造・保険前提）', '', '', ''],
    ['', '', '', ''],
    ['■ ブロックA: 来院構造', '', '', ''],
    ['項目名', '値', '単位', '備考'],
    ['保険実人数（現在）', preserved.insurancePatients, '人/月', '入口患者の実人数ベース'],
    ['保険延べ来院数（現在）', preserved.insuranceVisits, '回/月', '保険の延べ来院数'],
    ['保険1人あたり月来院回数', '=IFERROR(B7/B6,0)', '回/人', '保険延べ来院数 ÷ 保険実人数'],
    ['新患数（現在）', preserved.newPatients, '人/月', '月次管理用の参考値'],
    ['慢性候補率（現在）', preserved.chronicCandidateRate, '%', '腰痛・首肩こり候補の割合'],
    ['慢性候補人数（現在）', '=IFERROR(B6*B10,0)', '人/月', '保険実人数 × 慢性候補率'],
    ['', '', '', ''],
    ['■ ブロックB: 保険単価前提', '', '', ''],
    ['項目名', '値', '単位', '備考'],
    ['窓口単価', preserved.windowUnitPrice, '円/回', '患者が窓口で支払う平均額'],
    ['総保険売上単価', preserved.totalInsuranceUnitPrice, '円/回', '窓口負担 + 保険者支払分の1来院あたり合計'],
    ['月次窓口売上（参考）', '=IF(B15="","",IFERROR(B7*B15,0))', '円/月', '窓口単価 × 保険延べ来院数'],
    ['月次総保険売上（試算）', '=IF(B16="","",IFERROR(B7*B16,0))', '円/月', '総保険売上単価 × 保険延べ来院数'],
  ];
}

function buildNumericValues(preserved) {
  return [
    [WARNING_TEXT, '', '', ''],
    ['数値前提（売上・利益前提）', '', '', ''],
    ['', '', '', ''],
    ['■ ブロックA: 月次固定費（すべて入力してください）', '', '', ''],
    ['項目名', '金額（円/月）', '単位', '備考'],
    ['家賃', preserved.fixedRent, '円/月', ''],
    ['水道光熱費', preserved.fixedUtilities, '円/月', ''],
    ['通信費', preserved.fixedComms, '円/月', ''],
    ['システム費', preserved.fixedSystems, '円/月', 'GAS・クラウドツール等'],
    ['広告費', preserved.fixedAds, '円/月', 'Google広告・SNS等'],
    ['消耗品費', preserved.fixedSupplies, '円/月', ''],
    ['外注費', preserved.fixedOutsource, '円/月', 'クリーニング・業務委託等'],
    ['オーナー最低人件費', preserved.fixedOwnerLabor, '円/月', '院長の生活費ベース'],
    ['機器リース/返済', preserved.fixedLease, '円/月', '治療機器・設備の月次コスト'],
    ['スタッフ人件費（いる場合）', preserved.fixedStaffLabor, '円/月', 'スタッフがいない場合は 0'],
    ['現金支出固定費合計', '=IFERROR(SUM(B6:B14),"要入力")', '円/月', ''],
    ['経営固定費合計（スタッフ含む）', '=IFERROR(SUM(B6:B15),"要入力")', '円/月', ''],
    ['', '', '', ''],
    ['■ ブロックB: 売上ベースライン（保険・来院前提を参照）', '', '', ''],
    ['項目名', '現状値', '単位', '備考'],
    ['月次総保険売上（現在）', `=IFERROR('${SHEET.INSURANCE}'!B18,"")`, '円/月', '保険・来院前提の試算値を参照'],
    ['月次窓口売上（参考）', `=IFERROR('${SHEET.INSURANCE}'!B17,"")`, '円/月', '保険・来院前提の参考値を参照'],
    ['保険延べ来院数（現在）', `=IFERROR('${SHEET.INSURANCE}'!B7,"")`, '回/月', '総保険売上単価の母数'],
    ['保険実人数（現在）', `=IFERROR('${SHEET.INSURANCE}'!B6,"")`, '人/月', '保険・来院前提を参照'],
    ['月次営業日数', preserved.businessDays, '日/月', ''],
    ['', '', '', ''],
    ['保険1日平均延べ来院数', '=IFERROR(B23/B25,"要入力")', '回/日', '保険延べ来院数 ÷ 営業日数'],
    ['総保険売上単価', '=IFERROR(B21/B23,"要入力")', '円/回', '窓口負担 + 保険者支払分の1来院あたり合計'],
    ['窓口単価', '=IF(B22="","",IFERROR(B22/B23,"要入力"))', '円/回', '患者が窓口で支払う平均額'],
    ['自費+20万円後の月次総収入見込み', '=IFERROR(B21+200000,"要入力")', '円/月', '月次総保険売上 + 200,000'],
    ['固定費カバー率', '=IFERROR(TEXT(B30/B17,"0.0%"),"要入力")', '', '100%以上で固定費をカバーできる'],
  ];
}

function buildPricingValues() {
  return [
    [WARNING_TEXT, '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['メニューマスタ（価格設定）', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['表示順', '大区分', '小区分', 'メニュー名', '内容', '時間', '一般料金（円）', 'ジム会員料金（円）', '保険適用', '回数/単位', '主力手技フラグ', 'KPI集計対象', '確定状況', '備考'],
    [1, '保険施術（急性期対応）', '', '保険施術', '検査＋電気治療（約15分）＋手技（約5分）', '約20分', '保険適用', '—', '○', '1回', false, '×', '確定', '急な痛みや日常の不調に対応します。'],
    [2, '保険施術オプション', '', '手技延長', '10分延長', '10分', 1100, 935, '×', '1回', false, '○', '確定', ''],
    [3, '保険施術オプション', '', '筋膜リリース（マッサージガン）', '5分追加', '5分', 880, 748, '×', '1回', false, '○', '確定', ''],
    [4, '保険施術オプション', '', '温熱追加', '5分追加', '5分', 550, 467, '×', '1回', false, '○', '確定', ''],
    [5, '将来検討メニュー', '', '深部コンディショニング', '深部電気＋軽調整', '約30分', 4400, 3740, '×', '1回', false, '×', '将来検討', '機械中心の自費は当面主力にしない。'],
    [6, '将来検討メニュー', '', '電気治療1回', '干渉波電気治療', '約15分', 1200, 1020, '×', '1回', false, '×', '将来検討', '機械は保険治療の補助用を優先。'],
    [7, '将来検討メニュー', '', '電気治療午前限定通い放題', '干渉波電気治療', '約15分', 5500, 4675, '×', '月額', false, '×', '将来検討', '機械中心メニューは将来検討。'],
    [8, '将来検討メニュー', '', '慢性疼痛改善 8回プログラム', '根本改善＋再発予防設計', '45分×8回', 58000, 49300, '×', '8回', false, '×', '将来検討', '主力前提は外し、将来の継続商品候補として保持。'],
    [9, '慢性専門施術（主力）', '', '慢性ケア手技50分', '手技中心で筋緊張・可動域・姿勢バランスを整える', '約50分', 5000, 4250, '×', '1回', true, '○', '仮', '慢性腰痛・首肩こりの方へ最初に提案する主力メニュー。'],
    [10, '運動再教育（再発防止）', '', 'パーソナルトレーニング', '痛まない身体の使い方習得', '約60分', 8800, 7480, '×', '1回', false, '○', '確定', ''],
    [11, '運動再教育（再発防止）', '', '4回集中コース', 'フォーム再教育・卒業設計', '60分×4回', 35200, 29920, '×', '4回', false, '○', '確定', ''],
    [12, '併設ジム', '', '月会員', '併設ジム利用', '月額', 7480, '—', '×', '月額', false, '○', '仮', 'ジム会員価格は再確認予定。'],
    ['', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['集計', 'KPI集計対象数', '=COUNTIF(L4:L15,"○")&"件 / 12件"', '', '', '', '主力手技フラグ件数', '=COUNTIF(K4:K15,TRUE)&"件"', '', '未確定件数', '=COUNTIF(M4:M15,"未確定")&"件が未確定 / "&COUNTIF(M4:M15,"仮")&"件が仮値"', '', ''],
    ['警告', '=IF(COUNTIF(K4:K15,TRUE)=1,"OK","警告: 主力手技フラグを1行だけTRUEにしてください")', '', '', '', '', '', '', '', '', '', '', '', ''],
  ];
}

function buildKPIReverseValues(preserved) {
  return [
    ['KPI逆算', '手技主軸モデル（保険入口 → 自費化 → ジム誘導の必要件数逆算）', '', '', '', '', ''],
    ['色分け', '青=手入力 / 緑=自動計算 / 黄=仮値 / 灰=将来KPI', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['基本前提', '月次自費目標', 200000, '円', '入力', '固定', '月次自費+20万円目標'],
    ['基本前提', '主力手技価格', `=IF(COUNTIF('${SHEET.PRICING}'!K4:K15,TRUE)=1,INDEX(FILTER('${SHEET.PRICING}'!G4:G15,'${SHEET.PRICING}'!K4:K15=TRUE),1),5000)`, '円', '自動', '価格設定シートの主力手技フラグ参照', '主力手技フラグが0件/複数件なら 5,000 円にフォールバック'],
    ['基本前提', '主力手技フラグ件数', `=COUNTIF('${SHEET.PRICING}'!K4:K15,TRUE)`, '件', '自動', '価格設定シート参照', 'TRUE は 1 行のみ想定'],
    ['基本前提', '主力手技価格警告', '=IF(C6=1,"OK","警告: 価格設定シートの主力手技フラグを1行だけTRUEにしてください")', '警告', '自動', '=COUNTIF(価格設定!K4:K15,TRUE)', '0件または複数件なら警告を表示'],
    ['基本前提', '営業日数', preserved.businessDays, '日', '入力', '固定', '月の営業日数'],
    ['基本前提', 'ジム会員価格', `=IFERROR(INDEX('${SHEET.PRICING}'!G:G,MATCH("月会員",'${SHEET.PRICING}'!D:D,0)),0)`, '円', '自動', '価格設定シート参照', '将来KPI用。未確定なら 0 でも可'],
    ['基本前提', '更新日', '=TODAY()', '日付', '自動', '=TODAY()', '最終更新確認'],
    ['', '', '', '', '', '', ''],
    ['保険入口KPI', '保険実人数', `=IFERROR('${SHEET.INSURANCE}'!B6,0)`, '人/月', '自動', '保険・来院前提シート参照', '入口KPI'],
    ['保険入口KPI', '保険延べ来院数', `=IFERROR('${SHEET.INSURANCE}'!B7,0)`, '回/月', '自動', '保険・来院前提シート参照', '月次総保険売上の母数'],
    ['保険入口KPI', '月次総保険売上', `=IFERROR('${SHEET.NUMERIC}'!B21,0)`, '円/月', '自動', '数値前提シート参照', '窓口負担 + 保険者支払分の合計'],
    ['保険入口KPI', '保険1人あたり月来院回数', '=IFERROR(C13/C12,0)', '回/人', '自動', '=C13/C12', '実人数ベース'],
    ['保険入口KPI', '保険1回来院あたり総売上', '=IFERROR(C14/C13,0)', '円/回', '自動', '=C14/C13', '総保険売上単価'],
    ['保険入口KPI', '慢性候補率', `=IFERROR('${SHEET.INSURANCE}'!B10,0)`, '%', '自動', '保険・来院前提シート参照', '腰痛・首肩こり候補比率'],
    ['保険入口KPI', '慢性候補人数', '=IFERROR(C12*C17,0)', '人/月', '自動', '=C12*C17', '自費化候補母数'],
    ['', '', '', '', '', '', ''],
    ['自費化KPI', '慢性患者移行率', '20%', '%', '入力', '仮値', '慢性候補 → 手技自費'],
    ['自費化KPI', '手技患者数', '=IFERROR(C18*C20,0)', '人/月', '自動', '=C18*C20', '手技に移行した人数'],
    ['自費化KPI', '手技自費再来率', '50%', '%', '入力', '監視指標', '初回後の再来率は監視用'],
    ['自費化KPI', '手技患者1人あたり月平均来院回数', '2.0', '回/人', '入力', '主指標', '再来率よりも計算用主指標として管理'],
    ['自費化KPI', '手技回数', '=IFERROR(C21*C23,0)', '回/月', '自動', '=C21*C23', '売上の基本単位'],
    ['自費化KPI', '自費売上', '=IFERROR(C24*C5,0)', '円/月', '自動', '=C24*C5', '手技回数 × 主力手技価格'],
    ['自費化KPI', '必要手技回数', '=IFERROR(ROUNDUP(C4/C5,0),0)', '回/月', '自動', '=ROUNDUP(C4/C5,0)', '月次自費目標から逆算'],
    ['自費化KPI', '必要手技回数/日', '=IFERROR(C26/C8,0)', '回/日', '自動', '=C26/C8', '営業日数で割った日次感覚'],
    ['自費化KPI', '自費売上達成率', '=IFERROR(C25/C4,0)', '%', '自動', '=C25/C4', '目標比'],
    ['', '', '', '', '', '', ''],
    ['ジム誘導KPI', 'ジム体験誘導率', '10%', '%', '入力', '仮値', '手技患者 → ジム体験'],
    ['ジム誘導KPI', 'ジム体験人数', '=IFERROR(C21*C30,0)', '人/月', '自動', '=C21*C30', '初期KPI'],
    ['ジム誘導KPI', '体験→入会率', '30%', '%', '入力', '将来KPI', 'ジム運用安定後に重視'],
    ['ジム誘導KPI', '新規入会数', '=IFERROR(C31*C32,0)', '人/月', '自動', '=C31*C32', '将来KPI'],
    ['ジム誘導KPI', 'ジム売上', '=IFERROR(C33*C9,0)', '円/月', '自動', '=C33*C9', 'ジム会員価格確定後に使用'],
    ['', '', '', '', '', '', ''],
    ['必要母数の逆算', '必要手技患者数', '=IFERROR(ROUNDUP(C26/C23,0),0)', '人/月', '自動', '=C26/C23', '必要手技回数から逆算'],
    ['必要母数の逆算', '必要慢性候補人数', '=IFERROR(ROUNDUP(C36/C20,0),0)', '人/月', '自動', '=C36/C20', '移行率込み逆算'],
    ['必要母数の逆算', '必要保険実人数', '=IFERROR(ROUNDUP(C37/C17,0),0)', '人/月', '自動', '=C37/C17', '入口母数の必要量'],
    ['必要母数の逆算', '保険実人数ギャップ', '=IFERROR(C12-C38,0)', '人/月', '自動', '=C12-C38', 'マイナスなら入口不足'],
    ['必要母数の逆算', '慢性候補人数ギャップ', '=IFERROR(C18-C37,0)', '人/月', '自動', '=C18-C37', 'マイナスなら候補不足'],
    ['', '', '', '', '', '', ''],
    ['将来KPI', '月次退会率', '5%', '%', '入力', '仮値', 'ジム運用安定後に重視'],
    ['将来KPI', '6ヶ月後会員数', '=IFERROR(IF(C42=0,C33*6,C33*((1-(1-C42)^6)/C42)),0)', '人', '将来', '別ロジック', '節目比較用'],
    ['将来KPI', '6ヶ月後ジム月次収益', '=IFERROR(C43*C9,0)', '円', '将来', '別ロジック', '後段で拡張'],
  ];
}

function buildKPIValues() {
  return [
    [WARNING_TEXT, '', '', '', '', '', ''],
    ['KPI目標（月次目標と実績比較）', '', '', '', '', '', ''],
    ['KPI名', '単位', '目標値', '実績値', '差異', '達成率', 'メモ'],
    ['月間売上', '円/月', '=IFERROR(C5+C6,0)', '=IFERROR(D5+D6,0)', '=IF(OR(C4="",D4=""),"",D4-C4)', '=IF(OR(C4="",C4=0,D4=""),"",D4/C4)', '月次総保険売上 + 自費売上'],
    ['月次総保険売上', '円/月', `=IFERROR('${SHEET.NUMERIC}'!B21,0)`, '', '=IF(OR(C5="",D5=""),"",D5-C5)', '=IF(OR(C5="",C5=0,D5=""),"",D5/C5)', '主指標は窓口 + 保険者支払分の合計'],
    ['自費売上', '円/月', `=IFERROR(INDEX('${SHEET.KPI_REVERSE}'!C:C,MATCH("月次自費目標",'${SHEET.KPI_REVERSE}'!B:B,0)),0)`, '', '=IF(OR(C6="",D6=""),"",D6-C6)', '=IF(OR(C6="",C6=0,D6=""),"",D6/C6)', '当月の手技中心の自費売上'],
    ['自費売上比率', '%', '=IFERROR(C6/C4,0)', '=IFERROR(D6/D4,0)', '=IF(OR(C7="",D7=""),"",D7-C7)', '=IF(OR(C7="",C7=0,D7=""),"",D7/C7)', '自費売上 ÷ 月間売上'],
    ['新患数', '人/月', '', '', '=IF(OR(C8="",D8=""),"",D8-C8)', '=IF(C8=0,"",D8/C8)', '月末確定時に手入力'],
    ['延べ来院数', '回/月', `=IFERROR('${SHEET.INSURANCE}'!B7,0)`, '', '=IF(OR(C9="",D9=""),"",D9-C9)', '=IF(OR(C9="",C9=0,D9=""),"",D9/C9)', '保険・来院前提を目標側の基準値に使用'],
    ['保険平均単価', '円/回', '=IFERROR(C5/C9,0)', '=IFERROR(D5/D9,0)', '=IF(OR(C10="",D10=""),"",D10-C10)', '=IF(OR(C10="",C10=0,D10=""),"",D10/C10)', '月次総保険売上 ÷ 延べ来院数'],
    ['自費平均単価', '円/回', `=IFERROR(INDEX('${SHEET.KPI_REVERSE}'!C:C,MATCH("主力手技価格",'${SHEET.KPI_REVERSE}'!B:B,0)),0)`, '', '=IF(OR(C11="",D11=""),"",D11-C11)', '=IF(OR(C11="",C11=0,D11=""),"",D11/C11)', '主力手技価格を基準値として管理'],
    ['', '', '', '', '', '', ''],
    ['定義', '月次総保険売上 = 月の総保険収入（窓口 + 保険者） / 保険平均単価 = 月次総保険売上 ÷ 延べ来院数 / 自費平均単価 = 主力手技価格を基準に管理', '', '', '', '', ''],
  ];
}

function buildKPIHistoryValues() {
  return [
    [WARNING_TEXT, '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['KPI実績履歴（月次保存用）', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['1か月 = 1行で保存します。月末または翌月初に KPI目標 の目標値 / 実績値を値貼り付けで転記する前提です。', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['対象年月', '月間売上_目標', '月間売上_実績', '月次総保険売上_目標', '月次総保険売上_実績', '自費売上_目標', '自費売上_実績', '自費売上比率_目標', '自費売上比率_実績', '新患数_目標', '新患数_実績', '延べ来院数_目標', '延べ来院数_実績', '保険平均単価_目標', '保険平均単価_実績', '自費平均単価_目標', '自費平均単価_実績', '備考', '記録日'],
  ];
}

function buildKPIReverseHistoryValues(preserved, today) {
  return [
    [WARNING_TEXT, '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['KPI逆算履歴（前提変更履歴用）', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['KPI逆算 は常に最新設計です。方針転換や前提変更があったときだけ 1 行追記し、節目比較に使います。', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ['変更日', '版名', '変更理由', '月次自費目標', '主力手技価格', '保険実人数前提', '保険延べ来院数前提', '月次総保険売上前提', '慢性候補率', '慢性患者移行率', '手技患者1人あたり月平均来院回数', '手技自費再来率', 'ジム体験誘導率', 'メモ'],
    [today, '2026-03 手技主軸モデル', 'KPI役割分離 / 履歴シート新設 / live本体反映', 200000, 5000, preserved.insurancePatients, preserved.insuranceVisits, preserved.currentMonthlyInsuranceRevenue, preserved.chronicCandidateRate, '20%', '2.0', '50%', '10%', '初期ベースライン'],
  ];
}

function buildColumnWidthRequests(sheetId, widths) {
  return widths.map((pixelSize, index) => ({
    updateDimensionProperties: {
      range: {
        sheetId,
        dimension: 'COLUMNS',
        startIndex: index,
        endIndex: index + 1,
      },
      properties: { pixelSize },
      fields: 'pixelSize',
    },
  }));
}

function buildFreezeRequest(sheetId, frozenRowCount) {
  return {
    updateSheetProperties: {
      properties: {
        sheetId,
        gridProperties: { frozenRowCount },
      },
      fields: 'gridProperties.frozenRowCount',
    },
  };
}

function getSheetMap(metadata) {
  return new Map((metadata.sheets ?? []).map((sheet) => [sheet.properties.title, sheet.properties]));
}

async function applyRange(context, sheetName, range, values) {
  await updateSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName,
    range,
    values,
    accessToken: context.accessToken,
  });
}

async function verifyWarningState(context, flags, label) {
  const values = flags.map((flag) => [flag]);
  await updateSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: SHEET.PRICING,
    range: 'K4:K15',
    values,
    accessToken: context.accessToken,
  });
  await sleep(2000);
  const [pricing, reverse] = await Promise.all([
    getSheetValues({
      spreadsheetId: context.spreadsheetId,
      sheetName: SHEET.PRICING,
      range: 'B18',
      accessToken: context.accessToken,
      valueRenderOption: 'FORMATTED_VALUE',
    }),
    getSheetValues({
      spreadsheetId: context.spreadsheetId,
      sheetName: SHEET.KPI_REVERSE,
      range: 'C7',
      accessToken: context.accessToken,
      valueRenderOption: 'FORMATTED_VALUE',
    }),
  ]);

  return {
    case: label,
    pricingWarning: cell(pricing.values ?? [], 1, 1),
    reverseWarning: cell(reverse.values ?? [], 1, 1),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const context = await getAuthorizedContext({
    ...args,
    'spreadsheet-id': args['spreadsheet-id'] || LIVE_SPREADSHEET_ID,
  });

  const now = new Date();
  const today = todayString(now);
  const backupTitle = `平山接骨院 慢性疼痛強化プロジェクト 管理表 backup ${timestampForTitle(now)}`;

  const metadataBefore = await getSpreadsheetMetadata(context);
  const liveSheetMap = getSheetMap(metadataBefore);

  const preservedRanges = await batchGetSheetValues({
    spreadsheetId: context.spreadsheetId,
    ranges: [
      `${SHEET.DASHBOARD}!B3:B4`,
      `${SHEET.INSURANCE}!B6:B18`,
      `${SHEET.NUMERIC}!B6:B31`,
    ],
    accessToken: context.accessToken,
    valueRenderOption: 'UNFORMATTED_VALUE',
  }).catch(() => ({ valueRanges: [] }));

  const dashboardValues = preservedRanges.valueRanges?.find((item) => item.range.startsWith(`${SHEET.DASHBOARD}!`))?.values ?? [];
  const insuranceValues = preservedRanges.valueRanges?.find((item) => item.range.startsWith(`${SHEET.INSURANCE}!`))?.values ?? [];
  const numericValues = preservedRanges.valueRanges?.find((item) => item.range.startsWith(`${SHEET.NUMERIC}!`))?.values ?? [];

  const preserved = {
    dashboardUpdatedAt: cell(dashboardValues, 1, 1) || today,
    dashboardMemo: cell(dashboardValues, 2, 1) || '',
    insurancePatients: asNumber(cell(insuranceValues, 1, 1), 50),
    insuranceVisits: asNumber(cell(insuranceValues, 2, 1), 125),
    newPatients: asNumber(cell(insuranceValues, 4, 1), ''),
    chronicCandidateRate: asPercentInput(cell(insuranceValues, 5, 1), '40%'),
    windowUnitPrice: asNumber(cell(insuranceValues, 10, 1), ''),
    totalInsuranceUnitPrice: asNumber(cell(insuranceValues, 11, 1), ''),
    currentMonthlyInsuranceRevenue: asNumber(cell(numericValues, 16, 1), ''),
    businessDays: asNumber(cell(numericValues, 20, 1), 25),
    fixedRent: asNumber(cell(numericValues, 1, 1), ''),
    fixedUtilities: asNumber(cell(numericValues, 2, 1), ''),
    fixedComms: asNumber(cell(numericValues, 3, 1), ''),
    fixedSystems: asNumber(cell(numericValues, 4, 1), ''),
    fixedAds: asNumber(cell(numericValues, 5, 1), ''),
    fixedSupplies: asNumber(cell(numericValues, 6, 1), ''),
    fixedOutsource: asNumber(cell(numericValues, 7, 1), ''),
    fixedOwnerLabor: asNumber(cell(numericValues, 8, 1), ''),
    fixedLease: asNumber(cell(numericValues, 9, 1), ''),
    fixedStaffLabor: asNumber(cell(numericValues, 10, 1), ''),
  };

  const backupSpreadsheet = await createSpreadsheet({
    title: backupTitle,
    accessToken: context.accessToken,
  });

  const defaultBackupSheetId = backupSpreadsheet.sheets?.[0]?.properties?.sheetId;
  for (const sheetName of BACKUP_SHEETS) {
    const props = liveSheetMap.get(sheetName);
    if (!props) {
      continue;
    }
    await copySheetToSpreadsheet({
      sourceSpreadsheetId: context.spreadsheetId,
      sourceSheetId: props.sheetId,
      destinationSpreadsheetId: backupSpreadsheet.spreadsheetId,
      accessToken: context.accessToken,
    });
  }
  if (defaultBackupSheetId !== undefined) {
    await batchUpdateSpreadsheet({
      spreadsheetId: backupSpreadsheet.spreadsheetId,
      accessToken: context.accessToken,
      requests: [{ deleteSheet: { sheetId: defaultBackupSheetId } }],
    }).catch(() => {});
  }

  const rebuildRequests = [];
  for (const sheetName of SUPPORT_SHEETS) {
    if (liveSheetMap.has(sheetName)) {
      continue;
    }
    rebuildRequests.push({
      addSheet: {
        properties: {
          title: sheetName,
        },
      },
    });
  }
  for (const sheetName of TARGET_REBUILD_SHEETS) {
    const props = liveSheetMap.get(sheetName);
    if (props) {
      rebuildRequests.push({ deleteSheet: { sheetId: props.sheetId } });
    }
    rebuildRequests.push({
      addSheet: {
        properties: {
          title: sheetName,
        },
      },
    });
  }
  await batchUpdateSpreadsheet({
    spreadsheetId: context.spreadsheetId,
    accessToken: context.accessToken,
    requests: rebuildRequests,
  });

  await applyRange(context, SHEET.DASHBOARD, 'A1:C4', buildDashboardHeaderValues(preserved));
  if (!liveSheetMap.has(SHEET.ROADMAP)) {
    await applyRange(context, SHEET.ROADMAP, 'A1:F7', buildRoadmapPlaceholderValues());
  }
  if (!liveSheetMap.has(SHEET.OPEN_ITEMS)) {
    await applyRange(context, SHEET.OPEN_ITEMS, 'A1:J12', buildOpenItemsPlaceholderValues());
  }
  await applyRange(context, SHEET.INSURANCE, 'A1:D18', buildInsuranceValues(preserved));
  await applyRange(context, SHEET.NUMERIC, 'A1:D31', buildNumericValues(preserved));
  await applyRange(context, SHEET.PRICING, 'A1:N18', buildPricingValues());
  await applyRange(context, SHEET.KPI_REVERSE, 'A1:G44', buildKPIReverseValues(preserved));
  await applyRange(context, SHEET.KPI, 'A1:G13', buildKPIValues());
  await applyRange(context, SHEET.KPI_HISTORY, 'A1:S4', buildKPIHistoryValues());
  await applyRange(context, SHEET.KPI_REVERSE_HISTORY, 'A1:N5', buildKPIReverseHistoryValues(preserved, today));

  const dashboardRows = buildDashboardSummaryRows();
  await applyRange(context, SHEET.DASHBOARD, 'A6:C19', dashboardRows);

  const metadataAfterAdd = await getSpreadsheetMetadata(context);
  const afterMap = getSheetMap(metadataAfterAdd);

  const formatRequests = [];
  const widthConfig = new Map([
    [SHEET.DASHBOARD, [200, 300, 220]],
    [SHEET.INSURANCE, [220, 130, 90, 220]],
    [SHEET.NUMERIC, [220, 130, 90, 210]],
    [SHEET.PRICING, [40, 160, 90, 160, 200, 75, 90, 105, 65, 70, 110, 75, 85, 200]],
    [SHEET.KPI_REVERSE, [90, 220, 120, 90, 130, 180, 240]],
    [SHEET.KPI, [220, 90, 120, 120, 120, 100, 220]],
    [SHEET.KPI_HISTORY, [110, 120, 120, 140, 140, 120, 120, 130, 130, 100, 100, 110, 110, 120, 120, 120, 120, 220, 110]],
    [SHEET.KPI_REVERSE_HISTORY, [110, 120, 220, 120, 120, 110, 130, 140, 110, 120, 170, 130, 120, 220]],
  ]);
  const freezeConfig = new Map([
    [SHEET.INSURANCE, 5],
    [SHEET.NUMERIC, 5],
    [SHEET.PRICING, 3],
    [SHEET.KPI_REVERSE, 2],
    [SHEET.KPI, 3],
    [SHEET.KPI_HISTORY, 4],
    [SHEET.KPI_REVERSE_HISTORY, 4],
  ]);

  for (const [sheetName, widths] of widthConfig.entries()) {
    const props = afterMap.get(sheetName);
    if (!props) continue;
    formatRequests.push(...buildColumnWidthRequests(props.sheetId, widths));
  }
  for (const [sheetName, frozenRows] of freezeConfig.entries()) {
    const props = afterMap.get(sheetName);
    if (!props) continue;
    formatRequests.push(buildFreezeRequest(props.sheetId, frozenRows));
  }

  for (const [index, sheetName] of SHEET_ORDER.entries()) {
    const props = afterMap.get(sheetName);
    if (!props) continue;
    formatRequests.push({
      updateSheetProperties: {
        properties: { sheetId: props.sheetId, index },
        fields: 'index',
      },
    });
  }

  if (formatRequests.length > 0) {
    await batchUpdateSpreadsheet({
      spreadsheetId: context.spreadsheetId,
      accessToken: context.accessToken,
      requests: formatRequests,
    });
  }

  await sleep(2500);

  const warningChecks = [];
  warningChecks.push(await verifyWarningState(context, Array.from({ length: 12 }, (_, index) => index === 8), 'single_true'));
  warningChecks.push(await verifyWarningState(context, Array.from({ length: 12 }, () => false), 'zero_true'));
  warningChecks.push(await verifyWarningState(context, Array.from({ length: 12 }, (_, index) => index === 0 || index === 8), 'multi_true'));
  await verifyWarningState(context, Array.from({ length: 12 }, (_, index) => index === 8), 'restore_single_true');

  await sleep(2000);

  const verifyRanges = await batchGetSheetValues({
    spreadsheetId: context.spreadsheetId,
    ranges: [
      `${SHEET.PRICING}!A1:N18`,
      `${SHEET.KPI_REVERSE}!A1:G44`,
      `${SHEET.KPI}!A1:G13`,
      `${SHEET.DASHBOARD}!A6:C19`,
    ],
    accessToken: context.accessToken,
    valueRenderOption: 'FORMATTED_VALUE',
  });

  const finalMetadata = await getSpreadsheetMetadata(context);
  const finalSheetNames = (finalMetadata.sheets ?? []).map((sheet) => sheet.properties?.title).filter(Boolean);

  console.log(JSON.stringify({
    liveSpreadsheetId: context.spreadsheetId,
    backupSpreadsheetId: backupSpreadsheet.spreadsheetId,
    finalSheetNames,
    warningChecks,
    verifyRanges: verifyRanges.valueRanges ?? [],
  }, null, 2));
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
