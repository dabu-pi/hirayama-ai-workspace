#!/usr/bin/env node

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { getAuthorizedContext, getSheetValues, parseArgs, updateSheetValues } from './lib-sheets.mjs';

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

const NOTE_KEYS = ['legacy_type', 'runtime', 'progress', 'completion', 'owner', 'repo', 'risk'];
const STATUS_PRIORITY = new Map([
  ['進行中', 0],
  ['未着手', 1],
  ['待機', 2],
  ['停止中', 3],
  ['完了', 4],
]);
const PRIORITY_ORDER = new Map([
  ['高', 0],
  ['中', 1],
  ['低', 2],
]);
const ACTIVE_TASK_STATUSES = new Set(['進行中', '待機', '停止中']);
const STANDARD_PHASE_RANK = new Map([
  ['構想', 0],
  ['設計', 1],
  ['実装', 2],
  ['テスト', 3],
  ['運用', 4],
  ['安定運用', 5],
]);
const TASK_TYPE_TO_PHASE = new Map([
  ['設計', '設計'],
  ['開発', '実装'],
  ['テスト', 'テスト'],
  ['実行', '運用'],
  ['Ops', '運用'],
]);
const DEFAULT_LIFECYCLE_ALLOWLIST_FILE = 'ai-os/lifecycle-projects.json';

function ensureHeaders(row, expected, label) {
  const matches = expected.every((value, index) => row[index] === value);
  if (!matches) {
    throw new Error(`${label} header mismatch: ${JSON.stringify(row)}`);
  }
}

function normalizeDate(value) {
  if (!value) {
    return '';
  }
  return String(value).slice(0, 10);
}

function todayString() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

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

function parseNotes(value = '') {
  const parts = String(value || '')
    .split(' | ')
    .map((part) => part.trim())
    .filter(Boolean);
  const keyed = new Map();
  const freeText = [];

  for (const part of parts) {
    const delimiter = part.indexOf('=');
    if (delimiter > 0) {
      const key = part.slice(0, delimiter);
      const noteValue = part.slice(delimiter + 1);
      if (NOTE_KEYS.includes(key) && !keyed.has(key)) {
        keyed.set(key, noteValue);
        continue;
      }
    }
    freeText.push(part);
  }

  return { keyed, freeText };
}

function parseProgressPercent(notes = '') {
  const match = String(notes).match(/(?:^|\| )progress=(\d+)%/);
  if (!match) {
    return 0;
  }
  return Number.parseInt(match[1], 10) || 0;
}

function buildNotesWithProgress(existingNotes, nextProgress) {
  const { keyed, freeText } = parseNotes(existingNotes);
  if (nextProgress > 0) {
    keyed.set('progress', `${nextProgress}%`);
  }
  const ordered = NOTE_KEYS
    .map((key) => (keyed.has(key) ? `${key}=${keyed.get(key)}` : ''))
    .filter(Boolean);
  return [...ordered, ...freeText].join(' | ');
}

function sortTasks(tasks) {
  return [...tasks].sort((a, b) => {
    const statusDiff = (STATUS_PRIORITY.get(a.status) ?? 99) - (STATUS_PRIORITY.get(b.status) ?? 99);
    if (statusDiff !== 0) {
      return statusDiff;
    }
    const priorityDiff = (PRIORITY_ORDER.get(a.priority) ?? 99) - (PRIORITY_ORDER.get(b.priority) ?? 99);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    const dateA = normalizeDate(a.plannedDate) || '9999-99-99';
    const dateB = normalizeDate(b.plannedDate) || '9999-99-99';
    if (dateA !== dateB) {
      return dateA.localeCompare(dateB);
    }
    return a.rowNumber - b.rowNumber;
  });
}

function pickNextAction(openTasks, existingNextAction) {
  if (openTasks.length === 0) {
    return existingNextAction || '';
  }
  return openTasks[0].title || existingNextAction || '';
}

function pickBlocker(openTasks, existingBlocker) {
  if (openTasks.length === 0) {
    return existingBlocker || '';
  }
  const current = openTasks[0];
  if ((current.status === '待機' || current.status === '停止中') && current.dependency) {
    return current.dependency;
  }
  return '';
}

function computeProgress(tasks, existingProgress) {
  const total = tasks.length;
  if (total === 0) {
    return existingProgress;
  }
  const done = tasks.filter((task) => task.status === '完了').length;
  const queueProgress = Math.round((done / total) * 100);
  return Math.max(existingProgress, queueProgress);
}

function rowsToProjects(rows) {
  return rows.slice(3)
    .filter((row) => row.some((cell) => String(cell || '').trim() !== ''))
    .map((row, index) => ({
      rowNumber: index + 4,
      project_id: row[0] || '',
      project_name: row[1] || '',
      directory: row[2] || '',
      status: row[3] || '',
      phase: row[4] || '',
      priority: row[5] || '',
      last_updated: row[6] || '',
      next_action: row[7] || '',
      blocker: row[8] || '',
      notes: row[9] || '',
    }));
}

