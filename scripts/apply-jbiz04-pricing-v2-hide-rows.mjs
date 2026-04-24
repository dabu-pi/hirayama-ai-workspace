#!/usr/bin/env node
/**
 * JBIZ-04: 価格設定_v2 表示整理 — 廃止・保留メニューの行を非表示化（2026-04-25e）
 *
 * 方針:
 *   - 行は削除しない。データ・有効フラグ・廃止区分はすべて維持する。
 *   - hiddenByUser=true で行を非表示にするだけ（シートの「行を非表示」と同等）。
 *   - GAS の getValues / VLOOKUP / FILTER は非表示行も読む → GAS・数式への影響なし。
 *   - 再表示が必要な場合は Google Sheets のメニューから「行の再表示」で即座に戻せる。
 *
 * 非表示にする行:
 *   Row 5-7   SELFPAY_EVAL_LOWBACK30/NECKSHOULDER30/KNEE30   症状別初回評価（要確認で非表示）
 *   Row 11    SELFPAY_CHRONIC50                              特別対応/保留
 *   Row 15-17 ELECTRO_AM_UNLIMITED/SELFPAY_PT60/TRAINING_4PASS   廃止保留（PT60は要確認）
 *   Row 19-23 FUTURE_3種+SELFPAY_MANUAL5+空行                 廃止/保留/将来検討
 *   Row 30    SELFPAY_OINTMENT                               有効FALSE
 *
 * 実行:
 *   node scripts/apply-jbiz04-pricing-v2-hide-rows.mjs          # dry-run
 *   node scripts/apply-jbiz04-pricing-v2-hide-rows.mjs --write  # 実行
 */
import { getAuthorizedContext, batchUpdateSpreadsheet } from './lib-sheets.mjs';

const SPREADSHEET_ID = '1FnJdALwFSv48WiD6NWr0DzG78kwB692R2pFeiTcZlCc';
const V2_SHEET_ID    = 1509383494;  // 価格設定_v2 の sheetId（取得済み）

// 非表示にする行範囲（1-based）→ API では 0-based startIndex / exclusive endIndex
// 連続する行はまとめて1リクエストに。
const HIDE_RANGES = [
  { rows: '5-7',  label: 'SELFPAY_EVAL_* ×3（症状別初回評価・要確認で非表示）', start: 4,  end: 7  },
  { rows: '11',   label: 'SELFPAY_CHRONIC50（特別対応/保留）',                  start: 10, end: 11 },
  { rows: '15-17',label: 'ELECTRO_AM/SELFPAY_PT60/TRAINING_4PASS（廃止保留）',  start: 14, end: 17 },
  { rows: '19-23',label: 'FUTURE_* ×3 + SELFPAY_MANUAL5 + 空行（廃止保留）',   start: 18, end: 23 },
  { rows: '30',   label: 'SELFPAY_OINTMENT（有効FALSE）',                       start: 29, end: 30 },
];

async function main() {
  const write = process.argv.includes('--write');
  const ctx = await getAuthorizedContext();

  console.log(`[INFO] 非表示対象: ${HIDE_RANGES.reduce((s,r)=>s+(r.end-r.start),0)} 行`);
  console.log('[INFO] 行は削除せず hiddenByUser=true を設定するだけ（再表示可）\n');

  HIDE_RANGES.forEach(r => {
    console.log(`[${write?'WRITE':'DRY'}] Row ${r.rows} → 非表示  [${r.label}]`);
  });

  if (!write) {
    console.log('\n[DRY-RUN] --write を付けて再実行してください');
    return;
  }

  const requests = HIDE_RANGES.map(r => ({
    updateDimensionProperties: {
      range: {
        sheetId:    V2_SHEET_ID,
        dimension:  'ROWS',
        startIndex: r.start,  // 0-based
        endIndex:   r.end,    // exclusive
      },
      properties: { hiddenByUser: true },
      fields:     'hiddenByUser',
    },
  }));

  await batchUpdateSpreadsheet({
    spreadsheetId: SPREADSHEET_ID,
    accessToken:   ctx.accessToken,
    requests,
  });

  console.log('\n[DONE] 非表示化完了');
}

main().catch(e => { console.error('[ERROR]', e.message); process.exit(1); });
