#!/usr/bin/env node

import {
  batchUpdateSpreadsheet,
  getAuthorizedContext,
  getSheetValues,
  getSpreadsheetMetadata,
  parseArgs,
  updateSheetValues,
} from './lib-sheets.mjs';
import {
  CANONICAL_PROJECTS,
  IDEA_HEADERS_V2,
  LISTS_HEADERS_V2,
  PRIORITY_ADJUST_HEADERS,
  PROJECT_HEADERS_V2,
  TASK_HEADERS_V2,
  buildListsRows,
  githubBlobUrl,
  githubTreeUrl,
  mapProjectRefToId,
  normalizeAssignee,
  normalizeIdeaStage,
  normalizeTaskPriorityLabel,
  normalizeTaskStatus,
  normalizeTaskType,
  priorityLabelToScore,
  projectById,
  projectNameById,
  sheetUrl,
  sortTasksForDisplay,
  toIsoDate,
} from './aios-dashboard-v2.mjs';

const BACKUP_SUFFIX = 'backup_20260313_jp';
const PROJECT_WIDTH = PROJECT_HEADERS_V2.length;
const TASK_WIDTH = TASK_HEADERS_V2.length;
const IDEA_WIDTH = IDEA_HEADERS_V2.length;
const PRIORITY_WIDTH = PRIORITY_ADJUST_HEADERS.length;
const LISTS_WIDTH = LISTS_HEADERS_V2.length;
const PROJECT_WRITE_WIDTH = 18;
const METRICS_WRITE_WIDTH = 8;

function blankRow(width) {
  return Array.from({ length: width }, () => '');
}

function padRows(rows, width, totalRows) {
  const padded = rows.map((row) => {
    const nextRow = [...row];
    while (nextRow.length < width) {
      nextRow.push('');
    }
    return nextRow.slice(0, width);
  });

  while (padded.length < totalRows) {
    padded.push(blankRow(width));
  }

  return padded;
}

function firstNonEmpty(...candidates) {
  for (const candidate of candidates) {
    if (Array.isArray(candidate) && candidate.length > 0) {
      return candidate;
    }
  }
  return [];
}

function normalizeImportance(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '中';
  }
  if (raw === 'High' || raw === '高') {
    return '高';
  }
  if (raw === 'Low' || raw === '低') {
    return '低';
  }
  return '中';
}

function normalizeEffort(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return 'M';
  }
  if (raw === 'Small') {
    return 'S';
  }
  if (raw === 'Medium') {
    return 'M';
  }
  if (raw === 'Large') {
    return 'L';
  }
  if (raw === 'Extra Large') {
    return 'XL';
  }
  return raw;
}

function latestRunMap(runLogRows) {
  const result = new Map();
  for (const row of runLogRows) {
    const projectId = mapProjectRefToId(row[3]);
    const when = toIsoDate(row[1]);
    if (!projectId || !when) {
      continue;
    }
    if (!result.has(projectId) || result.get(projectId) < when) {
      result.set(projectId, when);
    }
  }
  return result;
}

function existingProjectMap(rows) {
  const map = new Map();
  if ((rows[2] ?? [])[0] !== 'project_id') {
    return map;
  }
  for (const row of rows.slice(3)) {
    const projectId = String(row[0] || '').trim();
    if (!projectId) {
      continue;
    }
    map.set(projectId, row);
  }
  return map;
}

function parseLegacyTasks(rows) {
  const header = rows[2] ?? [];
  if (header[0] !== 'Task') {
    return [];
  }

  return rows.slice(3)
    .filter((row) => row.some((cell) => String(cell || '').trim() !== ''))
    .map((row) => ({
      title: row[0] || '',
      project_ref: row[1] || '',
      type: normalizeTaskType(row[2]),
      priority_label: normalizeTaskPriorityLabel(row[3]),
      status: normalizeTaskStatus(row[4]),
      assignee: normalizeAssignee(row[5]),
      due_date: toIsoDate(row[6]),
      completed_at: toIsoDate(row[7]),
      dependency: row[8] || '',
      notes: row[10] || '',
    }));
}

