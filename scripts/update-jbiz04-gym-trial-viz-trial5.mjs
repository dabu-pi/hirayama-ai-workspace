#!/usr/bin/env node
/**
 * JBIZ-04: 体験試行_可視化 シートを試行 #5 結果で更新する
 *
 * 試行 #5（2026-03-22）— 首肩こり向け追試行
 *   チンタック（壁版）: 2連続合格 → 採用確定
 *   肩甲骨リトラクション（壁版）: 2連続合格 → 採用確定
 *   肩甲骨リトラクション（バンド版）: 初試行合格 → 採用候補（新行追加）
 *   胸椎モビリティ（キャットカウ版）: 2件目確認合格 → 採用確定維持
 *
 * Usage:
 *   node scripts/update-jbiz04-gym-trial-viz-trial5.mjs          # dry-run
 *   node scripts/update-jbiz04-gym-trial-viz-trial5.mjs --write  # live 反映
 */

import { getAuthorizedContext } from './lib-sheets.mjs';

const LIVE_SHEET_ID = '1FnJdALwFSv48WiD6NWr0DzG78kwB692R2pFeiTcZlCc';
const SHEET_TITLE = '体験試行_可視化';

async function getSheetMetadata(accessToken, spreadsheetId) {
  const resp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const data = await resp.json();
  if (data.error) throw new Error(`getSheetMetadata error: ${JSON.stringify(data.error)}`);
  return data.sheets ?? [];
}

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

async function insertRowAfter(accessToken, spreadsheetId, sheetId, afterRowIndex) {
  // afterRowIndex は 0-indexed の「この行の後に挿入する」行番号
  const startIndex = afterRowIndex + 1;
  const resp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [{
          insertRange: {
            range: {
              sheetId,
              startRowIndex: startIndex,
              endRowIndex: startIndex + 1,
            },
            shiftDimension: 'ROWS',
          },
        }],
      }),
    },
  );
  const data = await resp.json();
  if (data.error) throw new Error(`insertRow error: ${JSON.stringify(data.error)}`);
  return data;
}

function findRowByKeyword(values, keyword) {
  for (let i = 0; i < values.length; i++) {
    if ((values[i][0] ?? '').toString().includes(keyword)) return i + 1; // 1-indexed
  }
  return null;
}

