/****************************************************
 * 柔整 Ver3.1 統合版（保存＋金額＋ヘッダ追記を一括実行）
 *
 * ★主要変更（統合版）
 * - saveVisit_V3() で ①来院ケース保存 → ②金額計算 → ③来院ヘッダ追記 を一括
 * - visitKey = 患者ID + "_" + yyyy-MM-dd（旧"|"から変更）
 * - 同日二重登録禁止（来院ヘッダに同一visitKeyがあればエラー停止）
 * - 上書き禁止（修正は別機能で行う前提）
 *
 * ★既存仕様（維持）
 * - 30日ルール（エピソード連結＋終了境界で打ち切り）
 * - 安全弁（コアなし行のチェック強制FALSE等）
 * - 終了日セルに何か入っていれば終了扱い
 * - 終了は「コア補完を止める」だけ（治療チェックは消さない）
 *
 * ★金額計算
 * - 来院ケースの部位データから直接算定
 * - 来院合計 = 初検料 + 再検料 + 相談支援料 + 明細合計
 * - 窓口負担額 = 来院合計 × 負担割合（roundToUnit_で丸め）
 * - 保険請求額 = 来院合計 - 窓口負担額（丸めない）
 ****************************************************/

/** ===== シート名 ===== */
const SHEETS = {
  settings: "設定",
  cases: "来院ケース",
  master: "患者マスタ",
  ui: "患者画面",
  detail: "施術明細",
  header: "来院ヘッダ",
  history: "初検情報履歴",
  insurer: "保険者情報",
  selfPayDetail: "自費明細",  // Phase 2: 自費明細シート
};

// ===== JBIZ 連携定数（Phase 3: 価格マスタ正本参照） =====
const JBIZ_SS_ID    = "1FnJdALwFSv48WiD6NWr0DzG78kwB692R2pFeiTcZlCc";
// シート名候補（実名が変わっても候補に追加するだけで対応できるよう配列化）
// 2026-03-23 バグ修正: 実名は「価格設定」（「メニューマスタ（価格設定）」ではなかった）
const JBIZ_MENU_SHEET_CANDIDATES = [
  "メニューマスタ（価格設定）",  // 設計時の想定名（旧）
  "価格設定",                     // 実際のシート名（正）
];
// 列インデックス（0始まり、A=0）
const JBIZ_COL = {
  displayOrder: 0,  // A: 表示順
  category:     1,  // B: 大区分
  menuId:       2,  // C: menu_id（2026-03-23 O列から移動。旧: 小区分 — JREC未使用のため転用）
  menuName:     3,  // D: メニュー名
  description:  4,  // E: 内容
  duration:     5,  // F: 時間
  price:        6,  // G: 一般料金（円）
  memberPrice:  7,  // H: ジム会員料金（円）
  insurance:    8,  // I: 保険適用
  unit:         9,  // J: 回数/単位
  isMain:       10, // K: 主力手技フラグ
  isKpi:        11, // L: KPI集計対象
  status:       12, // M: 確定状況
  note:         13, // N: 備考
  // O列（インデックス14）: menu_id を C列へ移動したため廃止（2026-03-23）
};
// menu_id マッピング（初回セットアップ用）
const JBIZ_MENU_ID_MAP = {
  "慢性ケア手技50分":          "SELF_CHRONIC50",
  "パーソナルトレーニング60分": "TRAINING_PERSONAL60",
  "4回集中コース":             "TRAINING_4PASS",
  "ジム月会費":                "GYM_MONTHLY",
  "症状別初回評価":            "SELF_INITIAL_EVAL",
  "保険基本施術":              "INS_BASE",
  "手技延長":                  "INS_OPTION_EXTEND10",
  // 2026-03-23: 筋膜リリース（マッサージガン）→ ストレッチ（20分）に置換。旧 INS_OPTION_FASCIA_GUN 廃止。
  "ストレッチ（20分）":         "INS_OPTION_STRETCH20",
  // 2026-03-23: 温熱追加 → 電療追加（15分）に置換。旧 INS_OPTION_HEAT5 廃止。
  "電療追加（15分）":           "INS_OPTION_ELECTRO15",
};

/** ===== 患者画面 UIセル ===== */
const UI = {
  patientId: "C2",        // B2は検索プルダウン、C2に患者ID自動抽出
  patientDisplay: "B2",   // 検索用表示文字列
  treatDate: "B4",
  gymMember: "B5",      // ジム会員フラグ（チェックボックス）— Phase A (2026-03-31)
                        // Phase B で JBIZ 価格マスタの G列(一般料金)/H列(会員料金) 切替に使用予定
                        // Phase C で患者マスタ既定値からの当日UI上書き方式に拡張予定

  // 表示専用：区分
  case1_kubunView: "C10",
  case2_kubunView: "C34",

  // Case1（入力2行）※ A〜H（G=終了日, H=転帰）
  case1_rows: ["A12:H12", "A13:H13"],
  case1_shoken:       "A23:B28",
  case1_keikaNow:     "A16:B20",
  case1_keikaHistory: "D23:G28",
  // Case1 初検情報入力（初検時のみ入力）
  case1_initInfo: {
    injuryDatetime: "E16:G16",
    injuryPlace:    "E17:G17",
    injuryStatus:   "E18:G18",
    initFindings:   "E19:G19",
    supportContent: "E20:G20",
  },

  // Case2（入力2行）※ A〜H（G=終了日, H=転帰）
  case2_rows: ["A36:H36", "A37:H37"],
  case2_shoken:       "A47:B52",
  case2_keikaNow:     "A40:B44",
  case2_keikaHistory: "D47:G52",
  // Case2 初検情報入力（初検時のみ入力）
  case2_initInfo: {
    injuryDatetime: "E40:G40",
    injuryPlace:    "E41:G41",
    injuryStatus:   "E42:G42",
    initFindings:   "E43:G43",
    supportContent: "E44:G44",
  },

  // 終了日入力（明示）
  case1_endHeader: "G11",
  case2_endHeader: "G35",

  // 来院回数（表示専用）
  case1_visitCount: "G10",
  case2_visitCount: "B39",

  // 会計ブロック（表示専用）
  billing_visitTotal: "E2",
  billing_windowPay: "E3",
  billing_claimPay: "E4",
  billing_needCheck: "E5",
  billing_needCheckReason: "E6",

  // 会計・経営情報ブロック（入力用 — Phase 1 / 行7〜8）
  // 保険算定UIとは独立。saveVisit_V3 で readSelfPayFromUI_V3_ が読み取る。
  // Phase 2 で自費明細シートへの1行保存に拡張予定。menu_id は selfPay_menuCode に収容。
  // Row 7: B7=会計区分, D7=自費メニュー, F7=自費売上額, H7=会計合計(=IF(F7="",E2,E2+F7))
  // Row 8: B8=慢性候補, D8=次回予約, F8=新規区分, H8=メニューコード
  // ※ Row 9 は Case1 ブロック開始のため使用不可
  selfPay_accountingType:  "B7",   // 会計区分（プルダウン: 保険のみ/保険+自費/自費のみ）
  selfPay_menuType:        "D7",   // 自費メニュー区分（プルダウン: 手技50分 等）
  selfPay_amount:          "F7",   // 自費売上額（手入力 — Phase2で価格マスタ参照予定）
  selfPay_chronicFlag:     "B8",   // 慢性候補フラグ（チェックボックス）
  selfPay_nextReserv:      "D8",   // 次回予約あり（チェックボックス）
  selfPay_firstVisitType:  "F8",   // 新規区分（プルダウン: 保険新規/自費直新規/再来）
  selfPay_menuCode:        "H8",   // 自費メニューコード（将来: menu_id / Phase2価格マスタ連携用）

  // 直前保存サマリー（保存後会計サマリー / 領収証参照元）— JREC-01 Case A (2026-03-31)
  // writeSavedSummaryUI_V3_ / clearSummaryValuesUI_V3_ / setupSelfPayValidation_V3_ で使用
  // 配置: J2:N22（J列以右の未使用エリア / 縦並びレイアウト）
  summary_area: "J2:N22",
};

/** ===== 患者画面ボタン設定 ===== */
const PATIENT_SCREEN_BUTTONS = {
  save: {
    key: "JREC_BUTTON_SAVE",
    label: "保存",
    functionName: "buttonSavePatientScreen",
    rangeA1: "F1:G2",
    fillColor: "#2563eb",
    fontColor: "#ffffff",
    borderColor: "#1d4ed8",
    note: "患者画面の主操作ボタン（保存）",
  },
  clear: {
    key: "JREC_BUTTON_CLEAR",
    label: "入力クリア",
    functionName: "buttonClearPatientScreen",
    rangeA1: "H1:I2",
    fillColor: "#e5e7eb",
    fontColor: "#374151",
    borderColor: "#9ca3af",
    note: "患者画面の主操作ボタン（入力クリア）",
  },
};
const PATIENT_SCREEN_BUTTON_KEY_PREFIX = "JREC_BUTTON_";
// 画像自動挿入は廃止（insertImage 失敗のため手動配置に移行）。PNG 定数は削除済み。

/** ===== 来院ケース列名（誤解ゼロ命名：部位1/2） ===== */
const CASE_COLS = {
  visitKey: "visitKey",
  treatDate: "施術日",
  patientId: "患者ID",
  caseNo: "caseNo",
  injuryFixed: "受傷日_確定",
  kubun: "区分",
  initFee: "初検料",
  reFee: "再検料",
  supportFee: "相談支援料",
  detailSum: "明細合計(case)",
  caseTotal: "case合計",
  createdAt: "作成日時",
  caseKey: "caseKey",

  // 部位1
  p1: "部位_部位1",
  d1: "傷病_部位1",
  inj1: "受傷日_部位1",
  cold1: "冷罨法_部位1",
  warm1: "温罨法_部位1",
  elec1: "電療_部位1",
  metal1: "金属副子_部位1",  // §18.3 Phase 1

  // 部位2
  p2: "部位_部位2",
  d2: "傷病_部位2",
  inj2: "受傷日_部位2",
  cold2: "冷罨法_部位2",
  warm2: "温罨法_部位2",
  elec2: "電療_部位2",
  metal2: "金属副子_部位2",  // §18.3 Phase 1
  exercise1: "運動後療_部位1",  // 柔道整復運動後療料 Phase 1
  exercise2: "運動後療_部位2",  // 柔道整復運動後療料 Phase 1

  // 施術開始日/終了日/転帰（部位ごと）
  start1: "施術開始日_部位1",
  end1: "施術終了日_部位1",
  tenki1: "転帰_部位1",
  start2: "施術開始日_部位2",
  end2: "施術終了日_部位2",
  tenki2: "転帰_部位2",

  shoken: "所見",
  keikaNow: "経過_今回",
};

/**
 * ===== 来院ヘッダ列名 =====
 * 論理グループ順（I-1: 2026-04-01 整理）:
 *   A 基本識別 → B 保険算定 → C ケース識別 → D 来院状態 → E 経営KPI → F 保険監査
 *
 * 注意: この定義順は ensureHeaderCols_ が"不足列を末尾追加"する際の参照にもなる。
 *       既存シートの列順は reorderHeaderCols_V3() で別途整理する。
 */
const HEADER_COLS = {
  // ── A 基本識別 ──────────────────────────────
  visitKey:            "visitKey",
  treatDate:           "施術日",
  patientId:           "患者ID",

  // ── B 保険算定 ──────────────────────────────
  kubun:               "区分",
  injuryVisit:         "受傷日_確定(来院)",
  initFee:             "初検料",
  reFee:               "再検料",
  supportFee:          "相談支援料",
  detailSum:           "明細合計",
  visitTotal:          "来院合計",
  windowPay:           "窓口負担額",   // 旧定義: createdAt の後ろに後付け → I-1 で保険算定グループへ
  claimPay:            "保険請求額",   // 同上

  // ── C ケース識別 ────────────────────────────
  caseKey:             "caseKey",
  caseIndex:           "caseIndex",
  caseKey2:            "caseKey2",     // HIGH-2: 同日2ケース活性時の第2ケースキー（通常は空）→ I-1 で経営KPIゾーンから移動

  // ── D 来院状態・アラート・管理 ──────────────
  lastVisit:           "最終来院日",
  gapDays:             "前回から日数",
  needCheck:           "要確認",
  needCheckReason:     "要確認理由",
  createdAt:           "作成日時",

  // ── E 経営KPI ───────────────────────────────
  // selfPayMenuType / selfPayAmount / selfPayMenuCode は 2026-03-23 撤去。
  // 自費明細シートが正本。二重管理・陳腐化防止のため来院ヘッダから除外。
  accountingType:         "会計区分",
  gymMemberFlag:          "ジム会員フラグ",  // Phase A (2026-03-31): UI B5 から読み取り。将来: 患者マスタ既定値連携
  chronicCandidateFlag:   "慢性候補フラグ",
  nextReservation:        "次回予約あり",
  firstVisitType:         "新規区分",

  // ── F 保険監査（mixed case 説明性列） ────────
  billedKubun:         "算定区分",
  mixedFlag:           "Mixed区分",
  case1Summary:        "case1要約",
  case2Summary:        "case2要約",
  chargeReason:        "課金理由要約",
};

/** ===== 設定シートの選択肢マスタ（E:I） ===== */
const SETTINGS_CHOICE_MASTERS = [
  { col: 5, label: "会計区分", values: ["保険のみ", "保険+自費", "自費のみ"] },
  // col:6 「自費メニュー区分」は 2026-03-23 撤去（自費明細シートのメニュー名が正本）
  { col: 7, label: "慢性候補フラグ", values: ["TRUE", "FALSE"] },
  { col: 8, label: "次回予約あり", values: ["TRUE", "FALSE"] },
  // 新規区分は空欄運用を許容するため、マスタには実値のみ置く。
  { col: 9, label: "新規区分", values: ["保険新規", "自費直新規", "再来"] },
];

/** ===== 来院ヘッダ入力候補（設定シート E:I を参照） ===== */
const HEADER_CHOICE_VALIDATIONS = [
  { headerName: HEADER_COLS.accountingType, settingsCol: 5, helpText: "設定シートE列の候補から選択します。" },
  // selfPayMenuType は 2026-03-23 撤去（来院ヘッダから除外・自費明細が正本）
  { headerName: HEADER_COLS.chronicCandidateFlag, settingsCol: 7, helpText: "設定シートG列の TRUE / FALSE を使います。" },
  { headerName: HEADER_COLS.nextReservation, settingsCol: 8, helpText: "設定シートH列の TRUE / FALSE を使います。" },
  { headerName: HEADER_COLS.firstVisitType, settingsCol: 9, helpText: "設定シートI列の候補から選択します。空欄のままでも保持できます。" },
];

/** ===== 患者マスタ列名 ===== */
const MASTER_COLS = {
  patientId: "患者ID",
  burden: "負担割合",
};



/** ===== メニュー ===== */
var JUSEI_TOOL_MENU_SECTIONS = [
  {
    title: "柔整入力",
    items: [
      { label: "保存", functionName: "saveVisit_V3" },
      { label: "自動引継ぎ", functionName: "autofillFromPreviousVisit_V3" },
      { label: "自費明細入力", functionName: "openSelfPayDialog_V3" },
      { label: "経過履歴更新", functionName: "refreshKeikaHistoryUI_V3" },
      { label: "画面クリア", functionName: "clearEntryUI_V3" },
      { label: "施術録を出力", functionName: "srShowDialog" }
    ]
  },
  {
    title: "柔整管理",
    items: [
      { label: "当日内容を再読み込み", functionName: "reloadVisitToUI_V3" },
      { label: "転帰を更新",           functionName: "updateOutcomeFromUI_V3" },
      { label: "経過を更新",           functionName: "updateProgressFromUI_V3" },
      { label: "ヘッダ再出力", functionName: "exportHeaderFromCases_V3" },
      { label: "金額再計算", functionName: "menuRecalcAmounts_V3" },
      { label: "申請書転記データ作成", functionName: "V3TR_menuBuildTransferData" },
      { label: "患者検索プルダウン更新", functionName: "refreshPatientPicker_V3" },
      { label: "保険者情報を患者マスタへ反映", functionName: "copyInsurerToMaster_V3" }
    ]
  },
  {
    title: "柔整設定",
    items: [
      { label: "転帰ドロップダウン設定", functionName: "menuSetupTenkiValidation_V3" },
      { label: "入力バリデーション設定", functionName: "setupValidation_V3" },
      { label: "設定シート初期セットアップ", functionName: "ensureSettingsRows_V3" },
      { label: "施術明細ヘッダセットアップ", functionName: "ensureDetailHeaders_V3" },
      { label: "UI初期設定", functionName: "setupSelfPayValidation_V3" },
      { label: "自費明細シート初期化", functionName: "ensureSelfPayDetailSheet_V3" },
      { label: "患者検索プルダウン設定", functionName: "setupPatientPicker_V3" }
    ]
  },
  {
    title: "管理者用",
    items: [
      { label: "手動ボタン配置ガイド", functionName: "setupPatientScreenButtons_V3" },
      { label: "ヘッダ確認（デバッグ）", functionName: "checkHeaders_V3" },
      { label: "JBIZ menu_id 追加", functionName: "setupJBIZMenuMasterId_V3" },
      { label: "JBIZ 会員傷行レコード移行", functionName: "migrateJBIZMemberRules_V3" },
      { label: "来院ヘッダ列順整理", functionName: "reorderHeaderCols_V3" },
      { label: "一括JSON出力", functionName: "V3TR_menuBatchExportJson" },
      { label: "申請書を生成して Drive に保存", functionName: "V3TR_menuGenerateApplication_B" }
    ]
  }
];

function buildJuseiToolSubMenu_(ui, section) {
  var subMenu = ui.createMenu(section.title);
  (section.items || []).forEach(function(item) {
    subMenu.addItem(item.label, item.functionName);
  });
  return subMenu;
}

function buildJuseiToolMenu_() {
  var ui = SpreadsheetApp.getUi();
  var menu = ui.createMenu("柔整ツール");

  JUSEI_TOOL_MENU_SECTIONS.forEach(function(section) {
    menu.addSubMenu(buildJuseiToolSubMenu_(ui, section));
  });

  menu.addToUi();
}

function onOpen() {
  try {
    buildJuseiToolMenu_();
    // ensurePatientScreenButtons_V3_() は廃止（画像自動挿入を中止）
  } catch (err) {
    console.error(err);
  }
}

/** ===== 患者画面 Drawing/画像ボタン用 公開ラッパー ===== */
function buttonSavePatientScreen() {
  return saveVisit_V3();
}

function buttonClearPatientScreen() {
  var ui = SpreadsheetApp.getUi();
  var result = ui.alert(
    "確認",
    "患者画面の入力をクリアします。よろしいですか？",
    ui.ButtonSet.OK_CANCEL
  );
  if (result !== ui.Button.OK) return;
  return clearEntryUI_V3();
}

/**
 * 患者画面ボタンの手動配置ガイドを表示する。
 * ※ 画像自動挿入は廃止（insertImage 失敗のため）。
 *    スプレッドシートの「挿入 → 図形描画」で手動配置し、スクリプトを割り当ててください。
 */
function setupPatientScreenButtons_V3() {
  SpreadsheetApp.getUi().alert(
    "【患者画面ボタン — 手動配置ガイド】\n\n" +
    "画像の自動挿入は廃止しました。\n" +
    "以下の手順で手動配置してください。\n\n" +
    "① 患者画面シートを開く\n" +
    "② 挿入 → 図形描画 で図形を作成\n" +
    "③ 図形を右クリック → 「スクリプトを割り当て」\n\n" +
    "割当スクリプト名:\n" +
    "  保存ボタン:        buttonSavePatientScreen\n" +
    "  入力クリアボタン:  buttonClearPatientScreen"
  );
}

function inspectPatientScreenButtons_V3() {
  var ss = SpreadsheetApp.getActive();
  var logs = [];

  ss.getSheets().forEach(function(sheet) {
    sheet.getImages().forEach(function(image, index) {
      var anchorCell = image.getAnchorCell();
      var item = {
        sheetName: sheet.getName(),
        index: index + 1,
        key: safeGetImageMeta_(image, "getAltTextTitle"),
        description: safeGetImageMeta_(image, "getAltTextDescription"),
        script: safeGetImageMeta_(image, "getScript"),
        anchorA1: anchorCell ? anchorCell.getA1Notation() : "",
        width: Number(safeGetImageMeta_(image, "getWidth") || 0),
        height: Number(safeGetImageMeta_(image, "getHeight") || 0),
        isPatientButton: isPatientScreenButtonImage_(image),
      };
      logs.push(item);
      Logger.log("[inspectPatientScreenButtons_V3] " + JSON.stringify(item));
    });
  });

  Logger.log("[inspectPatientScreenButtons_V3] totalImages=" + logs.length);
  Logger.log("[inspectPatientScreenButtons_V3] patientButtonImages=" + logs.filter(function(item) {
    return item.isPatientButton;
  }).length);
  return logs;
}

function setupPatientScreenButtonCell_(uiSh, config) {
  var range = uiSh.getRange(config.rangeA1);
  range.breakApart();
  range.clearFormat();
  range.clearNote();
  range.merge();
  range
    .setValue(config.label)
    .setFontWeight("bold")
    .setFontSize(12)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle")
    .setBackground(config.fillColor)
    .setFontColor(config.fontColor)
    .setBorder(true, true, true, true, true, true, config.borderColor, SpreadsheetApp.BorderStyle.SOLID_MEDIUM)
    .setNote(config.note);
}

function ensurePatientScreenButtons_V3_() {
  // 画像自動挿入は廃止。手動配置前提のため何もしない。
}

function rebuildPatientScreenButtons_(uiSh) {
  removePatientScreenButtons_(uiSh); // 既存の自動挿入画像を削除
  setupPatientScreenButtonCell_(uiSh, PATIENT_SCREEN_BUTTONS.save);
  setupPatientScreenButtonCell_(uiSh, PATIENT_SCREEN_BUTTONS.clear);
  // insertPatientScreenButtonOverlay_ は廃止（insertImage失敗のため手動配置に移行）
}

function removePatientScreenButtons_(uiSh) {
  uiSh.getImages().forEach(function(image) {
    if (isPatientScreenButtonImage_(image)) image.remove();
  });
}

function countPatientScreenButtons_(uiSh) {
  return uiSh.getImages().filter(isPatientScreenButtonImage_).length;
}

function isPatientScreenButtonImage_(image) {
  var title = String(safeGetImageMeta_(image, "getAltTextTitle") || "");
  var description = String(safeGetImageMeta_(image, "getAltTextDescription") || "");
  var script = String(safeGetImageMeta_(image, "getScript") || "");
  return (
    title.indexOf(PATIENT_SCREEN_BUTTON_KEY_PREFIX) === 0 ||
    description.indexOf("患者画面ボタン:") === 0 ||
    script === PATIENT_SCREEN_BUTTONS.save.functionName ||
    script === PATIENT_SCREEN_BUTTONS.clear.functionName
  );
}

function getRangePixelWidth_(sheet, range) {
  var width = 0;
  for (var col = range.getColumn(); col < range.getColumn() + range.getNumColumns(); col++) {
    width += sheet.getColumnWidth(col);
  }
  return width;
}

function getRangePixelHeight_(sheet, range) {
  var height = 0;
  for (var row = range.getRow(); row < range.getRow() + range.getNumRows(); row++) {
    height += sheet.getRowHeight(row);
  }
  return height;
}

function safeGetImageMeta_(image, methodName) {
  if (!image || typeof image[methodName] !== "function") return "";
  try {
    return image[methodName]();
  } catch (err) {
    return "";
  }
}

