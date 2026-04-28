#!/usr/bin/env node
/**
 * JBIZ-04: 体験試行_可視化 シートを試行 #7 結果で更新する
 *
 * 試行 #7（2026-03-22）— ブリッジ（腰痛向け・初回試行）
 *   患者G（50代男性・施術前・20分版）
 *   ブリッジ（マット版）: 初試行合格 → 採用候補
 *
 * Usage:
 *   node scripts/update-jbiz04-gym-trial-viz-trial7.mjs          # dry-run
 *   node scripts/update-jbiz04-gym-trial-viz-trial7.mjs --write  # live 反映
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
  console.log(`[INFO] Task             : 試行 #7 反映（ブリッジ初試行合格・採用候補）`);

  const values = await getSheetValues(ctx.accessToken, LIVE_SHEET_ID, SHEET_TITLE);
  console.log(`[INFO] Current sheet rows: ${values.length}`);

  // ブリッジ行・総試行数・最終更新日を探す
  const rowBridge      = findRowByKeyword(values, 'ブリッジ');
  const rowTotalTrials = findRowByKeyword(values, '総試行数');
  const rowLastUpdated = findRowByKeyword(values, '最終更新日');

  console.log(`[INFO] Row positions:`);
  console.log(`  ブリッジ                         : Row ${rowBridge}`);
  console.log(`  総試行数                         : Row ${rowTotalTrials}`);
  console.log(`  最終更新日                       : Row ${rowLastUpdated}`);

  if (!rowBridge) throw new Error('ブリッジ行が見つかりません。シート構成を確認してください。');

  if (isDryRun) {
    console.log('\n[DRY-RUN] Updates to apply:');
    console.log(`  A${rowBridge}:I${rowBridge} → 採用候補（試行1/合格1）`);
    console.log(`  B${rowTotalTrials} → 7`);
    console.log(`  B${rowLastUpdated} → 2026-03-22`);
    return;
  }

  // ブリッジ → 採用候補（初試行合格）
  await writeCells(ctx.accessToken, LIVE_SHEET_ID, SHEET_TITLE, `A${rowBridge}:I${rowBridge}`,
    [['ブリッジ（マット版）', '採用候補', 1, 1, 0, 0, 1, 0, '採用候補（初試行合格。代償動作なし・痛み増悪なし。追試行で採用確定予定）']]);
  console.log(`[OK] ブリッジ（マット版）→ 採用候補（Row ${rowBridge}）`);

  // 総試行数 → 7
  await writeCells(ctx.accessToken, LIVE_SHEET_ID, SHEET_TITLE, `B${rowTotalTrials}`, [[7]]);
  console.log(`[OK] 総試行数 → 7`);

  // 最終更新日 → 2026-03-22（変更なし・念のため書き込み）
  if (rowLastUpdated) {
    await writeCells(ctx.accessToken, LIVE_SHEET_ID, SHEET_TITLE, `B${rowLastUpdated}`, [['2026-03-22']]);
    console.log(`[OK] 最終更新日 → 2026-03-22（Row ${rowLastUpdated}）`);
  }

  console.log('\n[DONE] 試行 #7 反映完了');
  console.log('  ブリッジ（マット版）→ 採用候補（試行1/合格1）');
  console.log('  総試行数             → 7');
}

main().catch((err) => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
