"use strict";

// SPREADSHEET_ID, SHEET_NAMES, getTargetSpreadsheet_: defined in JREC_SF01_Setup.gs
// appendRunLog_: defined in JREC_SF01_Patient.gs

/**
 * 指定患者の来院履歴を降順で返す。isDeleted フィールドを含む。
 * col 12: isDeleted / col 13: deletedAt / col 14: deleteReason
 * 列が未追加（11列以下）の場合は isDeleted=false として扱う。
 */
function getVisitsByPatient(patientId) {
  var ss = getTargetSpreadsheet_();
  var sh = ss.getSheetByName(SHEET_NAMES.VISITS);
  if (!sh || sh.getLastRow() < 2) return [];

  var numCols = Math.min(sh.getLastColumn(), 14);
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, numCols).getValues();
  var results = [];
  rows.forEach(function(r) {
    if (!r[0] || String(r[1]) !== String(patientId)) return;
    var visitDate = "";
    if (r[2]) {
      try { visitDate = Utilities.formatDate(new Date(r[2]), "Asia/Tokyo", "yyyy-MM-dd"); } catch(e) {}
    }
    var deletedAt = "";
    if (r[12]) {
      try { deletedAt = Utilities.formatDate(new Date(r[12]), "Asia/Tokyo", "yyyy-MM-dd"); } catch(e) {}
    }
    results.push({
      selfPayVisitKey: String(r[0]),
      patientId:       String(r[1]),
      visitDate:       visitDate,
      visitType:       r[3]  || "",
      practitioner:    r[4]  || "",
      chiefComplaint:  r[5]  || "",
      vas:             r[6] !== "" ? String(r[6]) : "",
      nextPlan:        r[7]  || "",
      billingStatus:   r[8]  || "未会計",
      isDeleted:       r[11] === true || r[11] === "TRUE",
      deletedAt:       deletedAt,
      deleteReason:    r[13] ? String(r[13]) : ""
    });
  });
  results.sort(function(a, b) { return b.visitDate.localeCompare(a.visitDate); });
  return results;
}

/**
 * 指定 visitKey 群のカルテを { visitKey: chartObj } マップで返す。
 */
function getChartsByVisitKeys(visitKeys) {
  if (!visitKeys || visitKeys.length === 0) return {};
  var ss = getTargetSpreadsheet_();
  var sh = ss.getSheetByName(SHEET_NAMES.CHART);
  if (!sh || sh.getLastRow() < 2) return {};

  var keySet = {};
  visitKeys.forEach(function(k) { keySet[k] = true; });

  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 12).getValues();
  var result = {};
  rows.forEach(function(r) {
    var vk = String(r[1]);
    if (!keySet[vk]) return;
    result[vk] = {
      chartId:          String(r[0]),
      selfPayVisitKey:  vk,
      assessment:       r[2]  || "",
      findings:         r[3]  || "",
      treatment:        r[4]  || "",
      equipment:        r[5]  || "",
      explanation:      r[6]  || "",
      contraindication: r[7]  || "",
      lifestyle:        r[8]  || "",
      nextAppointment:  r[9]  || ""
    };
  });
  return result;
}

/**
 * 来院 + カルテを統合したタイムラインを返す（降順）。isDeleted=TRUE は除外。
 */
function getVisitTimelineByPatient(patientId) {
  var visits = getVisitsByPatient(patientId).filter(function(v) { return !v.isDeleted; });
  if (visits.length === 0) return [];
  var charts = getChartsByVisitKeys(visits.map(function(v) { return v.selfPayVisitKey; }));
  return visits.map(function(v) {
    return { visit: v, chart: charts[v.selfPayVisitKey] || null };
  });
}

/**
 * 来院 + カルテを統合し、アクティブとゴミ箱の両方を返す。
 * @param {string} patientId
 * @returns {{ timeline: Array, deletedTimeline: Array }}
 */