/** ===== onEdit ===== */
function onEdit(e) {
  try {
    if (!e || !e.range) return;

    var sh = e.range.getSheet();
    if (sh.getName() !== SHEETS.ui) return;

    var a1 = e.range.getA1Notation();

    // ---- 近接部位チェック（部位名/傷病名セル編集時） ----
    var PROXIMITY_CELLS = {
      "A12": 1, "B12": 1, "A13": 1, "B13": 1,
      "A36": 2, "B36": 2, "A37": 2, "B37": 2
    };
    if (PROXIMITY_CELLS[a1] != null) {
      var caseNo = PROXIMITY_CELLS[a1];
      var rows = (caseNo === 1) ? UI.case1_rows : UI.case2_rows;
      var line1 = readRowNewUI_(sh, rows[0]);
      var line2 = readRowNewUI_(sh, rows[1]);

      // 近接部位チェック
      var prox = checkProximityParts_V3_(line1.part, line1.disease, line2.part, line2.disease);
      if (prox.isProximity) {
        SpreadsheetApp.getActive().toast(
          "⚠ " + prox.reason + "\n部位または傷病名を修正してください。",
          "近接部位の警告",
          8
        );
        return;
      }

      // 骨折/不全骨折の部位名キーワード検証
      var buiWarnings = [];
      var lines = [line1, line2];
      for (var li = 0; li < lines.length; li++) {
        var ln = lines[li];
        if (!ln.part || !ln.disease) continue;
        var iType = detectInjuryType_V3_(ln.disease);
        if (iType === "骨折" || iType === "不全骨折") {
          if (!mapBuiToSettingKey_V3_(ln.part)) {
            buiWarnings.push("「" + ln.part + "」→ 部位キーワード不一致（整復料/固定料が0円になります）");
          }
        }
      }
      if (buiWarnings.length > 0) {
        SpreadsheetApp.getActive().toast(
          "⚠ " + buiWarnings.join("\n") +
          "\n有効な部位名: 鎖骨, 肋骨, 前腕, 上腕, 下腿, 大腿, 指, 趾 等",
          "部位名の警告",
          8
        );
      }
      return;
    }

    // ---- 患者選択(B2) / 来院日の変更 → 履歴更新 ----
    if (a1 !== UI.patientDisplay && a1 !== UI.patientId && a1 !== UI.treatDate) return;

    var lock = LockService.getScriptLock();
    if (!lock.tryLock(500)) return;

    try {
      var props = PropertiesService.getScriptProperties();
      var now = Date.now();
      var last = Number(props.getProperty("V3_ONEDIT_LAST") || 0);
      if (now - last < 1200) return;
      props.setProperty("V3_ONEDIT_LAST", String(now));

      refreshKeikaHistoryUI_V3();
      refreshVisitCountUI_V3();
      autofillFromPreviousVisit_V3();
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    console.error(err);
  }
}

/** ===== ヘッダー名正規化（trim＋全角空白→半角＋連続空白圧縮＋英字小文字） ===== */
function normalizeHeaderName_(s) {
  return String(s || "")
    .trim()
    .replace(/\u3000/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/** ===== 別名辞書（正式名 → 別名リスト） ===== */
const HEADER_ALIASES_ = {
  "患者ID":    ["患者ＩＤ", "patientId", "PATIENT_ID", "patient_id"],
  "施術日":    ["施術日付", "treatDate", "treatmentDate", "treatment_date"],
  "visitKey":  ["訪問キー", "来院キー", "キー", "visitkey"],
  "区分":      ["kubun", "種別"],
  "受傷日_確定": ["受傷日", "負傷日", "injuryDate", "injury_date"],
  "受傷日_部位1": ["受傷日1"],
  "受傷日_部位2": ["受傷日2"],
  "傷病_部位1": ["傷病1", "傷病名_部位1"],
  "傷病_部位2": ["傷病2", "傷病名_部位2"],
  "部位_部位1": ["部位1", "患部_部位1", "site1"],
  "部位_部位2": ["部位2", "患部_部位2", "site2"],
  "caseNo":    ["caseno", "ケース番号"],
  "caseKey":   ["casekey", "ケースキー"],
};

var _aliasToCanonical_ = null;
function getAliasToCanonicalMap_() {
  if (_aliasToCanonical_) return _aliasToCanonical_;
  _aliasToCanonical_ = {};
  for (var canonical in HEADER_ALIASES_) {
    var aliases = HEADER_ALIASES_[canonical];
    for (var j = 0; j < aliases.length; j++) {
      _aliasToCanonical_[normalizeHeaderName_(aliases[j])] = canonical;
    }
  }
  return _aliasToCanonical_;
}

/** ===== 1行目ヘッダー名→列番号（1-based）＋正規化＋別名吸収 ===== */
function buildHeaderColMap_(sh) {
  var lastCol = sh.getLastColumn();
  if (lastCol < 1) return {};
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var aliasMap = getAliasToCanonicalMap_();
  var map = {};

  headers.forEach(function(raw, i) {
    var trimmed = String(raw || "").trim();
    if (!trimmed) return;

    var col1 = i + 1;

    if (!map[trimmed]) map[trimmed] = col1;

    var norm = normalizeHeaderName_(trimmed);
    if (norm !== trimmed && !map[norm]) map[norm] = col1;

    var canonical = aliasMap[norm];
    if (canonical && !map[canonical]) map[canonical] = col1;
  });

  return map;
}

/** ===== 結合セル（左上） ===== */
function getMergedValue_(sheet, a1Range) {
  return sheet.getRange(a1Range).getCell(1, 1).getValue();
}
function setMergedValue_(sheet, a1Range, value) {
  var cell = sheet.getRange(a1Range).getCell(1, 1);
  cell.setValue(value);
  cell.setWrap(true);
}

/** ===== 日付ユーティリティ ===== */
function fmt_(d, pat) {
  return Utilities.formatDate(d, "Asia/Tokyo", pat);
}
function daysBetween_(fromDate, toDate) {
  var a = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  var b = new Date(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
  return Math.round((b.getTime() - a.getTime()) / (24 * 3600 * 1000));
}
function minDate_(d1, d2) {
  var a = (d1 instanceof Date) ? d1 : null;
  var b = (d2 instanceof Date) ? d2 : null;
  if (!a && !b) return "";
  if (a && !b) return a;
  if (!a && b) return b;
  return (a.getTime() <= b.getTime()) ? a : b;
}

/** ===== visitKey / caseKey 構築 ===== */
function buildVisitKey_(patientId, treatDate) {
  return patientId + "_" + fmt_(treatDate, "yyyy-MM-dd");
}
/**
 * caseKey = エピソードID（初検日ベース、エピソード中は不変）
 * 形式: 患者ID_エピソード開始日_C{caseNo}
 */
function buildCaseKey_(patientId, episodeStartDate, caseNo) {
  var dateStr = (episodeStartDate instanceof Date)
    ? fmt_(episodeStartDate, "yyyy-MM-dd")
    : String(episodeStartDate || "");
  return patientId + "_" + dateStr + "_C" + caseNo;
}

/** ===== 必須列チェック（シート名・実ヘッダー付きエラー） ===== */
function ensureRequiredCols_(map, requiredList, sheetName) {
  var missing = requiredList.filter(function(n) { return !map[n]; });
  if (!missing.length) return;

  var actualHeaders = Object.keys(map).slice(0, 30);
  var label = sheetName ? ("【" + sheetName + "】") : "【対象シート】";

  throw new Error(
    label + " ヘッダー不足：\n" +
    "- " + missing.join("\n- ") + "\n\n" +
    label + " 実ヘッダー（先頭30件）：\n" +
    actualHeaders.join(", ")
  );
}

/**
 * 不足ヘッダーをシート末尾列に自動追加し、更新済みmapを返す。
 */
function ensureHeaderCols_(sheet, map, requiredList) {
  var missing = requiredList.filter(function(n) { return !map[n]; });
  if (!missing.length) return map;
  var lastCol = sheet.getLastColumn();
  for (var i = 0; i < missing.length; i++) {
    sheet.getRange(1, lastCol + 1 + i).setValue(missing[i]);
  }
  return buildHeaderColMap_(sheet);
}

function findLastFilledRowInColumn_(sheet, col, startRow) {
  startRow = startRow || 1;
  var lastRow = sheet.getLastRow();
  if (lastRow < startRow) return startRow - 1;

  var vals = sheet.getRange(startRow, col, lastRow - startRow + 1, 1).getValues().flat();
  for (var i = vals.length - 1; i >= 0; i--) {
    if (String(vals[i] || "").trim()) return startRow + i;
  }
  return startRow - 1;
}

function ensureSettingsListColumn_(sheet, col, label, values) {
  var currentLabel = String(sheet.getRange(1, col).getValue() || "").trim();
  if (currentLabel !== label) {
    sheet.getRange(1, col).setValue(label);
  }

  var lastFilled = findLastFilledRowInColumn_(sheet, col, 2);
  var existing = new Set();
  if (lastFilled >= 2) {
    var currentValues = sheet.getRange(2, col, lastFilled - 1, 1).getValues().flat();
    for (var i = 0; i < currentValues.length; i++) {
      var v = String(currentValues[i] || "").trim();
      if (v) existing.add(v);
    }
  }

  var added = [];
  for (var j = 0; j < values.length; j++) {
    if (existing.has(values[j])) continue;
    lastFilled = Math.max(lastFilled, 1) + 1;
    sheet.getRange(lastFilled, col).setValue(values[j]);
    added.push(values[j]);
    existing.add(values[j]);
  }
  return added;
}

function setupHeaderChoiceValidation_V3_(settingsSh, headSh, headMap) {
  if (!settingsSh || !headSh) return;

  var targetRows = Math.max(headSh.getMaxRows() - 1, 1);
  for (var i = 0; i < HEADER_CHOICE_VALIDATIONS.length; i++) {
    var def = HEADER_CHOICE_VALIDATIONS[i];
    var targetCol = headMap[def.headerName];
    if (!targetCol) continue;

    var lastFilled = findLastFilledRowInColumn_(settingsSh, def.settingsCol, 2);
    if (lastFilled < 2) continue;

    var sourceRange = settingsSh.getRange(2, def.settingsCol, lastFilled - 1, 1);
    var rule = SpreadsheetApp.newDataValidation()
      .requireValueInRange(sourceRange, true)
      .setAllowInvalid(true)
      .setHelpText(def.helpText)
      .build();

    headSh.getRange(2, targetCol, targetRows, 1).setDataValidation(rule);
  }
}

/** ===== キー列で行検索 ===== */
function findRowByKey_(sheet, map, keyHeaderName, keyValue) {
  var c = map[keyHeaderName];
  if (!c) throw new Error("キー列がありません: " + keyHeaderName);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  var vals = sheet.getRange(2, c, lastRow - 1, 1).getValues().flat();
  for (var i = 0; i < vals.length; i++) {
    if (String(vals[i] || "").trim() === String(keyValue)) return i + 2;
  }
  return 0;
}

/** ===== visitKey + caseNo 複合キーで来院ケース行を検索 ===== */
function findCaseRowByVisitKeyAndCaseNo_(caseSh, caseMap, visitKey, caseNo) {
  var lastRow = caseSh.getLastRow();
  if (lastRow < 2) return 0;
  var n = lastRow - 1;
  var cVk = caseMap[CASE_COLS.visitKey];
  var cNo = caseMap[CASE_COLS.caseNo];
  if (!cVk || !cNo) return 0;
  var vkVals = caseSh.getRange(2, cVk, n, 1).getValues().flat();
  var noVals = caseSh.getRange(2, cNo, n, 1).getValues().flat();
  for (var i = 0; i < n; i++) {
    if (String(vkVals[i] || "").trim() === visitKey && Number(noVals[i] || 0) === caseNo) {
      return i + 2;
    }
  }
  return 0;
}

/** ===== rowArrへ列名でセット ===== */
function setByName_(rowArr, headerMap, name, value, opt) {
  opt = opt || {};
  var col = headerMap[name];
  if (!col) throw new Error("対象シートに列がありません: " + name);
  var idx = col - 1;
  if (opt.preserveIfExists && rowArr[idx] !== "" && rowArr[idx] != null) return;
  rowArr[idx] = value;
}

/** ===== チェック安全弁 ===== */
function coreHasAny_(rowVals) {
  var part = String(rowVals[0] || "").trim();
  var dis  = String(rowVals[1] || "").trim();
  var inj  = rowVals[2] instanceof Date;
  return !!(part || dis || inj);
}
function forceChecksFalse_(rowVals) {
  rowVals[3] = false;
  rowVals[4] = false;
  rowVals[5] = false;
}
function forceWarmElecTrue_(rowVals) {
  rowVals[4] = true;
  rowVals[5] = true;
}

/** ===== 終了判定 ===== */
function isEnded_(endVal, treatDate) {
  if (endVal === "" || endVal == null) return false;
  if (!(endVal instanceof Date)) return true;
  if (!(treatDate instanceof Date)) return true;
  return endVal.getTime() <= treatDate.getTime();
}

/**
 * 終了済み部位行に取消線を適用し、A〜F列を入力不可にする。
 * 未終了の場合は取消線を解除し、入力可能に戻す。
 */
function applyEndedProtection_(uiSh, rowA1, isEnded) {
  var fullRange = uiSh.getRange(rowA1);  // A12:H12 etc.
  var row = fullRange.getRow();
  var afRange = uiSh.getRange(row, 1, 1, 6);  // A〜F列

  if (isEnded) {
    afRange.setFontLine("line-through");
    afRange.setFontColor("#999999");
    // A-C: テキスト入力を拒否するバリデーション
    var lockRule = SpreadsheetApp.newDataValidation()
      .requireTextEqualTo("__LOCKED__")
      .setAllowInvalid(false)
      .setHelpText("この部位は終了済みのため変更できません")
      .build();
    uiSh.getRange(row, 1, 1, 3).setDataValidation(lockRule);
    // D-F: チェックボックスだがロック（同じルールで上書き）
    uiSh.getRange(row, 4, 1, 3).setDataValidation(lockRule);
  } else {
    afRange.setFontLine("none");
    afRange.setFontColor(null);
    // A-C: ロック用バリデーションが設定されている場合のみ解除
    // （元の部位名・傷病名プルダウンを壊さないよう、ロック判定して解除）
    for (var ci = 1; ci <= 3; ci++) {
      var cellRange = uiSh.getRange(row, ci);
      var existing = cellRange.getDataValidation();
      if (existing) {
        var helpText = existing.getHelpText() || "";
        if (helpText.indexOf("終了済み") >= 0) {
          cellRange.clearDataValidations();
        }
      }
    }
    // D-F: チェックボックスに再設定
    var cbRule = SpreadsheetApp.newDataValidation().requireCheckbox().build();
    uiSh.getRange(row, 4, 1, 3).setDataValidation(cbRule);
  }
}

/** 転帰ドロップダウンを設定（H12,H13,H36,H37） */
function setupTenkiValidation_(uiSh) {
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["治癒", "中止", "転医"], true)
    .setAllowInvalid(false)
    .build();
  ["H12", "H13", "H36", "H37"].forEach(function(cell) {
    uiSh.getRange(cell).setDataValidation(rule);
  });
}

/** メニュー実行用: 転帰ドロップダウン初期設定 */
function menuSetupTenkiValidation_V3() {
  var uiSh = SpreadsheetApp.getActive().getSheetByName(SHEETS.ui);
  setupTenkiValidation_(uiSh);
  SpreadsheetApp.getActive().toast("転帰ドロップダウンを設定しました", "完了", 3);
}

/** ===== UIの2行入力を読む ===== */
function readRowNewUI_(uiSh, a1) {
  var v = uiSh.getRange(a1).getValues()[0];

  var part = String(v[0] || "").trim();
  var disease = String(v[1] || "").trim();
  var injuryDate = (v[2] instanceof Date) ? v[2] : "";

  var cold = v[3] === true;
  var warm = v[4] === true;
  var elec = v[5] === true;

  var endRaw = v[6];
  var endVal =
    (endRaw instanceof Date) ? endRaw :
    (String(endRaw || "").trim() ? String(endRaw) : "");

  var tenki = String(v[7] || "").trim();  // H列（転帰: 治癒/中止/転医）

  var hasCore = !!(part || disease || injuryDate);

  return { part: part, disease: disease, injuryDate: injuryDate, cold: cold, warm: warm, elec: elec, endVal: endVal, tenki: tenki, hasCore: hasCore };
}

/** ===== UIにケースデータがあるか判定（部位・傷病・受傷日のいずれか） ===== */
function hasCaseDataInUI_(uiSh, caseNo) {
  var rows = (caseNo === 1) ? UI.case1_rows : UI.case2_rows;
  for (var i = 0; i < rows.length; i++) {
    var line = readRowNewUI_(uiSh, rows[i]);
    if (line.hasCore) return true;
  }
  return false;
}

/** ===== 来院ケースから患者の来院日一覧 ===== */
function getPatientVisitDatesFromCases_(caseSh, caseMap, patientId) {
  var lastRow = caseSh.getLastRow();
  if (lastRow < 2) return [];

  var n = lastRow - 1;
  var cPid = caseMap[CASE_COLS.patientId];
  var cDt  = caseMap[CASE_COLS.treatDate];

  var pidVals = caseSh.getRange(2, cPid, n, 1).getValues().flat();
  var dtVals  = caseSh.getRange(2, cDt,  n, 1).getValues().flat();

  var set = new Map();
  for (var i = 0; i < n; i++) {
    if (String(pidVals[i] || "").trim() !== patientId) continue;
    var d = dtVals[i];
    if (!(d instanceof Date)) continue;
    var k = fmt_(d, "yyyy-MM-dd");
    if (!set.has(k)) set.set(k, d);
  }
  return Array.from(set.values()).sort(function(a,b){ return a.getTime()-b.getTime(); });
}


/* =======================================================================
   saveVisit_V3  ―  統合保存（ケース保存＋金額計算＋ヘッダ追記）
   ======================================================================= */
function saveVisit_V3() {
  var ss = SpreadsheetApp.getActive();
  var uiSh   = ss.getSheetByName(SHEETS.ui);
  var caseSh = ss.getSheetByName(SHEETS.cases);
  var headSh = ss.getSheetByName(SHEETS.header);
  // どのシートが不足しているかを個別に特定して通知する
  var missing = [];
  if (!uiSh)   missing.push(SHEETS.ui   + "（入力元）");
  if (!caseSh) missing.push(SHEETS.cases + "（保存先）");
  if (!headSh) missing.push(SHEETS.header + "（保存先）");
  if (missing.length) {
    Logger.log("必要シート不足: " + missing.join(", "));
    throw new Error("必要シート不足: " + missing.join(", "));
  }

  var patientId = String(uiSh.getRange(UI.patientId).getValue() || "").trim();
  var treatDate = uiSh.getRange(UI.treatDate).getValue();

  if (!patientId) throw new Error("患者を選択してください（B2で検索→選択）。");
  if (!(treatDate instanceof Date)) throw new Error("来院日（B4）が日付になっていません。");

  var visitKey = buildVisitKey_(patientId, treatDate);
  var now = new Date();

  // ★ Phase 0: 自費・経営情報をUIから読み込む（保険算定とは完全に独立）
  var selfPayInfo = readSelfPayFromUI_V3_(uiSh);

  // ★ Phase 2: 自費明細の未保存警告チェック
  if (!checkSelfPayWarningBeforeSave_V3_(uiSh)) {
    return;  // キャンセル
  }

  // ★ 会計区分ゲート（Phase 2 バグ修正: 自費のみ時の保険保存防止）
  // 空欄・未選択は後方互換で保険処理ありとして扱う
  var acctType        = selfPayInfo.accountingType;
  var isInsuranceVisit = (acctType !== "自費のみ");   // 保険のみ / 保険+自費 / 空欄 → true
  var isSelfPayVisit   = (acctType !== "保険のみ");   // 保険+自費 / 自費のみ / 空欄 → true

  // ★ 会計区分クロスチェック警告（レセプト事故防止）
  if (!checkAccountingTypeCrossWarning_V3_(uiSh, acctType)) {
    return;  // キャンセル
  }

  var caseMap = buildHeaderColMap_(caseSh);
  // 不足ヘッダーを自動追加（転帰列など新規追加列への対応）
  caseMap = ensureHeaderCols_(caseSh, caseMap, Object.values(CASE_COLS));
  var headMap = buildHeaderColMap_(headSh);
  headMap = ensureHeaderCols_(headSh, headMap, Object.values(HEADER_COLS));
  var settingsSh = ss.getSheetByName(SHEETS.settings);
  if (settingsSh) setupHeaderChoiceValidation_V3_(settingsSh, headSh, headMap);
  ensureRequiredCols_(caseMap, Object.values(CASE_COLS), SHEETS.cases);
  ensureRequiredCols_(headMap, Object.values(HEADER_COLS), SHEETS.header);

  // ★二重登録禁止チェック（来院ヘッダに同一visitKeyがあれば停止）
  var existingHeaderRow = findRowByKey_(headSh, headMap, HEADER_COLS.visitKey, visitKey);
  if (existingHeaderRow > 0) {
    throw new Error(
      "同日二重登録禁止：来院ヘッダに同一visitKeyが存在します。\n" +
      "visitKey: " + visitKey + "（行 " + existingHeaderRow + "）\n" +
      "修正は別機能で行ってください。"
    );
  }

  // ★UIデータ先読み（必須チェック・治療法チェック・近接チェックで共有）
  var caseConfigs = [
    { no: 1, rows: UI.case1_rows, label: "ケース1" },
    { no: 2, rows: UI.case2_rows, label: "ケース2" }
  ];
  for (var ci = 0; ci < caseConfigs.length; ci++) {
    caseConfigs[ci].line1 = readRowNewUI_(uiSh, caseConfigs[ci].rows[0]);
    caseConfigs[ci].line2 = readRowNewUI_(uiSh, caseConfigs[ci].rows[1]);
  }

  // ★必須フィールドチェック（保険処理ありの場合のみ）
  if (isInsuranceVisit) {
    var requiredErrors = [];
    for (var vi = 0; vi < caseConfigs.length; vi++) {
      var cfg = caseConfigs[vi];
      var lines = [cfg.line1, cfg.line2];
      for (var ri = 0; ri < lines.length; ri++) {
        var line = lines[ri];
        if (!line.hasCore) continue;
        var missing = [];
        if (!line.part)       missing.push("部位");
        if (!line.disease)    missing.push("傷病");
        if (!line.injuryDate) missing.push("受傷日");
        if (missing.length > 0) {
          requiredErrors.push(cfg.label + " 行" + (ri + 1) + ": " + missing.join("・") + " が未入力");
        }
      }
    }
    if (requiredErrors.length > 0) {
      throw new Error(
        "必須項目が未入力のため保存できません。\n\n" +
        requiredErrors.join("\n")
      );
    }
  }

  // ★治療法チェック・転帰チェック・近接部位チェック（保険処理ありの場合のみ）
  if (isInsuranceVisit) {
    // 治療法チェック（前回来院との比較 — 警告のみ、保存はブロックしない）
    var therapyWarnings = [];
    for (var ti = 0; ti < caseConfigs.length; ti++) {
      var tcfg = caseConfigs[ti];
      if (!tcfg.line1.hasCore && !tcfg.line2.hasCore) continue;
      var latestDate = findLatestCaseRowDateInEpisode_(caseSh, caseMap, patientId, treatDate, tcfg.no);
      if (!latestDate) continue;
      var prevRow = findCaseRowByPatientDateCaseNo_(caseSh, caseMap, patientId, latestDate, tcfg.no);
      if (!prevRow) continue;
      if (tcfg.line1.hasCore) {
        var d1 = [];
        if (prevRow.cold1 && !tcfg.line1.cold) d1.push("冷罨法");
        if (prevRow.warm1 && !tcfg.line1.warm) d1.push("温罨法");
        if (prevRow.elec1 && !tcfg.line1.elec) d1.push("電療");
        if (d1.length) therapyWarnings.push(tcfg.label + " 部位1: " + d1.join("・"));
      }
      if (tcfg.line2.hasCore) {
        var d2 = [];
        if (prevRow.cold2 && !tcfg.line2.cold) d2.push("冷罨法");
        if (prevRow.warm2 && !tcfg.line2.warm) d2.push("温罨法");
        if (prevRow.elec2 && !tcfg.line2.elec) d2.push("電療");
        if (d2.length) therapyWarnings.push(tcfg.label + " 部位2: " + d2.join("・"));
      }
    }
    if (therapyWarnings.length > 0) {
      ss.toast(
        "前回適用の治療法が今回チェックされていません:\n" + therapyWarnings.join("\n"),
        "治療法の確認", 10
      );
    }

    // 終了日⇔転帰の整合チェック（BLOCKING）
    var tenkiErrors = [];
    for (var tci = 0; tci < caseConfigs.length; tci++) {
      var tcfg2 = caseConfigs[tci];
      var tlines = [tcfg2.line1, tcfg2.line2];
      for (var tri = 0; tri < tlines.length; tri++) {
        var tline = tlines[tri];
        if (!tline.hasCore) continue;
        var hasEnd = (tline.endVal !== "" && tline.endVal != null);
        var hasTenki = !!tline.tenki;
        if (hasEnd && !hasTenki) {
          tenkiErrors.push(tcfg2.label + " 部位" + (tri + 1) + ": 終了日がありますが転帰が未選択です");
        }
        if (!hasEnd && hasTenki) {
          tenkiErrors.push(tcfg2.label + " 部位" + (tri + 1) + ": 転帰がありますが終了日が未入力です");
        }
      }
    }
    if (tenkiErrors.length > 0) {
      throw new Error("終了日と転帰の整合性エラー:\n\n" + tenkiErrors.join("\n"));
    }

    // 近接部位チェック（§18 — 近接部位があれば保存ブロック）
    var proxErrors = [];
    for (var pi = 0; pi < caseConfigs.length; pi++) {
      var pcfg = caseConfigs[pi];
      if (pcfg.line1.hasCore && pcfg.line2.hasCore) {
        var prox = checkProximityParts_V3_(pcfg.line1.part, pcfg.line1.disease, pcfg.line2.part, pcfg.line2.disease);
        if (prox.isProximity) {
          proxErrors.push("ケース" + pcfg.no + ": " + prox.reason);
        }
      }
    }
    if (proxErrors.length > 0) {
      throw new Error(
        "近接部位が検出されたため保存できません。\n部位または傷病名を修正してください。\n\n" +
        proxErrors.join("\n")
      );
    }
  }  // end isInsuranceVisit checks

  // ① 来院ケースへ保存（保険処理ありの場合のみ）
  var case1HasData = false;
  var case2HasData = false;
  var ep1 = null;
  var ep2 = null;
  var kubun1 = "";
  var kubun2 = "";

  if (isInsuranceVisit) {
    // UIに実データがあるケースのみ区分を有効にする（空ケースの"初検"誤判定を防止）
    case1HasData = hasCaseDataInUI_(uiSh, 1);
    case2HasData = hasCaseDataInUI_(uiSh, 2);

    ep1 = calcEpisodeForCase_(caseSh, caseMap, patientId, treatDate, 1);
    ep2 = calcEpisodeForCase_(caseSh, caseMap, patientId, treatDate, 2);

    kubun1 = case1HasData ? ep1.kubun : "";
    kubun2 = case2HasData ? ep2.kubun : "";

    var res1 = upsertOneCase_(uiSh, caseSh, caseMap, {
      visitKey: visitKey, patientId: patientId, treatDate: treatDate,
      kubun: ep1.kubun,
      caseNo: 1,
      now: now,
      episodeStartDate: ep1.episodeStartDate
    });
    // 初検時のみ初検情報履歴へ upsert
    if (res1 && res1.kubun === "初検") {
      appendInitHistory_V3_(ss, patientId, 1, res1.caseKey, treatDate,
                            readInitInfoFromUI_(uiSh, 1));
    }

    var res2 = upsertOneCase_(uiSh, caseSh, caseMap, {
      visitKey: visitKey, patientId: patientId, treatDate: treatDate,
      kubun: ep2.kubun,
      caseNo: 2,
      now: now,
      episodeStartDate: ep2.episodeStartDate
    });
    // 初検時のみ初検情報履歴へ upsert
    if (res2 && res2.kubun === "初検") {
      appendInitHistory_V3_(ss, patientId, 2, res2.caseKey, treatDate,
                            readInitInfoFromUI_(uiSh, 2));
    }
  }  // end isInsuranceVisit case saving

  // ② 金額計算（保険処理ありの場合のみ / 自費のみは全ゼロ）
  var amounts;
  if (isInsuranceVisit) {
    // 来院ケースベース。UIに実データがあるケースの区分のみを渡す
    amounts = calcHeaderAmountsByVisitKey_V3_(ss, visitKey, patientId, treatDate, kubun1, kubun2);
  } else {
    // 自費のみ: 保険算定なし → 保険列はすべてゼロ
    amounts = buildZeroInsuranceAmounts_V3_();
  }

  // ③ 来院ヘッダへ1行追記
  var injuryFixed = null;
  var row1idx = findCaseRowByVisitKeyAndCaseNo_(caseSh, caseMap, visitKey, 1);
  if (row1idx > 0) {
    var v = caseSh.getRange(row1idx, caseMap[CASE_COLS.injuryFixed], 1, 1).getValue();
    if (v instanceof Date) injuryFixed = v;
  }
  if (!injuryFixed) {
    var row2idx = findCaseRowByVisitKeyAndCaseNo_(caseSh, caseMap, visitKey, 2);
    if (row2idx > 0) {
      var v2 = caseSh.getRange(row2idx, caseMap[CASE_COLS.injuryFixed], 1, 1).getValue();
      if (v2 instanceof Date) injuryFixed = v2;
    }
  }

  var lastVisit = findLastVisitDateInHeader_(headSh, headMap, patientId, treatDate);
  var gapDays = (lastVisit instanceof Date) ? daysBetween_(lastVisit, treatDate) : "";

  var kubunLabel = kubun1 || kubun2 || "";

  appendHeaderRow_V3_(headSh, headMap, {
    visitKey: visitKey,
    treatDate: treatDate,
    patientId: patientId,
    kubun: kubunLabel,
    injuryVisit: injuryFixed,
    initFee: amounts.initFee,
    reFee: amounts.reFee,
    supportFee: amounts.supportFee,
    detailSum: amounts.detailSum,
    visitTotal: amounts.visitTotal,
    windowPay: amounts.windowPay,
    claimPay: amounts.claimPay,
    lastVisit: lastVisit || "",
    gapDays: gapDays,
    needCheck: amounts.needCheck ? true : false,
    needCheckReason: amounts.needCheckReason || "",
    createdAt: now,
    // 自費のみの場合は ep1/ep2 が null のため null-safe に処理する
    caseKey: case1HasData
      ? buildCaseKey_(patientId, ep1.episodeStartDate, 1)
      : (case2HasData ? buildCaseKey_(patientId, ep2.episodeStartDate, 2) : ""),
    caseIndex: case1HasData ? 1 : (case2HasData ? 2 : 0),
    // HIGH-2: 同日に case1/case2 が両方アクティブの場合に第2ケースキーを保存
    caseKey2: (case1HasData && case2HasData)
      ? buildCaseKey_(patientId, ep2.episodeStartDate, 2)
      : "",
    // mixed case 説明性列
    billedKubun: amounts.billedKubun || "",
    mixedFlag: amounts.mixedFlag || "",
    case1Summary: amounts.case1Summary || "",
    case2Summary: amounts.case2Summary || "",
    chargeReason: amounts.chargeReason || "",
    // 来院性質（保険算定とは独立。来院合計には混入しない）
    // selfPayMenuType / selfPayAmount / selfPayMenuCode は 2026-03-23 撤去（自費明細シートが正本）
    accountingType:       selfPayInfo.accountingType,
    chronicCandidateFlag: selfPayInfo.chronicCandidateFlag,
    nextReservation:      selfPayInfo.nextReservation,
    firstVisitType:       selfPayInfo.firstVisitType,
    gymMemberFlag:        selfPayInfo.gymMemberFlag,    // Phase A: ジム会員フラグ
  });

  // ④ 施術明細upsert（保険処理ありの場合のみ）
  if (isInsuranceVisit) {
    var detailSh = ss.getSheetByName(SHEETS.detail);
    if (detailSh) {
      var detailMap = buildHeaderColMap_(detailSh);
      upsertDetailRows_V3_(detailSh, detailMap, {
        visitKey: visitKey,
        patientId: patientId,
        treatDate: treatDate,
        kubun1: kubun1,
        kubun2: kubun2,
        amounts: amounts,
        ep1: ep1,
        ep2: ep2,
        now: now,
      });
    }
  }

  // ⑤ UI会計ブロック更新
  if (isInsuranceVisit) {
    writeAmountsToUI_V3_(uiSh, amounts);
  } else {
    clearAmountsUI_V3_(uiSh);  // 自費のみ: 保険金額欄をクリア（誤表示防止）
  }

  // ⑥ 経過履歴更新 / UIクリア
  // JREC-01 サマリー用: B2（患者表示名）と自費合計を clearAfterSaveUI_V3_ 前に取得
  var patientDisplayName_ = String(uiSh.getRange(UI.patientDisplay).getValue() || "").trim();
  var selfPayDetailSh_ = ss.getSheetByName(SHEETS.selfPayDetail);
  var selfPayItems_    = selfPayDetailSh_ ? readSelfPayDetailsForVisit_V3_(selfPayDetailSh_, visitKey) : [];
  var selfPayTotal_    = selfPayItems_.reduce(function(sum, item) {
    return sum + Number(item.subtotal || 0);
  }, 0);

  refreshKeikaHistoryUI_V3();
  clearAfterSaveUI_V3_(uiSh);

  // 保存後会計サマリー書き込み（JREC-01 Case A: J2:N22）
  writeSavedSummaryUI_V3_(uiSh, {
    patientName:    patientDisplayName_,
    treatDate:      treatDate,
    accountingType: acctType,
    visitTotal:     isInsuranceVisit ? (amounts.visitTotal || 0) : 0,
    windowPay:      isInsuranceVisit ? (amounts.windowPay  || 0) : 0,
    selfPayTotal:   selfPayTotal_,
    visitKey:       visitKey,
  });

  if (isInsuranceVisit) {
    SpreadsheetApp.getUi().alert(
      "保存完了（統合：ケース＋金額＋ヘッダ）\n" +
      "visitKey: " + visitKey + "\n" +
      "来院合計: " + amounts.visitTotal + "\n" +
      "窓口負担: " + amounts.windowPay + "\n" +
      "保険請求: " + amounts.claimPay + "\n\n" +
      "J2 右側に会計サマリーを表示しました。"
    );
  } else {
    SpreadsheetApp.getUi().alert(
      "保存完了（自費のみ）\n" +
      "visitKey: " + visitKey + "\n" +
      "※ 保険ケース保存・保険算定は行っていません\n" +
      "保険請求額: 0（会計区分 = 自費のみ）\n\n" +
      "J2 右側に会計サマリーを表示しました。"
    );
  }
}


/* =======================================================================
   appendHeaderRow_V3_  ―  来院ヘッダへ1行追記（visitKey重複時throw）
   ======================================================================= */
function appendHeaderRow_V3_(headSh, headMap, obj) {
  // 二重登録禁止チェック（念のため再チェック）
  var existingRow = findRowByKey_(headSh, headMap, HEADER_COLS.visitKey, obj.visitKey);
  if (existingRow > 0) {
    throw new Error(
      "来院ヘッダに同一visitKeyが存在します（二重登録禁止）。\n" +
      "visitKey: " + obj.visitKey + "（行 " + existingRow + "）"
    );
  }

  var rowArr = new Array(headSh.getLastColumn()).fill("");

  setByName_(rowArr, headMap, HEADER_COLS.visitKey, obj.visitKey);
  setByName_(rowArr, headMap, HEADER_COLS.treatDate, obj.treatDate);
  setByName_(rowArr, headMap, HEADER_COLS.patientId, obj.patientId);
  setByName_(rowArr, headMap, HEADER_COLS.kubun, obj.kubun);
  if (obj.injuryVisit instanceof Date) {
    setByName_(rowArr, headMap, HEADER_COLS.injuryVisit, obj.injuryVisit);
  }
  setByName_(rowArr, headMap, HEADER_COLS.initFee, obj.initFee);
  setByName_(rowArr, headMap, HEADER_COLS.reFee, obj.reFee);
  setByName_(rowArr, headMap, HEADER_COLS.supportFee, obj.supportFee);
  setByName_(rowArr, headMap, HEADER_COLS.detailSum, obj.detailSum);
  setByName_(rowArr, headMap, HEADER_COLS.visitTotal, obj.visitTotal);
  setByName_(rowArr, headMap, HEADER_COLS.windowPay, obj.windowPay);
  setByName_(rowArr, headMap, HEADER_COLS.claimPay, obj.claimPay);
  setByName_(rowArr, headMap, HEADER_COLS.lastVisit, obj.lastVisit);
  setByName_(rowArr, headMap, HEADER_COLS.gapDays, obj.gapDays);
  setByName_(rowArr, headMap, HEADER_COLS.needCheck, obj.needCheck);
  if (headMap[HEADER_COLS.needCheckReason]) {
    setByName_(rowArr, headMap, HEADER_COLS.needCheckReason, obj.needCheckReason || "");
  }
  setByName_(rowArr, headMap, HEADER_COLS.createdAt, obj.createdAt);
  setByName_(rowArr, headMap, HEADER_COLS.caseKey, obj.caseKey);
  setByName_(rowArr, headMap, HEADER_COLS.caseIndex, obj.caseIndex);
  // 保険算定の「区分」とは別に、経営KPI用の会計区分を保持する（Phase 0: UIから読み取り）
  setByName_(rowArr, headMap, HEADER_COLS.accountingType, obj.accountingType != null ? obj.accountingType : "");
  // selfPayMenuType / selfPayAmount / selfPayMenuCode は 2026-03-23 撤去
  setByName_(rowArr, headMap, HEADER_COLS.chronicCandidateFlag, obj.chronicCandidateFlag != null ? obj.chronicCandidateFlag : "");
  setByName_(rowArr, headMap, HEADER_COLS.nextReservation, obj.nextReservation != null ? obj.nextReservation : "");
  setByName_(rowArr, headMap, HEADER_COLS.firstVisitType, obj.firstVisitType != null ? obj.firstVisitType : "");
  // Phase A (2026-03-31): ジム会員フラグ — boolean。列が存在しない旧シートでは setByName_ が無視する
  if (headMap[HEADER_COLS.gymMemberFlag] !== undefined) {
    setByName_(rowArr, headMap, HEADER_COLS.gymMemberFlag, obj.gymMemberFlag === true ? true : false);
  }
  // HIGH-2: 同日2ケース活性時に第2ケースキーを記録（通常空）
  setByName_(rowArr, headMap, HEADER_COLS.caseKey2, obj.caseKey2 != null ? obj.caseKey2 : "");
  // mixed case 説明性列（列が存在しない場合は setByName_ が無視する）
  if (headMap[HEADER_COLS.billedKubun]) {
    setByName_(rowArr, headMap, HEADER_COLS.billedKubun, obj.billedKubun != null ? obj.billedKubun : "");
  }
  if (headMap[HEADER_COLS.mixedFlag]) {
    setByName_(rowArr, headMap, HEADER_COLS.mixedFlag, obj.mixedFlag != null ? obj.mixedFlag : "");
  }
  if (headMap[HEADER_COLS.case1Summary]) {
    setByName_(rowArr, headMap, HEADER_COLS.case1Summary, obj.case1Summary != null ? obj.case1Summary : "");
  }
  if (headMap[HEADER_COLS.case2Summary]) {
    setByName_(rowArr, headMap, HEADER_COLS.case2Summary, obj.case2Summary != null ? obj.case2Summary : "");
  }
  if (headMap[HEADER_COLS.chargeReason]) {
    setByName_(rowArr, headMap, HEADER_COLS.chargeReason, obj.chargeReason != null ? obj.chargeReason : "");
  }

  headSh.getRange(headSh.getLastRow() + 1, 1, 1, headSh.getLastColumn()).setValues([rowArr]);
}


/* =======================================================================
   upsertDetailRows_V3_  ―  施術明細シートへ部位行をupsert
   detailID = visitKey + "_C" + caseNo + "_P" + partOrder
   ======================================================================= */
function upsertDetailRows_V3_(detailSh, detailMap, ctx) {
  var visitKey = ctx.visitKey;
  var amounts = ctx.amounts;
  if (!amounts.details) return;

  var allParts = [];

  // caseKey生成
  var caseKey1 = buildCaseKey_(ctx.patientId, ctx.ep1.episodeStartDate, 1);
  var caseKey2 = buildCaseKey_(ctx.patientId, ctx.ep2.episodeStartDate, 2);

  // effectiveKubun は金額算定（calcCaseDetailAmount_V3_）専用の請求実効区分。
  // 施術明細.区分 列には case 自体の生の kubun を記録する。
  // 初検抑制後の請求区分は 来院ヘッダ.billedKubun / case2Summary で管理。

  // case1
  var c1Parts = amounts.details.case1Parts || [];
  for (var i = 0; i < c1Parts.length; i++) {
    allParts.push({ caseNo: 1, part: c1Parts[i], kubun: ctx.kubun1, caseKey: caseKey1 });
  }

  // case2
  var c2Parts = amounts.details.case2Parts || [];
  for (var j = 0; j < c2Parts.length; j++) {
    allParts.push({ caseNo: 2, part: c2Parts[j], kubun: ctx.kubun2, caseKey: caseKey2 });
  }

  var colCount = detailSh.getLastColumn();

  for (var k = 0; k < allParts.length; k++) {
    var entry = allParts[k];
    var p = entry.part;
    var detailID = visitKey + "_C" + entry.caseNo + "_P" + p.partOrder;

    // 既存行検索
    var existingRow = 0;
    if (detailMap[AM_DETAIL_COLS.detailID]) {
      existingRow = findRowByKey_(detailSh, detailMap, AM_DETAIL_COLS.detailID, detailID);
    }

    var rowArr;
    if (existingRow > 0) {
      // 既存行を読み込んで上書き
      rowArr = detailSh.getRange(existingRow, 1, 1, colCount).getValues()[0];
    } else {
      rowArr = new Array(colCount).fill("");
    }

    setByName_(rowArr, detailMap, AM_DETAIL_COLS.detailID, detailID);
    setByName_(rowArr, detailMap, AM_DETAIL_COLS.visitKey, visitKey);
    setByName_(rowArr, detailMap, AM_DETAIL_COLS.patientId, ctx.patientId);
    setByName_(rowArr, detailMap, AM_DETAIL_COLS.treatDate, ctx.treatDate);
    setByName_(rowArr, detailMap, AM_DETAIL_COLS.kubun, entry.kubun);
    setByName_(rowArr, detailMap, AM_DETAIL_COLS.caseNo, entry.caseNo);
    setByName_(rowArr, detailMap, AM_DETAIL_COLS.caseKey, entry.caseKey);
    setByName_(rowArr, detailMap, AM_DETAIL_COLS.bui, p.bui || "");
    setByName_(rowArr, detailMap, AM_DETAIL_COLS.byomei, p.byomei || "");
    setByName_(rowArr, detailMap, AM_DETAIL_COLS.partOrder, p.partOrder);
    if (p.injuryDate instanceof Date) {
      setByName_(rowArr, detailMap, AM_DETAIL_COLS.injuryDateFixed, p.injuryDate);
    }
    setByName_(rowArr, detailMap, AM_DETAIL_COLS.coldChk, p.coldChk);
    setByName_(rowArr, detailMap, AM_DETAIL_COLS.warmChk, p.warmChk);
    setByName_(rowArr, detailMap, AM_DETAIL_COLS.electroChk, p.electroChk);

    // 確定金額
    setByName_(rowArr, detailMap, AM_DETAIL_COLS.coefOut, p.coef);
    setByName_(rowArr, detailMap, AM_DETAIL_COLS.baseOut, p.base);
    setByName_(rowArr, detailMap, AM_DETAIL_COLS.supportOut, 0);
    setByName_(rowArr, detailMap, AM_DETAIL_COLS.coldOut, p.cold);
    setByName_(rowArr, detailMap, AM_DETAIL_COLS.warmOut, p.warm);
    setByName_(rowArr, detailMap, AM_DETAIL_COLS.electroOut, p.electro);
    setByName_(rowArr, detailMap, AM_DETAIL_COLS.taikiOut, p.taiki);
    setByName_(rowArr, detailMap, AM_DETAIL_COLS.rowTotalOut, p.total);

    if (existingRow > 0) {
      detailSh.getRange(existingRow, 1, 1, colCount).setValues([rowArr]);
    } else {
      detailSh.getRange(detailSh.getLastRow() + 1, 1, 1, colCount).setValues([rowArr]);
    }
  }
}


/* =====================================================
   upsertOneCase_（来院ケースへ1ケース保存）
   ===================================================== */
function upsertOneCase_(uiSh, caseSh, caseMap, base) {
  var visitKey = base.visitKey;
  var patientId = base.patientId;
  var treatDate = base.treatDate;
  var kubun = base.kubun;
  var caseNo = base.caseNo;
  var now = base.now;
  var episodeStartDate = base.episodeStartDate;

  var rows = (caseNo === 1) ? UI.case1_rows : UI.case2_rows;
  var shokenRange = (caseNo === 1) ? UI.case1_shoken : UI.case2_shoken;
  var keikaRange  = (caseNo === 1) ? UI.case1_keikaNow : UI.case2_keikaNow;

  var line1 = readRowNewUI_(uiSh, rows[0]);
  var line2 = readRowNewUI_(uiSh, rows[1]);

  var shoken = String(getMergedValue_(uiSh, shokenRange) || "").trim();
  var keikaNow = String(getMergedValue_(uiSh, keikaRange) || "").trim();

  var hasAny = line1.hasCore || line2.hasCore || !!shoken || !!keikaNow || !!line1.endVal || !!line2.endVal;
  if (!hasAny) return;

  var injuryFixed = minDate_(line1.injuryDate, line2.injuryDate);
  // caseKey = エピソードID（初検日ベース）
  var caseKey = buildCaseKey_(patientId, episodeStartDate, caseNo);
  // 来院ケース行の検索は visitKey + caseNo 複合キー
  var rowIndex = findCaseRowByVisitKeyAndCaseNo_(caseSh, caseMap, visitKey, caseNo);

  if (rowIndex === 0) {
    var rowArr = new Array(caseSh.getLastColumn()).fill("");

    setByName_(rowArr, caseMap, CASE_COLS.visitKey, visitKey);
    setByName_(rowArr, caseMap, CASE_COLS.treatDate, treatDate);
    setByName_(rowArr, caseMap, CASE_COLS.patientId, patientId);
    setByName_(rowArr, caseMap, CASE_COLS.caseNo, caseNo);
    setByName_(rowArr, caseMap, CASE_COLS.caseKey, caseKey);
    setByName_(rowArr, caseMap, CASE_COLS.kubun, kubun);

    if (injuryFixed) setByName_(rowArr, caseMap, CASE_COLS.injuryFixed, injuryFixed);

    writeLinesToCaseRow_(rowArr, caseMap, line1, line2);

    if (line1.hasCore) setByName_(rowArr, caseMap, CASE_COLS.start1, (kubun === "初検") ? treatDate : episodeStartDate);
    if (line2.hasCore) setByName_(rowArr, caseMap, CASE_COLS.start2, (kubun === "初検") ? treatDate : episodeStartDate);

    if (line1.endVal !== "" && line1.endVal != null) setByName_(rowArr, caseMap, CASE_COLS.end1, line1.endVal);
    if (line1.tenki) setByName_(rowArr, caseMap, CASE_COLS.tenki1, line1.tenki);
    if (line2.endVal !== "" && line2.endVal != null) setByName_(rowArr, caseMap, CASE_COLS.end2, line2.endVal);
    if (line2.tenki) setByName_(rowArr, caseMap, CASE_COLS.tenki2, line2.tenki);

    if (shoken) setByName_(rowArr, caseMap, CASE_COLS.shoken, shoken);
    if (keikaNow) setByName_(rowArr, caseMap, CASE_COLS.keikaNow, keikaNow);

    setByName_(rowArr, caseMap, CASE_COLS.initFee, "");
    setByName_(rowArr, caseMap, CASE_COLS.reFee, "");
    setByName_(rowArr, caseMap, CASE_COLS.supportFee, "");
    setByName_(rowArr, caseMap, CASE_COLS.detailSum, "");
    setByName_(rowArr, caseMap, CASE_COLS.caseTotal, "");
    setByName_(rowArr, caseMap, CASE_COLS.createdAt, now);

    caseSh.appendRow(rowArr);
  } else {
    var lastCol = caseSh.getLastColumn();
    var rowArr2 = caseSh.getRange(rowIndex, 1, 1, lastCol).getValues()[0];

    setByName_(rowArr2, caseMap, CASE_COLS.visitKey, visitKey);
    setByName_(rowArr2, caseMap, CASE_COLS.treatDate, treatDate);
    setByName_(rowArr2, caseMap, CASE_COLS.patientId, patientId);
    setByName_(rowArr2, caseMap, CASE_COLS.caseNo, caseNo);
    setByName_(rowArr2, caseMap, CASE_COLS.caseKey, caseKey);
    setByName_(rowArr2, caseMap, CASE_COLS.kubun, kubun);

    if (injuryFixed) setByName_(rowArr2, caseMap, CASE_COLS.injuryFixed, injuryFixed, { preserveIfExists: true });

    writeLinesToCaseRow_(rowArr2, caseMap, line1, line2);

    if (line1.hasCore) {
      if (kubun === "初検") {
        setByName_(rowArr2, caseMap, CASE_COLS.start1, treatDate);
      } else {
        setByName_(rowArr2, caseMap, CASE_COLS.start1, episodeStartDate, { preserveIfExists: true });
      }
    }
    if (line2.hasCore) {
      if (kubun === "初検") {
        setByName_(rowArr2, caseMap, CASE_COLS.start2, treatDate);
      } else {
        setByName_(rowArr2, caseMap, CASE_COLS.start2, episodeStartDate, { preserveIfExists: true });
      }
    }

    if (line1.endVal !== "" && line1.endVal != null) setByName_(rowArr2, caseMap, CASE_COLS.end1, line1.endVal);
    if (line1.tenki) setByName_(rowArr2, caseMap, CASE_COLS.tenki1, line1.tenki);
    if (line2.endVal !== "" && line2.endVal != null) setByName_(rowArr2, caseMap, CASE_COLS.end2, line2.endVal);
    if (line2.tenki) setByName_(rowArr2, caseMap, CASE_COLS.tenki2, line2.tenki);

    if (shoken) setByName_(rowArr2, caseMap, CASE_COLS.shoken, shoken);
    if (keikaNow) setByName_(rowArr2, caseMap, CASE_COLS.keikaNow, keikaNow);

    caseSh.getRange(rowIndex, 1, 1, lastCol).setValues([rowArr2]);
  }
  return { kubun: kubun, caseKey: caseKey };
}

function writeLinesToCaseRow_(rowArr, caseMap, line1, line2) {
  setByName_(rowArr, caseMap, CASE_COLS.p1, line1.part || "");
  setByName_(rowArr, caseMap, CASE_COLS.d1, line1.disease || "");
  setByName_(rowArr, caseMap, CASE_COLS.inj1, line1.injuryDate || "");
  setByName_(rowArr, caseMap, CASE_COLS.cold1, line1.cold);
  setByName_(rowArr, caseMap, CASE_COLS.warm1, line1.warm);
  setByName_(rowArr, caseMap, CASE_COLS.elec1, line1.elec);

  setByName_(rowArr, caseMap, CASE_COLS.p2, line2.part || "");
  setByName_(rowArr, caseMap, CASE_COLS.d2, line2.disease || "");
  setByName_(rowArr, caseMap, CASE_COLS.inj2, line2.injuryDate || "");
  setByName_(rowArr, caseMap, CASE_COLS.cold2, line2.cold);
  setByName_(rowArr, caseMap, CASE_COLS.warm2, line2.warm);
  setByName_(rowArr, caseMap, CASE_COLS.elec2, line2.elec);
}

/** ===== 経過履歴（最新5件） ===== */
function refreshKeikaHistoryUI_V3() {
  var ss = SpreadsheetApp.getActive();
  var uiSh = ss.getSheetByName(SHEETS.ui);
  var caseSh = ss.getSheetByName(SHEETS.cases);
  if (!uiSh || !caseSh) return;

  var patientId = String(uiSh.getRange(UI.patientId).getValue() || "").trim();
  if (!patientId) {
    setMergedValue_(uiSh, UI.case1_keikaHistory, "");
    setMergedValue_(uiSh, UI.case2_keikaHistory, "");
    return;
  }

  var caseMap = buildHeaderColMap_(caseSh);
  ensureRequiredCols_(caseMap, [CASE_COLS.patientId, CASE_COLS.caseNo, CASE_COLS.treatDate, CASE_COLS.keikaNow], SHEETS.cases);

  var hist1 = buildKeikaHistoryTextFromCases_(caseSh, caseMap, patientId, 1, 5);
  var hist2 = buildKeikaHistoryTextFromCases_(caseSh, caseMap, patientId, 2, 5);

  setMergedValue_(uiSh, UI.case1_keikaHistory, hist1);
  setMergedValue_(uiSh, UI.case2_keikaHistory, hist2);
}

function buildKeikaHistoryTextFromCases_(caseSh, caseMap, patientId, caseNo, limit) {
  var cPid = caseMap[CASE_COLS.patientId];
  var cNo  = caseMap[CASE_COLS.caseNo];
  var cDt  = caseMap[CASE_COLS.treatDate];
  var cK   = caseMap[CASE_COLS.keikaNow];

  var lastRow = caseSh.getLastRow();
  if (lastRow < 2) return "";

  var pidVals = caseSh.getRange(2, cPid, lastRow - 1, 1).getValues().flat();
  var noVals  = caseSh.getRange(2, cNo,  lastRow - 1, 1).getValues().flat();
  var dtVals  = caseSh.getRange(2, cDt,  lastRow - 1, 1).getValues().flat();
  var kVals   = caseSh.getRange(2, cK,   lastRow - 1, 1).getValues().flat();

  var rows = [];
  for (var i = 0; i < pidVals.length; i++) {
    if (String(pidVals[i] || "").trim() !== patientId) continue;
    if (Number(noVals[i] || 0) !== caseNo) continue;

    var d = dtVals[i];
    var kv = String(kVals[i] || "").trim();
    if (!(d instanceof Date)) continue;
    if (!kv) continue;
    rows.push({ d: d, k: kv });
  }

  rows.sort(function(a, b) { return b.d.getTime() - a.d.getTime(); });
  return rows.slice(0, limit).map(function(x) { return fmt_(x.d, "M/d") + "：" + x.k; }).join("\n");
}

/** ===== 来院回数表示（B15/B30） ===== */
function refreshVisitCountUI_V3() {
  var ss = SpreadsheetApp.getActive();
  var uiSh = ss.getSheetByName(SHEETS.ui);
  var caseSh = ss.getSheetByName(SHEETS.cases);
  if (!uiSh || !caseSh) return;

  var patientId = String(uiSh.getRange(UI.patientId).getValue() || "").trim();
  var treatDate = asDate_V3_(uiSh.getRange(UI.treatDate).getValue());
  if (!patientId) {
    uiSh.getRange(UI.case1_visitCount).clearContent();
    uiSh.getRange(UI.case2_visitCount).clearContent();
    return;
  }

  var caseMap = buildHeaderColMap_(caseSh);
  var cnt1 = countVisitsForCase_(caseSh, caseMap, patientId, 1, treatDate);
  var cnt2 = countVisitsForCase_(caseSh, caseMap, patientId, 2, treatDate);

  uiSh.getRange(UI.case1_visitCount).setValue(cnt1 > 0 ? "来院回数" + cnt1 + "回目" : "");
  uiSh.getRange(UI.case2_visitCount).setValue(cnt2 > 0 ? "来院回数" + cnt2 + "回目" : "");
}

function countVisitsForCase_(caseSh, caseMap, patientId, caseNo, treatDate) {
  var lastRow = caseSh.getLastRow();
  if (lastRow < 2) return 0;
  var n = lastRow - 1;
  var cPid = caseMap[CASE_COLS.patientId];
  var cNo  = caseMap[CASE_COLS.caseNo];
  var cDt  = caseMap[CASE_COLS.treatDate];
  var cP1  = caseMap[CASE_COLS.p1];
  var cD1  = caseMap[CASE_COLS.d1];
  var cP2  = caseMap[CASE_COLS.p2];
  var cD2  = caseMap[CASE_COLS.d2];
  if (!cPid || !cNo || !cDt) return 0;

  var pidVals = caseSh.getRange(2, cPid, n, 1).getValues().flat();
  var noVals  = caseSh.getRange(2, cNo,  n, 1).getValues().flat();
  var dtVals  = caseSh.getRange(2, cDt,  n, 1).getValues().flat();
  var p1Vals  = cP1 ? caseSh.getRange(2, cP1, n, 1).getValues().flat() : [];
  var d1Vals  = cD1 ? caseSh.getRange(2, cD1, n, 1).getValues().flat() : [];
  var p2Vals  = cP2 ? caseSh.getRange(2, cP2, n, 1).getValues().flat() : [];
  var d2Vals  = cD2 ? caseSh.getRange(2, cD2, n, 1).getValues().flat() : [];

  // 重複日を排除して来院日をカウント
  var dateSet = new Set();
  for (var i = 0; i < pidVals.length; i++) {
    if (String(pidVals[i] || "").trim() !== patientId) continue;
    if (Number(noVals[i] || 0) !== caseNo) continue;
    // コアがある行のみカウント（部位or傷病が入っている）
    var hasCore = !!(String(p1Vals[i]||"").trim() || String(d1Vals[i]||"").trim() ||
                     String(p2Vals[i]||"").trim() || String(d2Vals[i]||"").trim());
    if (!hasCore) continue;
    var d = asDate_V3_(dtVals[i]);
    if (d) dateSet.add(fmt_(d, "yyyy-MM-dd"));
  }

  // 当日を含める
  if (treatDate) dateSet.add(fmt_(treatDate, "yyyy-MM-dd"));

  return dateSet.size;
}

/** ===== 自動引継ぎ ===== */
function autofillFromPreviousVisit_V3() {
  var ss = SpreadsheetApp.getActive();
  var uiSh = ss.getSheetByName(SHEETS.ui);
  var caseSh = ss.getSheetByName(SHEETS.cases);
  if (!uiSh || !caseSh) return;

  var patientId = String(uiSh.getRange(UI.patientId).getValue() || "").trim();
  var treatDate = uiSh.getRange(UI.treatDate).getValue();

  if (!patientId || !(treatDate instanceof Date)) {
    uiSh.getRange(UI.case1_kubunView).setValue("");
    uiSh.getRange(UI.case2_kubunView).setValue("");
    return;
  }

  var caseMap = buildHeaderColMap_(caseSh);
  ensureRequiredCols_(caseMap, [
    CASE_COLS.patientId, CASE_COLS.treatDate, CASE_COLS.caseNo,
    CASE_COLS.p1, CASE_COLS.d1, CASE_COLS.inj1,
    CASE_COLS.p2, CASE_COLS.d2, CASE_COLS.inj2,
    CASE_COLS.start1, CASE_COLS.end1,
    CASE_COLS.start2, CASE_COLS.end2,
    CASE_COLS.shoken
  ], SHEETS.cases);

  var ep1 = calcEpisodeForCase_(caseSh, caseMap, patientId, treatDate, 1);
  var ep2 = calcEpisodeForCase_(caseSh, caseMap, patientId, treatDate, 2);

  var latest1 = findLatestCaseRowDateInEpisode_(caseSh, caseMap, patientId, treatDate, 1);
  var latest2 = findLatestCaseRowDateInEpisode_(caseSh, caseMap, patientId, treatDate, 2);

  var src1 = latest1 ? findCaseRowByPatientDateCaseNo_(caseSh, caseMap, patientId, latest1, 1) : null;
  var src2 = latest2 ? findCaseRowByPatientDateCaseNo_(caseSh, caseMap, patientId, latest2, 2) : null;

  // case1
  (function() {
    var caseClosed = isCaseClosedAsOf_(src1, treatDate);
    if (caseClosed) {
      uiSh.getRange(UI.case1_kubunView).setValue("初検");
      setMergedValue_(uiSh, UI.case1_shoken, "");
      applyCaseRowToUI_Safe_(uiSh, null, 1, treatDate, { forceWarmElec: false });
    } else {
      uiSh.getRange(UI.case1_kubunView).setValue(ep1.kubun || "");
      applyCaseRowToUI_Safe_(uiSh, src1, 1, treatDate, { forceWarmElec: true });
      var curShoken = String(getMergedValue_(uiSh, UI.case1_shoken) || "").trim();
      if (!curShoken && src1) {
        var startForShoken = minDate_(src1.start1, src1.start2);
        var shokenDate = (startForShoken instanceof Date) ? startForShoken : ep1.episodeStartDate;
        var shokenSrc = findCaseRowByPatientDateCaseNo_(caseSh, caseMap, patientId, shokenDate, 1);
        if (shokenSrc) {
          var srcText = String(shokenSrc.shoken || "").trim();
          if (srcText) setMergedValue_(uiSh, UI.case1_shoken, srcText);
        }
      }
    }
  })();

  // case2
  (function() {
    var caseClosed = isCaseClosedAsOf_(src2, treatDate);
    if (caseClosed) {
      uiSh.getRange(UI.case2_kubunView).setValue("初検");
      setMergedValue_(uiSh, UI.case2_shoken, "");
      applyCaseRowToUI_Safe_(uiSh, null, 2, treatDate, { forceWarmElec: false });
    } else {
      uiSh.getRange(UI.case2_kubunView).setValue(ep2.kubun || "");
      applyCaseRowToUI_Safe_(uiSh, src2, 2, treatDate, { forceWarmElec: true });
      var curShoken = String(getMergedValue_(uiSh, UI.case2_shoken) || "").trim();
      if (!curShoken && src2) {
        var startForShoken = minDate_(src2.start1, src2.start2);
        var shokenDate = (startForShoken instanceof Date) ? startForShoken : ep2.episodeStartDate;
        var shokenSrc = findCaseRowByPatientDateCaseNo_(caseSh, caseMap, patientId, shokenDate, 2);
        if (shokenSrc) {
          var srcText = String(shokenSrc.shoken || "").trim();
          if (srcText) setMergedValue_(uiSh, UI.case2_shoken, srcText);
        }
      }
    }
  })();
}

function sameDateKey_(d) {
  return (d instanceof Date) ? fmt_(d, "yyyy-MM-dd") : "";
}

function findCaseRowByPatientDateCaseNo_(caseSh, caseMap, patientId, dateObj, caseNo) {
  if (!dateObj) return null;
  var lastRow = caseSh.getLastRow();
  if (lastRow < 2) return null;

  var n = lastRow - 1;
  var cPid = caseMap[CASE_COLS.patientId];
  var cDt  = caseMap[CASE_COLS.treatDate];
  var cNo  = caseMap[CASE_COLS.caseNo];

  var pidVals = caseSh.getRange(2, cPid, n, 1).getValues().flat();
  var dtVals  = caseSh.getRange(2, cDt,  n, 1).getValues().flat();
  var noVals  = caseSh.getRange(2, cNo,  n, 1).getValues().flat();

  var targetKey = sameDateKey_(dateObj);

  for (var i = 0; i < n; i++) {
    if (String(pidVals[i] || "").trim() !== patientId) continue;
    if (Number(noVals[i] || 0) !== caseNo) continue;
    var d = dtVals[i];
    if (!(d instanceof Date)) continue;
    if (sameDateKey_(d) !== targetKey) continue;

    var rowIndex = i + 2;
    var row = caseSh.getRange(rowIndex, 1, 1, caseSh.getLastColumn()).getValues()[0];
    var get = function(name) { return row[caseMap[name] - 1]; };

    return {
      p1: String(get(CASE_COLS.p1) || ""),
      d1: String(get(CASE_COLS.d1) || ""),
      inj1: (get(CASE_COLS.inj1) instanceof Date) ? get(CASE_COLS.inj1) : "",
      cold1: get(CASE_COLS.cold1) === true,
      warm1: get(CASE_COLS.warm1) === true,
      elec1: get(CASE_COLS.elec1) === true,
      start1: (get(CASE_COLS.start1) instanceof Date) ? get(CASE_COLS.start1) : "",
      end1: get(CASE_COLS.end1),

      p2: String(get(CASE_COLS.p2) || ""),
      d2: String(get(CASE_COLS.d2) || ""),
      inj2: (get(CASE_COLS.inj2) instanceof Date) ? get(CASE_COLS.inj2) : "",
      cold2: get(CASE_COLS.cold2) === true,
      warm2: get(CASE_COLS.warm2) === true,
      elec2: get(CASE_COLS.elec2) === true,
      start2: (get(CASE_COLS.start2) instanceof Date) ? get(CASE_COLS.start2) : "",
      end2: get(CASE_COLS.end2),
      tenki1: String(get(CASE_COLS.tenki1) || ""),
      tenki2: String(get(CASE_COLS.tenki2) || ""),

      shoken: String(get(CASE_COLS.shoken) || ""),
    };
  }
  return null;
}

/** ===== UIへ安全に適用 ===== */
function applyCaseRowToUI_Safe_(uiSh, src, caseNo, treatDate, opt) {
  opt = opt || {};
  var rows = (caseNo === 1) ? UI.case1_rows : UI.case2_rows;

  var rng1 = uiSh.getRange(rows[0]);
  var rng2 = uiSh.getRange(rows[1]);

  var v1 = rng1.getValues()[0];
  var v2 = rng2.getValues()[0];

  if (!src) {
    if (!coreHasAny_(v1)) forceChecksFalse_(v1);
    if (!coreHasAny_(v2)) forceChecksFalse_(v2);
    rng1.setValues([v1]);
    rng2.setValues([v2]);
    return;
  }

  var ended1 = isEnded_(src.end1, treatDate);
  var ended2 = isEnded_(src.end2, treatDate);

  var hasSrc1 = !!(String(src.p1||"").trim() || String(src.d1||"").trim() || (src.inj1 instanceof Date));
  var hasSrc2 = !!(String(src.p2||"").trim() || String(src.d2||"").trim() || (src.inj2 instanceof Date));

  // 終了日の補完
  if (hasSrc1 && (v1[6] === "" || v1[6] == null)) {
    if (src.end1 !== "" && src.end1 != null) v1[6] = src.end1;
  }
  if (hasSrc2 && (v2[6] === "" || v2[6] == null)) {
    if (src.end2 !== "" && src.end2 != null) v2[6] = src.end2;
  }
  // 転帰の補完
  if (hasSrc1 && (v1[7] === "" || v1[7] == null)) {
    if (src.tenki1) v1[7] = src.tenki1;
  }
  if (hasSrc2 && (v2[7] === "" || v2[7] == null)) {
    if (src.tenki2) v2[7] = src.tenki2;
  }

  // 終了済み部位: コア補完は行わないが、表示用にデータをセット
  if (ended1 && hasSrc1) {
    v1[0] = src.p1 || "";
    v1[1] = src.d1 || "";
    v1[2] = src.inj1 || "";
  }
  if (!ended1) {
    if (!coreHasAny_(v1)) {
      v1[0] = src.p1 || "";
      v1[1] = src.d1 || "";
      v1[2] = src.inj1 || "";
    }
  }

  if (ended2 && hasSrc2) {
    v2[0] = src.p2 || "";
    v2[1] = src.d2 || "";
    v2[2] = src.inj2 || "";
  }
  if (!ended2) {
    if (!coreHasAny_(v2)) {
      v2[0] = src.p2 || "";
      v2[1] = src.d2 || "";
      v2[2] = src.inj2 || "";
    }
  }

  var row1HasCore = coreHasAny_(v1);
  var row2HasCore = coreHasAny_(v2);

  if (!row1HasCore) forceChecksFalse_(v1);
  if (!row2HasCore) forceChecksFalse_(v2);

  // 終了済み部位はチェックボックスをfalseに強制
  if (ended1 && hasSrc1) forceChecksFalse_(v1);
  if (ended2 && hasSrc2) forceChecksFalse_(v2);

  if (opt.forceWarmElec) {
    if (row1HasCore && !(ended1 && hasSrc1)) forceWarmElecTrue_(v1);
    if (row2HasCore && !(ended2 && hasSrc2)) forceWarmElecTrue_(v2);
  }

  rng1.setValues([v1]);
  rng2.setValues([v2]);

  // ★終了済み部位の視覚保護（取消線 + 入力ロック）
  applyEndedProtection_(uiSh, rows[0], ended1 && hasSrc1);
  applyEndedProtection_(uiSh, rows[1], ended2 && hasSrc2);
}

/* =======================================================================
   reloadVisitToUI_V3 ― 過去日の来院内容を患者画面へ再読み込み
   =======================================================================
   設計方針:
   - 患者ID + 来院日 で来院ケースを検索し、その日の入力内容をそのまま UI に復元する
   - 自動引継ぎ（autofillFromPreviousVisit_V3）とは異なり「前回値の補完」ではなく
     「その日の実記録をそのまま表示」する
   - 金額・初検/再検ロジックは再計算しない（閲覧・転帰更新用途のみ）
   ======================================================================= */

/**
 * 来院ケースシートから visitKey + caseNo で kubun（区分）を読む。
 * findCaseRowByPatientDateCaseNo_ は kubun を返さないため個別に取得する。
 */
function readCaseKubun_(caseSh, caseMap, visitKey, caseNo) {
  var rowIndex = findCaseRowByVisitKeyAndCaseNo_(caseSh, caseMap, visitKey, caseNo);
  if (!rowIndex) return "";
  var kubunCol = caseMap[CASE_COLS.kubun];
  if (!kubunCol) return "";
  return String(caseSh.getRange(rowIndex, kubunCol).getValue() || "");
}

/**
 * 来院ケースデータをそのまま UI の2行にセットする（自動引継ぎとは別ロジック）。
 * 既存 UI の値は上書きする。金額・初検/再検ロジックは触らない。
 * [A=部位, B=傷病, C=受傷日, D=冷, E=温, F=電, G=終了日, H=転帰]
 */
function writeExactCaseSrcToUI_(uiSh, src, caseNo, treatDate) {
  var rows = (caseNo === 1) ? UI.case1_rows : UI.case2_rows;
  var rng1 = uiSh.getRange(rows[0]);
  var rng2 = uiSh.getRange(rows[1]);

  if (!src) {
    rng1.setValues([["", "", "", false, false, false, "", ""]]);
    rng2.setValues([["", "", "", false, false, false, "", ""]]);
    applyEndedProtection_(uiSh, rows[0], false);
    applyEndedProtection_(uiSh, rows[1], false);
    return;
  }

  var hasSrc1 = !!(src.p1 || src.d1 || (src.inj1 instanceof Date));
  var hasSrc2 = !!(src.p2 || src.d2 || (src.inj2 instanceof Date));
  var ended1  = isEnded_(src.end1, treatDate);
  var ended2  = isEnded_(src.end2, treatDate);

  // 部位1: A〜H
  var row1 = [
    src.p1   || "",
    src.d1   || "",
    src.inj1 || "",
    hasSrc1 ? src.cold1 : false,
    hasSrc1 ? src.warm1 : false,
    hasSrc1 ? src.elec1 : false,
    src.end1   || "",
    src.tenki1 || ""
  ];
  // 部位2: A〜H
  var row2 = [
    src.p2   || "",
    src.d2   || "",
    src.inj2 || "",
    hasSrc2 ? src.cold2 : false,
    hasSrc2 ? src.warm2 : false,
    hasSrc2 ? src.elec2 : false,
    src.end2   || "",
    src.tenki2 || ""
  ];

  rng1.setValues([row1]);
  rng2.setValues([row2]);

  // 終了済み部位の視覚保護（取消線 + 入力ロック）
  applyEndedProtection_(uiSh, rows[0], ended1 && hasSrc1);
  applyEndedProtection_(uiSh, rows[1], ended2 && hasSrc2);
}

/**
 * 患者画面の患者ID・来院日に一致する来院ケースを検索し、
 * その日の入力内容を患者画面に復元する。
 * メニュー: 柔整管理 > 当日内容を再読み込み
 */
function reloadVisitToUI_V3() {
  var ss   = SpreadsheetApp.getActive();
  var uiSh = ss.getSheetByName(SHEETS.ui);
  var caseSh = ss.getSheetByName(SHEETS.cases);
  var ui   = SpreadsheetApp.getUi();

  if (!uiSh || !caseSh) {
    ui.alert("必要なシートが見つかりません（患者画面 / 来院ケース）。");
    return;
  }

  var patientId = String(uiSh.getRange(UI.patientId).getValue() || "").trim();
  var treatDate = uiSh.getRange(UI.treatDate).getValue();

  if (!patientId) {
    ui.alert("患者を選択してください（B2で検索→選択）。");
    return;
  }
  if (!(treatDate instanceof Date)) {
    ui.alert("来院日（B4）が日付になっていません。");
    return;
  }

  // 未保存の入力チェック（部位などが入力済みの場合は確認を取る）
  if (hasCaseDataInUI_(uiSh, 1) || hasCaseDataInUI_(uiSh, 2)) {
    var ans = ui.alert(
      "現在の入力を破棄して再読み込みしますか？\n（未保存の入力は失われます）",
      ui.ButtonSet.OK_CANCEL
    );
    if (ans !== ui.Button.OK) return;
  }

  var caseMap = buildHeaderColMap_(caseSh);
  var src1 = findCaseRowByPatientDateCaseNo_(caseSh, caseMap, patientId, treatDate, 1);
  var src2 = findCaseRowByPatientDateCaseNo_(caseSh, caseMap, patientId, treatDate, 2);

  if (!src1 && !src2) {
    ui.alert(
      "来院記録が見つかりませんでした。\n\n" +
      "患者ID: " + patientId + "\n" +
      "来院日: " + fmt_(treatDate, "yyyy/MM/dd") + "\n\n" +
      "患者IDと来院日を確認してください。"
    );
    return;
  }

  // ケース1 / ケース2 を UI に書き込む
  writeExactCaseSrcToUI_(uiSh, src1, 1, treatDate);
  writeExactCaseSrcToUI_(uiSh, src2, 2, treatDate);

  // 区分表示（来院ケースシートから直接取得）
  var visitKey = buildVisitKey_(patientId, treatDate);
  uiSh.getRange(UI.case1_kubunView).setValue(readCaseKubun_(caseSh, caseMap, visitKey, 1));
  uiSh.getRange(UI.case2_kubunView).setValue(readCaseKubun_(caseSh, caseMap, visitKey, 2));

  // 所見を書き込む（値があるときのみ）
  if (src1 && String(src1.shoken || "").trim()) {
    setMergedValue_(uiSh, UI.case1_shoken, src1.shoken);
  }
  if (src2 && String(src2.shoken || "").trim()) {
    setMergedValue_(uiSh, UI.case2_shoken, src2.shoken);
  }

  var dateStr = fmt_(treatDate, "yyyy/MM/dd");
  Logger.log("[reloadVisitToUI_V3] patientId=" + patientId + " treatDate=" + dateStr +
    " src1=" + (src1 ? "found" : "none") + " src2=" + (src2 ? "found" : "none"));
  ss.toast(
    patientId + " / " + dateStr + " の内容を復元しました",
    "再読み込み完了", 4
  );
}

/* =======================================================================
   updateOutcomeFromUI_V3 ― 転帰・終了日を来院ケースへ後付け更新
   =======================================================================
   設計方針:
   - UI 上の転帰（H列）と終了日（G列）だけを来院ケースに書き込む
   - 更新対象: ケース1の end1/tenki1/end2/tenki2、ケース2の end1/tenki1/end2/tenki2
   - 更新しない: 部位・傷病・受傷日・治療法フラグ・金額・初検/再検区分
   - 終了日⇔転帰の整合チェック後に確認ダイアログを表示してから書き込む
   ======================================================================= */

/**
 * UI の転帰・終了日を来院ケースに後付けで書き込む。
 * メニュー: 柔整管理 > 転帰を更新
 */
function updateOutcomeFromUI_V3() {
  var ss     = SpreadsheetApp.getActive();
  var uiSh   = ss.getSheetByName(SHEETS.ui);
  var caseSh = ss.getSheetByName(SHEETS.cases);
  var ui     = SpreadsheetApp.getUi();

  if (!uiSh || !caseSh) {
    ui.alert("必要なシートが見つかりません（患者画面 / 来院ケース）。");
    return;
  }

  var patientId = String(uiSh.getRange(UI.patientId).getValue() || "").trim();
  var treatDate = uiSh.getRange(UI.treatDate).getValue();

  if (!patientId) {
    ui.alert("患者を選択してください（B2で検索→選択）。");
    return;
  }
  if (!(treatDate instanceof Date)) {
    ui.alert("来院日（B4）が日付になっていません。");
    return;
  }

  // UIから転帰・終了日を読み取る
  // ケース1: case1_rows[0]=部位1 / case1_rows[1]=部位2
  // ケース2: case2_rows[0]=部位1 / case2_rows[1]=部位2
  var lc1p1 = readRowNewUI_(uiSh, UI.case1_rows[0]);  // ケース1 部位1
  var lc1p2 = readRowNewUI_(uiSh, UI.case1_rows[1]);  // ケース1 部位2
  var lc2p1 = readRowNewUI_(uiSh, UI.case2_rows[0]);  // ケース2 部位1
  var lc2p2 = readRowNewUI_(uiSh, UI.case2_rows[1]);  // ケース2 部位2

  // 終了日⇔転帰の整合チェック（BLOCKING）
  var checks = [
    { label: "ケース1 部位1", line: lc1p1 },
    { label: "ケース1 部位2", line: lc1p2 },
    { label: "ケース2 部位1", line: lc2p1 },
    { label: "ケース2 部位2", line: lc2p2 }
  ];
  var errors = [];
  for (var i = 0; i < checks.length; i++) {
    var c = checks[i];
    var hasEnd   = (c.line.endVal !== "" && c.line.endVal != null);
    var hasTenki = !!c.line.tenki;
    if (hasEnd   && !hasTenki) errors.push(c.label + ": 終了日がありますが転帰が未選択です");
    if (!hasEnd  && hasTenki)  errors.push(c.label + ": 転帰がありますが終了日が未入力です");
  }
  if (errors.length > 0) {
    ui.alert("終了日と転帰の整合性エラー:\n\n" + errors.join("\n"));
    return;
  }

  var visitKey = buildVisitKey_(patientId, treatDate);
  var caseMap  = buildHeaderColMap_(caseSh);
  var row1 = findCaseRowByVisitKeyAndCaseNo_(caseSh, caseMap, visitKey, 1);
  var row2 = findCaseRowByVisitKeyAndCaseNo_(caseSh, caseMap, visitKey, 2);

  if (!row1 && !row2) {
    ui.alert(
      "来院記録が見つかりませんでした。\n\n" +
      "患者ID: " + patientId + "\n" +
      "来院日: " + fmt_(treatDate, "yyyy/MM/dd") + "\n\n" +
      "先に「当日内容を再読み込み」で確認してから更新してください。"
    );
    return;
  }

  // 更新内容のサマリーを作成（確認ダイアログ用）
  function fmtEndVal_(v) {
    if (!v || v === "") return "（空欄）";
    return (v instanceof Date) ? fmt_(v, "yyyy/MM/dd") : String(v);
  }
  var summary = [];
  if (row1) {
    if (lc1p1.tenki || (lc1p1.endVal !== "" && lc1p1.endVal != null)) {
      summary.push("ケース1 部位1: 転帰=" + (lc1p1.tenki || "（なし）") + " / 終了日=" + fmtEndVal_(lc1p1.endVal));
    }
    if (lc1p2.tenki || (lc1p2.endVal !== "" && lc1p2.endVal != null)) {
      summary.push("ケース1 部位2: 転帰=" + (lc1p2.tenki || "（なし）") + " / 終了日=" + fmtEndVal_(lc1p2.endVal));
    }
  }
  if (row2) {
    if (lc2p1.tenki || (lc2p1.endVal !== "" && lc2p1.endVal != null)) {
      summary.push("ケース2 部位1: 転帰=" + (lc2p1.tenki || "（なし）") + " / 終了日=" + fmtEndVal_(lc2p1.endVal));
    }
    if (lc2p2.tenki || (lc2p2.endVal !== "" && lc2p2.endVal != null)) {
      summary.push("ケース2 部位2: 転帰=" + (lc2p2.tenki || "（なし）") + " / 終了日=" + fmtEndVal_(lc2p2.endVal));
    }
  }

  if (summary.length === 0) {
    ui.alert(
      "更新する転帰・終了日が入力されていません。\n" +
      "ケース行の H列（転帰）と G列（終了日）を入力してから実行してください。"
    );
    return;
  }

  var confirmed = ui.alert(
    "以下の転帰・終了日を来院ケースに書き込みます。\n\n" +
    summary.join("\n") + "\n\n" +
    "患者: " + patientId + " / " + fmt_(treatDate, "yyyy/MM/dd") + "\n\n" +
    "よろしいですか？\n（部位・治療法・金額は変更しません）",
    ui.ButtonSet.OK_CANCEL
  );
  if (confirmed !== ui.Button.OK) return;

  // ケース1 行を更新（end1/tenki1/end2/tenki2 のみ）
  if (row1) {
    var lastCol1 = caseSh.getLastColumn();
    var arr1 = caseSh.getRange(row1, 1, 1, lastCol1).getValues()[0];
    if (lc1p1.endVal !== "" && lc1p1.endVal != null) setByName_(arr1, caseMap, CASE_COLS.end1,   lc1p1.endVal);
    if (lc1p1.tenki)                                 setByName_(arr1, caseMap, CASE_COLS.tenki1, lc1p1.tenki);
    if (lc1p2.endVal !== "" && lc1p2.endVal != null) setByName_(arr1, caseMap, CASE_COLS.end2,   lc1p2.endVal);
    if (lc1p2.tenki)                                 setByName_(arr1, caseMap, CASE_COLS.tenki2, lc1p2.tenki);
    caseSh.getRange(row1, 1, 1, lastCol1).setValues([arr1]);
  }

  // ケース2 行を更新（end1/tenki1/end2/tenki2 のみ）
  if (row2) {
    var lastCol2 = caseSh.getLastColumn();
    var arr2 = caseSh.getRange(row2, 1, 1, lastCol2).getValues()[0];
    if (lc2p1.endVal !== "" && lc2p1.endVal != null) setByName_(arr2, caseMap, CASE_COLS.end1,   lc2p1.endVal);
    if (lc2p1.tenki)                                 setByName_(arr2, caseMap, CASE_COLS.tenki1, lc2p1.tenki);
    if (lc2p2.endVal !== "" && lc2p2.endVal != null) setByName_(arr2, caseMap, CASE_COLS.end2,   lc2p2.endVal);
    if (lc2p2.tenki)                                 setByName_(arr2, caseMap, CASE_COLS.tenki2, lc2p2.tenki);
    caseSh.getRange(row2, 1, 1, lastCol2).setValues([arr2]);
  }

  Logger.log("[updateOutcomeFromUI_V3] patientId=" + patientId +
    " treatDate=" + fmt_(treatDate, "yyyy/MM/dd") +
    " row1=" + row1 + " row2=" + row2);
  ss.toast("転帰・終了日を来院ケースに更新しました", "転帰更新完了", 4);
}

/* =======================================================================
   updateProgressFromUI_V3 ― 経過を来院ケースへ後付け更新
   =======================================================================
   設計方針:
   - UI 上の経過（case1_keikaNow / case2_keikaNow）だけを来院ケースに書き込む
   - 更新対象: CASE_COLS.keikaNow（"経過_今回"）のみ
   - 更新しない: 転帰・終了日・金額・初検/再検区分・治療法フラグ・所見・自費明細
   - 空欄での上書きも許可するが、確認ダイアログで内容を明示する
   ======================================================================= */

/**
 * UI から Case1 / Case2 の経過テキストを収集して返す。
 */
function collectProgressPatchFromUI_(uiSh) {
  return {
    keika1: String(getMergedValue_(uiSh, UI.case1_keikaNow) || ""),
    keika2: String(getMergedValue_(uiSh, UI.case2_keikaNow) || "")
  };
}

/**
 * UI 上の経過（case1_keikaNow / case2_keikaNow）を来院ケースに後付けで書き込む。
 * メニュー: 柔整管理 > 経過を更新
 */
function updateProgressFromUI_V3() {
  var ss     = SpreadsheetApp.getActive();
  var uiSh   = ss.getSheetByName(SHEETS.ui);
  var caseSh = ss.getSheetByName(SHEETS.cases);
  var ui     = SpreadsheetApp.getUi();

  if (!uiSh || !caseSh) {
    ui.alert("必要なシートが見つかりません（患者画面 / 来院ケース）。");
    return;
  }

  var patientId = String(uiSh.getRange(UI.patientId).getValue() || "").trim();
  var treatDate = uiSh.getRange(UI.treatDate).getValue();

  if (!patientId) {
    ui.alert("患者を選択してください（B2で検索→選択）。");
    return;
  }
  if (!(treatDate instanceof Date)) {
    ui.alert("来院日（B4）が日付になっていません。");
    return;
  }

  var visitKey = buildVisitKey_(patientId, treatDate);
  var caseMap  = buildHeaderColMap_(caseSh);
  var row1 = findCaseRowByVisitKeyAndCaseNo_(caseSh, caseMap, visitKey, 1);
  var row2 = findCaseRowByVisitKeyAndCaseNo_(caseSh, caseMap, visitKey, 2);

  if (!row1 && !row2) {
    ui.alert(
      "来院記録が見つかりませんでした。\n\n" +
      "患者ID: " + patientId + "\n" +
      "来院日: " + fmt_(treatDate, "yyyy/MM/dd") + "\n\n" +
      "先に「当日内容を再読み込み」で確認してから更新してください。"
    );
    return;
  }

  var patch = collectProgressPatchFromUI_(uiSh);

  // 確認ダイアログ（空欄も明示）
  var lines = [];
  if (row1) lines.push("ケース1 経過: " + (patch.keika1 || "（空欄）"));
  if (row2) lines.push("ケース2 経過: " + (patch.keika2 || "（空欄）"));

  var confirmed = ui.alert(
    "以下の経過を来院ケースに書き込みます。\n\n" +
    lines.join("\n") + "\n\n" +
    "患者: " + patientId + " / " + fmt_(treatDate, "yyyy/MM/dd") + "\n\n" +
    "よろしいですか？\n（転帰・終了日・金額・治療法は変更しません）",
    ui.ButtonSet.OK_CANCEL
  );
  if (confirmed !== ui.Button.OK) return;

  // ケース1 経過を更新
  if (row1) {
    var lastCol1 = caseSh.getLastColumn();
    var arr1 = caseSh.getRange(row1, 1, 1, lastCol1).getValues()[0];
    setByName_(arr1, caseMap, CASE_COLS.keikaNow, patch.keika1);
    caseSh.getRange(row1, 1, 1, lastCol1).setValues([arr1]);
  }

  // ケース2 経過を更新
  if (row2) {
    var lastCol2 = caseSh.getLastColumn();
    var arr2 = caseSh.getRange(row2, 1, 1, lastCol2).getValues()[0];
    setByName_(arr2, caseMap, CASE_COLS.keikaNow, patch.keika2);
    caseSh.getRange(row2, 1, 1, lastCol2).setValues([arr2]);
  }

  Logger.log("[updateProgressFromUI_V3] patientId=" + patientId +
    " treatDate=" + fmt_(treatDate, "yyyy/MM/dd") +
    " row1=" + row1 + " row2=" + row2 +
    " keika1=" + patch.keika1.slice(0, 30) + " keika2=" + patch.keika2.slice(0, 30));
  ss.toast("経過を来院ケースに更新しました", "経過更新完了", 4);
}

/**
 * ===== 来院ケース → 来院ヘッダへ一括出力（高速） =====
 * ★設計方針: 基本項目（visitKey/日付/区分等）のみコピー。
 *   Mixed区分/case1要約/case2要約の3列はkubun値から生成（費用計算不要）。
 *   算定区分/課金理由の2列は空で出力する（費用計算後に金額計算・保存で上書きされる）。
 *   case2要約の初検抑制表現（"case2:初検(抑制)"）は近似値（"case2:初検"）で出力する。
 */
function exportHeaderFromCases_V3() {
  var ss = SpreadsheetApp.getActive();
  var caseSh = ss.getSheetByName(SHEETS.cases);
  var headSh = ss.getSheetByName(SHEETS.header);
  if (!caseSh || !headSh) throw new Error("必要シートが見つかりません（来院ケース/来院ヘッダ）");

  var caseMap = buildHeaderColMap_(caseSh);
  var headMap = buildHeaderColMap_(headSh);
  headMap = ensureHeaderCols_(headSh, headMap, Object.values(HEADER_COLS));
  var settingsSh = ss.getSheetByName(SHEETS.settings);
  if (settingsSh) setupHeaderChoiceValidation_V3_(settingsSh, headSh, headMap);

  ensureRequiredCols_(caseMap, [CASE_COLS.visitKey, CASE_COLS.treatDate, CASE_COLS.patientId, CASE_COLS.kubun, CASE_COLS.injuryFixed, CASE_COLS.caseKey, CASE_COLS.caseNo], SHEETS.cases);
  ensureRequiredCols_(headMap, Object.values(HEADER_COLS), SHEETS.header);

  var lastRow = caseSh.getLastRow();
  if (lastRow < 2) {
    SpreadsheetApp.getUi().alert("来院ケースにデータがありません。");
    return;
  }

  var n = lastRow - 1;
  var visitKeyVals = caseSh.getRange(2, caseMap[CASE_COLS.visitKey], n, 1).getValues().flat();
  var treatVals    = caseSh.getRange(2, caseMap[CASE_COLS.treatDate], n, 1).getValues().flat();
  var pidVals      = caseSh.getRange(2, caseMap[CASE_COLS.patientId], n, 1).getValues().flat();
  var kubunVals    = caseSh.getRange(2, caseMap[CASE_COLS.kubun], n, 1).getValues().flat();
  var injFixVals   = caseSh.getRange(2, caseMap[CASE_COLS.injuryFixed], n, 1).getValues().flat();
  var caseKeyVals  = caseSh.getRange(2, caseMap[CASE_COLS.caseKey], n, 1).getValues().flat();
  var caseNoVals   = caseSh.getRange(2, caseMap[CASE_COLS.caseNo], n, 1).getValues().flat();

  var existed = buildExistingHeaderKeySet_(headSh, headMap);

  // 事前集計: visitKey → { kubun1, kubun2 }（Mixed区分/case要約生成用）
  var kvMap = {};
  for (var p = 0; p < n; p++) {
    var pvk = String(visitKeyVals[p] || "").trim();
    var pno = Number(caseNoVals[p] || 0);
    var pkubun = String(kubunVals[p] || "").trim();
    if (!pvk || !pno) continue;
    if (!kvMap[pvk]) kvMap[pvk] = { kubun1: "", kubun2: "" };
    if (pno === 1) kvMap[pvk].kubun1 = pkubun;
    if (pno === 2) kvMap[pvk].kubun2 = pkubun;
  }

  var out = [];
  var now = new Date();

  for (var i = 0; i < n; i++) {
    var visitKey = String(visitKeyVals[i] || "").trim();
    var patientId = String(pidVals[i] || "").trim();
    var treatDate = treatVals[i];
    var kubun = String(kubunVals[i] || "").trim();
    var inj = injFixVals[i];
    var caseKey = String(caseKeyVals[i] || "").trim();
    var caseIndex = Number(caseNoVals[i] || 0);

    if (!visitKey || !patientId || !(treatDate instanceof Date) || !caseKey || !caseIndex) continue;

    // 重複チェックは visitKey 単位（来院ヘッダは1来院日1行）
    if (existed.has(visitKey)) continue;

    var rowArr = new Array(headSh.getLastColumn()).fill("");

    setByName_(rowArr, headMap, HEADER_COLS.visitKey, visitKey);
    setByName_(rowArr, headMap, HEADER_COLS.treatDate, treatDate);
    setByName_(rowArr, headMap, HEADER_COLS.patientId, patientId);
    setByName_(rowArr, headMap, HEADER_COLS.kubun, kubun);
    if (inj instanceof Date) setByName_(rowArr, headMap, HEADER_COLS.injuryVisit, inj);

    setByName_(rowArr, headMap, HEADER_COLS.initFee, "");
    setByName_(rowArr, headMap, HEADER_COLS.reFee, "");
    setByName_(rowArr, headMap, HEADER_COLS.supportFee, "");
    setByName_(rowArr, headMap, HEADER_COLS.detailSum, "");
    setByName_(rowArr, headMap, HEADER_COLS.visitTotal, "");
    setByName_(rowArr, headMap, HEADER_COLS.windowPay, "");

    var last = findLastVisitDateInHeader_(headSh, headMap, patientId, treatDate);
    setByName_(rowArr, headMap, HEADER_COLS.lastVisit, (last instanceof Date) ? last : "");
    setByName_(rowArr, headMap, HEADER_COLS.gapDays, (last instanceof Date) ? daysBetween_(last, treatDate) : "");

    setByName_(rowArr, headMap, HEADER_COLS.needCheck, "");
    setByName_(rowArr, headMap, HEADER_COLS.createdAt, now);
    setByName_(rowArr, headMap, HEADER_COLS.caseKey, caseKey);
    setByName_(rowArr, headMap, HEADER_COLS.caseIndex, caseIndex);
    setByName_(rowArr, headMap, HEADER_COLS.accountingType, "");
    // selfPayMenuType / selfPayAmount は 2026-03-23 撤去
    setByName_(rowArr, headMap, HEADER_COLS.chronicCandidateFlag, "");
    setByName_(rowArr, headMap, HEADER_COLS.nextReservation, "");
    setByName_(rowArr, headMap, HEADER_COLS.firstVisitType, "");

    // Mixed区分/case要約: kubun値から生成（費用計算不要の3列）
    // billedKubun / chargeReason は "" のまま（金額計算・保存で上書きされる）
    var kv = kvMap[visitKey] || { kubun1: "", kubun2: "" };
    var k1 = kv.kubun1, k2 = kv.kubun2;
    var mixedFlag    = k2 ? "Mixed" : "通常";
    var case1Summary = k1 === "初検" ? "case1:初検"
                     : k1 === "再検" ? "case1:再検"
                     : k1 === "後療" ? "case1:後療"
                     : "case1:なし";
    var case2Summary = !k2         ? "case2:なし"
                     : k2 === "初検" ? "case2:初検"   // 抑制有無は近似（金額計算後に正確値で上書き）
                     : k2 === "再検" ? "case2:再検"
                     : k2 === "後療" ? "case2:後療"
                     : "case2:" + k2;
    setByName_(rowArr, headMap, HEADER_COLS.mixedFlag,    mixedFlag);
    setByName_(rowArr, headMap, HEADER_COLS.case1Summary, case1Summary);
    setByName_(rowArr, headMap, HEADER_COLS.case2Summary, case2Summary);

    out.push(rowArr);
    existed.add(visitKey);
  }

  if (!out.length) {
    SpreadsheetApp.getUi().alert("出力対象がありません（すでに出力済み or データ不足）");
    return;
  }

  headSh.getRange(headSh.getLastRow() + 1, 1, out.length, headSh.getLastColumn()).setValues(out);
  SpreadsheetApp.getUi().alert("来院ヘッダへ出力しました：" + out.length + " 行");
}

function buildExistingHeaderKeySet_(headSh, headMap) {
  var set = new Set();
  var lastRow = headSh.getLastRow();
  if (lastRow < 2) return set;

  var cVisitKey = headMap[HEADER_COLS.visitKey];
  if (!cVisitKey) return set;

  var keys = headSh.getRange(2, cVisitKey, lastRow - 1, 1).getValues().flat();

  for (var i = 0; i < keys.length; i++) {
    var k = String(keys[i] || "").trim();
    if (k) set.add(k);
  }
  return set;
}

function findLastVisitDateInHeader_(headSh, headMap, patientId, treatDate) {
  var lastRow = headSh.getLastRow();
  if (lastRow < 2) return null;

  var cPid = headMap[HEADER_COLS.patientId];
  var cDt  = headMap[HEADER_COLS.treatDate];
  if (!cPid || !cDt) return null;

  var pidVals = headSh.getRange(2, cPid, lastRow - 1, 1).getValues().flat();
  var dtVals  = headSh.getRange(2, cDt,  lastRow - 1, 1).getValues().flat();

  var best = null;
  for (var i = 0; i < pidVals.length; i++) {
    if (String(pidVals[i] || "").trim() !== patientId) continue;
    var d = dtVals[i];
    if (!(d instanceof Date)) continue;
    if (d.getTime() >= treatDate.getTime()) continue;
    if (!best || d.getTime() > best.getTime()) best = d;
  }
  return best;
}

/** ===== クリア（入力だけ） ===== */
function clearEntryUI_V3() {
  var ss = SpreadsheetApp.getActive();
  var uiSh = ss.getSheetByName(SHEETS.ui);

  uiSh.getRange(UI.patientDisplay).clearContent();  // B2（プルダウン）クリア → C2,B3は数式で自動クリア
  uiSh.getRange(UI.gymMember).setValue(false);       // B5: ジム会員チェックボックス → FALSE（Phase A）
  uiSh.getRange("B6:B7").clearContent();             // B6: (空), B7: 会計区分 dropdown クリア
  // E列の会計値をクリア（D列のラベルは残す）
  uiSh.getRange("E2:E6").clearContent();

  uiSh.getRange("A12:H13").clearContent();
  uiSh.getRange(UI.case1_shoken).clearContent();
  uiSh.getRange(UI.case1_keikaNow).clearContent();
  uiSh.getRange(UI.case1_keikaHistory).clearContent();
  clearInitInfoUI_V3_(uiSh, 1);

  uiSh.getRange("A36:H37").clearContent();
  uiSh.getRange(UI.case2_shoken).clearContent();
  uiSh.getRange(UI.case2_keikaNow).clearContent();
  uiSh.getRange(UI.case2_keikaHistory).clearContent();
  clearInitInfoUI_V3_(uiSh, 2);

  // 取消線・色の解除 + チェックボックス再設定
  var inputRows = ["A12:H12", "A13:H13", "A36:H36", "A37:H37"];
  for (var i = 0; i < inputRows.length; i++) {
    applyEndedProtection_(uiSh, inputRows[i], false);
  }

  uiSh.getRange("D12:F13").setValues([
    [false, false, false],
    [false, false, false]
  ]);
  uiSh.getRange("D36:F37").setValues([
    [false, false, false],
    [false, false, false]
  ]);

  // 転帰ドロップダウン再設定
  setupTenkiValidation_(uiSh);

  uiSh.getRange(UI.case1_visitCount).clearContent();
  uiSh.getRange(UI.case2_visitCount).clearContent();

  uiSh.getRange(UI.case1_kubunView).clearContent();
  uiSh.getRange(UI.case2_kubunView).clearContent();

  clearAmountsUI_V3_(uiSh);

  // Phase 0: 自費・経営情報ブロックをクリア
  clearSelfPayUI_V3_(uiSh);

  // JREC-01 Case A: 保存後会計サマリー — 値のみクリア（枠・ラベル・固定文言は残す）
  clearSummaryValuesUI_V3_(uiSh);

  SpreadsheetApp.getUi().alert("自動入力エリアをクリアしました（B4は保持・書式は保持）。");
}

/** ===== UI会計ブロック書き込み ===== */
function writeAmountsToUI_V3_(uiSh, amounts) {
  uiSh.getRange(UI.billing_visitTotal).setValue(amounts.visitTotal);
  uiSh.getRange(UI.billing_windowPay).setValue(amounts.windowPay);
  uiSh.getRange(UI.billing_claimPay).setValue(amounts.claimPay);
  uiSh.getRange(UI.billing_needCheck).setValue(amounts.needCheck ? true : false);

  // 要確認理由: 内部";"区切り → UI表示時"\n"に変換、wrap有効
  var reasonDisplay = (amounts.needCheckReason || "").replace(/;/g, "\n");
  var reasonCell = uiSh.getRange(UI.billing_needCheckReason);
  reasonCell.setValue(reasonDisplay);
  reasonCell.setWrap(true);
}

/** ===== UI会計ブロッククリア ===== */
function clearAmountsUI_V3_(uiSh) {
  uiSh.getRange(UI.billing_visitTotal).clearContent();
  uiSh.getRange(UI.billing_windowPay).clearContent();
  uiSh.getRange(UI.billing_claimPay).clearContent();
  uiSh.getRange(UI.billing_needCheck).clearContent();
  uiSh.getRange(UI.billing_needCheckReason).clearContent();
}

/* =======================================================================
   Phase 0: 自費・経営情報 UI 関数
   ======================================================================= */

/** ===== 患者画面から自費・経営情報を読み込む（Phase 0） ===== */
function readSelfPayFromUI_V3_(uiSh) {
  // selfPay_menuType(D7) / selfPay_amount(F7) / selfPay_menuCode(H8) は
  // 自費明細ダイアログの表示専用。来院ヘッダへの書き込みは 2026-03-23 撤去。
  var accType   = String(uiSh.getRange(UI.selfPay_accountingType).getValue() || "").trim();
  var chronic   = uiSh.getRange(UI.selfPay_chronicFlag).getValue() === true;
  var nextResv  = uiSh.getRange(UI.selfPay_nextReserv).getValue() === true;
  var fvType    = String(uiSh.getRange(UI.selfPay_firstVisitType).getValue() || "").trim();
  // Phase A (2026-03-31): ジム会員フラグ — B5 チェックボックスから読み取り
  // Phase B でこの値を getSelfPayMenuMaster_V3 へ渡し、一般/会員料金を切り替える予定
  var gymMember = uiSh.getRange(UI.gymMember).getValue() === true;

  return {
    accountingType:       accType,
    chronicCandidateFlag: chronic,
    nextReservation:      nextResv,
    firstVisitType:       fvType,
    gymMemberFlag:        gymMember,  // Phase A: boolean。来院ヘッダの「ジム会員フラグ」列に保存
  };
}

/** ===== 患者画面の自費・経営情報ブロックをクリア（Phase 0/2） ===== */
function clearSelfPayUI_V3_(uiSh) {
  uiSh.getRange(UI.selfPay_accountingType).clearContent();
  uiSh.getRange(UI.selfPay_menuType).clearContent();      // D7: 表示専用（Phase 2）
  uiSh.getRange(UI.selfPay_amount).clearContent();        // F7: 表示専用（Phase 2）
  uiSh.getRange(UI.selfPay_chronicFlag).setValue(false);  // チェックボックス → FALSE
  uiSh.getRange(UI.selfPay_nextReserv).setValue(false);   // チェックボックス → FALSE
  uiSh.getRange(UI.selfPay_firstVisitType).clearContent();
  uiSh.getRange(UI.selfPay_menuCode).setValue("未入力");  // H8: 状態表示をリセット（Phase 2）
}

/** ===== 自費入力欄 会計ブロック自動生成（メニューから呼ぶ公開版） ===== */
function setupSelfPayValidation_V3() {
  var ss = SpreadsheetApp.getActive();
  var uiSh = ss.getSheetByName(SHEETS.ui);
  if (!uiSh) throw new Error("患者画面シートが見つかりません");
  setupSelfPayValidation_V3_(uiSh);
  SpreadsheetApp.getUi().alert(
    "UI初期設定が完了しました。\n\n" +
    "【Row 5】ジム会員フラグ（Phase A）\n" +
    "  A5: ラベル「ジム会員」/ B5: チェックボックス\n" +
    "  ※当日の来院でジム会員なら B5 にチェック。来院ヘッダに「ジム会員フラグ」として記録。\n\n" +
    "【Row 7】会計区分(B7) / 自費メニュー[表示専用](D7) / 自費金額[表示専用](F7) / 会計合計(H7)\n" +
    "【Row 8】慢性候補(B8) / 次回予約(D8) / 新規区分(F8) / 明細状態[状態表示](H8)\n\n" +
    "D7/F7 は手入力不可。自費明細ダイアログから保存すると自動表示されます。\n" +
    "H8 は状態表示セル。Drawingボタンをシートに設置して openSelfPayDialog_V3 を割り当ててください。"
  );
}

/**
 * ===== 患者画面 行7〜8 に会計・経営情報ブロックを自動生成（内部用） =====
 * ラベル書き込み・背景色・プルダウン・チェックボックス・会計合計数式をすべて設定する。
 * 手動設置は不要。このメニューを1回実行すれば完了。
 * H7 の数式: =IF(F7="",E3,E3+F7) — E3=窓口負担額（E2=来院合計なので注意）
 */
function setupSelfPayValidation_V3_(uiSh) {
  var LABEL_BG   = "#e8e8e8";  // ラベルセル: ライトグレー
  var INPUT_BG   = "#ffffff";  // 入力セル: 白
  var FORMULA_BG = "#fff9c4";  // 会計合計(H7): 薄黄（表示専用・手入力不可）

  // ── Row 5: ジム会員チェックボックス（Phase A / 2026-03-31）────────────
  // Phase B で getSelfPayMenuMaster_V3 へ gymMemberFlag を渡し G列(一般)/H列(会員) を切替予定
  // Phase C で患者マスタの既定値から自動設定 + 当日UI上書き方式に拡張予定
  uiSh.getRange("A5").setValue("ジム会員").setBackground(LABEL_BG).setFontWeight("bold");
  uiSh.getRange("B5").setBackground(INPUT_BG).insertCheckboxes();
  uiSh.getRange("A5:B5").setBorder(
    true, true, true, true, null, null,
    "#888888", SpreadsheetApp.BorderStyle.SOLID
  );
  // A6:B6 を白でクリア（旧「区分」表示の残骸除去・視覚的に行7会計ブロックと分離）
  uiSh.getRange("A6:B6").clearContent().clearDataValidations().setBackground("#ffffff");

  // ── Row 7 ラベル書き込み ──────────────────────────────
  uiSh.getRange("A7").setValue("会計区分").setBackground(LABEL_BG).setFontWeight("bold");
  uiSh.getRange("C7").setValue("自費メニュー").setBackground(LABEL_BG).setFontWeight("bold");
  uiSh.getRange("E7").setValue("自費金額（円）").setBackground(LABEL_BG).setFontWeight("bold");
  uiSh.getRange("G7").setValue("会計合計").setBackground(LABEL_BG).setFontWeight("bold");

  // ── Row 8 ラベル書き込み ──────────────────────────────
  uiSh.getRange("A8").setValue("慢性候補").setBackground(LABEL_BG).setFontWeight("bold");
  uiSh.getRange("C8").setValue("次回予約").setBackground(LABEL_BG).setFontWeight("bold");
  uiSh.getRange("E8").setValue("新規区分").setBackground(LABEL_BG).setFontWeight("bold");
  uiSh.getRange("G8").setValue("明細入力").setBackground(LABEL_BG).setFontWeight("bold");  // Phase 2: H8 = 状態表示セル

  // ── 入力セル背景色 ────────────────────────────────────
  uiSh.getRange("B7").setBackground(INPUT_BG);
  uiSh.getRange("D7").setBackground("#fff9c4");  // Phase 2: 表示専用（薄黄）
  uiSh.getRange("F7").setBackground("#fff9c4");  // Phase 2: 表示専用（薄黄）
  uiSh.getRange("B8").setBackground(INPUT_BG);
  uiSh.getRange("D8").setBackground(INPUT_BG);
  uiSh.getRange("F8").setBackground(INPUT_BG);
  uiSh.getRange("H8").setBackground("#e8f4f8").setValue("未入力");  // Phase 2: 状態表示セル（薄青）

  // ── H7: 会計合計 数式（E3=窓口負担額 ※E2=来院合計なので注意）────
  uiSh.getRange("H7").setFormula("=IF(F7=\"\",E3,E3+F7)").setBackground(FORMULA_BG);

  // ── 旧セル残骸クリア（B9/D9/F9: 旧チェックボックス設定の残り）──────
  uiSh.getRange("B9").clearContent().clearDataValidations();
  uiSh.getRange("D9").clearContent().clearDataValidations();
  uiSh.getRange("F9").clearContent().clearDataValidations();

  // ── 旧会計ブロック残骸クリア（A55:H62: Phase0初回設置時の残り）──────
  uiSh.getRange("A55:H62").clearContent().clearDataValidations();

  // ── 旧サマリーv1残骸クリア（J55:Q62: v1実装時に書いた結合・文言の完全除去）──
  uiSh.getRange("J55:Q62").breakApart().clearContent().clearFormat();

  // ── J2:N22: 会計サマリーエリア初期化（空レイアウトを書いて旧文言を残さない）──
  clearSummaryValuesUI_V3_(uiSh);

  // ── ブロック外枠（A7:H8）─────────────────────────────
  uiSh.getRange("A7:H8").setBorder(
    true, true, true, true, null, null,
    "#888888", SpreadsheetApp.BorderStyle.SOLID
  );

  // ── B7: 会計区分 プルダウン ───────────────────────────
  var acctRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["保険のみ", "保険+自費", "自費のみ"], true)
    .setAllowInvalid(true)
    .build();
  uiSh.getRange(UI.selfPay_accountingType).setDataValidation(acctRule);

  // ── D7: 表示専用（Phase 2: 入力規則削除 → 薄黄背景）─────────────────
  // Phase 1 まではプルダウン入力欄だったが、Phase 2 でダイアログ経由の表示専用セルに変更
  uiSh.getRange(UI.selfPay_menuType).clearDataValidations().setBackground("#fff9c4");

  // ── B8・D8: チェックボックス（boolean 保存）──────────
  uiSh.getRange(UI.selfPay_chronicFlag).insertCheckboxes();
  uiSh.getRange(UI.selfPay_nextReserv).insertCheckboxes();

  // ── F8: 新規区分 プルダウン（空欄可）────────────────
  var fvRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["保険新規", "自費直新規", "再来"], true)
    .setAllowInvalid(true)
    .build();
  uiSh.getRange(UI.selfPay_firstVisitType).setDataValidation(fvRule);
}

/** ===== 保存後クリア ===== */
function clearAfterSaveUI_V3_(uiSh) {
  uiSh.getRange(UI.patientDisplay).clearContent();  // B2クリア → C2,B3は数式で自動クリア
  uiSh.getRange(UI.gymMember).setValue(false);      // B5: ジム会員チェックボックス → FALSE（Phase A）

  UI.case1_rows.forEach(function(r) { uiSh.getRange(r).clearContent(); });
  UI.case2_rows.forEach(function(r) { uiSh.getRange(r).clearContent(); });

  // 取消線・色の解除 + チェックボックス再設定
  var inputRows = UI.case1_rows.concat(UI.case2_rows);
  for (var i = 0; i < inputRows.length; i++) {
    applyEndedProtection_(uiSh, inputRows[i], false);
  }

  uiSh.getRange("D12:F13").setValues([[false,false,false],[false,false,false]]);
  uiSh.getRange("D36:F37").setValues([[false,false,false],[false,false,false]]);

  // 転帰ドロップダウン再設定
  setupTenkiValidation_(uiSh);

  setMergedValue_(uiSh, UI.case1_shoken, "");
  setMergedValue_(uiSh, UI.case1_keikaNow, "");
  setMergedValue_(uiSh, UI.case2_shoken, "");
  setMergedValue_(uiSh, UI.case2_keikaNow, "");

  setMergedValue_(uiSh, UI.case1_keikaHistory, "");
  setMergedValue_(uiSh, UI.case2_keikaHistory, "");

  clearInitInfoUI_V3_(uiSh, 1);
  clearInitInfoUI_V3_(uiSh, 2);

  uiSh.getRange(UI.case1_kubunView).setValue("");
  uiSh.getRange(UI.case2_kubunView).setValue("");

  // Phase 0: 自費・経営情報ブロックをクリア（次の患者入力に備える）
  clearSelfPayUI_V3_(uiSh);

  // 会計ブロックは保存直後の確認用に残す（clearEntryUI_V3で初めてクリア）
}

/**
 * 設定シートから施術所情報を取得する（A列=ラベル / B列=値 の形式で全行検索）。
 * @returns {Object} {name, addr, tel}
 */
function getClinicInfoFromSettings_V3_() {
  var result = { name: "", addr: "", tel: "" };
  var sh = SpreadsheetApp.getActive().getSheetByName(SHEETS.settings);
  if (!sh || sh.getLastRow() < 1) return result;
  var rows = sh.getRange(1, 1, sh.getLastRow(), 2).getValues();
  rows.forEach(function(r) {
    var lbl = String(r[0] || "").trim();
    var val = String(r[1] || "").trim();
    if (lbl === "施術所名") result.name = val;
    if (lbl === "住所")     result.addr = val;
    if (lbl === "電話")     result.tel  = val;
  });
  return result;
}

/**
 * 保存後会計サマリーの「値セル」のみをクリアする。
 * 枠・ラベル・固定文言（領収証定型テキスト・クリニック情報）は残す。
 * clearEntryUI_V3 から呼ぶ。
 */
function clearSummaryValuesUI_V3_(uiSh) {
  // 空オブジェクトで writeSavedSummaryUI_V3_ を呼ぶことで
  // ① breakApart().clearContent() による正規化
  // ② レイアウト・ラベル・枠を維持したまま値セルを空欄表示（v_() が 0 → "" を返す）
  // を同時に保証する。セルに旧文言を残さない。
  writeSavedSummaryUI_V3_(uiSh, {});
}

/**
 * 保存後会計サマリーを患者画面 J2:N22 に書き込む（領収証参照元・縦並びレイアウト）。
 * 毎回の保存で前回値を上書きする。clearEntryUI_V3（→clearSummaryValuesUI_V3_）で値のみ消える。
 *
 * @param {Sheet}  uiSh  患者画面シート
 * @param {Object} obj   {patientName, treatDate, accountingType,
 *                        visitTotal, windowPay, selfPayTotal, visitKey}
 */
function writeSavedSummaryUI_V3_(uiSh, obj) {
  // ── 値を準備 ──────────────────────────────────────────
  var name    = obj.patientName || "";
  var dateFmt = (obj.treatDate instanceof Date)
    ? Utilities.formatDate(obj.treatDate, Session.getScriptTimeZone(), "yyyy/MM/dd")
    : String(obj.treatDate || "");
  var acctType  = obj.accountingType || "";
  var insTotal  = Number(obj.visitTotal  || 0);
  var windowPay = Number(obj.windowPay   || 0);
  var spTotal   = Number(obj.selfPayTotal || 0);
  var total     = windowPay + spTotal;
  var visitKey  = obj.visitKey || "";

  // 数値ヘルパー: 0 → "" で空欄表示（clearSummaryValues 呼び出し時に ¥0 を残さない）
  function v_(n) { return n > 0 ? n : ""; }

  // ── 設定シートからクリニック情報を取得（全行検索）──────
  var clinic = getClinicInfoFromSettings_V3_();

  // ── 色定数 ──────────────────────────────────────────
  var TITLE_BG   = "#1a73e8";
  var TITLE_FG   = "#ffffff";
  var LABEL_BG   = "#e8f0fe";
  var VALUE_BG   = "#ffffff";
  var DIV_BG     = "#e0e0e0";
  var TOTAL_BG   = "#fff3e0";   // 薄オレンジ: 合計金額
  var RECEIPT_BG = "#fff9c4";   // 薄黄: 領収証セクション
  var RECV_TOTAL = "#fce8b2";   // 濃い黄: 領収証合計金額

  // ── 既存マージをリセット＋全値クリア（想定外結合や旧文言を除去）──────────
  uiSh.getRange(UI.summary_area).breakApart().clearContent();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // セクション 1: 直前保存サマリー（Row 2〜12）
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // Row 2: タイトル帯
  uiSh.getRange("J2:N2").merge()
    .setValue("■ 直前保存サマリー（領収証参照元）")
    .setBackground(TITLE_BG).setFontColor(TITLE_FG).setFontWeight("bold").setFontSize(11)
    .setVerticalAlignment("middle");

  // Row 3: 患者名
  uiSh.getRange("J3:K3").merge().setValue("患者名").setBackground(LABEL_BG).setFontWeight("bold");
  uiSh.getRange("L3:N3").merge().setValue(name).setBackground(VALUE_BG)
    .setFontWeight("bold").setFontSize(11);

  // Row 4: 来院日
  uiSh.getRange("J4:K4").merge().setValue("来院日").setBackground(LABEL_BG).setFontWeight("bold");
  uiSh.getRange("L4:N4").merge().setValue(dateFmt).setBackground(VALUE_BG);

  // Row 5: 会計区分
  uiSh.getRange("J5:K5").merge().setValue("会計区分").setBackground(LABEL_BG).setFontWeight("bold");
  uiSh.getRange("L5:N5").merge().setValue(acctType).setBackground(VALUE_BG);

  // Row 6: セパレーター
  uiSh.getRange("J6:N6").merge().setValue("").setBackground(DIV_BG);

  // Row 7: 保険分合計（参考）
  uiSh.getRange("J7:K7").merge().setValue("保険分合計（参考）")
    .setBackground(LABEL_BG).setFontSize(9).setFontColor("#666666");
  uiSh.getRange("L7:N7").merge().setValue(v_(insTotal)).setBackground(VALUE_BG)
    .setNumberFormat("¥#,##0").setFontSize(9).setFontColor("#666666");

  // Row 8: ①一部負担金
  uiSh.getRange("J8:K8").merge().setValue("① 一部負担金").setBackground(LABEL_BG).setFontWeight("bold");
  uiSh.getRange("L8:N8").merge().setValue(v_(windowPay)).setBackground(VALUE_BG).setNumberFormat("¥#,##0");

  // Row 9: ②保険外（自費）
  uiSh.getRange("J9:K9").merge().setValue("② 保険外（自費）").setBackground(LABEL_BG).setFontWeight("bold");
  uiSh.getRange("L9:N9").merge().setValue(v_(spTotal)).setBackground(VALUE_BG).setNumberFormat("¥#,##0");

  // Row 10: 区切り線
  uiSh.getRange("J10:N10").merge()
    .setValue("").setBackground(DIV_BG);

  // Row 11: 合計金額（強調）
  uiSh.getRange("J11:K11").merge()
    .setValue("合計金額（①+②）").setBackground(TOTAL_BG).setFontWeight("bold").setFontSize(11);
  uiSh.getRange("L11:N11").merge()
    .setValue(v_(total)).setBackground(TOTAL_BG)
    .setNumberFormat("¥#,##0").setFontWeight("bold").setFontSize(13);

  // Row 12: visitKey（小さく）
  uiSh.getRange("J12:K12").merge()
    .setValue("visitKey").setBackground(LABEL_BG).setFontSize(9).setFontColor("#666666");
  uiSh.getRange("L12:N12").merge()
    .setValue(visitKey).setBackground(VALUE_BG).setFontSize(9).setFontColor("#666666");

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // セクション 2: 領収証（Row 13〜22）
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  // Row 13: 領収証タイトル
  uiSh.getRange("J13:N13").merge()
    .setValue("――― 領 収 証 ―――")
    .setBackground(RECEIPT_BG).setFontWeight("bold").setFontSize(11)
    .setHorizontalAlignment("center");

  // Row 14: 受取人
  uiSh.getRange("J14:N14").merge()
    .setValue(name ? name + " 様" : "")
    .setBackground(VALUE_BG).setFontWeight("bold").setFontSize(12);

  // Row 15: 合計金額（強調）
  uiSh.getRange("J15:K15").merge()
    .setValue("合計金額").setBackground(LABEL_BG).setFontWeight("bold");
  uiSh.getRange("L15:N15").merge()
    .setValue(v_(total)).setBackground(RECV_TOTAL)
    .setNumberFormat("¥#,##0").setFontWeight("bold").setFontSize(12);

  // Row 16: 一部負担金（内訳）
  uiSh.getRange("J16:K16").merge()
    .setValue("　一部負担金").setBackground(LABEL_BG).setFontSize(10);
  uiSh.getRange("L16:N16").merge()
    .setValue(v_(windowPay)).setBackground(VALUE_BG)
    .setNumberFormat("¥#,##0").setFontSize(10);

  // Row 17: 保険外（内訳）
  uiSh.getRange("J17:K17").merge()
    .setValue("　保険外（自費）").setBackground(LABEL_BG).setFontSize(10);
  uiSh.getRange("L17:N17").merge()
    .setValue(v_(spTotal)).setBackground(VALUE_BG)
    .setNumberFormat("¥#,##0").setFontSize(10);

  // Row 18: 締め文（固定）
  uiSh.getRange("J18:N18").merge()
    .setValue("上記合計金額を領収いたしました。")
    .setBackground(RECEIPT_BG).setFontSize(10);

  // Row 19: 施術所名（設定シートから取得・固定）
  uiSh.getRange("J19:N19").merge()
    .setValue(clinic.name || "（設定シート A列「施術所名」に記入）")
    .setBackground(RECEIPT_BG).setFontWeight("bold");

  // Row 20: 住所（固定）
  uiSh.getRange("J20:N20").merge()
    .setValue(clinic.addr ? "〒 " + clinic.addr : "（設定シート A列「住所」に記入）")
    .setBackground(RECEIPT_BG).setFontSize(9);

  // Row 21: 電話（固定）
  uiSh.getRange("J21:N21").merge()
    .setValue(clinic.tel ? "TEL  " + clinic.tel : "（設定シート A列「電話」に記入）")
    .setBackground(RECEIPT_BG).setFontSize(9);

  // Row 22: 来院日（領収日として表示・値セル）
  uiSh.getRange("J22:N22").merge()
    .setValue(dateFmt ? "来院日: " + dateFmt : "")
    .setBackground(RECEIPT_BG).setFontSize(9).setFontColor("#555555");

  // ── ボーダー ──────────────────────────────────────────
  uiSh.getRange(UI.summary_area).setBorder(
    true, true, true, true, null, null,
    "#1a73e8", SpreadsheetApp.BorderStyle.SOLID_MEDIUM
  );
  // タイトル帯の下
  uiSh.getRange("J2:N2").setBorder(null, null, true, null, null, null,
    "#1a73e8", SpreadsheetApp.BorderStyle.SOLID);
  // サマリー/領収証の境界
  uiSh.getRange("J12:N12").setBorder(null, null, true, null, null, null,
    "#aaaaaa", SpreadsheetApp.BorderStyle.DASHED);
  uiSh.getRange("J13:N13").setBorder(null, null, true, null, null, null,
    "#1a73e8", SpreadsheetApp.BorderStyle.SOLID);
  // 締め文の下
  uiSh.getRange("J18:N18").setBorder(null, null, true, null, null, null,
    "#aaaaaa", SpreadsheetApp.BorderStyle.DASHED);
}

/** ===== ヘッダー確認 ===== */
function checkHeaders_V3() {
  var ss = SpreadsheetApp.getActive();
  var caseSh = ss.getSheetByName(SHEETS.cases);
  var headSh = ss.getSheetByName(SHEETS.header);
  if (!caseSh || !headSh) throw new Error("来院ケース または 来院ヘッダ が見つかりません。");

  var caseMap = buildHeaderColMap_(caseSh);
  var headMap = buildHeaderColMap_(headSh);

  var needCase = Object.values(CASE_COLS);
  var needHead = Object.values(HEADER_COLS);

  var missCase = needCase.filter(function(h) { return !caseMap[h]; });
  var missHead = needHead.filter(function(h) { return !headMap[h]; });

  var caseActual = Object.keys(caseMap).slice(0, 30).join(", ");
  var headActual = Object.keys(headMap).slice(0, 30).join(", ");

  SpreadsheetApp.getUi().alert(
    "ヘッダーチェック結果\n\n" +
    (missCase.length
      ? "【来院ケース 不足】\n- " + missCase.join("\n- ") + "\n\n実ヘッダー：" + caseActual + "\n\n"
      : "【来院ケース 不足】なし\n\n") +
    (missHead.length
      ? "【来院ヘッダ 不足】\n- " + missHead.join("\n- ") + "\n\n実ヘッダー：" + headActual
      : "【来院ヘッダ 不足】なし")
  );
}

/** ===== caseNo別の来院日（コアがある日だけ） ===== */
function getPatientVisitDatesFromCasesByCase_(caseSh, caseMap, patientId, caseNo) {
  var lastRow = caseSh.getLastRow();
  if (lastRow < 2) return [];

  var n = lastRow - 1;
  var cPid = caseMap[CASE_COLS.patientId];
  var cDt  = caseMap[CASE_COLS.treatDate];
  var cNo  = caseMap[CASE_COLS.caseNo];

  var cP1 = caseMap[CASE_COLS.p1];
  var cD1 = caseMap[CASE_COLS.d1];
  var cI1 = caseMap[CASE_COLS.inj1];
  var cP2 = caseMap[CASE_COLS.p2];
  var cD2 = caseMap[CASE_COLS.d2];
  var cI2 = caseMap[CASE_COLS.inj2];

  var pidVals = caseSh.getRange(2, cPid, n, 1).getValues().flat();
  var dtVals  = caseSh.getRange(2, cDt,  n, 1).getValues().flat();
  var noVals  = caseSh.getRange(2, cNo,  n, 1).getValues().flat();

  var p1Vals = caseSh.getRange(2, cP1, n, 1).getValues().flat();
  var d1Vals = caseSh.getRange(2, cD1, n, 1).getValues().flat();
  var i1Vals = caseSh.getRange(2, cI1, n, 1).getValues().flat();
  var p2Vals = caseSh.getRange(2, cP2, n, 1).getValues().flat();
  var d2Vals = caseSh.getRange(2, cD2, n, 1).getValues().flat();
  var i2Vals = caseSh.getRange(2, cI2, n, 1).getValues().flat();

  var uniq = new Map();

  for (var i = 0; i < n; i++) {
    if (String(pidVals[i] || "").trim() !== patientId) continue;
    if (Number(noVals[i] || 0) !== caseNo) continue;

    var d = dtVals[i];
    if (!(d instanceof Date)) continue;

    var hasCore =
      String(p1Vals[i] || "").trim() ||
      String(d1Vals[i] || "").trim() ||
      (i1Vals[i] instanceof Date) ||
      String(p2Vals[i] || "").trim() ||
      String(d2Vals[i] || "").trim() ||
      (i2Vals[i] instanceof Date);

    if (!hasCore) continue;

    var key = fmt_(d, "yyyy-MM-dd");
    if (!uniq.has(key)) uniq.set(key, d);
  }

  return Array.from(uniq.values()).sort(function(a, b) { return a.getTime() - b.getTime(); });
}

/** ===== エピソード計算（30日ルール＋終了境界で打ち切り） ===== */
function calcEpisodeForCase_(caseSh, caseMap, patientId, treatDate, caseNo) {
  var dates = getPatientVisitDatesFromCasesByCase_(caseSh, caseMap, patientId, caseNo);

  if (!dates.length) {
    return { episodeStartDate: treatDate, kubun: "初検", priorCountInEpisode: 0 };
  }

  var prevDates = dates
    .filter(function(d) { return d.getTime() < treatDate.getTime(); })
    .sort(function(a, b) { return a.getTime() - b.getTime(); });

  if (!prevDates.length) {
    return { episodeStartDate: treatDate, kubun: "初検", priorCountInEpisode: 0 };
  }

  var lastDate = prevDates[prevDates.length - 1];
  var gap = daysBetween_(lastDate, treatDate);
  if (gap > 30) {
    return { episodeStartDate: treatDate, kubun: "初検", priorCountInEpisode: 0 };
  }

  var episode = buildEpisodeDatesBackwards_StopAtClosed_(
    caseSh, caseMap, patientId, caseNo, prevDates, treatDate, 30
  );

  if (!episode.length) {
    return { episodeStartDate: treatDate, kubun: "初検", priorCountInEpisode: 0 };
  }

  var episodeStartDate = episode[0];
  var priorCountInEpisode = episode.length;

  var kubun =
    (priorCountInEpisode === 0) ? "初検" :
    (priorCountInEpisode === 1) ? "再検" : "後療";

  return { episodeStartDate: episodeStartDate, kubun: kubun, priorCountInEpisode: priorCountInEpisode };
}

function findLatestCaseRowDateInEpisode_(caseSh, caseMap, patientId, treatDate, caseNo) {
  var dates = getPatientVisitDatesFromCasesByCase_(caseSh, caseMap, patientId, caseNo);
  if (!dates.length) return null;

  var prevDates = dates.filter(function(d) { return d.getTime() < treatDate.getTime(); }).sort(function(a,b){ return a.getTime()-b.getTime(); });
  if (!prevDates.length) return null;

  var lastDate = prevDates[prevDates.length - 1];
  var gap = daysBetween_(lastDate, treatDate);
  if (gap > 30) return null;

  return lastDate;
}

function isCaseClosedAsOf_(caseRowObj, treatDate) {
  if (!caseRowObj) return false;

  var has1 = partExists_(caseRowObj, 1);
  var has2 = partExists_(caseRowObj, 2);

  var e1 = has1 ? isEnded_(caseRowObj.end1, treatDate) : true;
  var e2 = has2 ? isEnded_(caseRowObj.end2, treatDate) : true;

  return e1 && e2;
}

function buildEpisodeDatesBackwards_StopAtClosed_(caseSh, caseMap, patientId, caseNo, prevDatesAsc, currentDate, maxGap) {
  var episode = [];
  var pivot = currentDate;

  for (var i = prevDatesAsc.length - 1; i >= 0; i--) {
    var d = prevDatesAsc[i];
    var gap = daysBetween_(d, pivot);
    if (gap > maxGap) break;

    var row = findCaseRowByPatientDateCaseNo_(caseSh, caseMap, patientId, d, caseNo);
    if (isCaseClosedAsOf_(row, pivot)) {
      break;
    }

    episode.unshift(d);
    pivot = d;
  }
  return episode;
}

function partExists_(src, idx) {
  if (!src) return false;
  if (idx === 1) return !!(String(src.p1||"").trim() || String(src.d1||"").trim() || (src.inj1 instanceof Date));
  return !!(String(src.p2||"").trim() || String(src.d2||"").trim() || (src.inj2 instanceof Date));
}

/* =====================================================
   checkProximityParts_V3_（近接部位チェック — §18）
   同一ケース内の部位1と部位2の組み合わせで近接部位を判定。
   戻り値: { isProximity: boolean, reason: string }
   ===================================================== */
function checkProximityParts_V3_(bui1, disease1, bui2, disease2) {
  var result = { isProximity: false, reason: "" };
  if (!bui1 || !disease1 || !bui2 || !disease2) return result;

  var type1 = detectInjuryType_V3_(disease1);
  var type2 = detectInjuryType_V3_(disease2);
  if (!type1 || !type2) return result;

  // ---- (a) 骨折 + 捻挫（関節近接） ----
  // 骨折部位の近接関節に捻挫がある場合
  var KOSSETU_NENZA_MAP = [
    { kossetuKw: ["鎖骨"],           nenzaKw: ["肩"] },
    { kossetuKw: ["上腕"],           nenzaKw: ["肩", "肘"] },
    { kossetuKw: ["前腕", "橈骨", "尺骨"], nenzaKw: ["肘", "手関節", "手首"] },
    { kossetuKw: ["指", "中手骨"],    nenzaKw: ["手関節", "手首", "指"] },
    { kossetuKw: ["大腿"],           nenzaKw: ["股", "膝"] },
    { kossetuKw: ["下腿", "脛骨", "腓骨"], nenzaKw: ["膝", "足関節", "足首"] },
    { kossetuKw: ["趾", "中足骨"],    nenzaKw: ["足関節", "足首", "趾"] },
    { kossetuKw: ["肋骨"],           nenzaKw: ["胸", "背"] },
  ];

  var fracSide = null, sprainSide = null, fracBui = null, sprainBui = null;
  if ((type1 === "骨折" || type1 === "不全骨折") && type2 === "捻挫") {
    fracSide = 1; sprainSide = 2; fracBui = bui1; sprainBui = bui2;
  } else if ((type2 === "骨折" || type2 === "不全骨折") && type1 === "捻挫") {
    fracSide = 2; sprainSide = 1; fracBui = bui2; sprainBui = bui1;
  }
  if (fracSide !== null) {
    for (var i = 0; i < KOSSETU_NENZA_MAP.length; i++) {
      var rule = KOSSETU_NENZA_MAP[i];
      var fracMatch = false, sprainMatch = false;
      for (var j = 0; j < rule.kossetuKw.length; j++) {
        if (fracBui.indexOf(rule.kossetuKw[j]) !== -1) { fracMatch = true; break; }
      }
      if (!fracMatch) continue;
      for (var k = 0; k < rule.nenzaKw.length; k++) {
        if (sprainBui.indexOf(rule.nenzaKw[k]) !== -1) { sprainMatch = true; break; }
      }
      if (sprainMatch) {
        result.isProximity = true;
        result.reason = "近接部位（§18）: " + fracBui + "の骨折と" + sprainBui + "の捻挫は同時算定不可（骨折のみ算定）";
        return result;
      }
    }
  }

  // ---- (b) 捻挫(頸/腰/肩) + 打撲/挫傷(背部) ----
  var nSide = null, dSide = null, nBui = null, dBui = null, nType = null, dType = null;
  if (type1 === "捻挫" && (type2 === "打撲" || type2 === "挫傷")) {
    nSide = 1; dSide = 2; nBui = bui1; dBui = bui2; nType = type1; dType = type2;
  } else if (type2 === "捻挫" && (type1 === "打撲" || type1 === "挫傷")) {
    nSide = 2; dSide = 1; nBui = bui2; dBui = bui1; nType = type2; dType = type1;
  }
  if (nSide !== null) {
    // 頸部/腰部/肩関節の捻挫 + 背部上部or下部の打撲/挫傷
    // 近接になる組み合わせ:
    //   頸部捻挫 ↔ 背部上部  (下部は非近接)
    //   腰部捻挫 ↔ 背部下部  (上部は非近接)
    //   肩関節捻挫 ↔ 背部上部  (下部は非近接)
    var nIsKeibu = nBui.indexOf("頸") !== -1 || nBui.indexOf("頚") !== -1;
    var nIsYobu = nBui.indexOf("腰") !== -1;
    var nIsKata = nBui.indexOf("肩") !== -1;

    var dIsSenakaUpper = dBui.indexOf("背部上") !== -1 || dBui.indexOf("背上") !== -1;
    var dIsSenakaLower = dBui.indexOf("背部下") !== -1 || dBui.indexOf("背下") !== -1;
    // 「背部」のみ（上下の指定なし）は上部扱い（従来互換）
    var dIsSenakaPlain = !dIsSenakaUpper && !dIsSenakaLower &&
                         (dBui.indexOf("背") !== -1);
    var dIsKata = dBui.indexOf("肩") !== -1;

    var proximity_b = false;
    if (nIsKeibu && (dIsSenakaUpper || dIsSenakaPlain || dIsKata)) proximity_b = true;
    if (nIsYobu && dIsSenakaLower) proximity_b = true;
    if (nIsKata && (dIsSenakaUpper || dIsSenakaPlain || dIsKata)) proximity_b = true;

    if (proximity_b) {
      result.isProximity = true;
      result.reason = "近接部位（§18）: " + nBui + "の捻挫と" + dBui + "の" + dType + "は同時算定不可（捻挫のみ算定）";
      return result;
    }

    // ---- (d) 捻挫 + 打撲の上下2関節 ----
    var NENZA_DABOKU_MAP = [
      { nenzaKw: ["手関節", "手首"], dabokuKw: ["前腕"] },
      { nenzaKw: ["肘"],           dabokuKw: ["前腕", "上腕"] },
      { nenzaKw: ["肩"],           dabokuKw: ["上腕"] },
      { nenzaKw: ["足関節", "足首"], dabokuKw: ["下腿"] },
      { nenzaKw: ["膝"],           dabokuKw: ["下腿", "大腿"] },
      { nenzaKw: ["股"],           dabokuKw: ["大腿"] },
    ];

    if (dType === "打撲") {
      for (var m = 0; m < NENZA_DABOKU_MAP.length; m++) {
        var rule2 = NENZA_DABOKU_MAP[m];
        var nMatch = false, dMatch = false;
        for (var n = 0; n < rule2.nenzaKw.length; n++) {
          if (nBui.indexOf(rule2.nenzaKw[n]) !== -1) { nMatch = true; break; }
        }
        if (!nMatch) continue;
        for (var p = 0; p < rule2.dabokuKw.length; p++) {
          if (dBui.indexOf(rule2.dabokuKw[p]) !== -1) { dMatch = true; break; }
        }
        if (dMatch) {
          result.isProximity = true;
          result.reason = "近接部位（§18）: " + nBui + "の捻挫と" + dBui + "の打撲は同時算定不可（捻挫のみ算定）";
          return result;
        }
      }
    }
  }

  // ---- (c) 指趾の骨折/脱臼 + 同部位の下位負傷 ----
  var YUBI_TYPES_HIGH = ["骨折", "脱臼"];
  var YUBI_TYPES_LOW = ["不全骨折", "捻挫", "打撲"];
  var YUBI_KW = ["指", "趾", "中手骨", "中足骨", "基節骨", "末節骨"];

  var highSide = null, lowSide = null, highBui = null, lowBui = null;
  if (YUBI_TYPES_HIGH.indexOf(type1) !== -1 && YUBI_TYPES_LOW.indexOf(type2) !== -1) {
    highSide = 1; lowSide = 2; highBui = bui1; lowBui = bui2;
  } else if (YUBI_TYPES_HIGH.indexOf(type2) !== -1 && YUBI_TYPES_LOW.indexOf(type1) !== -1) {
    highSide = 2; lowSide = 1; highBui = bui2; lowBui = bui1;
  }
  if (highSide !== null) {
    var highIsYubi = false, lowIsYubi = false;
    for (var q = 0; q < YUBI_KW.length; q++) {
      if (highBui.indexOf(YUBI_KW[q]) !== -1) highIsYubi = true;
      if (lowBui.indexOf(YUBI_KW[q]) !== -1) lowIsYubi = true;
    }
    if (highIsYubi && lowIsYubi) {
      var highType = (highSide === 1) ? type1 : type2;
      var lowType = (lowSide === 1) ? type1 : type2;
      result.isProximity = true;
      result.reason = "近接部位（§18）: " + highBui + "の" + highType + "と" + lowBui + "の" + lowType + "は同時算定不可（" + highType + "のみ算定）";
      return result;
    }
  }

  return result;
}

/* =====================================================
   setupValidation_V3（傷病名プルダウン設定）
   設定シートC列の傷病名一覧を読み取り、
   患者画面のB12, B13, B27, B28にプルダウンを設定する。
   ===================================================== */
function setupValidation_V3() {
  var ss = SpreadsheetApp.getActive();
  var settingsSh = ss.getSheetByName(SHEETS.settings);
  var uiSh = ss.getSheetByName(SHEETS.ui);
  if (!settingsSh) throw new Error("設定シートが見つかりません");
  if (!uiSh) throw new Error("患者画面シートが見つかりません");

  // 設定シートC列から傷病名一覧を取得（C2以降、空セルまで）
  var lastRow = settingsSh.getLastRow();
  if (lastRow < 2) {
    SpreadsheetApp.getUi().alert("設定シートC列に傷病名一覧がありません。C2以降に傷病名を入力してください。");
    return;
  }

  var values = settingsSh.getRange(2, 3, lastRow - 1, 1).getValues().flat();
  var names = [];
  for (var i = 0; i < values.length; i++) {
    var v = String(values[i] || "").trim();
    if (!v) break;
    names.push(v);
  }

  if (!names.length) {
    SpreadsheetApp.getUi().alert("設定シートC列に傷病名が見つかりません。C2以降に傷病名を入力してください。");
    return;
  }

  // B列: 傷病名プルダウン（選択必須）
  var diseaseCells = ["B12", "B13", "B36", "B37"];
  var diseaseRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(names, true)
    .setAllowInvalid(false)
    .build();

  for (var j = 0; j < diseaseCells.length; j++) {
    uiSh.getRange(diseaseCells[j]).setDataValidation(diseaseRule);
  }

  // D列から部位名候補を取得（D2以降、空セルまで）
  var dValues = settingsSh.getRange(2, 4, lastRow - 1, 1).getValues().flat();
  var partNames = [];
  for (var k = 0; k < dValues.length; k++) {
    var pv = String(dValues[k] || "").trim();
    if (!pv) break;
    partNames.push(pv);
  }

  // A列: 部位名プルダウン（自由入力も許可）
  var partMsg = "";
  if (partNames.length) {
    var partCells = ["A12", "A13", "A36", "A37"];
    var partRule = SpreadsheetApp.newDataValidation()
      .requireValueInList(partNames, true)
      .setAllowInvalid(true)
      .build();

    for (var m = 0; m < partCells.length; m++) {
      uiSh.getRange(partCells[m]).setDataValidation(partRule);
    }
    partMsg = "\n部位名候補プルダウン: " + partCells.join(", ") + "（自由入力も可）" +
              "\n候補: " + partNames.join(", ");
  }

  SpreadsheetApp.getUi().alert(
    "バリデーションを設定しました。\n" +
    "傷病名プルダウン: " + diseaseCells.join(", ") +
    "\n選択肢: " + names.join(", ") +
    partMsg
  );
}

/* =====================================================
   ensureSettingsRows_V3（設定シート初期セットアップ）
   A列=キー名 / B列=単価 を不足分だけ追記する。
   C列=傷病名一覧（プルダウンソース）も不足分を追記する。
   既存行は上書きしない（手動変更を保護）。
   ===================================================== */
function ensureSettingsRows_V3() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SHEETS.settings);
  if (!sh) throw new Error("設定シートが見つかりません");

  // ===== A列・B列: 設定キーと既定値 =====
  var requiredKeys = [
    ["初検料", 1550],
    ["初検時相談支援料", 50],
    ["再検料", 410],
    ["施療料_打撲", 820],
    ["施療料_捻挫", 820],
    ["施療料_挫傷", 820],
    ["後療料_打撲", 620],
    ["後療料_捻挫", 620],
    ["後療料_挫傷", 620],
    ["整復料_脱臼", 5200],
    ["後療料_脱臼", 720],
    // 骨折（§17.3）
    ["後療料_骨折", 850],
    ["後療料_不全骨折", 720],
    ["整復料_骨折_鎖骨", 5500],
    ["整復料_骨折_肋骨", 5500],
    ["整復料_骨折_指_趾", 5500],
    ["整復料_骨折_前腕", 7200],
    ["整復料_骨折_上腕", 7800],
    ["整復料_骨折_下腿", 7800],
    ["整復料_骨折_大腿", 11800],
    ["固定料_鎖骨", 3000],
    ["固定料_肋骨", 3000],
    ["固定料_指_趾", 3000],
    ["固定料_前腕", 4100],
    ["固定料_上腕", 4600],
    ["固定料_下腿", 4600],
    ["固定料_大腿", 7200],
    ["冷罨法", 85],
    ["温罨法", 37],
    ["電療", 33],
    ["待機_打撲捻挫挫傷", 100],
    ["多部位_3部位目係数", 0.6],
    ["窓口端数単位", 10],
  ];

  // 既存キーを収集
  var lastRow = sh.getLastRow();
  var existingKeys = new Set();
  if (lastRow >= 2) {
    var aVals = sh.getRange(2, 1, lastRow - 1, 1).getValues().flat();
    for (var i = 0; i < aVals.length; i++) {
      var k = String(aVals[i] || "").trim();
      if (k) existingKeys.add(k);
    }
  }

  // 不足分を追記
  var addedKeys = [];
  for (var j = 0; j < requiredKeys.length; j++) {
    var key = requiredKeys[j][0];
    var val = requiredKeys[j][1];
    if (!existingKeys.has(key)) {
      var nr = sh.getLastRow() + 1;
      sh.getRange(nr, 1).setValue(key);
      sh.getRange(nr, 2).setValue(val);
      addedKeys.push(key);
    }
  }

  // ===== C列: 傷病名一覧（プルダウンソース） =====
  var requiredNames = ["打撲", "捻挫", "挫傷", "脱臼", "骨折", "不全骨折"];

  var existingNames = new Set();
  if (lastRow >= 2) {
    var cVals = sh.getRange(2, 3, lastRow - 1, 1).getValues().flat();
    for (var m = 0; m < cVals.length; m++) {
      var n = String(cVals[m] || "").trim();
      if (n) existingNames.add(n);
    }
  }

  // C列の末尾行を特定（A/B列とは独立に管理）
  var cLastRow = 1;
  if (lastRow >= 2) {
    var cAll = sh.getRange(2, 3, sh.getLastRow() - 1, 1).getValues().flat();
    for (var p = cAll.length - 1; p >= 0; p--) {
      if (String(cAll[p] || "").trim()) { cLastRow = p + 2; break; }
    }
  }

  var addedNames = [];
  for (var q = 0; q < requiredNames.length; q++) {
    if (!existingNames.has(requiredNames[q])) {
      cLastRow++;
      sh.getRange(cLastRow, 3).setValue(requiredNames[q]);
      addedNames.push(requiredNames[q]);
    }
  }

  // ===== D列: 部位名候補（プルダウンソース） =====
  // 基本部位（体幹 — 左右なし）
  var trunk = ["頸部", "背部", "腰部"];
  // 左右展開する四肢部位
  var limb = [
    "肩関節", "上腕", "肘関節", "前腕", "手関節",
    "股関節", "大腿", "膝関節", "下腿", "足関節",
    "鎖骨", "肋骨", "指", "趾"
  ];
  // 上部/下部展開する部位
  var upperLower = ["背部", "腰部", "前腕", "上腕", "大腿", "下腿"];

  var requiredParts = [];
  // 体幹はそのまま
  for (var i = 0; i < trunk.length; i++) requiredParts.push(trunk[i]);
  // 四肢は 素 + 右 + 左
  for (var i = 0; i < limb.length; i++) {
    requiredParts.push(limb[i]);
    requiredParts.push("右" + limb[i]);
    requiredParts.push("左" + limb[i]);
  }
  // 上部/下部
  for (var i = 0; i < upperLower.length; i++) {
    requiredParts.push(upperLower[i] + "上部");
    requiredParts.push(upperLower[i] + "下部");
    requiredParts.push("右" + upperLower[i] + "上部");
    requiredParts.push("左" + upperLower[i] + "上部");
    requiredParts.push("右" + upperLower[i] + "下部");
    requiredParts.push("左" + upperLower[i] + "下部");
  }

  var existingParts = new Set();
  var curLastRow = sh.getLastRow();
  if (curLastRow >= 2) {
    var dVals = sh.getRange(2, 4, curLastRow - 1, 1).getValues().flat();
    for (var r = 0; r < dVals.length; r++) {
      var pv = String(dVals[r] || "").trim();
      if (pv) existingParts.add(pv);
    }
  }

  // D列の末尾行を特定
  var dLastRow = 1;
  if (curLastRow >= 2) {
    var dAll = sh.getRange(2, 4, curLastRow - 1, 1).getValues().flat();
    for (var s = dAll.length - 1; s >= 0; s--) {
      if (String(dAll[s] || "").trim()) { dLastRow = s + 2; break; }
    }
  }

  var addedParts = [];
  for (var t = 0; t < requiredParts.length; t++) {
    if (!existingParts.has(requiredParts[t])) {
      dLastRow++;
      sh.getRange(dLastRow, 4).setValue(requiredParts[t]);
      addedParts.push(requiredParts[t]);
    }
  }

  // ===== E:I列: 来院ヘッダ追加項目の選択肢マスタ =====
  var addedChoiceMasters = [];
  for (var u = 0; u < SETTINGS_CHOICE_MASTERS.length; u++) {
    var master = SETTINGS_CHOICE_MASTERS[u];
    var addedValues = ensureSettingsListColumn_(sh, master.col, master.label, master.values);
    addedChoiceMasters.push({
      label: master.label,
      values: addedValues,
    });
  }

  var headerSetupMsg = "";
  var headSh = ss.getSheetByName(SHEETS.header);
  if (headSh) {
    var headMap = buildHeaderColMap_(headSh);
    headMap = ensureHeaderCols_(headSh, headMap, Object.values(HEADER_COLS));
    setupHeaderChoiceValidation_V3_(sh, headSh, headMap);
    headerSetupMsg = "【来院ヘッダ】6列の末尾追加と入力候補設定を確認しました";
  }

  // 結果表示
  var msg = "設定シート初期セットアップ完了\n\n";
  if (addedKeys.length) {
    msg += "【追加した設定キー（A列）】\n" + addedKeys.join(", ") + "\n\n";
  } else {
    msg += "【設定キー】すべて登録済み\n\n";
  }
  if (addedNames.length) {
    msg += "【追加した傷病名（C列）】\n" + addedNames.join(", ") + "\n\n";
  } else {
    msg += "【傷病名一覧】すべて登録済み\n\n";
  }
  if (addedParts.length) {
    msg += "【追加した部位名候補（D列）】\n" + addedParts.join(", ");
  } else {
    msg += "【部位名候補】すべて登録済み";
  }
  msg += "\n\n";

  var addedChoiceMsgs = [];
  for (var v = 0; v < addedChoiceMasters.length; v++) {
    var item = addedChoiceMasters[v];
    if (item.values.length) {
      addedChoiceMsgs.push(item.label + ": " + item.values.join(", "));
    }
  }
  if (addedChoiceMsgs.length) {
    msg += "【追加した選択肢マスタ（E:I）】\n" + addedChoiceMsgs.join("\n");
  } else {
    msg += "【選択肢マスタ（E:I）】すべて登録済み";
  }
  if (headerSetupMsg) {
    msg += "\n\n" + headerSetupMsg;
  }
  SpreadsheetApp.getUi().alert(msg);
}

