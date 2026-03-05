/**
 * フェーズ1：hawkメール → スプレッドシート自動記録（B列/D列精度UP版）
 *
 * - A列：Message-ID（RFCヘッダ優先 / 取れなければGmail内部ID）
 * - B列：お客様名（件名の括弧内 > 本文の宛名 > 株式会社系 > 要確認）
 * - C列：発生日（受信日）
 * - D列：取引内容（明細から品目名を抽出。無理なら件名＋本文冒頭）
 * - E列：長谷川（固定）
 * - O列：表示「長谷川」で「メール1通」直リンク
 * - 処理後：Gmailラベル付与で再処理防止
 */

/** lines_json 入力ヘルパーシートの設定 */
const LINES_JSON_HELPER = {
  SHEET_NAME: 'lines_json作成',
  TARGET_ROW_CELL: 'C1',    // 転記先行番号を入力するセル
  INPUT_START_ROW: 4,       // 品目入力の開始行
  INPUT_END_ROW: 13,        // 品目入力の終了行（最大10件）
  OUTPUT_CELL: 'A16',       // 生成JSONの出力セル
  INTERNAL_COL: 5,          // E列：行ごとの内部JSON（非表示）
};

const CONFIG = {
  SPREADSHEET_ID: '1TMKQO4zYwk1kWgkfoCR4K7jTeIxNxsS1B8uh7t8nd2c',
  SHEET_NAME: '2024長谷川さん',
  HAWK_EMAIL: 'hawk@pop13.odn.ne.jp',
  PROCESSED_LABEL: 'processed_hawk_estimate',
  SEARCH_DAYS: 60,
  MAX_THREADS_PER_RUN: 50,
  START_ROW: 2
};

function phase1_recordHawkMailsToSheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) throw new Error('指定シートが見つかりません: ' + CONFIG.SHEET_NAME);

  const label = getOrCreateGmailLabel_(CONFIG.PROCESSED_LABEL);

  // A列の既存ID（Message-ID）をSet化
  const existingIdSet = loadExistingIdsFromColA_(sheet);

  const query = [
    `from:${CONFIG.HAWK_EMAIL}`,
    `-label:${CONFIG.PROCESSED_LABEL}`,
    `newer_than:${CONFIG.SEARCH_DAYS}d`
  ].join(' ');

  const threads = GmailApp.search(query, 0, CONFIG.MAX_THREADS_PER_RUN);
  threads.reverse();

  let appended = 0;

  for (const thread of threads) {
    const msg = pickLatestMessageFrom_(thread, CONFIG.HAWK_EMAIL);
    if (!msg) continue;

    const messageId = getRfcMessageIdOrFallback_(msg); // A列用（重複防止）
    if (existingIdSet.has(messageId)) {
      thread.addLabel(label);
      continue;
    }

    const receivedDate = msg.getDate();
    const subject = msg.getSubject() || '';
    const body = msg.getPlainBody() || '';

    // ★B列：顧客名（強化）
    const customerName = extractCustomerNameV2_(subject, body) || '要確認';

    // ★D列：案件内容（強化：明細から品目）
    const itemName = extractMainItemFromBody_(body);
    const tradeSummary = itemName ? itemName : buildTradeSummaryFallback_(subject, body);

    // ★Q列：見積明細JSON（自動抽出。抽出失敗時は空文字＝手入力）
    const linesJson = extractLinesJsonFromBody_(body);

    // O列：メール1通直リンク
    const gmailInternalId = String(msg.getId());
    const messageUrl = buildGmailMessageUrl_(gmailInternalId);

    appendRow_(sheet, {
      messageId,
      customerName,
      receivedDate,
      tradeSummary,
      personFixed: '長谷川',
      linkUrl: messageUrl,
      linesJson,
    });

    existingIdSet.add(messageId);

    // 処理済みラベル付与（スレッド単位）
    thread.addLabel(label);

    appended++;
  }

  Logger.log(`phase1 done. appended=${appended}, scannedThreads=${threads.length}`);
}

