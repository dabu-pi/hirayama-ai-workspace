/**
 * AI投資プロジェクト 管理シート セットアップスクリプト
 *
 * 【使い方】
 * 1. Google Drive で新しいスプレッドシートを作成する
 * 2. メニュー「拡張機能」>「Apps Script」を開く
 * 3. このファイルの内容をすべてコピーして貼り付ける（既存コードは削除）
 * 4. 保存（Ctrl+S）
 * 5. 関数リストで「runSetup」を選択し「実行」ボタンをクリック
 * 6. 権限の許可を求められたら「許可」する
 * 7. 完了メッセージが表示されたら終了
 *
 * 参照設計書: ai-invest/docs/sheet_design.md v1.3
 * 作成日: 2026-03-10
 */

// ===== メイン実行関数 =====

function runSetup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  setupSheet1_候補管理(ss);
  setupSheet2_スクリーニング記録(ss);
  setupSheet3_取引記録(ss);
  setupSheet4_チャート型記録(ss);

  // デフォルトの「シート1」を削除（あれば）
  const defaultSheet = ss.getSheetByName('シート1');
  if (defaultSheet) {
    try { ss.deleteSheet(defaultSheet); } catch (e) {}
  }

  // 最初のシートをアクティブに
  ss.setActiveSheet(ss.getSheets()[0]);

  Logger.log('✅ セットアップ完了: ' + ss.getUrl());
  SpreadsheetApp.getUi().alert(
    '✅ セットアップ完了！\n\n' +
    '以下の4シートが作成されました:\n' +
    '  ① 候補管理（16銘柄を事前入力済み）\n' +
    '  ② スクリーニング記録\n' +
    '  ③ 取引記録\n' +
    '  ④ チャート型記録\n\n' +
    'sheet_design.md v1.3 の設計に準拠しています。'
  );
}

// ===== ヘルパー関数 =====

/**
 * シートを取得または新規作成する。既存の場合はクリアする。
 */
