/**
 * ============================================================
 * Apps Script エディタから手動実行する場合はこちらを選択する。
 * 関数選択プルダウンで「runSetupAll」を選んで「実行」ボタンをクリック。
 * ============================================================
 */
function runSetupAll() {
  setupAll_();
}

/**
 * ============================================================
 * JREC-SF01 自費カルテ・会計システム — 初期セットアップスクリプト
 * ============================================================
 * 設計書 : docs/SHEET_DESIGN_v1.md v1.0
 * 対象SS : https://docs.google.com/spreadsheets/d/15O2AIWv1OyZAXdCOWoz1-OxVukuFttHoZydsCDlYPX0
 *
 * 【実行方法】
 *   1. 対象スプレッドシートを開く
 *   2. 拡張機能 > Apps Script を開く
 *   3. このコードを貼り付けて保存（Ctrl+S）
 *   4. 関数「setupAll_」を選択して「実行」ボタンをクリック
 *
 * 【再実行時の動作】
 *   - シートが存在しない場合 : 新規作成
 *   - シートが存在する場合   : ヘッダー・書式のみ更新。データ行は保持
 *   - MenuMaster / Settings  : データが空の場合のみ初期データを投入
 *
 * 【注意】
 *   - clasp push / deploy は実施しない（コード確認後に手動で行う）
 *   - 既存 JREC-01（jyu-gas-ver3.1）には一切触れない
 *   - .env / secret は参照・表示しない
 */

"use strict";

// ============================================================
// 定数
// ============================================================

var SPREADSHEET_ID = "15O2AIWv1OyZAXdCOWoz1-OxVukuFttHoZydsCDlYPX0";

var SHEET_NAMES = {
  SETTINGS       : "Settings",
  PATIENTS       : "Patients",
  VISITS         : "SelfPayVisits",
  CHART          : "SelfPayChart",
  ITEMS          : "SelfPayItems",
  PAYMENTS       : "Payments",
  RECEIPTS       : "Receipts",
  MENU_MASTER    : "MenuMaster",
  DAILY_SALES    : "DailySales",
  RUN_LOG        : "Run_Log",
};

// ヘッダー色
var COLOR = {
  HEADER_BG     : "#263238",
  HEADER_FG     : "#FFFFFF",
  ACTIVE_ROW    : "#E8F5E9",   // 有効フラグ TRUE
  INACTIVE_ROW  : "#FAFAFA",   // 有効フラグ FALSE
};

// ============================================================
// Settings 初期データ
// ============================================================

var SETTINGS_INITIAL = [
  ["clinic_name",          "平山接骨院",  "院名（領収書・画面タイトル用）"],
  ["tax_rate",             "0.10",        "消費税率（10%）"],
  ["tax_rounding",         "floor",       "端数処理（floor=切り捨て / round=四捨五入 / ceil=切り上げ）"],
  ["tax_unit",             "item",        "税計算単位（item=明細行ごと / total=合計一括）"],
  ["patient_id_prefix",    "P",           "患者IDプレフィックス"],
  ["patient_id_digits",    "4",           "患者ID連番の桁数"],
  ["receipt_no_prefix",    "R",           "領収書番号プレフィックス"],
  ["receipt_no_digits",    "4",           "領収書番号の桁数"],
  ["receipt_no_reset",     "yearly",      "領収書番号リセット単位（yearly=年度ごと / never=リセットなし）"],
  ["default_tax_category", "課税",        "会計明細のデフォルト税区分"],
  ["selfpay_spreadsheet_id", SPREADSHEET_ID, "本スプレッドシートのID（自己参照）"],
  ["version",              "1.0",         "設定バージョン"],
];

// ============================================================
// MenuMaster 初期データ（15件）
// カラム順: menuCode / メニュー名 / 標準時間 / 税別価格 / 税込価格 / カテゴリ / 有効フラグ / 表示順 / 備考
// ============================================================

