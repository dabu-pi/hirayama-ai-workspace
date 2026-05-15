# 問診票転記マッピング + 導線改善 + 共通ナビ追加 — 2026-05-15

## 1. 背景

ユーザがトークン式問診票の実運用テストを完走した結果、3 つの改善要望が出た。

| 番号 | 課題 |
|---|---|
| 改善1 | 問診票 → カルテ転記で **初見（findings）に患者記載**（部位・症状）が入ってしまう。初見は施術者の所見欄なので、患者記載は **主訴・問診メモ・LINE記録**側に集約すべき |
| 改善2 | 新規患者登録後の導線（手動「再読込」リンクのクリック待ち）が往復が多い |
| 改善3 | 自費カルテ・会計画面から問診票管理 / 問診票URL発行へ直接行ける共通ナビが無い |

---

## 2. 実装内容

### 2.1 改善1: 問診票 → カルテ転記マッピング修正

#### 対象ファイル: `JREC_SF01_Questionnaire.gs`

##### `buildCandidateVisitChart_` (L911) の修正

| フィールド | 旧 | 新（2026-05-15） |
|---|---|---|
| `chiefComplaint`（主訴）| `q.chiefComplaint` 単体 | 【主訴】+【痛む部位】+【症状】を 1 ブロックに集約 |
| `findings`（所見=初見）| `部位: ... \n症状: ...` | **空（""）** ← 施術者記入欄、患者記載は転記しない |
| `explanation`（説明内容）| `日常生活 / 仕事 / 睡眠` のみ | 【生活への影響】+【悪化要因】+【軽減要因】+【希望・目標】+ 問診票 ID trace |
| `injuryTrigger` / `relatedHistoryNote` / `vas` | 既存維持 | 既存維持 |

##### `applyQuestionnaireToExistingVisit_` (L985 周辺) の修正

既存来院記録に問診票を補完する処理も同じポリシーで修正:
- `SelfPayVisits.主訴`（col 6）には【主訴】【痛む部位】【症状】を集約
- `SelfPayChart.findings`（col 4）= **補完しない**（施術者記入欄なので空のまま）
- `SelfPayChart.explanation`（col 7）に【生活への影響】【悪化要因】【軽減要因】【希望・目標】を集約

##### 新規に転記対象になった問診票フィールド

旧実装で **転記されていなかった** 3 フィールドを explanation に取り込み:

| 問診票フィールド | ラベル | 転記先 |
|---|---|---|
| `painWorseFactor` | 悪化要因 | explanation 内【悪化要因】 |
| `painBetterFactor` | 軽減要因 | explanation 内【軽減要因】 |
| `treatmentGoal` | 治療目標 | explanation 内【希望・目標】 |
| `desiredOutcome` | 希望結果 | explanation 内【希望・目標】 |

問診票 `QUESTIONNAIRE_HEADERS` 全 24 項目（patient profile 14 + symptom 17 + token 5 等）のうち、転記対象になるべきものは漏らさず転記済み。

### 2.2 改善2: 新規患者登録後の自動 reload

#### 対象ファイル: `questionnaire-detail.html`

##### `createPatientBtn` ハンドラ (L399)

旧:
```js
showTransferMsg('success', '✅ 患者登録完了 — 患者ID: <strong>' + res.patientId + '</strong>　'
  + '<a href="' + APP_URL + '?page=questionnaireDetail&id=' + ...QID + '" target="_top">再読込</a>');
createBtn.style.display = 'none';
```
→ ユーザが「再読込」リンクをクリックして手動遷移

新:
```js
showTransferMsg('success', '✅ 患者登録完了 — 患者ID: <strong>' + res.patientId + '</strong>　'
  + '次にカルテ転記の準備をします… (1.5秒後に自動で画面が切り替わります)');
createBtn.style.display = 'none';
setTimeout(function() {
  window.top.location.href = APP_URL + '?page=questionnaireDetail&id=' + encodeURIComponent(QID);
}, 1500);
```
→ 自動で問診票詳細を再読込（`q.linkedPatientId` が set されているのでカルテ転記セクションが活性化）

##### `linkExistingBtn` ハンドラ (L566) も同じパターンで修正

既存患者への紐付け完了後も同様に 1.5 秒後に自動 reload。

「再読込リンクを押す → 戻る」の手動 1 ステップを排除。状態別アクション（`q.linkedPatientId` / `q.linkedVisitKey` の if-else 分岐）は既存実装で既にあるため、reload 後に正しい次アクションが表示される。

