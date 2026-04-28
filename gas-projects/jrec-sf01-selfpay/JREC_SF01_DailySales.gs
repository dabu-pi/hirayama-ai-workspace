"use strict";

// SPREADSHEET_ID, SHEET_NAMES, getTargetSpreadsheet_: defined in JREC_SF01_Setup.gs

// ============================================================
// Phase 5-A — 日次売上集計
// ============================================================

/**
 * 指定日の自費会計日次集計を返す。
 *
 * ─── 集計定義 ─────────────────────────────────────────────────
 *
 * totalSales         = paymentSaveTotal + paymentCollectTotal
 *                      当日に入金が確定した売上の合計（税込）
 *
 * paymentSaveTotal   = 当日 PAYMENT_SAVE かつ paymentStatus=入金済 の totalTaxInc 合計
 *                      新規会計入力で当日に現金/カード等で支払われた分
 *
 * paymentCollectTotal= 当日 PAYMENT_COLLECT の totalTaxInc 合計
 *                      過去の未収分を当日に回収した分
 *
 * unpaidTotal        = 現在時点の paymentStatus=未収/一部入金 の totalTaxInc 合計
 *                      ※日付非依存（現在スナップショット）
 *
 * visitCount         = SelfPayVisits.来院日 = date の来院件数（会計状態問わず）
 *
 * mainVisitCount     = 主力メニュー SELFPAY_CONTINUE20 を含む来院件数（当日来院のみ）
 *                      ※固定値。将来は設定化を検討
 *
 * receiptIssuedCount = Receipts.発行日 = date の領収書発行件数
 *
 * ─── 売上日基準 ───────────────────────────────────────────────
 *   PAYMENT_SAVE    : Run_Log.timestamp の日付（会計入力日）
 *   PAYMENT_COLLECT : Run_Log.timestamp の日付（回収日）
 *
 * ─── 二重計上防止 ─────────────────────────────────────────────
 *   Run_Log を正本として使う。同一 visitKey の同一 action は1件のみ集計。
 *   Run_Log.selfPayVisitKey が空の行（修正前の古いログ）は warnings に分類し集計除外。
 *
 * ─── 既知の制限 ───────────────────────────────────────────────
 *   - unpaidTotal は現在時点の状態。過去日付時点の残高履歴は未実装。
 *   - 修正前の Run_Log（selfPayVisitKey 空）は集計対象外。
 *   - mainVisitCount は SELFPAY_CONTINUE20 固定（外販時は設定化を推奨）。
 *
 * @param {string} dateStr "YYYY-MM-DD" 形式の日付文字列
 * @returns {{
 *   ok: boolean,
 *   date: string,
 *   totalSales: number,
 *   paymentSaveTotal: number,
 *   paymentCollectTotal: number,
 *   unpaidTotal: number,
 *   visitCount: number,
 *   mainVisitCount: number,
 *   receiptIssuedCount: number,
 *   rows: Array<{
 *     visitKey, patientId, patientName, visitDate, salesDate,
 *     action, amount, paymentStatus, paymentMethod, receiptNo, detail
 *   }>,
 *   warnings: Array<{ type, action?, visitKey?, detail?, note }>,
 *   error?: string
 * }}
 */
