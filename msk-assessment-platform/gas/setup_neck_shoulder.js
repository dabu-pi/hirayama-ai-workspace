/**
 * setup_neck_shoulder.js — JASSESS-01 頚肩こりモジュール シート追加 GAS
 *
 * システム: 運動器初期評価システム (msk-assessment-platform)
 * フェーズ: Phase 2 = 頚肩こり評価モジュール追加
 *
 * ⚠️ 既存シートは変更しない。追加のみで対応する。
 *   - 腰痛評価入力 / 判定ロジック / コメントマスタ → 変更禁止
 *   - 設定 / 評価履歴 → 末尾・右端への追加のみ
 *
 * 使い方:
 *   1. clasp push でこのファイルを GAS プロジェクトへ反映する
 *   2. Apps Script エディタから setupNeckShoulderSheets() を実行する
 *   3. 実行後、各シートが追加されたことを確認する
 *   4. 判定ロジックシートは非表示になる
 *
 * 依存:
 *   setup_sheets.js の SHEET_NAMES / COLORS / ヘルパー関数を使用する。
 *   同一 GAS プロジェクト内で読み込まれることを前提とする。
 *
 * 実機反映対象シート:
 *   新規: 共通_初期評価 / 頚肩こり_初期評価 / 初期評価サマリー / 頚肩こり_コメントマスタ / 頚肩こり_判定ロジック(非表示)
 *   追加: 設定（末尾に頚肩こりセクション）/ 評価履歴（右端に7列）
 *
 * 最終更新: 2026-03-26（Phase 2 初版）
 */

// ========== Phase 2 シート名定数 ==========
// 既存 SHEET_NAMES は変更せず、別定数として追加する

const NS_SHEET_NAMES = {
  COMMON_INPUT:   '共通_初期評価',
  NS_INPUT:       '頚肩こり_初期評価',
  SUMMARY:        '初期評価サマリー',
  NS_COMMENTS:    '頚肩こり_コメントマスタ',
  NS_LOGIC:       '頚肩こり_判定ロジック',
};


// ========== メインエントリ ==========

/**
 * 頚肩こりモジュールの全シートを追加する。
 * 既存シートには触れない。
 * Apps Script エディタから手動実行する。
 */
function setupNeckShoulderSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 新規シートの追加
  setupCommonInputSheet(ss);
  setupNsInputSheet(ss);
  setupNsCommentsSheet(ss);
  setupNsLogicSheet(ss);
  setupSummarySheet(ss);

  // 既存シートへの追加（末尾・右端のみ）
  addNsConfigRows(ss);
  addNsHistoryColumns(ss);

  // 判定ロジックシートは非表示
  const logicSheet = ss.getSheetByName(NS_SHEET_NAMES.NS_LOGIC);
  if (logicSheet) logicSheet.hideSheet();

  SpreadsheetApp.getUi().alert(
    '[JASSESS-01] Phase 2 頚肩こりモジュール セットアップ完了！\n\n' +
    '追加されたシート:\n' +
    '  共通_初期評価\n' +
    '  頚肩こり_初期評価\n' +
    '  初期評価サマリー\n' +
    '  頚肩こり_コメントマスタ\n' +
    '  頚肩こり_判定ロジック（非表示）\n\n' +
    '既存シートへの追加:\n' +
    '  設定 → 末尾に頚肩こりセクション追加\n' +
    '  評価履歴 → 右端に7列追加\n\n' +
    '次のステップ:\n' +
    '  logic_engine_neck_shoulder.js を clasp push して onEdit トリガーを追加してください。'
  );
}


// ========== シート 1: 共通_初期評価 ==========

