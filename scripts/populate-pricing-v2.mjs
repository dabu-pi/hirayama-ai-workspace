#!/usr/bin/env node
/**
 * JBIZ-04: populate 価格設定_v2 data rows from current 価格設定,
 * applying menu_id rename (SELF_* -> SELFPAY_*) and reclassification.
 * Writes: 価格設定_v2 data rows + conditional formatting,
 *         価格設定_運用メモ 追記（転記ルール・未確定論点）.
 * Does NOT touch 価格設定 / KPI逆算 / KPI目標 / JREC.
 */
import {
  getAuthorizedContext,
  getSpreadsheetMetadata,
  batchUpdateSpreadsheet,
  updateSheetValues,
} from './lib-sheets.mjs';

const LIVE_SHEET_ID = '1FnJdALwFSv48WiD6NWr0DzG78kwB692R2pFeiTcZlCc';
const V2 = '価格設定_v2';
const MEMO = '価格設定_運用メモ';

// Data rows: 17 columns
// [表示順, 大区分, 中区分, menu_id, メニュー名, 患者向け表示名, 内容, 時間,
//  一般料金, ジム会員料金, 保険適用, 回数単位, 主力手技フラグ, KPI集計対象, 確定状況, 有効フラグ, 備考]
const DATA = [
  // 1. 保険施術
  [10, '保険施術', '通常', 'INS_BASIC', '保険施術', '保険施術',
    '検査＋電気治療（約15分）＋手技（約5分）', '約20分',
    '', '', '保険', '1回', false, false, '確定', true,
    '急な痛みや日常の不調に対応。料金は窓口で算定'],

  // 2. 症状別初回評価
  [20, '症状別初回評価', '初回限定', 'SELFPAY_EVAL_LOWBACK30',
    '腰痛改善 運動療法 初回評価', '腰痛改善 運動療法 初回評価',
    '腰痛の原因になりやすい姿勢・股関節・体幹の使い方を評価し、その場で改善運動を体験する初回メニュー',
    '約30分', 3300, 2800, '自費', '1回', false, true, '仮', true,
    '旧 SELF_EVAL_LOWBACK30。会員価格2,800円は仮値（次フェーズで確定）'],
  [30, '症状別初回評価', '初回限定', 'SELFPAY_EVAL_NECKSHOULDER30',
    '首肩こり改善 運動療法 初回評価', '首肩こり改善 運動療法 初回評価',
    '首肩こりの原因になりやすい姿勢・胸椎・肩甲骨の動きを評価し、その場で改善運動を体験する初回メニュー',
    '約30分', 3300, 2800, '自費', '1回', false, true, '仮', true,
    '旧 SELF_EVAL_NECKSHOULDER30。会員価格2,800円は仮値'],
  [40, '症状別初回評価', '初回限定', 'SELFPAY_EVAL_KNEE30',
    '膝改善 運動療法 初回評価', '膝改善 運動療法 初回評価',
    '膝の負担に関わる立ち方・股関節・足部の使い方を評価し、その場で改善運動を体験する初回メニュー',
    '約30分', 3300, 2800, '自費', '1回', false, true, '仮', true,
    '旧 SELF_EVAL_KNEE30。会員価格2,800円は仮値'],

  // 3. 主力自費メニュー - 物療主力
  [50, '主力自費メニュー', '物療主力', 'SELFPAY_MICROCURRENT',
    'マイクロカレント', 'マイクロカレント',
    '微弱電流治療', '約10分', 1000, '', '自費', '1回', false, true, '確定', true,
    '旧 Row32 orphan を正式メニュー化。ジム会員優待価格は未設定'],
  [60, '主力自費メニュー', '物療主力', 'SELFPAY_HIGHVOLTAGE',
    'ハイボルテージ', 'ハイボルテージ',
    '高電圧治療器', '約10分', 1000, '', '自費', '1回', false, true, '確定', true,
    '旧 Row33 orphan を正式メニュー化。ジム会員優待価格は未設定'],
  [70, '主力自費メニュー', '物療主力', 'SELFPAY_ULTRASOUND',
    '超音波', '超音波',
    '超音波治療器にて治療', '約5分', 500, '', '自費', '1回', false, true, '確定', true,
    '旧 Row34 orphan を正式メニュー化。ジム会員優待価格は未設定'],

  // 3. 主力自費メニュー - 手技主力（KPI主力）
  [80, '主力自費メニュー', '手技主力', 'SELFPAY_CHRONIC50',
    '慢性ケア手技50分', '慢性ケア手技50分',
    '手技中心で筋緊張・可動域・姿勢バランスを整える', '約50分',
    5500, 4700, '自費', '1回', true, true, '確定', true,
    '旧 SELF_CHRONIC50。KPI逆算の主力手技価格参照元（主力手技フラグ=TRUE は本行のみ）'],

  // 4. 保険施術オプション
  [90, '保険施術オプション', '延長', 'INS_OPTION_EXTEND10',
    '手技延長', '手技延長', '10分延長', '10分',
    1100, 950, '保険＋オプション', '1回', false, true, '確定', true,
    '会員価格は live=950 / pricing.md=935 の差異あり。live 値を採用'],
  [100, '保険施術オプション', '追加', 'INS_OPTION_STRETCH20',
    'ストレッチ', 'ストレッチ', '20分', '20分',
    2200, 2000, '保険＋オプション', '1回', false, true, '確定', true, ''],
  [110, '保険施術オプション', '追加', 'INS_OPTION_ELECTRO15',
    '電療追加(干渉波延長)', '電療追加', '15分', '15分',
    880, 750, '保険＋オプション', '1回', false, true, '確定', true, ''],

  // 5. 自費オプション
  [120, '自費オプション', '通い放題', 'ELECTRO_AM_UNLIMITED',
    '電気治療午前限定通い放題', '電気治療午前限定通い放題',
    '干渉波電気治療', '約15分', 5500, 4700, '自費', '月額', false, false, '確定', true,
    '主力と同額だが KPI集計=× で分離。機械中心メニュー'],

  // 6. 再発予防・運動再教育
  [130, '再発予防・運動再教育', 'パーソナル', 'SELFPAY_PT60',
    'パーソナルトレーニング', 'パーソナルトレーニング',
    '痛まない身体の使い方習得', '約50分', 5500, 4700, '自費', '1回', false, true, '要確認', true,
    '価格乖離: live=5,500 / pricing.md=8,800。どちらが正か確認後に確定'],
  [140, '再発予防・運動再教育', 'パッケージ', 'TRAINING_4PASS',
    'BIG3卒業コース全4回', 'BIG3卒業コース全4回',
    'フォーム再教育・卒業設計', '50分×4回', 22000, 13200, '自費', '4回', false, true, '要確認', true,
    '価格乖離: live=22,000 / pricing.md=35,200。どちらが正か確認後に確定。名称も要整合'],

  // 7. ジム接続メニュー
  [150, 'ジム接続メニュー', 'asago月会費', 'GYM_MONTHLY_REF',
    '月会員', 'ジム月会員', '併設ジム利用', '月額',
    7480, '', '自費', '月額', false, false, '仮', true,
    'asago公式7区分の代表1行（男性会員）。7区分詳細は pricing.md 参照'],

  // 8. 廃止/保留/将来検討
  [900, '廃止/保留/将来検討', '検討中', 'FUTURE_DEEP_COND',
    '深部コンディショニング', '深部コンディショニング',
    '深部電気＋軽調整', '約30分', 4400, 3800, '自費', '1回', false, false, '将来検討', false,
    '機械中心の自費は当面主力にしない'],
  [910, '廃止/保留/将来検討', '検討中', 'FUTURE_ELECTRO1',
    '電気治療1回', '電気治療1回',
    '干渉波電気治療', '約15分', 1200, 1000, '自費', '1回', false, false, '将来検討', false,
    '機械は保険治療の補助用を優先'],
  [920, '廃止/保留/将来検討', '検討中', 'FUTURE_CHRONIC_8PASS',
    '慢性疼痛改善 8回プログラム', '慢性疼痛改善 8回プログラム',
    '根本改善＋再発予防設計', '45分×8回', 58000, 49300, '自費', '8回', false, false, '将来検討', false,
    '主力前提は外し、将来の継続商品候補として保持'],
];

