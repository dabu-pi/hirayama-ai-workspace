/*******************************************************
 * フェーズ3：freee見積書PDF → Gmail下書き作成
 *
 * 前提（同一GASプロジェクト内で他ファイルの変数を参照）:
 *   - freee請求書作成.js の CFG, safeJsonParse_, getValidAccessToken_,
 *     getCompanyId_, getSheet_ が利用可能
 *   - hawkメール自動貼り付け.js の CONFIG が利用可能
 *
 * 処理:
 *   - R列（quotation_id）あり かつ U列（下書き作成日）空 の行を対象
 *   - freee IV APIからPDFを取得して添付（失敗時は見積URLを本文に貼る）
 *   - 元スレッドへの返信下書きをGmailに保存（絶対に送信しない）
 *   - U列に下書き作成日時を記録
 *******************************************************/

const P3 = {
  COL_DRAFT_CREATED_AT: 21, // U列：下書き作成日時（T列はCFG.COL_CHECK_REQUIREDが使用）
};

// ===================== 公開関数 =====================

/**
 * メイン処理：見積済み・下書き未作成の行を一括処理する
 * 時間トリガーまたは手動で実行
 */
function phase3_createDraftsForQuotedRows() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) { console.log('データなし'); return; }

  const colCount = Math.max(sheet.getLastColumn(), P3.COL_DRAFT_CREATED_AT);
  const values = sheet.getRange(2, 1, lastRow - 1, colCount).getValues();
  let created = 0;

  for (let i = 0; i < values.length; i++) {
    const rowIndex = i + 2;
    const row = values[i];

    // R列に quotation_id がなければスキップ
    const quotationId = String(row[CFG.COL_FREEE_QUOTATION_ID - 1] || '').trim();
    if (!quotationId) continue;

    // U列が埋まっていれば処理済み
    const draftCreatedAt = row[P3.COL_DRAFT_CREATED_AT - 1];
    if (draftCreatedAt) continue;

    const customerName = String(row[CFG.COL_CUSTOMER_NAME - 1] || '要確認').trim();
    const subject = String(row[CFG.COL_DESC - 1] || '').trim();

    // GmailメッセージIDを取得（O列URL → A列RFC ID の順で試みる）
    const gmailMessageId = p3_getGmailMessageId_(sheet, rowIndex);
    if (!gmailMessageId) {
      console.warn(`行${rowIndex}: GmailメッセージIDを取得できません。スキップ。`);
      continue;
    }

    // PDF取得（失敗してもURL本文貼り付けで続行）
    let pdfBlob = null;
    try {
      pdfBlob = p3_downloadPdf_(quotationId);
    } catch (err) {
      console.warn(`行${rowIndex}: PDF取得失敗（URL本文記載に切り替え）: ${err.message || err}`);
    }

    const freeeUrl = `https://app.freee.co.jp/invoice/quotations/${quotationId}`;
    const body = p3_buildBody_(customerName, subject, freeeUrl, /* isUrlFallback= */ !pdfBlob);

    try {
      p3_createDraftReply_(gmailMessageId, body, pdfBlob);
      sheet.getRange(rowIndex, P3.COL_DRAFT_CREATED_AT)
        .setValue(new Date())
        .setNumberFormat('yyyy/MM/dd HH:mm');
      console.log(`✅ 行${rowIndex} 下書き作成: ${customerName}`);
      created++;
    } catch (err) {
      console.error(`❌ 行${rowIndex} 下書き作成失敗: ${err.message || err}`);
    }
  }

  console.log(`phase3 完了: created=${created}`);
}

/**
 * テスト実行：最初の対象行（R列あり・T列空）で下書きを1件作成する
 * T列は更新しない（テスト用）
 */