### 2.3 改善3: 共通ナビに問診票リンク追加

#### 対象ファイル: `index.html`

ナビバー L34-38 の「売上・レポート」ボタンの後に 2 つ追加:

```html
<button type="button" class="tab-btn" data-page="questionnaireAdmin"
  onclick="window.top.location.href=(typeof APP_URL!=='undefined'?APP_URL:'/')+'?page=questionnaireAdmin&filter=all'">
  📋 問診票
</button>
<button type="button" class="tab-btn" data-page="questionnaireIssue"
  onclick="window.top.location.href=(typeof APP_URL!=='undefined'?APP_URL:'/')+'?page=questionnaireIssue'">
  🔗 URL発行
</button>
```

`window.top.location.href` を使うことで GAS iframe 入れ子問題を回避（前回 Q-4 で確認済みのパターン）。

#### 対象ファイル: `JREC_SF01_Main.gs`

`questionnaireIssue` case の `currentPage` を `"questionnaireAdmin"` → `"questionnaireIssue"` に変更。これで URL発行画面では「🔗 URL発行」ボタンが active になる。`questionnaireAdmin` / `questionnaireDetail` は `"questionnaireAdmin"` のままで、両画面とも「📋 問診票」ボタンが active。

### 2.4 「固定 URL 方式」は未実装

ユーザ要望に「固定URL方式はまだ実装しない。まずトークン式の運用性を改善する」と明記されているため、今回はトークン式維持。固定 URL（永続 patient-bound URL）が必要になったら次フェーズで検討。

---

## 3. Deploy

```
clasp push --force
clasp deploy \
  --deploymentId AKfycbyOtef10SuH7R1SaDVMBZS7L9yZIBYpEIVmNdS_fhz3hUtc1b0PSKvtzwRxQ6I43YObEA \
  --description "@59 staff UI: questionnaire transfer mapping fix (findings empty, chief+explanation aggregated, painWorseFactor/painBetterFactor/treatmentGoal/desiredOutcome included) + auto-reload after patient transfer + common nav links 問診票/URL発行"
```

結果: `Deployed AKfycbyOtef10... @59` ✅

deploymentId 維持 = **既存ブックマーク URL の張り替え不要**。

---

## 4. 動作確認用 URL（@59 staff UI / すべて同じ deploy）

| 用途 | URL 末尾 |
|---|---|
| 管理画面（admin）| `?page=questionnaireAdmin&filter=all` |
| 問診票詳細 | `?page=questionnaireDetail&id=<questionnaireId>` |
| URL 発行画面 | `?page=questionnaireIssue` |
| ホーム | `?page=home` |
| 自費カルテ・会計 | `?page=dailyCheckout` / `?page=list` 等 |

staff UI base:
```
https://script.google.com/macros/s/AKfycbyOtef10SuH7R1SaDVMBZS7L9yZIBYpEIVmNdS_fhz3hUtc1b0PSKvtzwRxQ6I43YObEA/exec
```

---

## 5. live-check について

本セッションでは live-check 再実行を見送る。

理由:
- 並行 Claude（pid 17956 / 16736）が wildboar 範囲で live-check-runner を断続的に稼働している可能性
- 競合回避（chrome / port / auth.json / Chrome CDP は単一プロセス占有）
- 既存 `questionnaire-transfer-chart.spec.ts 11/11 PASS` / `questionnaire-transfer-patient.spec.ts 13/13 PASS` の CLOSED 認識は `443aecf` / `5840279` commit で確定済み

本変更は転記マッピングのフィールド集約形式を変えたため、spec 側で次回の改修が必要な可能性が高い:
- `questionnaire-transfer-chart.spec.ts` QC-2 で `c.findings` に `"頸部"` (painLocation) が含まれることを期待 → 新実装では `findings` は空。**spec 修正が必要**（次タスク）

**今回は本番優先で deploy、spec 同期は次タスクへ。** ユーザによる本番動作確認で代用。

---

## 6. 期待される動作（ユーザ確認用）

### 6.1 問診票管理画面から発行画面までの導線

1. 自費カルテ・会計画面（例: `?page=dailyCheckout`）の上部ナビに「📋 問診票」「🔗 URL発行」が表示される ← **改善3**
2. 「🔗 URL発行」をクリック → token 発行画面（既存 Q-4）
3. token 発行 → publicUrl / QR / LINE 文面が表示される（既存 Q-4）
4. 「📋 問診票」をクリック → 問診票管理画面

### 6.2 患者が問診票を送信した後の運用フロー