var MENU_MASTER_INITIAL = [
  // ── 主力自費メニュー（有効）────────────────────────────────
  ["SELFPAY_INITIAL_FULL",        "初回標準施術",                   48,  5000, 5500, "主力",       true,  10,  "初回のみ。初診料込みのフルパッケージ"],
  ["SELFPAY_CONTINUE20",          "継続標準施術",                   33,  3500, 3850, "主力",       true,  20,  "主力（KPI基準単価）。物療2種+手技"],
  ["SELFPAY_MAINT15",             "メンテナンス施術",               23,  2500, 2750, "主力",       true,  30,  "軽度症状・維持管理向け"],
  // ── 自費個別パーツ（有効）────────────────────────────────
  ["SELFPAY_FIRST_FEE15",         "初診料",                         15,  1500, 1650, "個別パーツ", true,  40,  "初回標準施術に含む"],
  ["SELFPAY_IFC10",               "干渉波",                         10,  1000, 1100, "個別パーツ", true,  50,  ""],
  ["SELFPAY_MICROCURRENT",        "マイクロカレント",               10,  1000, 1100, "個別パーツ", true,  60,  ""],
  ["SELFPAY_HIGHVOLTAGE",         "ハイボルテージ",                  5,   500,  550, "個別パーツ", true,  70,  "2026-04-25 価格1,000→500に訂正"],
  ["SELFPAY_ULTRASOUND",          "超音波",                          5,   500,  550, "個別パーツ", true,  80,  ""],
  ["SELFPAY_MANUAL3",             "手技",                            3,   500,  550, "個別パーツ", true,  90,  "軟膏塗布込み対応可"],
  // ── 評価入口（有効・要現場確認）──────────────────────────
  ["SELFPAY_EVAL_LOWBACK30",      "腰痛改善 運動療法 初回評価",    30,  3300, 3630, "評価入口",   true, 100,  "初回限定。導線商品。※要現場確認"],
  ["SELFPAY_EVAL_NECKSHOULDER30", "首肩こり改善 運動療法 初回評価",30,  3300, 3630, "評価入口",   true, 110,  "初回限定。導線商品。※要現場確認"],
  ["SELFPAY_EVAL_KNEE30",         "膝改善 運動療法 初回評価",      30,  3300, 3630, "評価入口",   true, 120,  "初回限定。導線商品。※要現場確認"],
  // ── 特別対応・保留・運動再教育（無効）────────────────────
  ["SELFPAY_CHRONIC50",           "慢性ケア手技50分",              50,  5500, 6050, "特別対応",   false, 200, "特別対応/保留。主力フラグ外れ済み"],
  ["SELFPAY_PT60",                "パーソナルトレーニング",         60,  8800, 9680, "運動再教育", false, 210, "要確認。実運用中なら有効フラグをTRUEに変更"],
  ["TRAINING_4PASS",              "4回集中コース",                 240, 35200, 38720,"運動再教育", false, 220, "価格見直し保留中"],
];

// ============================================================
// メインエントリ
// ============================================================

/**
 * 全シートの初期セットアップを実行する。
 * スプレッドシートを開き、各シートを作成 or 更新する。
 */
function setupAll_() {
  var ss = getTargetSpreadsheet_();
  var now = new Date();

  log_("setupAll_ 開始", "", "", now);

  setupSettings_(ss);
  setupPatients_(ss);
  setupSelfPayVisits_(ss);
  setupSelfPayChart_(ss);
  setupSelfPayItems_(ss);
  setupPayments_(ss);
  setupReceipts_(ss);
  setupMenuMaster_(ss);
  setupDailySales_(ss);
  setupRunLog_(ss);

  log_("setupAll_ 完了", "", "", now);

  SpreadsheetApp.getUi().alert(
    "✅ JREC-SF01 初期セットアップ完了\n\n" +
    "作成・更新したシート:\n" +
    "  Settings / Patients / SelfPayVisits / SelfPayChart\n" +
    "  SelfPayItems / Payments / Receipts / MenuMaster\n" +
    "  DailySales / Run_Log\n\n" +
    "次のステップ:\n" +
    "・Settings シートの各値を確認する\n" +
    "・MenuMaster の評価入口3メニューの有効フラグを院長に確認する\n" +
    "・パーソナルトレーニング・4回集中コースの有効フラグを確認する"
  );
}

// ============================================================
// Settings
// ============================================================

function setupSettings_(ss) {
  var sh = getOrCreateSheet_(ss, SHEET_NAMES.SETTINGS);

  // ヘッダー
  var headers = [["key", "value", "説明"]];
  setHeaders_(sh, headers, [180, 260, 400]);

  // 初期データ（空の場合のみ投入）
  if (sh.getLastRow() < 2) {
    sh.getRange(2, 1, SETTINGS_INITIAL.length, 3).setValues(SETTINGS_INITIAL);
    applyAlternateRowColor_(sh, 2, SETTINGS_INITIAL.length, "#F5F5F5", "#FFFFFF");
    Logger.log("[Settings] 初期データを投入しました（" + SETTINGS_INITIAL.length + "行）");
  } else {
    Logger.log("[Settings] データあり。スキップ。");
  }

  sh.setFrozenRows(1);
}

