# Phase AI-3 実装プロンプト — JREC-SF01 AI評価補助 API連携

作成日: 2026-05-04
対象プロジェクト: gas-projects/jrec-sf01-selfpay
前提フェーズ: Phase AI-2 CLOSED（commit 7f048e6 / @36 本番反映済み）

---

## このプロンプトの使い方

このファイルをそのまま Claude Code に流して Phase AI-3 実装を依頼する。
実装場所・ルール・完了条件がすべて含まれている。

---

## 現在地

```
BRANCH:    feature/auto-dev-phase3-loop
COMMIT:    36b3cf2
PUSH:      実施済み
GIT:       clean
```

**Phase AI-2 実装済み内容（変更しない）:**
- `visit-form.html` に `#aiAssistCard` セクション追加済み
- 免責文・7種プレースホルダー・`#aiAssistBtn`（保存前 disabled）実装済み
- `enableAiAssist(visitKey)` でボタン有効化済み
- `runAiAssist()` は現在「Phase AI-3 有効化予定」メッセージのみ表示

---

## Phase AI-3 の目的

`runAiAssist()` を実際の API 呼び出しに置き換え、AI評価補助の出力を画面に表示する。

---

## 実装場所

```
gas-projects/jrec-sf01-selfpay/
├── JREC_SF01_Main.gs       ← runAIAssessment(visitKey) 関数を追加
├── visit-form.html          ← runAiAssist() を API 呼び出しに更新・出力表示処理追加
```

**変更しないもの:**
- JREC_SF01_Billing.gs / JREC_SF01_Patient.gs / JREC_SF01_Setup.gs
- JREC_SF01_Visit.gs（既存の createVisitWithChart / updateVisitWithChart は変更しない）
- 会計・領収書・集計処理
- `#aiAssistCard` の HTML 構造（JS のみ変更）
- clasp push まで実施。GAS deploy（/exec 反映）は人間が判断してから実施する。

---

## Step 1: JREC_SF01_Main.gs への追加

### 追加関数: `runAIAssessment(visitKey)`

