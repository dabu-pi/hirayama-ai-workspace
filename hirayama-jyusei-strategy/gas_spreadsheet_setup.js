// ============================================================
// 平山接骨院 慢性疼痛強化プロジェクト
// Googleスプレッドシート 一括生成スクリプト
// 対応設計書: SHEET_DESIGN.md
// 最終更新: 2026-03-15
// ============================================================
//
// 【使い方】
// 1. Google スプレッドシートを新規作成する
// 2. 拡張機能 > Apps Script を開く
// 3. このコードを全選択して貼り付ける
// 4. 関数 createHirayamaSpreadsheet を選択して「実行」
// 5. 権限承認のダイアログが出たら「許可」する
// 6. 完了ダイアログにURLが表示される
// ============================================================

// --- シート名定数（変更しないこと）---
const SHEET = {
  DASHBOARD:  '全体ダッシュボード',
  ROADMAP:    'ロードマップ進捗',
  INSURANCE:  '保険・来院前提',
  NUMERIC:    '数値前提',
  PRICING:    '価格設定',
  KPI_REVERSE:'KPI逆算',
  KPI:        'KPI目標',
  KPI_HISTORY:'KPI実績履歴',
  KPI_REVERSE_HISTORY:'KPI逆算履歴',
  OPEN_ITEMS: '未確定項目',
};

// --- 色定数 ---
const C = {
  INPUT:       '#CFE2F3', // 青系: 手入力
  CALC:        '#D9EAD3', // 緑系: 自動計算
  HEADER:      '#D9D9D9', // 灰系: 見出し
  FIXED:       '#EFEFEF', // 灰系: 固定説明
  TEMP:        '#FFF2CC', // 黄系: 仮値・未確定
  WARN_BG:     '#F4CCCC', // 赤系: 警告
  TITLE_BG:    '#3C78D8', // 青: タイトル
  SECTION_BG:  '#434343', // 黒: セクション見出し
  CONFIRMED:   '#D9EAD3', // 薄緑: 確定済み
  UNCONFIRMED: '#F4CCCC', // 薄赤: 未確定
};

const WARNING_MSG =
  '⚠ このシートの行・列は追加・削除しないでください。数式の参照がズレます。入力は黄色セルのみ行ってください。';

// ============================================================
// エントリーポイント
// ============================================================
function createHirayamaSpreadsheet() {
  const ss = SpreadsheetApp.create('平山接骨院 慢性疼痛強化プロジェクト 管理表');

  // デフォルトシートをダッシュボードに転用
  const ds = ss.getSheets()[0];
  ds.setName(SHEET.DASHBOARD);

  setupDashboard(ss, ds);
  setupRoadmap(ss);
  setupInsurance(ss);
  setupNumeric(ss);
  setupPricing(ss);
  setupKPIReverse(ss);
  setupKPI(ss);
  setupKPIHistory(ss);
  setupKPIReverseHistory(ss);
  setupOpenItems(ss);
  reorderSheets(ss);

  const url = ss.getUrl();
  Logger.log('生成完了: ' + url);
  SpreadsheetApp.getUi().alert(
    '✅ スプレッドシートが生成されました。\n\n' + url
  );
}

// ============================================================
// 共通ユーティリティ
// ============================================================

/** 警告バー（行1）を設置 */
function addWarning(sheet, cols) {
  sheet.getRange(1, 1, 1, cols).merge()
    .setValue(WARNING_MSG)
    .setBackground(C.WARN_BG)
    .setFontColor('#7F4F24')
    .setFontWeight('bold')
    .setWrap(true);
  sheet.setRowHeight(1, 36);
}

/** タイトル行を設置（行2想定） */
function addTitle(sheet, cols, text) {
  sheet.getRange(2, 1, 1, cols).merge()
    .setValue(text)
    .setBackground(C.TITLE_BG)
    .setFontColor('#FFFFFF')
    .setFontSize(13)
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
}

/** セクション見出し行 */
function addSection(sheet, row, cols, text) {
  sheet.getRange(row, 1, 1, cols).merge()
    .setValue(text)
    .setBackground(C.SECTION_BG)
    .setFontColor('#FFFFFF')
    .setFontWeight('bold');
}

/** ヘッダセル */
function hdr(sheet, row, col, text) {
  sheet.getRange(row, col)
    .setValue(text)
    .setBackground(C.HEADER)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setWrap(true);
}

/** ラベルセル（左寄せ） */
function lbl(sheet, row, col, text) {
  sheet.getRange(row, col)
    .setValue(text)
    .setBackground(C.HEADER)
    .setFontWeight('bold');
}

/** 入力セル（青系）*/
function inp(sheet, row, col, val, fmt) {
  const cell = sheet.getRange(row, col);
  cell.setBackground(C.INPUT);
  if (val !== '' && val !== undefined) cell.setValue(val);
  if (fmt) cell.setNumberFormat(fmt);
  return cell;
}

/** 仮値セル（黄系）*/
function tempInp(sheet, row, col, val, fmt) {
  const cell = inp(sheet, row, col, val, fmt);
  cell.setBackground(C.TEMP);
  return cell;
}

/** 計算セル（緑系・保護警告）*/
function calc(sheet, row, col, formula, fmt) {
  const cell = sheet.getRange(row, col);
  cell.setFormula(formula)
    .setBackground(C.CALC);
  if (fmt) cell.setNumberFormat(fmt);
  const p = cell.protect();
  p.setWarningOnly(true);
  p.setDescription('自動計算セル（編集注意）');
  return cell;
}

/** 固定説明セル */
function fixedCell(sheet, row, col, text) {
  return sheet.getRange(row, col)
    .setValue(text)
    .setBackground(C.FIXED);
}

/** 短い入力メモ */
function setMemo(cell, text) {
  if (text) cell.setNote(text);
  return cell;
}

/** ドロップダウン設定 */
function dropdown(cell, list) {
  cell.setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(list, true)
      .build()
  );
}

/** 列幅まとめて設定 */
function setColWidths(sheet, widths) {
  widths.forEach((w, i) => sheet.setColumnWidth(i + 1, w));
}

/** シート順序を定数順に整列 */
function reorderSheets(ss) {
  Object.values(SHEET).forEach((name, i) => {
    const s = ss.getSheetByName(name);
    if (s) { ss.setActiveSheet(s); ss.moveActiveSheet(i + 1); }
  });
}

