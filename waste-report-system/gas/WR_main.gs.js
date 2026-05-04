/******************************************************
 * WR_main.gs（統合版）
 * 一般廃棄物収集運搬業：日報・月報・年度積算（2系統）
 *
 * 含む機能：
 *  - 日報 作成（UI→日報_YYYY-MM）
 *  - 月報 作成（B案：日報→月報_YYYY-MM、PDF出力）
 *  - 年度積算 作成（指定YYYY-MM月分：年度開始〜指定月まで集計、月報テンプレ1枚）
 *  - 年度積算 v2（年度選択：9社/ページ、複数ページ、ページ別PDF）
 *
 * 注意：
 *  - WR2_ は「指定YYYY-MM月分の年度積算」
 *  - WR2V2_ は「年度選択（複数ページ）年度積算 v2」
 ******************************************************/

// =====================
// 共通定数
// =====================
const WR_SHEETS = {
  ui: "収集運搬一覧",
  dailyTpl: "日報",
  monthlyTpl: "月報",
  settings: "設定",
  submitLog: "提出済み確認",
};

const WR_STATUS = {
  DRAFT: "DRAFT",
  PDF_READY: "PDF_READY",
  SENT: "SENT",
};

const WR_UI_HEADERS = {
  date: "日付",
  name: "排出者の氏名",
  addr: "排出先の住所",
  carType: "収集運搬の車種",
  carNo: "車番",
  burn: "燃やすごみ",
  incomb: "不燃ごみ",
  recycle: "資源ごみ",
};

// 月報（提出用）セル仕様（確定）
const WR_MONTHLY = {
  headerRow: 29,        // A29:N29
  firstBizTopRow: 30,   // A30:A31 が1社（結合）
  lastBizRow: 47,       // A46:A47 が9社目（結合）
  bizCount: 9,          // 9社
  totalTopRow: 48,      // A48:A49 結合「合計」
  totalBottomRow: 49,
  nameCol: 1,           // A
  monthStartCol: 2,     // B=2
  monthEndCol: 13,      // M=13
  annualCol: 14,        // N=14
  titleRangeA1: "A4:N4",          // タイトル（結合セル）
  submitDateRangeA1: "L7:N7",     // 提出日（結合セル）
};

// 日報（帳票型）セル仕様（確定）
const WR_DAILY = {
  dayStartCol: 11, // K
  dayEndCol: 41,   // AO
  ymRow: 4,        // K4:AO4
  dayRow: 5,       // K5:AO5
  dowRow: 6,       // K6:AO6
  blockFirstRow: 7, // 案件1は 7-10
  blockSize: 4,     // 4行ブロック
  nameCol: 5,       // E
  addrCol: 6,       // F
  carCol: 9,        // I
  fixedCol: 10,     // J
  rowTypeOffset: { burn: 0, incomb: 1, recycle: 2 },
  sumCol: 42,       // AP
};

// =====================
// メニュー
// =====================
function onOpen(e) {
  try {
    const ui = SpreadsheetApp.getUi();
    ui.createMenu("月報・日報 自動")
      .addItem("日報 作成（今月）", "WR_buildDaily_thisMonth")
      .addItem("月報 作成（今月）", "WR_buildMonthly_thisMonth")
      .addSeparator()
      .addItem("日報 作成（指定YYYY-MM）", "WR_promptDaily")
      .addItem("月報 作成（指定YYYY-MM）", "WR_promptMonthly")
      .addSeparator()
      .addItem("年度積算 作成（指定YYYY-MM月分）", "WR2_promptFiscal") // ★指定YYYY-MM月分
      .addSeparator()
      .addItem("年度積算 v2（設定の年度選択）", "WR2V2_buildFiscalReport_fromSettings") // ★年度選択（複数ページ）
      .addToUi();
  } catch (err) {
    // no-op（UIのない実行コンテキスト対策）
  }
}

// =====================
// 日報・月報（B案）エントリ
// =====================
function WR_buildDaily_thisMonth() {
  const ym = WR_formatYm_(new Date());
  WR_buildDailySheet(ym);
}
function WR_buildMonthly_thisMonth() {
  const ym = WR_formatYm_(new Date());
  WR_buildMonthlyReport(ym);
}
function WR_promptDaily() {
  const ym = WR_promptYm_();
  if (!ym) return;
  WR_buildDailySheet(ym);
}
function WR_promptMonthly() {
  const ym = WR_promptYm_();
  if (!ym) return;
  WR_buildMonthlyReport(ym);
}
function WR_promptYm_() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt("対象年月", "YYYY-MM 形式で入力してください（例：2026-02）", ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return null;
  const ym = (res.getResponseText() || "").trim();
  WR_assertYm_(ym);
  return ym;
}

// =====================================================
// 8.1 日報 buildDailySheet(targetYm)
// =====================================================
function WR_buildDailySheet(targetYm) {
  WR_assertYm_(targetYm);
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  WR_guardNotSent_(ss, targetYm);

  const workName = `日報_${targetYm}`;
  const sh = WR_recreateFromTemplate_(ss, WR_SHEETS.dailyTpl, workName);

  // ★事故対策：ヘッダーは強制的に結合解除→再セット
  WR_setDailyHeader_(sh, targetYm);

  const uiSh = WR_getSheetOrThrow_(ss, WR_SHEETS.ui);
  const uiData = WR_readUiRecordsForYm_(uiSh, targetYm);
  const cases = WR_buildCasesFromUi_(uiData);

  const maxCases = WR_getDailyMaxCases_(sh);
  if (cases.order.length > maxCases) {
    throw new Error(`案件ブロック不足：案件数=${cases.order.length}, 可能数=${maxCases}`);
  }

  WR_clearDailyNumbers_(sh);

  // ★J列ラベル欠損補修
  WR_ensureDailyRowLabels_(sh);

  WR_writeCasesToDaily_(sh, targetYm, cases);

  // ★AP列合計（必ず式）
  WR_setDailySumFormulas_(sh);

  WR_upsertSubmitLog_(ss, targetYm, {
    status: WR_STATUS.DRAFT,
    dailyName: workName,
  });

  SpreadsheetApp.flush();
}

