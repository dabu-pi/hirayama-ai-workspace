#!/usr/bin/env node

import { batchUpdateSpreadsheet, getAuthorizedContext, updateSheetValues } from './lib-sheets.mjs';

const SPREADSHEET_ID = '1FnJdALwFSv48WiD6NWr0DzG78kwB692R2pFeiTcZlCc';
const SHEET_D = '全体ダッシュボード';
const SHEET_R = 'ロードマップ進捗';
const SHEET_O = '未確定項目';
const SHEET_K = 'KPI逆算';

const rows = [
  ['■ 進捗サマリ（自動集計）', '', ''],
  ['現在フェーズ', `=IFERROR(INDEX('${SHEET_R}'!B4:B9,MATCH("進行中",'${SHEET_R}'!E4:E9,0)),"未設定")`, 'ロードマップ進捗シートを参照'],
  ['戦略完成度（%）', `=IFERROR(TEXT(COUNTIF('${SHEET_R}'!E4:E9,"完了")/6,"0%"),"0%")`, '完了フェーズ数÷6'],
  ['数値確定度（%）', `=IFERROR(TEXT(COUNTIF('${SHEET_O}'!F4:F14,"確定済み")/11,"0%"),"0%")`, '確定済み件数÷11'],
  ['未確定項目数（件）', `=IFERROR(COUNTIF('${SHEET_O}'!F4:F14,"未確定")&"件","—")`, '未確定項目シートを参照'],
  ['月自費収益目標', `=IFERROR(TEXT(INDEX('${SHEET_K}'!C:C,MATCH("月次自費目標",'${SHEET_K}'!B:B,0)),"#,##0")&"円","要入力")`, 'KPI逆算シートを参照'],
  ['必要手技回数/月', `=IFERROR(TEXT(INDEX('${SHEET_K}'!C:C,MATCH("必要手技回数",'${SHEET_K}'!B:B,0)),"0.0")&"回","要入力")`, '自費目標 ÷ 主力手技価格'],
  ['必要手技回数/日', `=IFERROR(TEXT(INDEX('${SHEET_K}'!C:C,MATCH("必要手技回数/日",'${SHEET_K}'!B:B,0)),"0.0")&"回","要入力")`, '必要手技回数 ÷ 営業日数'],
  ['保険実人数', `=IFERROR(TEXT(INDEX('${SHEET_K}'!C:C,MATCH("保険実人数",'${SHEET_K}'!B:B,0)),"0")&"人","要入力")`, '入口KPI'],
  ['月次総保険売上', `=IFERROR(TEXT(INDEX('${SHEET_K}'!C:C,MATCH("月次総保険売上",'${SHEET_K}'!B:B,0)),"#,##0")&"円","要入力")`, '窓口負担 + 保険者支払分'],
  ['慢性候補人数', `=IFERROR(TEXT(INDEX('${SHEET_K}'!C:C,MATCH("慢性候補人数",'${SHEET_K}'!B:B,0)),"0.0")&"人","要入力")`, '保険実人数 × 慢性候補率'],
  ['手技回数', `=IFERROR(TEXT(INDEX('${SHEET_K}'!C:C,MATCH("手技回数",'${SHEET_K}'!B:B,0)),"0.0")&"回","要入力")`, '月次の見込み手技回数'],
  ['見込み自費売上', `=IFERROR(TEXT(INDEX('${SHEET_K}'!C:C,MATCH("自費売上",'${SHEET_K}'!B:B,0)),"#,##0")&"円","要入力")`, '手技回数 × 主力手技価格'],
  ['ジム体験人数', `=IFERROR(TEXT(INDEX('${SHEET_K}'!C:C,MATCH("ジム体験人数",'${SHEET_K}'!B:B,0)),"0.0")&"人","要入力")`, '手技患者数 × ジム体験誘導率'],
];

const ctx = await getAuthorizedContext({ 'spreadsheet-id': SPREADSHEET_ID });

await batchUpdateSpreadsheet({
  spreadsheetId: ctx.spreadsheetId,
  accessToken: ctx.accessToken,
  requests: [
    {
      unmergeCells: {
        range: {
          sheetId: 0,
          startRowIndex: 5,
          endRowIndex: 19,
          startColumnIndex: 0,
          endColumnIndex: 3,
        },
      },
    },
  ],
});

const result = await updateSheetValues({
  spreadsheetId: ctx.spreadsheetId,
  sheetName: SHEET_D,
  range: 'A6:C19',
  values: rows,
  accessToken: ctx.accessToken,
});

console.log(JSON.stringify(result, null, 2));
