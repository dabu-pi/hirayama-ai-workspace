/**
 * logic_engine.js — 腰痛評価ルールベース判定エンジン (JASSESS-01)
 *
 * システム: 運動器初期評価システム / Phase 1: 腰痛評価モジュール
 * スプレッドシートID: 1sj6dYtkFbnk4fjLOk764f-w7KUUeGNVYcbMDOg26OXY
 *
 * ────────────────────────────────────────────────
 * 責務と構造
 * ────────────────────────────────────────────────
 * Step 1〜7 は setup_sheets.js で設定した Sheets 数式が担当（リアルタイム計算）。
 * このファイルは数式結果を読み取り、以下を実行する:
 *   Step 8:  フラグ集計（慢性期・既往・全フラグ判定）
 *   Step 9:  総合方針判定（判定マトリクス完全版 → C95 を更新）
 *   Step 10: 自動生成コメント（K. セクション C99〜C106 を更新）
 *
 * ────────────────────────────────────────────────
 * エントリポイント
 * ────────────────────────────────────────────────
 *   runLogicAll()  — ボタン or 手動実行。全ステップを再計算して書き込む
 *   onEdit(e)      — onEdit トリガー。主要入力セル変更時に自動呼び出し
 *
 *   ⚠️ onEdit を自動実行するには Apps Script エディタでトリガー設定が必要:
 *      「トリガーを追加」→ onEdit → スプレッドシートから → 編集時
 *
 * ────────────────────────────────────────────────
 * 将来モジュール拡張方針
 * ────────────────────────────────────────────────
 * 頸部・膝モジュールを追加する場合:
 *   1. CELLS 定数に新モジュールのセル位置を追加（または neck_CELLS 等を別ファイルで定義）
 *   2. computeFlags / generateComments に新モジュール固有フラグを追加
 *   共通判定マトリクス・フラグ優先順位は変更不要
 *
 * 依存: setup_sheets.js の定数 SHEET_NAMES, COLORS を参照する。
 *       GAS プロジェクト内で同一スコープで読み込まれることを前提とする。
 *
 * 最終更新: 2026-03-24（Phase 1 Step 8〜10 ルールベース判定ロジック実装）
 */

// ========== セル位置定数 ==========
// 腰痛評価入力シートのセル位置を一元管理。
// 列設計変更時はここだけ修正する。

const CELLS = {
  // Section A: 基本情報
  EVAL_DATE:        'C3',    // 評価日
  PATIENT_ID:       'C4',    // 患者ID
  ONSET_DURATION:   'C11',   // 発症からの期間
  PAST_HISTORY:     'C13',   // 既往歴（腰部）

  // Section B: 赤旗スクリーニング
  CAUDA_URINE:      'C22',   // 排尿・排便障害（馬尾①）
  CAUDA_PERINEUM:   'C23',   // 会陰部・鞍状領域の感覚異常（馬尾②）
  RED_SCORE:        'C24',   // 赤旗スコア合計（Sheets 数式）

  // Section C: 神経症状
  NERVE_RADIATE:    'C28',   // 下肢放散痛
  NERVE_WEAK:       'C31',   // 下肢筋力低下
  SLR:              'C32',   // SLRテスト
  NERVE_LEVEL:      'C33',   // 神経症状レベル（Sheets 数式: なし/軽度/中等度/重度）

  // Section D: NRS
  NRS_CURRENT:      'C36',   // NRS（現在）

  // Section E: RMDQ-10
  RMDQ_SCORE:       'C52',   // RMDQ合計スコア（Sheets 数式）

  // Section F: STarT
  START_SCORE:      'C65',   // STarT合計スコア（Sheets 数式）

  // Section H: 動作評価
  MOTION_SUMMARY:   'C81',   // 動作評価まとめ（Sheets 数式: 正常/軽度/中等度/重度制限型）

  // Section I: 移乗動作
  FALL_RISK:        'C88',   // 転倒リスク（Sheets 数式: 低/中/高）

  // Section J: 総合判定（書き込み先）
  RULE_RESULT:      'C95',   // ルールベース判定結果（このファイルが書き込む）

  // Section K: 自動生成コメント（書き込み先）
  CMT_SUMMARY:      'C99',   // 評価まとめ（施術者向け）
  CMT_CAUTION:      'C100',  // 注意すべき所見
  CMT_EXPLAIN:      'C101',  // 初回説明の方向性
  CMT_PRIORITY:     'C102',  // 施術の優先順位
  CMT_SELFCARE:     'C103',  // セルフケア・運動療法の方向性
  CMT_REASSESS:     'C104',  // 再評価時に見るべきポイント
  CMT_PATIENT:      'C105',  // 患者さんへの説明文（要約）
  CMT_REFERRAL:     'C106',  // 医療連携を考えるべき条件
};