// =====================================================
// 8.2 月報 buildMonthlyReport(targetYm)  ★B案：日報参照★
// =====================================================
function WR_buildMonthlyReport(targetYm) {
  WR_assertYm_(targetYm);
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  WR_guardNotSent_(ss, targetYm);

  // ★転記元の日報を必須にする（B案）
  const dailyName = `日報_${targetYm}`;
  const dailySh = ss.getSheetByName(dailyName);
  if (!dailySh) {
    throw new Error(`停止：転記元の日報が見つかりません：${dailyName}（先に日報を作成してください）`);
  }

  // 作業用月報をテンプレから作成
  const monthlyName = `月報_${targetYm}`;
  const monthlySh = WR_recreateFromTemplate_(ss, WR_SHEETS.monthlyTpl, monthlyName);

  // ★タイトル設定（A4:N4 結合セル）
  {
    const p = WR_parseYm_(targetYm);
    const titleText = `一般廃棄物収集運搬業務実績報告書 （${p.y}年${p.m}月分）`;

    const a1 = WR_MONTHLY.titleRangeA1 || "A4:N4";
    const titleRg = monthlySh.getRange(a1);
    try { titleRg.breakApart(); } catch (e) {}
    titleRg.merge();
    titleRg.setValue(titleText);
  }

  // 0初期化（B30:N49）＋ 合計(A48:A49結合)
  WR_initMonthlyZeros_(monthlySh);

  // 対象月列（B..M）
  const targetMonthCol = WR_monthColFromYm_(targetYm);

  // 日報から案件（排出者）と月合計を抽出
  const dailyCases = WR_readDailyCasesForMonthly_(dailySh);

  // 枠チェック（9社）
  if (dailyCases.length > WR_MONTHLY.bizCount) {
    throw new Error(`停止：日報の排出者数が月報の枠を超えています（検出=${dailyCases.length}, 枠=${WR_MONTHLY.bizCount}）`);
  }

  let totalGeneral = 0;
  let totalRecycle = 0;

  for (let i = 0; i < dailyCases.length; i++) {
    const c = dailyCases[i];
    const topRow = WR_MONTHLY.firstBizTopRow + i * 2;

    monthlySh.getRange(topRow, WR_MONTHLY.nameCol).setValue(c.name);
    monthlySh.getRange(topRow, targetMonthCol).setValue(c.general);
    monthlySh.getRange(topRow + 1, targetMonthCol).setValue(c.recycle);

    totalGeneral += c.general;
    totalRecycle += c.recycle;

    monthlySh.getRange(topRow, WR_MONTHLY.annualCol)
      .setFormulaR1C1(`=SUM(R[0]C${WR_MONTHLY.monthStartCol}:R[0]C${WR_MONTHLY.monthEndCol})`);
    monthlySh.getRange(topRow + 1, WR_MONTHLY.annualCol)
      .setFormulaR1C1(`=SUM(R[0]C${WR_MONTHLY.monthStartCol}:R[0]C${WR_MONTHLY.monthEndCol})`);
  }

  // 合計行
  monthlySh.getRange(WR_MONTHLY.totalTopRow, targetMonthCol).setValue(totalGeneral);
  monthlySh.getRange(WR_MONTHLY.totalBottomRow, targetMonthCol).setValue(totalRecycle);

  monthlySh.getRange(WR_MONTHLY.totalTopRow, WR_MONTHLY.annualCol)
    .setFormulaR1C1(`=SUM(R[0]C${WR_MONTHLY.monthStartCol}:R[0]C${WR_MONTHLY.monthEndCol})`);
  monthlySh.getRange(WR_MONTHLY.totalBottomRow, WR_MONTHLY.annualCol)
    .setFormulaR1C1(`=SUM(R[0]C${WR_MONTHLY.monthStartCol}:R[0]C${WR_MONTHLY.monthEndCol})`);

  // ★提出日：対象年月の末日
  {
    const p = WR_parseYm_(targetYm);
    const endOfMonth = new Date(p.y, p.m, 0);
    const submitRg = monthlySh.getRange(WR_MONTHLY.submitDateRangeA1);
    try { submitRg.breakApart(); } catch (e) {}
    submitRg.merge();
    submitRg.setValue(endOfMonth);
  }

  // PDF出力
  const pdf = WR_exportSheetToPdf_(ss, monthlySh, `月報_${targetYm}.pdf`);

  WR_upsertSubmitLog_(ss, targetYm, {
    status: WR_STATUS.PDF_READY,
    monthlyName: monthlyName,
    dailyName: dailyName,
    pdfUrl: pdf.url,
    error: "",
  });

  SpreadsheetApp.flush();
}

// ★B案の核：日報_YYYY-MM から月報用データを作る
function WR_readDailyCasesForMonthly_(dailySh) {
  const lastRow = dailySh.getLastRow();
  const cases = [];

  for (let topRow = WR_DAILY.blockFirstRow; topRow <= lastRow; topRow += WR_DAILY.blockSize) {
    const name = String(dailySh.getRange(topRow, WR_DAILY.nameCol).getDisplayValue() || "").trim();
    if (!name) continue;

    const burnSum = WR_toNumberOrZero_(dailySh.getRange(topRow + WR_DAILY.rowTypeOffset.burn, WR_DAILY.sumCol).getValue(), `日報AP 燃やす（行${topRow}）`);
    const incombSum = WR_toNumberOrZero_(dailySh.getRange(topRow + WR_DAILY.rowTypeOffset.incomb, WR_DAILY.sumCol).getValue(), `日報AP 不燃（行${topRow + 1}）`);
    const recycleSum = WR_toNumberOrZero_(dailySh.getRange(topRow + WR_DAILY.rowTypeOffset.recycle, WR_DAILY.sumCol).getValue(), `日報AP 資源（行${topRow + 2}）`);

    cases.push({
      name,
      general: burnSum + incombSum,
      recycle: recycleSum,
    });
  }

  // 同名重複ガード
  const seen = new Set();
  for (const c of cases) {
    if (seen.has(c.name)) throw new Error(`停止：日報に同一排出者が重複しています：${c.name}`);
    seen.add(c.name);
  }
  return cases;
}

// =====================
// UI読取（日報用）
// =====================
function WR_readUiRecordsForYm_(uiSh, targetYm) {
  const values = uiSh.getDataRange().getValues();
  if (values.length < 2) return [];

  const header = values[0].map(String);
  const col = WR_buildColMap_(header);

  const need = [
    WR_UI_HEADERS.date,
    WR_UI_HEADERS.name,
    WR_UI_HEADERS.addr,
    WR_UI_HEADERS.carType,
    WR_UI_HEADERS.carNo,
    WR_UI_HEADERS.burn,
    WR_UI_HEADERS.incomb,
    WR_UI_HEADERS.recycle,
  ];
  for (const h of need) if (col[h] == null) throw new Error(`収集運搬一覧：必須ヘッダー不足：${h}`);

  const p = WR_parseYm_(targetYm);
  const from = new Date(p.y, p.m - 1, 1);
  const to = new Date(p.y, p.m, 1);

  const out = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];

    const name = String(row[col[WR_UI_HEADERS.name]] || "").trim();
    if (!name) continue;

    const addr = String(row[col[WR_UI_HEADERS.addr]] || "").trim();
    if (!addr) throw new Error(`停止：排出先住所が空欄（収集運搬一覧 行${r + 1}）`);

    const dt = row[col[WR_UI_HEADERS.date]];
    const dateObj = WR_toDate_(dt);
    if (!dateObj) throw new Error(`停止：日付が不正（収集運搬一覧 行${r + 1}）`);

    if (!(dateObj >= from && dateObj < to)) continue;

    const burn = WR_toNumberOrZero_(row[col[WR_UI_HEADERS.burn]], `燃やすごみ（行${r + 1}）`);
    const incomb = WR_toNumberOrZero_(row[col[WR_UI_HEADERS.incomb]], `不燃ごみ（行${r + 1}）`);
    const recycle = WR_toNumberOrZero_(row[col[WR_UI_HEADERS.recycle]], `資源ごみ（行${r + 1}）`);

    const carType = String(row[col[WR_UI_HEADERS.carType]] || "").trim();
    const carNo = String(row[col[WR_UI_HEADERS.carNo]] || "").trim();

    out.push({
      rowNo: r + 1,
      date: dateObj,
      day: dateObj.getDate(),
      name,
      addr,
      carType,
      carNo,
      burn,
      incomb,
      recycle,
    });
  }
  return out;
}