function phase1_rebuildFromProcessedLabel() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) throw new Error('指定シートが見つかりません: ' + CONFIG.SHEET_NAME);

  const existingIdSet = loadExistingIdsFromColA_(sheet);

  const query = [
    `from:${CONFIG.HAWK_EMAIL}`,
    `label:${CONFIG.PROCESSED_LABEL}`,
    `newer_than:${CONFIG.SEARCH_DAYS}d`
  ].join(' ');

  const threads = GmailApp.search(query, 0, 500);
  threads.reverse();

  let appended = 0;

  for (const thread of threads) {
    const msg = pickLatestMessageFrom_(thread, CONFIG.HAWK_EMAIL);
    if (!msg) continue;

    const messageId = getRfcMessageIdOrFallback_(msg);
    if (existingIdSet.has(messageId)) continue;

    const receivedDate = msg.getDate();
    const subject = msg.getSubject() || '';
    const body = msg.getPlainBody() || '';

    const customerName = extractCustomerNameV2_(subject, body) || '要確認';

    const itemName = extractMainItemFromBody_(body);
    const tradeSummary = itemName ? itemName : buildTradeSummaryFallback_(subject, body);

    // ★Q列：見積明細JSON（自動抽出）
    const linesJson = extractLinesJsonFromBody_(body);

    const gmailInternalId = String(msg.getId());
    const messageUrl = buildGmailMessageUrl_(gmailInternalId);

    appendRow_(sheet, {
      messageId,
      customerName,
      receivedDate,
      tradeSummary,
      personFixed: '長谷川',
      linkUrl: messageUrl,
      linesJson,
    });

    existingIdSet.add(messageId);
    appended++;
  }

  Logger.log(`rebuild done. appended=${appended}, scannedThreads=${threads.length}`);
}

function onOpen(e) {
  try {
    SpreadsheetApp.getUi()
      .createMenu('見積自動化')
      .addItem('フェーズ1実行（hawk→台帳）', 'phase1_recordHawkMailsToSheet')
      .addItem('復元：ラベル済みから再取り込み', 'phase1_rebuildFromProcessedLabel')
      .addItem('時間トリガー作成（10分おき）', 'installPhase1Trigger_10min')
      .addSeparator()
      .addItem('lines_json入力シートを開く', 'openLinesJsonSheet')
      .addItem('lines_json → Q列に転記', 'applyLinesJsonToRow')
      .addSeparator()
      .addItem('フェーズ2実行（freee見積書作成）', 'freee_phase2_processPendingQuotations')
      .addItem('フェーズ2テスト（1件・台帳更新なし）', 'freee_testPhase2')
      .addSeparator()
      .addItem('フェーズ3実行（見積済み→Gmail下書き）', 'phase3_createDraftsForQuotedRows')
      .addItem('フェーズ3テスト（1件・T列更新なし）', 'phase3_testDraft')
      .addToUi();
  } catch (err) {}
}

/**
 * lines_json入力ヘルパーシートを開く（なければ自動作成）
 */
function openLinesJsonSheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let sheet = ss.getSheetByName(LINES_JSON_HELPER.SHEET_NAME);
  if (!sheet) {
    sheet = buildLinesJsonSheet_(ss);
    SpreadsheetApp.getUi().alert(
      `"${LINES_JSON_HELPER.SHEET_NAME}" シートを作成しました。\n\n` +
      `【使い方】\n` +
      `1. C1セルに転記先の行番号を入力\n` +
      `2. 品目名・単価・数量・税率を入力（自動でJSONが生成されます）\n` +
      `3. メニュー「lines_json → Q列に転記」を実行`
    );
  }
  ss.setActiveSheet(sheet);
}

/**
 * ヘルパーシートのlines_jsonを台帳シートのQ列（17列）に転記する
 * C1セルに転記先行番号を事前入力しておくこと
 */
