#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  batchUpdateSpreadsheet,
  getAuthorizedContext,
  getSpreadsheetMetadata,
  parseArgs,
} from './lib-sheets.mjs';
import {
  DEFAULT_RANGE,
  formatTaskQueueRowRange,
  loadTaskQueueAnalysis,
  SHEET_NAME,
} from './task-queue-validation-lib.mjs';

function printHelp() {
  console.log(`cleanup-known-taskqueue-row.mjs

Usage:
  node scripts/cleanup-known-taskqueue-row.mjs [--range 1:200]
  node scripts/cleanup-known-taskqueue-row.mjs [--range 1:200] --write

Notes:
  - Deletes a Task_Queue row only when the validator logic finds exactly one known cleanup candidate.
  - A backup JSON is always written before delete when --write is used.
  - After delete, revalidation must return 0 findings or the command fails.
`);
}

function timestampString() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const mi = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');
  return `${yyyy}${mm}${dd}_${hh}${mi}${ss}`;
}

function buildBackupPayload(candidate, range) {
  return {
    saved_at: new Date().toISOString(),
    sheet_name: SHEET_NAME,
    scan_range: `${SHEET_NAME}!${range}`,
    row_range: formatTaskQueueRowRange(candidate.rowNumber),
    row_number: candidate.rowNumber,
    missing: candidate.missing,
    row: candidate.row,
  };
}

async function deleteRow(context, rowNumber) {
  const metadata = await getSpreadsheetMetadata(context);
  const sheet = (metadata.sheets ?? []).find((entry) => entry.properties?.title === SHEET_NAME);
  if (!sheet) {
    throw new Error(`${SHEET_NAME} sheet metadata was not found.`);
  }

  await batchUpdateSpreadsheet({
    spreadsheetId: context.spreadsheetId,
    accessToken: context.accessToken,
    requests: [
      {
        deleteDimension: {
          range: {
            sheetId: sheet.properties.sheetId,
            dimension: 'ROWS',
            startIndex: rowNumber - 1,
            endIndex: rowNumber,
          },
        },
      },
    ],
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === 'true') {
    printHelp();
    return;
  }

  const context = await getAuthorizedContext(args);
  const range = args.range || DEFAULT_RANGE;
  const shouldWrite = args.write === 'true';
  const backupDir = resolve(args['backup-dir'] || 'logs/taskqueue');
  const analysis = await loadTaskQueueAnalysis({ context, range });

  console.log(`[INFO] Sheet        : ${SHEET_NAME}`);
  console.log(`[INFO] Scan range   : ${SHEET_NAME}!${range}`);
  console.log(`[INFO] Findings     : ${analysis.findings.length}`);

  if (!analysis.knownCleanupCandidate) {
    console.log('[INFO] Known cleanup: no single known incomplete row candidate was found.');
    return;
  }

  const candidate = analysis.knownCleanupCandidate;
  const backupPayload = buildBackupPayload(candidate, range);
  const backupPath = resolve(backupDir, `taskqueue_cleanup_backup_${timestampString()}.json`);

  console.log(`[INFO] Candidate    : ${formatTaskQueueRowRange(candidate.rowNumber)}`);
  console.log(`[INFO] Missing      : ${candidate.missing.join(', ')}`);
  console.log(`[INFO] Row payload  : ${JSON.stringify(candidate.row)}`);
  console.log(`[INFO] Backup path  : ${backupPath}`);

  if (!shouldWrite) {
    console.log('[INFO] Dry run mode. Pass --write to save the backup and delete the row.');
    return;
  }

  mkdirSync(backupDir, { recursive: true });
  writeFileSync(backupPath, `${JSON.stringify(backupPayload, null, 2)}\n`, 'utf8');
  await deleteRow(context, candidate.rowNumber);

  const revalidated = await loadTaskQueueAnalysis({ context, range });
  if (revalidated.findings.length !== 0) {
    throw new Error(`Revalidation failed after delete: ${revalidated.findings.length} incomplete row(s) remain.`);
  }

  console.log(`[OK] Backup saved   : ${backupPath}`);
  console.log(`[OK] Deleted row    : ${formatTaskQueueRowRange(candidate.rowNumber)}`);
  console.log('[OK] Revalidation   : 0 incomplete rows remain.');
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
