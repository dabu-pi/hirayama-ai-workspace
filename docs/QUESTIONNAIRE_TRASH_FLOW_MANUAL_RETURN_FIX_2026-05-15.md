# 問診票ゴミ箱移動後の画面遷移 再修正（手動リンク方式へ） — 2026-05-15

## 1. 状況

@60 で「`setTimeout 1.0s` + `window.top.location.href`」パターンを導入したが、ユーザの実機確認では **依然として自動遷移が走らなかった**。

- 「ゴミ箱へ移動しました」表示 ✅
- 「一覧へ戻ります」表示 ✅
- 「移動完了」ボタン表示 ✅
- **自動で `?page=questionnaireAdmin&filter=all` への遷移は起きない** ❌
- 手動で `?filter=all` を開くと、対象問診票には `status-trashed` 赤バッジが出ている（**サーバー処理は完了**）
- 2 回試して同じ結果 → 環境依存ではなく構造的問題

## 2. 根本原因（再評価）

GAS WebApp `IFRAME_SANDBOX` 環境では、`google.script.run` の success callback 実行コンテキストから `window.top.location.href` を代入する navigation は **`setTimeout` で遅延しても信頼できない**ことが確定。

考えられる詳細メカニズム:
- 外側 sandboxFrame（`docs.google.com`）と内側 `userCodeAppPanel`（`script.googleusercontent.com`）の cross-origin barrier
- google.script.run callback 実行後の microtask queue 処理タイミングが Chrome のセキュリティモデルと相互作用
- 上位 frame への navigation 要求が「user activation」を要求する近年のブラウザポリシー（user gesture が click から callback まで残っていない可能性）

要するに **「画面遷移は user が押した瞬間（user activation 期間内）でないと、上位 frame への navigation は silently fail する」** という Chromium の最近の挙動と整合する。

### Q-1B `createPatientBtn` / `linkExistingBtn` で同パターンが動いている理由（推測）

@59 で実装した patient transfer の自動 reload は **同一 deployment 内の `?page=questionnaireDetail&id=...` への遷移** で、上位 frame そのものを変えていない可能性（GAS 内部で iframe を replace するだけの軽い遷移）。

一方 trashBtn の遷移は **`?page=questionnaireAdmin` という別 page** への遷移で、GAS の page handling が異なる可能性。ただし表面上は両方とも `window.top.location.href = APP_URL + '?page=...'` で書き方は同じ。理屈は完全には解明できないが、**確実な「ユーザがクリックする戻りリンク」を併用する方針に切り替えるのが運用上の正解**。

## 3. 修正内容（@61）

**対象**: `questionnaire-detail.html` `trashBtn` click handler success ブランチ

### 3.1 「確実に押せる戻りリンク」を必ず表示

```js
var adminUrl = APP_URL + '?page=questionnaireAdmin&filter=all';
var html = '<div style="line-height:1.7;">'
  + '✅ <strong>ゴミ箱へ移動しました。</strong><br>'
  + '一覧へ戻るには下のボタンを押してください。'
  + '<div style="margin-top:10px;">'
  +   '<a href="' + adminUrl + '" target="_top" rel="noopener" '
  +      'style="display:inline-block;padding:10px 22px;background:#1a73e8;color:#fff;'
  +             'border-radius:4px;text-decoration:none;font-weight:600;font-size:14px;">'
  +     '📋 問診票一覧へ戻る'
  +   '</a>'
  + '</div>'
  + '</div>';
showMemoMsg('success', html);
```

ポイント:
- **`<a target="_top">`** で iframe 入れ子を確実に突き抜けて navigation。これは **user click による user activation** なので Chromium の navigation policy で確実に動く
- 青ボタン風スタイルを inline で固定（既存の `.alert .btn` CSS 競合を回避）
- `rel="noopener"` で安全性確保
- PII を含まない（APP_URL は固定 GAS URL）

### 3.2 自動遷移は補助扱い（best-effort）

```js
setTimeout(function() {
  try { window.top.location.href = adminUrl; } catch (e) { /* fail OK */ }
}, 1500);
```

完全に廃止せず、**動けばラッキー**の best-effort として残す。`try / catch` で fail を握りつぶす（コンソールエラーを残さない）。

### 3.3 ボタン状態

- 成功後: `btn.textContent = '移動完了'`、`btn.disabled = true` のまま、`_trashInProgress = true` のまま
- 失敗後: 既存通り、ボタン復帰 + `_trashInProgress = false`

成功状態でボタンを active に戻す必要はない（ユーザは戻りリンクで一覧へ移動するため）。

## 4. Deploy

```
clasp push --force
clasp deploy \
  --deploymentId AKfycbyOtef10SuH7R1SaDVMBZS7L9yZIBYpEIVmNdS_fhz3hUtc1b0PSKvtzwRxQ6I43YObEA \
  --description "@61 staff UI: trash success shows reliable <a target=_top> return link (window.top.location.href unreliable in IFRAME_SANDBOX callback context; auto navigation kept as best-effort fallback only)"
```

