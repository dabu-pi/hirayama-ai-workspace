/**
 * setup_sheets.js — 運動器初期評価システム Phase 1: 腰痛評価モジュール シート自動生成 GAS
 *
 * システム: JASSESS-01 運動器初期評価システム (msk-assessment-platform)
 * フェーズ: Phase 1 = 腰痛評価モジュール
 * 将来: Phase 2〜でモジュール追加時は setup_{module}.js を追加する方針
 *
 * 使い方:
 *   1. Google スプレッドシートを新規作成する
 *   2. ツール → Apps Script エディタを開く
 *   3. このファイルの内容を貼り付ける
 *   4. setupAllSheets() を実行する
 *   5. 実行後にスプレッドシートIDを取得し PROJECT_STATUS.md に記録する
 *
 * 注意:
 *   - 既存シートがある場合は上書きされる
 *   - 閾値・選択肢はすべて「設定」シートで管理する（コード内に固定値を持たない）
 *   - clasp 管理対象として workspace/msk-assessment-platform/gas/ に保管する
 *
 * シート構成:
 *   【共通基盤】設定 / 患者マスタ / 評価履歴 / コメントマスタ / AI判定用出力 / スタッフマスタ
 *   【腰痛モジュール】腰痛評価入力 / 判定ロジック
 *
 * 最終更新: 2026-03-23（JEVAL-01 → JASSESS-01 / msk-assessment-platform へ移行）
 */

// ========== 定数 ==========
const SHEET_NAMES = {
  CONFIG:     '設定',
  PATIENTS:   '患者マスタ',
  INPUT:      '腰痛評価入力',
  HISTORY:    '評価履歴',
  LOGIC:      '判定ロジック',
  COMMENTS:   'コメントマスタ',
  AI_OUTPUT:  'AI判定用出力',
  STAFF:      'スタッフマスタ',
};

const COLORS = {
  MANUAL:   '#FFF2CC', // 黄色: 手入力
  SELECT:   '#CCEEFF', // 水色: プルダウン選択
  AUTO:     '#EEEEEE', // グレー: 自動計算
  ALERT:    '#FF9999', // 赤: 要注意
  HEADER:   '#4A90D9', // ヘッダー背景
  WHITE:    '#FFFFFF',
};

// ========== メインエントリ ==========

/**
 * 全シートをセットアップするメイン関数
 * Apps Script エディタから直接実行する
 */
function setupAllSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  setupConfigSheet(ss);
  setupPatientsSheet(ss);
  setupInputSheet(ss);
  setupHistorySheet(ss);
  setupLogicSheet(ss);
  setupCommentsSheet(ss);
  setupAiOutputSheet(ss);
  setupStaffSheet(ss);

  // 判定ロジックシートは通常非表示
  const logicSheet = ss.getSheetByName(SHEET_NAMES.LOGIC);
  if (logicSheet) logicSheet.hideSheet();

  // 完了メッセージ
  SpreadsheetApp.getUi().alert(
    '[JASSESS-01] Phase 1 腰痛評価モジュール セットアップ完了！\n\n' +
    'スプレッドシートIDをコピーして PROJECT_STATUS.md に記録してください:\n' +
    ss.getId()
  );
}

// ========== ヘルパー関数 ==========

/**
 * シートを取得または新規作成する
 */
function getOrCreateSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  } else {
    sheet.clearContents();
    sheet.clearFormats();
  }
  return sheet;
}

/**
 * ヘッダー行を設定する
 */
function setHeader(sheet, row, col, text, colspan) {
  const cell = sheet.getRange(row, col, 1, colspan || 1);
  cell.setValue(text)
      .setBackground(COLORS.HEADER)
      .setFontColor('#FFFFFF')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');
}

/**
 * ラベルと入力欄のペアを設定する
 */
function setLabelInput(sheet, row, label, bgColor) {
  sheet.getRange(row, 2).setValue(label).setFontWeight('bold');
  sheet.getRange(row, 3).setBackground(bgColor || COLORS.MANUAL);
}

/**
 * プルダウンリストを設定する
 */
function setDropdown(sheet, row, col, values) {
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(values, true)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(row, col).setDataValidation(rule);
  sheet.getRange(row, col).setBackground(COLORS.SELECT);
}

/**
 * 自動計算セルを設定する
 */
function setAutoCell(sheet, row, col, formula) {
  sheet.getRange(row, col).setFormula(formula).setBackground(COLORS.AUTO);
}

// ========== シート 1: 設定 ==========

