#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  batchGetSheetValues,
  getAuthorizedContext,
  getSpreadsheetMetadata,
  parseArgs,
  updateSheetValues,
} from './lib-sheets.mjs';

const DEFAULT_SPREADSHEET_ID = '1sj6dYtkFbnk4fjLOk764f-w7KUUeGNVYcbMDOg26OXY';
const DEFAULT_SERVICE_ACCOUNT = 'C:/hirayama-ai-workspace/workspace/secrets/service_account.json';
const DEFAULT_SHEET_NAME = '\u981a\u80a9\u3053\u308a_\u30b3\u30e1\u30f3\u30c8\u30de\u30b9\u30bf';
const DEFAULT_SETUP_FILE = 'C:/hirayama-ai-workspace/workspace/msk-assessment-platform/gas/setup_neck_shoulder.js';
const TARGET_ROW_COUNT = 120;

function extractLiteralBlock(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) {
    throw new Error(`Marker not found: ${marker}`);
  }

  const startIndex = source.indexOf('[', markerIndex);
  if (startIndex < 0) {
    throw new Error(`Array literal not found after marker: ${marker}`);
  }

  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;
  let inLineComment = false;
  let inBlockComment = false;
  let escaping = false;

  for (let i = startIndex; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];

    if (inLineComment) {
      if (char === '\n') {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false;
        i += 1;
      }
      continue;
    }

    if (inSingle || inDouble || inTemplate) {
      if (escaping) {
        escaping = false;
        continue;
      }
      if (char === '\\') {
        escaping = true;
        continue;
      }
      if (inSingle && char === '\'') {
        inSingle = false;
      } else if (inDouble && char === '"') {
        inDouble = false;
      } else if (inTemplate && char === '`') {
        inTemplate = false;
      }
      continue;
    }

    if (char === '/' && next === '/') {
      inLineComment = true;
      i += 1;
      continue;
    }

    if (char === '/' && next === '*') {
      inBlockComment = true;
      i += 1;
      continue;
    }

    if (char === '\'') {
      inSingle = true;
      continue;
    }

    if (char === '"') {
      inDouble = true;
      continue;
    }

    if (char === '`') {
      inTemplate = true;
      continue;
    }

    if (char === '[') {
      depth += 1;
      continue;
    }

    if (char === ']') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(startIndex, i + 1);
      }
    }
  }

  throw new Error(`Array literal was not closed: ${marker}`);
}

function extractTodayLiteral(source) {
  const match = source.match(/const today = ['"]([^'"]+)['"];/);
  if (!match) {
    throw new Error('const today literal not found in setup_neck_shoulder.js');
  }
  return match[1];
}

function evaluateArrayLiteral(arrayLiteral, today) {
  return Function(
    '"use strict";\n' +
    `const today = ${JSON.stringify(today)};\n` +
    `return (${arrayLiteral});\n`,
  )();
}

function loadCanonicalCommentMaster(setupFilePath) {
  const source = readFileSync(resolve(setupFilePath), 'utf8');
  const today = extractTodayLiteral(source);
  const headersLiteral = extractLiteralBlock(source, 'const headers =');
  const rowsLiteral = extractLiteralBlock(source, 'const rows =');
  const headers = evaluateArrayLiteral(headersLiteral, today);
  const rows = evaluateArrayLiteral(rowsLiteral, today);

  if (!Array.isArray(headers) || !Array.isArray(rows) || rows.length === 0) {
    throw new Error('Failed to load canonical headers/rows from setup_neck_shoulder.js');
  }

  return { headers, rows };
}

function normalizeRangeKey(value) {
  return String(value || '').replace(/^'(.+)'!/, '$1!');
}

function padRows(rows, targetRowCount, width) {
  const padded = rows.slice(0, targetRowCount).map((row) => {
    const next = row.slice(0, width);
    while (next.length < width) {
      next.push('');
    }
    return next;
  });
  while (padded.length < targetRowCount) {
    padded.push(new Array(width).fill(''));
  }
  return padded;
}

function trimTrailingBlankRows(rows) {
  const out = rows.map((row) => row.map((value) => (value === undefined ? '' : value)));
  while (out.length > 0) {
    const last = out[out.length - 1];
    if (last.some((value) => value !== '')) {
      break;
    }
    out.pop();
  }
  return out;
}

function rowsEqual(left, right) {
  if (left.length !== right.length) {
    return false;
  }
  for (let i = 0; i < left.length; i += 1) {
    const a = left[i] || [];
    const b = right[i] || [];
    if (a.length !== b.length) {
      return false;
    }
    for (let j = 0; j < a.length; j += 1) {
      if (String(a[j] ?? '') !== String(b[j] ?? '')) {
        return false;
      }
    }
  }
  return true;
}

