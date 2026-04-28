#!/usr/bin/env node
/**
 * JBIZ-04: create 価格設定_v2 and 価格設定_運用メモ scaffolds in live workbook.
 * Idempotent: aborts if either sheet already exists.
 * Writes: new sheets + header rows + 運用メモ content. Does NOT touch existing sheets.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  getAuthorizedContext,
  getSpreadsheetMetadata,
  batchUpdateSpreadsheet,
  updateSheetValues,
} from './lib-sheets.mjs';

const LIVE_SHEET_ID = '1FnJdALwFSv48WiD6NWr0DzG78kwB692R2pFeiTcZlCc';

const V2_SHEET_TITLE = '価格設定_v2';
const MEMO_SHEET_TITLE = '価格設定_運用メモ';

const V2_HEADERS = [
  '表示順', '大区分', '中区分', 'menu_id', 'メニュー名', '患者向け表示名', '内容',
  '時間', '一般料金（円）', 'ジム会員料金（円）', '保険適用', '回数・単位',
  '主力手技フラグ', 'KPI集計対象', '確定状況', '有効フラグ', '備考',
];

const V2_ROW1 = [
  'このシートは戦略管理用です。黄色セルを入力し、青/緑セルは自動計算として扱ってください。',
];
const V2_ROW2 = ['メニューマスタ（v2）'];

const MEMO_HEADERS = ['項目', '内容', '確定状況', '備考'];
const MEMO_ROWS = [
  ['▼ ジム会員優待価格 適用条件（2026-03-22 確定）', '', '', ''],
  MEMO_HEADERS,
  ['適用区分', 'asago全会員区分（7区分すべて）', '確定', 'asago担当者確認済み（2026-03-22）'],
  ['証明方法', '施術時に会員番号を記録する（会員証の提示は不要）', '確定', '受付で番号を記録。'],
  ['主力単価（慢性ケア手技50分）', '通常: 5,500円 / 会員優待: 4,700円', '確定', ''],
  ['初回評価（症状別・腰痛/首肩こり/膝）', '通常: 3,300円 / 会員優待: 2,800円（仮）', '仮', '次フェーズで確定'],
  ['確認日', '2026-03-22', '確認済み', 'asago担当者に全区分対象・会員番号記録を確認'],
];

const LOG_DIR = resolve('logs', 'jbiz04');
const LOG_FILE = resolve(LOG_DIR, `create-pricing-v2-sheets-${new Date().toISOString().replace(/[:.]/g, '-')}.log`);

const logLines = [];
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  logLines.push(line);
}

async function main() {
  const ctx = await getAuthorizedContext();
  ctx.spreadsheetId = LIVE_SHEET_ID;

  log(`Target spreadsheet: ${LIVE_SHEET_ID}`);

  // --- Pre-check: confirm target sheets do not exist ---
  const meta = await getSpreadsheetMetadata({ spreadsheetId: LIVE_SHEET_ID, accessToken: ctx.accessToken });
  const existingTitles = meta.sheets.map(s => s.properties.title);
  log(`Existing sheets: ${existingTitles.join(' / ')}`);

  for (const title of [V2_SHEET_TITLE, MEMO_SHEET_TITLE]) {
    if (existingTitles.includes(title)) {
      throw new Error(`Abort: sheet already exists -> ${title}`);
    }
  }

  // Read-only confirm: existing 価格設定 / KPI逆算 / KPI目標 are present (we will NOT touch them)
  for (const title of ['価格設定', 'KPI逆算', 'KPI目標']) {
    if (!existingTitles.includes(title)) {
      throw new Error(`Safety check failed: expected sheet missing -> ${title}`);
    }
  }
  log('Safety check OK: target sheets absent, existing sheets intact.');

  // --- Step 1: add two new sheets via batchUpdate ---
  const addResp = await batchUpdateSpreadsheet({
    spreadsheetId: LIVE_SHEET_ID,
    accessToken: ctx.accessToken,
    requests: [
      {
        addSheet: {
          properties: {
            title: V2_SHEET_TITLE,
            gridProperties: { rowCount: 200, columnCount: 17, frozenRowCount: 3 },
          },
        },
      },
      {
        addSheet: {
          properties: {
            title: MEMO_SHEET_TITLE,
            gridProperties: { rowCount: 50, columnCount: 4, frozenRowCount: 2 },
          },
        },
      },
    ],
  });

  const v2SheetId = addResp.replies[0].addSheet.properties.sheetId;
  const memoSheetId = addResp.replies[1].addSheet.properties.sheetId;
  log(`Created: ${V2_SHEET_TITLE} (sheetId=${v2SheetId})`);
  log(`Created: ${MEMO_SHEET_TITLE} (sheetId=${memoSheetId})`);

  // --- Step 2: write headers into 価格設定_v2 (A1:Q3) ---
  const v2Rows = [
    [...V2_ROW1, ...Array(16).fill('')],
    [...V2_ROW2, ...Array(16).fill('')],
    V2_HEADERS,
  ];
  await updateSheetValues({
    spreadsheetId: LIVE_SHEET_ID,
    accessToken: ctx.accessToken,
    sheetName: V2_SHEET_TITLE,
    range: 'A1:Q3',
    values: v2Rows,
  });
  log(`Wrote headers to ${V2_SHEET_TITLE}!A1:Q3`);

  // --- Step 3: write 運用メモ table (A1:D7) ---
  await updateSheetValues({
    spreadsheetId: LIVE_SHEET_ID,
    accessToken: ctx.accessToken,
    sheetName: MEMO_SHEET_TITLE,
    range: 'A1:D7',
    values: MEMO_ROWS,
  });
  log(`Wrote content to ${MEMO_SHEET_TITLE}!A1:D7`);

  // --- Step 4: formatting (gray header band on A3:Q3 in v2, bold on section titles) ---
  await batchUpdateSpreadsheet({
    spreadsheetId: LIVE_SHEET_ID,
    accessToken: ctx.accessToken,
    requests: [
      // v2: header band gray + bold (A3:Q3)
      {
        repeatCell: {
          range: { sheetId: v2SheetId, startRowIndex: 2, endRowIndex: 3, startColumnIndex: 0, endColumnIndex: 17 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.87, green: 0.87, blue: 0.87 },
              textFormat: { bold: true },
              horizontalAlignment: 'CENTER',
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
        },
      },
      // v2: title row bold (A2)
      {
        repeatCell: {
          range: { sheetId: v2SheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 17 },
          cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 12 } } },
          fields: 'userEnteredFormat.textFormat',
        },
      },
      // memo: section title bold (A1)
      {
        repeatCell: {
          range: { sheetId: memoSheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 4 },
          cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 12 } } },
          fields: 'userEnteredFormat.textFormat',
        },
      },
      // memo: header row gray + bold (A2:D2)
      {
        repeatCell: {
          range: { sheetId: memoSheetId, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 4 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.87, green: 0.87, blue: 0.87 },
              textFormat: { bold: true },
              horizontalAlignment: 'CENTER',
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)',
        },
      },
    ],
  });
  log('Applied formatting (gray header band + bold title)');

  // --- Write execution log ---
  mkdirSync(LOG_DIR, { recursive: true });
  writeFileSync(LOG_FILE, logLines.join('\n') + '\n', 'utf8');
  log(`Log file: ${LOG_FILE}`);
  console.log('\n[DONE] Scaffolds created. No existing sheets were modified.');
}

main().catch(e => {
  console.error('[ERROR]', e.message);
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    writeFileSync(LOG_FILE, logLines.join('\n') + `\n[ERROR] ${e.message}\n`, 'utf8');
  } catch {}
  process.exit(1);
});