function phase3_testDraft() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) { console.log('データなし'); return; }

  const colCount = Math.max(sheet.getLastColumn(), P3.COL_DRAFT_CREATED_AT);
  const values = sheet.getRange(2, 1, lastRow - 1, colCount).getValues();

  let targetRow = null;
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const qid = String(row[CFG.COL_FREEE_QUOTATION_ID - 1] || '').trim();
    const draftAt = row[P3.COL_DRAFT_CREATED_AT - 1];
    if (qid && !draftAt) { targetRow = i + 2; break; }
  }

  if (!targetRow) {
    console.log('処理対象行なし（R列あり・U列空 の行がありません）');
    return;
  }

  const row = values[targetRow - 2];
  const quotationId = String(row[CFG.COL_FREEE_QUOTATION_ID - 1] || '').trim();
  const customerName = String(row[CFG.COL_CUSTOMER_NAME - 1] || '要確認').trim();
  const subject = String(row[CFG.COL_DESC - 1] || '').trim();

  console.log(`=== テスト対象: 行${targetRow} / ${customerName} / quotation_id=${quotationId} ===`);

  const gmailMessageId = p3_getGmailMessageId_(sheet, targetRow);
  console.log('GmailメッセージID:', gmailMessageId || '（取得失敗）');

  if (!gmailMessageId) {
    console.error('GmailメッセージIDが取得できません（O列のHYPERLINK式またはA列のMessage-IDを確認）');
    return;
  }

  let pdfBlob = null;
  try {
    pdfBlob = p3_downloadPdf_(quotationId);
    console.log(`PDF取得成功: ${pdfBlob.getBytes().length} bytes`);
  } catch (err) {
    console.warn('PDF取得失敗（URL本文記載に切り替え）:', err.message || err);
  }

  const freeeUrl = `https://app.freee.co.jp/invoice/quotations/${quotationId}`;
  const body = p3_buildBody_(customerName, subject, freeeUrl, !pdfBlob);
  console.log('--- 下書き本文 ---\n' + body + '\n---');

  try {
    p3_createDraftReply_(gmailMessageId, body, pdfBlob);
    console.log('✅ 下書き作成成功（テストなのでU列は更新していません）');
    console.log('Gmail の下書きボックスに保存されました。確認後、不要なら削除してください。');
  } catch (err) {
    console.error('❌ 下書き作成失敗:', err.message || err);
  }
}

/**
 * freee見積書のPDF取得を診断する（APIレスポンス構造を確認する目的）
 * @param {string} quotationId freee quotation_id（省略時はR列の最初の値を使用）
 */
function phase3_diagnosePdf(quotationId) {
  let qid = quotationId;
  if (!qid) {
    const sheet = getSheet_();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) { console.log('データなし'); return; }
    const values = sheet.getRange(2, CFG.COL_FREEE_QUOTATION_ID, lastRow - 1, 1).getValues();
    for (const [v] of values) {
      if (v) { qid = String(v).trim(); break; }
    }
  }
  if (!qid) { console.log('quotation_idが見つかりません'); return; }

  console.log('対象 quotation_id:', qid);
  const token = getValidAccessToken_();
  const companyId = getCompanyId_();

  // 見積書詳細を取得してレスポンス構造を確認
  const detailUrl = `${CFG.FREEE_API_BASE}${CFG.IV_BASE_PATH}/quotations/${qid}?company_id=${companyId}`;
  const detailRes = UrlFetchApp.fetch(detailUrl, {
    method: 'get',
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    muteHttpExceptions: true,
  });
  console.log('詳細取得 status:', detailRes.getResponseCode());
  const detailText = detailRes.getContentText();
  console.log('詳細レスポンス（抜粋）:', detailText.slice(0, 500));

  // download_url / file_src フィールドの確認
  const detail = safeJsonParse_(detailText);
  const q = (detail && detail.quotation) ? detail.quotation : detail;
  console.log('download_url:', (q && q.download_url) || 'なし');
  console.log('file_src    :', (q && q.file_src) || 'なし');

  // /download エンドポイントも試す
  const dlUrl = `${CFG.FREEE_API_BASE}${CFG.IV_BASE_PATH}/quotations/${qid}/download`;
  const dlRes = UrlFetchApp.fetch(dlUrl, {
    method: 'get',
    headers: { Authorization: `Bearer ${token}` },
    muteHttpExceptions: true,
  });
  console.log('/download status:', dlRes.getResponseCode());
  if (dlRes.getResponseCode() === 200) {
    console.log('→ PDF取得OK: Content-Type =', dlRes.getHeaders()['Content-Type'] || '不明');
  } else {
    console.log('→ エラー:', dlRes.getContentText().slice(0, 200));
  }
}

// ===================== 内部ヘルパー =====================

/**
 * freee IV APIで見積書PDFをダウンロードしてBlobで返す
 * 試行順:
 *   1. 見積書詳細レスポンスの download_url / file_src（将来の API 対応に備え残す）
 *   2. Accept: application/pdf による Content-Negotiation
 * ※ /quotations/{id}/download は 404 が確認済みのため試行しない
 */