function setupConfigSheet(ss) {
  const sheet = getOrCreateSheet(ss, SHEET_NAMES.CONFIG);
  sheet.setColumnWidth(1, 30);
  sheet.setColumnWidth(2, 200);
  sheet.setColumnWidth(3, 300);

  setHeader(sheet, 1, 2, '設定シート — 運動器初期評価システム (JASSESS-01)', 2);

  const configs = [
    [3,  '施設名',                     '平山接骨院'],
    [5,  '--- スコア閾値 ---',          ''],
    [6,  'NRS重症閾値（以上=高強度）',   7],
    [7,  'RMDQ-10 軽度上限（以下=軽度）', 3],
    [8,  'RMDQ-10 中等度上限（以下=中等度）', 7],
    [9,  'STarT 高リスク閾値（以上=高）', 6],
    [10, 'STarT 中リスク閾値（以上=中）', 4],
    [11, 'PSFS MCID（以上=有意な改善）', 2],
    [13, '--- 選択肢定義 ---',          ''],
    [14, '発症様式',        '急性,亜急性,慢性,再燃'],
    [15, '期間区分',        '2週未満,2〜6週,6週〜3か月,3か月以上'],
    [16, '受傷起点',        '動作時,重量物,長時間姿勢,不明,その他'],
    [17, '動作評価',        '正常,軽度制限,中等度制限,著明制限'],
    [18, '動作時痛の方向',  'なし,前屈時,後屈時,側屈時,複合'],
    [19, '赤旗回答',        'なし,あり'],
    [20, '神経症状（下肢放散）', 'なし,片側,両側'],
    [21, 'SLRテスト',       '陰性,陽性（右）,陽性（左）,両側陽性'],
    [22, '下肢しびれ',      'なし,あり（軽度）,あり（強度）'],
    [23, '下肢筋力低下',    'なし,疑い,あり'],
    [24, '性別',            '男性,女性,その他'],
    [25, '職業',            '事務系,立ち仕事,重労働,学生,主婦・主夫,無職,その他'],
    [26, '評価区分',        '初回,中間再評価,最終評価'],
    [27, '治療優先方針',    '疼痛管理優先,機能改善優先,神経所見優先,医療連携優先,行動変容優先,セルフケア優先'],
    [28, '医療連携必要性',  '不要,要検討,要紹介'],
    [29, '慢性化リスク判定', '低,中,高'],
    [30, '立ち上がり評価',  '自立,見守り要,介助要,不可'],
    [31, '歩行評価',        '自立,軽度障害,中等度障害,著明障害'],
    [32, '段差昇降評価',    '自立,可能（手すり要）,困難,不可'],
    [33, '床からの立ち上がり', '自立,可能（支持要）,困難,不可'],
    [34, 'RMDQ回答',        'いいえ(0),はい(1)'],
    [35, 'STarT回答',       'いいえ(0),はい(1)'],
    [36, 'あり/なし',       'なし,あり'],
    [37, 'デルマトーム',    'なし,L4,L5,S1,不明確'],
  ];

  configs.forEach(([row, label, value]) => {
    sheet.getRange(row, 2).setValue(label).setFontWeight(label.startsWith('---') ? 'bold' : 'normal');
    if (value !== '') {
      const cell = sheet.getRange(row, 3);
      cell.setValue(value);
      if (!label.startsWith('---')) cell.setBackground(COLORS.MANUAL);
    }
  });

  sheet.getRange(1, 1, 40, 3).setBorder(true, true, true, true, true, true);
}

// ========== シート 2: 患者マスタ ==========

function setupPatientsSheet(ss) {
  const sheet = getOrCreateSheet(ss, SHEET_NAMES.PATIENTS);
  const headers = ['患者ID', '氏名（カナ）', '生年月日', '年齢', '性別', '職業', '連絡先', '初診日', '最終来院日', '総評価回数', '特記事項', '担当施術者'];
  const widths  = [80, 150, 120, 60, 80, 100, 130, 100, 100, 80, 200, 120];

  headers.forEach((h, i) => {
    sheet.getRange(1, i + 1).setValue(h)
         .setBackground(COLORS.HEADER).setFontColor('#FFFFFF').setFontWeight('bold');
    sheet.setColumnWidth(i + 1, widths[i]);
  });

  // 年齢（D列）は生年月日（C列）から自動計算
  // 入力行は2行目以降に追加される。初期1行分の数式例:
  sheet.getRange(2, 4).setFormula('=IF(C2="","",DATEDIF(C2,TODAY(),"Y"))');
  sheet.getRange(2, 4).setBackground(COLORS.AUTO);

  sheet.setFrozenRows(1);
}

// ========== シート 3: 腰痛評価入力 ==========

