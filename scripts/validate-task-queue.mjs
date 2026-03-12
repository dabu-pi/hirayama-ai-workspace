#!/usr/bin/env node

import {
  getAuthorizedContext,
  getSheetValues,
  parseArgs,
} from './lib-sheets.mjs';

const SHEET_NAME = 'Task_Queue';
const DEFAULT_RANGE = '1:200';
const LIVE_HEADERS = [
  'Task',
  'Project',
  'Type',
  'Priority',
  'Status',
  'Assigned To',
  'Planned Date',
  'Done Date',
  'Dependency',
  'Score',
  'Notes',
];
const REQUIRED_FIELDS = [
  ['Task', 0],
  ['Project', 1],
  ['Type', 2],
  ['Priority', 3],
  ['Status', 4],
];

function printHelp() {
  console.log(`validate-task-queue.mjs

Usage:
  node scripts/validate-task-queue.mjs [--range 1:200]
  node scripts/validate-task-queue.mjs [--range 1:200] --warn-only

Notes:
  - Reads the live Task_Queue sheet and reports rows that have any content but are missing Task / Project / Type / Priority / Status.
  - Default behavior exits with code 1 when incomplete rows are found.
  - Pass --warn-only to keep the command informational during routine checks.
`);
}

function isLiveHeaderRow(row = []) {
  return LIVE_HEADERS.every((value, index) => row[index] === value);
}

function findHeaderRowIndex(rows = []) {
  return rows.findIndex((row) => isLiveHeaderRow(row));
}

function parseRangeStart(range) {
  const match = String(range || '').match(/^(\d+)/);
  return match ? Number(match[1]) : 1;
}

function hasAnyValue(row = []) {
  return row.some((cell) => String(cell || '').trim() !== '');
}

function findMissingRequiredFields(row = []) {
  return REQUIRED_FIELDS
    .filter(([, index]) => String(row[index] || '').trim() === '')
    .map(([label]) => label);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === 'true') {
    printHelp();
    return;
  }

  const context = await getAuthorizedContext(args);
  const range = args.range || DEFAULT_RANGE;
  const warnOnly = args['warn-only'] === 'true';
  const response = await getSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: SHEET_NAME,
    range,
    accessToken: context.accessToken,
  });

  const rows = response.values ?? [];
  if (rows.length === 0) {
    console.log(`[WARN] ${SHEET_NAME}!${range} returned no rows.`);
    return;
  }

  const headerIndex = findHeaderRowIndex(rows);
  if (headerIndex < 0) {
    throw new Error(`Task_Queue header row was not found inside ${SHEET_NAME}!${range}`);
  }

  const rangeStart = parseRangeStart(range);
  const findings = rows
    .slice(headerIndex + 1)
    .map((row, index) => {
      const rowNumber = rangeStart + headerIndex + index + 1;
      const missing = hasAnyValue(row) ? findMissingRequiredFields(row) : [];
      return {
        rowNumber,
        row,
        missing,
      };
    })
    .filter((entry) => entry.missing.length > 0);

  console.log(`[INFO] Sheet        : ${SHEET_NAME}`);
  console.log(`[INFO] Scan range   : ${SHEET_NAME}!${range}`);
  console.log(`[INFO] Findings     : ${findings.length}`);

  if (findings.length === 0) {
    console.log('[OK] No incomplete Task_Queue rows detected.');
    return;
  }

  findings.forEach((entry) => {
    const endColumn = String.fromCharCode('A'.charCodeAt(0) + LIVE_HEADERS.length - 1);
    console.log(`[WARN] ${SHEET_NAME}!A${entry.rowNumber}:${endColumn}${entry.rowNumber} is incomplete.`);
    console.log(`[WARN] Missing      : ${entry.missing.join(', ')}`);
    console.log(`[WARN] Row payload  : ${JSON.stringify(entry.row)}`);
  });

  if (!warnOnly) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