function getFullVisitTimelineByPatient(patientId) {
  var visits  = getVisitsByPatient(patientId);
  var active  = visits.filter(function(v) { return !v.isDeleted; });
  var deleted = visits.filter(function(v) { return  v.isDeleted; });
  var charts  = getChartsByVisitKeys(visits.map(function(v) { return v.selfPayVisitKey; }));
  return {
    timeline: active.map(function(v) {
      return { visit: v, chart: charts[v.selfPayVisitKey] || null };
    }),
    deletedTimeline: deleted.map(function(v) {
      return { visit: v, chart: charts[v.selfPayVisitKey] || null };
    })
  };
}

/**
 * 来院記録をゴミ箱に移動する（論理削除 — 来院履歴を非表示にする）。
 * Payments / Receipts / DailySales は変更しない。
 * 支払い状態にかかわらずゴミ箱移動を許可する。
 * @param {string} visitKey
 * @param {string=} reason
 * @returns {{ ok: boolean, visitKey?: string, error?: string }}
 */
function trashVisit(visitKey, reason) {
  Logger.log("[trashVisit] START visitKey=" + visitKey);
  try {
    if (!visitKey) return { ok: false, error: "visitKey は必須です" };
    visitKey = String(visitKey);
    var ss   = getTargetSpreadsheet_();

    var visitSh = ss.getSheetByName(SHEET_NAMES.VISITS);
    if (!visitSh || visitSh.getLastRow() < 2)
      return { ok: false, error: "SelfPayVisits シートが見つかりません" };

    var keys = visitSh.getRange(2, 1, visitSh.getLastRow() - 1, 1).getValues();
    for (var vi = 0; vi < keys.length; vi++) {
      if (String(keys[vi][0]) !== visitKey) continue;
      var rowNum = vi + 2;
      var now    = new Date();
      visitSh.getRange(rowNum, 12).setValue(true);
      visitSh.getRange(rowNum, 13).setValue(now);
      visitSh.getRange(rowNum, 14).setValue(reason ? String(reason).trim() : "");
      Logger.log("[trashVisit] row " + rowNum + " → isDeleted=true");
      appendRunLog_("VISIT_TRASH", visitKey.split("_")[2] || visitKey,
        "visitKey: " + visitKey + (reason ? " reason: " + reason : ""),
        visitKey);
      return { ok: true, visitKey: visitKey };
    }
    return { ok: false, error: "来院記録が見つかりません: " + visitKey };

  } catch (err) {
    var m = err && err.message ? err.message : String(err);
    Logger.log("[trashVisit] ERROR: " + m);
    return { ok: false, error: m };
  }
}

/**
 * ゴミ箱の来院記録を復元する（isDeleted=FALSE に戻す）。
 * @param {string} visitKey
 * @returns {{ ok: boolean, visitKey?: string, error?: string }}
 */
function restoreVisit(visitKey) {
  Logger.log("[restoreVisit] START visitKey=" + visitKey);
  try {
    if (!visitKey) return { ok: false, error: "visitKey は必須です" };
    visitKey = String(visitKey);
    var ss   = getTargetSpreadsheet_();

    var visitSh = ss.getSheetByName(SHEET_NAMES.VISITS);
    if (!visitSh || visitSh.getLastRow() < 2)
      return { ok: false, error: "SelfPayVisits シートが見つかりません" };

    var numCols = Math.min(visitSh.getLastColumn(), 12);
    var rows    = visitSh.getRange(2, 1, visitSh.getLastRow() - 1, numCols).getValues();
    for (var vi = 0; vi < rows.length; vi++) {
      if (String(rows[vi][0]) !== visitKey) continue;
      var rowNum    = vi + 2;
      var isDeleted = rows[vi][11] === true || rows[vi][11] === "TRUE";
      if (!isDeleted)
        return { ok: false, error: "この来院記録はゴミ箱に入っていません。" };
      visitSh.getRange(rowNum, 12).setValue(false);
      visitSh.getRange(rowNum, 13).setValue("");
      visitSh.getRange(rowNum, 14).setValue("");
      Logger.log("[restoreVisit] row " + rowNum + " → restored");
      appendRunLog_("VISIT_RESTORE", visitKey.split("_")[2] || visitKey,
        "visitKey: " + visitKey, visitKey);
      return { ok: true, visitKey: visitKey };
    }
    return { ok: false, error: "来院記録が見つかりません: " + visitKey };

  } catch (err) {
    var m = err && err.message ? err.message : String(err);
    Logger.log("[restoreVisit] ERROR: " + m);
    return { ok: false, error: m };
  }
}

