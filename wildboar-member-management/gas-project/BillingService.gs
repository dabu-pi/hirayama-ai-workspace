/**
 * ワイルドボア会員管理システム — 月会費・請求管理サービス
 *
 * 月会費の支払い記録・月別集計を担当する。
 * リコーリース集金代行のエクスポートはRicohLeaseService.gsが担当する。
 *
 * 依存：Config.gs, SheetService.gs, AuditLogService.gs
 */

/**
 * 支払い記録を追加する
 *
 * @param {Object} paymentData - 支払いデータ
 * @param {string} paymentData.memberId - 会員番号
 * @param {string} paymentData.paymentType - 支払い種別（PAYMENT_TYPE参照）
 * @param {Date} paymentData.paymentDate - 支払日
 * @param {number} paymentData.amount - 金額（円）
 * @param {Object} [paymentData.breakdown] - 内訳（初回費用の場合）
 * @param {string} paymentData.paymentMethod - 支払い方法（PAYMENT_METHOD参照）
 * @param {string} [paymentData.billingMonth] - 対象月（YYYY-MM形式）
 * @param {string} [paymentData.notes] - 備考
 * @returns {string} 追加された支払いID
 */
function addPayment(paymentData) {
  // TODO: Phase 6 で実装する
  // 1. payment_id を採番する
  // 2. Paymentsシートに行を追加する
  // 3. AuditLogService.log でログを記録する
  throw new Error('未実装: BillingService.addPayment');
}

/**
 * 会員の支払い履歴を取得する
 *
 * @param {string} memberId - 会員番号
 * @returns {Object[]} 支払い履歴の配列（新しい順）
 */
function getPaymentsByMemberId(memberId) {
  // TODO: Phase 6 で実装する
  throw new Error('未実装: BillingService.getPaymentsByMemberId');
}

/**
 * 月別の集金データを集計する
 *
 * @param {string} billingMonth - 対象月（YYYY-MM形式）
 * @returns {Object} 月別集計データ
 * @returns {number} result.totalAmount - 合計金額
 * @returns {number} result.memberCount - 対象会員数
 * @returns {Object[]} result.details - 会員別の詳細
 */
function getMonthlySummary(billingMonth) {
  // TODO: Phase 9 で実装する
  throw new Error('未実装: BillingService.getMonthlySummary');
}

/**
 * 特定月の振替対象会員リストを生成する
 *
 * ステータスが active の会員のみを対象とする。
 * 休会・退会会員は除外する。
 * StatusHistoryを参照して、対象月時点のステータスを正確に判定する。
 *
 * @param {string} billingMonth - 対象月（YYYY-MM形式）
 * @returns {Object[]} 振替対象会員の配列（会員情報と月会費を含む）
 */
function getBillingTargetMembers(billingMonth) {
  // TODO: Phase 7 で実装する
  // 1. 対象月の1日時点でactiveだった会員を取得する
  // 2. StatusHistoryを参照して月中のステータス変更を確認する
  // 3. 各会員の月会費をMembershipPlansから取得する
  // 4. 合計金額と会員リストを返す
  throw new Error('未実装: BillingService.getBillingTargetMembers');
}

/**
 * 月別の会員数推移を取得する
 *
 * @param {number} months - 過去何ヶ月分を取得するか
 * @returns {Object[]} 月別会員数の配列
 */
function getMemberCountTrend(months) {
  // TODO: Phase 9 で実装する
  throw new Error('未実装: BillingService.getMemberCountTrend');
}
