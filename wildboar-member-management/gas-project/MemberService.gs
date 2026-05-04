/**
 * ワイルドボア会員管理システム — 会員CRUD操作サービス
 *
 * Membersシートに対するデータ操作を担当する。
 * このファイルでは個人情報を直接ログに出力しない。
 *
 * 依存：Config.gs, SheetService.gs, AuditLogService.gs
 */

/**
 * 全会員を取得する（ステータスフィルタあり）
 *
 * @param {string} [statusFilter] - フィルタするステータス（MEMBER_STATUS参照）。省略時は全件取得
 * @returns {Object[]} 会員オブジェクトの配列
 */
function getMembers(statusFilter) {
  // TODO: Phase 4 で実装する
  // SheetService.getSheetData(SHEET_NAMES.MEMBERS) でシートデータを取得する
  // statusFilterが指定されている場合は絞り込みを行う
  throw new Error('未実装: MemberService.getMembers');
}

/**
 * 会員番号で会員を取得する
 *
 * @param {string} memberId - 会員番号（例：W-0001）
 * @returns {Object|null} 会員オブジェクト、存在しない場合はnull
 */
function getMemberById(memberId) {
  // TODO: Phase 4 で実装する
  throw new Error('未実装: MemberService.getMemberById');
}

/**
 * 申込データから会員を新規登録する
 *
 * IntakeApplicationsの申込が承認された後に呼ばれる。
 * Membersシートに行を追加し、会員番号・鍵番号を設定する。
 *
 * @param {string} applicationId - 申込ID
 * @param {string} memberId - 割り当てる会員番号
 * @param {string} keyCardNumber - 割り当てる鍵番号
 * @param {string} planId - 確定コースID
 * @param {Date} joinDate - 入会日
 * @returns {Object} 登録された会員オブジェクト
 */
function createMember(applicationId, memberId, keyCardNumber, planId, joinDate) {
  // TODO: Phase 3 で実装する
  // 1. IntakeApplicationsシートから申込データを取得する
  // 2. 会員番号の重複チェックをする
  // 3. Membersシートに新規行を追加する
  // 4. KeyCardsシートの該当番号をin_useに更新する
  // 5. AuditLogService.log でログを記録する
  throw new Error('未実装: MemberService.createMember');
}

/**
 * 会員情報を更新する
 *
 * @param {string} memberId - 会員番号
 * @param {Object} updateData - 更新するフィールドと値のオブジェクト
 * @returns {Object} 更新後の会員オブジェクト
 */
function updateMember(memberId, updateData) {
  // TODO: Phase 4 で実装する
  // 1. 対象会員の行を特定する
  // 2. 更新前の値をAuditLogに記録する
  // 3. 各フィールドを更新する
  // 4. updated_atを更新する
  // 5. AuditLogService.log でログを記録する
  throw new Error('未実装: MemberService.updateMember');
}

/**
 * 次に使用可能な会員番号を生成する
 *
 * Settingsシートのプレフィックス・桁数設定と、
 * 現在の最大会員番号から次の番号を生成する。
 *
 * @returns {string} 新しい会員番号（例：W-0042）
 */
function generateNextMemberId() {
  // TODO: Phase 3 で実装する
  // 1. Settingsシートからmember_id_prefix, member_id_digitsを取得する
  // 2. Membersシートの現在の最大会員番号を取得する
  // 3. 最大番号 + 1 でゼロパディングした番号を生成する
  throw new Error('未実装: MemberService.generateNextMemberId');
}

/**
 * 氏名・電話番号・会員番号で会員を検索する
 *
 * @param {string} query - 検索文字列
 * @returns {Object[]} 一致した会員オブジェクトの配列
 */
function searchMembers(query) {
  // TODO: Phase 4 で実装する
  // 氏名カナ・氏名漢字・携帯電話番号・会員番号で部分一致検索する
  throw new Error('未実装: MemberService.searchMembers');
}