function applyLinesJsonToRow() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const ui = SpreadsheetApp.getUi();

  const helperSheet = ss.getSheetByName(LINES_JSON_HELPER.SHEET_NAME);
  if (!helperSheet) {
    ui.alert(`"${LINES_JSON_HELPER.SHEET_NAME}" シートが見つかりません。\nまず「lines_json入力シートを開く」を実行してください。`);
    return;
  }

  // 転記先行番号を確認
  const targetRow = parseInt(helperSheet.getRange(LINES_JSON_HELPER.TARGET_ROW_CELL).getValue(), 10);
  if (isNaN(targetRow) || targetRow < 2) {
    ui.alert(`${LINES_JSON_HELPER.TARGET_ROW_CELL}セルに転記先の行番号（2以上の整数）を入力してください。`);
    return;
  }

  // 生成されたJSONを取得
  const jsonStr = String(helperSheet.getRange(LINES_JSON_HELPER.OUTPUT_CELL).getValue() || '').trim();
  if (!jsonStr.startsWith('[')) {
    ui.alert('有効なlines_jsonが生成されていません。\n品目名と単価を入力してください。');
    return;
  }

  // 台帳シートへ書き込み
  const mainSheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!mainSheet) {
    ui.alert(`台帳シート "${CONFIG.SHEET_NAME}" が見つかりません。`);
    return;
  }

  // 既存値がある場合は上書き確認
  const existing = String(mainSheet.getRange(targetRow, 17).getValue() || '').trim();
  if (existing) {
    const answer = ui.alert(
      `行${targetRow}のQ列には既に値があります。上書きしますか？\n\n既存値: ${existing.slice(0, 80)}`,
      ui.ButtonSet.YES_NO
    );
    if (answer !== ui.Button.YES) return;
  }

  mainSheet.getRange(targetRow, 17).setValue(jsonStr);
  ui.alert(`行${targetRow} のQ列にlines_jsonを転記しました。\n内容を確認後、フェーズ2を実行してください。`);
}

/**
 * lines_json入力ヘルパーシートを作成する（内部関数）
 */
function buildLinesJsonSheet_(ss) {
  const h = LINES_JSON_HELPER;
  const sheet = ss.insertSheet(h.SHEET_NAME);

  // --- 転記先行番号 ---
  sheet.getRange('A1').setValue('転記先行番号（台帳の行番号）:').setFontWeight('bold');
  sheet.getRange(h.TARGET_ROW_CELL).setValue(2)
    .setBackground('#fff2cc')
    .setFontWeight('bold')
    .setHorizontalAlignment('center');
  sheet.getRange('A1:B1').merge();

  // --- ヘッダー ---
  sheet.getRange('A3:D3').setValues([['品目名', '単価（円）', '数量', '税率（%）']]);
  sheet.getRange('A3:D3')
    .setFontWeight('bold')
    .setBackground('#c9daf8')
    .setHorizontalAlignment('center');

  // --- 入力行（初期値） ---
  for (let r = h.INPUT_START_ROW; r <= h.INPUT_END_ROW; r++) {
    sheet.getRange(r, 3).setValue(1);   // 数量デフォルト: 1
    sheet.getRange(r, 4).setValue(10);  // 税率デフォルト: 10%
    sheet.getRange(r, 1, 1, 4).setBorder(true, true, true, true, true, true);

    // E列: 行ごとのJSON（非表示・内部用）
    // unit_price は freee IV API が文字列型を要求するため TEXT() で変換
    const itemFormula =
      `=IF(A${r}="","",` +
      `"{"&CHAR(34)&"type"&CHAR(34)&":"&CHAR(34)&"item"&CHAR(34)&","` +
      `&CHAR(34)&"description"&CHAR(34)&":"&CHAR(34)&A${r}&CHAR(34)&","` +
      `&CHAR(34)&"quantity"&CHAR(34)&":"&C${r}&","` +
      `&CHAR(34)&"unit_price"&CHAR(34)&":"&CHAR(34)&TEXT(B${r},"0")&CHAR(34)&","` +
      `&CHAR(34)&"tax_rate"&CHAR(34)&":"&D${r}&"}")`;
    sheet.getRange(r, h.INTERNAL_COL).setFormula(itemFormula);
  }

  // --- 出力ラベル ---
  sheet.getRange('A15').setValue('▼ 生成されたlines_json（メニュー「lines_json → Q列に転記」を実行）')
    .setFontWeight('bold')
    .setBackground('#d9ead3')
    .setFontColor('#274e13');
  sheet.getRange('A15:D15').merge();

  // --- 出力JSON（式で自動生成） ---
  const outputFormula =
    `=IF(SUMPRODUCT((LEN(E${h.INPUT_START_ROW}:E${h.INPUT_END_ROW})>0)*1)=0,` +
    `"（品目名と単価を入力してください）",` +
    `"["&TEXTJOIN(",",TRUE,E${h.INPUT_START_ROW}:E${h.INPUT_END_ROW})&"]")`;
  sheet.getRange(h.OUTPUT_CELL).setFormula(outputFormula)
    .setBackground('#d9ead3')
    .setWrap(true)
    .setFontColor('#274e13');
  sheet.getRange('A16:D16').merge();
  sheet.setRowHeight(16, 80);

  // --- E列（内部用）を非表示 ---
  sheet.hideColumns(h.INTERNAL_COL);

  // --- 列幅 ---
  sheet.setColumnWidth(1, 320); // 品目名
  sheet.setColumnWidth(2, 110); // 単価
  sheet.setColumnWidth(3, 60);  // 数量
  sheet.setColumnWidth(4, 80);  // 税率

  return sheet;
}

