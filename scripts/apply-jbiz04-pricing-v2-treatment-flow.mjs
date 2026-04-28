#!/usr/bin/env node
/**
 * JBIZ-04: 価格設定_v2 シートへ治療導線v1対応メニューを追加
 *   - 空行（Row 24〜26）に3メニューを追加
 *   - SELFPAY_CHRONIC50 の主力手技フラグを FALSE に変更
 */
import { getAuthorizedContext, updateSheetValues } from './lib-sheets.mjs';

const SHEET_ID = '1FnJdALwFSv48WiD6NWr0DzG78kwB692R2pFeiTcZlCc';
const SHEET_NAME = '価格設定_v2';

// 列順: A=表示順 B=大区分 C=中区分 D=menu_id E=メニュー名 F=患者向け表示名
//       G=内容 H=時間 I=一般料金 J=ジム会員料金 K=保険適用 L=回数・単位
//       M=主力手技フラグ N=KPI集計対象
const NEW_ROWS = [
  // Row 24: 初回パッケージ
  [
    '25',
    '主力自費メニュー',
    '初回パッケージ',
    'SELFPAY_INITIAL_FULL',
    '初回改善施術',
    '初回改善施術',
    '評価＋物療（干渉波・マイクロ・HV・超音波）＋手技を組み合わせた初回施術',
    '約50分',
    '6000',
    '4700',
    '自費',
    '1回',
    'FALSE',
    'TRUE',
  ],
  // Row 25: 継続施術20分（主力）
  [
    '55',
    '主力自費メニュー',
    '継続施術',
    'SELFPAY_CONTINUE20',
    '継続施術20分',
    '継続施術',
    '物療（2種）＋手技を組み合わせた再発予防施術',
    '約20分',
    '3500',
    '3000',
    '自費',
    '1回',
    'TRUE',
    'TRUE',
  ],
  // Row 26: メンテナンス15分
  [
    '56',
    '主力自費メニュー',
    '継続施術',
    'SELFPAY_MAINT15',
    'メンテナンス15分',
    'メンテナンス施術',
    '軽度症状向け（物療1種＋手技）',
    '約15分',
    '2500',
    '2200',
    '自費',
    '1回',
    'FALSE',
    'TRUE',
  ],
];

async function main() {
  const write = process.argv.includes('--write');
  const ctx = await getAuthorizedContext();
  const base = { spreadsheetId: SHEET_ID, sheetName: SHEET_NAME, accessToken: ctx.accessToken };

  // ① SELFPAY_CHRONIC50 の主力手技フラグ（Row 11, M列）を FALSE に変更
  console.log(`[INFO] SELFPAY_CHRONIC50 主力手技フラグ変更: ${SHEET_NAME}!M11 -> FALSE`);
  if (write) {
    await updateSheetValues({ ...base, range: 'M11', values: [['FALSE']] });
    console.log('[OK] SELFPAY_CHRONIC50 フラグ更新完了');
  } else {
    console.log('[DRY] would update M11 -> FALSE');
  }

  // ② 空行 Row 24〜26 に3メニューを追加
  console.log(`[INFO] 新規メニュー追加: ${SHEET_NAME}!A24:N26`);
  NEW_ROWS.forEach((row, i) => {
    console.log(`  Row ${24 + i}: menu_id=${row[3]} 表示順=${row[0]} 一般料金=${row[8]} 主力手技フラグ=${row[12]}`);
  });

  if (write) {
    await updateSheetValues({ ...base, range: 'A24:N26', values: NEW_ROWS });
    console.log('[OK] 新規メニュー3件追加完了');
  } else {
    console.log('[DRY] would write 3 rows to A24:N26');
  }

  console.log(write ? '[DONE] 全変更適用済み' : '[DRY-RUN] --write を付けて再実行してください');
}

main().catch(e => { console.error('[ERROR]', e.message); process.exit(1); });
