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
 * コンテナバインド時は getActiveSpreadsheet() を優先する。
 * スタンドアロン実行時のみ Config.gs の SPREADSHEET_ID（またはスクリプトプロパティ）を使う。
 *
 * @returns {SpreadsheetApp.Spreadsheet}
 * @throws {Error} ID が未設定の場合
 */
function getSpreadsheet() {
  var active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;

  var id = getSpreadsheetId();
  if (!id || id === 'YOUR_SPREADSHEET_ID_HERE') {
    throw new Error(
      '[Config.gs の SPREADSHEET_ID が未設定です]\n' +
      'スタンドアロン実行時は以下のいずれかを設定してください：\n' +
      '1. GASエディタ → プロジェクト設定 → スクリプトプロパティ → SPREADSHEET_ID = <スプレッドシートID>\n' +
      '2. Config.gs の getSpreadsheetId() のフォールバック値を実際のIDに変更'
    );
  }
  return SpreadsheetApp.openById(id);
}

/**
 * 指定シートオブジェクトを取得する
 *
 * @param {string} sheetName - シート名（SHEET_NAMES参照）
 * @returns {SpreadsheetApp.Sheet}
 * @throws {Error} シートが存在しない場合
 */
function getSheet(sheetName) {
  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('シートが見つかりません: ' + sheetName);
  return sheet;
}

/**
 * シートの全データをオブジェクト配列として取得する
 *
 * 1行目をヘッダーとして使い、2行目以降をオブジェクトに変換する。
 * 全列が空の行はスキップする。
 *
 * @param {string} sheetName
 * @returns {Object[]} 行データのオブジェクト配列（各オブジェクトに _rowIndex プロパティあり）
 */
function getSheetData(sheetName) {
  var sheet = getSheet(sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var data = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  var headers = data[0];
  var rows = [];

  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var isEmpty = row.every(function(cell) { return cell === '' || cell === null; });
    if (isEmpty) continue;
    var obj = { _rowIndex: i + 1 };
    headers.forEach(function(header, j) {
      obj[header] = row[j];
    });
    rows.push(obj);
  }
  return rows;
}

/**
 * シートに新しい行を追加する
 *
 * rowData のキーはヘッダー名と一致している必要がある。
 * ヘッダーにないキーは無視する。ヘッダーにあってrowDataにないキーは空文字になる。
 *
 * @param {string} sheetName
 * @param {Object} rowData - { フィールド名: 値 }
 * @returns {number} 追加した行番号（1-based）
 */
function appendRow(sheetName, rowData) {
  var sheet = getSheet(sheetName);
  var headers = getHeaders(sheetName);
  var row = headers.map(function(header) {
    return rowData.hasOwnProperty(header) ? rowData[header] : '';
  });
  sheet.appendRow(row);
  return sheet.getLastRow();
}

/**
 * 指定キーと値で行を検索する
 *
 * @param {string} sheetName
 * @param {string} keyColumn - 検索対象の列名
 * @param {string} keyValue - 検索値
 * @returns {Object|null} 一致した行オブジェクト（_rowIndex付き）。見つからない場合はnull
 */
function findRowByKey(sheetName, keyColumn, keyValue) {
  var sheet = getSheet(sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  var data = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  var headers = data[0];
  var keyColIndex = headers.indexOf(keyColumn);
  if (keyColIndex === -1) throw new Error('列が見つかりません: ' + keyColumn + ' in ' + sheetName);

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][keyColIndex]) === String(keyValue)) {
      var obj = { _rowIndex: i + 1 };
      headers.forEach(function(header, j) { obj[header] = data[i][j]; });
      return obj;
    }
  }
  return null;
}

/**
 * 指定キーで行を更新する
 *
 * updateData に含まれるフィールドのみ更新する。
 * 一致する行が見つからない場合は false を返す。
 *
 * @param {string} sheetName
 * @param {string} keyColumn - 主キーの列名
 * @param {string} keyValue - 主キーの値
 * @param {Object} updateData - { フィールド名: 新しい値 }
 * @returns {boolean} 更新成功時true
 */
function updateRowByKey(sheetName, keyColumn, keyValue, updateData) {
  var sheet = getSheet(sheetName);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  var data = sheet.getRange(1, 1, lastRow, sheet.getLastColumn()).getValues();
  var headers = data[0];
  var keyColIndex = headers.indexOf(keyColumn);
  if (keyColIndex === -1) throw new Error('列が見つかりません: ' + keyColumn + ' in ' + sheetName);

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][keyColIndex]) === String(keyValue)) {
      var rowNum = i + 1;
      Object.keys(updateData).forEach(function(field) {
        var colIndex = headers.indexOf(field);
        if (colIndex !== -1) {
          sheet.getRange(rowNum, colIndex + 1).setValue(updateData[field]);
        }
      });
      return true;
    }
  }
  return false;
}

/**
 * Settingsシートから設定値を取得する
 *
 * @param {string} settingKey - 設定キー（setting_key列の値）
 * @returns {string} 設定値（setting_value列の値）
 * @throws {Error} キーが存在しない場合
 */
function getSetting(settingKey) {
  var sheet = getSheet(SHEET_NAMES.SETTINGS);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) throw new Error('Settingsシートにデータがありません');

  var data = sheet.getRange(2, 1, lastRow - 1, 2).getValues();
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]) === settingKey) return String(data[i][1]);
  }
  throw new Error('設定キーが見つかりません: ' + settingKey);
}

/**
 * 指定シートのヘッダー行を取得する
 *
 * @param {string} sheetName
 * @returns {string[]} ヘッダーの配列
 */
function getHeaders(sheetName) {
  var sheet = getSheet(sheetName);
  var lastCol = sheet.getLastColumn();
  if (lastCol === 0) return [];
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0];
}

/**
 * 一意IDを生成する（UUIDv4形式）
 *
 * @returns {string} UUID文字列
 */
function generateId() {
  return Utilities.getUuid();
}

/**
 * 現在日時をISO8601形式で返す
 *
 * @returns {string} ISO8601文字列
 */
function nowIso() {
  return new Date().toISOString();
}
