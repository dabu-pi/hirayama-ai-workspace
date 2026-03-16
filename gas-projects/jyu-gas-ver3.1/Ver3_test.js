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
  warm:                 75,   // 2026-03-17 設定シート確認済み
  electro:              33,   // 2026-03-17 設定シート確認済み
  taiki:                5,    // 2026-03-17 設定シート確認済み
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

  // ── TC04: 30日境界 ─────────────────────────────────────────────────────
  "TC04a": {
    testId: "TC04a",
    context: { patientId: "P001", treatDate: "2026-02-04",
      monthlyStatus: { initBilled: true, reBilled: true, supportBilled: true } },
    cases: [
      { caseNo: 1, kubun: "後療", parts: [
        { bui: "腰部", byomei: "捻挫", injuryDate: "2026-01-05", cold: false, warm: false, electro: false }
      ]}
    ]
  },

  "TC04b": {
    testId: "TC04b",
    context: { patientId: "P001", treatDate: "2026-02-05",
      monthlyStatus: { initBilled: false, reBilled: false, supportBilled: false } },
    cases: [
      { caseNo: 1, kubun: "初検", parts: [
        { bui: "腰部", byomei: "捻挫", injuryDate: "2026-02-05", cold: false, warm: false, electro: false }
      ]}
    ]
  },

  // ── TC05: 冷罨法 打撲/捻挫 0-1日のみ ────────────────────────────────────
  "TC05a": {
    testId: "TC05a",
    context: { patientId: "P001", treatDate: "2026-02-01",
      monthlyStatus: { initBilled: false, reBilled: false, supportBilled: false } },
    cases: [
      { caseNo: 1, kubun: "初検", parts: [
        { bui: "腰部", byomei: "捻挫", injuryDate: "2026-02-01", cold: true, warm: false, electro: false }
      ]}
    ]
  },

  "TC05b": {
    testId: "TC05b",
    context: { patientId: "P001", treatDate: "2026-02-02",
      monthlyStatus: { initBilled: true, reBilled: false, supportBilled: true } },
    cases: [
      { caseNo: 1, kubun: "再検", parts: [
        { bui: "腰部", byomei: "捻挫", injuryDate: "2026-02-01", cold: true, warm: false, electro: false }
      ]}
    ]
  },

  "TC05c": {
    testId: "TC05c",
    context: { patientId: "P001", treatDate: "2026-02-03",
      monthlyStatus: { initBilled: true, reBilled: true, supportBilled: true } },
    cases: [
      { caseNo: 1, kubun: "後療", parts: [
        { bui: "腰部", byomei: "捻挫", injuryDate: "2026-02-01", cold: true, warm: false, electro: false }
      ]}
    ]
  },

  // ── TC06: 温/電 捻挫 5日以降 ─────────────────────────────────────────────
  "TC06a": {
    testId: "TC06a",
    context: { patientId: "P001", treatDate: "2026-02-05",
      monthlyStatus: { initBilled: true, reBilled: true, supportBilled: true } },
    cases: [
      { caseNo: 1, kubun: "後療", parts: [
        { bui: "腰部", byomei: "捻挫", injuryDate: "2026-02-01", cold: false, warm: true, electro: true }
      ]}
    ]
  },

  "TC06b": {
    testId: "TC06b",
    context: { patientId: "P001", treatDate: "2026-02-06",
      monthlyStatus: { initBilled: true, reBilled: true, supportBilled: true } },
    cases: [
      { caseNo: 1, kubun: "後療", parts: [
        { bui: "腰部", byomei: "捻挫", injuryDate: "2026-02-01", cold: false, warm: true, electro: true }
      ]}
    ]
  },

  // ── TC07: 温/電 骨折 7日以降 ─────────────────────────────────────────────
  "TC07a": {
    testId: "TC07a",
    context: { patientId: "P001", treatDate: "2026-02-07",
      monthlyStatus: { initBilled: true, reBilled: true, supportBilled: true } },
    cases: [
      { caseNo: 1, kubun: "後療", parts: [
        { bui: "前腕", byomei: "骨折", injuryDate: "2026-02-01", cold: false, warm: true, electro: true }
      ]}
    ]
  },

  "TC07b": {
    testId: "TC07b",
    context: { patientId: "P001", treatDate: "2026-02-08",
      monthlyStatus: { initBilled: true, reBilled: true, supportBilled: true } },
    cases: [
      { caseNo: 1, kubun: "後療", parts: [
        { bui: "前腕", byomei: "骨折", injuryDate: "2026-02-01", cold: false, warm: true, electro: true }
      ]}
    ]
  },

  // ── TC08: 冷罨法 脱臼 0-4日のみ ─────────────────────────────────────────
  // ⚠️ koryoDakkyu=0（TODO: 設定シートから確認後 TEST_SETTINGS_ を更新すること）
  "TC08a": {
    testId: "TC08a",
    context: { patientId: "P001", treatDate: "2026-02-05",
      monthlyStatus: { initBilled: true, reBilled: true, supportBilled: true } },
    cases: [
      { caseNo: 1, kubun: "後療", parts: [
        { bui: "肩関節", byomei: "脱臼", injuryDate: "2026-02-01", cold: true, warm: false, electro: false }
      ]}
    ]
  },

  "TC08b": {
    testId: "TC08b",
    context: { patientId: "P001", treatDate: "2026-02-06",
      monthlyStatus: { initBilled: true, reBilled: true, supportBilled: true } },
    cases: [
      { caseNo: 1, kubun: "後療", parts: [
        { bui: "肩関節", byomei: "脱臼", injuryDate: "2026-02-01", cold: true, warm: false, electro: false }
      ]}
    ]
  },

  // ── TC09: 月内再検消化後（両ケース後療） ────────────────────────────────
  "TC09": {
    testId: "TC09",
    context: { patientId: "P001", treatDate: "2026-02-12",
      monthlyStatus: { initBilled: true, reBilled: true, supportBilled: true } },
    cases: [
      { caseNo: 1, kubun: "後療", parts: [
        { bui: "腰部", byomei: "捻挫", injuryDate: "2026-02-01", cold: false, warm: false, electro: false }
      ]},
      { caseNo: 2, kubun: "後療", parts: [
        { bui: "肩関節", byomei: "打撲", injuryDate: "2026-02-10", cold: false, warm: false, electro: false }
      ]}
    ]
  },

  // ── TC10: 複合（初検抑制 + 冷不可 + 温電可） ────────────────────────────
  "TC10": {
    testId: "TC10",
    context: { patientId: "P001", treatDate: "2026-02-10",
      monthlyStatus: { initBilled: true, reBilled: true, supportBilled: true } },
    cases: [
      { caseNo: 1, kubun: "後療", parts: [
        { bui: "腰部", byomei: "捻挫", injuryDate: "2026-02-01", cold: false, warm: false, electro: false }
      ]},
      { caseNo: 2, kubun: "初検", parts: [
        { bui: "肩関節", byomei: "捻挫", injuryDate: "2026-02-01", cold: true, warm: true, electro: true }
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

  // ── TC04 ──────────────────────────────────────────────────────────────
  "TC04a": {
    header: { initFee: 0, reFee: 0, supportFee: 0, detailSum: 505, visitTotal: 505,
      needCheck: false, needCheckReason: "",
      billedKubun: "後療", mixedFlag: "通常",
      case1Summary: "case1:後療", case2Summary: "case2:なし", chargeReason: "後療のみ" },
    details: [
      { detailID: "P001_2026-02-04_C1_P1", kubun: "後療", baseOut: 505, coldOut: 0, rowTotalOut: 505 }
    ]
  },

  "TC04b": {
    header: { initFee: 1550, reFee: 0, supportFee: 100, detailSum: 760, visitTotal: 2410,
      needCheck: false, needCheckReason: "",
      billedKubun: "初検", mixedFlag: "通常",
      case1Summary: "case1:初検", case2Summary: "case2:なし", chargeReason: "初検のみ" },
    details: [
      { detailID: "P001_2026-02-05_C1_P1", kubun: "初検", baseOut: 760, coldOut: 0, rowTotalOut: 760 }
    ]
  },

  // ── TC05 ──────────────────────────────────────────────────────────────
  "TC05a": {
    header: { initFee: 1550, reFee: 0, supportFee: 100, detailSum: 845, visitTotal: 2495,
      needCheck: false, needCheckReason: "",
      billedKubun: "初検", mixedFlag: "通常",
      case1Summary: "case1:初検", case2Summary: "case2:なし", chargeReason: "初検のみ" },
    details: [
      { detailID: "P001_2026-02-01_C1_P1", kubun: "初検", baseOut: 760, coldOut: 85, rowTotalOut: 845 }
    ]
  },

  "TC05b": {
    header: { initFee: 0, reFee: 410, supportFee: 0, detailSum: 590, visitTotal: 1000,
      needCheck: false, needCheckReason: "",
      billedKubun: "再検", mixedFlag: "通常",
      case1Summary: "case1:再検", case2Summary: "case2:なし", chargeReason: "再検のみ" },
    details: [
      { detailID: "P001_2026-02-02_C1_P1", kubun: "再検", baseOut: 505, coldOut: 85, rowTotalOut: 590 }
    ]
  },

  "TC05c": {
    header: { initFee: 0, reFee: 0, supportFee: 0, detailSum: 505, visitTotal: 505,
      needCheck: true, needCheckReason: "冷罨法 算定不可（捻挫：受傷後2日）",
      billedKubun: "後療", mixedFlag: "通常",
      case1Summary: "case1:後療", case2Summary: "case2:なし", chargeReason: "後療のみ" },
    details: [
      { detailID: "P001_2026-02-03_C1_P1", kubun: "後療", baseOut: 505, coldOut: 0, rowTotalOut: 505 }
    ]
  },

  // ── TC06 ──────────────────────────────────────────────────────────────
  "TC06a": {
    header: { initFee: 0, reFee: 0, supportFee: 0, detailSum: 505, visitTotal: 505,
      needCheck: true, needCheckReason: "温罨法 算定不可（捻挫：受傷後4日）;電療 算定不可（捻挫：受傷後4日）",
      billedKubun: "後療", mixedFlag: "通常",
      case1Summary: "case1:後療", case2Summary: "case2:なし", chargeReason: "後療のみ" },
    details: [
      { detailID: "P001_2026-02-05_C1_P1", kubun: "後療", baseOut: 505, coldOut: 0, warmOut: 0, electroOut: 0, rowTotalOut: 505 }
    ]
  },

  "TC06b": {
    header: { initFee: 0, reFee: 0, supportFee: 0, detailSum: 618, visitTotal: 618,
      needCheck: false, needCheckReason: "",
      billedKubun: "後療", mixedFlag: "通常",
      case1Summary: "case1:後療", case2Summary: "case2:なし", chargeReason: "後療のみ" },
    details: [
      { detailID: "P001_2026-02-06_C1_P1", kubun: "後療", baseOut: 505, coldOut: 0, warmOut: 75, electroOut: 33, rowTotalOut: 618 }
    ]
  },

  // ── TC07 ──────────────────────────────────────────────────────────────
  "TC07a": {
    header: { initFee: 0, reFee: 0, supportFee: 0, detailSum: 850, visitTotal: 850,
      needCheck: true, needCheckReason: "温罨法 算定不可（骨折：受傷後6日）;電療 算定不可（骨折：受傷後6日）",
      billedKubun: "後療", mixedFlag: "通常",
      case1Summary: "case1:後療", case2Summary: "case2:なし", chargeReason: "後療のみ" },
    details: [
      { detailID: "P001_2026-02-07_C1_P1", kubun: "後療", baseOut: 850, coldOut: 0, warmOut: 0, electroOut: 0, rowTotalOut: 850 }
    ]
  },

  "TC07b": {
    header: { initFee: 0, reFee: 0, supportFee: 0, detailSum: 963, visitTotal: 963,
      needCheck: false, needCheckReason: "",
      billedKubun: "後療", mixedFlag: "通常",
      case1Summary: "case1:後療", case2Summary: "case2:なし", chargeReason: "後療のみ" },
    details: [
      { detailID: "P001_2026-02-08_C1_P1", kubun: "後療", baseOut: 850, coldOut: 0, warmOut: 75, electroOut: 33, rowTotalOut: 963 }
    ]
  },

  // ── TC08 ──────────────────────────────────────────────────────────────
  // ⚠️ baseOut=0 は koryoDakkyu 未確認のプレースホルダ。設定シート確認後に更新すること
  "TC08a": {
    header: { initFee: 0, reFee: 0, supportFee: 0, detailSum: 85, visitTotal: 85,
      needCheck: false, needCheckReason: "",
      billedKubun: "後療", mixedFlag: "通常",
      case1Summary: "case1:後療", case2Summary: "case2:なし", chargeReason: "後療のみ" },
    details: [
      { detailID: "P001_2026-02-05_C1_P1", kubun: "後療", baseOut: 0, coldOut: 85, rowTotalOut: 85 }
    ]
  },

  "TC08b": {
    header: { initFee: 0, reFee: 0, supportFee: 0, detailSum: 0, visitTotal: 0,
      needCheck: true, needCheckReason: "冷罨法 算定不可（脱臼：受傷後5日）",
      billedKubun: "後療", mixedFlag: "通常",
      case1Summary: "case1:後療", case2Summary: "case2:なし", chargeReason: "後療のみ" },
    details: [
      { detailID: "P001_2026-02-06_C1_P1", kubun: "後療", baseOut: 0, coldOut: 0, rowTotalOut: 0 }
    ]
  },

  // ── TC09 ──────────────────────────────────────────────────────────────
  "TC09": {
    header: { initFee: 0, reFee: 0, supportFee: 0, detailSum: 1010, visitTotal: 1010,
      needCheck: false, needCheckReason: "",
      billedKubun: "後療", mixedFlag: "Mixed",
      case1Summary: "case1:後療", case2Summary: "case2:後療", chargeReason: "後療のみ" },
    details: [
      { detailID: "P001_2026-02-12_C1_P1", kubun: "後療", baseOut: 505, coldOut: 0, rowTotalOut: 505 },
      { detailID: "P001_2026-02-12_C2_P1", kubun: "後療", baseOut: 505, coldOut: 0, rowTotalOut: 505 }
    ]
  },

  // ── TC10 ──────────────────────────────────────────────────────────────
  "TC10": {
    header: { initFee: 0, reFee: 0, supportFee: 0, detailSum: 1123, visitTotal: 1123,
      needCheck: true, needCheckReason: "同月別ケース初回 初検抑制;冷罨法 算定不可（捻挫：受傷後9日）",
      billedKubun: "後療", mixedFlag: "Mixed",
      case1Summary: "case1:後療", case2Summary: "case2:初検(抑制)", chargeReason: "初検抑制かつ再検対象なし" },
    details: [
      { detailID: "P001_2026-02-10_C1_P1", kubun: "後療", baseOut: 505, coldOut: 0, rowTotalOut: 505 },
      { detailID: "P001_2026-02-10_C2_P1", kubun: "後療", baseOut: 505, coldOut: 0, warmOut: 75, electroOut: 33, rowTotalOut: 618 }
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


/* =======================================================================
   公開ラッパー関数（Apps Script 実行メニューに表示される）
   末尾アンダースコアなし・引数なし
   ======================================================================= */
function runFixtureSuite()  { runFixtureSuite_(); }
function runFixtureTC01()   { showFixtureResult_("TC01"); }
function runFixtureTC02()   { showFixtureResult_("TC02"); }
function runFixtureTC03()   { showFixtureResult_("TC03"); }
function runFixtureTC04a()  { showFixtureResult_("TC04a"); }
function runFixtureTC04b()  { showFixtureResult_("TC04b"); }
function runFixtureTC05a()  { showFixtureResult_("TC05a"); }
function runFixtureTC05b()  { showFixtureResult_("TC05b"); }
function runFixtureTC05c()  { showFixtureResult_("TC05c"); }
function runFixtureTC06a()  { showFixtureResult_("TC06a"); }
function runFixtureTC06b()  { showFixtureResult_("TC06b"); }
function runFixtureTC07a()  { showFixtureResult_("TC07a"); }
function runFixtureTC07b()  { showFixtureResult_("TC07b"); }
function runFixtureTC08a()  { showFixtureResult_("TC08a"); }
function runFixtureTC08b()  { showFixtureResult_("TC08b"); }
function runFixtureTC09()   { showFixtureResult_("TC09"); }
function runFixtureTC10()   { showFixtureResult_("TC10"); }
function runFixtureM01()    { showFixtureResult_("M01"); }
function runFixtureM02()    { showFixtureResult_("M02"); }
function runFixtureM03()    { showFixtureResult_("M03"); }
function runFixtureM04()    { showFixtureResult_("M04"); }
function runFixtureM05()    { showFixtureResult_("M05"); }

function showFixtureResult_(testId) {
  var r = runFixtureTest_(testId);
  var msg = r.pass
    ? "[PASS] " + testId
    : "[FAIL] " + testId + "\n\n" + r.diff;
  Logger.log(msg);
  SpreadsheetApp.getUi().alert(msg);
}
