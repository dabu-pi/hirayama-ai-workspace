"use strict";

// SPREADSHEET_ID, SHEET_NAMES, getTargetSpreadsheet_: defined in JREC_SF01_Setup.gs
// getPatientById, appendRunLog_: defined in JREC_SF01_Patient.gs

// ============================================================
// PUBLIC — 会計・支払・領収書
// ============================================================

/**
 * 患者一覧表示用に未収額・未会計件数を1回の読み取りで返す。
 * SelfPayVisits と Payments を各1回だけ読み取り、患者ごとの集計を返す。
 *
 * 未収額:    Payments.paymentStatus = "未収" または "一部入金" の totalTaxInc 合計
 * 未会計件数: Payments が存在しない SelfPayVisits 行の数
 *
 * @param {string=} patientId 指定時はその患者のみ集計（省略時は全患者）
 * @returns {{ [patientId]: { outstanding: number, unbilledCount: number } }}
 */
function getPatientListStats(patientId) {
  try {
    var ss = getTargetSpreadsheet_();

    // SelfPayVisits: visitKey→patientId マップ + patientId ごとの totalVisits カウント
    // isDeleted=TRUE の visit は除外（ゴミ箱の来院は集計対象外）
    var vkToPatient   = {};
    var patientTotals = {};
    var visitSh = ss.getSheetByName(SHEET_NAMES.VISITS);
    if (visitSh && visitSh.getLastRow() >= 2) {
      var lscols = Math.min(visitSh.getLastColumn(), 12);
      visitSh.getRange(2, 1, visitSh.getLastRow() - 1, lscols).getValues().forEach(function(r) {
        if (!r[0] || !r[1]) return;
        var isDeleted = r[11] === true || r[11] === "TRUE";
        if (isDeleted) return;
        var vk  = String(r[0]);
        var pid = String(r[1]);
        if (patientId && pid !== String(patientId)) return;
        vkToPatient[vk] = pid;
        if (!patientTotals[pid]) patientTotals[pid] = { totalVisits: 0, billedVisits: 0, outstanding: 0 };
        patientTotals[pid].totalVisits++;
      });
    }

    // Payments: 会計済み visitKey を確認 + 未収残額を集計
    // paidAmount (col 11): 実際の入金済み累積額。未設定の旧データはフォールバックで推定。
    var paymentSh = ss.getSheetByName(SHEET_NAMES.PAYMENTS);
    if (paymentSh && paymentSh.getLastRow() >= 2) {
      paymentSh.getRange(2, 1, paymentSh.getLastRow() - 1, 11).getValues().forEach(function(r) {
        var vk     = String(r[1]);
        var status = r[6] || "";
        var amt    = r[4] || 0;
        var pid    = vkToPatient[vk];
        if (!pid || !patientTotals[pid]) return;
        patientTotals[pid].billedVisits++;
        if (status === "未収" || status === "一部入金") {
          // paidAmount がなければ旧データとしてフォールバック（未収=0 既払い、一部入金=0）
          var rawPaid   = r[10];
          var paidAmt   = (rawPaid !== "" && rawPaid !== null && rawPaid !== undefined) ? (rawPaid || 0) : 0;
          var remaining = Math.max(amt - paidAmt, 0);
          patientTotals[pid].outstanding += remaining;
        }
      });
    }

    // 結果を組み立て
    var result = {};
    Object.keys(patientTotals).forEach(function(pid) {
      var t = patientTotals[pid];
      result[pid] = {
        outstanding:   t.outstanding,
        unbilledCount: Math.max(0, t.totalVisits - t.billedVisits)
      };
    });
    return result;

  } catch(err) {
    var m = (err && err.message) ? err.message : String(err);
    Logger.log("[getPatientListStats] ERROR: " + m);
    return {};
  }
}

/**
 * 全患者の未収残高を { [patientId]: outstandingAmount } で返す。
 * 患者一覧の未収額列表示に使用する。
 *
 * 未収額の定義:
 *   Payments.paymentStatus = "未収" または "一部入金" の totalTaxInc 合計。
 *   会計入力がまだない来院（未会計）は未収に含めない。
 *
 * 読み取りコスト: SelfPayVisits 全行 + Payments 全行 の2回読み取り。
 * 患者数・来院数が増えた場合は DailySales への集計キャッシュ化を検討する。
 *
 * @returns {{ [patientId]: number }}
 */
