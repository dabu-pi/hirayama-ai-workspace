/******************************************************
 * WR_autoSubmit.gs（単体運用OK版）
 *
 * 毎月1回（1日 21:00 JST）：
 *   1) 前月分の「年度積算_YYYY-MM月分」シートを（月報テンプレから）作成
 *   2) PDFを出力（設定のPDFフォルダIDがあればそこへ、なければ親フォルダ）
 *   3) Gmail下書きを作成（PDF添付、送信はしない）
 *   4) 提出済み確認ログを更新（PDF_READY）
 *
 * To: tanigaki-toshihiko@nantan.hyogo.jp
 * 件名：廃棄物実績報告書（YYYY-MM分）
 ******************************************************/

const WR_AUTO = {
  to: "tanigaki-toshihiko@nantan.hyogo.jp",
  subjectBase: "廃棄物実績報告書",
  triggerFunctionName: "WR_AUTO_runMonthlyFiscalDraft",
  triggerHour: 21,
  sheets: {
    ui: "収集運搬一覧",
    monthlyTpl: "月報",
    settings: "設定",
    submitLog: "提出済み確認",
  },
  status: {
    DRAFT: "DRAFT",
    PDF_READY: "PDF_READY",
    SENT: "SENT",
  },
  uiHeaders: {
    date: "日付",
    name: "排出者の氏名",
    addr: "排出先の住所",
    burn: "燃やすごみ",
    incomb: "不燃ごみ",
    recycle: "資源ごみ",
  },
  monthlyLayout: {
    firstBizTopRow: 30,
    lastBizRow: 47,
    bizCount: 9,
    totalTopRow: 48,
    totalBottomRow: 49,
    nameCol: 1,
    monthStartCol: 2,
    monthEndCol: 13,
    annualCol: 14,
    titleRangeA1: "A4:N4",
    submitDateRangeA1: "L7:N7",
  },
};

function WR_AUTO_installMonthlyTrigger() {
  const triggers = ScriptApp.getProjectTriggers();
  for (const t of triggers) {
    if (t.getHandlerFunction && t.getHandlerFunction() === WR_AUTO.triggerFunctionName) {
      ScriptApp.deleteTrigger(t);
    }
  }

  ScriptApp.newTrigger(WR_AUTO.triggerFunctionName)
    .timeBased()
    .onMonthDay(1)
    .atHour(WR_AUTO.triggerHour)
    .create();
}

function WR_AUTO_runMonthlyFiscalDraft() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const targetYm = WR_AUTO_prevYm_();

  const uiSh = ss.getSheetByName(WR_AUTO.sheets.ui);
  if (!uiSh) throw new Error(`停止：入力元シートが見つかりません：${WR_AUTO.sheets.ui}`);

  const tpl = ss.getSheetByName(WR_AUTO.sheets.monthlyTpl);
  if (!tpl) throw new Error(`停止：月報テンプレが見つかりません：${WR_AUTO.sheets.monthlyTpl}`);

  const logSh = WR_AUTO_ensureSubmitLogSheet_(ss);
  WR_AUTO_ensureSettingsSheet_(ss);

  WR_AUTO_guardNotSent_(logSh, targetYm);

  const fiscalSheetName = `年度積算_${targetYm}月分`;
  const fiscalSh = WR_AUTO_recreateFromTemplate_(ss, tpl, fiscalSheetName);

  WR_AUTO_initMonthlyZeros_(fiscalSh);
  WR_AUTO_setFiscalTitle_(fiscalSh, targetYm);
  WR_AUTO_setSubmitDate_(fiscalSh, targetYm);

  const fy = WR_AUTO_getFiscalYearRangeFromYm_(ss, targetYm);
  const cutoffExclusive = WR_AUTO_cutoffExclusiveFromYm_(targetYm);
  const toExclusive = (cutoffExclusive < fy.toExclusive) ? cutoffExclusive : fy.toExclusive;

  const records = WR_AUTO_readUiRecordsForRange_(uiSh, fy.from, toExclusive);
  const fiscalCases = WR_AUTO_buildFiscalCasesFromUi_(records);

  if (fiscalCases.order.length > WR_AUTO.monthlyLayout.bizCount) {
    throw new Error(`停止：排出者数が枠を超えています（検出=${fiscalCases.order.length}, 枠=${WR_AUTO.monthlyLayout.bizCount}）`);
  }

  WR_AUTO_writeFiscalToTemplate_(fiscalSh, fiscalCases);

  SpreadsheetApp.flush();

  const pdfName = `年度積算_${targetYm}.pdf`;
  const pdf = WR_AUTO_exportSheetToPdf_(ss, fiscalSh, pdfName);

  if (WR_AUTO_hasSimilarDraft_(WR_AUTO.to, WR_AUTO.subjectBase, targetYm)) {
    WR_AUTO_upsertSubmitLog_(logSh, targetYm, {
      status: WR_AUTO.status.PDF_READY,
      pdfUrl: pdf.url,
      error: "同一条件の下書きが既に存在するため、新規下書き作成をスキップしました。",
    });
    return;
  }

  const subject = `${WR_AUTO.subjectBase}（${targetYm}分）`;
  const body = WR_AUTO_buildMailBody_(targetYm);

  GmailApp.createDraft(
    WR_AUTO.to,
    subject,
    body,
    { attachments: [pdf.blob], name: "廃棄物収集運搬（自動作成）" }
  );

  WR_AUTO_upsertSubmitLog_(logSh, targetYm, {
    status: WR_AUTO.status.PDF_READY,
    pdfUrl: pdf.url,
    error: "",
  });
}

