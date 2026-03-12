#!/usr/bin/env node

import {
  getAuthorizedContext,
  getSheetValues,
  parseArgs,
  updateSheetValues,
} from './lib-sheets.mjs';

const RUN_LOG_HEADERS = [
  'log_id',
  'datetime',
  'system',
  'project',
  'summary',
  'result',
  'commit_hash',
  'tasks_done',
  'stop_reason',
  'next_action',
];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const context = await getAuthorizedContext(args);
  const isWrite = args.write === 'true';

  const current = await getSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: context.sheetName,
    range: '1:2',
    accessToken: context.accessToken,
  });

  console.log(`[INFO] Sheet name   : ${context.sheetName}`);
  console.log(`[INFO] Current row1 : ${JSON.stringify((current.values ?? [])[0] ?? [])}`);
  console.log(`[INFO] Current row2 : ${JSON.stringify((current.values ?? [])[1] ?? [])}`);
  console.log(`[INFO] Target row1  : ${JSON.stringify(RUN_LOG_HEADERS)}`);

  if (!isWrite) {
    console.log('[INFO] Dry run mode. Pass --write to update Run_Log!A1:J1.');
    return;
  }

  const result = await updateSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: context.sheetName,
    range: 'A1:J1',
    values: [RUN_LOG_HEADERS],
    accessToken: context.accessToken,
  });

  console.log(`[OK] Updated header range: ${result.updatedRange ?? 'A1:J1'}`);
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