/**
 * 来院レコードとカルテレコードを同時に保存する。
 * @param {Object} payload
 * @returns {{ ok, selfPayVisitKey?, chartId?, error? }}
 */
function createVisitWithChart(payload) {
  Logger.log("[createVisitWithChart] START patientId=" + (payload && payload.patientId));
  // ── バリデーション ───────────────────────────────────────
  try {
    if (!payload || !payload.patientId)  return { ok: false, error: "patientId は必須です" };
    if (!payload.visitDate)              return { ok: false, error: "来院日は必須です" };
    var cc = payload.chiefComplaint ? String(payload.chiefComplaint).trim() : "";
    if (!cc)                             return { ok: false, error: "主訴は必須です" };

    var vas = "";
    var vasRaw = payload.vas;
    if (vasRaw !== "" && vasRaw !== null && vasRaw !== undefined) {
      var vasNum = parseInt(String(vasRaw), 10);
      if (isNaN(vasNum) || vasNum < 0 || vasNum > 10) {
        return { ok: false, error: "VAS は 0〜10 の整数で入力してください（入力値: " + vasRaw + "）" };
      }
      vas = vasNum;
    }
    Logger.log("[createVisitWithChart] validation OK cc=" + cc + " vas=" + vas);

    // ── スプレッドシート取得 ─────────────────────────────────
    var ss  = getTargetSpreadsheet_();
    Logger.log("[createVisitWithChart] ss OK id=" + ss.getId());
    var now = new Date();

    // ── selfPayVisitKey 採番 ─────────────────────────────────
    var vk      = generateSelfPayVisitKey_(payload.patientId, payload.visitDate);
    var chartId = vk.replace(/^SPV_/, "SPC_");
    Logger.log("[createVisitWithChart] vk=" + vk + " patientId=" + payload.patientId);

    // ── SelfPayVisits に保存 ─────────────────────────────────
    var vSh = ss.getSheetByName(SHEET_NAMES.VISITS);
    if (!vSh) return { ok: false, error: "シート SelfPayVisits が見つかりません" };
    vSh.appendRow([
      vk,
      payload.patientId,
      payload.visitDate,
      payload.visitType    ? String(payload.visitType).trim()    : "再診",
      getDefaultPractitioner_(),
      cc,
      vas,
      payload.nextPlan     ? String(payload.nextPlan).trim()     : "",
      "未会計",
      now,
      now,
      false,  // col12: isDeleted
      "",     // col13: deletedAt
      "",     // col14: deleteReason
      payload.injuryTrigger      ? String(payload.injuryTrigger).trim()      : "",
      payload.relatedHistoryNote ? String(payload.relatedHistoryNote).trim() : ""
    ]);
    Logger.log("[createVisitWithChart] SelfPayVisits 保存完了");

    // ── SelfPayChart に保存 ──────────────────────────────────
    var cSh = ss.getSheetByName(SHEET_NAMES.CHART);
    if (!cSh) return { ok: false, error: "シート SelfPayChart が見つかりません" };
    cSh.appendRow([
      chartId,
      vk,
      payload.assessment       ? String(payload.assessment).trim()       : "",
      payload.findings         ? String(payload.findings).trim()         : "",
      payload.treatment        ? String(payload.treatment).trim()        : "",
      payload.equipment        ? String(payload.equipment).trim()        : "",
      payload.explanation      ? String(payload.explanation).trim()      : "",
      payload.contraindication ? String(payload.contraindication).trim() : "",
      payload.lifestyle        ? String(payload.lifestyle).trim()        : "",
      payload.nextAppointment  ? String(payload.nextAppointment).trim()  : "",
      now,
      now
    ]);
    Logger.log("[createVisitWithChart] SelfPayChart 保存完了");

    // ── Run_Log ─────────────────────────────────────────────
    appendRunLog_("VISIT_CREATE", payload.patientId, "visitKey: " + vk, vk);

    return { ok: true, selfPayVisitKey: vk, chartId: chartId };

  } catch(err) {
    var errMsg = (err && err.message) ? err.message : String(err);
    Logger.log("[createVisitWithChart] ERROR: " + errMsg);
    return { ok: false, error: errMsg };
  }
}

