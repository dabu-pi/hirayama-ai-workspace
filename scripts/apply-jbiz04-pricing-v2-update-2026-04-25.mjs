#!/usr/bin/env node
/**
 * JBIZ-04: 価格設定_v2 バージョンアップ（2026-04-25）
 *
 * 変更内容:
 *   ① Row 24 SELFPAY_INITIAL_FULL  → 初回標準施術 / 5,000円 / 約48分
 *   ② Row 25 SELFPAY_CONTINUE20    → 継続標準施術 / 3,500円 / 約33分（主力フラグ=TRUE維持）
 *   ③ Row 26 SELFPAY_MAINT15       → メンテナンス施術 / 2,500円 / 約23分
 *   ④ Row 8  SELFPAY_MICROCURRENT  → 自費個別パーツ > 電療 / ジム会員850円
 *   ⑤ Row 9  SELFPAY_HIGHVOLTAGE   → 自費個別パーツ > 電療 / 500円/約5分/ジム会員500円（価格・時間訂正）
 *   ⑥ Row 10 SELFPAY_ULTRASOUND    → 自費個別パーツ > 電療 / ジム会員350円
 *   ⑦ Row 11 SELFPAY_CHRONIC50     → 特別対応/保留 に分類変更
 *   ⑧ Row 15 ELECTRO_AM_UNLIMITED  → 廃止/保留/将来検討 に分類変更
 *   ⑨ Row 17 TRAINING_4PASS        → 確定状況を保留に変更（価格見直し必須）
 *   ⑩ Row 27 SELFPAY_FIRST_FEE15   → 新規追加（初診料）
 *   ⑪ Row 28 SELFPAY_IFC10         → 新規追加（干渉波）
 *   ⑫ Row 29 SELFPAY_MANUAL3       → 新規追加（手技）※SELFPAY_MANUAL5 は v2 に存在しないため新規
 *   ⑬ Row 30 SELFPAY_OINTMENT      → 新規追加（軟膏塗布・価格・時間 要確認）
 *
 * 税別ルール: 価格設定_v2 の全価格は税別。
 *
 * 実行:
 *   node scripts/apply-jbiz04-pricing-v2-update-2026-04-25.mjs          # dry-run
 *   node scripts/apply-jbiz04-pricing-v2-update-2026-04-25.mjs --write  # 実行
 */
import { getAuthorizedContext, updateSheetValues } from './lib-sheets.mjs';

const SHEET_ID = '1FnJdALwFSv48WiD6NWr0DzG78kwB692R2pFeiTcZlCc';
const SHEET_NAME = '価格設定_v2';

// 列順（v2 全17列）:
//   A=表示順  B=大区分    C=中区分         D=menu_id
//   E=メニュー名          F=患者向け表示名  G=内容
//   H=時間    I=一般料金  J=ジム会員料金   K=保険適用
//   L=回数・単位  M=主力手技フラグ  N=KPI集計対象
//   O=確定状況  P=有効フラグ  Q=備考

