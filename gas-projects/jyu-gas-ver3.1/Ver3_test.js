/****************************************************
 * Ver3_test.js — JREC-01 fixture テストランナー
 *
 * ★使い方
 *   Apps Script エディタで以下を実行する:
 *   - runFixtureSuite_()      全 fixture を一括実行（結果をアラートで表示）
 *   - runFixtureTest_("M01")  個別実行
 *
 * ★設計方針
 *   - SpreadsheetApp を使わない純粋計算テスト
 *   - calcOnePartAmount_V3_（Ver3_amounts.js）を直接呼び出す
 *   - computeAmountsFromFixture_V3_ で fixture → amounts 変換を担う
 *   - production コードの変更時はこちらの同等ロジックも更新すること
 *
 * ★対象: tests/jrec01/fixtures/ + expected/ の JSON を JS オブジェクトとして埋め込み
 ****************************************************/


/* =======================================================================
   テスト設定単価（設定シートの値と同値に保つこと）
   ⚠️ warm / electro / taiki は TC06〜TC08 追加時に設定シートから確認して更新
   ======================================================================= */
var TEST_SETTINGS_ = {
  initFee:              1550,
  initSupport:          100,
  reFee:                410,
  shoryoDaboku:         760,
  shoryoNenZa:          760,
  shoryoZasyo:          760,
  koryoDaboku:          505,
  koryoNenZa:           505,
  koryoZasyo:           505,
  seifukuDakkyu:        0,    // TODO: 設定シートから取得
  koryoDakkyu:          0,    // TODO: 設定シートから取得
  koryoKossetu:         850,
  koryoFuzenKossetu:    720,
  cold:                 85,
  warm:                 70,   // ⚠️ 要確認
  electro:              70,   // ⚠️ 要確認
  taiki:                35,   // ⚠️ 要確認
  multiCoef3:           0.6,
  roundUnit:            10,
  _rawMap:              {},
};


/* =======================================================================
   Fixture データ（tests/jrec01/fixtures/*.json と同内容）
   ======================================================================= */
