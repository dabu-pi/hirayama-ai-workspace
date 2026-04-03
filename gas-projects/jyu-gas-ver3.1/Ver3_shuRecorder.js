/****************************************************
 * Ver3_shuRecorder.js — WS-SR 施術録 月次出力
 *
 * 機能:
 *   JREC の日次入力データから施術録テンプレート（Google Docs）を複製・
 *   差し込みして PDF を自動生成する。
 *
 * エントリポイント:
 *   srShowDialog() — カスタムメニュー「施術録を出力」から呼び出す。
 *
 * ★ Ver3_core.js の onOpen() 末尾に以下を追加すること:
 *   .addSeparator()
 *   .addItem('施術録を出力', 'srShowDialog')
 *
 * テンプレート ID  : 1Tcq8kcwFfIzFixGF54xFoWyZcNz7IsgjYsT8NqV0mnY
 * 出力フォルダ ID  : 1XMx2e1ufCRqp7bhpfRRjvPDyXCESL83V
 *
 * 設計書: docs/施術録導線/JREC-01_施術録実装設計.md
 * フェーズ: WS-SR Phase 1 (T-SR-02 〜 T-SR-09)
 ****************************************************/

// ===== 定数 (T-SR-02) =====
var SR_TEMPLATE_ID    = '1Tcq8kcwFfIzFixGF54xFoWyZcNz7IsgjYsT8NqV0mnY';
var SR_ROOT_FOLDER_ID = '1XMx2e1ufCRqp7bhpfRRjvPDyXCESL83V';
var SR_SUBFOLDER_NAME = '施術録';

/**
 * 裏面 日別明細テーブル 列Indexマッピング
 * T-SR-10v4 修正:
 * - 実テンプレの grouped cell 前提に寄せる。
 * - 月/日は左端 1 セルに M/D 形式で出力する。
 * - 初検料等は明細 baseOut のうち kubun=初検 を表示用に載せる。
 * - 判定なしは blank 維持。0 は表示しない。
 * ★最終的な fallback はこの定数。実テンプレ変更時の手修正起点にも使う。
 */
var SR_URAME_COL = {
  date:    0,   // 月/日（左端 1 セル）
  initial: 1,   // 初検料/再検料/初検時相談支援料 など grouped cell
  shiryo:  4,   // 施療料（初検日の基本料）— fallback: 目印「施療料はここ」で上書き
  koryo:   5,   // 後療料（再検・後療日の基本料）— fallback: 目印「後療料はここ」で上書き
  base:    5,   // 後方互換（srResolveUrameCols_ offset 計算の基準）
  cold:    7,   // 冷罨法料（combined header の場合は warm と同セル）
  warm:    7,   // 温罨法料
  elec:    8,   // 電療料
  copay:   11,  // 一部負担金
  notes:   13,  // 整復・施療等の施術経過所見
};

/**
 * 裏面 ①集計行 列Indexマッピング
 * T-SR-10v2 実機テスト後に実態に合わせて修正すること。
 */
var SR_SUM_COL = {
  month:     1,  // 月の値
  countVal:  3,  // 合計回数
  totalVal:  5,  // 合計金額
  copayVal:  7,  // 一部負担額
  dateFrom:  10, // 自（請求期間開始）
  dateTo:    12, // 至（請求期間終了）
  days:      13, // 日間
};

/**
 * 施術終了年月日プレースホルダー（転帰なし=施術継続中）
 * 転帰が記載されていない限り実日付は入れず、このプレースホルダーを表示する。
 * 2026-04-03 T-SR-17: '　　年　　月　　日'（全角スペース）は文字ずれするため
 *   '年月日' に変更（見た目優先・ずれにくい最短表記）
 */
var SR_END_DATE_PLACEHOLDER = '年　月　日';  // 全角スペース1つ入り（詰まり防止）

/** 初検情報のデフォルト空オブジェクト（初検情報履歴なし時に使用） */
var SR_EMPTY_INIT_EXAM_ = { injuryDatetime: '', injuryPlace: '', injuryStatus: '', initFindings: '' };


/* =======================================================================
   ① ダイアログ / エントリポイント (T-SR-09)
   ======================================================================= */

/**
 * カスタムメニューから呼び出す。
 * 患者ID と対象年月をダイアログで受け取り srGenerateDocument() を実行する。
 */
function srShowDialog() {
  var html = HtmlService.createHtmlOutput(
    '<style>' +
    'body{font-family:"Noto Sans JP",sans-serif;padding:16px;font-size:13px;}' +
    'p{margin:4px 0 2px;}' +
    'input{width:100%;box-sizing:border-box;padding:6px;margin-bottom:8px;border:1px solid #ccc;border-radius:3px;}' +
    'button{padding:8px 20px;background:#1a73e8;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;}' +
    '#msg{margin-top:10px;font-size:12px;white-space:pre-wrap;}' +
    '</style>' +
    '<p><b>患者ID</b></p>' +
    '<input id="pid" placeholder="例: P001"/>' +
    '<p><b>対象年月（YYYY-MM）</b></p>' +
    '<input id="ym" placeholder="例: 2026-04"/>' +
    '<button onclick="run()">施術録を出力</button>' +
    '<p id="msg"></p>' +
    '<script>' +
    'function run(){' +
    '  var pid = document.getElementById("pid").value.trim();' +
    '  var ym  = document.getElementById("ym").value.trim();' +
    '  var msg = document.getElementById("msg");' +
    '  if(!pid || !ym){msg.style.color="red";msg.textContent="入力してください";return;}' +
    '  msg.style.color="#555";msg.textContent="処理中...";' +
    '  google.script.run' +
    '    .withSuccessHandler(function(r){msg.style.color="green";msg.textContent=r;})' +
    '    .withFailureHandler(function(e){msg.style.color="red";msg.textContent="エラー: "+e.message;})' +
    '    .srGenerateDocument(pid, ym);' +
    '}' +
    '</script>'
  ).setWidth(340).setHeight(280).setTitle('施術録を出力');
  SpreadsheetApp.getUi().showModalDialog(html, '施術録を出力');
}


/* =======================================================================
   ② メイン処理 (T-SR-02)
   ======================================================================= */

/**
 * 施術録を生成してドライブに保存する。
 * @param {string} patientId - 患者ID
 * @param {string} yearMonth - 対象年月 "YYYY-MM"
 * @return {string} 完了メッセージ（ダイアログに表示）
 */
