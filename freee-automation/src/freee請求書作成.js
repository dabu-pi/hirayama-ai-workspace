/*******************************************************
 * freee 請求書API 見積書（/quotations）作成 - GAS 版（フェーズ2）
 * - OAuth2 (code -> token, refresh) ※refresh_token更新時も必ず保存
 * - お客様名(B列) → freee取引先検索/作成 → partner_id(P列) 自動
 * - 見積作成：freee請求書API（/iv/api/1/quotations）
 * - 429/401/403 ハンドリング（指数バックオフ/リフレッシュ再試行）
 * - 二重作成防止（Message-IDで冪等）
 *
 * 参考：partner_id必須化・partner APIで事前作成が必要（freee公式お知らせ） :contentReference[oaicite:1]{index=1}
 * 会計APIのPartnersエンドポイント（GET/POST /api/1/partners） :contentReference[oaicite:2]{index=2}
 *******************************************************/

/** ====== 設定（あなたの環境に合わせて変更） ====== */
const CFG = {
  // ★スプレッドシート（案件管理台帳）
  SPREADSHEET_ID: '1TMKQO4zYwk1kWgkfoCR4K7jTeIxNxsS1B8uh7t8nd2c',
  SHEET_NAME: '2024長谷川さん',

  // 既存仕様（確定）列
  COL_MESSAGE_ID: 1,      // A：Gmail Message-ID（フェーズ1が書き込み・冪等キー正）
  COL_CUSTOMER_NAME: 2,   // B：お客様名
  COL_EVENT_DATE: 3,      // C：発生日
  COL_DESC: 4,            // D：取引の内容（件名/案件名）
  COL_OWNER: 5,           // E：長谷川
  COL_QUOTED_AT: 7,       // G：見積をした日
  COL_MAIL_LINK: 15,      // O：メールリンク

  // フェーズ2追加列（あなたが追加済み）
  COL_FREEE_PARTNER_ID: 16,   // P：freee partner_id（自動で埋める）
  COL_LINES_JSON: 17,         // Q：見積明細JSON（現状は手入力想定）
  COL_FREEE_QUOTATION_ID: 18, // R：freee quotation_id（成功時に保存）
  COL_GMAIL_MESSAGE_ID: 19,   // S：予備（旧冪等キー列・現在はA列を正として使用）

  // 見積設定
  PARTNER_TITLE_DEFAULT: '御中',   // '御中' or '様'
  TAX_ENTRY_METHOD_DEFAULT: 'out', // 'in' or 'out'
  TAX_FRACTION_DEFAULT: 'round',   // 'omit'|'round_up'|'round'
  DEFAULT_TAX_RATE: 10,            // 0/8/10
  // freee API
  FREEE_AUTH_BASE: 'https://accounts.secure.freee.co.jp/public_api',
  FREEE_API_BASE: 'https://api.freee.co.jp',
  IV_BASE_PATH: '/iv', // freee請求書API（OpenAPI仕様: https://api.freee.co.jp/iv）
};

/** ====== OAuth / Token 保存キー ====== */
const PROP_KEYS = {
  CLIENT_ID: 'FREEE_CLIENT_ID',
  CLIENT_SECRET: 'FREEE_CLIENT_SECRET',
  REDIRECT_URI: 'FREEE_REDIRECT_URI',

  ACCESS_TOKEN: 'FREEE_ACCESS_TOKEN',
  REFRESH_TOKEN: 'FREEE_REFRESH_TOKEN',
  EXPIRES_AT: 'FREEE_EXPIRES_AT', // epoch millis
  COMPANY_ID: 'FREEE_COMPANY_ID',

  // 取引先検索キャッシュ（JSON文字列）
  PARTNER_CACHE_JSON: 'FREEE_PARTNER_CACHE_JSON',
};

/** =========================
 * 0) 初期セットアップ（最初だけ）
 * ========================= */

/** 認可URLをログに出す（最初だけ） */
function freee_setup_printAuthUrl() {
  console.log(buildAuthUrl_());
}

/**
 * フェーズ2テスト：スプレッドシートの指定行で見積書をPOSTする
 * - P列（partner_id）が手動入力済みの行を対象
 * - Q列（lines_json）のサンプルも自動生成（空の場合）
 * @param {number} testRow テスト対象の行番号（省略時は最初のQ列非空行）
 */
