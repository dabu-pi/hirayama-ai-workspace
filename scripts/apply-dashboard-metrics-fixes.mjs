#!/usr/bin/env node

import {
  batchUpdateSpreadsheet,
  getAuthorizedContext,
  getSpreadsheetMetadata,
  parseArgs,
  updateSheetValues,
} from './lib-sheets.mjs';

const METRICS_VALUES = [
  ['Total Projects', '=COUNTA(Projects!A4:A200)', '', 'Status', 'Count'],
  ['Production Systems', '=COUNTIF(Projects!J4:J200,"*legacy_type=本番*")', '', '進行中', '=COUNTIF(Projects!D4:D200,"進行中")'],
  ['Projects In Progress', '=COUNTIF(Projects!D4:D200,"進行中")', '', '試作', '=COUNTIF(Projects!D4:D200,"試作")'],
  ['Projects Prototype', '=COUNTIF(Projects!D4:D200,"試作")', '', '保留', '=COUNTIF(Projects!D4:D200,"保留")'],
  ['Projects Parked', '=COUNTIF(Projects!D4:D200,"保留")', '', '完了', '=COUNTIF(Projects!D4:D200,"完了")'],
  ['Projects Complete', '=COUNTIF(Projects!D4:D200,"完了")', '', '稼働中', '=COUNTIF(Projects!D4:D200,"稼働中")'],
  ['Average Progress', '=IFERROR(AVERAGE(ArrayFormula(IFERROR(VALUE(REGEXEXTRACT(Projects!J4:J200,"progress=(\\d+)%"))/100,))),0)'],
  ['Open Tasks', '=COUNTIFS(Task_Queue!A4:A300,"<>",Task_Queue!E4:E300,"<>完了")'],
  ['High Priority Open Tasks', '=COUNTIFS(Task_Queue!A4:A300,"<>",Task_Queue!D4:D300,"高",Task_Queue!E4:E300,"<>完了")'],
  ['Idea Count', '=COUNTA(Ideas!A4:A200)'],
];

const LATEST_RUN_HEADERS = ['Date', 'Project', 'System', 'Summary', 'Result', 'Commit', 'Next Action'];
const LATEST_RUN_FORMULA = '=ARRAY_CONSTRAIN(QUERY({Run_Log!B4:B,Run_Log!D4:D,Run_Log!C4:C,Run_Log!E4:E,Run_Log!F4:F,Run_Log!G4:G,Run_Log!J4:J},"select Col1,Col2,Col3,Col4,Col5,Col6,Col7 where Col1 is not null order by Col1 desc",0),5,7)';

function buildLatestRunValues() {
  return [
    LATEST_RUN_HEADERS,
    [LATEST_RUN_FORMULA, '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
    ['', '', '', '', '', '', ''],
  ];
}

async function applyNumberFormats(context) {
  const metadata = await getSpreadsheetMetadata(context);
  const metricsSheet = (metadata.sheets || []).find((sheet) => sheet.properties?.title === 'Metrics');
  const dashboardSheet = (metadata.sheets || []).find((sheet) => sheet.properties?.title === 'Dashboard');
  const requests = [];

  if (metricsSheet?.properties?.sheetId !== undefined) {
    requests.push({
      repeatCell: {
        range: {
          sheetId: metricsSheet.properties.sheetId,
          startRowIndex: 7,
          endRowIndex: 8,
          startColumnIndex: 1,
          endColumnIndex: 2,
        },
        cell: {
          userEnteredFormat: {
            numberFormat: {
              type: 'PERCENT',
              pattern: '0%',
            },
          },
        },
        fields: 'userEnteredFormat.numberFormat',
      },
    });
  }

  if (dashboardSheet?.properties?.sheetId !== undefined) {
    requests.push({
      repeatCell: {
        range: {
          sheetId: dashboardSheet.properties.sheetId,
          startRowIndex: 5,
          endRowIndex: 6,
          startColumnIndex: 6,
          endColumnIndex: 7,
        },
        cell: {
          userEnteredFormat: {
            numberFormat: {
              type: 'PERCENT',
              pattern: '0%',
            },
          },
        },
        fields: 'userEnteredFormat.numberFormat',
      },
    });
  }

  if (requests.length > 0) {
    await batchUpdateSpreadsheet({
      spreadsheetId: context.spreadsheetId,
      accessToken: context.accessToken,
      requests,
    });
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const context = await getAuthorizedContext(args);
  const isWrite = args.write === 'true';
  const latestRunValues = buildLatestRunValues();

  console.log('[INFO] Metrics target   : Metrics!A2:E11');
  console.log(`[INFO] Metrics sample   : ${JSON.stringify(METRICS_VALUES[1])}`);
  console.log('[INFO] Dashboard target : Dashboard!H21:N26');
  console.log(`[INFO] Latest run head  : ${JSON.stringify(LATEST_RUN_HEADERS)}`);
  console.log(`[INFO] Latest run expr  : ${LATEST_RUN_FORMULA}`);

  if (!isWrite) {
    console.log('[INFO] Dry run mode. Pass --write to update the live Dashboard and Metrics sheets.');
    return;
  }

  const metricsResult = await updateSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: 'Metrics',
    range: 'A2:E11',
    values: METRICS_VALUES,
    accessToken: context.accessToken,
  });

  const dashboardResult = await updateSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: 'Dashboard',
    range: 'H21:N26',
    values: latestRunValues,
    accessToken: context.accessToken,
  });

  await applyNumberFormats(context);

  console.log(`[OK] Metrics formulas updated  : ${metricsResult.updatedRange ?? 'Metrics!A2:E11'}`);
  console.log(`[OK] Dashboard latest run sync: ${dashboardResult.updatedRange ?? 'Dashboard!H21:N26'}`);
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