// onEdit トリガー対象セル（これらが変更されたとき runLogicAll を呼び出す）
const TRIGGER_CELLS = new Set([
  'C11', 'C13',                                                              // 基本情報
  'C16', 'C17', 'C18', 'C19', 'C20', 'C21', 'C22', 'C23',                 // 赤旗 B16〜B23
  'C28', 'C31', 'C32',                                                       // 神経症状
  'C36',                                                                      // NRS
  'C42', 'C43', 'C44', 'C45', 'C46', 'C47', 'C48', 'C49', 'C50', 'C51',  // RMDQ Q1〜Q10
  'C56', 'C57', 'C58', 'C59', 'C60', 'C61', 'C62', 'C63', 'C64',          // STarT Q1〜Q9
  'C76', 'C77', 'C78', 'C79',                                               // 動作評価 前屈〜左側屈
  'C84', 'C85', 'C86', 'C87',                                               // 移乗動作
]);


// ========== ユーティリティ ==========

/**
 * セル値を数値に変換する。空欄・非数値は null を返す。
 * null を返すことで「未入力」と「0点」を区別する。
 */
function toNum(val) {
  if (val === '' || val === null || val === undefined) return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}


// ========== Step 8: フラグ集計 ==========

/**
 * 入力シートから全データを読み取り、{data, flags} を返す。
 *
 * ■ data: 生値オブジェクト
 * ■ flags: フラグ（true/false）
 *   各 Step のフラグが 1 か所に集約され、Step 9/10 で使われる。
 *
 * 将来モジュール: 頸部・膝固有フラグをここに追加する。
 *
 * @param {Sheet} sheet — 腰痛評価入力シート
 * @returns {{data: Object, flags: Object}}
 */
