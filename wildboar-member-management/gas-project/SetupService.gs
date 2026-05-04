/**
 * ワイルドボア会員管理システム — スプレッドシート初期セットアップサービス
 *
 * GASエディタから手動実行するセットアップ専用関数群。
 * すべての関数は冪等性を持つ（2回実行しても重複データは作成されない）。
 *
 * 実行方法：
 *   GASエディタで setupSpreadsheet() を選択して「実行」ボタンを押す。
 *
 * 注意：
 *   - このファイルの関数は doGet() からは呼ばれない（セットアップ専用）
 *   - 金額はすべて仮値（0）で投入される。実際の金額はMembershipPlansシートで設定すること
 *   - 既存のシート・データは上書きしない（冪等性）
 *
 * 依存：Config.gs, SheetService.gs
 */

/** 各シートのヘッダー行定義（列順はSupabaseテーブル設計に準拠） */
var SHEET_HEADERS = {
  MEMBERS: [
    'member_id', 'family_name', 'given_name', 'family_name_kana', 'given_name_kana',
    'birth_date', 'gender', 'postal_code', 'prefecture', 'city', 'address1', 'address2',
    'phone_home', 'phone_mobile', 'email',
    'emergency_contact_name', 'emergency_contact_relation', 'emergency_contact_phone',
    'occupation', 'plan_id', 'key_card_number', 'join_date', 'status',
    'referrer_member_id', 'intake_application_id', 'notes',
    'created_at', 'updated_at', 'created_by', 'updated_by'
  ],
  INTAKE_APPLICATIONS: [
    'application_id', 'application_date',
    'family_name', 'given_name', 'family_name_kana', 'given_name_kana',
    'birth_date', 'gender', 'postal_code', 'prefecture', 'city', 'address1', 'address2',
    'phone_home', 'phone_mobile', 'email',
    'emergency_contact_name', 'emergency_contact_relation', 'emergency_contact_phone',
    'occupation', 'plan_id', 'referrer_member_id', 'notes', 'privacy_agreed',
    'review_status', 'reviewed_by', 'reviewed_at',
    'assigned_member_id', 'assigned_key_card_number', 'rejection_reason',
    'created_at', 'updated_at'
  ],
  MEMBERSHIP_PLANS: [
    'plan_id', 'plan_name', 'monthly_fee', 'enrollment_fee', 'card_key_fee',
    'description', 'is_active', 'display_order', 'notes', 'created_at', 'updated_at'
  ],
  FEE_RULES: [
    'rule_id', 'rule_key', 'rule_name', 'rule_category', 'rule_value', 'rule_type',
    'description', 'is_active', 'notes', 'created_at', 'updated_at'
  ],
  PAYMENTS: [
    'payment_id', 'member_id', 'payment_type', 'amount', 'payment_method',
    'payment_date', 'target_month', 'notes', 'created_at', 'created_by'
  ],
  STATUS_HISTORY: [
    'history_id', 'member_id', 'change_type', 'previous_status', 'new_status',
    'effective_date', 'end_date', 'reason', 'notes', 'created_at', 'created_by'
  ],
  KEY_CARDS: [
    'key_card_number', 'status', 'member_id', 'issued_date', 'returned_date',
    'notes', 'created_at', 'updated_at'
  ],
  REFERRALS: [
    'referral_id', 'referrer_member_id', 'referee_member_id',
    'referral_date', 'reward_applied', 'notes', 'created_at'
  ],
  BILLING_EXPORTS: [
    'export_id', 'target_month', 'export_date', 'exported_by',
    'file_name', 'member_count', 'total_amount', 'status', 'notes', 'created_at'
  ],
  AUDIT_LOGS: [
    'log_id', 'action', 'table_name', 'record_id', 'field_name',
    'old_value', 'new_value', 'performed_by', 'performed_at', 'notes'
  ],
  SETTINGS: [
    'setting_key', 'setting_value', 'setting_type', 'description',
    'is_editable', 'updated_at', 'updated_by'
  ]
};

// =============================================================================
// メインセットアップ関数
// =============================================================================

/**
 * スプレッドシートの初期セットアップをすべて実行する
 *
 * GASエディタでこの関数を選択して「実行」ボタンを押す。
 * 2回実行しても重複データは作成されない。
 */