```javascript
/**
 * AI評価補助判定を実行する。
 * visitKey に対応する visit + chart + patient データを取得し、
 * 個人情報を除去してから OpenAI API に送信する。
 * API キーは ScriptProperties から取得する。
 *
 * @param {string} visitKey - selfPayVisitKey（例: SPV_20260502_P0001_001）
 * @returns {Object} { ok: boolean, result?: Object, error?: string }
 */
function runAIAssessment(visitKey) {
  try {
    // 1. API キー取得（ScriptProperties に保管）
    var apiKey = PropertiesService.getScriptProperties().getProperty('OPENAI_API_KEY');
    if (!apiKey) {
      return { ok: false, error: 'APIキーが設定されていません。GAS エディタ > プロジェクトのプロパティ > スクリプトプロパティ で OPENAI_API_KEY を設定してください。' };
    }

    // 2. visit データ取得
    var visitData = getVisitFormData(visitKey, null);
    if (!visitData.ok) {
      return { ok: false, error: '来院データの取得に失敗しました: ' + visitData.error };
    }
    var visit = visitData.data;

    // 3. patient データ取得
    var patient = getPatientById(visit.patientId);
    if (!patient) {
      return { ok: false, error: '患者データの取得に失敗しました: ' + visit.patientId };
    }

    // 4. 年齢計算（生年月日から）
    var age = null;
    var ageBand = null;
    if (patient.dob) {
      try {
        var today = new Date();
        var birth  = new Date(patient.dob);
        var ageNum = today.getFullYear() - birth.getFullYear();
        var dm = today.getMonth() - birth.getMonth();
        if (dm < 0 || (dm === 0 && today.getDate() < birth.getDate())) ageNum--;
        age = ageNum;
        ageBand = calcAgeBand_(ageNum);
      } catch(e) {}
    }

    // 5. 入力データ構築（個人情報を除外）
    var inputData = {
      patientContext: {
        age:           age,
        ageBand:       ageBand,
        sex:           patient.gender    || null,
        occupation:    patient.occupation || null,
        medicalHistory: patient.medicalHistory || null
      },
      visitContext: {
        visitDate:          visit.visitDate         || null,
        visitType:          visit.visitType         || null,
        chiefComplaint:     visit.chiefComplaint    || null,
        vas:                visit.vas               !== undefined ? visit.vas : null,
        injuryTrigger:      visit.injuryTrigger     || null,
        relatedHistoryNote: visit.relatedHistoryNote|| null,
        assessment:         visit.assessment        || null,
        findings:           visit.findings          || null,
        treatment:          visit.treatment         || null,
        lifestyle:          visit.lifestyle         || null,
        nextPlan:           visit.nextPlan          || null
      }
    };

    // 送信しない情報: name, kana, phone, address, dob, jrecPatientId （患者特定に繋がる情報は含めない）

    // 6. プロンプト生成
    var prompt = buildAIPrompt_(inputData);

    // 7. OpenAI API 呼び出し
    var payload = {
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system',  content: AI_SYSTEM_PROMPT_ },
        { role: 'user',    content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 1500
    };

    var options = {
      method: 'post',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type':  'application/json'
      },
      payload:          JSON.stringify(payload),
      muteHttpExceptions: true
    };

    var response  = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', options);
    var respCode  = response.getResponseCode();
    var respText  = response.getContentText();

    if (respCode !== 200) {
      Logger.log('[runAIAssessment] API error ' + respCode + ': ' + respText.substring(0, 200));
      return { ok: false, error: 'API エラー (' + respCode + '): ' + JSON.parse(respText).error.message };
    }

    var respJson = JSON.parse(respText);
    var content  = respJson.choices[0].message.content;
    var result   = JSON.parse(content);

    Logger.log('[runAIAssessment] visitKey=' + visitKey + ' ok=true model=' + respJson.model);
    return { ok: true, result: result };

  } catch(err) {
    Logger.log('[runAIAssessment] error: ' + err.message);
    return { ok: false, error: err.message };
  }
}

/** 年齢層を返す */
function calcAgeBand_(age) {
  if (age <= 5)  return '幼児';
  if (age <= 14) return '小児';
  if (age <= 18) return '学生（中高）';
  if (age <= 29) return '若年成人';
  if (age <= 44) return '壮年';
  if (age <= 64) return '中年';
  if (age <= 74) return '前期高齢者';
  return '後期高齢者';
}

/** AI へ送るプロンプトを生成する */
function buildAIPrompt_(data) {
  var lines = [];
  var pc = data.patientContext;
  var vc = data.visitContext;

  if (pc.ageBand || pc.sex || pc.occupation) {
    lines.push('【患者情報】');
    if (pc.ageBand) lines.push('年齢層: ' + pc.ageBand + (pc.age ? '（' + pc.age + '歳）' : ''));
    if (pc.sex)     lines.push('性別: ' + pc.sex);
    if (pc.occupation)    lines.push('職業: ' + pc.occupation);
    if (pc.medicalHistory) lines.push('既往歴: ' + pc.medicalHistory);
  }

  lines.push('');
  lines.push('【来院・症状情報】');
  if (vc.visitType)      lines.push('来院区分: ' + vc.visitType);
  if (vc.chiefComplaint) lines.push('主訴: ' + vc.chiefComplaint);
  if (vc.vas !== null && vc.vas !== undefined) lines.push('VAS: ' + vc.vas + '/10');
  if (vc.injuryTrigger)      lines.push('受傷起点: ' + vc.injuryTrigger);
  if (vc.relatedHistoryNote) lines.push('今回追記既往歴: ' + vc.relatedHistoryNote);
  if (vc.assessment) lines.push('評価: ' + vc.assessment);
  if (vc.findings)   lines.push('所見: ' + vc.findings);
  if (vc.treatment)  lines.push('施術内容: ' + vc.treatment);
  if (vc.lifestyle)  lines.push('生活指導: ' + vc.lifestyle);
  if (vc.nextPlan)   lines.push('次回方針: ' + vc.nextPlan);

  return lines.join('\n');
}

/** AI システムプロンプト */
var AI_SYSTEM_PROMPT_ =
  'あなたは接骨院・整骨院の施術者（柔道整復師）を補助するAIアシスタントです。\n' +
  '提供された患者情報と来院情報をもとに、以下の観点で補助情報を日本語で返してください。\n' +
  '重要: あなたは診断を行いません。すべての情報は参考情報であり、施術者が確認・判断することを前提としています。\n' +
  '\n' +
  '以下の JSON フォーマットで返してください:\n' +
  '{\n' +
  '  "assessmentPoints": ["評価の観点1", "評価の観点2", ...],\n' +
  '  "differentialDirection": ["鑑別の方向性1", "鑑別の方向性2", ...],\n' +
  '  "redFlags": ["危険サイン1", "危険サイン2", ...],\n' +
  '  "additionalQuestions": ["追加問診候補1", "追加問診候補2", ...],\n' +
  '  "treatmentApproach": ["施術方針案1", "施術方針案2", ...],\n' +
  '  "referralIndication": "医療機関受診勧奨の目安（不要なら空文字）",\n' +
  '  "chartDraft": "カルテ下書き（評価・所見・施術内容の文章化案）"\n' +
  '}\n' +
  '\n' +
  'redFlags は該当なしでも空配列ではなく["特記すべき危険サインは確認されませんでした"]としてください。\n' +
  '各配列の要素は2〜5件が目安です。\n' +
  '断定表現（「〜です」「〜に違いない」等）は使用しないでください。';
```