function WR_buildCasesFromUi_(records) {
  const byKey = {};
  const order = [];

  for (const rec of records) {
    const key = `${rec.name}|${rec.addr}`;

    if (!byKey[key]) {
      byKey[key] = {
        name: rec.name,
        addr: rec.addr,
        days: {},
        carType: rec.carType,
        carNo: rec.carNo,
      };
      order.push(key);
    } else {
      if (byKey[key].addr !== rec.addr) throw new Error(`停止：同一案件キー内で住所が複数：${rec.name}`);
    }

    const d = rec.day;
    if (!byKey[key].days[d]) byKey[key].days[d] = { burn: 0, incomb: 0, recycle: 0 };
    byKey[key].days[d].burn += rec.burn;
    byKey[key].days[d].incomb += rec.incomb;
    byKey[key].days[d].recycle += rec.recycle;
  }
  return { byKey, order };
}

// =====================
// 日報：ヘッダー・最大案件・クリア・ラベル補修・書込み・合計
// =====================
function WR_setDailyHeader_(dailySh, targetYm) {
  const p = WR_parseYm_(targetYm);

  const hdr = dailySh.getRange(WR_DAILY.ymRow, WR_DAILY.dayStartCol, 3, WR_DAILY.dayEndCol - WR_DAILY.dayStartCol + 1);
  try { hdr.breakApart(); } catch (e) {}
  hdr.clearContent();

  const ymText = `${p.y}年 ${p.m}月`;
  dailySh.getRange(WR_DAILY.ymRow, WR_DAILY.dayStartCol, 1, WR_DAILY.dayEndCol - WR_DAILY.dayStartCol + 1).setValue(ymText);

  const daysInMonth = WR_daysInMonth_(p.y, p.m);

  const dayRow = [];
  for (let d = 1; d <= 31; d++) dayRow.push(d <= daysInMonth ? d : "");
  dailySh.getRange(WR_DAILY.dayRow, WR_DAILY.dayStartCol, 1, 31).setValues([dayRow]);

  const dowRow = [];
  for (let d = 1; d <= 31; d++) {
    if (d > daysInMonth) { dowRow.push(""); continue; }
    const dt = new Date(p.y, p.m - 1, d);
    dowRow.push(WR_dowJa_(dt.getDay()));
  }
  dailySh.getRange(WR_DAILY.dowRow, WR_DAILY.dayStartCol, 1, 31).setValues([dowRow]);
}

function WR_getDailyMaxCases_(dailySh) {
  const lastRow = dailySh.getLastRow();
  const usableRows = lastRow - WR_DAILY.blockFirstRow + 1;
  return Math.floor(usableRows / WR_DAILY.blockSize);
}

function WR_clearDailyNumbers_(dailySh) {
  const lastRow = dailySh.getLastRow();
  const startRow = WR_DAILY.blockFirstRow;
  const numRows = lastRow - startRow + 1;

  dailySh.getRange(startRow, WR_DAILY.nameCol, numRows, 1).clearContent();
  dailySh.getRange(startRow, WR_DAILY.addrCol, numRows, 1).clearContent();
  dailySh.getRange(startRow, WR_DAILY.carCol, numRows, 1).clearContent();

  dailySh.getRange(startRow, WR_DAILY.dayStartCol, numRows, WR_DAILY.dayEndCol - WR_DAILY.dayStartCol + 1).clearContent();
  dailySh.getRange(startRow, WR_DAILY.sumCol, numRows, 1).clearContent();
}

function WR_ensureDailyRowLabels_(dailySh) {
  const lastRow = dailySh.getLastRow();
  const labels = [
    { offset: WR_DAILY.rowTypeOffset.burn, text: "燃やすごみ" },
    { offset: WR_DAILY.rowTypeOffset.incomb, text: "不燃ごみ" },
    { offset: WR_DAILY.rowTypeOffset.recycle, text: "資源ごみ" },
  ];

  for (let topRow = WR_DAILY.blockFirstRow; topRow <= lastRow; topRow += WR_DAILY.blockSize) {
    if (topRow + 2 > lastRow) break;
    for (const l of labels) {
      const r = topRow + l.offset;
      const cell = dailySh.getRange(r, WR_DAILY.fixedCol);
      const cur = String(cell.getDisplayValue() || "").trim();
      if (!cur) cell.setValue(l.text);
    }
  }
}

function WR_writeCasesToDaily_(dailySh, targetYm, cases) {
  const p = WR_parseYm_(targetYm);
  const daysInMonth = WR_daysInMonth_(p.y, p.m);

  for (let idx = 0; idx < cases.order.length; idx++) {
    const key = cases.order[idx];
    const c = cases.byKey[key];
    const topRow = WR_DAILY.blockFirstRow + idx * WR_DAILY.blockSize;

    dailySh.getRange(topRow, WR_DAILY.nameCol).setValue(c.name);
    dailySh.getRange(topRow, WR_DAILY.addrCol).setValue(c.addr);

    dailySh.getRange(topRow, WR_DAILY.carCol).setValue(c.carType || "");
    dailySh.getRange(topRow + 1, WR_DAILY.carCol).setValue(c.carNo || "");

    for (const [dayStr, v] of Object.entries(c.days)) {
      const day = Number(dayStr);
      if (!day || day < 1 || day > 31) continue;
      if (day > daysInMonth) continue;

      const col = WR_DAILY.dayStartCol + (day - 1);
      dailySh.getRange(topRow + WR_DAILY.rowTypeOffset.burn, col).setValue(v.burn);
      dailySh.getRange(topRow + WR_DAILY.rowTypeOffset.incomb, col).setValue(v.incomb);
      dailySh.getRange(topRow + WR_DAILY.rowTypeOffset.recycle, col).setValue(v.recycle);
    }
  }
}

