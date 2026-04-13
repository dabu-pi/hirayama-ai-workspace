#!/usr/bin/env node

import {
  getAuthorizedContext,
  parseArgs,
  updateSheetValues,
} from './lib-sheets.mjs';

const CANONICAL_COLUMNS = [
  ['status', ['稼働中', '進行中', '試作', '保留', '完了']],
  ['phase', ['構想', '設計', '実装', 'テスト', '運用', '安定運用', 'Phase1', 'Phase2', 'Phase3', 'Phase4', 'PhaseB', 'Ops']],
  ['type', ['本番', '試行', 'ローカル専用', 'なし']],
  ['system', ['Sheets', 'GitHub', 'GAS', 'Claude', 'ChatGPT', 'Codex', 'freee', 'Local']],
  ['assigned_to', ['AI', '人', 'AI+人']],
  ['task_status', ['未着手', '進行中', '待機', '停止中', '完了']],
  ['task_type', ['実行', 'テスト', '開発', '文書', '調査', '設計', 'Ops']],
  ['priority', ['高', '中', '低']],
  ['idea_status', ['アイデア', '調査中', '計画済み', '保留', 'プロジェクト化済み']],
];

const TOTAL_COLUMNS = 12;

function padRow(values) {
  const padded = [...values];
  while (padded.length < TOTAL_COLUMNS) {
    padded.push('');
  }
  return padded.slice(0, TOTAL_COLUMNS);
}

function buildRows() {
  const maxLength = Math.max(...CANONICAL_COLUMNS.map(([, values]) => values.length));
  const rows = [padRow(CANONICAL_COLUMNS.map(([header]) => header))];

  for (let rowIndex = 0; rowIndex < maxLength; rowIndex += 1) {
    rows.push(padRow(CANONICAL_COLUMNS.map(([, values]) => values[rowIndex] ?? '')));
  }

  return rows;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const context = await getAuthorizedContext(args);
  const values = buildRows();
  const isWrite = args.write === 'true';
  const lastRow = values.length;

  console.log(`[INFO] Target range : Lists!A1:L${lastRow}`);
  console.log(`[INFO] Header row   : ${JSON.stringify(values[0])}`);
  console.log(`[INFO] Row 2        : ${JSON.stringify(values[1])}`);
  console.log(`[INFO] Row ${lastRow}        : ${JSON.stringify(values[lastRow - 1])}`);

  if (!isWrite) {
    console.log('[INFO] Dry run mode. Pass --write to update the live Lists sheet.');
    return;
  }

  const result = await updateSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: 'Lists',
    range: `A1:L${lastRow}`,
    values,
    accessToken: context.accessToken,
  });

  console.log(`[OK] Updated Lists canonical vocabulary: ${result.updatedRange ?? `Lists!A1:L${lastRow}`}`);
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