/**
 * 既存の来院記録とカルテを更新する（visitKey を変えずに内容を上書き）。
 * カルテ入力画面での再保存時に呼ばれる。会計状態は変更しない。
 *
 * @param {string} visitKey
 * @param {Object} payload - createVisitWithChart と同じ形式
 * @returns {{ ok: boolean, selfPayVisitKey?: string, error?: string }}
 */
function updateVisitWithChart(visitKey, payload) {
  Logger.log("[updateVisitWithChart] START visitKey=" + visitKey);
  try {
    if (!visitKey) return { ok: false, error: "visitKey は必須です" };
    var cc = payload && payload.chiefComplaint ? String(payload.chiefComplaint).trim() : "";
    if (!cc) return { ok: false, error: "主訴は必須です" };

    var ss  = getTargetSpreadsheet_();
    var now = new Date();

    // ── SelfPayVisits を更新（会計状態・isDeleted 列は変更しない）──
    var visitSh = ss.getSheetByName(SHEET_NAMES.VISITS);
    if (!visitSh || visitSh.getLastRow() < 2)
      return { ok: false, error: "SelfPayVisits シートが見つかりません" };

    var vKeys      = visitSh.getRange(2, 1, visitSh.getLastRow() - 1, 1).getValues();
    var visitFound = false;
    for (var vi = 0; vi < vKeys.length; vi++) {
      if (String(vKeys[vi][0]) !== visitKey) continue;
      var rowNum = vi + 2;
      var vas    = "";
      if (payload.vas !== "" && payload.vas !== null && payload.vas !== undefined) {
        var vasNum = parseInt(String(payload.vas), 10);
        if (!isNaN(vasNum) && vasNum >= 0 && vasNum <= 10) vas = vasNum;
      }
      visitSh.getRange(rowNum, 3).setValue(payload.visitDate  || "");
      visitSh.getRange(rowNum, 4).setValue(payload.visitType  || "再診");
      visitSh.getRange(rowNum, 5).setValue(getDefaultPractitioner_());
      visitSh.getRange(rowNum, 6).setValue(cc);
      visitSh.getRange(rowNum, 7).setValue(vas);
      visitSh.getRange(rowNum, 8).setValue(payload.nextPlan ? String(payload.nextPlan).trim() : "");
      visitSh.getRange(rowNum, 11).setValue(now);  // updatedAt
      visitSh.getRange(rowNum, 15).setValue(payload.injuryTrigger      ? String(payload.injuryTrigger).trim()      : "");
      visitSh.getRange(rowNum, 16).setValue(payload.relatedHistoryNote ? String(payload.relatedHistoryNote).trim() : "");
      visitFound = true;
      Logger.log("[updateVisitWithChart] SelfPayVisits row " + rowNum + " updated");
      break;
    }
    if (!visitFound) return { ok: false, error: "来院記録が見つかりません: " + visitKey };

    // ── SelfPayChart を更新（なければ新規追加）────────────
    var chartSh = ss.getSheetByName(SHEET_NAMES.CHART);
    if (chartSh) {
      var chartFound = false;
      if (chartSh.getLastRow() >= 2) {
        var cData = chartSh.getRange(2, 1, chartSh.getLastRow() - 1, 2).getValues();
        for (var ci = 0; ci < cData.length; ci++) {
          if (String(cData[ci][1]) !== visitKey) continue;
          var crow = ci + 2;
          chartSh.getRange(crow, 3).setValue(payload.assessment       ? String(payload.assessment).trim()       : "");
          chartSh.getRange(crow, 4).setValue(payload.findings         ? String(payload.findings).trim()         : "");
          chartSh.getRange(crow, 5).setValue(payload.treatment        ? String(payload.treatment).trim()        : "");
          chartSh.getRange(crow, 6).setValue(payload.equipment        ? String(payload.equipment).trim()        : "");
          chartSh.getRange(crow, 7).setValue(payload.explanation      ? String(payload.explanation).trim()      : "");
          chartSh.getRange(crow, 8).setValue(payload.contraindication ? String(payload.contraindication).trim() : "");
          chartSh.getRange(crow, 9).setValue(payload.lifestyle        ? String(payload.lifestyle).trim()        : "");
          chartSh.getRange(crow, 10).setValue(payload.nextAppointment ? String(payload.nextAppointment).trim()  : "");
          chartSh.getRange(crow, 12).setValue(now);  // updatedAt
          chartFound = true;
          Logger.log("[updateVisitWithChart] SelfPayChart row " + crow + " updated");
          break;
        }
      }
      if (!chartFound) {
        var chartId = visitKey.replace(/^SPV_/, "SPC_");
        chartSh.appendRow([
          chartId, visitKey,
          payload.assessment       ? String(payload.assessment).trim()       : "",
          payload.findings         ? String(payload.findings).trim()         : "",
          payload.treatment        ? String(payload.treatment).trim()        : "",
          payload.equipment        ? String(payload.equipment).trim()        : "",
          payload.explanation      ? String(payload.explanation).trim()      : "",
          payload.contraindication ? String(payload.contraindication).trim() : "",
          payload.lifestyle        ? String(payload.lifestyle).trim()        : "",
          payload.nextAppointment  ? String(payload.nextAppointment).trim()  : "",
          now, now
        ]);
        Logger.log("[updateVisitWithChart] SelfPayChart new row appended");
      }
    }

    var pidForLog = visitKey.split("_")[2] || visitKey;
    appendRunLog_("VISIT_UPDATE", pidForLog, "visitKey: " + visitKey, visitKey);

    return { ok: true, selfPayVisitKey: visitKey };

  } catch (err) {
    var m = err && err.message ? err.message : String(err);
    Logger.log("[updateVisitWithChart] ERROR: " + m);
    return { ok: false, error: m };
  }
}