---

## Step 2: visit-form.html の `runAiAssist()` を更新

### 現在の runAiAssist()（Phase AI-2）を置き換える

```javascript
function runAiAssist() {
  var btn    = document.getElementById('aiAssistBtn');
  var result = document.getElementById('aiAssistResult');
  var placeholder = document.getElementById('aiAssistPlaceholder');
  var status = document.getElementById('aiStatusMsg');
  if (!btn || !result) return;

  btn.disabled    = true;
  btn.textContent = '実行中...';
  if (status) status.textContent = 'AI評価補助を実行中です（10〜30秒かかる場合があります）';
  result.style.display = 'none';

  // google.script.run が使える環境か確認
  if (typeof google === 'undefined' || !google.script || !google.script.run) {
    showAiError('google.script.run が使用できません。WebApp URL として開いているか確認してください。');
    resetAiBtn();
    return;
  }

  google.script.run
    .withSuccessHandler(function(res) {
      if (res && res.ok && res.result) {
        displayAiResult(res.result);
        if (placeholder) placeholder.style.display = 'none';
        btn.disabled    = false;
        btn.textContent = 'AI評価補助を再実行する';
        if (status) status.textContent = 'AI評価補助の結果を表示しています';
      } else {
        var msg = (res && res.error) ? res.error : 'AI評価補助の取得に失敗しました';
        showAiError(msg);
        resetAiBtn();
      }
    })
    .withFailureHandler(function(err) {
      showAiError('GAS実行エラー: ' + (err ? (err.message || String(err)) : '不明なエラー'));
      resetAiBtn();
    })
    .runAIAssessment(SAVED_VISIT_KEY);
}

function displayAiResult(r) {
  var result = document.getElementById('aiAssistResult');
  if (!result) return;

  function section(icon, title, items, bgColor, borderColor, textColor) {
    bgColor     = bgColor     || '#f8f9fa';
    borderColor = borderColor || '#e8eaed';
    textColor   = textColor   || '#3c4043';
    var itemsHtml = Array.isArray(items) && items.length
      ? '<ul style="margin:4px 0 0 0;padding-left:16px;font-size:12px;color:#5f6368;line-height:1.8;">' +
          items.map(function(i) { return '<li>' + escapeHtml(i) + '</li>'; }).join('') + '</ul>'
      : '<p style="font-size:12px;color:#9aa0a6;margin:4px 0 0 0;">—</p>';
    return '<div style="padding:10px;background:' + bgColor + ';border-radius:6px;border:1px solid ' + borderColor + ';margin-bottom:8px;">' +
      '<div style="font-weight:600;color:' + textColor + ';font-size:12px;margin-bottom:2px;">' + icon + ' ' + title + '</div>' +
      itemsHtml + '</div>';
  }

  function textSection(icon, title, text, bgColor, borderColor) {
    bgColor     = bgColor     || '#f8f9fa';
    borderColor = borderColor || '#e8eaed';
    return '<div style="padding:10px;background:' + bgColor + ';border-radius:6px;border:1px solid ' + borderColor + ';margin-bottom:8px;">' +
      '<div style="font-weight:600;color:#3c4043;font-size:12px;margin-bottom:4px;">' + icon + ' ' + title + '</div>' +
      '<p style="font-size:12px;color:#5f6368;white-space:pre-wrap;margin:0;">' + escapeHtml(text || '—') + '</p></div>';
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  var html = '';
  html += section('📋', '評価の観点整理', r.assessmentPoints);
  html += section('🔍', '鑑別の方向性',   r.differentialDirection);
  html += section('⚠️', '危険サイン確認', r.redFlags, '#fff8e1', '#fce8b2', '#c4770b');
  html += section('💬', '追加問診候補',   r.additionalQuestions);
  html += section('🎯', '施術方針案',     r.treatmentApproach);
  if (r.referralIndication) {
    html += textSection('🏥', '受診勧奨の目安', r.referralIndication, '#fce8e6', '#f28b82');
  }
  if (r.chartDraft) {
    html += textSection('📝', 'カルテ下書き', r.chartDraft, '#e8f0fe', '#aecbfa');
  }
  html += '<p style="font-size:11px;color:#9aa0a6;margin-top:8px;line-height:1.5;">' +
    '⚠️ 上記はAIによる参考情報です。診断の確定ではありません。施術者が確認・判断してください。</p>';

  result.innerHTML = html;
  result.style.display = 'block';
}

function showAiError(msg) {
  var result = document.getElementById('aiAssistResult');
  if (!result) return;
  result.innerHTML =
    '<div style="padding:10px 14px;background:#fce8e6;border-left:3px solid #f28b82;border-radius:4px;font-size:13px;color:#c5221f;">' +
    '❌ AI評価補助エラー: ' + msg + '</div>';
  result.style.display = 'block';
}

function resetAiBtn() {
  var btn = document.getElementById('aiAssistBtn');
  if (btn) {
    btn.disabled    = false;
    btn.textContent = 'AI評価補助を実行する';
  }
  var status = document.getElementById('aiStatusMsg');
  if (status) {
    status.innerHTML =
      '対象カルテ: <code style="font-size:11px;background:#f1f3f4;padding:1px 5px;border-radius:3px;">' +
      (SAVED_VISIT_KEY || '—') + '</code>';
  }
}
```