function getOrCreateSheet(ss, name) {
  let sheet = ss.getSheetByName(name);
  if (sheet) {
    sheet.clear();
    sheet.clearConditionalFormatRules();
  } else {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

/**
 * 指定範囲にドロップダウンの入力規則を設定する。
 */
function setDropdown(sheet, startRow, col, numRows, values) {
  const range = sheet.getRange(startRow, col, numRows, 1);
  const rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(values, true)
    .setAllowInvalid(false)
    .build();
  range.setDataValidation(rule);
}

/**
 * ヘッダー行に標準スタイルを適用する（青背景・白文字・太字）。
 */
function applyHeaderStyle(sheet, numCols) {
  const range = sheet.getRange(1, 1, 1, numCols);
  range
    .setBackground('#1a73e8')
    .setFontColor('#ffffff')
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(true);
  sheet.setRowHeight(1, 40);
}

// ===== シート① 候補管理 =====

function setupSheet1_候補管理(ss) {
  const sheet = getOrCreateSheet(ss, '①候補管理');
  const DATA_ROWS = 200; // データ入力想定行数

  // ヘッダー
  const headers = [
    '登録日', 'コード', '銘柄名', '分類', '登録元',
    '登録理由', 'AI根拠ソース', '一次コメント', '判定ステータス', '最終アクション'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  applyHeaderStyle(sheet, headers.length);

  // 1行目固定・フィルタ
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).createFilter();

  // ドロップダウン
  setDropdown(sheet, 2, 4,  DATA_ROWS, ['A', 'B', 'C', 'D', 'E', 'TBD']); // 分類
  setDropdown(sheet, 2, 5,  DATA_ROWS, ['AI_UNIVERSE', 'AI_SCREENING', 'AI_NEWS', 'MANUAL_USER']); // 登録元
  setDropdown(sheet, 2, 7,  DATA_ROWS, ['UNIVERSE登録済み', 'SCREENING条件通過', '決算材料', 'ニュース材料', 'ユーザー注目銘柄']); // AI根拠ソース
  setDropdown(sheet, 2, 9,  DATA_ROWS, ['未判定', '判定済み']); // 判定ステータス
  setDropdown(sheet, 2, 10, DATA_ROWS, ['監視継続', '保留', '除外']); // 最終アクション

  // UNIVERSE.md 初期16銘柄をプリセット入力（登録元: AI_UNIVERSE）
  const today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  const universeStocks = [
    // [コード, 銘柄名, 分類]
    ['9843', 'ニトリHD',                    'A'],
    ['3064', 'MonotaRO',                   'A'],
    ['9432', '日本電信電話（NTT）',          'A'],
    ['4684', 'オービック',                   'B'],
    ['3769', 'GMOペイメントゲートウェイ',    'B'],
    ['4776', 'サイボウズ',                   'B'],
    ['4307', '野村総合研究所（NRI）',        'B'],
    ['6861', 'キーエンス',                   'C'],
    ['6954', 'ファナック',                   'C'],
    ['6273', 'SMC',                        'C'],
    ['6146', 'ディスコ',                    'C'],
    ['6869', 'シスメックス',                'D'],
    ['2413', 'エムスリー',                  'D'],
    ['4901', '富士フイルムHD',              'D'],
    ['8766', '東京海上HD',                  'E'],
    ['8473', 'SBIホールディングス',         'E'],
  ];

  const rowData = universeStocks.map(([code, name, category]) => [
    today,                  // A: 登録日
    code,                   // B: コード
    name,                   // C: 銘柄名
    category,               // D: 分類
    'AI_UNIVERSE',          // E: 登録元
    'UNIVERSE.md初期登録', // F: 登録理由
    'UNIVERSE登録済み',    // G: AI根拠ソース
    '',                     // H: 一次コメント
    '未判定',               // I: 判定ステータス
    '監視継続',             // J: 最終アクション
  ]);
  sheet.getRange(2, 1, rowData.length, headers.length).setValues(rowData);

  // 列幅
  sheet.setColumnWidth(1,  110); // 登録日
  sheet.setColumnWidth(2,   70); // コード
  sheet.setColumnWidth(3,  160); // 銘柄名
  sheet.setColumnWidth(4,   60); // 分類
  sheet.setColumnWidth(5,  140); // 登録元
  sheet.setColumnWidth(6,  180); // 登録理由
  sheet.setColumnWidth(7,  180); // AI根拠ソース
  sheet.setColumnWidth(8,  200); // 一次コメント
  sheet.setColumnWidth(9,  110); // 判定ステータス
  sheet.setColumnWidth(10, 110); // 最終アクション

  Logger.log('✅ シート① 候補管理 完了（16銘柄をプリセット入力済み）');
}

// ===== シート② スクリーニング記録 =====

function setupSheet2_スクリーニング記録(ss) {
  const sheet = getOrCreateSheet(ss, '②スクリーニング記録');
  const DATA_ROWS = 500;

  const headers = [
    '確認日', 'コード', '銘柄名', '分類',
    '株価>25日MA', '株価>75日MA', '1か月騰落>+5%', '出来高OK',
    '売上成長OK', '営利成長OK', 'PER≦50', '自己資本≧30%',
    '総合判定', '保留・除外理由', '監視メモ',
    '登録元', 'データ確認日', 'AIコメント'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  applyHeaderStyle(sheet, headers.length);

  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).createFilter();

  // ドロップダウン
  setDropdown(sheet, 2, 4, DATA_ROWS, ['A', 'B', 'C', 'D', 'E']); // 分類
  const maruBatu = ['○', '✕'];
  for (let col = 5; col <= 12; col++) {
    setDropdown(sheet, 2, col, DATA_ROWS, maruBatu); // テクニカル+ファンダ 8条件
  }
  setDropdown(sheet, 2, 13, DATA_ROWS, ['通過', '保留', '除外']); // 総合判定
  setDropdown(sheet, 2, 16, DATA_ROWS, ['AI_UNIVERSE', 'AI_SCREENING', 'AI_NEWS', 'MANUAL_USER']); // 登録元

  // 条件付き書式: 総合判定列に色付け
  const judgeRange = sheet.getRange(2, 13, DATA_ROWS, 1);
  const cfRules = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('通過').setBackground('#d9ead3').setRanges([judgeRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('保留').setBackground('#fff2cc').setRanges([judgeRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('除外').setBackground('#f4cccc').setRanges([judgeRange]).build(),
  ];
  sheet.setConditionalFormatRules(cfRules);

  // 列幅
  sheet.setColumnWidth(1,  110); // 確認日
  sheet.setColumnWidth(2,   70); // コード
  sheet.setColumnWidth(3,  140); // 銘柄名
  sheet.setColumnWidth(4,   60); // 分類
  for (let col = 5; col <= 12; col++) {
    sheet.setColumnWidth(col, 85); // 条件列8本
  }
  sheet.setColumnWidth(13, 90);  // 総合判定
  sheet.setColumnWidth(14, 200); // 保留・除外理由
  sheet.setColumnWidth(15, 200); // 監視メモ
  sheet.setColumnWidth(16, 140); // 登録元
  sheet.setColumnWidth(17, 110); // データ確認日
  sheet.setColumnWidth(18, 200); // AIコメント

  Logger.log('✅ シート② スクリーニング記録 完了');
}

// ===== シート③ 取引記録 =====

function setupSheet3_取引記録(ss) {
  const sheet = getOrCreateSheet(ss, '③取引記録');
  const DATA_ROWS = 500;

  const headers = [
    '日付', '種別', 'コード', '銘柄名', '売買区分',
    '取引単価', '数量', '取引金額',
    '損切りライン', '部分利確ライン', '全利確ライン',
    '損益（円）', '損益（%）', 'エグジット理由', 'エントリー根拠・メモ'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  applyHeaderStyle(sheet, headers.length);

  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).createFilter();

  // ドロップダウン
  setDropdown(sheet, 2, 2, DATA_ROWS, ['ペーパー', '実取引']); // 種別
  setDropdown(sheet, 2, 5, DATA_ROWS, ['買', '売（部分）', '売（全）']); // 売買区分
  setDropdown(sheet, 2, 14, DATA_ROWS, ['損切り', '部分利確', '全利確', '期間利確', '根拠消滅']); // エグジット理由

  // 自動計算列 (ARRAYFORMULA で一括設定)
  // H列: 取引金額 = 取引単価 × 数量
  sheet.getRange(2, 8).setFormula(
    '=ARRAYFORMULA(IF(F2:F="","",F2:F*G2:G))'
  );

  // 条件付き書式: 種別列（ペーパーは薄い青）
  const kindRange = sheet.getRange(2, 2, DATA_ROWS, 1);
  sheet.setConditionalFormatRules([
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('ペーパー').setBackground('#e8f0fe').setRanges([kindRange]).build(),
  ]);

  // 列幅
  sheet.setColumnWidth(1,  110); // 日付
  sheet.setColumnWidth(2,   90); // 種別
  sheet.setColumnWidth(3,   70); // コード
  sheet.setColumnWidth(4,  140); // 銘柄名
  sheet.setColumnWidth(5,  100); // 売買区分
  sheet.setColumnWidth(6,   90); // 取引単価
  sheet.setColumnWidth(7,   70); // 数量
  sheet.setColumnWidth(8,  100); // 取引金額
  sheet.setColumnWidth(9,  110); // 損切りライン
  sheet.setColumnWidth(10, 120); // 部分利確ライン
  sheet.setColumnWidth(11,  90); // 全利確ライン
  sheet.setColumnWidth(12, 100); // 損益（円）
  sheet.setColumnWidth(13,  90); // 損益（%）
  sheet.setColumnWidth(14, 110); // エグジット理由
  sheet.setColumnWidth(15, 220); // エントリー根拠・メモ

  Logger.log('✅ シート③ 取引記録 完了');
}

// ===== シート④ チャート型記録 =====

function setupSheet4_チャート型記録(ss) {
  const sheet = getOrCreateSheet(ss, '④チャート型記録');
  const DATA_ROWS = 500;

  const headers = [
    '記録日', 'コード', '銘柄名', '分類', 'チャート型',
    'エントリー理由', 'ルール通過状況', 'エントリー価格',
    '損切りライン', '利確ルール', '結果', '損益率（%）',
    '失敗/成功理由', '振り返りメモ'
  ];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  applyHeaderStyle(sheet, headers.length);

  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).createFilter();

  // ドロップダウン
  setDropdown(sheet, 2, 4, DATA_ROWS, ['A', 'B', 'C', 'D', 'E']); // 分類
  setDropdown(sheet, 2, 5, DATA_ROWS, [ // チャート型
    '25日線上の押し目',
    '75日線上抜け後の初押し',
    '高値更新ブレイク',
    '出来高を伴うボックス上抜け',
    '決算後ギャップアップ継続',
    '25日線割れ反発失敗',
    'その他'
  ]);
  setDropdown(sheet, 2, 7,  DATA_ROWS, ['通過', '一部未確認', '特例']); // ルール通過状況
  setDropdown(sheet, 2, 10, DATA_ROWS, ['標準（+10%部分/+20%全）', 'その他']); // 利確ルール
  setDropdown(sheet, 2, 11, DATA_ROWS, ['勝ち', '負け', '保留']); // 結果

  // 損切りラインを自動計算（I列: エントリー価格 × 0.95）
  sheet.getRange(2, 9).setFormula(
    '=ARRAYFORMULA(IF(H2:H="","",ROUND(H2:H*0.95,0)))'
  );

  // 条件付き書式: 結果列に色付け
  const resultRange = sheet.getRange(2, 11, DATA_ROWS, 1);
  const cfRules = [
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('勝ち').setBackground('#d9ead3').setRanges([resultRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('負け').setBackground('#f4cccc').setRanges([resultRange]).build(),
    SpreadsheetApp.newConditionalFormatRule()
      .whenTextEqualTo('保留').setBackground('#fff2cc').setRanges([resultRange]).build(),
  ];
  sheet.setConditionalFormatRules(cfRules);

  // 列幅
  sheet.setColumnWidth(1,  110); // 記録日
  sheet.setColumnWidth(2,   70); // コード
  sheet.setColumnWidth(3,  140); // 銘柄名
  sheet.setColumnWidth(4,   60); // 分類
  sheet.setColumnWidth(5,  200); // チャート型
  sheet.setColumnWidth(6,  200); // エントリー理由
  sheet.setColumnWidth(7,  120); // ルール通過状況
  sheet.setColumnWidth(8,  110); // エントリー価格
  sheet.setColumnWidth(9,  100); // 損切りライン（自動計算）
  sheet.setColumnWidth(10, 200); // 利確ルール
  sheet.setColumnWidth(11,  80); // 結果
  sheet.setColumnWidth(12, 100); // 損益率（%）
  sheet.setColumnWidth(13, 200); // 失敗/成功理由
  sheet.setColumnWidth(14, 220); // 振り返りメモ

  Logger.log('✅ シート④ チャート型記録 完了');
}