// ============================================================
// Patients
// ============================================================

function setupPatients_(ss) {
  var sh = getOrCreateSheet_(ss, SHEET_NAMES.PATIENTS);

  var headers = [["patientId", "氏名", "フリガナ", "生年月日", "性別", "電話番号", "住所", "備考", "jrecPatientId", "createdAt", "updatedAt"]];
  setHeaders_(sh, headers, [80, 120, 120, 110, 70, 130, 200, 200, 120, 160, 160]);

  // 性別プルダウン
  applyDropdown_(sh, 2, 5, 200, ["男性", "女性", "その他"]);

  sh.setFrozenRows(1);
}

// ============================================================
// SelfPayVisits
// ============================================================

function setupSelfPayVisits_(ss) {
  var sh = getOrCreateSheet_(ss, SHEET_NAMES.VISITS);

  var headers = [["selfPayVisitKey", "patientId", "来院日", "来院区分", "担当者", "主訴", "VAS", "次回方針", "会計状態", "createdAt", "updatedAt", "isDeleted", "deletedAt", "deleteReason"]];
  setHeaders_(sh, headers, [200, 80, 100, 80, 90, 260, 50, 200, 80, 160, 160, 80, 160, 200]);

  // 来院区分プルダウン
  applyDropdown_(sh, 2, 4, 200, ["初診", "再診"]);
  // 会計状態プルダウン
  applyDropdown_(sh, 2, 9, 200, ["未会計", "会計済", "未収"]);
  // isDeleted チェックボックス
  sh.getRange(2, 12, 200, 1).insertCheckboxes();

  sh.setFrozenRows(1);
}

/**
 * 既存 SelfPayVisits シートにゴミ箱列（col 12-14）を追加する。
 * Phase 6-B 導入時に Apps Script エディタから1回手動実行する。
 * 列が既に存在する場合はスキップして ok:true を返す。
 * @returns {{ ok: boolean, message: string }}
 */
function runAddTrashColumns() {
  var sh = getTargetSpreadsheet_().getSheetByName(SHEET_NAMES.VISITS);
  if (!sh) {
    Logger.log("[runAddTrashColumns] SelfPayVisits シートが見つかりません");
    return { ok: false, message: "SelfPayVisits シートが見つかりません" };
  }
  var lastCol = sh.getLastColumn();
  if (lastCol >= 12) {
    Logger.log("[runAddTrashColumns] 既に " + lastCol + " 列あります。スキップ。");
    return { ok: true, message: "既に列が存在します（" + lastCol + " 列）。スキップしました。" };
  }
  sh.getRange(1, 12).setValue("isDeleted");
  sh.getRange(1, 13).setValue("deletedAt");
  sh.getRange(1, 14).setValue("deleteReason");
  sh.setColumnWidth(12, 80);
  sh.setColumnWidth(13, 160);
  sh.setColumnWidth(14, 200);
  if (sh.getLastRow() >= 2) {
    sh.getRange(2, 12, sh.getLastRow() - 1, 1).insertCheckboxes();
  }
  Logger.log("[runAddTrashColumns] isDeleted / deletedAt / deleteReason 追加完了");
  return { ok: true, message: "isDeleted / deletedAt / deleteReason 列を追加しました" };
}

// ============================================================
// SelfPayChart
// ============================================================

function setupSelfPayChart_(ss) {
  var sh = getOrCreateSheet_(ss, SHEET_NAMES.CHART);

  var headers = [["chartId", "selfPayVisitKey", "評価", "所見", "施術内容", "使用機器", "説明内容", "禁忌確認", "生活指導", "次回予定", "createdAt", "updatedAt"]];
  setHeaders_(sh, headers, [200, 200, 200, 200, 240, 160, 200, 100, 200, 200, 160, 160]);

  sh.setFrozenRows(1);
}

// ============================================================
// SelfPayItems
// ============================================================

