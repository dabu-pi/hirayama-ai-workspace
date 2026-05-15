# 問診票ステータス表示名 + カルテ転記先再整理 — 2026-05-15

## 1. 背景

@64 の運用確認で残った気付き 2 点を整理。

### 気付き 1: filter 表示名の誤導

| filter 値 | 旧表示 | 業務上の本来の意味 |
|---|---|---|
| `pending` | 受付待ち | **患者がまだ送信していない / 入力中**（受付に届いていない）|
| `submitted` | 送信済み | **患者が送信完了し、受付が処理すべきもの**（本当の意味で「受付待ち」）|
| `transferred` | 転記済み | 転記済み |
| `trashed` | ゴミ箱 | ゴミ箱 |
| `all` | すべて | すべて |

`pending` を「受付待ち」と表示していたのが業務上の混乱の元。`submitted` こそ受付が次に処理する対象。

### 気付き 2: 「説明内容」は施術者の説明欄

「説明内容」(`explanation`) は **施術者が患者へ説明した内容を書く欄** であり、患者申告（生活影響/悪化軽減要因/希望目標）を自動転記するのは責務混在。

カルテ責務の正しい分離:
- **主訴 (`chiefComplaint`)**: 患者の訴え + 患者申告メモ
- **所見 (`findings`)** = 初見: 施術者が診た所見（空のまま、後で記入）
- **説明内容 (`explanation`)**: 施術者が患者へ説明した内容（空のまま、後で記入）
- **生活指導 (`lifestyle`)**: 施術者の指導（空のまま、後で記入）
- **既往歴 (`relatedHistoryNote`)**: 患者既往 + 服薬 + 問診票 ID trace

## 2. 修正内容

### 改善1: filter ラベル + 順序 + デフォルト変更

#### `questionnaire-admin.html`

```diff
- { v: "pending",     label: "受付待ち" },
- { v: "submitted",   label: "送信済み" },
+ { v: "submitted",   label: "受付待ち" },
+ { v: "pending",     label: "患者入力待ち" },
  { v: "transferred", label: "転記済み" },
  { v: "trashed",     label: "ゴミ箱" },
  { v: "all",         label: "すべて" }
```

順序も入れ替えて「受付待ち」を最初に配置（受付業務トップ）。

#### `JREC_SF01_Main.gs`

```diff
- var qFilter = filterParam || "pending";
+ var qFilter = filterParam || "submitted";
```

URL に `filter=` を指定しない場合、デフォルトを `submitted`（受付待ち）にする。

#### `index.html` 共通ナビ

```diff
- href="...?page=questionnaireAdmin&filter=all"
+ href="...?page=questionnaireAdmin&filter=submitted"
```

ナビの「📋 問診票」ボタンクリック時にいきなり受付待ちが見える。

#### `questionnaire-detail.html` trash 戻り先

```diff
- var adminUrl = APP_URL + '?page=questionnaireAdmin&filter=pending';
+ var adminUrl = APP_URL + '?page=questionnaireAdmin&filter=submitted';
```

ゴミ箱処理後の戻り先も `submitted`（受付待ち）に統一。一連の業務フローが「受付待ち一覧」を起点に回る。

### 改善2: 患者申告メモを `explanation` 外へ移動

#### `JREC_SF01_Questionnaire.gs`

##### `buildCandidateVisitChart_` (L911 周辺)

旧: 患者申告 4 項目を `explanation` に集約
新: 患者申告 4 項目を `chiefComplaint` の末尾に「`---[患者申告メモ]---`」で区切って追記、`explanation` は **空** に

```
【主訴】肩こりがある
【痛む部位】首・肩
【症状】重だるい

---[患者申告メモ]---
【生活への影響】
日常生活: ... / 仕事: ... / 睡眠: ...

【悪化要因】長時間 PC 作業

【軽減要因】温める

【希望・目標】治療目標: 半年で完治 / 希望: ジムも併用

[問診票: QXXX_YYYYMMDDHHMMSS]
```

##### `applyQuestionnaireToExistingVisit_` (L1005 周辺)

