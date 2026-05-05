/**
 * ワイルドボア会員管理システム — 会員CRUD操作サービス
 *
 * Members シートに対するデータ操作を担当する。
 * このファイルでは個人情報を直接ログに出力しない。
 *
 * 依存：Config.gs, SheetService.gs, AuditLogService.gs
 */

// =============================================================================
// Phase 3 実装
// =============================================================================

/**
 * 次に使用可能な会員番号を生成する
 *
 * Settings シートのプレフィックス・桁数設定と、
 * 現在の最大会員番号から次の番号を生成する。
 *
 * @returns {string} 新しい会員番号（例：W-0042）
 */
function generateNextMemberId() {
  var prefix = getSetting('member_id_prefix') || 'W-';
  var digits  = parseInt(getSetting('member_id_digits') || '4', 10);

  var members = getSheetData(SHEET_NAMES.MEMBERS);
  var maxSeq  = 0;
  members.forEach(function(m) {
    var id  = String(m.member_id || '');
    if (id.indexOf(prefix) === 0) {
      var seq = parseInt(id.slice(prefix.length), 10) || 0;
      if (seq > maxSeq) maxSeq = seq;
    }
  });

  var nextSeq = String(maxSeq + 1);
  while (nextSeq.length < digits) nextSeq = '0' + nextSeq;
  return prefix + nextSeq;
}

/**
 * 空き鍵番号の一覧を取得する（フロントエンドから呼ぶ）
 *
 * @returns {Object[]} [{ key_card_number: 'K-001' }, ...]
 */
function getAvailableKeyCards() {
  try {
    var data = getSheetData(SHEET_NAMES.KEY_CARDS);
    return data
      .filter(function(k) { return String(k.status) === KEY_CARD_STATUS.AVAILABLE; })
      .map(function(k) { return { key_card_number: String(k.key_card_number) }; })
      .sort(function(a, b) { return a.key_card_number.localeCompare(b.key_card_number); });
  } catch (e) {
    Logger.log('[MemberService.getAvailableKeyCards] エラー: ' + e.message);
    return [];
  }
}

/**
 * 申込データから会員を新規登録する
 *
 * IntakeApplications の申込が承認された後に呼ばれる。
 * Members シートに行を追加し、KeyCards を更新する。
 *
 * @param {string} applicationId  - 申込ID
 * @param {string} memberId       - 割り当てる会員番号
 * @param {string} keyCardNumber  - 割り当てる鍵番号
 * @param {string} planId         - 確定コースID
 * @param {string} joinDate       - 入会日（YYYY-MM-DD）
 * @param {string} staffNotes     - スタッフメモ（任意）
 * @param {string} createdBy      - 登録スタッフID
 * @returns {string} 登録された会員番号
 */
function createMember(applicationId, memberId, keyCardNumber, planId, joinDate, staffNotes, createdBy) {
  // 1. 申込データを取得
  var app = findRowByKey(SHEET_NAMES.INTAKE_APPLICATIONS, 'application_id', applicationId);
  if (!app) throw new Error('申込が見つかりません: ' + applicationId);

  // 2. 会員番号の重複チェック
  var existing = findRowByKey(SHEET_NAMES.MEMBERS, 'member_id', memberId);
  if (existing) throw new Error('会員番号はすでに使用されています: ' + memberId);

  // 3. Members シートに追加
  var now = new Date().toISOString();
  appendRow(SHEET_NAMES.MEMBERS, {
    member_id:                  memberId,
    family_name:                String(app.family_name                || ''),
    given_name:                 String(app.given_name                 || ''),
    family_name_kana:           String(app.family_name_kana           || ''),
    given_name_kana:            String(app.given_name_kana            || ''),
    birth_date:                 String(app.birth_date                 || ''),
    gender:                     String(app.gender                     || ''),
    postal_code:                String(app.postal_code                || ''),
    prefecture:                 String(app.prefecture                 || ''),
    city:                       String(app.city                       || ''),
    address1:                   String(app.address1                   || ''),
    address2:                   String(app.address2                   || ''),
    phone_home:                 String(app.phone_home                 || ''),
    phone_mobile:               String(app.phone_mobile               || ''),
    email:                      String(app.email                      || ''),
    emergency_contact_name:     String(app.emergency_contact_name     || ''),
    emergency_contact_relation: String(app.emergency_contact_relation || ''),
    emergency_contact_phone:    String(app.emergency_contact_phone    || ''),
    occupation:                 String(app.occupation                 || ''),
    plan_id:                    planId,
    key_card_number:            keyCardNumber,
    join_date:                  joinDate,
    status:                     MEMBER_STATUS.ACTIVE,
    referrer_member_id:         String(app.referrer_member_id         || ''),
    intake_application_id:      applicationId,
    notes:                      staffNotes || '',
    created_at:                 now,
    updated_at:                 now,
    created_by:                 createdBy || getCurrentOperator(),
    updated_by:                 '',
  });

  // 4. KeyCards の該当番号を in_use に更新
  updateRowByKey(SHEET_NAMES.KEY_CARDS, 'key_card_number', keyCardNumber, {
    status:      KEY_CARD_STATUS.IN_USE,
    member_id:   memberId,
    issued_date: joinDate,
    updated_at:  now,
  });

  Logger.log('[MemberService.createMember] 会員登録完了: ' + memberId);
  return memberId;
}

// =============================================================================
// Phase 4 以降で実装するスタブ
// =============================================================================

function getMembers(statusFilter) {
  throw new Error('未実装: MemberService.getMembers（Phase 4 で実装）');
}

function getMemberById(memberId) {
  throw new Error('未実装: MemberService.getMemberById（Phase 4 で実装）');
}

function updateMember(memberId, updateData) {
  throw new Error('未実装: MemberService.updateMember（Phase 4 で実装）');
}

function searchMembers(query) {
  throw new Error('未実装: MemberService.searchMembers（Phase 4 で実装）');
}