function setupInputSheet(ss) {
  const sheet = getOrCreateSheet(ss, SHEET_NAMES.INPUT);
  sheet.setColumnWidth(1, 20);
  sheet.setColumnWidth(2, 220);
  sheet.setColumnWidth(3, 280);
  sheet.setColumnWidth(4, 40);

  // タイトル
  sheet.getRange(1, 1, 1, 4).merge()
       .setValue('腰痛評価入力シート — JASSESS-01')
       .setBackground(COLORS.HEADER).setFontColor('#FFFFFF')
       .setFontSize(14).setFontWeight('bold').setHorizontalAlignment('center');

  // ---- セクション A: 基本情報 ----
  setHeader(sheet, 2, 2, 'A. 基本情報', 2);

  const sectionA = [
    [3,  '評価日',          COLORS.MANUAL,  null],
    [4,  '患者ID',          COLORS.MANUAL,  null],
    [5,  '患者名',          COLORS.AUTO,    null],
    [6,  '年齢',            COLORS.AUTO,    null],
    [7,  '担当施術者',      COLORS.SELECT,  '担当施術者リスト'],
    [8,  '評価区分',        COLORS.SELECT,  '初回,中間再評価,最終評価'],
    [9,  '主訴',            COLORS.MANUAL,  null],
    [10, '発症様式',        COLORS.SELECT,  '急性,亜急性,慢性,再燃'],
    [11, '発症からの期間',  COLORS.SELECT,  '2週未満,2〜6週,6週〜3か月,3か月以上'],
    [12, '受傷起点',        COLORS.SELECT,  '動作時,重量物,長時間姿勢,不明,その他'],
    [13, '既往歴（腰部）',  COLORS.SELECT,  'なし,あり（1回）,あり（複数回）,手術歴あり'],
  ];

  sectionA.forEach(([row, label, color, choices]) => {
    setLabelInput(sheet, row, label, color);
    if (choices) setDropdown(sheet, row, 3, choices.split(','));
  });

  // ---- セクション B: 赤旗 ----
  setHeader(sheet, 15, 2, 'B. 赤旗スクリーニング（Red Flags）— 1つでも「あり」で要注意', 2);

  const redFlagItems = [
    [16, '外傷（転倒・事故等）',                  '骨折リスク'],
    [17, '安静時痛・夜間痛',                      '腫瘍・炎症性疾患'],
    [18, '体重減少（6か月で5kg以上）',             '悪性腫瘍'],
    [19, '発熱・全身倦怠感',                      '感染性脊椎炎'],
    [20, 'ステロイド長期使用歴',                  '骨粗鬆症性骨折'],
    [21, '悪性腫瘍の既往',                        '転移性脊椎腫瘍'],
    [22, '排尿・排便障害 ★馬尾注意',              '馬尾症候群（即緊急）'],
    [23, '会陰部・鞍状領域の感覚異常 ★馬尾注意', '馬尾症候群（即緊急）'],
  ];

  redFlagItems.forEach(([row, label, note]) => {
    sheet.getRange(row, 2).setValue(label).setFontWeight('bold');
    sheet.getRange(row, 4).setValue(note).setFontColor('#888888').setFontSize(9);
    setDropdown(sheet, row, 3, ['なし', 'あり']);
  });

  sheet.getRange(24, 2).setValue('赤旗スコア合計').setFontWeight('bold');
  setAutoCell(sheet, 24, 3,
    '=COUNTIF(C16:C23,"あり")');
  sheet.getRange(25, 2).setValue('赤旗判定').setFontWeight('bold');
  setAutoCell(sheet, 25, 3,
    '=IF(OR(C22="あり",C23="あり"),"【緊急】馬尾症候群疑い — 即日紹介検討",IF(C24>=1,"赤旗あり — 医療連携を検討","問題なし"))');

  // ---- セクション C: 神経症状 ----
  setHeader(sheet, 27, 2, 'C. 神経症状', 2);

  const nerveItems = [
    [28, '下肢放散痛',              ['なし', '片側', '両側']],
    [29, 'デルマトーム分布',        ['なし', 'L4', 'L5', 'S1', '不明確']],
    [30, '下肢のしびれ',            ['なし', 'あり（軽度）', 'あり（強度）']],
    [31, '下肢筋力低下',            ['なし', '疑い', 'あり']],
    [32, 'SLRテスト',               ['陰性', '陽性（右）', '陽性（左）', '両側陽性']],
  ];

  nerveItems.forEach(([row, label, choices]) => {
    sheet.getRange(row, 2).setValue(label).setFontWeight('bold');
    setDropdown(sheet, row, 3, choices);
  });

  sheet.getRange(33, 2).setValue('神経症状レベル（自動）').setFontWeight('bold');
  setAutoCell(sheet, 33, 3,
    '=IF(OR(C31="あり",C32="両側陽性"),"重度",IF(OR(C32="陽性（右）",C32="陽性（左）"),"中等度",IF(C28<>"なし","軽度","なし")))');

  // ---- セクション D: NRS ----
  setHeader(sheet, 35, 2, 'D. 痛みの強度（NRS: 0〜10）', 2);

  [[36, 'NRS（現在）'], [37, 'NRS（最悪時）'], [38, 'NRS（最良時）']].forEach(([row, label]) => {
    sheet.getRange(row, 2).setValue(label).setFontWeight('bold');
    sheet.getRange(row, 3).setBackground(COLORS.MANUAL);
    // 数値入力規則 0〜10
    const rule = SpreadsheetApp.newDataValidation()
      .requireNumberBetween(0, 10).setHelpText('0〜10の整数を入力してください').build();
    sheet.getRange(row, 3).setDataValidation(rule);
  });

  sheet.getRange(39, 2).setValue('NRS判定（自動）').setFontWeight('bold');
  setAutoCell(sheet, 39, 3,
    '=IF(C36="","",IF(C36>=7,"重度（7〜10）",IF(C36>=4,"中等度（4〜6）","軽度（0〜3）")))');

  // ---- セクション E: RMDQ-10 ----
  setHeader(sheet, 41, 2, 'E. 機能評価（RMDQ-10 短縮版）— 「今日の状態」で回答', 2);

  const rmdqItems = [
    [42, 'Q1: 痛みのせいで家にいることが多い'],
    [43, 'Q2: 痛みのせいでゆっくりしか動けない'],
    [44, 'Q3: 痛みのせいで階段の上り下りが遅い'],
    [45, 'Q4: 痛みのせいで横になって休む時間が多い'],
    [46, 'Q5: 痛みのせいで椅子につかまらないと立てない'],
    [47, 'Q6: 痛みのせいで着替えに時間がかかる'],
    [48, 'Q7: 痛みのせいで長時間立っていられない'],
    [49, 'Q8: 痛みのせいで食事の準備が大変'],
    [50, 'Q9: 痛みのせいで靴下・靴を履くのが大変'],
    [51, 'Q10: 痛みのせいで仕事・日課が制限される'],
  ];

  rmdqItems.forEach(([row, label]) => {
    sheet.getRange(row, 2).setValue(label).setFontWeight('normal');
    setDropdown(sheet, row, 3, ['いいえ(0)', 'はい(1)']);
  });

  sheet.getRange(52, 2).setValue('RMDQ-10 合計スコア（自動）').setFontWeight('bold');
  setAutoCell(sheet, 52, 3,
    '=COUNTIF(C42:C51,"はい(1)")');
  sheet.getRange(53, 2).setValue('RMDQ判定（自動）').setFontWeight('bold');
  setAutoCell(sheet, 53, 3,
    '=IF(C52="","",IF(C52>=8,"重度障害（8〜10）",IF(C52>=4,"中等度障害（4〜7）","軽度障害（0〜3）")))');

  // ---- セクション F: STarT ----
  setHeader(sheet, 55, 2, 'F. 慢性化リスク（STarT簡易版）— 「過去1週間」について', 2);

  const startItems = [
    [56, 'Q1: 腰痛が他の部位にも広がっている'],
    [57, 'Q2: 腰痛はここ1週間ずっと続いている'],
    [58, 'Q3: 痛みのせいで動くのが怖い'],
    [59, 'Q4: 自分の努力ではどうにもならないと感じる'],
    [60, 'Q5: 心配事・不安が多い'],
    [61, 'Q6: 気分が落ち込むことが多い'],
    [62, 'Q7: 仕事に戻るのが不安（または仕事が悪化させる）'],
    [63, 'Q8: 腰痛は自分には治せないと思う'],
    [64, 'Q9: 全体的に日常生活にひどく支障している'],
  ];

  startItems.forEach(([row, label]) => {
    sheet.getRange(row, 2).setValue(label).setFontWeight('normal');
    setDropdown(sheet, row, 3, ['いいえ(0)', 'はい(1)']);
  });

  sheet.getRange(65, 2).setValue('STarT合計スコア（自動）').setFontWeight('bold');
  setAutoCell(sheet, 65, 3, '=COUNTIF(C56:C64,"はい(1)")');
  sheet.getRange(66, 2).setValue('STarT判定（自動）').setFontWeight('bold');
  setAutoCell(sheet, 66, 3,
    '=IF(C65="","",IF(C65>=6,"高リスク（6〜9）",IF(C65>=4,"中リスク（4〜5）","低リスク（0〜3）")))');

  // ---- セクション G: PSFS ----
  setHeader(sheet, 68, 2, 'G. PSFS（患者特定機能評価）', 2);
  sheet.getRange(68, 4).setValue('※ 0=まったくできない / 10=通常通りできる').setFontSize(9).setFontColor('#888888');

  [[69, 'PSFS活動1（困っている動作）'], [70, 'PSFS活動2（困っている動作）'], [71, 'PSFS活動3（困っている動作）']].forEach(([row, label]) => {
    sheet.getRange(row, 2).setValue(label).setFontWeight('normal');
    sheet.getRange(row, 3).setBackground(COLORS.MANUAL);
    // スコア列（D列）に0〜10入力
    const ruleScore = SpreadsheetApp.newDataValidation()
      .requireNumberBetween(0, 10).build();
    sheet.getRange(row, 4).setDataValidation(ruleScore).setBackground(COLORS.MANUAL);
  });

  sheet.getRange(72, 2).setValue('PSFS平均スコア（自動）').setFontWeight('bold');
  setAutoCell(sheet, 72, 4,
    '=IFERROR(AVERAGE(D69:D71),"")');
  sheet.getRange(73, 2).setValue('PSFS目標スコア（合意値）').setFontWeight('normal');
  sheet.getRange(73, 4).setBackground(COLORS.MANUAL);

  // ---- セクション H: 動作評価 ----
  setHeader(sheet, 75, 2, 'H. 動作評価', 2);

  const motionItems = [
    [76, '前屈（腰椎屈曲）'],
    [77, '後屈（腰椎伸展）'],
    [78, '右側屈'],
    [79, '左側屈'],
  ];

  motionItems.forEach(([row, label]) => {
    sheet.getRange(row, 2).setValue(label).setFontWeight('normal');
    setDropdown(sheet, row, 3, ['正常', '軽度制限', '中等度制限', '著明制限']);
  });

  sheet.getRange(80, 2).setValue('動作時痛の方向').setFontWeight('normal');
  setDropdown(sheet, 80, 3, ['なし', '前屈時', '後屈時', '側屈時', '複合']);
  sheet.getRange(81, 2).setValue('動作評価まとめ（自動）').setFontWeight('bold');
  // 重症度ベース判定: 著明制限1つ→重度 / 中等度1つ or 軽度2つ→中等度 / 軽度1つ→軽度 / 全正常→正常
  // C76〜C79（前屈・後屈・右側屈・左側屈）の4項目すべてを参照
  setAutoCell(sheet, 81, 3,
    '=IF(COUNTIF(C76:C79,"著明制限")>=1,"重度制限型",IF(OR(COUNTIF(C76:C79,"中等度制限")>=1,COUNTIF(C76:C79,"軽度制限")>=2),"中等度制限型",IF(COUNTIF(C76:C79,"軽度制限")>=1,"軽度制限型","正常")))');

  // ---- セクション I: 移乗動作 ----
  setHeader(sheet, 83, 2, 'I. 移乗動作評価', 2);

  const transferItems = [
    [84, '立ち上がり（椅子から）', ['自立', '見守り要', '介助要', '不可']],
    [85, '歩行',                  ['自立', '軽度障害', '中等度障害', '著明障害']],
    [86, '段差昇降',              ['自立', '可能（手すり要）', '困難', '不可']],
    [87, '床からの立ち上がり',    ['自立', '可能（支持要）', '困難', '不可']],
  ];

  transferItems.forEach(([row, label, choices]) => {
    sheet.getRange(row, 2).setValue(label).setFontWeight('normal');
    setDropdown(sheet, row, 3, choices);
  });

  sheet.getRange(88, 2).setValue('転倒リスク（自動）').setFontWeight('bold');
  setAutoCell(sheet, 88, 3,
    '=IF(OR(C84<>"自立",C85="著明障害",C85="中等度障害"),"高",IF(OR(C86="不可",C87="不可"),"中","低"))');

  // ---- セクション J: 総合所見・判定 ----
  setHeader(sheet, 90, 2, 'J. 総合所見・施術者判定', 2);

  sheet.getRange(91, 2).setValue('総合所見（施術者テキスト）').setFontWeight('bold');
  sheet.getRange(91, 3).setBackground(COLORS.MANUAL);
  sheet.setRowHeight(91, 80);

  const judgeItems = [
    [92, '施術者判定: 治療優先方針', ['疼痛管理優先', '機能改善優先', '神経所見優先', '医療連携優先', '行動変容優先', 'セルフケア優先']],
    [93, '施術者判定: 慢性化リスク判定', ['低', '中', '高']],
    [94, '施術者判定: 医療連携必要性', ['不要', '要検討', '要紹介']],
  ];

  judgeItems.forEach(([row, label, choices]) => {
    sheet.getRange(row, 2).setValue(label).setFontWeight('bold');
    setDropdown(sheet, row, 3, choices);
  });

  sheet.getRange(95, 2).setValue('ルールベース判定結果（自動）').setFontWeight('bold');
  setAutoCell(sheet, 95, 3,
    '=IF(OR(C22="あり",C23="あり"),"【緊急】馬尾症候群疑い",IF(C24>=1,"赤旗あり — 医療連携を優先",IF(C33="重度","神経症状重度 — 医療連携検討",IF(C66="高リスク（6〜9）","行動変容・心理社会的介入優先",IF(C39="重度（7〜10）","疼痛管理優先",IF(C53="重度障害（8〜10）","機能障害対応優先","標準方針"))))))');

  sheet.getRange(96, 2).setValue('AI判定欄（将来用）').setFontWeight('bold').setFontColor('#888888');
  sheet.getRange(96, 3).setBackground('#F5F5F5').setFontColor('#888888').setValue('（Phase 5: Claude API連携予定）');

  // ---- セクション K: 自動生成コメント ----
  setHeader(sheet, 98, 2, 'K. 自動生成コメント（出力）', 2);

  const commentRows = [
    [99,  '評価まとめ'],
    [100, '注意すべき所見'],
    [101, '初回説明の方向性'],
    [102, '施術の優先順位'],
    [103, 'セルフケア・運動療法の方向性'],
    [104, '再評価時に見るべきポイント'],
    [105, '患者さんへの説明文（要約）'],
    [106, '医療連携を考えるべき条件'],
  ];

  commentRows.forEach(([row, label]) => {
    sheet.getRange(row, 2).setValue(label).setFontWeight('bold');
    sheet.getRange(row, 3).setBackground(COLORS.AUTO)
         .setValue('（runLogicAll() 実行後に自動更新）')
         .setFontColor('#888888');
    sheet.setRowHeight(row, 80);
  });

  sheet.getRange(108, 2).setValue('再評価予定日').setFontWeight('bold');
  sheet.getRange(108, 3).setBackground(COLORS.MANUAL);

  // ---- セクション L: 操作ボタン ----
  setHeader(sheet, 110, 2, 'L. 操作', 2);
  sheet.getRange(111, 2).setValue('→ 判定を更新（コメント再生成）: runLogicAll() を実行').setFontStyle('italic').setFontColor('#444444');
  sheet.getRange(112, 2).setValue('→ 評価入力をクリアする場合: clearInputSheet() を実行').setFontStyle('italic').setFontColor('#888888');
  sheet.getRange(113, 2).setValue('→ 記録確定（評価履歴へ転記）: saveToHistory() を実行').setFontStyle('italic').setFontColor('#888888');
  sheet.getRange(115, 2).setValue('※ 入力中は onEdit トリガーが自動で runLogicAll() を呼び出します（トリガー設定済みの場合）').setFontSize(9).setFontColor('#888888');

  sheet.setFrozenRows(1);
}