function getAllOutstandingByPatient() {
  try {
    var ss = getTargetSpreadsheet_();

    // SelfPayVisits: visitKey → patientId マップ
    var vkToPatient = {};
    var visitSh = ss.getSheetByName(SHEET_NAMES.VISITS);
    if (visitSh && visitSh.getLastRow() >= 2) {
      visitSh.getRange(2, 1, visitSh.getLastRow() - 1, 2).getValues().forEach(function(r) {
        if (r[0] && r[1]) vkToPatient[String(r[0])] = String(r[1]);
      });
    }

    // Payments: 未収・一部入金 の残額を patientId 別に集計（paidAmount 対応）
    var result = {};
    var paymentSh = ss.getSheetByName(SHEET_NAMES.PAYMENTS);
    if (paymentSh && paymentSh.getLastRow() >= 2) {
      paymentSh.getRange(2, 1, paymentSh.getLastRow() - 1, 11).getValues().forEach(function(r) {
        var vk     = String(r[1]);
        var status = r[6] || "";
        if (status !== "未収" && status !== "一部入金") return;
        var pid = vkToPatient[vk];
        if (!pid) return;
        var amt      = r[4] || 0;
        var rawPaid  = r[10];
        var paidAmt  = (rawPaid !== "" && rawPaid !== null && rawPaid !== undefined) ? (rawPaid || 0) : 0;
        var remaining = Math.max(amt - paidAmt, 0);
        result[pid] = (result[pid] || 0) + remaining;
      });
    }

    return result;

  } catch(err) {
    var m = (err && err.message) ? err.message : String(err);
    Logger.log("[getAllOutstandingByPatient] ERROR: " + m);
    return {};
  }
}

/**
 * 患者単位の会計集計と visitKey ごとの支払・領収書状態を返す。
 * patient-detail.html のサマリー表示と来院ごとの会計導線に使用する。
 *
 * @param {string} patientId
 * @returns {{
 *   totalPaid:        number,  // 入金済・一部入金 の tax-inc 合計
 *   totalOutstanding: number,  // 未収・一部入金 の tax-inc 合計
 *   unbilledCount:    number,  // Payments が存在しない来院件数（未会計）
 *   payments: { [visitKey]: { paymentId, totalTaxInc, paymentMethod, paymentStatus } },
 *   receipts: { [visitKey]: { receiptId, receiptNo } }
 * }}
 */
