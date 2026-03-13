#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  getAuthorizedContext,
  getSheetValues,
  loadJson,
  parseArgs,
  updateSheetValues,
} from './lib-sheets.mjs';
import { syncProjectFromTaskQueue } from './sync-project-from-taskqueue.mjs';

function printHelp() {
  console.log(`promote-idea-to-task.mjs

Usage:
  node scripts/promote-idea-to-task.mjs --json <path> [--write]
  node scripts/promote-idea-to-task.mjs --idea-title <title> [--project AIOS-06] [--write]

Notes:
  - Default behavior keeps the Task project aligned to the source idea's Related Project.
  - Pass --project (or set json.project) only when you want the Task row to point at a canonical Projects row such as AIOS-06.
  - The source Ideas row is preserved; only its status/note trace is updated.
  - Sample payloads:
    - scripts/idea-to-task-workspace.example.json
    - scripts/idea-to-task-aios.example.json
`);
}

const IDEAS_HEADERS = [
  'Idea',
  'Domain',
  'Status',
  'Impact',
  'Effort',
  'Owner',
  'Related Project',
  'Why It Matters',
  'Next Review',
  'Notes',
];

const TASK_HEADERS = [
  'Task',
  'Project',
  'Type',
  'Priority',
  'Status',
  'Assigned To',
  'Planned Date',
  'Done Date',
  'Dependency',
  'Score',
  'Notes',
];

const PROJECT_NAME_MAP = new Map([
  ['AINV-07', 'AI投資プロジェクト'],
  ['ai-invest', 'AI投資プロジェクト'],
  ['FREEE-02', 'freee見積自動化'],
  ['freee-automation', 'freee見積自動化'],
  ['GAS-01', '柔整GASシステム'],
  ['gas-projects/jyu-gas-ver3.1', '柔整GASシステム'],
  ['WEB-03', '患者管理Webアプリ'],
  ['patient-management', '患者管理Webアプリ'],
  ['JBIZ-04', '接骨院経営戦略AI'],
  ['hirayama-jyusei-strategy', '接骨院経営戦略AI'],
  ['WST-05', '廃棄物日報GAS'],
  ['waste-report-system', '廃棄物日報GAS'],
  ['AIOS-06', 'Hirayama AI OS'],
  ['ai-os', 'Hirayama AI OS'],
  ['COMMON', 'workspace全体'],
]);

const TASK_TYPE_MAP = new Map([
  ['Run', '実行'],
  ['Ops', '運用'],
  ['Test', 'テスト'],
  ['Dev', '開発'],
  ['Docs', '文書'],
  ['Research', '調査'],
  ['Design', '設計'],
  ['実行', '実行'],
  ['運用', '運用'],
  ['テスト', 'テスト'],
  ['開発', '開発'],
  ['文書', '文書'],
  ['調査', '調査'],
  ['設計', '設計'],
]);

const PRIORITY_MAP = new Map([
  ['High', '高'],
  ['Medium', '中'],
  ['Low', '低'],
  ['高', '高'],
  ['中', '中'],
  ['低', '低'],
]);

const TASK_STATUS_MAP = new Map([
  ['Pending', '未着手'],
  ['In Progress', '進行中'],
  ['Waiting', '待機'],
  ['Blocked', '停止中'],
  ['Done', '完了'],
  ['未着手', '未着手'],
  ['進行中', '進行中'],
  ['待機', '待機'],
  ['停止中', '停止中'],
  ['完了', '完了'],
]);

const ASSIGNED_TO_MAP = new Map([
  ['AI', 'AI'],
  ['Human', '人'],
  ['人', '人'],
  ['AI+Human', 'AI+人'],
  ['AI+人', 'AI+人'],
]);

const IDEA_STATUS_MAP = new Map([
  ['Idea', 'アイデア'],
  ['Research', '調査中'],
  ['Planned', '計画済み'],
  ['Parked', '保留'],
  ['Converted', 'プロジェクト化済み'],
  ['アイデア', 'アイデア'],
  ['調査中', '調査中'],
  ['計画済み', '計画済み'],
  ['保留', '保留'],
  ['プロジェクト化済み', 'プロジェクト化済み'],
]);

const DEFAULT_LIFECYCLE_ALLOWLIST_FILE = 'ai-os/lifecycle-projects.json';
const DEFAULT_TASK_TYPE = '調査';
const DEFAULT_TASK_STATUS = '未着手';
const DEFAULT_IDEA_STATUS = '計画済み';
const DEFAULT_ASSIGNED_TO = 'AI';
const DEFAULT_SCORE = '30';

