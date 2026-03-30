/**
 * ============================================================
 * JREC-01 運用ポータル セットアップスクリプト
 * ============================================================
 * 設計書 : docs/JREC-01_運用ポータル_シート設計.md v1.1
 * 対象SS : https://docs.google.com/spreadsheets/d/121BkW7jEnKUjmU_NNVAPyJRs_UVmmoqkHDPMHL-RJeA
 *
 * 【実行方法】
 *   1. 対象スプレッドシートを開く
 *   2. 拡張機能 > Apps Script を開く
 *   3. このコードを貼り付けて保存（Ctrl+S）
 *   4. 関数「setupOperationPortal_」を選択して「実行」ボタンをクリック
 *      または スプレッドシート上の「運用ポータル」メニューから実行
 *
 * 【再実行時の動作】
 *   - シートが存在しない場合  : 新規作成 → 書式設定 → 初期データ挿入
 *   - シートが存在する場合    : 書式・入力規則のみ更新（データ行は保持）
 *   - データもリセットしたい  : メニュー「データ行をリセット（要注意）」を使う
 *
 * 【更新履歴】
 *   2026-03-30  v1.0  初版作成（13列 / 新患フロー最小セット11行）
 *   2026-03-30  v1.1  onEdit(e) 追加（H列変更時に背景色を自動更新）
 *               applyRowColorsForRows_() を共通ロジックとして切り出し
 */

"use strict";

// ============================================================
// 定数
// ============================================================

var SPREADSHEET_ID    = "121BkW7jEnKUjmU_NNVAPyJRs_UVmmoqkHDPMHL-RJeA";
var PORTAL_SHEET_NAME = "運用ポータル";
var FIELD_FLOW_SHEET_NAME = "現場フロー";
var DATA_START_ROW    = 2;      // 1行目はヘッダー
var NUM_COLS          = 13;     // A〜M
var MAX_DATA_ROWS     = 200;    // 入力規則の適用上限行

// ── ヘッダー（v1.1 / 13列）──────────────────────────────────
var HEADERS = [
  "管理ID",          // A
  "カテゴリ",         // B
  "フェーズ",         // C
  "工程名",           // D
  "担当",             // E
  "関連ファイル名",    // F
  "リンク/場所",      // G
  "整備状況",         // H  ← 工程の準備完了度（患者対応状況ではない）
  "実務進行段階",      // I  ← 来院フローのどの段階に属するか
  "プレオープン対象",  // J  チェックボックス
  "必須区分",         // K  必須/条件付き/任意
  "タグ",             // L
  "備考"              // M
];

// ── 入力規則の選択肢 ────────────────────────────────────────
var STATUS_CHOICES = [
  "✅完了", "⚠️要確認", "❌未整備", "🚧準備中", "⏭️将来対応"
];

var STAGE_CHOICES = [
  "未着手", "受付中", "施術者待ち", "入力中", "保存済", "会計待ち", "完了"
];

var PRIORITY_CHOICES = ["必須", "条件付き", "任意"];

// ── 列番号（1-indexed）──────────────────────────────────────
var COL = {
  MGMT_ID   : 1,   // A
  CATEGORY  : 2,   // B
  PHASE     : 3,   // C
  PROCESS   : 4,   // D
  OWNER     : 5,   // E
  FILE_NAME : 6,   // F
  LINK      : 7,   // G
  STATUS    : 8,   // H 整備状況
  STAGE     : 9,   // I 実務進行段階
  PRE_OPEN  : 10,  // J プレオープン対象
  PRIORITY  : 11,  // K 必須区分
  TAGS      : 12,  // L タグ
  NOTES     : 13   // M 備考
};

// ── 列幅（px）───────────────────────────────────────────────
// A    B    C     D    E    F    G    H    I    J    K    L    M
var COL_WIDTHS = [
  80,  90, 100, 240, 110, 220, 200, 110, 120, 130, 100, 180, 220
];