function readAndComputeFlags(sheet) {
  const get = (cell) => sheet.getRange(cell).getValue();

  // ── 生値取得 ──
  const data = {
    // 基本情報（Step 8 で使う）
    onsetDuration : get(CELLS.ONSET_DURATION),  // '2週未満' / '2〜6週' / '6週〜3か月' / '3か月以上'
    pastHistory   : get(CELLS.PAST_HISTORY),    // 'なし' / 'あり（1回）' / 'あり（複数回）' / '手術歴あり'

    // 赤旗（Step 1）
    caudaUrine    : get(CELLS.CAUDA_URINE),     // 'なし' / 'あり'
    caudaPerineum : get(CELLS.CAUDA_PERINEUM),  // 'なし' / 'あり'
    redScore      : toNum(get(CELLS.RED_SCORE)) ?? 0,

    // 神経症状（Step 2 — Sheets 数式結果を読む）
    nerveRadiate  : get(CELLS.NERVE_RADIATE),   // 'なし' / '片側' / '両側'
    nerveWeak     : get(CELLS.NERVE_WEAK),      // 'なし' / '疑い' / 'あり'
    slr           : get(CELLS.SLR),             // '陰性' / '陽性（右）' / '陽性（左）' / '両側陽性'
    nerveLevel    : get(CELLS.NERVE_LEVEL),     // 'なし' / '軽度' / '中等度' / '重度'（数式結果）

    // NRS（Step 4）
    nrs           : toNum(get(CELLS.NRS_CURRENT)),

    // RMDQ（Step 5 — 数式結果を読む）
    rmdq          : toNum(get(CELLS.RMDQ_SCORE)),

    // STarT（Step 3 — 数式結果を読む）
    startScore    : toNum(get(CELLS.START_SCORE)),

    // 動作評価まとめ（Step 6 — 数式結果を読む）
    motionSummary : get(CELLS.MOTION_SUMMARY),  // '正常' / '軽度制限型' / '中等度制限型' / '重度制限型'

    // 転倒リスク（Step 7 — 数式結果を読む）
    fallRisk      : get(CELLS.FALL_RISK),       // '低' / '中' / '高'
  };

  const flags = {};

  // ── Step 1: 赤旗フラグ ──
  flags.CAUDA   = data.caudaUrine === 'あり' || data.caudaPerineum === 'あり';
  flags.REDFLAG = !flags.CAUDA && data.redScore >= 1;

  // ── Step 2: 神経症状フラグ ──
  flags.NERVE_SEVERE = data.nerveLevel === '重度';
  flags.NERVE_MOD    = data.nerveLevel === '中等度';
  flags.NERVE_MILD   = data.nerveLevel === '軽度';

  // ── Step 3: STarT フラグ ──
  const st = data.startScore;
  flags.START_HIGH = st !== null && st >= 6;
  flags.START_MID  = st !== null && st >= 4 && st < 6;
  flags.START_LOW  = st !== null && st < 4;

  // ── Step 4: NRS フラグ ──
  const n = data.nrs;
  flags.NRS_HIGH = n !== null && n >= 7;
  flags.NRS_MID  = n !== null && n >= 4 && n < 7;
  flags.NRS_LOW  = n !== null && n < 4;

  // ── Step 5: RMDQ フラグ ──
  const rmdq = data.rmdq;
  flags.RMDQ_SEVERE = rmdq !== null && rmdq >= 8;
  flags.RMDQ_MOD    = rmdq !== null && rmdq >= 4 && rmdq < 8;
  flags.RMDQ_MILD   = rmdq !== null && rmdq < 4;

  // ── Step 6: 動作評価フラグ ──
  flags.MOTION_SEVERE = data.motionSummary === '重度制限型';
  flags.MOTION_MOD    = data.motionSummary === '中等度制限型';
  flags.MOTION_MILD   = data.motionSummary === '軽度制限型';
  flags.MOTION_NORMAL = data.motionSummary === '正常';

  // ── Step 7: 転倒リスクフラグ ──
  flags.FALL_HIGH = data.fallRisk === '高';
  flags.FALL_MID  = data.fallRisk === '中';

  // ── Step 8: 慢性期・既往フラグ（発症期間・既往歴から判定）──
  flags.ACUTE    = data.onsetDuration === '2週未満';
  flags.SUBACUTE = data.onsetDuration === '2〜6週' || data.onsetDuration === '6週〜3か月';
  flags.CHRONIC  = data.onsetDuration === '3か月以上';
  flags.RECURRENT = data.pastHistory === 'あり（複数回）' || data.pastHistory === '手術歴あり';

  return { data, flags };
}


// ========== Step 9: 総合方針判定 ==========

/**
 * LOGIC.md 総合判定マトリクスに準拠した優先順位で治療方針テキストを返す。
 *
 * 優先順位:
 *   1. CAUDA（馬尾）— 最優先・緊急
 *   2. REDFLAG（赤旗）
 *   3. NERVE_SEVERE（神経重度）
 *   4. NERVE_MOD（神経中等度）
 *   5. START_HIGH + NRS中〜高（行動変容・疼痛管理）
 *   6. START_HIGH + NRS低（行動変容・段階的機能改善）
 *   7. FALL_HIGH（転倒予防）
 *   8. NRS_HIGH + RMDQ中等度以上（疼痛管理→機能改善）
 *   9. NRS_HIGH（疼痛管理）
 *  10. RMDQ_SEVERE（機能障害優先）
 *  11. ACUTE + NRS_MID（急性期管理）
 *  12. 慢性期・亜急性 + START_LOW（運動療法開始）
 *  13. CHRONIC + START_HIGH（生活指導・行動変容）
 *  14. CHRONIC（機能改善・セルフケア習慣化）
 *  15. デフォルト（標準方針）
 *
 * @param {Object} flags
 * @param {Object} data
 * @returns {string} 判定テキスト
 */
