#!/usr/bin/env node

import {
  getAuthorizedContext,
  getSheetValues,
  parseArgs,
  updateSheetValues,
} from './lib-sheets.mjs';

const PROJECT_HEADERS = [
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

const DEFAULT_SOURCE_SHEET = 'Projects_backup_20260308';
const DEFAULT_TARGET_SHEET = 'Projects';
const PROJECT_ID_PATTERN = /^(?:[A-Z]+-\d{2}|LEGACY-PROJECT-\d{2})$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const KNOWN_DIRECTORIES = new Set([
  'freee-automation',
  'gas-projects/jyu-gas-ver3.1',
  'patient-management',
  'hirayama-jyusei-strategy',
  'waste-report-system',
  'ai-os',
]);

const DIRECTORY_ID_MAP = new Map([
  ['freee-automation', 'FREEE-02'],
  ['gas-projects/jyu-gas-ver3.1', 'JREC-01'],
  ['patient-management', 'WEB-03'],
  ['hirayama-jyusei-strategy', 'JBIZ-04'],
  ['waste-report-system', 'HAIKI-05'],
  ['ai-os', 'AIOS-06'],
]);

const DIRECTORY_PRIORITY_MAP = new Map([
  ['ai-os', 1],
  ['freee-automation', 2],
  ['gas-projects/jyu-gas-ver3.1', 3],
  ['patient-management', 4],
  ['hirayama-jyusei-strategy', 5],
  ['waste-report-system', 6],
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

const LEGACY_TYPE_MAP = new Map([
  ['Production', '本番'],
  ['Pilot', '試行'],
  ['Local Only', 'ローカル専用'],
  ['None', 'なし'],
  ['Medical GAS', '医療'],
  ['Web App', 'Webアプリ'],
  ['Strategy AI', '戦略'],
  ['system', 'ダッシュボード'],
]);

const RUNTIME_MAP = new Map([
  ['Production', '本番'],
  ['Local Only', 'ローカル専用'],
  ['None', 'なし'],
  ['Manual', '手動'],
]);

function normalizePriority(directory, rowIndex) {
  return DIRECTORY_PRIORITY_MAP.get(directory) ?? rowIndex;
}

function normalizeStatus(value) {
  return STATUS_MAP.get(value) ?? value ?? '';
}

function normalizePhase(value) {
  return PHASE_MAP.get(value) ?? value?.replace(/\s+/g, '') ?? '';
}

function normalizeLegacyType(value) {
  return LEGACY_TYPE_MAP.get(value) ?? value ?? '';
}

function normalizeRuntime(value) {
  return RUNTIME_MAP.get(value) ?? value ?? '';
}

function padRow(values) {
  const padded = [...values];
  while (padded.length < 14) {
    padded.push('');
  }
  return padded.slice(0, 14);
}

function isCanonicalHeader(row = []) {
  return PROJECT_HEADERS.every((value, index) => row[index] === value);
}

function isCanonicalProjectRow(row = []) {
  const [projectId, , directory, , , priority, lastUpdated] = row;
  return (
    PROJECT_ID_PATTERN.test(String(projectId || '')) &&
    KNOWN_DIRECTORIES.has(String(directory || '')) &&
    /^\d+$/.test(String(priority || '')) &&
    (String(lastUpdated || '') === '' || DATE_PATTERN.test(String(lastUpdated)))
  );
}

function toNoteParts({
  legacyType,
  runtime,
  progress,
  completionCondition,
  owner,
  repo,
  risk,
  notes,
}) {
  return [
    legacyType ? `legacy_type=${normalizeLegacyType(legacyType)}` : '',
    runtime ? `runtime=${normalizeRuntime(runtime)}` : '',
    progress ? `progress=${progress}` : '',
    completionCondition ? `completion=${completionCondition}` : '',
    owner ? `owner=${owner}` : '',
    repo ? `repo=${repo}` : '',
    risk ? `risk=${risk}` : '',
    notes || '',
  ].filter(Boolean);
}

function fromLegacyRow(row, rowIndex) {
  const [
    projectName,
    directory,
    legacyType,
    status,
    phase,
    runtime,
    progress,
    lastUpdate,
    nextAction,
    completionCondition,
    owner,
    repo,
    risk,
    notes,
  ] = row;

  return padRow([
    DIRECTORY_ID_MAP.get(directory) || `LEGACY-PROJECT-${String(rowIndex).padStart(2, '0')}`,
    projectName || '',
    directory || '',
    normalizeStatus(status),
    normalizePhase(phase),
    String(normalizePriority(directory, rowIndex)),
    lastUpdate || '',
    nextAction || '',
    '',
    toNoteParts({ legacyType, runtime, progress, completionCondition, owner, repo, risk, notes }).join(' | '),
  ]);
}

function fromCanonicalRow(row) {
  return padRow(row.slice(0, 10));
}

function migrateRow(row, rowIndex, sourceIsCanonical) {
  if (sourceIsCanonical && isCanonicalProjectRow(row)) {
    return fromCanonicalRow(row);
  }
  return fromLegacyRow(row, rowIndex);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const context = await getAuthorizedContext(args);
  const isWrite = args.write === 'true';
  const sourceSheet = args['source-sheet'] || DEFAULT_SOURCE_SHEET;
  const targetSheet = args['target-sheet'] || DEFAULT_TARGET_SHEET;

  const data = await getSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: sourceSheet,
    range: '1:200',
    accessToken: context.accessToken,
  });

  const rows = data.values ?? [];
  const headerRow = rows[2] ?? [];
  const sourceIsCanonical = isCanonicalHeader(headerRow);
  const titleRow = padRow(rows[0] ?? ['Hirayama AI OS - Projects']);
  const descriptionRow = padRow(rows[1] ?? ['Seeded from the workspace audit. Update rows here and the dashboard refreshes.']);
  const bodyRows = rows.slice(3).filter((row) => row.some((cell) => String(cell || '').trim() !== ''));
  const migratedRows = bodyRows.map((row, index) => migrateRow(row, index + 1, sourceIsCanonical));
  const output = [titleRow, descriptionRow, padRow(PROJECT_HEADERS), ...migratedRows];
  const lastRow = output.length;

  console.log(`[INFO] Source sheet      : ${sourceSheet}`);
  console.log(`[INFO] Target sheet      : ${targetSheet}`);
  console.log(`[INFO] Source canonical  : ${sourceIsCanonical}`);
  console.log(`[INFO] Existing data rows: ${bodyRows.length}`);
  console.log(`[INFO] Migrated rows     : ${migratedRows.length}`);
  console.log(`[INFO] Header row        : ${JSON.stringify(PROJECT_HEADERS)}`);
  if (migratedRows.length > 0) {
    console.log(`[INFO] Sample row 1      : ${JSON.stringify(migratedRows[0].slice(0, 10))}`);
  }

  if (!isWrite) {
    console.log(`[INFO] Dry run mode. Pass --write to update ${targetSheet}!A1:N${lastRow}.`);
    return;
  }

  const result = await updateSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: targetSheet,
    range: `A1:N${lastRow}`,
    values: output,
    accessToken: context.accessToken,
  });

  console.log(`[OK] Migrated Projects to canonical schema: ${result.updatedRange ?? `${targetSheet}!A1:N${lastRow}`}`);
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
