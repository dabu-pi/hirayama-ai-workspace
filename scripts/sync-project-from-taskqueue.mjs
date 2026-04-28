#!/usr/bin/env node

import { getAuthorizedContext, getSheetValues, parseArgs, updateSheetValues } from './lib-sheets.mjs';
import { PROJECT_HEADERS_V2, TASK_HEADERS_V2, projectNameById, toIsoDate } from './aios-dashboard-v2.mjs';

function ensureHeaders(row, expected, label) {
  const matches = expected.every((value, index) => row[index] === value);
  if (!matches) {
    throw new Error(`${label} header mismatch: ${JSON.stringify(row)}`);
  }
}

function activeTasks(tasks) {
  return tasks.filter((task) => task.status !== '完了');
}

function sortTasks(tasks) {
  return [...tasks].sort((left, right) => {
    const finalDiff = (Number(right.final_priority) || 0) - (Number(left.final_priority) || 0);
    if (finalDiff !== 0) {
      return finalDiff;
    }
    return String(left.due_date || '9999-99-99').localeCompare(String(right.due_date || '9999-99-99'));
  });
}

function inferStatus(project, tasks) {
  if (tasks.length === 0) {
    return project.status;
  }
  if (project.status === '保留' || project.status === '構想') {
    return '進行中';
  }
  return project.status;
}

function inferStage(project, tasks) {
  const top = tasks[0];
  if (!top) {
    return project.stage;
  }
  const typeToStage = new Map([
    ['設計', '設計'],
    ['文書', 'SPEC作成'],
    ['実装', '実装'],
    ['テスト', 'テスト'],
    ['確認', '運用'],
    ['運用', '運用'],
  ]);
  return typeToStage.get(top.type) ?? project.stage;
}

export async function syncProjectFromTaskQueue({
  context,
  projectRef,
  eventDate = '',
  shouldWrite = false,
  applyLifecycle = false,
} = {}) {
  const [projectsData, tasksData] = await Promise.all([
    getSheetValues({
      spreadsheetId: context.spreadsheetId,
      sheetName: 'Projects',
      range: '1:100',
      accessToken: context.accessToken,
    }),
    getSheetValues({
      spreadsheetId: context.spreadsheetId,
      sheetName: 'Task_Queue',
      range: '1:300',
      accessToken: context.accessToken,
    }),
  ]);

  ensureHeaders(projectsData.values?.[2] ?? [], PROJECT_HEADERS_V2, 'Projects');
  ensureHeaders(tasksData.values?.[2] ?? [], TASK_HEADERS_V2, 'Task_Queue');

  const projects = (projectsData.values ?? []).slice(3).filter((row) => row[0]);
  const tasks = (tasksData.values ?? []).slice(3).filter((row) => row[0]).map((row) => ({
    task_id: row[0] || '',
    title: row[1] || '',
    project_id: row[2] || '',
    project_name: row[3] || '',
    type: row[4] || '',
    final_priority: row[8] || 0,
    status: row[9] || '',
    due_date: row[11] || '',
  }));

  const project = projects.find((row) => row[0] === projectRef || row[1] === projectRef);
  if (!project) {
    return { skipped: true, reason: `No Projects row matched: ${projectRef}` };
  }

  const openTasks = sortTasks(activeTasks(tasks.filter((task) => task.project_id === project[0])));
  const nextAction = openTasks[0]?.title || project[5] || '';
  const lastUpdated = toIsoDate(eventDate) || toIsoDate(project[6]);
  const nextStatus = applyLifecycle ? inferStatus({ status: project[2] }, openTasks) : project[2];
  const nextStage = applyLifecycle ? inferStage({ stage: project[3] }, openTasks) : project[3];
  const nextRow = [
    project[0],
    project[1] || projectNameById(project[0]),
    nextStatus,
    nextStage,
    project[4],
    nextAction,
    lastUpdated,
    project[7],
    project[8],
    project[9],
    project[10],
    project[11],
    project[12],
  ];
  const targetRange = `Projects!A${projects.indexOf(project) + 4}:M${projects.indexOf(project) + 4}`;

  if (!shouldWrite) {
    return {
      skipped: false,
      targetRange,
      nextRow,
      project: { project_id: project[0], project_name: project[1], status: project[2], stage: project[3] },
      lifecycle: {
        changed: nextStatus !== project[2] || nextStage !== project[3],
        status: nextStatus,
        phase: nextStage,
        statusChanged: nextStatus !== project[2],
        phaseChanged: nextStage !== project[3],
        reasons: [],
      },
      lifecyclePermission: { enabled: applyLifecycle, reason: applyLifecycle ? 'enabled' : 'preview only' },
      lifecycleWriteEnabled: applyLifecycle,
      computedProgress: 0,
    };
  }

  const updateResult = await updateSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: 'Projects',
    range: targetRange.replace('Projects!', ''),
    values: [nextRow],
    accessToken: context.accessToken,
  });

  return {
    skipped: false,
    targetRange,
    nextRow,
    updateResult,
    project: { project_id: project[0], project_name: project[1], status: project[2], phase: project[3] },
    lifecycle: {
      changed: nextStatus !== project[2] || nextStage !== project[3],
      status: nextStatus,
      phase: nextStage,
      statusChanged: nextStatus !== project[2],
      phaseChanged: nextStage !== project[3],
      reasons: [],
    },
    lifecyclePermission: { enabled: applyLifecycle, reason: applyLifecycle ? 'enabled' : 'preview only' },
    lifecycleWriteEnabled: applyLifecycle,
    computedProgress: 0,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const context = await getAuthorizedContext(args);
  const result = await syncProjectFromTaskQueue({
    context,
    projectRef: args.project || args['project-id'],
    eventDate: args['event-date'] || '',
    shouldWrite: args.write === 'true',
    applyLifecycle: args['apply-status-phase'] === 'true',
  });

  if (result.skipped) {
    console.log(`[INFO] ${result.reason}`);
    return;
  }

  console.log(`[INFO] Target row  : ${result.targetRange}`);
  console.log(`[INFO] Row payload : ${JSON.stringify(result.nextRow)}`);
  if (args.write === 'true') {
    console.log(`[OK] Projects sync succeeded: ${result.updateResult.updatedRange ?? result.targetRange}`);
  } else {
    console.log('[INFO] Dry run mode. Pass --write true to update the live Projects row.');
  }
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
