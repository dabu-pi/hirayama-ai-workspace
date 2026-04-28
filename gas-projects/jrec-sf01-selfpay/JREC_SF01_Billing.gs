"use strict";

// SPREADSHEET_ID, SHEET_NAMES, getTargetSpreadsheet_: defined in JREC_SF01_Setup.gs
// getPatientById, appendRunLog_: defined in JREC_SF01_Patient.gs

// ============================================================
// PUBLIC — 会計・支払・領収書
// ============================================================

/**
 * 患者単位の会計集計と visitKey ごとの支払・領収書状態を返す。
 * patient-detail.html のサマリー表示と来院ごとの会計導線に使用する。
 *
 * @param {string} patientId
 * @returns {{
 *   totalPaid:        number,  // 入金済・一部入金 の tax-inc 合計
 *   totalOutstanding: number,  // 未収・一部入金 の tax-inc 合計
 *   payments: { [visitKey]: { paymentId, totalTaxInc, paymentMethod, paymentStatus } },
 *   receipts: { [visitKey]: { receiptId, receiptNo } }
 * }}
 */
function getPatientAccountingData(patientId) {
  try {
    if (!patientId) return { totalPaid: 0, totalOutstanding: 0, payments: {}, receipts: {} };
    var ss = getTargetSpreadsheet_();

    // ── 患者の visitKey セット ───────────────────────────
    var visitKeySet = {};
    var visitSh = ss.getSheetByName(SHEET_NAMES.VISITS);
    if (visitSh && visitSh.getLastRow() >= 2) {
      visitSh.getRange(2, 1, visitSh.getLastRow() - 1, 2).getValues().forEach(function(r) {
        if (r[0] && String(r[1]) === String(patientId)) {
          visitKeySet[String(r[0])] = true;
        }
      });
    }

    // ── Payments 集計 ────────────────────────────────────
    var payments         = {};
    var totalPaid        = 0;
    var totalOutstanding = 0;
    var paymentSh = ss.getSheetByName(SHEET_NAMES.PAYMENTS);
    if (paymentSh && paymentSh.getLastRow() >= 2) {
      paymentSh.getRange(2, 1, paymentSh.getLastRow() - 1, 10).getValues().forEach(function(r) {
        var vk = String(r[1]);
        if (!visitKeySet[vk]) return;
        var status   = r[6] || "";
        var totalInc = r[4] || 0;
        payments[vk] = {
          paymentId:     String(r[0]),
          totalTaxInc:   totalInc,
          paymentMethod: r[5] || "",
          paymentStatus: status
        };
        if (status === "入金済" || status === "一部入金") totalPaid        += totalInc;
        if (status === "未収"   || status === "一部入金") totalOutstanding += totalInc;
      });
    }

    // ── Receipts 取得 ────────────────────────────────────
    var receipts  = {};
    var receiptSh = ss.getSheetByName(SHEET_NAMES.RECEIPTS);
    if (receiptSh && receiptSh.getLastRow() >= 2) {
      receiptSh.getRange(2, 1, receiptSh.getLastRow() - 1, 3).getValues().forEach(function(r) {
        var vk = String(r[1]);
        if (!visitKeySet[vk] || receipts[vk]) return;
        receipts[vk] = { receiptId: String(r[0]), receiptNo: String(r[2]) };
      });
    }

    return {
      totalPaid:        totalPaid,
      totalOutstanding: totalOutstanding,
      payments:         payments,
      receipts:         receipts
    };

  } catch(err) {
    var m = (err && err.message) ? err.message : String(err);
    Logger.log("[getPatientAccountingData] ERROR: " + m);
    return { totalPaid: 0, totalOutstanding: 0, payments: {}, receipts: {} };
  }
}

/**
 * MenuMaster の有効フラグ=TRUE のメニューを表示順で返す。
 * billing-form のメニュー選択プルダウンに使用する。
 * @returns {Object[]}
 */