function srGenerateDocument(patientId, yearMonth) {
  patientId = String(patientId || '').trim();
  yearMonth  = String(yearMonth  || '').trim();

  if (!patientId)
    throw new Error('患者ID が未入力です');
  if (!/^\d{4}-\d{2}$/.test(yearMonth))
    throw new Error('年月は YYYY-MM 形式で入力してください（例: 2026-04）');

  var ss      = SpreadsheetApp.getActiveSpreadsheet();
  var ymParts = yearMonth.split('-');

  // ----- データ取得 -----
  var patient = srGetPatientData_(ss, patientId);
  if (!patient)
    throw new Error('患者マスタに見つかりません: ' + patientId);

  var visitRows = srGetVisitRows_(ss, patientId, yearMonth);
  if (visitRows.length === 0)
    throw new Error(yearMonth + ' に来院記録がありません: ' + patientId);

  var caseData = srGetCaseData_(ss, patientId, yearMonth);
  // ★2件目対応(2026-04-03): 全件昇順取得。[0]=表面用(earliest=case1相当), [1]=裏面2件目用(case2相当)
  var initExamAll = srGetAllInitExamData_(ss, patientId);
  var initExam  = initExamAll.length > 0 ? initExamAll[0] : SR_EMPTY_INIT_EXAM_;
  var initExam2 = initExamAll.length > 1 ? initExamAll[1] : null;

  // ★診断 Logger (T-SR-18): 2件目情報の取得状況確認
  Logger.log('[DIAG-A] caseData.d2="' + caseData.d2 + '" inj2="' + caseData.inj2 +
             '" start2="' + caseData.start2 + '" tenki2="' + caseData.tenki2 + '"');
  Logger.log('[DIAG-B] initExamAll.length=' + initExamAll.length +
             ' initExam2=' + (initExam2 ? JSON.stringify(initExam2) : 'null'));

  // ----- 出力先 -----
  var filename  = '施術録_' + patient.name + '_' + ymParts[0] + '年' + ymParts[1] + '月';
  var outFolder = srGetOrCreateOutputFolder_(yearMonth);

  // ----- 既存ファイル確認 (T-SR-09) -----
  var existing = srFindExistingFile_(outFolder, filename);
  if (existing) {
    var ui   = SpreadsheetApp.getUi();
    var resp = ui.alert(
      '上書き確認',
      '[' + filename + '] が既に存在します。\n上書きしますか？',
      ui.ButtonSet.YES_NO
    );
    if (resp !== ui.Button.YES) return '施術録の出力をキャンセルしました。';
    existing.setTrashed(true);
    Utilities.sleep(500); // ゴミ箱移動の反映を待つ
  }

  // ----- テンプレート複製 -----
  var docId = srDuplicateTemplate_(outFolder, filename);

  // ----- 差し込み -----
  srInsertHyomenData_(docId, patient, caseData, initExam);
  srInsertUrameData_(docId, visitRows, parseInt(ymParts[1]), caseData, initExam2);

  // ----- PDF 出力 -----
  var pdfId = srExportPdf_(docId, outFolder, filename);

  Logger.log('SR 出力完了 docId=' + docId + ' pdfId=' + pdfId);
  return '✅ 出力完了: ' + filename +
         '\nGDocs: https://docs.google.com/document/d/' + docId +
         '\nPDF:   https://drive.google.com/file/d/' + pdfId;
}

/**
 * 開発用: T-SR-10v2 再テストの固定ケースを no-arg で実行する。
 * clasp run の JSON 引数崩れを避けるためのラッパー。
 */
function srRunTsr10v2Debug_() {
  return srGenerateDocument('P001', '2026-03');
}


/* =======================================================================
   ③ データ取得 (T-SR-03, T-SR-04)
   ======================================================================= */

/**
 * 患者マスタから1件取得して返す。
 * @return {Object|null}
 */
function srGetPatientData_(ss, patientId) {
  var sh   = ss.getSheetByName(SHEETS.master);
  var data = sh.getDataRange().getValues();
  var hdrs = data[0];
  var mc   = V3TR.CONFIG.masterCols;

  var ci = function(name) { return hdrs.indexOf(name); };

  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    if (String(row[ci(mc.patientId)] || '').trim() !== patientId) continue;

    var addr1 = String(row[ci(mc.address1)] || '');
    var addr2 = String(row[ci(mc.address2)] || '');
    return {
      name:         String(row[ci(mc.name)]         || ''),
      birthday:     srFormatDate_(row[ci(mc.birthday)], 'wareki'),
      gender:       String(row[ci(mc.gender)]       || ''),
      address:      addr1 + (addr2 ? ' ' + addr2 : ''),
      relation:     String(row[ci(mc.relation)]     || ''),
      insuredName:  String(row[ci(mc.insuredName)]  || ''),
      insurerNo:    String(row[ci(mc.insurerNo)]    || ''),
      symbol:       String(row[ci(mc.symbol)]       || ''),
      number:       String(row[ci(mc.number)]       || ''),
      insurerName:  String(row[ci(mc.insurerName)]  || ''),
    };
  }
  return null;
}

/**
 * 来院ヘッダ + 施術明細 + 来院ケース所見 を結合し、
 * 対象月の保険来院日一覧を日付昇順で返す。
 * ★Bug 1修正: 会計区分="自費のみ" の来院日を除外する。
 * ★Bug 2修正: cold / warm を別フィールドで返す。
 * ★正本統一修正(2026-04-02):
 *   initialAmount = 来院ヘッダの initFee+supportFee+reFee（申請書算定結果を正本とする）
 *   shiryoOut / koryoOut = kubun で分離（初検→施療料 / 再検・後療→後療料）
 *   これにより「初検抑制日(case2同月2番目の初検)」でも initialAmount=0 となり申請書と整合する。
 *   再検料も initialAmount に正しく反映される。
 * @return {Array} [{month, day, date, initialAmount, shiryoOut, koryoOut, cold, warm, elecOut, copay, notes}, ...]
 *   initialAmount: 施術録裏面の初検料等表示用 = initFee + supportFee + reFee（来院ヘッダ）
 *   shiryoOut:     施術録裏面の施療料表示用 = kubun=初検 の baseOut 合計
 *   koryoOut:      施術録裏面の後療料表示用 = kubun=再検/後療 の baseOut 合計
 */