function setupCommonInputSheet(ss) {
  const sh = getOrCreateSheet(ss, NS_SHEET_NAMES.COMMON_INPUT);
  sh.setColumnWidth(1, 30);   // A: 区切り
  sh.setColumnWidth(2, 220);  // B: ラベル
  sh.setColumnWidth(3, 280);  // C: 入力値

  // タイトル
  setHeader(sh, 1, 1, '共通_初期評価 — 運動器初期評価システム JASSESS-01', 3);

  // ── 管理情報 ──
  sh.getRange('B3').setValue('評価日').setFontWeight('bold');
  sh.getRange('C3').setBackground(COLORS.MANUAL);

  sh.getRange('B4').setValue('患者ID').setFontWeight('bold');
  sh.getRange('C4').setBackground(COLORS.MANUAL);

  sh.getRange('B5').setValue('担当者').setFontWeight('bold');
  setDropdown(sh, 5, 3, ['（スタッフマスタから選択）']);

  sh.getRange('B6').setValue('評価区分').setFontWeight('bold');
  setDropdown(sh, 6, 3, ['初回', '再評価', '最終']);

  sh.getRange('B7').setValue('評価対象症状').setFontWeight('bold');
  setDropdown(sh, 7, 3, ['腰痛', '頚肩こり', '複合', 'その他']);

  // ── セクション A: 患者基本情報 ──
  setHeader(sh, 9, 2, 'A. 患者基本情報', 2);
  setLabelInput(sh, 10, '氏名（カナ）');
  setLabelInput(sh, 11, '年齢');
  sh.getRange('B12').setValue('性別').setFontWeight('bold');
  setDropdown(sh, 12, 3, ['男性', '女性', 'その他']);
  sh.getRange('B13').setValue('職業').setFontWeight('bold');
  setDropdown(sh, 13, 3, ['事務系', '立ち仕事', '重労働', '学生', '主婦・主夫', '無職', 'その他']);
  sh.getRange('B14').setValue('主な仕事内容').setFontWeight('bold');
  setDropdown(sh, 14, 3, ['デスクワーク', '立ち仕事', '重量物', '学生', '主婦主夫', '無職', 'その他']);

  // ── セクション B: 主訴・経過（共通部分）──
  setHeader(sh, 16, 2, 'B. 主訴・経過（共通）', 2);
  sh.getRange('B17').setValue('主症状（部位）').setFontWeight('bold');
  setDropdown(sh, 17, 3, ['腰痛', '頚部痛', '肩こり', '頚部痛＋肩こり', 'その他']);
  sh.getRange('B18').setValue('発症時期').setFontWeight('bold');
  setDropdown(sh, 18, 3, ['2週未満', '2週〜3か月', '3か月以上']);
  sh.getRange('B19').setValue('発症様式').setFontWeight('bold');
  setDropdown(sh, 19, 3, ['急性', '徐々に', '反復性', '不明']);
  sh.getRange('B20').setValue('初発 / 再発').setFontWeight('bold');
  setDropdown(sh, 20, 3, ['初発', '再発', '反復性', '不明']);

  // ── セクション C: 共通赤旗スクリーニング ──
  setHeader(sh, 22, 2, 'C. 共通赤旗スクリーニング', 2);
  const commonRedFlags = [
    '安静時・夜間痛（非機械的）',
    '発熱・全身倦怠感',
    '進行性の神経症状（上下肢）',
    '排尿・排便障害',
    '外傷後の強い疼痛',
    '体重減少（原因不明）',
    '既往：悪性腫瘍',
    'ステロイド長期使用',
  ];
  commonRedFlags.forEach((label, i) => {
    const row = 23 + i;
    sh.getRange(`B${row}`).setValue(label).setFontWeight('bold');
    sh.getRange(`C${row}`).insertCheckboxes().setBackground(COLORS.SELECT);
  });
  sh.getRange('B31').setValue('赤旗スコア合計').setFontWeight('bold');
  setAutoCell(sh, 31, 3, '=COUNTIF(C23:C30,TRUE)');

  // ── セクション D: NRS ──
  setHeader(sh, 33, 2, 'D. 痛みの強さ（NRS）', 2);
  sh.getRange('B34').setValue('NRS（現在 0〜10）').setFontWeight('bold');
  setDropdown(sh, 34, 3, ['0','1','2','3','4','5','6','7','8','9','10']);
  sh.getRange('B35').setValue('NRS（最悪時 0〜10）').setFontWeight('bold');
  setDropdown(sh, 35, 3, ['0','1','2','3','4','5','6','7','8','9','10']);

  // ── セクション E: 生活背景 ──
  setHeader(sh, 37, 2, 'E. 生活背景', 2);
  sh.getRange('B38').setValue('睡眠の状態').setFontWeight('bold');
  setDropdown(sh, 38, 3, ['問題なし', '寝つきが悪い', '途中で目が覚める', '両方']);
  sh.getRange('B39').setValue('精神的ストレス').setFontWeight('bold');
  setDropdown(sh, 39, 3, ['ほとんどない', '多少ある', 'かなりある']);

  // ── セクション F: PSFS ──
  setHeader(sh, 41, 2, 'F. PSFS（患者特定機能評価）', 2);
  const psfsActivities = ['PSFS 活動1', 'PSFS 活動2', 'PSFS 活動3'];
  psfsActivities.forEach((label, i) => {
    const actRow = 42 + i * 2;
    const scoreRow = actRow + 1;
    sh.getRange(`B${actRow}`).setValue(label).setFontWeight('bold');
    sh.getRange(`C${actRow}`).setBackground(COLORS.MANUAL);
    sh.getRange(`B${scoreRow}`).setValue(label.replace('活動', '評点')).setFontWeight('bold');
    setDropdown(sh, scoreRow, 3, ['0','1','2','3','4','5','6','7','8','9','10']);
  });
  sh.getRange('B48').setValue('PSFS 平均').setFontWeight('bold');
  setAutoCell(sh, 48, 3, '=IFERROR(AVERAGE(C43,C45,C47),"")');

  SpreadsheetApp.flush();
}


// ========== シート 2: 頚肩こり_初期評価 ==========