function setupSpreadsheet() {
  Logger.log('=== ワイルドボア会員管理 スプレッドシートセットアップ開始 ===');

  var ss = getSpreadsheet();
  Logger.log('対象スプレッドシート: ' + ss.getName() + ' (ID: ' + ss.getId() + ')');

  Logger.log('[1/6] シート作成...');
  createRequiredSheets(ss);

  Logger.log('[2/6] ヘッダー行設定...');
  setupHeaders(ss);

  Logger.log('[3/6] 初期設定データ投入...');
  setupInitialSettings(ss);

  Logger.log('[4/6] コースマスタ投入...');
  setupMembershipPlans(ss);

  Logger.log('[5/6] 料金ルール投入...');
  setupFeeRules(ss);

  Logger.log('[6/6] 入力規則設定...');
  setupValidations(ss);

  SpreadsheetApp.flush();
  Logger.log('=== セットアップ完了 ===');
  Logger.log('');
  Logger.log('[重要] 金額はすべて仮値（0円）で投入しています。');
  Logger.log('以下のシートで実際の金額・設定値を入力してください：');
  Logger.log('  - MembershipPlans: monthly_fee, enrollment_fee, card_key_fee');
  Logger.log('  - Settings: card_key_issue_fee, default_join_fee, billing_cutoff_day, pause_max_months');
}

// =============================================================================
// シート作成
// =============================================================================

/**
 * 必要な全シートを作成する（既存シートはスキップ）
 *
 * @param {SpreadsheetApp.Spreadsheet} ss
 */
function createRequiredSheets(ss) {
  var sheetList = [
    SHEET_NAMES.MEMBERS,
    SHEET_NAMES.INTAKE_APPLICATIONS,
    SHEET_NAMES.MEMBERSHIP_PLANS,
    SHEET_NAMES.FEE_RULES,
    SHEET_NAMES.PAYMENTS,
    SHEET_NAMES.STATUS_HISTORY,
    SHEET_NAMES.KEY_CARDS,
    SHEET_NAMES.REFERRALS,
    SHEET_NAMES.BILLING_EXPORTS,
    SHEET_NAMES.AUDIT_LOGS,
    SHEET_NAMES.SETTINGS
  ];

  sheetList.forEach(function(name) {
    if (!ss.getSheetByName(name)) {
      ss.insertSheet(name);
      Logger.log('  作成: ' + name);
    } else {
      Logger.log('  既存: ' + name + '（スキップ）');
    }
  });
}

// =============================================================================
// ヘッダー設定
// =============================================================================

/**
 * 全シートにヘッダー行を設定する（既にヘッダーがある場合はスキップ）
 *
 * @param {SpreadsheetApp.Spreadsheet} ss
 */
function setupHeaders(ss) {
  var sheetHeaderMap = [
    { name: SHEET_NAMES.MEMBERS,             headers: SHEET_HEADERS.MEMBERS },
    { name: SHEET_NAMES.INTAKE_APPLICATIONS, headers: SHEET_HEADERS.INTAKE_APPLICATIONS },
    { name: SHEET_NAMES.MEMBERSHIP_PLANS,    headers: SHEET_HEADERS.MEMBERSHIP_PLANS },
    { name: SHEET_NAMES.FEE_RULES,           headers: SHEET_HEADERS.FEE_RULES },
    { name: SHEET_NAMES.PAYMENTS,            headers: SHEET_HEADERS.PAYMENTS },
    { name: SHEET_NAMES.STATUS_HISTORY,      headers: SHEET_HEADERS.STATUS_HISTORY },
    { name: SHEET_NAMES.KEY_CARDS,           headers: SHEET_HEADERS.KEY_CARDS },
    { name: SHEET_NAMES.REFERRALS,           headers: SHEET_HEADERS.REFERRALS },
    { name: SHEET_NAMES.BILLING_EXPORTS,     headers: SHEET_HEADERS.BILLING_EXPORTS },
    { name: SHEET_NAMES.AUDIT_LOGS,          headers: SHEET_HEADERS.AUDIT_LOGS },
    { name: SHEET_NAMES.SETTINGS,            headers: SHEET_HEADERS.SETTINGS }
  ];

  sheetHeaderMap.forEach(function(item) {
    var sheet = ss.getSheetByName(item.name);
    if (!sheet) {
      Logger.log('  [WARN] シートが見つかりません: ' + item.name);
      return;
    }
    _setSheetHeader(sheet, item.headers);
  });
}

