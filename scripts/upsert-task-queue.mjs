#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import {
  getAuthorizedContext,
  getSheetValues,
  parseArgs,
  updateSheetValues,
} from './lib-sheets.mjs';

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

const PROJECT_NAME_MAP = new Map([
  ['FREEE-02', 'freee見積自動化'],
  ['GAS-01', '柔整GASシステム'],
  ['WEB-03', '患者管理Webアプリ'],
  ['STR-04', '接骨院戦略AI'],
  ['WST-05', '廃棄物日報GAS'],
  ['AIOS-06', 'Hirayama AI OS'],
  ['COMMON', 'workspace全体'],
]);

const TYPE_MAP = new Map([
  ['Run', '実行'],
  ['Ops', '運用'],
  ['Test', 'テスト'],
  ['Dev', '開発'],
  ['Docs', '文書'],
  ['Research', '調査'],
  ['Design', '設計'],
]);

const PRIORITY_MAP = new Map([
  ['High', '高'],
  ['Medium', '中'],
  ['Low', '低'],
]);

const STATUS_MAP = new Map([
  ['Pending', '未着手'],
  ['In Progress', '進行中'],
  ['Waiting', '待機'],
  ['Blocked', '停止中'],
  ['Done', '完了'],
]);

const ASSIGNED_TO_MAP = new Map([
  ['Human', '人'],
  ['AI+Human', 'AI+人'],
]);

function loadJson(path) {
  const raw = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function ensureLiveHeaders(row = []) {
  const matches = LIVE_HEADERS.every((value, index) => row[index] === value);
  if (!matches) {
    throw new Error(`Task_Queue header mismatch: ${JSON.stringify(row)}`);
  }
}

function normalizeProject(value) {
  if (!value) {
    return '';
  }
  return PROJECT_NAME_MAP.get(value) ?? value;
}

function normalizeMappedValue(value, map) {
  if (!value) {
    return '';
  }
  return map.get(value) ?? value;
}

function normalizeDate(value) {
  if (!value) {
    return '';
  }
  return String(value).slice(0, 10);
}

function toNumberString(value, fallback = '30') {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  return String(value);
}

function buildLiveRow(entry, existingRow = []) {
  return [
    entry.title || existingRow[0] || '',
    normalizeProject(entry.project || existingRow[1] || ''),
    normalizeMappedValue(entry.type || existingRow[2] || '', TYPE_MAP),
    normalizeMappedValue(entry.priority || existingRow[3] || '', PRIORITY_MAP),
    normalizeMappedValue(entry.status || existingRow[4] || '', STATUS_MAP),
    normalizeMappedValue(entry.assigned_to || existingRow[5] || '', ASSIGNED_TO_MAP),
    normalizeDate(entry.planned_date || existingRow[6] || ''),
    normalizeDate(entry.done_date || existingRow[7] || ''),
    entry.dependency ?? existingRow[8] ?? '',
    toNumberString(entry.score ?? existingRow[9] ?? '', '30'),
    entry.notes ?? existingRow[10] ?? '',
  ];
}

function pickEntry(args) {
  if (args.json) {
    return loadJson(args.json);
  }
  return {
    title: args.title || '',
    project: args.project || '',
    type: args.type || '',
    priority: args.priority || '',
    status: args.status || '',
    assigned_to: args['assigned-to'] || '',
    planned_date: args['planned-date'] || '',
    done_date: args['done-date'] || '',
    dependency: args.dependency || '',
    score: args.score || '',
    notes: args.notes || '',
  };
}

function findExistingRow(bodyRows, entry) {
  const normalizedTitle = String(entry.title || '').trim();
  const normalizedProject = normalizeProject(String(entry.project || '').trim());
  if (!normalizedTitle || !normalizedProject) {
    return -1;
  }

  return bodyRows.findIndex((row) => {
    const task = String(row[0] || '').trim();
    const project = String(row[1] || '').trim();
    return task === normalizedTitle && project === normalizedProject;
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const context = await getAuthorizedContext(args);
  const entry = pickEntry(args);
  const isWrite = args.write === 'true';

  if (!entry.title) {
    throw new Error('Task title is required. Pass --title or --json.');
  }
  if (!entry.project) {
    throw new Error('Project is required. Pass --project or --json.');
  }

  const data = await getSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: 'Task_Queue',
    range: '1:300',
    accessToken: context.accessToken,
  });

  const rows = data.values ?? [];
  ensureLiveHeaders(rows[2] ?? []);

  const bodyRows = rows.slice(3).filter((row) => row.some((cell) => String(cell || '').trim() !== ''));
  const existingIndex = findExistingRow(bodyRows, entry);
  const targetRowNumber = existingIndex >= 0 ? existingIndex + 4 : bodyRows.length + 4;
  const existingRow = existingIndex >= 0 ? bodyRows[existingIndex] : [];
  const liveRow = buildLiveRow(entry, existingRow);
  const action = existingIndex >= 0 ? 'update' : 'append';

  console.log(`[INFO] Action      : ${action}`);
  console.log(`[INFO] Target row  : Task_Queue!A${targetRowNumber}:K${targetRowNumber}`);
  console.log(`[INFO] Task        : ${liveRow[0]}`);
  console.log(`[INFO] Project     : ${liveRow[1]}`);
  console.log(`[INFO] Row payload : ${JSON.stringify(liveRow)}`);

  if (!isWrite) {
    console.log('[INFO] Dry run mode. Pass --write to update the live Task_Queue sheet.');
    return;
  }

  const result = await updateSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: 'Task_Queue',
    range: `A${targetRowNumber}:K${targetRowNumber}`,
    values: [liveRow],
    accessToken: context.accessToken,
  });

  console.log(`[OK] Task_Queue ${action} succeeded: ${result.updatedRange ?? `Task_Queue!A${targetRowNumber}:K${targetRowNumber}`}`);
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
