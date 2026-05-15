# 問診票 → カルテ編集 直行フロー改善 — 2026-05-15

## 1. 背景

ユーザの実運用テストで観察された遠回り導線:

```
問診票管理 → 詳細 → 新規患者登録 → ✕患者一覧へ戻った → 患者詳細 → カルテ入力（空）
            → ✕問診票管理へ戻る → 詳細 → カルテ転記プレビュー → 下書き作成
            → ✕患者一覧へ戻る → 患者詳細 → カルテ編集（やっと問診票内容を確認）
```

往復が多すぎる。問診票詳細を **作業の中心** にして、必要な次アクションへ直行できる導線に変える。

加えて @59 で実装した「createPatient 自動 reload」も `@61` の trash 修正で判明した **「GAS iframe では `google.script.run` callback 後の `window.top.location.href` が信頼できない」** 問題の被害者で、実機では fail していた可能性が高い（ユーザ報告「実機では患者一覧へ戻ったように見える」）。

## 2. 修正内容

### 改善1: 患者登録/紐付け後を「`<a target="_top">` 手動リンク」方式に統一

**対象**: `questionnaire-detail.html`

- `createPatientBtn` success handler
- `linkExistingBtn` success handler

旧 @59 実装の `setTimeout` 自動 reload は IFRAME_SANDBOX で fail する可能性が高いため、**`@61` trash で確定した手動リンク方式** に統一:

```js
var html = '<div style="line-height:1.7;">'
  + '✅ <strong>患者登録完了</strong> — 患者ID: <code>' + res.patientId + '</code><br>'
  + '次にカルテ下書きを作成します。下のボタンで問診票詳細に戻ってください。'
  + '<div style="margin-top:10px;">' + _returnToQuestionnaireDetailBtnHtml() + '</div>'
  + '</div>';
showTransferMsg('success', html);
createBtn.style.display = 'none';
// best-effort 自動遷移
setTimeout(function() {
  try { window.top.location.href = ...; } catch (e) {}
}, 1500);
```

ヘルパー関数 `_returnLinkBtnHtml(url, label)` / `_returnToQuestionnaireDetailBtnHtml()` / `_gotoChartEditBtnHtml(patientId, visitKey)` を新設、コード重複を排除。

### 改善2: カルテ下書き作成後の「カルテ編集画面へ進む」直行リンク

**対象**: `questionnaire-detail.html` の `createChartDraftBtn` / `applyToVisitBtn` success handler

旧:
```
✅ カルテ下書き作成完了 — visitKey: SPV_...
[再読込]   ← 問診票詳細を再読込するだけ。患者一覧→患者詳細→カルテ編集と探す必要
```

新:
```
✅ カルテ下書き作成完了 — visitKey: SPV_...
内容を確認・編集してください。
[✏️ カルテ編集画面へ進む]   ← ?page=visitForm&id=<patientId>&vk=<visitKey> へ直行
```

カルテ編集 URL 形式: `?page=visitForm&id=<patientId>&vk=<selfPayVisitKey>` で **既存 visit を編集モードで開く**（`JREC_SF01_Main.gs` L456-483 `visitForm` case の `vkParam` ありの分岐）。

`createDraft` の返却値には `patientId` + `selfPayVisitKey` が含まれているのでそのまま URL 生成可能。

`applyToVisit` の場合は `res.patientId || LINKED_PATIENT_ID` で patient ID を解決（`LINKED_PATIENT_ID` は template から JS に渡された `q.linkedPatientId`）。

### 改善3: 既存「カルテ転記済み」セクションにもカルテ編集リンク追加

**対象**: `questionnaire-detail.html` の `<? if (q.linkedVisitKey) { ?>` ブロック

問診票詳細を再読込したときに「既にカルテ転記済み」状態でも、その場から直接編集画面に進めるよう、緑バナー内に「✏️ カルテ編集画面へ進む」`<a target="_top">` ボタンを追加。

```html
<? if (q.linkedPatientId) { ?>
<div style="margin-top:10px;">
  <a href="<?= appUrl ?>?page=visitForm&id=<?= encodeURIComponent(q.linkedPatientId) ?>&vk=<?= encodeURIComponent(q.linkedVisitKey) ?>"
     target="_top" rel="noopener" style="...青ボタン...">
    ✏️ カルテ編集画面へ進む
  </a>
</div>
<? } ?>
```

問診票詳細を訪問するだけでカルテ編集に直行可能（共通ナビ「📋 問診票」→ 一覧 → 詳細 → ボタンクリックの 4 クリック以内）。

### 改善4: 説明内容欄を `<input>` → `<textarea>` に変更

