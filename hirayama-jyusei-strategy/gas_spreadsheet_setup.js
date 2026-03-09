// ============================================================
// 平山接骨院 慢性疼痛強化プロジェクト
// Googleスプレッドシート 一括生成スクリプト
// 対応設計書: SHEET_DESIGN.md
// 最終更新: 2026-03-09
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
  NUMERIC:    '数値前提',
  PRICING:    '価格設定',
  KPI:        'KPI目標',
  OPEN_ITEMS: '未確定項目',
};

// --- 色定数 ---
const C = {
  INPUT:       '#FFF2CC', // 黄色: ユーザー入力
  CALC:        '#CFE2F3', // 水色: 自動計算
  HEADER:      '#EFEFEF', // グレー: 見出し
  WARN_BG:     '#FCE5CD', // オレンジ: 注意行
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
  setupNumeric(ss);
  setupPricing(ss);
  setupKPI(ss);
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

/** 入力セル（黄色）*/
function inp(sheet, row, col, val, fmt) {
  const cell = sheet.getRange(row, col);
  cell.setBackground(C.INPUT);
  if (val !== '' && val !== undefined) cell.setValue(val);
  if (fmt) cell.setNumberFormat(fmt);
  return cell;
}

/** 計算セル（水色・保護警告）*/
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
      `=IFERROR(TEXT(COUNTIF('${SHEET.OPEN_ITEMS}'!F4:F12,"確定済み")/9,"0%"),"0%")`,
      '確定済み件数÷9'],
    ['未確定項目数（件）',
      `=IFERROR(COUNTIF('${SHEET.OPEN_ITEMS}'!F4:F12,"未確定")&"件","—")`,
      '未確定項目シートを参照'],
    ['月自費収益目標',
      `=IFERROR(TEXT('${SHEET.KPI}'!B6,"#,##0")&"円","要入力")`,
      'KPI目標シートを参照'],
    ['必要成約件数/月（逆算）',
      `=IFERROR('${SHEET.KPI}'!B24&"件","要入力")`,
      'KPI目標シートで逆算（ブロックC・B24）'],
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
    //   =IFERROR(INDEX('未確定項目'!B$4:B$12,
    //     SMALL(IF(('未確定項目'!D$4:D$12="高")*('未確定項目'!F$4:F$12="未確定"),
    //       ROW('未確定項目'!B$4:B$12)-ROW('未確定項目'!B$4)+1), <N>)), "（なし）")
    //   <N> には Top1=1, Top2=2, Top3=3 を入れる
    //   ※ Ctrl+Shift+Enter で確定すると { } で囲まれた配列数式になる
    calc(sheet, 15 + i, 2,
      `=IFERROR(INDEX(FILTER('${SHEET.OPEN_ITEMS}'!B4:B12,` +
      `('${SHEET.OPEN_ITEMS}'!D4:D12="高")*('${SHEET.OPEN_ITEMS}'!F4:F12="未確定")),${i + 1}),"（なし）")`
    );
  }

  // ---- 初回手順 ----
  addSection(sheet, 19, 3, '■ 最初にやること（入力手順）');
  [
    'Step 1: 「数値前提」シートを開き、固定費・保険ベースラインを入力する',
    'Step 2: 「価格設定」シートで仮価格を確認し、正式価格が決まったら上書きする',
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
      '院長が30秒でコンセプト説明できる / Google説明文更新',
      '進行中', 80,
      'STRATEGY_ONE_PAGE.md 作成済み。キャッチコピー確定・Google更新が残り'],
    ['Phase2', '価格・商品確定',
      '患者に実際に提案できる正式な価格表を完成させる',
      '患者に見せられる価格表完成 / 院長承認',
      '未着手', 0,
      '価格が未確定のためブロック中。NEXT_ACTIONS.md 参照'],
    ['Phase3', '集患導線整備',
      '慢性腰痛で困っている新患が院を知り、予約できる仕組みを作る',
      'Googleビジネスプロフィール最適化完了 / 月1件以上Google新患',
      '未着手', 0, ''],
    ['Phase4', '院内運用整備',
      '来院患者を自費→運動療法→ジムへ段階的に引き上げる仕組みを作る',
      'トークスクリプト完成 / 記録シート運用1ヶ月',
      '未着手', 0, ''],
    ['Phase5', 'KPI計測開始',
      '毎月数字で状況を把握し、改善判断ができる体制を作る',
      '月末に来院数・提案数・成約数・自費収益・ジム会員数が確認できる状態',
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
// 3. 数値前提
// ============================================================
function setupNumeric(ss) {
  const sheet = ss.insertSheet(SHEET.NUMERIC);
  setColWidths(sheet, [220, 130, 90, 210]);
  addWarning(sheet, 4);
  addTitle(sheet, 4, '数値前提（固定費・保険ベースライン）');

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
    sheet.getRange(row, 3).setValue(unit).setBackground('#F9F9F9').setHorizontalAlignment('center');
    sheet.getRange(row, 4).setValue(note).setBackground('#F9F9F9').setFontColor('#888888');
  });

  // スタッフ人件費
  lbl(sheet, 15, 1, 'スタッフ人件費（いる場合）');
  inp(sheet, 15, 2, '', '#,##0');
  sheet.getRange(15, 3).setValue('円/月').setBackground('#F9F9F9').setHorizontalAlignment('center');
  sheet.getRange(15, 4).setValue('スタッフがいない場合は 0').setBackground('#F9F9F9').setFontColor('#888888');

  // 合計行
  lbl(sheet, 16, 1, '現金支出固定費合計');
  calc(sheet, 16, 2, '=IFERROR(SUM(B6:B14),"要入力")', '#,##0').setFontWeight('bold');
  lbl(sheet, 17, 1, '経営固定費合計（スタッフ含む）');
  calc(sheet, 17, 2, '=IFERROR(SUM(B6:B15),"要入力")', '#,##0').setFontWeight('bold');

  // ---- ブロックB: ベースライン ----
  addSection(sheet, 19, 4, '■ ブロックB: 保険診療ベースライン（現状の数値を入力）');
  ['項目名', '現状値', '単位', '備考'].forEach((h, i) => hdr(sheet, 20, i + 1, h));

  const baseItems = [
    ['月次保険売上（現在）', '', '円/月', '直近3ヶ月平均が望ましい'],
    ['月次来院患者数（現在）', '', '人/月', ''],
    ['月次営業日数', '25', '日/月', ''],
  ];
  baseItems.forEach(([name, val, unit, note], i) => {
    const row = 21 + i;
    lbl(sheet, row, 1, name);
    inp(sheet, row, 2, val, i === 0 ? '#,##0' : '0');
    sheet.getRange(row, 3).setValue(unit).setBackground('#F9F9F9').setHorizontalAlignment('center');
    sheet.getRange(row, 4).setValue(note).setBackground('#F9F9F9').setFontColor('#888888');
  });

  // 自動計算
  const calcs = [
    ['1日平均患者数',                '=IFERROR(B22/B23,"要入力")', '人/日', ''],
    ['自費+20万円後の月次総収入見込み', '=IFERROR(B21+200000,"要入力")', '円/月', '保険売上+200,000'],
    ['固定費カバー率',                '=IFERROR(TEXT(B25/B17,"0.0%"),"要入力")', '', '100%以上で固定費をカバーできる'],
  ];
  calcs.forEach(([name, formula, unit, note], i) => {
    const row = 25 + i;
    lbl(sheet, row, 1, name);
    calc(sheet, row, 2, formula).setFontWeight('bold');
    sheet.getRange(row, 3).setValue(unit).setBackground('#F9F9F9').setHorizontalAlignment('center');
    sheet.getRange(row, 4).setValue(note).setBackground('#F9F9F9').setFontColor('#888888');
  });
}