/** ===== 保険者情報 → 患者マスタへ転記 ===== */
/**
 * 保険者情報シート（縦型：A列=項目名、B列=値）から
 * 患者IDをキーに患者マスタへ上書きコピーする。
 *
 * レイアウト:
 *   A1「照会番号」、B1 = 患者ID の値
 *   以降: A列に項目名、B列に値が並ぶ縦型形式（マイナンバー取得データ）
 *
 * 氏名・性別は最初の出現のみ転記（配偶者情報を除外）。
 */
function copyInsurerToMaster_V3() {
  var ss = SpreadsheetApp.getActive();
  var insurerSh = ss.getSheetByName(SHEETS.insurer);
  var masterSh  = ss.getSheetByName(SHEETS.master);
  if (!insurerSh) { SpreadsheetApp.getUi().alert("「保険者情報」シートが見つかりません。"); return; }
  if (!masterSh)  { SpreadsheetApp.getUi().alert("「患者マスタ」シートが見つかりません。"); return; }

  // B1 から患者IDを取得（A1ラベル「照会番号」の隣）
  var patientId = String(insurerSh.getRange(1, 2).getValue() || "").trim();
  if (!patientId) {
    SpreadsheetApp.getUi().alert("患者IDが入力されていません。\nB1セル（照会番号の隣）に患者IDを入力してください。");
    return;
  }

  // 保険者情報A列の項目名 → 患者マスタのヘッダー列名 マッピング
  var FIELD_MAP = {
    "確認日":             "確認日",
    "保険者番号":         "保険者番号",
    "保険者名":           "保険者名",
    "番号":               "番号",
    "フリガナ":           "フリガナ",
    "氏名":               "氏名",
    "生年月日":           "生年月日",
    "性別":               "性別",
    "区分":               "区分",
    "有効開始日":         "有効開始日",
    "資格取得年月日":     "資格取得年月日",
    "負担割合":           "負担割合",
    "要配慮情報（備考）": "要配慮情報（備考）"
  };

  // 氏名・性別は最初の出現のみ（2回目以降=配偶者情報を除外）
  var seenOnce = { "氏名": false, "性別": false };

  // 患者マスタのヘッダーマップ（列名 → 1-based 列番号）
  var masterMap = buildHeaderColMap_(masterSh);
  if (!masterMap["患者ID"]) {
    SpreadsheetApp.getUi().alert("患者マスタに「患者ID」列が見つかりません。");
    return;
  }

  // 患者マスタから患者IDで行を検索
  var masterLastRow = masterSh.getLastRow();
  if (masterLastRow < 2) {
    SpreadsheetApp.getUi().alert("患者マスタにデータがありません。");
    return;
  }
  var masterData = masterSh.getRange(2, 1, masterLastRow - 1, masterSh.getLastColumn()).getValues();
  var mPidCol0 = masterMap["患者ID"] - 1;
  var masterRowNum = -1;
  for (var mi = 0; mi < masterData.length; mi++) {
    if (String(masterData[mi][mPidCol0] || "").trim() === patientId) {
      masterRowNum = mi + 2; // 1-based（ヘッダー行分 +1、0-based +1）
      break;
    }
  }
  if (masterRowNum === -1) {
    SpreadsheetApp.getUi().alert("患者マスタに患者ID「" + patientId + "」が見つかりません。");
    return;
  }

  // 保険者情報シートの全行を読み込み（A列=項目名、B列=値）
  var insurerLastRow = insurerSh.getLastRow();
  if (insurerLastRow < 2) {
    SpreadsheetApp.getUi().alert("保険者情報シートにデータが不足しています。");
    return;
  }
  var insurerData = insurerSh.getRange(1, 1, insurerLastRow, 2).getValues();

  // 各行を走査して転記
  var updatedFields = [];
  var skippedFields = [];

  for (var ii = 0; ii < insurerData.length; ii++) {
    var fieldName = String(insurerData[ii][0] || "").trim();
    var fieldVal  = insurerData[ii][1]; // 日付等を保持するため生のまま

    if (!fieldName || !FIELD_MAP.hasOwnProperty(fieldName)) continue;

    // 氏名・性別は最初の出現のみ転記
    if (seenOnce.hasOwnProperty(fieldName)) {
      if (seenOnce[fieldName]) {
        skippedFields.push(fieldName + "（配偶者、スキップ）");
        continue;
      }
      seenOnce[fieldName] = true;
    }

    var masterColName = FIELD_MAP[fieldName];
    var masterCol = masterMap[masterColName];
    if (!masterCol) {
      skippedFields.push(fieldName + "（患者マスタに列なし）");
      continue;
    }

    masterSh.getRange(masterRowNum, masterCol).setValue(fieldVal);
    updatedFields.push(fieldName);
  }

  // 結果報告
  var msg = "患者ID「" + patientId + "」の患者マスタを更新しました。\n\n";
  msg += "【転記した項目（" + updatedFields.length + "件）】\n" + updatedFields.join("、");
  if (skippedFields.length > 0) {
    msg += "\n\n【スキップした項目】\n" + skippedFields.join("、");
  }
  SpreadsheetApp.getUi().alert(msg);
}