// ===== ユーティリティ =====
function WR_AUTO_prevYm_() {
  const tz = Session.getScriptTimeZone() || "Asia/Tokyo";
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return Utilities.formatDate(prev, tz, "yyyy-MM");
}
function WR_AUTO_parseYm_(ym) { return { y: Number(ym.slice(0, 4)), m: Number(ym.slice(5, 7)) }; }
function WR_AUTO_cutoffExclusiveFromYm_(ym) { const p = WR_AUTO_parseYm_(ym); return new Date(p.y, p.m, 1); }

function WR_AUTO_ensureSettingsSheet_(ss) {
  let sh = ss.getSheetByName(WR_AUTO.sheets.settings);
  if (!sh) sh = ss.insertSheet(WR_AUTO.sheets.settings);

  const lastRow = sh.getLastRow();
  if (lastRow === 0) {
    sh.getRange(1, 1).setValue("キー");
    sh.getRange(1, 2).setValue("値");
    sh.getRange(2, 1).setValue("PDF出力フォルダID");
    sh.getRange(2, 2).setValue("");
    sh.getRange(3, 1).setValue("年度開始月");
    sh.getRange(3, 2).setValue(4);
    sh.getRange(4, 1).setValue("年度開始年");
    sh.getRange(4, 2).setValue("");
  }
  return sh;
}

function WR_AUTO_ensureSubmitLogSheet_(ss) {
  let sh = ss.getSheetByName(WR_AUTO.sheets.submitLog);
  if (!sh) sh = ss.insertSheet(WR_AUTO.sheets.submitLog);

  const need = ["対象年月", "ステータス", "PDFリンク", "生成日時", "実行者", "エラー内容"];
  const lastCol = Math.max(sh.getLastColumn(), need.length);
  const header = (sh.getLastRow() >= 1)
    ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(v => String(v || "").trim())
    : [];

  const exists = header.filter(h => h).length > 0;

  if (!exists) {
    sh.getRange(1, 1, 1, need.length).setValues([need]);
    return sh;
  }

  const set = new Set(header);
  let col = header.length;
  for (const h of need) {
    if (!set.has(h)) {
      col++;
      sh.getRange(1, col).setValue(h);
    }
  }
  return sh;
}

function WR_AUTO_getSubmitLogColMap_(logSh) {
  const header = logSh.getRange(1, 1, 1, logSh.getLastColumn()).getValues()[0].map(v => String(v || "").trim());
  const idx = (name) => {
    const i = header.findIndex(h => h === name);
    if (i < 0) throw new Error(`提出済み確認：ヘッダー不足：${name}`);
    return i;
  };
  return {
    targetYm: idx("対象年月"),
    status: idx("ステータス"),
    pdfUrl: idx("PDFリンク"),
    createdAt: idx("生成日時"),
    actor: idx("実行者"),
    error: idx("エラー内容"),
  };
}

function WR_AUTO_guardNotSent_(logSh, targetYm) {
  const map = WR_AUTO_getSubmitLogColMap_(logSh);
  const rows = logSh.getLastRow();
  if (rows < 2) return;

  const vals = logSh.getRange(2, 1, rows - 1, logSh.getLastColumn()).getValues();
  for (let i = 0; i < vals.length; i++) {
    const ym = String(vals[i][map.targetYm] || "").trim();
    if (ym !== targetYm) continue;
    const st = String(vals[i][map.status] || "").trim();
    if (st === WR_AUTO.status.SENT) throw new Error(`停止：対象月 ${targetYm} はステータス=SENT のため更新禁止です`);
  }
}

