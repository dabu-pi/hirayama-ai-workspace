"use strict";

// SPREADSHEET_ID, SHEET_NAMES, getTargetSpreadsheet_: defined in JREC_SF01_Setup.gs

function doGet(e) {
  var page      = (e && e.parameter && e.parameter.page) || "home";
  var idParam   = (e && e.parameter && (e.parameter.id || e.parameter.patientId)) || "";
  var q         = (e && e.parameter && e.parameter.q)                             || "";
  var vkParam   = (e && e.parameter && (e.parameter.visitKey || e.parameter.vk))  || "";
  var dateParam  = (e && e.parameter && e.parameter.date)                          || "";
  var yearParam  = (e && e.parameter && e.parameter.year)                          || "";
  var monthParam = (e && e.parameter && e.parameter.month)                         || "";

  try {
    var output = buildPage_(page, idParam, q, vkParam, dateParam, yearParam, monthParam);
    return output
      .setTitle("JREC-SF01 自費カルテ・会計")
      .addMetaTag("viewport", "width=device-width, initial-scale=1.0")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    return renderError_("予期しないエラー: " + err.message);
  }
}

function buildPage_(page, idParam, q, vkParam, dateParam, yearParam, monthParam) {
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
        t.appUrl       = appUrl;
        t.mode         = "new";
        t.patient      = null;
        t.currentPage  = "newPatient";
        return evalTemplate_(t);
      }

      case "editPatient": {
        Logger.log("[editPatient] idParam=" + idParam);
        if (!idParam) return renderError_(
          "患者IDが指定されていません。<br><a href=\"" + appUrl + "\">一覧に戻る</a>"
        );
        var pte = getPatientById(idParam);
        if (!pte) return renderError_(
          "患者 " + idParam + " が見つかりませんでした。<br><a href=\"" + appUrl + "\">一覧に戻る</a>"
        );
        var t = HtmlService.createTemplateFromFile("patient-form");
        t.appUrl      = appUrl;
        t.mode        = "edit";
        t.patient     = pte;
        t.currentPage = "";
        return evalTemplate_(t);
      }

      case "visitForm": {
        Logger.log("[visitForm] idParam=" + idParam + " vkParam=" + vkParam);
        if (!idParam) return renderError_(
          "患者IDが指定されていません。<br><a href=\"" + appUrl + "\">一覧に戻る</a>"
        );
        var ptv = getPatientById(idParam);
        Logger.log("[visitForm] patient=" + (ptv ? ptv.name : "null"));
        if (!ptv) return renderError_(
          "患者 " + idParam + " が見つかりませんでした。<br><a href=\"" + appUrl + "\">一覧に戻る</a>"
        );
        var t = HtmlService.createTemplateFromFile("visit-form");
        t.appUrl      = appUrl;
        t.patient     = ptv;
        t.editVisit   = null;
        t.currentPage = "";
        if (vkParam) {
          var evData = getVisitFormData(idParam, vkParam);
          if (!evData.ok) {
            return renderError_(evData.error +
              "<br><a href=\"" + appUrl + "?page=detail&id=" + encodeURIComponent(idParam) + "\">患者詳細へ戻る</a>"
            );
          }
          t.editVisit = evData.data;
        }
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
        var fullTl = getFullVisitTimelineByPatient(idParam);
        var t = HtmlService.createTemplateFromFile("patient-detail");
        t.appUrl          = appUrl;
        t.webAppUrl       = ScriptApp.getService().getUrl();
        t.patient         = ptd;
        t.timeline        = fullTl.timeline;
        t.deletedTimeline = fullTl.deletedTimeline;
        t.accounting      = getPatientAccountingData(idParam);
        t.currentPage     = "";
        return evalTemplate_(t);
      }

      // ── 会計入力画面（Step 3 で本格実装）──────────────────
      case "billing": {
        Logger.log("[billing] vkParam=" + vkParam);
        if (!vkParam) return renderError_(
          "visitKey が指定されていません。<br><a href=\"" + appUrl + "\">一覧に戻る</a>"
        );
        var bd = getVisitForBilling(vkParam);
        if (!bd.ok) return renderError_(
          "会計情報の取得に失敗しました: " + bd.error +
          "<br><a href=\"" + appUrl + "\">一覧に戻る</a>"
        );
        if (bd.alreadyPaid) return renderError_(
          "この来院はすでに会計済みです（" + bd.existingPayment.paymentId + "）。" +
          "<br><a href=\"" + appUrl + "?page=receipt&visitKey=" + encodeURIComponent(vkParam) + "\">領収書を確認する</a>" +
          "　<a href=\"" + appUrl + "?page=detail&id=" + bd.visit.patientId + "\">患者詳細へ戻る</a>"
        );
        var t = HtmlService.createTemplateFromFile("billing-form");
        t.appUrl      = appUrl;
        t.visit       = bd.visit;
        t.patient     = bd.patient;
        t.menus       = getActiveMenus();
        t.currentPage = "";
        return evalTemplate_(t);
      }

      // ── 領収書プレビュー・発行画面（Step 4 で本格実装）──
      case "receipt": {
        Logger.log("[receipt] vkParam=" + vkParam);
        if (!vkParam) return renderError_(
          "visitKey が指定されていません。<br><a href=\"" + appUrl + "\">一覧に戻る</a>"
        );
        var rd = getReceiptByVisit(vkParam);
        if (!rd.ok) return renderError_(
          "領収書情報の取得に失敗しました: " + rd.error +
          "<br><a href=\"" + appUrl + "\">一覧に戻る</a>"
        );
        var t = HtmlService.createTemplateFromFile("receipt");
        t.appUrl      = appUrl;
        t.visit       = rd.visit;
        t.patient     = rd.patient;
        t.items       = rd.items;
        t.payment     = rd.payment;
        t.receipt     = rd.receipt;      // null = 未発行
        t.clinicName  = rd.clinicName;
        t.currentPage = "";
        return evalTemplate_(t);
      }

      case "reports": {
        var tr = HtmlService.createTemplateFromFile("reports");
        tr.appUrl      = appUrl;
        tr.currentPage = "reports";
        return evalTemplate_(tr);
      }

      case "home": {
        var nowHome  = new Date();
        var tz       = "Asia/Tokyo";
        var nowYear  = parseInt(Utilities.formatDate(nowHome, tz, "yyyy"), 10);
        var nowMonth = parseInt(Utilities.formatDate(nowHome, tz, "MM"),   10);
        var todayStr = Utilities.formatDate(nowHome, tz, "yyyy-MM-dd");

        var _yp = parseInt(yearParam,  10);
        var _mp = parseInt(monthParam, 10);
        var calYear  = (_yp >= 2020 && _yp <= 2035) ? _yp : nowYear;
        var calMonth = (_mp >= 1    && _mp <= 12)   ? _mp : nowMonth;

        var calData  = getMonthlyVisitCalendar(calYear, calMonth);
        var th = HtmlService.createTemplateFromFile("home");
        th.appUrl       = appUrl;
        th.calYear      = calYear;
        th.calMonth     = calMonth;
        th.today        = todayStr;
        th.calDays      = calData.days;
        th.currentPage  = "home";
        return evalTemplate_(th);
      }

      case "dailyCheckout": {
        var today      = Utilities.formatDate(new Date(), "Asia/Tokyo", "yyyy-MM-dd");
        var targetDate = dateParam || today;
        var coData     = getDailyCheckoutList(targetDate);
        var tco = HtmlService.createTemplateFromFile("daily-checkout");
        tco.appUrl        = appUrl;
        tco.date          = targetDate;
        tco.today         = today;
        tco.checkoutList  = coData.list;
        tco.checkoutError = coData.error || null;
        tco.currentPage   = "dailyCheckout";
        return evalTemplate_(tco);
      }

      case "list": {
        var pts   = getPatients(q);
        var stats = getPatientListStats();
        pts.forEach(function(p) {
          var s = stats[p.patientId] || { outstanding: 0, unbilledCount: 0 };
          p.outstanding   = s.outstanding;
          p.unbilledCount = s.unbilledCount;
        });
        var tl = HtmlService.createTemplateFromFile("patient-list");
        tl.appUrl       = appUrl;
        tl.patients     = pts;
        tl.query        = q;
        tl.currentPage  = "list";
        return evalTemplate_(tl);
      }

      default: {
        var td = HtmlService.createTemplateFromFile("home");
        td.appUrl      = appUrl;
        td.currentPage = "home";
        return evalTemplate_(td);
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