function parseCurrentTasks(rows) {
  const header = rows[2] ?? [];
  if (header[0] !== 'task_id') {
    return [];
  }

  return rows.slice(3)
    .filter((row) => row.some((cell) => String(cell || '').trim() !== ''))
    .map((row) => ({
      title: row[1] || '',
      project_ref: row[2] || row[3] || '',
      type: normalizeTaskType(row[4]),
      priority_label: normalizeTaskPriorityLabel(row[5]),
      status: normalizeTaskStatus(row[9]),
      assignee: normalizeAssignee(row[10]),
      due_date: toIsoDate(row[11]),
      completed_at: toIsoDate(row[12]),
      dependency: row[13] || '',
      notes: row[14] || '',
    }));
}

function existingPriorityRows(rows) {
  const byKey = new Map();
  if ((rows[2] ?? [])[0] === 'task_id') {
    for (const row of rows.slice(3)) {
      const key = `${row[1] || ''}|${row[2] || ''}`;
      if (!row[1] || !row[2]) {
        continue;
      }
      byKey.set(key, {
        today: row[3] || '',
        adjust: row[4] || 0,
        reason: row[5] || '',
        notes: row[6] || '',
      });
    }
  }
  return byKey;
}

function taskId(index) {
  return `TASK-${String(index).padStart(3, '0')}`;
}

function ideaId(index) {
  return `IDEA-${String(index).padStart(3, '0')}`;
}

function buildTaskRecords(taskRows, priorityMap) {
  const mapped = [];
  let index = 1;

  for (const row of taskRows) {
    const projectId = mapProjectRefToId(row.project_ref);
    if (!projectId) {
      continue;
    }
    const project = projectById(projectId);
    const key = `${row.title}|${projectId}`;
    const preserved = priorityMap.get(key) ?? { today: '', adjust: 0, reason: '', notes: '' };
    const adjustment = Number.parseInt(String(preserved.adjust || 0), 10) || 0;
    const todayBoost = String(preserved.today || '') === 'はい' ? 100 : 0;
    const base = priorityLabelToScore(row.priority_label);
    mapped.push({
      task_id: taskId(index),
      title: row.title,
      project_id: projectId,
      project_name: project?.project_name ?? '',
      type: row.type,
      priority_label: row.priority_label,
      base_priority: base,
      adjustment,
      final_priority: base + adjustment + todayBoost,
      status: row.status,
      assignee: row.assignee,
      due_date: row.due_date,
      completed_at: row.completed_at,
      dependency: row.dependency,
      notes: row.notes,
      today_priority: preserved.today || '',
      adjust_reason: preserved.reason || '',
      adjust_notes: preserved.notes || '',
    });
    index += 1;
  }

  return sortTasksForDisplay(mapped);
}

function buildProjectsRows(projectMap, runLogMap, tasks) {
  const rows = [
    ['平山 AI OS - 案件マスター'],
    ['案件名・リンクの正本。Dashboard はこの表だけを参照して表示する。'],
    PROJECT_HEADERS_V2,
  ];

  for (const project of CANONICAL_PROJECTS) {
    const existing = projectMap.get(project.project_id) ?? [];
    const projectTasks = tasks.filter((task) => task.project_id === project.project_id && task.status !== '完了');
    const nextAction = projectTasks[0]?.title || existing[5] || '';
    const lastUpdated = existing[6] || runLogMap.get(project.project_id) || '';
    rows.push([
      project.project_id,
      project.project_name,
      project.status,
      project.stage,
      project.priority,
      nextAction,
      lastUpdated,
      sheetUrl(project.main_sheet_id, project.main_sheet_name),
      githubBlobUrl(project.spec_path),
      project.folder_url,
      githubTreeUrl(project.directory),
      `workspace/${project.directory}`,
      project.notes,
    ]);
  }

  return rows;
}