function WR_setDailySumFormulas_(dailySh) {
  const lastRow = dailySh.getLastRow();
  const startRow = WR_DAILY.blockFirstRow;
  const numRows = lastRow - startRow + 1;

  const range = dailySh.getRange(startRow, WR_DAILY.sumCol, numRows, 1);
  const formulas = [];
  for (let i = 0; i < numRows; i++) {
    const r = startRow + i;
    const f = `=SUM(${WR_colToA1_(WR_DAILY.dayStartCol)}${r}:${WR_colToA1_(WR_DAILY.dayEndCol)}${r})`;
    formulas.push([f]);
  }
  range.setFormulas(formulas);
}

// =====================
// 月報：0初期化・対象月列
// =====================
function WR_initMonthlyZeros_(monthlySh) {
  const r1 = WR_MONTHLY.firstBizTopRow;
  const r2 = WR_MONTHLY.lastBizRow;
  const c1 = WR_MONTHLY.monthStartCol;
  const c2 = WR_MONTHLY.annualCol;

  monthlySh.getRange(r1, c1, (r2 - r1 + 1), (c2 - c1 + 1)).setValue(0);
  monthlySh.getRange(WR_MONTHLY.totalTopRow, c1, 2, (c2 - c1 + 1)).setValue(0);

  monthlySh.getRange(r1, WR_MONTHLY.nameCol, (r2 - r1 + 1), 1).clearContent();

  const totalRg = monthlySh.getRange(WR_MONTHLY.totalTopRow, WR_MONTHLY.nameCol, 2, 1);
  try { totalRg.breakApart(); } catch (e) {}
  totalRg.merge();
  monthlySh.getRange(WR_MONTHLY.totalTopRow, WR_MONTHLY.nameCol).setValue("合計");
}

function WR_monthColFromYm_(targetYm) {
  const p = WR_parseYm_(targetYm);
  const map = { 4: 2, 5: 3, 6: 4, 7: 5, 8: 6, 9: 7, 10: 8, 11: 9, 12: 10, 1: 11, 2: 12, 3: 13 };
  const col = map[p.m];
  if (!col) throw new Error(`対象月の列決定に失敗：month=${p.m}`);
  return col;
}