// ── 行背景色（整備状況に連動）───────────────────────────────
var COLOR = {
  HEADER_BG  : "#263238",  // ヘッダー背景
  HEADER_FG  : "#FFFFFF",  // ヘッダー文字
  COMPLETE   : "#E8F5E9",  // ✅完了     （薄緑）
  NEED_CHECK : "#FFF9C4",  // ⚠️要確認  （薄黄）
  NOT_READY  : "#FFEBEE",  // ❌未整備  （薄赤）
  PREPARING  : "#E3F2FD",  // 🚧準備中  （薄青）
  FUTURE     : "#F3E5F5",  // ⏭️将来対応（薄紫）
  DEFAULT    : "#FFFFFF"
};

// ============================================================
// 初期データ（新患フロー最小セット + 会計）
// 列順: [管理ID, カテゴリ, フェーズ, 工程名, 担当,
//        関連ファイル名, リンク/場所,
//        整備状況, 実務進行段階, プレオープン対象(bool),
//        必須区分, タグ, 備考]
// ============================================================

var INITIAL_DATA = [

  // ─── 新患フロー ──────────────────────────────────────────

  ["OP-011", "新患", "受付",
   "来院時に問診票を渡す・記入案内",
   "受付",
   "JREC-01_受付者向け手順書.md", "docs/JREC-01_受付者向け手順書.md",
   "✅完了", "受付中", true, "必須",
   "新患,受付", ""],

  ["OP-012", "新患", "受付",
   "問診票の記入漏れ確認（6項目）",
   "受付",
   "JREC-01_受付者向け手順書.md", "docs/JREC-01_受付者向け手順書.md",
   "✅完了", "受付中", true, "必須",
   "新患,受付", "負傷原因「いつ・どこで・どうして」必須"],

  ["OP-013", "新患", "受付",
   "保険証の確認・コピー取得",
   "受付",
   "JREC-01_受付者向け手順書.md", "docs/JREC-01_受付者向け手順書.md",
   "✅完了", "受付中", true, "必須",
   "新患,受付,保険", "有効期限確認。コピーと照合"],

  ["OP-014", "新患", "受付",
   "問診票＋保険証コピーを院長へ引き継ぐ",
   "受付",
   "JREC-01_受付者向け手順書.md", "docs/JREC-01_受付者向け手順書.md",
   "✅完了", "受付中", true, "必須",
   "新患,受付", ""],

  ["OP-015", "新患", "問診",
   "初期評価テンプレ記入（院長）",
   "院長",
   "JREC-01_初期評価テンプレ.md", "docs/JREC-01_初期評価テンプレ.md",
   "✅完了", "施術者待ち", true, "必須",
   "新患,評価", "赤旗チェック含む"],

  // OP-016: 2026-03-30正本変更 — 受付がUI画面で患者ID+来院日を入力する
  ["OP-016", "新患", "受付",
   "UI画面で患者IDと来院日を入力（受付が実施）",
   "受付",
   "JREC-01_受付者向け手順書.md", "患者画面!B2,B4",
   "✅完了", "受付中", true, "必須",
   "新患,受付,入力", "B2=患者ID（プルダウン）・B4=来院日 のみ入力。施術内容は院長が担当"],

  ["OP-017", "新患", "カルテ入力",
   "患者マスタ登録（受付が実施）",
   "受付",
   "JREC-01_受付者向け手順書.md", "患者マスタ（シート）",
   "✅完了", "受付中", true, "必須",
   "新患,受付,設定", "保険証コピーから転記。記号番号の照合必須"],

  ["OP-021", "新患", "カルテ入力",
   "次回予約チェック（D8）入力",
   "受付",
   "JREC-01_受付者向け手順書.md", "患者画面!D8",
   "✅完了", "会計待ち", true, "任意",
   "新患,受付,入力", "保存後に受付が確認・入力。予約なしはスキップ可"],

  ["OP-022", "新患", "カルテ入力",
   "施術内容入力・「登録・計算・出力」ボタンで保存",
   "院長",
   "JREC-01_施術者向け手順書.md", "患者画面（GASボタン）",
   "✅完了", "入力中", true, "必須",
   "新患,院長,入力", "区分・部位・傷病名・治療法・会計区分を入力してから保存"],

  ["OP-023", "新患", "確認",
   "保存後 E5（要確認）が橙背景か確認",
   "院長",
   "JREC-01_施術者向け手順書.md", "患者画面!E5",
   "✅完了", "保存済", true, "必須",
   "新患,院長,確認", "橙背景→E6理由を確認。会計・申請書生成に進まない"],

  // ─── 会計 ────────────────────────────────────────────────

  ["OP-030", "会計", "会計",
   "窓口負担額（E3/H7/F7）を確認して徴収",
   "受付",
   "JREC-01_受付者向け手順書.md", "患者画面!E3,H7,F7",
   "✅完了", "会計待ち", true, "必須",
   "会計,保険,自費", "保険→E3 / 保険+自費→H7 / 自費のみ→F7"],

  ["OP-033", "会計", "会計",
   "手書き領収書の発行（院長確認後）",
   "受付",
   "JREC-01_受付者向け手順書.md", "—",
   "⚠️要確認", "会計待ち", true, "条件付き",
   "会計", "領収書自動発行は未実装。書式は院長が用意"]

];