function setupSelfPayItems_(ss) {
  var sh = getOrCreateSheet_(ss, SHEET_NAMES.ITEMS);

  var headers = [["itemId", "selfPayVisitKey", "menuCode", "メニュー名", "数量", "単価（税別）", "税区分", "小計（税別）", "消費税額", "小計（税込）", "createdAt"]];
  setHeaders_(sh, headers, [220, 200, 200, 200, 50, 100, 70, 100, 100, 100, 160]);

  // 税区分プルダウン
  applyDropdown_(sh, 2, 7, 200, ["課税", "非課税"]);

  sh.setFrozenRows(1);
}

// ============================================================
// Payments
// ============================================================

function setupPayments_(ss) {
  var sh = getOrCreateSheet_(ss, SHEET_NAMES.PAYMENTS);

  // col 11: paidAmount = 実際に入金された累積額。新規追加。
  // outstandingAmount = max(税込合計 - paidAmount, 0) で計算可能。
  var headers = [["paymentId", "selfPayVisitKey", "税別合計", "消費税額合計", "税込合計", "支払方法", "入金状態", "入金日", "メモ", "createdAt", "paidAmount"]];
  setHeaders_(sh, headers, [200, 200, 90, 100, 90, 110, 90, 100, 200, 160, 100]);

  // 支払方法プルダウン
  applyDropdown_(sh, 2, 6, 200, ["現金", "カード", "電子マネー", "未収"]);
  // 入金状態プルダウン
  applyDropdown_(sh, 2, 7, 200, ["入金済", "未収", "一部入金"]);

  sh.setFrozenRows(1);
}

// ============================================================
// Receipts
// ============================================================

function setupReceipts_(ss) {
  var sh = getOrCreateSheet_(ss, SHEET_NAMES.RECEIPTS);

  var headers = [["receiptId", "selfPayVisitKey", "receiptNo", "発行日", "宛名", "金額（税込）", "消費税額", "但し書き", "再発行回数", "createdAt"]];
  setHeaders_(sh, headers, [160, 200, 120, 100, 120, 110, 100, 200, 100, 160]);

  sh.setFrozenRows(1);
}

// ============================================================
// MenuMaster
// ============================================================

function setupMenuMaster_(ss) {
  var sh = getOrCreateSheet_(ss, SHEET_NAMES.MENU_MASTER);

  var headers = [["menuCode", "メニュー名", "標準時間(分)", "税別価格", "税込価格(参考)", "カテゴリ", "有効フラグ", "表示順", "備考"]];
  setHeaders_(sh, headers, [220, 220, 100, 90, 110, 100, 80, 70, 280]);

  // 初期データ（空の場合のみ投入）
  if (sh.getLastRow() < 2) {
    sh.getRange(2, 1, MENU_MASTER_INITIAL.length, 9).setValues(MENU_MASTER_INITIAL);

    // 有効フラグ列の背景色（TRUE=薄緑 / FALSE=薄グレー）
    for (var i = 0; i < MENU_MASTER_INITIAL.length; i++) {
      var isActive = MENU_MASTER_INITIAL[i][6];
      var rowBg = isActive ? COLOR.ACTIVE_ROW : COLOR.INACTIVE_ROW;
      sh.getRange(2 + i, 1, 1, 9).setBackground(rowBg);
    }

    Logger.log("[MenuMaster] 初期データを投入しました（" + MENU_MASTER_INITIAL.length + "件）");
  } else {
    Logger.log("[MenuMaster] データあり。スキップ。");
  }

  // カテゴリプルダウン
  applyDropdown_(sh, 2, 6, 200, ["主力", "個別パーツ", "評価入口", "特別対応", "運動再教育"]);

  // 有効フラグチェックボックス（上書きしない — 既存チェック値は保持）
  // ※ insertCheckboxes は既存値がある場合は書式のみ更新
  sh.getRange(2, 7, 200, 1).insertCheckboxes();

  sh.setFrozenRows(1);
}

// ============================================================
// DailySales
// ============================================================

function setupDailySales_(ss) {
  var sh = getOrCreateSheet_(ss, SHEET_NAMES.DAILY_SALES);

  var headers = [["日付", "来院数", "売上合計（税込）", "売上合計（税別）", "消費税合計", "未収発生額", "未収回収額", "主力来院数", "備考"]];
  setHeaders_(sh, headers, [100, 70, 130, 130, 100, 110, 110, 100, 200]);

  sh.setFrozenRows(1);
}