var JREC01_FIXTURES_ = {

  "TC01": {
    testId: "TC01",
    context: { patientId: "P001", treatDate: "2026-02-03",
      monthlyStatus: { initBilled: false, reBilled: false, supportBilled: false } },
    cases: [
      { caseNo: 1, kubun: "初検", parts: [
        { bui: "腰部", byomei: "捻挫", injuryDate: "2026-02-03", cold: true, warm: false, electro: false }
      ]}
    ]
  },

  "TC02": {
    testId: "TC02",
    context: { patientId: "P001", treatDate: "2026-02-05",
      monthlyStatus: { initBilled: true, reBilled: false, supportBilled: true } },
    cases: [
      { caseNo: 1, kubun: "再検", parts: [
        { bui: "腰部", byomei: "捻挫", injuryDate: "2026-02-03", cold: false, warm: false, electro: false }
      ]}
    ]
  },

  "TC03": {
    testId: "TC03",
    context: { patientId: "P001", treatDate: "2026-02-07",
      monthlyStatus: { initBilled: true, reBilled: true, supportBilled: true } },
    cases: [
      { caseNo: 1, kubun: "後療", parts: [
        { bui: "腰部", byomei: "捻挫", injuryDate: "2026-02-03", cold: false, warm: false, electro: false }
      ]}
    ]
  },

  "M01": {
    testId: "M01",
    context: { patientId: "P001", treatDate: "2026-02-10",
      monthlyStatus: { initBilled: true, reBilled: true, supportBilled: true } },
    cases: [
      { caseNo: 1, kubun: "後療", parts: [
        { bui: "腰部", byomei: "捻挫", injuryDate: "2026-02-03", cold: false, warm: false, electro: false }
      ]},
      { caseNo: 2, kubun: "初検", parts: [
        { bui: "肩関節", byomei: "打撲", injuryDate: "2026-02-10", cold: false, warm: false, electro: false }
      ]}
    ]
  },

  "M02": {
    testId: "M02",
    context: { patientId: "P001", treatDate: "2026-02-03",
      monthlyStatus: { initBilled: false, reBilled: false, supportBilled: false } },
    cases: [
      { caseNo: 1, kubun: "再検", parts: [
        { bui: "腰部", byomei: "捻挫", injuryDate: "2026-01-20", cold: false, warm: false, electro: false }
      ]},
      { caseNo: 2, kubun: "初検", parts: [
        { bui: "肩関節", byomei: "打撲", injuryDate: "2026-02-03", cold: false, warm: false, electro: false }
      ]}
    ]
  },

  "M03": {
    testId: "M03",
    context: { patientId: "P001", treatDate: "2026-02-10",
      monthlyStatus: { initBilled: true, reBilled: true, supportBilled: true } },
    cases: [
      { caseNo: 1, kubun: "後療", parts: [
        { bui: "腰部", byomei: "捻挫", injuryDate: "2026-02-01", cold: false, warm: false, electro: false }
      ]},
      { caseNo: 2, kubun: "初検", parts: [
        { bui: "肩関節", byomei: "打撲", injuryDate: "2026-02-10", cold: false, warm: false, electro: false }
      ]}
    ]
  },

  "M04": {
    testId: "M04",
    context: { patientId: "P001", treatDate: "2026-02-10",
      monthlyStatus: { initBilled: false, reBilled: false, supportBilled: false } },
    cases: [
      { caseNo: 1, kubun: "初検", parts: [
        { bui: "腰部", byomei: "捻挫", injuryDate: "2026-02-10", cold: false, warm: false, electro: false }
      ]},
      { caseNo: 2, kubun: "初検", parts: [
        { bui: "肩関節", byomei: "打撲", injuryDate: "2026-02-10", cold: false, warm: false, electro: false }
      ]}
    ]
  },

  "M05": {
    testId: "M05",
    context: { patientId: "P001", treatDate: "2026-02-12",
      monthlyStatus: { initBilled: true, reBilled: false, supportBilled: true } },
    cases: [
      { caseNo: 1, kubun: "後療", parts: [
        { bui: "腰部", byomei: "捻挫", injuryDate: "2026-02-01", cold: false, warm: false, electro: false }
      ]},
      { caseNo: 2, kubun: "再検", parts: [
        { bui: "肩関節", byomei: "打撲", injuryDate: "2026-02-08", cold: false, warm: false, electro: false }
      ]}
    ]
  },

};


/* =======================================================================
   Expected データ（tests/jrec01/expected/*.json と同内容）
   ======================================================================= */