function collectDiffs(expected, actual, maxCount = 5) {
  const diffs = [];
  const rowCount = Math.max(expected.length, actual.length);
  for (let i = 0; i < rowCount; i += 1) {
    const expectedRow = expected[i] || [];
    const actualRow = actual[i] || [];
    const colCount = Math.max(expectedRow.length, actualRow.length);
    for (let j = 0; j < colCount; j += 1) {
      const left = String(expectedRow[j] ?? '');
      const right = String(actualRow[j] ?? '');
      if (left !== right) {
        diffs.push({
          row: i + 1,
          col: j + 1,
          expected: left,
          actual: right,
        });
        if (diffs.length >= maxCount) {
          return diffs;
        }
      }
    }
  }
  return diffs;
}

async function readLiveValues(context, sheetName) {
  const batch = await batchGetSheetValues({
    spreadsheetId: context.spreadsheetId,
    accessToken: context.accessToken,
    ranges: [`${sheetName}!A1:G${TARGET_ROW_COUNT}`],
    valueRenderOption: 'FORMATTED_VALUE',
  });

  const item = (batch.valueRanges || [])[0];
  return trimTrailingBlankRows(item?.values || []);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const spreadsheetId = args['spreadsheet-id'] || DEFAULT_SPREADSHEET_ID;
  const serviceAccountPath = args['service-account'] || DEFAULT_SERVICE_ACCOUNT;
  const sheetName = args['sheet-name'] || DEFAULT_SHEET_NAME;
  const setupFilePath = args['setup-file'] || DEFAULT_SETUP_FILE;
  const dryRun = args['dry-run'] === 'true';
  const jsonMode = args.json === 'true';

  const context = await getAuthorizedContext({
    'spreadsheet-id': spreadsheetId,
    'service-account': serviceAccountPath,
  });

  const metadata = await getSpreadsheetMetadata({
    spreadsheetId,
    accessToken: context.accessToken,
    fields: 'properties.title,sheets(properties(title,index))',
  });

  const availableSheets = (metadata.sheets || []).map((sheet) => sheet.properties?.title).filter(Boolean);
  if (!availableSheets.includes(sheetName)) {
    throw new Error(`Sheet not found: ${sheetName}`);
  }

  const { headers, rows } = loadCanonicalCommentMaster(setupFilePath);
  const canonicalRows = [headers, ...rows];
  const beforeRows = await readLiveValues(context, sheetName);

  if (!dryRun) {
    const paddedRows = padRows(canonicalRows, TARGET_ROW_COUNT, 7);
    await updateSheetValues({
      spreadsheetId,
      accessToken: context.accessToken,
      sheetName,
      range: `A1:G${TARGET_ROW_COUNT}`,
      values: paddedRows,
    });
  }

  const afterRows = await readLiveValues(context, sheetName);
  const expectedRows = trimTrailingBlankRows(canonicalRows);
  const synced = rowsEqual(expectedRows, afterRows.slice(0, expectedRows.length));

  const report = {
    spreadsheetId,
    spreadsheetTitle: metadata.properties?.title || '(unknown)',
    sheetName,
    setupFilePath: resolve(setupFilePath),
    serviceAccountFile: context.serviceAccountFile,
    dryRun,
    canonicalRowCount: rows.length,
    liveRowCountBefore: Math.max(beforeRows.length - 1, 0),
    liveRowCountAfter: Math.max(afterRows.length - 1, 0),
    synced,
    diffs: synced ? [] : collectDiffs(expectedRows, afterRows.slice(0, expectedRows.length)),
    sampleKeys: rows.slice(0, 5).map((row) => row[0]),
  };

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`Spreadsheet: ${report.spreadsheetTitle}`);
  console.log(`Sheet: ${report.sheetName}`);
  console.log(`Canonical rows: ${report.canonicalRowCount}`);
  console.log(`Live rows before: ${report.liveRowCountBefore}`);
  console.log(`Live rows after: ${report.liveRowCountAfter}`);
  console.log(`Synced: ${report.synced ? 'YES' : 'NO'}`);
  if (!report.synced) {
    console.log('Diffs:');
    report.diffs.forEach((diff) => {
      console.log(
        `- row ${diff.row}, col ${diff.col}: expected="${diff.expected}" actual="${diff.actual}"`,
      );
    });
  }
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
