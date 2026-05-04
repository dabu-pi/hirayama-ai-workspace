/**
 * ワイルドボア会員管理システム — スプレッドシート操作共通関数
 *
 * Google Sheetsの読み書き操作をラップした共通ユーティリティ。
 * 全サービスからこのモジュールを経由してシートにアクセスする。
 *
 * 依存：Config.gs
 */

/**
 * スプレッドシートオブジェクトを取得する
 *
 * @returns {SpreadsheetApp.Spreadsheet} スプレッドシートオブジェクト
 */
function getSpreadsheet() {
  // TODO: Phase 1 で実装する
  return SpreadsheetApp.openById(getSpreadsheetId());
}

/**
 * 指定したシートオブジェクトを取得する
 *
 * @param {string} sheetName - シート名（SHEET_NAMES参照）
 * @returns {SpreadsheetApp.Sheet} シートオブジェクト
 * @throws {Error} シートが存在しない場合
 */
function getSheet(sheetName) {
  // TODO: Phase 1 で実装する
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('シートが見つかりません: ' + sheetName);
  }
  return sheet;
}

/**
 * シートの全データをオブジェクトの配列として取得する
 *
 * 1行目をヘッダーとして使い、2行目以降をオブジェクトに変換する。
 *
 * @param {string} sheetName - シート名
 * @returns {Object[]} 行データのオブジェクト配列
 */
function getSheetData(sheetName) {
  // TODO: Phase 1 で実装する
  // 1. getSheet でシートを取得する
  // 2. getValues でデータを取得する
  // 3. 1行目をキーとして各行をオブジェクトに変換する
  // 4. 空行はスキップする
  throw new Error('未実装: SheetService.getSheetData');
}

/**
 * シートに新しい行を追加する
 *
 * @param {string} sheetName - シート名
 * @param {Object} rowData - 追加するデータ（キーはヘッダー名）
 * @returns {number} 追加した行番号
 */
function appendRow(sheetName, rowData) {
  // TODO: Phase 1 で実装する
  // 1. getSheet でシートを取得する
  // 2. ヘッダー行を取得して列順を確認する
  // 3. ヘッダー順にデータを配列に変換する
  // 4. appendRow で追加する
  throw new Error('未実装: SheetService.appendRow');
}

/**
 * 指定したキーと値で行を検索する
 *
 * @param {string} sheetName - シート名
 * @param {string} keyColumn - 検索するキー列名
 * @param {string} keyValue - 検索する値
 * @returns {Object|null} 一致した行のオブジェクト、見つからない場合はnull
 */
function findRowByKey(sheetName, keyColumn, keyValue) {
  // TODO: Phase 1 で実装する
  throw new Error('未実装: SheetService.findRowByKey');
}

/**
 * 指定した行を更新する
 *
 * @param {string} sheetName - シート名
 * @param {string} keyColumn - 主キーの列名
 * @param {string} keyValue - 主キーの値
 * @param {Object} updateData - 更新するフィールドと値
 * @returns {boolean} 成功した場合はtrue
 */
function updateRowByKey(sheetName, keyColumn, keyValue, updateData) {
  // TODO: Phase 1 で実装する
  throw new Error('未実装: SheetService.updateRowByKey');
}

/**
 * シートの設定値を取得する（Settingsシート専用）
 *
 * @param {string} settingKey - 設定キー
 * @returns {string} 設定値
 * @throws {Error} キーが存在しない場合
 */
function getSetting(settingKey) {
  // TODO: Phase 1 で実装する
  // Settingsシートからsetting_keyに対応するsetting_valueを返す
  throw new Error('未実装: SheetService.getSetting');
}

/**
 * 指定したシートのヘッダー行を取得する
 *
 * @param {string} sheetName - シート名
 * @returns {string[]} ヘッダーの配列
 */
function getHeaders(sheetName) {
  // TODO: Phase 1 で実装する
  var sheet = getSheet(sheetName);
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0];
}