var JREC01_EXPECTED_ = {

  "TC01": {
    header: { initFee: 1550, reFee: 0, supportFee: 100, detailSum: 845, visitTotal: 2495,
      needCheck: false, needCheckReason: "",
      billedKubun: "初検", mixedFlag: "通常",
      case1Summary: "case1:初検", case2Summary: "case2:なし", chargeReason: "初検のみ" },
    details: [
      { detailID: "P001_2026-02-03_C1_P1", kubun: "初検", baseOut: 760, coldOut: 85, rowTotalOut: 845 }
    ]
  },

  "TC02": {
    header: { initFee: 0, reFee: 410, supportFee: 0, detailSum: 505, visitTotal: 915,
      needCheck: false, needCheckReason: "",
      billedKubun: "再検", mixedFlag: "通常",
      case1Summary: "case1:再検", case2Summary: "case2:なし", chargeReason: "再検のみ" },
    details: [
      { detailID: "P001_2026-02-05_C1_P1", kubun: "再検", baseOut: 505, coldOut: 0, rowTotalOut: 505 }
    ]
  },

  "TC03": {
    header: { initFee: 0, reFee: 0, supportFee: 0, detailSum: 505, visitTotal: 505,
      needCheck: false, needCheckReason: "",
      billedKubun: "後療", mixedFlag: "通常",
      case1Summary: "case1:後療", case2Summary: "case2:なし", chargeReason: "後療のみ" },
    details: [
      { detailID: "P001_2026-02-07_C1_P1", kubun: "後療", baseOut: 505, coldOut: 0, rowTotalOut: 505 }
    ]
  },

  "M01": {
    header: { initFee: 0, reFee: 0, supportFee: 0, detailSum: 1010, visitTotal: 1010,
      needCheck: true, needCheckReason: "同月別ケース初回 初検抑制",
      billedKubun: "後療", mixedFlag: "Mixed",
      case1Summary: "case1:後療", case2Summary: "case2:初検(抑制)", chargeReason: "初検抑制かつ再検対象なし" },
    details: [
      { detailID: "P001_2026-02-10_C1_P1", kubun: "後療", baseOut: 505, coldOut: 0, rowTotalOut: 505 },
      { detailID: "P001_2026-02-10_C2_P1", kubun: "後療", baseOut: 505, coldOut: 0, rowTotalOut: 505 }
    ]
  },

  "M02": {
    header: { initFee: 1550, reFee: 0, supportFee: 100, detailSum: 1265, visitTotal: 2915,
      needCheck: false, needCheckReason: "",
      billedKubun: "初検", mixedFlag: "Mixed",
      case1Summary: "case1:再検", case2Summary: "case2:初検", chargeReason: "算定可能な初検ありのため初検採用" },
    details: [
      { detailID: "P001_2026-02-03_C1_P1", kubun: "再検", baseOut: 505, coldOut: 0, rowTotalOut: 505 },
      { detailID: "P001_2026-02-03_C2_P1", kubun: "初検", baseOut: 760, coldOut: 0, rowTotalOut: 760 }
    ]
  },

  "M03": {
    header: { initFee: 0, reFee: 0, supportFee: 0, detailSum: 1010, visitTotal: 1010,
      needCheck: true, needCheckReason: "同月別ケース初回 初検抑制",
      billedKubun: "後療", mixedFlag: "Mixed",
      case1Summary: "case1:後療", case2Summary: "case2:初検(抑制)", chargeReason: "初検抑制かつ再検対象なし" },
    details: [
      { detailID: "P001_2026-02-10_C1_P1", kubun: "後療", baseOut: 505, coldOut: 0, rowTotalOut: 505 },
      { detailID: "P001_2026-02-10_C2_P1", kubun: "後療", baseOut: 505, coldOut: 0, rowTotalOut: 505 }
    ]
  },

  "M04": {
    header: { initFee: 1550, reFee: 0, supportFee: 100, detailSum: 1520, visitTotal: 3170,
      needCheck: false, needCheckReason: "",
      billedKubun: "初検", mixedFlag: "Mixed",
      case1Summary: "case1:初検", case2Summary: "case2:初検", chargeReason: "算定可能な初検ありのため初検採用" },
    details: [
      { detailID: "P001_2026-02-10_C1_P1", kubun: "初検", baseOut: 760, coldOut: 0, rowTotalOut: 760 },
      { detailID: "P001_2026-02-10_C2_P1", kubun: "初検", baseOut: 760, coldOut: 0, rowTotalOut: 760 }
    ]
  },

  "M05": {
    header: { initFee: 0, reFee: 410, supportFee: 0, detailSum: 1010, visitTotal: 1420,
      needCheck: false, needCheckReason: "",
      billedKubun: "再検", mixedFlag: "Mixed",
      case1Summary: "case1:後療", case2Summary: "case2:再検", chargeReason: "再検ありのため再検採用" },
    details: [
      { detailID: "P001_2026-02-12_C1_P1", kubun: "後療", baseOut: 505, coldOut: 0, rowTotalOut: 505 },
      { detailID: "P001_2026-02-12_C2_P1", kubun: "再検", baseOut: 505, coldOut: 0, rowTotalOut: 505 }
    ]
  },

};


/* =======================================================================
   computeAmountsFromFixture_V3_
   fixture → amounts 変換（calcHeaderAmountsByVisitKey_V3_ の純粋計算部分を複製）
   ※ production ロジック変更時はここも更新すること
   ======================================================================= */