async function main() {
  const isDryRun = !process.argv.includes('--write');
  const ctx = await getAuthorizedContext();

  console.log(`[INFO] Target spreadsheet: ${LIVE_SHEET_ID}`);
  console.log(`[INFO] Sheet name        : ${SHEET_TITLE}`);
  console.log(`[INFO] Mode              : ${isDryRun ? 'DRY-RUN (pass --write to apply)' : 'WRITE'}`);
  console.log(`[INFO] Task             : 試行 #5 反映（首肩こり向け追試行・採用確定更新）`);

  // シートID取得
  const sheets = await getSheetMetadata(ctx.accessToken, LIVE_SHEET_ID);
  const sheetMeta = sheets.find(s => s.properties?.title === SHEET_TITLE);
  if (!sheetMeta) throw new Error(`Sheet "${SHEET_TITLE}" not found`);
  const sheetId = sheetMeta.properties.sheetId;
  console.log(`[INFO] Sheet ID: ${sheetId}`);

  // 現在のシート内容を取得
  let values = await getSheetValues(ctx.accessToken, LIVE_SHEET_ID, SHEET_TITLE);
  console.log(`[INFO] Current sheet rows: ${values.length}`);

  // バンド版が既に存在するか確認
  const bandRowExists = values.some(row => (row[0] ?? '').includes('バンド版'));
  console.log(`[INFO] バンド版行 existing: ${bandRowExists}`);

  const rowChintuck     = findRowByKeyword(values, 'チンタック');
  const rowShoulderWall = values.findIndex(r => (r[0] ?? '').includes('肩甲骨リトラクション') && !(r[0] ?? '').includes('バンド')) + 1;
  const rowThoracic     = findRowByKeyword(values, '胸椎モビリティ');
  const rowTotalTrials  = findRowByKeyword(values, '総試行数');
  const rowLastUpdated  = findRowByKeyword(values, '最終更新日');

  console.log(`[INFO] Row positions (before insert):`);
  console.log(`  チンタック（壁版）         : Row ${rowChintuck}`);
  console.log(`  肩甲骨リトラクション（壁版）: Row ${rowShoulderWall}`);
  console.log(`  胸椎モビリティ             : Row ${rowThoracic}`);
  console.log(`  総試行数                   : Row ${rowTotalTrials}`);
  console.log(`  最終更新日                 : Row ${rowLastUpdated}`);

  if (isDryRun) {
    console.log('\n[DRY-RUN] Updates to apply:');
    console.log(`  A${rowChintuck}:I${rowChintuck} → 採用確定（試行2/合格2）`);
    console.log(`  A${rowShoulderWall}:I${rowShoulderWall} → 採用確定（試行2/合格2）`);
    if (!bandRowExists) {
      console.log(`  [INSERT] Row after Row ${rowShoulderWall}: 肩甲骨リトラクション（バンド版）新行`);
      console.log(`  → 以降の行は +1 シフト（胸椎: Row ${rowThoracic+1}, 総試行数: Row ${rowTotalTrials+1}, 最終更新日: Row ${rowLastUpdated+1}）`);
    }
    console.log(`  A${bandRowExists ? findRowByKeyword(values, 'バンド') : rowShoulderWall+1}:I_ → 採用候補（試行1/合格1）`);
    console.log(`  胸椎モビリティ → 採用確定（試行2/合格2）`);
    console.log(`  総試行数 → 5`);
    return;
  }

  // Step 1: チンタック（壁版）→ 採用確定
  await writeCells(ctx.accessToken, LIVE_SHEET_ID, SHEET_TITLE, `A${rowChintuck}:I${rowChintuck}`,
    [['チンタック（壁版）', '✅ 採用確定', 2, 2, 0, 0, 2, 0, '採用確定（2連続合格・改善反応あり）']]);
  console.log(`[OK] チンタック（壁版）→ 採用確定`);

  // Step 2: 肩甲骨リトラクション（壁版）→ 採用確定
  await writeCells(ctx.accessToken, LIVE_SHEET_ID, SHEET_TITLE, `A${rowShoulderWall}:I${rowShoulderWall}`,
    [['肩甲骨リトラクション（壁版）', '✅ 採用確定', 2, 2, 0, 0, 2, 0, '採用確定（2連続合格。声かけ「滑らかに動かす」標準化）']]);
  console.log(`[OK] 肩甲骨リトラクション（壁版）→ 採用確定`);

  // Step 3: バンド版行の処理（未存在の場合は挿入、存在する場合は更新）
  let bandRowNumber;
  if (!bandRowExists) {
    // 壁版行の後に新行を挿入（0-indexed: rowShoulderWall が 1-indexed なので -1 してから +1 = rowShoulderWall）
    await insertRowAfter(ctx.accessToken, LIVE_SHEET_ID, sheetId, rowShoulderWall - 1);
    console.log(`[OK] 新行を Row ${rowShoulderWall + 1} に挿入（肩甲骨リトラクション（バンド版））`);
    bandRowNumber = rowShoulderWall + 1;
    // 挿入後、胸椎・総試行数・最終更新日は +1 シフト
  } else {
    bandRowNumber = findRowByKeyword(values, 'バンド');
    console.log(`[INFO] バンド版行は既存 (Row ${bandRowNumber})。更新のみ行う。`);
  }

  // Step 4: バンド版行を書き込み
  await writeCells(ctx.accessToken, LIVE_SHEET_ID, SHEET_TITLE, `A${bandRowNumber}:I${bandRowNumber}`,
    [['肩甲骨リトラクション（バンド版）', '✅ 採用候補', 1, 1, 0, 0, 1, 0, '採用候補（初試行合格。壁版と並行運用可。追試行推奨）']]);
  console.log(`[OK] 肩甲骨リトラクション（バンド版）→ 採用候補（Row ${bandRowNumber}）`);

  // Step 5: 挿入後の行位置を再取得して更新
  const shift = bandRowExists ? 0 : 1;
  const rowThoracicNew     = rowThoracic + shift;
  const rowTotalTrialsNew  = rowTotalTrials + shift;
  const rowLastUpdatedNew  = rowLastUpdated + shift;

  await writeCells(ctx.accessToken, LIVE_SHEET_ID, SHEET_TITLE, `A${rowThoracicNew}:I${rowThoracicNew}`,
    [['胸椎モビリティ（キャットカウ）', '採用確定', 2, 2, 0, 0, 2, 0, '採用確定（2件確認・改善反応あり）']]);
  console.log(`[OK] 胸椎モビリティ → 採用確定（試行2/合格2）`);

  await writeCells(ctx.accessToken, LIVE_SHEET_ID, SHEET_TITLE, `B${rowTotalTrialsNew}`, [[5]]);
  console.log(`[OK] 総試行数 → 5`);

  await writeCells(ctx.accessToken, LIVE_SHEET_ID, SHEET_TITLE, `B${rowLastUpdatedNew}`, [['2026-03-22']]);
  console.log(`[OK] 最終更新日 → 2026-03-22`);

  console.log('\n[DONE] 試行 #5 反映完了');
  console.log('  チンタック（壁版）             → 採用確定（試行2/合格2）');
  console.log('  肩甲骨リトラクション（壁版）   → 採用確定（試行2/合格2）');
  console.log('  肩甲骨リトラクション（バンド版）→ 採用候補（試行1/合格1）※新行追加');
  console.log('  胸椎モビリティ（キャットカウ） → 採用確定（試行2/合格2）');
  console.log('  総試行数                        → 5');
}

main().catch((err) => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