function getActiveMenus() {
  var ss = getTargetSpreadsheet_();
  var sh = ss.getSheetByName(SHEET_NAMES.MENU_MASTER);
  if (!sh || sh.getLastRow() < 2) return [];

  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 9).getValues();
  var result = [];
  rows.forEach(function(r) {
    if (!r[0]) return;
    if (!r[6]) return;          // 有効フラグ = FALSE は除外
    result.push({
      menuCode:  String(r[0]),
      name:      r[1]  || "",
      duration:  r[2]  || 0,
      priceEx:   parseInt(r[3], 10) || 0,  // 税別価格
      priceInc:  parseInt(r[4], 10) || 0,  // 税込価格（参考）
      category:  r[5]  || "",
      sortOrder: parseInt(r[7], 10) || 0,
      note:      r[8]  || ""
    });
  });
  result.sort(function(a, b) { return a.sortOrder - b.sortOrder; });
  return result;
}

/**
 * billing-form 表示用に visit・患者・既存支払・既存領収書を返す。
 * alreadyPaid=true の場合は会計入力フォームで二重保存を防ぐ。
 *
 * @param {string} visitKey
 * @returns {{
 *   ok, visit?, patient?,
 *   alreadyPaid, existingPayment?,
 *   existingReceipt?, error?
 * }}
 */
function getVisitForBilling(visitKey) {
  try {
    if (!visitKey) return { ok: false, error: "visitKey は必須です" };
    visitKey = String(visitKey);
    var ss   = getTargetSpreadsheet_();

    // ── SelfPayVisits ────────────────────────────────────
    var visitSh = ss.getSheetByName(SHEET_NAMES.VISITS);
    if (!visitSh || visitSh.getLastRow() < 2)
      return { ok: false, error: "SelfPayVisits シートが見つかりません" };

    var visit = null;
    visitSh.getRange(2, 1, visitSh.getLastRow() - 1, 11).getValues()
      .forEach(function(r) {
        if (visit || String(r[0]) !== visitKey) return;
        var vd = "";
        if (r[2]) {
          try { vd = Utilities.formatDate(new Date(r[2]), "Asia/Tokyo", "yyyy-MM-dd"); } catch(e) {}
        }
        visit = {
          selfPayVisitKey: String(r[0]),
          patientId:       String(r[1]),
          visitDate:       vd,
          visitType:       r[3]  || "",
          practitioner:    r[4]  || "",
          chiefComplaint:  r[5]  || "",
          vas:             r[6] !== "" ? String(r[6]) : "",
          billingStatus:   r[8]  || "未会計"
        };
      });
    if (!visit) return { ok: false, error: "来院記録が見つかりません: " + visitKey };

    // ── Patient ──────────────────────────────────────────
    var patient = getPatientById(visit.patientId);
    if (!patient) return { ok: false, error: "患者が見つかりません: " + visit.patientId };

    // ── Payments（二重保存チェック用）────────────────────
    var alreadyPaid     = false;
    var existingPayment = null;
    var paymentSh = ss.getSheetByName(SHEET_NAMES.PAYMENTS);
    if (paymentSh && paymentSh.getLastRow() >= 2) {
      paymentSh.getRange(2, 1, paymentSh.getLastRow() - 1, 10).getValues()
        .forEach(function(r) {
          if (alreadyPaid || String(r[1]) !== visitKey) return;
          alreadyPaid = true;
          existingPayment = {
            paymentId:     String(r[0]),
            totalTaxEx:    r[2],
            totalTaxAmt:   r[3],
            totalTaxInc:   r[4],
            paymentMethod: r[5] || "",
            paymentStatus: r[6] || ""
          };
        });
    }

    // ── Receipts（発行済みチェック用）────────────────────
    var existingReceipt = null;
    var receiptSh = ss.getSheetByName(SHEET_NAMES.RECEIPTS);
    if (receiptSh && receiptSh.getLastRow() >= 2) {
      receiptSh.getRange(2, 1, receiptSh.getLastRow() - 1, 3).getValues()
        .forEach(function(r) {
          if (existingReceipt || String(r[1]) !== visitKey) return;
          existingReceipt = { receiptId: String(r[0]), receiptNo: String(r[2]) };
        });
    }

    return {
      ok:              true,
      visit:           visit,
      patient:         patient,
      alreadyPaid:     alreadyPaid,
      existingPayment: existingPayment,
      existingReceipt: existingReceipt
    };

  } catch(err) {
    var m = (err && err.message) ? err.message : String(err);
    Logger.log("[getVisitForBilling] ERROR: " + m);
    return { ok: false, error: m };
  }
}