function freee_testPhase2() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) { console.log('データなし'); return; }

  const values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

  let targetRowIndex = null;
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const quotedAt = row[CFG.COL_QUOTED_AT - 1];
    const linesJson = row[CFG.COL_LINES_JSON - 1];
    const partnerId = String(row[CFG.COL_FREEE_PARTNER_ID - 1] || '').trim();
    if (!quotedAt && linesJson && partnerId) {
      targetRowIndex = i + 2;
      break;
    }
  }

  if (!targetRowIndex) {
    console.log([
      '処理対象行が見つかりません。条件：',
      '  ・G列（見積済み日）が空',
      '  ・Q列（lines_json）に値あり',
      '  ・P列（partner_id）に値あり',
      '',
      'P列が空の場合は partner_id を手動入力するか、freeeアプリ設定で',
      '[会計]→取引先権限を追加してから freee_resetAuth → 再認証してください。',
    ].join('\n'));
    return;
  }

  const rowData = values[targetRowIndex - 2];
  const partnerId = String(rowData[CFG.COL_FREEE_PARTNER_ID - 1]).trim();
  const customerName = String(rowData[CFG.COL_CUSTOMER_NAME - 1] || '').trim();
  const linesJson = rowData[CFG.COL_LINES_JSON - 1];
  const subject = String(rowData[CFG.COL_DESC - 1] || '').trim();
  // A列（フェーズ1が書いたMessage-ID）を第一候補
  const gmailMsgId = String(rowData[CFG.COL_MESSAGE_ID - 1] || '').trim()
                  || String(rowData[CFG.COL_GMAIL_MESSAGE_ID - 1] || '').trim();
  const quotationDate = normalizeDateYmd_(rowData[CFG.COL_EVENT_DATE - 1]) || todayYmd_();
  const idempotencyKey = buildIdempotencyKey_(targetRowIndex, gmailMsgId);

  console.log(`=== テスト対象: 行${targetRowIndex} / ${customerName} ===`);
  console.log('partner_id:', partnerId, '/ quotation_date:', quotationDate);
  console.log('lines_json:', String(linesJson).slice(0, 200));

  const lines = parseLinesJson_(linesJson);
  const payload = {
    company_id: Number(getCompanyId_()),
    quotation_date: quotationDate,
    subject: subject || `御見積（${customerName}）`,
    tax_entry_method: CFG.TAX_ENTRY_METHOD_DEFAULT,
    tax_fraction: CFG.TAX_FRACTION_DEFAULT,
    withholding_tax_entry: 'without',
    withholding_tax_entry_method: 'out',
    partner_id: Number(partnerId),
    partner_title: CFG.PARTNER_TITLE_DEFAULT,
    lines: lines,
    memo: `auto: ${idempotencyKey}`,
  };

  console.log('POST payload:', JSON.stringify(payload).slice(0, 400));

  try {
    const res = freeeIvApi_('post', '/quotations', payload, { idempotencyKey });
    const quotationId = (res && res.quotation && res.quotation.id) ? res.quotation.id : (res && res.id) ? res.id : '';
    const quotationNumber = (res && res.quotation) ? res.quotation.quotation_number : '';
    console.log(`✅ 見積書作成成功: id=${quotationId} / ${quotationNumber}`);
    console.log('※ テストなので台帳は更新していません。本番は freee_phase2_processPendingQuotations() を実行してください。');
  } catch (err) {
    console.error('❌ 見積書作成失敗:', err && err.message ? err.message : err);
  }
}

/**
 * 取引先解決の診断：P列が空の行について partner_id を解決できるか確認する（書き込みなし）
 */
function freee_diagnosePartnerResolution() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) { console.log('データなし'); return; }

  const values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  let checked = 0;

  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const quotedAt = row[CFG.COL_QUOTED_AT - 1];
    if (quotedAt) continue; // 見積済みはスキップ

    const customerName = String(row[CFG.COL_CUSTOMER_NAME - 1] || '').trim();
    if (!customerName) continue;

    const existingPartnerId = String(row[CFG.COL_FREEE_PARTNER_ID - 1] || '').trim();
    if (existingPartnerId) {
      console.log(`行${i+2}: ${customerName} → P列に手動入力済み (${existingPartnerId}) ✅`);
      checked++;
      continue;
    }

    // resolveOrCreatePartnerId_ を試す
    try {
      const pid = resolveOrCreatePartnerId_(customerName);
      console.log(`行${i+2}: ${customerName} → partner_id=${pid} ✅`);
    } catch (err) {
      console.warn(`行${i+2}: ${customerName} → ❌ ${err && err.message ? err.message.split('\n')[0] : err}`);
    }
    checked++;
    if (checked >= 10) { console.log('（最大10件まで確認）'); break; }
  }
}

/** デバッグ：見積書を1件直接POSTして結果を確認する */
function freee_testPostQuotation() {
  const companyId = Number(getCompanyId_());
  const token = getValidAccessToken_();
  const url = CFG.FREEE_API_BASE + CFG.IV_BASE_PATH + '/quotations';

  console.log('POST URL:', url);

  // 取引先IDを取得：freee請求書の既存見積書からpartner_idを借用
  const quotRes = UrlFetchApp.fetch(
    CFG.FREEE_API_BASE + CFG.IV_BASE_PATH + '/quotations?company_id=' + companyId + '&limit=1',
    { method: 'get', headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' }, muteHttpExceptions: true }
  );
  const quotations = safeJsonParse_(quotRes.getContentText()).quotations || [];
  const testPartnerId = quotations.length ? Number(quotations[0].partner_id) : null;
  console.log('testPartnerId:', testPartnerId, '（既存見積書から取得）');
  if (!testPartnerId) { console.log('既存見積書がないかpartner_idが取得できません。中断。'); return; }

  // 必須フィールドを含む最小テストPOST
  // 200/201 = 作成成功、422 = バリデーションエラー（認証OK）、401 = 権限NG
  const today = new Date();
  const ymd = today.getFullYear() + '-' + String(today.getMonth()+1).padStart(2,'0') + '-' + String(today.getDate()).padStart(2,'0');

  const body = {
    company_id: companyId,
    quotation_date: ymd,
    tax_entry_method: 'out',          // 税抜（in=税込, out=税抜）
    tax_fraction: 'round',           // 端数丸め
    withholding_tax_entry: 'without',
    withholding_tax_entry_method: 'out',
    partner_id: testPartnerId,
    partner_title: '御中',
    lines: [
      {
        type: 'item',
        description: 'テスト品目（API疎通確認用）',
        quantity: 1,
        unit_price: '1000',
        tax_rate: 10
      }
    ]
  };

  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Accept: 'application/json' },
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });
  console.log('Status:', res.getResponseCode());
  console.log('Response:', res.getContentText().slice(0, 800));
}

