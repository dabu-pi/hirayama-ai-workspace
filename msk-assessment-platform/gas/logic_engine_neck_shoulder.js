/**
 * logic_engine_neck_shoulder.js — 頚肩こり評価ルールベース判定エンジン (JASSESS-01)
 *
 * システム: 運動器初期評価システム / Phase 2: 頚肩こり評価モジュール
 * スプレッドシートID: 1sj6dYtkFbnk4fjLOk764f-w7KUUeGNVYcbMDOg26OXY
 *
 * 責務:
 *   - 共通_初期評価 / 頚肩こり_初期評価 の主要入力を読む
 *   - フラグ集計を行う
 *   - 総合方針判定を C59 / C60 に書き込む
 *   - 自動コメントを C63:C70 に書き込む
 *
 * 方針:
 *   - setup_neck_shoulder.js のセル番地を正本とする
 *   - 既存の腰痛 logic_engine.js とは完全に分離する
 *   - コメントは「キー選択」と「本文取得」を分離し、
 *     将来のコメントマスタ拡張に寄せやすい構造にする
 *
 * 最終更新: 2026-03-26（Phase C 初版実装）
 */

const NS_LOGIC_SPREADSHEET_ID = '1sj6dYtkFbnk4fjLOk764f-w7KUUeGNVYcbMDOg26OXY';

const NS_LOGIC_SHEETS = {
  COMMON_INPUT: '共通_初期評価',
  NS_INPUT: '頚肩こり_初期評価',
  NS_COMMENT_MASTER: '頚肩こり_コメントマスタ',
};

const NS_COMMON_CELLS = {
  EVAL_DATE: 'C3',
  PATIENT_ID: 'C4',
  ONSET_DURATION: 'C18',
  FIRST_OR_RECUR: 'C20',
  COMMON_REDFLAG_SCORE: 'C31',
  NRS_CURRENT: 'C34',
  NRS_WORST: 'C35',
  PSFS_AVG: 'C48',
};

const NS_INPUT_CELLS = {
  REDFLAG_SCORE: 'C12',
  RADIATE: 'C15',
  DISTRIBUTION: 'C16',
  DEXTERITY: 'C17',
  GRIP_WEAKNESS: 'C18',
  NERVE_LEVEL: 'C20',
  MAIN_SYMPTOM: 'C23',
  DIURNAL_VARIATION: 'C24',
  AGGRAVATE: 'C25',
  RELIEF: 'C26',
  PC_TIME: 'C29',
  SMARTPHONE_TIME: 'C30',
  DRIVE_TIME: 'C31',
  HOUSEWORK: 'C32',
  CARE_LOAD: 'C33',
  LIFESTYLE_FLAG: 'C34',
  HEAD_FORWARD: 'C37',
  SHOULDER_DIFF: 'C38',
  SCAPULA_POSITION: 'C39',
  KYPHOSIS: 'C40',
  POSTURE_NOTE: 'C41',
  ROM_FLEXION: 'C44',
  ROM_EXTENSION: 'C45',
  ROM_LEFT_BEND: 'C46',
  ROM_RIGHT_BEND: 'C47',
  ROM_LEFT_ROTATION: 'C48',
  ROM_RIGHT_ROTATION: 'C49',
  ROM_TYPE: 'C50',
  SHOULDER_RAISE: 'C53',
  SPURLING: 'C54',
  RETRACTION_RESPONSE: 'C55',
  CHIN_TUCK_RESPONSE: 'C56',
  RULE_RESULT: 'C59',
  NEXT_STEP: 'C60',
  CMT_SUMMARY: 'C63',
  CMT_CAUTION: 'C64',
  CMT_EXPLAIN: 'C65',
  CMT_PRIORITY: 'C66',
  CMT_SELFCARE: 'C67',
  CMT_REASSESS: 'C68',
  CMT_PATIENT: 'C69',
  CMT_REFERRAL: 'C70',
};

const NS_COMMON_TRIGGER_CELLS = new Set([
  'C3', 'C4',
  'C18', 'C20',
  'C23', 'C24', 'C25', 'C26', 'C27', 'C28', 'C29', 'C30',
  'C34', 'C35',
  'C42', 'C43', 'C44', 'C45', 'C46', 'C47',
]);

