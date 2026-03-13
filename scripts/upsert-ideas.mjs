#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import {
  getAuthorizedContext,
  getSheetValues,
  parseArgs,
  updateSheetValues,
} from './lib-sheets.mjs';

const LIVE_HEADERS = [
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

const DOMAIN_MAP = new Map([
  ['Infrastructure', '基盤'],
  ['Foundation', '基盤'],
  ['Strategy', '戦略'],
  ['Medical', '医療'],
  ['Automation', '自動化'],
  ['GAS', 'GAS'],
]);

const STATUS_MAP = new Map([
  ['Idea', 'アイデア'],
  ['Research', '調査中'],
  ['Planned', '計画済み'],
  ['Parked', '保留'],
  ['Converted', 'プロジェクト化済み'],
  ['Converted to Project', 'プロジェクト化済み'],
]);

const IMPACT_MAP = new Map([
  ['High', '高'],
  ['Medium', '中'],
  ['Low', '低'],
]);

const EFFORT_MAP = new Map([
  ['Small', 'S'],
  ['Medium', 'M'],
  ['Large', 'L'],
  ['Extra Large', 'XL'],
  ['XLarge', 'XL'],
]);

const OWNER_MAP = new Map([
  ['Human', 'Human'],
  ['人', 'Human'],
  ['AI+人', 'AI+Human'],
]);

const RELATED_PROJECT_MAP = new Map([
  ['AINV-07', 'AI投資プロジェクト'],
  ['FREEE-02', 'freee見積自動化'],
  ['GAS-01', '柔整GASシステム'],
  ['WEB-03', '患者管理Webアプリ'],
  ['STR-04', '接骨院戦略AI'],
  ['WST-05', 'waste-report-system'],
  ['AIOS-06', 'Hirayama AI OS'],
  ['COMMON', 'workspace全体'],
]);

function loadJson(path) {
  const raw = readFileSync(path, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}

function ensureLiveHeaders(row = []) {
  const matches = LIVE_HEADERS.every((value, index) => row[index] === value);
  if (!matches) {
    throw new Error(`Ideas header mismatch: ${JSON.stringify(row)}`);
  }
}

function normalizeMappedValue(value, map) {
  if (!value) {
    return '';
  }
  return map.get(value) ?? value;
}

function normalizeRelatedProject(value) {
  if (!value) {
    return '';
  }
  return RELATED_PROJECT_MAP.get(value) ?? value;
}

function normalizeDate(value) {
  if (!value) {
    return '';
  }
  return String(value).slice(0, 10);
}

function buildLiveRow(entry, existingRow = []) {
  return [
    entry.title || existingRow[0] || '',
    normalizeMappedValue(entry.domain || existingRow[1] || '', DOMAIN_MAP),
    normalizeMappedValue(entry.status || existingRow[2] || '', STATUS_MAP),
    normalizeMappedValue(entry.impact || existingRow[3] || '', IMPACT_MAP),
    normalizeMappedValue(entry.effort || existingRow[4] || '', EFFORT_MAP),
    normalizeMappedValue(entry.owner || existingRow[5] || '', OWNER_MAP),
    normalizeRelatedProject(entry.related_project || entry.project || existingRow[6] || ''),
    entry.why_it_matters || entry.description || existingRow[7] || '',
    normalizeDate(entry.next_review || existingRow[8] || ''),
    entry.notes ?? existingRow[9] ?? '',
  ];
}

function pickEntry(args) {
  if (args.json) {
    return loadJson(args.json);
  }
  return {
    title: args.title,
    domain: args.domain,
    status: args.status,
    impact: args.impact,
    effort: args.effort,
    owner: args.owner,
    related_project: args['related-project'],
    project: args.project,
    why_it_matters: args['why-it-matters'],
    description: args.description,
    next_review: args['next-review'],
    notes: args.notes,
  };
}

function findExistingRow(bodyRows, entry) {
  const normalizedTitle = String(entry.title || '').trim();
  const normalizedProject = normalizeRelatedProject(String(entry.related_project || entry.project || '').trim());
  if (!normalizedTitle) {
    return -1;
  }

  if (normalizedProject) {
    return bodyRows.findIndex((row) => {
      const title = String(row[0] || '').trim();
      const relatedProject = String(row[6] || '').trim();
      return title === normalizedTitle && relatedProject === normalizedProject;
    });
  }

  return bodyRows.findIndex((row) => String(row[0] || '').trim() === normalizedTitle);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const context = await getAuthorizedContext(args);
  const entry = pickEntry(args);
  const isWrite = args.write === 'true';

  if (!entry.title) {
    throw new Error('Idea title is required. Pass --title or --json.');
  }

  const data = await getSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: 'Ideas',
    range: '1:300',
    accessToken: context.accessToken,
  });

  const rows = data.values ?? [];
  ensureLiveHeaders(rows[2] ?? []);

  const bodyRows = rows.slice(3).filter((row) => row.some((cell) => String(cell || '').trim() !== ''));
  const existingIndex = findExistingRow(bodyRows, entry);
  const targetRowNumber = existingIndex >= 0 ? existingIndex + 4 : bodyRows.length + 4;
  const existingRow = existingIndex >= 0 ? bodyRows[existingIndex] : [];
  const liveRow = buildLiveRow(entry, existingRow);
  const action = existingIndex >= 0 ? 'update' : 'append';

  console.log(`[INFO] Action      : ${action}`);
  console.log(`[INFO] Target row  : Ideas!A${targetRowNumber}:J${targetRowNumber}`);
  console.log(`[INFO] Idea        : ${liveRow[0]}`);
  console.log(`[INFO] Project     : ${liveRow[6]}`);
  console.log(`[INFO] Row payload : ${JSON.stringify(liveRow)}`);

  if (!isWrite) {
    console.log('[INFO] Dry run mode. Pass --write to update the live Ideas sheet.');
    return;
  }

  const result = await updateSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: 'Ideas',
    range: `A${targetRowNumber}:J${targetRowNumber}`,
    values: [liveRow],
    accessToken: context.accessToken,
  });

  console.log(`[OK] Ideas ${action} succeeded: ${result.updatedRange ?? `Ideas!A${targetRowNumber}:J${targetRowNumber}`}`);
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