`SelfPayVisits.主訴 (col 6)`: 上記と同じ集約形式で補完（空欄のみ、上書きしない）
`SelfPayChart.所見 (col 4)`: 補完しない（既存通り、施術者記入欄）
`SelfPayChart.説明内容 (col 7)`: **補完しない**（@65 新ポリシー、施術者の説明欄）

#### `visit-form.html` chiefComplaint textarea 拡大

```diff
- <textarea class="form-control" id="chiefComplaint" rows="2"
-           style="min-height:72px;resize:vertical;line-height:1.6;"
+ <textarea class="form-control" id="chiefComplaint" rows="5"
+           style="min-height:140px;resize:vertical;line-height:1.6;"
```

主訴本体 + 患者申告メモブロックを複数行で表示できるように拡大。`resize:vertical` で必要に応じてさらに伸ばせる。

## 3. 期待カルテレイアウト（カルテ編集画面 @65）

```
来院日: 2026-05-15
来院区分: 初診
担当者: 院長

主訴 *  (textarea / min-height 140px)
┌────────────────────────────────┐
│ 【主訴】肩こりがある              │
│ 【痛む部位】首・肩                │
│ 【症状】重だるい                  │
│                                  │
│ ---[患者申告メモ]---             │
│ 【生活への影響】                  │
│ 仕事: PC で肩が... / 睡眠: ...   │
│                                  │
│ 【悪化要因】長時間 PC 作業       │
│                                  │
│ 【軽減要因】温める               │
│                                  │
│ 【希望・目標】治療目標: 半年で完治│
│                                  │
│ [問診票: QXXX_...]               │
└────────────────────────────────┘

VAS: 5
受傷起点: 発症日 2026-05-01 / デスクワーク継続
今回追記既往歴: 高血圧 / 服薬: 降圧薬 [問診票: QXXX_...]

評価:  (空、施術者が後で記入)
所見:  (空、施術者が後で記入) ← 初見
施術内容: (空、施術者が後で記入)
使用機器: (空、施術者が後で記入)
禁忌確認: ...
説明内容: (空、施術者が後で記入) ← 患者への説明
生活指導: (空、施術者が後で記入)
次回予定: ...
```

責務が完全に分離:
- 患者由来 = **主訴** に集約
- 施術者由来 = **評価 / 所見 / 施術内容 / 使用機器 / 説明内容 / 生活指導**（空白で待機）

## 4. Deploy

```
clasp push --force
clasp deploy --deploymentId AKfycbyOtef10... \
  --description "@65 staff UI: filter labels (submitted=受付待ち first, pending=患者入力待ち) + nav default filter=submitted + trash return to submitted + transfer policy: patient notes consolidated into chiefComplaint with 【患者申告メモ】 block, explanation/findings stay empty for staff to fill + chiefComplaint textarea rows 2→5"
```

結果: `Deployed AKfycbyOtef10... @65` ✅
**deploymentId 維持 = URL 維持**。

## 5. 動作確認

| 確認 | 期待 |
|---|---|
| ナビ「📋 問診票」クリック | `?page=questionnaireAdmin&filter=submitted` に遷移 |
| 一覧の filter ボタン | 「受付待ち / 患者入力待ち / 転記済み / ゴミ箱 / すべて」の順、受付待ちが先頭 |
| `submitted` ラベル | 「受付待ち」と表示 |
| `pending` ラベル | 「患者入力待ち」と表示 |
| 受付待ち問診票 → 詳細 → 患者登録/紐付け → カルテ下書き作成 | @63 / @64 と同様の流れ |
| カルテ編集画面の主訴欄 | 【主訴】【痛む部位】【症状】+ 「---[患者申告メモ]---」+ 【生活への影響】【悪化要因】【軽減要因】【希望・目標】+ 問診票 ID |
| 主訴 textarea | 140px 以上、resize vertical で伸ばせる |
| 説明内容欄 | **空欄**（施術者が後で記入する状態） |
| 所見欄 (初見) | **空欄**（施術者が後で記入する状態） |
| ゴミ箱処理後の戻り先 | `?page=questionnaireAdmin&filter=submitted`（受付待ち）|