/** 診断：freee会計API（/api/1/quotations）とfreee請求書API（/invoice/api/v1/quotations）を両方テスト */
function freee_diagnoseApis() {
  const companyId = Number(getCompanyId_());
  const token = getValidAccessToken_();
  console.log('使用トークン(末尾4桁):', token.slice(-4), '/ company_id:', companyId);

  const tests = [
    // freee会計 API
    { label: '会計 GET  /api/1/quotations', url: 'https://api.freee.co.jp/api/1/quotations?company_id=' + companyId, method: 'get', body: null },
    { label: '会計 POST /api/1/quotations', url: 'https://api.freee.co.jp/api/1/quotations', method: 'post', body: { company_id: companyId } },
    // freee請求書 API（正しいベースURL: /iv）
    { label: '請求書 GET /iv/quotations', url: 'https://api.freee.co.jp/iv/quotations?company_id=' + companyId, method: 'get', body: null },
    { label: '請求書 POST /iv/quotations', url: 'https://api.freee.co.jp/iv/quotations', method: 'post', body: { company_id: companyId } },
  ];

  for (const t of tests) {
    const opt = {
      method: t.method,
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Accept: 'application/json' },
      muteHttpExceptions: true,
    };
    if (t.body) opt.payload = JSON.stringify(t.body);
    const res = UrlFetchApp.fetch(t.url, opt);
    console.log('[' + t.label + '] Status:', res.getResponseCode(), '/', res.getContentText().slice(0, 150));
  }
}

/** 詳細診断：レスポンスヘッダーも含めて freee請求書API の401を調査 */
function freee_diagnoseHeaders() {
  const token = getValidAccessToken_();
  const companyId = getCompanyId_();

  const url = 'https://api.freee.co.jp/iv/quotations?company_id=' + companyId;

  const res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      Authorization: 'Bearer ' + token,
      Accept: 'application/json',
    },
    muteHttpExceptions: true,
  });

  console.log('Status:', res.getResponseCode());
  console.log('Body:', res.getContentText());

  // レスポンスヘッダーを全部出力
  const headers = res.getHeaders();
  console.log('=== Response Headers ===');
  Object.keys(headers).forEach(k => console.log(k + ': ' + headers[k]));

  // WWW-Authenticate ヘッダーがあれば認証要件がわかる
  const wwwAuth = headers['WWW-Authenticate'] || headers['www-authenticate'];
  if (wwwAuth) console.log('WWW-Authenticate:', wwwAuth);
}

/** デバッグ：freee請求書API のGET内容確認とPOST形式テスト */
function freee_debugQuotationEndpoint() {
  const companyId = getCompanyId_();
  const token = getValidAccessToken_();
  const base = 'https://api.freee.co.jp/invoice/api/v1';

  // GET でデータ構造を確認
  console.log('=== GET /invoice/api/v1/quotations ===');
  const getRes = UrlFetchApp.fetch(base + '/quotations?company_id=' + companyId, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
    muteHttpExceptions: true,
  });
  console.log('Status:', getRes.getResponseCode());
  console.log('Response:', getRes.getContentText().slice(0, 400));

  // POST に Accept: application/json を追加して試す
  console.log('=== POST /invoice/api/v1/quotations ===');
  const postRes = UrlFetchApp.fetch(base + '/quotations', {
    method: 'post',
    headers: {
      Authorization: 'Bearer ' + token,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    payload: JSON.stringify({ company_id: Number(companyId) }),
    muteHttpExceptions: true,
  });
  console.log('Status:', postRes.getResponseCode());
  console.log('Response:', postRes.getContentText().slice(0, 400));
}

/** スクリプトプロパティ例（最初だけ） */
function freee_setup_setScriptPropertiesExample() {
  const p = PropertiesService.getScriptProperties();
  p.setProperty(PROP_KEYS.CLIENT_ID, 'YOUR_CLIENT_ID');
  p.setProperty(PROP_KEYS.CLIENT_SECRET, 'YOUR_CLIENT_SECRET');
  p.setProperty(PROP_KEYS.REDIRECT_URI, 'YOUR_REDIRECT_URI');
  console.log('Script properties set.');
}

/**
 * OAuth情報をすべて削除して最初からやり直す。
 * Client Secretを作り直したとき・invalid_grantが出たときに実行。
 * 実行後は freee_setup_printAuthUrl() → ブラウザで認可 → doGet() の順で再認証。
 */
