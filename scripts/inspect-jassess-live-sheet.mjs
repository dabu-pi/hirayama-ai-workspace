#!/usr/bin/env node

import {
  batchGetSheetValues,
  getAuthorizedContext,
  getSpreadsheetMetadata,
  parseArgs,
} from './lib-sheets.mjs';

const DEFAULT_SPREADSHEET_ID = '1sj6dYtkFbnk4fjLOk764f-w7KUUeGNVYcbMDOg26OXY';
const DEFAULT_SHEET_NAME = '\u8170\u75db\u8a55\u4fa1\u5165\u529b';
const DEFAULT_SERVICE_ACCOUNT = 'C:/hirayama-ai-workspace/workspace/secrets/service_account.json';

const RANGE_DEFS = {
  topInputs: `${DEFAULT_SHEET_NAME}!B3:C13`,
  flagScore: `${DEFAULT_SHEET_NAME}!B24:C24`,
  nerve: `${DEFAULT_SHEET_NAME}!B33:C33`,
  nrs: `${DEFAULT_SHEET_NAME}!B39:C39`,
  rmdq: `${DEFAULT_SHEET_NAME}!B52:C53`,
  start: `${DEFAULT_SHEET_NAME}!B65:C66`,
  motion: `${DEFAULT_SHEET_NAME}!B81:C81`,
  fall: `${DEFAULT_SHEET_NAME}!B88:C88`,
  outputs: `${DEFAULT_SHEET_NAME}!B95:C106`,
};

function getArgOrDefault(args, key, fallback) {
  return args[key] || fallback;
}

function indexByRange(valueRanges = []) {
  return new Map((valueRanges || []).map((item) => [item.range, item.values || []]));
}

function rowsToMap(rows = []) {
  const out = new Map();
  for (const row of rows) {
    if (!row || row.length === 0) {
      continue;
    }
    const [label, value = ''] = row;
    if (!label) {
      continue;
    }
    out.set(label, value);
  }
  return out;
}

function normalizeCellValue(value) {
  if (value === undefined || value === null || value === '') {
    return '(blank)';
  }
  return value;
}

function buildCurrentState(rangeMap) {
  const topInputs = rowsToMap(rangeMap.get(RANGE_DEFS.topInputs));
  const flagScore = rowsToMap(rangeMap.get(RANGE_DEFS.flagScore));
  const nerve = rowsToMap(rangeMap.get(RANGE_DEFS.nerve));
  const nrs = rowsToMap(rangeMap.get(RANGE_DEFS.nrs));
  const rmdq = rowsToMap(rangeMap.get(RANGE_DEFS.rmdq));
  const start = rowsToMap(rangeMap.get(RANGE_DEFS.start));
  const motion = rowsToMap(rangeMap.get(RANGE_DEFS.motion));
  const fall = rowsToMap(rangeMap.get(RANGE_DEFS.fall));
  const outputs = rowsToMap(rangeMap.get(RANGE_DEFS.outputs));

  return {
    inputSnapshot: {
      evalDate: normalizeCellValue(topInputs.get('\u8a55\u4fa1\u65e5')),
      patientId: normalizeCellValue(topInputs.get('\u60a3\u8005ID')),
      onset: normalizeCellValue(topInputs.get('\u767a\u75c7\u304b\u3089\u306e\u671f\u9593')),
      history: normalizeCellValue(topInputs.get('\u65e2\u5f80\u6b74\uff08\u8170\u90e8\uff09')),
      redFlagScore: normalizeCellValue(flagScore.get('\u8d64\u65d7\u30b9\u30b3\u30a2\uff08\u81ea\u52d5\uff09')),
      nerveLevel: normalizeCellValue(nerve.get('\u795e\u7d4c\u75c7\u72b6\u30ec\u30d9\u30eb\uff08\u81ea\u52d5\uff09')),
      nrsLevel: normalizeCellValue(nrs.get('NRS\u5224\u5b9a\uff08\u81ea\u52d5\uff09')),
      rmdqScore: normalizeCellValue(rmdq.get('RMDQ-10 \u5408\u8a08\u30b9\u30b3\u30a2\uff08\u81ea\u52d5\uff09')),
      rmdqLevel: normalizeCellValue(rmdq.get('RMDQ\u5224\u5b9a\uff08\u81ea\u52d5\uff09')),
      startScore: normalizeCellValue(start.get('STarT\u5408\u8a08\u30b9\u30b3\u30a2\uff08\u81ea\u52d5\uff09')),
      startLevel: normalizeCellValue(start.get('STarT\u5224\u5b9a\uff08\u81ea\u52d5\uff09')),
      motionSummary: normalizeCellValue(motion.get('\u52d5\u4f5c\u8a55\u4fa1\u307e\u3068\u3081\uff08\u81ea\u52d5\uff09')),
      fallRisk: normalizeCellValue(fall.get('\u8ee2\u5012\u30ea\u30b9\u30af\uff08\u81ea\u52d5\uff09')),
    },
    outputSnapshot: {
      policy: normalizeCellValue(outputs.get('\u30eb\u30fc\u30eb\u30d9\u30fc\u30b9\u5224\u5b9a\u7d50\u679c\uff08\u81ea\u52d5\uff09')),
      aiPlaceholder: normalizeCellValue(outputs.get('AI\u5224\u5b9a\u6b04\uff08\u5c06\u6765\u7528\uff09')),
      comments: {
        summary: normalizeCellValue(outputs.get('\u8a55\u4fa1\u307e\u3068\u3081')),
        caution: normalizeCellValue(outputs.get('\u6ce8\u610f\u3059\u3079\u304d\u6240\u898b')),
        explain: normalizeCellValue(outputs.get('\u521d\u56de\u8aac\u660e\u306e\u65b9\u5411\u6027')),
        priority: normalizeCellValue(outputs.get('\u65bd\u8853\u306e\u512a\u5148\u9806\u4f4d')),
        selfcare: normalizeCellValue(outputs.get('\u30bb\u30eb\u30d5\u30b1\u30a2\u30fb\u904b\u52d5\u7642\u6cd5\u306e\u65b9\u5411\u6027')),
        reassess: normalizeCellValue(outputs.get('\u518d\u8a55\u4fa1\u6642\u306b\u898b\u308b\u3079\u304d\u30dd\u30a4\u30f3\u30c8')),
        patient: normalizeCellValue(outputs.get('\u60a3\u8005\u3055\u3093\u3078\u306e\u8aac\u660e\u6587\uff08\u8981\u7d04\uff09')),
        referral: normalizeCellValue(outputs.get('\u533b\u7642\u9023\u643a\u3092\u8003\u3048\u308b\u3079\u304d\u6761\u4ef6')),
      },
    },
  };
}