function buildTaskRows(tasks) {
  const rows = [
    ['平山 AI OS - 今日のタスク'],
    ['project_id を正本キーにし、優先度調整を加味した最終優先度で扱う。'],
    TASK_HEADERS_V2,
  ];

  for (let index = 0; index < tasks.length; index += 1) {
    const task = tasks[index];
    const rowNumber = index + 4;
    rows.push([
      task.task_id,
      task.title,
      task.project_id,
      `=IF($C${rowNumber}="","",IFNA(VLOOKUP($C${rowNumber},Projects!$A$4:$B$20,2,FALSE),"未登録"))`,
      task.type,
      task.priority_label,
      String(task.base_priority),
      `=IF($A${rowNumber}="","",N(IFNA(VLOOKUP($A${rowNumber},'優先度調整'!$A$4:$G$200,5,FALSE),0))+IF(IFNA(VLOOKUP($A${rowNumber},'優先度調整'!$A$4:$G$200,4,FALSE),"")="はい",100,0))`,
      `=IF($A${rowNumber}="","",$G${rowNumber}+$H${rowNumber})`,
      task.status,
      task.assignee,
      task.due_date,
      task.completed_at,
      task.dependency,
      task.notes,
    ]);
  }

  return rows;
}

function buildPriorityRows(tasks) {
  const rows = [
    ['優先度調整'],
    ['今日だけ優先したいタスクは「はい」または調整値を入れる。Task_Queue はこの表を参照する。'],
    PRIORITY_ADJUST_HEADERS,
  ];

  for (const task of tasks) {
    rows.push([
      task.task_id,
      task.title,
      task.project_id,
      task.today_priority,
      String(task.adjustment || 0),
      task.adjust_reason,
      task.adjust_notes,
    ]);
  }

  return rows;
}

function parseLegacyIdeas(rows) {
  const header = rows[2] ?? [];
  if (header[0] !== 'Idea') {
    return [];
  }

  return rows.slice(3)
    .filter((row) => row.some((cell) => String(cell || '').trim() !== ''))
    .map((row) => ({
      title: row[0] || '',
      project_id: mapProjectRefToId(row[6]),
      stage: normalizeIdeaStage(row[2], row[0], row[9]),
      impact: normalizeImportance(row[3]),
      effort: normalizeEffort(row[4]),
      summary: row[7] || '',
      next_review: toIsoDate(row[8]),
      notes: row[9] || '',
    }));
}

function parseCurrentIdeas(rows) {
  const header = rows[2] ?? [];
  if (header[0] !== 'idea_id') {
    return [];
  }

  return rows.slice(3)
    .filter((row) => row.some((cell) => String(cell || '').trim() !== ''))
    .map((row) => ({
      title: row[1] || '',
      project_id: mapProjectRefToId(row[2] || row[3]),
      stage: normalizeIdeaStage(row[4], row[1], row[9]),
      impact: normalizeImportance(row[5]),
      effort: normalizeEffort(row[6]),
      summary: row[7] || '',
      next_review: toIsoDate(row[8]),
      notes: row[9] || '',
    }));
}

function buildIdeaRows(ideas) {
  const rows = [
    ['平山 AI OS - アイデア管理'],
    ['メモから案件化までを段階で管理する。project_id は案件に紐づく場合のみ入れる。'],
    IDEA_HEADERS_V2,
  ];

  ideas.forEach((idea, index) => {
    rows.push([
      ideaId(index + 1),
      idea.title,
      idea.project_id,
      projectNameById(idea.project_id),
      idea.stage,
      idea.impact,
      idea.effort,
      idea.summary,
      idea.next_review,
      idea.notes,
    ]);
  });

  return rows;
}

function buildMetricsRows() {
  return [
    ['運用指標', '値'],
    ['総案件数', '=COUNTA(Projects!A4:A20)'],
    ['本番運用中', '=COUNTIF(Projects!C4:C20,"本番運用中")'],
    ['進行中', '=COUNTIF(Projects!C4:C20,"進行中")'],
    ['未完了タスク', '=COUNTIFS(Task_Queue!A4:A200,"<>",Task_Queue!J4:J200,"<>完了")'],
    ['保留アイデア数', '=COUNTIF(Ideas!E4:E200,"保留")'],
    ['今日優先タスク数', '=COUNTIF(\'優先度調整\'!D4:D200,"はい")'],
  ];
}

