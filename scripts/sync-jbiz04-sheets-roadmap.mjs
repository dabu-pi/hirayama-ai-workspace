#!/usr/bin/env node
/**
 * JBIZ-04: ダッシュボード / ロードマップ進捗 / 未確定項目 を現状に整合させる
 *
 * 背景: 初期試行フェーズ完了（全8試行・全種目採用確定）/ 本格導入準備着手
 * 正本: PROJECT_STATUS.md / 慢性疼痛_管理表_STATUS.md
 *
 * 更新内容:
 *   【ダッシュボード】
 *     B3  最終更新日        2026/03/15 → 2026/03/22
 *   【ロードマップ進捗】
 *     E5  Phase2 ステータス  進行中 → 完了（価格確定・シート反映・asago優待確定）
 *     F5  Phase2 進捗率     0%    → 100%
 *     E7  Phase4 ステータス  未着手 → 進行中（案内スクリプト・担当分担完成）
 *     F7  Phase4 進捗率     0%    → 30%（記録シート運用1ヶ月はまだ）
 *   【未確定項目】
 *     B9  No.6 項目名 → ジム会員費（asago7区分月額）
 *     F9  No.6 決定状況 → asago7区分に変更。具体月額は未確定
 *     B10 No.7 項目名 → ジム会員費（3段階廃止・asago7区分へ統合）
 *     F10 No.7 決定状況 → asago7区分に統合（ライト/スタンダード/プレミアム廃止）
 *     F11 No.8 決定状況 → 入力済み566,000円（妥当性未検証）
 *
 * Usage:
 *   node scripts/sync-jbiz04-sheets-roadmap.mjs          # dry-run
 *   node scripts/sync-jbiz04-sheets-roadmap.mjs --write  # live 反映
 */

import { getAuthorizedContext } from './lib-sheets.mjs';

const LIVE_SHEET_ID = '1FnJdALwFSv48WiD6NWr0DzG78kwB692R2pFeiTcZlCc';

async function writeCells(accessToken, sheetName, rangeA1, values) {
  const range = `${sheetName}!${rangeA1}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${LIVE_SHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const resp = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ range, values }),
  });
  const data = await resp.json();
  if (data.error) throw new Error(`writeCells [${sheetName}!${rangeA1}] error: ${JSON.stringify(data.error)}`);
  return data;
}

async function main() {
  const isDryRun = !process.argv.includes('--write');
  const ctx = await getAuthorizedContext();

  console.log(`[INFO] Mode: ${isDryRun ? 'DRY-RUN (pass --write to apply)' : 'WRITE'}`);
  console.log(`[INFO] Target: ${LIVE_SHEET_ID}`);

  const updates = [
    // ダッシュボード
    { sheet: '全体ダッシュボード', range: 'B3',  values: [['2026/03/22']],         label: 'ダッシュボード 最終更新日 → 2026/03/22' },

    // ロードマップ進捗
    { sheet: 'ロードマップ進捗',   range: 'E5',  values: [['完了']],               label: 'Phase2 ステータス → 完了（価格確定・シート反映済み）' },
    { sheet: 'ロードマップ進捗',   range: 'F5',  values: [['100%']],               label: 'Phase2 進捗率 → 100%' },
    { sheet: 'ロードマップ進捗',   range: 'E7',  values: [['進行中']],             label: 'Phase4 ステータス → 進行中（案内スクリプト・担当分担完成）' },
    { sheet: 'ロードマップ進捗',   range: 'F7',  values: [['30%']],                label: 'Phase4 進捗率 → 30%（記録シート運用はまだ）' },

    // 未確定項目
    { sheet: '未確定項目',         range: 'B9',  values: [['ジム会員費（asago7区分月額）']], label: 'No.6 項目名 → asago7区分月額' },
    { sheet: '未確定項目',         range: 'F9',  values: [['asago7区分に変更。具体月額は未確定']], label: 'No.6 決定状況 → asago7区分に変更' },
    { sheet: '未確定項目',         range: 'B10', values: [['ジム会員費（3段階廃止・asago7区分へ統合）']], label: 'No.7 項目名 → 3段階廃止・asago統合' },
    { sheet: '未確定項目',         range: 'F10', values: [['asago7区分に統合（ライト/スタンダード/プレミアム廃止）']], label: 'No.7 決定状況 → asago統合' },
    { sheet: '未確定項目',         range: 'F11', values: [['入力済み566,000円（妥当性未検証）']], label: 'No.8 決定状況 → 入力済み（仮）' },
  ];

  console.log('\n[INFO] Updates planned:');
  updates.forEach(u => console.log(`  ${u.sheet}!${u.range}: ${u.label}`));

  if (isDryRun) {
    console.log('\n[DRY-RUN] No changes applied. Pass --write to execute.');
    return;
  }

  console.log('\n[INFO] Applying updates...');
  for (const u of updates) {
    await writeCells(ctx.accessToken, u.sheet, u.range, u.values);
    console.log(`  [OK] ${u.sheet}!${u.range}: ${u.label}`);
  }

  console.log('\n[DONE] 全シート整合完了');
  console.log('  ダッシュボード: 最終更新日 2026/03/22');
  console.log('  ロードマップ: Phase2→完了(100%) / Phase4→進行中(30%)');
  console.log('  未確定項目: No.6/7 asago7区分へ更新 / No.8 入力済み(仮)');
}

main().catch(err => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
