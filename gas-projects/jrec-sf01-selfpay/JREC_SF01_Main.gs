"use strict";

// SPREADSHEET_ID, SHEET_NAMES, getTargetSpreadsheet_: defined in JREC_SF01_Setup.gs

function doGet(e) {
  var page    = (e && e.parameter && e.parameter.page) || "list";
  var idParam = (e && e.parameter && (e.parameter.id || e.parameter.patientId)) || "";
  var q       = (e && e.parameter && e.parameter.q)   || "";

  try {
    var output = buildPage_(page, idParam, q);
    return output
      .setTitle("JREC-SF01 自費カルテ・会計")
      .addMetaTag("viewport", "width=device-width, initial-scale=1.0")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    return renderError_("予期しないエラー: " + err.message);
  }
}

function buildPage_(page, idParam, q) {
  var appUrl = getAppUrl_();

  try {
    switch (page) {

      // ── 動作確認用 ping ────────────────────────────────────
      case "ping": {
        return HtmlService.createHtmlOutput(
          '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>' +
          '<div style="padding:24px;font-family:sans-serif;color:#1e8e3e;">' +
          '<b>JREC-SF01 ping OK</b><br>doGet is running.<br>appUrl: ' +
          appUrl + '</div></body></html>'
        );
      }

      case "newPatient": {
        var t = HtmlService.createTemplateFromFile("patient-form");
        t.appUrl = appUrl;
        t.mode   = "new";
        return evalTemplate_(t);
      }

      case "visitForm": {
        Logger.log("[visitForm] idParam=" + idParam);
        if (!idParam) return renderError_(
          "患者IDが指定されていません。<br><a href=\"" + appUrl + "\">一覧に戻る</a>"
        );
        var ptv = getPatientById(idParam);
        Logger.log("[visitForm] patient=" + (ptv ? ptv.name : "null"));
        if (!ptv) return renderError_(
          "患者 " + idParam + " が見つかりませんでした。<br><a href=\"" + appUrl + "\">一覧に戻る</a>"
        );
        var t = HtmlService.createTemplateFromFile("visit-form");
        t.appUrl   = appUrl;
        t.patient  = ptv;
        return evalTemplate_(t);
      }

      case "detail": {
        if (!idParam) return renderError_(
          "患者IDが指定されていません。<br><a href=\"" + appUrl + "\">一覧に戻る</a>"
        );
        var ptd = getPatientById(idParam);
        if (!ptd) return renderError_(
          "患者 " + idParam + " が見つかりませんでした。<br><a href=\"" + appUrl + "\">一覧に戻る</a>"
        );
        var t = HtmlService.createTemplateFromFile("patient-detail");
        t.appUrl   = appUrl;
        t.patient  = ptd;
        t.timeline = getVisitTimelineByPatient(idParam);
        return evalTemplate_(t);
      }

      default: { // "list"
        var t = HtmlService.createTemplateFromFile("patient-list");
        t.appUrl    = appUrl;
        t.patients  = getPatients(q);
        t.query     = q;
        return evalTemplate_(t);
      }
    }
  } catch (err) {
    return renderError_("ページ構築エラー (page=" + page + "): " + err.message);
  }
}

function evalTemplate_(tmpl) {
  try {
    return tmpl.evaluate();
  } catch (err) {
    return renderError_(
      "テンプレート描画エラー: " + err.message +
      "<br><br><a href=\"" + getAppUrl_() + "\">一覧に戻る</a>"
    );
  }
}

function renderError_(message) {
  return HtmlService.createHtmlOutput(
    '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1.0"></head>' +
    '<body style="font-family:sans-serif;padding:24px;color:#c5221f;">' +
    '<h2 style="margin-bottom:12px;">JREC-SF01 エラー</h2>' +
    '<p>' + message + '</p></body></html>'
  );
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getAppUrl_() {
  return ScriptApp.getService().getUrl();
}