function parseAllowlist(value) {
  if (!value) {
    return new Set();
  }
  return new Set(
    String(value)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function loadAllowlistFile(filePath) {
  if (!filePath) {
    return new Set();
  }

  const resolvedPath = resolve(filePath);
  if (!existsSync(resolvedPath)) {
    throw new Error(`Lifecycle allowlist file not found: ${resolvedPath}`);
  }

  const raw = readFileSync(resolvedPath, 'utf8').replace(/^\uFEFF/, '');
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`Lifecycle allowlist file must be a JSON array: ${resolvedPath}`);
  }

  return new Set(parsed.map((item) => String(item || '').trim()).filter(Boolean));
}

function resolveLifecycleAllowlist(args) {
  const argValue = args['lifecycle-projects'];
  if (argValue) {
    return parseAllowlist(argValue);
  }

  const envValue = process.env.AIOS_LIFECYCLE_PROJECTS || '';
  if (envValue) {
    return parseAllowlist(envValue);
  }

  const allowlistPath = args['lifecycle-projects-file'] || DEFAULT_LIFECYCLE_ALLOWLIST_FILE;
  return loadAllowlistFile(allowlistPath);
}

function ensureHeaders(row = [], expectedHeaders = [], sheetName = 'Sheet') {
  const matches = expectedHeaders.every((value, index) => row[index] === value);
  if (!matches) {
    throw new Error(`${sheetName} header mismatch: ${JSON.stringify(row)}`);
  }
}

function normalizeProject(value) {
  if (!value) {
    return '';
  }
  return PROJECT_NAME_MAP.get(value) ?? value;
}

function normalizeMappedValue(value, map, fallback = '') {
  if (!value) {
    return fallback;
  }
  return map.get(value) ?? value;
}

function normalizeDate(value) {
  if (!value) {
    return '';
  }
  return String(value).slice(0, 10);
}

function toNumberString(value, fallback = DEFAULT_SCORE) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  return String(value);
}

function todayString() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function ensureRequiredTaskFields(row = []) {
  const required = [
    ['Task', row[0]],
    ['Project', row[1]],
    ['Type', row[2]],
    ['Priority', row[3]],
    ['Status', row[4]],
  ];

  const missing = required
    .filter(([, value]) => String(value || '').trim() === '')
    .map(([label]) => label);

  if (missing.length > 0) {
    throw new Error(`Task_Queue row is missing required fields: ${missing.join(', ')}`);
  }
}

function appendNote(existingValue, addition) {
  const existing = String(existingValue || '').trim();
  const extra = String(addition || '').trim();
  if (!extra) {
    return existing;
  }
  if (!existing) {
    return extra;
  }
  if (existing.includes(extra)) {
    return existing;
  }
  return `${existing} | ${extra}`;
}

function pickEntry(args) {
  if (args.json) {
    return loadJson(args.json);
  }

  return {
    idea_title: args['idea-title'] || args.title,
    related_project: args['related-project'],
    task_title: args['task-title'],
    project: args.project,
    type: args.type,
    priority: args.priority,
    status: args.status,
    assigned_to: args['assigned-to'],
    planned_date: args['planned-date'],
    done_date: args['done-date'],
    dependency: args.dependency,
    score: args.score,
    notes: args.notes,
    idea_status: args['idea-status'],
  };
}

function findIdeaRow(bodyRows, entry) {
  const normalizedTitle = String(entry.idea_title || '').trim();
  const normalizedProject = normalizeProject(String(entry.related_project || entry.project || '').trim());
  if (!normalizedTitle) {
    return -1;
  }

  if (normalizedProject) {
    return bodyRows.findIndex((row) => {
      const title = String(row[0] || '').trim();
      const relatedProject = normalizeProject(String(row[6] || '').trim());
      return title === normalizedTitle && relatedProject === normalizedProject;
    });
  }

  return bodyRows.findIndex((row) => String(row[0] || '').trim() === normalizedTitle);
}

function findExistingTaskRow(bodyRows, taskTitle, projectName) {
  const normalizedTitle = String(taskTitle || '').trim();
  const normalizedProject = normalizeProject(String(projectName || '').trim());
  if (!normalizedTitle || !normalizedProject) {
    return -1;
  }

  return bodyRows.findIndex((row) => {
    const title = String(row[0] || '').trim();
    const project = String(row[1] || '').trim();
    return title === normalizedTitle && project === normalizedProject;
  });
}