/** ===== 施術明細ヘッダー自動セットアップ ===== */
function ensureDetailHeaders_V3() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(SHEETS.detail);
  if (!sh) throw new Error("施術明細シートが見つかりません");
  var required = [
    "detailID", "visitKey", "患者ID", "施術日", "区分",
    "caseNo", "caseKey", "受傷日_確定", "受傷日(入力)",
    "部位", "傷病", "部位順位",
    "冷", "温", "電",
    "係数", "基本料_確定", "初検相談_確定",
    "冷_確定", "温_確定", "電_確定", "待機_確定", "行合計_確定"
  ];
  sh.getRange(1, 1, 1, required.length).setValues([required]);
  SpreadsheetApp.getUi().alert("施術明細ヘッダーを設定しました（" + required.length + "列）");
}

// ============================================================
// ===== 初検情報UI読み取り / クリア / 履歴保存 =====
// ============================================================

/**
 * UIシートから初検情報入力の5項目を読み取る。
 * case1_initInfo / case2_initInfo のセル範囲を参照。
 */
function readInitInfoFromUI_(uiSh, caseNo) {
  var cells = (caseNo === 1) ? UI.case1_initInfo : UI.case2_initInfo;
  return {
    injuryDatetime: String(getMergedValue_(uiSh, cells.injuryDatetime) || "").trim(),
    injuryPlace:    String(getMergedValue_(uiSh, cells.injuryPlace)    || "").trim(),
    injuryStatus:   String(getMergedValue_(uiSh, cells.injuryStatus)   || "").trim(),
    initFindings:   String(getMergedValue_(uiSh, cells.initFindings)   || "").trim(),
    supportContent: String(getMergedValue_(uiSh, cells.supportContent) || "").trim(),
  };
}