function getDailySalesReport(dateStr) {
  Logger.log("[getDailySalesReport] START date=" + dateStr);
  try {
    // ── 日付の正規化（JST）────────────────────────────────────
    if (!dateStr) return { ok: false, error: "date は必須です（YYYY-MM-DD 形式）" };
    var targetDate = normalizeDate_(dateStr);
    if (!targetDate) return { ok: false, error: "日付の形式が不正です: " + dateStr };
    Logger.log("[getDailySalesReport] targetDate=" + targetDate);

    var ss = getTargetSpreadsheet_();

    // ── (1) Payments 全件インデックス ─────────────────────────
    // 列: paymentId / selfPayVisitKey / 税別 / 税額 / 税込 / 支払方法 / 入金状態 / 入金日 / メモ / createdAt
    var paymentsMap = {};
    var unpaidTotal = 0;
    var paymentSh = ss.getSheetByName(SHEET_NAMES.PAYMENTS);
    if (paymentSh && paymentSh.getLastRow() >= 2) {
      paymentSh.getRange(2, 1, paymentSh.getLastRow() - 1, 10).getValues()
        .forEach(function(r) {
          if (!r[0] || !r[1]) return;
          var vk     = String(r[1]);
          var status = r[6] || "";
          paymentsMap[vk] = {
            paymentId:     String(r[0]),
            totalTaxEx:    r[2] || 0,
            totalTaxAmt:   r[3] || 0,
            totalTaxInc:   r[4] || 0,
            paymentMethod: r[5] || "",
            paymentStatus: status,
            paymentDate:   r[7] ? toDateStr_(r[7]) : "",
            memo:          r[8] || ""
          };
          if (status === "未収" || status === "一部入金") unpaidTotal += (r[4] || 0);
        });
    }

    // ── (2) Patients インデックス（patientName 用）────────────
    // 列: patientId / 氏名 / ...
    var patientsMap = {};
    var patientSh = ss.getSheetByName(SHEET_NAMES.PATIENTS);
    if (patientSh && patientSh.getLastRow() >= 2) {
      patientSh.getRange(2, 1, patientSh.getLastRow() - 1, 2).getValues()
        .forEach(function(r) {
          if (r[0]) patientsMap[String(r[0])] = r[1] || "";
        });
    }

    // ── (3) SelfPayVisits インデックス + visitCount ──────────
    // 列: selfPayVisitKey / patientId / 来院日 / ... / 会計状態
    var visitMap   = {};
    var visitCount = 0;
    var visitSh = ss.getSheetByName(SHEET_NAMES.VISITS);
    if (visitSh && visitSh.getLastRow() >= 2) {
      visitSh.getRange(2, 1, visitSh.getLastRow() - 1, 9).getValues()
        .forEach(function(r) {
          if (!r[0]) return;
          var vk = String(r[0]);
          var vd = r[2] ? toDateStr_(r[2]) : "";
          visitMap[vk] = {
            patientId:     String(r[1]),
            visitDate:     vd,
            billingStatus: r[8] || ""
          };
          if (vd === targetDate) visitCount++;
        });
    }

    // ── (4) SelfPayItems → mainVisitCount ────────────────────
    // 列: itemId / selfPayVisitKey / menuCode / ...
    // 主力メニューコード（外販時は Settings から取得することを推奨）
    var MAIN_MENU_CODE = "SELFPAY_CONTINUE20";
    var mainVisitKeys  = {};
    var itemSh = ss.getSheetByName(SHEET_NAMES.ITEMS);
    if (itemSh && itemSh.getLastRow() >= 2) {
      itemSh.getRange(2, 1, itemSh.getLastRow() - 1, 3).getValues()
        .forEach(function(r) {
          if (!r[1] || String(r[2]) !== MAIN_MENU_CODE) return;
          var vk   = String(r[1]);
          var info = visitMap[vk];
          if (info && info.visitDate === targetDate) mainVisitKeys[vk] = true;
        });
    }
    var mainVisitCount = Object.keys(mainVisitKeys).length;

    // ── (5) Receipts インデックス ─────────────────────────────
    // 列: receiptId / selfPayVisitKey / receiptNo / 発行日
    var receiptsMap        = {};
    var receiptIssuedCount = 0;
    var receiptSh = ss.getSheetByName(SHEET_NAMES.RECEIPTS);
    if (receiptSh && receiptSh.getLastRow() >= 2) {
      receiptSh.getRange(2, 1, receiptSh.getLastRow() - 1, 4).getValues()
        .forEach(function(r) {
          if (!r[0] || !r[1]) return;
          var vk = String(r[1]);
          if (!receiptsMap[vk]) receiptsMap[vk] = String(r[2]);
          var rd = r[3] ? toDateStr_(r[3]) : "";
          if (rd === targetDate) receiptIssuedCount++;
        });
    }

    // ── (6) Run_Log を対象日でフィルタリング → rows / warnings ─
    // 列: timestamp / action / selfPayVisitKey / patientId / result / detail / operator
    var rows                = [];
    var warnings            = [];
    var paymentSaveTotal    = 0;
    var paymentCollectTotal = 0;
    var seenAmountKeys      = {};   // "ACTION_visitKey" → 二重計上防止

    var runLogSh = ss.getSheetByName(SHEET_NAMES.RUN_LOG);
    if (runLogSh && runLogSh.getLastRow() >= 2) {
      runLogSh.getRange(2, 1, runLogSh.getLastRow() - 1, 7).getValues()
        .forEach(function(r) {
          var ts     = r[0];
          var action = r[1] ? String(r[1]).trim() : "";
          var vk     = r[2] ? String(r[2]).trim() : "";
          var pid    = r[3] ? String(r[3]).trim() : "";
          var detail = r[5] ? String(r[5]) : "";

          // PAYMENT_SAVE / PAYMENT_COLLECT のみ集計対象
          if (action !== "PAYMENT_SAVE" && action !== "PAYMENT_COLLECT") return;

          // ログの日付が対象日かチェック
          var logDate = ts ? toDateStr_(ts) : "";
          if (logDate !== targetDate) return;

          // selfPayVisitKey が空 → 修正前の古いログ → warnings
          if (!vk) {
            warnings.push({
              type:   "MISSING_VISIT_KEY",
              action: action,
              date:   logDate,
              detail: detail,
              note:   "Run_Log の selfPayVisitKey 列が空。Phase 5-A Step 0 修正前のログです。集計から除外しました。"
            });
            return;
          }

          // Payments に対応行があるか
          var payment = paymentsMap[vk];
          if (!payment) {
            warnings.push({
              type:     "PAYMENT_NOT_FOUND",
              action:   action,
              visitKey: vk,
              detail:   detail,
              note:     "Run_Log に visitKey はあるが Payments に対応行が見つかりません。"
            });
            return;
          }

          // PAYMENT_SAVE かつ paymentStatus が入金済でない → 未収として保存された会計。売上計上しない
          if (action === "PAYMENT_SAVE" && payment.paymentStatus !== "入金済") return;

          // 二重計上チェック（同一 visitKey + 同一 action が複数ある場合は最初の1件のみ）
          var amountKey = action + "_" + vk;
          if (seenAmountKeys[amountKey]) {
            warnings.push({
              type:     "DUPLICATE_LOG",
              action:   action,
              visitKey: vk,
              note:     "同一 visitKey の " + action + " が2件以上あります。最初の1件のみ集計しました。"
            });
            return;
          }
          seenAmountKeys[amountKey] = true;

          var amount   = payment.totalTaxInc || 0;
          var visit    = visitMap[vk];
          var patientId = visit ? visit.patientId : pid;

          if (action === "PAYMENT_SAVE") {
            paymentSaveTotal += amount;
          } else {
            paymentCollectTotal += amount;
          }

          rows.push({
            visitKey:      vk,
            patientId:     patientId,
            patientName:   patientsMap[patientId] || "",
            visitDate:     visit ? visit.visitDate : "",
            salesDate:     payment.paymentDate || targetDate,
            action:        action,
            amount:        amount,
            paymentStatus: payment.paymentStatus,
            paymentMethod: payment.paymentMethod,
            receiptNo:     receiptsMap[vk] || "",
            detail:        detail
          });
        });
    }

    var totalSales = paymentSaveTotal + paymentCollectTotal;

    Logger.log("[getDailySalesReport] DONE" +
      " totalSales=¥" + totalSales +
      " save=¥" + paymentSaveTotal +
      " collect=¥" + paymentCollectTotal +
      " unpaid=¥" + unpaidTotal +
      " visits=" + visitCount +
      " mainVisits=" + mainVisitCount +
      " receipts=" + receiptIssuedCount +
      " rows=" + rows.length +
      " warnings=" + warnings.length);

    return {
      ok:                  true,
      date:                targetDate,
      totalSales:          totalSales,
      paymentSaveTotal:    paymentSaveTotal,
      paymentCollectTotal: paymentCollectTotal,
      unpaidTotal:         unpaidTotal,
      visitCount:          visitCount,
      mainVisitCount:      mainVisitCount,
      receiptIssuedCount:  receiptIssuedCount,
      rows:                rows,
      warnings:            warnings
    };

  } catch(err) {
    var m = (err && err.message) ? err.message : String(err);
    Logger.log("[getDailySalesReport] ERROR: " + m);
    return { ok: false, error: m };
  }
}

