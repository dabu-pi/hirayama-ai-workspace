#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  batchGetSheetValues,
  getAuthorizedContext,
  getSpreadsheetMetadata,
  parseArgs,
} from './lib-sheets.mjs';
import {
  HIRAYAMA_INPUT_SYNC_CONFIG,
  HIRAYAMA_LIVE_SPREADSHEET_ID,
  buildSyncTargets,
} from './hirayama-input-sync-config.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DEFAULT_OUTPUT = resolve(__dirname, '..', 'hirayama-jyusei-strategy', 'data', 'inputs_snapshot.json');

function a1(sheetName, cell) {
  return `'${sheetName}'!${cell}`;
}

function normalizeRange(range) {
  const match = range.match(/^(?:'([^']+)'|([^!]+))!(.+)$/);
  if (!match) {
    return range;
  }
  const [, quotedSheet, plainSheet, cell] = match;
  return `${quotedSheet || plainSheet}!${cell}`;
}

function extractValue(valueRange) {
  if (!valueRange || !Array.isArray(valueRange.values) || valueRange.values.length === 0) {
    return null;
  }
  const row = valueRange.values[0];
  if (!Array.isArray(row) || row.length === 0) {
    return null;
  }
  return row[0] ?? null;
}

function mapValueRanges(valueRanges = []) {
  return new Map(valueRanges.map((entry) => [normalizeRange(entry.range), entry]));
}

function requireRangeValue(rangeMap, sheetName, cell, purpose) {
  const key = `${sheetName}!${cell}`;
  if (!rangeMap.has(key)) {
    throw new Error(`Missing ${purpose} response for ${sheetName}!${cell}`);
  }
  return extractValue(rangeMap.get(key));
}

function validateSheets(metadata, config) {
  const existingSheets = new Set((metadata.sheets || []).map((sheet) => sheet.properties?.title).filter(Boolean));
  for (const sheet of config) {
    if (!existingSheets.has(sheet.sheetName)) {
      throw new Error(`Missing target sheet in live spreadsheet: ${sheet.sheetName}`);
    }
  }
}

function buildSnapshot({ rawMap, displayMap, config, spreadsheetId, syncedAt }) {
  const snapshot = {
    synced_at: syncedAt,
    spreadsheet_id: spreadsheetId,
    sheets: {},
  };

  for (const sheet of config) {
    if (sheet.kind === 'items') {
      const items = {};
      for (const item of sheet.items) {
        const actualLabel = requireRangeValue(displayMap, sheet.sheetName, item.labelCell, 'label');
        const expectedLabel = item.expectedLabel || item.label;
        if ((actualLabel ?? '') !== expectedLabel) {
          throw new Error(
            `Label mismatch at ${sheet.sheetName}!${item.labelCell}: expected "${expectedLabel}" but got "${actualLabel ?? ''}"`
          );
        }

        items[item.label] = {
          key: item.key,
          cell: item.valueCell,
          value: requireRangeValue(rawMap, sheet.sheetName, item.valueCell, 'value'),
          display_value: requireRangeValue(displayMap, sheet.sheetName, item.valueCell, 'display value'),
        };
      }

      snapshot.sheets[sheet.sheetName] = {
        kind: sheet.kind,
        item_count: sheet.items.length,
        items,
      };
      continue;
    }

    const rows = [];
    for (const row of sheet.rows) {
      const rowLabelCell = `${sheet.rowLabelCellColumn}${row.row}`;
      const actualRowLabel = requireRangeValue(displayMap, sheet.sheetName, rowLabelCell, 'row label');
      if ((actualRowLabel ?? '') !== row.rowLabel) {
        throw new Error(
          `Row label mismatch at ${sheet.sheetName}!${rowLabelCell}: expected "${row.rowLabel}" but got "${actualRowLabel ?? ''}"`
        );
      }

      const fields = {};
      for (const field of row.fields) {
        fields[field.label] = {
          key: field.key,
          cell: field.valueCell,
          value: requireRangeValue(rawMap, sheet.sheetName, field.valueCell, 'value'),
          display_value: requireRangeValue(displayMap, sheet.sheetName, field.valueCell, 'display value'),
        };
      }

      rows.push({
        row: row.row,
        row_key: row.rowKey,
        row_label: row.rowLabel,
        fields,
      });
    }

    snapshot.sheets[sheet.sheetName] = {
      kind: sheet.kind,
      row_count: rows.length,
      rows,
    };
  }

  return snapshot;
}

function buildSummary(snapshot) {
  const sheets = {};
  for (const [sheetName, sheet] of Object.entries(snapshot.sheets)) {
    if (sheet.kind === 'items') {
      sheets[sheetName] = { item_count: sheet.item_count };
      continue;
    }
    sheets[sheetName] = { row_count: sheet.row_count };
  }

  return {
    synced_at: snapshot.synced_at,
    spreadsheet_id: snapshot.spreadsheet_id,
    sheets,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = args['dry-run'] === 'true';
  const outputPath = resolve(args.output || DEFAULT_OUTPUT);
  const spreadsheetId = args['spreadsheet-id'] || HIRAYAMA_LIVE_SPREADSHEET_ID;

  const context = await getAuthorizedContext({ 'spreadsheet-id': spreadsheetId });
  const metadata = await getSpreadsheetMetadata({
    spreadsheetId: context.spreadsheetId,
    accessToken: context.accessToken,
    fields: 'sheets(properties(title))',
  });
  validateSheets(metadata, HIRAYAMA_INPUT_SYNC_CONFIG);

  const targets = buildSyncTargets();
  const ranges = targets.map((target) => a1(target.sheetName, target.cell));

  const [rawResponse, displayResponse] = await Promise.all([
    batchGetSheetValues({
      spreadsheetId: context.spreadsheetId,
      accessToken: context.accessToken,
      ranges,
      valueRenderOption: 'UNFORMATTED_VALUE',
    }),
    batchGetSheetValues({
      spreadsheetId: context.spreadsheetId,
      accessToken: context.accessToken,
      ranges,
      valueRenderOption: 'FORMATTED_VALUE',
    }),
  ]);

  const syncedAt = new Date().toISOString();
  const snapshot = buildSnapshot({
    rawMap: mapValueRanges(rawResponse.valueRanges),
    displayMap: mapValueRanges(displayResponse.valueRanges),
    config: HIRAYAMA_INPUT_SYNC_CONFIG,
    spreadsheetId: context.spreadsheetId,
    syncedAt,
  });

  if (dryRun) {
    console.log(JSON.stringify({
      dry_run: true,
      output_path: outputPath,
      summary: buildSummary(snapshot),
      snapshot,
    }, null, 2));
    return;
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    dry_run: false,
    output_path: outputPath,
    summary: buildSummary(snapshot),
  }, null, 2));
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