/**
 * カルテ編集用: 来院レコード + カルテレコードを 1 件取得して返す。
 * isDeleted=true の場合はエラーを返す（通常編集不可）。
 * @param {string} patientId
 * @param {string} visitKey
 * @returns {{ ok: boolean, data?: Object, error?: string }}
 */
function getVisitFormData(patientId, visitKey) {
  Logger.log("[getVisitFormData] patientId=" + patientId + " visitKey=" + visitKey);
  try {
    if (!visitKey) return { ok: false, error: "visitKey は必須です" };

    var ss = getTargetSpreadsheet_();

    var visitSh = ss.getSheetByName(SHEET_NAMES.VISITS);
    if (!visitSh || visitSh.getLastRow() < 2)
      return { ok: false, error: "SelfPayVisits シートが見つかりません" };

    var numCols  = Math.min(visitSh.getLastColumn(), 16);
    var rows     = visitSh.getRange(2, 1, visitSh.getLastRow() - 1, numCols).getValues();
    var visitRow = null;
    for (var i = 0; i < rows.length; i++) {
      if (String(rows[i][0]) === visitKey) { visitRow = rows[i]; break; }
    }
    if (!visitRow) return { ok: false, error: "来院記録が見つかりません: " + visitKey };

    var isDeleted = visitRow[11] === true || visitRow[11] === "TRUE";
    if (isDeleted) return { ok: false, error: "この来院記録はゴミ箱に入っています。復元後に編集してください。" };

    var visitDate = "";
    if (visitRow[2]) {
      try { visitDate = Utilities.formatDate(new Date(visitRow[2]), "Asia/Tokyo", "yyyy-MM-dd"); } catch(e) {}
    }

    var data = {
      selfPayVisitKey:    visitKey,
      patientId:          String(visitRow[1]),
      visitDate:          visitDate,
      visitType:          visitRow[3] || "再診",
      chiefComplaint:     visitRow[5] || "",
      vas:                visitRow[6] !== "" ? String(visitRow[6]) : "",
      nextPlan:           visitRow[7] || "",
      billingStatus:      visitRow[8] || "未会計",
      injuryTrigger:      visitRow[14] || "",
      relatedHistoryNote: visitRow[15] || "",
      assessment:         "",
      findings:           "",
      treatment:          "",
      equipment:          "",
      explanation:        "",
      contraindication:   "",
      lifestyle:          "",
      nextAppointment:    ""
    };

    var chartSh = ss.getSheetByName(SHEET_NAMES.CHART);
    if (chartSh && chartSh.getLastRow() >= 2) {
      var cRows = chartSh.getRange(2, 1, chartSh.getLastRow() - 1, 12).getValues();
      for (var ci = 0; ci < cRows.length; ci++) {
        if (String(cRows[ci][1]) !== visitKey) continue;
        data.assessment       = cRows[ci][2]  || "";
        data.findings         = cRows[ci][3]  || "";
        data.treatment        = cRows[ci][4]  || "";
        data.equipment        = cRows[ci][5]  || "";
        data.explanation      = cRows[ci][6]  || "";
        data.contraindication = cRows[ci][7]  || "";
        data.lifestyle        = cRows[ci][8]  || "";
        data.nextAppointment  = cRows[ci][9]  || "";
        break;
      }
    }

    return { ok: true, data: data };

  } catch (err) {
    var m = err && err.message ? err.message : String(err);
    Logger.log("[getVisitFormData] ERROR: " + m);
    return { ok: false, error: m };
  }
}