// ============================================================
// 4. 価格設定（メニューマスタ）
// ============================================================
function setupPricing(ss) {
  const sheet = ss.insertSheet(SHEET.PRICING);
  // 13列: 表示順/大区分/小区分/メニュー名/内容/時間/一般料金/ジム会員料金/保険適用/回数単位/KPI集計/確定状況/備考
  setColWidths(sheet, [40, 160, 90, 160, 200, 75, 90, 105, 65, 70, 75, 75, 200]);
  addWarning(sheet, 13);
  addTitle(sheet, 13, 'メニューマスタ（価格設定）');

  // ヘッダ行（行3）
  ['表示順', '大区分', '小区分', 'メニュー名', '内容', '時間',
   '一般料金\n（円）', 'ジム会員\n料金（円）', '保険\n適用', '回数/単位',
   'KPI集計\n対象', '確定状況', '備考']
    .forEach((h, i) => hdr(sheet, 3, i + 1, h));
  sheet.setRowHeight(3, 45);

  // 区分ごとの背景色
  const catColors = {
    '保険施術（急性期対応）':   '#D9EAD3',
    '保険施術オプション':       '#EAD1DC',
    '午前限定 自費メニュー':    '#FCE5CD',
    '慢性専門施術（根本改善）': '#CFE2F3',
    '運動再教育（再発防止）':   '#E6D0DE',
    '併設ジム':                 '#FFF2CC',
  };

  // メニューデータ
  // [表示順, 大区分, 小区分, メニュー名, 内容, 時間, 一般料金(null=保険適用), ジム会員料金(null=なし),
  //  保険適用, 回数/単位, KPI集計対象, 確定状況, 備考]
  const menus = [
    [1,  '保険施術（急性期対応）',  '', '保険施術',
     '検査＋電気治療（約15分）＋手技（約5分）', '約20分',
     null,  null,  '○', '1回',   '×', '確定', '急な痛みや日常の不調に対応します。'],
    [2,  '保険施術オプション',      '', '手技延長',
     '10分延長', '10分',
     1100,   935,  '×', '1回',   '○', '確定', ''],
    [3,  '保険施術オプション',      '', '筋膜リリース（マッサージガン）',
     '5分追加', '5分',
     880,    748,  '×', '1回',   '○', '確定', ''],
    [4,  '保険施術オプション',      '', '温熱追加',
     '5分追加', '5分',
     550,  467.5,  '×', '1回',   '○', '確定', ''],
    [5,  '午前限定 自費メニュー',   '', '深部コンディショニング',
     '深部電気＋軽調整', '約30分',
     4400,  3740,  '×', '1回',   '○', '確定', '通常の電気では届かない深部へアプローチします。'],
    [6,  '午前限定 自費メニュー',   '', '電気治療1回',
     '干渉波電気治療', '約15分',
     1200,  1020,  '×', '1回',   '○', '確定', ''],
    [7,  '午前限定 自費メニュー',   '', '電気治療午前限定通い放題',
     '干渉波電気治療', '約15分',
     5500,  4675,  '×', '月額',  '○', '確定', ''],
    [8,  '慢性専門施術（根本改善）', '', '慢性疼痛改善（単発）',
     '深部高電圧＋可動域改善', '約45分',
     7700,  6545,  '×', '1回',   '○', '確定', '慢性腰痛・首肩こりの方はこちらをおすすめします。'],
    [9,  '慢性専門施術（根本改善）', '', '慢性疼痛改善 8回プログラム',
     '根本改善＋再発予防設計', '45分×8回',
     58000, 49300, '×', '8回',   '○', '確定', '慢性腰痛・首肩こりの方はこちらをおすすめします。'],
    [10, '運動再教育（再発防止）',  '', 'パーソナルトレーニング',
     '痛まない身体の使い方習得', '約60分',
     8800,  7480,  '×', '1回',   '○', '確定', ''],
    [11, '運動再教育（再発防止）',  '', '4回集中コース',
     'フォーム再教育・卒業設計', '60分×4回',
     35200, 29920, '×', '4回',   '○', '確定', ''],
    [12, '併設ジム',               '', '月会員',
     '併設ジム利用', '月額',
     7480,  null,  '×', '月額',  '○', '確定', ''],
  ];

  menus.forEach((m, i) => {
    const row = 4 + i;
    const [order, cat, subcat, name, content, time,
           price, memberPrice, insurance, unit, kpi, status, note] = m;
    const catColor = catColors[cat] || '#F9F9F9';

    // 表示順（1列）
    sheet.getRange(row, 1).setValue(order)
      .setBackground(catColor).setHorizontalAlignment('center').setFontWeight('bold');
    // 大区分（2列）
    sheet.getRange(row, 2).setValue(cat)
      .setBackground(catColor).setFontWeight('bold').setWrap(true);
    // 小区分（3列）
    sheet.getRange(row, 3).setValue(subcat).setBackground('#F9F9F9');
    // メニュー名（4列）
    sheet.getRange(row, 4).setValue(name)
      .setBackground(C.HEADER).setFontWeight('bold');
    // 内容（5列）
    sheet.getRange(row, 5).setValue(content)
      .setBackground('#F9F9F9').setWrap(true);
    // 時間（6列）
    sheet.getRange(row, 6).setValue(time)
      .setBackground('#F9F9F9').setHorizontalAlignment('center');
    // 一般料金（7列）: null = 保険適用
    if (price !== null) {
      inp(sheet, row, 7, price, '#,##0').setHorizontalAlignment('right');
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
        .setBackground('#F9F9F9').setHorizontalAlignment('center').setFontColor('#888888');
    }
    // 保険適用（9列）
    sheet.getRange(row, 9).setValue(insurance)
      .setBackground('#F9F9F9').setHorizontalAlignment('center')
      .setFontColor(insurance === '○' ? '#006600' : '#888888').setFontWeight('bold');
    // 回数/単位（10列）
    sheet.getRange(row, 10).setValue(unit)
      .setBackground('#F9F9F9').setHorizontalAlignment('center');
    // KPI集計対象（11列）
    const kpiCell = inp(sheet, row, 11, kpi);
    kpiCell.setHorizontalAlignment('center');
    dropdown(kpiCell, ['○', '×']);
    // 確定状況（12列）
    const statusCell = inp(sheet, row, 12, status);
    statusCell.setHorizontalAlignment('center');
    dropdown(statusCell, ['確定', '仮', '未設定']);
    // 備考（13列）
    inp(sheet, row, 13, note).setWrap(true);
  });

  // 条件付き書式: 確定状況（12列目）
  const statusRange = sheet.getRange(4, 12, 12, 1);
  const rules = [];
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('未設定').setBackground(C.UNCONFIRMED).setFontColor('#CC0000')
    .setRanges([statusRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('確定').setBackground(C.CONFIRMED).setFontColor('#006600')
    .setRanges([statusRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('仮').setBackground('#FFF3CD').setFontColor('#7F6000')
    .setRanges([statusRange]).build());
  // 条件付き書式: KPI集計対象（11列目）
  const kpiRange = sheet.getRange(4, 11, 12, 1);
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('○').setBackground(C.CONFIRMED).setFontColor('#006600')
    .setRanges([kpiRange]).build());
  rules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenTextEqualTo('×').setBackground(C.HEADER).setFontColor('#888888')
    .setRanges([kpiRange]).build());
  sheet.setConditionalFormatRules(rules);

  // 集計行（行17）
  lbl(sheet, 17, 1, '集計');
  lbl(sheet, 17, 2, 'KPI集計対象数');
  calc(sheet, 17, 3, '=COUNTIF(K4:K15,"○")&"件 / 12件"');
  lbl(sheet, 17, 7, '未確定件数');
  calc(sheet, 17, 8,
    '=COUNTIF(L4:L15,"未設定")&"件が未設定、"&COUNTIF(L4:L15,"仮")&"件が仮値"');
}

// ============================================================
// 5. KPI目標
// ============================================================
function setupKPI(ss) {
  const sheet = ss.insertSheet(SHEET.KPI);
  setColWidths(sheet, [240, 140, 90, 210]);
  addWarning(sheet, 4);
  addTitle(sheet, 4, 'KPI目標・逆算シミュレーション');

  // ---- ブロックA: 目標値入力 ----
  addSection(sheet, 4, 4, '■ ブロックA: 目標値入力（黄色セルに入力してください）');
  ['項目名', '目標値', '単位', '備考'].forEach((h, i) => hdr(sheet, 5, i + 1, h));

  const targets = [
    ['月次自費収益目標',       200000, '円/月', '月+20万円が当面のKPI'],
    ['保険来院患者数（月次）', '',     '人/月', '「数値前提」シートの現状値を参考に'],
    ['慢性疼痛患者の割合',     '',     '%',     '来院患者のうち慢性対象の割合'],
    ['自費提案率',             '',     '%',     '慢性患者のうち何%に提案するか'],
    ['自費成約率',             '',     '%',     '提案患者のうち何%が成約'],
    ['ジム体験案内率',         '',     '%',     '自費患者のうち何%にジム体験を案内'],
    ['ジム体験→入会率',       '',     '%',     '体験者のうち何%が入会'],
    ['月次退会率',             '',     '%',     '在籍会員のうち月何%が退会'],
  ];
  targets.forEach(([name, val, unit, note], i) => {
    const row = 6 + i;
    lbl(sheet, row, 1, name);
    inp(sheet, row, 2, val !== '' ? val : '', i === 0 ? '#,##0' : '0.0');
    sheet.getRange(row, 3).setValue(unit).setBackground('#F9F9F9').setHorizontalAlignment('center');
    sheet.getRange(row, 4).setValue(note).setBackground('#F9F9F9').setFontColor('#888888');
  });

  // ---- ブロックB: 主力メニュー単価（価格設定シートから自動参照）----
  addSection(sheet, 15, 4, '■ ブロックB: 主力メニュー単価（価格設定シートから自動参照）');
  ['メニュー名', '一般料金', 'ジム会員料金', '備考'].forEach((h, i) => hdr(sheet, 16, i + 1, h));

  // 価格設定シートの列G=一般料金 / 列H=ジム会員料金
  // 行12=慢性疼痛改善8回 / 行11=慢性疼痛改善単発 / 行13=パーソナル / 行15=月会員
  const priceRefs = [
    ['慢性疼痛改善 8回プログラム',
      `='${SHEET.PRICING}'!G12`, `='${SHEET.PRICING}'!H12`, '主力商品（逆算の基準）'],
    ['慢性疼痛改善（単発）',
      `='${SHEET.PRICING}'!G11`, `='${SHEET.PRICING}'!H11`, '単発利用者向け'],
    ['パーソナルトレーニング',
      `='${SHEET.PRICING}'!G13`, `='${SHEET.PRICING}'!H13`, ''],
    ['月会員（月額）',
      `='${SHEET.PRICING}'!G15`, '', 'ジム継続収益'],
  ];
  priceRefs.forEach(([name, priceF, memberF, note], i) => {
    const row = 17 + i;
    lbl(sheet, row, 1, name);
    calc(sheet, row, 2, priceF, '#,##0');
    if (memberF) {
      calc(sheet, row, 3, memberF, '#,##0');
    } else {
      sheet.getRange(row, 3).setValue('—')
        .setBackground('#F9F9F9').setHorizontalAlignment('center').setFontColor('#888888');
    }
    sheet.getRange(row, 4).setValue(note).setBackground('#F9F9F9').setFontColor('#888888');
  });

  // ---- ブロックC: 逆算シミュレーション ----
  addSection(sheet, 22, 4, '■ ブロックC: 逆算シミュレーション（入力不要・自動計算）');
  ['逆算項目', '計算結果', '単位', '計算根拠'].forEach((h, i) => hdr(sheet, 23, i + 1, h));

  // [項目名, 数式, 単位, 根拠, 数値フォーマット]
  // ※ 計算結果はすべてB列（col 2）に配置。チェーン参照は Bxx を使用
  const calcRows = [
    ['必要成約件数/月（逆算）',
      '=IFERROR(CEILING(B6/B17,1),"要入力")',
      '件/月', '月次自費目標 ÷ 8回プログラム単価（切り上げ）', '0'],
    ['慢性疼痛候補数/月',
      '=IFERROR(B7*B8/100,"要入力")',
      '人/月', '保険来院数 × 慢性割合', '0.0'],
    ['自費提案件数/月',
      '=IFERROR(B25*B9/100,"要入力")',
      '件/月', '候補数 × 提案率', '0.0'],
    ['自費成約件数/月',
      '=IFERROR(B26*B10/100,"要入力")',
      '件/月', '提案件数 × 成約率', '0.0'],
    ['見込み自費収益/月',
      '=IFERROR(B27*B17,"要入力")',
      '円/月', '成約件数 × 8回プログラム単価', '#,##0'],
    ['目標との差額',
      '=IFERROR(B6-B28,"要入力")',
      '円/月', 'マイナスなら目標達成', '#,##0'],
    ['ジム新規入会数/月',
      '=IFERROR(B27*B11/100*B12/100,"要入力")',
      '人/月', '成約件数 × 体験案内率 × 入会率', '0.0'],
    ['ジム会員数（6ヶ月後・概算）',
      '=IFERROR(IF(B13=0,B30*6,B30/B13*100*(1-(1-B13/100)^6)),"要入力")',
      '人', '月次入会者の積み上げ（退会考慮）', '0.0'],
    ['ジム月次収益（6ヶ月後）',
      '=IFERROR(B31*B20,"要入力")',
      '円/月', '会員数 × 月会員料金', '#,##0'],
  ];
  calcRows.forEach(([name, formula, unit, basis, fmt], i) => {
    const row = 24 + i;
    lbl(sheet, row, 1, name);
    calc(sheet, row, 2, formula, fmt);
    sheet.getRange(row, 3).setValue(unit).setBackground('#F9F9F9').setHorizontalAlignment('center');
    sheet.getRange(row, 4).setValue(basis).setBackground('#F9F9F9').setFontColor('#888888');
  });

  // 目標との差額（行29）の条件付き書式（マイナス=緑・プラス=赤）
  const gapCell = sheet.getRange(29, 2);
  const gapRules = [];
  gapRules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberLessThan(0).setBackground(C.CONFIRMED).setFontColor('#006600')
    .setRanges([gapCell]).build());
  gapRules.push(SpreadsheetApp.newConditionalFormatRule()
    .whenNumberGreaterThan(0).setBackground(C.UNCONFIRMED).setFontColor('#CC0000')
    .setRanges([gapCell]).build());
  sheet.setConditionalFormatRules(gapRules);
}

