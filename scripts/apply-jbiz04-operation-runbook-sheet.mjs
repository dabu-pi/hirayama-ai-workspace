#!/usr/bin/env node
/**
 * JBIZ-04: 「運用メモ」シートを live スプレッドシートに追加する
 *
 * 背景: 実績運用開始（2026-04-01）前に院長が日次/月末で何をするかを
 *       スプレッドシート内で一目で確認できるようにする。
 *
 * 処理:
 *   1. 「運用メモ」シートが未存在なら addSheet で追加（末尾）
 *   2. シート内容を書き込む（院長向け日次/院長アクション/月末手順）
 *   3. ヘッダー行に書式（太字・背景色）を設定
 *
 * Usage:
 *   node scripts/apply-jbiz04-operation-runbook-sheet.mjs           # dry-run
 *   node scripts/apply-jbiz04-operation-runbook-sheet.mjs --write   # live 反映
 */

import {
  batchUpdateSpreadsheet,
  getAuthorizedContext,
  getSpreadsheetMetadata,
  updateSheetValues,
} from './lib-sheets.mjs';

const LIVE_SHEET_ID = '1FnJdALwFSv48WiD6NWr0DzG78kwB692R2pFeiTcZlCc';
const SHEET_NAME    = '運用メモ';

// ──────────────────────────────────────────────
// シート内容定義（行ごとの [A, B, C, D] 値）
// ──────────────────────────────────────────────
const SHEET_ROWS = [
  // Row 1: タイトル
  ['院長向け 運用メモ', '', '', ''],
  // Row 2: 更新日 / 開始日
  ['最終更新: 2026-03-22', '', '運用開始: 2026-04-01', ''],
  // Row 3: 空行
  ['', '', '', ''],

  // Row 4: 日次メモ セクションヘッダー
  ['【日次メモ（閉院後 5分）】', '', '', ''],
  // Row 5: 列見出し
  ['記録内容', '担当', 'メモ', ''],
  // Row 6〜9: 日次項目
  ['自費患者の件数', '受付 or 院長', '月末に院長が合計を集計', ''],
  ['自費の延べ来院回数', '受付 or 院長', '件数×回数で月末に集計', ''],
  ['ジム利用者数（当日）', 'ジムスタッフ', '当日の実数をメモ', ''],
  ['ジム案内した人数', '院長', '「興味あり」だけでカウント可', ''],
  // Row 10: 空行
  ['', '', '', ''],

  // Row 11: 院長アクション セクションヘッダー
  ['【院長アクション（運用開始前）】', '', '', ''],
  // Row 12〜14: アクション
  ['①', 'スタッフ・受付へ日次メモの記録方法を共有する', '→ 運用開始前（4/1まで）に完了', ''],
  ['②', 'KPI目標!D5 / D6 の入力場所をスプレッドシートで確認する', '→ 運用開始前（4/1まで）に完了', ''],
  ['③', '機器リース月額は 数値前提!B14 の現状値で固定して進める', '→ 変更が必要な場合は Claude Code へ連絡', ''],
  // Row 15: 空行
  ['', '', '', ''],

  // Row 16: 運用スケジュール セクションヘッダー
  ['【運用スケジュール】', '', '', ''],
  // Row 17〜18: スケジュール
  ['2026-04-01', '実績運用開始', '施術記録・ジム案内の日次メモ開始', ''],
  ['2026-04-30 〜 5/1', '初回月末作業', 'KPI目標!D5/D6 入力 → 初回損益判定', ''],
  // Row 19: 空行
  ['', '', '', ''],

  // Row 20: 月末手順 セクションヘッダー
  ['【月末10分 作業手順】', '', '', ''],
  // Row 21: 列見出し
  ['Step', 'セル', '作業内容', ''],
  // Row 22〜26: 手順
  ['Step 1', 'KPI目標!D5', '月次総保険売上（実績）を入力', ''],
  ['Step 2', 'KPI目標!D6', '月次自費売上（実績）を入力', ''],
  ['Step 3', 'KPI目標!J12', '「達成 / 不足」を確認', ''],
  ['Step 4', 'KPI目標!J11', '不足の場合: マイナス幅を確認', ''],
  ['Step 5', 'KPI実績履歴', '月・実績・備考を1行追記', ''],
  // Row 27: 空行
  ['', '', '', ''],

  // Row 28: 判定目安 セクションヘッダー
  ['【J11 マイナス幅の目安】', '', '', ''],
  // Row 29〜31: 判定
  ['▲10万円未満', '→ 順調。来月も続ける', '', ''],
  ['▲10〜20万円', '→ 件数 or 回数を増やす対策を検討する', '', ''],
  ['▲20万円以上', '→ Claude Code に相談。KPI逆算を実績値で更新する', '', ''],
];

// ヘッダー行インデックス（0始まり）: タイトル・各セクション見出し
const HEADER_ROWS = [0, 3, 10, 15, 19, 27];

// ──────────────────────────────────────────────
// ユーティリティ
// ──────────────────────────────────────────────
function findSheetId(metadata, name) {
  const sheet = metadata.sheets?.find((s) => s.properties?.title === name);
  return sheet?.properties?.sheetId ?? null;
}

function colorRgb(r, g, b) {
  return { red: r / 255, green: g / 255, blue: b / 255 };
}