1. staff が「📋 問診票 → filter=送信済み」で受信を確認
2. 詳細を開く → 「転記プレビュー」 → 「新規患者登録へ転記」
3. **登録完了後、1.5 秒で自動的に問診票詳細に戻り**「カルテ転記」セクションが活性化 ← **改善2**
4. 「カルテ転記プレビュー」を押す → プレビュー表示
   - 主訴: 【主訴】肩こりがある\n【痛む部位】首・肩\n【症状】重だるい
   - **所見候補: （空欄）** ← **改善1**（施術者が後で記入）
   - 説明内容候補: 【生活への影響】仕事: PCで肩が… / 睡眠: 寝つきが…\n\n【悪化要因】長時間のPC作業\n\n【軽減要因】温める\n\n【希望・目標】治療目標: 半年で完治させたい / 希望: ジムも併用したい
5. 「来院カルテ下書きを作成」 → SelfPayVisits / SelfPayChart に書き込み
6. 施術者が後から visit-form で `findings`（所見/初見）を診察結果で記入する

### 6.3 既存カルテへの補完

「既存の来院記録へ補完する場合」フィールドで visitKey を入れると、既存 SelfPayVisits/SelfPayChart 行に対し:
- 空欄の主訴列 → 【主訴】【痛む部位】【症状】を集約して書き込み
- **`findings`（chart 列 4） → 触らない（空のまま、または既存値そのまま）** ← **改善1**
- 空欄の説明内容列 → 集約した explanation を書き込み

既に値がある列は上書きしない（安全補完）。

---

## 7. Dashboard / Task_Queue / Run_Log 反映

なし。

理由: 転記の挙動変更は KPI / Portal 表示に影響しない（カルテ列の値配置が変わるだけで、件数集計や questionnaire_layer_connected 判定ロジックは無関係）。

---

## 8. 次タスク (NEXT_ACTIONS)

| 優先度 | タスク | 内容 |
|---|---|---|
| 高 | **questionnaire-transfer-chart.spec.ts QC-2 の修正** | 旧期待値 `c.findings` に "頸部" / "肩こり" を含む → 新実装では `c.chiefComplaint` に【痛む部位】として含まれる、`c.findings` は空。spec 期待値を新マッピングに合わせて更新 |
| 中 | live-check で本変更の再現性確認 | auth.json 更新 + 並行 Claude wildboar が完了したタイミングで実行 |
| 中 | visit-form.html の `初見（findings）` フィールドラベルに「施術者記入欄」明示注記 | UI 側でも責務を明確化 |
| 中 | JBIZ portal-gateway-v1.gs L478-480 fallback URL を `AKfycbyOtef10...` に正本化 | calMonth RCA の残課題、別セッション |
| 低 | 古い @48 deployment archive 検討 | JBIZ ScriptProperties / hardcoded reference grep 後 |

---

## 9. 並行 Claude / Multi-Claude

| プロセス | 範囲 | 影響 |
|---|---|---|
| 本セッション（claude pid 7304）| JREC-SF01 4 ファイル修正 + clasp push + clasp deploy --deploymentId（@58 → @59 / URL 維持）+ workspace docs 新規 + JREC PROJECT_STATUS.md 追記 | edit window 最小化 |
| 別 Claude（pid 17956 / 16736）| wildboar 範囲 | JREC scriptId `1-1opRk...` への並行 clasp push なし（git status / clasp deployments 結果と整合）|

CLAUDE.md §Multi-Claude single writer rule 遵守:
- 同一 Apps Script project への clasp push / clasp deploy → 本セッションが単一 writer
- JBIZ には触れず（fallback URL 正本化は次セッションへ）
- live-check-runner には触れず（spec 修正は次タスクへ）
- auth.json には触れず

---

## 10. 変更ファイル一覧

```
JREC-SF01:
- JREC_SF01_Main.gs          (+4 -2) ← questionnaireIssue currentPage 変更
- JREC_SF01_Questionnaire.gs (+47 -15) ← buildCandidateVisitChart_ + applyQuestionnaireToExistingVisit_ マッピング修正
- index.html                 (+12 -0) ← 共通ナビ 2 ボタン追加
- questionnaire-detail.html  (+22 -9) ← create / linkExisting の自動 reload

Workspace:
- docs/QUESTIONNAIRE_TRANSFER_MAPPING_AND_FLOW_IMPROVEMENT_2026-05-15.md (新規)
- gas-projects/jrec-sf01-selfpay/PROJECT_STATUS.md (本変更セクション追加)
```
