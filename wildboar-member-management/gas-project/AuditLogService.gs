/**
 * ワイルドボア会員管理システム — 操作ログ記録サービス
 *
 * すべての操作（会員情報変更・申込確認・ステータス変更等）を
 * AuditLogs シートに記録する。
 * ログ記録自体が失敗してもメイン処理を止めないようにする。
 *
 * 依存：Config.gs, SheetService.gs
 */

/**
 * 操作ログを記録する
 *
 * @param {Object} logData
 * @param {string} logData.action       - 操作種別（LOG_ACTION 参照）
 * @param {string} logData.targetSheet  - 対象シート名（SHEET_NAMES 参照）
 * @param {string} logData.targetId     - 対象レコードの主キー
 * @param {string} [logData.fieldName]  - 変更フィールド名
 * @param {string} [logData.oldValue]   - 変更前の値
 * @param {string} [logData.newValue]   - 変更後の値
 * @param {string} [logData.description]- 操作の説明
 * @returns {string} 記録されたログID（失敗時は空文字）
 */
function log(logData) {
  try {
    var logId    = generateLogId();
    var now      = new Date().toISOString();
    var operator = getCurrentOperator();

    appendRow(SHEET_NAMES.AUDIT_LOGS, {
      log_id:       logId,
      action:       String(logData.action       || ''),
      table_name:   String(logData.targetSheet  || ''),
      record_id:    String(logData.targetId     || ''),
      field_name:   String(logData.fieldName    || ''),
      old_value:    String(logData.oldValue     || ''),
      new_value:    String(logData.newValue     || ''),
      performed_by: operator,
      performed_at: now,
      notes:        String(logData.description  || ''),
    });

    return logId;
  } catch (e) {
    Logger.log('[AuditLogService.log] ログ記録失敗: ' + e.message);
    return '';
  }
}

/**
 * ログIDを採番する
 *
 * フォーマット：LOG-yyyyMMdd-XXXXX（当日連番・5桁）
 *
 * @returns {string}
 */
function generateLogId() {
  var today  = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd');
  var prefix = 'LOG-' + today + '-';

  var ss    = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.AUDIT_LOGS);
  if (!sheet || sheet.getLastRow() < 2) return prefix + '00001';

  var ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  var seqs = ids
    .map(function(r) { return String(r[0]); })
    .filter(function(id) { return id.indexOf(prefix) === 0; })
    .map(function(id) { return parseInt(id.slice(prefix.length), 10) || 0; });

  var maxSeq = seqs.length > 0 ? Math.max.apply(null, seqs) : 0;
  var seq = String(maxSeq + 1);
  while (seq.length < 5) seq = '0' + seq;
  return prefix + seq;
}

/**
 * 現在のセッションユーザー（スタッフ）のメールアドレスを取得する
 *
 * @returns {string} メールアドレス（取得不可時は 'staff'）
 */
function getCurrentOperator() {
  try {
    var email = Session.getActiveUser().getEmail();
    return email || 'staff';
  } catch (e) {
    return 'staff';
  }
}

/**
 * 操作ログを取得する（Phase 4 以降で実装）
 */
function getAuditLogs(targetSheet, targetId, limit) {
  throw new Error('未実装: AuditLogService.getAuditLogs（Phase 4 で実装）');
}