// ============================================================
// 1. 全体ダッシュボード
// ============================================================
function setupDashboard(ss, sheet) {
  setColWidths(sheet, [200, 300, 220]);
  addWarning(sheet, 3);
  addTitle(sheet, 3, '平山接骨院 慢性疼痛強化プロジェクト ダッシュボード');

  // 更新日・メモ
  lbl(sheet, 3, 1, '最終更新日');
  inp(sheet, 3, 2, '', 'yyyy/mm/dd');
  lbl(sheet, 4, 1, '今週のメモ');
  inp(sheet, 4, 2, '');

  // ---- 進捗サマリ ----
  addSection(sheet, 6, 3, '■ 進捗サマリ（自動集計）');
  const summary = [
    ['現在フェーズ',
      `=IFERROR(INDEX('${SHEET.ROADMAP}'!B4:B9,MATCH("進行中",'${SHEET.ROADMAP}'!E4:E9,0)),"未設定")`,
      'ロードマップ進捗シートを参照'],
    ['戦略完成度（%）',
      `=IFERROR(TEXT(COUNTIF('${SHEET.ROADMAP}'!E4:E9,"完了")/6,"0%"),"0%")`,
      '完了フェーズ数÷6'],
    ['数値確定度（%）',
      `=IFERROR(TEXT(COUNTIF('${SHEET.OPEN_ITEMS}'!F4:F14,"確定済み")/11,"0%"),"0%")`,
      '確定済み件数÷11'],
    ['未確定項目数（件）',
      `=IFERROR(COUNTIF('${SHEET.OPEN_ITEMS}'!F4:F14,"未確定")&"件","—")`,
      '未確定項目シートを参照'],
    ['月自費収益目標',
      `=IFERROR(TEXT(INDEX('${SHEET.KPI_REVERSE}'!C:C,MATCH("月次自費目標",'${SHEET.KPI_REVERSE}'!B:B,0)),"#,##0")&"円","要入力")`,
      'KPI逆算シートを参照'],
    ['必要手技回数/月',
      `=IFERROR(TEXT(INDEX('${SHEET.KPI_REVERSE}'!C:C,MATCH("必要手技回数",'${SHEET.KPI_REVERSE}'!B:B,0)),"0.0")&"回","要入力")`,
      '自費目標 ÷ 主力手技価格'],
    ['必要手技回数/日',
      `=IFERROR(TEXT(INDEX('${SHEET.KPI_REVERSE}'!C:C,MATCH("必要手技回数/日",'${SHEET.KPI_REVERSE}'!B:B,0)),"0.0")&"回","要入力")`,
      '必要手技回数 ÷ 営業日数'],
    ['保険実人数',
      `=IFERROR(TEXT(INDEX('${SHEET.KPI_REVERSE}'!C:C,MATCH("保険実人数",'${SHEET.KPI_REVERSE}'!B:B,0)),"0")&"人","要入力")`,
      '入口KPI'],
    ['月次総保険売上',
      `=IFERROR(TEXT(INDEX('${SHEET.KPI_REVERSE}'!C:C,MATCH("月次総保険売上",'${SHEET.KPI_REVERSE}'!B:B,0)),"#,##0")&"円","要入力")`,
      '窓口負担 + 保険者支払分'],
    ['慢性候補人数',
      `=IFERROR(TEXT(INDEX('${SHEET.KPI_REVERSE}'!C:C,MATCH("慢性候補人数",'${SHEET.KPI_REVERSE}'!B:B,0)),"0.0")&"人","要入力")`,
      '保険実人数 × 慢性候補率'],
    ['手技回数',
      `=IFERROR(TEXT(INDEX('${SHEET.KPI_REVERSE}'!C:C,MATCH("手技回数",'${SHEET.KPI_REVERSE}'!B:B,0)),"0.0")&"回","要入力")`,
      '月次の見込み手技回数'],
    ['見込み自費売上',
      `=IFERROR(TEXT(INDEX('${SHEET.KPI_REVERSE}'!C:C,MATCH("自費売上",'${SHEET.KPI_REVERSE}'!B:B,0)),"#,##0")&"円","要入力")`,
      '手技回数 × 主力手技価格'],
    ['ジム体験人数',
      `=IFERROR(TEXT(INDEX('${SHEET.KPI_REVERSE}'!C:C,MATCH("ジム体験人数",'${SHEET.KPI_REVERSE}'!B:B,0)),"0.0")&"人","要入力")`,
      '手技患者数 × ジム体験誘導率'],
  ];
  summary.forEach(([label, formula, note], i) => {
    const row = 7 + i;
    lbl(sheet, row, 1, label);
    calc(sheet, row, 2, formula);
    sheet.getRange(row, 3).setValue(note).setFontColor('#888888').setFontStyle('italic');
  });

  // ---- 次にやること ----
  addSection(sheet, 14, 3, '■ 次にやること Top3（高優先度・未確定 上位3件）');
  for (let i = 0; i < 3; i++) {
    lbl(sheet, 15 + i, 1, `Top${i + 1}`);
    // FILTER関数を使用（Google Sheets 新エディタで利用可能）
    // ▼ FILTER が "#NAME?" エラーになる場合の代替数式（Ctrl+Shift+Enter で配列数式として入力）:
    //   =IFERROR(INDEX('未確定項目'!B$4:B$14,
    //     SMALL(IF(('未確定項目'!D$4:D$14="高")*('未確定項目'!F$4:F$14="未確定"),
    //       ROW('未確定項目'!B$4:B$14)-ROW('未確定項目'!B$4)+1), <N>)), "（なし）")
    //   <N> には Top1=1, Top2=2, Top3=3 を入れる
    //   ※ Ctrl+Shift+Enter で確定すると { } で囲まれた配列数式になる
    calc(sheet, 15 + i, 2,
      `=IFERROR(INDEX(FILTER('${SHEET.OPEN_ITEMS}'!B4:B14,` +
      `('${SHEET.OPEN_ITEMS}'!D4:D14="高")*('${SHEET.OPEN_ITEMS}'!F4:F14="未確定")),${i + 1}),"（なし）")`
    );
  }

  // ---- 初回手順 ----
  addSection(sheet, 19, 3, '■ 最初にやること（入力手順）');
  [
    'Step 1: 「数値前提」シートを開き、固定費・保険ベースラインを入力する',
    'Step 2: 「価格設定」シートで主力手技50分の価格と将来検討メニューの扱いを確認する',
    'Step 3: 「ロードマップ進捗」シートでフェーズのステータスと進捗率を更新する',
  ].forEach((text, i) => {
    sheet.getRange(20 + i, 1, 1, 3).merge()
      .setValue(text)
      .setBackground('#F9F9F9')
      .setWrap(true);
  });
}