// ========== シート 4: 評価履歴 ==========

function setupHistorySheet(ss) {
  const sheet = getOrCreateSheet(ss, SHEET_NAMES.HISTORY);
  const headers = [
    '評価ID', '評価日', '患者ID', '患者名', '評価区分',
    'NRS（現在）', 'NRS（最悪）', 'RMDQ-10スコア', 'STarTスコア', 'STarT判定',
    'PSFS平均', '赤旗スコア', '神経症状レベル',
    '施術者判定: 治療優先方針', 'ルールベース判定', 'AI判定（将来）',
    '評価まとめ（自動）', '施術者所見', '担当施術者', '記録日時'
  ];
  const widths = [80, 100, 80, 120, 100, 80, 80, 80, 80, 120, 80, 80, 120, 160, 200, 200, 200, 200, 120, 160];

  headers.forEach((h, i) => {
    sheet.getRange(1, i + 1).setValue(h)
         .setBackground(COLORS.HEADER).setFontColor('#FFFFFF').setFontWeight('bold');
    sheet.setColumnWidth(i + 1, widths[i]);
  });

  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setBorder(true, true, true, true, true, true);
}

// ========== シート 5: 判定ロジック ==========

function setupLogicSheet(ss) {
  const sheet = getOrCreateSheet(ss, SHEET_NAMES.LOGIC);
  sheet.getRange(1, 1).setValue('判定ロジック（中間計算用） — 通常は非表示').setFontWeight('bold');
  sheet.getRange(2, 1).setValue('このシートはGASから参照される中間計算用シートです。直接編集しないでください。');
  sheet.getRange(4, 1).setValue('入力値参照エリア（Phase 2 実装時に数式追加）').setFontWeight('bold');
  sheet.getRange(5, 1).setValue('フラグエリア（Phase 2 実装時に数式追加）').setFontWeight('bold');
}

