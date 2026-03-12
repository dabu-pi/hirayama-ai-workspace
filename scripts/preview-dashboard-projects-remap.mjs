#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parseArgs } from './lib-sheets.mjs';

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
  const startRow = Number(args['projects-start-row'] || 4);
  const rows = Number(args.rows || 5);
  const outputPath = resolve(args.output || 'artifacts/dashboard-projects-formula-preview.json');

  const formulaRows = [];
  for (let i = 0; i < rows; i += 1) {
    formulaRows.push(buildFormulaRow(startRow + i));
  }

  const payload = {
    dashboard_header_range: 'H11:N11',
    dashboard_data_range: `H12:N${11 + rows}`,
    headers: DASHBOARD_HEADERS,
    formulas: formulaRows,
    note: 'Apply only after the live Projects tab has been migrated to the canonical 10-column schema.',
  };

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log(`[INFO] Preview written: ${outputPath}`);
  console.log(`[INFO] Headers       : ${JSON.stringify(DASHBOARD_HEADERS)}`);
  console.log(`[INFO] First formula : ${JSON.stringify(formulaRows[0])}`);
  console.log('[INFO] This is a preview only. It does not modify the live sheet.');
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