// ============================================================
// カスタムメニュー
// ============================================================

/**
 * スプレッドシートを開いたときにカスタムメニューを追加する。
 * このスクリプトを container-bound で設置した場合に自動実行される。
 */
function onOpen() {
  SpreadsheetApp.getActiveSpreadsheet().addMenu("運用ポータル", [
    { name: "初期セットアップ（書式＋データ）", functionName: "setupOperationPortal_"  },
    { name: "書式・入力規則のみ更新",           functionName: "refreshFormatOnly_"     },
    { name: "データ行をリセット（要注意）",      functionName: "resetDataRows_"         },
    { name: "─────────────────",              functionName: "noop_"                   },
    { name: "現場フローを更新",                 functionName: "setupFieldFlow_"        },
    { name: "フィルターをリセット",              functionName: "resetFilter_"           }
  ]);
}

/** メニューのセパレーター用（何もしない） */
function noop_() {}

// ============================================================
// 自動トリガー: onEdit
// ============================================================

/**
 * H列（整備状況）がドロップダウンで変更されたとき、その行の背景色を自動更新する。
 *
 * ■ 動作条件
 *   container-bound スクリプトとして設置した場合のみ自動実行される。
 *   スタンドアロンの場合は「トリガー」設定で onEdit を登録する必要がある。
 *
 * ■ 安全策
 *   - ポータルシート（PORTAL_SHEET_NAME）以外の編集には反応しない
 *   - H列（COL.STATUS = 8）以外の編集には反応しない
 *   - ヘッダー行（1行目）の変更には反応しない
 *   → JREC-01 本体（来店管理施術録ver3.1）とは別 GAS プロジェクトのため
 *      本体側への影響はない
 */
function onEdit(e) {
  if (!e) { return; }
  var range = e.range;
  var sh    = range.getSheet();

  // ポータルシート以外は無視
  if (sh.getName() !== PORTAL_SHEET_NAME) { return; }

  // H列（整備状況）が編集範囲に含まれない場合は無視
  var col     = range.getColumn();
  var lastCol = range.getLastColumn();
  if (lastCol < COL.STATUS || col > COL.STATUS) { return; }

  // ヘッダー行（1行目）は無視
  var startRow = range.getRow();
  if (startRow < DATA_START_ROW) { return; }

  // 変更された行だけ背景色を更新（全行再スキャンしない）
  applyRowColorsForRows_(sh, startRow, range.getNumRows());
}

// ============================================================
// メイン関数
// ============================================================

/**
 * 「運用ポータル」シートを作成または更新する。
 *
 * ■ シートが存在しない場合
 *   新規作成 → ヘッダー書き込み → 書式設定 → 入力規則 → 初期データ挿入
 *
 * ■ シートが存在する場合
 *   ヘッダー・書式・入力規則のみ更新。データ行（2行目以降）は保持する。
 *
 * 再実行しても既存データを消さない安全な設計。
 * データをリセットしたい場合は resetDataRows_() を使う。
 */