function WR_AUTO_upsertSubmitLog_(logSh, targetYm, patch) {
  const map = WR_AUTO_getSubmitLogColMap_(logSh);
  const now = new Date();
  const user = Session.getActiveUser().getEmail() || "";

  const rows = logSh.getLastRow();
  const data = rows >= 2
    ? logSh.getRange(2, 1, rows - 1, logSh.getLastColumn()).getValues()
    : [];

  let rowIndex = -1;
  for (let i = 0; i < data.length; i++) {
    const ym = String(data[i][map.targetYm] || "").trim();
    if (ym === targetYm) { rowIndex = i; break; }
  }
  const sheetRow = (rowIndex >= 0) ? (2 + rowIndex) : (logSh.getLastRow() + 1);

  logSh.getRange(sheetRow, map.targetYm + 1).setValue(targetYm);
  if (patch.status != null) logSh.getRange(sheetRow, map.status + 1).setValue(patch.status);
  if (patch.pdfUrl != null) logSh.getRange(sheetRow, map.pdfUrl + 1).setValue(patch.pdfUrl);
  if (patch.error != null) logSh.getRange(sheetRow, map.error + 1).setValue(patch.error);

  logSh.getRange(sheetRow, map.createdAt + 1).setValue(now);
  logSh.getRange(sheetRow, map.actor + 1).setValue(user);
}

function WR_AUTO_recreateFromTemplate_(ss, tplSheet, workName) {
  const existing = ss.getSheetByName(workName);
  if (existing) ss.deleteSheet(existing);
  const sh = tplSheet.copyTo(ss).setName(workName);
  ss.setActiveSheet(sh);
  return sh;
}

function WR_AUTO_initMonthlyZeros_(sh) {
  const L = WR_AUTO.monthlyLayout;
  const r1 = L.firstBizTopRow;
  const r2 = L.lastBizRow;
  const c1 = L.monthStartCol;
  const c2 = L.annualCol;

  sh.getRange(r1, c1, (r2 - r1 + 1), (c2 - c1 + 1)).setValue(0);
  sh.getRange(L.totalTopRow, c1, 2, (c2 - c1 + 1)).setValue(0);
  sh.getRange(r1, L.nameCol, (r2 - r1 + 1), 1).clearContent();

  const totalRg = sh.getRange(L.totalTopRow, L.nameCol, 2, 1);
  try { totalRg.breakApart(); } catch (e) {}
  totalRg.merge();
  sh.getRange(L.totalTopRow, L.nameCol).setValue("合計");
}

function WR_AUTO_setFiscalTitle_(sh, targetYm) {
  const p = WR_AUTO_parseYm_(targetYm);
  const titleText = `一般廃棄物収集運搬業務実績報告書（${p.y}年${p.m}月分）`;

  const rg = sh.getRange(WR_AUTO.monthlyLayout.titleRangeA1);
  try { rg.breakApart(); } catch (e) {}
  rg.merge();
  rg.setValue(titleText);
}
function WR_AUTO_setSubmitDate_(sh, targetYm) {
  const p = WR_AUTO_parseYm_(targetYm);
  const endOfMonth = new Date(p.y, p.m, 0);

  const rg = sh.getRange(WR_AUTO.monthlyLayout.submitDateRangeA1);
  try { rg.breakApart(); } catch (e) {}
  rg.merge();
  rg.setValue(endOfMonth);
}

function WR_AUTO_getFiscalYearRangeFromYm_(ss, targetYm) {
  const p = WR_AUTO_parseYm_(targetYm);
  const startMonth = WR_AUTO_getSettingNumber_(ss, "年度開始月", 4);
  if (!(startMonth >= 1 && startMonth <= 12)) throw new Error(`設定：年度開始月が不正（1-12）：${startMonth}`);

  const fixedStartYear = WR_AUTO_getSettingNumber_(ss, "年度開始年", null);
  if (fixedStartYear != null && !(fixedStartYear >= 2000 && fixedStartYear <= 2100)) {
    throw new Error(`設定：年度開始年が不正（2000-2100）：${fixedStartYear}`);
  }

  const fyStartYear = (fixedStartYear != null)
    ? fixedStartYear
    : ((p.m >= startMonth) ? p.y : (p.y - 1));

  const from = new Date(fyStartYear, startMonth - 1, 1);
  const toExclusive = new Date(fyStartYear + 1, startMonth - 1, 1);
  return { fyStartYear, startMonth, from, toExclusive };
}