const MEMO_APPEND_ROWS = [
  ['', '', '', ''],
  ['▼ 価格設定_v2 転記ルール（2026-04-17）', '', '', ''],
  ['項目', '内容', '確定状況', '備考'],
  ['接頭辞統一', 'SELF_* → SELFPAY_* に全置換', '確定', 'セルフケアと紛らわしいため'],
  ['物療3種の昇格', 'マイクロ/ハイボル/超音波 を主力自費＞物療主力へ', '確定', '旧 orphan Row32〜34 を正式メニュー化'],
  ['KPI主力フラグ', 'SELFPAY_CHRONIC50 の1行のみ TRUE', '確定', '表示順≠KPI主力。物療は上位だが主力フラグは FALSE'],
  ['表示順', '10刻みで大区分単位にブロック化', '確定', '挿入余地確保'],
  ['有効フラグ', '将来検討3種は FALSE', '確定', '集計対象外の明示'],
  ['', '', '', ''],
  ['▼ v2 に残した未確定論点', '', '', ''],
  ['項目', '内容', '確定状況', '備考'],
  ['SELFPAY_PT60 価格', 'live=5,500 / pricing.md=8,800', '要確認', '正本確定後に更新'],
  ['TRAINING_4PASS 価格・名称', 'live=22,000 / pricing.md=35,200、名称も不一致', '要確認', '正本確定後に更新'],
  ['GYM_MONTHLY_REF', 'asago 7区分の代表1行で妥協。7区分全行化は別判断', '仮', '男性会員 7,480円を代表値としている'],
  ['物療3種の会員優待価格', '未設定（空欄）', '仮', '次フェーズで確定'],
  ['症状別初回評価 会員価格', '2,800円（仮）', '仮', '月会員コース設計後に確定'],
];