function setupOperationPortal_() {
  var ss   = getTargetSpreadsheet_();
  var sh   = ss.getSheetByName(PORTAL_SHEET_NAME);
  var isNew = (sh === null);

  if (isNew) {
    sh = ss.insertSheet(PORTAL_SHEET_NAME);
    Logger.log("[portal] 新規シートを作成しました: " + PORTAL_SHEET_NAME);
  } else {
    Logger.log("[portal] 既存シートを検出。書式・入力規則を更新します（データ行は保持）。");
  }

  // ── 書式・構造の設定（毎回安全に適用）───────────────────
  applyHeaders_(sh);
  applyColumnWidths_(sh);
  applyHeaderFormat_(sh);
  applyDataValidations_(sh);
  applyFreezeAndFilter_(sh);

  // ── データ（新規作成時のみ）───────────────────────────
  if (isNew) {
    writeInitialData_(sh);
    Logger.log("[portal] 初期データを書き込みました（" + INITIAL_DATA.length + "行）。");
  }

  // ── 行背景色（毎回再適用）────────────────────────────
  applyRowColors_(sh);

  var msg = isNew
    ? PORTAL_SHEET_NAME + " を新規作成しました（" + INITIAL_DATA.length + "行）。\n\n"
      + "次のステップ:\n"
      + "・G列のリンク/場所 に HYPERLINK 関数を設定してください\n"
      + "・OP-033（領収書）の整備状況を ⚠️要確認 のままにし、書式入手後に ✅完了 へ変更してください\n"
      + "・必要に応じてカテゴリ「設定」「再診」「月次」の行を追加してください"
    : PORTAL_SHEET_NAME + " の書式・入力規則を更新しました。\n\nデータ行は保持されています。";

  SpreadsheetApp.getUi().alert("✅ セットアップ完了\n\n" + msg);
}

// ============================================================
// サブ関数: 書式・構造
// ============================================================

/** ヘッダー行を書き込む（1行目を上書き） */
function applyHeaders_(sh) {
  sh.getRange(1, 1, 1, NUM_COLS).setValues([HEADERS]);
}

/** 列幅を設定する */
function applyColumnWidths_(sh) {
  for (var i = 0; i < COL_WIDTHS.length; i++) {
    sh.setColumnWidth(i + 1, COL_WIDTHS[i]);
  }
}

/** ヘッダー行の書式を設定する */
function applyHeaderFormat_(sh) {
  var r = sh.getRange(1, 1, 1, NUM_COLS);
  r.setBackground(COLOR.HEADER_BG)
   .setFontColor(COLOR.HEADER_FG)
   .setFontWeight("bold")
   .setFontSize(10)
   .setVerticalAlignment("middle")
   .setHorizontalAlignment("center")
   .setWrap(true);
  sh.setRowHeight(1, 34);
}

/**
 * H列（整備状況）・I列（実務進行段階）・K列（必須区分）に入力規則を設定する。
 * J列（プレオープン対象）はチェックボックスを設定する。
 * 既存の入力規則は上書きされる。
 */
function applyDataValidations_(sh) {
  var rows = MAX_DATA_ROWS - 1;  // ヘッダーを除いた行数

  // H: 整備状況
  sh.getRange(DATA_START_ROW, COL.STATUS, rows, 1)
    .setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireValueInList(STATUS_CHOICES, true)
        .setAllowInvalid(false)
        .setHelpText("工程の整備状況を選択してください（患者対応の状況ではありません）")
        .build()
    );

  // I: 実務進行段階
  sh.getRange(DATA_START_ROW, COL.STAGE, rows, 1)
    .setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireValueInList(STAGE_CHOICES, true)
        .setAllowInvalid(false)
        .setHelpText("この工程が属する患者来院フローの段階を選択してください")
        .build()
    );

  // J: プレオープン対象（チェックボックス）
  // insertCheckboxes は既存チェックボックスに対しても安全に再適用できる
  sh.getRange(DATA_START_ROW, COL.PRE_OPEN, rows, 1).insertCheckboxes();

  // K: 必須区分
  sh.getRange(DATA_START_ROW, COL.PRIORITY, rows, 1)
    .setDataValidation(
      SpreadsheetApp.newDataValidation()
        .requireValueInList(PRIORITY_CHOICES, true)
        .setAllowInvalid(false)
        .setHelpText("プレオープン中の必須度を選択してください")
        .build()
    );
}