// ============================================================
// 6. 未確定項目
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
    [1, 'ジム会員費（スタンダード月額）', '価格', '高',
     '継続商品の根幹・損益シミュレーションに必須',
     '未確定', '', '', 'pricing.md / membership.md', '近隣ジム相場: 5,000〜8,000円'],
    [2, 'ジム会員費（プレミアム月額）', '価格', '高',
     'スタンダードとの価格差設計が売れ方を左右する',
     '未確定', '', '', 'pricing.md / membership.md', ''],
    [3, '自費施術の正式価格', '価格', '高',
     '仮価格のままではスタッフトークが固まらない',
     '未確定', '', '', 'pricing.md', '8回プログラム・単回・運動療法4回'],
    [4, '自費提案率・成約率の目標値', 'KPI', '高',
     '来院数から逆算した必要件数が計算できない',
     '未確定', '', '', 'kpi.md', '例: 提案率40%・成約率30%'],
    [5, 'ジム体験案内率・入会率の目標値', 'KPI', '高',
     'ジム会員積み上げモデルの設計に必要',
     '未確定', '', '', 'kpi.md', ''],
    [6, 'ジム継続率・月次退会率の目標値', 'KPI', '中',
     'LTV計算と損益分岐点に影響',
     '未確定', '', '', 'kpi.md', '3ヶ月の実績が出てから設定でもよい'],
    [7, '固定費の実数値', '財務', '高',
     '損益分岐点が計算できない・最優先で入力',
     '未確定', '', '', 'cost-structure.md', '「数値前提」シートに入力'],
    [8, '治療機器投資額・月次リース費', '財務', '高',
     '1年回収目標の分母が空白のまま',
     '未確定', '', '', 'equipment-investment.md', ''],
    [9, '月次保険売上・患者数ベースライン', '財務', '高',
     '現在地が分からないと+20万円の難易度が見えない',
     '未確定', '', '', 'profit-simulation.md', '「数値前提」シートに入力'],
  ];

  items.forEach((item, i) => {
    const row = 4 + i;
    sheet.getRange(row, 1).setValue(item[0]).setBackground(C.HEADER).setHorizontalAlignment('center').setFontWeight('bold');
    lbl(sheet, row, 2, item[1]);
    sheet.getRange(row, 3).setValue(item[2]).setBackground('#F9F9F9').setHorizontalAlignment('center');
    sheet.getRange(row, 4).setValue(item[3]).setBackground('#F9F9F9').setHorizontalAlignment('center').setFontWeight('bold');
    sheet.getRange(row, 5).setValue(item[4]).setBackground('#F9F9F9').setWrap(true);

    // 決定状況（入力・ドロップダウン）
    const sc = inp(sheet, row, 6, item[5]);
    dropdown(sc, ['未確定', '確定済み', '検討中']);

    inp(sheet, row, 7, item[6]).setWrap(true);  // 確定値
    inp(sheet, row, 8, item[7]);                 // いつ決めるか
    sheet.getRange(row, 9).setValue(item[8]).setBackground('#F9F9F9').setFontColor('#888888').setWrap(true);
    inp(sheet, row, 10, item[9]).setWrap(true);  // 備考
  });

  // 条件付き書式（決定状況列）
  const statusRange = sheet.getRange(4, 6, 9, 1);
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
  calc(sheet, 14, 6, '=COUNTIF(F4:F12,"確定済み")&"件 / 9件"').setFontWeight('bold');
}