function judgeOverallPolicy(flags, data) {
  if (flags.CAUDA) {
    return '【緊急】馬尾症候群疑い — 即日医療機関紹介を強く検討してください';
  }
  if (flags.REDFLAG) {
    return '赤旗あり — 施術前に医療連携の必要性を確認してください';
  }
  if (flags.NERVE_SEVERE) {
    return '神経症状重度 — 神経所見優先・整形外科精査（MRI等）を強く推奨';
  }
  if (flags.NERVE_MOD) {
    return '神経根障害疑い — 神経所見優先・施術強度を慎重に。悪化時は即医療連携';
  }
  if (flags.START_HIGH && (flags.NRS_HIGH || flags.NRS_MID)) {
    return '行動変容・説明優先 — 心理社会的介入と疼痛教育を施術と並行して実施';
  }
  if (flags.START_HIGH && flags.NRS_LOW) {
    return '行動変容優先 — 段階的な機能改善プログラムを導入。セルフエフィカシーの向上を重視';
  }
  if (flags.FALL_HIGH) {
    return 'ADL・転倒予防優先 — 安全な立位・歩行の確保を最優先に対応';
  }
  if (flags.NRS_HIGH && (flags.RMDQ_SEVERE || flags.RMDQ_MOD)) {
    return '疼痛管理優先 → 機能改善 — まず痛みを緩和してから機能回復へ段階的に移行';
  }
  if (flags.NRS_HIGH) {
    return '疼痛管理優先 — 痛みの緩和を中心に対応';
  }
  if (flags.RMDQ_SEVERE) {
    return '機能障害対応優先 — ADL制限の軽減（起き上がり・歩行）から着手';
  }
  if (flags.ACUTE && flags.NRS_MID) {
    return '急性期管理優先 — 安静・保護と急性期疼痛管理から開始（2〜4週で改善を目標）';
  }
  if ((flags.SUBACUTE || flags.CHRONIC) && flags.START_LOW && !flags.NRS_HIGH) {
    return '機能改善・運動療法開始 — 段階的なエクササイズと日常活動の再開を促進';
  }
  if (flags.CHRONIC && flags.START_HIGH) {
    return '生活指導・行動変容優先 — セルフケア習慣化と段階的運動を組み合わせた慢性期管理';
  }
  if (flags.CHRONIC) {
    return '機能改善・セルフケア習慣化 — 再発予防を見据えた運動療法と生活指導';
  }
  return '機能改善・セルフケア優先 — 状態に応じた標準的な施術方針で対応';
}


// ========== Step 10: 自動生成コメント ==========

/**
 * フラグと生値から K. セクションの 8 種コメントを生成する。
 * 空欄フィールドを判定に混入させないよう null チェックを実施。
 *
 * 将来モジュール拡張:
 *   頸部・膝固有のフラグが true の場合に追加コメントを挿入するだけで流用可能。
 *
 * @param {Object} flags
 * @param {Object} data
 * @param {string} policy — Step 9 の判定テキスト
 * @returns {{summary, caution, explain, priority, selfcare, reassess, patient, referral}}
 */