/** 先頭行の固定とフィルターを設定する（既存フィルターは解除して再設定）*/
function applyFreezeAndFilter_(sh) {
  sh.setFrozenRows(1);

  var existing = sh.getFilter();
  if (existing) { existing.remove(); }

  // フィルター範囲は 1行目 × 全列（データ行が増えても機能する）
  sh.getRange(1, 1, sh.getMaxRows(), NUM_COLS).createFilter();
}

// ============================================================
// サブ関数: データ
// ============================================================

/** 初期データを DATA_START_ROW から書き込む */
function writeInitialData_(sh) {
  if (!INITIAL_DATA || INITIAL_DATA.length === 0) { return; }
  sh.getRange(DATA_START_ROW, 1, INITIAL_DATA.length, NUM_COLS).setValues(INITIAL_DATA);
}

/**
 * 全データ行の背景色を整備状況（H列）の値に応じて設定する。
 * setupOperationPortal_() / refreshFormatOnly_() から呼ばれる。
 * ⚠️ H列を手動変更しても自動反映されない。自動反映は onEdit(e) が担う。
 */
function applyRowColors_(sh) {
  var lastRow = sh.getLastRow();
  if (lastRow < DATA_START_ROW) { return; }
  applyRowColorsForRows_(sh, DATA_START_ROW, lastRow - DATA_START_ROW + 1);
}

/**
 * 指定した行範囲の背景色を整備状況（H列）の値に応じて設定する。
 * applyRowColors_() と onEdit(e) の両方から呼ばれる共通ロジック。
 *
 * @param {Sheet}  sh       対象シート
 * @param {number} startRow 開始行（1-indexed）
 * @param {number} numRows  行数
 */
function applyRowColorsForRows_(sh, startRow, numRows) {
  if (numRows <= 0) { return; }
  var statusValues = sh.getRange(startRow, COL.STATUS, numRows, 1).getValues();
  var bgMatrix = [];
  for (var i = 0; i < numRows; i++) {
    var s  = statusValues[i][0];
    var bg = COLOR.DEFAULT;
    if      (s === "✅完了")      { bg = COLOR.COMPLETE;   }
    else if (s === "⚠️要確認")   { bg = COLOR.NEED_CHECK; }
    else if (s === "❌未整備")   { bg = COLOR.NOT_READY;  }
    else if (s === "🚧準備中")   { bg = COLOR.PREPARING;  }
    else if (s === "⏭️将来対応") { bg = COLOR.FUTURE;     }
    bgMatrix.push(new Array(NUM_COLS).fill(bg));
  }
  sh.getRange(startRow, 1, numRows, NUM_COLS).setBackgrounds(bgMatrix);
}

// ============================================================
// 個別操作関数（メニューから呼び出し）
// ============================================================

/**
 * 書式・ヘッダー・入力規則のみ更新する。
 * データ行は一切変更しない。
 */
function refreshFormatOnly_() {
  var ss = getTargetSpreadsheet_();
  var sh = ss.getSheetByName(PORTAL_SHEET_NAME);

  if (!sh) {
    SpreadsheetApp.getUi().alert(
      "「" + PORTAL_SHEET_NAME + "」シートが見つかりません。\n"
      + "先に「初期セットアップ」を実行してください。"
    );
    return;
  }

  applyHeaders_(sh);
  applyColumnWidths_(sh);
  applyHeaderFormat_(sh);
  applyDataValidations_(sh);
  applyFreezeAndFilter_(sh);
  applyRowColors_(sh);

  SpreadsheetApp.getUi().alert(
    "✅ 書式・入力規則を更新しました。\nデータ行は保持されています。"
  );
}