function srGetVisitRows_(ss, patientId, yearMonth) {
  var ymParts    = yearMonth.split('-');
  var year       = parseInt(ymParts[0]);
  var month      = parseInt(ymParts[1]);
  var monthStart = new Date(year, month - 1, 1);
  var monthEnd   = new Date(year, month, 0);   // 月末日

  // ----- 来院ヘッダ → visitKey マップ -----
  var hdrSh   = ss.getSheetByName(SHEETS.header);
  var hdrData = hdrSh.getDataRange().getValues();
  var hHdrs   = hdrData[0];
  var hc      = HEADER_COLS;
  var hci     = function(n) { return hHdrs.indexOf(n); };

  // 会計区分列のインデックス（列なしなら -1）
  var acctIdx = hci(hc.accountingType);  // "会計区分"

  var headerMap = {};  // visitKey → {month, day, date, initial, copay}
  for (var r = 1; r < hdrData.length; r++) {
    var hrow = hdrData[r];
    if (String(hrow[hci(hc.patientId)] || '').trim() !== patientId) continue;
    var raw  = hrow[hci(hc.treatDate)];
    var dt   = (raw instanceof Date) ? raw : new Date(raw);
    if (isNaN(dt) || dt < monthStart || dt > monthEnd) continue;
    var vk = String(hrow[hci(hc.visitKey)] || '');
    if (!vk) continue;

    // ★Bug 1修正: 自費のみ来院を除外（保険なし日が裏面に混入しないよう防止）
    var acctType = (acctIdx >= 0) ? String(hrow[acctIdx] || '') : '';
    if (acctType === '自費のみ') continue;

    // ★正本統一修正: 初検料等は来院ヘッダの算定済み値を使う
    var hInitFee   = Number(hrow[hci(hc.initFee)]    || 0);
    var hSupportFee= Number(hrow[hci(hc.supportFee)] || 0);
    var hReFee     = Number(hrow[hci(hc.reFee)]      || 0);

    headerMap[vk] = {
      month:    dt.getMonth() + 1,
      day:      dt.getDate(),
      date:     dt,
      initial:  hInitFee + hSupportFee + hReFee,  // 申請書と同一ロジックの算定結果
      copay:    Number(hrow[hci(hc.windowPay)] || 0),
      visitKey: vk,
    };
  }

  // ----- 施術明細 → visitKey 別合計 -----
  var dtlSh   = ss.getSheetByName(SHEETS.detail);
  var dtlData = dtlSh.getDataRange().getValues();
  var dHdrs   = dtlData[0];
  var dc      = AM_DETAIL_COLS;
  var dci     = function(n) { return dHdrs.indexOf(n); };

  // ★施療料/後療料分離(v5): kubun=初検 → shiryo / それ以外(再検・後療) → koryo
  var amountMap = {};  // visitKey → {shiryo, koryo, cold, warm, elec}
  for (var r2 = 1; r2 < dtlData.length; r2++) {
    var drow = dtlData[r2];
    var vk2  = String(drow[dci(dc.visitKey)] || '');
    if (!headerMap[vk2]) continue;
    if (!amountMap[vk2]) amountMap[vk2] = { shiryo: 0, koryo: 0, cold: 0, warm: 0, elec: 0 };
    var kubunVal2 = String(drow[dci(dc.kubun)] || '').trim();
    var baseVal2  = Number(drow[dci(dc.baseOut)] || 0);
    if (kubunVal2 === '初検') {
      amountMap[vk2].shiryo += baseVal2;  // 施療料（初検日の基本料）
    } else {
      amountMap[vk2].koryo  += baseVal2;  // 後療料（再検・後療日の基本料）
    }
    amountMap[vk2].cold += Number(drow[dci(dc.coldOut)]    || 0);
    amountMap[vk2].warm += Number(drow[dci(dc.warmOut)]    || 0);
    amountMap[vk2].elec += Number(drow[dci(dc.electroOut)] || 0);
  }

  // ----- 来院ケース → visitKey 別 最新所見 -----
  var csSh   = ss.getSheetByName(SHEETS.cases);
  var csData = csSh.getDataRange().getValues();
  var cHdrs  = csData[0];
  var cc     = CASE_COLS;
  var cci    = function(n) { return cHdrs.indexOf(n); };

  var notesMap = {};  // visitKey → 所見テキスト
  for (var r3 = 1; r3 < csData.length; r3++) {
    var crow = csData[r3];
    if (String(crow[cci(cc.patientId)] || '').trim() !== patientId) continue;
    var vk3 = String(crow[cci(cc.visitKey)] || '');
    if (!headerMap[vk3]) continue;
    // 所見優先・なければ経過_今回
    var sho = String(crow[cci(cc.shoken)]   || '');
    var kei = String(crow[cci(cc.keikaNow)] || '');
    if (!notesMap[vk3] || sho) notesMap[vk3] = sho || kei;
  }

  // ----- 結合・日付昇順ソート -----
  var result = [];
  for (var vk in headerMap) {
    var h  = headerMap[vk];
    var am = amountMap[vk] || { shiryo: 0, koryo: 0, cold: 0, warm: 0, elec: 0 };
    result.push({
      visitKey:      vk,
      month:         h.month,
      day:           h.day,
      date:          h.date,
      initialAmount: h.initial,   // ★正本統一修正: 来院ヘッダの initFee+supportFee+reFee
      shiryoOut:     am.shiryo,   // 施療料（初検日の基本料 / kubun=初検）
      koryoOut:      am.koryo,    // 後療料（再検・後療日の基本料 / kubun≠初検）
      cold:          am.cold,    // ★Bug 2修正: 冷罨法料（単独）
      warm:          am.warm,    // ★Bug 2修正: 温罨法料（単独）
      elecOut:       am.elec,
      copay:         h.copay,
      notes:         notesMap[vk] || '',
    });
  }
  result.sort(function(a, b) { return a.date - b.date; });
  return result;
}

/**
 * 来院ケースシートから表面の負傷名・日付・日数・回数を返す。
 *
 * ★Bug 3修正: 施術回数 = V3TR_aggregateDetailMonthly_ の visitDays（実来院日数）
 * ★Bug 4修正: 日数 = V3TR_aggregateDetailMonthly_ の visitDays（実来院日数）
 * ★Bug 5修正: 負傷名 = 部位_部位1 + 傷病_部位1 を組み合わせる
 * ★正本統一修正(2026-04-02):
 *   来院ケース行を caseNo で分離して取得する。
 *   - 負傷名1 = case1（caseNo=1）の部位_部位1 + 傷病_部位1
 *   - 負傷名2 = case2（caseNo=2）が存在すれば case2 の部位_部位1 + 傷病_部位1
 *              case2 なし かつ case1 に部位_部位2 があれば case1 の部位2
 *              どちらもなければ空欄
 *   旧実装は cc.p2/d2（= case1の部位_部位2）を負傷名2に使っていたため、
 *   case2（別エピソード）がある患者で負傷名2 が欠落する問題があった。
 *   visitDays も case2 用は detailAgg.case2 から取得するよう修正。
 */
