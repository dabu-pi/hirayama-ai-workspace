#!/usr/bin/env node

import {
  getAuthorizedContext,
  parseArgs,
} from './lib-sheets.mjs';
import {
  DEFAULT_RANGE,
  formatTaskQueueRowRange,
  loadTaskQueueAnalysis,
  SHEET_NAME,
} from './task-queue-validation-lib.mjs';

function printHelp() {
  console.log(`validate-task-queue.mjs

Usage:
  node scripts/validate-task-queue.mjs [--range 1:200]
  node scripts/validate-task-queue.mjs [--range 1:200] --warn-only

Notes:
  - Reads the live Task_Queue sheet and reports rows that have any content but are missing Task / Project / Type / Priority / Status.
  - Default behavior exits with code 1 when incomplete rows are found.
  - Pass --warn-only to keep the command informational during routine checks.
  - Known-row cleanup rules are documented in ai-os/AUTO_APPROVAL_RULES.md.
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help === 'true') {
    printHelp();
    return;
  }

  const context = await getAuthorizedContext(args);
  const range = args.range || DEFAULT_RANGE;
  const warnOnly = args['warn-only'] === 'true';
  const analysis = await loadTaskQueueAnalysis({ context, range });

  if (analysis.rows.length === 0) {
    console.log(`[WARN] ${SHEET_NAME}!${range} returned no rows.`);
    return;
  }

  console.log(`[INFO] Sheet        : ${SHEET_NAME}`);
  console.log(`[INFO] Scan range   : ${SHEET_NAME}!${range}`);
  console.log(`[INFO] Findings     : ${analysis.findings.length}`);

  if (analysis.findings.length === 0) {
    console.log('[OK] No incomplete Task_Queue rows detected.');
    return;
  }

  analysis.findings.forEach((entry) => {
    console.log(`[WARN] ${formatTaskQueueRowRange(entry.rowNumber)} is incomplete.`);
    console.log(`[WARN] Missing      : ${entry.missing.join(', ')}`);
    console.log(`[WARN] Row payload  : ${JSON.stringify(entry.row)}`);
  });

  if (analysis.knownCleanupCandidate) {
    console.log(`[INFO] Known row    : ${formatTaskQueueRowRange(analysis.knownCleanupCandidate.rowNumber)}`);
  }

  if (!warnOnly) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