const NS_INPUT_TRIGGER_CELLS = new Set([
  'C7', 'C8', 'C9', 'C10', 'C11',
  'C15', 'C16', 'C17', 'C18', 'C19',
  'C23', 'C24', 'C25', 'C26',
  'C29', 'C30', 'C31', 'C32', 'C33',
  'C37', 'C38', 'C39', 'C40', 'C41',
  'C44', 'C45', 'C46', 'C47', 'C48', 'C49',
  'C53', 'C54', 'C55', 'C56',
]);

const NS_COMMENT_KEY_MATRIX = {
  NS_MYELOPATHY: {
    summary: 'NS_MYELOPATHY_SUMMARY',
    caution: 'NS_MYELOPATHY_CAUTION',
    explain: 'NS_MYELOPATHY_EXPLAIN',
    priority: 'NS_MYELOPATHY_PRIORITY',
    selfcare: 'NS_MYELOPATHY_SELFCARE',
    reassess: 'NS_MYELOPATHY_REASSESS',
    patient: 'NS_MYELOPATHY_PATIENT',
    referral: 'NS_MYELOPATHY_REFERRAL',
  },
  NS_REDFLAG: {
    summary: 'NS_REDFLAG_SUMMARY',
    caution: 'NS_REDFLAG_CAUTION',
    explain: 'NS_REDFLAG_EXPLAIN',
    priority: 'NS_REDFLAG_PRIORITY',
    selfcare: 'NS_REDFLAG_SELFCARE',
    reassess: 'NS_REDFLAG_REASSESS',
    patient: 'NS_REDFLAG_PATIENT',
    referral: 'NS_REDFLAG_REFERRAL',
  },
  NS_RADICULOPATHY: {
    summary: 'NS_RADICULOPATHY_SUMMARY',
    caution: 'NS_RADICULOPATHY_CAUTION',
    explain: 'NS_RADICULOPATHY_EXPLAIN',
    priority: 'NS_RADICULOPATHY_PRIORITY',
    selfcare: 'NS_RADICULOPATHY_SELFCARE',
    reassess: 'NS_RADICULOPATHY_REASSESS',
    patient: 'NS_RADICULOPATHY_PATIENT',
    referral: 'NS_RADICULOPATHY_REFERRAL',
  },
  NS_CHRONIC_LIFE: {
    summary: 'NS_CHRONIC_LIFE_SUMMARY',
    caution: 'NS_CHRONIC_LIFE_CAUTION',
    explain: 'NS_CHRONIC_EXPLAIN',
    priority: 'NS_CHRONIC_LIFE_PRIORITY',
    selfcare: 'NS_LIFESTYLE_SELFCARE',
    reassess: 'NS_CHRONIC_REASSESS',
    patient: 'NS_LIFESTYLE_PATIENT',
    referral: 'NS_STANDARD_REFERRAL',
  },
  NS_CHRONIC: {
    summary: 'NS_CHRONIC_SUMMARY',
    caution: 'NS_CHRONIC_CAUTION',
    explain: 'NS_CHRONIC_EXPLAIN',
    priority: 'NS_CHRONIC_PRIORITY',
    selfcare: 'NS_CHRONIC_SELFCARE',
    reassess: 'NS_CHRONIC_REASSESS',
    patient: 'NS_CHRONIC_PATIENT',
    referral: 'NS_STANDARD_REFERRAL',
  },
  NS_LIFESTYLE: {
    summary: 'NS_LIFESTYLE_SUMMARY',
    caution: 'NS_LIFESTYLE_CAUTION',
    explain: 'NS_LIFESTYLE_EXPLAIN',
    priority: 'NS_LIFESTYLE_PRIORITY',
    selfcare: 'NS_LIFESTYLE_SELFCARE',
    reassess: 'NS_STANDARD_REASSESS',
    patient: 'NS_LIFESTYLE_PATIENT',
    referral: 'NS_STANDARD_REFERRAL',
  },
  NS_STANDARD: {
    summary: 'NS_STANDARD_SUMMARY',
    caution: 'NS_STANDARD_CAUTION',
    explain: 'NS_STANDARD_EXPLAIN',
    priority: 'NS_STANDARD_PRIORITY',
    selfcare: 'NS_STANDARD_SELFCARE',
    reassess: 'NS_STANDARD_REASSESS',
    patient: 'NS_STANDARD_PATIENT',
    referral: 'NS_STANDARD_REFERRAL',
  },
};


