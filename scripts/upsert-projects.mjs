#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import {
  getAuthorizedContext,
  getSheetValues,
  parseArgs,
  updateSheetValues,
} from './lib-sheets.mjs';

const LIVE_HEADERS = [
  'project_id',
  'project_name',
  'directory',
  'status',
  'phase',
  'priority',
  'last_updated',
  'next_action',
  'blocker',
  'notes',
];

const DIRECTORY_ID_MAP = new Map([
  ['ai-invest', 'AINV-07'],
  ['freee-automation', 'FREEE-02'],
  ['gas-projects/jyu-gas-ver3.1', 'JREC-01'],
  ['patient-management', 'WEB-03'],
  ['hirayama-jyusei-strategy', 'JBIZ-04'],
  ['waste-report-system', 'WST-05'],
  ['ai-os', 'AIOS-06'],
]);

const ID_NAME_MAP = new Map([
  ['AINV-07', 'AI投資プロジェクト'],
  ['FREEE-02', 'freee見積自動化'],
  ['JREC-01', '柔整毎日記録システム'],
  ['WEB-03', '患者管理Webアプリ'],
  ['JBIZ-04', '接骨院経営戦略AI'],
  ['WST-05', '廃棄物日報GAS'],
  ['AIOS-06', 'Hirayama AI OS'],
]);

const DIRECTORY_NAME_MAP = new Map([
  ['ai-invest', 'AI投資プロジェクト'],
  ['freee-automation', 'freee見積自動化'],
  ['gas-projects/jyu-gas-ver3.1', '柔整毎日記録システム'],
  ['patient-management', '患者管理Webアプリ'],
  ['hirayama-jyusei-strategy', '接骨院経営戦略AI'],
  ['waste-report-system', '廃棄物日報GAS'],
  ['ai-os', 'Hirayama AI OS'],
]);

const STATUS_MAP = new Map([
  ['Active', '稼働中'],
  ['In Progress', '進行中'],
  ['Prototype', '試作'],
  ['Parked', '保留'],
  ['Complete', '完了'],
]);

const PHASE_MAP = new Map([
  ['Concept', '構想'],
  ['Design', '設計'],
  ['Build', '実装'],
  ['Test', 'テスト'],
  ['Run', '運用'],
  ['Stable', '安定運用'],
  ['Phase 1', 'Phase1'],
  ['Phase 2', 'Phase2'],
  ['Phase 3', 'Phase3'],
  ['Phase 4', 'Phase4'],
  ['Phase B', 'PhaseB'],
]);

const NOTE_KEYS = ['legacy_type', 'runtime', 'progress', 'completion', 'owner', 'repo', 'risk'];