function buildDashboardRows() {
  return [
    ['平山 AI OS ダッシュボード'],
    [''],
    ['表示専用。案件名・リンクは Projects、今日の優先順位は 優先度調整 を正本にする。'],
    [''],
    ['総案件数', '', '本番運用中', '', '進行中', '', '未完了タスク', '', '保留アイデア数'],
    ['=COUNTA(Projects!A4:A20)', '', '=COUNTIF(Projects!C4:C20,"本番運用中")', '', '=COUNTIF(Projects!C4:C20,"進行中")', '', '=COUNTIFS(Task_Queue!A4:A200,"<>",Task_Queue!J4:J200,"<>完了")', '', '=COUNTIF(Ideas!E4:E200,"保留")'],
    [''],
    [''],
    ['今日の優先タスク', '', '', '', '', '', '', '案件の現況'],
    ['タスク', '案件', '状態', '最終優先度', '期限', '', '', 'project_id', '案件', '状態', '段階', '次アクション', '開く', 'SPEC'],
    ['=IFERROR(ARRAY_CONSTRAIN(SORT(FILTER({Task_Queue!B4:B,Task_Queue!D4:D,Task_Queue!J4:J,Task_Queue!I4:I,Task_Queue!L4:L},Task_Queue!A4:A<>"",Task_Queue!J4:J<>"完了"),4,FALSE,5,TRUE),5,5),"")', '', '', '', '', '', '', '=IFERROR(ARRAY_CONSTRAIN(FILTER({Projects!A4:A,Projects!B4:B,Projects!C4:C,Projects!D4:D,Projects!F4:F,IF(Projects!H4:H<>"",HYPERLINK(Projects!H4:H,"開く"),"未設定"),IF(Projects!I4:I<>"",HYPERLINK(Projects!I4:I,"SPEC"),"未設定")},Projects!A4:A<>""),10,7),"")', '', '', '', '', '', ''],
    [''],
    [''],
    [''],
    [''],
    [''],
    [''],
    ['最近の更新'],
    ['日時', '案件', '実行元', '内容', '結果', '次アクション'],
    ['=ARRAY_CONSTRAIN(QUERY({Run_Log!B4:B,Run_Log!D4:D,Run_Log!C4:C,Run_Log!E4:E,Run_Log!F4:F,Run_Log!J4:J},"select Col1,Col2,Col3,Col4,Col5,Col6 where Col1 is not null order by Col1 desc",0),6,6)', '', '', '', '', ''],
  ];
}

async function ensureSheetExists(context, metadata, title) {
  const found = (metadata.sheets || []).find((sheet) => sheet.properties?.title === title);
  if (found) {
    return found.properties.sheetId;
  }

  await batchUpdateSpreadsheet({
    spreadsheetId: context.spreadsheetId,
    accessToken: context.accessToken,
    requests: [
      {
        addSheet: {
          properties: {
            title,
          },
        },
      },
    ],
  });

  const refreshed = await getSpreadsheetMetadata(context);
  return (refreshed.sheets || []).find((sheet) => sheet.properties?.title === title)?.properties?.sheetId;
}