function srGetCaseData_(ss, patientId, yearMonth) {
  var ymParts  = yearMonth.split('-');
  var year     = parseInt(ymParts[0]);
  var month    = parseInt(ymParts[1]);
  var start    = new Date(year, month - 1, 1);
  var end      = new Date(year, month, 1);  // exclusive

  // ── 来院ケースを caseNo 別に収集 ──
  var sh   = ss.getSheetByName(SHEETS.cases);
  var data = sh.getDataRange().getValues();
  var hdrs = data[0];
  var cc   = CASE_COLS;
  var ci   = function(n) { return hdrs.indexOf(n); };

  var c1 = null;  // case1 データ
  var c2 = null;  // case2 データ（別エピソード）

  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    if (String(row[ci(cc.patientId)] || '').trim() !== patientId) continue;
    var raw = row[ci(cc.treatDate)];
    var dt  = (raw instanceof Date) ? raw : new Date(raw);
    if (isNaN(dt)) continue;
    if (dt.getFullYear() !== year || dt.getMonth() + 1 !== month) continue;

    var cno = String(row[ci(cc.caseNo)] || '1').trim();

    if (cno === '1' || cno === 1) {
      // ── case1 ──
      if (!c1) {
        c1 = {
          p1: String(row[ci(cc.p1)] || ''),   // 部位_部位1
          d1: String(row[ci(cc.d1)] || ''),   // 傷病_部位1
          p2: String(row[ci(cc.p2)] || ''),   // 部位_部位2（case1の2か所目）
          d2: String(row[ci(cc.d2)] || ''),   // 傷病_部位2
          inj1:   row[ci(cc.inj1)],
          inj2:   row[ci(cc.inj2)],
          start1: row[ci(cc.start1)],
          start2: row[ci(cc.start2)],
          end1: null, end2: null, tenki1: '', tenki2: '',
        };
      }
      srBackfillCaseValue_(c1, 'p1',     String(row[ci(cc.p1)] || ''));
      srBackfillCaseValue_(c1, 'd1',     String(row[ci(cc.d1)] || ''));
      srBackfillCaseValue_(c1, 'p2',     String(row[ci(cc.p2)] || ''));
      srBackfillCaseValue_(c1, 'd2',     String(row[ci(cc.d2)] || ''));
      srBackfillCaseValue_(c1, 'inj1',   row[ci(cc.inj1)]);
      srBackfillCaseValue_(c1, 'inj2',   row[ci(cc.inj2)]);
      srBackfillCaseValue_(c1, 'start1', row[ci(cc.start1)]);
      srBackfillCaseValue_(c1, 'start2', row[ci(cc.start2)]);
      // 転帰・終了日は月内の最終行で上書き
      if (row[ci(cc.tenki1)]) c1.tenki1 = String(row[ci(cc.tenki1)]);
      if (row[ci(cc.tenki2)]) c1.tenki2 = String(row[ci(cc.tenki2)]);
      if (row[ci(cc.end1)])   c1.end1   = row[ci(cc.end1)];
      if (row[ci(cc.end2)])   c1.end2   = row[ci(cc.end2)];

    } else {
      // ── case2（別エピソード）── caseNo=2 の行から部位_部位1 を使う
      if (!c2) {
        c2 = {
          p1:     String(row[ci(cc.p1)] || ''),  // case2 の部位1
          d1:     String(row[ci(cc.d1)] || ''),  // case2 の傷病1
          inj1:   row[ci(cc.inj1)],
          start1: row[ci(cc.start1)],
          end1: null, tenki1: '',
        };
      }
      srBackfillCaseValue_(c2, 'p1',     String(row[ci(cc.p1)] || ''));
      srBackfillCaseValue_(c2, 'd1',     String(row[ci(cc.d1)] || ''));
      srBackfillCaseValue_(c2, 'inj1',   row[ci(cc.inj1)]);
      srBackfillCaseValue_(c2, 'start1', row[ci(cc.start1)]);
      if (row[ci(cc.tenki1)]) c2.tenki1 = String(row[ci(cc.tenki1)]);
      if (row[ci(cc.end1)])   c2.end1   = row[ci(cc.end1)];
    }
  }

  if (!c1 && !c2) {
    return {
      d1:'', d2:'', inj1:'', inj2:'', start1:'', start2:'',
      end1:'', end2:'', tenki1:'', tenki2:'',
      nissuu1:'', nissuu2:'', count1:'', count2:'',
    };
  }

  // ── V3TR 月次集計から visitDays（実日数）取得 ──
  // endDates に case2 の終了日も渡す（正本統一修正）
  var shDetail = ss.getSheetByName(SHEETS.detail);
  var endDates = {
    1: {
      1: (c1 && c1.end1 instanceof Date) ? c1.end1 : null,
      2: (c1 && c1.end2 instanceof Date) ? c1.end2 : null,
    },
    2: {
      1: (c2 && c2.end1 instanceof Date) ? c2.end1 : null,
      2: null,
    },
  };
  var detailAgg = V3TR_aggregateDetailMonthly_(shDetail, patientId, start, end, endDates);
  var agg1 = detailAgg.case1 || {};
  var agg2 = detailAgg.case2 || {};

  // days1: case1 part1 の来院日数
  var days1 = ((agg1.parts && agg1.parts[1] && agg1.parts[1].visitDays > 0)
               ? agg1.parts[1].visitDays
               : (agg1.visitDays || 0));

  // days2: case2 があれば case2.visitDays、なければ case1 part2
  var days2 = 0;
  if (c2) {
    days2 = agg2.visitDays || 0;
  } else if (c1 && (c1.p2 || c1.d2)) {
    days2 = ((agg1.parts && agg1.parts[2] && agg1.parts[2].visitDays > 0)
             ? agg1.parts[2].visitDays
             : (agg1.visitDays || 0));
  }

  // ── 負傷名の組み立て ──
  var name1 = c1
    ? ((c1.p1 && c1.d1) ? (c1.p1 + ' ' + c1.d1).trim() : (c1.p1 || c1.d1 || ''))
    : '';

  // 負傷名2: case2（別エピソード）優先 → case1 part2 → 空欄
  var name2, inj2, start2, end2, tenki2;
  if (c2) {
    // ★正本統一修正: case2 の部位1 を使う
    name2  = (c2.p1 && c2.d1) ? (c2.p1 + ' ' + c2.d1).trim() : (c2.p1 || c2.d1 || '');
    inj2   = c2.inj1   ? srFormatDate_(c2.inj1,   'wareki') : '';
    start2 = c2.start1 ? srFormatDate_(c2.start1, 'wareki') : '';
    end2   = c2.end1   ? srFormatDate_(c2.end1,   'wareki') : '';
    tenki2 = c2.tenki1 || '';
  } else if (c1 && (c1.p2 || c1.d2)) {
    // case2 なし・case1 に部位2 あり
    name2  = (c1.p2 && c1.d2) ? (c1.p2 + ' ' + c1.d2).trim() : (c1.p2 || c1.d2 || '');
    inj2   = c1.inj2   ? srFormatDate_(c1.inj2,   'wareki') : '';
    start2 = c1.start2 ? srFormatDate_(c1.start2, 'wareki') : '';
    end2   = c1.end2   ? srFormatDate_(c1.end2,   'wareki') : '';
    tenki2 = c1.tenki2 || '';
  } else {
    name2 = inj2 = start2 = end2 = tenki2 = '';
  }

  var hasP2 = !!(name2);

  return {
    d1:      name1,
    d2:      name2,
    inj1:    c1 ? srFormatDate_(c1.inj1,   'wareki') : '',
    inj2:    inj2,
    start1:  c1 ? srFormatDate_(c1.start1, 'wareki') : '',
    start2:  start2,
    end1:    (c1 && c1.end1) ? srFormatDate_(c1.end1, 'wareki') : '',
    end2:    end2,
    tenki1:  c1 ? (c1.tenki1 || '') : '',
    tenki2:  tenki2,
    nissuu1: days1 > 0 ? String(days1) : '',
    nissuu2: (hasP2 && days2 > 0) ? String(days2) : '',
    count1:  days1 > 0 ? String(days1) : '',
    count2:  (hasP2 && days2 > 0) ? String(days2) : '',
  };
}