function installPhase1Trigger_10min() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const t of triggers) {
    if (t.getHandlerFunction() === 'phase1_recordHawkMailsToSheet') {
      ScriptApp.deleteTrigger(t);
    }
  }
  ScriptApp.newTrigger('phase1_recordHawkMailsToSheet')
    .timeBased()
    .everyMinutes(10)
    .create();

  Logger.log('installed trigger: every 10 minutes');
}

// ===================== ヘルパー =====================

function getOrCreateGmailLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}

function loadExistingIdsFromColA_(sheet) {
  const lastRow = sheet.getLastRow();
  const set = new Set();
  if (lastRow < CONFIG.START_ROW) return set;

  const values = sheet.getRange(CONFIG.START_ROW, 1, lastRow - CONFIG.START_ROW + 1, 1).getValues();
  for (const [v] of values) {
    if (v) set.add(String(v).trim());
  }
  return set;
}

function pickLatestMessageFrom_(thread, fromEmail) {
  const msgs = thread.getMessages();
  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i];
    const from = (m.getFrom() || '').toLowerCase();
    if (from.includes(fromEmail.toLowerCase())) return m;
  }
  return null;
}

function buildGmailMessageUrl_(gmailInternalMessageId) {
  return `https://mail.google.com/mail/u/0/#all/${encodeURIComponent(gmailInternalMessageId)}`;
}

function getRfcMessageIdOrFallback_(msg) {
  const fallback = String(msg.getId());
  try {
    const res = Gmail.Users.Messages.get('me', msg.getId(), {
      format: 'metadata',
      metadataHeaders: ['Message-ID', 'Message-Id']
    });

    const headers = (res.payload && res.payload.headers) ? res.payload.headers : [];
    for (const h of headers) {
      const name = (h.name || '').toLowerCase();
      if (name === 'message-id' || name === 'message-id'.toLowerCase() || name === 'message-id') {
        if (h.value) return String(h.value).trim();
      }
      if (name === 'message-id' || name === 'message-id') {
        if (h.value) return String(h.value).trim();
      }
    }
    return fallback;
  } catch (e) {
    return fallback;
  }
}

/** ★B列強化：件名括弧内 > 本文宛名 > 株式会社系 */
function extractCustomerNameV2_(subject, body) {
  // 1) 件名の括弧内（（）()【】）を最優先
  const nameFromSubject = extractNameFromSubjectBrackets_(subject);
  if (nameFromSubject) return normalizeCustomerName_(nameFromSubject);

  // 2) 本文の「〇〇様」「〇〇御中」「（有）〇〇　様宛」等
  const nameFromBody = extractNameFromBodySalutation_(body);
  if (nameFromBody) return normalizeCustomerName_(nameFromBody);

  // 3) 株式会社/有限会社
  const text = (subject + '\n' + body).replace(/\r/g, '\n');
  let m = text.match(/((?:株式会社|有限会社|（有）|（株）)[^\s　\n\r]{1,30})/);
  if (m && m[1]) return normalizeCustomerName_(m[1]);

  return '';
}

