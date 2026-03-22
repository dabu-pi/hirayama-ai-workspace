#!/usr/bin/env node
/**
 * JBIZ-04: 体験試行_可視化 シートを試行 #4 結果で更新する
 *
 * 試行 #4（2026-03-22）— 首肩こり向け初回試行
 *   患者D（50代女性・施術後当日・20分版）
 *   チンタック（壁版）: 合格・改善反応あり → 採用候補
 *   肩甲骨リトラクション（壁版）: 合格・改善反応あり → 採用候補
 *   胸椎モビリティ（キャットカウ版）: 合格・改善反応あり（採用確定維持）
 *
 * Usage:
 *   node scripts/update-jbiz04-gym-trial-viz-trial4.mjs          # dry-run
 *   node scripts/update-jbiz04-gym-trial-viz-trial4.mjs --write  # live 反映
 */

import { getAuthorizedContext, updateSheetValues } from './lib-sheets.mjs';

const LIVE_SHEET_ID = '1FnJdALwFSv48WiD6NWr0DzG78kwB692R2pFeiTcZlCc';
const SHEET_TITLE = '体験試行_可視化';

// ─────────────────────────────────────────────
// シートの全値を取得する
// ─────────────────────────────────────────────
async function getSheetValues(accessToken, spreadsheetId, sheetName) {
  const range = encodeURIComponent(`${sheetName}!A1:I30`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`;
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await resp.json();
  if (data.error) throw new Error(`getSheetValues error: ${JSON.stringify(data.error)}`);
  return data.values ?? [];
}

// ─────────────────────────────────────────────
// 特定セルを更新する（単一範囲）
// ─────────────────────────────────────────────
async function writeCells(accessToken, spreadsheetId, sheetName, rangeA1, values) {
  const range = `${sheetName}!${rangeA1}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const resp = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ range, values }),
  });
  const data = await resp.json();
  if (data.error) throw new Error(`writeCells error: ${JSON.stringify(data.error)}`);
  return data;
}

// ─────────────────────────────────────────────
// 行番号を A 列のキーワードで探す（1-indexed）
// ─────────────────────────────────────────────
function findRowByKeyword(values, keyword) {
  for (let i = 0; i < values.length; i++) {
    if ((values[i][0] ?? '').toString().includes(keyword)) {
      return i + 1; // 1-indexed
    }
  }
  return null;
}

async function main() {
  const isDryRun = !process.argv.includes('--write');
  const ctx = await getAuthorizedContext();

  console.log(`[INFO] Target spreadsheet: ${LIVE_SHEET_ID}`);
  console.log(`[INFO] Sheet name        : ${SHEET_TITLE}`);
  console.log(`[INFO] Mode              : ${isDryRun ? 'DRY-RUN (pass --write to apply)' : 'WRITE'}`);
  console.log(`[INFO] Task             : 試行 #4 反映（首肩こり向け初回試行）`);

  // 現在のシート内容を取得して行位置を確認
  const values = await getSheetValues(ctx.accessToken, LIVE_SHEET_ID, SHEET_TITLE);
  console.log(`[INFO] Current sheet rows: ${values.length}`);

  // 各種目の行番号を特定
  const rowChintuck = findRowByKeyword(values, 'チンタック');
  const rowShoulder = findRowByKeyword(values, '肩甲骨リトラクション');
  const rowThoracic = findRowByKeyword(values, '胸椎モビリティ');
  const rowTotalTrials = findRowByKeyword(values, '総試行数');
  const rowLastUpdated = findRowByKeyword(values, '最終更新日');

  console.log(`[INFO] Row positions:`);
  console.log(`  チンタック（壁版）      : Row ${rowChintuck}`);
  console.log(`  肩甲骨リトラクション    : Row ${rowShoulder}`);
  console.log(`  胸椎モビリティ          : Row ${rowThoracic}`);
  console.log(`  総試行数                : Row ${rowTotalTrials}`);
  console.log(`  最終更新日              : Row ${rowLastUpdated}`);

  if (!rowChintuck || !rowShoulder || !rowThoracic) {
    throw new Error('Required rows not found in sheet. Check sheet structure.');
  }

  // 更新内容の定義
  // [種目名, 採用状態, 試行数, 合格, 条件付き, 保留, 改善反応あり, 痛み増悪, 採用判定]
  const updates = [
    {
      label: 'チンタック（壁版）',
      row: rowChintuck,
      values: [['チンタック（壁版）', '✅ 採用候補', 1, 1, 0, 0, 1, 0, '採用候補（初試行合格。追試行推奨）']],
    },
    {
      label: '肩甲骨リトラクション（壁版）',
      row: rowShoulder,
      values: [['肩甲骨リトラクション（壁版）', '✅ 採用候補', 1, 1, 0, 0, 1, 0, '採用候補（初試行合格。バンド版未試行）']],
    },
    {
      label: '胸椎モビリティ（キャットカウ）',
      row: rowThoracic,
      values: [['胸椎モビリティ（キャットカウ）', '採用確定', 1, 1, 0, 0, 1, 0, '採用確定（追加確認済み）']],
    },
  ];

  // 概要セクションの更新
  if (rowTotalTrials) {
    updates.push({
      label: '総試行数',
      row: rowTotalTrials,
      col: 'B',
      singleCell: true,
      values: [[4]],
    });
  }
  if (rowLastUpdated) {
    updates.push({
      label: '最終更新日',
      row: rowLastUpdated,
      col: 'B',
      singleCell: true,
      values: [['2026-03-22']],
    });
  }

  if (isDryRun) {
    console.log('\n[DRY-RUN] Updates to apply:');
    for (const u of updates) {
      if (u.singleCell) {
        console.log(`  ${u.col}${u.row} (${u.label}): ${JSON.stringify(u.values[0][0])}`);
      } else {
        console.log(`  A${u.row}:I${u.row} (${u.label}): ${JSON.stringify(u.values[0])}`);
      }
    }
    return;
  }

  // 書き込み実行
  for (const u of updates) {
    if (u.singleCell) {
      const range = `${u.col}${u.row}`;
      await writeCells(ctx.accessToken, LIVE_SHEET_ID, SHEET_TITLE, range, u.values);
      console.log(`[OK] ${u.label} (${SHEET_TITLE}!${range}) → ${JSON.stringify(u.values[0][0])}`);
    } else {
      const range = `A${u.row}:I${u.row}`;
      await writeCells(ctx.accessToken, LIVE_SHEET_ID, SHEET_TITLE, range, u.values);
      console.log(`[OK] ${u.label} (${SHEET_TITLE}!${range}) → 採用候補更新`);
    }
  }

  console.log('\n[DONE] 試行 #4 反映完了');
  console.log('  チンタック（壁版）     → 採用候補（試行1/合格1/改善反応1）');
  console.log('  肩甲骨リトラクション   → 採用候補（試行1/合格1/改善反応1）');
  console.log('  胸椎モビリティ         → 採用確定（追加確認済み）');
  console.log('  総試行数               → 4');
  console.log('  最終更新日             → 2026-03-22');
}

main().catch((err) => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
