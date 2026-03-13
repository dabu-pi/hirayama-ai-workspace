#!/usr/bin/env node

export const REPO_BASE_URL = 'https://github.com/dabu-pi/hirayama-ai-workspace';
export const REPO_BRANCH = 'feature/auto-dev-phase3-loop';

export const PROJECT_HEADERS_V2 = [
  'project_id',
  '案件名',
  '状態',
  '段階',
  '優先度',
  '次アクション',
  '最終更新日',
  'メインシートURL',
  'SPEC URL',
  'フォルダURL',
  'GitHub URL',
  'ローカルパス',
  '補足',
];

export const TASK_HEADERS_V2 = [
  'task_id',
  'タスク',
  'project_id',
  '案件名',
  '種別',
  '優先度区分',
  '基本優先度',
  '優先度調整',
  '最終優先度',
  '状態',
  '担当',
  '期限',
  '完了日',
  '依存',
  'メモ',
];

export const IDEA_HEADERS_V2 = [
  'idea_id',
  'アイデア',
  'project_id',
  '案件名',
  '段階',
  '重要度',
  '工数',
  '概要',
  '次回確認日',
  'メモ',
];

export const PRIORITY_ADJUST_HEADERS = [
  'task_id',
  'タスク',
  'project_id',
  '今日優先',
  '調整値',
  '理由',
  'メモ',
];

export const LISTS_HEADERS_V2 = [
  '案件状態',
  '作業段階',
  '担当',
  'タスク状態',
  'タスク種別',
  '優先度区分',
  'アイデア段階',
  'project_id',
  '実行元',
];

export const PROJECT_STATUS_VALUES = ['本番運用中', '進行中', '保留', '構想', 'アーカイブ'];
export const PROJECT_STAGE_VALUES = ['構想', '設計', 'SPEC作成', '実装', '試作', 'テスト', '運用'];
export const TASK_STATUS_VALUES = ['未着手', '進行中', '待機', '保留', '完了'];
export const TASK_TYPE_VALUES = ['実装', 'テスト', '設計', '調査', '文書', '運用', '確認'];
export const PRIORITY_LABEL_VALUES = ['最優先', '高', '中', '低'];
export const IDEA_STAGE_VALUES = [
  'メモ',
  '概要あり',
  '検討中',
  'SPEC作成中',
  'SPEC完成',
  'フォルダ作成済み',
  '試作中',
  '案件化済み',
  '保留',
  'アーカイブ',
];
export const ASSIGNEE_VALUES = ['AI', '人', 'AI+人'];
export const SYSTEM_VALUES = ['Codex', 'GitHub', 'GAS', 'Google Sheets', '人'];

const PRIORITY_SCORE_MAP = new Map([
  ['最優先', 90],
  ['高', 70],
  ['中', 50],
  ['低', 30],
  ['High', 70],
  ['Medium', 50],
  ['Low', 30],
]);

const LEGACY_PRIORITY_TO_LABEL = new Map([
  ['High', '高'],
  ['Medium', '中'],
  ['Low', '低'],
  ['高', '高'],
  ['中', '中'],
  ['低', '低'],
]);

const LEGACY_TASK_TYPE_TO_V2 = new Map([
  ['Run', '確認'],
  ['Ops', '運用'],
  ['Test', 'テスト'],
  ['Dev', '実装'],
  ['Docs', '文書'],
  ['Research', '調査'],
  ['Design', '設計'],
  ['実行', '確認'],
  ['運用', '運用'],
  ['テスト', 'テスト'],
  ['開発', '実装'],
  ['文書', '文書'],
  ['調査', '調査'],
  ['設計', '設計'],
]);

const LEGACY_TASK_STATUS_TO_V2 = new Map([
  ['Pending', '未着手'],
  ['In Progress', '進行中'],
  ['Waiting', '待機'],
  ['Blocked', '保留'],
  ['Done', '完了'],
  ['未着手', '未着手'],
  ['進行中', '進行中'],
  ['待機', '待機'],
  ['停止中', '保留'],
  ['保留', '保留'],
  ['完了', '完了'],
]);

