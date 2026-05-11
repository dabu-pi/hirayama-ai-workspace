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

      case "outstandingReport": {
        var orData = getOutstandingReport();
        var tor = HtmlService.createTemplateFromFile("outstanding-report");
        tor.appUrl      = appUrl;
        tor.currentPage = "reports";   // 売上・レポートタブを active に
        tor.summary     = orData.summary  || {};
        tor.details     = orData.details  || [];
        tor.patients    = orData.patients || [];
        tor.orError     = orData.error    || null;
        return evalTemplate_(tor);
      }

      case "monthlyReport": {
        var nowMR  = new Date();
        var tzMR   = "Asia/Tokyo";
        var nowMRY = parseInt(Utilities.formatDate(nowMR, tzMR, "yyyy"), 10);
        var nowMRM = parseInt(Utilities.formatDate(nowMR, tzMR, "MM"),   10);

        var _yp2 = parseInt(yearParam,  10);
        var _mp2 = parseInt(monthParam, 10);
        var mrYear  = (_yp2 >= 2020 && _yp2 <= 2035) ? _yp2 : nowMRY;
        var mrMonth = (_mp2 >= 1    && _mp2 <= 12)   ? _mp2 : nowMRM;

        var mrData = getMonthlyRevenueSummary(mrYear, mrMonth);
        var tmr = HtmlService.createTemplateFromFile("monthly-report");
        tmr.appUrl      = appUrl;
        tmr.currentPage = "reports";   // 売上・レポートタブを active に
        tmr.mrYear      = mrYear;
        tmr.mrMonth     = mrMonth;
        tmr.summary     = mrData.summary || {};
        tmr.days        = mrData.days    || {};
        tmr.mrError     = mrData.error   || null;
        return evalTemplate_(tmr);
      }

      case "menuSalesReport": {
        var nowMS  = new Date();
        var tzMS   = "Asia/Tokyo";
        var nowMSY = parseInt(Utilities.formatDate(nowMS, tzMS, "yyyy"), 10);
        var nowMSM = parseInt(Utilities.formatDate(nowMS, tzMS, "MM"),   10);

        var _yp3 = parseInt(yearParam,  10);
        var _mp3 = parseInt(monthParam, 10);
        var msYear  = (_yp3 >= 2020 && _yp3 <= 2035) ? _yp3 : nowMSY;
        var msMonth = (_mp3 >= 1    && _mp3 <= 12)   ? _mp3 : nowMSM;

        var msData = getMenuSalesSummary(msYear, msMonth);
        var tms = HtmlService.createTemplateFromFile("menu-sales-report");
        tms.appUrl      = appUrl;
        tms.currentPage = "reports";   // 売上・レポートタブを active に
        tms.msYear      = msYear;
        tms.msMonth     = msMonth;
        tms.summary     = msData.summary || {};
        tms.menus       = msData.menus   || [];
        tms.msError     = msData.error   || null;
        return evalTemplate_(tms);
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

// ──────────────────────────────────────────────────────────────
// AI評価補助 (Phase AI-3)
// 個人情報（氏名・住所・電話番号・生年月日・jrecPatientId）は送信しない。
// API key は ScriptProperties の OPENAI_API_KEY から取得する。
// ──────────────────────────────────────────────────────────────


/**
 * AI評価補助を実行する。
 * visitKey に対応する visit + chart + patient データを取得し、
 * 個人情報を除去してから OpenAI Chat Completion API に送信する。
 *
 * @param {string} visitKey - selfPayVisitKey
 * @returns {{ ok: boolean, result?: Object, error?: string }}
 */
function runAIAssessment(visitKey) {
  try {
    if (!visitKey) return { ok: false, error: "visitKey が指定されていません" };

    var apiKey = PropertiesService.getScriptProperties().getProperty("OPENAI_API_KEY");
    if (!apiKey) {
      return {
        ok: false,
        error: "APIキーが設定されていません。GAS エディタ → プロジェクトのプロパティ → スクリプトプロパティ で OPENAI_API_KEY を設定してください。"
      };
    }

    // getVisitFormData(patientId, visitKey) は visitKey のみで検索する。
    // patientId 引数は logger 用なので空文字で安全。
    var visitData = getVisitFormData("", visitKey);
    if (!visitData.ok) {
      return { ok: false, error: "来院データの取得に失敗しました: " + visitData.error };
    }
    var visit = visitData.data;

    var patient = getPatientById(visit.patientId);
    if (!patient) {
      return { ok: false, error: "患者データの取得に失敗しました: " + visit.patientId };
    }

    var age = null;
    var ageBand = null;
    if (patient.dob) {
      try {
        var today = new Date();
        var birth = new Date(patient.dob);
        var ageNum = today.getFullYear() - birth.getFullYear();
        var dm = today.getMonth() - birth.getMonth();
        if (dm < 0 || (dm === 0 && today.getDate() < birth.getDate())) ageNum--;
        if (!isNaN(ageNum) && ageNum >= 0 && ageNum <= 130) {
          age = ageNum;
          ageBand = calcAgeBand_(ageNum);
        }
      } catch (e) {}
    }

    var inputData = {
      patientContext: {
        age:            age,
        ageBand:        ageBand,
        sex:            patient.gender         || null,
        occupation:     patient.occupation     || null,
        medicalHistory: patient.medicalHistory || null
      },
      visitContext: {
        visitDate:          visit.visitDate          || null,
        visitType:          visit.visitType          || null,
        chiefComplaint:     visit.chiefComplaint     || null,
        vas:                (visit.vas !== undefined && visit.vas !== "") ? visit.vas : null,
        injuryTrigger:      visit.injuryTrigger      || null,
        relatedHistoryNote: visit.relatedHistoryNote || null,
        assessment:         visit.assessment         || null,
        findings:           visit.findings           || null,
        treatment:          visit.treatment          || null,
        lifestyle:          visit.lifestyle          || null,
        nextPlan:           visit.nextPlan           || null
      }
    };
    // 送信しない情報: name / kana / phone / address / dob / jrecPatientId

    var prompt = buildAIPrompt_(inputData);

    var payload = {
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: AI_SYSTEM_PROMPT_ },
        { role: "user",   content: prompt }
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 1500
    };

    var options = {
      method: "post",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type":  "application/json"
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    var response = UrlFetchApp.fetch("https://api.openai.com/v1/chat/completions", options);
    var respCode = response.getResponseCode();
    var respText = response.getContentText();

    if (respCode !== 200) {
      Logger.log("[runAIAssessment] API error " + respCode + ": " + respText.substring(0, 500));
      var errMsg = "API エラー (" + respCode + ")";
      try {
        var errJson = JSON.parse(respText);
        if (errJson && errJson.error && errJson.error.message) {
          errMsg += ": " + errJson.error.message;
        }
      } catch (e) {}
      return { ok: false, error: errMsg };
    }

    var respJson = JSON.parse(respText);
    if (!respJson.choices || !respJson.choices[0] || !respJson.choices[0].message) {
      return { ok: false, error: "AI 応答の形式が想定外です" };
    }
    var content = respJson.choices[0].message.content;
    var result;
    try {
      result = JSON.parse(content);
    } catch (e) {
      Logger.log("[runAIAssessment] JSON parse error: " + content.substring(0, 500));
      return { ok: false, error: "AI 応答の JSON 解析に失敗しました" };
    }

    Logger.log("[runAIAssessment] visitKey=" + visitKey + " ok=true model=" + respJson.model);
    return { ok: true, result: result };

  } catch (err) {
    var m = err && err.message ? err.message : String(err);
    Logger.log("[runAIAssessment] ERROR: " + m);
    return { ok: false, error: m };
  }
}

/** 年齢層を返す */
function calcAgeBand_(age) {
  if (age <= 5)  return "幼児";
  if (age <= 14) return "小児";
  if (age <= 18) return "学生（中高）";
  if (age <= 29) return "若年成人";
  if (age <= 44) return "壮年";
  if (age <= 64) return "中年";
  if (age <= 74) return "前期高齢者";
  return "後期高齢者";
}

/** AI へ送るプロンプト本文を生成する */
function buildAIPrompt_(data) {
  var lines = [];
  var pc = data.patientContext;
  var vc = data.visitContext;

  if (pc.ageBand || pc.sex || pc.occupation || pc.medicalHistory) {
    lines.push("【患者情報】");
    if (pc.ageBand)        lines.push("年齢層: " + pc.ageBand + (pc.age !== null ? "（" + pc.age + "歳）" : ""));
    if (pc.sex)            lines.push("性別: " + pc.sex);
    if (pc.occupation)     lines.push("職業: " + pc.occupation);
    if (pc.medicalHistory) lines.push("既往歴: " + pc.medicalHistory);
    lines.push("");
  }

  lines.push("【来院・症状情報】");
  if (vc.visitType)          lines.push("来院区分: " + vc.visitType);
  if (vc.visitDate)          lines.push("来院日: " + vc.visitDate);
  if (vc.chiefComplaint)     lines.push("主訴: " + vc.chiefComplaint);
  if (vc.vas !== null)       lines.push("VAS: " + vc.vas + "/10");
  if (vc.injuryTrigger)      lines.push("受傷起点: " + vc.injuryTrigger);
  if (vc.relatedHistoryNote) lines.push("今回追記既往歴: " + vc.relatedHistoryNote);
  if (vc.assessment)         lines.push("評価: " + vc.assessment);
  if (vc.findings)           lines.push("所見: " + vc.findings);
  if (vc.treatment)          lines.push("施術内容: " + vc.treatment);
  if (vc.lifestyle)          lines.push("生活指導: " + vc.lifestyle);
  if (vc.nextPlan)           lines.push("次回方針: " + vc.nextPlan);

  return lines.join("\n");
}

/** AI システムプロンプト */
var AI_SYSTEM_PROMPT_ =
  "あなたは接骨院・整骨院の施術者（柔道整復師）を補助するAIアシスタントです。\n" +
  "提供された患者情報と来院情報をもとに、以下の観点で補助情報を日本語で返してください。\n" +
  "重要: あなたは診断を行いません。すべての情報は参考情報であり、施術者が確認・判断することを前提としています。\n" +
  "\n" +
  "以下の JSON フォーマットで返してください:\n" +
  "{\n" +
  '  "assessmentPoints":      ["評価の観点1", "評価の観点2", ...],\n' +
  '  "differentialDirection": ["鑑別の方向性1", "鑑別の方向性2", ...],\n' +
  '  "redFlags":              ["危険サイン1", "危険サイン2", ...],\n' +
  '  "additionalQuestions":   ["追加問診候補1", "追加問診候補2", ...],\n' +
  '  "treatmentApproach":     ["施術方針案1", "施術方針案2", ...],\n' +
  '  "referralIndication":    "医療機関受診勧奨の目安（不要なら空文字）",\n' +
  '  "chartDraft":            "カルテ下書き（評価・所見・施術内容の文章化案）"\n' +
  "}\n" +
  "\n" +
  "redFlags は該当なしでも空配列ではなく [\"特記すべき危険サインは確認されませんでした\"] としてください。\n" +
  "各配列の要素は2〜5件が目安です。\n" +
  "断定表現（「〜です」「〜に違いない」等）は使用しないでください。";