/**
 * Phase Chart-Ref-1: 当該来院に対する 初回カルテ / 前回カルテ の参照データを返す。
 * 自動コピーはしない。read-only 表示用。
 *
 * - 初回: 同一 patientId / isDeleted=false の中で visitDate 最古
 * - 前回: 当該 currentVisitKey より前の最新（編集モード）/ 全体の最新（新規モード）
 * - 編集モードで当該 visit が初回そのものの場合は firstVisit = null（自分自身を参照しない）
 * - first と previous が同一 visit になる場合は previous = null に collapse
 *
 * 返却は RPC-safe（toRpcSafeObject_ 経由・Date は文字列化）。
 *
 * @param {string} currentVisitKey 現在編集中の visitKey（新規モードは空文字）
 * @param {string} patientId       内部患者キー
 * @returns {{ ok: boolean, patientId: string, currentVisitKey: string,
 *            firstVisit: Object|null, previousVisit: Object|null, debug: Object }}
 */
function getChartReferencesForVisit(currentVisitKey, patientId) {
  var debug = {
    reason:                "",
    totalVisitsForPatient: 0,
    sortedVisitKeys:       [],
    isCurrentVisitInList:  false,
    error:                 ""
  };
  try {
    var pidStr = String(patientId      || '').trim();
    var curStr = String(currentVisitKey || '').trim();
    if (!pidStr) {
      debug.reason = "no patientId";
      return toRpcSafeObject_({ ok: true, patientId: "", currentVisitKey: curStr, firstVisit: null, previousVisit: null, debug: debug });
    }

    var ss = getTargetSpreadsheet_();
    var visitSh = ss.getSheetByName(SHEET_NAMES.VISITS);
    if (!visitSh || visitSh.getLastRow() < 2) {
      debug.reason = "visits sheet not found or empty";
      return toRpcSafeObject_({ ok: true, patientId: pidStr, currentVisitKey: curStr, firstVisit: null, previousVisit: null, debug: debug });
    }

    var numCols = Math.min(visitSh.getLastColumn(), 16);
    var visitRows = visitSh.getRange(2, 1, visitSh.getLastRow() - 1, numCols).getValues();

    // 同一 patientId / 非削除のみ抽出
    var pv = [];
    for (var i = 0; i < visitRows.length; i++) {
      var r = visitRows[i];
      if (String(r[1] || '').trim() !== pidStr) continue;
      var isDeleted = r[11] === true || r[11] === "TRUE";
      if (isDeleted) continue;
      pv.push({
        visitKey:           String(r[0] || ""),
        patientId:          pidStr,
        visitDateRaw:       r[2],
        visitType:          String(r[3] || ""),
        chiefComplaint:     String(r[5] || ""),
        vas:                (r[6] === "" || r[6] === null) ? "" : String(r[6]),
        nextPlan:           String(r[7] || ""),
        injuryTrigger:      String(r[14] || ""),
        relatedHistoryNote: String(r[15] || "")
      });
    }
    debug.totalVisitsForPatient = pv.length;

    if (pv.length === 0) {
      debug.reason = "no visits for patient";
      return toRpcSafeObject_({ ok: true, patientId: pidStr, currentVisitKey: curStr, firstVisit: null, previousVisit: null, debug: debug });
    }

    // visitDate 昇順、同一日は visitKey 昇順
    pv.sort(function(a, b) {
      var aMs = a.visitDateRaw ? new Date(a.visitDateRaw).getTime() : 0;
      var bMs = b.visitDateRaw ? new Date(b.visitDateRaw).getTime() : 0;
      if (aMs !== bMs) return aMs - bMs;
      return a.visitKey < b.visitKey ? -1 : (a.visitKey > b.visitKey ? 1 : 0);
    });
    debug.sortedVisitKeys = pv.map(function(v) { return v.visitKey; });

    var first = pv[0];
    var previous = null;

    if (curStr) {
      var curIdx = -1;
      for (var j = 0; j < pv.length; j++) {
        if (pv[j].visitKey === curStr) { curIdx = j; break; }
      }
      debug.isCurrentVisitInList = curIdx >= 0;
      // 編集モード: 当該より前の最新
      if (curIdx > 0) previous = pv[curIdx - 1];
      // 編集モードで当該が初回そのもの → firstVisit を出さない
      if (curIdx === 0) first = null;
    } else {
      // 新規モード: 過去 visit 全体の最新
      previous = pv[pv.length - 1];
    }

    // first と previous が同一なら previous を畳む（重複表示防止）
    if (first && previous && first.visitKey === previous.visitKey) previous = null;

    // SelfPayChart を visitKey でマップ化（必要な visit 分だけ後で引く）
    var chartSh = ss.getSheetByName(SHEET_NAMES.CHART);
    var chartMap = {};
    if (chartSh && chartSh.getLastRow() >= 2) {
      var chartRows = chartSh.getRange(2, 1, chartSh.getLastRow() - 1, 12).getValues();
      for (var ci = 0; ci < chartRows.length; ci++) {
        var cvk = String(chartRows[ci][1] || "").trim();
        if (!cvk) continue;
        chartMap[cvk] = {
          assessment:       String(chartRows[ci][2]  || ""),
          findings:         String(chartRows[ci][3]  || ""),
          treatment:        String(chartRows[ci][4]  || ""),
          equipment:        String(chartRows[ci][5]  || ""),
          explanation:      String(chartRows[ci][6]  || ""),
          contraindication: String(chartRows[ci][7]  || ""),
          lifestyle:        String(chartRows[ci][8]  || ""),
          nextAppointment:  String(chartRows[ci][9]  || "")
        };
      }
    }

    function _toIsoDate(d) {
      if (!d) return "";
      try {
        if (d instanceof Date) return Utilities.formatDate(d, "Asia/Tokyo", "yyyy-MM-dd");
        return String(d);
      } catch (e) { return ""; }
    }

    function _attach(v) {
      if (!v) return null;
      var c = chartMap[v.visitKey] || {};
      return {
        visitKey:           v.visitKey,
        visitDate:          _toIsoDate(v.visitDateRaw),
        visitType:          v.visitType,
        chiefComplaint:     v.chiefComplaint,
        vas:                v.vas,
        nextPlan:           v.nextPlan,
        injuryTrigger:      v.injuryTrigger,
        relatedHistoryNote: v.relatedHistoryNote,
        chart: {
          assessment:       c.assessment       || "",
          findings:         c.findings         || "",
          treatment:        c.treatment        || "",
          equipment:        c.equipment        || "",
          explanation:      c.explanation      || "",
          contraindication: c.contraindication || "",
          lifestyle:        c.lifestyle        || "",
          nextAppointment:  c.nextAppointment  || ""
        }
      };
    }

    var firstOut    = _attach(first);
    var previousOut = _attach(previous);

    debug.reason = "ok";
    Logger.log("[getChartReferencesForVisit] patient=" + pidStr +
               " current=" + curStr +
               " total=" + debug.totalVisitsForPatient +
               " first=" + (firstOut ? firstOut.visitKey : "none") +
               " previous=" + (previousOut ? previousOut.visitKey : "none"));
    return toRpcSafeObject_({
      ok: true,
      patientId: pidStr,
      currentVisitKey: curStr,
      firstVisit: firstOut,
      previousVisit: previousOut,
      debug: debug
    });
  } catch (e) {
    debug.reason = "exception";
    debug.error  = e && e.message ? String(e.message) : String(e);
    Logger.log("[getChartReferencesForVisit] ERROR: " + debug.error);
    return toRpcSafeObject_({
      ok: true,
      patientId: String(patientId || ""),
      currentVisitKey: String(currentVisitKey || ""),
      firstVisit: null,
      previousVisit: null,
      debug: debug
    });
  }
}