function setupNsInputSheet(ss) {
  const sh = getOrCreateSheet(ss, NS_SHEET_NAMES.NS_INPUT);
  sh.setColumnWidth(1, 30);
  sh.setColumnWidth(2, 250);
  sh.setColumnWidth(3, 300);

  // タイトル
  setHeader(sh, 1, 1, '頚肩こり_初期評価 — JASSESS-01', 3);

  // ── 管理情報（共通_初期評価から参照）──
  sh.getRange('B3').setValue('評価日（共通から参照）').setFontWeight('bold');
  setAutoCell(sh, 3, 3, "='共通_初期評価'!C3");
  sh.getRange('B4').setValue('患者ID（共通から参照）').setFontWeight('bold');
  setAutoCell(sh, 4, 3, "='共通_初期評価'!C4");

  // ── NS-A: 赤旗 / 頚部特有の危険所見 ──
  setHeader(sh, 6, 2, 'NS-A. 赤旗 / 頚部特有の危険所見', 2);
  const nsRedFlags = [
    '雷鳴頭痛・急激な頭痛悪化',
    '進行性の上肢筋力低下',
    '嚥下障害・構音障害',
    'めまい（頭位変換時）',
    '外傷後の頚部強い疼痛',
  ];
  nsRedFlags.forEach((label, i) => {
    const row = 7 + i;
    sh.getRange(`B${row}`).setValue(label).setFontWeight('bold');
    sh.getRange(`C${row}`).insertCheckboxes().setBackground(COLORS.SELECT);
  });
  sh.getRange('B12').setValue('頚部赤旗スコア').setFontWeight('bold');
  setAutoCell(sh, 12, 3, '=COUNTIF(C7:C11,TRUE)');

  // ── NS-B: 神経症状スクリーニング ──
  setHeader(sh, 14, 2, 'NS-B. 神経症状スクリーニング', 2);
  sh.getRange('B15').setValue('上肢への放散痛・しびれ').setFontWeight('bold');
  setDropdown(sh, 15, 3, ['なし', '片側', '両側']);
  sh.getRange('B16').setValue('しびれの分布').setFontWeight('bold');
  setDropdown(sh, 16, 3, ['なし', '親指側', '小指側', '全指', '上腕外側', 'その他']);
  sh.getRange('B17').setValue('手の巧緻性低下').setFontWeight('bold');
  sh.getRange('C17').insertCheckboxes().setBackground(COLORS.SELECT);
  sh.getRange('B18').setValue('握力低下の自覚').setFontWeight('bold');
  sh.getRange('C18').insertCheckboxes().setBackground(COLORS.SELECT);
  sh.getRange('B19').setValue('症状増悪体位').setFontWeight('bold');
  setDropdown(sh, 19, 3, ['なし', '後屈', '前屈', '側屈', '特定姿勢']);
  sh.getRange('B20').setValue('神経症状レベル（自動）').setFontWeight('bold');
  setAutoCell(sh, 20, 3,
    '=IF(COUNTA(C15,C17)=0,"",IF(C17=TRUE,"頚髄症疑い",IF(C15="両側","要確認",IF(C15="片側","神経根性","なし"))))');

  // ── NS-C: 主訴と経過 ──
  setHeader(sh, 22, 2, 'NS-C. 主訴と経過', 2);
  sh.getRange('B23').setValue('主症状').setFontWeight('bold');
  setDropdown(sh, 23, 3, ['頚部痛', '肩こり', '両方', '頭痛主体', '上肢症状主体']);
  sh.getRange('B24').setValue('日内変動').setFontWeight('bold');
  setDropdown(sh, 24, 3, ['朝強い', '夕強い', '動作後強い', '一定', '不規則']);
  sh.getRange('B25').setValue('悪化要因').setFontWeight('bold');
  sh.getRange('C25').setBackground(COLORS.MANUAL);
  sh.getRange('B26').setValue('緩和要因').setFontWeight('bold');
  setDropdown(sh, 26, 3, ['動かすと楽', '安静で楽', '温めると楽', '特になし']);

  // ── NS-D: 日常生活負荷 ──
  setHeader(sh, 28, 2, 'NS-D. 日常生活負荷', 2);
  sh.getRange('B29').setValue('PC作業時間/日').setFontWeight('bold');
  setDropdown(sh, 29, 3, ['ほぼなし', '1〜3時間', '4〜6時間', '7時間以上']);
  sh.getRange('B30').setValue('スマホ使用時間/日').setFontWeight('bold');
  setDropdown(sh, 30, 3, ['ほぼなし', '1〜2時間', '3〜4時間', '5時間以上']);
  sh.getRange('B31').setValue('運転時間/日').setFontWeight('bold');
  setDropdown(sh, 31, 3, ['ほぼなし', '30分未満', '1〜2時間', '3時間以上']);
  sh.getRange('B32').setValue('家事の主な内容').setFontWeight('bold');
  sh.getRange('C32').setBackground(COLORS.MANUAL);
  sh.getRange('B33').setValue('抱っこ・介護動作').setFontWeight('bold');
  setDropdown(sh, 33, 3, ['なし', '時々', '毎日']);
  sh.getRange('B34').setValue('生活負荷フラグ（自動）').setFontWeight('bold');
  setAutoCell(sh, 34, 3,
    '=IF(COUNTA(C29,C30)=0,"",IF(OR(C29="7時間以上",AND(C29="4〜6時間",C30="5時間以上")),"高","標準"))');

  // ── NS-E: 姿勢観察 ──
  setHeader(sh, 36, 2, 'NS-E. 姿勢観察', 2);
  sh.getRange('B37').setValue('前傾頭位の程度').setFontWeight('bold');
  setDropdown(sh, 37, 3, ['なし', '軽度', '中等度', '著明']);
  sh.getRange('B38').setValue('肩の高さの左右差').setFontWeight('bold');
  setDropdown(sh, 38, 3, ['なし', '軽度', '中等度']);
  sh.getRange('B39').setValue('肩甲骨の位置').setFontWeight('bold');
  setDropdown(sh, 39, 3, ['問題なし', '肩甲骨突出', '肩甲骨挙上', '両方']);
  sh.getRange('B40').setValue('胸椎後弯の増強').setFontWeight('bold');
  setDropdown(sh, 40, 3, ['なし', '軽度', '著明']);
  sh.getRange('B41').setValue('姿勢所見まとめ（自由記載）').setFontWeight('bold');
  sh.getRange('C41').setBackground(COLORS.MANUAL);

  // ── NS-F: 頚部 ROM ──
  setHeader(sh, 43, 2, 'NS-F. 頚部 ROM（6方向）', 2);
  const romDirections = ['屈曲', '伸展', '左側屈', '右側屈', '左回旋', '右回旋'];
  romDirections.forEach((dir, i) => {
    const row = 44 + i;
    sh.getRange(`B${row}`).setValue(dir).setFontWeight('bold');
    const choices = dir === '伸展'
      ? ['正常', '軽度制限', '著明制限', '疼痛再現']
      : ['正常', '軽度制限', '著明制限'];
    setDropdown(sh, row, 3, choices);
  });
  sh.getRange('B50').setValue('ROM制限型（自動）').setFontWeight('bold');
  setAutoCell(sh, 50, 3,
    '=IF(COUNTA(C44:C49)=0,"",IF(COUNTIF(C44:C49,"著明制限")>=4,"全方向制限型",' +
    'IF(C45="疼痛再現","疼痛誘発型",' +
    'IF(COUNTIF(C44:C49,"<>正常")>=2,"複合制限型",' +
    'IF(COUNTIF(C44:C49,"<>正常")=1,"単方向制限型","正常")))))');

  // ── NS-G: 簡易動作評価 ──
  setHeader(sh, 52, 2, 'NS-G. 簡易動作評価', 2);
  sh.getRange('B53').setValue('肩挙上（バンザイ）').setFontWeight('bold');
  setDropdown(sh, 53, 3, ['正常', '制限あり', '疼痛あり', '施行せず']);
  sh.getRange('B54').setValue('スパーリングテスト').setFontWeight('bold');
  setDropdown(sh, 54, 3, ['陰性', '陽性-同側', '陽性-対側', '施行せず']);
  sh.getRange('B55').setValue('肩甲骨リトラクション反応').setFontWeight('bold');
  setDropdown(sh, 55, 3, ['実施せず', '変化なし', '症状軽減']);
  sh.getRange('B56').setValue('チンタック反応').setFontWeight('bold');
  setDropdown(sh, 56, 3, ['実施せず', '変化なし', '症状軽減']);

  // ── NS-J: 総合判定（GAS 書き込み先）──
  setHeader(sh, 58, 2, 'NS-J. 総合判定', 2);
  sh.getRange('B59').setValue('総合方針判定').setFontWeight('bold');
  sh.getRange('C59').setBackground(COLORS.AUTO).setValue('（自動判定 — 未実行）');
  sh.getRange('B60').setValue('次の介入先').setFontWeight('bold');
  sh.getRange('C60').setBackground(COLORS.AUTO).setValue('（自動判定 — 未実行）');

  // ── NS-K: 自動生成コメント（GAS 書き込み先）──
  setHeader(sh, 62, 2, 'NS-K. 自動生成コメント', 2);
  const nsCommentLabels = [
    '評価まとめ',
    '注意すべき所見',
    '初回説明の方向性',
    '施術の優先順位',
    'セルフケア・運動療法の方向性',
    '再評価ポイント',
    '患者向け説明文',
    '医療連携を考えるべき条件',
  ];
  nsCommentLabels.forEach((label, i) => {
    const row = 63 + i;
    sh.getRange(`B${row}`).setValue(label).setFontWeight('bold');
    sh.getRange(`C${row}`).setBackground(COLORS.AUTO).setValue('（自動生成 — 未実行）');
    sh.getRange(`C${row}`).setWrap(true);
  });

  SpreadsheetApp.flush();
}


