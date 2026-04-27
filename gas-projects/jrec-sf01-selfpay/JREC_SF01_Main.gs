"use strict";

// SPREADSHEET_ID, SHEET_NAMES, getTargetSpreadsheet_: defined in JREC_SF01_Setup.gs

function doGet(e) {
  var page = e && e.parameter && e.parameter.page || "list";
  var id   = e && e.parameter && e.parameter.id   || "";
  var q    = e && e.parameter && e.parameter.q    || "";

  try {
    var tmpl;
    switch (page) {

      case "newPatient":
        tmpl = HtmlService.createTemplateFromFile("patient-form");
        tmpl.mode = "new";
        break;

      case "visitForm":
        var pt = getPatientById(id);
        if (!pt) return notFound_(id);
        tmpl = HtmlService.createTemplateFromFile("visit-form");
        tmpl.patient = pt;
        break;

      case "detail":
        var pt = getPatientById(id);
        if (!pt) return notFound_(id);
        tmpl = HtmlService.createTemplateFromFile("patient-detail");
        tmpl.patient  = pt;
        tmpl.timeline = getVisitTimelineByPatient(id);
        break;

      default: // "list"
        tmpl = HtmlService.createTemplateFromFile("patient-list");
        tmpl.patients = getPatients(q);
        tmpl.query    = q;
        break;
    }

    return tmpl.evaluate()
      .setTitle("JREC-SF01 自費カルテ・会計")
      .addMetaTag("viewport", "width=device-width, initial-scale=1.0")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  } catch (err) {
    return HtmlService.createHtmlOutput(
      '<div style="padding:24px;font-family:sans-serif;color:#c5221f;">' +
      '<b>エラーが発生しました</b><br>' + err.message + '</div>'
    ).setTitle("JREC-SF01 エラー");
  }
}

function notFound_(id) {
  return HtmlService.createHtmlOutput(
    '<div style="padding:24px;font-family:sans-serif;">' +
    '<p>患者 ' + id + ' が見つかりませんでした。</p>' +
    '<a href="' + ScriptApp.getService().getUrl() + '">← 一覧に戻る</a></div>'
  ).setTitle("JREC-SF01");
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getAppUrl_() {
  return ScriptApp.getService().getUrl();
}