/**
 * 明細（SelfPayItems）と支払（Payments）を保存し、SelfPayVisits.会計状態を更新する。
 *
 * @param {Object} payload
 *   {
 *     selfPayVisitKey: "SPV_...",
 *     items: [
 *       { menuCode, menuName, qty, priceEx, taxCategory? }
 *     ],
 *     paymentMethod:  "現金" | "カード" | "電子マネー" | "未収",
 *     paymentStatus:  "入金済" | "未収" | "一部入金",
 *     paymentDate?:   "YYYY-MM-DD",   // 省略時は当日（入金済の場合）
 *     memo?:          ""
 *   }
 * @returns {{ ok, paymentId?, totalTaxEx?, totalTaxAmt?, totalTaxInc?, savedItems?, error? }}
 */
function savePaymentWithItems(payload) {
  Logger.log("[savePaymentWithItems] START visitKey=" + (payload && payload.selfPayVisitKey));
  try {
    if (!payload || !payload.selfPayVisitKey)
      return { ok: false, error: "selfPayVisitKey は必須です" };
    if (!payload.items || payload.items.length === 0)
      return { ok: false, error: "明細が1件以上必要です" };

    var visitKey = String(payload.selfPayVisitKey);
    var ss       = getTargetSpreadsheet_();

    // ── 二重保存チェック（最優先）────────────────────────
    var paymentSh = ss.getSheetByName(SHEET_NAMES.PAYMENTS);
    if (paymentSh && paymentSh.getLastRow() >= 2) {
      var pRows = paymentSh.getRange(2, 1, paymentSh.getLastRow() - 1, 2).getValues();
      for (var ci = 0; ci < pRows.length; ci++) {
        if (String(pRows[ci][1]) === visitKey) {
          return {
            ok: false,
            error: "この来院はすでに会計済みです（" + pRows[ci][0] + "）。二重保存は禁止されています。"
          };
        }
      }
    }
    Logger.log("[savePaymentWithItems] duplicate check OK");

    // ── 税設定・デフォルト税区分 ──────────────────────────
    var taxCfg        = getTaxSettings_();
    var defaultTaxCat = String(getSettingValue_("default_tax_category") || "課税");

    var now    = new Date();
    var itemSh = ss.getSheetByName(SHEET_NAMES.ITEMS);
    if (!itemSh) return { ok: false, error: "シート SelfPayItems が見つかりません" };

    // 明細連番の起点（既存行を1度だけ読む）
    var itemSeq = getMaxItemSeq_(visitKey);

    // ── 明細行の保存 ──────────────────────────────────────
    var totalTaxEx  = 0;
    var totalTaxAmt = 0;
    var totalTaxInc = 0;
    var savedItems  = [];

    for (var i = 0; i < payload.items.length; i++) {
      var item     = payload.items[i];
      var menuCode = item.menuCode ? String(item.menuCode).trim()   : "";
      var menuName = item.menuName ? String(item.menuName).trim()   : "";
      var qty      = parseInt(item.qty,     10)                     || 1;
      var priceEx  = parseInt(item.priceEx, 10)                     || 0;
      var taxCat   = item.taxCategory ? String(item.taxCategory)    : defaultTaxCat;

      if (!menuCode)   return { ok: false, error: "明細 " + (i + 1) + " の menuCode が空です" };
      if (qty < 1)     return { ok: false, error: "明細 " + (i + 1) + " の数量は1以上必要です" };
      if (priceEx < 0) return { ok: false, error: "明細 " + (i + 1) + " の単価が不正です（負の値）" };

      var calc = calcItemTax_(priceEx, qty, taxCat, taxCfg);

      itemSeq++;
      var itemId = "SPI_" + visitKey + "_" + String(itemSeq).padStart(3, "0");
      itemSh.appendRow([
        itemId, visitKey, menuCode, menuName,
        qty, priceEx, taxCat,
        calc.subtotalEx, calc.taxAmt, calc.subtotalInc,
        now
      ]);
      Logger.log("[savePaymentWithItems] item: " + itemId + " ¥" + calc.subtotalInc);

      totalTaxEx  += calc.subtotalEx;
      totalTaxAmt += calc.taxAmt;
      totalTaxInc += calc.subtotalInc;
      savedItems.push({ itemId: itemId, menuCode: menuCode, subtotalInc: calc.subtotalInc });
    }
    Logger.log("[savePaymentWithItems] items done. totalTaxInc=¥" + totalTaxInc);

    // ── Payments 保存 ─────────────────────────────────────
    var paymentId     = "SPP_" + visitKey;
    var paymentMethod = payload.paymentMethod ? String(payload.paymentMethod) : "現金";
    var paymentStatus = payload.paymentStatus ? String(payload.paymentStatus) : "入金済";
    var paymentDate   = "";
    if (payload.paymentDate) {
      paymentDate = String(payload.paymentDate);
    } else if (paymentStatus === "入金済") {
      try { paymentDate = Utilities.formatDate(now, "Asia/Tokyo", "yyyy-MM-dd"); } catch(e) {}
    }

    if (!paymentSh) paymentSh = ss.getSheetByName(SHEET_NAMES.PAYMENTS);
    if (!paymentSh) return { ok: false, error: "シート Payments が見つかりません" };

    paymentSh.appendRow([
      paymentId, visitKey,
      totalTaxEx, totalTaxAmt, totalTaxInc,
      paymentMethod, paymentStatus, paymentDate,
      payload.memo ? String(payload.memo).trim() : "",
      now
    ]);
    Logger.log("[savePaymentWithItems] payment saved: " + paymentId);

    // ── SelfPayVisits.会計状態 更新 ──────────────────────
    var newBillingStatus = (paymentStatus === "未収") ? "未収" : "会計済";
    updateVisitBillingStatus_(visitKey, newBillingStatus);
    Logger.log("[savePaymentWithItems] billingStatus → " + newBillingStatus);

    // ── Run_Log ──────────────────────────────────────────
    // patientId: visitKey から "P0001" 部分を抽出（SPV_YYYYMMDD_P0001_001 形式）
    var pidForLog = visitKey.split("_")[2] || visitKey;
    appendRunLog_("PAYMENT_SAVE", pidForLog,
      "paymentId: " + paymentId + " 税込合計: ¥" + totalTaxInc + " " + paymentMethod);

    return {
      ok:          true,
      paymentId:   paymentId,
      totalTaxEx:  totalTaxEx,
      totalTaxAmt: totalTaxAmt,
      totalTaxInc: totalTaxInc,
      savedItems:  savedItems
    };

  } catch(err) {
    var m = (err && err.message) ? err.message : String(err);
    Logger.log("[savePaymentWithItems] ERROR: " + m);
    return { ok: false, error: m };
  }
}