function extractNameFromSubjectBrackets_(subject) {
  if (!subject) return '';
  const s = String(subject);

  // 例：見積もりの作成お願いします（ASRE様）
  // () / （） / 【】
  const patterns = [
    /（([^（）]{1,40})）/,
    /\(([^()]{1,40})\)/,
    /【([^【】]{1,40})】/
  ];

  for (const re of patterns) {
    const m = s.match(re);
    if (m && m[1]) return m[1].trim();
  }
  return '';
}

function extractNameFromBodySalutation_(body) {
  if (!body) return '';
  const lines = String(body).replace(/\r/g, '\n').split('\n');

  for (const raw of lines.slice(0, 20)) { // 先頭20行だけ見れば十分なことが多い
    const line = raw.trim();
    if (!line) continue;

    // 「（有）ASRE 様宛」など
    let m = line.match(/(.{1,40}?)(?:様|御中|殿)(?:宛|あて)?/);
    if (m && m[1]) {
      const cand = m[1].trim();
      // あいさつ文などを避ける
      if (!/お世話|いつも|よろしく|平山|長谷川/.test(cand)) return cand;
    }
  }
  return '';
}

function normalizeCustomerName_(name) {
  if (!name) return '';
  let s = String(name).trim();

  // 敬称削除
  s = s.replace(/(様|御中|殿|さん)\s*$/g, '');

  // 余計な記号
  s = s.replace(/^[\s　]+|[\s　]+$/g, '');

  // 「(有)」「（有）」など表記揺れは残しても良いが、括弧だけ整える
  s = s.replace(/^\(有\)/, '（有）').replace(/^（有\)/, '（有）');
  s = s.replace(/^\(株\)/, '（株）').replace(/^（株\)/, '（株）');

  return s;
}

/** ★D列強化：明細っぽい行から品目名を抜く */
function extractMainItemFromBody_(body) {
  if (!body) return '';

  const ignoreWords = [
    '送料', '出張', '消費税', '税', '合計', '小計', '値引', '振込', '手数料',
    '下記の通り', '見積書', '送付', 'お願いします', 'よろしく', 'いつも', 'お世話'
  ];

  const lines = String(body)
    .replace(/\r/g, '\n')
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const line of lines) {
    // テンプレ行を飛ばす
    if (ignoreWords.some(w => line.includes(w))) continue;

    // 金額が含まれる行は明細の可能性が高い
    const hasMoney = /[0-9０-９][,，]?[0-9０-９]*\s*円/.test(line) || /[0-9０-９]+\s*[×xX]\s*[0-9０-９]+/.test(line);

    // 例：KEISER M3バイクマウント（中古） 5,000円×2
    // → 金額・数量以降をカットして品目名だけにする
    if (hasMoney) {
      let item = line;

      // 「円」や「×」が出る位置以降をカット
      const cutIndexCandidates = [];
      // ピリオド区切り（5.000円）・カンマ区切り（5,000円）両方に対応
      const idxYen = item.search(/[0-9０-９][0-9０-９.,，]*\s*円/);
      if (idxYen >= 0) cutIndexCandidates.push(idxYen);

      const idxTimes = item.search(/[×xX]\s*[0-9０-９]+/);
      if (idxTimes >= 0) cutIndexCandidates.push(idxTimes);

      const cutAt = cutIndexCandidates.length ? Math.min(...cutIndexCandidates) : -1;
      if (cutAt > 0) item = item.slice(0, cutAt).trim();

      // 余計な記号やコロンの後ろを整理（任意）
      item = item.replace(/[：:]\s*$/g, '').trim();

      // 最低2文字以上
      if (item.length >= 2) return item;
    }
  }

  return '';
}