function freee_resetAuth() {
  const p = PropertiesService.getScriptProperties();
  [
    PROP_KEYS.ACCESS_TOKEN,
    PROP_KEYS.REFRESH_TOKEN,
    PROP_KEYS.EXPIRES_AT,
    PROP_KEYS.COMPANY_ID,
    PROP_KEYS.PARTNER_CACHE_JSON,
  ].forEach(key => p.deleteProperty(key));
  console.log('OAuth情報をリセットしました。次: freee_setup_printAuthUrl() を実行してください。');
}

/**
 * 現在の認証状態を確認する（デバッグ用）。
 */
function freee_checkAuthStatus() {
  const p = PropertiesService.getScriptProperties();
  const token     = p.getProperty(PROP_KEYS.ACCESS_TOKEN);
  const refresh   = p.getProperty(PROP_KEYS.REFRESH_TOKEN);
  const expiresAt = Number(p.getProperty(PROP_KEYS.EXPIRES_AT) || '0');
  const companyId = p.getProperty(PROP_KEYS.COMPANY_ID);
  const redirectUri = p.getProperty(PROP_KEYS.REDIRECT_URI);

  const clientId = p.getProperty(PROP_KEYS.CLIENT_ID);

  console.log('--- freee OAuth 状態 ---');
  console.log('client_id    : ' + (clientId   ? clientId + ' ✅' : 'なし ❌ ← 要設定'));
  console.log('redirect_uri : ' + (redirectUri ? redirectUri : 'なし ❌ ← 要設定'));
  console.log('access_token : ' + (token   ? '存在 (末尾4桁: ...' + token.slice(-4) + ')' : 'なし ❌'));
  console.log('refresh_token: ' + (refresh  ? '存在 ✅' : 'なし ❌'));
  console.log('expires_at   : ' + (expiresAt ? new Date(expiresAt).toLocaleString('ja-JP') : 'なし'));
  console.log('期限切れ     : ' + (Date.now() >= expiresAt ? 'YES → リフレッシュ必要' : 'NO ✅'));
  console.log('company_id   : ' + (companyId  ? companyId + ' ✅' : 'なし ❌'));
}

/**
 * OAuth callback（ウェブアプリ）
 * - codeをtokenに交換して保存
 * - company_id を保存
 */
function doGet(e) {
  try {
    const params = e && e.parameter ? e.parameter : {};

    // OAuth callback以外で /exec を開いた時は案内を返す
    if (!params.code && !params.error) {
      return HtmlService.createHtmlOutput('This is a GAS WebApp endpoint. Use freee OAuth authorize URL to start.');
    }

    if (params.error) {
      return HtmlService.createHtmlOutput('OAuth error: ' + params.error);
    }
    if (!params.code) {
      return HtmlService.createHtmlOutput('No code.');
    }

    const token = exchangeCodeForToken_(params.code);
    saveToken_(token);
    ensureCompanyId_();

    return HtmlService.createHtmlOutput('OK. Token saved. You can close this tab.');
  } catch (err) {
    return HtmlService.createHtmlOutput('ERROR: ' + (err && err.stack ? err.stack : err));
  }
}

/** =========================
 * 1) フェーズ2本体：取引先自動→見積作成
 * ========================= */

/**
 * 台帳の見積未作成（G列空）を処理
 * - P列が空 → B列お客様名からpartner_id自動（検索→なければ作成）
 * - Q列 lines_json が空 → スキップ（要確認）
 * - 見積作成成功 → G列日時、R列quotation_id
 */
function freee_phase2_processPendingQuotations() {
  ensureCompanyId_();

  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;

  const values = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();

  for (let i = 0; i < values.length; i++) {
    const rowIndex = i + 2;
    const row = values[i];

    const quotedAt = row[CFG.COL_QUOTED_AT - 1];
    if (quotedAt) continue; // 既に見積作成済み

    const customerName = String(row[CFG.COL_CUSTOMER_NAME - 1] || '').trim();
    if (!customerName) continue; // お客様名なしは要確認扱い

    // 冪等キー：A列（フェーズ1が書いたMessage-ID）を第一候補、S列を保険
    const gmailMsgId = String(row[CFG.COL_MESSAGE_ID - 1] || '').trim()
                    || String(row[CFG.COL_GMAIL_MESSAGE_ID - 1] || '').trim();
    const idempotencyKey = buildIdempotencyKey_(rowIndex, gmailMsgId);

    if (alreadyProcessed_(sheet, idempotencyKey)) continue;

    // ---- partner_id 自動（検索→なければ作成）
    let partnerId = String(row[CFG.COL_FREEE_PARTNER_ID - 1] || '').trim();
    if (!partnerId) {
      try {
        partnerId = String(resolveOrCreatePartnerId_(customerName));
        sheet.getRange(rowIndex, CFG.COL_FREEE_PARTNER_ID).setValue(partnerId);
      } catch (err) {
        console.error(`Row ${rowIndex} partner resolve failed:`, err && err.stack ? err.stack : err);
        continue; // partnerが作れないなら見積作成は止める
      }
    }

    // ---- lines_json（現状は手入力前提）
    const linesJson = row[CFG.COL_LINES_JSON - 1];
    if (!linesJson) continue;

    const subject = String(row[CFG.COL_DESC - 1] || '').trim();
    const quotationDate = normalizeDateYmd_(row[CFG.COL_EVENT_DATE - 1]) || todayYmd_();
    const lines = parseLinesJson_(linesJson);

    const payload = {
      company_id: Number(getCompanyId_()),
      quotation_date: quotationDate,
      subject: subject || `御見積（${customerName}）`,
      tax_entry_method: CFG.TAX_ENTRY_METHOD_DEFAULT,
      tax_fraction: CFG.TAX_FRACTION_DEFAULT,
      withholding_tax_entry: 'without',
      withholding_tax_entry_method: 'out',
      partner_id: Number(partnerId),
      partner_title: CFG.PARTNER_TITLE_DEFAULT,
      lines: lines,
      memo: `auto: ${idempotencyKey}`,
    };

    try {
      const res = freeeIvApi_('post', '/quotations', payload, { idempotencyKey });

      const quotationId =
        (res && res.quotation && res.quotation.id) ? res.quotation.id :
        (res && res.id) ? res.id : '';

      sheet.getRange(rowIndex, CFG.COL_QUOTED_AT).setValue(new Date());
      if (quotationId) sheet.getRange(rowIndex, CFG.COL_FREEE_QUOTATION_ID).setValue(String(quotationId));

      // S列が空なら冪等キーを保存（Message-IDが取れない運用の保険）
      if (!gmailMsgId) sheet.getRange(rowIndex, CFG.COL_GMAIL_MESSAGE_ID).setValue(String(idempotencyKey));

    } catch (err) {
      console.error(`Row ${rowIndex} quotation failed:`, err && err.stack ? err.stack : err);
    }
  }
}

