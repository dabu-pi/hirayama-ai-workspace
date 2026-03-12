#!/usr/bin/env node

import {
  getAuthorizedContext,
  getSheetValues,
  loadJson,
  parseArgs,
  updateSheetValues,
} from './lib-sheets.mjs';

const PROJECTS_SHEET = 'Projects';
const RUNLOG_SHEET = 'Run_Log';
const TARGET_PROJECT_ID = 'AIOS-06';
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
const RUNLOG_HEADERS = [
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

function printHelp() {
  console.log(`sync-project-from-runlog.mjs

Usage:
  node scripts/sync-project-from-runlog.mjs --json <runlog.json> --project-id AIOS-06 [--expected-commit <hash>]
  node scripts/sync-project-from-runlog.mjs --json <runlog.json> --project-id AIOS-06 [--expected-commit <hash>] --write

Notes:
  - Default behavior is dry-run only.
  - Only AIOS-06 is supported in this first handoff snapshot version.
  - Writes are skipped unless the latest live Run_Log row matches the expected commit.
`);
}

function ensureHeaders(row = [], expected = [], label = 'header') {
  const matches = expected.every((value, index) => row[index] === value);
  if (!matches) {
    throw new Error(`${label} mismatch: ${JSON.stringify(row)}`);
  }
}

function findLastNonEmptyRow(rows = []) {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    if (rows[index].some((cell) => String(cell || '').trim() !== '')) {
      return { row: rows[index], index };
    }
  }
  return { row: [], index: -1 };
}

function sanitizeBlockValue(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .replace(/\|/g, '/')
    .trim();
}

function buildLatestHandoffBlock(entry) {
  return `latest_handoff=commit:${sanitizeBlockValue(entry.commit_hash)};summary:${sanitizeBlockValue(entry.summary)};result:${sanitizeBlockValue(entry.result)}`;
}

function updateNotes(existingNotes = '', entry) {
  const latestBlock = buildLatestHandoffBlock(entry);
  const parts = String(existingNotes || '')
    .split(' | ')
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !part.startsWith('latest_handoff='));
  return [...parts, latestBlock].join(' | ');
}

function buildProjectsRow(existingRow, entry) {
  return [
    existingRow[0] ?? '',
    existingRow[1] ?? '',
    existingRow[2] ?? '',
    existingRow[3] ?? '',
    existingRow[4] ?? '',
    existingRow[5] ?? '',
    entry.datetime ?? existingRow[6] ?? '',
    entry.next_action ?? existingRow[7] ?? '',
    existingRow[8] ?? '',
    updateNotes(existingRow[9] ?? '', entry),
  ];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === 'true') {
    printHelp();
    return;
  }

  if (!args.json) {
    throw new Error('Missing required --json argument.');
  }

  const projectId = args['project-id'] || '';
  if (!projectId) {
    console.log('[INFO] Skip        : project-id was not provided.');
    return;
  }

  if (projectId !== TARGET_PROJECT_ID) {
    console.log(`[INFO] Skip        : only ${TARGET_PROJECT_ID} is supported in this helper.`);
    return;
  }

  const entry = loadJson(args.json);
  const expectedCommit = args['expected-commit'] || entry.commit_hash || '';
  const isWrite = args.write === 'true';

  if (entry.project !== TARGET_PROJECT_ID) {
    console.log(`[INFO] Skip        : runlog project ${entry.project ?? '(blank)'} is not ${TARGET_PROJECT_ID}.`);
    return;
  }

  if (entry.result !== 'SUCCESS') {
    console.log(`[INFO] Skip        : runlog result ${entry.result ?? '(blank)'} is not SUCCESS.`);
    return;
  }

  const context = await getAuthorizedContext(args);
  const projectsData = await getSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: PROJECTS_SHEET,
    range: '1:200',
    accessToken: context.accessToken,
  });
  const runlogData = await getSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: RUNLOG_SHEET,
    range: '1:300',
    accessToken: context.accessToken,
  });

  const projectRows = projectsData.values ?? [];
  const runlogRows = runlogData.values ?? [];
  ensureHeaders(projectRows[2] ?? [], PROJECT_HEADERS, 'Projects header');
  ensureHeaders(runlogRows[2] ?? [], RUNLOG_HEADERS, 'Run_Log header');

  const projectBody = projectRows.slice(3);
  const projectIndex = projectBody.findIndex((row) => String(row[0] || '').trim() === TARGET_PROJECT_ID);
  if (projectIndex < 0) {
    console.log(`[INFO] Skip        : ${TARGET_PROJECT_ID} row was not found in Projects.`);
    return;
  }

  const latestRunlog = findLastNonEmptyRow(runlogRows.slice(3));
  const latestRunlogRow = latestRunlog.row;
  const latestCommit = String(latestRunlogRow[6] || '').trim();
  const latestProject = String(latestRunlogRow[3] || '').trim();
  const latestRowNumber = latestRunlog.index >= 0 ? latestRunlog.index + 4 : -1;

  console.log(`[INFO] Project ID   : ${TARGET_PROJECT_ID}`);
  console.log(`[INFO] Expected    : ${expectedCommit}`);
  console.log(`[INFO] Run_Log row  : ${latestRowNumber > 0 ? `${RUNLOG_SHEET}!A${latestRowNumber}:J${latestRowNumber}` : '(none)'}`);
  console.log(`[INFO] Live latest  : commit=${latestCommit || '(blank)'} project=${latestProject || '(blank)'}`);

  if (!expectedCommit || latestCommit !== expectedCommit) {
    console.log('[INFO] Skip        : latest Run_Log commit does not match the expected commit.');
    return;
  }

  if (latestProject !== TARGET_PROJECT_ID) {
    console.log(`[INFO] Skip        : latest Run_Log project ${latestProject || '(blank)'} is not ${TARGET_PROJECT_ID}.`);
    return;
  }

  const targetRowNumber = projectIndex + 4;
  const existingRow = projectBody[projectIndex];
  const updatedRow = buildProjectsRow(existingRow, entry);

  console.log(`[INFO] Target row   : ${PROJECTS_SHEET}!A${targetRowNumber}:J${targetRowNumber}`);
  console.log(`[INFO] last_updated : ${existingRow[6] ?? ''} -> ${updatedRow[6]}`);
  console.log(`[INFO] next_action  : ${existingRow[7] ?? ''} -> ${updatedRow[7]}`);
  console.log(`[INFO] notes block  : ${buildLatestHandoffBlock(entry)}`);
  console.log(`[INFO] Row payload  : ${JSON.stringify(updatedRow)}`);

  if (!isWrite) {
    console.log('[INFO] Dry run mode. Pass --write to update the live Projects row.');
    return;
  }

  const result = await updateSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: PROJECTS_SHEET,
    range: `A${targetRowNumber}:J${targetRowNumber}`,
    values: [updatedRow],
    accessToken: context.accessToken,
  });

  console.log(`[OK] Projects snapshot sync succeeded: ${result.updatedRange ?? `${PROJECTS_SHEET}!A${targetRowNumber}:J${targetRowNumber}`}`);
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
