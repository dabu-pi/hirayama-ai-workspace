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
  TASK_HEADERS_V2,
  normalizeAssignee,
  normalizeTaskPriorityLabel,
  normalizeTaskStatus,
  normalizeTaskType,
  priorityLabelToScore,
  toIsoDate,
} from './aios-dashboard-v2.mjs';
import { syncProjectFromTaskQueue } from './sync-project-from-taskqueue.mjs';

function loadJson(path) {
  const raw = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function ensureHeaders(row = []) {
  const matches = TASK_HEADERS_V2.every((value, index) => row[index] === value);
  if (!matches) {
    throw new Error(`Task_Queue header mismatch: ${JSON.stringify(row)}`);
  }
}

function loadEntry(args) {
  if (args.json) {
    return loadJson(args.json);
  }
  return {
    task_id: args['task-id'],
    title: args.title,
    project_id: args['project-id'],
    type: args.type,
    priority: args.priority,
    status: args.status,
    assigned_to: args['assigned-to'],
    due_date: args['due-date'],
    completed_at: args['completed-at'],
    dependency: args.dependency,
    notes: args.notes,
  };
}

function findRow(bodyRows, entry) {
  if (entry.task_id) {
    const taskIdIndex = bodyRows.findIndex((row) => String(row[0] || '').trim() === entry.task_id);
    if (taskIdIndex >= 0) {
      return taskIdIndex;
    }
  }

  if (entry.title && entry.project_id) {
    return bodyRows.findIndex((row) => String(row[1] || '').trim() === entry.title.trim() && String(row[2] || '').trim() === entry.project_id.trim());
  }

  return -1;
}

function nextTaskId(bodyRows) {
  const ids = bodyRows
    .map((row) => String(row[0] || ''))
    .map((value) => /^TASK-(\d+)$/.exec(value))
    .filter(Boolean)
    .map((match) => Number.parseInt(match[1], 10));
  const next = (ids.length > 0 ? Math.max(...ids) : 0) + 1;
  return `TASK-${String(next).padStart(3, '0')}`;
}

function buildRow(entry, rowNumber, existingRow = []) {
  const taskId = entry.task_id || existingRow[0] || '';
  const title = entry.title ?? existingRow[1] ?? '';
  const projectId = entry.project_id ?? existingRow[2] ?? '';
  if (!title || !projectId) {
    throw new Error('Task title and project_id are required.');
  }
  if (!CANONICAL_PROJECTS.some((project) => project.project_id === projectId)) {
    throw new Error(`project_id must be one of: ${CANONICAL_PROJECTS.map((project) => project.project_id).join(', ')}`);
  }

  const priorityLabel = normalizeTaskPriorityLabel(entry.priority ?? existingRow[5] ?? '中');
  const basePriority = priorityLabelToScore(priorityLabel);

  return [
    taskId,
    title,
    projectId,
    `=IF($C${rowNumber}="","",IFNA(VLOOKUP($C${rowNumber},Projects!$A$4:$B$20,2,FALSE),"未登録"))`,
    normalizeTaskType(entry.type ?? existingRow[4] ?? '調査'),
    priorityLabel,
    String(basePriority),
    `=IF($A${rowNumber}="","",N(IFNA(VLOOKUP($A${rowNumber},'優先度調整'!$A$4:$G$200,5,FALSE),0))+IF(IFNA(VLOOKUP($A${rowNumber},'優先度調整'!$A$4:$G$200,4,FALSE),"")="はい",100,0))`,
    `=IF($A${rowNumber}="","",$G${rowNumber}+$H${rowNumber})`,
    normalizeTaskStatus(entry.status ?? existingRow[9] ?? '未着手'),
    normalizeAssignee(entry.assigned_to ?? existingRow[10] ?? 'AI'),
    toIsoDate(entry.due_date ?? existingRow[11]),
    toIsoDate(entry.completed_at ?? existingRow[12]),
    entry.dependency ?? existingRow[13] ?? '',
    entry.notes ?? existingRow[14] ?? '',
  ];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const context = await getAuthorizedContext(args);
  const entry = loadEntry(args);
  const isWrite = args.write === 'true';

  const data = await getSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: 'Task_Queue',
    range: '1:300',
    accessToken: context.accessToken,
  });

  const rows = data.values ?? [];
  ensureHeaders(rows[2] ?? []);

  const bodyRows = rows.slice(3).filter((row) => row.some((cell) => String(cell || '').trim() !== ''));
  const index = findRow(bodyRows, entry);
  const targetRow = index >= 0 ? index + 4 : bodyRows.length + 4;
  if (!entry.task_id && index < 0) {
    entry.task_id = nextTaskId(bodyRows);
  }
  const row = buildRow(entry, targetRow, index >= 0 ? bodyRows[index] : []);

  console.log(`[INFO] Target row  : Task_Queue!A${targetRow}:O${targetRow}`);
  console.log(`[INFO] Payload     : ${JSON.stringify(row)}`);

  if (!isWrite) {
    const preview = await syncProjectFromTaskQueue({
      context,
      projectRef: row[2],
      eventDate: row[12] || row[11],
      shouldWrite: false,
      applyLifecycle: args['apply-status-phase'] === 'true',
    });
    if (!preview.skipped) {
      console.log(`[INFO] Project sync preview: ${JSON.stringify(preview.nextRow)}`);
    }
    console.log('[INFO] Dry run mode. Pass --write to update the live Task_Queue sheet.');
    return;
  }

  const result = await updateSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: 'Task_Queue',
    range: `A${targetRow}:O${targetRow}`,
    values: [row],
    accessToken: context.accessToken,
  });

  await syncProjectFromTaskQueue({
    context,
    projectRef: row[2],
    eventDate: row[12] || row[11],
    shouldWrite: true,
    applyLifecycle: args['apply-status-phase'] === 'true',
  });

  console.log(`[OK] Task_Queue row updated: ${result.updatedRange ?? `Task_Queue!A${targetRow}:O${targetRow}`}`);
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
