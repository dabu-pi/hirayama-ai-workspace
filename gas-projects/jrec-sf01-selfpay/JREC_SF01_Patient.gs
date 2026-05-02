"use strict";

// SPREADSHEET_ID, SHEET_NAMES, getTargetSpreadsheet_: defined in JREC_SF01_Setup.gs

/**
 * Patients シートの全患者を返す。query があれば氏名・フリガナ・患者ID・電話番号で絞り込む。
 * @param {string} query 検索文字列（省略可）
 * @returns {Object[]}
 */
function getPatients(query) {
  var ss = getTargetSpreadsheet_();
  var sh = ss.getSheetByName(SHEET_NAMES.PATIENTS);
  if (!sh || sh.getLastRow() < 2) return [];

  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 11).getValues();
  var q = query ? query.trim().toLowerCase() : "";

  var results = [];
  rows.forEach(function(r) {
    if (!r[0]) return;
    if (q) {
      var hay = [r[0], r[1], r[2], r[5]].join(" ").toLowerCase();
      if (hay.indexOf(q) === -1) return;
    }
    results.push({
      patientId:    String(r[0]),
      name:         r[1]  || "",
      kana:         r[2]  || "",
      phone:        r[5]  ? String(r[5]) : "",
      lastVisitDate: "",
      visitCount:   0,
      totalPaid:    0,
      outstanding:  0
    });
  });
  return results;
}

/**
 * patientId で1件取得する。見つからなければ null。
 * @param {string} patientId
 * @returns {Object|null}
 */
function getPatientById(patientId) {
  var ss = getTargetSpreadsheet_();
  var sh = ss.getSheetByName(SHEET_NAMES.PATIENTS);
  if (!sh || sh.getLastRow() < 2) return null;

  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 11).getValues();
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (String(r[0]) !== String(patientId)) continue;
    var dob = "";
    if (r[3]) {
      try { dob = Utilities.formatDate(new Date(r[3]), "Asia/Tokyo", "yyyy-MM-dd"); } catch (e) {}
    }
    var createdAt = "";
    if (r[9]) {
      try { createdAt = Utilities.formatDate(new Date(r[9]), "Asia/Tokyo", "yyyy-MM-dd"); } catch (e) {}
    }
    return {
      patientId:     String(r[0]),
      name:          r[1]  || "",
      kana:          r[2]  || "",
      dob:           dob,
      gender:        r[4]  || "",
      phone:         r[5]  ? String(r[5]) : "",
      address:       r[6]  || "",
      note:          r[7]  || "",
      jrecPatientId: r[8]  || "",
      createdAt:     createdAt
    };
  }
  return null;
}

/**
 * 新規患者を Patients シートに保存する。
 * @param {Object} payload { name, kana, dob, gender, phone, address, note, jrecPatientId }
 * @returns {{ ok: boolean, patientId?: string, error?: string }}
 */