/** =========================
 * 2) 取引先（partner）検索・作成
 * ========================= */

/**
 * お客様名から partner_id を解決（検索→なければ作成）
 *
 * 優先順位：
 *   1) キャッシュ
 *   2) freee会計API（/api/1/partners）--- [会計]取引先権限がある場合
 *   3) freee請求書API（/iv/quotations）の見積書一覧からpartner_nameで照合
 *      ※ IV APIにpartnersエンドポイントは存在しないため、既存見積書から探す
 *   4) 上記すべて失敗 → エラー（freeeUI or P列手動入力が必要）
 */
function resolveOrCreatePartnerId_(customerNameRaw) {
  const companyId = Number(getCompanyId_());
  const nameNorm = normalizePartnerName_(customerNameRaw);

  // 1) キャッシュ
  const cache = loadPartnerCache_();
  if (cache[nameNorm]) {
    console.log(`partner_id キャッシュヒット: ${customerNameRaw} → ${cache[nameNorm]}`);
    return cache[nameNorm];
  }

  // 2) freee会計API（/api/1/partners）
  //    [会計]取引先の参照権限がある場合のみ動く
  let skipAccountingApi = false;
  try {
    const found = findPartnerByNameViaAccountingApi_(companyId, nameNorm);
    if (found) {
      cache[nameNorm] = String(found.id);
      savePartnerCache_(cache);
      console.log(`partner_id 会計APIで発見: ${customerNameRaw} → ${found.id}`);
      return found.id;
    }

    // 見つからなければ作成（POST /api/1/partners）
    const created = createPartnerViaAccountingApi_(companyId, customerNameRaw);
    if (created && created.id) {
      cache[nameNorm] = String(created.id);
      savePartnerCache_(cache);
      console.log(`partner_id 会計APIで新規作成: ${customerNameRaw} → ${created.id}`);
      return created.id;
    }
  } catch (e) {
    const msg = e && e.message ? e.message : String(e);
    if (msg.includes('403')) {
      // [会計]取引先権限なし → フォールバックへ
      console.warn(`[会計API] 取引先権限なし（403）。フォールバック: IV API見積書一覧で検索します。`);
      console.warn(`権限追加方法: freeeアプリ設定 → [会計] → 取引先「参照」「更新・作成」をON → freee_resetAuth → 再認証`);
      skipAccountingApi = true;
    } else {
      throw e; // 403以外のエラーはそのまま投げる
    }
  }

  // 3) freee IV API フォールバック：既存見積書一覧から取引先を照合
  //    ※ IV APIにpartnersエンドポイントは存在しないため、見積書のpartner情報を流用
  const ivPartnerId = findPartnerIdFromIvQuotations_(companyId, nameNorm);
  if (ivPartnerId) {
    cache[nameNorm] = String(ivPartnerId);
    savePartnerCache_(cache);
    console.log(`partner_id IV見積書一覧で発見: ${customerNameRaw} → ${ivPartnerId}`);
    return ivPartnerId;
  }

  // 4) すべて失敗
  const hint = skipAccountingApi
    ? `\n解決策A（推奨）: freeeアプリ設定で[会計]→取引先の権限を追加し再認証\n解決策B: freeeUIで取引先「${customerNameRaw}」を確認し、P列にpartner_idを手動入力`
    : `\n取引先「${customerNameRaw}」がfreeeに存在しません。freeeで取引先を作成し、P列にpartner_idを手動入力してください。`;
  throw new Error(`partner_id を特定できませんでした: ${customerNameRaw}${hint}`);
}

/**
 * freee会計API（/api/1/partners）で取引先を検索
 */