const LEGACY_ASSIGNEE_TO_V2 = new Map([
  ['Human', '人'],
  ['AI', 'AI'],
  ['人', '人'],
  ['AI+Human', 'AI+人'],
  ['AI+人', 'AI+人'],
]);

const LEGACY_IDEA_STAGE_TO_V2 = new Map([
  ['Idea', 'メモ'],
  ['アイデア', 'メモ'],
  ['Research', '検討中'],
  ['調査中', '検討中'],
  ['Planned', '概要あり'],
  ['計画済み', '概要あり'],
  ['Parked', '保留'],
  ['保留', '保留'],
  ['Converted', '案件化済み'],
  ['プロジェクト化済み', '案件化済み'],
]);

export const CANONICAL_PROJECTS = [
  {
    project_id: 'JREC-01',
    project_name: '柔整毎日記録システム',
    directory: 'gas-projects/jyu-gas-ver3.1',
    status: '本番運用中',
    stage: 'テスト',
    priority: '最優先',
    main_sheet_name: '【毎日記録】来店管理施術録ver3.1',
    main_sheet_id: '',
    folder_url: '',
    spec_path: 'gas-projects/jyu-gas-ver3.1/SPEC.md',
    notes: 'Projects を案件名・リンクの正本にする。メインシートURLは Drive 検索フォールバック。',
    aliases: ['柔整GASシステム', '柔整毎日記録システム', 'gas-projects/jyu-gas-ver3.1'],
  },
  {
    project_id: 'JBIZ-04',
    project_name: '接骨院経営戦略AI',
    directory: 'hirayama-jyusei-strategy',
    status: '進行中',
    stage: '設計',
    priority: '高',
    main_sheet_name: '平山接骨院 慢性疼痛強化プロジェクト 管理表',
    main_sheet_id: '1FnJdALwFSv48WiD6NWr0DzG78kwB692R2pFeiTcZlCc',
    folder_url: '',
    spec_path: 'hirayama-jyusei-strategy/SPEC.md',
    notes: '数値入力と実装開始待ち。Spreadsheet URL は確定済み。',
    aliases: ['接骨院戦略AI', '接骨院経営戦略AI', 'hirayama-jyusei-strategy'],
  },
  {
    project_id: 'HAIKI-05',
    project_name: '廃棄物日報システム',
    directory: 'waste-report-system',
    status: '進行中',
    stage: '設計',
    priority: '高',
    main_sheet_name: '【UI日報・月報】2026年一般廃棄物業務報告書（日報・月報）',
    main_sheet_id: '',
    folder_url: '',
    spec_path: 'waste-report-system/SPEC.md',
    notes: '仕様整理を優先。メインシートURLは Drive 検索フォールバック。',
    aliases: ['廃棄物日報GAS', '廃棄物日報システム', 'waste-report-system'],
  },
  {
    project_id: 'JWEB-03',
    project_name: '患者管理Webアプリ',
    directory: 'patient-management',
    status: '進行中',
    stage: '実装',
    priority: '高',
    main_sheet_name: '整骨院 電子カルテ',
    main_sheet_id: '1rASJV_j8pGmXY5NhQrw4FKJY_eRy-iSPoGSh08gdLk0',
    folder_url: '',
    spec_path: 'patient-management/spec.md',
    notes: 'プロトタイプを整理しながら本番寄せ。Spreadsheet URL は確定済み。',
    aliases: ['患者管理Webアプリ', 'patient-management'],
  },
];

const PROJECT_ID_BY_ALIAS = new Map();
for (const project of CANONICAL_PROJECTS) {
  PROJECT_ID_BY_ALIAS.set(project.project_id, project.project_id);
  PROJECT_ID_BY_ALIAS.set(project.project_name, project.project_id);
  PROJECT_ID_BY_ALIAS.set(project.directory, project.project_id);
  for (const alias of project.aliases) {
    PROJECT_ID_BY_ALIAS.set(alias, project.project_id);
  }
}