function computeAmountsFromFixture_V3_(fx) {
  var settings  = TEST_SETTINGS_;
  var ms        = fx.context.monthlyStatus;
  var treatDate = new Date(fx.context.treatDate);
  var patId     = fx.context.patientId;
  var kubun1    = (fx.cases[0] || {}).kubun || null;
  var kubun2    = (fx.cases[1] || {}).kubun || null;
  var reasons   = [];

  // --- 初検料 ---
  var hasInit   = (kubun1 === "初検" || kubun2 === "初検");
  var hasReexam = (kubun1 === "再検" || kubun2 === "再検");
  var hasKoryo  = (kubun1 === "再検" || kubun1 === "後療" || kubun2 === "再検" || kubun2 === "後療");

  var initFee = 0;
  if (hasInit) {
    if (ms.initBilled) {
      reasons.push("同月別ケース初回 初検抑制");
    } else {
      initFee = settings.initFee;
    }
  }
  var hasBillableInitial = (initFee > 0);

  // --- 相談支援料 ---
  var supportFee = 0;
  if (hasBillableInitial) {
    supportFee = ms.supportBilled ? 0 : settings.initSupport;
  }

  // --- 再検料 ---
  var reFee = 0;
  if (hasReexam && !hasBillableInitial) {
    reFee = settings.reFee;
  }

  // --- 実効区分（抑制変換） ---
  var calcKoryoOnThisDay = !hasBillableInitial;
  var effectiveKubun1 = calcKoryoOnThisDay ? (kubun1 === "初検" ? "後療" : kubun1) : kubun1;
  var effectiveKubun2 = calcKoryoOnThisDay ? (kubun2 === "初検" ? "後療" : kubun2) : kubun2;

  // --- 部位別明細計算 ---
  function calcPartsFromFixture_(caseData, effectiveKubun) {
    if (!caseData || !caseData.parts) return { total: 0, parts: [] };
    var total = 0;
    var parts = [];
    for (var i = 0; i < caseData.parts.length; i++) {
      var p = caseData.parts[i];
      var injDate = new Date(p.injuryDate);
      var part = calcOnePartAmount_V3_(
        settings, effectiveKubun, p.byomei, injDate, treatDate,
        !!p.cold, !!p.warm, !!p.electro,
        i + 1, reasons, p.bui
      );
      part.bui = p.bui;
      total += part.total;
      parts.push(part);
    }
    return { total: total, parts: parts };
  }

  var detail1   = calcPartsFromFixture_(fx.cases[0], effectiveKubun1);
  var detail2   = calcPartsFromFixture_(fx.cases[1], effectiveKubun2);
  var detailSum = detail1.total + detail2.total;
  var visitTotal = initFee + reFee + supportFee + detailSum;

  // --- 新5列 ---
  var isMixed       = (kubun2 != null && String(kubun2).trim() !== "");
  var initSuppressed = reasons.some(function(r) { return r.indexOf("初検抑制") !== -1; });

  var billedKubun = initFee > 0 ? "初検" : reFee > 0 ? "再検" : hasKoryo ? "後療" : "算定なし";
  var mixedFlag   = isMixed ? "Mixed" : "通常";

  var k1 = String(kubun1 || "").trim();
  var case1Summary = k1 === "初検" ? "case1:初検"
    : k1 === "再検" ? "case1:再検"
    : k1 === "後療" ? "case1:後療"
    : "case1:なし";

  var k2 = String(kubun2 || "").trim();
  var case2Summary;
  if (!k2)             case2Summary = "case2:なし";
  else if (k2 === "初検") case2Summary = initSuppressed ? "case2:初検(抑制)" : "case2:初検";
  else if (k2 === "再検") case2Summary = "case2:再検";
  else if (k2 === "後療") case2Summary = "case2:後療";
  else                    case2Summary = "case2:" + k2;

  var chargeReason;
  if      (hasBillableInitial && !isMixed)                              chargeReason = "初検のみ";
  else if (hasBillableInitial && isMixed)                               chargeReason = "算定可能な初検ありのため初検採用";
  else if (!hasBillableInitial && reFee > 0 && isMixed && initSuppressed)  chargeReason = "初検抑制のため再検採用";
  else if (!hasBillableInitial && reFee > 0 && isMixed && !initSuppressed) chargeReason = "再検ありのため再検採用";
  else if (!hasBillableInitial && reFee > 0 && !isMixed)               chargeReason = "再検のみ";
  else if (!hasBillableInitial && reFee === 0 && hasKoryo && isMixed && initSuppressed) chargeReason = "初検抑制かつ再検対象なし";
  else if (!hasBillableInitial && reFee === 0 && hasKoryo)             chargeReason = "後療のみ";
  else                                                                   chargeReason = "算定なし";

  // --- detail リスト生成 ---
  var details = [];
  var pushDetails_ = function(parts, caseNo, ek) {
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      details.push({
        detailID:    patId + "_" + fx.context.treatDate + "_C" + caseNo + "_P" + (i + 1),
        kubun:       ek,
        baseOut:     p.base,
        coldOut:     p.cold,
        warmOut:     p.warm,
        electroOut:  p.electro,
        rowTotalOut: Math.round(p.total),
      });
    }
  };
  pushDetails_(detail1.parts, 1, effectiveKubun1);
  pushDetails_(detail2.parts, 2, effectiveKubun2);

  return {
    initFee: initFee, reFee: reFee, supportFee: supportFee,
    detailSum: detailSum, visitTotal: visitTotal,
    needCheck: reasons.length > 0,
    needCheckReason: reasons.join(";"),
    billedKubun: billedKubun, mixedFlag: mixedFlag,
    case1Summary: case1Summary, case2Summary: case2Summary,
    chargeReason: chargeReason,
    effectiveKubun1: effectiveKubun1, effectiveKubun2: effectiveKubun2,
    details: details,
  };
}


