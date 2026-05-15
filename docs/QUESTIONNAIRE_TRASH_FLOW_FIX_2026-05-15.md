# 問診票ゴミ箱移動後の画面遷移修正 — 2026-05-15

## 1. 状況

`@59` まで完成した staff UI で実運用テストを行い、テスト用問診票をゴミ箱へ移動した際に以下を確認:

- **サーバー側のゴミ箱処理は成功**（`trashQuestionnaire` GAS RPC が `ok=true` 返却、`filter=trashed` および `filter=all` で `trashedAt` 入りで表示される）
- **画面側は「移動中…」のまま止まり、一覧に遷移しない**

ユーザ体感: 処理が終わったのか分からず不安。スタッフの導線が詰まる。

## 2. 根本原因

`questionnaire-detail.html` L284-305 の `trashBtn` click handler では `google.script.run` の success handler 内で **即時に `window.top.location.href` 代入** を行っていた:

```js
google.script.run
  .withSuccessHandler(function(res) {
    if (res && res.ok) {
      window.top.location.href = APP_URL + '?page=questionnaireAdmin&filter=trashed';
    } ...
```

GAS WebApp の `IFRAME_SANDBOX` モード下では、`google.script.run` callback 実行コンテキストから **直接 `window.top.location.href` を代入すると silently fail する場合がある**（外側 `sandboxFrame` (docs.google.com) と内側 `userCodeAppPanel` (script.googleusercontent.com) を跨ぐ navigation のタイミング問題）。

その結果、ボタンは disabled / "移動中…" のまま、location 代入は無視され、ユーザは画面が止まったように見える。

なお、サーバー側 `trashQuestionnaire` は `linkedPatientId` / `linkedVisitKey` を更新し `trashedAt` を set した上で `ok=true` を返している（記録は完了）。

## 3. 修正内容

**対象ファイル**: `questionnaire-detail.html` L284 周辺の `trashBtn` click handler

### 3.1 setTimeout 経由の遷移パターン化

Q-1B `createPatientBtn` / `linkExistingBtn` で確立した **「成功メッセージ表示 → 1.0〜1.5 秒後に `setTimeout` で `window.top.location.href`」** に統一。

```js
showMemoMsg('success', '✅ ゴミ箱へ移動しました。一覧へ戻ります…');
btn.textContent = '移動完了';
setTimeout(function() {
  window.top.location.href = APP_URL + '?page=questionnaireAdmin&filter=all';
}, 1000);
```

これにより:
- ユーザに「処理完了」が 1.0 秒間視認できる
- google.script.run の callback context から抜けたタイミングで navigation が走る
- iframe sandbox の navigation 問題を回避

### 3.2 戻り先 filter を `trashed` → `all` に変更

旧: `filter=trashed`（ゴミ箱に入った行だけ表示）
新: `filter=all`（一覧全体表示、`status-trashed` バッジで識別）

理由:
- ユーザ要望「判断できなければ all でよい」
- 元の filter を引き継ぐ手段がない（詳細画面遷移時に URL に filter を持って来ていない）
- all のほうが一覧の流れが見えて運用しやすい
- ゴミ箱に入ったかどうかは `status-trashed` バッジ（赤系）で識別可能

### 3.3 二重押下防止フラグ追加

```js
var _trashInProgress = false;
```

success 待機中の二重クリックを防ぐ。Q-1B `_createInProgress` と同じパターン。

## 4. Deploy

```
clasp push --force
clasp deploy \
  --deploymentId AKfycbyOtef10SuH7R1SaDVMBZS7L9yZIBYpEIVmNdS_fhz3hUtc1b0PSKvtzwRxQ6I43YObEA \
  --description "@60 staff UI: trash success auto-return to ?page=questionnaireAdmin&filter=all (setTimeout 1.0s pattern aligned with patient transfer auto-reload)"
```

結果: `Deployed AKfycbyOtef10... @60` ✅
**deploymentId 維持 = URL 維持 = ブックマーク張り替え不要**。

## 5. 期待される動作（@60 動作確認）

1. 問診票管理画面で対象問診票の詳細を開く
2. 下部の「🗑️ ゴミ箱へ移動」ボタンを押す
3. プロンプトで理由を入力（または空でも可）
4. 「移動中…」表示（disabled）
5. サーバー処理成功 → 「✅ ゴミ箱へ移動しました。一覧へ戻ります…」+ ボタン「移動完了」
6. 1.0 秒後、自動で `?page=questionnaireAdmin&filter=all` に遷移
7. 一覧に対象問診票が `status-trashed` バッジ付きで表示される

