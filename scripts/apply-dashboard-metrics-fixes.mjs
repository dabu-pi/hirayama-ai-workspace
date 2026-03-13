#!/usr/bin/env node

import { getAuthorizedContext, parseArgs, updateSheetValues } from './lib-sheets.mjs';

const CANONICAL_PROJECT_PATTERN = 'JREC-01|JBIZ-04|HAIKI-05|JWEB-03';

const METRICS_VALUES = [
  ['運用指標', '値'],
  ['総案件数', '=COUNTA(Projects!A4:A20)'],
  ['本番運用中', '=COUNTIF(Projects!C4:C20,"本番運用中")'],
  ['進行中', '=COUNTIF(Projects!C4:C20,"進行中")'],
  ['未完了タスク', '=COUNTIFS(Task_Queue!A4:A200,"<>",Task_Queue!J4:J200,"<>完了")'],
  ['保留アイデア数', '=COUNTIF(Ideas!E4:E200,"保留")'],
  ['今日優先タスク数', '=COUNTIF(\'優先度調整\'!D4:D200,"はい")'],
];

const DASHBOARD_SUMMARY = [
  ['総案件数', '', '本番運用中', '', '進行中', '', '未完了タスク', '', '保留アイデア数'],
  ['=COUNTA(Projects!A4:A20)', '', '=COUNTIF(Projects!C4:C20,"本番運用中")', '', '=COUNTIF(Projects!C4:C20,"進行中")', '', '=COUNTIFS(Task_Queue!A4:A200,"<>",Task_Queue!J4:J200,"<>完了")', '', '=COUNTIF(Ideas!E4:E200,"保留")'],
];

const DASHBOARD_RECENT = [
  ['最近の更新'],
  ['日時', '案件', '実行元', '内容', '結果', '次アクション'],
  [`=IFERROR(ARRAY_CONSTRAIN(QUERY(FILTER({Run_Log!B4:B,Run_Log!D4:D,Run_Log!C4:C,Run_Log!E4:E,Run_Log!F4:F,Run_Log!J4:J},Run_Log!B4:B<>"",REGEXMATCH(Run_Log!D4:D,"^(${CANONICAL_PROJECT_PATTERN})$")),"select Col1,Col2,Col3,Col4,Col5,Col6 order by Col1 desc",0),6,6),"")`, '', '', '', '', ''],
];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const context = await getAuthorizedContext(args);
  const isWrite = args.write === 'true';

  console.log('[INFO] Metrics target   : Metrics!A1:B15');
  console.log('[INFO] Dashboard cards : Dashboard!A5:I6');
  console.log('[INFO] Dashboard logs  : Dashboard!A18:F20');

  if (!isWrite) {
    console.log('[INFO] Dry run mode. Pass --write to update the live Metrics and Dashboard ranges.');
    return;
  }

  await Promise.all([
    updateSheetValues({
      spreadsheetId: context.spreadsheetId,
      sheetName: 'Metrics',
      range: 'A1:B15',
      values: [...METRICS_VALUES, ...Array.from({ length: 8 }, () => ['', ''])],
      accessToken: context.accessToken,
    }),
    updateSheetValues({
      spreadsheetId: context.spreadsheetId,
      sheetName: 'Dashboard',
      range: 'A5:I6',
      values: DASHBOARD_SUMMARY,
      accessToken: context.accessToken,
    }),
    updateSheetValues({
      spreadsheetId: context.spreadsheetId,
      sheetName: 'Dashboard',
      range: 'A18:F20',
      values: DASHBOARD_RECENT,
      accessToken: context.accessToken,
    }),
  ]);

  console.log('[OK] Metrics and Dashboard summary blocks were refreshed for the Japanese layout.');
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
