# 問診票詳細：既存患者紐づけ検索改善 — 2026-05-15

## 1. 背景

@63 までで問診票 → 既存患者紐づけ → カルテ下書き → カルテ編集 → 保存 → 会計 の通し運用は OK 近くに到達。残課題は **「既存患者に紐づけるとき患者IDを覚えていないと面倒」**。

実運用では受付スタッフが LINE / QR 経由で問診票を受け取り、それを既存患者に紐づけるシナリオが多い。患者IDは内部識別子で患者本人に伝えていないため、staff が覚えていない場合は患者一覧画面に探しに行く必要があった。

## 2. 修正方針

既存 GAS 関数 **`getPatients(query)`**（`JREC_SF01_Patient.gs` L10-37）を再利用。新規 GAS 関数の追加は不要。

`getPatients(query)` の検索仕様（既存）:
- `query` を lower-case で渡すと、`[r[0], r[1], r[2], r[5]]` =【patientId, name, kana, phone】を結合した文字列に対して部分一致検索
- 返却: `{ patientId, name, kana, phone, ... }` の配列

つまり **氏名・フリガナ・電話番号・患者ID すべて 1 関数で部分一致検索できる**。これをそのまま問診票詳細から `google.script.run.getPatients(q)` で呼ぶだけ。

サーバー側変更ゼロ・UI 側のみで実装する最小構成。

## 3. 実装内容

**対象**: `questionnaire-detail.html` のみ（1 ファイル変更）

### 3.1 UI 追加（HTML）

既存「既存患者に紐付ける場合」セクション（L94 周辺）に検索ボックスを追加。**患者ID直接入力 UI は維持**（同セクション内に併存）。

```html
<!-- 患者検索 (新規 @64) -->
<div>
  🔍 氏名・フリガナ・電話番号・患者IDで検索:
  <input id="patientSearchInput" placeholder="例: 山田 / ヤマダ / 090 / P0001">
  <button id="searchPatientBtn">検索</button>
  <div id="patientSearchResults"></div>
</div>

<!-- 患者ID 直接入力 (既存維持) -->
<div>
  または患者IDで直接指定:
  <input id="linkPatientIdInput" placeholder="患者ID（例: P0001）">
  <button id="linkExistingBtn">紐付け</button>
</div>
```

### 3.2 JS ロジック追加

```js
// 検索ボタン → google.script.run.getPatients(q) → renderPatientSearchResults
// Enter キーでも検索発火
// 結果行に「この患者に紐づける」ボタン → selectPatientForLink(pid)

function selectPatientForLink(pid) {
  // 既存 ID 直接入力欄に値をセット → 既存 linkExistingBtn.click() を発火
  // (confirm ダイアログ + transferQuestionnaireToPatient(linkExisting) + 自動 reload
  //  すべて既存ロジックを通る = 新規バグの混入リスクが最小)
  document.getElementById('linkPatientIdInput').value = pid;
  document.getElementById('linkExistingBtn').click();
}
```

### 3.3 セキュリティ・PII 配慮

| 項目 | 対応 |
|---|---|
| 患者検索 API | スタッフ用 staff UI (`AKfycbyOtef10...`) でのみ呼べる。Google ログイン必須 |
| public 問診票画面 | 検索 UI / API を一切呼ばない。`questionnaire-public.html` には変更なし |
| JBIZ / Portal | 触らない。`getPatients` は JREC-SF01 内部関数で外部公開なし |
| 結果表示 | 検索キーワードと結果（patientId / name / kana / phone）は staff 画面内のみ |
| `_escHtml` 関数 | name / kana / phone を `innerHTML` に入れる前に HTML エスケープ |
| 最大件数 | 10 件まで表示（多すぎる場合は「他に N 件あります、キーワードを絞ってください」案内）|

### 3.4 既存導線との互換性

| 既存機能 | 影響 |
|---|---|
| 患者ID直接入力 + 紐付けボタン | **完全に維持**（並列で使える）|
| `linkExistingBtn` click handler | 不変（@63 で実装した手動リンク + best-effort 自動遷移パターン）|
| `transferQuestionnaireToPatient(linkExisting)` GAS RPC | 不変 |
| 新規患者登録（`createPatientBtn`）| 不変 |
| カルテ下書き作成・カルテ編集直行リンク（@63）| 不変 |

検索結果から「この患者に紐づける」を押すと、`linkPatientIdInput` に値が入って `linkExistingBtn.click()` が発火 → **既存の confirm ダイアログ + transferQuestionnaireToPatient + 紐付け完了後の「問診票詳細に戻る」リンクが全部既存通り動く**。新規バグの混入リスクが最小。

## 4. Deploy

```
clasp push --force
clasp deploy --deploymentId AKfycbyOtef10... \
  --description "@64 staff UI: add patient search for questionnaire existing-patient link (reuse getPatients(query) for name/kana/phone/patientId partial match, max 10 results, existing direct-ID input retained)"
```

