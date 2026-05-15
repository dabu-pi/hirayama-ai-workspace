# 問診票詳細 UI 改善 — 既存患者紐づけ後の状態表示とカルテ転記導線整理

**日付:** 2026-05-15  
**deploy:** JREC-SF01 @67  
**commit:** JREC-SF01 / workspace

---

## 実運用フィードバック（原因）

@66 実運用で以下のUX問題を確認:

1. **「重複候補が1件あります」がわかりにくい** — エラーなのか候補なのか不明。紐づけボタンもなかった。
2. **紐づけ完了後も「この患者に紐づける」ボタンが残る** — iframe sandbox でリロードが失敗すると旧状態のまま。
3. **「患者登録へ転記済み」メッセージでカルテ転記への導線が見えない** — 1 と 2 の状態で次のアクションが不明。

根本原因: GAS WebApp の iframe sandbox 内では `window.top.location.href` によるリロードが信頼できない。
紐づけ後も DOM が旧状態のままになるため「次に何を押せばいいか」がわからなくなる。

---

## 修正内容

### A. 重複候補メッセージ改善

**変更:** `renderPreview()` の `warnHtml` ブロック

| 変更前 | 変更後 |
|---|---|
| `alert-error` 赤スタイル + "重複候補が N 件あります" のみ | 黄色警告スタイル + 現場向けの説明文 |
| 患者名・電話番号のみ列挙 | 各候補に「この患者に紐づける」ボタンを追加 |

- 1 件: 「登録済みの可能性がある患者が1件見つかりました。既存患者の場合はこの患者に紐づけてください。別人または新規の場合は、新規患者登録へ進んでください。」
- 複数件: 件数と確認方法の案内

### B. 紐づけ後の DOM 動的更新 (`showLinkedState()` 追加)

リロードが失敗した場合でも、JS が DOM を正しい状態に更新する。

```
showLinkedState(patientId, patientName)
```

実行すると:
1. `linkedPatientBanner` を「✅ 患者紐づけ済み 患者ID: XXXX / 下の【2】からカルテ作成」に更新・表示
2. `patientLinkUnlinkedArea`（検索フォーム・プレビュー・既存候補ボタン）を `display:none`
3. `chartTransferBlockerDiv`（「患者登録が必要」メッセージ）を非表示
4. `chartTransferUIDiv`（カルテ転記プレビューボタン等）を表示

### C. HTML 構造リファクタ

転記アクション card を 2 ブロックに明示分離:

```
【1】患者登録・紐づけ
  - linkedPatientBanner (ID付き、JS から reveal 可能)
  - patientLinkUnlinkedArea (ID付き、JS から hide 可能)

【2】来院カルテへ転記
  - chartTransferBlockerDiv (未紐づけ時のみ表示)
  - chartTransferUIDiv (紐づけ済み未転記時に表示、JS から reveal 可能)
```

### D. カルテ転記プレビューの整理

`renderChartPreview()` から @65 で常に空になる「所見候補」「説明内容候補」行を削除。
施術者記入欄は転記プレビューに出す必要なし（主訴/VAS/受傷起点/来院区分/来院日のみ）。

### E. `createPatientBtn` / `linkExistingBtn` success handler 更新

旧: メッセージ表示 + 「問診票詳細に戻る」ボタン + best-effort reload  
新: `showLinkedState()` で即時 DOM 更新 + best-effort reload（成功時はサーバレンダリング済み状態で表示）

---

## 状態別の表示仕様

| 状態 | 【1】患者登録・紐づけ | 【2】来院カルテへ転記 |
|---|---|---|
| 未紐づけ | 転記プレビュー + 検索フォーム + 直接 ID 入力 | 「患者登録完了後に進めます」（グレー） |
| 紐づけ直後（JS 更新） | ✅ 患者紐づけ済み バナー（「下の【2】から作成」案内付き） | カルテ転記プレビューボタン表示 |
| 紐づけ済み（ページリロード後） | ✅ 患者紐づけ済み 患者ID + 氏名 + 日時 | カルテ転記プレビューボタン表示 |
| カルテ転記済み | ✅ 患者紐づけ済み | ✅ 来院カルテ転記済み + 「カルテ編集画面へ進む」ボタン |

---

## 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `gas-projects/jrec-sf01-selfpay/questionnaire-detail.html` | HTML 構造リファクタ + JS 改善（全修正） |

---

## deploy

| repo | deploymentId | version |
|---|---|---|
| JREC-SF01 | `AKfycbyOtef10...` | @67 |

---

## 検証結果

| spec | 結果 |
|---|---|
| QC-2 questionnaire-chart-transfer (11 spec) | ✅ 11/11 PASS |
| UI 動的更新（showLinkedState）| 手動確認推奨（live-check では DOM 操作をカバーしていない）|

---

## 次回確認推奨

1. 受付待ち問診票を開き、患者検索 → 「この患者に紐づける」をクリック
2. 紐づけ完了後、バナーが「✅ 患者紐づけ済み」に変わり、検索フォームが消えることを確認
3. 同画面下部に「カルテ転記プレビュー」ボタンが出ることを確認
4. プレビュー → カルテ下書き作成 → 「カルテ編集画面へ進む」の流れを確認

---

## Dashboard / Task_Queue / Run_Log

軽微な UI 改善のため反映不要。