function taskRowToTask(row, rowNumber) {
  return {
    rowNumber,
    title: row[0] || '',
    project: row[1] || '',
    type: row[2] || '',
    priority: row[3] || '',
    status: row[4] || '',
    assignedTo: row[5] || '',
    plannedDate: row[6] || '',
    doneDate: row[7] || '',
    dependency: row[8] || '',
    score: row[9] || '',
    notes: row[10] || '',
  };
}

function rowsToTasks(rows) {
  return rows.slice(3)
    .filter((row) => row.some((cell) => String(cell || '').trim() !== ''))
    .map((row, index) => taskRowToTask(row, index + 4));
}

function applyTaskQueueRowOverride(tasks, override) {
  if (!override || !Array.isArray(override.values)) {
    return tasks;
  }
  const nextTasks = tasks.filter((task) => task.rowNumber !== override.rowNumber);
  nextTasks.push(taskRowToTask(override.values, override.rowNumber));
  return nextTasks;
}

function findProject(projects, projectRef) {
  if (!projectRef) {
    return null;
  }
  const normalized = String(projectRef).trim();
  return projects.find((project) => project.project_id === normalized || project.project_name === normalized) ?? null;
}

function computeLifecycleSuggestion(project, openTasks) {
  const activeTasks = sortTasks(openTasks.filter((task) => ACTIVE_TASK_STATUSES.has(task.status)));
  const reasons = [];
  let suggestedStatus = project.status || '';
  let suggestedPhase = project.phase || '';
  let phaseSourceTask = null;

  if (project.status === '保留' && activeTasks.length > 0) {
    suggestedStatus = '進行中';
    reasons.push(`active task resumed parked project: ${activeTasks[0].title}`);
  }

  const currentPhaseRank = STANDARD_PHASE_RANK.get(project.phase);
  if (currentPhaseRank !== undefined) {
    let bestPhase = project.phase;
    let bestRank = currentPhaseRank;

    for (const task of activeTasks) {
      const candidatePhase = TASK_TYPE_TO_PHASE.get(task.type);
      const candidateRank = STANDARD_PHASE_RANK.get(candidatePhase);
      if (candidateRank === undefined || candidateRank <= bestRank) {
        continue;
      }
      bestPhase = candidatePhase;
      bestRank = candidateRank;
      phaseSourceTask = task;
    }

    if (bestPhase !== project.phase && phaseSourceTask) {
      suggestedPhase = bestPhase;
      reasons.push(`active ${phaseSourceTask.type} task suggests phase ${bestPhase}: ${phaseSourceTask.title}`);
    }
  }

  return {
    changed: suggestedStatus !== project.status || suggestedPhase !== project.phase,
    statusChanged: suggestedStatus !== project.status,
    phaseChanged: suggestedPhase !== project.phase,
    status: suggestedStatus,
    phase: suggestedPhase,
    reasons,
    activeTaskCount: activeTasks.length,
  };
}