function generateComments(flags, data, policy) {

  // ── 評価まとめ（施術者向けサマリー）──
  const scoreParts = [];
  if (data.nrs !== null)        scoreParts.push(`NRS ${data.nrs}/10`);
  if (data.rmdq !== null)       scoreParts.push(`RMDQ ${data.rmdq}/10`);
  if (data.startScore !== null) scoreParts.push(`STarT ${data.startScore}/9`);
  const scoreText = scoreParts.length > 0 ? scoreParts.join(' / ') : '（スコア未入力）';

  let summary = `【判定】${policy}\n【スコア】${scoreText}`;
  if (data.nerveLevel && data.nerveLevel !== 'なし') {
    summary += `\n【神経症状】${data.nerveLevel}`;
  }
  if (data.motionSummary && data.motionSummary !== '') {
    summary += `\n【動作評価】${data.motionSummary}`;
  }
  if (data.fallRisk && data.fallRisk !== '') {
    summary += `\n【転倒リスク】${data.fallRisk}`;
  }

  // ── 注意すべき所見 ──
  const cautionItems = [];
  if (flags.CAUDA)        cautionItems.push('★【緊急】馬尾症候群疑い（排尿/会陰部症状）— 即日紹介を強く検討');
  if (flags.REDFLAG)      cautionItems.push('赤旗所見あり — 施術前に医療連携を確認');
  if (flags.NERVE_SEVERE) cautionItems.push('重度神経症状（筋力低下 or 両側SLR陽性）— 画像精査を強く推奨');
  if (flags.NERVE_MOD)    cautionItems.push('神経根症状（SLR陽性）— 施術強度を抑え、悪化時は即対応');
  if (flags.START_HIGH)   cautionItems.push('慢性化リスク高（STarT≥6）— 心理社会的介入が重要。パニックや恐怖回避に注意');
  if (flags.NRS_HIGH)     cautionItems.push('疼痛高強度（NRS≥7）— 疼痛管理を最優先');
  if (flags.RMDQ_SEVERE)  cautionItems.push('機能障害重度（RMDQ≥8）— 日常生活制限が著しい。ADL改善を早期に');
  if (flags.FALL_HIGH)    cautionItems.push('転倒リスク高 — 安全な環境整備と介助者への指導が必要');
  if (flags.RECURRENT)    cautionItems.push('腰痛の再発・既往あり — 再発予防の観点を初回から組み込む');
  if (flags.MOTION_SEVERE) cautionItems.push('動作範囲 重度制限 — 日常動作の安全性を優先');
  const caution = cautionItems.length > 0
    ? cautionItems.join('\n')
    : '特記すべき緊急所見はありません。通常の施術方針で進めてください。';

  // ── 初回説明の方向性 ──
  let explain;
  if (flags.CAUDA || flags.REDFLAG) {
    explain = '本日の評価で、専門的な検査が必要な状態が確認されました。\n施術の前に専門医への受診をお勧めし、受診後に施術方針を改めてご説明します。';
  } else if (flags.NERVE_SEVERE) {
    explain = '神経に関わる重い症状（足の力が入りにくい・両足のしびれ等）が見られます。\n施術には慎重を要し、整形外科での精査をお勧めします。症状が悪化した場合はすぐにお知らせください。';
  } else if (flags.NERVE_MOD) {
    explain = '神経根への刺激症状（SLRテスト陽性・放散痛）があります。\n痛みやしびれの原因を丁寧に説明し、「悪化時のサイン」を必ずお伝えしてください。';
  } else if (flags.START_HIGH) {
    explain = '痛みが続く背景に、不安やストレスが影響している可能性があります。\n「動いても大丈夫」という安心感と回復の見通しを丁寧にお伝えください。痛みの原因を正確に理解してもらうことが、慢性化予防につながります。';
  } else if (flags.CHRONIC) {
    explain = '長期間続く痛みの状態です。「なぜ続いているか」の原因と「どうすれば良くなるか」の具体的な見通しをお伝えください。焦らず段階的に改善できることを強調してください。';
  } else if (flags.ACUTE) {
    explain = '急性期の状態です。「安静にすることで改善が期待できる」こと、「無理をしないこと」の重要性をお伝えください。通常 2〜4 週で改善が見込まれます。';
  } else {
    explain = '現状と改善の見通しを丁寧にお伝えください。セルフケアの重要性と、次回評価時の目標をお伝えしてください。';
  }

  // ── 施術の優先順位 ──
  let priority;
  if (flags.CAUDA || flags.REDFLAG) {
    priority = '施術は一時保留。医療連携を最優先に対応してください。';
  } else if (flags.NERVE_SEVERE) {
    priority = '1. 神経症状の評価・悪化監視\n2. 整形外科への紹介を強く検討\n3. 施術は最小限の軽介入にとどめる';
  } else if (flags.NRS_HIGH) {
    priority = '1. 疼痛緩和（手技・物理療法）\n2. 炎症軽減・過緊張の緩和\n3. 日常動作の安全な動き方の指導\n（痛みが落ち着いたら機能改善へ移行）';
  } else if (flags.FALL_HIGH) {
    priority = '1. 安全な立位・歩行の確保\n2. 転倒予防動作訓練\n3. 必要に応じて家族・介護者への指導';
  } else if (flags.RMDQ_SEVERE) {
    priority = '1. ADL制限の軽減（起き上がり・立ち上がり・歩行）\n2. 疼痛緩和\n3. 段階的なセルフケア・ホームエクササイズの導入';
  } else if (flags.START_HIGH) {
    priority = '1. 疼痛教育（痛みの正しい理解）\n2. 恐怖回避行動への対応\n3. セルフエフィカシー（自己効力感）の向上\n4. 段階的な身体機能改善';
  } else {
    priority = '1. 患者の主訴・希望を確認\n2. 疼痛緩和と機能改善を並行\n3. セルフケア指導を早期に開始';
  }

  // ── セルフケア・運動療法の方向性 ──
  let selfcare;
  if (flags.CAUDA || flags.REDFLAG || flags.NERVE_SEVERE) {
    selfcare = '症状が安定するまでセルフエクササイズは控えてください。\n安全な姿勢・動作（良肢位の保持）のみ指導します。';
  } else if (flags.NRS_HIGH || flags.ACUTE) {
    selfcare = '急性期・高強度疼痛期は安静を優先し、段階的に活動を再開します。\n・骨盤中間位での良肢位保持\n・温熱・冷却の使い分け（急性炎症期は冷却）\n・痛みの出ない範囲での軽い動き（ベッド上での膝抱え等）';
  } else if (flags.START_HIGH) {
    selfcare = '「動けない」という思い込みを修正することが大切です。\n・無理のない範囲での日常活動の継続を促す\n・腹式呼吸（リラクゼーション）の習慣化\n・「痛み＝傷が広がっている」という誤信念の修正\n・段階的に活動範囲を広げる（graded activity）';
  } else if (flags.CHRONIC && flags.START_LOW) {
    selfcare = '慢性期は運動療法が中心です。\n・体幹安定化エクササイズ（ドローイン・ブリッジ）\n・有酸素運動（ウォーキング 10〜20 分 / 日から開始）\n・姿勢改善（デスクワーク環境・スマホ姿勢の見直し）\n・ハムストリング・腸腰筋ストレッチ';
  } else {
    selfcare = '・ドローイン（腹横筋の活性化）\n・ハムストリング・腸腰筋のストレッチ\n・日常生活での姿勢意識（前屈時の腰椎保護動作）\n・長時間同一姿勢を避けるための休憩習慣';
  }

  // ── 再評価時に見るべきポイント ──
  const reassessPoints = [];
  if (data.nrs !== null) {
    const nrsTarget = Math.max(0, data.nrs - 3);
    reassessPoints.push(`NRS の変化（現在 ${data.nrs}/10 → 目標 ${nrsTarget}/10 以下）`);
  }
  if (data.rmdq !== null) {
    const rmdqTarget = Math.max(0, data.rmdq - 3);
    reassessPoints.push(`RMDQ の変化（現在 ${data.rmdq}/10 → 目標 ${rmdqTarget}/10 以下）`);
  }
  if (flags.NERVE_MOD || flags.NERVE_MILD || flags.NERVE_SEVERE) {
    reassessPoints.push('神経症状の変化（放散痛・しびれの増減・筋力の変化）');
  }
  if (flags.START_HIGH || flags.START_MID) {
    reassessPoints.push('STarT スコアの変化（心理社会的因子の改善・悪化）');
  }
  if (flags.MOTION_SEVERE || flags.MOTION_MOD) {
    reassessPoints.push(`動作評価の改善（現在: ${data.motionSummary} → 軽度制限型または正常を目標）`);
  }
  if (flags.FALL_HIGH || flags.FALL_MID) {
    reassessPoints.push('移乗動作・歩行の安全性と自立度の変化');
  }
  reassessPoints.push('セルフケアの実施状況と困っていること');
  reassessPoints.push('PSFS スコアの変化（目標活動の達成度）');
  const reassess = reassessPoints.map((p, i) => `${i + 1}. ${p}`).join('\n');

  // ── 患者さんへの説明文（要約）──
  let patient;
  if (flags.CAUDA) {
    patient = '本日の評価で、専門の病院での検査が必要な状態が確認されました。\n早めに受診されることをお勧めします。詳しくは担当施術者にご確認ください。';
  } else if (flags.REDFLAG) {
    patient = '評価の中で注意が必要な状態が見つかりました。\n念のため、専門医への確認をお勧めします。';
  } else if (flags.NERVE_SEVERE || flags.NERVE_MOD) {
    const nerveSymptom = flags.NERVE_SEVERE ? '足の力が入りにくい・強いしびれ' : '足への痛みの広がり・しびれ';
    patient = `神経に関わる症状（${nerveSymptom}）が確認されています。\n施術中に症状が強くなった場合はすぐにお知らせください。\n症状の変化を一緒に観察しながら進めていきます。`;
  } else if (flags.START_HIGH) {
    patient = '痛みが続く背景に、日常生活でのストレスや不安が影響している可能性があります。\n施術だけでなく、痛みとのうまい付き合い方を一緒に考えていきましょう。\n焦らず、できることから少しずつ取り組んでいきます。';
  } else if (flags.CHRONIC) {
    patient = '痛みが長い期間続いている状態です。\n焦らず、段階的に動ける身体に戻していきましょう。\n再発を防ぐための運動習慣も、一緒に作っていきます。';
  } else if (flags.ACUTE) {
    patient = '急に痛みが出てきている状態です。まず炎症を落ち着かせることが大切です。\n無理な動作は避け、2〜4 週間を目安に回復を目指していきましょう。';
  } else {
    const nrsText = data.nrs !== null ? ` NRS ${data.nrs}/10 の痛みがありますが、` : '';
    patient = `現在の状態をしっかり評価しました。${nrsText}適切な施術とセルフケアで改善が期待できます。\n一緒に取り組んでいきましょう。`;
  }

  // ── 医療連携を考えるべき条件 ──
  const referralLines = [];
  // 今回の評価結果
  if (flags.CAUDA) {
    referralLines.push('★今回の評価: 【即日紹介推奨】馬尾症候群疑いあり');
  } else if (flags.REDFLAG) {
    referralLines.push('★今回の評価: 赤旗所見あり — 施術前に医療連携を確認すること');
  } else if (flags.NERVE_SEVERE) {
    referralLines.push('★今回の評価: 神経症状重度 — 整形外科精査（MRI等）を強く推奨');
  } else {
    referralLines.push('★今回の評価: 緊急紹介の適応なし（経過を観察しながら施術継続）');
  }
  referralLines.push('');
  referralLines.push('【即日紹介が必要な状態】');
  referralLines.push('・馬尾症候群疑い（排尿障害・会陰部感覚異常）');
  referralLines.push('・進行性の下肢筋力低下');
  referralLines.push('');
  referralLines.push('【早期紹介を検討する状態】');
  referralLines.push('・安静時痛 + 体重減少・発熱（腫瘍・感染疑い）');
  referralLines.push('・外傷後の強い腰痛（骨折疑い）');
  referralLines.push('・SLR陽性 + 筋力低下（椎間板ヘルニア・脊柱管狭窄症疑い）');
  referralLines.push('');
  referralLines.push('【4〜6週改善なし → 紹介検討】');
  referralLines.push('・施術継続にも関わらず NRS・RMDQ が改善しない場合');
  referralLines.push('・神経症状が増悪または新出した場合');
  const referral = referralLines.join('\n');

  return { summary, caution, explain, priority, selfcare, reassess, patient, referral };
}


