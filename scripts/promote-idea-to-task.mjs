#!/usr/bin/env node

import { getAuthorizedContext, getSheetValues, parseArgs, updateSheetValues } from './lib-sheets.mjs';
import { IDEA_HEADERS_V2, TASK_HEADERS_V2, priorityLabelToScore, projectNameById, toIsoDate } from './aios-dashboard-v2.mjs';
import { syncProjectFromTaskQueue } from './sync-project-from-taskqueue.mjs';

function ensureHeaders(row, expected, label) {
  const matches = expected.every((value, index) => row[index] === value);
  if (!matches) {
    throw new Error(`${label} header mismatch: ${JSON.stringify(row)}`);
  }
}

function nextTaskId(rows) {
  const ids = rows
    .map((row) => String(row[0] || ''))
    .map((value) => /^TASK-(\d+)$/.exec(value))
    .filter(Boolean)
    .map((match) => Number.parseInt(match[1], 10));
  const next = (ids.length > 0 ? Math.max(...ids) : 0) + 1;
  return `TASK-${String(next).padStart(3, '0')}`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const context = await getAuthorizedContext(args);
  const isWrite = args.write === 'true';
  const ideaRef = args['idea-id'] || args['idea-title'];

  if (!ideaRef) {
    throw new Error('Pass --idea-id or --idea-title.');
  }

  const [ideasData, tasksData] = await Promise.all([
    getSheetValues({
      spreadsheetId: context.spreadsheetId,
      sheetName: 'Ideas',
      range: '1:300',
      accessToken: context.accessToken,
    }),
    getSheetValues({
      spreadsheetId: context.spreadsheetId,
      sheetName: 'Task_Queue',
      range: '1:300',
      accessToken: context.accessToken,
    }),
  ]);

  ensureHeaders(ideasData.values?.[2] ?? [], IDEA_HEADERS_V2, 'Ideas');
  ensureHeaders(tasksData.values?.[2] ?? [], TASK_HEADERS_V2, 'Task_Queue');

  const ideas = (ideasData.values ?? []).slice(3).filter((row) => row[0]);
  const tasks = (tasksData.values ?? []).slice(3).filter((row) => row[0]);
  const ideaIndex = ideas.findIndex((row) => row[0] === ideaRef || row[1] === ideaRef);
  if (ideaIndex < 0) {
    throw new Error(`Idea not found: ${ideaRef}`);
  }

  const ideaRow = ideas[ideaIndex];
  const targetRow = tasks.length + 4;
  const taskId = nextTaskId(tasks);
  const priorityLabel = args.priority || (ideaRow[5] === '高' ? '高' : '中');
  const dueDate = args['due-date'] || toIsoDate(ideaRow[8]) || today();
  const taskRow = [
    taskId,
    args['task-title'] || ideaRow[1],
    args['project-id'] || ideaRow[2] || '',
    `=IF($C${targetRow}="","",IFNA(VLOOKUP($C${targetRow},Projects!$A$4:$B$20,2,FALSE),"未登録"))`,
    args.type || '調査',
    priorityLabel,
    String(priorityLabelToScore(priorityLabel)),
    `=IF($A${targetRow}="","",N(IFNA(VLOOKUP($A${targetRow},'優先度調整'!$A$4:$G$200,5,FALSE),0))+IF(IFNA(VLOOKUP($A${targetRow},'優先度調整'!$A$4:$G$200,4,FALSE),"")="はい",100,0))`,
    `=IF($A${targetRow}="","",$G${targetRow}+$H${targetRow})`,
    args.status || '未着手',
    args['assigned-to'] || 'AI',
    dueDate,
    '',
    args.dependency || '',
    args.notes || `idea=${ideaRow[0]} | summary=${ideaRow[7]}`,
  ];

  const ideaUpdate = [
    ideaRow[0],
    ideaRow[1],
    ideaRow[2],
    projectNameById(ideaRow[2]),
    '案件化済み',
    ideaRow[5],
    ideaRow[6],
    ideaRow[7],
    ideaRow[8],
    `${ideaRow[9] ? `${ideaRow[9]} | ` : ''}Task化 ${today()}: ${taskRow[1]}`,
  ];

  console.log(`[INFO] Task target  : Task_Queue!A${targetRow}:O${targetRow}`);
  console.log(`[INFO] Idea target  : Ideas!A${ideaIndex + 4}:J${ideaIndex + 4}`);
  console.log(`[INFO] Task payload : ${JSON.stringify(taskRow)}`);

  if (!isWrite) {
    console.log('[INFO] Dry run mode. Pass --write to promote the idea.');
    return;
  }

  await updateSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: 'Task_Queue',
    range: `A${targetRow}:O${targetRow}`,
    values: [taskRow],
    accessToken: context.accessToken,
  });

  await updateSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: 'Ideas',
    range: `A${ideaIndex + 4}:J${ideaIndex + 4}`,
    values: [ideaUpdate],
    accessToken: context.accessToken,
  });

  if (taskRow[2]) {
    await syncProjectFromTaskQueue({
      context,
      projectRef: taskRow[2],
      eventDate: taskRow[11],
      shouldWrite: true,
      applyLifecycle: true,
    });
  }

  console.log('[OK] Idea promoted to Task_Queue and marked as 案件化済み.');
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