function getProjectRefs(project) {
  return [project.project_id, project.project_name, project.directory]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function evaluateLifecyclePermission(project, applyLifecycle, lifecycleAllowlist) {
  if (!applyLifecycle) {
    return {
      requested: false,
      enabled: false,
      reason: 'preview only',
    };
  }

  if (!(lifecycleAllowlist instanceof Set) || lifecycleAllowlist.size === 0) {
    return {
      requested: true,
      enabled: false,
      reason: 'no lifecycle allowlist configured',
    };
  }

  const refs = getProjectRefs(project);
  const enabled = refs.some((ref) => lifecycleAllowlist.has(ref));
  return {
    requested: true,
    enabled,
    reason: enabled ? 'project matched lifecycle allowlist' : 'project not in lifecycle allowlist',
    refs,
  };
}

export async function syncProjectFromTaskQueue({
  context,
  projectRef,
  eventDate = '',
  shouldWrite = false,
  applyLifecycle = false,
  lifecycleProjectAllowlist = null,
  taskQueueRowOverride = null,
}) {
  const [projectsData, tasksData] = await Promise.all([
    getSheetValues({
      spreadsheetId: context.spreadsheetId,
      sheetName: 'Projects',
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

  ensureHeaders(projectsData.values?.[2] ?? [], PROJECT_HEADERS, 'Projects');
  ensureHeaders(tasksData.values?.[2] ?? [], TASK_HEADERS, 'Task_Queue');

  const projects = rowsToProjects(projectsData.values ?? []);
  const tasks = applyTaskQueueRowOverride(rowsToTasks(tasksData.values ?? []), taskQueueRowOverride);
  const project = findProject(projects, projectRef);
  if (!project) {
    return { skipped: true, reason: `No canonical Projects row matched: ${projectRef}` };
  }

  const projectTasks = tasks.filter((task) => task.project === project.project_name);
  if (projectTasks.length === 0) {
    return { skipped: true, reason: `No Task_Queue rows matched project: ${project.project_name}`, project };
  }

  const openTasks = sortTasks(projectTasks.filter((task) => task.status !== '完了'));
  const lastUpdated = normalizeDate(eventDate) || todayString();
  const existingProgress = parseProgressPercent(project.notes);
  const nextProgress = computeProgress(projectTasks, existingProgress);
  const nextAction = pickNextAction(openTasks, project.next_action);
  const nextBlocker = pickBlocker(openTasks, project.blocker);
  const nextNotes = buildNotesWithProgress(project.notes, nextProgress);
  const lifecycle = computeLifecycleSuggestion(project, openTasks);
  const lifecyclePermission = evaluateLifecyclePermission(project, applyLifecycle, lifecycleProjectAllowlist);
  const lifecycleWriteEnabled = lifecycle.changed && lifecyclePermission.enabled;
  const nextStatus = lifecycleWriteEnabled ? lifecycle.status : project.status;
  const nextPhase = lifecycleWriteEnabled ? lifecycle.phase : project.phase;
  const nextRow = [
    project.project_id,
    project.project_name,
    project.directory,
    nextStatus,
    nextPhase,
    project.priority,
    lastUpdated,
    nextAction,
    nextBlocker,
    nextNotes,
  ];

  const result = {
    skipped: false,
    project,
    taskCount: projectTasks.length,
    openTaskCount: openTasks.length,
    computedProgress: nextProgress,
    targetRange: `Projects!A${project.rowNumber}:J${project.rowNumber}`,
    nextRow,
    lifecycle,
    lifecyclePermission,
    lifecycleWriteEnabled,
    applyLifecycle,
  };

  if (!shouldWrite) {
    return result;
  }

  const updateResult = await updateSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: 'Projects',
    range: `A${project.rowNumber}:J${project.rowNumber}`,
    values: [nextRow],
    accessToken: context.accessToken,
  });

  return {
    ...result,
    updateResult,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const context = await getAuthorizedContext(args);
  const shouldWrite = args.write === 'true';
  const applyLifecycle = args['apply-status-phase'] === 'true';
  const lifecycleProjectAllowlist = resolveLifecycleAllowlist(args);
  const projectRef = args.project || args['project-id'] || args['project-name'];
  const eventDate = args['event-date'] || '';

  if (!projectRef) {
    throw new Error('Pass --project, --project-id, or --project-name.');
  }

  const result = await syncProjectFromTaskQueue({
    context,
    projectRef,
    eventDate,
    shouldWrite,
    applyLifecycle,
    lifecycleProjectAllowlist,
  });

  if (result.skipped) {
    console.log(`[INFO] Sync skipped: ${result.reason}`);
    return;
  }

  console.log(`[INFO] Project      : ${result.project.project_name}`);
  console.log(`[INFO] Target range : ${result.targetRange}`);
  console.log(`[INFO] Task count    : ${result.taskCount}`);
  console.log(`[INFO] Open tasks    : ${result.openTaskCount}`);
  console.log(`[INFO] Progress      : ${result.computedProgress}%`);
  console.log(`[INFO] Row payload   : ${JSON.stringify(result.nextRow)}`);

  if (result.lifecycle.changed) {
    if (result.lifecycle.statusChanged) {
      console.log(`[INFO] Status preview: ${result.project.status} -> ${result.lifecycle.status}`);
    }
    if (result.lifecycle.phaseChanged) {
      console.log(`[INFO] Phase preview : ${result.project.phase} -> ${result.lifecycle.phase}`);
    }
    console.log(`[INFO] Lifecycle note: ${result.lifecycle.reasons.join(' | ')}`);
    if (!applyLifecycle) {
      console.log('[INFO] Lifecycle apply: preview only. Pass --apply-status-phase and use the lifecycle allowlist to include status/phase in Projects writes.');
    } else if (!result.lifecyclePermission.enabled) {
      console.log(`[INFO] Lifecycle apply: blocked (${result.lifecyclePermission.reason}).`);
    } else if (!shouldWrite) {
      console.log('[INFO] Lifecycle apply: previewing a status/phase write because the lifecycle allowlist matched.');
    }
  } else {
    console.log('[INFO] Lifecycle preview: no guarded status/phase change suggested.');
  }

  if (!shouldWrite) {
    console.log('[INFO] Dry run mode. Pass --write to update the live Projects sheet.');
    return;
  }

  console.log(`[OK] Project sync succeeded: ${result.updateResult.updatedRange ?? result.targetRange}`);
  if (applyLifecycle && result.lifecycle.changed) {
    if (result.lifecycleWriteEnabled) {
      console.log('[OK] Lifecycle apply: status/phase changes were included in the Projects write.');
    } else {
      console.log(`[INFO] Lifecycle apply: status/phase write was skipped (${result.lifecyclePermission.reason}).`);
    }
  }
}

const isDirectRun = process.argv[1] && new URL(import.meta.url).pathname.endsWith(process.argv[1].replace(/\\/g, '/'));

if (isDirectRun) {
  main().catch((error) => {
    console.error(`[ERR] ${error.message}`);
    process.exit(1);
  });
}