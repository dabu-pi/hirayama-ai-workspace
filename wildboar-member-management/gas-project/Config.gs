/**
 * ワイルドボア会員管理システム — 設定定数
 *
 * スプレッドシートID・シート名・その他定数を管理する。
 * 金額・料金はこのファイルにハードコードせず、Settingsシートから取得すること。
 *
 * 注意：本番スプレッドシートIDはこのファイル（GitHubに公開）に書かない。
 *      ローカルの設定ファイルまたはGASのプロパティサービスを使うこと。
 */

/**
 * スプレッドシートIDを取得する
 *
 * PropertiesServiceに設定がある場合はそちらを使い、
 * なければハードコードされたIDを使う（開発・テスト用）。
 *
 * 本番運用では Script Properties に SPREADSHEET_ID を設定すること：
 *   GASエディタ → プロジェクト設定 → スクリプトプロパティ → SPREADSHEET_ID = <ID>
 *
 * @returns {string} スプレッドシートID
 */
function getSpreadsheetId() {
  var props = PropertiesService.getScriptProperties();
  return props.getProperty('SPREADSHEET_ID') || 'YOUR_SPREADSHEET_ID_HERE';
}

/**
 * シート名の定数
 * シート名を変更する場合はここだけ修正すれば全体に反映される
 */
var SHEET_NAMES = {
  MEMBERS:              'Members',          // 会員マスタ
  INTAKE_APPLICATIONS:  'IntakeApplications', // 入会申込
  MEMBERSHIP_PLANS:     'MembershipPlans',  // コースマスタ
  FEE_RULES:            'FeeRules',         // 料金ルール
  PAYMENTS:             'Payments',         // 支払い記録
  STATUS_HISTORY:       'StatusHistory',    // ステータス変更履歴
  KEY_CARDS:            'KeyCards',         // 鍵番号管理
  REFERRALS:            'Referrals',        // 紹介者管理
  BILLING_EXPORTS:      'BillingExports',   // 集金代行データ
  AUDIT_LOGS:           'AuditLogs',        // 操作ログ
  SETTINGS:             'Settings',         // システム設定
};

/**
 * 会員ステータスの定数
 */
var MEMBER_STATUS = {
  ACTIVE:    'active',    // 在籍中
  PAUSE:     'pause',     // 休会中
  WITHDRAWN: 'withdrawn', // 退会済み
};

/**
 * 申込確認ステータスの定数
 */
var REVIEW_STATUS = {
  PENDING:  'pending',  // 確認待ち
  APPROVED: 'approved', // 承認済み
  REJECTED: 'rejected', // 却下
};

/**
 * 鍵カードステータスの定数
 */
var KEY_CARD_STATUS = {
  IN_USE:    'in_use',    // 使用中
  AVAILABLE: 'available', // 空き（使用可能）
  LOST:      'lost',      // 紛失
  DAMAGED:   'damaged',   // 破損
};

/**
 * ステータス変更種別の定数
 */
var CHANGE_TYPE = {
  PAUSE:    'pause',    // 休会
  WITHDRAW: 'withdraw', // 退会
  RESTART:  'restart',  // 再開
};

/**
 * 支払い種別の定数
 */
var PAYMENT_TYPE = {
  INITIAL: 'initial', // 初回費用
  MONTHLY: 'monthly', // 月会費
  OTHER:   'other',   // その他
};

/**
 * 支払い方法の定数
 */
var PAYMENT_METHOD = {
  CASH:          'cash',          // 現金
  BANK_TRANSFER: 'bank_transfer', // 口座振替
};

/**
 * 操作ログのアクション種別
 */
var LOG_ACTION = {
  CREATE: 'create', // 新規作成
  UPDATE: 'update', // 更新
  DELETE: 'delete', // 削除
  VIEW:   'view',   // 閲覧
  EXPORT: 'export', // エクスポート
  APPROVE: 'approve', // 承認
  REJECT: 'reject', // 却下
};