/**
 * 指定 visitKey の領収書を発行して Receipts に保存する。
 * 既に領収書が存在する場合は再発行せず既存を返す（二重発行防止）。
 *
 * @param {string} selfPayVisitKey
 * @returns {{
 *   ok, receiptId?, receiptNo?, issuedDate?,
 *   patientName?, clinicName?,
 *   totalTaxInc?, totalTaxAmt?,
 *   alreadyIssued?, error?
 * }}
 */
function issueReceipt(selfPayVisitKey) {
  Logger.log("[issueReceipt] START visitKey=" + selfPayVisitKey);
  try {
    if (!selfPayVisitKey) return { ok: false, error: "selfPayVisitKey は必須です" };
    var visitKey = String(selfPayVisitKey);
    var ss       = getTargetSpreadsheet_();

    // ── 二重発行チェック ─────────────────────────────────
    var receiptSh = ss.getSheetByName(SHEET_NAMES.RECEIPTS);
    if (receiptSh && receiptSh.getLastRow() >= 2) {
      var rRows = receiptSh.getRange(2, 1, receiptSh.getLastRow() - 1, 7).getValues();
      for (var ri = 0; ri < rRows.length; ri++) {
        if (String(rRows[ri][1]) !== visitKey) continue;
        Logger.log("[issueReceipt] already issued: " + rRows[ri][0]);
        var existRd = "";
        if (rRows[ri][3]) {
          try { existRd = Utilities.formatDate(new Date(rRows[ri][3]), "Asia/Tokyo", "yyyy-MM-dd"); } catch(e) {}
        }
        return {
          ok:           true,
          receiptId:    String(rRows[ri][0]),
          receiptNo:    String(rRows[ri][2]),
          issuedDate:   existRd,
          patientName:  rRows[ri][4] || "",
          totalTaxInc:  rRows[ri][5] || 0,
          totalTaxAmt:  rRows[ri][6] || 0,
          clinicName:   String(getSettingValue_("clinic_name") || "平山接骨院"),
          alreadyIssued: true
        };
      }
    }

    // ── Payments 確認（会計済みか検証）──────────────────
    var paymentSh = ss.getSheetByName(SHEET_NAMES.PAYMENTS);
    if (!paymentSh || paymentSh.getLastRow() < 2)
      return { ok: false, error: "Payments シートが見つかりません" };

    var payment = null;
    paymentSh.getRange(2, 1, paymentSh.getLastRow() - 1, 10).getValues()
      .forEach(function(r) {
        if (!payment && String(r[1]) === visitKey) {
          payment = { totalTaxEx: r[2], totalTaxAmt: r[3], totalTaxInc: r[4] };
        }
      });
    if (!payment)
      return { ok: false, error: "支払記録がありません。先に会計入力を完了してください。" };

    // ── 患者名・院名 ──────────────────────────────────────
    var patientId = visitKey.split("_")[2] || "";
    var visitSh   = ss.getSheetByName(SHEET_NAMES.VISITS);
    if (visitSh && visitSh.getLastRow() >= 2) {
      visitSh.getRange(2, 1, visitSh.getLastRow() - 1, 2).getValues().forEach(function(r) {
        if (!patientId && String(r[0]) === visitKey) patientId = String(r[1]);
      });
    }
    var patient     = getPatientById(patientId);
    var patientName = patient ? patient.name : (patientId || "—");
    var clinicName  = String(getSettingValue_("clinic_name") || "平山接骨院");

    // ── receiptNo 採番 ────────────────────────────────────
    var receiptNo  = nextReceiptNo_();
    var now        = new Date();
    var issuedDate = "";
    try { issuedDate = Utilities.formatDate(now, "Asia/Tokyo", "yyyy-MM-dd"); } catch(e) {}

    // ── Receipts 保存 ─────────────────────────────────────
    if (!receiptSh) receiptSh = ss.getSheetByName(SHEET_NAMES.RECEIPTS);
    if (!receiptSh) return { ok: false, error: "シート Receipts が見つかりません" };

    receiptSh.appendRow([
      receiptNo,            // receiptId
      visitKey,             // selfPayVisitKey
      receiptNo,            // receiptNo（表示用・receiptId と同値）
      issuedDate,           // 発行日
      patientName,          // 宛名
      payment.totalTaxInc,  // 金額（税込）
      payment.totalTaxAmt,  // 消費税額
      "施術費として",        // 但し書き
      0,                    // 再発行回数
      now                   // createdAt
    ]);
    Logger.log("[issueReceipt] saved: " + receiptNo + " ¥" + payment.totalTaxInc);

    var pidForLog = visitKey.split("_")[2] || visitKey;
    appendRunLog_("RECEIPT_ISSUE", pidForLog,
      "receiptNo: " + receiptNo + " 宛名: " + patientName + " ¥" + payment.totalTaxInc);

    return {
      ok:           true,
      receiptId:    receiptNo,
      receiptNo:    receiptNo,
      issuedDate:   issuedDate,
      patientName:  patientName,
      clinicName:   clinicName,
      totalTaxInc:  payment.totalTaxInc,
      totalTaxAmt:  payment.totalTaxAmt,
      alreadyIssued: false
    };

  } catch(err) {
    var m = (err && err.message) ? err.message : String(err);
    Logger.log("[issueReceipt] ERROR: " + m);
    return { ok: false, error: m };
  }
}