/**
 * シートの1行目が空の場合のみヘッダーを設定する（内部関数）
 *
 * @param {SpreadsheetApp.Sheet} sheet
 * @param {string[]} headers
 */
function _setSheetHeader(sheet, headers) {
  var firstCell = sheet.getRange(1, 1).getValue();
  if (firstCell !== '') {
    Logger.log('  既存ヘッダー: ' + sheet.getName() + '（スキップ）');
    return;
  }
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#d9e1f2');
  headerRange.setFontColor('#1f3864');
  sheet.setFrozenRows(1);
  Logger.log('  ヘッダー設定: ' + sheet.getName() + ' (' + headers.length + '列)');
}

// =============================================================================
// 初期データ投入
// =============================================================================

/**
 * Settingsシートに初期設定値を投入する（既存キーはスキップ）
 *
 * @param {SpreadsheetApp.Spreadsheet} ss
 */
function setupInitialSettings(ss) {
  var sheet = ss.getSheetByName(SHEET_NAMES.SETTINGS);
  if (!sheet) return;

  var now = new Date().toISOString();

  // setting_key | setting_value | setting_type | description | is_editable | updated_at | updated_by
  var initialSettings = [
    ['gym_name',           'トレーニングジム ワイルドボア', 'text',    'ジム名',                                  'FALSE', now, 'setup'],
    ['gym_address',        '兵庫県朝来市立野169-1',          'text',    'ジム所在地',                              'FALSE', now, 'setup'],
    ['business_hours',     '5:00〜23:00',                    'text',    '営業時間',                                'TRUE',  now, 'setup'],
    ['card_key_issue_fee', '0',                              'number',  'カードキー発行料（円）※要確認・仮値',     'TRUE',  now, 'setup'],
    ['default_join_fee',   '0',                              'number',  '入会金デフォルト（円）※要確認・仮値',     'TRUE',  now, 'setup'],
    ['tax_rate',           '0.10',                           'number',  '消費税率（0.10 = 10%）',                  'TRUE',  now, 'setup'],
    ['member_id_prefix',   'W-',                             'text',    '会員番号プレフィックス',                  'FALSE', now, 'setup'],
    ['member_id_digits',   '4',                              'number',  '会員番号連番の桁数（例：4 → W-0001）',   'FALSE', now, 'setup'],
    ['key_number_prefix',  'K-',                             'text',    '鍵番号プレフィックス',                    'FALSE', now, 'setup'],
    ['key_number_digits',  '3',                              'number',  '鍵番号連番の桁数（例：3 → K-001）',      'FALSE', now, 'setup'],
    ['billing_cutoff_day', '0',                              'number',  '請求締め日（日）※要確認・仮値',           'TRUE',  now, 'setup'],
    ['pause_max_months',   '0',                              'number',  '最長休会月数 ※要確認・仮値',             'TRUE',  now, 'setup'],
    ['pause_fee_enabled',  'FALSE',                          'boolean', '休会中も月会費を徴収するか ※要確認',     'TRUE',  now, 'setup']
  ];

  var existingKeys = _getExistingKeys(sheet, 0);
  var added = 0;
  initialSettings.forEach(function(row) {
    if (!existingKeys[row[0]]) {
      sheet.appendRow(row);
      added++;
    }
  });
  Logger.log('  Settings: ' + added + '件追加（' + (initialSettings.length - added) + '件スキップ）');
}

/**
 * MembershipPlansシートに初期コースデータを投入する（既存IDはスキップ）
 *
 * @param {SpreadsheetApp.Spreadsheet} ss
 */