// ========== シート 3: 頚肩こり_コメントマスタ ==========

function setupNsCommentsSheet(ss) {
  const sh = getOrCreateSheet(ss, NS_SHEET_NAMES.NS_COMMENTS);
  sh.setColumnWidth(1, 220);  // A: コメントキー
  sh.setColumnWidth(2, 60);   // B: カテゴリ番号
  sh.setColumnWidth(3, 160);  // C: カテゴリ名
  sh.setColumnWidth(4, 500);  // D: コメント本文
  sh.setColumnWidth(5, 100);  // E: 対象読者
  sh.setColumnWidth(6, 200);  // F: 有効フラグ条件（メモ）
  sh.setColumnWidth(7, 100);  // G: 最終更新日

  // ヘッダー
  const headers = ['コメントキー', 'カテゴリ番号', 'カテゴリ名', 'コメント本文', '対象読者', '有効フラグ条件', '最終更新日'];
  headers.forEach((h, i) => {
    sh.getRange(1, i + 1).setValue(h)
      .setBackground(COLORS.HEADER)
      .setFontColor('#FFFFFF')
      .setFontWeight('bold');
  });

  // コメントデータ（COMMENT_DESIGN_neck_shoulder.md の内容）
  const today = '2026-03-26';
  const rows = [
    // ── カテゴリ 1: 評価まとめ ──
    ['NS_REDFLAG_SUMMARY',        1, '評価まとめ', '評価まとめ: 赤旗所見（{REDFLAG_TEXT}）が確認されています。施術開始前に医療連携の必要性を判断してください。', '施術者', 'NS_FLAG_REDFLAG', today],
    ['NS_MYELOPATHY_SUMMARY',     1, '評価まとめ', '評価まとめ: NRS {NRS} / 神経所見 {NERVE_LEVEL} / ROM {ROM_TYPE}。頚髄症を疑う所見があります。本日の施術は保留または最小限とし、整形外科受診を優先してください。', '施術者', 'NS_FLAG_MYELOPATHY', today],
    ['NS_RADICULOPATHY_SUMMARY',  1, '評価まとめ', '評価まとめ: NRS {NRS} / 放散 {RADIATE} / 神経所見 {NERVE_LEVEL} / ROM {ROM_TYPE}。神経根障害の可能性があるため、神経刺激回避を前提に進めてください。', '施術者', 'NS_FLAG_RADICULOPATHY', today],
    ['NS_CHRONIC_LIFE_SUMMARY',   1, '評価まとめ', '評価まとめ: NRS {NRS} / 発症期間 {ONSET_DURATION} / 生活負荷 {LIFESTYLE_FLAG}。慢性化と生活負荷の関与が強く、施術と生活習慣改善を並行して進める段階です。', '施術者', 'NS_FLAG_CHRONIC + NS_FLAG_LIFESTYLE_HIGH', today],
    ['NS_CHRONIC_SUMMARY',        1, '評価まとめ', '評価まとめ: NRS {NRS} / 発症期間 {ONSET_DURATION} / ROM {ROM_TYPE}。慢性期の頚肩症状で、セルフケア習慣化と姿勢再教育を軸に進めやすい状態です。', '施術者', 'NS_FLAG_CHRONIC', today],
    ['NS_LIFESTYLE_SUMMARY',      1, '評価まとめ', '評価まとめ: NRS {NRS} / 生活負荷 {LIFESTYLE_FLAG} / PC {PC_TIME} / スマホ {SMARTPHONE_TIME}。生活負荷が主な持続要因として疑われるため、施術と並行して負荷軽減指導を早期に入れてください。', '施術者', 'NS_FLAG_LIFESTYLE_HIGH', today],
    ['NS_STANDARD_SUMMARY',       1, '評価まとめ', '評価まとめ: NRS {NRS} / ROM {ROM_TYPE} / 生活負荷 {LIFESTYLE_FLAG}。神経症状は目立たず、施術中心で進めながらセルフケアを段階的に導入する状態です。', '施術者', '（標準）', today],
    // ── カテゴリ 2: 注意すべき所見 ──
    ['NS_REDFLAG_CAUTION',        2, '注意すべき所見', '頚部特有の危険所見（{REDFLAG_TEXT}）が報告されています。施術前に受診・精査を検討してください。', '施術者', 'NS_FLAG_REDFLAG', today],
    ['NS_MYELOPATHY_CAUTION',     2, '注意すべき所見', '頚髄症が疑われます。頚部への強い手技・牽引・急激な可動域操作は禁忌に準じます。整形外科（頸椎専門）への紹介を強く推奨します。', '施術者', 'NS_FLAG_MYELOPATHY', today],
    ['NS_RADICULOPATHY_CAUTION',  2, '注意すべき所見', '神経根障害の可能性があります（放散 {RADIATE} / 神経所見 {NERVE_LEVEL}）。施術後に上肢症状が増悪する場合は施術を中止し再評価してください。3〜4回で改善傾向がない場合は医療連携を検討します。', '施術者', 'NS_FLAG_RADICULOPATHY', today],
    ['NS_CHRONIC_LIFE_CAUTION',   2, '注意すべき所見', '生活負荷が高い状態が続き、慢性化を固定しやすい状況です。PC {PC_TIME} / スマホ {SMARTPHONE_TIME} / 運転 {DRIVE_TIME} を目安に、負担源を初回から具体化してください。', '施術者', 'NS_FLAG_CHRONIC + NS_FLAG_LIFESTYLE_HIGH', today],
    ['NS_CHRONIC_CAUTION',        2, '注意すべき所見', '慢性化した頚肩症状です。痛みの強さだけでなく、ROM {ROM_TYPE} とセルフケアの定着状況を継続的に確認してください。', '施術者', 'NS_FLAG_CHRONIC', today],
    ['NS_LIFESTYLE_CAUTION',      2, '注意すべき所見', '生活負荷が高い状態が症状の持続要因として疑われます。PC {PC_TIME} / スマホ {SMARTPHONE_TIME} / 運転 {DRIVE_TIME} を踏まえて、負荷軽減の指導を早期に組み込んでください。', '施術者', 'NS_FLAG_LIFESTYLE_HIGH', today],
    ['NS_STANDARD_CAUTION',       2, '注意すべき所見', '現時点で緊急性の高い所見はありません。症状の悪化・新たな神経症状が出現した場合は即座に再評価してください。', '施術者', '（標準）', today],
    // ── カテゴリ 3: 初回説明の方向性 ──
    ['NS_REDFLAG_EXPLAIN',        3, '初回説明の方向性', '説明の方向性: 危険所見（{REDFLAG_TEXT}）があるため、まず安全確認を優先すること、必要に応じて受診が必要になることを落ち着いて説明してください。', '施術者', 'NS_FLAG_REDFLAG', today],
    ['NS_MYELOPATHY_EXPLAIN',     3, '初回説明の方向性', '説明の方向性: 神経系に関わる可能性があることを伝え、精査の必要性を説明してください。「今すぐ危険ではないが確認が必要」というトーンで伝えると受け入れやすいです。', '施術者', 'NS_FLAG_MYELOPATHY', today],
    ['NS_RADICULOPATHY_EXPLAIN',  3, '初回説明の方向性', '説明の方向性: 「首の神経が少し刺激を受けている可能性がある」と伝え、避けるべき動き・姿勢を具体的に説明してください。', '施術者', 'NS_FLAG_RADICULOPATHY', today],
    ['NS_CHRONIC_EXPLAIN',        3, '初回説明の方向性', '説明の方向性: 「身体の使い方と生活習慣が関係していることが多い」と伝えてください。施術で症状を緩和しながら再発しにくい使い方を一緒に覚えていく方針を共有します。', '施術者', 'NS_FLAG_CHRONIC', today],
    ['NS_LIFESTYLE_EXPLAIN',      3, '初回説明の方向性', '説明の方向性: 「今の仕事・生活のパターンが首肩への負担を高めている可能性がある」と具体的に伝えてください。責める表現ではなく「少し工夫するだけで変わりやすい」という前向きなトーンで話します。', '施術者', 'NS_FLAG_LIFESTYLE_HIGH', today],
    ['NS_STANDARD_EXPLAIN',       3, '初回説明の方向性', '説明の方向性: 「なぜ首肩が凝るのか」の原因を分かりやすく伝え、施術と自分でできることの両輪で進める方針を共有してください。', '施術者', '（標準）', today],
    // ── カテゴリ 4: 施術の優先順位 ──
    ['NS_REDFLAG_PRIORITY',       4, '施術の優先順位', '施術の優先順位: 施術は保留または最小限とし、安全確認と受診勧奨を最優先にしてください。', '施術者', 'NS_FLAG_REDFLAG', today],
    ['NS_MYELOPATHY_PRIORITY',    4, '施術の優先順位', '施術の優先順位: 施術保留または最小限（頚部への強い刺激・牽引・操作を避ける）。安全確認と医療連携が最優先。', '施術者', 'NS_FLAG_MYELOPATHY', today],
    ['NS_RADICULOPATHY_PRIORITY', 4, '施術の優先順位', '施術の優先順位: 神経根への刺激を避けた筋緊張緩和 → 症状緩和後に可動域改善。伸展や同側への側屈・回旋は慎重に。', '施術者', 'NS_FLAG_RADICULOPATHY', today],
    ['NS_CHRONIC_LIFE_PRIORITY',  4, '施術の優先順位', '施術の優先順位: 筋緊張緩和＋生活指導（負荷軽減）→ 姿勢再教育 → セルフケア定着。1回あたり5分程度の指導時間を設けることを推奨。', '施術者', 'NS_FLAG_CHRONIC + NS_FLAG_LIFESTYLE_HIGH', today],
    ['NS_CHRONIC_PRIORITY',       4, '施術の優先順位', '施術の優先順位: 症状緩和 → 可動域改善 → セルフケア定着。再発予防を見据えて、施術とホームケアを同じ比重で進めてください。', '施術者', 'NS_FLAG_CHRONIC', today],
    ['NS_LIFESTYLE_PRIORITY',     4, '施術の優先順位', '施術の優先順位: 主訴部位の緊張緩和 → 生活負荷の調整 → 姿勢・作業環境の修正。短時間で継続しやすいセルフケア提案を優先してください。', '施術者', 'NS_FLAG_LIFESTYLE_HIGH', today],
    ['NS_STANDARD_PRIORITY',      4, '施術の優先順位', '施術の優先順位: 主訴部位の緊張緩和 → 可動域改善 → 姿勢・動作の再教育。症状が強ければ緩和優先。落ち着いたらセルフケア導入に移行。', '施術者', '（標準）', today],
    // ── カテゴリ 5: セルフケア・運動療法の方向性 ──
    ['NS_REDFLAG_SELFCARE',       5, 'セルフケア・運動療法', 'セルフケア: 自己判断で首を強く動かす運動やストレッチは控えてください。受診方針が固まるまでは負担を増やさないことを優先します。', '患者', 'NS_FLAG_REDFLAG', today],
    ['NS_MYELOPATHY_SELFCARE',    5, 'セルフケア・運動療法', '施術者の指示に従うこと。自己判断での首のストレッチ・体操は控えてください。精査結果が出てから判断します。', '患者', 'NS_FLAG_MYELOPATHY', today],
    ['NS_RADICULOPATHY_SELFCARE', 5, 'セルフケア・運動療法', '首に負担のかかる姿勢（うつぶせ・長時間の下向き）を避けてください。チンタック（あご引き運動）は症状が増悪しなければ1日5〜10回から試せます。', '患者', 'NS_FLAG_RADICULOPATHY', today],
    ['NS_CHRONIC_SELFCARE',       5, 'セルフケア・運動療法', 'チンタック（あご引き）＋肩甲骨リトラクション（肩甲骨を引く動作）を1日2〜3回、各10回を目安に行ってください。まず1種目から習慣化することを優先してください。', '患者', 'NS_FLAG_CHRONIC', today],
    ['NS_LIFESTYLE_SELFCARE',     5, 'セルフケア・運動療法', 'まず1時間に1回、30秒でいいので首・肩を動かす習慣をつけてください（立つ・伸ばす・あご引きなど）。スマホ・PCの持ち方・高さを少し調整するだけでも首への負担が変わります。', '患者', 'NS_FLAG_LIFESTYLE_HIGH', today],
    ['NS_STANDARD_SELFCARE',      5, 'セルフケア・運動療法', 'チンタック（あご引き）を1日3〜5回、各10回から始めてください。長時間同じ姿勢を避けることも合わせて意識してください。', '患者', '（標準）', today],
    // ── カテゴリ 6: 再評価ポイント ──
    ['NS_REDFLAG_REASSESS',       6, '再評価ポイント', '再評価: 危険所見（{REDFLAG_TEXT}）の持続や増悪、上肢症状・全身症状の変化を確認してください。受診結果が得られたら施術継続可否を再判断します。', '施術者', 'NS_FLAG_REDFLAG', today],
    ['NS_MYELOPATHY_REASSESS',    6, '再評価ポイント', '再評価: 手の巧緻性・握力・上肢放散の変化を確認。精査の結果と紹介先からの情報を確認の上、施術継続可否を判断してください。', '施術者', 'NS_FLAG_MYELOPATHY', today],
    ['NS_RADICULOPATHY_REASSESS', 6, '再評価ポイント', '再評価: 上肢放散・しびれの範囲・強さの変化を確認。3〜4回で改善傾向がなければ医療連携を検討。', '施術者', 'NS_FLAG_RADICULOPATHY', today],
    ['NS_CHRONIC_REASSESS',       6, '再評価ポイント', '再評価: NRSの変化＋ROMの変化＋セルフケア実行状況を確認。「生活負荷の改善が進んでいるか」を毎回確認してください。', '施術者', 'NS_FLAG_CHRONIC', today],
    ['NS_STANDARD_REASSESS',      6, '再評価ポイント', '再評価: NRSの変化＋主訴部位の緊張・ROMを確認。新たな神経症状の出現がないか毎回確認してください。', '施術者', '（標準）', today],
    // ── カテゴリ 7: 患者向け説明文 ──
    ['NS_REDFLAG_PATIENT',        7, '患者向け説明文', '今日の評価では、まず安全確認を優先した方がよい所見がありました。必要に応じて医療機関で確認しながら、今後の進め方を一緒に判断していきましょう。', '患者', 'NS_FLAG_REDFLAG', today],
    ['NS_MYELOPATHY_PATIENT',     7, '患者向け説明文', '今日の評価で、首の神経に少し注意が必要な所見がありました。詳しく調べてもらう必要があるため、専門の病院への受診をお勧めします。', '患者', 'NS_FLAG_MYELOPATHY', today],
    ['NS_RADICULOPATHY_PATIENT',  7, '患者向け説明文', '首の神経が少し刺激を受けている可能性があります。腕のしびれや痛みが強くなる動きは避けながら、少しずつ改善を目指していきましょう。', '患者', 'NS_FLAG_RADICULOPATHY', today],
    ['NS_CHRONIC_PATIENT',        7, '患者向け説明文', '首・肩の症状が続いているのは、身体の使い方や日常の習慣が関係していることが多いです。施術でつらさを和らげながら、少しずつ再発しにくい使い方を身につけていきましょう。', '患者', 'NS_FLAG_CHRONIC', today],
    ['NS_LIFESTYLE_PATIENT',      7, '患者向け説明文', 'お仕事やスマホの使い方が首・肩への負担を高めている可能性があります。ちょっとした姿勢の工夫と簡単な体操で、症状が落ち着きやすくなります。一緒に取り組んでいきましょう。', '患者', 'NS_FLAG_LIFESTYLE_HIGH', today],
    ['NS_STANDARD_PATIENT',       7, '患者向け説明文', '首・肩の症状は、姿勢や筋肉の疲れが積み重なって起きていることが多いです。施術で緊張をほぐしながら、日常生活の中でできるセルフケアも取り入れていきましょう。', '患者', '（標準）', today],
    // ── カテゴリ 8: 医療連携を考えるべき条件 ──
    ['NS_MYELOPATHY_REFERRAL',    8, '医療連携条件', '【医療連携: 強く推奨】頚髄症の可能性があります（手の巧緻性低下 / 両側上肢放散）。整形外科（頸椎専門・MRI施設）への紹介を今すぐ検討してください。', '施術者', 'NS_FLAG_MYELOPATHY', today],
    ['NS_REDFLAG_REFERRAL',       8, '医療連携条件', '【医療連携: 要検討】危険所見（{REDFLAG_TEXT}）があります。整形外科・内科への受診を勧奨し、経過を確認してから施術を継続するか判断してください。', '施術者', 'NS_FLAG_REDFLAG', today],
    ['NS_RADICULOPATHY_REFERRAL', 8, '医療連携条件', '【医療連携: 経過観察】神経根障害の可能性があります。3〜4回の施術で上肢症状の改善傾向がない場合は整形外科への紹介を検討してください。', '施術者', 'NS_FLAG_RADICULOPATHY', today],
    ['NS_STANDARD_REFERRAL',      8, '医療連携条件', '現時点で医療連携が必要な所見はありません。上肢の力が急に落ちた・しびれが急に強くなった・頭痛が急に悪化した場合は即座に再評価・受診勧奨を検討してください。', '施術者', '（標準）', today],
  ];

  // 行データを書き込む
  rows.forEach((rowData, i) => {
    sh.getRange(2 + i, 1, 1, rowData.length).setValues([rowData]);
    sh.getRange(2 + i, 4).setWrap(true);  // D列: コメント本文は折り返し
  });

  // 罫線
  sh.getRange(1, 1, 1 + rows.length, 7).setBorder(true, true, true, true, true, true);

  SpreadsheetApp.flush();
}