function findPartnerByNameViaAccountingApi_(companyId, nameNorm) {
  // まず keyword 付きで試す
  try {
    const res = freeeAccountingApi_('get', `/api/1/partners?company_id=${encodeURIComponent(companyId)}&keyword=${encodeURIComponent(nameNorm)}`);
    const partners = (res && res.partners) ? res.partners : [];
    const best = pickBestPartner_(partners, nameNorm);
    if (best) return best;
  } catch (e) {
    const msg = e && e.message ? e.message : '';
    if (msg.includes('403')) throw e; // 権限エラーは上位に伝える
    // keyword未対応/不正パラメータ等 → 次へ
  }

  // keywordなしで全件取得してローカル照合
  const res2 = freeeAccountingApi_('get', `/api/1/partners?company_id=${encodeURIComponent(companyId)}`);
  const partners2 = (res2 && res2.partners) ? res2.partners : [];
  return pickBestPartner_(partners2, nameNorm);
}

/**
 * freee会計API（/api/1/partners）で取引先を新規作成
 */
function createPartnerViaAccountingApi_(companyId, displayName) {
  const body = {
    company_id: Number(companyId),
    name: String(displayName).trim(),
  };
  const res = freeeAccountingApi_('post', '/api/1/partners', body);
  return (res && res.partner) ? res.partner : res;
}

/**
 * IV API フォールバック：GET /iv/quotations の一覧からpartner_nameを照合してpartner_idを取得
 * - freee IV APIにpartnersエンドポイントは存在しないため、見積書データを利用
 * - 新規取引先は作成できない（freeeUIで作成 or 会計API権限追加が必要）
 */
function findPartnerIdFromIvQuotations_(companyId, nameNorm) {
  try {
    const res = freeeIvApi_('get', `/quotations?company_id=${companyId}&limit=100`);
    const quotations = (res && res.quotations) ? res.quotations : [];
    for (const q of quotations) {
      const qName = normalizePartnerName_(q.partner_name || '');
      if (qName && (qName === nameNorm || qName.includes(nameNorm) || nameNorm.includes(qName))) {
        return q.partner_id;
      }
    }
  } catch (e) {
    console.warn('IV API見積書一覧からの取引先検索に失敗:', e && e.message ? e.message : e);
  }
  return null;
}

// （後方互換のため古い関数名を残す）
function findPartnerByName_(companyId, nameNorm) {
  return findPartnerByNameViaAccountingApi_(companyId, nameNorm);
}
function createPartner_(companyId, displayName) {
  return createPartnerViaAccountingApi_(companyId, displayName);
}

function pickBestPartner_(partners, nameNorm) {
  if (!Array.isArray(partners) || partners.length === 0) return null;

  // 1) 完全一致（正規化後）
  for (const p of partners) {
    const pn = normalizePartnerName_(p && p.name ? p.name : '');
    if (pn === nameNorm) return p;
  }

  // 2) 部分一致（どちらかが含む）
  for (const p of partners) {
    const pn = normalizePartnerName_(p && p.name ? p.name : '');
    if (!pn) continue;
    if (pn.includes(nameNorm) || nameNorm.includes(pn)) return p;
  }

  return null;
}

/**
 * 取引先名の正規化（ゆるく）
 * - 前後空白除去
 * - 全角括弧内敬称っぽいもの除去（例：ASRE様 → ASRE）
 * - 株式会社/有限会社/合同会社などを除去
 */
function normalizePartnerName_(name) {
  let s = String(name || '').trim();

  // （〇〇）を除去（例：ASRE様、ASRE御中など）
  s = s.replace(/[（(][^）)]+[）)]/g, '');

  // 会社種別のゆるい除去
  s = s
    .replace(/株式会社/g, '')
    .replace(/（株）/g, '')
    .replace(/\(株\)/g, '')
    .replace(/有限会社/g, '')
    .replace(/（有）/g, '')
    .replace(/\(有\)/g, '')
    .replace(/合同会社/g, '')
    .replace(/一般社団法人/g, '')
    .replace(/一般財団法人/g, '')
    .replace(/社団法人/g, '')
    .replace(/財団法人/g, '');

  // 敬称除去
  s = s.replace(/様/g, '').replace(/御中/g, '');

  // 連続スペース整理
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function loadPartnerCache_() {
  const p = PropertiesService.getScriptProperties();
  const raw = p.getProperty(PROP_KEYS.PARTNER_CACHE_JSON);
  if (!raw) return {};
  try { return JSON.parse(raw); } catch (_) { return {}; }
}

function savePartnerCache_(obj) {
  const p = PropertiesService.getScriptProperties();
  p.setProperty(PROP_KEYS.PARTNER_CACHE_JSON, JSON.stringify(obj || {}));
}

/** =========================
 * 3) freee API ラッパ
 * ========================= */

/** 請求書API（/iv/api/1/...） */
function freeeIvApi_(method, path, body, opt = {}) {
  const url = CFG.FREEE_API_BASE + CFG.IV_BASE_PATH + path;
  const accessToken = getValidAccessToken_();

  const headers = {
    Authorization: 'Bearer ' + accessToken,
    'Content-Type': 'application/json',
  };

  // サーバーが拒否する場合があるので、エラー出たら外す運用でもOK
  if (opt.idempotencyKey) headers['Idempotency-Key'] = String(opt.idempotencyKey);

  const payload = body ? JSON.stringify(body) : null;

  return fetchWithRetry_(url, {
    method: method.toUpperCase(),
    headers,
    payload,
    muteHttpExceptions: true,
  });
}