// ============================================================
// 2. ロードマップ進捗
// ============================================================
function setupRoadmap(ss) {
  const sheet = ss.insertSheet(SHEET.ROADMAP);
  setColWidths(sheet, [70, 140, 200, 210, 90, 65, 55, 210, 140]);
  addWarning(sheet, 9);
  addTitle(sheet, 9, 'ロードマップ進捗（Phase 1〜6）');

  // ヘッダ行
  ['フェーズ', 'フェーズ名', '目的（要約）', '完了条件', 'ステータス',
   '進捗率\n(%)', '現在地', '次フェーズ条件', '備考']
    .forEach((h, i) => hdr(sheet, 3, i + 1, h));

  const phases = [
    ['Phase1', 'コンセプト確定',
      '院のウリと主軸症状を言語化し、院内外のメッセージを統一する',
      '院長が30秒でコンセプト説明できる / 基本導線が共有されている',
      '完了', 100,
      '主方針は確定。コピーとGoogle説明文は運用タスクで継続'],
    ['Phase2', 'メニュー・KPI確定',
      '手技主軸モデルで価格表とKPIを運用可能な状態にする',
      '価格表完成 / KPI数値設定 / 院長承認',
      '進行中', 40,
      '主力手技50分の正式価格とKPI数値が未確定'],
    ['Phase3', '集患導線整備',
      '慢性腰痛・首肩こりで困っている新患が院を知り、予約できる仕組みを作る',
      'Googleビジネスプロフィール最適化完了 / 月1件以上Google新患',
      '未着手', 0, ''],
    ['Phase4', '院内運用整備',
      '来院患者を手技自費→継続導線へ段階的に引き上げる仕組みを作る',
      'トークスクリプト完成 / 記録シート運用1ヶ月',
      '未着手', 0, ''],
    ['Phase5', 'KPI計測開始',
      '毎月数字で状況を把握し、改善判断ができる体制を作る',
      '月末に手技自費回数・移行率・再来率・ジム体験誘導率が確認できる状態',
      '未着手', 0, 'Phase2〜4完了後に着手'],
    ['Phase6', '改善サイクル運用',
      'データで仮説→施策→測定のループを習慣化する',
      '月初に「今月の課題」と「打ち手」が決まっている状態',
      '未着手', 0, '将来フェーズ'],
  ];

  phases.forEach(([num, name, purpose, condition, status, progress, note], i) => {
    const row = 4 + i;
    sheet.getRange(row, 1).setValue(num).setBackground(C.HEADER).setHorizontalAlignment('center').setFontWeight('bold');
    sheet.getRange(row, 2).setValue(name).setBackground(C.HEADER).setFontWeight('bold');
    sheet.getRange(row, 3).setValue(purpose).setBackground('#F9F9F9').setWrap(true);
    sheet.getRange(row, 4).setValue(condition).setBackground('#F9F9F9').setWrap(true);

    // ステータス（入力）
    const sc = inp(sheet, row, 5, status);
    dropdown(sc, ['未着手', '進行中', '完了', '保留']);

    // 進捗率（入力）
    inp(sheet, row, 6, progress, '0"%"').setHorizontalAlignment('center');

    // 現在地フラグ（計算）
    calc(sheet, row, 7, `=IF(E${row}="進行中","★","")`)
      .setHorizontalAlignment('center')
      .setFontColor('#E06666')
      .setFontWeight('bold');

    sheet.getRange(row, 8).setValue(condition.split('/')[0].trim()).setBackground('#F9F9F9').setWrap(true).setFontColor('#888888');
    inp(sheet, row, 9, note).setWrap(true);
  });

  // 全体進捗平均
  sheet.getRange(11, 1, 1, 5).merge()
    .setValue('全体進捗平均').setBackground(C.HEADER).setFontWeight('bold');
  calc(sheet, 11, 6, '=IFERROR(AVERAGE(F4:F9),0)', '0"%"').setFontWeight('bold').setHorizontalAlignment('center');
}

// ============================================================
// 3. 保険・来院前提
// ============================================================
function setupInsurance(ss) {
  const sheet = ss.insertSheet(SHEET.INSURANCE);
  setColWidths(sheet, [220, 130, 90, 220]);
  addWarning(sheet, 4);
  addTitle(sheet, 4, '保険・来院前提（来院構造・保険前提）');

  addSection(sheet, 4, 4, '■ ブロックA: 来院構造');
  ['項目名', '値', '単位', '備考'].forEach((h, i) => hdr(sheet, 5, i + 1, h));

  const visitItems = [
    ['保険実人数（現在）', 50, '人/月', '入口患者の実人数ベース'],
    ['保険延べ来院数（現在）', 125, '回/月', '保険の延べ来院数'],
    ['保険1人あたり月来院回数', '=IFERROR(B7/B6,0)', '回/人', '保険延べ来院数 ÷ 保険実人数'],
    ['新患数（現在）', '', '人/月', '月次管理用の参考値'],
    ['慢性候補率（現在）', 0.4, '%', '腰痛・首肩こり候補の割合'],
    ['慢性候補人数（現在）', '=IFERROR(B6*B10,0)', '人/月', '保険実人数 × 慢性候補率'],
  ];
  visitItems.forEach(([name, value, unit, note], i) => {
    const row = 6 + i;
    lbl(sheet, row, 1, name);
    if (typeof value === 'string' && value.startsWith('=')) {
      calc(sheet, row, 2, value, unit === '%' ? '0%' : unit.includes('回') ? '0.0' : '0');
    } else {
      const valueCell = name.includes('慢性候補率')
        ? tempInp(sheet, row, 2, value, unit === '%' ? '0%' : '0')
        : inp(sheet, row, 2, value, unit === '%' ? '0%' : '0');
      if (name === '慢性候補率（現在）') {
        setMemo(valueCell, '慢性腰痛・首肩こり候補の割合。方針変更時に見直します。');
      }
    }
    sheet.getRange(row, 3).setValue(unit).setBackground(C.FIXED).setHorizontalAlignment('center');
    sheet.getRange(row, 4).setValue(note).setBackground(C.FIXED).setFontColor('#888888');
  });

  addSection(sheet, 13, 4, '■ ブロックB: 保険単価前提');
  ['項目名', '値', '単位', '備考'].forEach((h, i) => hdr(sheet, 14, i + 1, h));

  const insuranceItems = [
    ['窓口単価', '', '円/回', '患者が窓口で支払う平均額'],
    ['総保険売上単価', '', '円/回', '窓口負担 + 保険者支払分の1来院あたり合計'],
    ['月次窓口売上（参考）', '=IF(B15="","",IFERROR(B7*B15,0))', '円/月', '窓口単価 × 保険延べ来院数'],
    ['月次総保険売上（試算）', '=IF(B16="","",IFERROR(B7*B16,0))', '円/月', '総保険売上単価 × 保険延べ来院数'],
  ];
  insuranceItems.forEach(([name, value, unit, note], i) => {
    const row = 15 + i;
    lbl(sheet, row, 1, name);
    if (typeof value === 'string' && value.startsWith('=')) {
      calc(sheet, row, 2, value, unit === '円/回' || unit === '円/月' ? '#,##0' : '0');
    } else {
      const valueCell = inp(sheet, row, 2, value, '#,##0');
      if (name === '総保険売上単価') {
        setMemo(valueCell, '窓口負担と保険者支払分を合算した1来院あたりの単価を入力します。');
      }
    }
    sheet.getRange(row, 3).setValue(unit).setBackground(C.FIXED).setHorizontalAlignment('center');
    sheet.getRange(row, 4).setValue(note).setBackground(C.FIXED).setFontColor('#888888');
  });
}