エラー時（既存挙動）:
- 「ゴミ箱への移動に失敗しました」または「エラー: …」表示
- ボタンは復帰（disabled 解除 / テキスト「🗑️ ゴミ箱へ移動」/ `_trashInProgress = false`）

## 6. 確認項目

| 確認 | 期待結果 |
|---|---|
| ゴミ箱処理（サーバー）| 既存通り成功（@59 でも成功していた）|
| 一覧遷移 | 1.0 秒後に自動遷移 ← **今回修正の主眼** |
| filter=all で一覧表示 | 対象が status-trashed バッジ付きで表示 |
| filter=trashed でも表示 | 既存通り |
| 二重クリック | `_trashInProgress` でブロック |
| エラー時のボタン復帰 | 既存通り |
| 既存導線（@59 で実装した patient transfer 自動 reload、共通ナビ）| 壊さない（trashBtn のみ修正）|
| 既存 questionnaire-issue / questionnaire-public への影響 | なし（別ファイル）|

## 7. live-check について

本セッションでは live-check 再実行を見送る。

理由:
- 並行 Claude（pid 17956 / 16736）が wildboar 関連で live-check-runner を稼働中の可能性（workspace に wildboar dirty 残あり）
- 競合回避（chrome / port / auth.json 単一プロセス占有）
- 既存 `questionnaire-admin.spec.ts QA-7 / QA-8`（trash 動作）の CLOSED 認識は `4cecba1 close Q-1A admin-base UI with live-check 15/15 PASS` で確定済み（サーバー側は正常）

ただし spec が UI 側の `setTimeout` 経由遷移を直接検証していない（QA-7/QA-8 は trash 結果の Run_Log と row 状態を確認するのみ）ため、UI 確認はユーザ目視で代用。

## 8. Dashboard / Task_Queue / Run_Log 反映

なし。

理由: UI 遷移の修正のみで、KPI / Portal 表示 / Task_Queue 対象に影響しない。サーバー側 trash 処理（Run_Log への `QUESTIONNAIRE_TRASH` イベント記録）は既存通り動作。

## 9. 関連改善（@59 / @58 と一連の流れ）

このゴミ箱遷移修正は、2026-05-15 中に積み上げた一連の UI 改善の延長:

| version | 改善 | パターン |
|---|---|---|
| @58 | calMonth エラー復旧（古い @48 deploy 誤案内の正本化） | URL / deployment ID 整理 |
| @58 | questionnaireIssue case + html 不足の Q-4 機能反映 | clasp deploy --deploymentId で URL 維持 update |
| @59 | 転記マッピング修正（findings 空 / chief 集約 / explanation に悪化軽減希望目標）| サーバー側ロジック改善 |
| @59 | createPatientBtn / linkExistingBtn の自動 reload | `setTimeout` + `window.top.location.href` パターン |
| @59 | 共通ナビに「📋 問診票」「🔗 URL発行」追加 | iframe 入れ子回避 navigation |
| **@60** | **trashBtn の自動遷移修正**（本ドキュメント）| **@59 自動 reload と同じパターンに統一** |

「`google.script.run` callback で navigation するときは必ず `setTimeout` を挟む」が JREC-SF01 UI の定着パターンになった。

## 10. 次タスク (NEXT_ACTIONS)

- `questionnaire-transfer-chart.spec.ts QC-2` の期待値修正（新マッピング: findings 空 / chief に部位 / explanation に悪化軽減希望目標）— @59 改善由来、未着手
- visit-form.html「初見」フィールドラベル横に「施術者記入欄」明示注記
- JBIZ portal-gateway-v1.gs L478-480 fallback URL 正本化（calMonth RCA 残課題）
- 古い @48 deployment archive 検討
- 必要なら other ボタン（applyToVisitBtn 等）も google.script.run callback 内 navigation を持つか grep で確認（同様の事故を予防）

## 11. 並行 Claude / Multi-Claude

| プロセス | 範囲 | 影響 |
|---|---|---|
| 本セッション（claude pid 7304）| JREC-SF01 questionnaire-detail.html 1 ファイル + clasp push + clasp deploy --deploymentId（@59 → @60）+ workspace docs 新規 + JREC PROJECT_STATUS.md 追記 | edit window 最小化、JBIZ には触れず |
| 別 Claude（pid 17956 / 16736）| wildboar 範囲（workspace に `tools/live-check-runner/projects/wildboar/member-id-change.spec.ts` M、本セッションでは絶対 stage せず）| JREC scriptId `1-1opRk...` への並行 clasp push なし |

CLAUDE.md §Multi-Claude single writer rule 遵守。
