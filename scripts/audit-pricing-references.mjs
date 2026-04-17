#!/usr/bin/env node
/**
 * JBIZ-04 read-only audit: find every reference to `価格設定!` across the workbook,
 * and dump the current formulas/data of 価格設定 / KPI逆算 / KPI目標.
 * WRITE: none.
 */
import { getAuthorizedContext, getSpreadsheetMetadata, batchGetSheetValues } from './lib-sheets.mjs';

const LIVE_SHEET_ID = '1FnJdALwFSv48WiD6NWr0DzG78kwB692R2pFeiTcZlCc';
const TARGET_PATTERNS = [/価格設定!/];

function colLetter(idx) {
  let n = idx + 1, s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
  return s;
}

async function main() {
  const ctx = await getAuthorizedContext();
  ctx.spreadsheetId = LIVE_SHEET_ID;

  const meta = await getSpreadsheetMetadata({ spreadsheetId: LIVE_SHEET_ID, accessToken: ctx.accessToken });
  const sheets = meta.sheets.map(s => ({
    title: s.properties.title,
    sheetId: s.properties.sheetId,
    rows: s.properties.gridProperties.rowCount,
    cols: s.properties.gridProperties.columnCount,
  }));

  console.log('=== Sheets in workbook ===');
  sheets.forEach(s => console.log(`  - ${s.title} (id=${s.sheetId}, ${s.rows}x${s.cols})`));

  // Pull FORMULA-rendered values for every sheet
  const ranges = sheets.map(s => `${s.title}!A1:Z${Math.min(s.rows, 200)}`);
  const resp = await batchGetSheetValues({
    spreadsheetId: LIVE_SHEET_ID,
    ranges,
    accessToken: ctx.accessToken,
    valueRenderOption: 'FORMULA',
  });

  console.log('\n=== References containing `価格設定!` ===');
  const hits = [];
  resp.valueRanges.forEach((vr, idx) => {
    const sheetTitle = sheets[idx].title;
    (vr.values || []).forEach((row, r) => {
      row.forEach((cell, c) => {
        if (typeof cell !== 'string') return;
        if (!cell.startsWith('=')) return;
        if (TARGET_PATTERNS.some(p => p.test(cell))) {
          hits.push({ sheet: sheetTitle, cell: `${colLetter(c)}${r + 1}`, formula: cell });
        }
      });
    });
  });

  if (hits.length === 0) {
    console.log('  (no hits)');
  } else {
    hits.forEach(h => console.log(`  [${h.sheet}] ${h.cell}: ${h.formula}`));
  }

  // Dump 価格設定 / KPI逆算 / KPI目標 full formula content
  for (const target of ['価格設定', 'KPI逆算', 'KPI目標']) {
    const idx = sheets.findIndex(s => s.title === target);
    if (idx < 0) { console.log(`\n!!! sheet not found: ${target}`); continue; }
    console.log(`\n=== ${target} (FORMULA render) ===`);
    const rows = resp.valueRanges[idx].values || [];
    rows.forEach((row, r) => {
      const cells = row.map((v, c) => v !== '' && v != null ? `${colLetter(c)}=${JSON.stringify(v)}` : null).filter(Boolean);
      if (cells.length) console.log(`  R${r + 1}: ${cells.join(' | ')}`);
    });
  }

  // Also pull VALUE render for 価格設定 (so we can see evaluated numbers next to formulas)
  console.log('\n=== 価格設定 (VALUE render) ===');
  const valResp = await batchGetSheetValues({
    spreadsheetId: LIVE_SHEET_ID,
    ranges: ['価格設定!A1:Q40'],
    accessToken: ctx.accessToken,
  });
  (valResp.valueRanges[0].values || []).forEach((row, r) => {
    console.log(`  R${r + 1}: ${JSON.stringify(row)}`);
  });
}

main().catch(e => { console.error('[ERROR]', e.message); process.exit(1); });
