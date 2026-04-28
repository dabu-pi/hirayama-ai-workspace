#!/usr/bin/env node
/**
 * JBIZ-04: 価格設定_v2 手技メニュー一本化（2026-04-25d）
 *
 * 院長判断:
 *   - 手技パーツは SELFPAY_MANUAL3（約3分・自費個別パーツ）に一本化
 *   - SELFPAY_MANUAL5 は削除せず廃止/保留に変更（履歴保持）
 *   - 軟膏塗布は SELFPAY_MANUAL3 に含める
 *
 * 変更内容:
 *   Row 22 SELFPAY_MANUAL5:
 *     B: 主力自費メニュー → 廃止/保留/将来検討
 *     C: 手技主力       → 廃止
 *     G: 短時間の手技療法 → SELFPAY_MANUAL3 に統合済み。現在は使用しない
 *     N: TRUE           → FALSE（KPI集計対象外）
 *     O: 確定           → 廃止
 *     P: TRUE           → FALSE（有効フラグ）
 *     Q: （空欄）       → 統合経緯を記録
 *
 *   Row 29 SELFPAY_MANUAL3:
 *     G: 短時間手技 → 短時間手技。必要に応じて軟膏塗布を含む
 *     Q: 旧誤記     → 正しい説明に更新
 *
 * 実行:
 *   node scripts/apply-jbiz04-pricing-v2-manual-unify.mjs          # dry-run
 *   node scripts/apply-jbiz04-pricing-v2-manual-unify.mjs --write  # 実行
 */
import { getAuthorizedContext, updateSheetValues } from './lib-sheets.mjs';

const SHEET_ID = '1FnJdALwFSv48WiD6NWr0DzG78kwB692R2pFeiTcZlCc';
const SHEET_NAME = '価格設定_v2';

async function main() {
  const write = process.argv.includes('--write');
  const ctx = await getAuthorizedContext();
  const base = { spreadsheetId: SHEET_ID, sheetName: SHEET_NAME, accessToken: ctx.accessToken };

  const updates = [

    // ─── Row 22: SELFPAY_MANUAL5 → 廃止/保留/将来検討 ───

    {
      label: 'Row22 B22:C22: 大区分・中区分 → 廃止',
      range: 'B22:C22',
      values: [['廃止/保留/将来検討', '廃止']],
    },
    {
      label: 'Row22 G22: 内容 → 統合済み説明',
      range: 'G22',
      values: [['SELFPAY_MANUAL3 に統合済み。現在は使用しない']],
    },
    {
      label: 'Row22 N22:P22: KPI集計対象=FALSE / 確定状況=廃止 / 有効フラグ=FALSE',
      range: 'N22:P22',
      values: [['FALSE', '廃止', 'FALSE']],
    },
    {
      label: 'Row22 Q22: 統合経緯を記録',
      range: 'Q22',
      values: [['2026-04-25 院長判断により SELFPAY_MANUAL3(Row29) へ統合。削除せず履歴保持。旧: 主力自費メニュー > 手技主力 / 有効TRUE']],
    },

    // ─── Row 29: SELFPAY_MANUAL3 → 軟膏塗布含む説明に更新 ───

    {
      label: 'Row29 G29: 内容 → 軟膏塗布含む説明に更新',
      range: 'G29',
      values: [['短時間手技。必要に応じて軟膏塗布を含む']],
    },
    {
      label: 'Row29 Q29: 備考 → 正しい内容に更新',
      range: 'Q29',
      values: [['手技パーツ単品。軟膏塗布込み対応可。SELFPAY_MANUAL5(Row22)に代わり手技メニューを一本化（2026-04-25）']],
    },
  ];

  for (const u of updates) {
    console.log(`[${write ? 'WRITE' : 'DRY'}] ${u.label}`);
    console.log(`  -> ${u.range}: ${JSON.stringify(u.values[0])}`);
    if (write) {
      await updateSheetValues({ ...base, range: u.range, values: u.values });
      console.log('  -> OK');
    }
  }

  console.log('\n' + (write ? '[DONE] 全変更適用済み' : '[DRY-RUN] --write を付けて再実行してください'));
}

main().catch(e => { console.error('[ERROR]', e.message); process.exit(1); });
