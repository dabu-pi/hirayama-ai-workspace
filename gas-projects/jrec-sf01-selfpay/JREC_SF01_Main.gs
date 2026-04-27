"use strict";

// SPREADSHEET_ID, SHEET_NAMES, getTargetSpreadsheet_: defined in JREC_SF01_Setup.gs

function doGet(e) {
  var page      = (e && e.parameter && e.parameter.page)      || "list";
  var idParam   = (e && e.parameter && (e.parameter.id || e.parameter.patientId)) || "";
  var q         = (e && e.parameter && e.parameter.q)          || "";

  try {
    var output = buildPage_(page, idParam, q);
    return output
      .setTitle("JREC-SF01 自費カルテ・会計")
      .addMetaTag("viewport", "width=device-width, initial-scale=1.0")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

  } catch (err) {
    return renderError_(
      "<b>予期しないエラーが発生しました</b><br>" + err.message
    );
  }
}

/**
 * ページごとの HtmlOutput を返す。template evaluate エラーも個別に捕捉する。
 */
function buildPage_(page, idParam, q) {
  try {
    switch (page) {

      case "newPatient": {
        var t = HtmlService.createTemplateFromFile("patient-form");
        t.mode = "new";
        return evalTemplate_(t);
      }

      case "visitForm": {
        if (!idParam) return renderError_("患者IDが指定されていません。<a href='" + getAppUrl_() + "'>一覧に戻る</a>");
        var ptv = getPatientById(idParam);
        if (!ptv)    return renderError_("患者 " + idParam + " が見つかりませんでした。<a href='" + getAppUrl_() + "'>一覧に戻る</a>");
        var t = HtmlService.createTemplateFromFile("visit-form");
        t.patient = ptv;
        return evalTemplate_(t);
      }

      case "detail": {
        if (!idParam) return renderError_("患者IDが指定されていません。<a href='" + getAppUrl_() + "'>一覧に戻る</a>");
        var ptd = getPatientById(idParam);
        if (!ptd)    return renderError_("患者 " + idParam + " が見つかりませんでした。<a href='" + getAppUrl_() + "'>一覧に戻る</a>");
        var t = HtmlService.createTemplateFromFile("patient-detail");
        t.patient  = ptd;
        t.timeline = getVisitTimelineByPatient(idParam);
        return evalTemplate_(t);
      }

      default: { // "list"
        var t = HtmlService.createTemplateFromFile("patient-list");
        t.patients = getPatients(q);
        t.query    = q;
        return evalTemplate_(t);
      }
    }

  } catch (err) {
    return renderError_(
      "<b>ページ構築エラー（page=" + page + "）</b><br>" + err.message
    );
  }
}

/**
 * テンプレートを evaluate して HtmlOutput を返す。
 * evaluate 内のエラーを個別に捕捉し、白画面を防ぐ。
 */
function evalTemplate_(tmpl) {
  try {
    return tmpl.evaluate();
  } catch (err) {
    return renderError_(
      "<b>テンプレート描画エラー</b><br>" + err.message +
      "<br><br><a href='" + getAppUrl_() + "'>一覧に戻る</a>"
    );
  }
}

/**
 * エラー表示用の HtmlOutput を返す。白画面にしない。
 */
function renderError_(message) {
  return HtmlService.createHtmlOutput(
    '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1.0"></head>' +
    '<body style="font-family:sans-serif;padding:24px;color:#c5221f;">' +
    '<h2 style="margin-bottom:12px;">JREC-SF01 エラー</h2>' +
    '<p>' + message + '</p>' +
    '</body></html>'
  );
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getAppUrl_() {
  return ScriptApp.getService().getUrl();
}
