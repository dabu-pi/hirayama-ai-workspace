#!/usr/bin/env node
/**
 * JBIZ-04: 価格設定シートに「症状別 運動療法 初回評価」3メニューを追加
 *           未確定項目シートに「会員価格最終確定」論点を追加
 *
 * 追加するメニュー（すべて 仮・確定状況=仮）:
 *   - 腰痛改善 運動療法 初回評価   (SELF_EVAL_LOWBACK30)
 *   - 首肩こり改善 運動療法 初回評価 (SELF_EVAL_NECKSHOULDER30)
 *   - 膝改善 運動療法 初回評価     (SELF_EVAL_KNEE30)
 *   一般料金: 3,300円 / ジム会員料金: 2,800円（仮）
 *   主力手技フラグ: FALSE / KPI集計対象: ○ / 確定状況: 仮
 *
 * KPI逆算への影響:
 *   主力手技価格参照式 = COUNTIF('価格設定'!K4:K15, TRUE)
 *   新行は Row 27〜31（K4:K15 の範囲外）→ KPI逆算に影響なし ✅
 *
 * Usage:
 *   node scripts/apply-jbiz04-pricing-eval-menus.mjs           # dry-run
 *   node scripts/apply-jbiz04-pricing-eval-menus.mjs --write   # live 反映
 */

import { getAuthorizedContext } from './lib-sheets.mjs';

const LIVE_SHEET_ID = '1FnJdALwFSv48WiD6NWr0DzG78kwB692R2pFeiTcZlCc';

// ─────────────────────────────────────────────
// 価格設定シート: 追加行（Row 27 以降に追記）
// 列順: A=表示順, B=大区分, C=menu_id, D=メニュー名, E=内容, F=時間
//       G=一般料金, H=ジム会員料金, I=保険適用, J=回数/単位
//       K=主力手技フラグ, L=KPI集計対象, M=確定状況, N=備考
// ─────────────────────────────────────────────
const PRICING_NEW_ROWS = [
  // Row 27: 空白区切り
  [],
  // Row 28: セクション見出し
  ['▼ 保険外入口（症状別 運動療法 初回評価）【仮 2026-03-23 追加】'],
  // Row 29: 腰痛改善
  [
    13,
    '保険外入口（症状別）',
    'SELF_EVAL_LOWBACK30',
    '腰痛改善 運動療法 初回評価',
    '腰痛の原因になりやすい姿勢・股関節・体幹の使い方を評価し、その場で改善運動を体験する初回メニュー',
    '約30分',
    3300,
    2800,
    '×',
    '1回',
    'FALSE',
    '○',
    '仮',
    '導線商品（主力は慢性ケア手技50分）。会員価格2,800円は仮値。次提案: 慢性ケア手技50分/4回集中コース/ジム体験',
  ],
  // Row 30: 首肩こり改善
  [
    14,
    '保険外入口（症状別）',
    'SELF_EVAL_NECKSHOULDER30',
    '首肩こり改善 運動療法 初回評価',
    '首肩こりの原因になりやすい姿勢・胸椎・肩甲骨の動きを評価し、その場で改善運動を体験する初回メニュー',
    '約30分',
    3300,
    2800,
    '×',
    '1回',
    'FALSE',
    '○',
    '仮',
    '導線商品（主力は慢性ケア手技50分）。会員価格2,800円は仮値。次提案: 慢性ケア手技50分/4回集中コース/ジム体験',
  ],
  // Row 31: 膝改善
  [
    15,
    '保険外入口（症状別）',
    'SELF_EVAL_KNEE30',
    '膝改善 運動療法 初回評価',
    '膝の負担に関わる立ち方・股関節・足部の使い方を評価し、その場で改善運動を体験する初回メニュー',
    '約30分',
    3300,
    2800,
    '×',
    '1回',
    'FALSE',
    '○',
    '仮',
    '導線商品（主力は慢性ケア手技50分）。会員価格2,800円は仮値。次提案: 慢性ケア手技50分/4回集中コース/ジム体験',
  ],
];

// ─────────────────────────────────────────────
// 未確定項目シート: Row 13 に No.10 を追記
// 列順: A=No., B=項目名, C=カテゴリ, D=優先度, E=なぜ必要か, F=決定状況, G=確定値, H=いつ決めるか
// ─────────────────────────────────────────────
const UNDECIDED_ROW = [
  10,
  '症状別初回評価 会員価格最終確定（腰痛/首肩こり/膝）',
  '価格設定',
  '中',
  'シート反映・menu_id付与は2026-03-23完了。ジム会員価格2,800円は仮置き。月会員コース設計確定後に正式値へ差し替えが必要',
  '仮反映済み（2026-03-23）',
  '2,800円（仮）',
  '月会員コース設計確定後',
];

