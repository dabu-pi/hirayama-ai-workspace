/**
 * ワイルドボア会員管理システム — 入会申込処理サービス
 *
 * 入会申込フォームからの送信・保存・確認・承認・却下を担当する。
 *
 * 依存：Config.gs, SheetService.gs, MemberService.gs, AuditLogService.gs
 */

/**
 * 入会申込フォームのデータを保存する
 *
 * フォームから送信された申込データをIntakeApplicationsシートに保存する。
 * スタッフが確認するまでreview_status = pending で保存する。
 *
 * @param {Object} formData - フォームから送信されたデータオブジェクト
 * @param {string} formData.family_name - 氏名（姓）
 * @param {string} formData.given_name - 氏名（名）
 * @param {string} formData.family_name_kana - フリガナ（姓）
 * @param {string} formData.given_name_kana - フリガナ（名）
 * @param {string} formData.birth_date - 生年月日（YYYY-MM-DD形式）
 * @param {string} formData.gender - 性別（male/female/other）
 * @param {string} formData.postal_code - 郵便番号（7桁）
 * @param {string} formData.prefecture - 都道府県
 * @param {string} formData.city - 市区町村
 * @param {string} formData.address1 - 番地
 * @param {string} [formData.address2] - 建物名・部屋番号
 * @param {string} [formData.phone_home] - 自宅電話番号
 * @param {string} formData.phone_mobile - 携帯電話番号
 * @param {string} [formData.email] - メールアドレス
 * @param {string} formData.emergency_contact_name - 緊急連絡先氏名
 * @param {string} formData.emergency_contact_relation - 緊急連絡先続柄
 * @param {string} formData.emergency_contact_phone - 緊急連絡先電話番号
 * @param {string} [formData.occupation] - 職業
 * @param {string} formData.plan_id - 希望コースID
 * @param {string} [formData.referrer_member_id] - 紹介者会員番号
 * @param {string} [formData.notes] - 備考
 * @param {boolean} formData.privacy_agreed - プライバシーポリシー同意
 * @returns {Object} 保存結果（application_id を含む）
 */
function saveIntakeApplication(formData) {
  // TODO: Phase 2 で実装する
  // 1. ValidationService.validateIntakeForm(formData) でバリデーションする
  // 2. application_id を採番する
  // 3. IntakeApplicationsシートに行を追加する
  // 4. 受付番号を返す
  throw new Error('未実装: IntakeService.saveIntakeApplication');
}

/**
 * 申込一覧を取得する
 *
 * @param {string} [reviewStatus] - フィルタするステータス（省略時は全件）
 * @returns {Object[]} 申込オブジェクトの配列
 */
function getIntakeApplications(reviewStatus) {
  // TODO: Phase 3 で実装する
  throw new Error('未実装: IntakeService.getIntakeApplications');
}

/**
 * 申込IDで申込データを取得する
 *
 * @param {string} applicationId - 申込ID
 * @returns {Object|null} 申込オブジェクト、存在しない場合はnull
 */
function getIntakeApplicationById(applicationId) {
  // TODO: Phase 3 で実装する
  throw new Error('未実装: IntakeService.getIntakeApplicationById');
}

/**
 * 申込を承認して会員登録を完了する
 *
 * スタッフが確認画面で「正式登録する」を押したときに呼ばれる。
 *
 * @param {string} applicationId - 申込ID
 * @param {Object} staffData - スタッフが入力したデータ
 * @param {string} staffData.member_id - 割り当て会員番号
 * @param {string} staffData.key_card_number - 割り当て鍵番号
 * @param {string} staffData.plan_id - 確定コースID
 * @param {Date} staffData.join_date - 入会日
 * @param {string} [staffData.notes] - スタッフメモ
 * @returns {Object} 登録完了した会員データ
 */
function approveIntakeApplication(applicationId, staffData) {
  // TODO: Phase 3 で実装する
  // 1. IntakeApplicationsシートの review_status を approved に更新する
  // 2. MemberService.createMember を呼んで会員を登録する
  // 3. FeeService.calcInitialFee で初回費用を計算する
  // 4. Paymentsシートに初回費用記録を追加する
  // 5. AuditLogService.log でログを記録する
  throw new Error('未実装: IntakeService.approveIntakeApplication');
}

/**
 * 申込を却下する
 *
 * @param {string} applicationId - 申込ID
 * @param {string} reason - 却下理由
 * @returns {boolean} 成功した場合はtrue
 */
function rejectIntakeApplication(applicationId, reason) {
  // TODO: Phase 3 で実装する
  // 1. IntakeApplicationsシートの review_status を rejected に更新する
  // 2. rejection_reason を記録する
  // 3. AuditLogService.log でログを記録する
  throw new Error('未実装: IntakeService.rejectIntakeApplication');
}

/**
 * 申込IDを採番する
 *
 * フォーマット：APP-YYYYMMDD-XXXX（XXXXは当日の連番）
 *
 * @returns {string} 新しい申込ID
 */
function generateApplicationId() {
  // TODO: Phase 2 で実装する
  throw new Error('未実装: IntakeService.generateApplicationId');
}
