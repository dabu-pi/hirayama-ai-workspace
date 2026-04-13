#!/usr/bin/env node
/**
 * JBIZ-04: 価格設定シートの現在の構造を確認する
 */
import { getAuthorizedContext } from './lib-sheets.mjs';

const LIVE_SHEET_ID = '1FnJdALwFSv48WiD6NWr0DzG78kwB692R2pFeiTcZlCc';
const SHEET_NAME = '価格設定';

async function main() {
  const ctx = await getAuthorizedContext();
  const range = encodeURIComponent(`${SHEET_NAME}!A1:N30`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${LIVE_SHEET_ID}/values/${range}`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${ctx.accessToken}` } });
  const data = await resp.json();
  if (data.error) throw new Error(JSON.stringify(data.error));

  const values = data.values ?? [];
  console.log(`[INFO] 価格設定シート: ${values.length} 行`);
  values.forEach((row, i) => {
    console.log(`  Row ${i + 1}: ${JSON.stringify(row)}`);
  });
}

main().catch(e => { console.error('[ERROR]', e.message); process.exit(1); });
