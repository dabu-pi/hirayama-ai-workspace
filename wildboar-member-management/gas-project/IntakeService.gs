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
// Phase 3 実装
// =============================================================================

/**
 * 申込一覧を取得する（スタッフ画面 member-list.html から呼ぶ）
 *
 * @param {string} [reviewStatus] - 'pending' | 'approved' | 'rejected' | 省略で全件
 * @returns {Object[]} 申込サマリーの配列（新しい順）
 */
function getIntakeApplications(reviewStatus) {
  try {
    var data  = getSheetData(SHEET_NAMES.INTAKE_APPLICATIONS);
    var plans = getSheetData(SHEET_NAMES.MEMBERSHIP_PLANS);

    // plan_id → plan_name のマップ
    var planMap = {};
    plans.forEach(function(p) { planMap[String(p.plan_id)] = String(p.plan_name); });

    var list = (reviewStatus && reviewStatus !== 'all')
      ? data.filter(function(a) { return String(a.review_status) === reviewStatus; })
      : data;

    return list
      .sort(function(a, b) {
        return new Date(b.application_date).getTime() - new Date(a.application_date).getTime();
      })
      .map(function(a) {
        return {
          application_id:     String(a.application_id),
          application_date:   String(a.application_date),
          family_name:        String(a.family_name),
          given_name:         String(a.given_name),
          plan_id:            String(a.plan_id),
          plan_name:          planMap[String(a.plan_id)] || String(a.plan_id),
          review_status:      String(a.review_status),
          reviewed_at:        String(a.reviewed_at || ''),
          assigned_member_id: String(a.assigned_member_id || ''),
        };
      });
  } catch (e) {
    Logger.log('[getIntakeApplications] エラー: ' + e.message);
    throw e;
  }
}

/**
 * 申込IDで申込データを取得する（スタッフ画面 member-detail.html から呼ぶ）
 *
 * @param {string} applicationId - 申込ID
 * @returns {Object|null} 申込オブジェクト（_rowIndex を除く）
 */
function getIntakeApplicationById(applicationId) {
  try {
    var app = findRowByKey(SHEET_NAMES.INTAKE_APPLICATIONS, 'application_id', applicationId);
    if (!app) return null;

    // _rowIndex を除去して返す（GAS → フロントエンド間のシリアライズ対策）
    var result = {};
    Object.keys(app).forEach(function(k) {
      if (k !== '_rowIndex') result[k] = app[k];
    });
    return result;
  } catch (e) {
    Logger.log('[getIntakeApplicationById] エラー: ' + e.message);
    throw e;
  }
}

/**
 * 申込を承認して会員登録する（スタッフ画面から呼ぶ）
 *
 * 処理フロー:
 *   1. 申込取得・ステータス確認
 *   2. createMember() → Members 追加 + KeyCards 更新
 *   3. Payments 初回費用記録
 *   4. IntakeApplications を approved に更新
 *   5. AuditLog 記録
 *
 * @param {string} applicationId
 * @param {Object} staffData
 * @param {string} staffData.memberId        - 確定した会員番号
 * @param {string} staffData.keyCardNumber   - 選択した鍵番号
 * @param {string} staffData.planId          - 確定コースID
 * @param {string} staffData.joinDate        - 入会日（YYYY-MM-DD）
 * @param {string} [staffData.paymentMethod] - 支払い方法（cash / bank_transfer）
 * @param {string} [staffData.staffNotes]    - スタッフメモ
 * @returns {{ success: boolean, member_id?: string, message?: string }}
 */