// ─────────────────────────────────────────────
// Sheets API ヘルパー
// ─────────────────────────────────────────────
async function readRange(accessToken, sheetName, rangeA1) {
  const range = encodeURIComponent(`${sheetName}!${rangeA1}`);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${LIVE_SHEET_ID}/values/${range}`;
  const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  const data = await resp.json();
  if (data.error) throw new Error(`readRange [${sheetName}!${rangeA1}]: ${JSON.stringify(data.error)}`);
  return data.values ?? [];
}

async function writeCells(accessToken, sheetName, rangeA1, values) {
  const range = `${sheetName}!${rangeA1}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${LIVE_SHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  const resp = await fetch(url, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ range, values }),
  });
  const data = await resp.json();
  if (data.error) throw new Error(`writeCells [${range}]: ${JSON.stringify(data.error)}`);
  return data;
}

async function main() {
  const isDryRun = !process.argv.includes('--write');
  const ctx = await getAuthorizedContext();

  console.log(`[INFO] Target spreadsheet: ${LIVE_SHEET_ID}`);
  console.log(`[INFO] Mode: ${isDryRun ? 'DRY-RUN (pass --write to apply)' : 'WRITE'}`);

  // ── 1. 価格設定シートの現在の末尾行を確認 ──
  const pricingRows = await readRange(ctx.accessToken, '価格設定', 'A1:A35');
  const lastRow = pricingRows.length;
  const startRow = lastRow + 1;
  const endRow = startRow + PRICING_NEW_ROWS.length - 1;

  console.log(`\n[INFO] 価格設定シート:`);
  console.log(`  現在の末尾行: Row ${lastRow}`);
  console.log(`  追加範囲: A${startRow}:N${endRow} (${PRICING_NEW_ROWS.length}行)`);
  console.log(`  KPI逆算参照範囲 K4:K15 → 影響なし（新行は Row ${startRow} 以降）✅`);

  // ── 2. KPI逆算安全確認: K4:K15 に TRUE が1件のみ ──
  const kpiRange = await readRange(ctx.accessToken, '価格設定', 'K4:K15');
  const trueCount = kpiRange.flat().filter(v => v === 'TRUE').length;
  console.log(`\n[INFO] KPI逆算チェック: K4:K15 の主力手技フラグ TRUE 件数 = ${trueCount}件 (1件が期待値)`);
  if (trueCount !== 1) {
    console.warn(`[WARN] 主力手技フラグが1件でない（${trueCount}件）。KPI逆算シートを確認してください。`);
  } else {
    console.log('  → KPI逆算に影響なし ✅');
  }

  // ── 3. 追加内容のプレビュー ──
  console.log('\n[INFO] 追加行（価格設定シート）:');
  PRICING_NEW_ROWS.forEach((row, i) => {
    const label = row[3] ?? row[0] ?? '(空白またはセクション見出し)';
    const menuId = row[2] ?? '';
    console.log(`  Row ${startRow + i}: ${menuId ? '[' + menuId + '] ' : ''}${label}`);
  });

  console.log('\n[INFO] 追加行（未確定項目 Row 13）:');
  console.log(`  No.${UNDECIDED_ROW[0]}: ${UNDECIDED_ROW[1]}`);
  console.log(`  カテゴリ: ${UNDECIDED_ROW[2]} / 優先度: ${UNDECIDED_ROW[3]}`);
  console.log(`  決定状況: ${UNDECIDED_ROW[5]}`);

  if (isDryRun) {
    console.log('\n[DRY-RUN] No changes applied. Pass --write to execute.');
    return;
  }

  // ── 4. 価格設定シートへ書き込み ──
  await writeCells(
    ctx.accessToken,
    '価格設定',
    `A${startRow}:N${endRow}`,
    PRICING_NEW_ROWS,
  );
  console.log(`\n[OK] 価格設定シート: ${PRICING_NEW_ROWS.length}行追加 (A${startRow}:N${endRow})`);

  // ── 5. 未確定項目シートへ書き込み（Row 13） ──
  await writeCells(
    ctx.accessToken,
    '未確定項目',
    'A13:H13',
    [UNDECIDED_ROW],
  );
  console.log('[OK] 未確定項目シート: Row 13 に No.10 追加');

  // ── 6. 完了サマリー ──
  console.log('\n[DONE] 反映内容:');
  console.log('  価格設定:');
  console.log('    Row 27: (空白区切り)');
  console.log('    Row 28: ▼ 保険外入口（症状別 運動療法 初回評価）セクション見出し');
  console.log('    Row 29: [SELF_EVAL_LOWBACK30] 腰痛改善 運動療法 初回評価 / 3,300円 / 2,800円（仮）/ KPI集計○ / 仮');
  console.log('    Row 30: [SELF_EVAL_NECKSHOULDER30] 首肩こり改善 運動療法 初回評価 / 同上');
  console.log('    Row 31: [SELF_EVAL_KNEE30] 膝改善 運動療法 初回評価 / 同上');
  console.log('  未確定項目:');
  console.log('    Row 13: No.10 症状別初回評価 会員価格最終確定 / 仮反映済み（2026-03-23）');
}

main().catch((err) => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
