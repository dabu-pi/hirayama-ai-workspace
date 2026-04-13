#!/usr/bin/env node

import {
  batchGetSheetValues,
  getAuthorizedContext,
  getSpreadsheetMetadata,
  parseArgs,
} from './lib-sheets.mjs';

const DEFAULT_SPREADSHEET_ID = '1sj6dYtkFbnk4fjLOk764f-w7KUUeGNVYcbMDOg26OXY';
const DEFAULT_SPREADSHEET_TITLE = '平山接骨院_運動器初期評価システム_JASSESS-01';
const DEFAULT_SHEET_NAME = '\u8170\u75db\u8a55\u4fa1\u5165\u529b';
const DEFAULT_SERVICE_ACCOUNT = 'C:/hirayama-ai-workspace/workspace/secrets/service_account.json';

function buildRange(sheetName, a1) {
  return `${sheetName}!${a1}`;
}

function normalizeRangeKey(value) {
  return String(value || '').replace(/^'(.+)'!/, '$1!');
}

function rowsToObject(rows = []) {
  const items = [];
  for (const row of rows) {
    if (!row || row.length === 0) {
      continue;
    }
    const [label = '', value = ''] = row;
    items.push({ label, value });
  }
  return items;
}

function getValueRange(map, range) {
  return map.get(range)?.values ?? [];
}

function normalize(value) {
  if (value === undefined || value === null || value === '') {
    return '(blank)';
  }
  return value;
}

function printBlock(title, lines) {
  console.log(title);
  for (const line of lines) {
    console.log(line);
  }
  console.log('');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const spreadsheetId = args['spreadsheet-id'] || DEFAULT_SPREADSHEET_ID;
  const sheetName = args['sheet-name'] || DEFAULT_SHEET_NAME;
  const serviceAccountPath = args['service-account'] || DEFAULT_SERVICE_ACCOUNT;
  const jsonMode = args.json === 'true';

  const context = await getAuthorizedContext({
    'spreadsheet-id': spreadsheetId,
    'service-account': serviceAccountPath,
  });

  const metadata = await getSpreadsheetMetadata({
    spreadsheetId,
    accessToken: context.accessToken,
    fields: 'properties.title,sheets(properties(sheetId,title,index))',
  });

  const availableSheets = (metadata.sheets ?? []).map((sheet) => sheet.properties?.title).filter(Boolean);
  if (!availableSheets.includes(sheetName)) {
    throw new Error(`Sheet not found: ${sheetName}`);
  }

  const ranges = [
    buildRange(sheetName, 'B3:C4'),
    buildRange(sheetName, 'B11:C93'),
    buildRange(sheetName, 'B95:C106'),
  ];

  const batch = await batchGetSheetValues({
    spreadsheetId,
    accessToken: context.accessToken,
    ranges,
    valueRenderOption: 'FORMATTED_VALUE',
  });

  const rangeMap = new Map((batch.valueRanges ?? []).map((item) => [normalizeRangeKey(item.range), item]));

  const headerRows = rowsToObject(getValueRange(rangeMap, buildRange(sheetName, 'B3:C4')));
  const bodyRows = rowsToObject(getValueRange(rangeMap, buildRange(sheetName, 'B11:C93')));
  const outputRows = rowsToObject(getValueRange(rangeMap, buildRange(sheetName, 'B95:C106')));

  const outputs = {};
  for (const row of outputRows) {
    outputs[row.label || '(blank)'] = normalize(row.value);
  }

  const report = {
    spreadsheetId,
    spreadsheetTitle: metadata.properties?.title || DEFAULT_SPREADSHEET_TITLE,
    sheetName,
    serviceAccountFile: context.serviceAccountFile,
    availableSheets,
    inputs: {
      headerRows,
      bodyRows,
    },
    outputs: {
      c95: outputs['ルールベース判定結果（自動）'] || '(blank)',
      c96: outputs['AI判定欄（将来用）'] || '(blank)',
      c99: outputs['評価まとめ'] || '(blank)',
      c100: outputs['注意すべき所見'] || '(blank)',
      c101: outputs['初回説明の方向性'] || '(blank)',
      c102: outputs['施術の優先順位'] || '(blank)',
      c103: outputs['セルフケア・運動療法の方向性'] || '(blank)',
      c104: outputs['再評価時に見るべきポイント'] || '(blank)',
      c105: outputs['患者さんへの説明文（要約）'] || '(blank)',
      c106: outputs['医療連携を考えるべき条件'] || '(blank)',
    },
  };

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  printBlock('**Live Sheet**', [
    `- Spreadsheet: ${report.spreadsheetTitle}`,
    `- Spreadsheet ID: ${report.spreadsheetId}`,
    `- Sheet: ${report.sheetName}`,
    `- Service account: ${report.serviceAccountFile}`,
  ]);

  printBlock('**Core Inputs**', [
    ...report.inputs.headerRows.map((row) => `- ${row.label}: ${normalize(row.value)}`),
  ]);

  printBlock('**Rule Output**', [
    `- C95: ${report.outputs.c95}`,
    `- C96: ${report.outputs.c96}`,
  ]);

  printBlock('**Comments (C99:C106)**', [
    `- C99: ${report.outputs.c99}`,
    `- C100: ${report.outputs.c100}`,
    `- C101: ${report.outputs.c101}`,
    `- C102: ${report.outputs.c102}`,
    `- C103: ${report.outputs.c103}`,
    `- C104: ${report.outputs.c104}`,
    `- C105: ${report.outputs.c105}`,
    `- C106: ${report.outputs.c106}`,
  ]);

  console.log(`- Additional input rows fetched: ${report.inputs.bodyRows.length}`);
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