/**
 * 初検情報入力エリア（5セル）をクリアする。
 * clearEntryUI_V3 / clearAfterSaveUI_V3_ から呼ぶ。
 */
function clearInitInfoUI_V3_(uiSh, caseNo) {
  var cells = (caseNo === 1) ? UI.case1_initInfo : UI.case2_initInfo;
  uiSh.getRange(cells.injuryDatetime).clearContent();
  uiSh.getRange(cells.injuryPlace).clearContent();
  uiSh.getRange(cells.injuryStatus).clearContent();
  uiSh.getRange(cells.initFindings).clearContent();
  uiSh.getRange(cells.supportContent).clearContent();
}

/**
 * 初検情報履歴シートへ upsert（患者ID + caseKey + 施術日(初検日) をキーに更新、なければ append）。
 *
 * ★ saveVisit_V3 は来院ヘッダへの二重登録禁止チェック（同日 visitKey エラー）で
 *    再保存をブロックするため、この upsert は初回登録が主用途。
 *    caseKey + 施術日(初検日) 一致行の更新は移行・補完スクリプトからの呼び出し用フォールバック。
 *
 * ★ シートが存在しない、またはデータ行が 0 の場合のみ正式ヘッダで初期化する
 *    （データ行がある場合は既存ヘッダを壊さない）。
 *
 * ★ 旧ヘッダ名との alias テーブルでシート破壊なく読み書き互換を保つ。
 *    旧→新: 初検日→施術日(初検日) / 負傷の状況→負傷時の状況 /
 *           初検時所見→初検時の所見 / 初検時相談支援内容→初検時相談支援の内容
 */