function approveIntakeApplication(applicationId, staffData) {
  try {
    // 1. 申込取得・ステータス確認
    var app = findRowByKey(SHEET_NAMES.INTAKE_APPLICATIONS, 'application_id', applicationId);
    if (!app) return { success: false, message: '申込が見つかりません: ' + applicationId };
    if (String(app.review_status) !== REVIEW_STATUS.PENDING) {
      return { success: false, message: 'この申込はすでに処理済みです' };
    }

    // staffData バリデーション
    if (!staffData.memberId)      return { success: false, message: '会員番号を入力してください' };
    if (!staffData.keyCardNumber) return { success: false, message: '鍵番号を選択してください' };
    if (!staffData.planId)        return { success: false, message: 'コースを選択してください' };
    if (!staffData.joinDate)      return { success: false, message: '入会日を入力してください' };

    var now      = new Date().toISOString();
    var operator = getCurrentOperator();

    // 2. 会員登録（Members + KeyCards）
    createMember(
      applicationId,
      staffData.memberId,
      staffData.keyCardNumber,
      staffData.planId,
      staffData.joinDate,
      staffData.staffNotes || '',
      operator
    );

    // 3. 初回費用の記録（Payments）
    try {
      var feeResult = calcInitialFee(staffData.planId, staffData.joinDate);
      var paymentId = 'PAY-' + Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyyMMdd')
                    + '-' + generateId().slice(0, 8).toUpperCase();
      appendRow(SHEET_NAMES.PAYMENTS, {
        payment_id:     paymentId,
        member_id:      staffData.memberId,
        payment_type:   PAYMENT_TYPE.INITIAL,
        amount:         feeResult.total,
        payment_method: staffData.paymentMethod || PAYMENT_METHOD.CASH,
        payment_date:   staffData.joinDate,
        target_month:   staffData.joinDate.slice(0, 7),
        notes: [
          '入会金: ' + feeResult.enrollmentFee + '円',
          'カードキー: ' + feeResult.cardKeyFee + '円',
          '日割り(' + feeResult.breakdown.remainingDays + '日): ' + feeResult.proratedMonthlyFee + '円',
          '翌月(' + feeResult.breakdown.nextMonth + '): ' + feeResult.nextMonthFee + '円',
        ].join(' / '),
        created_at: now,
        created_by: operator,
      });
    } catch (feeErr) {
      // 費用記録失敗は警告のみ（会員登録は完了しているため続行）
      Logger.log('[approveIntakeApplication] Payments 記録失敗（続行）: ' + feeErr.message);
    }

    // 4. IntakeApplications ステータス更新
    updateRowByKey(SHEET_NAMES.INTAKE_APPLICATIONS, 'application_id', applicationId, {
      review_status:            REVIEW_STATUS.APPROVED,
      reviewed_by:              operator,
      reviewed_at:              now,
      assigned_member_id:       staffData.memberId,
      assigned_key_card_number: staffData.keyCardNumber,
      updated_at:               now,
    });

    // 5. AuditLog
    log({
      action:      LOG_ACTION.APPROVE,
      targetSheet: SHEET_NAMES.INTAKE_APPLICATIONS,
      targetId:    applicationId,
      newValue:    staffData.memberId,
      description: '入会申込承認 → 会員登録: ' + staffData.memberId,
    });

    Logger.log('[approveIntakeApplication] 承認完了: ' + applicationId + ' → ' + staffData.memberId);
    return { success: true, member_id: staffData.memberId };

  } catch (e) {
    Logger.log('[approveIntakeApplication] エラー: ' + e.message);
    return { success: false, message: 'システムエラー: ' + e.message };
  }
}

/**
 * 申込を差し戻す（スタッフ画面から呼ぶ）
 *
 * @param {string} applicationId
 * @param {string} reason - 差し戻し理由
 * @returns {{ success: boolean, message?: string }}
 */
function rejectIntakeApplication(applicationId, reason) {
  try {
    var app = findRowByKey(SHEET_NAMES.INTAKE_APPLICATIONS, 'application_id', applicationId);
    if (!app) return { success: false, message: '申込が見つかりません' };
    if (String(app.review_status) !== REVIEW_STATUS.PENDING) {
      return { success: false, message: 'この申込はすでに処理済みです' };
    }

    var now      = new Date().toISOString();
    var operator = getCurrentOperator();

    updateRowByKey(SHEET_NAMES.INTAKE_APPLICATIONS, 'application_id', applicationId, {
      review_status:    REVIEW_STATUS.REJECTED,
      rejection_reason: reason || '',
      reviewed_by:      operator,
      reviewed_at:      now,
      updated_at:       now,
    });

    log({
      action:      LOG_ACTION.REJECT,
      targetSheet: SHEET_NAMES.INTAKE_APPLICATIONS,
      targetId:    applicationId,
      description: '入会申込差し戻し: ' + (reason || '理由未記入'),
    });

    Logger.log('[rejectIntakeApplication] 差し戻し完了: ' + applicationId);
    return { success: true };

  } catch (e) {
    Logger.log('[rejectIntakeApplication] エラー: ' + e.message);
    return { success: false, message: 'システムエラー: ' + e.message };
  }
}