// ============================================================
// Run_Log
// ============================================================

function setupRunLog_(ss) {
  var sh = getOrCreateSheet_(ss, SHEET_NAMES.RUN_LOG);

  var headers = [["timestamp", "action", "selfPayVisitKey", "patientId", "result", "detail", "operator"]];
  setHeaders_(sh, headers, [160, 160, 200, 80, 80, 400, 90]);

  sh.setFrozenRows(1);
}

// ============================================================
// ユーティリティ: シート取得・作成
// ============================================================

/**
 * シートを取得する。なければ末尾に新規作成して返す。
 * 既存シートの場合は何もせずそのまま返す。
 */
function getOrCreateSheet_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    Logger.log("[" + name + "] 新規作成");
  } else {
    Logger.log("[" + name + "] 既存シートを使用");
  }
  return sh;
}

/**
 * ヘッダー行を書き込み、書式を設定する。
 * @param {Sheet}    sh      対象シート
 * @param {Array}    headers [[col1, col2, ...]] 形式の1行
 * @param {number[]} widths  各列の幅（px）
 */
function setHeaders_(sh, headers, widths) {
  var numCols = headers[0].length;

  // ヘッダー書き込み（常に上書き）
  sh.getRange(1, 1, 1, numCols).setValues(headers);

  // 書式
  var headerRange = sh.getRange(1, 1, 1, numCols);
  headerRange
    .setBackground(COLOR.HEADER_BG)
    .setFontColor(COLOR.HEADER_FG)
    .setFontWeight("bold")
    .setFontSize(10)
    .setVerticalAlignment("middle")
    .setHorizontalAlignment("center")
    .setWrap(false);
  sh.setRowHeight(1, 30);

  // 列幅
  for (var i = 0; i < widths.length && i < numCols; i++) {
    sh.setColumnWidth(i + 1, widths[i]);
  }
}

/**
 * ドロップダウン入力規則を設定する。
 * @param {Sheet}    sh       対象シート
 * @param {number}   startRow 開始行（1-indexed）
 * @param {number}   col      列番号（1-indexed）
 * @param {number}   numRows  適用行数
 * @param {string[]} choices  選択肢
 */
function applyDropdown_(sh, startRow, col, numRows, choices) {
  sh.getRange(startRow, col, numRows, 1).setDataValidation(
    SpreadsheetApp.newDataValidation()
      .requireValueInList(choices, true)
      .setAllowInvalid(false)
      .build()
  );
}

/**
 * 行に交互背景色を設定する。
 */
function applyAlternateRowColor_(sh, startRow, numRows, oddColor, evenColor) {
  for (var i = 0; i < numRows; i++) {
    var bg = (i % 2 === 0) ? oddColor : evenColor;
    sh.getRange(startRow + i, 1, 1, sh.getLastColumn() || 1).setBackground(bg);
  }
}

// ============================================================
// ユーティリティ: スプレッドシート取得
// ============================================================

/**
 * 対象スプレッドシートを取得する。
 * container-bound の場合は active を使い、スタンドアロンの場合は openById を使う。
 */
function getTargetSpreadsheet_() {
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active && active.getId() === SPREADSHEET_ID) {
      return active;
    }
  } catch (e) {
    // 時間ベーストリガー等では getActiveSpreadsheet() が使えない
  }

  try {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch (e) {
    throw new Error(
      "スプレッドシートを開けませんでした。\n" +
      "ID: " + SPREADSHEET_ID + "\n" +
      "エラー: " + e.message
    );
  }
}

// ============================================================
// ユーティリティ: Run_Log への記録
// ============================================================

/**
 * Run_Log シートにログを記録する。
 * シートが存在しない場合はスキップ（初期セットアップ中のためエラーにしない）。
 */
function log_(action, visitKey, patientId, timestamp) {
  try {
    var ss = getTargetSpreadsheet_();
    var sh = ss.getSheetByName(SHEET_NAMES.RUN_LOG);
    if (!sh) { return; }
    sh.appendRow([
      timestamp || new Date(),
      action,
      visitKey  || "",
      patientId || "",
      "SUCCESS",
      "",
      Session.getActiveUser().getEmail() || "setup"
    ]);
  } catch (e) {
    Logger.log("[Run_Log] 書き込み失敗（スキップ）: " + e.message);
  }
}