// ========== シート 6: コメントマスタ ==========

function setupCommentsSheet(ss) {
  const sheet = getOrCreateSheet(ss, SHEET_NAMES.COMMENTS);
  const headers = ['コメントID', 'カテゴリ', '適用条件キー', 'コメント本文（施術者向け）', 'コメント本文（患者向け要約）'];
  const widths  = [100, 120, 180, 400, 300];

  headers.forEach((h, i) => {
    sheet.getRange(1, i + 1).setValue(h)
         .setBackground(COLORS.HEADER).setFontColor('#FFFFFF').setFontWeight('bold');
    sheet.setColumnWidth(i + 1, widths[i]);
  });

  // サンプルエントリ（Phase 2 で本格充填）
  const samples = [
    ['CM_001', '評価まとめ',  'STANDARD',       '評価まとめ（標準）: NRS・RMDQ・STarT の値を確認し方針を決定してください。', '今日の評価で現状を確認しました。'],
    ['CM_002', '評価まとめ',  'CAUDA_EMERGENCY', '【緊急】馬尾症候群疑い。即日医療機関への紹介を検討してください。', '今日は専門の病院での検査をお勧めします。'],
    ['CM_003', '評価まとめ',  'REDFLAG_ALERT',   '赤旗スクリーニングで注意すべき所見があります。施術前に医療連携の必要性を確認してください。', '念のため専門医の確認をお勧めする状態があります。'],
    ['CM_004', '注意所見',    'NERVE_SEVERE',    '重度の神経症状あり。施術内容を慎重に選択し、整形外科的精査（MRI等）を強く推奨します。', '神経に関わる症状があるため、専門医の診察もお勧めします。'],
    ['CM_005', '注意所見',    'START_HIGH',      '慢性化リスクが高い状態です。心理社会的因子への介入と患者教育を施術と並行して実施してください。', '痛みが続く原因のひとつに、不安やストレスが影響している場合があります。'],
    ['CM_006', '施術優先順位','NRS_HIGH',        '疼痛緩和を最優先に。痛みが落ち着いたら機能改善へ移行してください。', 'まず痛みを和らげることを中心に対応します。'],
    ['CM_007', '医療連携',    'ALWAYS',          '【即日紹介】馬尾症候群疑い（排尿障害・会陰部感覚異常）/ 進行性下肢筋力低下\n【早期紹介】安静時痛+体重減少 / 発熱+背部痛 / 外傷後強い腰痛\n【経過観察後】4〜6週改善なし', '（施術者参考用）'],
  ];

  samples.forEach((row, i) => {
    row.forEach((val, j) => {
      sheet.getRange(i + 2, j + 1).setValue(val);
    });
  });

  sheet.setFrozenRows(1);
}