/**
 * getDailySalesReport を実行してスプレッドシートの Logger に出力する。
 * Apps Script エディタから手動実行で動作確認するためのラッパー。
 * 確認後は削除せずに残してよい（本番では getDailySalesReport を直接使う）。
 *
 * 使い方: Apps Script エディタ → 関数選択「runDailySalesReport」→ 実行
 */
function runDailySalesReport() {
  var today = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd");
  var result = getDailySalesReport(today);
  Logger.log("=== DailySalesReport ===");
  Logger.log(JSON.stringify(result, null, 2));
}

// ============================================================
// プライベートヘルパー
// ============================================================

/**
 * 日付値を "YYYY-MM-DD" JST 文字列に正規化する。
 * "YYYY-MM-DD", "YYYYMMDD", Date オブジェクトを受け付ける。
 * 変換できない場合は null を返す。
 */
function normalizeDate_(val) {
  if (!val) return null;
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    try { return Utilities.formatDate(val, "Asia/Tokyo", "yyyy-MM-dd"); } catch(e) { return null; }
  }
  var s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{8}$/.test(s)) return s.slice(0, 4) + "-" + s.slice(4, 6) + "-" + s.slice(6, 8);
  var d = new Date(s);
  if (isNaN(d.getTime())) return null;
  try { return Utilities.formatDate(d, "Asia/Tokyo", "yyyy-MM-dd"); } catch(e) { return null; }
}

/**
 * Sheets から取得した Date / 日付文字列を "YYYY-MM-DD" JST 文字列に変換する。
 * 変換できない場合は空文字を返す。
 */
function toDateStr_(val) {
  if (!val) return "";
  if (typeof val === "string" && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) return val.trim();
  var d = (val instanceof Date) ? val : new Date(val);
  if (isNaN(d.getTime())) return "";
  try { return Utilities.formatDate(d, "Asia/Tokyo", "yyyy-MM-dd"); } catch(e) { return ""; }
}