function appendInitHistory_V3_(ss, patientId, caseNo, caseKey, treatDate, initFields) {
  var HIST_HEADER = [
    "作成日時", "患者ID", "caseKey", "caseNo", "施術日(初検日)",
    "負傷の日時", "負傷の場所", "負傷時の状況", "初検時の所見",
    "初検時相談支援の内容", "受傷日_確定"
  ];
  // 旧ヘッダ名 → 新ヘッダ名 alias（既存シートの列名互換）
  var COL_ALIAS = {
    "初検日":               "施術日(初検日)",
    "負傷の状況":           "負傷時の状況",
    "初検時所見":           "初検時の所見",
    "初検時相談支援内容":   "初検時相談支援の内容",
  };

  var sh = ss.getSheetByName(SHEETS.history);
  if (!sh) { sh = ss.insertSheet(SHEETS.history); }

  // データ行なし（空 or ヘッダのみ）の場合のみ正式ヘッダを書き込む
  if (sh.getLastRow() < 2) {
    sh.getRange(1, 1, 1, HIST_HEADER.length).setValues([HIST_HEADER]);
  }

  // alias を解決したヘッダマップを構築（旧ヘッダ名も新ヘッダ名として扱う）
  var rawMap = buildHeaderColMap_(sh);
  var hmap = {};
  Object.keys(rawMap).forEach(function(name) {
    hmap[COL_ALIAS[name] || name] = rawMap[name];
  });

  // upsert キー検索（patientId + caseKey + 施術日(初検日) の3キー一致）
  var cPid = hmap["患者ID"];
  var cCK  = hmap["caseKey"];
  var cDt  = hmap["施術日(初検日)"];
  var rowIdx = 0;

  if (cPid && cCK && cDt && sh.getLastRow() >= 2) {
    var v = sh.getDataRange().getValues();
    var td = (treatDate instanceof Date) ? treatDate.getTime() : null;
    for (var r = 1; r < v.length; r++) {
      if (String(v[r][cPid - 1] || "").trim() !== patientId) continue;
      if (String(v[r][cCK  - 1] || "").trim() !== (caseKey || "")) continue;
      var rowDt = v[r][cDt - 1];
      if (td !== null && rowDt instanceof Date && rowDt.getTime() === td) {
        rowIdx = r + 1; break;
      }
    }
  }

  // 書き込みデータ（hmap 経由で列順に依存しない）
  var writeData = {
    "作成日時":             new Date(),
    "患者ID":               patientId,
    "caseKey":              caseKey   || "",
    "caseNo":               caseNo,
    "施術日(初検日)":       treatDate,
    "負傷の日時":           initFields.injuryDatetime || "",
    "負傷の場所":           initFields.injuryPlace    || "",
    "負傷時の状況":         initFields.injuryStatus   || "",
    "初検時の所見":         initFields.initFindings   || "",
    "初検時相談支援の内容": initFields.supportContent || "",
    "受傷日_確定":          "",   // 任意列：後から手動更新可
  };
  var colCount = Math.max(sh.getLastColumn(), HIST_HEADER.length);
  var rowArr = new Array(colCount).fill("");
  Object.keys(writeData).forEach(function(key) {
    if (hmap[key] !== undefined) rowArr[hmap[key] - 1] = writeData[key];
  });

  if (rowIdx > 0) {
    sh.getRange(rowIdx, 1, 1, rowArr.length).setValues([rowArr]);
  } else {
    sh.appendRow(rowArr);
  }

  // caseNo 列の日付自動変換防止: 書き込んだ行のセルを数値フォーマットに強制
  var caseNoCol = hmap["caseNo"];
  if (caseNoCol !== undefined) {
    var writtenRow = (rowIdx > 0) ? rowIdx : sh.getLastRow();
    sh.getRange(writtenRow, caseNoCol).setNumberFormat("0");
  }
}