/**
 * データ行（2行目以降）を初期データにリセットする。
 * 既存のデータはすべて消えるため、確認ダイアログを表示する。
 */
function resetDataRows_() {
  var ui       = SpreadsheetApp.getUi();
  var response = ui.alert(
    "⚠️ データ行リセット",
    "「" + PORTAL_SHEET_NAME + "」シートの\n2行目以降のデータを初期データに置き換えます。\n\n"
    + "既存のデータはすべて消えます。続けますか？",
    ui.ButtonSet.YES_NO
  );

  if (response !== ui.Button.YES) {
    ui.alert("キャンセルしました。データは変更されていません。");
    return;
  }

  var ss      = getTargetSpreadsheet_();
  var sh      = ss.getSheetByName(PORTAL_SHEET_NAME);

  if (!sh) {
    ui.alert(
      "「" + PORTAL_SHEET_NAME + "」シートが見つかりません。\n"
      + "先に「初期セットアップ」を実行してください。"
    );
    return;
  }

  // 既存データ行をクリア
  var lastRow = sh.getLastRow();
  if (lastRow >= DATA_START_ROW) {
    sh.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, NUM_COLS)
      .clearContent()
      .clearFormat();
  }

  // 初期データを再書き込み
  writeInitialData_(sh);
  applyDataValidations_(sh);
  applyRowColors_(sh);

  ui.alert(
    "✅ データ行をリセットしました。\n初期データ " + INITIAL_DATA.length + "行 を書き込みました。"
  );
}

/** フィルターを解除して再設定する */
function resetFilter_() {
  var ss = getTargetSpreadsheet_();
  var sh = ss.getSheetByName(PORTAL_SHEET_NAME);
  if (!sh) { return; }

  applyFreezeAndFilter_(sh);
  SpreadsheetApp.getUi().alert("✅ フィルターをリセットしました。");
}

// ============================================================
// 現場フロー セットアップ
// ============================================================

/**
 * 「現場フロー」シートを作成または上書きする。
 *
 * 2026-03-30 担当役割正本:
 *   受付  : 患者マスタ登録 / UI画面（B2患者ID・B4来院日）入力 / 会計徴収
 *   院長  : 施術内容入力 / 保存 / E5（要確認）確認
 *
 * レイアウト:
 *   A〜C列 : 新患フロー（15ステップ）
 *   D列    : スペーサー
 *   E〜G列 : 再診フロー（10ステップ）
 *
 * 色凡例:
 *   薄緑（#E8F5E9）= 受付担当
 *   薄青（#E3F2FD）= 院長担当
 */