function WR_AUTO_getSettingNumber_(ss, key, defaultValue) {
  const sh = ss.getSheetByName(WR_AUTO.sheets.settings);
  if (!sh) return defaultValue;
  const v = sh.getDataRange().getValues();
  for (let i = 0; i < v.length; i++) {
    const k = String(v[i][0] || "").trim();
    if (k !== key) continue;
    const raw = v[i][1];
    if (raw === "" || raw == null) return defaultValue;
    const n = Number(String(raw).trim());
    if (!isFinite(n)) throw new Error(`設定：${key} が数値ではありません：${raw}`);
    return n;
  }
  return defaultValue;
}

function WR_AUTO_readUiRecordsForRange_(uiSh, from, toExclusive) {
  const values = uiSh.getDataRange().getValues();
  if (values.length < 2) return [];

  const header = values[0].map(v => String(v || "").trim());
  const col = WR_AUTO_buildColMap_(header);

  const need = [
    WR_AUTO.uiHeaders.date,
    WR_AUTO.uiHeaders.name,
    WR_AUTO.uiHeaders.addr,
    WR_AUTO.uiHeaders.burn,
    WR_AUTO.uiHeaders.incomb,
    WR_AUTO.uiHeaders.recycle,
  ];
  for (const h of need) if (col[h] == null) throw new Error(`収集運搬一覧：必須ヘッダー不足：${h}`);

  const out = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];

    const name = String(row[col[WR_AUTO.uiHeaders.name]] || "").trim();
    if (!name) continue;

    const addr = String(row[col[WR_AUTO.uiHeaders.addr]] || "").trim();
    if (!addr) throw new Error(`停止：排出先住所が空欄（収集運搬一覧 行${r + 1}）`);

    const dt = WR_AUTO_toDate_(row[col[WR_AUTO.uiHeaders.date]]);
    if (!dt) throw new Error(`停止：日付が不正（収集運搬一覧 行${r + 1}）`);

    if (!(dt >= from && dt < toExclusive)) continue;

    const burn = WR_AUTO_toNumberOrZero_(row[col[WR_AUTO.uiHeaders.burn]], `燃やすごみ（行${r + 1}）`);
    const incomb = WR_AUTO_toNumberOrZero_(row[col[WR_AUTO.uiHeaders.incomb]], `不燃ごみ（行${r + 1}）`);
    const recycle = WR_AUTO_toNumberOrZero_(row[col[WR_AUTO.uiHeaders.recycle]], `資源ごみ（行${r + 1}）`);

    out.push({
      m: dt.getMonth() + 1,
      name,
      addr,
      burn,
      incomb,
      recycle,
    });
  }
  return out;
}

function WR_AUTO_buildFiscalCasesFromUi_(records) {
  const byKey = {};
  const order = [];

  for (const rec of records) {
    const key = `${rec.name}|${rec.addr}`;
    if (!byKey[key]) {
      byKey[key] = { name: rec.name, addr: rec.addr, months: {} };
      order.push(key);
    }
    const general = rec.burn + rec.incomb;
    const recycle = rec.recycle;

    if (!byKey[key].months[rec.m]) byKey[key].months[rec.m] = { general: 0, recycle: 0 };
    byKey[key].months[rec.m].general += general;
    byKey[key].months[rec.m].recycle += recycle;
  }
  return { byKey, order };
}