function srHasCaseValue_(value) {
  if (value instanceof Date) return !isNaN(value.getTime());
  return String(value || '').trim() !== '';
}

function srBackfillCaseValue_(target, key, value) {
  if (srHasCaseValue_(target[key])) return;
  if (!srHasCaseValue_(value)) return;
  target[key] = value;
}

/**
 * 初検情報履歴シートから patientId の全件を initDate 昇順で返す。
 * - [0]: 最も早い initDate（表面 負傷原因欄 = case1 相当）
 * - [1]: 2番目の initDate（裏面 2件目負傷情報 = case2 相当、存在しなければ配列長 < 2）
 * 該当なければ空配列を返す。
 * 2026-04-03 T-SR-18 対応: 複数負傷のある患者で earliest を表面に優先表示するために追加。
 */
function srGetAllInitExamData_(ss, patientId) {
  var sh   = ss.getSheetByName(SHEETS.history);
  var data = sh.getDataRange().getValues();
  var hdrs = data[0];
  var hc   = V3TR.CONFIG.historyCols;
  var ci   = function(n) { return hdrs.indexOf(n); };

  var records = [];
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    if (String(row[ci(hc.patientId)] || '').trim() !== patientId) continue;
    var raw = row[ci(hc.initDate)];
    var d   = (raw instanceof Date) ? raw : new Date(raw);
    if (isNaN(d)) continue;
    records.push({
      _date:          d,
      injuryDatetime: String(row[ci(hc.injuryDatetime)] || ''),
      injuryPlace:    String(row[ci(hc.injuryPlace)]    || ''),
      injuryStatus:   String(row[ci(hc.injuryStatus)]   || ''),
      initFindings:   String(row[ci(hc.initFindings)]   || ''),
    });
  }
  records.sort(function(a, b) { return a._date - b._date; });
  return records;
}

/**
 * 初検情報履歴シートから patientId の最古1件を返す（表面表示用）。
 * ★方針変更(2026-04-03 T-SR-18): 複数負傷がある場合は最も早い initDate を優先する。
 *   旧実装は最新を取得していたが、2件目情報が表面に出る問題を修正。
 * 該当なければ空文字のオブジェクトを返す。
 */
function srGetInitExamData_(ss, patientId) {
  var all = srGetAllInitExamData_(ss, patientId);
  if (all.length === 0) return SR_EMPTY_INIT_EXAM_;
  return {
    injuryDatetime: all[0].injuryDatetime,
    injuryPlace:    all[0].injuryPlace,
    injuryStatus:   all[0].injuryStatus,
    initFindings:   all[0].initFindings,
  };
}


/* =======================================================================
   ④ ファイル操作 (T-SR-05)
   ======================================================================= */

/** 出力フォルダ（施術録/YYYY-MM/）を取得または作成して返す */
function srGetOrCreateOutputFolder_(yearMonth) {
  var root     = DriveApp.getFolderById(SR_ROOT_FOLDER_ID);
  var srIter   = root.getFoldersByName(SR_SUBFOLDER_NAME);
  var srFolder = srIter.hasNext() ? srIter.next() : root.createFolder(SR_SUBFOLDER_NAME);
  var ymIter   = srFolder.getFoldersByName(yearMonth);
  return ymIter.hasNext() ? ymIter.next() : srFolder.createFolder(yearMonth);
}

/** フォルダ内の同名 Google Docs ファイルを返す（なければ null） */
function srFindExistingFile_(folder, filename) {
  var iter = folder.getFilesByName(filename);
  return iter.hasNext() ? iter.next() : null;
}

/** テンプレートをフォルダに複製し、新ドキュメントの ID を返す */
function srDuplicateTemplate_(folder, filename) {
  return DriveApp.getFileById(SR_TEMPLATE_ID).makeCopy(filename, folder).getId();
}


/* =======================================================================
   ⑤ 表面差し込み (T-SR-06) — replaceText 方式
   ======================================================================= */

/**
 * 表面の全プレースホルダー {{KEY}} を患者データで置換する。
 * テンプレートに {{KEY}} が存在しない欄はスキップされる（エラーなし）。
 */
function srInsertHyomenData_(docId, patient, caseData, initExam) {
  var doc  = DocumentApp.openById(docId);
  var body = doc.getBody();

  // {{KEY}} を val で置換する内部ヘルパー（val が空でもプレースホルダーを消す）
  var rep = function(key, val) {
    body.replaceText('\\{\\{' + key + '\\}\\}', String(val || ''));
  };

  // ── 被保険者情報 ──────────────────────────────────────
  rep('被保険者記号',     patient.symbol);
  rep('被保険者番号',     patient.number);
  rep('被保険者氏名',     patient.insuredName);
  rep('被保険者住所',     patient.address);
  rep('被保険者生年月日', patient.birthday);

  // ── 保険者情報 ─────────────────────────────────────────
  rep('保険者名',     patient.insurerName);
  rep('保険者番号',   patient.insurerNo);
  rep('保険者所在地', ''); // 患者マスタに列なし → 空欄

  // ── 施術を受ける者 ────────────────────────────────────
  rep('患者氏名',   patient.name);
  rep('患者性別',   patient.gender);
  rep('続柄',       patient.relation);
  rep('患者生年月日', patient.birthday); // 本人 = 被保険者と同値

  // ── 負傷名一覧 部位1 ──────────────────────────────────
  rep('負傷名1',         caseData.d1);
  rep('負傷年月日1',     caseData.inj1);
  rep('初検年月日1',     caseData.start1);
  // ★施術終了年月日(T-SR-17): 転帰なしなら実日付を入れずプレースホルダーを表示（施術継続中）
  //   転帰あり かつ 終了日あり → 実日付
  //   転帰なし または 終了日なし → SR_END_DATE_PLACEHOLDER
  //   ケース自体が存在しない → 空欄
  var hasCase1 = !!(caseData.d1 || caseData.inj1 || caseData.start1);
  rep('施術終了年月日1',
      hasCase1
        ? ((caseData.tenki1 && caseData.end1) ? caseData.end1 : SR_END_DATE_PLACEHOLDER)
        : '');
  rep('日数1',           caseData.nissuu1);
  rep('施術回数1',       caseData.count1);
  rep('転帰1',           caseData.tenki1);

  // ── 負傷名一覧 部位2（部位2なし患者は全て空文字）─────────
  rep('負傷名2',         caseData.d2);
  rep('負傷年月日2',     caseData.inj2);
  rep('初検年月日2',     caseData.start2);
  var hasCase2 = !!(caseData.d2 || caseData.inj2 || caseData.start2);
  rep('施術終了年月日2',
      hasCase2
        ? ((caseData.tenki2 && caseData.end2) ? caseData.end2 : SR_END_DATE_PLACEHOLDER)
        : '');
  rep('日数2',           caseData.nissuu2);
  rep('施術回数2',       caseData.count2);
  rep('転帰2',           caseData.tenki2);

  // ── 負傷記録（初検情報履歴）────────────────────────────
  rep('負傷日時', initExam.injuryDatetime);
  rep('負傷場所', initExam.injuryPlace);
  rep('負傷状況', initExam.injuryStatus);
  rep('初検所見', initExam.initFindings);

  doc.saveAndClose();
}