/**
 * receipt.html 表示用に visit・patient・items・payment・receipt・clinicName を返す。
 * @param {string} selfPayVisitKey
 * @returns {{ ok, visit?, patient?, items?, payment?, receipt?, clinicName?, error? }}
 */
function getReceiptByVisit(selfPayVisitKey) {
  try {
    if (!selfPayVisitKey) return { ok: false, error: "selfPayVisitKey は必須です" };
    var visitKey = String(selfPayVisitKey);
    var ss       = getTargetSpreadsheet_();

    // ── Visit ─────────────────────────────────────────────
    var visit = null;
    var visitSh = ss.getSheetByName(SHEET_NAMES.VISITS);
    if (visitSh && visitSh.getLastRow() >= 2) {
      visitSh.getRange(2, 1, visitSh.getLastRow() - 1, 9).getValues().forEach(function(r) {
        if (visit || String(r[0]) !== visitKey) return;
        var vd = "";
        if (r[2]) { try { vd = Utilities.formatDate(new Date(r[2]), "Asia/Tokyo", "yyyy-MM-dd"); } catch(e) {} }
        visit = {
          selfPayVisitKey: String(r[0]),
          patientId:       String(r[1]),
          visitDate:       vd,
          billingStatus:   r[8] || "未会計"
        };
      });
    }
    if (!visit) return { ok: false, error: "来院記録が見つかりません: " + visitKey };

    // ── Patient ───────────────────────────────────────────
    var patient = getPatientById(visit.patientId);

    // ── SelfPayItems ──────────────────────────────────────
    var items = [];
    var itemSh = ss.getSheetByName(SHEET_NAMES.ITEMS);
    if (itemSh && itemSh.getLastRow() >= 2) {
      itemSh.getRange(2, 1, itemSh.getLastRow() - 1, 11).getValues().forEach(function(r) {
        if (!r[0] || String(r[1]) !== visitKey) return;
        items.push({
          itemId:      String(r[0]),
          menuCode:    String(r[2]),
          menuName:    r[3]  || "",
          qty:         r[4]  || 1,
          priceEx:     r[5]  || 0,
          taxCategory: r[6]  || "課税",
          subtotalEx:  r[7]  || 0,
          taxAmt:      r[8]  || 0,
          subtotalInc: r[9]  || 0
        });
      });
    }

    // ── Payment ───────────────────────────────────────────
    var payment = null;
    var paymentSh = ss.getSheetByName(SHEET_NAMES.PAYMENTS);
    if (paymentSh && paymentSh.getLastRow() >= 2) {
      paymentSh.getRange(2, 1, paymentSh.getLastRow() - 1, 10).getValues().forEach(function(r) {
        if (payment || String(r[1]) !== visitKey) return;
        var pd = "";
        if (r[7]) { try { pd = Utilities.formatDate(new Date(r[7]), "Asia/Tokyo", "yyyy-MM-dd"); } catch(e) {} }
        payment = {
          paymentId:     String(r[0]),
          totalTaxEx:    r[2],
          totalTaxAmt:   r[3],
          totalTaxInc:   r[4],
          paymentMethod: r[5] || "",
          paymentStatus: r[6] || "",
          paymentDate:   pd,
          memo:          r[8] || ""
        };
      });
    }

    // ── Receipt ───────────────────────────────────────────
    var receipt = null;
    var receiptSh = ss.getSheetByName(SHEET_NAMES.RECEIPTS);
    if (receiptSh && receiptSh.getLastRow() >= 2) {
      receiptSh.getRange(2, 1, receiptSh.getLastRow() - 1, 10).getValues().forEach(function(r) {
        if (receipt || String(r[1]) !== visitKey) return;
        var rd = "";
        if (r[3]) { try { rd = Utilities.formatDate(new Date(r[3]), "Asia/Tokyo", "yyyy-MM-dd"); } catch(e) {} }
        receipt = {
          receiptId:    String(r[0]),
          receiptNo:    String(r[2]),
          issuedDate:   rd,
          addressee:    r[4] || "",
          totalTaxInc:  r[5] || 0,
          totalTaxAmt:  r[6] || 0,
          description:  r[7] || "施術費として",
          reissueCount: r[8] || 0
        };
      });
    }

    return {
      ok:         true,
      visit:      visit,
      patient:    patient,
      items:      items,
      payment:    payment,
      receipt:    receipt,
      clinicName: String(getSettingValue_("clinic_name") || "平山接骨院")
    };

  } catch(err) {
    var m = (err && err.message) ? err.message : String(err);
    Logger.log("[getReceiptByVisit] ERROR: " + m);
    return { ok: false, error: m };
  }
}