// ============================================================
// 4. 数値前提
// ============================================================
function setupNumeric(ss) {
  const sheet = ss.insertSheet(SHEET.NUMERIC);
  setColWidths(sheet, [220, 130, 90, 210]);
  addWarning(sheet, 4);
  addTitle(sheet, 4, '数値前提（売上・利益前提）');

  // ---- ブロックA: 固定費 ----
  addSection(sheet, 4, 4, '■ ブロックA: 月次固定費（すべて入力してください）');
  ['項目名', '金額（円/月）', '単位', '備考'].forEach((h, i) => hdr(sheet, 5, i + 1, h));

  const fixedItems = [
    ['家賃', '', '円/月', ''],
    ['水道光熱費', '', '円/月', ''],
    ['通信費', '', '円/月', ''],
    ['システム費', '', '円/月', 'GAS・クラウドツール等'],
    ['広告費', '', '円/月', 'Google広告・SNS等'],
    ['消耗品費', '', '円/月', ''],
    ['外注費', '', '円/月', 'クリーニング・業務委託等'],
    ['オーナー最低人件費', '', '円/月', '院長の生活費ベース'],
    ['機器リース/返済', '', '円/月', '治療機器・設備の月次コスト'],
  ];
  fixedItems.forEach(([name, , unit, note], i) => {
    const row = 6 + i;
    lbl(sheet, row, 1, name);
    inp(sheet, row, 2, '', '#,##0');
    sheet.getRange(row, 3).setValue(unit).setBackground(C.FIXED).setHorizontalAlignment('center');
    sheet.getRange(row, 4).setValue(note).setBackground(C.FIXED).setFontColor('#888888');
  });

  // スタッフ人件費
  lbl(sheet, 15, 1, 'スタッフ人件費（いる場合）');
  inp(sheet, 15, 2, '', '#,##0');
  sheet.getRange(15, 3).setValue('円/月').setBackground(C.FIXED).setHorizontalAlignment('center');
  sheet.getRange(15, 4).setValue('スタッフがいない場合は 0').setBackground(C.FIXED).setFontColor('#888888');

  // 合計行
  lbl(sheet, 16, 1, '現金支出固定費合計');
  calc(sheet, 16, 2, '=IFERROR(SUM(B6:B14),"要入力")', '#,##0').setFontWeight('bold');
  lbl(sheet, 17, 1, '経営固定費合計（スタッフ含む）');
  calc(sheet, 17, 2, '=IFERROR(SUM(B6:B15),"要入力")', '#,##0').setFontWeight('bold');

  // ---- ブロックB: ベースライン ----
  addSection(sheet, 19, 4, '■ ブロックB: 売上ベースライン（保険・来院前提を参照）');
  ['項目名', '現状値', '単位', '備考'].forEach((h, i) => hdr(sheet, 20, i + 1, h));

  const baseItems = [
    ['月次総保険売上（現在）', `=IFERROR('${SHEET.INSURANCE}'!B18,"")`, '円/月', '保険・来院前提の試算値を参照'],
    ['月次窓口売上（参考）', `=IFERROR('${SHEET.INSURANCE}'!B17,"")`, '円/月', '保険・来院前提の参考値を参照'],
    ['保険延べ来院数（現在）', `=IFERROR('${SHEET.INSURANCE}'!B7,"")`, '回/月', '総保険売上単価の母数'],
    ['保険実人数（現在）', `=IFERROR('${SHEET.INSURANCE}'!B6,"")`, '人/月', '保険・来院前提を参照'],
    ['月次営業日数', '25', '日/月', ''],
  ];
  baseItems.forEach(([name, val, unit, note], i) => {
    const row = 21 + i;
    lbl(sheet, row, 1, name);
    if (typeof val === 'string' && val.startsWith('=')) {
      calc(sheet, row, 2, val, i < 2 ? '#,##0' : '0');
    } else {
      inp(sheet, row, 2, val, i < 2 ? '#,##0' : '0');
    }
    sheet.getRange(row, 3).setValue(unit).setBackground(C.FIXED).setHorizontalAlignment('center');
    sheet.getRange(row, 4).setValue(note).setBackground(C.FIXED).setFontColor('#888888');
  });

  // 自動計算
  const calcs = [
    ['保険1日平均延べ来院数',            '=IFERROR(B23/B25,"要入力")', '回/日', '保険延べ来院数 ÷ 営業日数'],
    ['総保険売上単価',                  '=IFERROR(B21/B23,"要入力")', '円/回', '窓口負担 + 保険者支払分の1来院あたり合計'],
    ['窓口単価',                        '=IF(B22="","",IFERROR(B22/B23,"要入力"))', '円/回', '患者が窓口で支払う平均額'],
    ['自費+20万円後の月次総収入見込み', '=IFERROR(B21+200000,"要入力")', '円/月', '月次総保険売上+200,000'],
    ['固定費カバー率',                  '=IFERROR(TEXT(B30/B17,"0.0%"),"要入力")', '', '100%以上で固定費をカバーできる'],
  ];
  calcs.forEach(([name, formula, unit, note], i) => {
    const row = 27 + i;
    lbl(sheet, row, 1, name);
    calc(sheet, row, 2, formula).setFontWeight('bold');
    sheet.getRange(row, 3).setValue(unit).setBackground(C.FIXED).setHorizontalAlignment('center');
    sheet.getRange(row, 4).setValue(note).setBackground(C.FIXED).setFontColor('#888888');
  });
}