function setupFieldFlow_() {
  var ss = getTargetSpreadsheet_();
  var sh = ss.getSheetByName(FIELD_FLOW_SHEET_NAME);

  if (!sh) {
    sh = ss.insertSheet(FIELD_FLOW_SHEET_NAME);
  }

  sh.clearContents();
  sh.clearFormats();

  // ── 列番号 ──────────────────────────────────────────────
  var C_NEW_NO  = 1;  // A
  var C_NEW_WHO = 2;  // B
  var C_NEW_ACT = 3;  // C
  var C_SPACE   = 4;  // D
  var C_RE_NO   = 5;  // E
  var C_RE_WHO  = 6;  // F
  var C_RE_ACT  = 7;  // G

  // ── 列幅 ────────────────────────────────────────────────
  sh.setColumnWidth(C_NEW_NO,  40);
  sh.setColumnWidth(C_NEW_WHO, 80);
  sh.setColumnWidth(C_NEW_ACT, 290);
  sh.setColumnWidth(C_SPACE,   18);
  sh.setColumnWidth(C_RE_NO,   40);
  sh.setColumnWidth(C_RE_WHO,  80);
  sh.setColumnWidth(C_RE_ACT,  290);

  // ── 行1: セクションヘッダー ──────────────────────────────
  sh.getRange(1, C_NEW_NO, 1, 3).merge()
    .setValue("新患フロー（初回来院）")
    .setBackground("#1B5E20").setFontColor("#FFFFFF")
    .setFontWeight("bold").setFontSize(11)
    .setHorizontalAlignment("center").setVerticalAlignment("middle");

  sh.getRange(1, C_RE_NO, 1, 3).merge()
    .setValue("再診フロー（2回目以降）")
    .setBackground("#0D47A1").setFontColor("#FFFFFF")
    .setFontWeight("bold").setFontSize(11)
    .setHorizontalAlignment("center").setVerticalAlignment("middle");

  sh.setRowHeight(1, 30);

  // ── 行2: サブヘッダー ────────────────────────────────────
  var subH = [["#", "担当", "内容"]];
  sh.getRange(2, C_NEW_NO, 1, 3).setValues(subH)
    .setBackground("#388E3C").setFontColor("#FFFFFF")
    .setFontWeight("bold").setHorizontalAlignment("center");

  sh.getRange(2, C_RE_NO, 1, 3).setValues(subH)
    .setBackground("#1565C0").setFontColor("#FFFFFF")
    .setFontWeight("bold").setHorizontalAlignment("center");

  sh.setRowHeight(2, 24);

  // ── データ行開始位置 ─────────────────────────────────────
  var DATA_START = 3;

  // ── 新患フロー（15ステップ）──────────────────────────────
  var newFlow = [
    [1,  "受付", "来院確認・氏名確認"],
    [2,  "受付", "問診票を渡す・記入案内"],
    [3,  "受付", "問診票回収・記入漏れ確認（6項目：氏名/生年月日/保険/負傷原因/症状/連絡先）"],
    [4,  "受付", "保険証確認・コピー取得（有効期限確認）"],
    [5,  "受付", "患者マスタ登録（保険証コピーから転記 — 保険者番号・記号・番号を照合）"],
    [6,  "受付", "UI画面：患者ID（B2）と来院日（B4）を入力"],
    [7,  "受付", "問診票＋保険証コピーを院長へ引き継ぐ"],
    [8,  "院長", "問診票確認・初期評価テンプレ記入（赤旗チェック含む）"],
    [9,  "院長", "保険/自費の一次判定（判定フロー参照）"],
    [10, "院長", "施術内容入力：区分（初検/後療）・部位・傷病名・受傷日・治療法"],
    [11, "院長", "会計区分入力（B7）：保険のみ / 保険+自費 / 自費のみ"],
    [12, "院長", "自費明細入力（自費ありの場合のみ）— Drawingボタン"],
    [13, "院長", "「登録・計算・出力」ボタンで保存"],
    [14, "院長", "保存後 E5（要確認）が橙背景か確認 → 橙なら E6 を読んで対処"],
    [15, "受付", "窓口負担額（E3/H7/F7）確認・徴収・次回案内・D8チェック"]
  ];

  // ── 再診フロー（10ステップ）──────────────────────────────
  var revisitFlow = [
    [1,  "受付", "来院確認・氏名確認"],
    [2,  "受付", "保険証変更確認（月初・変更時はコピー再取得）"],
    [3,  "受付", "UI画面：患者ID（B2）と来院日（B4）を入力"],
    [4,  "受付", "院長へ引き継ぎ（今日の訴え・変更情報を伝える）"],
    [5,  "院長", "前回記録確認・経過確認"],
    [6,  "院長", "施術内容確認・変更があれば修正・入力（変更なければ前回踏襲）"],
    [7,  "院長", "会計区分確認・入力（B7）"],
    [8,  "院長", "「登録・計算・出力」ボタンで保存"],
    [9,  "院長", "保存後 E5（要確認）が橙背景か確認 → 橙なら E6 を読んで対処"],
    [10, "受付", "窓口負担額（E3/H7/F7）確認・徴収・次回案内・D8チェック"]
  ];

  // ── データ書き込み ───────────────────────────────────────
  sh.getRange(DATA_START, C_NEW_NO, newFlow.length, 3).setValues(newFlow);
  sh.getRange(DATA_START, C_RE_NO,  revisitFlow.length, 3).setValues(revisitFlow);

  // ── 行高・折り返し ───────────────────────────────────────
  for (var r = DATA_START; r < DATA_START + newFlow.length; r++) {
    sh.setRowHeight(r, 38);
  }
  sh.getRange(DATA_START, C_NEW_ACT, newFlow.length, 1).setWrap(true);
  sh.getRange(DATA_START, C_RE_ACT,  revisitFlow.length, 1).setWrap(true);

  // ── 行背景色（担当で色分け）──────────────────────────────
  var BG_RECEPTION = "#E8F5E9";  // 受付 = 薄緑
  var BG_DIRECTOR  = "#E3F2FD";  // 院長 = 薄青

  for (var i = 0; i < newFlow.length; i++) {
    var bg = newFlow[i][1] === "受付" ? BG_RECEPTION : BG_DIRECTOR;
    sh.getRange(DATA_START + i, C_NEW_NO, 1, 3).setBackground(bg);
  }
  for (var j = 0; j < revisitFlow.length; j++) {
    var bg2 = revisitFlow[j][1] === "受付" ? BG_RECEPTION : BG_DIRECTOR;
    sh.getRange(DATA_START + j, C_RE_NO, 1, 3).setBackground(bg2);
  }

  // ── 凡例・タイムスタンプ ──────────────────────────────────
  var legendRow = DATA_START + newFlow.length + 2;
  sh.getRange(legendRow, C_NEW_NO).setValue("凡例")
    .setFontWeight("bold").setFontSize(9);
  sh.getRange(legendRow, C_NEW_WHO).setValue("受付担当")
    .setBackground(BG_RECEPTION).setHorizontalAlignment("center");
  sh.getRange(legendRow, C_NEW_ACT).setValue("院長担当")
    .setBackground(BG_DIRECTOR).setHorizontalAlignment("center");

  sh.getRange(legendRow + 1, C_NEW_NO, 1, 3).merge()
    .setValue("最終更新: 2026-03-30（担当役割正本変更: 受付 = マスタ登録・UI入力(B2/B4)・会計 / 院長 = 施術内容・保存・E5確認）")
    .setFontSize(8).setFontColor("#757575").setWrap(true);

  // ── ヘッダー固定 ─────────────────────────────────────────
  sh.setFrozenRows(2);

  SpreadsheetApp.getUi().alert(
    "✅ 現場フローを更新しました。\n\n"
    + "新患フロー: " + newFlow.length + " ステップ\n"
    + "再診フロー: " + revisitFlow.length + " ステップ\n\n"
    + "担当ルール（2026-03-30 正本）\n"
    + "・受付: マスタ登録 / UI入力（B2/B4）/ 会計徴収\n"
    + "・院長: 施術内容 / 保存 / E5確認"
  );
}

// ============================================================
// ユーティリティ
// ============================================================

/**
 * 対象スプレッドシートを取得する。
 *
 * ■ container-bound（対象 SS に直接貼り付けた）場合
 *   getActiveSpreadsheet() が返す SS の ID を確認し、一致すればそれを使う。
 *
 * ■ スタンドアロン（別の GAS プロジェクト）の場合
 *   SPREADSHEET_ID で直接 openById() する。
 *
 * ■ フォールバック
 *   どちらも取得できない場合は getActiveSpreadsheet() を返す。
 */
function getTargetSpreadsheet_() {
  try {
    var active = SpreadsheetApp.getActiveSpreadsheet();
    if (active && active.getId() === SPREADSHEET_ID) {
      return active;  // container-bound かつ正しい SS
    }
  } catch (e) {
    // getActiveSpreadsheet() が使えない環境（時間ベーストリガー等）は無視
  }

  try {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
  } catch (e) {
    // アクセス権なし等
    throw new Error(
      "対象スプレッドシートを開けませんでした。\n"
      + "スプレッドシート ID を確認してください: " + SPREADSHEET_ID + "\n"
      + "エラー詳細: " + e.message
    );
  }
}