// ============================================================
// PRIVATE HELPERS
// ============================================================

/**
 * Settings シートから特定キーの値を返す。見つからない場合は null。
 */
function getSettingValue_(key) {
  try {
    var sh = getTargetSpreadsheet_().getSheetByName(SHEET_NAMES.SETTINGS);
    if (!sh || sh.getLastRow() < 2) return null;
    var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
    for (var i = 0; i < rows.length; i++) {
      if (rows[i][0] === key) return rows[i][1];
    }
  } catch(e) {}
  return null;
}

/**
 * Settings から税計算設定を読む。
 * @returns {{ taxRate: number, rounding: string, taxUnit: string }}
 */
function getTaxSettings_() {
  var taxRate  = 0.10;
  var rounding = "floor";
  var taxUnit  = "item";
  try {
    var sh = getTargetSpreadsheet_().getSheetByName(SHEET_NAMES.SETTINGS);
    if (sh && sh.getLastRow() >= 2) {
      sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function(r) {
        if (r[0] === "tax_rate")     taxRate  = parseFloat(r[1]) || 0.10;
        if (r[0] === "tax_rounding") rounding = String(r[1])     || "floor";
        if (r[0] === "tax_unit")     taxUnit  = String(r[1])     || "item";
      });
    }
  } catch(e) {}
  return { taxRate: taxRate, rounding: rounding, taxUnit: taxUnit };
}

