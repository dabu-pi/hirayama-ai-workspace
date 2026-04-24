#!/usr/bin/env node
/**
 * JBIZ-04: 価格設定_v2 修正（2026-04-25b）
 *
 * 院長判断:
 *   1. 軟膏塗布（SELFPAY_OINTMENT）は手技3分(SELFPAY_MANUAL3)に含める。個別メニューとして有効化しない。
 *      → Row 30 の有効フラグ=FALSE 維持 / 備考に院長判断を記録
 *   2. ジム優待割引を廃止。「通常価格のみ」で運用する。
 *      → J列（ジム会員料金）を空欄に統一
 *      → J列が空欄でも既存GAS・KPI逆算に影響がないことを確認済み（参照なし）
 *
 * 対象行:
 *   Row 8  SELFPAY_MICROCURRENT : J 850  → 空欄
 *   Row 9  SELFPAY_HIGHVOLTAGE  : J 500  → 空欄（J=I で割引なしだが統一のため）
 *   Row 10 SELFPAY_ULTRASOUND   : J 350  → 空欄
 *   Row 24 SELFPAY_INITIAL_FULL : J 4700 → 空欄
 *   Row 25 SELFPAY_CONTINUE20   : J 3000 → 空欄
 *   Row 26 SELFPAY_MAINT15      : J 2200 → 空欄
 *   Row 27 SELFPAY_FIRST_FEE15  : J 1500 → 空欄
 *   Row 28 SELFPAY_IFC10        : J 1000 → 空欄
 *   Row 29 SELFPAY_MANUAL3      : J 500  → 空欄
 *   Row 30 SELFPAY_OINTMENT     : Q 備考 → 院長判断を追記
 *
 * 実行:
 *   node scripts/apply-jbiz04-pricing-v2-fix-20260425b.mjs          # dry-run
 *   node scripts/apply-jbiz04-pricing-v2-fix-20260425b.mjs --write  # 実行
 */
import { getAuthorizedContext, updateSheetValues } from './lib-sheets.mjs';

const SHEET_ID = '1FnJdALwFSv48WiD6NWr0DzG78kwB692R2pFeiTcZlCc';
const SHEET_NAME = '価格設定_v2';

// J列のみ空欄にする対象行（J = col 10 = 0-based index 9）
const GYM_PRICE_ROWS = [8, 9, 10, 24, 25, 26, 27, 28, 29];

async function main() {
  const write = process.argv.includes('--write');
  const ctx = await getAuthorizedContext();
  const base = { spreadsheetId: SHEET_ID, sheetName: SHEET_NAME, accessToken: ctx.accessToken };

  // ① J列（ジム会員料金）を空欄に統一
  for (const row of GYM_PRICE_ROWS) {
    const range = `J${row}`;
    console.log(`[${write ? 'WRITE' : 'DRY'}] Row ${row} ${range}: J列（ジム会員料金）→ 空欄`);
    if (write) {
      await updateSheetValues({ ...base, range, values: [['']] });
      console.log('  -> OK');
    }
  }

  // ② Row 30 SELFPAY_OINTMENT: Q備考に院長判断を追記
  const ointmentNote = '院長判断（2026-04-25）: 手技3分(SELFPAY_MANUAL3)に含める。個別メニューとして有効化しない。ジム会員料金も設定しない。';
  console.log(`[${write ? 'WRITE' : 'DRY'}] Row 30 Q30: 院長判断備考を記録`);
  console.log(`  -> "${ointmentNote}"`);
  if (write) {
    await updateSheetValues({ ...base, range: 'Q30', values: [[ointmentNote]] });
    console.log('  -> OK');
  }

  console.log('\n' + (write ? '[DONE] 全変更適用済み' : '[DRY-RUN] --write を付けて再実行してください'));
}

main().catch(e => { console.error('[ERROR]', e.message); process.exit(1); });
