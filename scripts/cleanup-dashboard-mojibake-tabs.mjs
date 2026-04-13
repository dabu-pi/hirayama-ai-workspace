#!/usr/bin/env node

import {
  batchGetSheetValues,
  batchUpdateSpreadsheet,
  getAuthorizedContext,
  getSheetValues,
  getSpreadsheetMetadata,
  parseArgs,
  updateSheetValues,
} from './lib-sheets.mjs';

const DEFAULT_CANDIDATES = [
  'å¹³å±± AI OS ãƒ€ãƒƒã‚·ãƒ¥ãƒœãƒ¼ãƒ‰',
  'å¹³å±± AI OS - æ¡ˆä»¶ãƒžã‚¹ã‚¿ãƒ¼',
];

const FORMULA_SCAN_RANGES = [
  'Dashboard!A1:N60',
  'Projects!A1:M40',
  'Task_Queue!A1:O200',
  'Ideas!A1:J200',
  'Run_Log!A1:J200',
  'Metrics!A1:F20',
];

const HEADER_RANGES = [
  { sheetName: 'Dashboard', range: 'A1:N3' },
  { sheetName: 'Projects', range: 'A1:M3' },
];

const KNOWN_REPLACEMENTS = new Map([
  ['å¹³å±± AI OS ãƒ€ãƒƒã‚·ãƒ¥ãƒœãƒ¼ãƒ‰', '平山 AI OS ダッシュボード'],
  ['Projects ã‚’é–‹ã', 'Projects を開く'],
  ['è¡¨ç¤ºå°‚ç”¨ã€‚æ¡ˆä»¶åãƒ»ãƒªãƒ³ã‚¯ã¯ Projects æ­£æœ¬ã‚’å‚ç…§ã—ã€�ä»Šæ—¥ã®å„ªå…ˆé †ä½ã¯ å„ªå…ˆåº¦èª¿æ•´ ã‚’åæ˜ ã™ã‚‹ã€‚', '表示専用。案件名・リンクは Projects 正本を参照し、今日の優先順位は 優先度調整 を反映する。'],
  ['å¹³å±± AI OS - æ¡ˆä»¶ãƒžã‚¹ã‚¿ãƒ¼', '平山 AI OS - 案件マスター'],
  ['æ¡ˆä»¶åãƒ»ãƒªãƒ³ã‚¯ã®æ­£æœ¬ã€‚canonical 4æ¡ˆä»¶ã ã‘ã§ãªãã€�ç®¡ç†å¯¾è±¡ã¯ Projects ã«æ®‹ã™ã€‚', '案件名・リンクの正本。canonical 4案件だけでなく、管理対象は Projects に残す。'],
]);

function normalizeCandidates(args) {
  if (!args.candidates) {
    return DEFAULT_CANDIDATES;
  }
  return args.candidates
    .split('|')
    .map((value) => value.trim())
    .filter(Boolean);
}

function decodeLatin1Utf8(value) {
  return Buffer.from(value, 'latin1').toString('utf8');
}

function looksLikeMojibake(value) {
  return typeof value === 'string' && /[Ãåæã]/.test(value);
}

function fixGridValues(values) {
  const fixed = (values || []).map((row) =>
    (row || []).map((cell) => {
      if (KNOWN_REPLACEMENTS.has(cell)) {
        return KNOWN_REPLACEMENTS.get(cell);
      }
      if (!looksLikeMojibake(cell)) {
        return cell;
      }
      const decoded = decodeLatin1Utf8(cell);
      return decoded.includes('\uFFFD') ? cell : decoded;
    }),
  );

  const changed = JSON.stringify(fixed) !== JSON.stringify(values || []);
  return { changed, fixed };
}

function collectFormulaHits(valueRanges, candidates) {
  const hits = [];
  for (const valueRange of valueRanges || []) {
    const rangeName = valueRange.range || '';
    const rows = valueRange.values || [];
    rows.forEach((row, rowIndex) => {
      row.forEach((cell, colIndex) => {
        if (typeof cell !== 'string' || !cell.startsWith('=')) {
          return;
        }
        const matchedCandidates = candidates.filter((candidate) => cell.includes(candidate));
        if (matchedCandidates.length === 0) {
          return;
        }
        hits.push({
          range: rangeName,
          rowOffset: rowIndex + 1,
          colOffset: colIndex + 1,
          formula: cell,
          matchedCandidates,
        });
      });
    });
  }
  return hits;
}

function buildArchiveTitle(index) {
  const stamp = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `archive_mojibake_${stamp}_${index + 1}`;
}

async function inspectHeaderMatches(context, candidates) {
  const matches = [];
  for (const sheetName of ['Dashboard', 'Projects']) {
    const data = await getSheetValues({
      spreadsheetId: context.spreadsheetId,
      sheetName,
      range: 'A1',
      accessToken: context.accessToken,
    });
    const cellValue = data.values?.[0]?.[0] || '';
    if (candidates.includes(cellValue)) {
      matches.push({ sheetName, cellValue });
    }
  }
  return matches;
}