**対象**: `visit-form.html` L324-326

旧:
```html
<input class="form-control" id="explanation" type="text"
       placeholder="患者への説明内容" autocomplete="off">
```

単一行 input では【生活への影響】【悪化要因】【軽減要因】【希望・目標】を集約した複数行の説明内容が表示できず、ユーザ体感で「小さい」「見えない」状態だった。

新:
```html
<textarea class="form-control" id="explanation"
          placeholder="患者への説明内容（悪化・軽減要因、生活への影響、希望・目標 など）"
          autocomplete="off"
          style="min-height:140px;resize:vertical;line-height:1.6;"></textarea>
```

- `min-height: 140px` で初期から 4-5 行分の高さ確保
- `resize: vertical` でユーザが必要に応じて伸ばせる
- 既存 JS `document.getElementById('explanation').value` は textarea でも `.value` で同様にアクセスできるため、save / load ロジックは変更不要

### 改善5: JS 共通ヘルパー追加

`questionnaire-detail.html` 上部の `<script>` ブロックに以下を追加:

```js
var LINKED_PATIENT_ID = <?!= JSON.stringify(q.linkedPatientId || '')... ?>;
var LINKED_VISIT_KEY  = <?!= JSON.stringify(q.linkedVisitKey  || '')... ?>;

function _returnLinkBtnHtml(url, label) { /* 青ボタン HTML */ }
function _returnToQuestionnaireDetailBtnHtml() { /* 問診票詳細へ戻る */ }
function _gotoChartEditBtnHtml(patientId, visitKey) {
  if (!patientId || !visitKey) return '';
  var url = APP_URL + '?page=visitForm&id=' + encodeURIComponent(patientId)
                    + '&vk=' + encodeURIComponent(visitKey);
  return _returnLinkBtnHtml(url, '✏️ カルテ編集画面へ進む');
}
```

これで 4 つの success handler でリンク HTML 生成が一行に圧縮され、保守性向上。

## 3. Deploy

```
clasp push --force
clasp deploy --deploymentId AKfycbyOtef10... \
  --description "@63 staff UI: questionnaire→chart edit direct flow + reliable a target=_top links for createPatient/linkExisting/createChartDraft/applyToVisit + explanation input→textarea (min-height 140px)"
```

結果: `Deployed AKfycbyOtef10... @63` ✅
**deploymentId 維持 = URL 維持**。

## 4. 期待される運用フロー（@63）

```
[1] 共通ナビ「📋 問診票」をクリック (どの画面からでも可)
[2] 一覧 (filter=pending) で受付待ち問診票の「詳細」をクリック
[3] 詳細画面で「👁 転記プレビュー」→「✅ 新規患者登録へ転記」確認
[4] サーバー処理成功 → 「✅ 患者登録完了 / 📋 問診票詳細に戻る」青ボタン表示
[5] 青ボタンをクリック → 問診票詳細を再読込（カルテ転記セクション活性化）
[6] 「👁 カルテ転記プレビュー」→ 主訴・所見候補(空)・説明内容を確認
[7] 「来院カルテ下書きを作成」→ 確認ダイアログ → サーバー処理
[8] 成功後「✅ カルテ下書き作成完了 / ✏️ カルテ編集画面へ進む」青ボタン表示
[9] 青ボタンをクリック → 直接 visitForm 編集画面 (vk=...)へ
[10] 説明内容 textarea で問診票内容（複数行）が確認・編集可能
[11] 必要なら所見欄に施術者が記入、保存
```

患者一覧 / 患者詳細を経由する遠回りが排除され、**問診票詳細から最短 3 クリック（患者登録 / カルテ下書き / カルテ編集）** でカルテ編集到達。

## 5. 確認項目

| 項目 | 期待 |
|---|---|
| 1. 受付待ち問診票詳細 | 開ける（@62 fixed） |
| 2. 新規患者登録転記 | サーバー成功（既存通り） |
| 3. 患者登録後の戻り | 「📋 問診票詳細に戻る」青ボタンが必ず表示、クリックで戻れる |
| 4. カルテ下書き作成 | サーバー成功（既存通り） |
| 5. カルテ編集へ進むリンク | 「✏️ カルテ編集画面へ進む」青ボタンが必ず表示 |
| 6. ボタンクリックで visitForm 編集モード | `?page=visitForm&id=...&vk=...` に遷移 |
| 7. 主訴に【主訴】【痛む部位】【症状】| 集約表示（@59 で実装） |
| 8. 説明内容に【生活への影響】【悪化要因】【軽減要因】【希望・目標】| 集約表示（@59 で実装） |
| 9. 初見が空欄のまま | はい（@59 で実装） |
| 10. 説明内容欄が見やすい高さ | 140px 以上 + resize:vertical（@63 で実装） |

