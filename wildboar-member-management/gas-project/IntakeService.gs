/**
 * ワイルドボア会員管理システム — 入会申込処理サービス
 *
 * 依存：Config.gs, SheetService.gs, ValidationService.gs
 */

// =============================================================================
// フロントエンド向け公開関数
// =============================================================================

/**
 * アクティブなコース一覧を返す（intake-form.html から google.script.run で呼ぶ）
 *
 * @returns {Object[]} コースオブジェクトの配列
 */
function getMembershipPlans() {
  try {
    var data = getSheetData(SHEET_NAMES.MEMBERSHIP_PLANS);
    return data
      .filter(function(p) { return String(p.is_active).toUpperCase() === 'TRUE'; })
      .sort(function(a, b) {
        return (Number(a.display_order) || 99) - (Number(b.display_order) || 99);
      })
      .map(function(p) {
        return {
          plan_id:        String(p.plan_id),
          plan_name:      String(p.plan_name),
          monthly_fee:    Number(p.monthly_fee) || 0,
          enrollment_fee: Number(p.enrollment_fee) || 0,
          card_key_fee:   Number(p.card_key_fee) || 0,
          description:    String(p.description || ''),
        };
      });
  } catch (e) {
    Logger.log('[getMembershipPlans] エラー: ' + e.message);
    throw e;
  }
}

/**
 * 入会申込データを保存する（intake-form.html から google.script.run で呼ぶ）
 *
 * @param {Object} formData - フォームから送信されたデータ
 * @returns {Object} { success: boolean, application_id?: string, message?: string }
 */
function saveIntakeApplication(formData) {
  try {
    // 1. サーバーサイドバリデーション（フロントをすり抜けた不正送信対策）
    var validation = validateIntakeForm(formData);
    if (!validation.isValid) {
      return { success: false, errors: validation.errors, message: '入力内容にエラーがあります。' };
    }

    // 2. 採番
    var applicationId = generateApplicationId();
    var now = new Date().toISOString();

    // 3. 保存（個人情報はログに出力しない）
    Logger.log('[saveIntakeApplication] 保存開始: ' + applicationId);

    var rowData = {
      application_id:             applicationId,
      application_date:           now,
      family_name:                String(formData.family_name || '').trim(),
      given_name:                 String(formData.given_name || '').trim(),
      family_name_kana:           String(formData.family_name_kana || '').trim(),
      given_name_kana:            String(formData.given_name_kana || '').trim(),
      birth_date:                 String(formData.birth_date || ''),
      gender:                     String(formData.gender || ''),
      postal_code:                String(formData.postal_code || '').replace(/-/g, ''),
      prefecture:                 String(formData.prefecture || ''),
      city:                       String(formData.city || '').trim(),
      address1:                   String(formData.address1 || '').trim(),
      address2:                   String(formData.address2 || '').trim(),
      phone_home:                 String(formData.phone_home || '').replace(/-/g, ''),
      phone_mobile:               String(formData.phone_mobile || '').replace(/-/g, ''),
      email:                      String(formData.email || '').trim().toLowerCase(),
      emergency_contact_name:     String(formData.emergency_contact_name || '').trim(),
      emergency_contact_relation: String(formData.emergency_contact_relation || ''),
      emergency_contact_phone:    String(formData.emergency_contact_phone || '').replace(/-/g, ''),
      occupation:                 String(formData.occupation || '').trim(),
      plan_id:                    String(formData.plan_id || ''),
      referrer_member_id:         String(formData.referrer_member_id || '').trim(),
      notes:                      String(formData.notes || '').trim(),
      privacy_agreed:             formData.privacy_agreed ? 'TRUE' : 'FALSE',
      review_status:              'pending',
      reviewed_by:                '',
      reviewed_at:                '',
      assigned_member_id:         '',
      assigned_key_card_number:   '',
      rejection_reason:           '',
      created_at:                 now,
      updated_at:                 now,
    };

    appendRow(SHEET_NAMES.INTAKE_APPLICATIONS, rowData);
    Logger.log('[saveIntakeApplication] 保存完了: ' + applicationId);

    return { success: true, application_id: applicationId };

  } catch (e) {
    Logger.log('[saveIntakeApplication] エラー: ' + e.message);
    return { success: false, message: 'システムエラーが発生しました。スタッフにお声がけください。' };
  }
}

// =============================================================================
// 内部関数
// =============================================================================

/**
 * 申込IDを採番する
 *
 * フォーマット：APP-YYYYMMDD-XXXX（XXXXは当日の連番、4桁ゼロ埋め）
 *
 * @returns {string} 新しい申込ID
 */
function generateApplicationId() {
  var today = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd');
  var prefix = 'APP-' + today + '-';

  var ss = getSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAMES.INTAKE_APPLICATIONS);

  if (!sheet || sheet.getLastRow() < 2) {
    return prefix + '0001';
  }

  var ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
  var todaySeqs = ids
    .map(function(r) { return String(r[0]); })
    .filter(function(id) { return id.indexOf(prefix) === 0; })
    .map(function(id) { return parseInt(id.slice(prefix.length), 10) || 0; });

  var maxSeq = todaySeqs.length > 0 ? Math.max.apply(null, todaySeqs) : 0;
  var seq = String(maxSeq + 1);
  while (seq.length < 4) seq = '0' + seq;
  return prefix + seq;
}

// =============================================================================
// Phase 3 以降で実装するスタブ
// =============================================================================

/**
 * 申込一覧を取得する（Phase 3 で実装）
 *
 * @param {string} [reviewStatus] - フィルタするステータス（省略時は全件）
 * @returns {Object[]} 申込オブジェクトの配列
 */
function getIntakeApplications(reviewStatus) {
  throw new Error('未実装: IntakeService.getIntakeApplications（Phase 3 で実装）');
}

/**
 * 申込IDで申込データを取得する（Phase 3 で実装）
 *
 * @param {string} applicationId - 申込ID
 * @returns {Object|null}
 */
function getIntakeApplicationById(applicationId) {
  throw new Error('未実装: IntakeService.getIntakeApplicationById（Phase 3 で実装）');
}

/**
 * 申込を承認して会員登録する（Phase 3 で実装）
 *
 * @param {string} applicationId
 * @param {Object} staffData
 * @returns {Object}
 */
function approveIntakeApplication(applicationId, staffData) {
  throw new Error('未実装: IntakeService.approveIntakeApplication（Phase 3 で実装）');
}

/**
 * 申込を却下する（Phase 3 で実装）
 *
 * @param {string} applicationId
 * @param {string} reason
 * @returns {boolean}
 */
function rejectIntakeApplication(applicationId, reason) {
  throw new Error('未実装: IntakeService.rejectIntakeApplication（Phase 3 で実装）');
}
