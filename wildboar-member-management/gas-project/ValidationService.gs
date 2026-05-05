/**
 * ワイルドボア会員管理システム — 入力バリデーションサービス
 *
 * フロントエンドとバックエンド両方から呼ばれる。
 * 依存：Config.gs
 */

// =============================================================================
// 入会フォーム全体バリデーション
// =============================================================================

/**
 * 入会申込フォームの全入力をバリデーションする
 *
 * @param {Object} formData
 * @returns {{ isValid: boolean, errors: Object }}
 */
function validateIntakeForm(formData) {
  var errors = {};

  // --- 基本情報 ---
  if (!validateName(formData.family_name))
    errors.family_name = '氏名（姓）を入力してください';
  if (!validateName(formData.given_name))
    errors.given_name = '氏名（名）を入力してください';
  if (!validateKana(formData.family_name_kana))
    errors.family_name_kana = 'フリガナ（セイ）を全角カタカナで入力してください';
  if (!validateKana(formData.given_name_kana))
    errors.given_name_kana = 'フリガナ（メイ）を全角カタカナで入力してください';
  if (!validateBirthDate(formData.birth_date))
    errors.birth_date = '正しい生年月日を入力してください';
  if (!formData.gender || ['male', 'female', 'other'].indexOf(String(formData.gender)) === -1)
    errors.gender = '性別を選択してください';

  // --- 住所 ---
  if (!validatePostalCode(formData.postal_code))
    errors.postal_code = '郵便番号を7桁で入力してください';
  if (!formData.prefecture || String(formData.prefecture).trim().length === 0)
    errors.prefecture = '都道府県を選択してください';
  if (!formData.city || String(formData.city).trim().length === 0)
    errors.city = '市区町村を入力してください';
  if (!formData.address1 || String(formData.address1).trim().length === 0)
    errors.address1 = '番地を入力してください';

  // --- 連絡先 ---
  if (!validateMobilePhone(formData.phone_mobile))
    errors.phone_mobile = '携帯電話番号を正しく入力してください（例：09012345678）';
  if (!validatePhone(formData.phone_home))
    errors.phone_home = '自宅電話番号の形式が正しくありません';
  if (!validateEmail(formData.email))
    errors.email = 'メールアドレスの形式が正しくありません';

  // --- 緊急連絡先 ---
  if (!formData.emergency_contact_name || String(formData.emergency_contact_name).trim().length === 0)
    errors.emergency_contact_name = '緊急連絡先の氏名を入力してください';
  if (!formData.emergency_contact_relation)
    errors.emergency_contact_relation = '続柄を選択してください';
  var emgPhone = String(formData.emergency_contact_phone || '').trim();
  if (!emgPhone) {
    errors.emergency_contact_phone = '緊急連絡先の電話番号を入力してください';
  } else if (!validatePhone(emgPhone)) {
    errors.emergency_contact_phone = '緊急連絡先の電話番号の形式が正しくありません';
  }

  // --- コース・同意 ---
  if (!formData.plan_id)
    errors.plan_id = 'ご希望のコースを選択してください';
  if (!formData.privacy_agreed)
    errors.privacy_agreed = 'プライバシーポリシーへの同意が必要です';

  return {
    isValid: Object.keys(errors).length === 0,
    errors: errors,
  };
}

// =============================================================================
// 個別バリデーター
// =============================================================================

/**
 * 氏名（必須・1〜20文字）
 *
 * @param {string} value
 * @returns {boolean}
 */
function validateName(value) {
  if (!value || String(value).trim().length === 0) return false;
  if (String(value).length > 20) return false;
  return true;
}

/**
 * フリガナ（全角カタカナ必須）
 *
 * @param {string} value
 * @returns {boolean}
 */
function validateKana(value) {
  if (!value || String(value).trim().length === 0) return false;
  return /^[ァ-ヶーｦ-ﾟ\s　]+$/.test(String(value).trim());
}

/**
 * 郵便番号（ハイフンなし7桁）
 *
 * @param {string} value
 * @returns {boolean}
 */
function validatePostalCode(value) {
  if (!value) return false;
  return /^\d{7}$/.test(String(value).replace(/-/g, ''));
}

/**
 * 携帯電話番号（070/080/090 始まり11桁）
 *
 * @param {string} value
 * @returns {boolean}
 */
function validateMobilePhone(value) {
  if (!value) return false;
  var normalized = String(value).replace(/-/g, '');
  return /^(070|080|090)\d{8}$/.test(normalized);
}

/**
 * 電話番号（任意項目・空欄は OK・10〜11桁）
 *
 * @param {string} value
 * @returns {boolean}
 */
function validatePhone(value) {
  if (!value || String(value).trim().length === 0) return true;
  var normalized = String(value).replace(/-/g, '');
  return /^\d{10,11}$/.test(normalized);
}

/**
 * メールアドレス（任意項目・空欄は OK）
 *
 * @param {string} value
 * @returns {boolean}
 */
function validateEmail(value) {
  if (!value || String(value).trim().length === 0) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
}

/**
 * 生年月日（有効な過去の日付）
 *
 * @param {string} value - YYYY-MM-DD 形式
 * @returns {boolean}
 */
function validateBirthDate(value) {
  if (!value) return false;
  var d = new Date(String(value));
  if (isNaN(d.getTime())) return false;
  return d < new Date();
}

/**
 * 会員番号（Phase 3 で詳細実装予定）
 *
 * @param {string} value
 * @returns {boolean}
 */
function validateMemberId(value) {
  if (!value) return false;
  return true;
}
