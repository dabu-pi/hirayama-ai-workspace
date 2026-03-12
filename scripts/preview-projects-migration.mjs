#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  getAuthorizedContext,
  getSheetValues,
  parseArgs,
} from './lib-sheets.mjs';

const DIRECTORY_ID_MAP = new Map([
  ['freee-automation', 'FREEE-02'],
  ['gas-projects/jyu-gas-ver3.1', 'GAS-01'],
  ['patient-management', 'WEB-03'],
  ['hirayama-jyusei-strategy', 'STR-04'],
  ['waste-report-system', 'WST-05'],
  ['ai-os', 'AIOS-06'],
]);

const DIRECTORY_PRIORITY_MAP = new Map([
  ['ai-os', 1],
  ['freee-automation', 2],
  ['gas-projects/jyu-gas-ver3.1', 3],
  ['patient-management', 4],
  ['hirayama-jyusei-strategy', 5],
  ['waste-report-system', 6],
]);

function normalizePriority(directory, rowIndex) {
  return DIRECTORY_PRIORITY_MAP.get(directory) ?? rowIndex;
}

function toCanonicalRow(row, rowIndex) {
  const [
    projectName,
    directory,
    legacyType,
    status,
    phase,
    runtime,
    progress,
    lastUpdate,
    nextAction,
    completionCondition,
    owner,
    repo,
    risk,
    notes,
  ] = row;

  const noteParts = [
    legacyType ? `legacy_type=${legacyType}` : '',
    runtime ? `runtime=${runtime}` : '',
    progress ? `progress=${progress}` : '',
    completionCondition ? `completion=${completionCondition}` : '',
    owner ? `owner=${owner}` : '',
    repo ? `repo=${repo}` : '',
    risk ? `risk=${risk}` : '',
    notes || '',
  ].filter(Boolean);

  return {
    project_id: DIRECTORY_ID_MAP.get(directory) || `LEGACY-PROJECT-${String(rowIndex).padStart(2, '0')}`,
    project_name: projectName || '',
    directory: directory || '',
    status: status || '',
    phase: phase || '',
    priority: normalizePriority(directory, rowIndex),
    last_updated: lastUpdate || '',
    next_action: nextAction || '',
    blocker: '',
    notes: noteParts.join(' | '),
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const context = await getAuthorizedContext(args);
  const outputPath = resolve(args.output || 'artifacts/projects-migration-preview.json');
  const data = await getSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: 'Projects',
    range: '1:200',
    accessToken: context.accessToken,
  });

  const rows = data.values ?? [];
  const bodyRows = rows.slice(3).filter((row) => row.some((cell) => String(cell || '').trim() !== ''));
  const preview = bodyRows.map((row, index) => toCanonicalRow(row, index + 1));

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(preview, null, 2)}\n`, 'utf8');

  console.log(`[INFO] Live Projects rows: ${bodyRows.length}`);
  console.log(`[INFO] Preview written  : ${outputPath}`);
  if (preview.length > 0) {
    console.log(`[INFO] Sample row      : ${JSON.stringify(preview[0])}`);
  }
  console.log('[INFO] This is a preview only. It does not modify the live sheet.');
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