// ============================================================
// 4. 価格設定（メニューマスタ）
// ============================================================
function setupPricing(ss) {
  const sheet = ss.insertSheet(SHEET.PRICING);
  // 14列: 表示順/大区分/小区分/メニュー名/内容/時間/一般料金/ジム会員料金/保険適用/回数単位/主力手技フラグ/KPI集計/確定状況/備考
  setColWidths(sheet, [40, 160, 90, 160, 200, 75, 90, 105, 65, 70, 110, 75, 85, 200]);
  addWarning(sheet, 14);
  addTitle(sheet, 14, 'メニューマスタ（価格設定）');

  // ヘッダ行（行3）
  ['表示順', '大区分', '小区分', 'メニュー名', '内容', '時間',
   '一般料金\n（円）', 'ジム会員\n料金（円）', '保険\n適用', '回数/単位',
   '主力手技\nフラグ', 'KPI集計\n対象', '確定状況', '備考']
    .forEach((h, i) => hdr(sheet, 3, i + 1, h));
  sheet.setRowHeight(3, 45);

  // 区分ごとの背景色
  const catColors = {
    '保険施術（急性期対応）':   '#D9EAD3',
    '保険施術オプション':       '#EAD1DC',
    '将来検討メニュー':         '#FCE5CD',
    '慢性専門施術（主力）':     '#CFE2F3',
    '運動再教育（再発防止）':   '#E6D0DE',
    '併設ジム':                 '#FFF2CC',
  };

  // メニューデータ
  // [表示順, 大区分, 小区分, メニュー名, 内容, 時間, 一般料金(null=保険適用), ジム会員料金(null=なし),
  //  保険適用, 回数/単位, 主力手技フラグ, KPI集計対象, 確定状況, 備考]
  const menus = [
    [1,  '保険施術（急性期対応）',  '', '保険施術',
     '検査＋電気治療（約15分）＋手技（約5分）', '約20分',
     null,  null,  '○', '1回',   false, '×', '確定', '急な痛みや日常の不調に対応します。'],
    [2,  '保険施術オプション',      '', '手技延長',
     '10分延長', '10分',
     1100,   935,  '×', '1回',   false, '○', '確定', ''],
    [3,  '保険施術オプション',      '', '筋膜リリース（マッサージガン）',
     '5分追加', '5分',
     880,    748,  '×', '1回',   false, '○', '確定', ''],
    [4,  '保険施術オプション',      '', '温熱追加',
     '5分追加', '5分',
     550,  467,  '×', '1回',   false, '○', '確定', ''],
    [5,  '将来検討メニュー',        '', '深部コンディショニング',
     '深部電気＋軽調整', '約30分',
     4400,  3740,  '×', '1回',   false, '×', '将来検討', '機械中心の自費は当面主力にしない。'],
    [6,  '将来検討メニュー',        '', '電気治療1回',
     '干渉波電気治療', '約15分',
     1200,  1020,  '×', '1回',   false, '×', '将来検討', '機械は保険治療の補助用を優先。'],
    [7,  '将来検討メニュー',        '', '電気治療午前限定通い放題',
     '干渉波電気治療', '約15分',
     5500,  4675,  '×', '月額',  false, '×', '将来検討', '機械中心メニューは将来検討。'],
    [8,  '将来検討メニュー',        '', '慢性疼痛改善 8回プログラム',
     '根本改善＋再発予防設計', '45分×8回',
     58000, 49300, '×', '8回',   false, '×', '将来検討', '主力前提は外し、将来の継続商品候補として保持。'],
    [9,  '慢性専門施術（主力）',     '', '慢性ケア手技50分',
     '手技中心で筋緊張・可動域・姿勢バランスを整える', '約50分',
     5000,  4250,  '×', '1回',   true, '○', '仮', '慢性腰痛・首肩こりの方へ最初に提案する主力メニュー。'],
    [10, '運動再教育（再発防止）',  '', 'パーソナルトレーニング',
     '痛まない身体の使い方習得', '約60分',
     8800,  7480,  '×', '1回',   false, '○', '確定', ''],
    [11, '運動再教育（再発防止）',  '', '4回集中コース',
     'フォーム再教育・卒業設計', '60分×4回',
     35200, 29920, '×', '4回',   false, '○', '確定', ''],
    [12, '併設ジム',               '', '月会員',
     '併設ジム利用', '月額',
     7480,  null,  '×', '月額',  false, '○', '仮', 'ジム会員価格は再確認予定。'],
  ];

  menus.forEach((m, i) => {
    const row = 4 + i;
    const [order, cat, subcat, name, content, time,
           price, memberPrice, insurance, unit, mainFlag, kpi, status, note] = m;
    const catColor = catColors[cat] || C.FIXED;

    // 表示順（1列）
    sheet.getRange(row, 1).setValue(order)
      .setBackground(catColor).setHorizontalAlignment('center').setFontWeight('bold');
    // 大区分（2列）
    sheet.getRange(row, 2).setValue(cat)
      .setBackground(catColor).setFontWeight('bold').setWrap(true);
    // 小区分（3列）
    sheet.getRange(row, 3).setValue(subcat).setBackground(C.FIXED);
    // メニュー名（4列）
    sheet.getRange(row, 4).setValue(name)
      .setBackground(C.HEADER).setFontWeight('bold');
    // 内容（5列）
    sheet.getRange(row, 5).setValue(content)
      .setBackground(C.FIXED).setWrap(true);
    // 時間（6列）
    sheet.getRange(row, 6).setValue(time)
      .setBackground(C.FIXED).setHorizontalAlignment('center');
    // 一般料金（7列）: null = 保険適用
    if (price !== null) {
      const priceCell = inp(sheet, row, 7, price, '#,##0').setHorizontalAlignment('right');
      if (name === '慢性ケア手技50分') {
        setMemo(priceCell, '主力手技価格です。日常運用ではこの価格を更新してください。');
      }
    } else {
      sheet.getRange(row, 7).setValue('保険適用')
        .setBackground(C.CONFIRMED).setHorizontalAlignment('center')
        .setFontColor('#006600').setFontStyle('italic');
    }
    // ジム会員料金（8列）: null = 対象外
    if (memberPrice !== null) {
      inp(sheet, row, 8, memberPrice, '#,##0').setHorizontalAlignment('right');
    } else {
      sheet.getRange(row, 8).setValue('—')
        .setBackground(C.FIXED).setHorizontalAlignment('center').setFontColor('#888888');
    }
    // 保険適用（9列）
    sheet.getRange(row, 9).setValue(insurance)
      .setBackground(C.FIXED).setHorizontalAlignment('center')
      .setFontColor(insurance === '○' ? '#006600' : '#888888').setFontWeight('bold');
    // 回数/単位（10列）
    sheet.getRange(row, 10).setValue(unit)
      .setBackground(C.FIXED).setHorizontalAlignment('center');
    // 主力手技フラグ（11列）
    const mainFlagCell = sheet.getRange(row, 11);
    mainFlagCell.insertCheckboxes();
    mainFlagCell.setValue(mainFlag)
      .setBackground(C.INPUT).setHorizontalAlignment('center');
    if (name === '慢性ケア手技50分') {
      setMemo(mainFlagCell, '主力手技は 1 行だけ TRUE にします。');
    }
    // KPI集計対象（12列）
    const kpiCell = inp(sheet, row, 12, kpi);
    kpiCell.setHorizontalAlignment('center');
    dropdown(kpiCell, ['○', '×']);
    // 確定状況（13列）
    const statusCell = inp(sheet, row, 13, status);
    statusCell.setHorizontalAlignment('center');
    dropdown(statusCell, ['確定', '仮', '未確定', '将来検討']);
    // 備考（14列）
    inp(sheet, row, 14, note).setWrap(true);
  });

  // 条件付き書式: 確定状況（13列目）
  const statusRange = sheet.getRange(4, 13, 12, 1);
  const rules = [];
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('未確定').setBackground(C.UNCONFIRMED).setFontColor('#CC0000')
    .setRanges([statusRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('確定').setBackground(C.CONFIRMED).setFontColor('#006600')
    .setRanges([statusRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('仮').setBackground('#FFF3CD').setFontColor('#7F6000')
    .setRanges([statusRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('将来検討').setBackground('#FCE5CD').setFontColor('#7F6000')
    .setRanges([statusRange]).build());
  // 条件付き書式: KPI集計対象（12列目）
  const kpiRange = sheet.getRange(4, 12, 12, 1);
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('○').setBackground(C.CONFIRMED).setFontColor('#006600')
    .setRanges([kpiRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('×').setBackground(C.HEADER).setFontColor('#888888')
    .setRanges([kpiRange]).build());
  const mainFlagWarningRange = sheet.getRange(18, 2, 1, 13);
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('OK').setBackground(C.CONFIRMED).setFontColor('#006600')
    .setRanges([mainFlagWarningRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$B$18<>"OK"').setBackground(C.UNCONFIRMED).setFontColor('#CC0000')
    .setRanges([mainFlagWarningRange]).build());
  sheet.setConditionalFormatRules(rules);

  // 集計行（行17）
  lbl(sheet, 17, 1, '集計');
  lbl(sheet, 17, 2, 'KPI集計対象数');
  calc(sheet, 17, 3, '=COUNTIF(L4:L15,"○")&"件 / 12件"');
  lbl(sheet, 17, 7, '主力手技フラグ件数');
  calc(sheet, 17, 8, '=COUNTIF(K4:K15,TRUE)&"件"');
  lbl(sheet, 17, 10, '未確定件数');
  calc(sheet, 17, 11,
    '=COUNTIF(M4:M15,"未確定")&"件が未確定 / "&COUNTIF(M4:M15,"仮")&"件が仮値"');
  lbl(sheet, 18, 1, '警告');
  sheet.getRange(18, 2, 1, 13).merge();
  calc(sheet, 18, 2,
    '=IF(COUNTIF(K4:K15,TRUE)=1,"OK","警告: 主力手技フラグを1行だけTRUEにしてください")');
  sheet.getRange(18, 2).setWrap(true);
}

// ============================================================
// 5. KPI逆算
// ============================================================
function setupKPIReverse(ss) {
  const sheet = ss.insertSheet(SHEET.KPI_REVERSE);
  setColWidths(sheet, [90, 220, 120, 90, 130, 180, 240]);
  sheet.setFrozenRows(2);

  const K = {
    INPUT:  C.INPUT,
    CALC:   C.CALC,
    TEMP:   C.TEMP,
    FUTURE: C.FIXED,
    LABEL:  C.FIXED,
    HEAD:   '#3C78D8',
    TEXT:   '#444444',
  };

  sheet.getRange('A1').setValue('KPI逆算')
    .setBackground(K.HEAD).setFontColor('#FFFFFF').setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.getRange('B1:G1').merge()
    .setValue('手技主軸モデル（戦略設計・必要件数逆算・ボトルネック確認）')
    .setBackground(K.HEAD).setFontColor('#FFFFFF').setFontWeight('bold');

  sheet.getRange('A2').setValue('色分け')
    .setBackground(K.LABEL).setFontWeight('bold');
  sheet.getRange('B2:G2').merge()
    .setValue('青=手入力 / 緑=自動計算 / 黄=仮値 / 灰=将来KPI')
    .setBackground(K.LABEL).setFontColor(K.TEXT);

  function setKpiRow(row, section, label, value, unit, mode, source, note, style, fmt) {
    sheet.getRange(row, 1).setValue(section).setBackground(K.LABEL).setFontWeight('bold');
    sheet.getRange(row, 2).setValue(label).setBackground(K.LABEL).setFontWeight('bold');

    const cell = sheet.getRange(row, 3);
    if (typeof value === 'string' && value.startsWith('=')) {
      cell.setFormula(value);
    } else if (value !== '') {
      cell.setValue(value);
    } else {
      cell.clearContent();
    }
    if (fmt) cell.setNumberFormat(fmt);
    if (typeof value === 'string' && value.startsWith('=')) {
      const p = cell.protect();
      p.setWarningOnly(true);
      p.setDescription('自動計算セル（編集注意）');
    }

    const bg =
      style === 'calc' ? K.CALC :
      style === 'future' ? K.FUTURE :
      style === 'temp' ? K.TEMP :
      K.INPUT;
    cell.setBackground(bg);
    const memos = {
      '主力手技価格': '価格設定シートの主力手技フラグ行から参照します。日常更新は価格設定側を触ります。',
      '慢性患者移行率': '慢性候補から手技自費へ移行した割合。仮値の間は黄色で管理します。',
      '手技患者1人あたり月平均来院回数': '売上逆算に使う主指標です。再来率よりもこちらを優先して更新します。',
      'ジム体験誘導率': '手技患者からジム体験へ案内できた割合です。',
    };
    if (memos[label]) {
      setMemo(cell, memos[label]);
    }

    sheet.getRange(row, 4).setValue(unit).setBackground(K.LABEL).setHorizontalAlignment('center');
    sheet.getRange(row, 5).setValue(mode).setBackground(K.LABEL);
    sheet.getRange(row, 6).setValue(source).setBackground(K.LABEL);
    sheet.getRange(row, 7).setValue(note).setBackground(K.LABEL).setFontColor(K.TEXT);
  }

  const rows = [
    [4,  '基本前提', '月次自費目標', 200000, '円', '入力', '固定', '月次自費+20万円目標', 'input', '#,##0'],
    [5,  '基本前提', '主力手技価格', `=IF(COUNTIF('${SHEET.PRICING}'!K4:K15,TRUE)=1,INDEX(FILTER('${SHEET.PRICING}'!G4:G15,'${SHEET.PRICING}'!K4:K15=TRUE),1),5000)`, '円', '自動', '価格設定フラグ参照', '主力手技フラグが1件のとき採用 / それ以外は fallback 5,000', 'temp', '#,##0'],
    [6,  '基本前提', '主力手技フラグ件数', `=COUNTIF('${SHEET.PRICING}'!K4:K15,TRUE)`, '件', '自動', '価格設定フラグ参照', 'TRUE は 1 行のみ想定', 'calc', '0'],
    [7,  '基本前提', '主力手技価格警告', '=IF(C6=1,"OK","警告: 価格設定シートの主力手技フラグを1行だけTRUEにしてください")', '状態', '自動', '=COUNTIF(価格設定!K4:K15,TRUE)', '0件または複数件なら見直し', 'calc', '@'],
    [8,  '基本前提', '営業日数', 25, '日', '入力', '固定', '月の営業日数', 'input', '0'],
    [9,  '基本前提', 'ジム会員価格', `=IFERROR(INDEX('${SHEET.PRICING}'!G:G,MATCH("月会員",'${SHEET.PRICING}'!D:D,0)),0)`, '円', '自動', '価格設定参照', '未確定時は 0', 'temp', '#,##0'],
    [10, '基本前提', '更新日', '=TODAY()', '日付', '自動', '=TODAY()', '最終更新確認', 'calc', 'yyyy/mm/dd'],

    [12, '保険入口', '保険実人数', `=IFERROR('${SHEET.INSURANCE}'!B6,0)`, '人/月', '自動', '保険・来院前提参照', '入口KPI', 'calc', '0'],
    [13, '保険入口', '保険延べ来院数', `=IFERROR('${SHEET.INSURANCE}'!B7,0)`, '回/月', '自動', '保険・来院前提参照', '総保険売上単価の母数', 'calc', '0'],
    [14, '保険入口', '月次総保険売上', `=IFERROR('${SHEET.NUMERIC}'!B21,0)`, '円/月', '自動', '数値前提参照', '窓口負担 + 保険者支払分の合計', 'calc', '#,##0'],
    [15, '保険入口', '保険1人あたり月来院回数', '=IFERROR(C13/C12,0)', '回/人', '自動', '=C13/C12', '実人数ベース', 'calc', '0.0'],
    [16, '保険入口', '保険1回来院あたり総売上', '=IFERROR(C14/C13,0)', '円/回', '自動', '=C14/C13', '総保険売上単価', 'calc', '#,##0'],
    [17, '保険入口', '慢性候補率', `=IFERROR('${SHEET.INSURANCE}'!B10,0)`, '%', '自動', '保険・来院前提参照', '腰痛・首肩こり候補比率', 'calc', '0%'],
    [18, '保険入口', '慢性候補人数', '=IFERROR(C12*C17,0)', '人/月', '自動', '=C12*C17', '自費化候補母数', 'calc', '0.0'],

    [20, '自費化', '慢性患者移行率', 0.2, '%', '入力', '仮値', '慢性候補→手技自費', 'temp', '0%'],
    [21, '自費化', '手技患者数', '=IFERROR(C18*C20,0)', '人/月', '自動', '=C18*C20', '手技に移行した人数', 'calc', '0.0'],
    [22, '自費化', '手技自費再来率', 0.5, '%', '入力', '監視指標', '来院回数主指標の補助', 'temp', '0%'],
    [23, '自費化', '手技患者1人あたり月平均来院回数', 2.0, '回/人', '入力', '主指標', '売上逆算に使う計算用主指標', 'temp', '0.0'],
    [24, '自費化', '手技回数', '=IFERROR(C21*C23,0)', '回/月', '自動', '=C21*C23', '売上の基本単位', 'calc', '0.0'],
    [25, '自費化', '自費売上', '=IFERROR(C24*C5,0)', '円/月', '自動', '=C24*C5', '見込み自費売上/月', 'calc', '#,##0'],
    [26, '自費化', '必要手技回数', '=IFERROR(ROUNDUP(C4/C5,0),0)', '回/月', '自動', '=ROUNDUP(C4/C5,0)', '目標達成に必要', 'calc', '0'],
    [27, '自費化', '必要手技回数/日', '=IFERROR(C26/C8,0)', '回/日', '自動', '=C26/C8', '日次感覚で確認', 'calc', '0.0'],
    [28, '自費化', '手技売上達成率', '=IFERROR(C25/C4,0)', '%', '自動', '=C25/C4', '目標比', 'calc', '0%'],

    [30, 'ジム誘導', 'ジム体験誘導率', 0.1, '%', '入力', '仮値', '手技患者→ジム体験', 'temp', '0%'],
    [31, 'ジム誘導', 'ジム体験人数', '=IFERROR(C21*C30,0)', '人/月', '自動', '=C21*C30', '初期KPI', 'calc', '0.0'],
    [32, 'ジム誘導', '体験→入会率', 0.3, '%', '入力', '将来KPI', 'まだ仮値で可', 'future', '0%'],
    [33, 'ジム誘導', '新規入会数', '=IFERROR(C31*C32,0)', '人/月', '自動', '=C31*C32', '将来KPI', 'future', '0.0'],
    [34, 'ジム誘導', 'ジム売上', '=IFERROR(C33*C9,0)', '円/月', '自動', '=C33*C9', '会員価格確定後に使用', 'future', '#,##0'],

    [36, '逆算', '必要手技患者数', '=IFERROR(ROUNDUP(C26/C23,0),0)', '人/月', '自動', '=C26/C23', '必要回数から逆算', 'calc', '0'],
    [37, '逆算', '必要慢性候補人数', '=IFERROR(ROUNDUP(C36/C20,0),0)', '人/月', '自動', '=C36/C20', '移行率込み逆算', 'calc', '0'],
    [38, '逆算', '必要保険実人数', '=IFERROR(ROUNDUP(C37/C17,0),0)', '人/月', '自動', '=C37/C17', '入口母数の必要量', 'calc', '0'],
    [39, '逆算', '保険実人数ギャップ', '=IFERROR(C12-C38,0)', '人/月', '自動', '=C12-C38', 'マイナスなら入口不足', 'calc', '0'],
    [40, '逆算', '慢性候補人数ギャップ', '=IFERROR(C18-C37,0)', '人/月', '自動', '=C18-C37', 'マイナスなら候補不足', 'calc', '0'],

    [42, '将来KPI', '月次退会率', 0.05, '%', '入力', '仮値', 'ジム運用安定後に重視', 'future', '0%'],
    [43, '将来KPI', '6ヶ月後会員数', '=IFERROR(IF(C42=0,C33*6,C33*((1-(1-C42)^6)/C42)),0)', '人', '将来', '別ロジック', '退会率込み概算', 'future', '0.0'],
    [44, '将来KPI', '6ヶ月後ジム月次収益', '=IFERROR(C43*C9,0)', '円', '将来', '別ロジック', '後段で拡張', 'future', '#,##0'],
  ];

  rows.forEach((args) => setKpiRow(...args));

  const gapCells = [sheet.getRange('C39'), sheet.getRange('C40')];
  const gapRules = sheet.getConditionalFormatRules();
  const warningCell = sheet.getRange('C7');
  gapRules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('OK').setBackground(C.CONFIRMED).setFontColor('#006600')
    .setRanges([warningCell]).build());
  gapRules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=$C$7<>"OK"').setBackground(C.UNCONFIRMED).setFontColor('#CC0000')
    .setRanges([warningCell]).build());
  gapRules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberLessThan(0).setBackground(C.UNCONFIRMED).setFontColor('#CC0000')
    .setRanges(gapCells).build());
  gapRules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberGreaterThanOrEqualTo(0).setBackground(C.CONFIRMED).setFontColor('#006600')
    .setRanges(gapCells).build());
  sheet.setConditionalFormatRules(gapRules);
}

// ============================================================
// 6. KPI目標
// ============================================================
function setupKPI(ss) {
  const sheet = ss.insertSheet(SHEET.KPI);
  setColWidths(sheet, [220, 90, 120, 120, 120, 100, 220]);
  addWarning(sheet, 7);
  addTitle(sheet, 7, 'KPI目標（月次目標と実績比較）');

  ['KPI名', '単位', '目標値', '実績値', '差異', '達成率', 'メモ']
    .forEach((h, i) => hdr(sheet, 3, i + 1, h));

  const rows = [
    ['月間売上', '円/月', '=IFERROR(C5+C6,0)', '=IFERROR(D5+D6,0)', '総売上の着地確認', '#,##0'],
    ['月次総保険売上', '円/月', `=IFERROR('${SHEET.NUMERIC}'!B21,0)`, '', '窓口 + 保険者の合計', '#,##0'],
    ['自費売上', '円/月', `=IFERROR(INDEX('${SHEET.KPI_REVERSE}'!C:C,MATCH("月次自費目標",'${SHEET.KPI_REVERSE}'!B:B,0)),0)`, '', '手技中心の自費売上', '#,##0'],
    ['自費売上比率', '%', '=IFERROR(C6/C4,0)', '=IFERROR(D6/D4,0)', '自費売上 ÷ 月間売上', '0.0%'],
    ['新患数', '人/月', '', '', '月次の新患人数を入力', '0'],
    ['延べ来院数', '回/月', `=IFERROR('${SHEET.INSURANCE}'!B7,0)`, '', '保険・来院前提の延べ来院数', '0'],
    ['保険平均単価', '円/回', '=IFERROR(C5/C9,0)', '=IFERROR(D5/D9,0)', '月次総保険売上 ÷ 延べ来院数', '#,##0'],
    ['自費平均単価', '円/回', `=IFERROR(INDEX('${SHEET.KPI_REVERSE}'!C:C,MATCH("主力手技価格",'${SHEET.KPI_REVERSE}'!B:B,0)),0)`, '', '主力手技価格を基準に管理', '#,##0'],
  ];

  rows.forEach(([name, unit, target, actual, note, fmt], i) => {
    const row = 4 + i;
    lbl(sheet, row, 1, name);
    sheet.getRange(row, 2).setValue(unit).setBackground(C.FIXED).setHorizontalAlignment('center');
    calc(sheet, row, 3, target, fmt);
    if (typeof actual === 'string' && actual.startsWith('=')) {
      calc(sheet, row, 4, actual, fmt);
    } else {
      const actualCell = inp(sheet, row, 4, actual, fmt);
      const actualMemos = {
        '月次総保険売上': '当月の総保険収入を入力します。窓口負担と保険者支払分の合計です。',
        '自費売上': '当月の手技中心の自費売上を入力します。',
        '新患数': '当月の新患実人数を入力します。',
        '延べ来院数': '当月の延べ来院数を入力します。',
        '自費平均単価': '当面は手入力です。将来的に 自費売上 ÷ 自費件数 へ自動化予定です。',
      };
      if (actualMemos[name]) {
        setMemo(actualCell, actualMemos[name]);
      }
    }
    calc(sheet, row, 5, `=IF(OR(C${row}="",D${row}=""),"",D${row}-C${row})`, fmt);
    calc(sheet, row, 6, `=IF(OR(C${row}="",C${row}=0,D${row}=""),"",D${row}/C${row})`, '0.0%');
    sheet.getRange(row, 7).setValue(note).setBackground(C.FIXED).setFontColor('#666666');
  });

  sheet.getRange('A13:G13').merge()
    .setValue('定義: 月次総保険売上 = 月の総保険収入（窓口 + 保険者） / 保険平均単価 = 月次総保険売上 ÷ 延べ来院数 / 自費平均単価 = 主力手技価格を基準に管理')
    .setBackground(C.FIXED).setFontColor('#666666').setWrap(true);
}

// ============================================================
// 7. KPI実績履歴
// ============================================================
function setupKPIHistory(ss) {
  const sheet = ss.insertSheet(SHEET.KPI_HISTORY);
  setColWidths(sheet, [110, 120, 120, 140, 140, 120, 120, 130, 130, 100, 100, 110, 110, 120, 120, 120, 120, 220, 110]);
  addWarning(sheet, 19);
  addTitle(sheet, 19, 'KPI実績履歴（月次保存用）');
  sheet.setFrozenRows(4);

  sheet.getRange('A3:S3').merge()
    .setValue('1か月 = 1行で保存します。月末または翌月初に KPI目標 の目標値 / 実績値を値貼り付けで転記する前提です。')
    .setBackground(C.FIXED)
    .setFontColor('#666666')
    .setWrap(true);

  [
    '対象年月',
    '月間売上_目標',
    '月間売上_実績',
    '月次総保険売上_目標',
    '月次総保険売上_実績',
    '自費売上_目標',
    '自費売上_実績',
    '自費売上比率_目標',
    '自費売上比率_実績',
    '新患数_目標',
    '新患数_実績',
    '延べ来院数_目標',
    '延べ来院数_実績',
    '保険平均単価_目標',
    '保険平均単価_実績',
    '自費平均単価_目標',
    '自費平均単価_実績',
    '備考',
    '記録日',
  ].forEach((h, i) => hdr(sheet, 4, i + 1, h));

  sheet.getRange('A5:A1000').setNumberFormat('@');
  sheet.getRange('B5:G1000').setNumberFormat('#,##0');
  sheet.getRange('H5:I1000').setNumberFormat('0.0%');
  sheet.getRange('J5:M1000').setNumberFormat('0');
  sheet.getRange('N5:Q1000').setNumberFormat('#,##0');
  sheet.getRange('S5:S1000').setNumberFormat('yyyy/mm/dd');
}

// ============================================================
// 8. KPI逆算履歴
// ============================================================
function setupKPIReverseHistory(ss) {
  const sheet = ss.insertSheet(SHEET.KPI_REVERSE_HISTORY);
  setColWidths(sheet, [110, 120, 220, 120, 120, 110, 130, 140, 110, 120, 170, 130, 120, 220]);
  addWarning(sheet, 14);
  addTitle(sheet, 14, 'KPI逆算履歴（前提変更履歴用）');
  sheet.setFrozenRows(4);

  sheet.getRange('A3:N3').merge()
    .setValue('KPI逆算 は常に最新設計です。方針転換や前提変更があったときだけ 1 行追記し、節目比較に使います。')
    .setBackground(C.FIXED)
    .setFontColor('#666666')
    .setWrap(true);

  [
    '変更日',
    '版名',
    '変更理由',
    '月次自費目標',
    '主力手技価格',
    '保険実人数前提',
    '保険延べ来院数前提',
    '月次総保険売上前提',
    '慢性候補率',
    '慢性患者移行率',
    '手技患者1人あたり月平均来院回数',
    '手技自費再来率',
    'ジム体験誘導率',
    'メモ',
  ].forEach((h, i) => hdr(sheet, 4, i + 1, h));

  sheet.getRange('A5:A1000').setNumberFormat('yyyy/mm/dd');
  sheet.getRange('D5:H1000').setNumberFormat('#,##0');
  sheet.getRange('I5:J1000').setNumberFormat('0.0%');
  sheet.getRange('K5:K1000').setNumberFormat('0.0');
  sheet.getRange('L5:M1000').setNumberFormat('0.0%');
}

// ============================================================
// 9. 未確定項目
// ============================================================
function setupOpenItems(ss) {
  const sheet = ss.insertSheet(SHEET.OPEN_ITEMS);
  setColWidths(sheet, [40, 200, 80, 60, 200, 90, 140, 100, 150, 180]);
  addWarning(sheet, 10);
  addTitle(sheet, 10, '未確定項目一覧（NEXT_ACTIONS.md 対応シート）');

  ['No.', '項目名', 'カテゴリ', '優先度', 'なぜ必要か', '決定状況',
   '確定値', 'いつ決めるか', '関連ファイル', '備考']
    .forEach((h, i) => hdr(sheet, 3, i + 1, h));

  const items = [
    [1, '主力手技価格', '価格', '高',
     '月+20万円の逆算基準になるため',
     '未確定', '5,500円', '', 'pricing.md', '基準仮説=案C / 到達目標=案A'],
    [2, '慢性患者移行率', 'KPI', '高',
     '初回手技自費件数を逆算するため',
     '未確定', '50%', '', 'kpi.md', '差額7,500円は微増で補完候補あり'],
    [3, '月平均来院回数', 'KPI', '高',
     '売上逆算に使う主指標',
     '未確定', '3.5回', '', 'kpi.md', '案Aの到達目標は4.0回'],
    [4, '手技自費再来率', 'KPI', '中',
     '月平均来院回数の背景指標として監視するため',
     '未確定', '', '', 'kpi.md', ''],
    [5, 'ジム体験誘導率', 'KPI', '中',
     '手技から継続導線へつなげる精度を見るため',
     '未確定', '', '', 'kpi.md', ''],
    [6, 'ジム会員費（スタンダード月額）', '価格', '中',
     '継続商品としては重要だが初期主力ではない',
     '未確定', '', '', 'pricing.md', ''],
    [7, 'ジム会員費（プレミアム月額）', '価格', '中',
     '継続商品としては重要だが初期主力ではない',
     '未確定', '', '', 'pricing.md', ''],
    [8, '固定費の実数値', '財務', '高',
     '損益感覚を判断するための基礎データ',
     '未確定', '', '', 'cost-structure.md', '「数値前提」シートに入力'],
    [9, '月次保険売上・患者数ベースライン', '財務', '高',
     '現在地が分からないと+20万円の難易度が見えない',
     '未確定', '', '', 'profit-simulation.md', '「数値前提」シートに入力'],
  ];

  items.forEach((item, i) => {
    const row = 4 + i;
    sheet.getRange(row, 1).setValue(item[0]).setBackground(C.HEADER).setHorizontalAlignment('center').setFontWeight('bold');
    lbl(sheet, row, 2, item[1]);
    sheet.getRange(row, 3).setValue(item[2]).setBackground(C.FIXED).setHorizontalAlignment('center');
    sheet.getRange(row, 4).setValue(item[3]).setBackground(C.INPUT).setHorizontalAlignment('center').setFontWeight('bold');
    sheet.getRange(row, 5).setValue(item[4]).setBackground(C.FIXED).setWrap(true);

    // 決定状況（入力・ドロップダウン）
    const sc = inp(sheet, row, 6, item[5]);
    dropdown(sc, ['未確定', '確定済み', '検討中']);

    inp(sheet, row, 7, item[6]).setWrap(true);  // 確定値
    inp(sheet, row, 8, item[7]);                 // いつ決めるか
    sheet.getRange(row, 9).setValue(item[8]).setBackground(C.FIXED).setFontColor('#888888').setWrap(true);
    inp(sheet, row, 10, item[9]).setWrap(true);  // 備考
  });

  // 条件付き書式（決定状況列）
  const statusRange = sheet.getRange(4, 6, 11, 1);
  const rules = [];
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('未確定').setBackground(C.UNCONFIRMED).setFontColor('#CC0000')
    .setRanges([statusRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('確定済み').setBackground(C.CONFIRMED).setFontColor('#006600')
    .setRanges([statusRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('検討中').setBackground('#FFF3CD').setFontColor('#7F6000')
    .setRanges([statusRange]).build());
  sheet.setConditionalFormatRules(rules);

  // 確定件数集計
  sheet.getRange(14, 1, 1, 5).merge()
    .setValue('確定済み件数（Dashboardに連携）').setBackground(C.HEADER).setFontWeight('bold');
  calc(sheet, 14, 6, '=COUNTIF(F4:F14,"確定済み")&"件 / 11件"').setFontWeight('bold');
}