export function githubTreeUrl(directory) {
  return `${REPO_BASE_URL}/tree/${REPO_BRANCH}/${directory}`;
}

export function githubBlobUrl(filePath) {
  return `${REPO_BASE_URL}/blob/${REPO_BRANCH}/${filePath}`;
}

export function driveSearchUrl(name) {
  return `https://drive.google.com/drive/search?q=${encodeURIComponent(`"${name}"`)}`;
}

export function sheetUrl(sheetId, sheetName = '') {
  if (sheetId) {
    return `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
  }
  return sheetName ? driveSearchUrl(sheetName) : '';
}

export function projectById(projectId) {
  return CANONICAL_PROJECTS.find((project) => project.project_id === projectId) ?? null;
}

export function mapProjectRefToId(value) {
  if (!value) {
    return '';
  }
  return PROJECT_ID_BY_ALIAS.get(String(value).trim()) ?? '';
}

export function projectNameById(projectId) {
  return projectById(projectId)?.project_name ?? '';
}

export function toIsoDate(value) {
  if (!value) {
    return '';
  }
  return String(value).slice(0, 10);
}

export function normalizeTaskPriorityLabel(value) {
  if (!value) {
    return '中';
  }
  return LEGACY_PRIORITY_TO_LABEL.get(String(value).trim()) ?? String(value).trim();
}

export function priorityLabelToScore(value) {
  return PRIORITY_SCORE_MAP.get(normalizeTaskPriorityLabel(value)) ?? 50;
}

export function normalizeTaskType(value) {
  if (!value) {
    return '調査';
  }
  return LEGACY_TASK_TYPE_TO_V2.get(String(value).trim()) ?? String(value).trim();
}

export function normalizeTaskStatus(value) {
  if (!value) {
    return '未着手';
  }
  return LEGACY_TASK_STATUS_TO_V2.get(String(value).trim()) ?? String(value).trim();
}

export function normalizeAssignee(value) {
  if (!value) {
    return 'AI';
  }
  return LEGACY_ASSIGNEE_TO_V2.get(String(value).trim()) ?? String(value).trim();
}

export function normalizeIdeaStage(value, title = '', notes = '') {
  const normalized = LEGACY_IDEA_STAGE_TO_V2.get(String(value || '').trim());
  if (normalized) {
    if (normalized === '概要あり' && /Task化/.test(String(notes || ''))) {
      return '案件化済み';
    }
    return normalized;
  }
  if (/Task化/.test(String(notes || ''))) {
    return '案件化済み';
  }
  if (/spec/i.test(String(title || ''))) {
    return 'SPEC作成中';
  }
  return 'メモ';
}

export function buildListsRows() {
  const columns = [
    PROJECT_STATUS_VALUES,
    PROJECT_STAGE_VALUES,
    ASSIGNEE_VALUES,
    TASK_STATUS_VALUES,
    TASK_TYPE_VALUES,
    PRIORITY_LABEL_VALUES,
    IDEA_STAGE_VALUES,
    CANONICAL_PROJECTS.map((project) => project.project_id),
    SYSTEM_VALUES,
  ];
  const maxRows = Math.max(...columns.map((column) => column.length));
  const rows = [LISTS_HEADERS_V2];
  for (let index = 0; index < maxRows; index += 1) {
    rows.push(columns.map((column) => column[index] ?? ''));
  }
  return rows;
}

export function sortTasksForDisplay(tasks) {
  return [...tasks].sort((left, right) => {
    const finalDiff = (Number(right.final_priority) || 0) - (Number(left.final_priority) || 0);
    if (finalDiff !== 0) {
      return finalDiff;
    }
    const dueLeft = left.due_date || '9999-99-99';
    const dueRight = right.due_date || '9999-99-99';
    if (dueLeft !== dueRight) {
      return dueLeft.localeCompare(dueRight);
    }
    return left.task_id.localeCompare(right.task_id);
  });
}
