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
  IDEA_HEADERS_V2,
  normalizeIdeaStage,
  projectNameById,
  toIsoDate,
} from './aios-dashboard-v2.mjs';

function loadJson(path) {
  const raw = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function ensureHeaders(row = []) {
  const matches = IDEA_HEADERS_V2.every((value, index) => row[index] === value);
  if (!matches) {
    throw new Error(`Ideas header mismatch: ${JSON.stringify(row)}`);
  }
}

function loadEntry(args) {
  if (args.json) {
    return loadJson(args.json);
  }
  return {
    idea_id: args['idea-id'],
    title: args.title,
    project_id: args['project-id'],
    stage: args.stage,
    importance: args.importance,
    effort: args.effort,
    summary: args.summary,
    next_review: args['next-review'],
    notes: args.notes,
  };
}

function nextIdeaId(bodyRows) {
  const ids = bodyRows
    .map((row) => String(row[0] || ''))
    .map((value) => /^IDEA-(\d+)$/.exec(value))
    .filter(Boolean)
    .map((match) => Number.parseInt(match[1], 10));
  const next = (ids.length > 0 ? Math.max(...ids) : 0) + 1;
  return `IDEA-${String(next).padStart(3, '0')}`;
}

function findRow(bodyRows, entry) {
  if (entry.idea_id) {
    const ideaIdIndex = bodyRows.findIndex((row) => String(row[0] || '').trim() === entry.idea_id);
    if (ideaIdIndex >= 0) {
      return ideaIdIndex;
    }
  }
  return bodyRows.findIndex((row) => String(row[1] || '').trim() === String(entry.title || '').trim());
}

function buildRow(entry, existingRow = []) {
  const ideaId = entry.idea_id || existingRow[0] || '';
  const projectId = entry.project_id ?? existingRow[2] ?? '';
  if (projectId && !CANONICAL_PROJECTS.some((project) => project.project_id === projectId)) {
    throw new Error(`project_id must be one of: ${CANONICAL_PROJECTS.map((project) => project.project_id).join(', ')}`);
  }

  return [
    ideaId,
    entry.title ?? existingRow[1] ?? '',
    projectId,
    projectNameById(projectId),
    normalizeIdeaStage(entry.stage ?? existingRow[4], entry.title ?? existingRow[1], entry.notes ?? existingRow[9]),
    entry.importance ?? existingRow[5] ?? '中',
    entry.effort ?? existingRow[6] ?? 'M',
    entry.summary ?? existingRow[7] ?? '',
    toIsoDate(entry.next_review ?? existingRow[8]),
    entry.notes ?? existingRow[9] ?? '',
  ];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const context = await getAuthorizedContext(args);
  const entry = loadEntry(args);
  const isWrite = args.write === 'true';

  if (!entry.title) {
    throw new Error('Pass --title or provide title in --json.');
  }

  const data = await getSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: 'Ideas',
    range: '1:300',
    accessToken: context.accessToken,
  });

  const rows = data.values ?? [];
  ensureHeaders(rows[2] ?? []);

  const bodyRows = rows.slice(3).filter((row) => row.some((cell) => String(cell || '').trim() !== ''));
  const index = findRow(bodyRows, entry);
  const targetRow = index >= 0 ? index + 4 : bodyRows.length + 4;
  if (!entry.idea_id && index < 0) {
    entry.idea_id = nextIdeaId(bodyRows);
  }
  const row = buildRow(entry, index >= 0 ? bodyRows[index] : []);

  console.log(`[INFO] Target row  : Ideas!A${targetRow}:J${targetRow}`);
  console.log(`[INFO] Payload     : ${JSON.stringify(row)}`);

  if (!isWrite) {
    console.log('[INFO] Dry run mode. Pass --write to update the live Ideas sheet.');
    return;
  }

  const result = await updateSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: 'Ideas',
    range: `A${targetRow}:J${targetRow}`,
    values: [row],
    accessToken: context.accessToken,
  });

  console.log(`[OK] Ideas row updated: ${result.updatedRange ?? `Ideas!A${targetRow}:J${targetRow}`}`);
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