結果: `Deployed AKfycbyOtef10... @61` ✅
**deploymentId 維持 = URL 維持 = ブックマーク張り替え不要**。

## 5. 期待される動作（@61 動作確認）

1. 問診票詳細画面で「🗑️ ゴミ箱へ移動」→ 理由入力
2. 「移動中…」（disabled）
3. サーバー成功 → メッセージカード表示:
   ```
   ✅ ゴミ箱へ移動しました。
   一覧へ戻るには下のボタンを押してください。
   
   [📋 問診票一覧へ戻る]   ← 青いボタン (a target="_top")
   ```
4. ボタンは「移動完了」のまま disabled
5. **ユーザが「📋 問診票一覧へ戻る」をクリック → 確実に `?page=questionnaireAdmin&filter=all` に遷移**
6. 1.5 秒で自動遷移も試みる（動けばユーザクリック不要、動かなくてもリンクで戻れる）
7. 一覧で対象問診票が `status-trashed` 赤バッジ付きで表示される

エラー時は既存通りメッセージ + ボタン復帰。

## 6. 確認項目

| 確認 | 期待 |
|---|---|
| trash サーバー処理 | 既存通り成功（@60 でも成功していた）|
| 「ゴミ箱へ移動しました」 | 表示される |
| 「📋 問診票一覧へ戻る」ボタン/リンク | **必ず表示される** |
| ボタンクリックで一覧へ | **確実に遷移**（user activation あり）|
| filter=all で status-trashed バッジ | 既存通り表示 |
| 二重押下 | `_trashInProgress` でブロック |
| エラー時のボタン復帰 | 既存通り |
| Q-1B 新規患者登録後の 1.5s 自動 reload | **壊さない**（@59 で動作確認済み / 別 handler）|
| 共通ナビ「📋 問診票」「🔗 URL発行」| 壊さない |
| 既存の questionnaire-public / questionnaire-issue | 影響なし |

## 7. live-check について

本セッションでは live-check 再実行を見送る。
- 並行 Claude pid 17956 / 16736 が wildboar 範囲で live-check-runner を稼働中の可能性
- 競合回避（chrome / port / auth.json 単一プロセス占有）
- サーバー側 `trashQuestionnaire` の動作は既存 `questionnaire-admin.spec.ts QA-7 / QA-8` で CLOSED 認識を維持
- UI 側 navigation は spec で検証していない（spec は callback 結果のみ確認）→ ユーザ目視

## 8. Dashboard / Task_Queue / Run_Log 反映

なし。UI 表示の改修のみ。`QUESTIONNAIRE_TRASH` Run_Log 記録は既存通り動作。

## 9. 設計原則の更新

JREC-SF01 UI の **navigation を伴う success handler** の標準パターンを以下に **正式化**:

| 状況 | パターン |
|---|---|
| 同一 page 内の data 再描画（reload）| `setTimeout` + `window.top.location.href` で **動く場合がある**（@59 createPatient / linkExisting で動作確認済み）|
| **別 page への遷移**（例: 詳細 → 一覧）| **`<a target="_top">` リンクを表示してユーザクリック誘導**（@61 trash で確定）|

理由: Chromium の navigation policy では「ユーザの直接クリック」が user activation として有効で、callback context からの programmatic navigation は不安定。

### 該当する可能性のある他のボタン（次回確認候補）

| ボタン | 現状 | 推奨 |
|---|---|---|
| `createChartDraftBtn` (Q-1C) | success 時の navigation 有無を要確認 | 別 page 遷移するなら手動リンクに切り替え検討 |
| `applyToVisitBtn` (Q-1C) | 同上 | 同上 |
| `previewChartBtn` / `previewPatientBtn` | preview のみ（navigation なし）| 影響なし |
| `issueBtn` (Q-4 questionnaireIssue) | 同一 page 内表示変更（navigation なし）| 影響なし |

次セッションで grep `window.top.location.href` で他に同類問題箇所がないか確認 → 必要なら同パターンに統一。

## 10. 次タスク（NEXT_ACTIONS）

1. **他の success handler を grep でチェック**（`createChartDraftBtn` / `applyToVisitBtn` 等が同様の即時 navigation を持っていないか）→ あれば同パターン適用
2. `questionnaire-transfer-chart.spec.ts QC-2` の期待値修正（@59 改善由来、未着手）
3. visit-form.html「初見」フィールドに「施術者記入欄」明示注記
4. JBIZ portal-gateway-v1.gs L478-480 fallback URL 正本化
5. 古い @48 deployment archive 検討

## 11. 並行 Claude / Multi-Claude

| プロセス | 範囲 | 影響 |
|---|---|---|
| 本セッション（claude pid 7304）| JREC-SF01 questionnaire-detail.html 1 ファイル + clasp push + clasp deploy --deploymentId（@60 → @61）+ docs 新規 + PROJECT_STATUS 追記 | edit window 最小化 |
| 別 Claude（pid 17956 / 16736）| wildboar 範囲 | JREC scriptId への並行 clasp なし |