## 6. 設計原則の最終確定

JREC-SF01 UI の **navigation を伴う success handler** は全て以下のパターンに統一:

| パターン | 構成要素 |
|---|---|
| 1. 成功メッセージ（メッセージ本体 + `<br>` + ガイド文）| `showXxxMsg('success', html)` |
| 2. `<a target="_top" rel="noopener">` 青ボタン | ヘルパー `_returnLinkBtnHtml(url, label)` で生成 |
| 3. ボタンを `display:none` で隠す（再押下不可）| 該当ボタンの `.style.display = 'none'` |
| 4. best-effort 自動遷移（try/catch で fail を握りつぶす）| 1500ms `setTimeout` + `try { window.top.location.href = ... } catch(e) {}` |
| 5. 失敗時はメッセージ + ボタン復帰 | 既存通り |

この 5 構成要素を **全 4 success handler（createPatient / linkExisting / createChartDraft / applyToVisit）+ 既存 trashBtn** に適用済み。さらに既存「カルテ転記済み」緑バナーにも `<a target="_top">` ボタンを追加。

## 7. Dashboard / Task_Queue / Run_Log 反映

なし。UI navigation のみ。サーバー側の API / 列構造変更なし。Run_Log への既存イベント記録は不変。

## 8. live-check について

本セッションでは実行せず。
- 並行 Claude pid 17956 / 16736 が wildboar 範囲で live-check-runner を稼働中の可能性
- サーバー側のロジック（`transferQuestionnaireToPatient` / `transferQuestionnaireToVisitChart`）は今回完全に未変更
- 既存 `questionnaire-transfer-patient.spec.ts 13/13 PASS` / `questionnaire-transfer-chart.spec.ts 11/11 PASS` の CLOSED 認識は維持
- ただし `QC-2` は @59 マッピング変更で既に乖離 → 別タスクで spec 修正必要（前回から継続）

## 9. 並行 Claude / Multi-Claude

| プロセス | 範囲 | 影響 |
|---|---|---|
| 本セッション（claude pid 7304）| JREC-SF01 questionnaire-detail.html + visit-form.html 2 ファイル + clasp push + clasp deploy --deploymentId（@62 → @63）+ workspace docs 新規 + JREC PROJECT_STATUS 追記 | edit window 最小化 |
| 別 Claude（pid 17956 / 16736）| wildboar 範囲 | JREC scriptId への並行 clasp なし |

CLAUDE.md §Multi-Claude rule 遵守。

## 10. 次タスク

| 優先度 | タスク |
|---|---|
| 高 | `questionnaire-transfer-chart.spec.ts QC-2` の期待値修正（@59 マッピング変更由来、未着手 / `findings` 空 / `chiefComplaint` に部位）|
| 中 | `applyToVisit` の `recordTransferToVisitChart_` 返却値に `patientId` を追加（現状 `LINKED_PATIENT_ID` fallback で対応中、サーバー側で明示返却の方が堅牢）|
| 中 | visit-form.html「初見」フィールドラベル横に「施術者記入欄」明示注記 |
| 中 | returnFilter URL 引き継ぎ実装（trash filter pending 固定の改善案）|
| 中 | JBIZ portal-gateway-v1.gs L478-480 fallback URL 正本化 |
| 低 | 古い @48 deployment archive |

## 11. 変更ファイル

```
JREC-SF01:
- questionnaire-detail.html (+92 -28)
  - QID / LINKED_PATIENT_ID / LINKED_VISIT_KEY 宣言追加
  - _returnLinkBtnHtml / _returnToQuestionnaireDetailBtnHtml / _gotoChartEditBtnHtml ヘルパー追加
  - createPatientBtn / linkExistingBtn success: setTimeout 自動 reload → 手動リンク方式
  - createChartDraftBtn / applyToVisitBtn success: 再読込リンク → カルテ編集画面へ進むリンク
  - 「カルテ転記済み」緑バナーに「✏️ カルテ編集画面へ進む」<a target="_top"> 追加
- visit-form.html (+7 -2)
  - 説明内容 <input type="text"> → <textarea min-height:140px; resize:vertical>

Workspace:
- docs/QUESTIONNAIRE_TO_CHART_DIRECT_FLOW_IMPROVEMENT_2026-05-15.md (新規)
- gas-projects/jrec-sf01-selfpay/PROJECT_STATUS.md (@63 セクション追加)
```