// ========== シート 7: AI判定用出力 ==========

function setupAiOutputSheet(ss) {
  const sheet = getOrCreateSheet(ss, SHEET_NAMES.AI_OUTPUT);
  const headers = ['評価ID', 'JSON出力（評価データ）', 'APIリクエスト日時', 'AI判定テキスト', 'AI信頼度（将来）'];
  const widths  = [80, 500, 160, 400, 100];

  headers.forEach((h, i) => {
    sheet.getRange(1, i + 1).setValue(h)
         .setBackground(COLORS.HEADER).setFontColor('#FFFFFF').setFontWeight('bold');
    sheet.setColumnWidth(i + 1, widths[i]);
  });

  sheet.getRange(2, 1).setValue('（Phase 5: Claude API連携後に自動記録されます）')
       .setFontStyle('italic').setFontColor('#888888');
  sheet.setFrozenRows(1);
}

// ========== シート 8: スタッフマスタ ==========

function setupStaffSheet(ss) {
  const sheet = getOrCreateSheet(ss, SHEET_NAMES.STAFF);
  const headers = ['スタッフID', '氏名', '資格', '担当患者数', '在籍状況'];
  const widths  = [80, 120, 160, 80, 80];

  headers.forEach((h, i) => {
    sheet.getRange(1, i + 1).setValue(h)
         .setBackground(COLORS.HEADER).setFontColor('#FFFFFF').setFontWeight('bold');
    sheet.setColumnWidth(i + 1, widths[i]);
  });

  // サンプル行
  sheet.getRange(2, 1).setValue('ST001');
  sheet.getRange(2, 2).setValue('平山克司');
  sheet.getRange(2, 3).setValue('柔道整復師');
  sheet.getRange(2, 5).setValue('在籍');

  sheet.setFrozenRows(1);
}

