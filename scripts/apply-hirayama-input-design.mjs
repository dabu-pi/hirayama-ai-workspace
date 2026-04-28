#!/usr/bin/env node

import { batchUpdateSpreadsheet, getAuthorizedContext, getSpreadsheetMetadata } from './lib-sheets.mjs';

const SPREADSHEET_ID = '1FnJdALwFSv48WiD6NWr0DzG78kwB692R2pFeiTcZlCc';
const TAG = '[JBIZ-04 input-design]';

const SHEET = {
  DASHBOARD: '全体ダッシュボード',
  INSURANCE: '保険・来院前提',
  NUMERIC: '数値前提',
  PRICING: '価格設定',
  KPI_REVERSE: 'KPI逆算',
  KPI: 'KPI目標',
  KPI_HISTORY: 'KPI実績履歴',
  KPI_REVERSE_HISTORY: 'KPI逆算履歴',
  OPEN_ITEMS: '未確定項目',
};

const COLORS = {
  input: '#CFE2F3',
  calc: '#D9EAD3',
  fixed: '#EFEFEF',
  temp: '#FFF2CC',
  warn: '#F4CCCC',
};

function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  return {
    red: parseInt(normalized.slice(0, 2), 16) / 255,
    green: parseInt(normalized.slice(2, 4), 16) / 255,
    blue: parseInt(normalized.slice(4, 6), 16) / 255,
  };
}

function range(sheetId, startRow, endRow, startCol, endCol) {
  return { sheetId, startRowIndex: startRow, endRowIndex: endRow, startColumnIndex: startCol, endColumnIndex: endCol };
}

function bgRequest(sheetId, startRow, endRow, startCol, endCol, colorKey) {
  return {
    repeatCell: {
      range: range(sheetId, startRow, endRow, startCol, endCol),
      cell: {
        userEnteredFormat: {
          backgroundColor: hexToRgb(COLORS[colorKey]),
        },
      },
      fields: 'userEnteredFormat.backgroundColor',
    },
  };
}

function noteRequest(sheetId, row, col, text) {
  return {
    repeatCell: {
      range: range(sheetId, row, row + 1, col, col + 1),
      cell: { note: text },
      fields: 'note',
    },
  };
}

function protectRequest(sheetId, startRow, endRow, startCol, endCol, description) {
  return {
    addProtectedRange: {
      protectedRange: {
        range: range(sheetId, startRow, endRow, startCol, endCol),
        description: `${TAG} ${description}`,
        warningOnly: true,
      },
    },
  };
}

function sheetMapFromMetadata(metadata) {
  const map = new Map();
  for (const sheet of metadata.sheets ?? []) {
    const props = sheet.properties ?? {};
    map.set(props.title, {
      sheetId: props.sheetId,
      protectedRanges: sheet.protectedRanges ?? [],
    });
  }
  return map;
}

