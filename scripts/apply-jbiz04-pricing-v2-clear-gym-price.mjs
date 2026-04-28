#!/usr/bin/env node
/**
 * JBIZ-04: 価格設定_v2 ジム会員価格（J列）残存値を完全撤去（2026-04-25c）
 *
 * 院長判断: ジム優待割引を一旦すべて外す。
 *
 * スキャン結果（2026-04-25 実施）:
 *   Row 5  SELFPAY_EVAL_LOWBACK30      J=2800
 *   Row 6  SELFPAY_EVAL_NECKSHOULDER30 J=2800
 *   Row 7  SELFPAY_EVAL_KNEE30         J=2800
 *   Row 11 SELFPAY_CHRONIC50           J=4700
 *   Row 12 INS_OPTION_EXTEND10         J=950
 *   Row 13 INS_OPTION_STRETCH20        J=2000
 *   Row 14 INS_OPTION_ELECTRO15        J=750
 *   Row 15 ELECTRO_AM_UNLIMITED        J=4700
 *   Row 16 SELFPAY_PT60                J=4700
 *   Row 17 TRAINING_4PASS              J=13200
 *   Row 19 FUTURE_DEEP_COND            J=3800
 *   Row 20 FUTURE_ELECTRO1             J=1000
 *   Row 21 FUTURE_CHRONIC_8PASS        J=49300
 *   Row 22 SELFPAY_MANUAL5             J=500  ← 前回「存在しない」と誤記した未発見行
 *
 * 変更しない行:
 *   Row 18 GYM_MONTHLY_REF: J列は既に空欄。I列(月会費)は変更しない。
 *   Row 8-10, 24-29: 前回処理済みで既に空欄。
 *   Row 30 SELFPAY_OINTMENT: 元から空欄。
 *
 * 実行:
 *   node scripts/apply-jbiz04-pricing-v2-clear-gym-price.mjs          # dry-run
 *   node scripts/apply-jbiz04-pricing-v2-clear-gym-price.mjs --write  # 実行
 */
import { getAuthorizedContext, updateSheetValues } from './lib-sheets.mjs';

const SHEET_ID = '1FnJdALwFSv48WiD6NWr0DzG78kwB692R2pFeiTcZlCc';
const SHEET_NAME = '価格設定_v2';

// J列に残存していた行と旧値（記録用）
const TARGETS = [
  { row: 5,  menuId: 'SELFPAY_EVAL_LOWBACK30',      oldJ: 2800,  note: '症状別初回評価' },
  { row: 6,  menuId: 'SELFPAY_EVAL_NECKSHOULDER30',  oldJ: 2800,  note: '症状別初回評価' },
  { row: 7,  menuId: 'SELFPAY_EVAL_KNEE30',           oldJ: 2800,  note: '症状別初回評価' },
  { row: 11, menuId: 'SELFPAY_CHRONIC50',             oldJ: 4700,  note: '特別対応/保留' },
  { row: 12, menuId: 'INS_OPTION_EXTEND10',           oldJ: 950,   note: '保険施術オプション' },
  { row: 13, menuId: 'INS_OPTION_STRETCH20',          oldJ: 2000,  note: '保険施術オプション' },
  { row: 14, menuId: 'INS_OPTION_ELECTRO15',          oldJ: 750,   note: '保険施術オプション' },
  { row: 15, menuId: 'ELECTRO_AM_UNLIMITED',          oldJ: 4700,  note: '廃止/保留/将来検討' },
  { row: 16, menuId: 'SELFPAY_PT60',                  oldJ: 4700,  note: '再発予防・運動再教育' },
  { row: 17, menuId: 'TRAINING_4PASS',                oldJ: 13200, note: '再発予防・運動再教育（保留）' },
  { row: 19, menuId: 'FUTURE_DEEP_COND',              oldJ: 3800,  note: '廃止/保留/将来検討（無効）' },
  { row: 20, menuId: 'FUTURE_ELECTRO1',               oldJ: 1000,  note: '廃止/保留/将来検討（無効）' },
  { row: 21, menuId: 'FUTURE_CHRONIC_8PASS',          oldJ: 49300, note: '廃止/保留/将来検討（無効）' },
  { row: 22, menuId: 'SELFPAY_MANUAL5',               oldJ: 500,   note: '⚠️ 前回「存在しない」と誤記。実在。SELFPAY_MANUAL3(Row29)と共存中' },
];

async function main() {
  const write = process.argv.includes('--write');
  const ctx = await getAuthorizedContext();
  const base = { spreadsheetId: SHEET_ID, sheetName: SHEET_NAME, accessToken: ctx.accessToken };

  console.log(`[INFO] 対象 ${TARGETS.length} 行の J列を空欄化`);
  console.log('[INFO] GYM_MONTHLY_REF (Row18) は変更なし\n');

  for (const t of TARGETS) {
    const tag = t.menuId === 'SELFPAY_MANUAL5' ? ' ⚠️' : '';
    console.log(`[${write ? 'WRITE' : 'DRY'}] Row${t.row} J${t.row}: ${t.menuId}${tag} (旧J=${t.oldJ}) → 空欄  [${t.note}]`);
    if (write) {
      await updateSheetValues({ ...base, range: `J${t.row}`, values: [['']] });
      console.log('  -> OK');
    }
  }

  console.log('\n' + (write ? `[DONE] ${TARGETS.length}件 空欄化完了` : '[DRY-RUN] --write を付けて再実行してください'));
}

main().catch(e => { console.error('[ERROR]', e.message); process.exit(1); });