async function backupSheets(context, metadata, titles) {
  const requests = [];
  for (const title of titles) {
    const source = (metadata.sheets || []).find((sheet) => sheet.properties?.title === title);
    if (!source?.properties?.sheetId && source?.properties?.sheetId !== 0) {
      continue;
    }
    const backupTitle = `${title}_${BACKUP_SUFFIX}`;
    const exists = (metadata.sheets || []).some((sheet) => sheet.properties?.title === backupTitle);
    if (exists) {
      continue;
    }
    requests.push({
      duplicateSheet: {
        sourceSheetId: source.properties.sheetId,
        newSheetName: backupTitle,
      },
    });
  }

  if (requests.length > 0) {
    await batchUpdateSpreadsheet({
      spreadsheetId: context.spreadsheetId,
      accessToken: context.accessToken,
      requests,
    });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const context = await getAuthorizedContext(args);
  const isWrite = args.write === 'true';

  const metadata = await getSpreadsheetMetadata(context);
  const prioritySheetId = await ensureSheetExists(context, metadata, '優先度調整');
  const refreshedMetadata = await getSpreadsheetMetadata(context);

  const [projectsData, tasksData, ideasData, runLogData, priorityData, taskBackupData, ideaBackupData] = await Promise.all([
    getSheetValues({ spreadsheetId: context.spreadsheetId, sheetName: 'Projects', range: '1:300', accessToken: context.accessToken }),
    getSheetValues({ spreadsheetId: context.spreadsheetId, sheetName: 'Task_Queue', range: '1:300', accessToken: context.accessToken }),
    getSheetValues({ spreadsheetId: context.spreadsheetId, sheetName: 'Ideas', range: '1:300', accessToken: context.accessToken }),
    getSheetValues({ spreadsheetId: context.spreadsheetId, sheetName: 'Run_Log', range: '1:300', accessToken: context.accessToken }),
    getSheetValues({ spreadsheetId: context.spreadsheetId, sheetName: '優先度調整', range: '1:300', accessToken: context.accessToken }).catch(() => ({ values: [] })),
    getSheetValues({ spreadsheetId: context.spreadsheetId, sheetName: `Task_Queue_${BACKUP_SUFFIX}`, range: '1:300', accessToken: context.accessToken }).catch(() => ({ values: [] })),
    getSheetValues({ spreadsheetId: context.spreadsheetId, sheetName: `Ideas_${BACKUP_SUFFIX}`, range: '1:300', accessToken: context.accessToken }).catch(() => ({ values: [] })),
  ]);

  const priorityMap = existingPriorityRows(priorityData.values ?? []);
  const parsedTasks = firstNonEmpty(
    parseLegacyTasks(tasksData.values ?? []),
    parseCurrentTasks(tasksData.values ?? []),
    parseLegacyTasks(taskBackupData.values ?? []),
    parseCurrentTasks(taskBackupData.values ?? []),
  );
  const taskRecords = buildTaskRecords(parsedTasks, priorityMap);
  const runMap = latestRunMap((runLogData.values ?? []).slice(3));
  const projectRows = buildProjectsRows(existingProjectMap(projectsData.values ?? []), runMap, taskRecords);
  const taskRows = buildTaskRows(taskRecords);
  const priorityRows = buildPriorityRows(taskRecords);
  const parsedIdeas = firstNonEmpty(
    parseLegacyIdeas(ideasData.values ?? []),
    parseCurrentIdeas(ideasData.values ?? []),
    parseLegacyIdeas(ideaBackupData.values ?? []),
    parseCurrentIdeas(ideaBackupData.values ?? []),
  );
  const ideaRows = buildIdeaRows(parsedIdeas);
  const listsRows = buildListsRows();
  const metricsRows = buildMetricsRows();
  const dashboardRows = buildDashboardRows();

  console.log('[INFO] Canonical projects :', CANONICAL_PROJECTS.map((project) => project.project_id).join(', '));
  console.log('[INFO] Migrated task rows :', taskRecords.length);
  console.log('[INFO] Migrated idea rows :', Math.max(ideaRows.length - 3, 0));
  console.log('[INFO] Backup suffix       :', BACKUP_SUFFIX);
  if (taskRecords[0]) {
    console.log('[INFO] Top task preview   :', JSON.stringify(taskRecords[0]));
  }

  if (!isWrite) {
    console.log('[INFO] Dry run mode. Pass --write to back up and rewrite the live Dashboard sheets.');
    return;
  }

  await backupSheets(context, refreshedMetadata, ['Dashboard', 'Projects', 'Task_Queue', 'Ideas', 'Lists', 'Metrics']);

  const dashboardSheetId = (refreshedMetadata.sheets || []).find((sheet) => sheet.properties?.title === 'Dashboard')?.properties?.sheetId;

  await batchUpdateSpreadsheet({
    spreadsheetId: context.spreadsheetId,
    accessToken: context.accessToken,
    requests: [
      ...(dashboardSheetId === undefined ? [] : [
        {
          unmergeCells: {
            range: {
              sheetId: dashboardSheetId,
              startRowIndex: 0,
              endRowIndex: 30,
              startColumnIndex: 0,
              endColumnIndex: 14,
            },
          },
        },
        {
          repeatCell: {
            range: {
              sheetId: dashboardSheetId,
              startRowIndex: 5,
              endRowIndex: 6,
              startColumnIndex: 0,
              endColumnIndex: 9,
            },
            cell: {
              userEnteredFormat: {
                numberFormat: {
                  type: 'NUMBER',
                  pattern: '0',
                },
              },
            },
            fields: 'userEnteredFormat.numberFormat',
          },
        },
        {
          repeatCell: {
            range: {
              sheetId: dashboardSheetId,
              startRowIndex: 10,
              endRowIndex: 30,
              startColumnIndex: 4,
              endColumnIndex: 5,
            },
            cell: {
              userEnteredFormat: {
                numberFormat: {
                  type: 'DATE',
                  pattern: 'yyyy-mm-dd',
                },
              },
            },
            fields: 'userEnteredFormat.numberFormat',
          },
        },
      ]),
    ],
  });

  await Promise.all([
    updateSheetValues({
      spreadsheetId: context.spreadsheetId,
      sheetName: 'Projects',
      range: 'A1:R20',
      values: padRows(projectRows.map((row) => [...row, '', '', '', '', '']), PROJECT_WRITE_WIDTH, 20),
      accessToken: context.accessToken,
    }),
    updateSheetValues({
      spreadsheetId: context.spreadsheetId,
      sheetName: 'Task_Queue',
      range: 'A1:O40',
      values: padRows(taskRows, TASK_WIDTH, 40),
      accessToken: context.accessToken,
    }),
    updateSheetValues({
      spreadsheetId: context.spreadsheetId,
      sheetName: 'Ideas',
      range: 'A1:J40',
      values: padRows(ideaRows, IDEA_WIDTH, 40),
      accessToken: context.accessToken,
    }),
    updateSheetValues({
      spreadsheetId: context.spreadsheetId,
      sheetName: '優先度調整',
      range: 'A1:G40',
      values: padRows(priorityRows, PRIORITY_WIDTH, 40),
      accessToken: context.accessToken,
    }),
    updateSheetValues({
      spreadsheetId: context.spreadsheetId,
      sheetName: 'Lists',
      range: 'A1:I20',
      values: padRows(listsRows, LISTS_WIDTH, 20),
      accessToken: context.accessToken,
    }),
    updateSheetValues({
      spreadsheetId: context.spreadsheetId,
      sheetName: 'Metrics',
      range: 'A1:H20',
      values: padRows(metricsRows.map((row) => [...row, '', '', '', '', '', '']), METRICS_WRITE_WIDTH, 20),
      accessToken: context.accessToken,
    }),
    updateSheetValues({
      spreadsheetId: context.spreadsheetId,
      sheetName: 'Dashboard',
      range: 'A1:N30',
      values: padRows(dashboardRows, 14, 30),
      accessToken: context.accessToken,
    }),
  ]);

  if (prioritySheetId !== undefined) {
    await batchUpdateSpreadsheet({
      spreadsheetId: context.spreadsheetId,
      accessToken: context.accessToken,
      requests: [
        {
          sortRange: {
            range: {
              sheetId: (refreshedMetadata.sheets || []).find((sheet) => sheet.properties?.title === 'Task_Queue')?.properties?.sheetId,
              startRowIndex: 3,
              endRowIndex: 40,
              startColumnIndex: 0,
              endColumnIndex: 15,
            },
            sortSpecs: [
              { dimensionIndex: 8, sortOrder: 'DESCENDING' },
              { dimensionIndex: 11, sortOrder: 'ASCENDING' },
            ],
          },
        },
      ],
    });
  }

  console.log('[OK] Dashboard redesign applied to live sheets.');
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
