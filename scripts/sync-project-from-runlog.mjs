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

// Live Projects sheet column indices (0-based).
// Header is on row 3 of the spreadsheet (projectRows[2]).
// Schema: project_id / 案件名 / 状態 / 段階 / 優先度 / 次アクション /
//         最終更新日 / メインシートURL / SPEC URL / フォルダURL /
//         GitHub URL / ローカルパス / 補足   (13 cols, A:M)
const PC = {
  project_id:   0,  // A
  案件名:        1,  // B
  状態:          2,  // C
  段階:          3,  // D
  優先度:        4,  // E
  次アクション:   5,  // F  ← written from Run_Log.next_action
  最終更新日:    6,  // G  ← written from Run_Log.datetime
  メインシートURL: 7, // H
  SPEC_URL:     8,  // I
  フォルダURL:   9,  // J
  GitHub_URL:   10, // K
  ローカルパス:  11, // L
  補足:         12, // M  ← latest_handoff block is updated here
};
const PROJECTS_TOTAL_COLS = 13; // A:M

// Live Run_Log sheet column indices (0-based).
// Header is on row 3 (runlogRows[2]).  English schema unchanged.
const RUNLOG_HEADERS = [
  'log_id', 'datetime', 'system', 'project', 'summary',
  'result', 'commit_hash', 'tasks_done', 'stop_reason', 'next_action',
];

function printHelp() {
  console.log(`sync-project-from-runlog.mjs

Usage:
  node scripts/sync-project-from-runlog.mjs --json <runlog.json> --project-id <ID> [--expected-commit <hash>]
  node scripts/sync-project-from-runlog.mjs --json <runlog.json> --project-id <ID> [--expected-commit <hash>] --write

Notes:
  - Accepts any project_id that exists in the live Projects sheet.
  - Updates only: 次アクション (col F), 最終更新日 (col G), 補足 latest_handoff block (col M).
  - All other columns (状態, 段階, URLs, etc.) are preserved as-is.
  - If project_id is not found in the live Projects sheet, skips with a warning (no auto-append).
  - Default is dry-run. Pass --write to apply.
  - Skips if result != SUCCESS or latest Run_Log commit != expected-commit.
`);
}

function ensureRunlogHeaders(row = []) {
  const matches = RUNLOG_HEADERS.every((value, index) => row[index] === value);
  if (!matches) {
    throw new Error(
      `Run_Log header mismatch: expected ${JSON.stringify(RUNLOG_HEADERS)}, got ${JSON.stringify(row.slice(0, RUNLOG_HEADERS.length))}`,
    );
  }
}

function ensureProjectsHeader(row = []) {
  // Only verify col 0 = "project_id". The rest of the header is Japanese and
  // intentionally not strict-checked so schema evolution doesn't break the script.
  if (String(row[0] || '').trim() !== 'project_id') {
    throw new Error(
      `Projects header mismatch: expected col A = "project_id", got ${JSON.stringify(row[0])}`,
    );
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
  return (
    `latest_handoff=commit:${sanitizeBlockValue(entry.commit_hash)}` +
    `;summary:${sanitizeBlockValue(entry.summary)}` +
    `;result:${sanitizeBlockValue(entry.result)}`
  );
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

// Build a 13-column updated row.
// Only 次アクション / 最終更新日 / 補足 are overwritten.
// All other columns are preserved from the existing row.
function buildProjectsRow(existingRow, entry) {
  const row = Array.from({ length: PROJECTS_TOTAL_COLS }, (_, i) => existingRow[i] ?? '');
  row[PC.次アクション] = entry.next_action ?? existingRow[PC.次アクション] ?? '';
  row[PC.最終更新日]   = entry.datetime   ?? existingRow[PC.最終更新日]   ?? '';
  row[PC.補足]         = updateNotes(existingRow[PC.補足] ?? '', entry);
  return row;
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
    console.log('[INFO] Skip        : --project-id was not provided.');
    return;
  }

  const entry = loadJson(args.json);
  const expectedCommit = args['expected-commit'] || entry.commit_hash || '';
  const isWrite = args.write === 'true';

  if (entry.project !== projectId) {
    console.log(
      `[INFO] Skip        : runlog project "${entry.project ?? '(blank)'}" does not match --project-id "${projectId}".`,
    );
    return;
  }

  if (entry.result !== 'SUCCESS') {
    console.log(`[INFO] Skip        : runlog result "${entry.result ?? '(blank)'}" is not SUCCESS.`);
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
  const runlogRows  = runlogData.values ?? [];

  ensureProjectsHeader(projectRows[2] ?? []);   // row 3: only checks col 0
  ensureRunlogHeaders(runlogRows[2] ?? []);      // row 3: strict check

  const projectBody  = projectRows.slice(3);
  const projectIndex = projectBody.findIndex(
    (row) => String(row[0] || '').trim() === projectId,
  );

  if (projectIndex < 0) {
    console.log(
      `[WARN] Skip        : project_id "${projectId}" was not found in the live Projects sheet. Skipping (no auto-append).`,
    );
    return;
  }

  const latestRunlog    = findLastNonEmptyRow(runlogRows.slice(3));
  const latestRunlogRow = latestRunlog.row;
  const latestCommit    = String(latestRunlogRow[6] || '').trim();
  const latestProject   = String(latestRunlogRow[3] || '').trim();
  const latestRowNumber = latestRunlog.index >= 0 ? latestRunlog.index + 4 : -1;

  console.log(`[INFO] Project ID   : ${projectId}`);
  console.log(`[INFO] Expected    : ${expectedCommit}`);
  console.log(
    `[INFO] Run_Log row  : ${latestRowNumber > 0 ? `${RUNLOG_SHEET}!A${latestRowNumber}:J${latestRowNumber}` : '(none)'}`,
  );
  console.log(
    `[INFO] Live latest  : commit=${latestCommit || '(blank)'} project=${latestProject || '(blank)'}`,
  );

  if (!expectedCommit || latestCommit !== expectedCommit) {
    console.log('[INFO] Skip        : latest Run_Log commit does not match the expected commit.');
    return;
  }

  if (latestProject !== projectId) {
    console.log(
      `[INFO] Skip        : latest Run_Log project "${latestProject || '(blank)'}" does not match "${projectId}".`,
    );
    return;
  }

  const targetRowNumber = projectIndex + 4;
  const existingRow     = projectBody[projectIndex];
  const updatedRow      = buildProjectsRow(existingRow, entry);

  console.log(`[INFO] Target row   : ${PROJECTS_SHEET}!A${targetRowNumber}:M${targetRowNumber}`);
  console.log(
    `[INFO] 次アクション  : "${existingRow[PC.次アクション] ?? ''}" -> "${updatedRow[PC.次アクション]}"`,
  );
  console.log(
    `[INFO] 最終更新日    : "${existingRow[PC.最終更新日] ?? ''}" -> "${updatedRow[PC.最終更新日]}"`,
  );
  console.log(`[INFO] notes block  : ${buildLatestHandoffBlock(entry)}`);
  console.log(`[INFO] Row payload  : ${JSON.stringify(updatedRow)}`);

  if (!isWrite) {
    console.log('[INFO] Dry run mode. Pass --write to update the live Projects row.');
    return;
  }

  const result = await updateSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: PROJECTS_SHEET,
    range: `A${targetRowNumber}:M${targetRowNumber}`,
    values: [updatedRow],
    accessToken: context.accessToken,
  });

  console.log(
    `[OK] Projects snapshot sync succeeded: ${result.updatedRange ?? `${PROJECTS_SHEET}!A${targetRowNumber}:M${targetRowNumber}`}`,
  );
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
