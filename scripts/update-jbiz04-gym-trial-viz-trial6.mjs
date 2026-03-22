#!/usr/bin/env node
/**
 * JBIZ-04: 体験試行_可視化 シートを試行 #6 結果で更新する
 *
 * 試行 #6（2026-03-22）— 肩甲骨リトラクション（バンド版）2件目追試行
 *   患者F（40代女性・施術後当日・20分版）
 *   肩甲骨リトラクション（バンド版）: 2連続合格 → 採用確定
 *
 * Usage:
 *   node scripts/update-jbiz04-gym-trial-viz-trial6.mjs          # dry-run
 *   node scripts/update-jbiz04-gym-trial-viz-trial6.mjs --write  # live 反映
 */

import { getAuthorizedContext } from './lib-sheets.mjs';

const LIVE_SHEET_ID = '1FnJdALwFSv48WiD6NWr0DzG78kwB692R2pFeiTcZlCc';
const SHEET_TITLE = '体験試行_可視化';

async function getSheetValues(accessToken, spreadsheetId, sheetName) {
  const range = encodeURIComponent(`${sheetName}!A1:I30`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await resp.json();
  if (data.error) throw new Error(`getSheetValues error: ${JSON.stringify(data.error)}`);
  return data.values ?? [];
}

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

function findRowByKeyword(values, keyword) {
  for (let i = 0; i < values.length; i++) {
    if ((values[i][0] ?? '').toString().includes(keyword)) return i + 1;
  }
  return null;
}

async function main() {
  const isDryRun = !process.argv.includes('--write');
  const ctx = await getAuthorizedContext();

  console.log(`[INFO] Target spreadsheet: ${LIVE_SHEET_ID}`);
  console.log(`[INFO] Sheet name        : ${SHEET_TITLE}`);
  console.log(`[INFO] Mode              : ${isDryRun ? 'DRY-RUN (pass --write to apply)' : 'WRITE'}`);
  console.log(`[INFO] Task             : 試行 #6 反映（バンド版採用確定）`);

  const values = await getSheetValues(ctx.accessToken, LIVE_SHEET_ID, SHEET_TITLE);
  console.log(`[INFO] Current sheet rows: ${values.length}`);

  // バンド版行を探す（バンド版は試行 #5 で挿入済み）
  const rowBand        = findRowByKeyword(values, 'バンド版');
  const rowTotalTrials = findRowByKeyword(values, '総試行数');
  const rowLastUpdated = findRowByKeyword(values, '最終更新日');

  console.log(`[INFO] Row positions:`);
  console.log(`  肩甲骨リトラクション（バンド版）: Row ${rowBand}`);
  console.log(`  総試行数                         : Row ${rowTotalTrials}`);
  console.log(`  最終更新日                       : Row ${rowLastUpdated}`);

  if (!rowBand) throw new Error('バンド版行が見つかりません。試行 #5 のスクリプトが実行済みか確認してください。');

  if (isDryRun) {
    console.log('\n[DRY-RUN] Updates to apply:');
    console.log(`  A${rowBand}:I${rowBand} → 採用確定（試行2/合格2）`);
    console.log(`  B${rowTotalTrials} → 6`);
    return;
  }

  // バンド版 → 採用確定
  await writeCells(ctx.accessToken, LIVE_SHEET_ID, SHEET_TITLE, `A${rowBand}:I${rowBand}`,
    [['肩甲骨リトラクション（バンド版）', '✅ 採用確定', 2, 2, 0, 0, 2, 0, '採用確定（2連続合格。壁版と並行運用確定）']]);
  console.log(`[OK] 肩甲骨リトラクション（バンド版）→ 採用確定（Row ${rowBand}）`);

  // 総試行数 → 6
  await writeCells(ctx.accessToken, LIVE_SHEET_ID, SHEET_TITLE, `B${rowTotalTrials}`, [[6]]);
  console.log(`[OK] 総試行数 → 6`);

  // 最終更新日（変更なしだが念のため確認）
  console.log(`[INFO] 最終更新日 Row ${rowLastUpdated}: 変更なし（2026-03-22 維持）`);

  console.log('\n[DONE] 試行 #6 反映完了');
  console.log('  肩甲骨リトラクション（バンド版）→ 採用確定（試行2/合格2）');
  console.log('  総試行数                         → 6');
}

main().catch((err) => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