function buildRequests(sheetMap) {
  const requests = [];

  for (const [title, info] of sheetMap.entries()) {
    for (const protectedRange of info.protectedRanges ?? []) {
      if ((protectedRange.description || '').startsWith(TAG)) {
        requests.push({ deleteProtectedRange: { protectedRangeId: protectedRange.protectedRangeId } });
      }
    }
  }

  const dashboard = sheetMap.get(SHEET.DASHBOARD).sheetId;
  requests.push(
    bgRequest(dashboard, 2, 4, 1, 2, 'input'),
    bgRequest(dashboard, 6, 19, 1, 2, 'calc'),
    bgRequest(dashboard, 6, 19, 0, 1, 'fixed'),
    bgRequest(dashboard, 6, 19, 2, 3, 'fixed'),
    protectRequest(dashboard, 6, 19, 1, 2, 'dashboard formulas')
  );

  const insurance = sheetMap.get(SHEET.INSURANCE).sheetId;
  requests.push(
    bgRequest(insurance, 5, 18, 0, 1, 'fixed'),
    bgRequest(insurance, 5, 18, 2, 4, 'fixed'),
    bgRequest(insurance, 5, 11, 1, 2, 'input'),
    bgRequest(insurance, 7, 8, 1, 2, 'calc'),
    bgRequest(insurance, 10, 11, 1, 2, 'calc'),
    bgRequest(insurance, 14, 16, 1, 2, 'input'),
    bgRequest(insurance, 16, 18, 1, 2, 'calc'),
    bgRequest(insurance, 9, 10, 1, 2, 'temp'),
    noteRequest(insurance, 9, 1, '慢性腰痛・首肩こり候補の割合です。前提変更時に見直します。'),
    noteRequest(insurance, 15, 1, '窓口負担と保険者支払分を合算した1来院あたり単価を入力します。'),
    protectRequest(insurance, 7, 8, 1, 2, 'insurance formulas 1'),
    protectRequest(insurance, 10, 11, 1, 2, 'insurance formulas 2'),
    protectRequest(insurance, 16, 18, 1, 2, 'insurance formulas 3')
  );

  const numeric = sheetMap.get(SHEET.NUMERIC).sheetId;
  requests.push(
    bgRequest(numeric, 5, 31, 0, 1, 'fixed'),
    bgRequest(numeric, 5, 31, 2, 4, 'fixed'),
    bgRequest(numeric, 5, 15, 1, 2, 'input'),
    bgRequest(numeric, 14, 15, 1, 2, 'input'),
    bgRequest(numeric, 15, 17, 1, 2, 'calc'),
    bgRequest(numeric, 20, 25, 1, 2, 'calc'),
    bgRequest(numeric, 26, 31, 1, 2, 'calc'),
    noteRequest(numeric, 24, 1, '営業日数を入力します。日次必要回数の基準になります。'),
    protectRequest(numeric, 15, 17, 1, 2, 'numeric formulas 1'),
    protectRequest(numeric, 20, 25, 1, 2, 'numeric formulas 2'),
    protectRequest(numeric, 26, 31, 1, 2, 'numeric formulas 3')
  );

  const pricing = sheetMap.get(SHEET.PRICING).sheetId;
  requests.push(
    bgRequest(pricing, 3, 15, 6, 8, 'input'),
    bgRequest(pricing, 3, 15, 10, 12, 'input'),
    bgRequest(pricing, 3, 15, 12, 14, 'input'),
    bgRequest(pricing, 3, 15, 0, 6, 'fixed'),
    bgRequest(pricing, 3, 15, 8, 10, 'fixed'),
    bgRequest(pricing, 16, 18, 0, 14, 'calc'),
    bgRequest(pricing, 3, 15, 12, 13, 'temp'),
    noteRequest(pricing, 11, 6, '主力手技価格です。日常更新ではこの価格を見直します。'),
    noteRequest(pricing, 11, 10, '主力手技は 1 行だけ TRUE にします。'),
    protectRequest(pricing, 16, 18, 0, 14, 'pricing summary formulas')
  );

  const kpiReverse = sheetMap.get(SHEET.KPI_REVERSE).sheetId;
  requests.push(
    bgRequest(kpiReverse, 3, 44, 0, 2, 'fixed'),
    bgRequest(kpiReverse, 3, 44, 3, 7, 'fixed'),
    bgRequest(kpiReverse, 3, 44, 2, 3, 'calc'),
    bgRequest(kpiReverse, 3, 4, 2, 3, 'input'),
    bgRequest(kpiReverse, 7, 8, 2, 3, 'input'),
    bgRequest(kpiReverse, 19, 20, 2, 3, 'temp'),
    bgRequest(kpiReverse, 21, 23, 2, 3, 'temp'),
    bgRequest(kpiReverse, 29, 30, 2, 3, 'temp'),
    bgRequest(kpiReverse, 31, 32, 2, 3, 'temp'),
    bgRequest(kpiReverse, 41, 42, 2, 3, 'temp'),
    noteRequest(kpiReverse, 4, 2, '価格設定シートの主力手技フラグ行から参照します。日常更新は価格設定側で行います。'),
    noteRequest(kpiReverse, 19, 2, '慢性候補から手技自費へ移行した割合を入力します。'),
    noteRequest(kpiReverse, 22, 2, '売上逆算に使う主指標です。再来率よりこちらを優先して更新します。'),
    noteRequest(kpiReverse, 29, 2, '手技患者からジム体験へ案内できた割合を入力します。'),
    protectRequest(kpiReverse, 4, 7, 2, 3, 'kpi reverse formulas 1'),
    protectRequest(kpiReverse, 8, 18, 2, 3, 'kpi reverse formulas 2'),
    protectRequest(kpiReverse, 20, 21, 2, 3, 'kpi reverse formulas 3'),
    protectRequest(kpiReverse, 23, 28, 2, 3, 'kpi reverse formulas 4'),
    protectRequest(kpiReverse, 30, 31, 2, 3, 'kpi reverse formulas 5'),
    protectRequest(kpiReverse, 32, 40, 2, 3, 'kpi reverse formulas 6'),
    protectRequest(kpiReverse, 42, 44, 2, 3, 'kpi reverse formulas 7')
  );

  const kpi = sheetMap.get(SHEET.KPI).sheetId;
  requests.push(
    bgRequest(kpi, 3, 11, 0, 2, 'fixed'),
    bgRequest(kpi, 3, 11, 2, 3, 'calc'),
    bgRequest(kpi, 3, 11, 3, 4, 'input'),
    bgRequest(kpi, 3, 11, 4, 6, 'calc'),
    bgRequest(kpi, 3, 11, 6, 7, 'fixed'),
    bgRequest(kpi, 3, 4, 3, 4, 'calc'),
    bgRequest(kpi, 6, 7, 3, 4, 'calc'),
    bgRequest(kpi, 9, 10, 3, 4, 'calc'),
    noteRequest(kpi, 4, 3, '当月の総保険収入を入力します。窓口負担と保険者支払分の合計です。'),
    noteRequest(kpi, 5, 3, '当月の手技中心の自費売上を入力します。'),
    noteRequest(kpi, 7, 3, '当月の新患実人数を入力します。'),
    noteRequest(kpi, 8, 3, '当月の延べ来院数を入力します。'),
    noteRequest(kpi, 10, 3, '当面は手入力です。将来的に 自費売上 ÷ 自費件数 で自動化します。'),
    protectRequest(kpi, 3, 11, 2, 3, 'kpi target columns'),
    protectRequest(kpi, 3, 11, 4, 6, 'kpi calc columns')
  );

  const openItems = sheetMap.get(SHEET.OPEN_ITEMS).sheetId;
  requests.push(
    bgRequest(openItems, 3, 14, 0, 3, 'fixed'),
    bgRequest(openItems, 3, 14, 4, 5, 'fixed'),
    bgRequest(openItems, 3, 14, 8, 9, 'fixed'),
    bgRequest(openItems, 3, 14, 3, 4, 'input'),
    bgRequest(openItems, 3, 14, 5, 8, 'input'),
    bgRequest(openItems, 3, 14, 9, 10, 'input'),
    bgRequest(openItems, 13, 14, 0, 5, 'fixed'),
    bgRequest(openItems, 13, 14, 5, 6, 'calc'),
    protectRequest(openItems, 13, 14, 5, 6, 'open items summary')
  );

  const kpiHistory = sheetMap.get(SHEET.KPI_HISTORY).sheetId;
  requests.push(
    bgRequest(kpiHistory, 0, 4, 0, 19, 'fixed'),
    protectRequest(kpiHistory, 0, 4, 0, 19, 'kpi history fixed rows')
  );

  const kpiReverseHistory = sheetMap.get(SHEET.KPI_REVERSE_HISTORY).sheetId;
  requests.push(
    bgRequest(kpiReverseHistory, 0, 4, 0, 14, 'fixed'),
    protectRequest(kpiReverseHistory, 0, 4, 0, 14, 'kpi reverse history fixed rows')
  );

  return requests;
}

async function main() {
  const context = await getAuthorizedContext({ 'spreadsheet-id': SPREADSHEET_ID });
  const metadata = await getSpreadsheetMetadata({
    spreadsheetId: context.spreadsheetId,
    accessToken: context.accessToken,
    fields: 'sheets(properties(sheetId,title),protectedRanges(protectedRangeId,description))',
  });
  const sheetMap = sheetMapFromMetadata(metadata);
  const requests = buildRequests(sheetMap);

  await batchUpdateSpreadsheet({
    spreadsheetId: context.spreadsheetId,
    accessToken: context.accessToken,
    requests,
  });

  console.log(JSON.stringify({
    spreadsheetId: context.spreadsheetId,
    styledSheets: Array.from(sheetMap.keys()),
    requestCount: requests.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
