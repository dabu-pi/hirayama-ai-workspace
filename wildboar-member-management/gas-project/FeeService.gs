/**
 * ワイルドボア会員管理システム — 初回費用計算サービス
 *
 * 初回費用（入会金・カードキー発行料・日割り月会費・翌月月会費）の計算を担当する。
 * 金額はすべてSettingsシートまたはMembershipPlansシートから取得する。
 * コードに金額をハードコードしない。
 *
 * 依存：Config.gs, SheetService.gs
 */

/**
 * 初回費用を計算する
 *
 * @param {string} planId - コースID
 * @param {Date} joinDate - 入会日
 * @returns {Object} 初回費用の内訳と合計
 * @returns {number} result.enrollmentFee - 入会金
 * @returns {number} result.cardKeyFee - カードキー発行料
 * @returns {number} result.proratedMonthlyFee - 入会月の日割り月会費
 * @returns {number} result.nextMonthFee - 翌月の月会費
 * @returns {number} result.total - 合計
 * @returns {Object} result.breakdown - 計算の詳細（日数等）
 */
function calcInitialFee(planId, joinDate) {
  // TODO: Phase 3 または Phase 6 で実装する
  // 1. MembershipPlansシートからplanIdに対応するenrollment_fee, monthly_feeを取得する
  // 2. Settingsシートからcard_key_feeを取得する
  // 3. FeeRulesシートからprorating_roundingルールを取得する
  // 4. joinDateの月の日数を計算する
  // 5. 残日数を計算する（月末日 - joinDate + 1）
  // 6. 日割り月会費を計算する（monthly_fee * 残日数 / 当月日数）
  // 7. 端数処理を適用する
  // 8. 合計を計算して返す
  throw new Error('未実装: FeeService.calcInitialFee');
}

/**
 * 指定月の日数を取得する
 *
 * うるう年にも対応する。
 *
 * @param {number} year - 年（例：2026）
 * @param {number} month - 月（1〜12）
 * @returns {number} 当月の日数（28〜31）
 */
function getDaysInMonth(year, month) {
  // TODO: Phase 2 以降で実装する
  // new Date(year, month, 0).getDate() で取得できる
  throw new Error('未実装: FeeService.getDaysInMonth');
}

/**
 * 入会日から月末までの残日数を計算する
 *
 * 入会日を1日目として数える。
 *
 * @param {Date} joinDate - 入会日
 * @returns {number} 残日数
 */
function getRemainingDays(joinDate) {
  // TODO: Phase 2 以降で実装する
  // 月末日 - 入会日(日) + 1 で計算する
  throw new Error('未実装: FeeService.getRemainingDays');
}

/**
 * 端数処理を行う
 *
 * FeeRulesシートのprorating_roundingルールに従って処理する。
 *
 * @param {number} value - 端数処理する金額
 * @param {string} rounding - 端数処理方法（'floor', 'ceil', 'round'）
 * @returns {number} 端数処理後の金額
 */
function applyRounding(value, rounding) {
  // TODO: Phase 2 以降で実装する
  switch (rounding) {
    case 'floor': return Math.floor(value);
    case 'ceil':  return Math.ceil(value);
    case 'round': return Math.round(value);
    default: return Math.floor(value); // デフォルトは切り捨て
  }
}

/**
 * コースIDから月会費を取得する
 *
 * @param {string} planId - コースID
 * @returns {number} 月会費（円）
 */
function getMonthlyFee(planId) {
  // TODO: Phase 3 で実装する
  // SheetService でMembershipPlansシートを検索してmonthly_feeを返す
  throw new Error('未実装: FeeService.getMonthlyFee');
}

/**
 * コースIDから入会金を取得する
 *
 * @param {string} planId - コースID
 * @returns {number} 入会金（円）
 */
function getEnrollmentFee(planId) {
  // TODO: Phase 3 で実装する
  throw new Error('未実装: FeeService.getEnrollmentFee');
}

/**
 * カードキー発行料を取得する（全コース共通）
 *
 * @returns {number} カードキー発行料（円）
 */
function getCardKeyFee() {
  // TODO: Phase 3 で実装する
  // Settingsシートからcard_key_feeを取得する
  throw new Error('未実装: FeeService.getCardKeyFee');
}