/* =======================================================================
   ⑥ 裏面差し込み (T-SR-07) — テーブルセル直接書き込み
   ======================================================================= */

/**
 * 裏面の日別明細行と ① 月次集計行を書き込む。
 * @param {number}      targetMonth - 対象月の数字（例: 4）
 * @param {Object}      caseData    - srGetCaseData_ の戻り値（2件目表示判定に使用）
 * @param {Object|null} initExam2   - srGetAllInitExamData_ の [1]（case2 初検情報、なければ null）
 */
function srInsertUrameData_(docId, visitRows, targetMonth, caseData, initExam2) {
  var doc  = DocumentApp.openById(docId);
  var body = doc.getBody();

  var uTable = srFindUrameTable_(body);
  if (!uTable) {
    Logger.log('[WARN] 裏面テーブルが見つからないため書き込みをスキップします');
    doc.saveAndClose();
    return;
  }

  var sumIdx = srFindSummaryRows_(uTable);  // {1: idx, 2: idx, 3: idx}
  var uc     = srResolveUrameCols_(uTable);

  // ★ 施療料目印検出（施療料列は後療料列と完全に独立）
  var ph_shiryo = srFindPlaceholderRow_(uTable, '施療料はここ');
  if (ph_shiryo) {
    Logger.log('[INFO] 施療料目印 発見 row=' + ph_shiryo.rowIdx + ' col=' + ph_shiryo.cellIdx);
    uc.shiryo = ph_shiryo.cellIdx;
    srSetCell_(ph_shiryo.row, ph_shiryo.cellIdx, '');  // 目印文字削除
    Logger.log('[INFO] 施療料列 採用 col=' + uc.shiryo + ' / 目印文字削除完了');
  } else {
    Logger.log('[WARN] 施療料目印 未発見 → fallback col=' + uc.shiryo);
  }

  // ★ 後療料目印検出（施療料列とは独立。uc.shiryo に影響しない）
  var ph_koryo = srFindPlaceholderRow_(uTable, '後療料はここ');
  if (ph_koryo) {
    Logger.log('[INFO] 後療料目印 発見 row=' + ph_koryo.rowIdx + ' col=' + ph_koryo.cellIdx);
    uc.koryo = ph_koryo.cellIdx;
    srSetCell_(ph_koryo.row, ph_koryo.cellIdx, '');  // 目印文字削除
    Logger.log('[INFO] 後療料列 採用 col=' + uc.koryo + ' / 目印文字削除完了');
  } else {
    Logger.log('[WARN] 後療料目印 未発見 → fallback col=' + uc.koryo);
  }

  // データ書き込み可能範囲（header行の次 〜 ①行の前）
  var dataStart = 1;
  var dataEnd   = (sumIdx[1] > 0) ? sumIdx[1] - 1 : uTable.getNumRows() - 1;

  // ----- 日別明細行 -----
  for (var i = 0; i < visitRows.length; i++) {
    var rIdx = dataStart + i;
    if (rIdx > dataEnd) {
      Logger.log('[WARN] 来院日数(' + visitRows.length + '件)がテーブル行数を超えました。超過分はスキップします。');
      break;
    }
    var vr  = visitRows[i];
    var row = uTable.getRow(rIdx);

    srSetCell_(row, uc.date,    srFormatUrameDate_(targetMonth, vr.day));
    srSetCell_(row, uc.initial, srFormatUrameAmount_(vr.initialAmount));
    srSetCell_(row, uc.shiryo,  srFormatUrameAmount_(vr.shiryoOut));  // 施療料（初検日）
    srSetCell_(row, uc.koryo,   srFormatUrameAmount_(vr.koryoOut));   // 後療料（再検・後療日）
    srSetUrameThermal_(row, uc, vr.cold, vr.warm);
    srSetCell_(row, uc.elec,    srFormatUrameAmount_(vr.elecOut));
    srSetCell_(row, uc.copay,   srFormatUrameAmount_(vr.copay));
    srSetCell_(row, uc.notes,  vr.notes);
  }

  // ----- ① 月次集計行 -----
  if (sumIdx[1] >= 0) {
    var sRow       = uTable.getRow(sumIdx[1]);
    var sc         = SR_SUM_COL;
    var totalInitial = 0, totalBase = 0, totalCold = 0, totalWarm = 0, totalElec = 0, totalCopay = 0;

    for (var j = 0; j < visitRows.length; j++) {
      totalInitial += visitRows[j].initialAmount || 0;
      totalBase  += (visitRows[j].shiryoOut || 0) + (visitRows[j].koryoOut || 0);  // 施療料+後療料
      totalCold  += visitRows[j].cold;    // Bug 2修正
      totalWarm  += visitRows[j].warm;    // Bug 2修正
      totalElec  += visitRows[j].elecOut;
      totalCopay += visitRows[j].copay;
    }
    var grandTotal = totalInitial + totalBase + totalCold + totalWarm + totalElec;

    srSetCell_(sRow, sc.month,    String(targetMonth));
    srSetCell_(sRow, sc.countVal, String(visitRows.length) + '回');
    srSetCell_(sRow, sc.totalVal, String(grandTotal));
    srSetCell_(sRow, sc.copayVal, String(totalCopay));

    if (visitRows.length > 0) {
      var first = visitRows[0];
      var last  = visitRows[visitRows.length - 1];
      srSetCell_(sRow, sc.dateFrom, targetMonth + '/' + first.day);
      srSetCell_(sRow, sc.dateTo,   targetMonth + '/' + last.day);
      srSetCell_(sRow, sc.days,     String(visitRows.length) + '日');
    }
  }

  // ----- 2件目負傷情報（裏面所見欄下部）(T-SR-18) -----
  // ★挿入位置確定(2026-04-03実機確認):
  //   テンプレートの「②ケース目負傷原因はここ」プレースホルダーセルを優先使用する。
  //   - プレースホルダーあり + case2あり → 実データで置換
  //   - プレースホルダーあり + case2なし → 空文字でクリア（単独負傷患者の出力を汚さない）
  //   - プレースホルダーなし → 来院データ直後の空行へ fallback
  // 金額列には一切書き込まない。
  var ph2 = srFindPlaceholderRow_(uTable, '２ケース目負傷原因はここ');

  // ★診断 Logger (T-SR-18 C/D): プレースホルダー検索・notesText2 の確認
  Logger.log('[DIAG-C] ph2=' + (ph2 ? ('row=' + ph2.rowIdx + ' col=' + ph2.cellIdx) : 'null(未発見)'));
  if (caseData && caseData.d2) {
    var notesText2 = srBuild2ndCaseNotesText_(caseData, initExam2);
    Logger.log('[DIAG-D] caseData.d2="' + caseData.d2 +
               '" notesText2先頭="' + (notesText2 ? notesText2.substring(0, 40) : '空') + '"');
    if (ph2) {
      // プレースホルダー発見 → 実データで置換（最優先）
      srSetCell_(ph2.row, ph2.cellIdx, notesText2 || '');
      Logger.log('[INFO] 2件目負傷情報 → プレースホルダー置換 row=' + ph2.rowIdx + ' col=' + ph2.cellIdx);
    } else if (notesText2) {
      // プレースホルダーなし → 従来 fallback: 来院データ直後の空行 or 最終行末尾
      var nextIdx2 = dataStart + visitRows.length;
      if (nextIdx2 <= dataEnd) {
        srSetCell_(uTable.getRow(nextIdx2), uc.notes, notesText2);
        Logger.log('[INFO] 2件目負傷情報 → fallback 空行 row=' + nextIdx2);
      } else if (visitRows.length > 0) {
        var lastDataIdx = dataStart + visitRows.length - 1;
        var lastDataRow = uTable.getRow(lastDataIdx);
        if (uc.notes < lastDataRow.getNumCells()) {
          var existingNotes = lastDataRow.getCell(uc.notes).getText();
          srSetCell_(lastDataRow, uc.notes,
                     existingNotes ? (existingNotes + '\n' + notesText2) : notesText2);
          Logger.log('[INFO] 2件目負傷情報 → fallback 最終行末尾 row=' + lastDataIdx);
        }
      }
    }
  } else {
    // case2 なし → プレースホルダーが残っていれば消去（単独負傷患者の出力を汚さない）
    if (ph2) {
      srSetCell_(ph2.row, ph2.cellIdx, '');
      Logger.log('[INFO] case2 なし → プレースホルダー消去 row=' + ph2.rowIdx);
    }
  }

  doc.saveAndClose();
}

