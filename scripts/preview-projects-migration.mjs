#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  getAuthorizedContext,
  getSheetValues,
  parseArgs,
} from './lib-sheets.mjs';

const PROJECT_ID_MAP = new Map([
  ['freee見積自動化', 'FREEE-02'],
  ['柔整GASシステム', 'GAS-01'],
  ['患者管理Webアプリ', 'WEB-03'],
  ['接骨院戦略AI', 'STR-04'],
  ['廃棄物日報GAS', 'WST-05'],
  ['AIOS-06', 'AIOS-06'],
]);

function normalizePriority(projectName, rowIndex) {
  const fixed = new Map([
    ['AIOS-06', 1],
    ['freee見積自動化', 2],
    ['柔整GASシステム', 3],
    ['患者管理Webアプリ', 4],
    ['接骨院戦略AI', 5],
    ['廃棄物日報GAS', 6],
  ]);
  return fixed.get(projectName) ?? rowIndex;
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
    project_id: PROJECT_ID_MAP.get(projectName) || `LEGACY-PROJECT-${String(rowIndex).padStart(2, '0')}`,
    project_name: projectName || '',
    directory: directory || '',
    status: status || '',
    phase: phase || '',
    priority: normalizePriority(projectName, rowIndex),
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