function createPatient(payload) {
  var name = payload && payload.name ? payload.name.trim() : "";
  if (!name) return { ok: false, error: "氏名は必須です" };

  var ss  = getTargetSpreadsheet_();
  var sh  = ss.getSheetByName(SHEET_NAMES.PATIENTS);
  var now = new Date();

  try {
    var pid = generateNextPatientId_();
    sh.appendRow([
      pid,
      name,
      payload.kana          ? payload.kana.trim()          : "",
      payload.dob           ? payload.dob                   : "",
      payload.gender        ? payload.gender                 : "",
      payload.phone         ? String(payload.phone).trim()  : "",
      payload.address       ? payload.address.trim()        : "",
      payload.note          ? payload.note.trim()           : "",
      payload.jrecPatientId ? payload.jrecPatientId.trim()  : "",
      now,
      now
    ]);
    appendRunLog_("PATIENT_CREATE", pid, "氏名: " + name);
    return { ok: true, patientId: pid };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * 次の患者IDを生成する（P0001 形式）。
 * Settings シートの patient_id_prefix / patient_id_digits を参照する。
 */
function generateNextPatientId_() {
  var prefix = "P";
  var digits = 4;

  try {
    var ss   = getTargetSpreadsheet_();
    var stSh = ss.getSheetByName(SHEET_NAMES.SETTINGS);
    if (stSh && stSh.getLastRow() >= 2) {
      stSh.getRange(2, 1, stSh.getLastRow() - 1, 2).getValues().forEach(function(r) {
        if (r[0] === "patient_id_prefix") prefix = String(r[1]);
        if (r[0] === "patient_id_digits") digits  = parseInt(r[1], 10) || 4;
      });
    }
  } catch (e) {}

  var maxNum = 0;
  try {
    var pSh = getTargetSpreadsheet_().getSheetByName(SHEET_NAMES.PATIENTS);
    if (pSh && pSh.getLastRow() >= 2) {
      pSh.getRange(2, 1, pSh.getLastRow() - 1, 1).getValues().forEach(function(r) {
        var id = String(r[0]);
        if (id.indexOf(prefix) === 0) {
          var n = parseInt(id.slice(prefix.length), 10);
          if (!isNaN(n) && n > maxNum) maxNum = n;
        }
      });
    }
  } catch (e) {}

  return prefix + String(maxNum + 1).padStart(digits, "0");
}

/**
 * 既存患者の基本情報を更新する。patientId は変更不可。
 * @param {string} patientId
 * @param {{name, kana?, dob?, gender?, phone?, address?, note?, jrecPatientId?}} payload
 * @returns {{ ok: boolean, patientId?: string, error?: string }}
 */
function updatePatient(patientId, payload) {
  Logger.log("[updatePatient] START patientId=" + patientId);
  try {
    if (!patientId) return { ok: false, error: "patientId は必須です" };
    var name = payload && payload.name ? String(payload.name).trim() : "";
    if (!name) return { ok: false, error: "氏名は必須です" };

    var ss = getTargetSpreadsheet_();
    var sh = ss.getSheetByName(SHEET_NAMES.PATIENTS);
    if (!sh || sh.getLastRow() < 2) return { ok: false, error: "Patients シートが見つかりません" };

    var ids = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) !== String(patientId)) continue;
      var rowNum = i + 2;
      var now    = new Date();
      sh.getRange(rowNum, 2).setValue(name);
      sh.getRange(rowNum, 3).setValue(payload.kana    ? String(payload.kana).trim()    : "");
      sh.getRange(rowNum, 4).setValue(payload.dob     ? String(payload.dob)            : "");
      sh.getRange(rowNum, 5).setValue(payload.gender  ? String(payload.gender)         : "");
      sh.getRange(rowNum, 6).setValue(payload.phone   ? String(payload.phone).trim()   : "");
      sh.getRange(rowNum, 7).setValue(payload.address ? String(payload.address).trim() : "");
      sh.getRange(rowNum, 8).setValue(payload.note    ? String(payload.note).trim()    : "");
      sh.getRange(rowNum, 11).setValue(now);
      Logger.log("[updatePatient] row " + rowNum + " updated: " + name);
      appendRunLog_("PATIENT_UPDATE", String(patientId), "氏名: " + name);
      return { ok: true, patientId: String(patientId) };
    }
    return { ok: false, error: "患者が見つかりません: " + patientId };

  } catch (err) {
    var m = err && err.message ? err.message : String(err);
    Logger.log("[updatePatient] ERROR: " + m);
    return { ok: false, error: m };
  }
}

/**
 * Run_Log に操作記録を追記する。失敗してもエラーにしない。
 * @param {string}  action    操作種別（VISIT_CREATE / PAYMENT_SAVE / PAYMENT_COLLECT / RECEIPT_ISSUE 等）
 * @param {string}  patientId 対象患者ID（P0001 形式）
 * @param {string}  detail    詳細テキスト
 * @param {string=} visitKey  対象 selfPayVisitKey（省略可。患者登録など visit を伴わない操作は省略）
 */
function appendRunLog_(action, patientId, detail, visitKey) {
  try {
    var ss = getTargetSpreadsheet_();
    var sh = ss.getSheetByName(SHEET_NAMES.RUN_LOG);
    if (!sh) return;
    sh.appendRow([
      new Date(), action, visitKey || "", patientId || "", "SUCCESS",
      detail || "", Session.getActiveUser().getEmail() || ""
    ]);
  } catch (e) {
    Logger.log("[Run_Log] 書き込み失敗: " + e.message);
  }
}
