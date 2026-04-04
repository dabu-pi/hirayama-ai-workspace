#!/usr/bin/env node

import { getAuthorizedContext, parseArgs } from './lib-sheets.mjs';

const DEFAULT_SPREADSHEET_ID = '1KqOnN5eGh0i_DNRnpMHg9fqnR0DdVNeLEgui7lku3qk';
const DEFAULT_RANGE = "'ネットショップ商品一覧'!P1:R8";

async function fetchGridData({ spreadsheetId, range, accessToken }) {
  const params = new URLSearchParams({
    ranges: range,
    includeGridData: 'true',
    fields:
      'sheets(data(rowData(values(formattedValue,hyperlink,userEnteredValue,effectiveValue,textFormatRuns))))',
  });
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?${params.toString()}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google Sheets API error (${response.status}): ${text}`);
  }
  return response.json();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const spreadsheetId = args['spreadsheet-id'] || DEFAULT_SPREADSHEET_ID;
  const range = args.range || DEFAULT_RANGE;
  const context = await getAuthorizedContext({ 'spreadsheet-id': spreadsheetId });
  const payload = await fetchGridData({
    spreadsheetId: context.spreadsheetId,
    range,
    accessToken: context.accessToken,
  });
  console.log(JSON.stringify(payload, null, 2));
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