/**
 * 頚肩こり_コメントマスタをローカル正本の定義で live シートへ再同期する。
 * setupNsCommentsSheet() を正本として再利用し、既存シートを上書き更新する。
 */
function syncNsCommentMasterSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet() ||
    SpreadsheetApp.openById('1sj6dYtkFbnk4fjLOk764f-w7KUUeGNVYcbMDOg26OXY');
  const sh = getOrCreateSheet(ss, NS_SHEET_NAMES.NS_COMMENTS);

  sh.clearContents();
  setupNsCommentsSheet(ss);

  return {
    sheetName: NS_SHEET_NAMES.NS_COMMENTS,
    syncedRows: Math.max(sh.getLastRow() - 1, 0),
    syncedAt: new Date().toISOString(),
  };
}


// ========== シート 4: 頚肩こり_判定ロジック（下準備用・非表示）==========

function setupNsLogicSheet(ss) {
  const sh = getOrCreateSheet(ss, NS_SHEET_NAMES.NS_LOGIC);
  sh.setColumnWidth(1, 200);
  sh.setColumnWidth(2, 300);
  sh.setColumnWidth(3, 200);

  setHeader(sh, 1, 1, '頚肩こり_判定ロジック — 中間計算用（通常非表示）', 3);

  // フラグ計算の中間セル（GAS から参照される前提で構造だけ用意する）
  const flagRows = [
    ['NS_FLAG_REDFLAG',         '頚部赤旗スコア >= 1', '=IF(\'頚肩こり_初期評価\'!C12>=1,"TRUE","FALSE")'],
    ['NS_FLAG_MYELOPATHY',      '巧緻性低下 or 両側放散', '=IF(OR(\'頚肩こり_初期評価\'!C17=TRUE,\'頚肩こり_初期評価\'!C15="両側"),"TRUE","FALSE")'],
    ['NS_FLAG_RADICULOPATHY',   '神経根性（片側放散）', '=IF(\'頚肩こり_初期評価\'!C20="神経根性","TRUE","FALSE")'],
    ['NS_FLAG_CHRONIC',         '発症3か月以上', '=IF(\'共通_初期評価\'!C18="3か月以上","TRUE","FALSE")'],
    ['NS_FLAG_RECURRENT',       '再発 / 反復性', '=IF(OR(\'共通_初期評価\'!C20="再発",\'共通_初期評価\'!C20="反復性"),"TRUE","FALSE")'],
    ['NS_FLAG_LIFESTYLE_HIGH',  '生活負荷フラグ = 高', '=IF(\'頚肩こり_初期評価\'!C34="高","TRUE","FALSE")'],
    ['NS_FLAG_ROM_GLOBAL',      'ROM全方向制限型', '=IF(\'頚肩こり_初期評価\'!C50="全方向制限型","TRUE","FALSE")'],
    ['NS_FLAG_ROM_PAIN',        'ROM疼痛誘発型', '=IF(\'頚肩こり_初期評価\'!C50="疼痛誘発型","TRUE","FALSE")'],
    ['NS_FLAG_NRS_HIGH',        'NRS >= 7', '=IF(VALUE(\'共通_初期評価\'!C34)>=7,"TRUE","FALSE")'],
  ];

  setHeader(sh, 3, 1, 'フラグID', 1);
  setHeader(sh, 3, 2, '条件', 1);
  setHeader(sh, 3, 3, '計算値', 1);

  flagRows.forEach((row, i) => {
    sh.getRange(4 + i, 1).setValue(row[0]).setFontWeight('bold');
    sh.getRange(4 + i, 2).setValue(row[1]);
    sh.getRange(4 + i, 3).setFormula(row[2]).setBackground(COLORS.AUTO);
  });

  // 注記
  sh.getRange(14, 1).setValue('※ このシートはデバッグ用。GAS logic_engine_neck_shoulder.js が本番ロジックを担う。')
    .setFontStyle('italic').setFontColor('#888888');

  SpreadsheetApp.flush();
}


