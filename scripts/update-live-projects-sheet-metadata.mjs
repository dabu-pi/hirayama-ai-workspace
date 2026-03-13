#!/usr/bin/env node

import {
  getAuthorizedContext,
  getSheetValues,
  parseArgs,
  updateSheetValues,
} from './lib-sheets.mjs';

const BASE_HEADERS = [
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

const EXTRA_HEADERS = [
  'local_folder',
  'main_sheet_name',
  'main_sheet_id',
  'current_folder',
  'target_folder',
  'sheet_status',
  'cleanup_status',
  'evidence_note',
];

const PROJECT_METADATA = [
  {
    project_id: 'FREEE-02',
    project_name: 'freee見積自動化',
    directory: 'freee-automation',
    local_folder: 'workspace/freee-automation',
    main_sheet_name: '2024長谷川さん管理シート',
    main_sheet_id: '1TMKQO4zYwk1kWgkfoCR4K7jTeIxNxsS1B8uh7t8nd2c',
    current_folder: '',
    target_folder: 'hirayama-ai-workspace',
    sheet_status: 'active',
    cleanup_status: 'needs_review',
    evidence_note: 'main_sheet_name and id are confirmed from local docs/code. current_folder is still unverified.',
  },
  {
    project_id: 'JREC-01',
    project_name: '柔整毎日記録システム',
    directory: 'gas-projects/jyu-gas-ver3.1',
    local_folder: 'workspace/gas-projects/jyu-gas-ver3.1',
    main_sheet_name: '【毎日記録】来店管理施術録ver3.1',
    main_sheet_id: '',
    current_folder: '',
    target_folder: 'hirayama-ai-workspace',
    sheet_status: 'active',
    cleanup_status: 'clean',
    evidence_note: 'Current operational source of truth. Do not treat 整骨院 電子カルテ as the live main sheet. main_sheet_id and current_folder still need Drive confirmation.',
  },
  {
    project_id: 'WEB-03',
    project_name: '患者管理Webアプリ',
    directory: 'patient-management',
    local_folder: 'workspace/patient-management',
    main_sheet_name: '整骨院 電子カルテ',
    main_sheet_id: '1rASJV_j8pGmXY5NhQrw4FKJY_eRy-iSPoGSh08gdLk0',
    current_folder: 'My Drive',
    target_folder: 'hirayama-ai-workspace/archive',
    sheet_status: 'migration_target',
    cleanup_status: 'needs_migration',
    evidence_note: 'Stopped project. Migrate remaining handling to JREC-01, then keep this sheet as an archive candidate.',
  },
  {
    project_id: 'JBIZ-04',
    project_name: '接骨院経営戦略AI',
    directory: 'hirayama-jyusei-strategy',
    local_folder: 'workspace/hirayama-jyusei-strategy',
    main_sheet_name: '平山接骨院 慢性疼痛強化プロジェクト 管理表',
    main_sheet_id: '1FnJdALwFSv48WiD6NWr0DzG78kwB692R2pFeiTcZlCc',
    current_folder: 'My Drive',
    target_folder: 'hirayama-ai-workspace',
    sheet_status: 'active',
    cleanup_status: 'needs_review',
    evidence_note: 'Drive lookup confirmed this candidate sheet id and current_folder=My Drive. Duplicate check and target-folder move are still pending.',
  },
  {
    project_id: 'HAIKI-05',
    project_name: '廃棄物日報システム',
    directory: 'waste-report-system',
    local_folder: 'workspace/waste-report-system',
    main_sheet_name: '【UI日報・月報】2026年一般廃棄物業務報告書（日報・月報）',
    main_sheet_id: '',
    current_folder: '',
    target_folder: 'hirayama-ai-workspace',
    sheet_status: 'active',
    cleanup_status: 'needs_review',
    evidence_note: 'Canonical local_folder is fixed. Drive search did not yet expose the live sheet to the current service account.',
  },
  {
    project_id: 'AIOS-06',
    project_name: 'Hirayama AI OS',
    directory: 'ai-os',
    local_folder: 'workspace/ai-os',
    main_sheet_name: 'Hirayama_AI_OS_Dashboard',
    main_sheet_id: '1EvZMtMiX5TKsSBYPhF5VrCcK9JEWHhUHuuYkUTRSIfk',
    current_folder: '',
    target_folder: 'hirayama-ai-workspace',
    sheet_status: 'active',
    cleanup_status: 'clean',
    evidence_note: 'Dashboard spreadsheet itself is the main sheet for AIOS management.',
  },
  {
    project_id: 'AINV-07',
    project_name: 'AI投資プロジェクト',
    directory: 'ai-invest',
    local_folder: 'workspace/ai-invest',
    main_sheet_name: 'AI投資用スプレッドシート',
    main_sheet_id: '1HLKw4huGT9f_7g5vuIsPdtJZnI61vmXZIgalNLe8HLo',
    current_folder: '',
    target_folder: 'hirayama-ai-workspace',
    sheet_status: 'registration_candidate',
    cleanup_status: 'needs_review',
    evidence_note: 'Operational sheet id is recorded, but Drive current_folder is still unverified because the current service account cannot read the file yet.',
  },
];

const SHEET_STATUS_ALLOWED = new Set([
  'active',
  'migration_target',
  'archive_candidate',
  'registration_candidate',
  'unknown',
]);

const CLEANUP_STATUS_ALLOWED = new Set([
  'clean',
  'needs_review',
  'needs_migration',
  'archive_ready',
  'unknown',
]);

function ensureBaseHeaders(row = []) {
  const actual = row.slice(0, BASE_HEADERS.length);
  const matches = BASE_HEADERS.every((value, index) => actual[index] === value);
  if (!matches) {
    throw new Error(`Projects header mismatch: ${JSON.stringify(row)}`);
  }
}

function ensureStatusValues(entry) {
  if (!SHEET_STATUS_ALLOWED.has(entry.sheet_status)) {
    throw new Error(`Invalid sheet_status for ${entry.project_id}: ${entry.sheet_status}`);
  }
  if (!CLEANUP_STATUS_ALLOWED.has(entry.cleanup_status)) {
    throw new Error(`Invalid cleanup_status for ${entry.project_id}: ${entry.cleanup_status}`);
  }
}

function extraRow(entry) {
  return EXTRA_HEADERS.map((header) => entry[header] ?? '');
}

function buildAinvRow(entry) {
  return [
    entry.project_id,
    entry.project_name,
    entry.directory,
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    ...extraRow(entry),
  ];
}

async function getFormulaRange({ spreadsheetId, accessToken, range }) {
  const encoded = encodeURIComponent(range);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encoded}?valueRenderOption=FORMULA`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Formula read failed (${response.status}): ${text}`);
  }

  return response.json();
}

