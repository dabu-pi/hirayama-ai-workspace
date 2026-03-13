#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import {
  getAuthorizedContext,
  getSheetValues,
  parseArgs,
  updateSheetValues,
} from './lib-sheets.mjs';
import {
  CANONICAL_PROJECTS,
  PROJECT_HEADERS_V2,
  githubBlobUrl,
  githubTreeUrl,
  projectById,
  sheetUrl,
  toIsoDate,
} from './aios-dashboard-v2.mjs';

function loadJson(path) {
  const raw = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function ensureHeaders(row = []) {
  const matches = PROJECT_HEADERS_V2.every((value, index) => row[index] === value);
  if (!matches) {
    throw new Error(`Projects header mismatch: ${JSON.stringify(row)}`);
  }
}

function loadEntry(args) {
  if (args.json) {
    return loadJson(args.json);
  }
  return {
    project_id: args['project-id'],
    project_name: args['project-name'],
    status: args.status,
    stage: args.stage,
    priority: args.priority,
    next_action: args['next-action'],
    last_updated: args['last-updated'],
    main_sheet_url: args['main-sheet-url'],
    spec_url: args['spec-url'],
    folder_url: args['folder-url'],
    github_url: args['github-url'],
    local_path: args['local-path'],
    notes: args.notes,
  };
}

function findRow(bodyRows, projectId) {
  return bodyRows.findIndex((row) => String(row[0] || '').trim() === projectId);
}

function buildDefaultRow(projectId) {
  const project = projectById(projectId);
  if (!project) {
    throw new Error(`Unknown canonical project_id: ${projectId}`);
  }

  return [
    project.project_id,
    project.project_name,
    project.status,
    project.stage,
    project.priority,
    '',
    '',
    sheetUrl(project.main_sheet_id, project.main_sheet_name),
    githubBlobUrl(project.spec_path),
    project.folder_url || '',
    githubTreeUrl(project.directory),
    `workspace/${project.directory}`,
    project.notes,
  ];
}

function buildRow(entry, existingRow = []) {
  const baseRow = existingRow.length > 0 ? [...existingRow.slice(0, PROJECT_HEADERS_V2.length)] : buildDefaultRow(entry.project_id);
  return [
    entry.project_id,
    entry.project_name ?? baseRow[1],
    entry.status ?? baseRow[2],
    entry.stage ?? baseRow[3],
    entry.priority ?? baseRow[4],
    entry.next_action ?? baseRow[5],
    toIsoDate(entry.last_updated ?? baseRow[6]),
    entry.main_sheet_url ?? baseRow[7],
    entry.spec_url ?? baseRow[8],
    entry.folder_url ?? baseRow[9],
    entry.github_url ?? baseRow[10],
    entry.local_path ?? baseRow[11],
    entry.notes ?? baseRow[12],
  ];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const context = await getAuthorizedContext(args);
  const entry = loadEntry(args);
  const isWrite = args.write === 'true';

  if (!entry.project_id) {
    throw new Error('Pass --project-id or provide project_id in --json.');
  }
  if (!CANONICAL_PROJECTS.some((project) => project.project_id === entry.project_id)) {
    throw new Error(`project_id must be one of: ${CANONICAL_PROJECTS.map((project) => project.project_id).join(', ')}`);
  }

  const data = await getSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: 'Projects',
    range: '1:100',
    accessToken: context.accessToken,
  });

  const rows = data.values ?? [];
  ensureHeaders(rows[2] ?? []);

  const bodyRows = rows.slice(3).filter((row) => row.some((cell) => String(cell || '').trim() !== ''));
  const index = findRow(bodyRows, entry.project_id);
  const targetRow = index >= 0 ? index + 4 : bodyRows.length + 4;
  const row = buildRow(entry, index >= 0 ? bodyRows[index] : []);

  console.log(`[INFO] Target row  : Projects!A${targetRow}:M${targetRow}`);
  console.log(`[INFO] Payload     : ${JSON.stringify(row)}`);

  if (!isWrite) {
    console.log('[INFO] Dry run mode. Pass --write to update the live Projects sheet.');
    return;
  }

  const result = await updateSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: 'Projects',
    range: `A${targetRow}:M${targetRow}`,
    values: [row],
    accessToken: context.accessToken,
  });

  console.log(`[OK] Projects row updated: ${result.updatedRange ?? `Projects!A${targetRow}:M${targetRow}`}`);
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