// ========== ユーティリティ ==========

function nsToNum(value) {
  if (value === '' || value === null || value === undefined) return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
}

function nsGetSpreadsheet() {
  return SpreadsheetApp.openById(NS_LOGIC_SPREADSHEET_ID);
}

function nsGetRequiredSheets(ss) {
  const commonSheet = ss.getSheetByName(NS_LOGIC_SHEETS.COMMON_INPUT);
  const nsSheet = ss.getSheetByName(NS_LOGIC_SHEETS.NS_INPUT);
  const masterSheet = ss.getSheetByName(NS_LOGIC_SHEETS.NS_COMMENT_MASTER);
  return { commonSheet, nsSheet, masterSheet };
}

function nsA1ToRowCol(a1) {
  const match = /^([A-Z]+)(\d+)$/.exec(a1);
  if (!match) return null;
  const letters = match[1];
  let col = 0;
  for (let i = 0; i < letters.length; i += 1) {
    col = col * 26 + (letters.charCodeAt(i) - 64);
  }
  return { row: Number(match[2]), col };
}

function nsRangeTouchesTrigger(range, triggerCells) {
  const startRow = range.getRow();
  const endRow = startRow + range.getNumRows() - 1;
  const startCol = range.getColumn();
  const endCol = startCol + range.getNumColumns() - 1;

  for (const cell of triggerCells) {
    const pos = nsA1ToRowCol(cell);
    if (!pos) continue;
    if (pos.row >= startRow && pos.row <= endRow && pos.col >= startCol && pos.col <= endCol) {
      return true;
    }
  }
  return false;
}

function nsLoadCommentMasterMap(masterSheet) {
  const commentMap = new Map();
  if (!masterSheet) return commentMap;

  const values = masterSheet.getDataRange().getValues();
  for (let i = 1; i < values.length; i += 1) {
    const key = values[i][0];
    const text = values[i][3];
    if (key && text) {
      commentMap.set(String(key), String(text));
    }
  }
  return commentMap;
}


// ========== データ読取とフラグ集計 ==========