// ========== シート 5: 初期評価サマリー ==========

function setupSummarySheet(ss) {
  const sh = getOrCreateSheet(ss, NS_SHEET_NAMES.SUMMARY);
  sh.setColumnWidth(1, 180);
  sh.setColumnWidth(2, 200);
  sh.setColumnWidth(3, 200);
  sh.setColumnWidth(4, 200);

  setHeader(sh, 1, 1, '初期評価サマリー — JASSESS-01', 4);

  // 列ヘッダー
  const colHeaders = ['項目', '共通_初期評価', '腰痛_初期評価', '頚肩こり_初期評価'];
  colHeaders.forEach((h, i) => {
    sh.getRange(3, i + 1).setValue(h)
      .setBackground('#D9E1F2')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');
  });

  // サマリー行（共通_初期評価 + 各モジュールからの参照）
  const summaryRows = [
    ['評価日',     "='共通_初期評価'!C3",   '',  "='頚肩こり_初期評価'!C3"],
    ['患者ID',     "='共通_初期評価'!C4",   '',  "='頚肩こり_初期評価'!C4"],
    ['評価区分',   "='共通_初期評価'!C6",   '',  ''],
    ['評価症状',   "='共通_初期評価'!C7",   '',  ''],
    ['NRS（現在）',"='共通_初期評価'!C34",  "='腰痛評価入力'!C36", "='頚肩こり_初期評価'!C34"],
    ['共通赤旗スコア', "='共通_初期評価'!C31", '', ''],
    ['頚部赤旗スコア', '',                  '',  "='頚肩こり_初期評価'!C12"],
    ['神経症状レベル', '',                  "='腰痛評価入力'!C33", "='頚肩こり_初期評価'!C20"],
    ['ROM制限型',   '',                    "='腰痛評価入力'!C81", "='頚肩こり_初期評価'!C50"],
    ['生活負荷',    '',                    '',  "='頚肩こり_初期評価'!C34"],
    ['総合方針',    '',                    "='腰痛評価入力'!C95", "='頚肩こり_初期評価'!C59"],
    ['次の介入先',  '',                    '',  "='頚肩こり_初期評価'!C60"],
  ];

  summaryRows.forEach((row, i) => {
    const r = 4 + i;
    sh.getRange(r, 1).setValue(row[0]).setFontWeight('bold');
    if (row[1]) sh.getRange(r, 2).setFormula(row[1]).setBackground(COLORS.AUTO);
    else sh.getRange(r, 2).setValue('—').setFontColor('#AAAAAA');
    if (row[2]) sh.getRange(r, 3).setFormula(row[2]).setBackground(COLORS.AUTO);
    else sh.getRange(r, 3).setValue('—').setFontColor('#AAAAAA');
    if (row[3]) sh.getRange(r, 4).setFormula(row[3]).setBackground(COLORS.AUTO);
    else sh.getRange(r, 4).setValue('—').setFontColor('#AAAAAA');
  });

  // 注記
  sh.getRange(17, 1).setValue('※ 腰痛_初期評価 列は既存「腰痛評価入力」シートを参照。')
    .setFontStyle('italic').setFontColor('#888888');

  SpreadsheetApp.flush();
}


