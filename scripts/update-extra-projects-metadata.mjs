#!/usr/bin/env node

import {
  getAuthorizedContext,
  getSheetValues,
  parseArgs,
  updateSheetValues,
} from './lib-sheets.mjs';

const REPO_BASE_URL = 'https://github.com/dabu-pi/hirayama-ai-workspace';
const REPO_BRANCH = 'feature/auto-dev-phase3-loop';

const PROJECT_UPDATES = new Map([
  [
    'AINV-07',
    {
      status: '構想',
      stage: '構想',
      specUrl: `${REPO_BASE_URL}/blob/${REPO_BRANCH}/ai-invest/INVESTMENT_POLICY.md`,
    },
  ],
  [
    'AIOS-06',
    {
      status: '進行中',
      stage: '運用',
      specUrl: `${REPO_BASE_URL}/blob/${REPO_BRANCH}/ai-os/spec.md`,
    },
  ],
  [
    'FREEE-02',
    {
      status: '本番運用中',
      stage: '運用',
      specUrl: `${REPO_BASE_URL}/blob/${REPO_BRANCH}/freee-automation/spec.md`,
    },
  ],
]);

const EXPECTED_HEADER = [
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

function assertHeader(row) {
  const matches = EXPECTED_HEADER.every((value, index) => row?.[index] === value);
  if (!matches) {
    throw new Error(`Projects header mismatch: ${JSON.stringify(row || [])}`);
  }
}

function buildUpdatedRow(row) {
  const projectId = String(row[0] || '').trim();
  const update = PROJECT_UPDATES.get(projectId);
  if (!update) {
    return null;
  }

  const nextRow = [...row];
  while (nextRow.length < EXPECTED_HEADER.length) {
    nextRow.push('');
  }
  nextRow[2] = update.status;
  nextRow[3] = update.stage;
  nextRow[8] = update.specUrl;
  return nextRow;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const isWrite = args.write === 'true';
  const context = await getAuthorizedContext(args);

  const data = await getSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: 'Projects',
    range: 'A1:M40',
    accessToken: context.accessToken,
  });

  const rows = data.values || [];
  assertHeader(rows[2]);

  const pendingWrites = [];
  for (let rowNumber = 4; rowNumber <= rows.length; rowNumber += 1) {
    const row = rows[rowNumber - 1] || [];
    const nextRow = buildUpdatedRow(row);
    if (!nextRow) {
      continue;
    }
    pendingWrites.push({
      rowNumber,
      before: row,
      after: nextRow,
    });
  }

  if (pendingWrites.length !== PROJECT_UPDATES.size) {
    throw new Error(`Expected ${PROJECT_UPDATES.size} target rows, found ${pendingWrites.length}.`);
  }

  pendingWrites.forEach((entry) => {
    console.log(`[INFO] Projects!A${entry.rowNumber}:M${entry.rowNumber}`);
    console.log(`       before: ${JSON.stringify(entry.before)}`);
    console.log(`       after : ${JSON.stringify(entry.after)}`);
  });

  if (!isWrite) {
    console.log('[INFO] Dry run mode. Pass --write true to update the live Projects rows.');
    return;
  }

  for (const entry of pendingWrites) {
    await updateSheetValues({
      spreadsheetId: context.spreadsheetId,
      sheetName: 'Projects',
      range: `A${entry.rowNumber}:M${entry.rowNumber}`,
      values: [entry.after],
      accessToken: context.accessToken,
    });
  }

  console.log(`[OK] Updated ${pendingWrites.length} extra Projects row(s).`);
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