async function main() {
  const write = process.argv.includes('--write');
  const ctx = await getAuthorizedContext();
  const base = { spreadsheetId: SHEET_ID, sheetName: SHEET_NAME, accessToken: ctx.accessToken };

  const updates = [

    // ─────────────────────────────────────────────
    // ① 主力3メニュー更新
    // ─────────────────────────────────────────────

    {
      label: '① Row 24: SELFPAY_INITIAL_FULL → 初回標準施術 (6000→5000 / 約50分→約48分)',
      range: 'A24:Q24',
      values: [[
        25,                   // A 表示順
        '主力自費メニュー',    // B 大区分
        '初回標準',            // C 中区分（初回パッケージ→初回標準）
        'SELFPAY_INITIAL_FULL', // D menu_id
        '初回標準施術',        // E メニュー名
        '初回標準施術',        // F 患者向け表示名
        '初診評価＋干渉波＋マイクロカレント＋ハイボルテージ＋超音波＋手技を組み合わせた初回標準施術', // G 内容
        '約48分',              // H 時間
        5000,                  // I 一般料金（税別）
        4700,                  // J ジム会員料金（税別）※旧6000時から維持。通常5000への変更で割引率が6%に低下。次フェーズで再確認推奨
        '自費',                // K 保険適用
        '1回',                 // L 回数・単位
        'FALSE',               // M 主力手技フラグ
        'TRUE',                // N KPI集計対象
        '確定',                // O 確定状況
        'TRUE',                // P 有効フラグ
        'ジム会員価格4,700円は旧価格から維持。通常5,000円への変更で割引率6%に低下。次フェーズで再確認推奨', // Q 備考
      ]],
    },

    {
      label: '② Row 25: SELFPAY_CONTINUE20 → 継続標準施術 (約20分→約33分)',
      range: 'A25:Q25',
      values: [[
        55,
        '主力自費メニュー',
        '継続標準',            // C（継続施術→継続標準）
        'SELFPAY_CONTINUE20',
        '継続標準施術',        // E（継続施術20分→継続標準施術）
        '継続標準施術',        // F
        '干渉波＋マイクロカレント＋ハイボルテージ＋超音波＋手技を組み合わせた継続標準施術', // G
        '約33分',              // H（約20分→約33分）
        3500,                  // I 税別
        3000,                  // J 税別
        '自費',
        '1回',
        'TRUE',                // M 主力手技フラグ維持
        'TRUE',
        '確定',
        'TRUE',
        '旧名称「継続施術20分」は実態と合わないため修正（2026-04-25）',
      ]],
    },

    {
      label: '③ Row 26: SELFPAY_MAINT15 → メンテナンス施術 (約15分→約23分)',
      range: 'A26:Q26',
      values: [[
        56,
        '主力自費メニュー',
        'メンテナンス',         // C（継続施術→メンテナンス）
        'SELFPAY_MAINT15',
        'メンテナンス施術',     // E（メンテナンス15分→メンテナンス施術）
        'メンテナンス施術',     // F
        '干渉波＋マイクロカレント＋手技を組み合わせた軽症・維持向け施術', // G
        '約23分',              // H（約15分→約23分）
        2500,                  // I 税別
        2200,                  // J 税別
        '自費',
        '1回',
        'FALSE',
        'TRUE',
        '確定',
        'TRUE',
        '旧名称「メンテナンス15分」は実態と合わないため修正（2026-04-25）',
      ]],
    },

    // ─────────────────────────────────────────────
    // ② 個別パーツ3種の分類変更（主力自費→自費個別パーツ）
    // ─────────────────────────────────────────────

    {
      label: '④ Row 8: SELFPAY_MICROCURRENT 主力→自費個別パーツ / ジム会員850円追加 / 単位1回→1部位',
      range: 'A8:Q8',
      values: [[
        50,
        '自費個別パーツ',       // B（主力自費メニュー→自費個別パーツ）
        '電療',                 // C（物療主力→電療）
        'SELFPAY_MICROCURRENT',
        'マイクロカレント',
        'マイクロカレント',
        '微弱電流治療',
        '約10分',
        1000,                  // I 税別
        850,                   // J ジム会員料金（税別）新規追加
        '自費',
        '1部位',               // L（1回→1部位）
        'FALSE',
        'TRUE',
        '確定',
        'TRUE',
        '分類変更: 主力自費メニュー→自費個別パーツ（2026-04-25）',
      ]],
    },

    {
      label: '⑤ Row 9: SELFPAY_HIGHVOLTAGE 主力→自費個別パーツ / 1000→500円 / 約10分→約5分 / ジム会員500円',
      range: 'A9:Q9',
      values: [[
        60,
        '自費個別パーツ',
        '電療',
        'SELFPAY_HIGHVOLTAGE',
        'ハイボルテージ',
        'ハイボルテージ',
        '高電圧治療',
        '約5分',               // H（約10分→約5分）
        500,                   // I（1000→500 税別）
        500,                   // J ジム会員料金（税別）新規追加
        '自費',
        '1部位',
        'FALSE',
        'TRUE',
        '確定',
        'TRUE',
        '価格訂正: 1,000→500円 / 時間訂正: 約10分→約5分 / 分類変更: 主力→自費個別パーツ（2026-04-25）',
      ]],
    },

    {
      label: '⑥ Row 10: SELFPAY_ULTRASOUND 主力→自費個別パーツ / ジム会員350円追加 / 単位1回→1部位',
      range: 'A10:Q10',
      values: [[
        70,
        '自費個別パーツ',
        '電療',
        'SELFPAY_ULTRASOUND',
        '超音波',
        '超音波',
        '超音波治療',
        '約5分',
        500,                   // I 税別
        350,                   // J ジム会員料金（税別）新規追加
        '自費',
        '1部位',
        'FALSE',
        'TRUE',
        '確定',
        'TRUE',
        '分類変更: 主力自費メニュー→自費個別パーツ（2026-04-25）',
      ]],
    },

    // ─────────────────────────────────────────────
    // ③ 廃止・保留・特別対応への分類変更
    // ─────────────────────────────────────────────

    {
      label: '⑦ Row 11: SELFPAY_CHRONIC50 → 特別対応/保留',
      range: 'A11:Q11',
      values: [[
        80,
        '特別対応/保留',        // B（主力自費メニュー→特別対応/保留）
        '特別対応',             // C
        'SELFPAY_CHRONIC50',
        '慢性ケア手技50分',
        '慢性ケア手技50分',
        '手技中心で筋緊張・可動域・姿勢バランスを整える',
        '約50分',
        5500,                  // I 税別
        4700,                  // J 税別
        '自費',
        '1回',
        'FALSE',               // M 主力フラグ解除（2026-04-21）
        'TRUE',
        '保留',                // O（確定→保留）
        'TRUE',
        '主力から外し特別対応/保留に分類変更（2026-04-25）。KPI集計対象は維持。',
      ]],
    },

    {
      label: '⑧ Row 15: ELECTRO_AM_UNLIMITED → 廃止/保留/将来検討',
      range: 'A15:Q15',
      values: [[
        120,
        '廃止/保留/将来検討',   // B（自費オプション→廃止/保留/将来検討）
        '稼働率対策',           // C
        'ELECTRO_AM_UNLIMITED',
        '電気治療午前限定通い放題',
        '電気治療午前限定通い放題',
        '干渉波電気治療',
        '約15分',
        5500,
        4700,
        '自費',
        '月額',
        'FALSE',
        'FALSE',
        '保留',                // O（確定→保留）
        'TRUE',
        '稼働率対策用として保留（2026-04-25）。主力扱いにしない。',
      ]],
    },

    {
      label: '⑨ Row 17: TRAINING_4PASS 確定状況→保留（価格見直し必須）',
      range: 'O17:Q17',
      values: [['保留', 'TRUE', '価格見直し必須。現時点では主力にしない（2026-04-25）']],
    },

    // ─────────────────────────────────────────────
    // ④ 新規個別パーツ4種（Row 27〜30）
    // ─────────────────────────────────────────────

    {
      label: '⑩〜⑬ Row 27〜30: 個別パーツ4種 新規追加',
      range: 'A27:Q30',
      values: [
        // Row 27: SELFPAY_FIRST_FEE15 初診料
        [
          200,
          '自費個別パーツ',
          '初回',
          'SELFPAY_FIRST_FEE15',
          '初診料',
          '初診料',
          '初回評価・問診・状態確認',
          '約15分',
          1500,              // I 税別
          1500,              // J ジム会員同価格
          '自費',
          '1回',
          'FALSE',
          'TRUE',
          '確定',
          'TRUE',
          '',
        ],
        // Row 28: SELFPAY_IFC10 干渉波
        [
          210,
          '自費個別パーツ',
          '電療',
          'SELFPAY_IFC10',
          '干渉波',
          '干渉波',
          '干渉波電気治療',
          '約10分',
          1000,              // I 税別
          1000,              // J ジム会員同価格
          '自費',
          '1部位',
          'FALSE',
          'TRUE',
          '確定',
          'TRUE',
          '',
        ],
        // Row 29: SELFPAY_MANUAL3 手技（SELFPAY_MANUAL5 は価格設定_v2 に存在しないため新規）
        [
          220,
          '自費個別パーツ',
          '手技',
          'SELFPAY_MANUAL3',
          '手技',
          '手技',
          '短時間手技',
          '約3分',
          500,               // I 税別
          500,               // J ジム会員同価格
          '自費',
          '1部位',
          'FALSE',
          'TRUE',
          '確定',
          'TRUE',
          'SELFPAY_MANUAL5 は価格設定_v2 に存在しないため SELFPAY_MANUAL3 として新規追加',
        ],
        // Row 30: SELFPAY_OINTMENT 軟膏塗布（価格・時間 要確認）
        [
          230,
          '自費個別パーツ',
          '処置',
          'SELFPAY_OINTMENT',
          '軟膏塗布',
          '軟膏塗布',
          '軟膏塗布・患部処置',
          '要確認',           // H 時間 未確定
          '',                 // I 価格 未確定
          '',                 // J ジム会員料金 未確定
          '自費',
          '1回',
          'FALSE',
          'FALSE',            // N KPI集計対象（未確定のため FALSE）
          '要確認',           // O 確定状況
          'FALSE',            // P 有効フラグ（未確定のため FALSE）
          '価格・時間 未確定（要確認）。確定後に有効フラグを TRUE にする。',
        ],
      ],
    },

  ];

  // ─── 実行 ───
  for (const u of updates) {
    console.log(`[${write ? 'WRITE' : 'DRY'}] ${u.label}`);
    if (write) {
      await updateSheetValues({ ...base, range: u.range, values: u.values });
      console.log('  -> OK');
    } else {
      u.values.forEach((row, i) => {
        const rowLabel = u.range.match(/\d+/) ? parseInt(u.range.match(/\d+/)[0]) + i : i + 1;
        console.log(`  Row ${rowLabel}: ${JSON.stringify(row.slice(0, 6))} ...`);
      });
    }
  }

  console.log('\n' + (write ? '[DONE] 全変更適用済み' : '[DRY-RUN] --write を付けて再実行してください'));
}

main().catch(e => { console.error('[ERROR]', e.message); process.exit(1); });