---

## Step 3: visit-form.html のバッジを更新

AI実装完了後、以下のバッジテキストを変更する:

```html
<!-- 変更前 -->
Phase AI-3 で有効化予定

<!-- 変更後 -->
AI評価補助（ベータ）
```

---

## Step 4: API Key の設定（人間作業）

GAS エディタ → プロジェクトのプロパティ → スクリプトプロパティで設定:

| キー | 値 |
|---|---|
| `OPENAI_API_KEY` | OpenAI の API キー（sk-...） |

**絶対にコードに直書きしない。コミットしない。**

---

## Step 5: LiveCheck 追加（ai3.spec.ts）

以下の項目を自動確認するスペックを作成する。

| テスト | 内容 |
|---|---|
| AI3-1 | visitForm に #aiAssistBtn が存在し enabled（カルテ保存済みを前提） |
| AI3-2 | ボタンクリック後に #aiAssistResult に AI出力が表示される（実際のAPI呼び出し） |
| AI3-3 | AI出力に「評価の観点整理」「鑑別の方向性」「危険サイン確認」等のセクションが含まれる |

**注意:** AI3-2/AI3-3 は実際の API 呼び出しが必要なため、API Key 設定済み環境でのみ実行可能。
API Key 未設定時は SKIP とする。

---

## 完了条件

- [ ] `JREC_SF01_Main.gs` に `runAIAssessment(visitKey)` を追加
- [ ] `visit-form.html` の `runAiAssist()` を API 呼び出し版に置き換え
- [ ] `displayAiResult()` / `showAiError()` / `resetAiBtn()` を追加
- [ ] clasp push 完了
- [ ] API Key を ScriptProperties に設定する手順を docs に明記
- [ ] GAS エディタで `runAIAssessment('SPV_...some_visitKey...')` を手動実行してレスポンスを確認
- [ ] visit-form で実際に AI実行ボタンをクリックして結果表示を確認
- [ ] ai3.spec.ts 追加（AI3-1〜AI3-3）
- [ ] PROJECT_STATUS.md / ROADMAP.md 更新
- [ ] commit / push
- [ ] versioned deployment @37（任意タイミング）

---

## 禁止事項

- OpenAI API Key を visit-form.html / GAS コードに直書きしない
- 氏名・住所・電話番号・生年月日の生データを API に送信しない
- AI_Assessments シートへの保存は Phase AI-4 に残す（今回は実装しない）
- 既存の会計・領収書・集計・未収管理処理を変更しない
- auth.json / .chrome-profile をコミットしない

---

## 参照ファイル

```
gas-projects/jrec-sf01-selfpay/
├── JREC_SF01_Main.gs          ← runAIAssessment を追加
├── JREC_SF01_Visit.gs         ← getVisitFormData の戻り値を確認
├── JREC_SF01_Patient.gs       ← getPatientById の戻り値を確認
├── visit-form.html             ← runAiAssist を更新
├── docs/PHASE_AI_CHART_ASSIST_DESIGN_2026-05-02.md  ← AI設計書
└── docs/PHASE_AI3_DESIGN_PROMPT_2026-05-04.md       ← このファイル

tools/live-check-runner/
├── projects/jrec-sf01/ai2.spec.ts  ← 参考（同じフレーム構造）
└── projects/jrec-sf01/config.json  ← patientIdForVisitForm: "P0001"
```
