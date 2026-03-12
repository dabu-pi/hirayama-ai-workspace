#!/usr/bin/env node

import { getAuthorizedContext, getSheetValues, parseArgs } from './lib-sheets.mjs';
import {
  DEFAULT_RANGE,
  findHeaderRowIndex,
  findMissingRequiredFields,
  formatTaskQueueRowRange,
  hasAnyValue,
  parseRangeStart,
  SHEET_NAME,
} from './task-queue-validation-lib.mjs';

const PRIORITY_WEIGHT = new Map([
  ['高', 3],
  ['中', 2],
  ['低', 1],
  ['High', 3],
  ['Medium', 2],
  ['Low', 1],
]);

const PROJECT_ALIASES = new Map([
  ['FREEE-02', ['FREEE-02', 'freee見積自動化', 'freee-automation']],
  ['GAS-01', ['GAS-01', '柔整GASシステム', 'gas-projects/jyu-gas-ver3.1']],
  ['WEB-03', ['WEB-03', '患者管理Webアプリ', 'patient-management']],
  ['STR-04', ['STR-04', '接骨院戦略AI', 'hirayama-jyusei-strategy']],
  ['WST-05', ['WST-05', '廃棄物日報GAS', 'waste-report-system']],
  ['AIOS-06', ['AIOS-06', 'Hirayama AI OS', 'ai-os']],
]);

function printHelp() {
  console.log(`suggest-next-task.mjs

Usage:
  node scripts/suggest-next-task.mjs
  node scripts/suggest-next-task.mjs --project AIOS-06
  node scripts/suggest-next-task.mjs --range 1:200

Notes:
  - Read-only helper. It never writes to Task_Queue, Projects, Ideas, Run_Log, or Dashboard.
  - Eligible rows must have Task / Project / Type / Priority / Status and must not be 完了.
  - Ranking order: 進行中, priority, earlier planned date, higher score, older row.
`);
}

function normalizeProjectFilter(input = '') {
  const value = String(input || '').trim();
  if (!value) {
    return [];
  }
  return PROJECT_ALIASES.get(value) ?? [value];
}

function matchesProjectFilter(projectValue, aliases) {
  if (aliases.length === 0) {
    return true;
  }
  const current = String(projectValue || '').trim();
  return aliases.some((alias) => alias === current);
}

function parsePlannedDate(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return Number.POSITIVE_INFINITY;
  }
  const timestamp = Date.parse(raw);
  return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
}

function parseScore(value) {
  const parsed = Number.parseInt(String(value || '').trim(), 10);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function statusWeight(status) {
  return String(status || '').trim() === '進行中' ? 1 : 0;
}

function priorityWeight(priority) {
  return PRIORITY_WEIGHT.get(String(priority || '').trim()) ?? 0;
}

function buildEntry(rowNumber, row) {
  return {
    rowNumber,
    row,
    task: String(row[0] || '').trim(),
    project: String(row[1] || '').trim(),
    priority: String(row[3] || '').trim(),
    status: String(row[4] || '').trim(),
    plannedDate: String(row[6] || '').trim(),
    score: String(row[9] || '').trim(),
  };
}

function compareEntries(left, right) {
  const comparisons = [
    statusWeight(right.status) - statusWeight(left.status),
    priorityWeight(right.priority) - priorityWeight(left.priority),
    parsePlannedDate(left.plannedDate) - parsePlannedDate(right.plannedDate),
    parseScore(right.score) - parseScore(left.score),
    left.rowNumber - right.rowNumber,
  ];

  return comparisons.find((value) => value !== 0) ?? 0;
}

function buildReasons(selected, pool) {
  const reasons = [];

  if (selected.status === '進行中') {
    reasons.push('status=進行中 is ranked ahead of every non-active task.');
  } else {
    reasons.push('No 進行中 rows outranked this task, so the helper fell back to the best queued item.');
  }

  reasons.push(`priority=${selected.priority || '(blank)'} keeps this task ahead of lower-priority candidates.`);

  if (selected.plannedDate) {
    reasons.push(`planned date ${selected.plannedDate} and score ${selected.score || '(blank)'} kept it ahead of comparable rows.`);
  } else if (pool.length > 1) {
    reasons.push(`score ${selected.score || '(blank)'} and row age favored this task over similar rows.`);
  } else {
    reasons.push(`row age ${selected.rowNumber} made it the oldest remaining match after status and priority.`);
  }

  return reasons.slice(0, 3);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === 'true') {
    printHelp();
    return;
  }

  const context = await getAuthorizedContext(args);
  const range = args.range || DEFAULT_RANGE;
  const projectAliases = normalizeProjectFilter(args.project || '');
  const response = await getSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: SHEET_NAME,
    range,
    accessToken: context.accessToken,
  });

  const rows = response.values ?? [];
  const headerIndex = findHeaderRowIndex(rows);
  if (headerIndex < 0) {
    throw new Error(`Task_Queue header row was not found inside ${SHEET_NAME}!${range}`);
  }

  const rangeStart = parseRangeStart(range);
  const candidates = rows
    .slice(headerIndex + 1)
    .map((row, index) => ({
      rowNumber: rangeStart + headerIndex + index + 1,
      row,
      missing: hasAnyValue(row) ? findMissingRequiredFields(row) : [],
    }))
    .filter((entry) => hasAnyValue(entry.row))
    .filter((entry) => entry.missing.length === 0)
    .map((entry) => buildEntry(entry.rowNumber, entry.row))
    .filter((entry) => entry.status !== '完了')
    .filter((entry) => matchesProjectFilter(entry.project, projectAliases))
    .sort(compareEntries);

  console.log(`[INFO] Sheet         : ${SHEET_NAME}`);
  console.log(`[INFO] Scan range    : ${SHEET_NAME}!${range}`);
  console.log(`[INFO] Project filter: ${projectAliases.length === 0 ? '(all projects)' : projectAliases.join(', ')}`);
  console.log(`[INFO] Eligible rows : ${candidates.length}`);

  if (candidates.length === 0) {
    console.log('[INFO] No eligible task matched the current filter.');
    return;
  }

  const selected = candidates[0];
  const reasons = buildReasons(selected, candidates);

  console.log('[OK] Suggested next task');
  console.log(`Task      : ${selected.task}`);
  console.log(`Project   : ${selected.project}`);
  console.log(`Priority  : ${selected.priority}`);
  console.log(`Status    : ${selected.status}`);
  console.log(`Row range : ${formatTaskQueueRowRange(selected.rowNumber)}`);
  reasons.forEach((reason, index) => {
    console.log(`Reason ${index + 1} : ${reason}`);
  });
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});