// ========== 評価入力クリア ==========

/**
 * 腰痛評価入力シートをクリアする（基本情報・評価データのみ。自動生成コメントも消去）
 * 「評価入力をクリア」ボタンから呼び出す
 */
function clearInputSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.INPUT);
  if (!sheet) return;

  const ui = SpreadsheetApp.getUi();
  const response = ui.alert('確認', '評価入力をクリアしますか？（評価履歴への転記は行われません）', ui.ButtonSet.YES_NO);
  if (response !== ui.Button.YES) return;

  // 入力エリアのみクリア（C列の黄色・水色セル）
  const clearRanges = [
    'C3:C13',   // 基本情報
    'C16:C23',  // 赤旗
    'C28:C32',  // 神経症状
    'C36:C38',  // NRS
    'C42:C51',  // RMDQ
    'C56:C64',  // STarT
    'C69:C71', 'D69:D71', 'D73', // PSFS
    'C76:C80',  // 動作評価
    'C84:C87',  // 移乗動作
    'C91:C95',  // 総合所見・判定
    'C108',     // 再評価予定日
  ];

  clearRanges.forEach(range => {
    sheet.getRange(range).clearContent();
  });

  ui.alert('クリアしました。新しい評価を入力してください。');
}

// ========== 評価履歴へ転記 ==========

