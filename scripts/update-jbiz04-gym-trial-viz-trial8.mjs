#!/usr/bin/env node
/**
 * JBIZ-04: 体験試行_可視化 シートを試行 #8 結果で更新する
 *
 * 試行 #8（2026-03-22）— ブリッジ（腰痛向け・追試行）
 *   患者H（50代女性・施術後当日・20分版）
 *   ブリッジ（マット版）: 2連続合格 → 採用確定
 *   施術前（試行 #7）・施術後当日（試行 #8）両条件で安全性確認
 *
 * Usage:
 *   node scripts/update-jbiz04-gym-trial-viz-trial8.mjs          # dry-run
 *   node scripts/update-jbiz04-gym-trial-viz-trial8.mjs --write  # live 反映
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
  console.log(`[INFO] Task             : 試行 #8 反映（ブリッジ2連続合格・採用確定）`);

  const values = await getSheetValues(ctx.accessToken, LIVE_SHEET_ID, SHEET_TITLE);
  console.log(`[INFO] Current sheet rows: ${values.length}`);

  const rowBridge      = findRowByKeyword(values, 'ブリッジ');
  const rowTotalTrials = findRowByKeyword(values, '総試行数');
  const rowLastUpdated = findRowByKeyword(values, '最終更新日');

  console.log(`[INFO] Row positions:`);
  console.log(`  ブリッジ     : Row ${rowBridge}`);
  console.log(`  総試行数     : Row ${rowTotalTrials}`);
  console.log(`  最終更新日   : Row ${rowLastUpdated}`);

  if (!rowBridge) throw new Error('ブリッジ行が見つかりません。');

  if (isDryRun) {
    console.log('\n[DRY-RUN] Updates to apply:');
    console.log(`  A${rowBridge}:I${rowBridge} → 採用確定（試行2/合格2）`);
    console.log(`  B${rowTotalTrials} → 8`);
    return;
  }

  // ブリッジ → 採用確定
  await writeCells(ctx.accessToken, LIVE_SHEET_ID, SHEET_TITLE, `A${rowBridge}:I${rowBridge}`,
    [['ブリッジ（マット版）', '✅ 採用確定', 2, 2, 0, 0, 2, 0, '採用確定（2連続合格。施術前・後どちらでも安全に実施可能）']]);
  console.log(`[OK] ブリッジ（マット版）→ 採用確定（Row ${rowBridge}）`);

  // 総試行数 → 8
  await writeCells(ctx.accessToken, LIVE_SHEET_ID, SHEET_TITLE, `B${rowTotalTrials}`, [[8]]);
  console.log(`[OK] 総試行数 → 8`);

  if (rowLastUpdated) {
    await writeCells(ctx.accessToken, LIVE_SHEET_ID, SHEET_TITLE, `B${rowLastUpdated}`, [['2026-03-22']]);
    console.log(`[OK] 最終更新日 → 2026-03-22（Row ${rowLastUpdated}）`);
  }

  console.log('\n[DONE] 試行 #8 反映完了');
  console.log('  ブリッジ（マット版）→ 採用確定（試行2/合格2）');
  console.log('  総試行数             → 8');
  console.log('  🎉 初期試行フェーズ完了 — 全種目採用判定済み');
}

main().catch((err) => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