// ========== 結果書き込み ==========

/**
 * 判定結果とコメントを入力シートに書き込む。
 * K. セクション全 8 行とルールベース判定結果（C95）を更新する。
 *
 * @param {Sheet}  sheet
 * @param {string} policy
 * @param {Object} comments
 */
function writeResults(sheet, policy, comments) {
  const writeTo = (cell, text) => {
    sheet.getRange(cell)
         .setValue(text)
         .setBackground(COLORS.AUTO)
         .setFontColor('#333333')
         .setWrap(true);
  };

  writeTo(CELLS.RULE_RESULT,  policy);
  writeTo(CELLS.CMT_SUMMARY,  comments.summary);
  writeTo(CELLS.CMT_CAUTION,  comments.caution);
  writeTo(CELLS.CMT_EXPLAIN,  comments.explain);
  writeTo(CELLS.CMT_PRIORITY, comments.priority);
  writeTo(CELLS.CMT_SELFCARE, comments.selfcare);
  writeTo(CELLS.CMT_REASSESS, comments.reassess);
  writeTo(CELLS.CMT_PATIENT,  comments.patient);
  writeTo(CELLS.CMT_REFERRAL, comments.referral);
}


// ========== エントリポイント ==========

/**
 * 全 Step 8〜10 を実行してシートを更新する。
 *
 * 使い方:
 *   - Apps Script エディタから直接実行
 *   - シート上の「判定を更新」ボタンに割り当てる
 *   - onEdit トリガーから自動呼び出し
 */