/* =======================================================================
   Phase 2: 自費明細シート・ダイアログ・保存関数群
   ======================================================================= */

/** ===== 自費明細シートの作成・ヘッダ初期化（メニューから呼ぶ公開版） ===== */
function ensureSelfPayDetailSheet_V3() {
  var ss = SpreadsheetApp.getActive();
  var sh = ensureSelfPayDetailSheetInternal_(ss);
  SpreadsheetApp.getUi().alert(
    "自費明細シートの確認が完了しました。\n" +
    "シート名: " + SHEETS.selfPayDetail + "\n" +
    "14列ヘッダ設置済み。visitKey / lineNo などが列定義されています。"
  );
}

/**
 * 自費明細シートが存在しない場合は作成し、14列ヘッダを書き込む（内部用）。
 * 既存シートがある場合はそのまま返す。
 * @param {Spreadsheet} ss
 * @returns {Sheet} 自費明細シート
 */
function ensureSelfPayDetailSheetInternal_(ss) {
  var sh = ss.getSheetByName(SHEETS.selfPayDetail);
  if (!sh) {
    sh = ss.insertSheet(SHEETS.selfPayDetail);
  }
  // ヘッダ行がなければ書き込む（データ行がある場合は既存ヘッダを壊さない）
  if (sh.getLastRow() < 1) {
    var headers = [
      "明細ID", "visitKey", "行番号", "施術日", "患者ID",
      "会計区分", "menu_id", "メニュー名", "単価", "数量",
      "小計", "慢性候補フラグ", "次回予約あり", "作成日時"
    ];
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  }
  return sh;
}

/**
 * visitKey に一致する自費明細行を後方削除する。
 * @param {Sheet}  detailSh - 自費明細シート
 * @param {string} visitKey
 */
function deleteSelfPayDetailRows_V3_(detailSh, visitKey) {
  if (detailSh.getLastRow() < 2) return;
  var data    = detailSh.getDataRange().getValues();
  var headRow = data[0];
  var vkCol   = headRow.indexOf("visitKey");  // 0-based
  if (vkCol < 0) return;

  for (var r = data.length - 1; r >= 1; r--) {
    if (String(data[r][vkCol] || "") === visitKey) {
      detailSh.deleteRow(r + 1);  // Sheet は 1-based
    }
  }
}

/**
 * 自費明細シートに1行追記する。
 * @param {Sheet}  detailSh
 * @param {Object} rowObj - {selfPayDetailId, visitKey, lineNo, treatDate, patientId,
 *                           accountingType, menuId, menuName, unitPrice, qty, subtotal,
 *                           chronicFlag, nextReservation, createdAt}
 */
function appendSelfPayDetailRow_V3_(detailSh, rowObj) {
  detailSh.appendRow([
    rowObj.selfPayDetailId,
    rowObj.visitKey,
    rowObj.lineNo,
    rowObj.treatDate,
    rowObj.patientId,
    rowObj.accountingType  || "",
    rowObj.menuId          || "",
    rowObj.menuName        || "",
    rowObj.unitPrice,
    rowObj.qty,
    rowObj.subtotal,
    rowObj.chronicFlag       ? true : false,
    rowObj.nextReservation   ? true : false,
    rowObj.createdAt,
  ]);
}

/**
 * D7（自費メニュー表示）と F7（自費金額合計）を更新する。
 * @param {Sheet}  uiSh
 * @param {Array}  detailRows - [{menuName, subtotal}, ...] 当該 visitKey の全行
 */
function updateSelfPayDisplay_V3_(uiSh, detailRows) {
  // F7: 合計金額
  var total = detailRows.reduce(function(s, r) { return s + (r.subtotal || 0); }, 0);
  uiSh.getRange(UI.selfPay_amount).setValue(total > 0 ? total : "");

  // D7: メニュー集計テキスト
  var display = "";
  if (detailRows.length === 1) {
    display = detailRows[0].menuName || "";
  } else if (detailRows.length > 1) {
    display = (detailRows[0].menuName || "") + "ほか" + (detailRows.length - 1) + "件";
  }
  uiSh.getRange(UI.selfPay_menuType).setValue(display);
}

/**
 * H8 の状態表示を更新する。
 * @param {Sheet}  uiSh
 * @param {number} count - 保存済み明細件数
 */
function updateH8Status_V3_(uiSh, count) {
  if (count === 0) {
    uiSh.getRange(UI.selfPay_menuCode).setValue("未入力");
  } else {
    uiSh.getRange(UI.selfPay_menuCode).setValue(count + "件保存済");
  }
}

/**
 * visitKey に一致する自費明細行を返す。
 * @param {Sheet}  detailSh
 * @param {string} visitKey
 * @returns {Array} [{menuName, subtotal, lineNo, unitPrice, qty, menuId, ...}, ...]
 */
function readSelfPayDetailsForVisit_V3_(detailSh, visitKey) {
  if (!detailSh || detailSh.getLastRow() < 2) return [];
  var data    = detailSh.getDataRange().getValues();
  var headRow = data[0];
  var vkCol   = headRow.indexOf("visitKey");
  if (vkCol < 0) return [];

  var colIdx = {};
  headRow.forEach(function(name, i) { colIdx[name] = i; });

  var result = [];
  for (var r = 1; r < data.length; r++) {
    if (String(data[r][vkCol] || "") !== visitKey) continue;
    result.push({
      selfPayDetailId: data[r][colIdx["明細ID"]       || 0] || "",
      visitKey:        visitKey,
      lineNo:          data[r][colIdx["行番号"]        || 2] || r,
      treatDate:       data[r][colIdx["施術日"]        || 3] || "",
      patientId:       data[r][colIdx["患者ID"]        || 4] || "",
      accountingType:  data[r][colIdx["会計区分"]      || 5] || "",
      menuId:          data[r][colIdx["menu_id"]       || 6] || "",
      menuName:        data[r][colIdx["メニュー名"]    || 7] || "",
      unitPrice:       data[r][colIdx["単価"]          || 8] || 0,
      qty:             data[r][colIdx["数量"]          || 9] || 1,
      subtotal:        data[r][colIdx["小計"]          || 10] || 0,
      chronicFlag:     data[r][colIdx["慢性候補フラグ"]|| 11] === true,
      nextReservation: data[r][colIdx["次回予約あり"]  || 12] === true,
      createdAt:       data[r][colIdx["作成日時"]      || 13] || "",
    });
  }
  return result;
}

/**
 * 自費明細を visitKey 単位で delete & replace する（内部用）。
 * @param {Sheet}  uiSh     - 患者画面シート（D7/F7/H8 更新用）
 * @param {Sheet}  detailSh - 自費明細シート
 * @param {string} visitKey
 * @param {Array}  items    - [{menuId, menuName, unitPrice, qty}, ...]
 * @param {Object} context  - {treatDate, patientId, accountingType, chronicFlag, nextReservation}
 */
function saveSelfPayDetails_V3_(uiSh, detailSh, visitKey, items, context) {
  var now = new Date();

  // Step 1: 既存行を全削除（visitKey 一致行）
  deleteSelfPayDetailRows_V3_(detailSh, visitKey);

  // Step 2: 新しい行を追記
  var savedRows = [];
  items.forEach(function(item, idx) {
    var lineNo   = idx + 1;
    var detailId = visitKey + "_L" + lineNo;
    var subtotal = (item.unitPrice || 0) * (item.qty || 1);
    var rowObj = {
      selfPayDetailId: detailId,
      visitKey:        visitKey,
      lineNo:          lineNo,
      treatDate:       context.treatDate  || "",
      patientId:       context.patientId  || "",
      accountingType:  context.accountingType  || "",
      menuId:          item.menuId        || "",
      menuName:        item.menuName      || "",
      unitPrice:       item.unitPrice     || 0,
      qty:             item.qty           || 1,
      subtotal:        subtotal,
      chronicFlag:     context.chronicFlag     || false,
      nextReservation: context.nextReservation || false,
      createdAt:       now,
    };
    appendSelfPayDetailRow_V3_(detailSh, rowObj);
    savedRows.push(rowObj);
  });

  // Step 3: D7/F7 を更新
  updateSelfPayDisplay_V3_(uiSh, savedRows);

  // Step 4: H8 を更新
  updateH8Status_V3_(uiSh, savedRows.length);
}

/* =======================================================================
   Phase 2: 価格マスタ取得
   ======================================================================= */

/**
 * JBIZ 価格マスタシートを取得する内部ヘルパー。
 * JBIZ_MENU_SHEET_CANDIDATES を順に試し、最初に見つかったシートを返す。
 * 全候補で見つからない場合は null を返す（実在シート名一覧をログに出す）。
 * @param {Spreadsheet} jbizSS openById で取得済みの JBIZ スプレッドシート
 * @returns {Sheet|null}
 */
