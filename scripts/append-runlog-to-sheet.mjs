#!/usr/bin/env node

import {
  appendSheetRow,
  getAuthorizedContext,
  loadJson,
  parseArgs,
} from './lib-sheets.mjs';

function printHelp() {
  console.log(`append-runlog-to-sheet.mjs

Usage:
  node scripts/append-runlog-to-sheet.mjs --json <path> [--write]
`);
}

function toRow(entry) {
  return [
    entry.log_id ?? '',
    entry.datetime ?? '',
    entry.system ?? '',
    entry.project ?? '',
    entry.summary ?? '',
    entry.result ?? '',
    entry.commit_hash ?? '',
    entry.tasks_done ?? '',
    entry.stop_reason ?? '',
    entry.next_action ?? '',
  ];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === 'true') {
    printHelp();
    return;
  }

  const jsonPath = args.json;
  if (!jsonPath) {
    throw new Error('Missing required --json argument');
  }

  const entry = loadJson(jsonPath);
  const row = toRow(entry);
  const context = await getAuthorizedContext(args);
  const isDryRun = args['dry-run'] === 'true' || !context.shouldWrite;

  console.log(`[INFO] Run_Log JSON : ${jsonPath}`);
  console.log(`[INFO] Spreadsheet  : ${context.spreadsheetId}`);
  console.log(`[INFO] Sheet name   : ${context.sheetName}`);
  console.log(`[INFO] Row values   : ${JSON.stringify(row)}`);
  console.log(`[INFO] Service acct : ${context.serviceAccountFile}`);

  if (isDryRun) {
    console.log('[INFO] Dry run mode. No data was written to Google Sheets.');
    return;
  }

  const result = await appendSheetRow({
    spreadsheetId: context.spreadsheetId,
    sheetName: context.sheetName,
    row,
    accessToken: context.accessToken,
  });

  const updatedRange = result?.updates?.updatedRange ?? '(unknown)';
  console.log(`[OK] Appended Run_Log row to ${updatedRange}`);
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