/** 会計API（/api/1/...） */
function freeeAccountingApi_(method, pathOrFullUrl, body) {
  const url = pathOrFullUrl.startsWith('http')
    ? pathOrFullUrl
    : (CFG.FREEE_API_BASE + pathOrFullUrl);

  const accessToken = getValidAccessToken_();
  const headers = { Authorization: 'Bearer ' + accessToken };

  const params = {
    method: method.toUpperCase(),
    headers,
    muteHttpExceptions: true,
  };

  if (method.toLowerCase() !== 'get') {
    params.contentType = 'application/json';
    params.payload = JSON.stringify(body || {});
  }

  return fetchWithRetry_(url, params);
}

/**
 * 429/401/403 を想定してリトライする
 * - 401: refreshして1回だけ再試行
 * - 429: 指数バックオフ
 * - 403: 即エラー
 */
function fetchWithRetry_(url, params) {
  const maxRetries = 5;
  let refreshedOnce = false;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = UrlFetchApp.fetch(url, params);
    const code = res.getResponseCode();
    const text = res.getContentText();

    if (code >= 200 && code < 300) return safeJsonParse_(text);

    if (code === 401 && !refreshedOnce) {
      refreshedOnce = true;
      forceRefreshAccessToken_();
      const newToken = PropertiesService.getScriptProperties().getProperty(PROP_KEYS.ACCESS_TOKEN);
      params.headers = Object.assign({}, params.headers, { Authorization: 'Bearer ' + newToken });
      continue;
    }

    if (code === 429 && attempt < maxRetries) {
      Utilities.sleep(backoffMs_(attempt));
      continue;
    }

    if (code === 403) throw new Error(`freee API 403 Forbidden: ${text}`);

    if (attempt < maxRetries && code >= 500) {
      Utilities.sleep(backoffMs_(attempt));
      continue;
    }

    throw new Error(`freee API error ${code}: ${text}`);
  }

  throw new Error('fetchWithRetry: exceeded retries');
}

function backoffMs_(attempt) {
  const base = 500 * Math.pow(2, attempt);
  const jitter = Math.floor(Math.random() * 250);
  return Math.min(base + jitter, 15000);
}

/** =========================
 * 4) Token 管理（OAuth）
 * ========================= */

function buildAuthUrl_() {
  const p = PropertiesService.getScriptProperties();
  const clientId = mustGet_(p, PROP_KEYS.CLIENT_ID);
  const redirectUri = mustGet_(p, PROP_KEYS.REDIRECT_URI);

  return (
    CFG.FREEE_AUTH_BASE +
    '/authorize' +
    '?response_type=code' +
    '&client_id=' + encodeURIComponent(clientId) +
    '&redirect_uri=' + encodeURIComponent(redirectUri) +
    '&scope=' + encodeURIComponent('read write') +
    '&prompt=select_company'
  );
}

function exchangeCodeForToken_(code) {
  const p = PropertiesService.getScriptProperties();
  const clientId = mustGet_(p, PROP_KEYS.CLIENT_ID);
  const clientSecret = mustGet_(p, PROP_KEYS.CLIENT_SECRET);
  const redirectUri = mustGet_(p, PROP_KEYS.REDIRECT_URI);

  const url = CFG.FREEE_AUTH_BASE + '/token';

  const form = {
    grant_type: 'authorization_code',
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  };

  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: form,
    muteHttpExceptions: true,
  });

  if (res.getResponseCode() < 200 || res.getResponseCode() >= 300) {
    throw new Error(`Token exchange failed ${res.getResponseCode()}: ${res.getContentText()}`);
  }
  return safeJsonParse_(res.getContentText());
}

function refreshAccessToken_() {
  const p = PropertiesService.getScriptProperties();
  const clientId = mustGet_(p, PROP_KEYS.CLIENT_ID);
  const clientSecret = mustGet_(p, PROP_KEYS.CLIENT_SECRET);
  const refreshToken = mustGet_(p, PROP_KEYS.REFRESH_TOKEN);

  const url = CFG.FREEE_AUTH_BASE + '/token';

  const form = {
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  };

  const res = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: form,
    muteHttpExceptions: true,
  });

  if (res.getResponseCode() < 200 || res.getResponseCode() >= 300) {
    throw new Error(`Token refresh failed ${res.getResponseCode()}: ${res.getContentText()}`);
  }

  const token = safeJsonParse_(res.getContentText());
  saveToken_(token);
  return token;
}

function saveToken_(token) {
  const p = PropertiesService.getScriptProperties();
  if (!token || !token.access_token) throw new Error('Invalid token response.');

  const now = Date.now();
  const expiresIn = Number(token.expires_in || 0);
  const expiresAt = now + Math.max(0, (expiresIn - 60)) * 1000;

  p.setProperty(PROP_KEYS.ACCESS_TOKEN, token.access_token);
  p.setProperty(PROP_KEYS.EXPIRES_AT, String(expiresAt));

  // ★重要：refresh_token が更新される場合があるので保存し直す
  if (token.refresh_token) p.setProperty(PROP_KEYS.REFRESH_TOKEN, token.refresh_token);
}

