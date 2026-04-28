# JREC-01 初検時情報・所見・経過欄 運用整理メモ

調査日: 2026-04-26  
ステータス: **調査完了 / 統合非推奨 / Phase B 改善候補を記録**

---

## 0. 背景

UI シート上の以下 4 エリアについて、
「同じ内容を2箇所に書いていないか」という現場からの疑問を起点に調査した。

- D16 ラベル行 + E16:G20 値行 = 初検時情報ブロック
- A23:B28 = 所見欄（case1_shoken）
- A16:B20 = 今回の経過欄（case1_keikaNow）
- D23:G28 = 経過履歴表示欄（case1_keikaHistory）

---

## 1. 各エリアの役割

### E16:G20 — 初検時情報ブロック

| セル | コード定数 | 内容 |
|---|---|---|
| E16:G16 | `case1_initInfo.injuryDatetime` | 負傷日時 |
| E17:G17 | `case1_initInfo.injuryPlace` | 負傷場所 |
| E18:G18 | `case1_initInfo.injuryStatus` | 負傷時の状況 |
| E19:G19 | `case1_initInfo.initFindings` | 初検時所見 |
| E20:G20 | `case1_initInfo.supportContent` | 初検時相談支援の内容 |

**入力タイミング:** 初検時のみ。2日目以降は空欄のまま（`clearInitInfoUI_V3_` が保存後にクリア）  
**保存先:** 初検情報履歴シート（`appendInitHistory_V3_` 経由・初検 kubun 時のみ実行）  
**帳票出力:**

| 帳票 | 出力先 |
|---|---|
| 施術録 **表面** | 負傷日時 / 負傷場所 / 負傷状況 / 初検所見（`srGetInitExamData_` 経由） |
| 療養費支給申請書 | 負傷の日時 / 場所 / 状況 / 初検時所見（`V3TR_loadInitExamForCase_` 経由） |

---

### A23:B28 — 所見欄（case1_shoken）

**コード定数:** `UI.case1_shoken = "A23:B28"` → `CASE_COLS.shoken = "所見"`

**入力タイミング:** 毎回来院ごとに入力（初回だけではない）  
**保存先:** CASES シートの「所見」列（`upsertOneCase_` で毎来院保存）  
**帳票出力:** 施術録 **裏面**（来院行ノート。`shoken` 優先、なければ `keikaNow` を使用）

**2日目以降の自動引継ぎ（重要）:**  
`autofillFromPreviousVisit_V3` が「エピソード開始日（初検日）の CASES.shoken」を A23:B28 に書き戻す。  
→ 直前来院の所見ではなく、**初検日の所見を引き継ぐ設計**。  
→ A23:B28 が変更されていなければ、毎来院「初検時と同じ所見テキスト」が保持される。

```
Day1: A23:B28 に「腰部疼痛著明・ROM制限あり」と入力 → CASES.shoken に保存
Day2: autofill → 初検日の CASES.shoken から「腰部疼痛著明・ROM制限あり」を復元
      施術者が「改善傾向あり」に更新 → saveVisit_V3 で今日の CASES.shoken を更新
Day3: autofill → 再び初検日の shoken（「腰部疼痛著明・ROM制限あり」）を復元
      ※ 更新しなければ常に初検時の所見が引き継がれる
```

---

### A16:B20 — 今回の経過欄（case1_keikaNow）

**コード定数:** `UI.case1_keikaNow = "A16:B20"` → `CASE_COLS.keikaNow = "経過_今回"`

**入力タイミング:** 毎回来院ごとに入力（初回から）  
**保存先:** CASES シートの「経過_今回」列  
**帳票出力:**
- D23:G28 経過履歴の源泉（`buildKeikaHistoryTextFromCases_` が最新5件を生成）
- 施術録 裏面：shoken が空の場合のフォールバック

---

### D23:G28 — 経過履歴表示欄（case1_keikaHistory）

**コード定数:** `UI.case1_keikaHistory = "D23:G28"`

**特徴:** 表示専用。`buildKeikaHistoryTextFromCases_` が CASES.keikaNow から最新 N 件を生成する。  
**現在の件数上限:** `5`（`refreshKeikaHistoryUI_V3` 内の引数）  
**行配置:** A23:B28（所見）と同じ行 23〜28 に横並び配置。A23:B28 を削除しても D23:G28 の行数は増えない。

---

## 2. 実入力内容の重複分析

### 結論: 初回来院日に限って実入力内容が重複しやすい

