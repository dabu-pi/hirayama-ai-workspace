#!/usr/bin/env node
/**
 * JBIZ-04: 体験試行_可視化 シートを live スプレッドシートへ追加する
 *
 * 対象スプレッドシート: 平山接骨院 慢性疼痛強化プロジェクト 管理表
 *   ID: 1FnJdALwFSv48WiD6NWr0DzG78kwB692R2pFeiTcZlCc
 *
 * Usage:
 *   node scripts/apply-jbiz04-gym-trial-viz.mjs          # dry-run
 *   node scripts/apply-jbiz04-gym-trial-viz.mjs --write  # live 反映
 */

import { getAuthorizedContext, updateSheetValues } from './lib-sheets.mjs';

const LIVE_SHEET_ID = '1FnJdALwFSv48WiD6NWr0DzG78kwB692R2pFeiTcZlCc';
const SHEET_TITLE = '体験試行_可視化';

// ─────────────────────────────────────────────
// シートの初期データ
// ─────────────────────────────────────────────
const SHEET_DATA = [
  // Row 1: タイトル
  ['再発予防トレーニング体験 — 種目別試行状況'],
  // Row 2: 説明
  ['初期試行の結果を種目別に記録する。試行を実施するたびにこのシートを更新する。'],
  // Row 3: ヘッダー
  ['種目名', '採用状態', '試行数', '合格', '条件付き', '保留', '改善反応あり', '痛み増悪', '採用判定'],
  // Row 4-9: 6種目
  ['ヒップヒンジ（自重）', '採用確定', '—', '—', '—', '—', '—', '—', '採用確定'],
  ['デッドバグ', '試行待ち', 0, 0, 0, 0, 0, 0, '試行待ち'],
  ['ブリッジ', '試行待ち', 0, 0, 0, 0, 0, 0, '試行待ち'],
  ['チンタック（壁版）', '試行待ち', 0, 0, 0, 0, 0, 0, '試行待ち'],
  ['肩甲骨リトラクション', '試行待ち', 0, 0, 0, 0, 0, 0, '試行待ち'],
  ['胸椎モビリティ（キャットカウ）', '採用確定', '—', '—', '—', '—', '—', '—', '採用確定'],
  // Row 10: 空白
  [],
  // Row 11: セクションヘッダー
  ['▼ 試行概要'],
  // Row 12: 概要ヘッダー
  ['項目', '値', '備考'],
  // Row 13-17: 概要データ
  ['総試行数', 0, '実施するたびに更新する'],
  ['採用確定種目数', 2, 'ヒップヒンジ・胸椎モビリティは確定済み'],
  ['試行待ち種目数', 4, 'デッドバグ・ブリッジ・チンタック・肩甲骨リトラクション'],
  ['痛み増悪件数', 0, '発生した場合は種目を再検討する'],
  ['最終更新日', '2026-03-21', '試行実施後に更新する'],
];

// ─────────────────────────────────────────────
// Sheets API: addSheet + データ書き込み
// ─────────────────────────────────────────────
async function addSheetIfNotExists(accessToken, spreadsheetId, title) {
  // まず現在のシート一覧を取得
  const metaResp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  const meta = await metaResp.json();
  if (meta.error) throw new Error(`Sheets API error: ${JSON.stringify(meta.error)}`);

  const exists = (meta.sheets ?? []).some((s) => s.properties?.title === title);
  if (exists) {
    console.log(`[INFO] Sheet "${title}" already exists. Skipping addSheet.`);
    return null;
  }

  const resp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title } } }],
      }),
    },
  );
  const result = await resp.json();
  if (result.error) throw new Error(`addSheet error: ${JSON.stringify(result.error)}`);
  const newId = result.replies?.[0]?.addSheet?.properties?.sheetId;
  console.log(`[OK] Sheet "${title}" created (sheetId: ${newId})`);
  return newId;
}

async function main() {
  const isDryRun = !process.argv.includes('--write');
  const ctx = await getAuthorizedContext();

  console.log(`[INFO] Target spreadsheet: ${LIVE_SHEET_ID}`);
  console.log(`[INFO] Sheet name        : ${SHEET_TITLE}`);
  console.log(`[INFO] Mode              : ${isDryRun ? 'DRY-RUN (pass --write to apply)' : 'WRITE'}`);

  if (isDryRun) {
    console.log('[INFO] Sheet data preview:');
    SHEET_DATA.slice(0, 5).forEach((row, i) => console.log(`  Row ${i + 1}: ${JSON.stringify(row)}`));
    console.log(`  ... (${SHEET_DATA.length} rows total)`);
    return;
  }

  await addSheetIfNotExists(ctx.accessToken, LIVE_SHEET_ID, SHEET_TITLE);

  const result = await updateSheetValues({
    spreadsheetId: LIVE_SHEET_ID,
    sheetName: SHEET_TITLE,
    range: `A1:I${SHEET_DATA.length}`,
    values: SHEET_DATA,
    accessToken: ctx.accessToken,
  });

  console.log(`[OK] Data written to "${SHEET_TITLE}" (${SHEET_DATA.length} rows)`);
}

main().catch((err) => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
