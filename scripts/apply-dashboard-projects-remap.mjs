#!/usr/bin/env node

import {
  batchUpdateSpreadsheet,
  getAuthorizedContext,
  getSpreadsheetMetadata,
  parseArgs,
  updateSheetValues,
} from './lib-sheets.mjs';

const DASHBOARD_HEADERS = [
  'Project',
  'Status',
  'Phase',
  'Priority',
  'Last Updated',
  'Next Action',
  'Blocker',
];

function buildFormulaRow(rowNumber) {
  return [
    `=Projects!B${rowNumber}`,
    `=Projects!D${rowNumber}`,
    `=Projects!E${rowNumber}`,
    `=Projects!F${rowNumber}`,
    `=Projects!G${rowNumber}`,
    `=Projects!H${rowNumber}`,
    `=Projects!I${rowNumber}`,
  ];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const context = await getAuthorizedContext(args);
  const startRow = Number(args['projects-start-row'] || 4);
  const rows = Number(args.rows || 5);
  const isWrite = args.write === 'true';

  const values = [DASHBOARD_HEADERS];
  for (let i = 0; i < rows; i += 1) {
    values.push(buildFormulaRow(startRow + i));
  }

  console.log(`[INFO] Target range : Dashboard!H11:N${11 + rows}`);
  console.log(`[INFO] Header row   : ${JSON.stringify(DASHBOARD_HEADERS)}`);
  console.log(`[INFO] First row    : ${JSON.stringify(values[1])}`);
  console.log('[INFO] Apply only after Projects has been migrated to the canonical 10-column schema.');

  if (!isWrite) {
    console.log('[INFO] Dry run mode. Pass --write to update the live Dashboard sheet.');
    return;
  }

  const result = await updateSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: 'Dashboard',
    range: `H11:N${11 + rows}`,
    values,
    accessToken: context.accessToken,
  });

  const metadata = await getSpreadsheetMetadata(context);
  const dashboardSheet = (metadata.sheets || []).find((sheet) => sheet.properties?.title === 'Dashboard');
  if (dashboardSheet?.properties?.sheetId !== undefined) {
    await batchUpdateSpreadsheet({
      spreadsheetId: context.spreadsheetId,
      accessToken: context.accessToken,
      requests: [
        {
          repeatCell: {
            range: {
              sheetId: dashboardSheet.properties.sheetId,
              startRowIndex: 11,
              endRowIndex: 11 + rows,
              startColumnIndex: 11,
              endColumnIndex: 12,
            },
            cell: {
              userEnteredFormat: {
                numberFormat: {
                  type: 'DATE',
                  pattern: 'yyyy-mm-dd',
                },
              },
            },
            fields: 'userEnteredFormat.numberFormat',
          },
        },
      ],
    });
  }

  console.log(`[OK] Updated Dashboard project snapshot: ${result.updatedRange ?? `Dashboard!H11:N${11 + rows}`}`);
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