// =====================
// PDF出力
// =====================
function WR_exportSheetToPdf_(ss, sheet, fileName) {
  const folder = WR_getPdfFolder_(ss);

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

function WR_getPdfFolder_(ss) {
  const sh = ss.getSheetByName(WR_SHEETS.settings);
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

// =====================
// 提出済み確認（ログ）
// =====================
function WR_guardNotSent_(ss, targetYm) {
  const logSh = ss.getSheetByName(WR_SHEETS.submitLog);
  if (!logSh) return;

  const map = WR_getSubmitLogColMap_(logSh);
  const rows = logSh.getLastRow();
  if (rows < 2) return;

  const vals = logSh.getRange(2, 1, rows - 1, logSh.getLastColumn()).getValues();
  for (let i = 0; i < vals.length; i++) {
    const ym = String(vals[i][map.targetYm] || "").trim();
    if (ym !== targetYm) continue;
    const st = String(vals[i][map.status] || "").trim();
    if (st === WR_STATUS.SENT) throw new Error(`停止：対象月 ${targetYm} はステータス=SENT のため更新禁止です`);
  }
}

function WR_upsertSubmitLog_(ss, targetYm, patch) {
  const logSh = ss.getSheetByName(WR_SHEETS.submitLog);
  if (!logSh) return;

  WR_ensureSubmitLogHeader_(logSh);
  const map = WR_getSubmitLogColMap_(logSh);

  const now = new Date();
  const user = Session.getActiveUser().getEmail() || "";

  const lastRow = logSh.getLastRow();
  const dataRange = lastRow >= 2
    ? logSh.getRange(2, 1, lastRow - 1, logSh.getLastColumn()).getValues()
    : [];

  let rowIndex = -1;
  for (let i = 0; i < dataRange.length; i++) {
    const ym = String(dataRange[i][map.targetYm] || "").trim();
    if (ym === targetYm) { rowIndex = i; break; }
  }

  const sheetRow = (rowIndex >= 0) ? (2 + rowIndex) : (logSh.getLastRow() + 1);

  logSh.getRange(sheetRow, mapColTo1_(map.targetYm)).setValue(targetYm);

  if (patch.status != null) logSh.getRange(sheetRow, mapColTo1_(map.status)).setValue(patch.status);
  if (patch.monthlyName != null) logSh.getRange(sheetRow, mapColTo1_(map.monthlyName)).setValue(patch.monthlyName);
  if (patch.dailyName != null) logSh.getRange(sheetRow, mapColTo1_(map.dailyName)).setValue(patch.dailyName);
  if (patch.pdfUrl != null) logSh.getRange(sheetRow, mapColTo1_(map.pdfUrl)).setValue(patch.pdfUrl);
  if (patch.error != null) logSh.getRange(sheetRow, mapColTo1_(map.error)).setValue(patch.error);

  logSh.getRange(sheetRow, mapColTo1_(map.createdAt)).setValue(now);
  logSh.getRange(sheetRow, mapColTo1_(map.actor)).setValue(user);
}

function WR_ensureSubmitLogHeader_(logSh) {
  const header = logSh.getRange(1, 1, 1, logSh.getLastColumn()).getValues()[0].map(String);
  const need = ["対象年月", "ステータス", "作業用月報名", "作業用日報名", "PDFリンク", "生成日時", "実行者", "エラー内容"];
  const exists = header.filter(h => String(h).trim()).length > 0;

  if (!exists) {
    logSh.getRange(1, 1, 1, need.length).setValues([need]);
    return;
  }

  const set = new Set(header.map(h => String(h).trim()));
  let col = header.length;
  for (const h of need) {
    if (!set.has(h)) {
      col++;
      logSh.getRange(1, col).setValue(h);
    }
  }
}

function WR_getSubmitLogColMap_(logSh) {
  const header = logSh.getRange(1, 1, 1, logSh.getLastColumn()).getValues()[0].map(v => String(v || "").trim());
  const idx = (name) => {
    const i = header.findIndex(h => h === name);
    if (i < 0) throw new Error(`提出済み確認：ヘッダー不足：${name}`);
    return i;
  };

  return {
    targetYm: idx("対象年月"),
    status: idx("ステータス"),
    monthlyName: idx("作業用月報名"),
    dailyName: idx("作業用日報名"),
    pdfUrl: idx("PDFリンク"),
    createdAt: idx("生成日時"),
    actor: idx("実行者"),
    error: idx("エラー内容"),
  };
}
function mapColTo1_(zeroIdx) { return zeroIdx + 1; }

// =====================
// テンプレコピー
// =====================
function WR_recreateFromTemplate_(ss, templateName, workName) {
  const tpl = WR_getSheetOrThrow_(ss, templateName);

  const existing = ss.getSheetByName(workName);
  if (existing) ss.deleteSheet(existing);

  const sh = tpl.copyTo(ss).setName(workName);
  ss.setActiveSheet(sh);
  return sh;
}

// =====================
// 汎用ユーティリティ
// =====================
function WR_getSheetOrThrow_(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error(`シートが見つかりません：${name}`);
  return sh;
}
function WR_buildColMap_(headerRow) {
  const map = {};
  for (let i = 0; i < headerRow.length; i++) {
    const h = String(headerRow[i] || "").trim();
    if (!h) continue;
    map[h] = i;
  }
  return map;
}
function WR_assertYm_(ym) {
  if (!/^\d{4}-\d{2}$/.test(ym)) throw new Error(`対象年月が不正です（YYYY-MM）：${ym}`);
  const p = WR_parseYm_(ym);
  if (p.m < 1 || p.m > 12) throw new Error(`対象年月の月が不正：${ym}`);
  if (p.y < 2000 || p.y > 2100) throw new Error(`対象年月の年が不正：${ym}`);
}
function WR_parseYm_(ym) {
  return { y: Number(ym.slice(0, 4)), m: Number(ym.slice(5, 7)) };
}
function WR_formatYm_(dateObj) {
  const y = dateObj.getFullYear();
  const m = dateObj.getMonth() + 1;
  return `${y}-${("0" + m).slice(-2)}`;
}
function WR_daysInMonth_(y, m) { return new Date(y, m, 0).getDate(); }
function WR_dowJa_(d) { return ["日", "月", "火", "水", "木", "金", "土"][d] || ""; }
function WR_toDate_(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  const dt = new Date(v);
  if (dt instanceof Date && !isNaN(dt.getTime())) return dt;
  return null;
}
function WR_toNumberOrZero_(v, label) {
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
function WR_colToA1_(colNum) {
  let n = colNum;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// =====================================================
// 年度積算（WR2_）：指定YYYY-MM月分（年度開始〜指定月まで）
// =====================================================
function WR2_promptFiscal() {
  const ym = WR_promptYm_();
  if (!ym) return;
  WR2_buildFiscalMonthlyReport(ym);
}

function WR2_buildFiscalMonthlyReport(targetYm) {
  WR_assertYm_(targetYm);
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  WR_guardNotSent_(ss, targetYm);

  const workName = `年度積算_${targetYm}月分`;
  const sh = WR_recreateFromTemplate_(ss, WR_SHEETS.monthlyTpl, workName);

  WR_initMonthlyZeros_(sh);
  WR2_setFiscalTitle_(sh, targetYm);
  WR2_setFiscalSubmitDate_(sh, targetYm);

  const uiSh = WR_getSheetOrThrow_(ss, WR_SHEETS.ui);
  const fy = WR2_getFiscalYearRangeFromYm_(targetYm, ss);

  const p = WR_parseYm_(targetYm);
  const cutoffExclusive = new Date(p.y, p.m, 1);
  const toExclusive = (cutoffExclusive < fy.toExclusive) ? cutoffExclusive : fy.toExclusive;

  const records = WR2_readUiRecordsForRange_(uiSh, fy.from, toExclusive);
  const fiscalCases = WR2_buildFiscalCasesFromUi_(records);

  if (fiscalCases.order.length > WR_MONTHLY.bizCount) {
    throw new Error(`停止：排出者数が枠を超えています（検出=${fiscalCases.order.length}, 枠=${WR_MONTHLY.bizCount}）`);
  }

  WR2_writeFiscalToTemplate_(sh, fiscalCases);

  SpreadsheetApp.flush();
}

function WR2_setFiscalTitle_(sh, targetYm) {
  const p = WR_parseYm_(targetYm);
  const titleText = `一般廃棄物収集運搬業務実績報告書（${p.m}月分）`;

  const rg = sh.getRange("A4:N4");
  try { rg.breakApart(); } catch (e) {}
  rg.merge();
  rg.setValue(titleText);
}
function WR2_setFiscalSubmitDate_(sh, targetYm) {
  const p = WR_parseYm_(targetYm);
  const endOfMonth = new Date(p.y, p.m, 0);

  const rg = sh.getRange("L7:N7");
  try { rg.breakApart(); } catch (e) {}
  rg.merge();
  rg.setValue(endOfMonth);
}
function WR2_getFiscalYearRangeFromYm_(targetYm, ss) {
  const p = WR_parseYm_(targetYm);

  const startMonth = WR2_getSettingNumber_(ss, "年度開始月", 4);
  if (!(startMonth >= 1 && startMonth <= 12)) throw new Error(`設定：年度開始月が不正です（1-12）：${startMonth}`);

  const fixedStartYear = WR2_getSettingNumber_(ss, "年度開始年", null);
  if (fixedStartYear != null && !(fixedStartYear >= 2000 && fixedStartYear <= 2100)) {
    throw new Error(`設定：年度開始年が不正です（2000-2100）：${fixedStartYear}`);
  }

  const fyStartYear = (fixedStartYear != null)
    ? fixedStartYear
    : ((p.m >= startMonth) ? p.y : (p.y - 1));

  const from = new Date(fyStartYear, startMonth - 1, 1);
  const toExclusive = new Date(fyStartYear + 1, startMonth - 1, 1);
  return { fyStartYear, startMonth, from, toExclusive };
}
function WR2_getSettingNumber_(ss, key, defaultValue) {
  const sh = ss.getSheetByName(WR_SHEETS.settings);
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

function WR2_readUiRecordsForRange_(uiSh, from, toExclusive) {
  const values = uiSh.getDataRange().getValues();
  if (values.length < 2) return [];

  const header = values[0].map(String);
  const col = WR_buildColMap_(header);

  const need = [
    WR_UI_HEADERS.date,
    WR_UI_HEADERS.name,
    WR_UI_HEADERS.addr,
    WR_UI_HEADERS.burn,
    WR_UI_HEADERS.incomb,
    WR_UI_HEADERS.recycle,
  ];
  for (const h of need) if (col[h] == null) throw new Error(`収集運搬一覧：必須ヘッダー不足：${h}`);

  const out = [];
  for (let r = 1; r < values.length; r++) {
    const row = values[r];

    const name = String(row[col[WR_UI_HEADERS.name]] || "").trim();
    if (!name) continue;

    const addr = String(row[col[WR_UI_HEADERS.addr]] || "").trim();
    if (!addr) throw new Error(`停止：排出先住所が空欄（収集運搬一覧 行${r + 1}）`);

    const dateObj = WR_toDate_(row[col[WR_UI_HEADERS.date]]);
    if (!dateObj) throw new Error(`停止：日付が不正（収集運搬一覧 行${r + 1}）`);

    if (!(dateObj >= from && dateObj < toExclusive)) continue;

    const burn = WR_toNumberOrZero_(row[col[WR_UI_HEADERS.burn]], `燃やすごみ（行${r + 1}）`);
    const incomb = WR_toNumberOrZero_(row[col[WR_UI_HEADERS.incomb]], `不燃ごみ（行${r + 1}）`);
    const recycle = WR_toNumberOrZero_(row[col[WR_UI_HEADERS.recycle]], `資源ごみ（行${r + 1}）`);

    out.push({
      rowNo: r + 1,
      date: dateObj,
      m: dateObj.getMonth() + 1,
      name,
      addr,
      burn,
      incomb,
      recycle,
    });
  }
  return out;
}

function WR2_buildFiscalCasesFromUi_(records) {
  const byKey = {};
  const order = [];

  for (const rec of records) {
    const key = `${rec.name}|${rec.addr}`;
    if (!byKey[key]) {
      byKey[key] = { name: rec.name, addr: rec.addr, months: {} };
      order.push(key);
    } else {
      if (byKey[key].addr !== rec.addr) throw new Error(`停止：同一案件キー内で住所が複数：${rec.name}`);
    }

    const general = rec.burn + rec.incomb;
    const recycle = rec.recycle;

    if (!byKey[key].months[rec.m]) byKey[key].months[rec.m] = { general: 0, recycle: 0 };
    byKey[key].months[rec.m].general += general;
    byKey[key].months[rec.m].recycle += recycle;
  }
  return { byKey, order };
}

function WR2_writeFiscalToTemplate_(sh, fiscalCases) {
  const totalByCol = {};
  for (let col = WR_MONTHLY.monthStartCol; col <= WR_MONTHLY.monthEndCol; col++) {
    totalByCol[col] = { general: 0, recycle: 0 };
  }
  const m2col = { 4:2,5:3,6:4,7:5,8:6,9:7,10:8,11:9,12:10,1:11,2:12,3:13 };

  for (let i = 0; i < fiscalCases.order.length; i++) {
    const key = fiscalCases.order[i];
    const c = fiscalCases.byKey[key];
    const topRow = WR_MONTHLY.firstBizTopRow + i * 2;

    sh.getRange(topRow, WR_MONTHLY.nameCol).setValue(c.name);

    for (const [monthStr, v] of Object.entries(c.months)) {
      const month = Number(monthStr);
      const col = m2col[month];
      if (!col) continue;

      sh.getRange(topRow, col).setValue(v.general);
      sh.getRange(topRow + 1, col).setValue(v.recycle);

      totalByCol[col].general += v.general;
      totalByCol[col].recycle += v.recycle;
    }

    sh.getRange(topRow, WR_MONTHLY.annualCol)
      .setFormulaR1C1(`=SUM(R[0]C${WR_MONTHLY.monthStartCol}:R[0]C${WR_MONTHLY.monthEndCol})`);
    sh.getRange(topRow + 1, WR_MONTHLY.annualCol)
      .setFormulaR1C1(`=SUM(R[0]C${WR_MONTHLY.monthStartCol}:R[0]C${WR_MONTHLY.monthEndCol})`);
  }

  for (let col = WR_MONTHLY.monthStartCol; col <= WR_MONTHLY.monthEndCol; col++) {
    sh.getRange(WR_MONTHLY.totalTopRow, col).setValue(totalByCol[col].general);
    sh.getRange(WR_MONTHLY.totalBottomRow, col).setValue(totalByCol[col].recycle);
  }

  sh.getRange(WR_MONTHLY.totalTopRow, WR_MONTHLY.annualCol)
    .setFormulaR1C1(`=SUM(R[0]C${WR_MONTHLY.monthStartCol}:R[0]C${WR_MONTHLY.monthEndCol})`);
  sh.getRange(WR_MONTHLY.totalBottomRow, WR_MONTHLY.annualCol)
    .setFormulaR1C1(`=SUM(R[0]C${WR_MONTHLY.monthStartCol}:R[0]C${WR_MONTHLY.monthEndCol})`);
}

// =====================================================
// 年度積算 v2（WR2V2_）：年度選択・複数ページ・PDFページ別
// =====================================================
const WR2V2_SHEETS = {
  ui: "収集運搬一覧",
  monthlyTpl: "月報",
  settings: "設定",
};

const WR2V2_UI_HEADERS = {
  date: "日付",
  name: "排出者の氏名",
  addr: "排出先の住所",
  burn: "燃やすごみ",
  incomb: "不燃ごみ",
  recycle: "資源ごみ",
};

const WR2V2_MONTHLY = {
  firstBizTopRow: 30,
  lastBizRow: 47,
  totalTopRow: 48,
  totalBottomRow: 49,
  nameCol: 1,
  monthStartCol: 2,
  monthEndCol: 13,
  annualCol: 14,

  // v2の表示セル（残してOK）
  pageCellA1: "J3",

  // ★追加：テンプレと同じ場所に入れる
  titleRangeA1: "A4:N4",       // ←「（◯月分）」タイトル
  submitDateRangeA1: "L7:N7",  // ←提出日（末日）
};

function WR2V2_monthColFromMonth_(m) {
  const map = { 4: 2, 5: 3, 6: 4, 7: 5, 8: 6, 9: 7, 10: 8, 11: 9, 12: 10, 1: 11, 2: 12, 3: 13 };
  const col = map[m];
  if (!col) throw new Error(`年度積算v2：月→列変換に失敗 month=${m}`);
  return col;
}

function WR2V2_buildFiscalReport_fromSettings() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const fiscalYear = WR2V2_readFiscalYearFromSettings_(ss);
  WR2V2_buildFiscalReport_(ss, fiscalYear);
}

function WR2V2_buildFiscalReport_(ss, fiscalYear) {
  if (!Number.isInteger(fiscalYear) || fiscalYear < 2000 || fiscalYear > 2100) {
    throw new Error(`年度積算v2：年度が不正です：${fiscalYear}`);
  }

  const uiSh = WR2V2_getSheetOrThrow_(ss, WR2V2_SHEETS.ui);
  const tpl  = WR2V2_getSheetOrThrow_(ss, WR2V2_SHEETS.monthlyTpl);

  // 年度範囲：YYYY-04-01 ～ (YYYY+1)-04-01（排他）
  const fyFrom = new Date(fiscalYear, 3, 1);
  const fyToEx = new Date(fiscalYear + 1, 3, 1);

  // ★対象月：実行月の「前月」に固定（収集データに依存しない）
  const targetYm = WR2V2_prevYm_();         // 例：実行が3月なら 2月（YYYY-MM）
  const { y, m } = WR2V2_parseYm_(targetYm);
  const targetMonth = m;

  // タイトル／提出日（対象月末日）
  const titleText  = `一般廃棄物収集運搬業務実績報告書（${targetMonth}月分）`;
  const submitDate = new Date(y, m, 0);     // 月末

  // ★対象月が選択年度の範囲外なら停止（事故防止）
  //   例：2026年4月に実行 → 前月は2026-03（これは2025年度）なので、
  //   設定で2025年度を選んで実行してね、という挙動にする
  const cutoffEx = new Date(y, m, 1);       // 対象月の翌月1日（排他）
  if (!(cutoffEx > fyFrom && cutoffEx <= fyToEx)) {
    throw new Error(
      `年度積算v2：対象月 ${targetYm} は、選択した年度 ${fiscalYear}年度の範囲外です。\n` +
      `この月を出したい場合は「年度選択」を ${m >= 4 ? y : (y - 1)}年度 にして実行してください。`
    );
  }

  // 集計：年度開始～対象月の翌月1日（排他）まで（年度末を超えない）
  const toExclusive = (cutoffEx < fyToEx) ? cutoffEx : fyToEx;

  const agg = WR2V2_aggregateUiForFiscal_(uiSh, fyFrom, toExclusive);

  const bizKeys  = agg.order.slice();
  const bizCount = bizKeys.length;
  const pages    = Math.max(1, Math.ceil(bizCount / 9));

  const grandTotals = WR2V2_calcGrandTotals_(agg);
  const folder = WR_getPdfFolder_(ss);

  const createdSheets = [];
  const createdPdfs   = [];

  for (let p = 0; p < pages; p++) {
    const pageNo  = p + 1;
    const pageBiz = bizKeys.slice(p * 9, p * 9 + 9);

    const sheetName = `年度積算_${fiscalYear}年度_${pageNo}-${pages}`;
    const sh = WR2V2_copyTemplate_(ss, tpl, sheetName);

    WR2V2_initMonthlyPage_(sh);

    // ページ番号
    sh.getRange(WR2V2_MONTHLY.pageCellA1).setValue(`${pageNo}/${pages}`);

    // ★A4:N4 タイトル（結合セル）
    WR2V2_setMergedValue_(sh, WR2V2_MONTHLY.titleRangeA1, titleText);

    // ★L7:N7 提出日（結合セル）
    WR2V2_setMergedValue_(sh, WR2V2_MONTHLY.submitDateRangeA1, submitDate);

    // 明細
    WR2V2_writeBizBlock_(sh, agg, pageBiz);

    // 合計（最後ページは総合計、それ以外はページ内合計）
    const pageTotals  = WR2V2_calcPageTotals_(agg, pageBiz);
    const totalsToUse = (pageNo === pages) ? grandTotals : pageTotals;
    WR2V2_writeTotalsRow_(sh, totalsToUse);

    // PDF
    const pdfName = `年度積算_${fiscalYear}年度_${targetYm}_${pageNo}-${pages}.pdf`;
    const pdfFile = WR2V2_exportSheetToPdf_(ss, sh, folder, pdfName);

    createdSheets.push(sh.getName());
    createdPdfs.push(pdfFile.getUrl());
  }

  SpreadsheetApp.flush();

  try {
    SpreadsheetApp.getUi().alert(
      `年度積算 v2 完了\n年度: ${fiscalYear}年度\n対象: ${targetYm}分\nページ数: ${pages}\n` +
      `作成シート:\n- ${createdSheets.join("\n- ")}\n\nPDF:\n- ${createdPdfs.join("\n- ")}`
    );
  } catch (e) {}
}

// ★実行月の「前月」を YYYY-MM で返す
function WR2V2_prevYm_() {
  const tz = Session.getScriptTimeZone() || "Asia/Tokyo";
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 当月(0-11)
  const prev = new Date(y, m - 1, 1);
  return Utilities.formatDate(prev, tz, "yyyy-MM");
}

// ★YYYY-MM を {y,m} に分解
function WR2V2_parseYm_(ym) {
  const y = Number(ym.slice(0, 4));
  const m = Number(ym.slice(5, 7));
  return { y, m };
}

// ★結合セルに安全に書き込む（breakApart→merge→setValue）
function WR2V2_setMergedValue_(sh, a1, value) {
  const rg = sh.getRange(a1);
  try { rg.breakApart(); } catch (e) {}
  rg.merge();
  rg.setValue(value);
}

function WR2V2_aggregateUiForFiscal_(uiSh, from, to) {
  const values = uiSh.getDataRange().getValues();
  if (values.length < 2) return { byBiz: {}, order: [], lastMonthWithData: null };

  const header = values[0].map(v => String(v || "").trim());
  const col = WR2V2_buildColMap_(header);

  const need = [
    WR2V2_UI_HEADERS.date,
    WR2V2_UI_HEADERS.name,
    WR2V2_UI_HEADERS.addr,
    WR2V2_UI_HEADERS.burn,
    WR2V2_UI_HEADERS.incomb,
    WR2V2_UI_HEADERS.recycle,
  ];
  for (const h of need) if (col[h] == null) throw new Error(`年度積算v2：必須ヘッダー不足：${h}`);

  const byBiz = {};
  const order = [];
  let lastMonthWithData = null;

  for (let r = 1; r < values.length; r++) {
    const row = values[r];

    const name = String(row[col[WR2V2_UI_HEADERS.name]] || "").trim();
    if (!name) continue;

    const addr = String(row[col[WR2V2_UI_HEADERS.addr]] || "").trim();
    if (!addr) throw new Error(`停止：排出先住所が空欄（収集運搬一覧 行${r + 1}）`);

    const dt = WR_toDate_(row[col[WR2V2_UI_HEADERS.date]]);
    if (!dt) throw new Error(`停止：日付が不正（収集運搬一覧 行${r + 1}）`);

    if (!(dt >= from && dt < to)) continue;

    const burn = WR_toNumberOrZero_(row[col[WR2V2_UI_HEADERS.burn]], `燃やすごみ（行${r + 1}）`);
    const incomb = WR_toNumberOrZero_(row[col[WR2V2_UI_HEADERS.incomb]], `不燃ごみ（行${r + 1}）`);
    const recycle = WR_toNumberOrZero_(row[col[WR2V2_UI_HEADERS.recycle]], `資源ごみ（行${r + 1}）`);

    const m = dt.getMonth() + 1;
    const general = burn + incomb;

    if (!byBiz[name]) {
      byBiz[name] = { months: {} };
      order.push(name);
    }
    if (!byBiz[name].months[m]) byBiz[name].months[m] = { general: 0, recycle: 0 };
    byBiz[name].months[m].general += general;
    byBiz[name].months[m].recycle += recycle;

    if (general !== 0 || recycle !== 0) {
      if (lastMonthWithData == null) lastMonthWithData = m;
      else {
        const prevIdx = WR2V2_monthIndexInFiscal_(lastMonthWithData);
        const nowIdx = WR2V2_monthIndexInFiscal_(m);
        if (nowIdx > prevIdx) lastMonthWithData = m;
      }
    }
  }

  return { byBiz, order, lastMonthWithData };
}

function WR2V2_monthIndexInFiscal_(m) {
  if (m >= 4) return m - 4;
  return 8 + m; // 1->9,2->10,3->11
}

function WR2V2_buildFiscalTitle_(fiscalYear, lastMonth) {
  if (!lastMonth) return `${fiscalYear}年度（4月〜3月分）`;
  return `${fiscalYear}年度（4月〜${lastMonth}月分）`;
}

function WR2V2_copyTemplate_(ss, tplSheet, newName) {
  const existing = ss.getSheetByName(newName);
  if (existing) ss.deleteSheet(existing);
  const sh = tplSheet.copyTo(ss).setName(newName);
  ss.setActiveSheet(sh);
  return sh;
}

function WR2V2_initMonthlyPage_(sh) {
  const r1 = WR2V2_MONTHLY.firstBizTopRow;
  const r2 = WR2V2_MONTHLY.lastBizRow;
  const c1 = WR2V2_MONTHLY.monthStartCol;
  const c2 = WR2V2_MONTHLY.annualCol;

  sh.getRange(r1, c1, (r2 - r1 + 1), (c2 - c1 + 1)).setValue(0);
  sh.getRange(WR2V2_MONTHLY.totalTopRow, c1, 2, (c2 - c1 + 1)).setValue(0);

  sh.getRange(r1, WR2V2_MONTHLY.nameCol, (r2 - r1 + 1), 1).clearContent();

  // 合計ラベル（A48）
  sh.getRange(WR2V2_MONTHLY.totalTopRow, WR2V2_MONTHLY.nameCol).setValue("合計");
}

function WR2V2_writeBizBlock_(sh, agg, pageBiz) {
  for (let i = 0; i < pageBiz.length; i++) {
    const biz = pageBiz[i];
    const topRow = WR2V2_MONTHLY.firstBizTopRow + i * 2;

    sh.getRange(topRow, WR2V2_MONTHLY.nameCol).setValue(biz);

    const months = agg.byBiz[biz]?.months || {};
    for (let m = 1; m <= 12; m++) {
      const col = WR2V2_monthColFromMonth_(m);
      const val = months[m] || { general: 0, recycle: 0 };
      sh.getRange(topRow, col).setValue(val.general);
      sh.getRange(topRow + 1, col).setValue(val.recycle);
    }

    sh.getRange(topRow, WR2V2_MONTHLY.annualCol)
      .setFormulaR1C1(`=SUM(R[0]C${WR2V2_MONTHLY.monthStartCol}:R[0]C${WR2V2_MONTHLY.monthEndCol})`);
    sh.getRange(topRow + 1, WR2V2_MONTHLY.annualCol)
      .setFormulaR1C1(`=SUM(R[0]C${WR2V2_MONTHLY.monthStartCol}:R[0]C${WR2V2_MONTHLY.monthEndCol})`);
  }
}

function WR2V2_calcPageTotals_(agg, pageBiz) {
  const totals = {};
  for (let m = 1; m <= 12; m++) totals[m] = { general: 0, recycle: 0 };

  for (const biz of pageBiz) {
    const months = agg.byBiz[biz]?.months || {};
    for (let m = 1; m <= 12; m++) {
      const v = months[m] || { general: 0, recycle: 0 };
      totals[m].general += v.general;
      totals[m].recycle += v.recycle;
    }
  }
  return totals;
}

function WR2V2_calcGrandTotals_(agg) {
  const totals = {};
  for (let m = 1; m <= 12; m++) totals[m] = { general: 0, recycle: 0 };

  for (const biz of agg.order) {
    const months = agg.byBiz[biz]?.months || {};
    for (let m = 1; m <= 12; m++) {
      const v = months[m] || { general: 0, recycle: 0 };
      totals[m].general += v.general;
      totals[m].recycle += v.recycle;
    }
  }
  return totals;
}

function WR2V2_writeTotalsRow_(sh, totalsByMonth) {
  for (let m = 1; m <= 12; m++) {
    const col = WR2V2_monthColFromMonth_(m);
    sh.getRange(WR2V2_MONTHLY.totalTopRow, col).setValue(totalsByMonth[m].general);
    sh.getRange(WR2V2_MONTHLY.totalBottomRow, col).setValue(totalsByMonth[m].recycle);
  }

  sh.getRange(WR2V2_MONTHLY.totalTopRow, WR2V2_MONTHLY.annualCol)
    .setFormulaR1C1(`=SUM(R[0]C${WR2V2_MONTHLY.monthStartCol}:R[0]C${WR2V2_MONTHLY.monthEndCol})`);
  sh.getRange(WR2V2_MONTHLY.totalBottomRow, WR2V2_MONTHLY.annualCol)
    .setFormulaR1C1(`=SUM(R[0]C${WR2V2_MONTHLY.monthStartCol}:R[0]C${WR2V2_MONTHLY.monthEndCol})`);
}

function WR2V2_exportSheetToPdf_(ss, sheet, folder, fileName) {
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
  return folder.createFile(blob);
}

function WR2V2_readFiscalYearFromSettings_(ss) {
  const sh = ss.getSheetByName(WR2V2_SHEETS.settings);
  if (!sh) throw new Error(`年度積算v2：設定シートが見つかりません：${WR2V2_SHEETS.settings}`);

  const vals = sh.getDataRange().getValues();
  for (let i = 0; i < vals.length; i++) {
    const k = String(vals[i][0] || "").trim();
    if (k === "年度選択") {
      const v = String(vals[i][1] || "").trim();
      const y = Number(v);
      if (!Number.isInteger(y)) throw new Error(`年度積算v2：設定「年度選択」が不正です：${v}`);
      return y;
    }
  }
  throw new Error(`年度積算v2：設定に「年度選択」がありません（A列に 年度選択 / B列に年度）`);
}

function WR2V2_getSheetOrThrow_(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh) throw new Error(`シートが見つかりません：${name}`);
  return sh;
}
function WR2V2_buildColMap_(headerRow) {
  const map = {};
  for (let i = 0; i < headerRow.length; i++) {
    const h = String(headerRow[i] || "").trim();
    if (!h) continue;
    map[h] = i;
  }
  return map;
}

// ★年度(fiscalYear)と月(reportMonth)から「実年」を決めて末日Dateを返す
// fiscalYear=2025年度の場合：
//  - 4〜12月 → 2025年
//  - 1〜3月  → 2026年
function WR2V2_endOfMonthInFiscal_(fiscalYear, month) {
  const y = (month >= 4) ? fiscalYear : (fiscalYear + 1);
  return new Date(y, month, 0); // 月末
}

// ★結合セルでも安全に値を入れる（A1レンジ想定）
function WR2V2_setMergedValue_(sh, a1, value) {
  const rg = sh.getRange(a1);
  try { rg.breakApart(); } catch (e) {}
  rg.merge();
  rg.setValue(value);
}