| | E19（initFindings） | A23:B28（shoken） |
|---|---|---|
| 日1に入力する内容 | 「腰部疼痛著明・ROM制限あり」など初診時の客観的所見 | 同じまたは近似した内容（初回の臨床観察） |
| 設計上の意図 | 申請書・施術録表面のための **永久記録**（変更不可の正本） | 施術録裏面のための **毎来院更新可能なメモ** |
| 2日目以降 | 入力しない（空欄） | 初検日の所見を自動引継ぎ（更新可） |

**現場での問題:** 初回来院日に「同じような文章を2箇所に書く」負担がある。

### 統合非推奨の理由

| 帳票 | E19(initFindings) | A23:B28(shoken) |
|---|---|---|
| 施術録 表面 | ✅ 使用（初検所見欄） | 使用しない |
| 施術録 裏面 | 使用しない | ✅ 使用（来院行ノート） |
| 療養費申請書 | ✅ 使用（初検時所見欄） | 使用しない |

**同じ内容でも、別の帳票の別の欄に出力されるため、両方を廃止・統合すると必ずどちらかの帳票が空欄になる。**

---

## 3. 廃止・統合への影響

### A23:B28（shoken）を廃止した場合

- 施術録 裏面の来院行ノートが空欄（keikaNow のみになる）
- `autofillFromPreviousVisit_V3` の所見引継ぎ機能が消える
- `saveVisit_V3` → `upsertOneCase_` の shoken 保存が空になる
- CASES.shoken の蓄積が止まる
- **廃止不可**

### E16:G20（initFindings）を廃止した場合

- 申請書「負傷の日時・場所・状況・初検時所見」が空欄
- 施術録 表面「初検所見」欄が空欄
- **廃止不可**

---

## 4. 改善候補

### Phase A中（コード変更なし）

| 案 | 内容 | リスク |
|---|---|---|
| **案B: ラベル変更** | A23:B28 の隣のラベルセルを「所見（施術録裏面）」「本日の所見」「来院時所見」に変更 | ほぼゼロ（スプレッドシート手動変更のみ） |
| 記録・観察継続 | 現状維持で実運用を継続 | なし |

### Phase B以降（コード変更可）

| 案 | 内容 | 実装難易度 |
|---|---|---|
| **案A: 初検時に E19 → A23:B28 自動コピー** | 初検保存時、shoken が空欄なら initFindings の内容を A23:B28 にセット | `saveVisit_V3` 変更必要（中） |
| **案C: コピーメニュー追加** | 「初検時所見 → 本日の所見へコピー」メニュー関数を追加。`saveVisit_V3` 変更不要 | 低 |
| **経過履歴件数上限変更** | `buildKeikaHistoryTextFromCases_` の引数 `5` を `8` などに変更 | 低（3行変更のみ） |
| シート物理レイアウト変更 | 行追加・ケース2セル参照全更新 | 高（大規模変更） |

---

## 5. SPEC.md の旧記述について

SPEC.md の一部に「部位名欄（A12, A13, A27, A28）」「B27, B28」という記述が残っているが、
これは旧レイアウト時代（case2 が row27-28 だった頃）の記述であり、**現行コードと一致しない**。

現行コード:
- case2_rows = `["A36:H36", "A37:H37"]`（row36, row37）
- `onEdit` の近接チェック対象 = `A12/B12/A13/B13/A36/B36/A37/B37`
- `setupValidation_V3` の傷病名プルダウン対象 = `B12, B13, B36, B37`

**次回 SPEC.md を更新するタイミングで旧記述（A27/A28/B27/B28）を A36/A37/B36/B37 に修正すること。**

---

## 6. 関連ドキュメント

- `docs/施術録導線/JREC-01_施術録転記元対応表.md` — 施術録の転記元対応表
- `SPEC.md` §部位名プルダウン — 旧記述あり（更新対象）
- `Ver3_core.js:147` — `UI` 定数（case1_shoken / case1_initInfo 等）
- `Ver3_core.js:1619` — `upsertOneCase_`（shoken の毎来院保存）
- `Ver3_core.js:1864` — `autofillFromPreviousVisit_V3`（shoken の引継ぎロジック）
- `Ver3_core.js:1768` — `buildKeikaHistoryTextFromCases_`（経過履歴生成・件数上限）
- `Ver3_shuRecorder.js:535` — 施術録裏面の notes 生成（shoken 優先・keikaNow フォールバック）
