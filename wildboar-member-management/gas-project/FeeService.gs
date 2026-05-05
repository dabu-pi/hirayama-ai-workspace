/**
 * ワイルドボア会員管理システム — 初回費用計算サービス
 *
 * 初回費用（入会金・カードキー発行料・日割り月会費・翌月月会費）の計算を担当する。
 * 金額はすべて MembershipPlans シートまたは Settings / FeeRules シートから取得する。
 * コードに金額をハードコードしない。
 *
 * 依存：Config.gs, SheetService.gs
 */

// =============================================================================
// 公開関数（google.script.run から呼ぶ）
// =============================================================================

/**
 * 初回費用を計算する
 *
 * @param {string} planId       - コースID
 * @param {string} joinDateStr  - 入会日（YYYY-MM-DD）
 * @returns {Object} 初回費用の内訳と合計
 */
function calcInitialFee(planId, joinDateStr) {
  try {
    var d = new Date(joinDateStr);
    var year  = d.getFullYear();
    var month = d.getMonth() + 1; // 1-based

    var monthlyFee    = getMonthlyFee(planId);
    var enrollmentFee = getEnrollmentFee(planId);
    var cardKeyFeeAmt = getCardKeyFee();

    // FeeRules から設定を取得（取得失敗時はデフォルト値）
    var proratingEnabled  = getFeeRule('prorating_enabled')    !== 'FALSE';
    var proratingRounding = getFeeRule('prorating_rounding')   || 'floor';
    var prepayNextMonth   = getFeeRule('prepay_next_month')    !== 'FALSE';
    var joinFeeEnabled    = getFeeRule('join_fee_enabled')     !== 'FALSE';
    var cardKeyFeeEnabled = getFeeRule('card_key_fee_enabled') !== 'FALSE';

    var actualEnrollmentFee = joinFeeEnabled    ? enrollmentFee : 0;
    var actualCardKeyFee    = cardKeyFeeEnabled ? cardKeyFeeAmt : 0;

    // 日割り計算
    var daysInMonth   = getDaysInMonth(year, month);
    var remainingDays = getRemainingDays(joinDateStr);
    var proratedFee   = proratingEnabled
      ? applyRounding(monthlyFee * remainingDays / daysInMonth, proratingRounding)
      : monthlyFee;

    // 翌月
    var nextYear     = month === 12 ? year + 1 : year;
    var nextMonth    = month === 12 ? 1 : month + 1;
    var nextMonthFee = prepayNextMonth ? monthlyFee : 0;

    var total = actualEnrollmentFee + actualCardKeyFee + proratedFee + nextMonthFee;

    return {
      enrollmentFee:      actualEnrollmentFee,
      cardKeyFee:         actualCardKeyFee,
      proratedMonthlyFee: proratedFee,
      nextMonthFee:       nextMonthFee,
      total:              total,
      breakdown: {
        daysInMonth:    daysInMonth,
        remainingDays:  remainingDays,
        joinMonth:      year + '-' + _pad2(month),
        nextMonth:      nextYear + '-' + _pad2(nextMonth),
        monthlyFee:     monthlyFee,
        roundingMethod: proratingRounding,
      },
    };
  } catch (e) {
    Logger.log('[calcInitialFee] エラー: ' + e.message);
    throw e;
  }
}

// =============================================================================
// 内部ユーティリティ
// =============================================================================

/**
 * 指定月の日数を取得する（うるう年対応）
 *
 * @param {number} year  - 年
 * @param {number} month - 月（1〜12）
 * @returns {number} 当月の日数
 */
function getDaysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

/**
 * 入会日から月末までの残日数（入会日を1日目として数える）
 *
 * @param {string} joinDateStr - YYYY-MM-DD
 * @returns {number}
 */
function getRemainingDays(joinDateStr) {
  var d     = new Date(joinDateStr);
  var year  = d.getFullYear();
  var month = d.getMonth() + 1;
  var day   = d.getDate();
  return getDaysInMonth(year, month) - day + 1;
}

/**
 * 端数処理を行う
 *
 * @param {number} value    - 端数処理する金額
 * @param {string} rounding - 'floor' | 'ceil' | 'round'
 * @returns {number}
 */
function applyRounding(value, rounding) {
  switch (rounding) {
    case 'floor': return Math.floor(value);
    case 'ceil':  return Math.ceil(value);
    case 'round': return Math.round(value);
    default:      return Math.floor(value);
  }
}

/**
 * コースIDから月会費を取得する
 *
 * @param {string} planId
 * @returns {number}
 */
function getMonthlyFee(planId) {
  var plan = findRowByKey(SHEET_NAMES.MEMBERSHIP_PLANS, 'plan_id', planId);
  if (!plan) throw new Error('コースが見つかりません: ' + planId);
  return Number(plan.monthly_fee) || 0;
}

/**
 * コースIDから入会金を取得する
 *
 * @param {string} planId
 * @returns {number}
 */
function getEnrollmentFee(planId) {
  var plan = findRowByKey(SHEET_NAMES.MEMBERSHIP_PLANS, 'plan_id', planId);
  if (!plan) throw new Error('コースが見つかりません: ' + planId);
  return Number(plan.enrollment_fee) || 0;
}

/**
 * カードキー発行料を取得する（Settings シート・全コース共通）
 *
 * @returns {number}
 */
function getCardKeyFee() {
  try {
    return Number(getSetting('card_key_issue_fee')) || 0;
  } catch (e) {
    return 0;
  }
}

/**
 * FeeRules から指定キーのルール値を取得する
 *
 * @param {string} ruleKey
 * @returns {string|null}
 */
function getFeeRule(ruleKey) {
  try {
    var rule = findRowByKey(SHEET_NAMES.FEE_RULES, 'rule_key', ruleKey);
    return rule ? String(rule.rule_value) : null;
  } catch (e) {
    return null;
  }
}

/** 2桁ゼロ埋め */
function _pad2(n) {
  return n < 10 ? '0' + n : String(n);
}