function buildTaskRow(entry, ideaRow, existingTaskRow = []) {
  const ideaTitle = String(ideaRow[0] || '').trim();
  const ideaImpact = String(ideaRow[3] || '').trim();
  const ideaOwner = String(ideaRow[5] || '').trim();
  const relatedProject = normalizeProject(String(ideaRow[6] || '').trim());
  const whyItMatters = String(ideaRow[7] || '').trim();
  const ideaNotes = String(ideaRow[9] || '').trim();
  const taskTitle = entry.task_title || ideaTitle;
  const projectName = normalizeProject(entry.project || relatedProject || existingTaskRow[1] || '');
  const taskType = normalizeMappedValue(entry.type || existingTaskRow[2] || '', TASK_TYPE_MAP, DEFAULT_TASK_TYPE);
  const priority = normalizeMappedValue(entry.priority || ideaImpact || existingTaskRow[3] || '', PRIORITY_MAP, '中');
  const status = normalizeMappedValue(entry.status || existingTaskRow[4] || '', TASK_STATUS_MAP, DEFAULT_TASK_STATUS);
  const assignedTo = normalizeMappedValue(entry.assigned_to || ideaOwner || existingTaskRow[5] || '', ASSIGNED_TO_MAP, DEFAULT_ASSIGNED_TO);
  const noteParts = [];

  if (entry.notes) {
    noteParts.push(String(entry.notes).trim());
  } else {
    noteParts.push(`idea=${ideaTitle}`);
    if (whyItMatters) {
      noteParts.push(`why=${whyItMatters}`);
    }
    if (ideaNotes) {
      noteParts.push(`idea_note=${ideaNotes}`);
    }
  }

  return [
    taskTitle || existingTaskRow[0] || '',
    projectName,
    taskType,
    priority,
    status,
    assignedTo,
    normalizeDate(entry.planned_date || existingTaskRow[6] || todayString()),
    normalizeDate(entry.done_date || existingTaskRow[7] || ''),
    entry.dependency ?? existingTaskRow[8] ?? '',
    toNumberString(entry.score ?? existingTaskRow[9] ?? '', DEFAULT_SCORE),
    noteParts.filter(Boolean).join(' | ') || existingTaskRow[10] || '',
  ];
}

function buildIdeaUpdateRow(ideaRow, taskRow, entry) {
  const today = todayString();
  const nextIdeaStatus = normalizeMappedValue(entry.idea_status, IDEA_STATUS_MAP, DEFAULT_IDEA_STATUS);
  const traceNote = `Task化 ${today}: ${taskRow[0]}`;

  return [
    ideaRow[0] || '',
    ideaRow[1] || '',
    nextIdeaStatus,
    ideaRow[3] || '',
    ideaRow[4] || '',
    ideaRow[5] || '',
    ideaRow[6] || '',
    ideaRow[7] || '',
    normalizeDate(ideaRow[8] || ''),
    appendNote(ideaRow[9], traceNote),
  ];
}