function buildOnEditSummary(state) {
  const notes = [];
  if (state.outputSnapshot.policy === '(blank)') {
    notes.push('Policy output is blank; onEdit or manual logic execution may not have completed.');
  } else {
    notes.push(`C95 is populated: ${state.outputSnapshot.policy}`);
  }

  const summary = state.outputSnapshot.comments.summary;
  if (summary === '(blank)') {
    notes.push('C99 is blank; comment generation may not have run.');
  } else {
    notes.push('C99 is populated.');
    if (summary.includes('\u3010\u30b9\u30b3\u30a2\u3011\uff08\u30b9\u30b3\u30a2\u672a\u5165\u529b\uff09')) {
      notes.push('Score section is in the expected "score not entered" state.');
    }
  }

  return notes;
}

function printTextReport(report) {
  console.log(`[INFO] Spreadsheet: ${report.spreadsheetTitle}`);
  console.log(`[INFO] Spreadsheet ID: ${report.spreadsheetId}`);
  console.log(`[INFO] Service acct: ${report.serviceAccountFile}`);
  console.log(`[INFO] Target sheet: ${report.sheetName}`);
  console.log('');

  console.log('**Current Values**');
  for (const [key, value] of Object.entries(report.state.inputSnapshot)) {
    console.log(`- ${key}: ${value}`);
  }
  console.log('');

  console.log('**Rule Output**');
  console.log(`- C95: ${report.state.outputSnapshot.policy}`);
  console.log(`- C96: ${report.state.outputSnapshot.aiPlaceholder}`);
  console.log('');

  console.log('**Comments (C99:C106)**');
  for (const [key, value] of Object.entries(report.state.outputSnapshot.comments)) {
    console.log(`- ${key}:`);
    console.log(value);
  }
  console.log('');

  console.log('**onEdit Summary**');
  for (const line of report.onEditSummary) {
    console.log(`- ${line}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const spreadsheetId = getArgOrDefault(args, 'spreadsheet-id', DEFAULT_SPREADSHEET_ID);
  const sheetName = getArgOrDefault(args, 'sheet-name', DEFAULT_SHEET_NAME);
  const serviceAccount = getArgOrDefault(args, 'service-account', DEFAULT_SERVICE_ACCOUNT);
  const jsonMode = args.json === 'true';

  const context = await getAuthorizedContext({
    'spreadsheet-id': spreadsheetId,
    'service-account': serviceAccount,
  });

  const metadata = await getSpreadsheetMetadata({
    spreadsheetId,
    accessToken: context.accessToken,
    fields: 'properties.title,sheets(properties(sheetId,title,index))',
  });

  const sheetTitles = (metadata.sheets ?? []).map((sheet) => sheet.properties?.title).filter(Boolean);
  if (!sheetTitles.includes(sheetName)) {
    throw new Error(`Sheet not found: ${sheetName}`);
  }

  const ranges = Object.values(RANGE_DEFS).map((range) => range.replace(DEFAULT_SHEET_NAME, sheetName));
  const batch = await batchGetSheetValues({
    spreadsheetId,
    accessToken: context.accessToken,
    valueRenderOption: 'FORMATTED_VALUE',
    ranges,
  });

  const rangeMap = indexByRange(batch.valueRanges);
  const state = buildCurrentState(rangeMap);
  const report = {
    spreadsheetId,
    spreadsheetTitle: metadata.properties?.title || '(unknown)',
    sheetName,
    serviceAccountFile: context.serviceAccountFile,
    availableSheets: sheetTitles,
    state,
    onEditSummary: buildOnEditSummary(state),
  };

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  printTextReport(report);
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