function loadJson(path) {
  const raw = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function has(entry, key) {
  return Object.prototype.hasOwnProperty.call(entry, key);
}

function ensureLiveHeaders(row = []) {
  const matches = LIVE_HEADERS.every((value, index) => row[index] === value);
  if (!matches) {
    throw new Error(`Projects header mismatch: ${JSON.stringify(row)}`);
  }
}

function normalizeMappedValue(value, map) {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  return map.get(value) ?? value;
}

function normalizeProjectId(value, directory) {
  if (value) {
    return value;
  }
  return DIRECTORY_ID_MAP.get(directory) ?? '';
}

function normalizeProjectName(value, projectId, directory, existingValue = '') {
  if (value) {
    return value;
  }
  return ID_NAME_MAP.get(projectId) ?? DIRECTORY_NAME_MAP.get(directory) ?? existingValue;
}

function normalizeDate(value) {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  return String(value).slice(0, 10);
}

function normalizePriority(value, fallback = '') {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? String(parsed) : String(value);
}

function normalizeProgress(value) {
  if (value === undefined || value === null || value === '') {
    return '';
  }
  const raw = String(value).trim();
  if (/^\d+%$/.test(raw)) {
    return raw;
  }
  if (/^\d+$/.test(raw)) {
    return `${raw}%`;
  }
  return raw;
}

function parseNotes(value = '') {
  const parts = String(value || '')
    .split(' | ')
    .map((part) => part.trim())
    .filter(Boolean);
  const keyed = new Map();
  const freeText = [];

  for (const part of parts) {
    const delimiter = part.indexOf('=');
    if (delimiter > 0) {
      const key = part.slice(0, delimiter);
      const noteValue = part.slice(delimiter + 1);
      if (NOTE_KEYS.includes(key) && !keyed.has(key)) {
        keyed.set(key, noteValue);
        continue;
      }
    }
    freeText.push(part);
  }

  return { keyed, freeText };
}

function buildNotes(entry, existingNotes = '') {
  if (has(entry, 'notes')) {
    return entry.notes ?? '';
  }

  const { keyed, freeText } = parseNotes(existingNotes);

  for (const key of NOTE_KEYS) {
    if (!has(entry, key)) {
      continue;
    }
    const value = key === 'progress' ? normalizeProgress(entry[key]) : entry[key];
    if (value === undefined || value === null || value === '') {
      keyed.delete(key);
    } else {
      keyed.set(key, String(value));
    }
  }

  const textParts = has(entry, 'note_text')
    ? (entry.note_text ? [String(entry.note_text)] : [])
    : freeText;

  const ordered = NOTE_KEYS
    .map((key) => (keyed.has(key) ? `${key}=${keyed.get(key)}` : ''))
    .filter(Boolean);

  return [...ordered, ...textParts].join(' | ');
}

function loadEntry(args) {
  if (args.json) {
    return loadJson(args.json);
  }

  return {
    project_id: args['project-id'],
    project_name: args['project-name'],
    directory: args.directory,
    status: args.status,
    phase: args.phase,
    priority: args.priority,
    last_updated: args['last-updated'],
    next_action: args['next-action'],
    blocker: args.blocker,
    notes: args.notes,
    note_text: args['note-text'],
    legacy_type: args['legacy-type'],
    runtime: args.runtime,
    progress: args.progress,
    completion: args.completion,
    owner: args.owner,
    repo: args.repo,
    risk: args.risk,
  };
}

function findExistingRow(bodyRows, entry) {
  const projectId = String(entry.project_id || '').trim();
  const directory = String(entry.directory || '').trim();

  if (projectId) {
    const idIndex = bodyRows.findIndex((row) => String(row[0] || '').trim() === projectId);
    if (idIndex >= 0) {
      return idIndex;
    }
  }

  if (directory) {
    return bodyRows.findIndex((row) => String(row[2] || '').trim() === directory);
  }

  return -1;
}

function buildLiveRow(entry, existingRow = []) {
  const directory = has(entry, 'directory') ? (entry.directory ?? '') : (existingRow[2] ?? '');
  const projectId = normalizeProjectId(
    has(entry, 'project_id') ? entry.project_id : existingRow[0],
    directory,
  );

  if (!projectId) {
    throw new Error('project_id could not be resolved. Pass --project-id or a known --directory.');
  }

  return [
    projectId,
    normalizeProjectName(
      has(entry, 'project_name') ? entry.project_name : existingRow[1],
      projectId,
      directory,
      existingRow[1] ?? '',
    ),
    directory,
    normalizeMappedValue(has(entry, 'status') ? entry.status : existingRow[3], STATUS_MAP) || existingRow[3] || '',
    normalizeMappedValue(has(entry, 'phase') ? entry.phase : existingRow[4], PHASE_MAP) || existingRow[4] || '',
    normalizePriority(has(entry, 'priority') ? entry.priority : existingRow[5], existingRow[5] ?? ''),
    normalizeDate(has(entry, 'last_updated') ? entry.last_updated : existingRow[6]),
    has(entry, 'next_action') ? (entry.next_action ?? '') : (existingRow[7] ?? ''),
    has(entry, 'blocker') ? (entry.blocker ?? '') : (existingRow[8] ?? ''),
    buildNotes(entry, existingRow[9] ?? ''),
  ];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const context = await getAuthorizedContext(args);
  const entry = loadEntry(args);
  const isWrite = args.write === 'true';

  if (!entry.project_id && !entry.directory) {
    throw new Error('Pass --project-id or --directory, or provide one of them in --json.');
  }

  const data = await getSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: 'Projects',
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
  console.log(`[INFO] Target row  : Projects!A${targetRowNumber}:J${targetRowNumber}`);
  console.log(`[INFO] Project ID  : ${liveRow[0]}`);
  console.log(`[INFO] Directory   : ${liveRow[2]}`);
  console.log(`[INFO] Row payload : ${JSON.stringify(liveRow)}`);

  if (!isWrite) {
    console.log('[INFO] Dry run mode. Pass --write to update the live Projects sheet.');
    return;
  }

  const result = await updateSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: 'Projects',
    range: `A${targetRowNumber}:J${targetRowNumber}`,
    values: [liveRow],
    accessToken: context.accessToken,
  });

  console.log(`[OK] Projects ${action} succeeded: ${result.updatedRange ?? `Projects!A${targetRowNumber}:J${targetRowNumber}`}`);
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
