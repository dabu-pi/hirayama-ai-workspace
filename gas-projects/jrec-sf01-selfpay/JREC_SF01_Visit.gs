"use strict";

// SPREADSHEET_ID, SHEET_NAMES, getTargetSpreadsheet_: defined in JREC_SF01_Setup.gs
// appendRunLog_: defined in JREC_SF01_Patient.gs

/**
 * 指定患者の来院履歴を降順で返す。
 */
function getVisitsByPatient(patientId) {
  var ss = getTargetSpreadsheet_();
  var sh = ss.getSheetByName(SHEET_NAMES.VISITS);
  if (!sh || sh.getLastRow() < 2) return [];

  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 11).getValues();
  var results = [];
  rows.forEach(function(r) {
    if (!r[0] || String(r[1]) !== String(patientId)) return;
    var visitDate = "";
    if (r[2]) {
      try { visitDate = Utilities.formatDate(new Date(r[2]), "Asia/Tokyo", "yyyy-MM-dd"); } catch(e) {}
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
      billingStatus:   r[8]  || "未会計"
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
 * 来院 + カルテを統合したタイムラインを返す（降順）。
 */
function getVisitTimelineByPatient(patientId) {
  var visits = getVisitsByPatient(patientId);
  if (visits.length === 0) return [];
  var charts = getChartsByVisitKeys(visits.map(function(v) { return v.selfPayVisitKey; }));
  return visits.map(function(v) {
    return { visit: v, chart: charts[v.selfPayVisitKey] || null };
  });
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