/**
 * 評価入力シートの内容を評価履歴シートへ転記する
 * 「記録確定」ボタンから呼び出す
 * TODO: Phase 2 で必須項目バリデーションを追加する
 */
function saveToHistory() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const inputSheet = ss.getSheetByName(SHEET_NAMES.INPUT);
  const historySheet = ss.getSheetByName(SHEET_NAMES.HISTORY);

  if (!inputSheet || !historySheet) {
    SpreadsheetApp.getUi().alert('シートが見つかりません。setup_sheets.js を再実行してください。');
    return;
  }

  const ui = SpreadsheetApp.getUi();

  // 必須項目チェック（Phase 2 で詳細化）
  const evalDate = inputSheet.getRange('C3').getValue();
  const patientId = inputSheet.getRange('C4').getValue();
  if (!evalDate || !patientId) {
    ui.alert('エラー', '評価日と患者IDを入力してください。', ui.ButtonSet.OK);
    return;
  }

  const response = ui.alert('確認', '評価を履歴に記録しますか？', ui.ButtonSet.YES_NO);
  if (response !== ui.Button.YES) return;

  // 評価IDを生成 (E + ゼロ埋め4桁)
  const lastRow = historySheet.getLastRow();
  const evalId = 'E' + String(lastRow).padStart(4, '0');

  // 転記するデータを収集
  const data = [
    evalId,
    evalDate,
    patientId,
    inputSheet.getRange('C5').getValue(),  // 患者名（自動表示）
    inputSheet.getRange('C8').getValue(),  // 評価区分
    inputSheet.getRange('C36').getValue(), // NRS現在
    inputSheet.getRange('C37').getValue(), // NRS最悪
    inputSheet.getRange('C52').getValue(), // RMDQ合計
    inputSheet.getRange('C65').getValue(), // STarT合計
    inputSheet.getRange('C66').getValue(), // STarT判定
    inputSheet.getRange('D72').getValue(), // PSFS平均
    inputSheet.getRange('C24').getValue(), // 赤旗スコア
    inputSheet.getRange('C33').getValue(), // 神経症状レベル
    inputSheet.getRange('C92').getValue(), // 施術者判定: 治療優先方針
    inputSheet.getRange('C95').getValue(), // ルールベース判定
    inputSheet.getRange('C96').getValue(), // AI判定（将来）
    inputSheet.getRange('C99').getValue(), // 評価まとめ（自動）
    inputSheet.getRange('C91').getValue(), // 施術者所見
    inputSheet.getRange('C7').getValue(),  // 担当施術者
    new Date(),                             // 記録日時
  ];

  historySheet.appendRow(data);
  ui.alert('記録完了', `評価ID: ${evalId} として評価履歴に保存しました。\n入力シートをクリアする場合は「評価入力をクリア」を実行してください。`, ui.ButtonSet.OK);
}