/** 行インデックス（0始まり）のセル範囲を GridRange として返す */
function rowRange(sheetId, rowIndex, startCol = 0, endCol = 4) {
  return {
    sheetId,
    startRowIndex: rowIndex,
    endRowIndex: rowIndex + 1,
    startColumnIndex: startCol,
    endColumnIndex: endCol,
  };
}

/** 書式リクエスト: 背景 + 太字 */
function formatRequest(sheetId, rowIndex, bgColor, bold = true) {
  return {
    repeatCell: {
      range: rowRange(sheetId, rowIndex),
      cell: {
        userEnteredFormat: {
          backgroundColor: bgColor,
          textFormat: { bold },
        },
      },
      fields: 'userEnteredFormat(backgroundColor,textFormat)',
    },
  };
}

// ──────────────────────────────────────────────
// main
// ──────────────────────────────────────────────
async function main() {
  const isDryRun = !process.argv.includes('--write');
  const ctx = await getAuthorizedContext();

  console.log(`[INFO] Mode: ${isDryRun ? 'DRY-RUN (pass --write to apply)' : 'WRITE'}`);
  console.log(`[INFO] Target: ${LIVE_SHEET_ID}`);
  console.log(`[INFO] Sheet: ${SHEET_NAME}`);

  // 既存シート一覧を確認
  const metadata = await getSpreadsheetMetadata({
    spreadsheetId: LIVE_SHEET_ID,
    accessToken: ctx.accessToken,
  });

  let sheetId = findSheetId(metadata, SHEET_NAME);
  const sheetExists = sheetId !== null;
  console.log(`[INFO] Sheet exists: ${sheetExists}${sheetExists ? ` (sheetId=${sheetId})` : ''}`);

  if (isDryRun) {
    console.log('\n[DRY-RUN] 書き込み内容プレビュー:');
    SHEET_ROWS.forEach((row, i) => {
      if (row.some(Boolean)) {
        console.log(`  Row ${i + 1}: ${row.filter(Boolean).join(' | ')}`);
      }
    });
    console.log('\n[DRY-RUN] No changes applied. Pass --write to execute.');
    return;
  }

  // ── Step 1: シートが無ければ追加 ──
  let newSheetId = sheetId;
  if (!sheetExists) {
    console.log(`\n[INFO] Adding sheet: ${SHEET_NAME}`);
    const addResp = await batchUpdateSpreadsheet({
      spreadsheetId: LIVE_SHEET_ID,
      accessToken: ctx.accessToken,
      requests: [
        {
          addSheet: {
            properties: {
              title: SHEET_NAME,
              gridProperties: { rowCount: 50, columnCount: 6 },
            },
          },
        },
      ],
    });
    newSheetId = addResp.replies?.[0]?.addSheet?.properties?.sheetId;
    console.log(`  [OK] Sheet added (sheetId=${newSheetId})`);
  } else {
    console.log(`\n[INFO] Sheet already exists. Overwriting content.`);
  }

  // ── Step 2: 内容を書き込む ──
  console.log(`\n[INFO] Writing ${SHEET_ROWS.length} rows...`);
  await updateSheetValues({
    spreadsheetId: LIVE_SHEET_ID,
    accessToken: ctx.accessToken,
    sheetName: SHEET_NAME,
    range: `A1:D${SHEET_ROWS.length}`,
    values: SHEET_ROWS,
  });
  console.log(`  [OK] Content written`);

  // ── Step 3: 書式を設定 ──
  console.log(`\n[INFO] Applying formatting...`);
  const titleBg    = colorRgb(60,  120, 190); // 濃い青（タイトル）
  const sectionBg  = colorRgb(180, 210, 240); // 薄い青（セクション見出し）

  const formatRequests = HEADER_ROWS.map((rowIdx) =>
    formatRequest(newSheetId, rowIdx, rowIdx === 0 ? titleBg : sectionBg, true),
  );

  await batchUpdateSpreadsheet({
    spreadsheetId: LIVE_SHEET_ID,
    accessToken: ctx.accessToken,
    requests: formatRequests,
  });
  console.log(`  [OK] Formatting applied`);

  // ── Step 4: A列幅を広げる ──
  await batchUpdateSpreadsheet({
    spreadsheetId: LIVE_SHEET_ID,
    accessToken: ctx.accessToken,
    requests: [
      {
        updateDimensionProperties: {
          range: { sheetId: newSheetId, dimension: 'COLUMNS', startIndex: 0, endIndex: 1 },
          properties: { pixelSize: 180 },
          fields: 'pixelSize',
        },
      },
      {
        updateDimensionProperties: {
          range: { sheetId: newSheetId, dimension: 'COLUMNS', startIndex: 1, endIndex: 2 },
          properties: { pixelSize: 300 },
          fields: 'pixelSize',
        },
      },
      {
        updateDimensionProperties: {
          range: { sheetId: newSheetId, dimension: 'COLUMNS', startIndex: 2, endIndex: 3 },
          properties: { pixelSize: 280 },
          fields: 'pixelSize',
        },
      },
    ],
  });
  console.log(`  [OK] Column widths adjusted`);

  console.log(`\n[DONE] 「${SHEET_NAME}」シートの設置完了`);
  console.log(`  - ${SHEET_ROWS.length} 行の内容を書き込み`);
  console.log(`  - ヘッダー ${HEADER_ROWS.length} 行に書式設定`);
  console.log(`  - 運用開始: 2026-04-01 / 初回月末作業: 2026-04-30〜5/1`);
}

main().catch((err) => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
