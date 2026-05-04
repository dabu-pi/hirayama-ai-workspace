/**
 * ワイルドボア会員管理システム — 入力バリデーションサービス
 *
 * フォームの入力値を検証する関数群。
 * フロントエンド（JavaScript）とバックエンド（GAS）の両方でバリデーションを行う。
 *
 * 依存：Config.gs
 */

/**
 * 入会申込フォームの全入力をバリデーションする
 *
 * @param {Object} formData - フォームデータ（IntakeService.saveIntakeApplicationの引数と同じ）
 * @returns {Object} バリデーション結果
 * @returns {boolean} result.isValid - バリデーション通過の場合true
 * @returns {Object} result.errors - エラーメッセージ（フィールド名: エラーメッセージ）
 */
function validateIntakeForm(formData) {
  // TODO: Phase 2 で実装する
  var errors = {};

  // 各フィールドのバリデーションを呼び出す
  // if (!validateFamilyName(formData.family_name)) errors.family_name = '氏名（姓）を入力してください';
  // if (!validateKana(formData.family_name_kana)) errors.family_name_kana = 'フリガナはカタカナで入力してください';
  // ... 以下同様

  return {
    isValid: Object.keys(errors).length === 0,
    errors: errors,
  };
}

/**
 * 氏名のバリデーション
 *
 * @param {string} value - 入力値
 * @returns {boolean} 有効な場合はtrue
 */
function validateName(value) {
  // TODO: Phase 2 で実装する
  // 空欄でないこと、最大20文字以内であることを確認する
  if (!value || value.trim().length === 0) return false;
  if (value.length > 20) return false;
  return true;
}

/**
 * フリガナ（全角カタカナ）のバリデーション
 *
 * @param {string} value - 入力値
 * @returns {boolean} 有効な場合はtrue
 */
function validateKana(value) {
  // TODO: Phase 2 で実装する
  // 全角カタカナのみであることを確認する
  // 正規表現：/^[ァ-ヶー\s]+$/
  if (!value || value.trim().length === 0) return false;
  return /^[ァ-ヶー\s]+$/.test(value);
}

/**
 * 郵便番号のバリデーション
 *
 * @param {string} value - 入力値（ハイフンなし7桁）
 * @returns {boolean} 有効な場合はtrue
 */
function validatePostalCode(value) {
  // TODO: Phase 2 で実装する
  // 7桁の数字であることを確認する
  if (!value) return false;
  return /^\d{7}$/.test(value.replace(/-/g, ''));
}

/**
 * 携帯電話番号のバリデーション
 *
 * @param {string} value - 入力値（ハイフンなし）
 * @returns {boolean} 有効な場合はtrue
 */
function validateMobilePhone(value) {
  // TODO: Phase 2 で実装する
  // 070/080/090で始まる11桁の数字であることを確認する
  if (!value) return false;
  var normalized = value.replace(/-/g, '');
  return /^(070|080|090)\d{8}$/.test(normalized);
}

/**
 * 電話番号（一般）のバリデーション
 *
 * @param {string} value - 入力値（ハイフンなし）
 * @returns {boolean} 有効な場合はtrue（空欄もtrue）
 */
function validatePhone(value) {
  // TODO: Phase 2 で実装する
  // 空欄は許可する（任意フィールド）
  if (!value || value.trim().length === 0) return true;
  var normalized = value.replace(/-/g, '');
  return /^\d{10,11}$/.test(normalized);
}

/**
 * メールアドレスのバリデーション
 *
 * @param {string} value - 入力値
 * @returns {boolean} 有効な場合はtrue（空欄もtrue）
 */
function validateEmail(value) {
  // TODO: Phase 2 で実装する
  // 空欄は許可する（任意フィールド）
  if (!value || value.trim().length === 0) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * 生年月日のバリデーション
 *
 * @param {string} value - 入力値（YYYY-MM-DD形式）
 * @returns {boolean} 有効な場合はtrue
 */
function validateBirthDate(value) {
  // TODO: Phase 2 で実装する
  // 有効な日付であること、過去の日付であることを確認する
  if (!value) return false;
  var date = new Date(value);
  if (isNaN(date.getTime())) return false;
  return date < new Date();
}

/**
 * 会員番号のバリデーション
 *
 * @param {string} value - 入力値
 * @returns {boolean} 有効な場合はtrue
 */
function validateMemberId(value) {
  // TODO: Phase 3 で実装する
  // Settingsシートのプレフィックス・桁数設定に合致することを確認する
  // また、Membersシートに既に同じ番号が存在しないことを確認する
  if (!value) return false;
  return true; // 詳細な実装はPhase 3で行う
}