async function main() {
  const ctx = await getAuthorizedContext();
  ctx.spreadsheetId = LIVE_SHEET_ID;

  const meta = await getSpreadsheetMetadata({ spreadsheetId: LIVE_SHEET_ID, accessToken: ctx.accessToken });
  const sheets = meta.sheets.map(s => s.properties);
  const v2 = sheets.find(p => p.title === V2);
  const memo = sheets.find(p => p.title === MEMO);
  if (!v2) throw new Error(`Missing sheet: ${V2}`);
  if (!memo) throw new Error(`Missing sheet: ${MEMO}`);
  const v2SheetId = v2.sheetId;
  const memoSheetId = memo.sheetId;
  console.log(`[INFO] v2 sheetId=${v2SheetId} / memo sheetId=${memoSheetId}`);

  // Safety: abort if v2 data rows already have content (row 4+)
  const v2CheckUrl = `https://sheets.googleapis.com/v4/spreadsheets/${LIVE_SHEET_ID}/values/${encodeURIComponent(`${V2}!A4:A50`)}`;
  const chk = await fetch(v2CheckUrl, { headers: { Authorization: `Bearer ${ctx.accessToken}` } }).then(r => r.json());
  if ((chk.values || []).some(r => r[0] !== '' && r[0] != null)) {
    throw new Error(`Abort: ${V2} already has data rows below header. Refusing overwrite.`);
  }

  // Write data rows into 価格設定_v2 starting row 4
  const endRow = 3 + DATA.length; // inclusive
  await updateSheetValues({
    spreadsheetId: LIVE_SHEET_ID,
    accessToken: ctx.accessToken,
    sheetName: V2,
    range: `A4:Q${endRow}`,
    values: DATA.map(r => r.map(v => typeof v === 'boolean' ? (v ? 'TRUE' : 'FALSE') : v)),
  });
  console.log(`[INFO] Wrote ${DATA.length} data rows to ${V2}!A4:Q${endRow}`);

  // Append memo rules to 価格設定_運用メモ starting row 9
  await updateSheetValues({
    spreadsheetId: LIVE_SHEET_ID,
    accessToken: ctx.accessToken,
    sheetName: MEMO,
    range: `A9:D${8 + MEMO_APPEND_ROWS.length}`,
    values: MEMO_APPEND_ROWS,
  });
  console.log(`[INFO] Appended memo rules to ${MEMO}`);

  // Conditional formatting on v2 data range
  const dataRange = { sheetId: v2SheetId, startRowIndex: 3, endRowIndex: 3 + DATA.length, startColumnIndex: 0, endColumnIndex: 17 };

  const requests = [
    // 将来検討 → gray
    {
      addConditionalFormatRule: {
        rule: {
          ranges: [dataRange],
          booleanRule: {
            condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: '=$O4="将来検討"' }] },
            format: { backgroundColor: { red: 0.90, green: 0.90, blue: 0.90 } },
          },
        },
        index: 0,
      },
    },
    // 要確認 / 仮 → yellow
    {
      addConditionalFormatRule: {
        rule: {
          ranges: [dataRange],
          booleanRule: {
            condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: '=OR($O4="要確認",$O4="仮")' }] },
            format: { backgroundColor: { red: 1.0, green: 0.97, blue: 0.80 } },
          },
        },
        index: 1,
      },
    },
    // 主力手技フラグ TRUE → light blue + bold
    {
      addConditionalFormatRule: {
        rule: {
          ranges: [dataRange],
          booleanRule: {
            condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: '=$M4=TRUE' }] },
            format: {
              backgroundColor: { red: 0.80, green: 0.92, blue: 0.98 },
              textFormat: { bold: true },
            },
          },
        },
        index: 2,
      },
    },
    // 有効フラグ FALSE → strikethrough + light gray text
    {
      addConditionalFormatRule: {
        rule: {
          ranges: [dataRange],
          booleanRule: {
            condition: { type: 'CUSTOM_FORMULA', values: [{ userEnteredValue: '=$P4=FALSE' }] },
            format: {
              textFormat: { strikethrough: true, foregroundColor: { red: 0.55, green: 0.55, blue: 0.55 } },
            },
          },
        },
        index: 3,
      },
    },
  ];

  // Data validation: 確定状況 (col O) enum
  requests.push({
    setDataValidation: {
      range: { sheetId: v2SheetId, startRowIndex: 3, endRowIndex: 200, startColumnIndex: 14, endColumnIndex: 15 },
      rule: {
        condition: {
          type: 'ONE_OF_LIST',
          values: [{ userEnteredValue: '確定' }, { userEnteredValue: '仮' }, { userEnteredValue: '要確認' }, { userEnteredValue: '将来検討' }, { userEnteredValue: '廃止' }],
        },
        strict: false,
        showCustomUi: true,
      },
    },
  });
  // Data validation: 主力手技フラグ (M) / KPI集計対象 (N) / 有効フラグ (P) as checkbox
  for (const col of [12, 13, 15]) {
    requests.push({
      setDataValidation: {
        range: { sheetId: v2SheetId, startRowIndex: 3, endRowIndex: 200, startColumnIndex: col, endColumnIndex: col + 1 },
        rule: { condition: { type: 'BOOLEAN' }, strict: true },
      },
    });
  }
  // Data validation: 保険適用 (K)
  requests.push({
    setDataValidation: {
      range: { sheetId: v2SheetId, startRowIndex: 3, endRowIndex: 200, startColumnIndex: 10, endColumnIndex: 11 },
      rule: {
        condition: {
          type: 'ONE_OF_LIST',
          values: [{ userEnteredValue: '保険' }, { userEnteredValue: '自費' }, { userEnteredValue: '保険＋オプション' }],
        },
        strict: false,
        showCustomUi: true,
      },
    },
  });

  await batchUpdateSpreadsheet({
    spreadsheetId: LIVE_SHEET_ID,
    accessToken: ctx.accessToken,
    requests,
  });
  console.log('[INFO] Applied conditional formatting + data validation');

  console.log('\n[DONE] Populated 価格設定_v2 data rows. Existing 価格設定 / KPI逆算 / KPI目標 unchanged.');
}

main().catch(e => { console.error('[ERROR]', e.message); process.exit(1); });
