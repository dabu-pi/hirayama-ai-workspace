#!/usr/bin/env node

import {
  getAuthorizedContext,
  getSheetValues,
  parseArgs,
  updateSheetValues,
} from './lib-sheets.mjs';

const DASHBOARD_RANGE = 'A1:N26';

const REPLACEMENTS = new Map([
  ['ç·æ¡ˆä»¶æ•°', '総案件数'],
  ['æœ¬ç•ªé‹ç”¨ä¸­', '本番運用中'],
  ['é€²è¡Œä¸­', '進行中'],
  ['æœªå®Œäº†ã‚¿ã‚¹ã‚¯', '未完了タスク'],
  ['ä¿ç•™ã‚¢ã‚¤ãƒ‡ã‚¢æ•°', '保留アイデア数'],
  ['ä»Šæ—¥ã®å„ªå…ˆã‚¿ã‚¹ã‚¯', '今日の優先タスク'],
  ['æ¡ˆä»¶ã®ç¾æ³', '案件の現況'],
  ['ã‚¿ã‚¹ã‚¯', 'タスク'],
  ['æ¡ˆä»¶', '案件'],
  ['çŠ¶æ…‹', '状態'],
  ['æœ€çµ‚å„ªå…ˆåº¦', '最終優先度'],
  ['æœŸé™', '期限'],
  ['æ®µéšŽ', '段階'],
  ['æ¬¡ã‚¢ã‚¯ã‚·ãƒ§ãƒ³', '次アクション'],
  ['é–‹ã', '開く'],
  ['æœªè¨­å®š', '未設定'],
  ['æœ€è¿‘ã®æ›´æ–°', '最近の更新'],
  ['æ—¥æ™‚', '日時'],
  ['å®Ÿè¡Œå…ƒ', '実行元'],
  ['å†…å®¹', '内容'],
  ['çµæžœ', '結果'],
]);

function replaceAllKnownStrings(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return value;
  }

  let nextValue = value;
  for (const [source, target] of REPLACEMENTS.entries()) {
    nextValue = nextValue.split(source).join(target);
  }
  return nextValue;
}

function repairGrid(values) {
  let changed = false;
  const nextGrid = (values || []).map((row) =>
    (row || []).map((cell) => {
      const repaired = replaceAllKnownStrings(cell);
      if (repaired !== cell) {
        changed = true;
      }
      return repaired;
    }),
  );

  return { changed, nextGrid };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const isWrite = args.write === 'true';
  const context = await getAuthorizedContext(args);

  const data = await getSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: 'Dashboard',
    range: DASHBOARD_RANGE,
    accessToken: context.accessToken,
    valueRenderOption: 'FORMULA',
  });

  const { changed, nextGrid } = repairGrid(data.values || []);

  console.log('[INFO] Target sheet : Dashboard');
  console.log(`[INFO] Target range : Dashboard!${DASHBOARD_RANGE}`);
  console.log(`[INFO] Changes found: ${changed}`);

  if (!changed) {
    console.log('[INFO] No mojibake labels were found in the live Dashboard range.');
    return;
  }

  if (!isWrite) {
    console.log('[INFO] Dry run mode. Pass --write true to update the live Dashboard labels.');
    return;
  }

  await updateSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: 'Dashboard',
    range: DASHBOARD_RANGE,
    values: nextGrid,
    accessToken: context.accessToken,
  });

  console.log('[OK] Repaired live Dashboard Japanese labels and formula display text.');
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
