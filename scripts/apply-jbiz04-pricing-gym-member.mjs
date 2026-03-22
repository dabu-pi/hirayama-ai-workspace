#!/usr/bin/env node
/**
 * JBIZ-04: 価格設定シートに「ジム会員優待適用条件」セクションを追加する
 *
 * 追加内容（確定: 2026-03-22 / asago担当者確認済み）:
 *   - 最終方針: A案（asago全区分対象）
 *   - 証明方法: 会員番号記録
 *   - 慢性ケア手技50分: 通常5,500円 / 会員優待4,700円（確定）
 *   - 症状別初回評価: 通常3,300円 / 会員優待2,800円（仮）
 *
 * 追加場所: 既存 Row 18 の後（Row 19〜26 に追記）
 * 既存行の並べ替えは行わない。
 *
 * Usage:
 *   node scripts/apply-jbiz04-pricing-gym-member.mjs          # dry-run
 *   node scripts/apply-jbiz04-pricing-gym-member.mjs --write  # live 反映
 */

import { getAuthorizedContext } from './lib-sheets.mjs';

const LIVE_SHEET_ID = '1FnJdALwFSv48WiD6NWr0DzG78kwB692R2pFeiTcZlCc';
const SHEET_NAME = '価格設定';

// ─────────────────────────────────────────────
// 追加するセクション（Row 19 以降に追記）
// ─────────────────────────────────────────────
// Row 19: 区切り（空白）
// Row 20: セクション見出し
// Row 21: サブ見出し（項目・内容・確定状況）
// Row 22-26: 適用条件の詳細
const NEW_ROWS = [
  // Row 19: 空白区切り
  [],
  // Row 20: セクション見出し
  ['▼ ジム会員優待価格 適用条件（2026-03-22 確定）'],
  // Row 21: テーブルヘッダー
  ['項目', '内容', '', '', '', '', '', '', '', '', '', '', '確定状況', '備考'],
  // Row 22: 適用区分
  ['適用区分', 'asago全会員区分（7区分すべて）', '', '', '', '', '', '', '', '', '', '', '確定', 'asago担当者確認済み（2026-03-22）'],
  // Row 23: 証明方法
  ['証明方法', '施術時に会員番号を記録する（会員証の提示は不要）', '', '', '', '', '', '', '', '', '', '', '確定', '受付で番号を記録。'],
  // Row 24: 主力単価
  ['主力単価（慢性ケア手技50分）', '通常: 5,500円 / 会員優待: 4,700円', '', '', '', '約50分', 5500, 4700, '', '', '', '', '確定', ''],
  // Row 25: 初回評価
  ['初回評価（症状別・腰痛/首肩こり/膝）', '通常: 3,300円 / 会員優待: 2,800円（仮）', '', '', '', '約30分', 3300, 2800, '', '', '', '', '仮', '次フェーズで確定'],
  // Row 26: 確認日
  ['確認日', '2026-03-22', '', '', '', '', '', '', '', '', '', '', '確認済み', 'asago担当者に全区分対象・会員番号記録を確認'],
];

async function writeCells(accessToken, spreadsheetId, sheetName, rangeA1, values) {
  const range = `${sheetName}!${rangeA1}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const resp = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ range, values }),
  });
  const data = await resp.json();
  if (data.error) throw new Error(`writeCells error: ${JSON.stringify(data.error)}`);
  return data;
}

async function getSheetLastRow(accessToken, spreadsheetId, sheetName) {
  const range = encodeURIComponent(`${sheetName}!A1:A30`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await resp.json();
  if (data.error) throw new Error(`getSheetLastRow error: ${JSON.stringify(data.error)}`);
  return (data.values ?? []).length;
}

async function main() {
  const isDryRun = !process.argv.includes('--write');
  const ctx = await getAuthorizedContext();

  console.log(`[INFO] Target spreadsheet: ${LIVE_SHEET_ID}`);
  console.log(`[INFO] Sheet name        : ${SHEET_NAME}`);
  console.log(`[INFO] Mode              : ${isDryRun ? 'DRY-RUN (pass --write to apply)' : 'WRITE'}`);
  console.log(`[INFO] Task             : ジム会員優待適用条件セクション追加`);

  const lastRow = await getSheetLastRow(ctx.accessToken, LIVE_SHEET_ID, SHEET_NAME);
  const startRow = lastRow + 1;
  const endRow   = startRow + NEW_ROWS.length - 1;

  console.log(`[INFO] Current last row: ${lastRow}`);
  console.log(`[INFO] Append range   : A${startRow}:N${endRow}`);

  if (isDryRun) {
    console.log('\n[DRY-RUN] Rows to append:');
    NEW_ROWS.forEach((row, i) => {
      const label = row[0] ?? '(空白)';
      console.log(`  Row ${startRow + i}: ${label}`);
    });
    return;
  }

  // セクション全体を一括書き込み
  await writeCells(
    ctx.accessToken,
    LIVE_SHEET_ID,
    SHEET_NAME,
    `A${startRow}:N${endRow}`,
    NEW_ROWS,
  );

  console.log(`[OK] 価格設定シートに ${NEW_ROWS.length} 行追加 (A${startRow}:N${endRow})`);
  console.log('\n[DONE] 追加内容:');
  console.log('  Row 19: 空白区切り');
  console.log('  Row 20: ▼ ジム会員優待価格 適用条件（2026-03-22 確定）');
  console.log('  Row 21: テーブルヘッダー');
  console.log('  Row 22: 適用区分 → asago全区分対象（確定）');
  console.log('  Row 23: 証明方法 → 会員番号記録（確定）');
  console.log('  Row 24: 主力単価 → 5,500円 / 4,700円（確定）');
  console.log('  Row 25: 初回評価 → 3,300円 / 2,800円（仮）');
  console.log('  Row 26: 確認日  → 2026-03-22 / asago担当者確認済み');
}

main().catch((err) => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