function WR_AUTO_writeFiscalToTemplate_(sh, fiscalCases) {
  const L = WR_AUTO.monthlyLayout;
  const totalByCol = {};
  for (let col = L.monthStartCol; col <= L.monthEndCol; col++) totalByCol[col] = { general: 0, recycle: 0 };

  const m2col = { 4:2,5:3,6:4,7:5,8:6,9:7,10:8,11:9,12:10,1:11,2:12,3:13 };

  for (let i = 0; i < fiscalCases.order.length; i++) {
    const key = fiscalCases.order[i];
    const c = fiscalCases.byKey[key];
    const topRow = L.firstBizTopRow + i * 2;

    sh.getRange(topRow, L.nameCol).setValue(c.name);

    for (const [monthStr, v] of Object.entries(c.months)) {
      const month = Number(monthStr);
      const col = m2col[month];
      if (!col) continue;

      sh.getRange(topRow, col).setValue(v.general);
      sh.getRange(topRow + 1, col).setValue(v.recycle);

      totalByCol[col].general += v.general;
      totalByCol[col].recycle += v.recycle;
    }

    sh.getRange(topRow, L.annualCol)
      .setFormulaR1C1(`=SUM(R[0]C${L.monthStartCol}:R[0]C${L.monthEndCol})`);
    sh.getRange(topRow + 1, L.annualCol)
      .setFormulaR1C1(`=SUM(R[0]C${L.monthStartCol}:R[0]C${L.monthEndCol})`);
  }

  for (let col = L.monthStartCol; col <= L.monthEndCol; col++) {
    sh.getRange(L.totalTopRow, col).setValue(totalByCol[col].general);
    sh.getRange(L.totalBottomRow, col).setValue(totalByCol[col].recycle);
  }

  sh.getRange(L.totalTopRow, L.annualCol)
    .setFormulaR1C1(`=SUM(R[0]C${L.monthStartCol}:R[0]C${L.monthEndCol})`);
  sh.getRange(L.totalBottomRow, L.annualCol)
    .setFormulaR1C1(`=SUM(R[0]C${L.monthStartCol}:R[0]C${L.monthEndCol})`);
}

function WR_AUTO_exportSheetToPdf_(ss, sheet, fileName) {
  const folder = WR_AUTO_getPdfFolder_(ss);

  const url = ss.getUrl().replace(/edit$/, "") +
    "export?format=pdf" +
    "&size=A4" +
    "&portrait=true" +
    "&fitw=true" +
    "&sheetnames=false&printtitle=false&pagenumbers=false&gridlines=false&fzr=false" +
    `&gid=${sheet.getSheetId()}`;

  const token = ScriptApp.getOAuthToken();
  const resp = UrlFetchApp.fetch(url, {
    headers: { Authorization: "Bearer " + token },
    muteHttpExceptions: false,
  });

  const blob = resp.getBlob().setName(fileName);
  const file = folder.createFile(blob);
  return { id: file.getId(), url: file.getUrl(), blob };
}
function WR_AUTO_getPdfFolder_(ss) {
  const sh = ss.getSheetByName(WR_AUTO.sheets.settings);
  let folderId = null;

  if (sh) {
    const v = sh.getDataRange().getValues();
    for (let i = 0; i < v.length; i++) {
      const k = String(v[i][0] || "").trim();
      if (k === "PDF出力フォルダID") {
        folderId = String(v[i][1] || "").trim();
        break;
      }
    }
  }

  if (folderId) {
    try { return DriveApp.getFolderById(folderId); }
    catch (e) { throw new Error(`設定：PDF出力フォルダIDが不正です：${folderId}`); }
  }

  const file = DriveApp.getFileById(ss.getId());
  const parents = file.getParents();
  if (parents.hasNext()) return parents.next();
  return DriveApp.getRootFolder();
}

function WR_AUTO_buildMailBody_(targetYm) {
  const p = WR_AUTO_parseYm_(targetYm);
  return (
`南但クリーンセンター
谷垣 様

いつもお世話になっております。
廃棄物収集運搬業務の実績報告書（${p.y}年${p.m}月分）をお送りいたします。

本メールにはPDFファイルを添付しております。
ご査収のほどよろしくお願い申し上げます。

――――――――――――――――――
（自動作成）
`
  );
}

function WR_AUTO_hasSimilarDraft_(to, subjectBase, targetYm) {
  try {
    const q = `in:drafts to:${to} subject:(${subjectBase}) ${targetYm}`;
    const threads = GmailApp.search(q, 0, 5);
    return threads && threads.length > 0;
  } catch (e) {
    return false;
  }
}

function WR_AUTO_buildColMap_(headerRow) {
  const map = {};
  for (let i = 0; i < headerRow.length; i++) {
    const h = String(headerRow[i] || "").trim();
    if (!h) continue;
    map[h] = i;
  }
  return map;
}
function WR_AUTO_toDate_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  const dt = new Date(v);
  if (dt instanceof Date && !isNaN(dt.getTime())) return dt;
  return null;
}
function WR_AUTO_toNumberOrZero_(v, label) {
  if (v === "" || v == null) return 0;
  if (typeof v === "number") {
    if (!isFinite(v)) throw new Error(`停止：数量が不正（${label}）`);
    return v;
  }
  const s = String(v).trim();
  if (s === "") return 0;
  const n = Number(s);
  if (!isFinite(n)) throw new Error(`停止：数量が非数値（${label}）`);
  return n;
}