function nsReadDataAndFlags(commonSheet, nsSheet) {
  const commonGet = (cell) => commonSheet.getRange(cell).getValue();
  const nsGet = (cell) => nsSheet.getRange(cell).getValue();

  const positiveRedFlags = [];
  const nsRedFlagLabels = [
    ['C7', '雷鳴頭痛・急激な頭痛悪化'],
    ['C8', '進行性の上肢筋力低下'],
    ['C9', '嚥下障害・構音障害'],
    ['C10', 'めまい（頭位変換時）'],
    ['C11', '外傷後の頚部強い疼痛'],
  ];
  nsRedFlagLabels.forEach(([cell, label]) => {
    if (nsGet(cell) === true) positiveRedFlags.push(label);
  });

  const data = {
    evalDate: commonGet(NS_COMMON_CELLS.EVAL_DATE),
    patientId: commonGet(NS_COMMON_CELLS.PATIENT_ID),
    onsetDuration: commonGet(NS_COMMON_CELLS.ONSET_DURATION),
    firstOrRecur: commonGet(NS_COMMON_CELLS.FIRST_OR_RECUR),
    commonRedFlagScore: nsToNum(commonGet(NS_COMMON_CELLS.COMMON_REDFLAG_SCORE)) ?? 0,
    nrsCurrent: nsToNum(commonGet(NS_COMMON_CELLS.NRS_CURRENT)),
    nrsWorst: nsToNum(commonGet(NS_COMMON_CELLS.NRS_WORST)),
    psfsAverage: nsToNum(commonGet(NS_COMMON_CELLS.PSFS_AVG)),

    nsRedFlagScore: nsToNum(nsGet(NS_INPUT_CELLS.REDFLAG_SCORE)) ?? 0,
    positiveRedFlags,
    radiate: nsGet(NS_INPUT_CELLS.RADIATE),
    distribution: nsGet(NS_INPUT_CELLS.DISTRIBUTION),
    dexterity: nsGet(NS_INPUT_CELLS.DEXTERITY) === true,
    gripWeakness: nsGet(NS_INPUT_CELLS.GRIP_WEAKNESS) === true,
    nerveLevel: nsGet(NS_INPUT_CELLS.NERVE_LEVEL),
    mainSymptom: nsGet(NS_INPUT_CELLS.MAIN_SYMPTOM),
    diurnalVariation: nsGet(NS_INPUT_CELLS.DIURNAL_VARIATION),
    aggravate: nsGet(NS_INPUT_CELLS.AGGRAVATE),
    relief: nsGet(NS_INPUT_CELLS.RELIEF),
    pcTime: nsGet(NS_INPUT_CELLS.PC_TIME),
    smartphoneTime: nsGet(NS_INPUT_CELLS.SMARTPHONE_TIME),
    driveTime: nsGet(NS_INPUT_CELLS.DRIVE_TIME),
    housework: nsGet(NS_INPUT_CELLS.HOUSEWORK),
    careLoad: nsGet(NS_INPUT_CELLS.CARE_LOAD),
    lifestyleFlag: nsGet(NS_INPUT_CELLS.LIFESTYLE_FLAG),
    headForward: nsGet(NS_INPUT_CELLS.HEAD_FORWARD),
    shoulderDiff: nsGet(NS_INPUT_CELLS.SHOULDER_DIFF),
    scapulaPosition: nsGet(NS_INPUT_CELLS.SCAPULA_POSITION),
    kyphosis: nsGet(NS_INPUT_CELLS.KYPHOSIS),
    postureNote: nsGet(NS_INPUT_CELLS.POSTURE_NOTE),
    romType: nsGet(NS_INPUT_CELLS.ROM_TYPE),
    shoulderRaise: nsGet(NS_INPUT_CELLS.SHOULDER_RAISE),
    spurling: nsGet(NS_INPUT_CELLS.SPURLING),
    retractionResponse: nsGet(NS_INPUT_CELLS.RETRACTION_RESPONSE),
    chinTuckResponse: nsGet(NS_INPUT_CELLS.CHIN_TUCK_RESPONSE),
  };

  const flags = {
    NS_FLAG_REDFLAG: data.nsRedFlagScore >= 1 || data.commonRedFlagScore >= 1,
    NS_FLAG_MYELOPATHY: data.dexterity || data.radiate === '両側' || data.nerveLevel === '頚髄症疑い',
    NS_FLAG_RADICULOPATHY: data.nerveLevel === '神経根性' || data.radiate === '片側',
    NS_FLAG_CHRONIC: data.onsetDuration === '3か月以上',
    NS_FLAG_RECURRENT: data.firstOrRecur === '再発' || data.firstOrRecur === '反復性',
    NS_FLAG_LIFESTYLE_HIGH: data.lifestyleFlag === '高',
    NS_FLAG_ROM_GLOBAL: data.romType === '全方向制限型',
    NS_FLAG_ROM_PAIN: data.romType === '疼痛誘発型',
    NS_FLAG_NRS_HIGH: data.nrsCurrent !== null && data.nrsCurrent >= 7,
    NS_FLAG_NRS_MID: data.nrsCurrent !== null && data.nrsCurrent >= 4 && data.nrsCurrent < 7,
  };

  return { data, flags };
}

function nsHasMeaningfulInput(data) {
  return Boolean(
    data.evalDate ||
    data.patientId ||
    data.mainSymptom ||
    data.aggravate ||
    data.pcTime ||
    data.smartphoneTime ||
    data.romType ||
    data.nsRedFlagScore > 0 ||
    data.commonRedFlagScore > 0 ||
    data.nrsCurrent !== null
  );
}


// ========== 総合方針判定 ==========

function nsSelectProfile(flags) {
  if (flags.NS_FLAG_MYELOPATHY) return 'NS_MYELOPATHY';
  if (flags.NS_FLAG_REDFLAG) return 'NS_REDFLAG';
  if (flags.NS_FLAG_RADICULOPATHY) return 'NS_RADICULOPATHY';
  if (flags.NS_FLAG_CHRONIC && flags.NS_FLAG_LIFESTYLE_HIGH) return 'NS_CHRONIC_LIFE';
  if (flags.NS_FLAG_CHRONIC) return 'NS_CHRONIC';
  if (flags.NS_FLAG_LIFESTYLE_HIGH) return 'NS_LIFESTYLE';
  return 'NS_STANDARD';
}