結果: `Deployed AKfycbyOtef10... @64` ✅
**deploymentId 維持 = URL 維持 = ブックマーク張り替え不要**。

## 5. 期待される運用フロー（@64）

1. 共通ナビ「📋 問診票」→ 受付待ち一覧 → 詳細
2. 「転記アクション」セクションの「既存患者に紐付ける場合」を見る
3. **🔍 検索ボックスに「山田」「ヤマダ」「090-1234」「P0001」のいずれかを入力**
4. 「検索」ボタンクリック（または Enter）
5. 結果リストが表示（最大 10 件、patientId・name・kana・phone を一覧）
6. 該当患者の「この患者に紐づける」をクリック
7. confirm ダイアログ「患者ID P0001 に紐付けます。よろしいですか？」→ OK
8. サーバー処理成功 → 「📋 問診票詳細に戻る」青ボタン表示
9. ボタンクリックで詳細を再読込 → カルテ転記セクション活性化
10. 「来院カルテ下書きを作成」→ 「✏️ カルテ編集画面へ進む」
11. 編集画面で内容確認 → 保存 → 会計

**患者IDを覚えていなくても氏名 / フリガナ / 電話で検索して紐づけ可能**。

## 6. 確認項目

| 確認 | 期待 |
|---|---|
| 患者ID で検索 | `P0001` 等で部分一致ヒット |
| 氏名で検索 | 「山田」「太郎」等で部分一致ヒット |
| フリガナで検索 | 「ヤマダ」「タロウ」等で部分一致ヒット |
| 電話番号で検索 | 「090」「1234」等で部分一致ヒット |
| 結果表示 | 最大 10 件、patientId・name・kana・phone 表示 |
| 該当なし | 「該当する患者が見つかりませんでした」案内 |
| Enter で検索発火 | 動く |
| 「この患者に紐づける」ボタン | 既存 confirm → 紐付け処理 → 青ボタン |
| 紐付け後 | @63 で実装した「📋 問診票詳細に戻る」青ボタン表示 |
| 戻った詳細でカルテ下書き → 編集 | @63 の導線そのまま動く |
| 既存の患者ID直接入力 | **完全に維持**（並列で使える） |
| 新規患者登録 | 影響なし |
| 公開問診票 / JBIZ / Portal | 影響なし |

## 7. live-check について

本セッションでは未実施。
- 並行 Claude pid 17956 / 16736 が wildboar live-check 稼働中の可能性
- サーバー側ロジックは未変更（`getPatients` は既存）
- 既存 `questionnaire-transfer-patient.spec.ts QB-LINK-1` は `linkExisting` mode を `mode/id/patientId` のみで検証しており、本変更（UI のみ）には影響なし
- 動作確認はユーザ目視

## 8. Dashboard / Task_Queue / Run_Log 反映

なし。
- 検索は read-only operation（`getPatients` は spreadsheet 読み込みのみ）
- Run_Log への新規イベント記録なし
- KPI / Portal 表示変更なし
- 紐付け処理は既存 `transferQuestionnaireToPatient(linkExisting)` 経由なので Run_Log は既存通り `QUESTIONNAIRE_TRANSFER_PATIENT_LINK` が記録される

## 9. 次タスク（NEXT_ACTIONS）

優先度継続:
- `questionnaire-transfer-chart.spec.ts QC-2` 期待値修正（@59 マッピング変更由来、未着手）
- `recordTransferToVisitChart_` 返却値に `patientId` 追加（堅牢化）
- visit-form.html「初見」フィールドに「施術者記入欄」明示
- returnFilter URL 引き継ぎ実装
- JBIZ portal-gateway-v1.gs L478-480 fallback URL 正本化
- 古い @48 deployment archive

将来の検索強化候補（必要になったら）:
- 検索結果に「最終来院日」「未収金額」を付加表示（既存 `getPatientListStats` 併用）
- 患者検索に「重複候補（duplicate guard）」のスコア表示（@59 既存 `findDuplicateCandidates_` を再利用）

## 10. 並行 Claude / Multi-Claude

| プロセス | 範囲 | 影響 |
|---|---|---|
| 本セッション（claude pid 7304）| JREC questionnaire-detail.html 1 ファイル + clasp deploy --deploymentId（@63 → @64）+ workspace docs 新規 + JREC PROJECT_STATUS 追記 | edit window 最小化 |
| 別 Claude（pid 17956 / 16736）| wildboar 範囲 | JREC scriptId への並行 clasp なし |

CLAUDE.md §Multi-Claude rule 遵守。

## 11. 変更ファイル

```
JREC-SF01:
- questionnaire-detail.html (+126 -1) ← 検索 UI 追加 + JS ロジック

Workspace:
- docs/QUESTIONNAIRE_EXISTING_PATIENT_SEARCH_LINK_2026-05-15.md (新規)
- gas-projects/jrec-sf01-selfpay/PROJECT_STATUS.md (@64 セクション追加)
```