/**
 * 裏面テーブル header 行から列位置を再解決する。
 * 実テンプレ変更で全体が左右にずれた場合は、後療料列の位置差を
 * 基準オフセットとして grouped cell を含む主要列へ適用する。
 * ラベルが見つかる主要列は個別に上書きする。
 */
function srResolveUrameCols_(table) {
  var resolved = {};
  for (var key in SR_URAME_COL) resolved[key] = SR_URAME_COL[key];
  if (!table || table.getNumRows() === 0) return resolved;

  var headerRow   = table.getRow(0);
  var headerTexts = [];
  for (var i = 0; i < headerRow.getNumCells(); i++) {
    headerTexts.push(srNormalizeUrameHeader_(headerRow.getCell(i).getText()));
  }

  var found = {
    date:    srFindUrameHeaderIndex_(headerTexts, ['月日', '月/日']),
    initial: srFindUrameHeaderIndex_(headerTexts, ['初検料', '再検料']),
    shiryo:  srFindUrameHeaderIndex_(headerTexts, ['施療料']),
    koryo:   srFindUrameHeaderIndex_(headerTexts, ['後療料']),
    base:    srFindUrameHeaderIndex_(headerTexts, ['後療料']),  // offset 計算の基準（後方互換）
    cold:    srFindUrameHeaderIndex_(headerTexts, ['冷罨法料']),
    warm:    srFindUrameHeaderIndex_(headerTexts, ['温罨法料']),
    elec:    srFindUrameHeaderIndex_(headerTexts, ['電療料']),
    copay:   srFindUrameHeaderIndex_(headerTexts, ['一部負担金']),
    notes:   srFindUrameHeaderIndex_(headerTexts, ['整復施術等の施術経過所見', '整復施療等の施術経過所見', '施術経過所見'])
  };

  var offset = (found.base >= 0) ? (found.base - SR_URAME_COL.base) : 0;
  if (offset !== 0) {
    for (var name in resolved) {
      resolved[name] = Math.max(0, resolved[name] + offset);
    }
  }

  for (var foundKey in found) {
    if (found[foundKey] >= 0) resolved[foundKey] = found[foundKey];
  }

  Logger.log('[INFO] srResolveUrameCols_: offset=' + offset +
             ' headers=' + JSON.stringify(headerTexts) +
             ' resolved=' + JSON.stringify(resolved));
  return resolved;
}

function srFormatUrameDate_(month, day) {
  return String(month) + '/' + String(day);
}

function srNormalizeUrameHeader_(text) {
  return String(text || '').replace(/\s+/g, '');
}

function srFindUrameHeaderIndex_(headerTexts, candidates) {
  for (var i = 0; i < headerTexts.length; i++) {
    for (var j = 0; j < candidates.length; j++) {
      if (headerTexts[i].indexOf(srNormalizeUrameHeader_(candidates[j])) >= 0) {
        return i;
      }
    }
  }
  return -1;
}

/**
 * 判定なし / 0 は blank のまま維持する。
 */
function srFormatUrameAmount_(value) {
  var num = Number(value);
  if (isNaN(num) || num <= 0) return '';
  return String(num);
}

function srSetUrameThermal_(row, urameCols, cold, warm) {
  if (urameCols.cold === urameCols.warm) {
    srSetCell_(row, urameCols.cold, srFormatUrameAmount_((Number(cold) || 0) + (Number(warm) || 0)));
    return;
  }
  srSetCell_(row, urameCols.cold, srFormatUrameAmount_(cold));
  srSetCell_(row, urameCols.warm, srFormatUrameAmount_(warm));
}

/**
 * body 内のテーブルを走査し、ヘッダ行に「後療料」を含むものを裏面テーブルとして返す。
 * 見つからなければ null を返す。
 */
function srFindUrameTable_(body) {
  var tables = body.getTables();
  for (var i = 0; i < tables.length; i++) {
    var t = tables[i];
    if (t.getNumRows() > 0 && t.getRow(0).getText().indexOf('後療料') >= 0) {
      return t;
    }
  }
  return null;
}

/**
 * ①②③ 集計行の行 Index を返す。
 * @return {{1:number, 2:number, 3:number}} 未発見は -1
 */
function srFindSummaryRows_(table) {
  var result = { 1: -1, 2: -1, 3: -1 };
  for (var r = 0; r < table.getNumRows(); r++) {
    var txt = table.getCell(r, 0).getText();
    if (result[1] < 0 && txt.indexOf('①') >= 0) result[1] = r;
    if (result[2] < 0 && txt.indexOf('②') >= 0) result[2] = r;
    if (result[3] < 0 && txt.indexOf('③') >= 0) result[3] = r;
  }
  return result;
}

/**
 * テーブル行の指定セルにテキストを書き込む。
 * セルインデックスが行のセル数を超える場合は WARN ログのみ（エラーにしない）。
 */
function srSetCell_(row, cellIdx, text) {
  if (cellIdx >= row.getNumCells()) {
    Logger.log('[WARN] srSetCell_: cell[' + cellIdx + '] が範囲外 (numCells=' + row.getNumCells() + ')');
    return;
  }
  row.getCell(cellIdx).setText(String(text || ''));
}

/**
 * テキスト正規化: 全角/半角スペース・改行・タブをすべて除去して比較用文字列を返す。
 * srFindPlaceholderRow_ の検索精度向上に使用。
 */