/**
 * selfPayVisitKey を採番する: SPV_YYYYMMDD_patientId_001
 */
function generateSelfPayVisitKey_(patientId, visitDate) {
  var dateStr = visitDate.replace(/-/g, "");
  var prefix  = "SPV_" + dateStr + "_" + patientId + "_";

  var ss     = getTargetSpreadsheet_();
  var sh     = ss.getSheetByName(SHEET_NAMES.VISITS);
  var maxSeq = 0;

  if (sh && sh.getLastRow() >= 2) {
    sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(function(r) {
      var key = String(r[0]);
      if (key.indexOf(prefix) === 0) {
        var seq = parseInt(key.slice(prefix.length), 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      }
    });
  }
  return prefix + String(maxSeq + 1).padStart(3, "0");
}

/**
 * Settings.default_practitioner を読む。なければ "院長" を返す。
 */
function getDefaultPractitioner_() {
  try {
    var ss   = getTargetSpreadsheet_();
    var stSh = ss.getSheetByName(SHEET_NAMES.SETTINGS);
    if (stSh && stSh.getLastRow() >= 2) {
      var st = stSh.getRange(2, 1, stSh.getLastRow() - 1, 2).getValues();
      for (var i = 0; i < st.length; i++) {
        if (st[i][0] === "default_practitioner") return String(st[i][1]);
      }
    }
  } catch(e) {}
  return "院長";
}