## 6. 影響しない既存機能

- 既存患者検索 (`@64` 実装) は完全に維持
- 「📋 問診票詳細に戻る」「✏️ カルテ編集画面へ進む」青ボタン (`@63`) は維持
- 共通ナビ「📋 問診票」「🔗 URL発行」(`@59`) は維持（ナビボタンの `filter=` だけ変更）
- public 問診票（`@57` deploy）は無関係
- JBIZ Portal-17 KPI ロジック（`questionnaire_layer_connected`）は無関係（status=submitted/transferred を count するロジックは不変）

## 7. live-check への影響

`questionnaire-admin.spec.ts QA-2` は `filter ボタン 5 個（pending/submitted/transferred/trashed/all）が存在する` を assert しているのみ。**順序やラベル名は検証していない** ので spec は通る見込み。

`questionnaire-transfer-chart.spec.ts QC-2` は `c.findings` に "頸部" を含む等の旧マッピング検証で既に乖離（@59 以来）。**この機会に新マッピングに合わせて修正するのが望ましい（NEXT_ACTIONS）**:
- `c.chiefComplaint` に "頸部" / "肩こり" / "【主訴】" を含む
- `c.explanation` は空文字
- `c.findings` も空文字

## 8. Dashboard / Task_Queue / Run_Log 反映

なし。filter ラベル変更と転記マッピング再整理は KPI/Portal 表示に影響しない。Run_Log への `QUESTIONNAIRE_TRANSFER_PATIENT_*` / `QUESTIONNAIRE_CHART_DRAFT_CREATE` イベント記録は既存通り。

## 9. 次タスク (NEXT_ACTIONS)

| 優先度 | タスク |
|---|---|
| 高 | `questionnaire-transfer-chart.spec.ts QC-2` の期待値修正（新マッピング: chiefComplaint に部位/症状/患者申告メモ、findings/explanation は空）|
| 中 | visit-form.html 「初見」ラベル横に「施術者記入欄」明示注記 |
| 中 | visit-form.html 「説明内容」ラベル横に「先生が患者へ説明した内容」明示注記 |
| 中 | 「📋 問診票」一覧ヘッダーに件数バッジ（受付待ち N 件 等）|
| 中 | JBIZ portal-gateway-v1.gs L478-480 fallback URL 正本化 |
| 低 | 古い @48 deployment archive 検討 |

## 10. 並行 Claude / Multi-Claude

| プロセス | 範囲 | 影響 |
|---|---|---|
| 本セッション（claude pid 7304）| JREC 6 ファイル + clasp deploy --deploymentId（@64 → @65）+ workspace docs 新規 + JREC PROJECT_STATUS 追記 | edit window 最小化 |
| 別 Claude（pid 17956 / 16736）| wildboar 範囲 | JREC scriptId への並行 clasp なし |

CLAUDE.md §Multi-Claude rule 遵守。

## 11. 変更ファイル

```
JREC-SF01:
- JREC_SF01_Main.gs (+4 -2) ← questionnaireAdmin default filter "pending"→"submitted"
- JREC_SF01_Questionnaire.gs (+82 -44) ← buildCandidateVisitChart_/applyQuestionnaireToExistingVisit_ マッピング再整理
- index.html (+1 -1) ← ナビ「📋 問診票」default filter="submitted"
- questionnaire-admin.html (+7 -3) ← filter ラベル/順序変更
- questionnaire-detail.html (+4 -3) ← trash 戻り先 filter "pending"→"submitted"
- visit-form.html (+5 -2) ← chiefComplaint textarea rows 2→5 / min-height 拡大

Workspace:
- docs/QUESTIONNAIRE_STATUS_LABEL_AND_TRANSFER_FIELD_REVIEW_2026-05-15.md (新規)
- gas-projects/jrec-sf01-selfpay/PROJECT_STATUS.md (@65 セクション追加)
```