function nsDeterminePolicy(flags) {
  if (flags.NS_FLAG_MYELOPATHY) {
    return {
      policy: '頚髄症疑い：施術は保留または最小限とし、整形外科受診を優先してください',
      nextStep: '医療連携',
      profile: 'NS_MYELOPATHY',
    };
  }
  if (flags.NS_FLAG_REDFLAG) {
    return {
      policy: '医療連携を優先してください（頚部危険所見あり）',
      nextStep: '医療連携',
      profile: 'NS_REDFLAG',
    };
  }
  if (flags.NS_FLAG_RADICULOPATHY && flags.NS_FLAG_NRS_HIGH) {
    return {
      policy: '神経根性症状・疼痛コントロール優先：神経刺激を避けた施術から開始してください',
      nextStep: '施術（神経根対応）',
      profile: 'NS_RADICULOPATHY',
    };
  }
  if (flags.NS_FLAG_RADICULOPATHY) {
    return {
      policy: '神経根性症状あり：施術と段階的なセルフケア導入を並行してください',
      nextStep: '施術＋セルフケア',
      profile: 'NS_RADICULOPATHY',
    };
  }
  if (flags.NS_FLAG_CHRONIC && flags.NS_FLAG_LIFESTYLE_HIGH) {
    return {
      policy: '慢性期・生活負荷高：施術と生活指導を並行して進めてください',
      nextStep: '施術＋生活指導',
      profile: 'NS_CHRONIC_LIFE',
    };
  }
  if (flags.NS_FLAG_CHRONIC && flags.NS_FLAG_RECURRENT) {
    return {
      policy: '慢性期・再発型：セルフケア習慣化と再発予防を重点に進めてください',
      nextStep: '施術＋運動療法初回評価',
      profile: 'NS_CHRONIC',
    };
  }
  if (flags.NS_FLAG_CHRONIC) {
    return {
      policy: '慢性期：姿勢再教育とセルフケア習慣化を軸に進めてください',
      nextStep: '施術＋セルフケア',
      profile: 'NS_CHRONIC',
    };
  }
  if (flags.NS_FLAG_LIFESTYLE_HIGH) {
    return {
      policy: '生活負荷高：施術と負荷軽減指導から始めてください',
      nextStep: '施術＋生活指導',
      profile: 'NS_LIFESTYLE',
    };
  }
  return {
    policy: '施術中心で症状緩和から始めてください',
    nextStep: '施術',
    profile: 'NS_STANDARD',
  };
}


// ========== コメント生成 ==========

function nsBuildDataSummary(data) {
  const parts = [];
  if (data.nrsCurrent !== null) parts.push(`NRS ${data.nrsCurrent}/10`);
  if (data.onsetDuration) parts.push(`発症期間 ${data.onsetDuration}`);
  if (data.romType) parts.push(`ROM ${data.romType}`);
  if (data.lifestyleFlag) parts.push(`生活負荷 ${data.lifestyleFlag}`);
  return parts.join(' / ');
}

function nsBuildRedFlagText(data) {
  if (data.positiveRedFlags.length > 0) return data.positiveRedFlags.join(' / ');
  if (data.commonRedFlagScore > 0) return '共通赤旗スコア陽性';
  return '危険所見';
}