async function logProjectSyncPreview(context, projectName, eventDate, shouldWrite, applyStatusPhase, lifecycleProjectAllowlist, taskQueueRowOverride = null) {
  const syncResult = await syncProjectFromTaskQueue({
    context,
    projectRef: projectName,
    eventDate,
    shouldWrite,
    applyLifecycle: applyStatusPhase,
    lifecycleProjectAllowlist,
    taskQueueRowOverride,
  });

  if (syncResult.skipped) {
    console.log(`[INFO] Project sync skipped: ${syncResult.reason}`);
    return;
  }

  console.log(`[INFO] Project sync range : ${syncResult.targetRange}`);
  console.log(`[INFO] Project progress   : ${syncResult.computedProgress}%`);
  console.log(`[INFO] Project next action: ${syncResult.nextRow[7]}`);
  console.log(`[INFO] Project blocker    : ${syncResult.nextRow[8]}`);

  if (syncResult.lifecycle.changed) {
    if (syncResult.lifecycle.statusChanged) {
      console.log(`[INFO] Status preview    : ${syncResult.project.status} -> ${syncResult.lifecycle.status}`);
    }
    if (syncResult.lifecycle.phaseChanged) {
      console.log(`[INFO] Phase preview     : ${syncResult.project.phase} -> ${syncResult.lifecycle.phase}`);
    }
    console.log(`[INFO] Lifecycle note    : ${syncResult.lifecycle.reasons.join(' | ')}`);
    if (!applyStatusPhase) {
      console.log('[INFO] Lifecycle apply   : preview only. Pass --apply-status-phase and use the lifecycle allowlist to include status/phase in Projects writes.');
    } else if (!syncResult.lifecyclePermission.enabled) {
      console.log(`[INFO] Lifecycle apply   : blocked (${syncResult.lifecyclePermission.reason}).`);
    } else if (!shouldWrite) {
      console.log('[INFO] Lifecycle apply   : previewing status/phase because the lifecycle allowlist matched.');
    }
  } else {
    console.log('[INFO] Lifecycle preview : no guarded status/phase change suggested.');
  }

  if (shouldWrite) {
    console.log(`[OK] Project sync succeeded: ${syncResult.updateResult.updatedRange ?? syncResult.targetRange}`);
    if (applyStatusPhase && syncResult.lifecycle.changed) {
      if (syncResult.lifecycleWriteEnabled) {
        console.log('[OK] Lifecycle apply   : status/phase changes were included in the Projects write.');
      } else {
        console.log(`[INFO] Lifecycle apply   : status/phase write was skipped (${syncResult.lifecyclePermission.reason}).`);
      }
    }
  } else {
    console.log('[INFO] Dry run mode. Project sync was previewed only.');
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === 'true') {
    printHelp();
    return;
  }
  const context = await getAuthorizedContext(args);
  const entry = pickEntry(args);
  const isWrite = args.write === 'true';
  const applyStatusPhase = args['apply-status-phase'] === 'true';
  const lifecycleProjectAllowlist = resolveLifecycleAllowlist(args);

  if (!entry.idea_title) {
    throw new Error('Idea title is required. Pass --idea-title or --json.');
  }

  const [ideasData, taskData] = await Promise.all([
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

  const ideaRows = ideasData.values ?? [];
  const taskRows = taskData.values ?? [];
  ensureHeaders(ideaRows[2] ?? [], IDEAS_HEADERS, 'Ideas');
  ensureHeaders(taskRows[2] ?? [], TASK_HEADERS, 'Task_Queue');

  const ideaBodyRows = ideaRows.slice(3).filter((row) => row.some((cell) => String(cell || '').trim() !== ''));
  const ideaIndex = findIdeaRow(ideaBodyRows, entry);
  if (ideaIndex < 0) {
    throw new Error(`Idea not found: ${entry.idea_title}`);
  }

  const ideaRowNumber = ideaIndex + 4;
  const currentIdeaRow = ideaBodyRows[ideaIndex];
  const taskBodyRows = taskRows.slice(3).filter((row) => row.some((cell) => String(cell || '').trim() !== ''));
  const taskTitle = entry.task_title || currentIdeaRow[0] || '';
  const taskProject = normalizeProject(entry.project || currentIdeaRow[6] || '');
  const existingTaskIndex = findExistingTaskRow(taskBodyRows, taskTitle, taskProject);
  const existingTaskRow = existingTaskIndex >= 0 ? taskBodyRows[existingTaskIndex] : [];
  const taskRowNumber = existingTaskIndex >= 0 ? existingTaskIndex + 4 : taskBodyRows.length + 4;
  const taskRow = buildTaskRow(entry, currentIdeaRow, existingTaskRow);
  ensureRequiredTaskFields(taskRow);
  const ideaUpdateRow = buildIdeaUpdateRow(currentIdeaRow, taskRow, entry);
  const eventDate = taskRow[7] || todayString();
  const taskAction = existingTaskIndex >= 0 ? 'update' : 'append';

  console.log(`[INFO] Idea source   : Ideas!A${ideaRowNumber}:J${ideaRowNumber}`);
  console.log(`[INFO] Task action   : ${taskAction}`);
  console.log(`[INFO] Task target   : Task_Queue!A${taskRowNumber}:K${taskRowNumber}`);
  console.log(`[INFO] Idea title    : ${currentIdeaRow[0]}`);
  console.log(`[INFO] Task title    : ${taskRow[0]}`);
  console.log(`[INFO] Task project  : ${taskRow[1]}`);
  console.log(`[INFO] Project mode  : ${entry.project ? `override from idea -> ${taskRow[1]}` : 'use source idea related project'}`);
  console.log(`[INFO] Task payload  : ${JSON.stringify(taskRow)}`);
  console.log(`[INFO] Idea status   : ${currentIdeaRow[2]} -> ${ideaUpdateRow[2]}`);
  console.log(`[INFO] Idea notes    : ${ideaUpdateRow[9]}`);

  if (!isWrite) {
    console.log('[INFO] Dry run mode. Pass --write to update both Ideas and Task_Queue.');
    await logProjectSyncPreview(context, taskRow[1], eventDate, false, applyStatusPhase, lifecycleProjectAllowlist, {
      rowNumber: taskRowNumber,
      values: taskRow,
    });
    return;
  }

  const taskResult = await updateSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: 'Task_Queue',
    range: `A${taskRowNumber}:K${taskRowNumber}`,
    values: [taskRow],
    accessToken: context.accessToken,
  });

  const ideaResult = await updateSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: 'Ideas',
    range: `A${ideaRowNumber}:J${ideaRowNumber}`,
    values: [ideaUpdateRow],
    accessToken: context.accessToken,
  });

  console.log(`[OK] Task_Queue ${taskAction} succeeded: ${taskResult.updatedRange ?? `Task_Queue!A${taskRowNumber}:K${taskRowNumber}`}`);
  console.log(`[OK] Ideas update succeeded: ${ideaResult.updatedRange ?? `Ideas!A${ideaRowNumber}:J${ideaRowNumber}`}`);
  await logProjectSyncPreview(context, taskRow[1], eventDate, true, applyStatusPhase, lifecycleProjectAllowlist);
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
