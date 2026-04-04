#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getAuthorizedContext,
  getSheetValues,
  getSpreadsheetMetadata,
  parseArgs,
} from './lib-sheets.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DEFAULT_SPREADSHEET_ID = '1KqOnN5eGh0i_DNRnpMHg9fqnR0DdVNeLEgui7lku3qk';
const DEFAULT_SHEET_NAME = 'ネットショップ商品一覧';
const DEFAULT_RANGE = 'A:ZZ';
const DEFAULT_OUTPUT = resolve(
  __dirname,
  '..',
  'data',
  'input',
  'current_product_master.full.csv',
);

function toCsvCell(value) {
  const text = value == null ? '' : String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function toCsv(rows) {
  return `${rows.map((row) => row.map((value) => toCsvCell(value)).join(',')).join('\n')}\n`;
}

function assertTargetSheetExists(metadata, sheetName) {
  const sheet = (metadata.sheets || []).find(
    (entry) => entry.properties?.title === sheetName,
  );
  if (!sheet) {
    const titles = (metadata.sheets || [])
      .map((entry) => entry.properties?.title)
      .filter(Boolean);
    throw new Error(`Sheet not found: ${sheetName}. Available sheets: ${titles.join(', ')}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const spreadsheetId = args['spreadsheet-id'] || DEFAULT_SPREADSHEET_ID;
  const sheetName = args['sheet-name'] || DEFAULT_SHEET_NAME;
  const range = args.range || DEFAULT_RANGE;
  const outputPath = resolve(args.output || DEFAULT_OUTPUT);

  const context = await getAuthorizedContext({ 'spreadsheet-id': spreadsheetId });
  const metadata = await getSpreadsheetMetadata({
    spreadsheetId: context.spreadsheetId,
    accessToken: context.accessToken,
    fields: 'sheets(properties(title,index,gridProperties))',
  });
  assertTargetSheetExists(metadata, sheetName);

  const response = await getSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName,
    range,
    accessToken: context.accessToken,
    valueRenderOption: 'FORMATTED_VALUE',
  });
  const rows = Array.isArray(response.values) ? response.values : [];

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `\uFEFF${toCsv(rows)}`, 'utf8');

  console.log(JSON.stringify({
    spreadsheetId: context.spreadsheetId,
    sheetName,
    range,
    outputPath,
    rowCount: rows.length,
    columnCount: rows.reduce((maxValue, row) => Math.max(maxValue, row.length), 0),
  }, null, 2));
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