function srNormalizePlaceholderText_(text) {
  return String(text || '')
    .replace(/[\s\u3000\r\n\t]+/g, ''); // 半角スペース・全角スペース・改行・タブを除去
}

/**
 * テーブル全行を走査し、指定テキストを含むセルを最初に発見した行情報を返す。
 * ★2026-04-03 実機確認: テンプレートの「２ケース目負傷原因はここ」プレースホルダー検索に使用。
 * ★強化(2026-04-03): srNormalizePlaceholderText_ で全角/半角差・改行差を吸収してから比較する。
 *   見つからない場合は全セルテキストをダンプして原因調査を支援する。
 * @param {GoogleAppsScript.Document.Table} table
 * @param {string} searchText - 検索テキスト（部分一致・正規化後比較）
 * @return {{row: TableRow, rowIdx: number, cellIdx: number}|null}
 */
function srFindPlaceholderRow_(table, searchText) {
  var normSearch = srNormalizePlaceholderText_(searchText);

  for (var r = 0; r < table.getNumRows(); r++) {
    var row = table.getRow(r);
    for (var c = 0; c < row.getNumCells(); c++) {
      var raw     = row.getCell(c).getText();
      var normRaw = srNormalizePlaceholderText_(raw);
      if (normRaw.indexOf(normSearch) >= 0) {
        Logger.log('[INFO] srFindPlaceholderRow_: 発見 r=' + r + ' c=' + c +
                   ' raw=' + JSON.stringify(raw.substring(0, 50)));
        return { row: row, rowIdx: r, cellIdx: c };
      }
    }
  }

  // 見つからない場合: 全セルのテキストをダンプ（原因調査用）
  Logger.log('[WARN] srFindPlaceholderRow_: "' + searchText + '" が見つかりません。全非空セルをダンプします:');
  for (var rr = 0; rr < table.getNumRows(); rr++) {
    var dumpRow = table.getRow(rr);
    for (var cc = 0; cc < dumpRow.getNumCells(); cc++) {
      var cellText = dumpRow.getCell(cc).getText();
      if (cellText.trim()) {
        Logger.log('  [DUMP] r=' + rr + ' c=' + cc + ' text=' + JSON.stringify(cellText.substring(0, 80)));
      }
    }
  }
  return null;
}


/* =======================================================================
   ⑦ PDF 出力 (T-SR-08)
   ======================================================================= */

/**
 * Google Docs を PDF に変換してフォルダに保存し、PDF の Drive ファイル ID を返す。
 */
function srExportPdf_(docId, folder, filename) {
  var pdfBlob = DriveApp.getFileById(docId).getAs(MimeType.PDF).setName(filename + '.pdf');
  return folder.createFile(pdfBlob).getId();
}


/* =======================================================================
   ⑧ ユーティリティ
   ======================================================================= */

/**
 * 日付値を指定フォーマットに変換する。
 * @param {Date|string|*} dateVal
 * @param {'wareki'|'slash'} format - 'wareki': 令和8年4月1日, 'slash': 4/1
 * @return {string}
 */
function srFormatDate_(dateVal, format) {
  if (!dateVal) return '';
  var d = (dateVal instanceof Date) ? dateVal : new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal || '');

  var y   = d.getFullYear();
  var m   = d.getMonth() + 1;
  var day = d.getDate();

  if (format === 'wareki') {
    var era, yy;
    // 令和: 2019-05-01〜
    if (y > 2019 || (y === 2019 && m >= 5)) {
      era = '令和'; yy = y - 2018;
    // 平成: 1989-01-08〜2019-04-30
    } else if (y > 1989 || (y === 1989 && (m > 1 || day >= 8))) {
      era = '平成'; yy = y - 1988;
    // 昭和
    } else {
      era = '昭和'; yy = y - 1925;
    }
    return era + yy + '年' + m + '月' + day + '日';
  }

  // slash
  return m + '/' + day;
}

/**
 * 裏面所見欄に書き込む「2件目負傷情報」テキストブロックを生成する。
 * caseData.d2 が存在する前提で呼び出すこと。
 *
 * 表示方針(2026-04-03 T-SR-18 実機確認後確定):
 *   - 見出し「【2件目負傷情報】」
 *   - 負傷名 / 負傷日時 / 負傷場所 / 負傷時の状況 / 初検時所見 / 初検年月日
 *   - initExam2 が null の場合は caseData から取れる日付情報のみ表示
 *   - ヘッダーだけになるなら空文字を返す（書き込みスキップ）
 *
 * 挿入先: テンプレートの「２ケース目負傷原因はここ」プレースホルダーセル
 *   位置: 来院データ直後・①月合計回数ブロック直上・右端の大きな所見マス
 *
 * @param {Object}      caseData  - srGetCaseData_ の戻り値
 * @param {Object|null} initExam2 - srGetAllInitExamData_ の [1]（なければ null）
 * @return {string}
 */
function srBuild2ndCaseNotesText_(caseData, initExam2) {
  var lines = ['【2件目負傷情報】'];
  // 負傷名
  if (caseData.d2) lines.push('負傷名: ' + caseData.d2);
  // 負傷日時: initExam2 があれば詳細テキスト、なければ日付のみ
  if (initExam2 && initExam2.injuryDatetime) {
    lines.push('負傷日時: ' + initExam2.injuryDatetime);
  } else if (caseData.inj2) {
    lines.push('負傷日時: ' + caseData.inj2);
  }
  // 負傷場所・負傷時の状況・初検時所見（initExam2 がある場合のみ）
  if (initExam2) {
    if (initExam2.injuryPlace)  lines.push('負傷場所: '     + initExam2.injuryPlace);
    if (initExam2.injuryStatus) lines.push('負傷時の状況: ' + initExam2.injuryStatus);
    if (initExam2.initFindings) lines.push('初検時所見: '   + initExam2.initFindings);
  }
  // 初検年月日（常に表示）
  if (caseData.start2) lines.push('初検年月日: ' + caseData.start2);
  // ヘッダーのみなら空を返してスキップ
  return lines.length > 1 ? lines.join('\n') : '';
}

/**
 * 受傷日〜施術終了日（または月末）の日数を計算して文字列で返す。
 * 受傷日が不明な場合は空文字を返す。
 * @param {Date|string|*} injDate   - 受傷日（CASE_COLS.inj1 等）
 * @param {Date|string|*} endDate   - 施術終了日（空なら monthEnd を使用）
 * @param {Date}          monthEnd  - 対象月末日
 * @return {string}
 */
function srCalcNissuu_(injDate, endDate, monthEnd) {
  if (!injDate) return '';
  var start = (injDate instanceof Date) ? injDate : new Date(injDate);
  if (isNaN(start.getTime())) return '';

  var hasEnd = endDate && !isNaN(new Date(endDate).getTime());
  var end    = hasEnd ? new Date(endDate) : monthEnd;

  var days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  return days > 0 ? String(days) : '';
}