/* =======================================================================
   assertAmounts_  ―  actual vs expected 比較
   ======================================================================= */
function assertAmounts_(testId, actual, expected) {
  var diffs = [];

  // header 比較
  var hKeys = Object.keys(expected.header);
  for (var i = 0; i < hKeys.length; i++) {
    var k = hKeys[i];
    var a = actual[k];
    var e = expected.header[k];
    if (String(a) !== String(e)) {
      diffs.push("header." + k + ": expect=" + JSON.stringify(e) + " actual=" + JSON.stringify(a));
    }
  }

  // detail 比較
  var exDetails = expected.details || [];
  for (var j = 0; j < exDetails.length; j++) {
    var ex = exDetails[j];
    var ac = actual.details[j];
    if (!ac) {
      diffs.push("detail[" + j + "]: missing");
      continue;
    }
    var dKeys = Object.keys(ex);
    for (var m = 0; m < dKeys.length; m++) {
      var dk = dKeys[m];
      if (String(ac[dk]) !== String(ex[dk])) {
        diffs.push("detail[" + j + "]." + dk + ": expect=" + JSON.stringify(ex[dk]) + " actual=" + JSON.stringify(ac[dk]));
      }
    }
  }

  return { pass: diffs.length === 0, diff: diffs.join(" / ") };
}


/* =======================================================================
   runFixtureTest_  ―  個別 fixture 実行
   ======================================================================= */
function runFixtureTest_(testId) {
  var fx = JREC01_FIXTURES_[testId];
  var ex = JREC01_EXPECTED_[testId];
  if (!fx) throw new Error("fixture not found: " + testId);
  if (!ex) throw new Error("expected not found: " + testId);

  var result = computeAmountsFromFixture_V3_(fx);
  return assertAmounts_(testId, result, ex);
}


/* =======================================================================
   runFixtureSuite_  ―  全 fixture 一括実行（メニューから呼び出す）
   ======================================================================= */
function runFixtureSuite_() {
  var ids  = Object.keys(JREC01_FIXTURES_);
  var pass = 0, fail = 0;
  var log  = [];

  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    try {
      var r = runFixtureTest_(id);
      if (r.pass) {
        pass++;
        log.push("[PASS] " + id);
      } else {
        fail++;
        log.push("[FAIL] " + id + "\n       " + r.diff);
      }
    } catch (e) {
      fail++;
      log.push("[ERROR] " + id + "\n       " + e.message);
    }
  }

  var summary = "PASS: " + pass + "  FAIL: " + fail + "  / " + ids.length;
  Logger.log(summary + "\n\n" + log.join("\n"));
  SpreadsheetApp.getUi().alert(summary + "\n\n" + log.join("\n"));
}