function nsBuildCommentContext(data, flags, decision) {
  return {
    POLICY: decision.policy || '',
    NEXT_STEP: decision.nextStep || '',
    PROFILE: decision.profile || '',
    MAIN_SYMPTOM: data.mainSymptom || '頚肩こり',
    NRS: data.nrsCurrent !== null ? `${data.nrsCurrent}/10` : '未入力',
    NRS_WORST: data.nrsWorst !== null ? `${data.nrsWorst}/10` : '未入力',
    ONSET_DURATION: data.onsetDuration || '未記載',
    FIRST_OR_RECUR: data.firstOrRecur || '未記載',
    REDFLAG_TEXT: nsBuildRedFlagText(data),
    REDFLAG_SCORE: String(data.nsRedFlagScore ?? 0),
    COMMON_REDFLAG_SCORE: String(data.commonRedFlagScore ?? 0),
    NERVE_LEVEL: data.nerveLevel || 'なし',
    RADIATE: data.radiate || 'なし',
    DISTRIBUTION: data.distribution || 'なし',
    ROM_TYPE: data.romType || '未評価',
    LIFESTYLE_FLAG: data.lifestyleFlag || '標準',
    PC_TIME: data.pcTime || '未記載',
    SMARTPHONE_TIME: data.smartphoneTime || '未記載',
    DRIVE_TIME: data.driveTime || '未記載',
    AGGRAVATE: data.aggravate || '未記載',
    RELIEF: data.relief || '未記載',
    PSFS: data.psfsAverage !== null ? String(data.psfsAverage) : '未入力',
    HAS_MYELOPATHY: flags.NS_FLAG_MYELOPATHY ? 'あり' : 'なし',
    HAS_RADICULOPATHY: flags.NS_FLAG_RADICULOPATHY ? 'あり' : 'なし',
    HAS_REDFLAG: flags.NS_FLAG_REDFLAG ? 'あり' : 'なし',
    HAS_CHRONIC: flags.NS_FLAG_CHRONIC ? 'あり' : 'なし',
    HAS_LIFESTYLE_HIGH: flags.NS_FLAG_LIFESTYLE_HIGH ? 'あり' : 'なし',
  };
}

function nsRenderCommentTemplate(template, context) {
  if (!template) return template;
  return String(template).replace(/\{([A-Z0-9_]+)\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(context, key)) {
      return context[key];
    }
    return match;
  });
}

function nsBuildFallbackComments(data, flags, decision) {
  const summarySuffix = nsBuildDataSummary(data);
  const redFlagText = nsBuildRedFlagText(data);

  return {
    summary: `評価まとめ: ${decision.policy}${summarySuffix ? `\n【補足】${summarySuffix}` : ''}`,
    caution: flags.NS_FLAG_REDFLAG
      ? `危険所見（${redFlagText}）があります。施術前に受診・精査の要否を確認してください。`
      : '現時点で緊急性の高い所見はありません。症状の悪化や新たな神経症状が出た場合は即座に再評価してください。',
    explain: flags.NS_FLAG_REDFLAG
      ? '説明の方向性: 安全確認を優先し、必要に応じて専門医受診が必要な状態であることを落ち着いて説明してください。'
      : `説明の方向性: 主症状は「${data.mainSymptom || '頚肩こり'}」で、現在は「${decision.policy}」の段階であることを共有してください。`,
    priority: flags.NS_FLAG_REDFLAG
      ? '施術の優先順位: 施術は保留または最小限とし、安全確認と医療連携を最優先にしてください。'
      : `施術の優先順位: まず ${decision.nextStep} を意識しつつ、主訴部位の緊張緩和と負担軽減から進めてください。`,
    selfcare: flags.NS_FLAG_MYELOPATHY
      ? 'セルフケア: 自己判断での首のストレッチや強い体操は控えてください。精査結果が出てから再判断します。'
      : 'セルフケア: 長時間の同一姿勢を避け、症状が悪化しない範囲で軽い首肩の運動を段階的に始めてください。',
    reassess: '再評価: NRS、ROM、上肢症状の変化、セルフケア実行状況、生活負荷の調整状況を確認してください。',
    patient: flags.NS_FLAG_REDFLAG
      ? '今日の評価では安全確認を優先した方がよい所見がありました。必要に応じて専門の医療機関で確認しながら進めていきましょう。'
      : '首・肩の症状は、姿勢や生活負荷が関わることが多いです。施術と日常生活の工夫を一緒に進めていきましょう。',
    referral: flags.NS_FLAG_REDFLAG
      ? `【医療連携: 要検討】${redFlagText} が確認されています。受診勧奨を優先してください。`
      : '現時点で医療連携が必要な所見はありません。しびれ増悪・急な筋力低下・頭痛急変があれば即再評価してください。',
  };
}