/**
 * 1明細の税額・税込小計を計算する（item 単位）。
 * tax_unit = "total" の場合も item 単位で計算し、合算は呼び出し側で行う。
 */
function calcItemTax_(priceEx, qty, taxCategory, taxCfg) {
  var subtotalEx = priceEx * qty;
  if (taxCategory !== "課税") {
    return { subtotalEx: subtotalEx, taxAmt: 0, subtotalInc: subtotalEx };
  }
  var rawTax;
  if      (taxCfg.rounding === "ceil")  rawTax = Math.ceil(subtotalEx  * taxCfg.taxRate);
  else if (taxCfg.rounding === "round") rawTax = Math.round(subtotalEx * taxCfg.taxRate);
  else                                   rawTax = Math.floor(subtotalEx * taxCfg.taxRate);
  return { subtotalEx: subtotalEx, taxAmt: rawTax, subtotalInc: subtotalEx + rawTax };
}

/**
 * SelfPayItems で指定 visitKey に存在する最大の連番を返す。
 * 例: "SPI_SPV_20260428_P0001_001_002" の場合 2。存在しなければ 0。
 */
function getMaxItemSeq_(visitKey) {
  var prefix = "SPI_" + visitKey + "_";
  var maxSeq = 0;
  var sh = getTargetSpreadsheet_().getSheetByName(SHEET_NAMES.ITEMS);
  if (sh && sh.getLastRow() >= 2) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(function(r) {
      var key = String(r[0]);
      if (key.indexOf(prefix) !== 0) return;
      var seq = parseInt(key.slice(prefix.length), 10);
      if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    });
  }
  return maxSeq;
}

/**
 * 領収書番号を採番する。
 * フォーマット: {prefix}_{YYYY}_{N桁連番}（例: R_2026_0001）
 *
 * ⚠️ Settings.receipt_no_prefix の初期値は "R"（→ R_2026_0001 形式）。
 *    設計書の例 "SPR_2026_0001" に合わせたい場合は
 *    Settings シートで receipt_no_prefix を "SPR" に変更してください。
 */
function nextReceiptNo_() {
  var prefix    = String(getSettingValue_("receipt_no_prefix") || "R");
  var digits    = parseInt(getSettingValue_("receipt_no_digits") || 4, 10) || 4;
  var resetMode = String(getSettingValue_("receipt_no_reset")   || "yearly");

  var year       = new Date().getFullYear();
  var yearPart   = (resetMode === "yearly") ? String(year) + "_" : "";
  var fullPrefix = prefix + "_" + yearPart;   // 例: "R_2026_"

  var maxSeq = 0;
  var sh = getTargetSpreadsheet_().getSheetByName(SHEET_NAMES.RECEIPTS);
  if (sh && sh.getLastRow() >= 2) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(function(r) {
      var id = String(r[0]);
      if (id.indexOf(fullPrefix) !== 0) return;
      var seq = parseInt(id.slice(fullPrefix.length), 10);
      if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
    });
  }
  return fullPrefix + String(maxSeq + 1).padStart(digits, "0");
}

/**
 * SelfPayVisits の指定 visitKey の会計状態（列9）を更新する。
 */
function updateVisitBillingStatus_(visitKey, status) {
  try {
    var sh = getTargetSpreadsheet_().getSheetByName(SHEET_NAMES.VISITS);
    if (!sh || sh.getLastRow() < 2) return;
    var keys = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < keys.length; i++) {
      if (String(keys[i][0]) === visitKey) {
        sh.getRange(i + 2, 9).setValue(status);   // 9列目 = 会計状態
        return;
      }
    }
    Logger.log("[updateVisitBillingStatus_] visitKey not found: " + visitKey);
  } catch(e) {
    Logger.log("[updateVisitBillingStatus_] ERROR: " + e.message);
  }
}