async function repairHeaderValues(context) {
  const repairs = [];
  for (const headerTarget of HEADER_RANGES) {
    const data = await getSheetValues({
      spreadsheetId: context.spreadsheetId,
      sheetName: headerTarget.sheetName,
      range: headerTarget.range,
      accessToken: context.accessToken,
    });
    const { changed, fixed } = fixGridValues(data.values || []);
    if (!changed) {
      continue;
    }
    await updateSheetValues({
      spreadsheetId: context.spreadsheetId,
      sheetName: headerTarget.sheetName,
      range: headerTarget.range,
      values: fixed,
      accessToken: context.accessToken,
    });
    repairs.push({
      sheetName: headerTarget.sheetName,
      range: headerTarget.range,
      beforeTopLeft: data.values?.[0]?.[0] || '',
      afterTopLeft: fixed?.[0]?.[0] || '',
    });
  }
  return repairs;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const candidates = normalizeCandidates(args);
  const shouldArchive = args.archive === 'true';
  const shouldDelete = args.delete === 'true';
  const shouldRepairHeaders = args['repair-headers'] === 'true';
  const context = await getAuthorizedContext(args);

  const metadata = await getSpreadsheetMetadata({
    spreadsheetId: context.spreadsheetId,
    accessToken: context.accessToken,
    fields: 'sheets(properties(sheetId,title,index,hidden,gridProperties))',
  });

  const allSheets = metadata.sheets || [];
  const directCandidateSheets = allSheets.filter((sheet) =>
    candidates.includes(sheet.properties?.title || ''),
  );
  const headerMatches = await inspectHeaderMatches(context, candidates);

  const formulaScan = await batchGetSheetValues({
    spreadsheetId: context.spreadsheetId,
    ranges: FORMULA_SCAN_RANGES,
    accessToken: context.accessToken,
    valueRenderOption: 'FORMULA',
  });
  const formulaHits = collectFormulaHits(formulaScan.valueRanges, candidates);

  console.log(`[INFO] Candidate titles : ${JSON.stringify(candidates)}`);
  console.log(`[INFO] Direct tab hits  : ${directCandidateSheets.length}`);
  console.log(`[INFO] Header cell hits : ${headerMatches.length}`);
  console.log(`[INFO] Formula hits     : ${formulaHits.length}`);

  if (directCandidateSheets.length > 0) {
    directCandidateSheets.forEach((sheet) => {
      console.log(`- direct tab: ${sheet.properties?.title} (sheetId=${sheet.properties?.sheetId}, hidden=${sheet.properties?.hidden === true})`);
    });
  } else {
    console.log('[INFO] No live sheet titles matched the mojibake candidates.');
  }

  if (headerMatches.length > 0) {
    headerMatches.forEach((match) => {
      console.log(`- header match: ${match.sheetName}!A1 = ${match.cellValue}`);
    });
  }

  if (formulaHits.length > 0) {
    formulaHits.forEach((hit) => {
      console.log(`- formula hit: ${hit.range} r${hit.rowOffset} c${hit.colOffset} -> ${hit.formula}`);
    });
  }

  if (shouldArchive && directCandidateSheets.length > 0) {
    if (formulaHits.length > 0) {
      throw new Error('Refusing to archive candidate tabs while formula references still point at the mojibake titles.');
    }
    const requests = directCandidateSheets.map((sheet, index) => ({
      updateSheetProperties: {
        properties: {
          sheetId: sheet.properties.sheetId,
          title: buildArchiveTitle(index),
          hidden: true,
        },
        fields: 'title,hidden',
      },
    }));
    await batchUpdateSpreadsheet({
      spreadsheetId: context.spreadsheetId,
      accessToken: context.accessToken,
      requests,
    });
    console.log(`[OK] Archived ${requests.length} mojibake tab(s).`);
  }

  if (shouldDelete && directCandidateSheets.length > 0) {
    if (formulaHits.length > 0) {
      throw new Error('Refusing to delete candidate tabs while formula references still point at the mojibake titles.');
    }
    const requests = directCandidateSheets.map((sheet) => ({
      deleteSheet: {
        sheetId: sheet.properties.sheetId,
      },
    }));
    await batchUpdateSpreadsheet({
      spreadsheetId: context.spreadsheetId,
      accessToken: context.accessToken,
      requests,
    });
    console.log(`[OK] Deleted ${requests.length} mojibake tab(s).`);
  }

  if (shouldRepairHeaders) {
    const repairs = await repairHeaderValues(context);
    if (repairs.length === 0) {
      console.log('[INFO] Header repair found no mojibake values to rewrite.');
    } else {
      repairs.forEach((repair) => {
        console.log(`- repaired header: ${repair.sheetName} ${repair.range} :: ${repair.beforeTopLeft} -> ${repair.afterTopLeft}`);
      });
    }
  }
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