function setupMembershipPlans(ss) {
  var sheet = ss.getSheetByName(SHEET_NAMES.MEMBERSHIP_PLANS);
  if (!sheet) return;

  var now = new Date().toISOString();

  // plan_id | plan_name | monthly_fee | enrollment_fee | card_key_fee | description | is_active | display_order | notes | created_at | updated_at
  var initialPlans = [
    ['PLAN-001', '一般会員', 0, 0, 0, '一般向けコース',                       'TRUE',  1, '※金額は仮値。monthly_fee / enrollment_fee / card_key_fee を実際の金額に更新してください', now, now],
    ['PLAN-002', '女性会員', 0, 0, 0, '女性限定コース',                       'TRUE',  2, '※金額は仮値。monthly_fee / enrollment_fee / card_key_fee を実際の金額に更新してください', now, now],
    ['PLAN-003', '学生会員', 0, 0, 0, '学生向けコース（学生証提示が必要）',   'TRUE',  3, '※金額は仮値。monthly_fee / enrollment_fee / card_key_fee を実際の金額に更新してください', now, now],
    ['PLAN-004', 'ペア会員', 0, 0, 0, '2名セットのコース',                    'TRUE',  4, '※金額は仮値。monthly_fee / enrollment_fee / card_key_fee を実際の金額に更新してください', now, now],
    ['PLAN-005', '法人会員', 0, 0, 0, '法人向けコース（要相談）',             'TRUE',  5, '※金額は仮値。monthly_fee / enrollment_fee / card_key_fee を実際の金額に更新してください', now, now],
    ['PLAN-006', 'その他',   0, 0, 0, 'その他・特別コース（個別相談）',       'FALSE', 6, '※金額は仮値。monthly_fee / enrollment_fee / card_key_fee を実際の金額に更新してください', now, now]
  ];

  var existingIds = _getExistingKeys(sheet, 0);
  var added = 0;
  initialPlans.forEach(function(row) {
    if (!existingIds[row[0]]) {
      sheet.appendRow(row);
      added++;
    }
  });
  Logger.log('  MembershipPlans: ' + added + '件追加（' + (initialPlans.length - added) + '件スキップ）');
}

/**
 * FeeRulesシートに初期料金ルールを投入する（既存キーはスキップ）
 *
 * @param {SpreadsheetApp.Spreadsheet} ss
 */
function setupFeeRules(ss) {
  var sheet = ss.getSheetByName(SHEET_NAMES.FEE_RULES);
  if (!sheet) return;

  var now = new Date().toISOString();

  // rule_id | rule_key | rule_name | rule_category | rule_value | rule_type | description | is_active | notes | created_at | updated_at
  var initialRules = [
    ['FR-001', 'prorating_enabled',       '初月日割り計算あり',       'proration', 'TRUE',  'boolean', '入会月は日割り計算を行う',                                        'TRUE', '',                now, now],
    ['FR-002', 'prorating_rounding',      '日割り端数処理',           'proration', 'floor', 'text',    '日割り計算の端数処理（floor=切り捨て / ceil=切り上げ）',           'TRUE', '※要オーナー確認', now, now],
    ['FR-003', 'prepay_next_month',       '翌月分前払いあり',         'billing',   'TRUE',  'boolean', '初回費用に翌月分の月会費を含む',                                  'TRUE', '',                now, now],
    ['FR-004', 'join_fee_enabled',        '入会金あり',               'fee',       'TRUE',  'boolean', '入会金を初回費用に含める',                                        'TRUE', '',                now, now],
    ['FR-005', 'card_key_fee_enabled',    'カードキー発行料あり',     'fee',       'TRUE',  'boolean', 'カードキー発行料を初回費用に含める',                              'TRUE', '',                now, now],
    ['FR-006', 'join_fee_waived_on_line', 'LINE登録で入会金無料',     'fee',       'FALSE', 'boolean', 'LINE公式アカウント登録を条件に入会金を無料にする',                'TRUE', '※要オーナー確認', now, now]
  ];

  // rule_key で重複チェック（2列目 = インデックス1）
  var existingKeys = _getExistingKeys(sheet, 1);
  var added = 0;
  initialRules.forEach(function(row) {
    if (!existingKeys[row[1]]) {
      sheet.appendRow(row);
      added++;
    }
  });
  Logger.log('  FeeRules: ' + added + '件追加（' + (initialRules.length - added) + '件スキップ）');
}

// =============================================================================
// 入力規則設定
// =============================================================================

/**
 * 各シートにドロップダウン入力規則を設定する
 *
 * @param {SpreadsheetApp.Spreadsheet} ss
 */