function getJBIZMenuSheet_(jbizSS) {
  for (var i = 0; i < JBIZ_MENU_SHEET_CANDIDATES.length; i++) {
    var sh = jbizSS.getSheetByName(JBIZ_MENU_SHEET_CANDIDATES[i]);
    if (sh) {
      Logger.log("getJBIZMenuSheet_: シート確認 [" + JBIZ_MENU_SHEET_CANDIDATES[i] + "]");
      return sh;
    }
  }
  // 全候補不一致 → 実在シート名一覧をログへ
  var actualNames = jbizSS.getSheets().map(function(s) { return s.getName(); }).join(", ");
  Logger.log(
    "getJBIZMenuSheet_: 価格マスタシートが見つかりません。\n"
    + "探した候補: [" + JBIZ_MENU_SHEET_CANDIDATES.join(", ") + "]\n"
    + "実在シート名: [" + actualNames + "]"
  );
  return null;
}

/**
 * JBIZ 価格マスタシートから自費メニューマスタを取得する。
 * Phase 3: JBIZ正本参照方式（2026-03-23）
 *   - SpreadsheetApp.openById で JBIZ を直接参照
 *   - 確定状況 = "確定" の行のみ返す
 *   - JBIZ 不達 / シートなし / 0件 → fallback を返して業務継続
 * HTMLダイアログから google.script.run で呼ぶ公開関数。
 * @returns {Array} [{menuId, menuName, unitPrice}, ...]
 */
function getSelfPayMenuMaster_V3() {
  // フォールバック（JBIZ 不達時の業務継続用）
  var fallback = [
    {menuId: "SELF_CHRONIC50",      menuName: "慢性ケア手技50分",          unitPrice: 5500,  memberPrice: 0},
    {menuId: "TRAINING_PERSONAL60", menuName: "パーソナルトレーニング60分", unitPrice: 8800,  memberPrice: 0},
    {menuId: "TRAINING_4PASS",      menuName: "4回集中コース",              unitPrice: 35200, memberPrice: 0},
    {menuId: "SELF_INITIAL_EVAL",   menuName: "症状別初回評価",             unitPrice: 3300,  memberPrice: 0},
  ];

  try {
    var jbizSS = SpreadsheetApp.openById(JBIZ_SS_ID);
    var sh = getJBIZMenuSheet_(jbizSS);
    if (!sh) {
      Logger.log("getSelfPayMenuMaster_V3: JBIZ 価格マスタシートなし → fallback");
      return fallback;
    }
    var data = sh.getDataRange().getValues();
    if (data.length < 2) return fallback;

    var result = [];
    for (var r = 1; r < data.length; r++) {
      var row    = data[r];
      var menuId = String(row[JBIZ_COL.menuId] || "").trim();
      if (!menuId) continue;
      var status = String(row[JBIZ_COL.status] || "").trim();
      if (status !== "確定") continue;
      var menuName    = String(row[JBIZ_COL.menuName] || "").trim();
      if (!menuName) continue;
      var unitPrice   = Number(row[JBIZ_COL.price])       || 0;  // G列: 一般料金
      var memberPrice = Number(row[JBIZ_COL.memberPrice]) || 0;  // H列: ジム会員料金（Phase B）
      result.push({menuId: menuId, menuName: menuName, unitPrice: unitPrice, memberPrice: memberPrice});
    }
    if (result.length === 0) {
      Logger.log("getSelfPayMenuMaster_V3: JBIZ 確定メニュー 0件 → fallback");
      return fallback;
    }
    Logger.log("getSelfPayMenuMaster_V3: JBIZ から " + result.length + " 件取得");
    return result;
  } catch (e) {
    Logger.log("getSelfPayMenuMaster_V3 エラー: " + e.message + " → fallback");
    return fallback;
  }
}

/**
 * JBIZ「メニューマスタ（価格設定）」の C列（menu_id）ヘッダと既知メニューの menu_id を設定する。
 * 一度だけ実行。冪等（既存値は上書きしない）。
 * 実行後 C列を確認し、未設定行に手動で menu_id を追加すること。
 * ※ 2026-03-23: menu_id 列を O列 → C列（旧:小区分）へ移動済み。
 */
function setupJBIZMenuMasterId_V3() {
  var jbizSS = SpreadsheetApp.openById(JBIZ_SS_ID);
  var sh = getJBIZMenuSheet_(jbizSS);
  if (!sh) {
    var actualNames = jbizSS.getSheets().map(function(s) { return s.getName(); }).join(", ");
    SpreadsheetApp.getUi().alert(
      "JBIZ 価格マスタシートが見つかりません。\n"
      + "探した候補: " + JBIZ_MENU_SHEET_CANDIDATES.join(" / ") + "\n"
      + "実在シート名: " + actualNames + "\n\n"
      + "JBIZ_MENU_SHEET_CANDIDATES に正しいシート名を追加してください。"
    );
    return;
  }
  var data = sh.getDataRange().getValues();
  var colIdx = JBIZ_COL.menuId + 1;  // getRange は 1始まり（C列 = 3）

  // C1 ヘッダ設定（空欄の場合のみ）
  if (!String(data[0][JBIZ_COL.menuId] || "").trim()) {
    sh.getRange(1, colIdx).setValue("menu_id");
  }

  var set = 0;
  for (var r = 1; r < data.length; r++) {
    var menuName = String(data[r][JBIZ_COL.menuName] || "").trim();
    var existing = String(data[r][JBIZ_COL.menuId]   || "").trim();
    if (existing) continue;  // 既存値は上書きしない
    var mid = JBIZ_MENU_ID_MAP[menuName];
    if (mid) {
      sh.getRange(r + 1, colIdx).setValue(mid);
      set++;
    }
  }
  SpreadsheetApp.flush();
  Logger.log("setupJBIZMenuMasterId_V3 完了: " + set + " 件設定");
  SpreadsheetApp.getUi().alert(
    "JBIZ menu_id 設定完了。\n設定件数: " + set + " 件\n\n"
    + "C列（menu_id）を確認し、未設定行に手動で menu_id を追加してください。\n"
    + "追加後に getSelfPayMenuMaster_V3 が JBIZ から取得できるようになります。"
  );
}

/**
 * JBIZ「メニューマスタ（価格設定）」の17行目以降にある非メニュー行（会員優待ルールメモ等）を
 * 「会員優待ルール」シートへ移行する。
 * 条件: 行17以降 かつ menu_id 列が空 かつ 完全空行でない行が対象。
 * 実行前にスプレッドシートをバックアップすること。
 */
function migrateJBIZMemberRules_V3() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.alert(
    "JBIZ 会員優待ルール移行",
    "「" + JBIZ_MENU_SHEET_CANDIDATES.join(" / ") + "」の17行目以降で menu_id が空の行を\n"
    + "「会員優待ルール」シートへコピーし、元行をクリアします。\n\n"
    + "実行前にスプレッドシートをバックアップしてください。続行しますか？",
    ui.ButtonSet.YES_NO
  );
  if (res !== ui.Button.YES) return;

  var jbizSS = SpreadsheetApp.openById(JBIZ_SS_ID);
  var srcSh = getJBIZMenuSheet_(jbizSS);
  if (!srcSh) {
    var actualNames = jbizSS.getSheets().map(function(s) { return s.getName(); }).join(", ");
    ui.alert(
      "元シートが見つかりません。\n"
      + "探した候補: " + JBIZ_MENU_SHEET_CANDIDATES.join(" / ") + "\n"
      + "実在シート名: " + actualNames
    );
    return;
  }

  // 「会員優待ルール」シートを作成（なければ新規）
  var dstSh = jbizSS.getSheetByName("会員優待ルール");
  if (!dstSh) {
    dstSh = jbizSS.insertSheet("会員優待ルール");
    dstSh.getRange(1, 1).setValue("# JBIZ 会員優待ルール（メニューマスタから移行）");
    dstSh.getRange(2, 1).setValue("移行日: " + Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd"));
    dstSh.getRange(3, 1).setValue("元シート: " + srcSh.getName());
  }

  var data = srcSh.getDataRange().getValues();
  var dstNextRow = dstSh.getLastRow() + 2;
  var moved = 0;
  var numCols = srcSh.getLastColumn();

  for (var r = 16; r < data.length; r++) {  // 17行目（0-indexed: r=16）以降
    var menuId = String(data[r][JBIZ_COL.menuId] || "").trim();
    if (menuId) continue;  // menu_id 設定済みメニュー行は移動しない
    var rowData = data[r];
    if (rowData.every(function(c) { return c === "" || c === null; })) continue;
    dstSh.getRange(dstNextRow, 1, 1, rowData.length).setValues([rowData]);
    srcSh.getRange(r + 1, 1, 1, numCols).clearContent();
    dstNextRow++;
    moved++;
  }

  SpreadsheetApp.flush();
  Logger.log("migrateJBIZMemberRules_V3 完了: " + moved + " 行移行");
  ui.alert(
    "会員優待ルール移行完了。\n移行行数: " + moved + " 行\n"
    + "「会員優待ルール」シートを確認してください。\n"
    + "移行後、不要になった空行はスプレッドシートで手動削除できます。"
  );
}

/* =======================================================================
   I-1: 来院ヘッダ列順整理（2026-04-01）
   論理グループ: A基本識別 → B保険算定 → Cケース識別 → D来院状態 → E経営KPI → F保険監査
   ======================================================================= */

/**
 * 来院ヘッダシートの列を HEADER_COLS の論理グループ順に並び替える。
 *
 * 安全設計:
 *   1. 実行前に「来院ヘッダ_BK_YYYYMMdd_HHmm」シートへバックアップを作成する。
 *   2. 確認ダイアログ（ドライラン表示）で Before/After を提示してから実行する。
 *   3. 来院ヘッダの全参照は buildHeaderColMap_（名前ベース）なので列順変更の機能影響はゼロ。
 *   4. targetOrder に含まれない列（旧削除済みヘッダ等）は末尾へ残す。
 *
 * ロールバック: バックアップシートを来院ヘッダシートの前に手動コピーして元の名前に戻す。
 */
function reorderHeaderCols_V3() {
  var ss  = SpreadsheetApp.getActiveSpreadsheet();
  var ui  = SpreadsheetApp.getUi();
  var tz  = Session.getScriptTimeZone();

  // ── 対象シート取得 ──────────────────────────
  var headSh = ss.getSheetByName(SHEETS.header);
  if (!headSh) {
    ui.alert("[エラー] 来院ヘッダシートが見つかりません: " + SHEETS.header);
    return;
  }

  // ── 目標列順（HEADER_COLS の論理グループ順） ──
  var targetOrder = [
    // A 基本識別
    HEADER_COLS.visitKey, HEADER_COLS.treatDate, HEADER_COLS.patientId,
    // B 保険算定
    HEADER_COLS.kubun, HEADER_COLS.injuryVisit,
    HEADER_COLS.initFee, HEADER_COLS.reFee, HEADER_COLS.supportFee,
    HEADER_COLS.detailSum, HEADER_COLS.visitTotal,
    HEADER_COLS.windowPay, HEADER_COLS.claimPay,
    // C ケース識別
    HEADER_COLS.caseKey, HEADER_COLS.caseIndex, HEADER_COLS.caseKey2,
    // D 来院状態・アラート・管理
    HEADER_COLS.lastVisit, HEADER_COLS.gapDays,
    HEADER_COLS.needCheck, HEADER_COLS.needCheckReason, HEADER_COLS.createdAt,
    // E 経営KPI
    HEADER_COLS.accountingType, HEADER_COLS.gymMemberFlag,
    HEADER_COLS.chronicCandidateFlag, HEADER_COLS.nextReservation, HEADER_COLS.firstVisitType,
    // F 保険監査
    HEADER_COLS.billedKubun, HEADER_COLS.mixedFlag,
    HEADER_COLS.case1Summary, HEADER_COLS.case2Summary, HEADER_COLS.chargeReason,
  ];

  // ── 現在の列名を取得 ────────────────────────
  var lastCol   = headSh.getLastColumn();
  var curNames  = (lastCol >= 1)
    ? headSh.getRange(1, 1, 1, lastCol).getValues()[0].map(function(v) { return String(v || "").trim(); })
    : [];

  if (curNames.length === 0) {
    ui.alert("[エラー] 来院ヘッダシートにヘッダ行がありません。");
    return;
  }

  // targetOrder のうちシートに存在する列だけを処理対象にする
  var existingTarget = targetOrder.filter(function(name) {
    return curNames.indexOf(name) >= 0;
  });
  // シートにあるが targetOrder に含まれない列（廃止済みヘッダ等）は末尾へ残す
  var extraCols = curNames.filter(function(n) {
    return n !== "" && existingTarget.indexOf(n) < 0;
  });
  // targetOrder に含まれるがシートにない列（まだ追加されていない列）
  var missingCols = targetOrder.filter(function(name) {
    return curNames.indexOf(name) < 0;
  });

  // ── ドライラン: Before/After を構築 ─────────
  // After = existingTarget順 + extraCols（末尾）
  var afterOrder = existingTarget.concat(extraCols);

  // 変更が必要かチェック（現在と After が一致しているか）
  var alreadySorted = curNames.every(function(n, i) { return n === (afterOrder[i] || ""); });
  if (alreadySorted) {
    ui.alert("[I-1] 来院ヘッダ列順整理\n\n列順は既に目標順と一致しています。変更不要です。");
    return;
  }

  // ── 確認ダイアログ ───────────────────────────
  var dryRunLines = [];
  dryRunLines.push("【I-1】来院ヘッダ列順整理 — 実行前確認");
  dryRunLines.push("現在の列数: " + curNames.filter(function(n){return n!=="";}).length);
  dryRunLines.push("整理後の列数: " + afterOrder.length);
  if (missingCols.length > 0) {
    dryRunLines.push("シートにない列（未追加・スキップ）: " + missingCols.join(", "));
  }
  if (extraCols.length > 0) {
    dryRunLines.push("未定義列（末尾に残す）: " + extraCols.join(", "));
  }
  dryRunLines.push("");
  dryRunLines.push("── 変更される主な移動 ──");

  // 変更点を最大10件表示
  var changes = [];
  afterOrder.forEach(function(name, idx) {
    var oldIdx = curNames.indexOf(name);
    var newIdx = idx;
    if (oldIdx !== newIdx) changes.push((oldIdx + 1) + "列目「" + name + "」→ " + (newIdx + 1) + "列目");
  });
  changes.slice(0, 10).forEach(function(c) { dryRunLines.push("  " + c); });
  if (changes.length > 10) dryRunLines.push("  ...他 " + (changes.length - 10) + " 件");

  dryRunLines.push("");
  dryRunLines.push("実行前にバックアップシートを自動作成します。");
  dryRunLines.push("続行しますか？");

  var resp = ui.alert("[I-1] 来院ヘッダ列順整理", dryRunLines.join("\n"), ui.ButtonSet.OK_CANCEL);
  if (resp !== ui.Button.OK) {
    ui.alert("キャンセルしました。シートは変更されていません。");
    return;
  }

  // ── Step 1: バックアップ作成 ─────────────────
  var stamp  = Utilities.formatDate(new Date(), tz, "yyyyMMdd_HHmm");
  var bkName = SHEETS.header + "_BK_" + stamp;
  headSh.copyTo(ss).setName(bkName);
  SpreadsheetApp.flush();
  Logger.log("reorderHeaderCols_V3: バックアップ作成 → " + bkName);

  // ── Step 2: 列を並び替え ─────────────────────
  // 処理対象は existingTarget のみ（extraCols は末尾に自然に残る）
  var curArr = curNames.slice();  // 移動に伴う現在列インデックスの追跡用

  for (var i = 0; i < existingTarget.length; i++) {
    var targetName = existingTarget[i];
    var targetPos  = i + 1;  // 1-based
    var currentPos = curArr.indexOf(targetName) + 1;  // 1-based

    if (currentPos <= 0 || currentPos === targetPos) continue;

    // currentPos >= targetPos が常に成立（左移動のみ）
    headSh.moveColumns(headSh.getRange(1, currentPos, 1, 1), targetPos);

    // curArr を実際の移動に合わせて更新
    var removed = curArr.splice(currentPos - 1, 1)[0];
    curArr.splice(targetPos - 1, 0, removed);
  }

  SpreadsheetApp.flush();

  // ── Step 3: 検証 ─────────────────────────────
  var newLastCol = headSh.getLastColumn();
  var newNames   = headSh.getRange(1, 1, 1, newLastCol).getValues()[0]
    .map(function(v) { return String(v || "").trim(); });

  var verifyLines = ["【I-1 完了】来院ヘッダ列順整理", ""];
  verifyLines.push("バックアップシート: " + bkName);
  verifyLines.push("整理後の列数: " + newNames.filter(function(n){return n!=="";}).length);
  verifyLines.push("");
  verifyLines.push("── 整理後の列順 ──");

  var groups = [
    { label: "A 基本識別",          end: 3 },
    { label: "B 保険算定",          end: 12 },
    { label: "C ケース識別",        end: 15 },
    { label: "D 来院状態",          end: 20 },
    { label: "E 経営KPI",           end: 25 },
    { label: "F 保険監査 + その他", end: newNames.length },
  ];
  var groupIdx = 0;
  newNames.forEach(function(name, idx) {
    if (name === "") return;
    if (groupIdx < groups.length && idx === groups[groupIdx].end) groupIdx++;
    if (groupIdx < groups.length && idx === 0 ||
        (groupIdx < groups.length && (idx === 0 ||
         existingTarget.indexOf(name) === (groupIdx > 0 ? groups[groupIdx - 1].end : 0)))) {
      // group label print handled below
    }
    verifyLines.push("  " + (idx + 1) + ". " + name);
  });

  Logger.log("reorderHeaderCols_V3 完了: " + newNames.join(", "));
  ui.alert("[I-1 完了]", verifyLines.join("\n"), ui.ButtonSet.OK);
}

/* =======================================================================
   Phase 2: ダイアログ起動・HTMLからの保存呼び出し
   ======================================================================= */

/**
 * 自費明細入力ダイアログを開く（Drawing ボタン / GASメニューから呼ぶ公開関数）。
 * 患者画面から visitKey・context を読み取ってダイアログに渡す。
 */
function openSelfPayDialog_V3() {
  var ss   = SpreadsheetApp.getActive();
  var uiSh = ss.getSheetByName(SHEETS.ui);
  if (!uiSh) {
    SpreadsheetApp.getUi().alert("患者画面シートが見つかりません。");
    return;
  }

  var patientId = String(uiSh.getRange(UI.patientId).getValue() || "").trim();
  var treatDate = uiSh.getRange(UI.treatDate).getValue();

  if (!patientId) {
    SpreadsheetApp.getUi().alert("患者を選択してください（B2 で検索→選択）。");
    return;
  }
  if (!(treatDate instanceof Date)) {
    SpreadsheetApp.getUi().alert("来院日（B4）が日付になっていません。");
    return;
  }

  var visitKey = buildVisitKey_(patientId, treatDate);

  // 既存の自費明細を読んでダイアログに渡す
  var detailSh   = ensureSelfPayDetailSheetInternal_(ss);
  var existItems = readSelfPayDetailsForVisit_V3_(detailSh, visitKey);

  var html = HtmlService.createHtmlOutputFromFile("selfPayDialog")
    .setWidth(600)
    .setHeight(420);

  // テンプレートにデータを渡す（直接メタデータとして埋め込む）
  // NOTE: createHtmlOutputFromFile はテンプレートではないためスクリプトレット不可。
  //       ダイアログ側は google.script.run で visitKey を取得する方式を採用。
  SpreadsheetApp.getUi().showModalDialog(html, "自費明細入力 — " + visitKey);
}

/**
 * ダイアログから visitKey を取得するためのブリッジ関数。
 * HTML側が google.script.run.getCurrentVisitKey_V3() で呼ぶ。
 * @returns {{visitKey: string, patientId: string, treatDate: string,
 *             accountingType: string, chronicFlag: boolean,
 *             nextReservation: boolean, existItems: Array}}
 */
function getCurrentVisitKey_V3() {
  try {
    var ss   = SpreadsheetApp.getActive();
    var uiSh = ss.getSheetByName(SHEETS.ui);
    if (!uiSh) return {visitKey: "", patientId: "", existItems: [], error: "患者画面シートが見つかりません"};

    // バッチ読み取り①: B2:C5 → patientId(C2=[0][1]) / treatDate(B4=[2][0]) / isGymMember(B5=[3][0])
    var metaVals    = uiSh.getRange("B2:C5").getValues();
    var patientId   = String(metaVals[0][1] || "").trim();   // C2
    var treatDate   = metaVals[2][0];                        // B4
    var isGymMember = metaVals[3][0] === true;               // B5: Phase B ジム会員フラグ

    if (!patientId || !(treatDate instanceof Date)) {
      return {visitKey: "", patientId: "", existItems: [], error: "患者または来院日が未選択"};
    }

    var visitKey = buildVisitKey_(patientId, treatDate);
    var detailSh = ensureSelfPayDetailSheetInternal_(ss);
    var existRows = readSelfPayDetailsForVisit_V3_(detailSh, visitKey);

    // ★ JSON-safe化: Date型フィールド(treatDate/createdAt)を除外し、
    //    ダイアログ表示に必要な4項目のみを返す。
    //    google.script.run は Date を含むオブジェクトを正しくシリアライズできず
    //    2回目以降のダイアログ起動がハングする原因となる。
    var existItems = existRows.map(function(row) {
      return {
        menuId:    String(row.menuId    || ""),
        menuName:  String(row.menuName  || ""),
        unitPrice: Number(row.unitPrice) || 0,
        qty:       Number(row.qty)       || 1,
      };
    });

    // バッチ読み取り②: B7:D8 → accountingType(B7=[0][0]) / chronicFlag(B8=[1][0]) / nextReserv(D8=[1][2])
    var selfPayVals = uiSh.getRange("B7:D8").getValues();
    var acctType = String(selfPayVals[0][0] || "").trim();  // B7
    var chronic  = selfPayVals[1][0] === true;              // B8
    var nextResv = selfPayVals[1][2] === true;              // D8

    return {
      visitKey:        visitKey,
      patientId:       patientId,
      treatDate:       Utilities.formatDate(treatDate, "Asia/Tokyo", "yyyy-MM-dd"),
      accountingType:  acctType,
      chronicFlag:     chronic,
      nextReservation: nextResv,
      existItems:      existItems,
      isGymMember:     isGymMember,  // Phase B: B5 チェックボックス値。dialog 側で価格切替に使う
    };
  } catch (e) {
    Logger.log("getCurrentVisitKey_V3 エラー: " + e.message);
    return {visitKey: "", patientId: "", existItems: [], error: e.message};
  }
}

/**
 * HTMLダイアログから google.script.run で呼ぶ保存関数。
 * @param {string} visitKey
 * @param {string} itemsJson    - JSON文字列: [{menuId, menuName, unitPrice, qty}, ...]
 * @param {string} contextJson  - JSON文字列: {treatDate, patientId, accountingType, chronicFlag, nextReservation}
 * @returns {string} "OK" or エラーメッセージ
 */
function saveSelfPayDetailsFromDialog_V3(visitKey, itemsJson, contextJson) {
  try {
    var items   = JSON.parse(itemsJson);
    var context = JSON.parse(contextJson);

    // treatDate を Date オブジェクトに変換
    if (typeof context.treatDate === "string" && context.treatDate) {
      var parts = context.treatDate.split("-");
      context.treatDate = new Date(
        parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2])
      );
    }

    var ss       = SpreadsheetApp.getActive();
    var uiSh     = ss.getSheetByName(SHEETS.ui);
    var detailSh = ensureSelfPayDetailSheetInternal_(ss);

    saveSelfPayDetails_V3_(uiSh, detailSh, visitKey, items, context);
    return "OK";
  } catch (e) {
    Logger.log("saveSelfPayDetailsFromDialog_V3 エラー: " + e.message);
    return "ERROR: " + e.message;
  }
}

/* =======================================================================
   Phase 2: saveVisit_V3 向け安全制御（警告チェック）
   ======================================================================= */

/**
 * saveVisit_V3 呼び出し時に H8 の状態を確認し、
 * 未保存自費明細の可能性がある場合に confirm 警告を出す。
 * @param {Sheet}  uiSh
 * @returns {boolean} true=続行可 / false=キャンセル
 */
function checkSelfPayWarningBeforeSave_V3_(uiSh) {
  try {
    var h8Val = String(uiSh.getRange(UI.selfPay_menuCode).getValue() || "").trim();
    var f7Val = uiSh.getRange(UI.selfPay_amount).getValue();
    var f7Num = (typeof f7Val === "number" && f7Val > 0) ? f7Val : 0;

    // H8 が「未入力」または空欄 かつ F7 に数値がある場合は警告
    // （Phase 1 からの移行中に手入力された可能性）
    if ((h8Val === "未入力" || h8Val === "") && f7Num > 0) {
      var ui = SpreadsheetApp.getUi();
      var resp = ui.alert(
        "自費明細の確認",
        "F7（自費金額）に " + f7Num + " 円が入力されていますが、\n" +
        "自費明細ダイアログでの保存が確認されていません。\n\n" +
        "このまま保存しますか？（自費明細シートには記録されません）",
        ui.ButtonSet.OK_CANCEL
      );
      return (resp === ui.Button.OK);
    }
  } catch (e) {
    Logger.log("checkSelfPayWarningBeforeSave_V3_ エラー: " + e.message);
  }
  return true;
}

/* =======================================================================
   会計区分クロスチェック警告（Phase 2 バグ修正 — レセプト事故防止）
   ======================================================================= */

/**
 * 会計区分とUI入力状態の矛盾を検出し、confirm 警告を出す。
 *  ① 自費のみ なのに保険ケースデータがUIに残っている場合
 *  ② 保険のみ なのに自費明細が保存済みの場合
 * @param {Sheet}  uiSh
 * @param {string} acctType - 会計区分の値
 * @returns {boolean} true=続行可 / false=キャンセル
 */
function checkAccountingTypeCrossWarning_V3_(uiSh, acctType) {
  try {
    var uiObj = SpreadsheetApp.getUi();

    // ① 自費のみ + 保険ケースデータがUIに残っている
    if (acctType === "自費のみ") {
      var c1 = hasCaseDataInUI_(uiSh, 1);
      var c2 = hasCaseDataInUI_(uiSh, 2);
      if (c1 || c2) {
        var resp = uiObj.alert(
          "【会計区分の確認】レセプト事故防止",
          "会計区分が「自費のみ」ですが、保険ケースの入力データが残っています。\n\n" +
          "・保険ケースは保存しません（来院ケースシートへの記録なし）\n" +
          "・保険算定・請求額・窓口負担はすべて 0 になります\n\n" +
          "このまま続行しますか？（自費明細のみ保存されます）",
          uiObj.ButtonSet.OK_CANCEL
        );
        return (resp === uiObj.Button.OK);
      }
    }

    // ② 保険のみ + 自費明細が保存済み
    if (acctType === "保険のみ") {
      var h8Val = String(uiSh.getRange(UI.selfPay_menuCode).getValue() || "").trim();
      if (h8Val !== "未入力" && h8Val !== "") {
        var resp2 = uiObj.alert(
          "【会計区分の確認】",
          "会計区分が「保険のみ」ですが、自費明細が保存済みです（" + h8Val + "）。\n\n" +
          "来院ヘッダの自費金額は 0 円で記録されます。\n" +
          "（自費明細シートの保存済みデータは削除されません）\n\n" +
          "このまま続行しますか？",
          uiObj.ButtonSet.OK_CANCEL
        );
        return (resp2 === uiObj.Button.OK);
      }
    }
  } catch (e) {
    Logger.log("checkAccountingTypeCrossWarning_V3_ エラー: " + e.message);
  }
  return true;
}

/**
 * 保険算定なし（自費のみ）の場合に使用するゼロ金額オブジェクトを返す。
 * appendHeaderRow_V3_ および writeAmountsToUI_V3_ のパラメータ互換。
 * @returns {Object}
 */
function buildZeroInsuranceAmounts_V3_() {
  return {
    initFee: 0, reFee: 0, supportFee: 0, detailSum: 0,
    visitTotal: 0, windowPay: 0, claimPay: 0,
    needCheck: false, needCheckReason: "",
    billedKubun: "", mixedFlag: "",
    case1Summary: "", case2Summary: "", chargeReason: ""
  };
}
