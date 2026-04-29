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
      now
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
