/**
 * ワイルドボア会員管理システム — ステータス変更処理サービス
 *
 * 会員の休会・退会・再開処理を担当する。
 * すべてのステータス変更はStatusHistoryシートに記録する。
 *
 * 依存：Config.gs, SheetService.gs, AuditLogService.gs
 */

/**
 * 休会処理を行う
 *
 * Membersシートのステータスをpauseに変更し、
 * StatusHistoryに記録する。
 *
 * @param {string} memberId - 会員番号
 * @param {Object} pauseData - 休会データ
 * @param {Date} pauseData.startDate - 休会開始日
 * @param {Date} [pauseData.endDate] - 休会終了予定日（未定の場合はnull）
 * @param {string} [pauseData.reason] - 休会理由
 * @param {string} pauseData.keyCardAction - 鍵の扱い（'return'または'keep'）
 * @param {string} [pauseData.notes] - スタッフメモ
 * @returns {Object} 処理結果
 */
function processPause(memberId, pauseData) {
  // TODO: Phase 5 で実装する
  // 1. getMemberById でメンバーを取得し、statusがactiveであることを確認する
  // 2. StatusHistoryに記録する（change_type: 'pause'）
  // 3. Membersシートのstatusをpauseに更新する
  // 4. keyCardActionが'return'の場合、KeyCardsシートを更新する
  // 5. AuditLogService.log でログを記録する
  throw new Error('未実装: StatusService.processPause');
}

/**
 * 退会処理を行う
 *
 * Membersシートのステータスをwithdrawnに変更し、
 * StatusHistoryに記録する。
 *
 * @param {string} memberId - 会員番号
 * @param {Object} withdrawalData - 退会データ
 * @param {Date} withdrawalData.withdrawalDate - 退会日
 * @param {string} [withdrawalData.reason] - 退会理由
 * @param {boolean} withdrawalData.keyReturned - 鍵返却確認
 * @param {string} [withdrawalData.notes] - スタッフメモ
 * @returns {Object} 処理結果
 */
function processWithdrawal(memberId, withdrawalData) {
  // TODO: Phase 5 で実装する
  // 1. getMemberById でメンバーを取得し、statusがactive/pauseであることを確認する
  // 2. StatusHistoryに記録する（change_type: 'withdraw'）
  // 3. Membersシートのstatusをwithdrawnに更新する
  // 4. 鍵を返却した場合、KeyCardsシートのstatusをavailableに更新する
  // 5. AuditLogService.log でログを記録する
  throw new Error('未実装: StatusService.processWithdrawal');
}

/**
 * 再開処理を行う
 *
 * Membersシートのステータスをactiveに変更し、
 * StatusHistoryに記録する。
 *
 * @param {string} memberId - 会員番号
 * @param {Object} restartData - 再開データ
 * @param {Date} restartData.restartDate - 再開日
 * @param {string} restartData.keyCardAction - 鍵の扱い（'same'または'new'）
 * @param {string} [restartData.newKeyCardNumber] - 新しい鍵番号（keyCardAction='new'の場合）
 * @param {string} [restartData.notes] - スタッフメモ
 * @returns {Object} 処理結果
 */
function processRestart(memberId, restartData) {
  // TODO: Phase 5 で実装する
  // 1. getMemberById でメンバーを取得し、statusがpauseであることを確認する
  // 2. StatusHistoryに記録する（change_type: 'restart'）
  // 3. Membersシートのstatusをactiveに更新する
  // 4. keyCardActionが'new'の場合、新しいKeyCardを割り当てる
  // 5. AuditLogService.log でログを記録する
  throw new Error('未実装: StatusService.processRestart');
}

/**
 * StatusHistoryシートに変更記録を追加する
 *
 * @param {Object} historyData - 履歴データ
 * @param {string} historyData.memberId - 会員番号
 * @param {string} historyData.changeType - 変更種別（CHANGE_TYPE参照）
 * @param {string} historyData.statusBefore - 変更前ステータス
 * @param {string} historyData.statusAfter - 変更後ステータス
 * @param {Date} historyData.effectiveDate - 適用日
 * @param {Date} [historyData.endDate] - 終了予定日
 * @param {string} [historyData.reason] - 理由
 * @param {string} [historyData.notes] - メモ
 * @returns {string} 記録された履歴ID
 */
function addStatusHistory(historyData) {
  // TODO: Phase 5 で実装する
  throw new Error('未実装: StatusService.addStatusHistory');
}

/**
 * 会員のステータス変更履歴を取得する
 *
 * @param {string} memberId - 会員番号
 * @returns {Object[]} ステータス変更履歴の配列（新しい順）
 */
function getStatusHistoryByMemberId(memberId) {
  // TODO: Phase 5 で実装する
  throw new Error('未実装: StatusService.getStatusHistoryByMemberId');
}

/**
 * 最長休会期間を超過した会員を取得する
 *
 * Settingsシートのpause_max_monthsを参照する。
 *
 * @returns {Object[]} 最長休会期間超過会員の配列
 */
function getOverduePausedMembers() {
  // TODO: Phase 5 で実装する
  // 現在の日付と休会開始日を比較し、pause_max_monthsを超えた会員を返す
  throw new Error('未実装: StatusService.getOverduePausedMembers');
}