function nsSelectCommentKeys(decisionProfile) {
  return NS_COMMENT_KEY_MATRIX[decisionProfile] || NS_COMMENT_KEY_MATRIX.NS_STANDARD;
}

function nsResolveCommentText(commentMap, key, fallbackText, context) {
  const baseText = (key && commentMap.has(key)) ? commentMap.get(key) : fallbackText;
  return nsRenderCommentTemplate(baseText, context);
}

function nsGenerateComments(data, flags, decision, commentMap) {
  const fallbacks = nsBuildFallbackComments(data, flags, decision);
  const keys = nsSelectCommentKeys(decision.profile || nsSelectProfile(flags));
  const context = nsBuildCommentContext(data, flags, decision);

  return {
    summary: nsResolveCommentText(commentMap, keys.summary, fallbacks.summary, context),
    caution: nsResolveCommentText(commentMap, keys.caution, fallbacks.caution, context),
    explain: nsResolveCommentText(commentMap, keys.explain, fallbacks.explain, context),
    priority: nsResolveCommentText(commentMap, keys.priority, fallbacks.priority, context),
    selfcare: nsResolveCommentText(commentMap, keys.selfcare, fallbacks.selfcare, context),
    reassess: nsResolveCommentText(commentMap, keys.reassess, fallbacks.reassess, context),
    patient: nsResolveCommentText(commentMap, keys.patient, fallbacks.patient, context),
    referral: nsResolveCommentText(commentMap, keys.referral, fallbacks.referral, context),
  };
}


// ========== 書き込み ==========

function nsWriteResults(nsSheet, decision, comments) {
  const autoColor = (typeof COLORS !== 'undefined' && COLORS.AUTO) ? COLORS.AUTO : '#EDEDED';

  nsSheet.getRange(NS_INPUT_CELLS.RULE_RESULT)
    .setValue(decision.policy)
    .setBackground(autoColor)
    .setWrap(true);

  nsSheet.getRange(NS_INPUT_CELLS.NEXT_STEP)
    .setValue(decision.nextStep)
    .setBackground(autoColor)
    .setWrap(true);

  const commentValues = [
    [comments.summary],
    [comments.caution],
    [comments.explain],
    [comments.priority],
    [comments.selfcare],
    [comments.reassess],
    [comments.patient],
    [comments.referral],
  ];

  nsSheet.getRange(63, 3, 8, 1)
    .setValues(commentValues)
    .setBackground(autoColor)
    .setWrap(true);
}


// ========== エントリポイント ==========

function runNeckShoulderLogicAll() {
  const ss = nsGetSpreadsheet();
  const { commonSheet, nsSheet, masterSheet } = nsGetRequiredSheets(ss);
  if (!commonSheet || !nsSheet) {
    Logger.log('[NS] 共通_初期評価 または 頚肩こり_初期評価 が見つかりません。');
    return null;
  }

  SpreadsheetApp.flush();

  const { data, flags } = nsReadDataAndFlags(commonSheet, nsSheet);
  if (!nsHasMeaningfulInput(data)) {
    Logger.log('[NS] meaningful input がないため、頚肩こりロジック実行をスキップしました。');
    return null;
  }

  const decision = nsDeterminePolicy(flags);
  const commentMap = nsLoadCommentMasterMap(masterSheet);
  const comments = nsGenerateComments(data, flags, decision, commentMap);
  nsWriteResults(nsSheet, decision, comments);

  return { data, flags, decision, comments };
}

function nsRunLogicAll() {
  return runNeckShoulderLogicAll();
}

function nsOnEdit(e) {
  if (!e || !e.range) return;

  const sheet = e.range.getSheet();
  const sheetName = sheet.getName();

  const isCommonEdit = sheetName === NS_LOGIC_SHEETS.COMMON_INPUT &&
    nsRangeTouchesTrigger(e.range, NS_COMMON_TRIGGER_CELLS);
  const isNsEdit = sheetName === NS_LOGIC_SHEETS.NS_INPUT &&
    nsRangeTouchesTrigger(e.range, NS_INPUT_TRIGGER_CELLS);

  if (!isCommonEdit && !isNsEdit) return;

  SpreadsheetApp.flush();
  runNeckShoulderLogicAll();
}