function getValidAccessToken_() {
  const p = PropertiesService.getScriptProperties();
  const token = p.getProperty(PROP_KEYS.ACCESS_TOKEN);
  const expiresAt = Number(p.getProperty(PROP_KEYS.EXPIRES_AT) || '0');

  if (!token || Date.now() >= expiresAt) {
    refreshAccessToken_();
    return p.getProperty(PROP_KEYS.ACCESS_TOKEN);
  }
  return token;
}

function forceRefreshAccessToken_() {
  refreshAccessToken_();
}

/** =========================
 * 5) company_id 取得・保存
 * ========================= */

function ensureCompanyId_() {
  const p = PropertiesService.getScriptProperties();
  if (p.getProperty(PROP_KEYS.COMPANY_ID)) return;

  const accessToken = getValidAccessToken_();
  const url = CFG.FREEE_API_BASE + '/api/1/companies';

  const res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + accessToken },
    muteHttpExceptions: true,
  });

  if (res.getResponseCode() < 200 || res.getResponseCode() >= 300) {
    throw new Error(`GET /api/1/companies failed ${res.getResponseCode()}: ${res.getContentText()}`);
  }

  const json = safeJsonParse_(res.getContentText());
  const companies = json && json.companies ? json.companies : [];
  if (!companies.length) throw new Error('No companies returned.');

  p.setProperty(PROP_KEYS.COMPANY_ID, String(companies[0].id));
}

function getCompanyId_() {
  const p = PropertiesService.getScriptProperties();
  const id = p.getProperty(PROP_KEYS.COMPANY_ID);
  if (!id) throw new Error('company_id not set. Run OAuth & ensureCompanyId_().');
  return id;
}

/** =========================
 * 6) lines JSON（item/text 両対応）
 * ========================= */

function parseLinesJson_(linesJson) {
  const arr = safeJsonParse_(String(linesJson));
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error('lines_json must be a non-empty JSON array.');
  }

  return arr.map((line) => {
    const type = String(line.type || 'item');
    if (type === 'text') {
      return { type: 'text', description: String(line.description || '') };
    }

    const quantity = Number(line.quantity || 1);
    const unitPrice = String(line.unit_price || 0); // freee IV API は string を要求
    const taxRate = ('tax_rate' in line) ? Number(line.tax_rate) : CFG.DEFAULT_TAX_RATE;

    // unit が空の場合はフィールドごと省略（freee IV APIは空文字を拒否: "1文字以上"）
    const item = {
      type: 'item',
      description: String(line.description || ''),
      quantity,
      unit_price: unitPrice,
      tax_rate: taxRate,
    };
    if (line.unit && String(line.unit).trim()) item.unit = String(line.unit).trim();
    return item;
  });
}

/** =========================
 * 7) 冪等（Message-ID/キー）
 * ========================= */

function buildIdempotencyKey_(rowIndex, gmailMessageId) {
  if (gmailMessageId) return `gmail:${gmailMessageId}`;
  return `sheet:${CFG.SPREADSHEET_ID}:${CFG.SHEET_NAME}:row:${rowIndex}`;
}

/**
 * 二重作成チェック：同一冪等キーが台帳に既に記録されているか確認
 *
 * チェック順：
 *   1) A列（Message-ID）全体に同一キーがあれば処理済み ← フェーズ1のMessage-IDと照合
 *   2) S列（旧冪等キー列）全体に同一キーがあれば処理済み ← 後方互換
 * ※ G列（見積をした日）による主チェックは呼び出し元（processPendingQuotations）が担う
 */
function alreadyProcessed_(sheet, idempotencyKey) {
  if (!idempotencyKey) return false;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;

  const key = String(idempotencyKey).trim();

  // A列（フェーズ1のMessage-ID）と比較
  const aVals = sheet.getRange(2, CFG.COL_MESSAGE_ID, lastRow - 1, 1).getValues().flat().map(String);
  if (aVals.some(v => v.trim() === key)) return true;

  // S列（旧冪等キー・保険）と比較
  const sVals = sheet.getRange(2, CFG.COL_GMAIL_MESSAGE_ID, lastRow - 1, 1).getValues().flat().map(String);
  if (sVals.some(v => v.trim() === key)) return true;

  return false;
}

/** =========================
 * 8) Utilities
 * ========================= */

function getSheet_() {
  const ss = SpreadsheetApp.openById(CFG.SPREADSHEET_ID);
  const sheet = ss.getSheetByName(CFG.SHEET_NAME);
  if (!sheet) throw new Error('Sheet not found: ' + CFG.SHEET_NAME);
  return sheet;
}

function safeJsonParse_(text) {
  try { return JSON.parse(text); } catch (_) { return { raw: text }; }
}

function todayYmd_() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function normalizeDateYmd_(value) {
  if (!value) return '';
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return '';
}

function mustGet_(props, key) {
  const v = props.getProperty(key);
  if (!v) throw new Error(`Missing script property: ${key}`);
  return v;
}