// ========== 既存シート: 設定 への追加 ==========

/**
 * 設定シートの末尾に頚肩こりセクションを追加する。
 * 既存行は変更しない。
 */
function addNsConfigRows(ss) {
  const sh = ss.getSheetByName(SHEET_NAMES.CONFIG);
  if (!sh) { Logger.log('[WARN] 設定シートが見つかりません。スキップします。'); return; }

  const lastRow = sh.getLastRow();
  const addAt = lastRow + 2;  // 1行空けてから追加

  // セクション区切り
  sh.getRange(addAt, 2).setValue('─────────────────────────').setFontColor('#888888');
  sh.getRange(addAt + 1, 2).setValue('[頚肩こりモジュール設定]')
    .setFontWeight('bold').setBackground('#E2EFDA');

  const nsConfigs = [
    ['NS: NRS高強度閾値',               '7'],
    ['NS: ROM制限（著明）判定値',        '著明制限'],
    ['NS: 生活負荷高リスク閾値（PC）',   '7時間以上'],
    ['NS: 放散方向 プルダウン選択肢',   'なし,片側,両側'],
    ['NS: ROM評価 プルダウン選択肢',    '正常,軽度制限,著明制限,疼痛再現'],
    ['NS: 前傾頭位 プルダウン選択肢',   'なし,軽度,中等度,著明'],
  ];

  nsConfigs.forEach((cfg, i) => {
    sh.getRange(addAt + 2 + i, 2).setValue(cfg[0]).setFontWeight('bold');
    sh.getRange(addAt + 2 + i, 3).setValue(cfg[1]).setBackground(COLORS.MANUAL);
  });

  SpreadsheetApp.flush();
}


