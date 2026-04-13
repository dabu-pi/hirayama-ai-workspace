#!/usr/bin/env node

import {
  getAuthorizedContext,
  getSheetValues,
  getSpreadsheetMetadata,
  parseArgs,
} from './lib-sheets.mjs';

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const context = await getAuthorizedContext(args);
  const metadata = await getSpreadsheetMetadata(context);
  const headerRange = args.range || '1:3';

  console.log(`[INFO] Spreadsheet: ${context.spreadsheetId}`);
  console.log(`[INFO] Service acct: ${context.serviceAccountFile}`);
  console.log('');

  for (const sheet of metadata.sheets ?? []) {
    const title = sheet.properties?.title ?? '(unknown)';
    const index = sheet.properties?.index ?? -1;
    const data = await getSheetValues({
      spreadsheetId: context.spreadsheetId,
      sheetName: title,
      range: headerRange,
      accessToken: context.accessToken,
    }).catch((error) => ({ error: error.message }));

    console.log(`## [${index}] ${title}`);
    if (data.error) {
      console.log(`ERROR: ${data.error}`);
      console.log('');
      continue;
    }

    const rows = data.values ?? [];
    if (rows.length === 0) {
      console.log('(empty)');
      console.log('');
      continue;
    }

    rows.forEach((row, idx) => {
      console.log(`Row ${idx + 1}: ${JSON.stringify(row)}`);
    });
    console.log('');
  }
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