function runLogicAll() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_NAMES.INPUT);
  if (!sheet) {
    SpreadsheetApp.getUi().alert('腰痛評価入力シートが見つかりません。setupAllSheets() を再実行してください。');
    return;
  }

  // 評価日 と 患者ID が両方空なら実行しない（空シートへの誤書き込み防止）
  const evalDate  = sheet.getRange(CELLS.EVAL_DATE).getValue();
  const patientId = sheet.getRange(CELLS.PATIENT_ID).getValue();
  if (!evalDate && !patientId) return;

  // Sheets 数式の計算完了を待つ
  SpreadsheetApp.flush();

  // Step 8: 全フラグ集計
  const { data, flags } = readAndComputeFlags(sheet);

  // Step 9: 総合方針判定
  const policy = judgeOverallPolicy(flags, data);

  // Step 10: 自動生成コメント
  const comments = generateComments(flags, data, policy);

  // 書き込み
  writeResults(sheet, policy, comments);
}

/**
 * onEdit トリガー: 主要入力セル変更時に自動実行。
 *
 * ⚠️ このトリガーを有効にするには Apps Script エディタで設定が必要:
 *    左側「トリガー」アイコン → 「トリガーを追加」
 *    実行する関数: onEdit
 *    イベントのソース: スプレッドシートから
 *    イベントの種類: 編集時
 *
 * @param {Object} e — Google Apps Script の編集イベントオブジェクト
 */
function onEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== SHEET_NAMES.INPUT) return;

  const cell = e.range.getA1Notation();
  if (!TRIGGER_CELLS.has(cell)) return;

  // Sheets 数式の再計算を完了させてから実行
  SpreadsheetApp.flush();
  runLogicAll();
}