// ========== 既存シート: 評価履歴 への列追加 ==========

/**
 * 評価履歴シートの右端に頚肩こり固有列を追加する。
 * 既存列は変更しない。
 */
function addNsHistoryColumns(ss) {
  const sh = ss.getSheetByName(SHEET_NAMES.HISTORY);
  if (!sh) { Logger.log('[WARN] 評価履歴シートが見つかりません。スキップします。'); return; }

  const nsHistoryCols = [
    'モジュール種別',
    'NS-NRS',
    'NS-神経症状レベル',
    'NS-ROM制限型',
    'NS-生活負荷フラグ',
    'NS-総合方針',
    'NS-次の介入先',
  ];

  const headerValues = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const existingStart = headerValues.indexOf(nsHistoryCols[0]);

  if (existingStart !== -1) {
    const existingHeaders = headerValues.slice(existingStart, existingStart + nsHistoryCols.length);
    const isComplete = nsHistoryCols.every((colName, i) => existingHeaders[i] === colName);
    if (isComplete) {
      Logger.log('[INFO] 評価履歴の NS 列は既存のため追加をスキップします。');
      return;
    }
    throw new Error('評価履歴シートの NS 列ヘッダーが部分一致しており、安全に自動追記できません。ヘッダー状態を確認してください。');
  }

  const addAt = sh.getLastColumn() + 1;

  nsHistoryCols.forEach((colName, i) => {
    sh.getRange(1, addAt + i)
      .setValue(colName)
      .setBackground('#D9E1F2')
      .setFontWeight('bold')
      .setHorizontalAlignment('center');
  });

  SpreadsheetApp.flush();
}