function setupValidations(ss) {
  _setColumnDropdown(ss, SHEET_NAMES.MEMBERS,             SHEET_HEADERS.MEMBERS,             'status',        ['active', 'paused', 'withdrawn']);
  _setColumnDropdown(ss, SHEET_NAMES.MEMBERS,             SHEET_HEADERS.MEMBERS,             'gender',        ['male', 'female', 'other']);
  _setColumnDropdown(ss, SHEET_NAMES.INTAKE_APPLICATIONS, SHEET_HEADERS.INTAKE_APPLICATIONS, 'review_status', ['pending', 'approved', 'rejected']);
  _setColumnDropdown(ss, SHEET_NAMES.INTAKE_APPLICATIONS, SHEET_HEADERS.INTAKE_APPLICATIONS, 'gender',        ['male', 'female', 'other']);
  _setColumnDropdown(ss, SHEET_NAMES.INTAKE_APPLICATIONS, SHEET_HEADERS.INTAKE_APPLICATIONS, 'privacy_agreed',['TRUE', 'FALSE']);
  _setColumnDropdown(ss, SHEET_NAMES.KEY_CARDS,           SHEET_HEADERS.KEY_CARDS,           'status',        ['available', 'in_use', 'lost', 'damaged']);
  _setColumnDropdown(ss, SHEET_NAMES.STATUS_HISTORY,      SHEET_HEADERS.STATUS_HISTORY,      'change_type',   ['pause', 'withdraw', 'restart']);
  _setColumnDropdown(ss, SHEET_NAMES.STATUS_HISTORY,      SHEET_HEADERS.STATUS_HISTORY,      'previous_status',['active', 'paused', 'withdrawn']);
  _setColumnDropdown(ss, SHEET_NAMES.STATUS_HISTORY,      SHEET_HEADERS.STATUS_HISTORY,      'new_status',    ['active', 'paused', 'withdrawn']);
  _setColumnDropdown(ss, SHEET_NAMES.PAYMENTS,            SHEET_HEADERS.PAYMENTS,            'payment_type',  ['initial', 'monthly', 'other']);
  _setColumnDropdown(ss, SHEET_NAMES.PAYMENTS,            SHEET_HEADERS.PAYMENTS,            'payment_method',['cash', 'bank_transfer']);
  _setColumnDropdown(ss, SHEET_NAMES.BILLING_EXPORTS,     SHEET_HEADERS.BILLING_EXPORTS,     'status',        ['draft', 'submitted', 'confirmed']);
  _setColumnDropdown(ss, SHEET_NAMES.FEE_RULES,           SHEET_HEADERS.FEE_RULES,           'rule_type',     ['boolean', 'number', 'text', 'percentage']);
  _setColumnDropdown(ss, SHEET_NAMES.FEE_RULES,           SHEET_HEADERS.FEE_RULES,           'is_active',     ['TRUE', 'FALSE']);
  _setColumnDropdown(ss, SHEET_NAMES.MEMBERSHIP_PLANS,    SHEET_HEADERS.MEMBERSHIP_PLANS,    'is_active',     ['TRUE', 'FALSE']);
  Logger.log('  入力規則設定完了（15箇所）');
}

// =============================================================================
// 内部ヘルパー関数
// =============================================================================

/**
 * シートの指定列インデックスの値をキーとしたハッシュを返す（内部関数）
 *
 * 重複チェックに使用する。ヘッダー行はスキップする。
 *
 * @param {SpreadsheetApp.Sheet} sheet
 * @param {number} colIndex - 0-based列インデックス
 * @returns {Object} { value: true, ... }
 */
function _getExistingKeys(sheet, colIndex) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};
  var data = sheet.getRange(2, colIndex + 1, lastRow - 1, 1).getValues();
  var keys = {};
  data.forEach(function(row) {
    if (row[0] && row[0] !== '') keys[row[0]] = true;
  });
  return keys;
}

/**
 * 指定シートの指定フィールドにドロップダウン入力規則を設定する（内部関数）
 *
 * @param {SpreadsheetApp.Spreadsheet} ss
 * @param {string} sheetName
 * @param {string[]} headers - SHEET_HEADERS のヘッダー配列
 * @param {string} fieldName - 対象フィールド名
 * @param {string[]} values - ドロップダウン選択肢
 */
function _setColumnDropdown(ss, sheetName, headers, fieldName, values) {
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) return;

  var colIndex = headers.indexOf(fieldName);
  if (colIndex === -1) {
    Logger.log('  [WARN] フィールドが見つかりません: ' + sheetName + '.' + fieldName);
    return;
  }

  var colNum = colIndex + 1;
  var range = sheet.getRange(2, colNum, 999, 1);
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(values, true)
    .setAllowInvalid(false)
    .build();
  range.setDataValidation(rule);
}