function rowsToComparableStrings(values = []) {
  return values.map((row) => JSON.stringify(row));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const context = await getAuthorizedContext(args);
  const isWrite = args.write === 'true';

  for (const entry of PROJECT_METADATA) {
    ensureStatusValues(entry);
  }

  const beforeProjects = await getSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: 'Projects',
    range: '1:30',
    accessToken: context.accessToken,
  });
  const beforeDashboard = await getFormulaRange({
    spreadsheetId: context.spreadsheetId,
    accessToken: context.accessToken,
    range: 'Dashboard!H11:N18',
  });
  const beforeMetrics = await getFormulaRange({
    spreadsheetId: context.spreadsheetId,
    accessToken: context.accessToken,
    range: 'Metrics!A1:F15',
  });

  const rows = beforeProjects.values ?? [];
  ensureBaseHeaders(rows[2] ?? []);

  const bodyRows = rows.slice(3);
  const rowIndexByProjectId = new Map();
  bodyRows.forEach((row, index) => {
    const projectId = String(row[0] || '').trim();
    if (projectId) {
      rowIndexByProjectId.set(projectId, index + 4);
    }
  });

  const nextAvailableRow = bodyRows.reduce((max, row, index) => {
    const hasContent = row.some((cell) => String(cell || '').trim() !== '');
    return hasContent ? Math.max(max, index + 4) : max;
  }, 3) + 1;

  const metadataMatrix = [EXTRA_HEADERS];
  const existingProjectRows = [];
  let ainvRowNumber = rowIndexByProjectId.get('AINV-07') || null;

  for (const entry of PROJECT_METADATA) {
    if (entry.project_id === 'AINV-07') {
      continue;
    }
    const rowNumber = rowIndexByProjectId.get(entry.project_id);
    if (!rowNumber) {
      throw new Error(`Existing live row not found for ${entry.project_id}`);
    }
    existingProjectRows.push(rowNumber);
    metadataMatrix.push(extraRow(entry));
  }

  if (!ainvRowNumber) {
    ainvRowNumber = nextAvailableRow;
  }

  console.log(`[INFO] Existing project rows : ${existingProjectRows.join(', ')}`);
  console.log(`[INFO] AINV-07 row          : ${ainvRowNumber}${rowIndexByProjectId.has('AINV-07') ? ' (existing)' : ' (new)'}`);
  console.log(`[INFO] Header write range   : Projects!K3:R${3 + metadataMatrix.length - 1}`);
  console.log('[INFO] Metadata columns     :', EXTRA_HEADERS.join(', '));

  if (!isWrite) {
    console.log('[INFO] Dry run mode. Pass --write true to update the live Projects sheet.');
    return;
  }

  await updateSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: 'Projects',
    range: `K3:R${3 + metadataMatrix.length - 1}`,
    values: metadataMatrix,
    accessToken: context.accessToken,
  });

  if (ainvRowNumber === nextAvailableRow && !rowIndexByProjectId.has('AINV-07')) {
    const ainv = PROJECT_METADATA.find((entry) => entry.project_id === 'AINV-07');
    await updateSheetValues({
      spreadsheetId: context.spreadsheetId,
      sheetName: 'Projects',
      range: `A${ainvRowNumber}:R${ainvRowNumber}`,
      values: [buildAinvRow(ainv)],
      accessToken: context.accessToken,
    });
  } else {
    const ainv = PROJECT_METADATA.find((entry) => entry.project_id === 'AINV-07');
    await updateSheetValues({
      spreadsheetId: context.spreadsheetId,
      sheetName: 'Projects',
      range: `K${ainvRowNumber}:R${ainvRowNumber}`,
      values: [extraRow(ainv)],
      accessToken: context.accessToken,
    });
  }

  const afterDashboard = await getFormulaRange({
    spreadsheetId: context.spreadsheetId,
    accessToken: context.accessToken,
    range: 'Dashboard!H11:N18',
  });
  const afterMetrics = await getFormulaRange({
    spreadsheetId: context.spreadsheetId,
    accessToken: context.accessToken,
    range: 'Metrics!A1:F15',
  });

  const dashboardUnchanged = JSON.stringify(rowsToComparableStrings(beforeDashboard.values)) === JSON.stringify(rowsToComparableStrings(afterDashboard.values));
  const metricsUnchanged = JSON.stringify(rowsToComparableStrings(beforeMetrics.values)) === JSON.stringify(rowsToComparableStrings(afterMetrics.values));

  console.log(`[OK] Updated Projects metadata columns through row ${ainvRowNumber}.`);
  console.log(`[OK] Dashboard formulas unchanged: ${dashboardUnchanged}`);
  console.log(`[OK] Metrics formulas unchanged  : ${metricsUnchanged}`);

  if (!dashboardUnchanged || !metricsUnchanged) {
    throw new Error('Formula verification failed after write.');
  }
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
