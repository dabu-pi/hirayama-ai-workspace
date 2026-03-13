#!/usr/bin/env node

import {
  getAuthorizedContext,
  getSheetValues,
  parseArgs,
  updateSheetValues,
} from './lib-sheets.mjs';

const RUN_LOG_HEADERS = [
  'log_id',
  'datetime',
  'system',
  'project',
  'summary',
  'result',
  'commit_hash',
  'tasks_done',
  'stop_reason',
  'next_action',
];

const PROJECT_MAP = new Map([
  ['freee見積自動化', 'FREEE-02'],
  ['柔整毎日記録システム', 'JREC-01'],
  ['患者管理Webアプリ', 'WEB-03'],
  ['接骨院経営戦略AI', 'JBIZ-04'],
  ['AIOS-06', 'AIOS-06'],
  ['COMMON', 'COMMON'],
]);

const RESULT_MAP = new Map([
  ['OK', 'SUCCESS'],
  ['SUCCESS', 'SUCCESS'],
  ['PENDING', 'PARTIAL'],
  ['WARN', 'PARTIAL'],
  ['ERROR', 'ERROR'],
  ['STOP', 'STOP'],
  ['PARTIAL', 'PARTIAL'],
]);

function normalizeResult(value, errorCount) {
  const mapped = RESULT_MAP.get(String(value || '').toUpperCase());
  if (mapped) {
    if (mapped === 'SUCCESS' && Number(errorCount || 0) > 0) {
      return 'PARTIAL';
    }
    return mapped;
  }
  if (Number(errorCount || 0) > 0) {
    return 'PARTIAL';
  }
  return 'PARTIAL';
}

function normalizeProject(value) {
  return PROJECT_MAP.get(value) || value || 'COMMON';
}

function normalizeLegacyDatetime(value) {
  if (!value) {
    return '';
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return `${value} 00:00:00`;
  }
  return value;
}

function legacyLogId(rowIndex, datetimeValue) {
  const stamp = String(datetimeValue || 'legacy').replace(/[^0-9]/g, '').slice(0, 8) || 'legacy';
  return `LEGACY-${stamp}-${String(rowIndex).padStart(3, '0')}`;
}

function toCanonicalRow(row, rowIndex) {
  if ((row?.length ?? 0) >= 10 && String(row[0] || '').startsWith('LOG-')) {
    return row.slice(0, 10);
  }

  if ((row?.length ?? 0) >= 8) {
    const [date, project, system, action, result, errorCount, reference, notes] = row;
    const normalizedDatetime = normalizeLegacyDatetime(String(date || ''));
    const normalizedResult = normalizeResult(result, errorCount);
    const stopReason = Number(errorCount || 0) > 0 ? `legacy error count=${errorCount}` : '';
    return [
      legacyLogId(rowIndex, normalizedDatetime),
      normalizedDatetime,
      system || 'Legacy',
      normalizeProject(project),
      action || '',
      normalizedResult,
      reference || '',
      '',
      stopReason,
      notes || '',
    ];
  }

  return [
    legacyLogId(rowIndex, ''),
    '',
    'Legacy',
    'COMMON',
    row.join(' / '),
    'PARTIAL',
    '',
    '',
    'legacy row had unexpected shape',
    '',
  ];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const context = await getAuthorizedContext(args);
  const isWrite = args.write === 'true';
  const data = await getSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: context.sheetName,
    range: '1:200',
    accessToken: context.accessToken,
  });

  const rows = data.values ?? [];
  const titleRow = rows[0] ?? ['Hirayama AI OS — Run Log'];
  const descriptionRow = rows[1] ?? ['Append run/test events here to retain execution history.'];
  const bodyRows = rows.slice(3).filter((row) => row.some((cell) => String(cell || '').trim() !== ''));
  const migratedRows = bodyRows.map((row, index) => toCanonicalRow(row, index + 1));
  const output = [titleRow, descriptionRow, RUN_LOG_HEADERS, ...migratedRows];

  console.log(`[INFO] Existing data rows: ${bodyRows.length}`);
  console.log(`[INFO] Migrated rows     : ${migratedRows.length}`);
  console.log(`[INFO] Header row       : ${JSON.stringify(RUN_LOG_HEADERS)}`);
  if (migratedRows.length > 0) {
    console.log(`[INFO] Sample row 1     : ${JSON.stringify(migratedRows[0])}`);
  }
  const lastRow = output.length;

  if (!isWrite) {
    console.log(`[INFO] Dry run mode. Pass --write to update Run_Log!A1:J${lastRow}.`);
    return;
  }

  const result = await updateSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: context.sheetName,
    range: `A1:J${lastRow}`,
    values: output,
    accessToken: context.accessToken,
  });

  console.log(`[OK] Migrated Run_Log to canonical schema: ${result.updatedRange ?? `Run_Log!A1:J${lastRow}`}`);
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