function getPatientAccountingData(patientId) {
  try {
    if (!patientId) return { totalPaid: 0, totalOutstanding: 0, payments: {}, receipts: {} };
    var ss = getTargetSpreadsheet_();

    // ── 患者の visitKey セット（isDeleted=TRUE を除外）────────────
    var visitKeySet = {};
    var visitSh = ss.getSheetByName(SHEET_NAMES.VISITS);
    if (visitSh && visitSh.getLastRow() >= 2) {
      var vcols = Math.min(visitSh.getLastColumn(), 12);
      visitSh.getRange(2, 1, visitSh.getLastRow() - 1, vcols).getValues().forEach(function(r) {
        if (!r[0] || String(r[1]) !== String(patientId)) return;
        var isDeleted = r[11] === true || r[11] === "TRUE";
        if (!isDeleted) visitKeySet[String(r[0])] = true;
      });
    }

    // ── Payments 集計 ────────────────────────────────────
    // paidAmount (col 11): 実際の入金済み累積額。旧データは paymentStatus から推定。
    var payments         = {};
    var totalPaid        = 0;
    var totalOutstanding = 0;
    var paymentSh = ss.getSheetByName(SHEET_NAMES.PAYMENTS);
    if (paymentSh && paymentSh.getLastRow() >= 2) {
      paymentSh.getRange(2, 1, paymentSh.getLastRow() - 1, 11).getValues().forEach(function(r) {
        var vk = String(r[1]);
        if (!visitKeySet[vk]) return;
        var status   = r[6] || "";
        var totalInc = r[4] || 0;
        var rawPaid  = r[10];
        // フォールバック: 入金済→totalInc、未収/一部入金→0（旧データは不明として0扱い）
        var paidAmt  = (rawPaid !== "" && rawPaid !== null && rawPaid !== undefined)
          ? (rawPaid || 0)
          : (status === "入金済" ? totalInc : 0);
        var remaining = Math.max(totalInc - paidAmt, 0);
        payments[vk] = {
          paymentId:     String(r[0]),
          totalTaxInc:   totalInc,
          paidAmount:    paidAmt,
          paymentMethod: r[5] || "",
          paymentStatus: status
        };
        totalPaid        += paidAmt;
        totalOutstanding += remaining;
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

    // 未会計件数 = Payment が存在しない visitKey の数
    var unbilledCount = 0;
    Object.keys(visitKeySet).forEach(function(vk) { if (!payments[vk]) unbilledCount++; });

    return {
      totalPaid:        totalPaid,
      totalOutstanding: totalOutstanding,
      unbilledCount:    unbilledCount,
      payments:         payments,
      receipts:         receipts
    };

  } catch(err) {
    var m = (err && err.message) ? err.message : String(err);
    Logger.log("[getPatientAccountingData] ERROR: " + m);
    return { totalPaid: 0, totalOutstanding: 0, unbilledCount: 0, payments: {}, receipts: {} };
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
      paymentSh.getRange(2, 1, paymentSh.getLastRow() - 1, 11).getValues()
        .forEach(function(r) {
          if (alreadyPaid || String(r[1]) !== visitKey) return;
          alreadyPaid = true;
          var status   = r[6] || "";
          var totalInc = r[4] || 0;
          var rawPaid  = r[10];
          var paidAmt  = (rawPaid !== "" && rawPaid !== null && rawPaid !== undefined)
            ? (rawPaid || 0) : (status === "入金済" ? totalInc : 0);
          existingPayment = {
            paymentId:     String(r[0]),
            totalTaxEx:    r[2],
            totalTaxAmt:   r[3],
            totalTaxInc:   totalInc,
            paidAmount:    paidAmt,
            paymentMethod: r[5] || "",
            paymentStatus: status
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
 * 未収・一部入金の Payment の collectedAmount 分を回収する。
 *
 * paymentStatus 再判定（確定仕様）:
 *   paidAmount = 0               → 未収
 *   0 < paidAmount < totalTaxInc → 一部入金
 *   paidAmount >= totalTaxInc    → 入金済
 *
 * 二重回収防止:
 *   - paymentStatus = "入金済" のときは更新せず { ok: false } を返す
 *   - Payment が存在しない visitKey（未会計）も対象外
 *
 * 後方互換（paidAmount 空の旧データ）:
 *   - 入金済 + paidAmount 空   → paidAmount = totalTaxInc 相当
 *   - 未収   + paidAmount 空   → paidAmount = 0
 *   - 一部入金 + paidAmount 空 → エラー（既回収額不明のため回収不可）
 *
 * @param {string} visitKey
 * @param {{
 *   collectedAmount: number,  今回回収額（1円以上・未収残額以下）
 *   paymentMethod?:  string,  現金/カード/電子マネー/PayPay/その他
 *   paymentDate?:   string,   YYYY-MM-DD（省略時: 当日）
 *   memo?:          string
 * }} payload
 * @returns {{
 *   ok, visitKey?, newStatus?, paymentDate?,
 *   totalTaxInc?, collectedAmount?, paidAmount?, remainingAmount?,
 *   paymentMethod?, error?
 * }}
 */
function collectOutstandingPayment(visitKey, payload) {
  Logger.log("[collectOutstandingPayment] START visitKey=" + visitKey);
  try {
    if (!visitKey) return { ok: false, error: "visitKey は必須です" };
    visitKey = String(visitKey);
    var ss   = getTargetSpreadsheet_();

    // ── Payment を検索 ───────────────────────────────────
    var paymentSh = ss.getSheetByName(SHEET_NAMES.PAYMENTS);
    if (!paymentSh || paymentSh.getLastRow() < 2)
      return { ok: false, error: "Payments シートが見つかりません" };

    var rows             = paymentSh.getRange(2, 1, paymentSh.getLastRow() - 1, 11).getValues();
    var rowIndex         = -1;
    var curStatus        = "";
    var totalTaxInc      = 0;
    var curMemo          = "";
    var curPaymentMethod = "";
    var curPaidAmount    = 0;

    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][1]) === visitKey) {
        rowIndex         = i + 2;   // 1-indexed + header row
        curStatus        = rows[i][6] || "";
        totalTaxInc      = rows[i][4] || 0;
        curMemo          = rows[i][8] || "";
        curPaymentMethod = rows[i][5] || "";
        var rawPaid      = rows[i][10];
        if (rawPaid !== "" && rawPaid !== null && rawPaid !== undefined) {
          curPaidAmount = rawPaid || 0;
        } else if (curStatus === "入金済") {
          curPaidAmount = totalTaxInc;
        } else if (curStatus === "未収") {
          curPaidAmount = 0;
        } else {
          // 一部入金 + paidAmount 空: 既回収額不明のため回収不可
          return { ok: false,
            error: "既回収額（paidAmount）が記録されていません。Payments シートの col 11 を手動確認してください。" };
        }
        break;
      }
    }

    if (rowIndex === -1)
      return { ok: false, error: "この来院の支払記録が見つかりません。先に会計入力を行ってください。" };

    // ── 二重回収防止 ─────────────────────────────────────
    if (curStatus === "入金済")
      return { ok: false, error: "この支払はすでに入金済みです（二重回収は行いません）。" };

    if (curStatus !== "未収" && curStatus !== "一部入金")
      return { ok: false, error: "未収または一部入金の支払のみ回収できます（現在: " + curStatus + "）。" };

    // ── collectedAmount の取得・検証 ─────────────────────
    var collectedAmount = (payload && payload.collectedAmount !== undefined && payload.collectedAmount !== null)
      ? parseInt(payload.collectedAmount, 10) : NaN;
    if (isNaN(collectedAmount) || collectedAmount <= 0)
      return { ok: false, error: "今回回収額は1円以上を入力してください。" };

    var remaining = Math.max(totalTaxInc - curPaidAmount, 0);
    if (collectedAmount > remaining)
      return { ok: false,
        error: "今回回収額（¥" + collectedAmount + "）が未収残額（¥" + remaining + "）を超えています。" };

    // ── paidAmount 累積更新・paymentStatus 再判定 ─────────
    var newPaidAmount = curPaidAmount + collectedAmount;
    var newStatus;
    if (newPaidAmount >= totalTaxInc) {
      newPaidAmount = totalTaxInc;
      newStatus     = "入金済";
    } else if (newPaidAmount > 0) {
      newStatus = "一部入金";
    } else {
      newStatus = "未収";
    }
    var newRemaining = Math.max(totalTaxInc - newPaidAmount, 0);

    // ── 更新値の組み立て ─────────────────────────────────
    var now           = new Date();
    var paymentMethod = (payload && payload.paymentMethod) ? String(payload.paymentMethod) : "";
    var paymentDate   = (payload && payload.paymentDate)   ? String(payload.paymentDate) :
                        Utilities.formatDate(now, "Asia/Tokyo", "yyyy-MM-dd");
    var addMemo = (payload && payload.memo) ? String(payload.memo).trim() : "";
    var newMemo = curMemo
      ? curMemo + "　回収(" + paymentDate + " ¥" + collectedAmount + ")" + (addMemo ? ": " + addMemo : "")
      : "回収(" + paymentDate + " ¥" + collectedAmount + ")" + (addMemo ? ": " + addMemo : "");

    // ── Payments を更新 ──────────────────────────────────
    paymentSh.getRange(rowIndex, 7).setValue(newStatus);       // 入金状態
    paymentSh.getRange(rowIndex, 8).setValue(paymentDate);     // 入金日（最終回収日）
    paymentSh.getRange(rowIndex, 9).setValue(newMemo);         // メモ
    paymentSh.getRange(rowIndex, 11).setValue(newPaidAmount);  // paidAmount 累積更新
    if (paymentMethod) paymentSh.getRange(rowIndex, 6).setValue(paymentMethod);
    Logger.log("[collectOutstandingPayment] row " + rowIndex +
      " → " + newStatus + " paidAmount=¥" + newPaidAmount);

    // ── SelfPayVisits.会計状態 更新 ──────────────────────
    var newBillingStatus = (newStatus === "入金済") ? "会計済" : "未収";
    updateVisitBillingStatus_(visitKey, newBillingStatus);
    Logger.log("[collectOutstandingPayment] visit billingStatus → " + newBillingStatus);

    // ── Run_Log ──────────────────────────────────────────
    var pidForLog = visitKey.split("_")[2] || visitKey;
    appendRunLog_("PAYMENT_COLLECT", pidForLog,
      "visitKey: " + visitKey +
      " 今回回収額: ¥" + collectedAmount +
      " 累積入金額: ¥" + newPaidAmount +
      " 残額: ¥" + newRemaining +
      " " + (paymentMethod || ""),
      visitKey);

    return {
      ok:              true,
      visitKey:        visitKey,
      newStatus:       newStatus,
      paymentDate:     paymentDate,
      totalTaxInc:     totalTaxInc,
      collectedAmount: collectedAmount,
      paidAmount:      newPaidAmount,
      remainingAmount: newRemaining,
      paymentMethod:   paymentMethod || curPaymentMethod
    };

  } catch(err) {
    var m = (err && err.message) ? err.message : String(err);
    Logger.log("[collectOutstandingPayment] ERROR: " + m);
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

    // ── paidAmount 計算 ──────────────────────────────────
    // paidAmount = 実際に入金された累積額
    //   入金済:   paidAmount = totalTaxInc（全額）
    //   未収:     paidAmount = 0
    //   一部入金: paidAmount = payload.paidAmount（フォームから入力。0〜totalTaxInc-1）
    var paidAmount;
    if (paymentStatus === "入金済") {
      paidAmount = totalTaxInc;
    } else if (paymentStatus === "未収") {
      paidAmount = 0;
    } else {  // 一部入金
      var rawPaid = (payload.paidAmount !== undefined && payload.paidAmount !== null)
        ? parseInt(payload.paidAmount, 10) : 0;
      paidAmount = isNaN(rawPaid) ? 0 : Math.max(0, rawPaid);
      // paidAmount の範囲チェック・paymentStatus の自動補正
      if (paidAmount >= totalTaxInc) {
        paidAmount    = totalTaxInc;
        paymentStatus = "入金済";
      } else if (paidAmount === 0) {
        paymentStatus = "未収";
      }
    }
    var remainingAmount = Math.max(totalTaxInc - paidAmount, 0);
    Logger.log("[savePaymentWithItems] paidAmount=¥" + paidAmount + " remaining=¥" + remainingAmount);

    var paymentDate = "";
    if (payload.paymentDate) {
      paymentDate = String(payload.paymentDate);
    } else if (paymentStatus === "入金済" || paymentStatus === "一部入金") {
      try { paymentDate = Utilities.formatDate(now, "Asia/Tokyo", "yyyy-MM-dd"); } catch(e) {}
    }

    if (!paymentSh) paymentSh = ss.getSheetByName(SHEET_NAMES.PAYMENTS);
    if (!paymentSh) return { ok: false, error: "シート Payments が見つかりません" };

    paymentSh.appendRow([
      paymentId, visitKey,
      totalTaxEx, totalTaxAmt, totalTaxInc,
      paymentMethod, paymentStatus, paymentDate,
      payload.memo ? String(payload.memo).trim() : "",
      now,
      paidAmount    // col 11: 実際の入金済み累積額
    ]);
    Logger.log("[savePaymentWithItems] payment saved: " + paymentId);

    // ── SelfPayVisits.会計状態 更新 ──────────────────────
    // 一部入金・未収 → "未収"、入金済 → "会計済"
    var newBillingStatus = (paymentStatus === "入金済") ? "会計済" : "未収";
    updateVisitBillingStatus_(visitKey, newBillingStatus);
    Logger.log("[savePaymentWithItems] billingStatus → " + newBillingStatus);

    // ── Run_Log ──────────────────────────────────────────
    // patientId: visitKey から "P0001" 部分を抽出（SPV_YYYYMMDD_P0001_001 形式）
    var pidForLog = visitKey.split("_")[2] || visitKey;
    appendRunLog_("PAYMENT_SAVE", pidForLog,
      "paymentId: " + paymentId + " 税込合計: ¥" + totalTaxInc
        + " 入金額: ¥" + paidAmount + " 残額: ¥" + remainingAmount + " " + paymentMethod,
      visitKey);

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

    // ── Payments 確認（入金済のみ発行許可）────────────────
    var paymentSh = ss.getSheetByName(SHEET_NAMES.PAYMENTS);
    if (!paymentSh || paymentSh.getLastRow() < 2)
      return { ok: false, error: "Payments シートが見つかりません" };

    var payment = null;
    paymentSh.getRange(2, 1, paymentSh.getLastRow() - 1, 11).getValues()
      .forEach(function(r) {
        if (!payment && String(r[1]) === visitKey) {
          payment = {
            totalTaxEx:    r[2],
            totalTaxAmt:   r[3],
            totalTaxInc:   r[4],
            paymentStatus: r[6] || ""
          };
        }
      });
    if (!payment)
      return { ok: false, error: "支払記録がありません。先に会計入力を完了してください。" };

    // 入金済のみ発行許可（未収・一部入金は拒否）
    if (payment.paymentStatus !== "入金済")
      return { ok: false,
        error: "領収書は入金済みの場合のみ発行できます（現在: " + payment.paymentStatus + "）。" +
               "先に未収回収を完了してください。" };

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
      "receiptNo: " + receiptNo + " 宛名: " + patientName + " ¥" + payment.totalTaxInc,
      visitKey);

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
      paymentSh.getRange(2, 1, paymentSh.getLastRow() - 1, 11).getValues().forEach(function(r) {
        if (payment || String(r[1]) !== visitKey) return;
        var pd = "";
        if (r[7]) { try { pd = Utilities.formatDate(new Date(r[7]), "Asia/Tokyo", "yyyy-MM-dd"); } catch(e) {} }
        var status   = r[6] || "";
        var totalInc = r[4] || 0;
        var rawPaid  = r[10];
        var paidAmt  = (rawPaid !== "" && rawPaid !== null && rawPaid !== undefined)
          ? (rawPaid || 0) : (status === "入金済" ? totalInc : 0);
        payment = {
          paymentId:       String(r[0]),
          totalTaxEx:      r[2],
          totalTaxAmt:     r[3],
          totalTaxInc:     totalInc,
          paidAmount:      paidAmt,
          remainingAmount: Math.max(totalInc - paidAmt, 0),
          paymentMethod:   r[5] || "",
          paymentStatus:   status,
          paymentDate:     pd,
          memo:            r[8] || ""
        };
      });
    }

    // ── Receipt ───────────────────────────────────────────
    var receipt = null;
    var receiptSh = ss.getSheetByName(SHEET_NAMES.RECEIPTS);
    if (receiptSh && receiptSh.getLastRow() >= 2) {
      receiptSh.getRange(2, 1, receiptSh.getLastRow() - 1, 11).getValues().forEach(function(r) {
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

// ============================================================
// PUBLIC — 本日受付・会計待ち一覧（Phase 6-D）
// ============================================================

/**
 * 指定日に来院した SelfPayVisits を Payments / Receipts / Patients と join して返す。
 * isDeleted=TRUE の visit は除外。省略時は JST 当日。
 *
 * ソート順（ジム側会計業務優先）:
 *   1. 未収 → 2. 一部入金 → 3. 入金済（領収書未発行）→ 4. 未会計 → 5. 領収書発行済
 *
 * @param {string=} dateStr "YYYY-MM-DD"（省略時: 当日 JST）
 * @returns {{
 *   ok: boolean, date: string,
 *   list: Array<{
 *     selfPayVisitKey, patientId, patientName, visitDate, chiefComplaint,
 *     paymentStatus, totalTaxInc, paidAmount, remainingAmount, paymentMethod,
 *     receiptNo, displayStatus, sortOrder
 *   }>,
 *   error?: string
 * }}
 */
function getDailyCheckoutList(dateStr) {
  Logger.log("[getDailyCheckoutList] START date=" + dateStr);
  try {
    if (!dateStr) {
      dateStr = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd");
    }
    var ss = getTargetSpreadsheet_();

    // ── Patients をインデックス化（patientId → 氏名）────────────
    var patientMap = {};
    var patSh = ss.getSheetByName(SHEET_NAMES.PATIENTS);
    if (patSh && patSh.getLastRow() >= 2) {
      patSh.getRange(2, 1, patSh.getLastRow() - 1, 2).getValues().forEach(function(r) {
        if (r[0]) patientMap[String(r[0])] = r[1] ? String(r[1]) : "";
      });
    }

    // ── Payments をインデックス化（visitKey → payment）──────────
    var paymentMap = {};
    var paymentSh = ss.getSheetByName(SHEET_NAMES.PAYMENTS);
    if (paymentSh && paymentSh.getLastRow() >= 2) {
      paymentSh.getRange(2, 1, paymentSh.getLastRow() - 1, 11).getValues().forEach(function(r) {
        if (!r[0]) return;
        var vk      = String(r[1]);
        var status  = r[6] || "";
        var totalInc = r[4] || 0;
        var rawPaid  = r[10];
        var paidAmt  = (rawPaid !== "" && rawPaid !== null && rawPaid !== undefined)
          ? (rawPaid || 0) : (status === "入金済" ? totalInc : 0);
        paymentMap[vk] = {
          totalTaxInc:     totalInc,
          paymentMethod:   r[5] || "",
          paymentStatus:   status,
          paidAmount:      paidAmt,
          remainingAmount: Math.max(totalInc - paidAmt, 0)
        };
      });
    }

    // ── Receipts をインデックス化（visitKey → receiptNo）─────────
    var receiptMap = {};
    var receiptSh = ss.getSheetByName(SHEET_NAMES.RECEIPTS);
    if (receiptSh && receiptSh.getLastRow() >= 2) {
      receiptSh.getRange(2, 1, receiptSh.getLastRow() - 1, 3).getValues().forEach(function(r) {
        if (!r[0]) return;
        var vk = String(r[1]);
        if (!receiptMap[vk]) receiptMap[vk] = { receiptNo: String(r[2]) };
      });
    }

    // ── 対象日の SelfPayVisits を抽出（isDeleted 除外）──────────
    var list = [];
    var visitSh = ss.getSheetByName(SHEET_NAMES.VISITS);
    if (visitSh && visitSh.getLastRow() >= 2) {
      var numCols = Math.min(visitSh.getLastColumn(), 12);
      visitSh.getRange(2, 1, visitSh.getLastRow() - 1, numCols).getValues().forEach(function(r) {
        if (!r[0]) return;
        var isDeleted = r[11] === true || r[11] === "TRUE";
        if (isDeleted) return;

        var visitDate = "";
        if (r[2]) {
          try { visitDate = Utilities.formatDate(new Date(r[2]), "Asia/Tokyo", "yyyy-MM-dd"); } catch(e) {}
        }
        if (visitDate !== dateStr) return;

        var vk        = String(r[0]);
        var patientId = String(r[1]);
        var pay       = paymentMap[vk] || null;
        var rec       = receiptMap[vk] || null;

        // 表示ステータスとソート順（ジム側会計優先）
        var displayStatus, sortOrder;
        if (!pay) {
          displayStatus = "未会計";
          sortOrder     = 3;
        } else if (pay.paymentStatus === "未収") {
          displayStatus = "未収";
          sortOrder     = 0;
        } else if (pay.paymentStatus === "一部入金") {
          displayStatus = "一部入金";
          sortOrder     = 1;
        } else if (pay.paymentStatus === "入金済" && !rec) {
          displayStatus = "入金済（領収書未発行）";
          sortOrder     = 2;
        } else {
          displayStatus = "領収書発行済";
          sortOrder     = 4;
        }

        list.push({
          selfPayVisitKey: vk,
          patientId:       patientId,
          patientName:     patientMap[patientId] || patientId,
          visitDate:       visitDate,
          chiefComplaint:  r[5] ? String(r[5]) : "",
          paymentStatus:   pay ? pay.paymentStatus : null,
          totalTaxInc:     pay ? pay.totalTaxInc     : 0,
          paidAmount:      pay ? pay.paidAmount       : 0,
          remainingAmount: pay ? pay.remainingAmount  : 0,
          paymentMethod:   pay ? pay.paymentMethod    : "",
          receiptNo:       rec ? rec.receiptNo        : null,
          displayStatus:   displayStatus,
          sortOrder:       sortOrder
        });
      });
    }

    // ソート: 未収→一部入金→入金済未発行→未会計→発行済
    list.sort(function(a, b) { return a.sortOrder - b.sortOrder; });

    Logger.log("[getDailyCheckoutList] date=" + dateStr + " count=" + list.length);
    return { ok: true, date: dateStr, list: list };

  } catch (err) {
    var m = err && err.message ? err.message : String(err);
    Logger.log("[getDailyCheckoutList] ERROR: " + m);
    return { ok: false, error: m, date: dateStr || "", list: [] };
  }
}

// ============================================================
// PUBLIC — 月間来院カレンダー集計（Phase 6-F）
// ============================================================

/**
 * 指定年月の SelfPayVisits を日付ごとに集計して返す。
 * isDeleted=TRUE の来院は除外する。
 *
 * @param {number} year  例: 2026
 * @param {number} month 例: 5
 * @returns {{
 *   ok: boolean,
 *   year: number, month: number,
 *   days: Object.<string, {visitCount:number, hasVisit:boolean}>,
 *   error?: string
 * }}
 */
function getMonthlyVisitCalendar(year, month) {
  Logger.log("[getMonthlyVisitCalendar] year=" + year + " month=" + month);
  try {
    var ss      = getTargetSpreadsheet_();
    var visitSh = ss.getSheetByName(SHEET_NAMES.VISITS);
    var data    = visitSh.getDataRange().getValues();
    var tz      = "Asia/Tokyo";

    var monthStr = year + "-" + ("0" + month).slice(-2); // "2026-05"
    var days = {};

    for (var i = 1; i < data.length; i++) {
      var r = data[i];
      if (!r[0]) continue;

      var isDeleted = r[11] === true || r[11] === "TRUE";
      if (isDeleted) continue;

      var visitDate = "";
      if (r[2]) {
        try { visitDate = Utilities.formatDate(new Date(r[2]), tz, "yyyy-MM-dd"); } catch(e) {}
      }
      if (!visitDate || visitDate.slice(0, 7) !== monthStr) continue;

      if (!days[visitDate]) days[visitDate] = { visitCount: 0, hasVisit: false };
      days[visitDate].visitCount++;
      days[visitDate].hasVisit = true;
    }

    Logger.log("[getMonthlyVisitCalendar] days with visits=" + Object.keys(days).length);
    return { ok: true, year: year, month: month, days: days };
  } catch (err) {
    var m = err && err.message ? err.message : String(err);
    Logger.log("[getMonthlyVisitCalendar] ERROR: " + m);
    return { ok: false, error: m, year: year, month: month, days: {} };
  }
}

// ============================================================
// PUBLIC — 月次売上サマリー（Phase 6-J）
// ============================================================

/**
 * 指定年月の月次売上サマリーを返す。
 *
 * ─── 集計方式 ─────────────────────────────────────────────────
 *   DailySales / Run_Log 非依存。
 *   SelfPayVisits(visitDate) + Payments + Receipts から直接集計。
 *   getDailyCheckoutList と同じ displayStatus 判定ロジックを使用。
 *
 * ─── 集計基準 ─────────────────────────────────────────────────
 *   visitDate（来院日）が対象月の来院を集計対象とする。
 *   isDeleted=true の来院は除外。
 *
 * @param {number} year  例: 2026（2020〜2035）
 * @param {number} month 例: 5（1〜12）
 * @returns {{
 *   ok: boolean, year: number, month: number,
 *   summary: {
 *     visitCount, unbilledCount, unpaidCount, partialCount,
 *     paidNoReceiptCount, issuedCount,
 *     totalBilled, totalPaid, totalRemaining
 *   },
 *   days: Object.<string, {
 *     date, visitCount, unbilledCount, unpaidCount, partialCount,
 *     paidNoReceiptCount, issuedCount, totalBilled, totalPaid, totalRemaining
 *   }>,
 *   error?: string
 * }}
 */
function getMonthlyRevenueSummary(year, month) {
  Logger.log("[getMonthlyRevenueSummary] year=" + year + " month=" + month);
  try {
    var y = parseInt(year,  10);
    var m = parseInt(month, 10);
    if (isNaN(y) || y < 2020 || y > 2035) return { ok: false, error: "year が範囲外: " + year,  summary: {}, days: {} };
    if (isNaN(m) || m < 1   || m > 12)   return { ok: false, error: "month が範囲外: " + month, summary: {}, days: {} };

    var monthStr = y + "-" + ("0" + m).slice(-2);   // 例: "2026-05"
    var ss       = getTargetSpreadsheet_();

    // ── Payments をインデックス化（visitKey → payment）────────
    var paymentMap = {};
    var paymentSh  = ss.getSheetByName(SHEET_NAMES.PAYMENTS);
    if (paymentSh && paymentSh.getLastRow() >= 2) {
      paymentSh.getRange(2, 1, paymentSh.getLastRow() - 1, 11).getValues().forEach(function(r) {
        if (!r[0] || !r[1]) return;
        var vk      = String(r[1]);
        var status  = String(r[6] || "");
        var totalInc = r[4] || 0;
        var rawPaid  = r[10];
        var paidAmt  = (rawPaid !== "" && rawPaid !== null && rawPaid !== undefined)
          ? (rawPaid || 0) : (status === "入金済" ? totalInc : 0);
        paymentMap[vk] = {
          totalTaxInc:     totalInc,
          paymentStatus:   status,
          paidAmount:      paidAmt,
          remainingAmount: Math.max(totalInc - paidAmt, 0)
        };
      });
    }

    // ── Receipts をインデックス化（visitKey → receiptNo）──────
    var receiptMap = {};
    var receiptSh  = ss.getSheetByName(SHEET_NAMES.RECEIPTS);
    if (receiptSh && receiptSh.getLastRow() >= 2) {
      receiptSh.getRange(2, 1, receiptSh.getLastRow() - 1, 3).getValues().forEach(function(r) {
        if (!r[0] || !r[1]) return;
        var vk = String(r[1]);
        if (!receiptMap[vk]) receiptMap[vk] = String(r[2]);
      });
    }

    // ── 対象月の SelfPayVisits を抽出（isDeleted 除外）────────
    var days   = {};
    var visitSh = ss.getSheetByName(SHEET_NAMES.VISITS);
    if (visitSh && visitSh.getLastRow() >= 2) {
      var numCols = Math.min(visitSh.getLastColumn(), 12);
      visitSh.getRange(2, 1, visitSh.getLastRow() - 1, numCols).getValues().forEach(function(r) {
        if (!r[0]) return;
        var isDeleted = r[11] === true || r[11] === "TRUE";
        if (isDeleted) return;

        var visitDate = "";
        if (r[2]) {
          try { visitDate = Utilities.formatDate(new Date(r[2]), "Asia/Tokyo", "yyyy-MM-dd"); } catch(e) {}
        }
        if (!visitDate || visitDate.slice(0, 7) !== monthStr) return;

        var vk  = String(r[0]);
        var pay = paymentMap[vk] || null;
        var rec = receiptMap[vk] || null;

        // displayStatus 判定（getDailyCheckoutList と同一ロジック）
        var displayStatus;
        if (!pay)                                                { displayStatus = "未会計"; }
        else if (pay.paymentStatus === "未収")                  { displayStatus = "未収"; }
        else if (pay.paymentStatus === "一部入金")              { displayStatus = "一部入金"; }
        else if (pay.paymentStatus === "入金済" && !rec)        { displayStatus = "入金済（領収書未発行）"; }
        else                                                     { displayStatus = "領収書発行済"; }

        if (!days[visitDate]) {
          days[visitDate] = {
            date: visitDate, visitCount: 0,
            unbilledCount: 0, unpaidCount: 0, partialCount: 0,
            paidNoReceiptCount: 0, issuedCount: 0,
            totalBilled: 0, totalPaid: 0, totalRemaining: 0
          };
        }
        var d = days[visitDate];
        d.visitCount++;
        if      (displayStatus === "未会計")                   { d.unbilledCount++;     }
        else if (displayStatus === "未収")                     { d.unpaidCount++;       }
        else if (displayStatus === "一部入金")                 { d.partialCount++;      }
        else if (displayStatus === "入金済（領収書未発行）")   { d.paidNoReceiptCount++; }
        else                                                   { d.issuedCount++;       }
        d.totalBilled    += (pay ? (Number(pay.totalTaxInc)     || 0) : 0);
        d.totalPaid      += (pay ? (Number(pay.paidAmount)      || 0) : 0);
        d.totalRemaining += (pay ? (Number(pay.remainingAmount) || 0) : 0);
      });
    }

    // ── 月次サマリーを集計 ────────────────────────────────────
    var summary = {
      visitCount: 0, unbilledCount: 0, unpaidCount: 0, partialCount: 0,
      paidNoReceiptCount: 0, issuedCount: 0,
      totalBilled: 0, totalPaid: 0, totalRemaining: 0
    };
    Object.keys(days).forEach(function(date) {
      var d = days[date];
      summary.visitCount        += d.visitCount;
      summary.unbilledCount     += d.unbilledCount;
      summary.unpaidCount       += d.unpaidCount;
      summary.partialCount      += d.partialCount;
      summary.paidNoReceiptCount += d.paidNoReceiptCount;
      summary.issuedCount       += d.issuedCount;
      summary.totalBilled       += d.totalBilled;
      summary.totalPaid         += d.totalPaid;
      summary.totalRemaining    += d.totalRemaining;
    });

    Logger.log("[getMonthlyRevenueSummary] " + monthStr +
      " visits=" + summary.visitCount + " billed=¥" + summary.totalBilled);
    return { ok: true, year: y, month: m, summary: summary, days: days };

  } catch(err) {
    var em = err && err.message ? err.message : String(err);
    Logger.log("[getMonthlyRevenueSummary] ERROR: " + em);
    return { ok: false, year: year, month: month, error: em, summary: {}, days: {} };
  }
}