/**
 * ★Q列：メール本文から見積明細JSON（lines_json）を自動生成する
 *
 * 対応パターン（品目名　単価円×数量）：
 *   KEISER M3バイクマウント（中古）　5,000円×2
 *   商品A 10,000円
 *   部品B　3.500円×5
 *
 * 注意：
 *   - 消費税・合計・小計などの行は自動スキップ
 *   - 抽出できた明細が0件の場合は空文字を返す（手入力に委ねる）
 *   - tax_rate は一律 10%（必要に応じて手修正）
 *   - freee IV API 要件：unit_price は文字列型
 *
 * @param {string} body メール本文
 * @returns {string} JSON文字列（抽出ゼロの場合は空文字）
 */
function extractLinesJsonFromBody_(body) {
  if (!body) return '';

  const skipWords = [
    '消費税', '送料', '出張費', '合計', '小計', '値引', '振込', '手数料', '税額',
    '下記の通り', '見積書', '送付', 'お願いします', 'よろしく', 'いつも', 'お世話',
  ];

  const lines = String(body)
    .replace(/\r/g, '\n')
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const items = [];

  for (const line of lines) {
    // スキップワード判定（行全体）
    if (skipWords.some(w => line.includes(w))) continue;

    // パターン: 品目名（任意の文字）＋スペース（半角/全角）＋数値円（×数量）
    //   例: KEISER M3バイクマウント（中古）　5,000円×2
    //       商品A 10,000円
    //       部品B　3.500円×5
    const m = line.match(/^(.+?)[\s\u3000]+([0-9０-９][0-9０-９,，.]*)円\s*(?:[×xX]\s*([0-9０-９]+))?/);
    if (!m) continue;

    const description = m[1].trim();
    if (!description || description.length < 2) continue;

    // スキップワードが品目名に含まれる場合も除外
    if (skipWords.some(w => description.includes(w))) continue;

    // 単価：カンマ・ピリオドを除いて整数化（千区切り対応: 5,000 / 5.000）
    const priceRaw = toHalfWidthNum_(m[2]).replace(/[,，.]/g, '');
    const unitPrice = parseInt(priceRaw, 10);
    if (isNaN(unitPrice) || unitPrice <= 0) continue;

    // 数量：省略時は 1
    const quantity = m[3] ? Math.max(1, parseInt(toHalfWidthNum_(m[3]), 10) || 1) : 1;

    items.push({
      type: 'item',
      description,
      quantity,
      unit_price: String(unitPrice), // freee IV API は文字列型を要求
      tax_rate: 10,
    });
  }

  if (items.length === 0) return '';
  return JSON.stringify(items);
}

/**
 * 全角数字 → 半角数字変換（抽出時の内部ヘルパー）
 */
function toHalfWidthNum_(s) {
  return String(s || '').replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
}

/** 取れない時の保険（従来の簡易要約） */
function buildTradeSummaryFallback_(subject, body) {
  const lines = (body || '')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const head3 = lines.slice(0, 3).join(' / ');
  const s = `${(subject || '').trim()} ｜ ${head3}`.trim();
  return s.length > 250 ? s.slice(0, 250) + '…' : s;
}

function appendRow_(sheet, data) {
  const row = sheet.getLastRow() + 1;

  sheet.getRange(row, 1).setValue(data.messageId);      // A
  sheet.getRange(row, 2).setValue(data.customerName);   // B
  sheet.getRange(row, 3).setValue(data.receivedDate);   // C
  sheet.getRange(row, 4).setValue(data.tradeSummary);   // D
  sheet.getRange(row, 5).setValue(data.personFixed);    // E

  // Q列：見積明細JSON（自動抽出できた場合のみ書き込み）
  if (data.linesJson) {
    sheet.getRange(row, 17).setValue(data.linesJson);   // Q
  }

  // O列：表示「長谷川」＋リンク
  const safeUrl = String(data.linkUrl).replace(/"/g, '""');
  sheet.getRange(row, 15).setFormula(`=HYPERLINK("${safeUrl}","長谷川")`);

  sheet.getRange(row, 3).setNumberFormat('yyyy/MM/dd');
}