function p3_downloadPdf_(quotationId) {
  const token = getValidAccessToken_();
  const companyId = getCompanyId_();
  let quotationNumber = quotationId;

  // 見積書詳細を取得（quotation_number 取得 + download_url 確認）
  const detailRes = UrlFetchApp.fetch(
    `${CFG.FREEE_API_BASE}${CFG.IV_BASE_PATH}/quotations/${quotationId}?company_id=${companyId}`,
    { method: 'get', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }, muteHttpExceptions: true }
  );
  if (detailRes.getResponseCode() === 200) {
    const q = safeJsonParse_(detailRes.getContentText());
    const quotation = (q && q.quotation) ? q.quotation : q;
    if (quotation && quotation.quotation_number) quotationNumber = quotation.quotation_number;

    // download_url / file_src が提供されていれば使用（API が将来対応した場合）
    const downloadUrl = (quotation && (quotation.download_url || quotation.file_src)) || null;
    if (downloadUrl) {
      const r = UrlFetchApp.fetch(downloadUrl, {
        method: 'get', headers: { Authorization: `Bearer ${token}` }, muteHttpExceptions: true,
      });
      if (r.getResponseCode() === 200) {
        return r.getBlob().setName(`見積書_${quotationNumber}.pdf`);
      }
    }
  }

  // Accept: application/pdf で Content-Negotiation を試みる
  const pdfRes = UrlFetchApp.fetch(
    `${CFG.FREEE_API_BASE}${CFG.IV_BASE_PATH}/quotations/${quotationId}?company_id=${companyId}`,
    { method: 'get', headers: { Authorization: `Bearer ${token}`, Accept: 'application/pdf' }, muteHttpExceptions: true }
  );
  if (pdfRes.getResponseCode() === 200) {
    const ct = (pdfRes.getHeaders()['Content-Type'] || pdfRes.getHeaders()['content-type'] || '').toLowerCase();
    if (ct.includes('pdf')) {
      return pdfRes.getBlob().setName(`見積書_${quotationNumber}.pdf`);
    }
  }

  throw new Error(`freee IV API はPDFダウンロード非対応（status: ${pdfRes.getResponseCode()}）`);
}

/**
 * O列のHYPERLINK式 → A列のRFC Message-ID の順で Gmail 内部メッセージIDを取得する
 */
function p3_getGmailMessageId_(sheet, rowIndex) {
  // 1) O列のHYPERLINK式からURLを解析
  try {
    const formula = sheet.getRange(rowIndex, CFG.COL_MAIL_LINK).getFormula();
    if (formula) {
      // 例: =HYPERLINK("https://mail.google.com/mail/u/0/#all/18e5c3a5b4c2d1e0","長谷川")
      const m = formula.match(/\/#all\/([^"]+)/);
      if (m && m[1]) return decodeURIComponent(m[1]);
    }
  } catch (_) {}

  // 2) A列のRFC Message-IDで Gmail を検索（フォールバック）
  const rfcId = String(sheet.getRange(rowIndex, CFG.COL_MESSAGE_ID).getValue() || '').trim();
  if (rfcId && rfcId.includes('@')) {
    try {
      const query = `rfc822msgid:${rfcId.replace(/[<>]/g, '')}`;
      const threads = GmailApp.search(query, 0, 1);
      if (threads.length > 0) {
        const msgs = threads[0].getMessages();
        // hawkからのメッセージを優先
        for (const m of msgs) {
          if ((m.getFrom() || '').toLowerCase().includes(CONFIG.HAWK_EMAIL.toLowerCase())) {
            return m.getId();
          }
        }
        if (msgs.length > 0) return msgs[0].getId();
      }
    } catch (e) {
      console.warn(`rfc822msgid検索失敗:`, e.message || e);
    }
  }

  return null;
}

/**
 * Gmail下書き返信を作成する（スレッドへの返信・絶対送信しない）
 */
function p3_createDraftReply_(gmailMessageId, body, pdfBlob) {
  const msg = GmailApp.getMessageById(gmailMessageId);
  const thread = msg.getThread();
  const options = {};
  if (pdfBlob) options.attachments = [pdfBlob];
  return thread.createDraftReply(body, options);
}

/**
 * 下書き返信本文を生成する
 * @param {string} customerName  B列のお客様名
 * @param {string} subject       D列の案件内容
 * @param {string} freeeUrl      freee見積書のアプリURL
 * @param {boolean} isUrlFallback PDF添付なし（URL貼り付けモード）のとき true
 */
function p3_buildBody_(customerName, subject, freeeUrl, isUrlFallback) {
  const lines = [
    'お世話になっております。',
    '',
  ];

  if (isUrlFallback) {
    lines.push(`${customerName}様の見積書を作成しました。`);
    lines.push('');
    lines.push('■ freee 見積書URL');
    lines.push(freeeUrl);
    lines.push('');
    lines.push('※ PDFの確認・送付はこちらのURLからお願いいたします。');
  } else {
    lines.push(`${customerName}様の見積書をPDFにて添付いたします。`);
    if (subject) {
      lines.push('');
      lines.push(`【件名】${subject}`);
    }
  }

  lines.push('');
  lines.push('よろしくお願いいたします。');

  return lines.join('\n');
}
