# PROJECT_STATUS.md — 柔整GAS Ver3.1

最終更新: 2026-04-03（**WS-SR 表示追加修正 v6: 裏面①集計ブロックを項目別独立配置へ整理**）

---

## ✅ 現在のステータス（2026-04-03 更新）

**Phase 0〜3: 実装完了・実機確認完了 / Phase A/B: 実機確認完了 / 保存後サマリー案A v2.1: T-SUM-01〜06 全PASS 完了**

| フェーズ | 内容 | 状態 |
|---|---|---|
| Phase 0 | UI入力ギャップ解消（会計ブロック行7〜8設置） | ✅ 完了 |
| Phase 1 | UI再設計・T1〜T6 実機確認 | ✅ 完了（2026-03-22）|
| Phase 2 | 自費明細ダイアログ・T2-1〜T2-12 全PASS | ✅ 完了（2026-03-23）|
| Phase 3 | JBIZ直接参照・C列 menu_id 移行・全横断確認 | ✅ 完了（2026-03-23）|
| **Phase A** | **ジム会員チェックボックス（UI B5 + 来院ヘッダ）** | **✅ 実機確認完了（2026-03-31）**|
| **Phase B** | **自費ダイアログのジム会員料金自動切替** | **✅ 実機確認完了（2026-03-31）**|
| **サマリー案A** | **保存後会計サマリー（J2:N22）v2.1 + 領収証レイアウト** | **✅ T-SUM-01〜06 全PASS 完了（2026-04-01）**|
| **WS-SR 表示追加修正** | **施術終了年月日プレースホルダー / earliest case / 裏面2件目セクション / 裏面①集計ブロック項目別配置** | **✅ 実装完了・実機確認待ち（2026-04-03）** |

**次の作業:** WS-SR — `clasp push` → `srGenerateDocument('P001', '2026-03')` 手動実行 → **裏面①集計ブロック v6 の目視確認**。T-SR-17 / T-SR-18 と施療料/後療料の副作用も併せて確認。改善候補 I-1 保留中。

---

## 🔁 別PC再開手順（次回セッション用）

> **このセクションを最初に読むこと。**

| 手順 | 内容 |
|---|---|
| 1. `ds` 実行 | `git pull` で最新を取得。ブランチ: `feature/auto-dev-phase3-loop` |
| 2. 最終コミット確認 | `git log --oneline -3` で最新コミット確認 |
| 3. 現状 | **WS-SR 表示追加修正 v6 実装完了・実機確認待ち（裏面①集計ブロック項目別配置）** |
| 4. 次の作業候補 | `clasp push` → `srGenerateDocument('P001', '2026-03')` → ①月/合計回数/合計金額/請求期間自至のログ確認 → ①集計欄目視確認 |

**2026-04-03 作業記録（WS-SR 表示追加修正）:**

| # | 内容 | 結果 |
|---|---|---|
| Task A | `SR_END_DATE_PLACEHOLDER` / `SR_EMPTY_INIT_EXAM_` 定数追加 | ✅ 完了 |
| Task B | `srGetAllInitExamData_` 新規追加（全件昇順返却） | ✅ 完了 |
| Task C | `srGetInitExamData_` を最古1件返却に変更（旧: 最新） | ✅ 完了（earliest → 表面に case1 情報優先） |
| Task D | `srGenerateDocument` に initExamAll / initExam2 追加 | ✅ 完了 |
| Task E | `srInsertHyomenData_` — 施術終了年月日1/2 プレースホルダー実装 | ✅ 完了 |
| Task F | `srInsertUrameData_` — caseData / initExam2 引数追加 + 2件目セクション | ✅ 完了 |
| Task G | `srBuild2ndCaseNotesText_` ヘルパー関数追加 | ✅ 完了 |
| Task H | TESTCASES.md T-SR-17 / T-SR-18 追加 | ✅ 完了 |

**2026-04-03 作業記録（WS-SR 追加修正 v2 — プレースホルダー置換方式）:**

| # | 内容 | 結果 |
|---|---|---|
| Task I | 実機確認: テンプレートに「２ケース目負傷原因はここ」プレースホルダーセルが存在することを確認 | ✅ 確認 |
| Task J | `srFindPlaceholderRow_` ヘルパー追加（テーブル全体からプレースホルダーを検索） | ✅ 完了 |
| Task K | `srInsertUrameData_` 2件目セクションをプレースホルダー置換方式に変更 | ✅ 完了 |
| Task L | case2 なし患者のプレースホルダー消去処理追加 | ✅ 完了 |
| Task M | `srBuild2ndCaseNotesText_` ラベル修正（「負傷時の状況」「初検時所見」に統一） | ✅ 完了 |
| Task N | 「負傷年月日」→「負傷日時」ラベル統一 | ✅ 完了 |

**2026-04-03 作業記録（WS-SR 追加修正 v3 — 原因調査・診断Logger追加）:**

| # | 内容 | 結果 |
|---|---|---|
| Task O | `SR_END_DATE_PLACEHOLDER` を `'　　年　　月　　日'`（全角スペース→文字ずれ）から `'年月日'` に変更 | ✅ 完了 |
| Task P | `srGenerateDocument` に DIAG-A/B Logger 追加（caseData.d2 / initExamAll.length / initExam2） | ✅ 完了 |
| Task Q | `srInsertUrameData_` に DIAG-C/D Logger 追加（ph2 検索結果 / notesText2 冒頭） | ✅ 完了 |
| Task R | `srNormalizePlaceholderText_` 新規追加（全角/半角スペース・改行・タブを除去） | ✅ 完了 |
| Task S | `srFindPlaceholderRow_` を強化（正規化比較・未発見時全セルダンプ） | ✅ 完了 |

**2026-04-03 作業記録（WS-SR 追加修正 v4 — SR_END_DATE_PLACEHOLDER 修正 / 後療料目印検出）:**

| # | 内容 | 結果 |
|---|---|---|
| Task T | `SR_END_DATE_PLACEHOLDER` を `'年月日'` → `'年　月　日'`（全角スペース1つ入り）に変更 | ✅ 完了 |
| Task U | `srInsertUrameData_` に後療料目印検出ロジック追加（`srFindPlaceholderRow_(uTable, '後療料はここ')`） | ✅ 完了 |
| Task V | 後療料目印発見時: `uc.base = ph_base.cellIdx` で列上書き + 目印文字削除 + Logger出力 | ✅ 完了 |
| Task W | 後療料目印未発見時: WARN + 既存 `SR_URAME_COL.base` fallback 維持 | ✅ 完了 |

**2026-04-03 作業記録（WS-SR 追加修正 v5 — 施療料/後療料 列分離）:**

**原因:** v4 で `uc.base` に後療料列を上書きしたが、書き込みループは `uc.base` 1本で施療料・後療料を合算して書いていた。
結果として施療料が後療料列に混入し、施療料列（別位置）には何も入らない状態だった。

| # | 内容 | 結果 |
|---|---|---|
| Task X | `SR_URAME_COL` に `shiryo: 4`（施療料 fallback）/ `koryo: 5`（後療料 fallback）を追加 | ✅ 完了 |
| Task Y | `srGetVisitRows_`: kubun=初検 → `shiryo` / それ以外 → `koryo` に分割集計 | ✅ 完了 |
| Task Z | `srGetVisitRows_` 戻り値を `shiryoOut` / `koryoOut` に変更（`baseOut` 廃止） | ✅ 完了 |
| Task AA | `srResolveUrameCols_` に `shiryo: ['施療料']` / `koryo: ['後療料']` ヘッダ検出を追加 | ✅ 完了 |
| Task AB | `srInsertUrameData_`: `ph_base` → `ph_shiryo` / `ph_koryo` の2系統に分離 | ✅ 完了 |
| Task AC | 書き込みループ: `uc.base`/`vr.baseOut` → `uc.shiryo`/`vr.shiryoOut` + `uc.koryo`/`vr.koryoOut` | ✅ 完了 |
| Task AD | 月次集計 `totalBase`: `baseOut` → `shiryoOut + koryoOut` | ✅ 完了 |

**診断 Logger 一覧（T-SR-18 調査用）:**

| ログキー | 内容 | 確認ポイント |
|---|---|---|
| `[DIAG-A]` | caseData.d2 / inj2 / start2 / tenki2 | `d2` が空 → case2 データ取得失敗 |
| `[DIAG-B]` | initExamAll.length / initExam2 | length=1 → 初検情報履歴に2件目がない |
| `[DIAG-C]` | ph2 検索結果（rowIdx/cellIdx または null） | null → プレースホルダー検出失敗（DUMP を確認）|
| `[DIAG-D]` | caseData.d2 / notesText2 冒頭 | 空 → srBuild2ndCaseNotesText_ が空返却 |
| `[DUMP]` | テーブル全セルのテキスト | `[DIAG-C]` が null のときに出力 |
| `[INFO] srFindPlaceholderRow_` | 発見時の r/c/text | 正規化後に一致した際のみ出力 |

**施術終了年月日プレースホルダー変更履歴:**

| バージョン | 値 | 問題 |
|---|---|---|
| v1 | `'　　年　　月　　日'`（全角スペース複数） | 文字がずれて見える |
| v3 | `'年月日'` | 詰まりすぎ |
| **v4（現行）** | **`'年　月　日'`**（全角スペース1つ） | **ちょうどよい間隔・採用** |

**次回確認事項（v5 実機テスト）:**
- `clasp push` → `srGenerateDocument('P001', '2026-03')` → Apps Script ログを確認
- `[INFO] 施療料目印 発見 row=X col=X` → 施療料列の列番号をメモ
- `[INFO] 施療料列 採用 col=X / 目印文字削除完了` → 期待列と一致するか確認
- `[INFO] 後療料目印 発見 row=X col=X` → 後療料列の列番号をメモ（施療料列と別のこと）
- `[INFO] 後療料列 採用 col=X / 目印文字削除完了` → 期待列と一致するか確認
- 出力ドキュメント目視: 施療料列・後療料列にそれぞれ正しい金額が入っているか確認
- 施術終了年月日が `年　月　日` 表示になっているか確認
- `[DIAG-A]` の d2 が空でないか確認（2件目患者の場合）
- `[DIAG-C]` が null の場合は `[DUMP]` でテンプレートの実テキストを確認

**2026-04-03 Codex CLI 再確認メモ:**

| 項目 | 結果 |
|---|---|
| Git 同期 | `git pull --ff-only` → Already up to date / HEAD=`ae1db82` |
| `clasp push` | `Script is already up to date.` |
| API 実行用 version/deployment | `clasp version "WS-SR v5 execution api live check"` → version 3 作成 / 既存 deployment `AKfycbxHhsl9qNDB2WJtoqXt_WzQ7q89mEOnaBPjlLB1u7TDgZrTXL9E6LSrHD7xHURB-WWdDg` を `@3` に更新 / 新規 deployment `AKfycbxYCVhEM0mCXkBGG6PadolAY_Tbr1mXss88Vo4kvxRf2gcGGkEMCPlyzrTZ8Oud0lwy_A @3` も作成 |
| `clasp run srGenerateDocument --params ... --nondev` | `Script function not found. Please make sure script is deployed as API executable.` で未実行 |
| `clasp run srRunTsr10v2Debug_` | devMode: `Unable to run script function. Please make sure you have permission to run the script function.` / `--nondev`: `Script function not found...` |
| 次アクション | Apps Script エディタから `srGenerateDocument('P001', '2026-03')` を手動実行し、Apps Script ログの `[INFO] 施療料目印` / `[INFO] 後療料目印` と出力ドキュメントを目視確認する。必要なら「標準 Google Cloud プロジェクト紐付け」と Execution API の API executable 設定を再点検する。 |

**2026-04-03 作業記録（WS-SR 追加修正 v6 — 裏面①集計ブロック項目別配置）:**

**原因:** v5 までの①集計行は `SR_SUM_COL` の固定列へまとめて直接書き込む構造で、`3/1` / `3/9` など請求期間の自・至を「独立した項目」として位置管理できていなかった。請求金額・請求年月日・領収年月日も項目別の出力先マップを持っていなかった。

**①ブロック項目一覧:**

| 項目 | v6 方針 | データ元 / 状態 |
|---|---|---|
| ①月 | 独立項目 `month` | `targetMonth` → `3月` |
| ①合計回数 | 独立項目 `visitCount` | `visitRows.length` → `6回` |
| ①合計金額 | 独立項目 `totalAmount` | `initialAmount + shiryoOut + koryoOut + cold + warm + elecOut` |
| ①一部負担金額 | 独立項目 `windowPay` | `visitRows[].copay` 合計（来院ヘッダ `窓口負担額`） |
| ①請求期間_自 | 独立項目 `periodFrom` | `visitRows[0]` → `3/1` |
| ①請求期間_至 | 独立項目 `periodTo` | `visitRows[last]` → `3/9` |
| ①日間 | 独立項目 `periodDays` | **未確定**。現状は既存互換で `visitRows.length + "日"` |
| ①請求金額 | 独立項目 `claimAmount` | **暫定表示** `totalAmount - windowPay`。申請書側ロジックは未変更 |
| ①請求年月日 | 独立項目 `claimDate` | **未確定**。blank 維持 + TODO |
| ①領収年月日 | 独立項目 `receiptDate` | **未確定**。blank 維持 + TODO |

**配置方針:**
- ①集計ブロックは `srBuildSummary1Values_` → `srResolveSummary1Positions_` → `srWriteSummary1Values_` の3段で、項目ごとに独立書き込みする。
- テンプレートに `①月はここ` / `①合計回数はここ` / `①合計金額はここ` / `①請求期間自はここ` / `①請求期間至はここ` などの目印文字がある項目は、そのセル座標を優先採用して目印文字を削除する。
- 目印未発見項目だけ `SR_SUMMARY1_FALLBACK_COL` を使う。`claimAmount / claimDate / receiptDate` は fallback 未確定のため、目印未発見なら blank 維持。
- ②③ブロックは今回は書き込まない（空欄維持）。

**実装内容:**

| # | 内容 | 結果 |
|---|---|---|
| Task AE | `SR_SUMMARY1_FALLBACK_COL` を新設し、①項目を `month / visitCount / totalAmount / windowPay / periodFrom / periodTo / periodDays / claimAmount / claimDate / receiptDate` で管理 | ✅ 完了 |
| Task AF | `srBuildSummary1Values_` 追加。①合計回数・①合計金額・①請求期間自/至を `visitRows` から独立算出 | ✅ 完了 |
| Task AG | `srResolveSummary1Positions_` 追加。項目別 marker 探索 + fallback 採用 + 項目別 Logger | ✅ 完了 |
| Task AH | `srWriteSummary1Values_` / `srSetTableCellAtPos_` / `srFindPlaceholderRowNoDump_` 追加。項目別書き込みと未確定項目の安全スキップを実装 | ✅ 完了 |
| Task AI | `srInsertUrameData_` の①集計書き込みを v6 ヘルパー経由へ切替。旧直書きブロックは非実行化 | ✅ 完了 |
| Task AJ | 申請書側 (`Ver3_transferData.js`) は未変更。WS-SR 側の表示・転記処理だけを修正 | ✅ 完了 |

**確認ポイント（v6 実機テスト）:**
- `[INFO] ①月目印 発見 row=X col=Y` / `[WARN] ①月目印 未発見 → fallback ...`
- `[INFO] ①合計回数目印 発見 ...`
- `[INFO] ①合計金額目印 発見 ...`
- `[INFO] ①請求期間自目印 発見 ...`
- `[INFO] ①請求期間至目印 発見 ...`
- `[INFO] ①集計項目 month/visitCount/totalAmount/periodFrom/periodTo 書き込み値=...`
- 出力ドキュメント目視: `3月` / `6回` / `6491` / `3/1` / `3/9` が①ブロックの正しいセルへ分離配置され、②③が空欄維持で、明細行・2件目情報・施療料/後療料に副作用がないこと。

**未確定項目（v6 TODO）:**
- ①日間: 「請求期間の日数」か「来院日数」か定義未確定。現状は既存互換で来院日数。
- ①請求金額: WS-SR 表示専用として `合計金額 - 一部負担金額` を暫定採用。申請書側の月次請求金額ロジックとは分離維持。
- ①請求年月日 / ①領収年月日: 埋め方ルール未確定のため blank 維持。テンプレート目印と業務ルールが固まったら実装。

**表示方針（2026-04-03 確定・実機確認済み）:**

| 方針 | 内容 |
|---|---|
| 施術終了年月日 | 転帰なし → `年　月　日`（全角スペース1つ入りプレースホルダー）/ 転帰あり → 実日付 / ケースなし → 空欄 |
| 表面 負傷原因欄 | 複数負傷がある場合も earliest（最も早い initDate）の initExam データのみ表示 |
| 2件目情報の挿入位置 | **テンプレートの「２ケース目負傷原因はここ」プレースホルダーセルを置換（確定）**<br>位置: 来院データ最終行の直後・①月合計回数ブロック直上・右端の大きな所見マス |
| 2件目挿入ロジック | `srFindPlaceholderRow_` でテーブル全体をスキャン → 発見次第そのセルに `setText`<br>プレースホルダーなし → 空行 fallback → 最終行末尾追記 fallback |
| case2 なし患者 | プレースホルダーが残っていれば空文字でクリア（出力物を汚さない） |
| 2件目判定条件 | `caseData.d2` が非空の場合のみ出力 |
| 2件目ラベル | 負傷名 / 負傷日時 / 負傷場所 / **負傷時の状況** / **初検時所見** / 初検年月日 |
| 申請書算定ロジック | 今回一切変更なし。金額整合を壊さない |

**次回確認事項（実機テスト）:**
- `clasp push` → `srGenerateDocument('P001', '2026-03')` 実行
- T-SR-17: 施術終了年月日がプレースホルダー表示になっているか
- T-SR-18: 「２ケース目負傷原因はここ」が実データに置換されているか / 表面は 3/1 情報のみか
- 単独負傷患者: 「２ケース目負傷原因はここ」が消去されているか
- 金額列に変化がないか（T-SR-15 の期待値と一致）

---

**2026-03-23 作業記録:**

| # | 内容 | 結果 |
|---|---|---|
| Task 1 | Bug A 修正（selfPayDialog 全削除保存ブロック解除） | ✅ 完了（commit `9b6f4ec`） |
| Task 2 | 来院ヘッダ 自費収益3列撤去（自費明細シートを正本化） | ✅ 完了（commit `fc26621`） |
| Task 3 | 保険申請対象フィルタ追加（2層安全フィルタ） | ✅ 完了（commit `f686dba`） |
| Task 4 | T2-4〜T2-12 実機確認チェックリスト整備 | ✅ 完了 |
| Task 5 | Phase 3 JBIZ直接参照方式実装 | ✅ 完了（commit `3559754`） |
| Task 6 | Phase 3 バグ修正 — JBIZ シート名不一致対応 | ✅ 完了（clasp push 済み） |
| Task 7 | JBIZ C列 menu_id 移行 + 横断影響チェック | ✅ 完了（commit `d5d7dc8` / `a1bb29e`） |
| Task 8 | 保険施術オプション2件置換（ストレッチ/電療追加） + menu_id ポリシー記録 | ✅ 完了（commit `dbcbf5e`） |
| **Task 9** | **T1〜T6 + T2-1〜T2-12 全PASS 実機確認・正式記録** | ✅ **完了（本コミット）** |

---

## Phase 3 設計方針: JBIZ 価格正本直接参照（2026-03-23 確定）

### 採用方針

**直接参照方式** — JREC から `SpreadsheetApp.openById` で JBIZ 価格正本を参照。

| 項目 | 内容 |
|---|---|
| 参照先 | JBIZ `1FnJdALwFSv48WiD6NWr0DzG78kwB692R2pFeiTcZlCc` |
| 対象シート | `価格設定`（コードは `JBIZ_MENU_SHEET_CANDIDATES` 配列で両名称を順に試す）|
| 識別キー | **C列** `menu_id`（2026-03-23 O列→C列に移動）|
| 取得条件 | M列 `確定状況 = "確定"` のみ |
| 失敗時 | fallback（コード内ハードコード4件）で業務継続 |

### ✅ JBIZ 側の手動作業（2026-03-23 完了済み）

> T2-3a（新メニュー表示確認）PASS = 下記作業が完了していることを確認済み

| # | 作業 | 状態 |
|---|---|---|
| 1 | `価格設定` シート C列に `menu_id` ヘッダ設定 / GASメニュー「【初回1回】JBIZ menu_id 列追加」実行 | ✅ 完了 |
| 2 | 行3: ストレッチ（20分）2200円 `INS_OPTION_STRETCH20` / 行4: 電療追加（15分）1200円 `INS_OPTION_ELECTRO15` | ✅ 完了 |
| 3 | 旧メニュー（筋膜リリース・温熱追加）の M列「確定状況」を「廃止」に変更 | ✅ 完了 |
| 4 | 下段ルールメモ移行（任意） | 任意（未実施でも業務影響なし）|

### JBIZ menu_id 命名規則

| menu_id | メニュー名 | 単価 | 状態 |
|---|---|---|---|
| `SELF_CHRONIC50` | 慢性ケア手技50分 | 5,500円 | 有効 |
| `TRAINING_PERSONAL60` | パーソナルトレーニング60分 | 8,800円 | 有効 |
| `TRAINING_4PASS` | 4回集中コース | 35,200円 | 有効 |
| `GYM_MONTHLY` | ジム月会費 | 要確認 | 有効 |
| `SELF_INITIAL_EVAL` | 症状別初回評価 | 3,300円 | 有効 |
| `INS_BASE` | 保険基本施術 | 保険算定 | 有効 |
| `INS_OPTION_EXTEND10` | 手技延長 | 1,100円 | 有効 |
| `INS_OPTION_STRETCH20` | ストレッチ（20分） | 2,200円 | 有効（2026-03-23 新設）|
| `INS_OPTION_ELECTRO15` | 電療追加（15分） | 1,200円 | 有効（2026-03-23 新設）|
| ~~`INS_OPTION_FASCIA_GUN`~~ | ~~筋膜リリース（マッサージガン）~~ | ~~880円~~ | **廃止**（2026-03-23 ストレッチへ置換）|
| ~~`INS_OPTION_HEAT5`~~ | ~~温熱追加~~ | ~~550円~~ | **廃止**（2026-03-23 電療追加へ置換）|

> 新メニュー追加時は `大区分_詳細` 形式で追加する（例: `SELF_MYOFASCIA30`）

#### menu_id 運用ポリシー（2026-03-23 確定）

| ケース | menu_id の扱い |
|---|---|
| **価格のみ変更**（同じサービス内容） | **menu_id 維持**。JBIZ G列の単価だけ更新する。過去の自費明細データとの集計が継続できる |
| **サービス内容・時間・名称が変わる** | **新 menu_id を採番**。旧 menu_id は廃止記録として本テーブルに残す |
| **廃止メニュー** | JBIZ シートの M列「確定状況」を「廃止」に変更。C列 menu_id は削除しない（過去データのキーが壊れる）|

### JBIZ メニューマスタ 列定義（C列 = menu_id、2026-03-23 更新）

| 列 | ヘッダ | JREC参照 | 変更ルール |
|---|---|---|---|
| A | 表示順 | ❌ 未使用 | 自由 |
| B | 大区分 | ❌ 未使用 | 意味変更時は本ファイルに記録 |
| **C** | **menu_id** | **✅ 使用（識別キー）** | **変更するとJREC保存データとの整合が崩れる。変更不可（追加のみ可）。旧: 小区分（JREC未使用）から転用 2026-03-23** |
| **D** | **メニュー名** | **✅ 使用（表示名）** | **C列 menu_id 設定済みであることを確認してから変更する。変更後は過去の自費明細データと名称ズレが生じる（集計影響なし）** |
| E | 内容 | ❌ 未使用 | JBIZ運用上の意味が変わる変更は本ファイルに記録 |
| F | 時間 | ❌ 未使用 | JBIZ運用上の意味が変わる変更は本ファイルに記録 |
| **G** | **一般料金（円）** | **✅ 使用（unitPrice）** | 変更すると次回ダイアログから新単価が反映される |
| **H** | **ジム会員料金（円）** | **✅ 使用（memberPrice / Phase B 2026-03-31〜）** | B5チェックあり かつ > 0 のとき自費ダイアログで採用。0 or 空なら G列にフォールバック |
| I | 保険適用 | ❌ 未使用 | 意味変更時は本ファイルに記録 |
| J | 回数/単位 | ❌ 未使用 | 自由 |
| K | 主力手技フラグ | ❌ 未使用（将来対応予定）| 自由 |
| L | KPI集計対象 | ❌ 未使用（将来対応予定）| 自由 |
| **M** | **確定状況** | **✅ 使用（"確定" 行のみ取得）** | "確定" 以外の行はダイアログに出ない |
| N | 備考 | ❌ 未使用 | 自由 |
| O | （廃止） | ❌ 未使用 | 旧 menu_id 列。C列移動後は使用しない（2026-03-23）|

#### 列変更の記録ルール（2026-03-23 更新）

| ルール | 対象 |
|---|---|
| **記録必須（本ファイルへ）** | B・E・F・H の「意味・用途が変わる変更」（ヘッダ名変更・区分体系の変更等）|
| **変更前にC列設定を確認** | D列（メニュー名）の変更は C列 menu_id が設定済みであることを先に確認する |
| **変更不可** | C列（menu_id）の既存値変更。JREC自費明細シートの過去データとキーが不一致になる |
| **自由** | A・J・K（JREC未使用かつ意味変更なし）|

### 実装内容（Ver3_core.js）

| 変更 | 内容 |
|---|---|
| 定数追加 | `JBIZ_SS_ID` / `JBIZ_MENU_SHEET_CANDIDATES`（配列）/ `JBIZ_COL` / `JBIZ_MENU_ID_MAP` |
| `getJBIZMenuSheet_` | シート名候補を順に試すヘルパー関数（新設 — 2026-03-23 バグ修正で追加）|
| `getSelfPayMenuMaster_V3` | JBIZ 直接参照方式へ変更（旧: 設定シート参照）|
| `setupJBIZMenuMasterId_V3` | JBIZ C列 menu_id 初回セットアップ関数（新設）|
| `migrateJBIZMemberRules_V3` | 下段ルールメモを「会員優待ルール」シートへ移行（新設）|
| onOpen | setup / migrate 関数のメニュー項目追加 |
| fallback 更新 | M001→`SELF_CHRONIC50` 等、menu_id を新命名規則へ統一 |

### バグ修正記録（2026-03-23）

| 項目 | 内容 |
|---|---|
| **不具合** | 自費ダイアログ起動時「JBIZ シートが見つかりません: メニューマスタ（価格設定）」が表示され fallback に落ちていた |
| **一次原因** | `getSheetByName` に渡した名前「メニューマスタ（価格設定）」が JBIZ の実際のシート名「価格設定」と不一致 |
| **対応** | 定数を単値 → 候補配列 `JBIZ_MENU_SHEET_CANDIDATES` に変更し、`getJBIZMenuSheet_()` で順に探す方式へ |
| **候補順** | 1. メニューマスタ（価格設定） → 2. 価格設定 |
| **全不一致時** | 探した候補 + 実在シート名一覧をログ・ダイアログに表示 |
| **fallback** | 維持（JBIZ 不達・シートなし・0件すべてで業務継続）|

### テスト影響

| 項目 | 影響 | 対応 |
|---|---|---|
| T2-1 / T2-2 / T2-9 | ✅ PASS | 確認済み |
| T2-3a〜T2-3d | ✅ PASS | JBIZ参照・C列 menu_id 正常動作確認済み |
| T2-4〜T2-8 | ✅ PASS | snapshot単価・delete&replace・シート自動作成 確認済み |
| T2-10〜T2-12 | ✅ PASS | 保険算定・申請書ロジック 正常確認済み |

---

## WS-SR T-SR-10v2 再テスト結果（2026-04-02）

### 方針変更（2026-04-02 再整理）

| 項目 | 方針 |
|---|---|
| 0表示 | **入れない** |
| 判定なし | **blank のまま維持** |
| 変更対象 | **施術録側の表示 / 転記処理のみ** |
| 保護対象 | **申請書側の算定判定ロジックには原則手を入れない** |

### 再テストで確認できた点

| # | 観点 | 結果 |
|---|---|---|
| R-01 | 自費のみ日（3/2, 3/10）が裏面から除外 | ✅ OK |
| R-02 | 負傷名が「部位 + 傷病」で出力 | ✅ OK |
| R-03 | 表面の施術回数 / 日数 9 | ⏸ 大筋OK |

### 残課題

| # | 内容 | 状態 |
|---|---|---|
| P-01 | 裏面の月・日列が実テンプレ列と未一致。金額列も右流れに見える | 未解決 |
| P-02 | `cold / warm / elec / copay` の blank維持と列着地の確認 | 未解決 |
| P-03 | 14 / 16 / 17 の再判定は列位置修正後に行う | 保留 |
| P-04 | 表面の case2（例: `腰部 捻挫`）が月途中出現時に欠落する | 今回修正済み・実機未確認 |
| P-05 | 裏面 `505 / 1265` の基本料見え方が不自然 | 今回修正済み・実機未確認 |

### 今回の追加修正

| 修正 | 内容 |
|---|---|
| `Ver3_shuRecorder.js` | 裏面 fallback列を grouped cell 前提へ見直し（date / 初検料等 / 後療 / 冷温 / 電療 / 一部負担金 / 所見） |
| `Ver3_shuRecorder.js` | `月/日` は左端 1 セルへ `M/D` 形式で出力するよう再整理 |
| `Ver3_shuRecorder.js` | 表面 `srGetCaseData_` で、月内先頭行に case2 がなくても後続行の `p2 / d2 / inj2 / start2` を backfill するよう修正 |
| `Ver3_shuRecorder.js` | 裏面 `srGetVisitRows_` で `baseOut` を表示専用に再分離。`kubun=初検` は `初検料等`、`kubun!=初検` は `後療料` に着地させる |
| `Ver3_shuRecorder.js` | `0` は出さず、判定なし / 0 は blank 維持へ戻した |
| `docs/施術録導線/JREC-01_施術録実装設計.md` | 方針変更（0表示しない・blank維持・申請書ロジック保護優先）を追記 |

### 原因メモ（JREC-01再開）

| 項目 | 原因 |
|---|---|
| 表面 case2 欠落 | `srGetCaseData_` が月内最初の来院ケース行だけで `case2` を固定し、3/9 のような後続行の `腰部 / 捻挫` を拾えていなかった |
| 裏面 505 / 1265 の見え方 | `srGetVisitRows_` が `baseOut` を `kubun` 無視で 1 つの `後療料` 値に合算しており、`505(後療) + 760(初検)` が `1265` として見えていた |
| 申請書ロジック | 今回は **未変更**。施術録への集計・転記・表示だけを調整 |

### 次アクション

1. `Ver3_shuRecorder.js` の裏面列再マッピング確認
2. 手動で T-SR-10v2 再テスト再実施
3. `月/日, 初検料, 後療料, 冷罨法料, 温罨法料, 電療料, 一部負担金, 所見` の着地を確認
4. 14 / 16 / 17 を再判定して最終OK判定
5. 実機OKが取れた場合のみ `Run_Log / Dashboard` を更新

### 実行メモ

- `clasp push` は差分なし扱いで `Skipping push.` だったため、`clasp push --force` で再反映した履歴あり
- 2026-04-02 JREC-01再開分も `clasp push --force` 実施済み（`Ver3_shuRecorder.js` 最新反映）
- `clasp run` による自動実機実行は権限エラーでブロック
- `clasp run srRunTsr10v2Debug_` も `Unable to run script function. Please make sure you have permission to run the script function.` で未実行
- 今回は **0表示をやめて blank 維持へ戻す** 方針に切り替え

---

## 現在地（2026-03-23 更新）

- プロジェクト: 柔整毎日記録システム Ver3.1
- ディレクトリ: `gas-projects/jyu-gas-ver3.1/`
- 状態: **実装完了・実機確認完了・運用中**
  - Phase 0〜3 すべて完了
  - T1〜T6（Phase 1）+ T2-1〜T2-12（Phase 2）全PASS（2026-03-23）
  - JBIZ直接参照・C列 menu_id 移行・横断確認 すべて完了
- 優先度: 運用フェーズ（最優先から通常運用へ）
- ブランチ: `feature/auto-dev-phase3-loop`

### Phase 0: UI入力ギャップ解消（2026-03-22 設計完了）

> 詳細設計: `PHASE0_DESIGN.md` を参照

**問題:** 来院ヘッダの経営管理列（会計区分・自費メニュー区分・自費売上額・慢性候補フラグ・次回予約あり・新規区分）は
列定義・書き込みコードが存在するが、`saveVisit_V3` がUIから値を読んで渡しておらず常に空欄で保存される。

**設計内容:**

| 変更 | 内容 |
|---|---|
| 患者画面 行7〜8 | 「会計・経営情報ブロック」を設置（B7/D7/F7/H7/B8/D8/F8/H8）Phase 1 確定 2026-03-22 |
| UI オブジェクト | `selfPay_*` 7フィールドを追加 |
| HEADER_COLS | `selfPayMenuCode: "自費メニューコード"` を追加（将来拡張）|
| 新設関数 | `readSelfPayFromUI_V3_` / `clearSelfPayUI_V3_` / `setupSelfPayValidation_V3_` |
| saveVisit_V3 | selfPayInfo の読み取りと `appendHeaderRow_V3_` への渡しを追加 |
| clear関数 | `clearAfterSaveUI_V3_` / `clearEntryUI_V3` に `clearSelfPayUI_V3_` を追加 |

**コード変更済み（Ver3_core.js）:**
- UI オブジェクト: `selfPay_*` 7フィールド追加
- HEADER_COLS: `selfPayMenuCode` 追加
- 新設: `readSelfPayFromUI_V3_` / `clearSelfPayUI_V3_` / `setupSelfPayValidation_V3_`
- `saveVisit_V3`: selfPayInfo読み取り + appendHeaderRow_V3_ への渡し実装
- `clearAfterSaveUI_V3_` / `clearEntryUI_V3`: clearSelfPayUI_V3_ 追加
- メニュー: 「会計ブロック自動生成（患者画面 行7〜8）」追加（Phase 1 で名称変更済み）

**✅ Phase 1 実機確認完了（2026-03-22 院長）:**
- GASメニュー「会計ブロック自動生成（患者画面 行7〜8）」実行済み
- E5 条件付き書式設定済み
- T1〜T6 全項目OK（詳細: `UI_REDESIGN_PHASE1.md §テスト結果`）

**✅ repo cleanup 完了（2026-03-22）:**
- `test_import.py`（Cloud Runデバッグ用一時スクリプト）を削除
- `.claude/worktrees/` を追跡解除 + `.gitignore` に追加

**✅ Phase 2 設計 Rev.2 完了（2026-03-22）:**
- D7/F7 を表示専用化（自費明細集計結果を表示）
- 入力正本: 患者画面 HTML ダイアログ（案P2-B）
- 保存方式: visitKey 単位 delete & replace
- テスト観点 T2-1〜T2-8 定義済み
- 詳細: `SELF_PAY_DETAIL_DESIGN.md`（Rev.2）

**✅ Phase 2 コード実装完了（2026-03-22）:**
- SHEETS const に `selfPayDetail: "自費明細"` 追加
- 自費明細シート作成・ヘッダ初期化関数群実装
- delete & replace 保存関数群実装（saveSelfPayDetails_V3_ ほか）
- `selfPayDialog.html` 新規作成（価格マスタプルダウン・複数行・合計計算）
- `openSelfPayDialog_V3` / `getCurrentVisitKey_V3` / `saveSelfPayDetailsFromDialog_V3` 実装
- `getSelfPayMenuMaster_V3`（設定シート優先・フォールバック付き）実装
- `setupSelfPayValidation_V3_` 修正: D7/F7 表示専用（薄黄）・H8 状態表示（薄青）
- `clearSelfPayUI_V3_` 修正: H8 を "未入力" リセット
- `saveVisit_V3` に `checkSelfPayWarningBeforeSave_V3_` 追加
- onOpen に「自費明細入力」「自費明細シート初期化」メニュー追加
- `clasp push` 完了（2026-03-22）

**✅ 会計区分ゲート実装完了（2026-03-22 — 実機確認不具合の即時修正）:**
- **不具合:** 自費のみ選択時も保険継続 case が保存され、保険算定が実行されていた
- **原因:** `saveVisit_V3` が `accountingType` を保存ロジックの分岐条件として使っていなかった
- **修正:** `isInsuranceVisit = (acctType !== "自費のみ")` フラグで以下をゲート制御:
  - 必須フィールド / 治療法 / 転帰 / 近接部位チェック
  - `upsertOneCase_`（保険ケース保存）
  - `calcHeaderAmountsByVisitKey_V3_`（保険算定）
  - `upsertDetailRows_V3_`（施術明細保存）
- **新設関数 2個:**
  - `checkAccountingTypeCrossWarning_V3_` — 矛盾検出+confirm警告（自費のみ+保険データ残存 / 保険のみ+自費保存済み）
  - `buildZeroInsuranceAmounts_V3_` — 自費のみ時の全ゼロ金額オブジェクト
- **clasp push 完了（2026-03-22）**

**次のアクション（院長の手動作業）:**
- 価格マスタ テーブルを設定シートに手動追加（列: menu_id / メニュー名 / 一般料金 / asago会員料金 / KPI集計対象 / 確定状況）
- GASメニュー「会計ブロック自動生成（患者画面 行7〜8）」を再実行（D7/F7 表示専用化を患者画面に適用）
- GASメニュー「自費明細シート初期化」を実行（`自費明細` シート作成）
- Drawing ボタンをシートに設置して `openSelfPayDialog_V3` を割り当て（手順: SELF_PAY_DETAIL_DESIGN.md § Drawing ボタン設置手順）

**リスクなし:** 保険算定（Ver3_amounts.js）・申請書生成（Ver3_transferData.js）はコード変更なし

---

### Phase 2 実機確認状況（2026-03-23 全PASS）

> **T2-1〜T2-12 全項目 実機確認完了（2026-03-23 院長確認）**

#### ブロッカー修正記録（2026-03-22 — 参考記録）

| 項目 | 内容 |
|---|---|
| **症状** | T2-3 実施中: 自費入力後に「自費入力」ボタンを再押下すると「読み込み中…」で止まりダイアログが開かない |
| **根本原因** | `getCurrentVisitKey_V3()` の existItems に生 Date オブジェクト（treatDate/createdAt）が含まれ、`google.script.run` シリアライズ時にサイレント失敗。初回（existItems=[]）は問題なし、2回目以降でハング |
| **修正** | existItems を JSON-safe な4項目のみにマップ / try-catch + error フィールド追加 / バッチ読み取り最適化 |
| **修正ファイル** | `Ver3_core.js`（getCurrentVisitKey_V3）/ `selfPayDialog.html` |
| **clasp push** | ✅ 完了（2026-03-22）|

#### 全テスト結果（2026-03-23 実機確認完了）

| # | テスト内容 | 結果 | 備考 |
|---|---|---|---|
| T2-1 | 自費1件保存 | ✅ PASS | 自費明細1行 / D7=メニュー名 / F7=5500 / H8="1件保存済" / 来院ヘッダ更新 |
| T2-2 | 自費複数件保存 | ✅ PASS | 自費明細2行 / D7="〇〇ほか1件" / F7=14300 / H8="2件保存済" |
| T2-3a | 既存自費あり → 全削除 → 保存 | ✅ PASS | D7/F7 クリア / H8="未入力" / 自費明細シートの該当行が消える |
| T2-3b | 全削除後 → 再追加 → 保存 | ✅ PASS | 通常保存できる（D7/F7/H8 正常更新）|
| T2-3c | 全削除 → キャンセル | ✅ PASS | 保存されない / H8 変化なし |
| T2-3d | 金額変更して再保存 | ✅ PASS | 旧行削除 → 新行追記 / D7/F7/H8 再計算 |
| T2-4 | 価格マスタ変更後の過去データ | ✅ PASS | unitPrice は保存時点のまま（snapshot 維持）|
| T2-5 | 会計区分=保険のみ・自費なし | ✅ PASS | H8="未入力" / D7/F7 空欄 / 警告なしで saveVisit 続行 |
| T2-6 | clearEntryUI_V3 実行後 | ✅ PASS | D7/F7 空欄 / H8="未入力" / 自費明細シートは変化なし |
| T2-7 | delete & replace 後の他行ずれ | ✅ PASS | 削除後に他の visitKey 行がずれていないこと |
| T2-8 | 自費明細シートが存在しない場合 | ✅ PASS | ダイアログ起動時に自動作成（エラーにならない）|
| T2-9 | 自費のみ + 保険継続 case あり | ✅ PASS | confirm 警告: OK / 保険算定なし: OK / 施術明細への保険記録なし: OK |
| T2-10 | 自費のみ + 保険データなし | ✅ PASS | 警告なし / 自費明細のみ保存 / 来院ヘッダ保険列=0 |
| T2-11 | 保険のみ + H8="1件保存済" | ✅ PASS | confirm 警告が出ること / OK後: 保険通常保存 |
| T2-12 | 保険+自費（通常ケース） | ✅ PASS | 両方保存 / ヘッダ保険列+自費列ともに正常値 / 来院ケースあり |

#### T2-3 追加バグ：Bug A 修正（2026-03-23 完了）

**症状:** 既存自費明細を全件削除してダイアログで「保存して閉じる」を押すと「メニューを選択してください。」でブロックされ、自費クリアができなかった。全削除後に新規行を追加しようとしても操作を停止する原因になっていた。

| 項目 | 内容 |
|---|---|
| **根本原因** | `selfPayDialog.html` の `doSave()` で `hasError \|\| items.length === 0` を一括ガードしており、items=[] の「全削除保存」を一律ブロックしていた |
| **サーバー側** | `saveSelfPayDetails_V3_` は `items=[]` を正しく処理できる（既存行全削除 → D7/F7 クリア → H8="未入力"）。変更不要 |
| **修正箇所** | `selfPayDialog.html` の `doSave()` 1箇所のみ |
| **修正内容** | `hasError` と `items.length === 0` を分離。`items.length === 0` 時は confirm 確認の上、保存ルートへ進める |
| **clasp push** | 2026-03-23 実施 |

**T2-3 実機確認項目（修正後）:**

| # | 操作 | 期待値 |
|---|---|---|
| T2-3a | 既存自費あり → ダイアログ開く → 全削除 → 保存（confirm=OK） | D7/F7 クリア / H8="未入力" / 自費明細シートの当該 visitKey 行が消える |
| T2-3b | T2-3a 直後 → ダイアログ再開 → 新規追加 → 保存 | 通常保存できる（D7/F7/H8 正常更新）|
| T2-3c | 全削除 → 保存（confirm=キャンセル） | 保存されない / H8 変化なし |
| T2-3d | 金額変更して再保存（従来ケース） | 旧行削除 → 新行追記 / D7/F7/H8 再計算 |

**📌 設計ギャップ記録（今回は直さない）: 来院ヘッダ `selfPayAmount` 未更新**

| 項目 | 内容 |
|---|---|
| **問題** | `saveSelfPayDetails_V3_` はダイアログ保存時に D7/F7/H8 のみ更新し、来院ヘッダ（`selfPayAmount` 列）は更新しない |
| **更新経路** | 来院ヘッダへの `selfPayAmount` 書き戻しは `saveVisit_V3` 経由のみ |
| **影響** | ダイアログで自費を再保存しても来院ヘッダの自費売上額は古い値のまま（KPI 集計ズレの可能性） |
| **レセプト影響** | 保険申請書への影響なし（自費は申請書に含まない）|
| **対応方針** | ✅ **2026-03-23 解決済み**: 来院ヘッダから自費収益3列を撤去（下記参照）|

#### 設計方針確定（2026-03-23）: 来院ヘッダ 自費収益3列撤去

| 項目 | 内容 |
|---|---|
| **背景** | 自費明細ダイアログで再保存しても来院ヘッダの自費売上額が更新されない設計ギャップ（二重管理・陳腐化）が根本原因 |
| **方針** | 自費明細シートを唯一の正本にする。来院ヘッダから「自費収益データ」を撤去し、「来院性質データ」のみ残す |
| **撤去した3列** | `自費売上額`（selfPayAmount）/ `自費メニュー区分`（selfPayMenuType）/ `自費メニューコード`（selfPayMenuCode） |
| **残した4列** | `会計区分`（保険申請フィルタに必須）/ `慢性候補フラグ` / `次回予約あり` / `新規区分`（自費明細に対応列なし） |
| **コード修正** | `Ver3_core.js` — HEADER_COLS / appendHeaderRow_V3_ / exportHeaderFromCases_V3 / SETTINGS_CHOICE_MASTERS / HEADER_CHOICE_VALIDATIONS / readSelfPayFromUI_V3_ の計6箇所 |
| **サーバー側** | `Ver3_transferData.js` / `Ver3_amounts.js` / `write_application.py` は元から参照なし。変更不要 |
| **clasp push** | 2026-03-23 実施済み |
| **ユーザー操作（必須）** | 来院ヘッダシートから `自費売上額` / `自費メニュー区分` / `自費メニューコード` の3列を手動削除する（既存データは消える。GASコードが参照しないため機能影響なし） |

**KPI集計への影響（後回し可）:**

| 項目 | 内容 |
|---|---|
| **現状** | KPI集計で自費売上額を集計するGASは未実装 |
| **変更後の方針** | 自費売上集計は `自費明細` シートの `小計` 列を `SUMIF(visitKey列, 条件, 小計列)` で集計する |
| **優先度** | 低（KPI集計実装時に対応） |

#### ✅ 保険申請対象フィルタ修正（2026-03-23 完了）

> **レセプト事故防止の観点から必須対応 → 実施済み。**

**📌 自費のみ来院の申請書混入防止フィルタ（`Ver3_transferData.js`）**

| 項目 | 内容 |
|---|---|
| **問題** | `自費のみ` 来院は施術明細に記録されないが、来院ヘッダ経由で `V3TR_findPatientsForMonth_` の患者リストに混入し、保険請求額=0 の申請書が生成されるリスクがあった |
| **修正内容** | 2層の安全フィルタを追加 |
| **Layer 1** | `V3TR_findPatientsForMonth_` の来院ヘッダスキャンで `会計区分=自費のみ` の行をスキップ。列が存在しない旧データは安全方向でスキップせず通す |
| **Layer 2** | B案ループ・BatchExportJson ループで `parsed.case1["請求金額"]=0` かつ `parsed.case2["請求金額"]=0` の患者を `skipPatients` に退避し NDJSON に含めない |
| **安全ルール確定** | 保険申請対象 = `会計区分 ∈ {保険のみ, 保険+自費, ""(旧データ)}` かつ `保険請求額 > 0` |
| **影響なし** | 保険来院のある患者（施術明細あり）は Layer 1 でスキップされず、Layer 2 も claim > 0 で通過する |
| **clasp push** | 2026-03-23 実施済み |

**実機確認観点（次回月次処理時）:**

| 確認項目 | 期待値 |
|---|---|
| 自費のみ来院患者が当月にいる場合 | その患者がスキップされ、申請書が生成されない |
| スキップ時のログ | `[B案] 申請対象外スキップ（保険請求額=0）: <patientId>` |
| 保険+自費の患者 | 通常通り申請書生成（Layer 1 / Layer 2 ともに通過）|
| 既存 fixture への影響 | なし（fixture は per-visit 計算テストで transferData を経由しない）|

#### 改善候補（Phase 2 必須ではない）

| # | 内容 | 優先度 | ステータス |
|---|---|---|---|
| I-1 | 来院ヘッダ列順の整理: 論理グループ順に整列（保険算定→ケース識別→来院状態→経営KPI→保険監査） | Phase 3 以降 | ✅ 実装完了（2026-04-01）|

---

### I-1: 来院ヘッダ列順整理 — 実装完了（2026-04-01）

#### 変更理由

旧状態では列がフィーチャー追加の順で末尾に蓄積し、以下の混在が発生していた:
- `windowPay` / `claimPay`（保険算定）が `createdAt` の後ろに後付け配置
- `caseKey2`（ケース識別）が `gymMemberFlag` 等の経営KPI列の後ろに混在

#### 実装内容

**1. `HEADER_COLS` 定義順を論理グループ順に整理（`Ver3_core.js`）**

| グループ | 列（30列） |
|---|---|
| A 基本識別（3列）| visitKey / 施術日 / 患者ID |
| B 保険算定（9列）| 区分 / 受傷日_確定(来院) / 初検料〜来院合計 / **窓口負担額 / 保険請求額**（移動）|
| C ケース識別（3列）| caseKey / caseIndex / **caseKey2**（経営KPIゾーンから移動）|
| D 来院状態（5列）| 最終来院日 / 前回から日数 / 要確認 / 要確認理由 / 作成日時 |
| E 経営KPI（5列）| 会計区分 / ジム会員フラグ / 慢性候補フラグ / 次回予約あり / 新規区分 |
| F 保険監査（5列）| 算定区分 / Mixed区分 / case1要約 / case2要約 / 課金理由要約 |

> `HEADER_COLS` 定義順は `ensureHeaderCols_` による**新規列追加順**にも影響する（既存列は不変）。

**2. `reorderHeaderCols_V3()` GASヘルパー関数を追加**

| 機能 | 内容 |
|---|---|
| バックアップ | 実行前に `来院ヘッダ_BK_YYYYMMdd_HHmm` シートを自動作成 |
| ドライラン | Before/After の移動内容（最大10件）を確認ダイアログで提示 |
| 列並び替え | `sheet.moveColumns()` を左移動のみで処理（安全アルゴリズム）|
| 未定義列 | targetOrder にない列（廃止済みヘッダ等）は末尾に残す |
| 機能影響 | なし（全参照が `buildHeaderColMap_` による名前ベース）|

**3. メニュー追加**

`柔整ツール` メニューに「【I-1】来院ヘッダ列順整理（バックアップ付き）」を追加。

#### 移行手順（実機で実施するとき）

| 手順 | 操作 |
|---|---|
| 1 | `clasp push` で最新コードをデプロイ |
| 2 | スプレッドシートを再読み込み（ブラウザ更新）→ `柔整ツール` メニュー確認 |
| 3 | 「【I-1】来院ヘッダ列順整理（バックアップ付き）」を実行 |
| 4 | ドライランダイアログで Before/After を確認 → OK |
| 5 | バックアップシート名（`来院ヘッダ_BK_...`）をメモ |
| 6 | 来院ヘッダシートで列順を目視確認 |
| 7 | `saveVisit_V3` で1件テスト保存 → 来院ヘッダに正常保存されることを確認 |

#### ロールバック手順

1. バックアップシート（`来院ヘッダ_BK_...`）を開く
2. 全データをコピーして `来院ヘッダ` シートに貼り付け
3. ヘッダ行（行1）が正しく復元されていることを確認

#### 安全性根拠（固定列番号参照がない確認済みポイント）

| ファイル | 確認結果 |
|---|---|
| `Ver3_core.js` | `appendHeaderRow_V3_`・`setupHeaderChoiceValidation_V3_` 等 全参照が `headMap[HEADER_COLS.xxx]` ✅ |
| `Ver3_amounts.js` | `headMap` 経由 ✅ |
| `Ver3_transferData.js` | `V3TR_buildHeaderMap_` 経由 ✅ |
| `write_application.py` | 来院ヘッダを直接参照しない ✅ |

---

- 優先度: 最優先
- ブランチ: `feature/auto-dev-phase3-loop`
- 最新コミット: `34bcedf`

### 到達点スナップショット（2026-03-20 更新）

| 項目 | 状態 |
|---|---|
| Cloud Run `jrec-appgen-server` デプロイ | ✅ **Revision 00019-w8n deploy完了（2026-03-21）** — gunicorn 23.0.0 固定（25.1.0 worker fork バグ回避）・server.py 遅延 import 化・--preload 廃止 |
| `/health` 200 OK 確認済み | ✅ **確認済み（Revision 00019-w8n）** `{"status":"ok"}` 応答 0.13s。Booting worker pid:2 ログ確認済み |
| GAS Script Properties（APPGEN_ENDPOINT / APPGEN_SECRET） | ✅ 設定済み |
| `Ver3_smokeTest.js`（V3TR_smokeHealth / V3TR_smokeGenerate） | ✅ commit 済み |
| `clasp push`（最新 GAS を反映） | ✅ 2026-03-20 済み（7ファイル）|
| GAS → Cloud Run 疎通確認 | ✅ `/health` 200 OK（Revision 00010-h77）。`/generate` は B案実行で確認要 |
| 本番メニュー「【B案】申請書を生成して Drive に保存」 | ✅ **B案目視確認完了（2026-03-21 ユーザー全体OK）** — 楕円位置・各欄記入・罫線いずれも問題なし |
| 申請書上段欄（U1〜U7）実装 | ✅ 全欄実装済み（○専用画像方式 Revision 00012-7mn）|
| 下段 登録記号番号 分割欄書込 | ✅ 修正済み（CR51/DK51/DR51 分割書込、2026-03-20）|
| U6 給付割合 | ✅ **画像方式＋形状微調整済み（2026-03-21）** — KYUFU_OVAL_MAP を4列幅（DS-DV/DQ-DT）に拡張。style="kyufu"（margin_emu=9525）で横長楕円。|
| D4 負傷原因欄 | ✅ **書込先修正（本コミット）** BR20ラベル保持・BR21コンテンツ行書込 |
| B案プリフライト hard error | ✅ 実シート確認済み（2026-03-20）— mineo「患者氏名空欄」で除外ダイアログ表示 OK |
| B案プリフライト warning | ✅ 実シート確認済み（2026-03-20）— mineo「一部負担金割合0 / 窓口負担額0」で警告ダイアログ表示 OK |
| B案 2026-02 申請書生成 3件完了 | ✅ 実シート確認済み（2026-03-20）— 生成3件 / エラー0件 |
| B案高速化 P1（二重build除去） | ✅ 実装完了（2026-03-20）— `V3TR_exportTransferJson_` に `skipBuild` 引数追加、B案ループで `true` 渡し |
| mineo 患者マスタ直接確認（共有復旧後）| ✅ 確認済み（2026-03-20）— `負担割合=0.1`（正値）/ `一部負担金割合`列なし / `保険種別`空欄（Python自動判定で補完）|
| **U5保険種別文字列バグ修正・Revision 00007-vwf** | ✅ **完了（2026-03-20）** — 保険種別が文字列"後期高齢"で格納されるのにNumber("後期高齢")=0になり家族fallbackに落ちていた。名称→数値マップ追加+detectフォールバックで修正。GAS/Python両側修正・clasp push・Cloud Build・Revision 00007-vwf deploy済み |
| **B案最終確認（全患者クリーン）** | ✅ **完了（2026-03-20 人間実行）** — 3件生成 / エラー0件 / mineo warning なし / 目視確認OK / P1（二重build除去）出力不変確認済み |

> **別PC引継ぎ手順:** `docs/JREC-01_別PC再開手順.md` を参照
> **clasp 復旧手順（新PC用）:** `SETUP.md` §8章を参照

---

## 📋 過去記録（2026-03-20 Phase 0〜B案目視確認完了時点）

> **このセクションは履歴参照用。現在の再開手順はファイル冒頭「別PC再開手順」を参照すること。**

### 当時のプロジェクト状態（2026-03-20）

**B案目視確認完了・Cloud Run Revision 00019-w8n 稼働中（gunicorn 23.0.0 固定・server.py 遅延 import 化・--preload 廃止）・/health 200 OK 確認済み。次ステップへ進む準備完了。**

| カテゴリ | 状態 | 詳細 |
|---|---|---|
| **Phase 1 UI再設計（会計ブロック行7〜8）** | ✅ **実機確認完了** | T1〜T6 全項目OK（2026-03-22 院長確認）。UI_REDESIGN_PHASE1.md 参照 |
| B案申請書生成 | ✅ **本番稼働可能** | 3件生成/エラー0件/全患者クリーン（2026-03-20確認済み）|
| 申請書上段欄 U1〜U7 | ✅ 全欄実装済み | U2/U5/U6 制度公式確認完了・確定実装済み |
| D2 継続月数・頻回 | ✅ **設計確定・内部実装済み** | 正本=摘要欄+長期欄（手動）。M31空欄許容。A16:B20院内メモ（請求正本外）。clasp push / Cloud Run rev.00004-kc9 / ロジックテスト6ケースPASS（2026-03-20）|
| D5 施術証明欄 | ❌ 未実装 | 手書き運用継続。優先度低 |
| U5 後期高齢者本家区分 | ✅ **確定・実装済み** | 保険種別=6 or 75歳以上 → 高一（DH8）基本 / 7割給付（負担3割）のみ高7（DH12）。本人/家族区分は不使用（2026-03-20）|

### 参照ファイル（Phase 0〜B案完了時点）

> 現在も有効な参照先:
1. `docs/JREC-01_申請書様式運用メモ.md` → 各欄の詳細・暫定運用注記・制度定義
2. `SPEC.md §22` → 申請書欄 実装状況テーブル・残課題リスト
3. `docs/JREC-01_月次運用フロー.md` → 月次申請書生成手順

### 今回の実ファイル確認（B案再生成）で確定した値

| 項目 | 確定値 | セル | 備考 |
|---|---|---|---|
| 都道府県番号 | **28** | CI2 | 兵庫県。設定シート固定値 |
| 施術機関コード | **2804440-0-0** | CZ2 | 登録記号番号から先頭「契」除去・ハイフン保持（✅ 届出承諾通知書で確定済み 2026-03-21）|
| 単併区分 | **①.単独** | CT8 | 固定値 |
| 登録記号番号（左欄） | **契2804440** | CR51 | ハイフン前の部分（先頭「契」含む）|
| 登録記号番号（中欄） | **0** | DK51 | 1つ目ハイフン後 |
| 登録記号番号（右欄） | **0** | DR51 | 2つ目ハイフン後 |
| U6 9割給付（割合=1） | **10・⑨** | DP8 | '９'のみ丸付け（片側）|
| U6 8割給付（割合=2） | **⑧・７** | DP11 | '８'のみ丸付け（片側）|
| U6 7割給付（割合=3） | **８・⑦** | DP11 | '７'のみ丸付け（片側）|
| 後期高齢者 保険種別 | **⑥.後期** | CJ11 | 保険種別=6 |
| 後期高齢者 U5 本家区分 | **⑧高一**（期待値） | — | 保険種別文字列バグ修正済み（00007-vwf）。B案再生成で確認要 |
| 後期高齢者 U6 給付割合 | **10・⑨** | DP8 | 一部負担金割合=1（後期一般）|

### 実ファイル確認対象患者

| 患者ID | 概要 | 確認内容 |
|---|---|---|
| hirayamaka | 一般患者 | U1/U2/U4/U5/U6/U7/下段登録記号番号 全欄確認 |
| touji | 一般患者 | 主要欄確認 |
| mineo | 後期高齢者（保険種別=6） | 保険種別⑥・U5空欄・U6=10・⑨ 確認 |

> **総評:** 概ねうまくいっている。制度未確定領域（後期高齢者U5、高7表示）はまだ残る。

### 実シート確認結果（2026-03-20）

#### ✅ 確認済み（全項目）

| 確認内容 | 結果 | 備考 |
|---|---|---|
| B案で 2026-02 申請書生成（初回）| ✅ 3件生成 / エラー0件 | hirayamaka / touji / mineo |
| hard error ダイアログ表示 | ✅ 正常表示 | mineo「必須項目「患者氏名」が空」で除外確認ダイアログ表示 |
| hard error 除外後の他患者生成 | ✅ 確認済み | 問題患者を除外して他患者のみ生成が動作 |
| warning ダイアログ表示（検知テスト）| ✅ 正常表示 | mineo に一部負担金割合0 / 窓口負担額0 の warning が表示された |
| hard error / warning の画面文言 | ✅ 読める | 患者ごとに箇条書き・日本語文言で確認 |
| **B案最終確認（全患者クリーン）** | ✅ **3件生成 / エラー0件** | 2026-03-20 人間実行。mineo warning なし。目視確認OK |
| **mineo warning W1 消滅確認** | ✅ **出ないことを確認** | `負担割合=0.1` → `一部負担金割合=1` 自動導出 → warning 不発火 |
| **P1（二重build除去）後の出力不変確認** | ✅ **変化なし確認** | ファイル生成数・内容が従来と同じ |
| **生成ファイル目視確認** | ✅ **OK** | 氏名・保険者番号・金額・各欄いずれも問題なし |

#### 🔍 mineo 患者マスタ直接確認結果（2026-03-20 共有復旧後）

**確認方法:** サービスアカウント `id-719@e-carte-448107.iam.gserviceaccount.com` → スプレッドシート共有復旧 → gspread で 患者マスタ シートを直接取得（2026-03-20）。

**スプレッドシートID（確定）:** `1rXWkfAc_ppOfMV5Dxmb3maX9ORVrZbpSOX2Lz7RouZM`

**患者マスタ構造の判明事項:**

| col | 列名 | mineo の値 |
|---|---|---|
| 10 | 負担割合 | **0.1**（= 1割負担 = 10%） |
| 11 | 保険種別 | **空欄** |
| 12 | 保険者番号 | **39282256**（法別番号 39 = 後期高齢者） |

> **重要:** `一部負担金割合` という列は患者マスタに存在しない（45列を全確認）。

**制度上の根拠とシステムの判定ロジック:**

| 項目 | 内容 |
|---|---|
| 後期高齢者一般の負担割合 | 1割（0.1）|
| システム設定値（一部負担金割合桁）| 1 = 1割 / 2 = 2割 / 3 = 3割 |
| 自動導出ロジック | `V3TR_pickBurdenDigit_`: `負担割合=0.1` → `Math.round(0.1×10)=1` → 桁=1 |
| 期待 U6 | DP8 '10・⑨'（割合=1 → '９'→'⑨'置換）|

**保険種別の自動判定（Python側）:**

| 項目 | 内容 |
|---|---|
| 保険者番号 | 39282256（8桁）→ 先頭2桁 = 39 = 後期高齢者医療の法別番号 |
| `detect_insurance_type("39282256")` | → 6（後期高齢） |
| 申請書出力 | INSURANCE_TYPE_CELLS[6] → CJ11 '⑥.後期'（確認済み）|
| GAS側の年齢チェック | 昭和20年4月24日 = 1945年生 → 2026年時点81歳 ≥ 75歳 → 後期高齢者 ✓ |

**結論: 修正前値 / 修正後値 / 対応:**

| 項目 | 確認前想定 | 実際の値（直接確認）| 対応 |
|---|---|---|---|
| 一部負担金割合（列） | 0 または空欄（列あり想定）| **列が存在しない** | 対応不要（列を追加する設計ではない）|
| 負担割合 | 不明 | **0.1**（正しい。1割負担）| 修正不要 — 既に正値 |
| 保険種別 | 不明 | **空欄** | 修正不要 — Python が保険者番号から自動判定 |

> **前セッション warning の根本原因（推定）:** B案実行時点で `負担割合` が 0 または空欄だった可能性、もしくは転記データシートにキャッシュされた古い行が `一部負担金割合=""` を持っていた可能性。現在の `負担割合=0.1` であれば次回B案実行時は warning W1 は発火しない。

**B案最終確認（実行可否）:**
- GAS実行（スプレッドシートのメニュー操作）は Claude Code から不可
- **次回確認手順:** スプレッドシートを開く → 「柔整ツール」>「【B案】申請書を生成して Drive に保存」→ 2026-03（または2026-02）を指定 → プリフライト warning W1 が mineo で出なくなることを確認

### 今回修正して解消した不具合

| 不具合 | 原因 | 対応 | コミット |
|---|---|---|---|
| U6 が両方丸になっていた | `⑧・⑦` 固定文字列全体を書き込んでいた（セル置換方式が誤り）| KYUFU_CHAR_MAP で片側1文字のみ置換する方式に修正（U5と同方式）| b6a7c79 |
| 登録記号番号をラベル行（CR49）へ上書きしていた | テンプレート CR49:DV50 がラベル行であることを未確認のまま書込していた | openpyxlスキャンで入力欄（CR51/DK51/DR51）を確定し分割書込に修正 | b6a7c79 |
| B案再生成が最新実装を反映しない | clasp push は GAS のみ更新。Python（write_application.py）は Docker イメージに焼き込まれており Cloud Run 未再デプロイだと旧コードが動く | Docker rebuild（Cloud Build） + Cloud Run redeploy（Revision 00003-9mh）実施 | — |
| **B案で特定患者がスキップされると全員失敗する** | `patientCount` をループ前に `patientIds.length` で確定 → スキップ発生時に Python `validate_batch_safe` が patientCount不一致を検出 → `ValueError` → HTTP 400 → 全患者失敗 | ① patientCount後補正（A案・B案両方）: ループ後に `ndjsonLines.length - 1` で上書き。② B案プリフライト追加: Cloud Run POST前にcase1必須キーを GAS側検証、問題患者を除外して続行可能に | bed4550 |
| **負担割合0や金額不整合でも検知なしに POST していた** | プリフライトが「空かどうか」しか見ておらず、0値・金額合計不一致を見逃していた | ③ B案プリフライト第2段（warning）追加: 当月合計>0 の場合に 一部負担金割合0 / 窓口負担額0 / 請求金額0 / 合計不一致 を `preflightWarnings` として収集。除外なし・確認ダイアログのみ表示（ok→続行 / いいえ→中断）| ce9cda7 |
| **B案で1患者あたり build が2回実行されていた** | `V3TR_exportTransferJson_` 内が `V3TR_buildTransferDataForMonth_` を内部呼出していたためループ内で build が二重実行 | P1 二重build除去: `V3TR_exportTransferJson_` に `skipBuild` オプション引数を追加。B案ループ側で `build` 後に `skipBuild=true` で呼ぶことで 1患者1回に削減。他の呼び出し元（A案・A案個別）には影響なし | 2600dcb |
| **mineo U5=⑥家族 誤表示（保険種別文字列バグ）** | `保険種別` がGASマスタで `"後期高齢"` 等の名称文字列で保存されているのに、`V3TR_deriveHonkeku_`/`derive_honkeku_cell` が `Number("後期高齢")` = 0 に変換し後期高齢判定をスキップ → 続柄空白 → "家族" fallback | GAS: `INS_TYPE_NAME_MAP_` 追加（名称→数値変換）。Python: `_INS_TYPE_NAME_MAP` + `detect_insurance_type` fallback 追加。両側 clasp push / Cloud Build / Revision 00007-vwf 反映済み | 9d0e398 |
| **英語日付混入（"Mon Feb 02 2026..."）** | `V3TR_loadInitInfo_` の `get()` が `String(dateObj)` で英語Date文字列化。「負傷の日時」列がDate型セルの場合に発生。Python側では`put_wareki_ymd`をスキップするが、D4の`injury_text`に混入する | GAS: `get()` で `instanceof Date` チェック→`Utilities.formatDate("yyyy/MM/dd")` 変換 | （本コミット）|
| **「負傷の原因」D4書込先ずれ（再修正）** | `BR20:DV24`はラベル＋内容が同一結合セル。旧修正（E44/摘要欄）は暫定対応で意味的に誤り | Python: `BR20:DV24`をoutputファイル内のみ分割→BR20:DV20ラベル行（"負傷の原因"保持）＋BR21:DV24コンテンツ行。`D4_INJURY_CONTENT_CELL = "BR21"` に書込 | （本コミット）|
| **丸付けレイアウト崩れ（性別/保険種別/単独区分/本家区分）** | 文字置換方式（"1"→"①"等）がセルの文字縮小・位置ずれを引き起こしていた。テンプレートの固定ラベル文字も置換対象になりレイアウトが崩壊 | Python: `SELECTION_SPLIT_MAP`で各選択肢の結合セルをラベル行＋マーカー行に分割。テンプレート文字は保持し、マーカー行に"○"のみ書込む○専用セル方式に全面切替（`_apply_selection_splits` / `_write_selection_marker`）| c039ff7 |
| **テンプレート xlsx 日本語名 Cloud Build 失敗** | `療養費支給申請書.xlsx` の日本語ファイル名が Cloud Build 環境で文字化けし `COPY` ステップでファイル未検出 | `application_template.xlsx` に英数字リネーム。Dockerfile・write_application.py `TEMPLATE_FILE` を同名に修正 | ce29f9f |
| **英語日付文字列が D4 負傷の日時に混入** | GAS String型セル（`"Mon Feb 02 2026..."`）は `instanceof Date` チェックをすり抜け Python に英語日付文字列として渡る | Python側: `_normalize_date_str()` 追加。`_build_injury_text` 内で英語日付→YYYY/MM/DD正規化。GAS側修正の安全網 | 8941b19 |
| **旧ファイル（00008-8rx出力）が問題の出所** | 14:05 UTC に 00008-8rx でB案実行 → 14:13 UTC に 00010-h77 deploy。ユーザーは deploy 前のファイルを参照していた | 旧経路ではない。同一 URL でも deploy 前後でリビジョンが変わる。ファイル再生成で解消 | — |

### 今回完了したこと（2026-03-20）

| 項目 | 完了内容 |
|---|---|
| B案最終確認 | 3件生成 / エラー0件。プリフライト warning なし（全患者クリーン）|
| mineo warning W1 解消確認 | 負担割合=0.1 → 一部負担金割合=1 自動導出。warning 発火なし |
| P1（二重build除去）動作確認 | 出力ファイル数・内容が変わらないことを確認 |
| 申請書目視確認 | 氏名・保険者番号・金額・各申請書欄 いずれも OK |
| mineo 患者マスタ直接確認 | 共有復旧後 gspread 経由で確認。修正不要（負担割合=0.1 は正値）|
| JREC-01スプレッドシートID確定 | `1rXWkfAc_ppOfMV5Dxmb3maX9ORVrZbpSOX2Lz7RouZM` |
| **U5保険種別文字列バグ修正** | 根本原因: 保険種別の名称文字列("後期高齢")→数値変換漏れ。GAS/Python両側にINS_TYPE_NAME_MAPを追加。Revision 00007-vwf deploy済み |
| **○専用セル方式 全面実装** | 性別/保険種別/単独区分/本家区分の4項目を`SELECTION_SPLIT_MAP`方式に切替。テンプレート固定ラベル保持＋マーカー行"○"書込。openpyxlコードのみ変更（Cloud Run 再デプロイで反映）|
| **D4 書込先再修正（BR21）** | BR20:DV24を出力ファイル内で分割→BR20ラベル行保持・BR21コンテンツ行書込。E44摘要汚染なし。動作テスト確認済み（c039ff7）|
| **テンプレ英数字リネーム** | `療養費支給申請書.xlsx` → `application_template.xlsx`。Dockerfile・TEMPLATE_FILE修正。Cloud Build 文字化け問題を解消（ce29f9f）|
| **Cloud Run Revision 00011-24p deploy** | 英語日付正規化追加・全修正を反映。`/health` 200 OK 確認済み（2026-03-20）|

### 残課題（発生時対応）

| タスク | 種別 | 理由 |
|---|---|---|
| D5 施術証明欄・委任欄 | 未実装（低優先）| 手書き運用で当面は問題なし |
| 高7 の "⓪" 表示確認 | 発生時確認 | Unicode U+24EA が帳票上で正しく表示されるか実機確認が必要（後期高齢患者・7割給付ケース発生時）|
| D4 3部位ケースの実案件確認 | 発生時確認 | row2["部位1_計"]>0 の判定が実案件で正しく動くか確認（3部位来院発生時）|
| 改善候補 I-1: 来院ヘッダ列順整理 | 任意 | 「保険列/自費列/保険列(caseKey2)」の混在を整理。機能影響なし |

### Dashboard反映状況（2026-03-23 現在）

| 対象 | 状態 | 詳細 |
|---|---|---|
| GitHub（コード） | ✅ 反映済み | 最終コミット: `276b3bb`（feature/auto-dev-phase3-loop）|
| Cloud Run Revision | ✅ **反映済み** | **00019-w8n**（gunicorn 23.0.0 固定・/health 200 OK 確認済み 2026-03-21）|
| JREC-01スプレッドシート（患者マスタ） | ✅ 読取アクセス可能 | 共有復旧済み（2026-03-20）。**スプレッドシートID: `1rXWkfAc_ppOfMV5Dxmb3maX9ORVrZbpSOX2Lz7RouZM`** |

---

## 概要

接骨院の患者管理・保険算定・申請書作成を支援する Google Apps Script システム。
スプレッドシートをUIとして、来院登録から療養費支給申請書作成までを扱う。

---

## 完了済み

- `Ver3_core.js` に来院登録・区分判定・算定中枢ロジックを実装
- `Ver3_amounts.js` に金額計算を実装
- `Ver3_transferData.js` に申請書転記処理を実装
- `Ver3_patientPicker.js` に患者選択UIを実装
- `write_application.py` に申請書生成処理を実装
- `SPEC.md`、`PLAN.md`、`TESTCASES.md` を整備
- JBIZ-04 との役割分担を整理し、毎日記録ブックを日次入力の正本に固定
- 来院ヘッダの最小列追加について、追加位置・正式列名・選択肢マスタ案・月次KPI対応・リスク整理を文書化
- 来院ヘッダに `会計区分 / 自費メニュー区分 / 自費売上額 / 慢性候補フラグ / 次回予約あり / 新規区分` を末尾追加できる実装を反映
- `設定` シート `E:I` に選択肢マスタを持てるようにし、来院ヘッダの入力候補設定まで連動させた
- service account 経由で live スプレッドシートの現状を確認し、`設定` は実質 `A:D` 使用中・`E:I` 未使用、`来院ヘッダ` の現行末尾は `caseIndex` であることを確認

---

## 次アクション

> 最終更新: 2026-03-21（U2 施術機関コード 届出承諾通知書照合で確定完了）
> 次（発生時確認のみ残）: 高7「⓪」実機確認（患者来院時）/ D4 3部位実案件確認（発生時）

### ✅ 月次運用フロー整備 完了（2026-03-21）

- `docs/JREC-01_月次運用フロー.md` 新規作成
- 生成前確認 / 実行手順 / 生成後確認 / 再生成条件 / Cloud Run 再デプロイ条件 / 手書き欄 / 保存先管理 / トラブルシューティング / 月次チェックリストを一括整理
- 毎月の申請書生成はこのドキュメントに従って実施する

### ✅ exportHeaderFromCases_V3 新3列配線 完了（2026-03-17）

- `Ver3_core.js` に事前集計パス追加（visitKey → kubun1/kubun2 マップ）
- `Mixed区分 / case1要約 / case2要約` の3列をkubunから生成して書き込み
- `算定区分 / 課金理由要約` は空のまま維持（金額計算・保存で上書きされる）
- `case2要約` の初検抑制表現は近似（`"case2:初検"`）。金額計算後に正確値で上書きされる
- 確認状況: 既存ヘッダ全件が出力済みのため export 新規追加でのlive確認は省略。コードレビュー確認完了扱い
- **live 再確認予定: 来院ヘッダ再構築時（リセット→一括 export するタイミング）**
- commit: `168ecfc`

### ✅ transferData 表示列 正式仕様整合 完了（2026-03-18）

- `Ver3_transferData.js` の Mixed区分 / case1要約 / case2要約 / 算定区分 / 課金理由要約 を header 側正式仕様に整合
- **case2:初検(抑制)** 判定を追加: `case1.endDate < case2.startDate`（厳密）= [B] 治癒後 → 抑制なし / それ以外 = [A] 施術継続中 → 抑制
- **算定区分** を transferCols に追加: 初検/再検/後療/算定なし（`_effInitFee` で抑制フラグを反映、金額計算は変えない）
- **課金理由要約** を transferCols に追加: header 側と同一7パターンルール
- commit: （本 commit）

#### 整合確認観点（M01〜M03 / TC03）

| ケース | Mixed区分 | case1要約 | case2要約 | 算定区分 | 課金理由要約 |
|---|---|---|---|---|---|
| M01（case1=再検 / case2=初検抑制）| Mixed | case1:再検 | case2:初検(抑制) | 再検 | 初検抑制のため再検採用 |
| M02（case1=再検 / case2=初検算定可）| Mixed | case1:再検 | case2:初検 | 初検 | 算定可能な初検ありのため初検採用 |
| M03（case1=後療 / case2=初検抑制）| Mixed | case1:後療 | case2:初検(抑制) | 後療 | 初検抑制かつ再検対象なし |
| M05（case1=後療 / case2=再検）| Mixed | case1:後療 | case2:再検 | 再検 | 再検ありのため再検採用 |
| TC03（case1=後療のみ）| 通常 | case1:後療 | case2:なし | 後療 | 後療のみ |

#### 未解決論点（引き続き保留）

- M01 のケース: case1=再検(継続中)、case2=初検(抑制) のとき `V3TR_countKubunInCases_` は initCount=1 を返す（case2の初検を金額計算に含める）が、amounts.js は initFee=0 を算定する。金額不整合が残る。今回は「金額計算の正本は変えない」方針のため未修正。算定区分 display 列は `_initSuppressed` フラグで正しく表示できる。
- live 確認は次回転記再生成時（clasp push → 転記データ再生成）で実施する

### ✅ transferData 表示列 実シート確認 完了（2026-03-18）

| パターン | 実例 | 算定区分 | Mixed区分 | case1要約 | case2要約 | 課金理由要約 | 判定 |
|---|---|---|---|---|---|---|---|
| M01 | hirayamaka_2026-03-09 | 再検 | Mixed | case1:再検 | case2:初検(抑制) | 初検抑制のため再検採用 | ✅ OK |
| M03 | touji_2026-03-10 | 後療 | Mixed | case1:後療 | case2:初検(抑制) | 初検抑制かつ再検対象なし | ✅ OK |
| TC03 | mineo_2026-03-03 | 後療 | 通常 | case1:後療 | case2:なし | 後療のみ | ✅ OK |

- clasp push（707e3d1）→ 転記データ再生成 → 3パターン全て正式仕様と整合確認済み
- case2:初検(抑制) が M01 / M03 で正しく出力されることを実シートで確認

### ✅ M06b fixture 追加 完了（2026-03-18）

- `Ver3_test.js` に `M06b` fixture & expected を追加（JREC01_FIXTURES_ / JREC01_EXPECTED_）
- `tests/jrec01/fixtures/M06b_治癒後別負傷_case2初検.json` / `expected/` 追加
- `runFixtureM06b()` ラッパー関数追加
- `TESTCASES.md` の M06b セクションに fixture 仕様・金額不整合の確認箇所を追記
- fixture カウント: 46 → 47 件（PASS 確認は clasp push → runFixtureSuite() で実施すること）

**fixture 設計の要点:**

| 項目 | 設計判断 |
|---|---|
| テスト対象レイヤー | per-visit 計算（computeAmountsFromFixture_V3_）|
| treatDate | 2026-02-15（case1は2/10治癒済、case2新規初検）|
| initBilled=false | isCaseEndedBefore_ が確定した状態を monthlyStatus に直接設定 |
| reBilled=true | case1の再検(2/04)算定済・月内グローバルフラグ |
| reFee=0 | per-visit グローバル reBilled=true による抑制 |
| reBilled=true 影響 | M06b は hasReexam=false（case2=初検）のため reBilled は reFee に無関係。[A] 抑制は TC09b 参照。 |

### ✅ [A]施術継続中 再検料抑制バグ修正 完了（2026-03-18）

**問題:** [A] 施術継続中シナリオで case2=再検の来院日に reFee=410 が誤算定されていた。
**根本原因:** `calcHeaderAmountsByVisitKey_V3_` の reFee 判定に `!monthlyStatus.reBilled` チェックが欠落。`getMonthlyBilledStatus_` も reBilled に `isCaseEndedBefore_` を適用していなかった。

| ファイル | 対象関数 | 変更内容 |
|---|---|---|
| Ver3_amounts.js | `getMonthlyBilledStatus_` | reBilled 立てる前に `isCaseEndedBefore_` で [B] 判定 → suppressReBilled 時は reBilled=false を維持 |
| Ver3_amounts.js | `calcHeaderAmountsByVisitKey_V3_` | reFee 条件に `!monthlyStatus.reBilled` を追加 |
| Ver3_test.js | `computeAmountsFromFixture_V3_` | reFee 条件に `!ms.reBilled` を追加（production と同期） |
| Ver3_test.js | JREC01_FIXTURES_ | TC09b fixture 追加（[A] case1後療 / case2再検 / reBilled=true → reFee=0） |
| Ver3_test.js | JREC01_EXPECTED_ | TC09b expected 追加（reFee=0, visitTotal=1010） |

**修正後の[A]/[B]挙動整理:**

| シナリオ | isCaseEndedBefore_ | reBilled | reFee（case2再検来院日） |
|---|---|---|---|
| [A] 施術継続中 | false | true | 0（抑制）✅ |
| [B] 治癒後別負傷 | true | false（suppressReBilled） | 410（許可）✅ |

- fixture カウント: 47 → **48 件**（TC09b 追加）
- M06b fixture note の誤記（"per-visit reFee=0 だが V3TR=820"）を修正済み

### ✅ B-3: SPEC.md §14 実装整合更新 完了（2026-03-19）

- 施術明細列数を 23 → 27 に修正（metalChk / exerciseChk / metalOut / exerciseOut 追加）
- 列テーブルに §18.3 対応の4列を追記
- 行合計_確定の式に `+ metalOut + exerciseOut` を追加
- データフローの戻り値に metalOut / exerciseOut / metalChk / exerciseChk を追記
- fixture 48/48 PASS・TC09b 実シート確認を反映

**JREC-01 テストフェーズ（B-1〜B-3）完全クローズ**

### ✅ 特殊骨折制限 fixture 実装完了（2026-03-19）

- fixture/expected JSON（TC23a〜TC25b 9件）作成
- Ver3_test.js: `JREC01_FIXTURES_` / `JREC01_EXPECTED_` / wrapper関数 追加
- Ver3_amounts.js: §20 継続理由書アラートを骨折/不全骨折除外に修正
- Ver3_test.js: TEST_SETTINGS_._rawMap に 整復料_骨折_*/固定料_* 単価 14件追加
- fixture 件数: 48 → 57（TC23a〜TC25b 9件追加）
- clasp push 済み（2026-03-19）
- **✅ 57/57 PASS 確認済み（2026-03-19 GAS エディタ runFixtureSuite()）**

**実装済み fixture:**

| TC | 傷病 | 部位 / 条件 | ポイント |
|---|---|---|---|
| TC23a | 骨折 | 膝蓋骨（未定義部位） | base=0 + 要確認 |
| TC23b | 骨折 | 腰椎（脊椎） | base=0 + 要確認 |
| TC23c | 骨折 | 胸骨 | base=0 + 要確認 |
| TC23d | 骨折 | 大腿（定義済み） | base=11800 正常算定 |
| TC24a | 不全骨折 | 肩甲骨（未定義部位） | base=0 + 要確認 |
| TC24b | 骨折 | 後療 monthsElapsed=14 | ltCoef=1.0（長期減額対象外） |
| TC24c | 不全骨折 | 後療 monthsElapsed=14 | ltCoef=1.0（同上） |
| TC25a | 脱臼 | 後療 monthsElapsed=5 | ltCoef=0.75 + 継続理由書アラート |
| TC25b | 骨折 | 後療 monthsElapsed=3 | ltCoef=1.0 + アラートなし（§20 骨折対象外） |

### ✅ 特殊骨折制限 制度整理・fixture 設計 完了（2026-03-19）

- `FRACTURE_RESTRICTION.md` 作成（同ディレクトリ）
- 骨折/不全骨折/脱臼 の算定可否ルールを令和6年改正通知根拠で整理
- 現行実装の安全弁（mapBuiToSettingKey_ 未登録 → base=0）を確認・文書化
- TC23a〜TC25b 合計 9 件の fixture 境界ケース設計完了（実装も同日完了）
- 未実装事項（医師同意制御・特殊骨折医師依頼後療特例）を記録

### ✅ B案 帳票整合 設計方針確定（2026-03-19）

> 公式様式差分の対応方針を確定。実装前にドキュメント先行で記録。
> 詳細仕様は SPEC.md §22（差分修正方針）・§23（負傷名UI分割入力 設計案）を参照。

#### 確定方針

| # | 方針 | 対象差分 | 実装フェーズ |
|---|---|---|---|
| P1 | 施術継続中でも「施術終了年月日」は対象月の当該部位の最終施術日を入れる | D1 | ✅ **部位別maxDate対応済み（2026-03-19）** |
| P2 | 転帰は治癒・中止・転医のみ記載。継続中は空欄運用 | D1 | ✅ 現行実装で対応済み（setupTenkiValidation_ / H12,13,36,37）|
| P3 | 負傷名UIを「完成文字列選択」から「部位マスタ＋左右/上下＋傷病名」の分割入力へ移行 | D3 | 次フェーズ（設計完了後に実装） |
| P4 | 左右/上下は部位マスタの属性で条件表示する | D3 | 次フェーズ（P3と同時） |
| P5 | case別受傷日UIの見直しは保留 | — | 保留 |

#### コード調査結果（確認済み）

| 箇所 | 現行実装 | P1の変更必要性 |
|---|---|---|
| `Ver3_transferData.js:476` | `cs.endDate1 \|\| ""` （終了時のみ） | `cs.endDate1 \|\| aggDates.maxDate \|\| ""` に変更 |
| `Ver3_transferData.js:485` | `cs.endDate2 \|\| ""` （終了時のみ） | 同上 |
| `readRowNewUI_:657` | H列 = 転帰（治癒/中止/転医）読み込み済み | 変更不要（P2対応済み） |
| `ensureSettingsRows_V3` D列 | `右足関節`/`左足関節` 等の展開済み完成文字列を登録 | P3で部位マスタ方式に置き換え |

#### 実装インパクト概要

| 方針 | 変更ファイル | 変更規模 | リスク |
|---|---|---|---|
| P1 | `Ver3_transferData.js` 2行 | 最小（2行） | 転記データの施術終了欄が毎月入るようになる。意図通り |
| P2 | なし | ゼロ | なし |
| P3/P4 | `Ver3_core.js`（UI/validation/write）・`Ver3_transferData.js`（label生成） | 大（列構成変更）| 既存来院ケースデータとの互換性確認が必要 |

---

### ✅ B案 公式様式差分 整理完了（2026-03-19）

> B案メニュー実行・Drive出力OK後、実際の申請書と公式様式を照合して確認済みの差分を記録。
> 実装前に docs への記録を先行させる方針（SPEC.md §22 / TESTCASES.md TC-B01〜TC-B05 参照）。

#### 確認済み差分一覧（公式様式照合）

| No | 差分項目 | 現状 | 影響レイヤー | 優先度 |
|---|---|---|---|---|
| D1 | 施術終了年月日が未転記 | ✅ **実ファイル確認済み・クローズ（2026-03-19）** — 部位別maxDate二次fix + 実日数も確認済み | `Ver3_transferData.js:469-485` 修正・確認完了 | ~~高~~ **DONE** |
| D2 | 継続月数・頻回欄が未対応 | ✅ **設計確定・内部実装完了（2026-03-20）**— `V3TR_calcD2Keizoku_` 新設。正本=摘要欄（継続月数手動記入）＋長期欄（頻回→0.5・長期のみ→0.75、手動記入）。M31は空欄許容（補助表示扱い）。A16:B20（患者画面経過手入力）は院内メモ・請求正本外。clasp push + Cloud Run rev.00004-kc9 デプロイ済み | `Ver3_transferData.js` + `write_application.py` | ~~高~~ **DONE** |
| D3 | 負傷名の左右表記粒度 | `V3TR_buildInjuryLabel_` は `bui + byomei` 単純結合。左右が部位名に含まれる前提か不明 | `Ver3_transferData.js` ラベル生成 | **中** |

#### 申請書上段・31行目 未点検欄 点検タスク（2026-03-20 新設）

> **方針**: 「毎月必ず触る欄」で記載漏れになっていないかを整理。コード変更は今回なし。

| No | 欄名 | セル（✅=確定）| GAS側 | Python側 | 正本候補 | 優先度 |
|---|---|---|---|---|---|---|
| U1 | 都道府県番号 | ✅ **CI2**（CI2:CL3）| ✅ 設定シート「都道府県番号」→CI2 | ✅ clinic_info["prefectureNo"]→CI2 | 設定シート固定値（施術機関所在都道府県、2桁） | ~~中~~ **DONE** |
| U2 | 施術機関コード | ✅ **CZ2**（CZ2:DV3）| ✅ 登録記号番号から先頭協/契除去（ハイフン保持）→CZ2（✅ 確定）| ✅ derive_clinic_code()→CZ2（✅ 確定）| 設定「登録記号番号」の先頭協/契除去値（`2804440-0-0` 届出承諾通知書照合済み）| ~~中~~ **DONE** |
| U3 | 保険種別 | ✅ CB8〜CJ11（○付）| ✅ `master.insuranceType` | ✅ `INSURANCE_TYPE_CELLS` で○付 | 保険者番号から自動判定 or 患者マスタ | **DONE** |
| U4 | 単併区分 | ✅ **CT8**（単独）/ CT10（2併）/ CT12（3併）| ✅ CT8 "1.単独"→"①.単独" 書込 | ✅ put_era_circle(ws,"CT8",1) | 固定「単独」→CT8 / 将来: 患者マスタ「公費区分」 | ~~中~~ **DONE** |
| U5 | 本家区分 | ✅ **DB8**（本人）/ DB10（六歳）/ DB12（家族）/ DH8（高一）/ DH12（高7）| ✅ `V3TR_deriveHonkeku_()` 後期高齢対応確定 | ✅ `derive_honkeku_cell()` 後期高齢対応確定 | 後期高齢者（保険種別=6 or 75歳以上）→ 高一基本 / 7割給付のみ高7。本人/家族は70歳未満のみ | ~~中~~ **DONE** |
| U6 | 給付割合 | ✅ **DP8**（10・9割）/ **DP11**（8・7割）| ✅ `KYUFU_CHAR_MAP` 片側丸付け（修正2026-03-20）| ✅ `KYUFU_CHAR_MAP` 片側丸付け（修正2026-03-20）| 割合1→DP8('⑨')/2→DP11('⑧')/3→DP11('⑦')| ~~中~~ **DONE** |
| U7 | 請求区分（新規・継続） | ✅ **DH31**（DH31:DV31）| ✅ `row["請求区分"]`生成済み | ✅ `put(CELL_MAP["請求区分"], ...)`実装済み | 初検月=対象月→新規 / 前月以前→継続 / 同月内治癒再発→両方○（将来対応） | ~~高~~ **DONE** |

#### 各欄の詳細（2026-03-20 制度定義整理後）

**U1: 都道府県番号** — ✅ 実装済み（2026-03-20）★★☆
- 施術機関の所在都道府県コード（2桁）。保険者の都道府県ではない
- 設定シートキー: `都道府県番号` → CI2 に書込
- GAS: `V3TR_loadClinicInfo_()` で読み込み → `V3TR_writeToApplication_` で CI2 書込 / A案・B案 meta に付加
- Python: `clinic_info["prefectureNo"]` → `CELL_MAP["都道府県番号"]` (CI2) に書込

**U2: 施術機関コード** — ✅ 実装済み（2026-03-20）★★★（✅ 確定 2026-03-21）
- 国保連合会が付番する施術所固有コード（地方厚生局の登録記号番号とは別。神奈川県国保連記載要領原文で公式確認済み）
- **確定値**: 設定シート「登録記号番号」から先頭「協/契」の1文字のみ除去。ハイフンはそのまま保持して CZ2 に書込
  - 例: `契2804440-0-0` → `2804440-0-0`
  - ✅ 届出承諾通知書（兵庫県国保連合会発行）で照合済み（2026-03-21）。実装変更不要。
- GAS: `V3TR_deriveClinicCode_()` / Python: `derive_clinic_code()`

**下段 登録記号番号** — ✅ 実装済み（2026-03-20）→ 分割欄修正済み（2026-03-20）
- CR49:DV50 はラベル行「登録記号番号」→ **書き込み禁止**（旧実装の誤りを修正）
- 分割欄: 左=**CR51**:DH52 / 中=**DK51**:DO52 / 右=**DR51**:DV52（openpyxlスキャンで確定）
- 書込方式: `torokuKigoNo` をハイフンで3分割して各欄に記入。例: `契2804440-0-0` → 左=`契2804440` / 中=`0` / 右=`0`
- U2（CZ2・先頭協/契除去・ハイフン保持）とは別管理

**U4: 単併区分** — ✅ 実装済み（2026-03-20）★★☆
- 「単独」= 健保/国保単独。当面は固定「単独」で CT8 に書込
- CT8 テンプレート値 "1.単独" → "①.単独" にテキスト置換（circle パターン）
- GAS: `V3TR_writeToApplication_` 内でテキスト置換 / Python: `put_era_circle(ws, "CT8", 1)`

**U5: 本家区分** — ✅ 実装済み（2026-03-20）★★☆（★暫定運用★）
- 判定ロジック: 保険種別→続柄→生年月日（対象月末日時点年齢）→一部負担金割合
- GAS: `V3TR_calcAgeAtEndOfMonth_()` + `V3TR_deriveHonkeku_()` ヘルパー追加
- Python: `calc_age_at_end_of_month()` + `derive_honkeku_cell()` ヘルパー追加
- 書込: テンプレート内先頭数字を丸数字に置換（例: "2.本人"→"②.本人"）
- 使用列: `保険種別` / `続柄` / `患者生年月日` / `一部負担金割合` / `対象月`
- **★後期高齢者（保険種別=6 or 年齢75歳以上）は空欄（保留: 制度上の記載方式未確認）**
- "0.高7" の "0" は Unicode U+24EA "⓪" で置換（暫定: 帳票表示確認必要）

**U6: 給付割合** — ✅ 修正済み（2026-03-20）★★☆（★暫定運用★）
- 片側丸付け方式（U5と同方式）: テンプレートの対象数字1文字のみ置換
- テンプレート実値: DP8='10・９' / DP11='８・７'（全角文字）
- 割合=1: DP8 '９'→'⑨'（結果: '10・⑨'）/ 割合=2: DP11 '８'→'⑧'（結果: '⑧・７'）/ 割合=3: DP11 '７'→'⑦'（結果: '８・⑦'）
- GAS: `KYUFU_CHAR_MAP` / Python: `KYUFU_CHAR_MAP` 定数で管理（旧 KYUFU_CELLS+KYUFU_CIRCLE_TEXT を置換）

**U7: 請求区分（新規・継続）** — ✅ 実装済み（2026-03-20）★★★
- `row["請求区分"]` 生成: GAS側 `V3TR_buildTransferRow_` 内で `cs.firstDate` の年月 vs `ym` で "新規"/"継続" を判定
- DH31 書込: `write_application.py` の `put(CELL_MAP["請求区分"], seikyu_kubun)` で実装
- 保留: 同月内治癒再発（case1継続 + case2同月初検 → 両方○）は将来対応
| D4 | 負傷の原因欄 | ✅ **実装済み（2026-03-20）** 3部位目60/100算定時（row2["部位1_計"]>0）のみ BR20 に出力。GAS: V3TR_writeToApplication_ / Python: write_application() | — | ~~中~~ **DONE** |
| D5 | 施術証明欄・委任欄の自動/手書き分離が未明文化 | 両欄ともに py 実装なし（全手書き前提で空出力） | `write_application.py` + 運用ドキュメント | **低** |

#### 各差分の詳細

**D1 — 施術終了年月日 ✅ クローズ（2026-03-19）**

#### 実装内容

- 一次fix: `aggDates.maxDate` フォールバック追加
- 二次fix: `p1Dates.maxDate` / `p2Dates.maxDate` で部位別最終施術日に対応（優先順位: endDate → p1/p2Dates.maxDate → aggDates.maxDate → 空）

#### 実ファイル確認結果（2026-03-19）

| ファイル | 確認内容 | 結果 |
|---|---|---|
| `申請書_touji_2026-02_214947.xlsx` | 右肩関節打撲: 施術終了年月日=令和8年2月25日 / 実日数=8 | ✅ OK |
| `申請書_touji_2026-02_214947.xlsx` | 右上腕下部挫傷: 施術終了年月日=令和8年2月16日 / 実日数=4 | ✅ OK |
| `申請書_hirayamaka_2026-02_214947.xlsx` | 腰部捻挫: 施術終了年月日=令和8年2月16日 / 実日数=5 | ✅ OK |
| `申請書_hirayamaka_2026-02_214947.xlsx` | 肩関節打撲: 施術終了年月日=令和8年2月16日 / 実日数=3 | ✅ OK |

**確認判定:**
- D1空欄解消: OK
- 部位別最終施術日（部位で終了日が分かれて出力）: OK
- 実日数: OK（施術日カレンダーと整合確認済み）

**残課題なし。D1はクローズ。D2は設計確定・M31出力停止済み（B案: 既定で書かない）。**

**D2 — 継続月数・頻回（✅ 設計確定 2026-03-20 — M31出力停止・内部値計算のみ保持）**

#### セル確認（2026-03-19）✅

| 確認項目 | 結果 |
|---|---|
| 行31 の構造 | E31:L31=「経過」ラベル / **M31:CY31=空のマージセル（補助表示・当面未使用）** |
| 「頻回」「継続月」テキストを持つセル | **テンプレート全体で0件** |

#### 設計確定内容（2026-03-20）

| 項目 | 確定内容 |
|---|---|
| 正式出力先 | 摘要欄（継続月数）＋長期欄（頻回→0.5 / 長期のみ→0.75）— **手動** |
| M31 | **当面空欄（出力停止中）**。空欄提出でも制度違反なし |
| A16:B20（患者画面） | **院内メモ。請求正本に使わない** |
| 内部値 | `rawContMonths`/`freqStarted` — `V3TR_calcD2Keizoku_()` が計算・保持 |
| 継続月数の定義 | 月10回以上の施術を行った連続月数（単純経過月数ではない）|
| 頻回の成立 | 月10回以上×5か月連続 → 翌月から0.5逓減 |
| 頻回開始後 | 月10回未満でも治癒・中止・転医まで0.5継続（解除不可）|

#### コード状態

| ファイル | 状態 |
|---|---|
| `Ver3_transferData.js` | `V3TR_calcD2Keizoku_()` 存在・動作。`row["経過"]` は常に `""` を設定（出力停止中）|
| `write_application.py` | `CELL_MAP["経過"]="M31"` 存在。`if keizoku:` ガードにより現状はスキップ（出力停止中）|

#### 反映・確認済み（2026-03-20）

| 作業 | 結果 |
|---|---|
| clasp push | ✅ 7ファイル Pushed（Ver3_transferData.js / Ver3_test.js 含む）|
| Cloud Run | ✅ revision `jrec-appgen-server-00004-kc9` — 100% トラフィック |
| D2 ロジックテスト | ✅ 全6ケース PASS（`runD2Suite()` で確認可能）|
| M31出力停止 | ✅ `row["経過"]=""` 設定済み。clasp push 要（次回 de 時に反映）|

**D3 — 負傷名の左右表記**

- `V3TR_buildInjuryLabel_(partAgg)` = `partAgg.bui + " " + partAgg.byomei`
- `partAgg.bui` は施術明細の「部位」列の値そのまま
- 現場入力が「右頸部」「左足関節」のように左右込みで入力されていれば問題なし
- 問題ケース: 「頸部」と入力し左右なしで記録されていると申請書の負傷名欄に左右が出ない
- **確認箇所**: 実シートの部位名入力フォーマット（左右を部位名に含めているか）

**D4 — 負傷の原因欄** — ✅ 実装済み（2026-03-20）

- 出力条件: 「3部位目を100分の60で算定することとなる場合」= `row2["部位1_計"] > 0` が true のとき
- 新しい transferCol 追加なし。既存の `負傷の状況` / `負傷の場所` / `負傷の日時` (transferCols登録済み) から派生
- GAS: `V3TR_writeToApplication_` に `V3TR_buildInjuryText_` + part3HasData 判定を追加
- Python: `write_application()` に `_build_injury_text()` + part3_has_data 判定を追加
- 出力形式: `{負傷の場所　負傷の状況　負傷の日時}` を全角スペース結合。複数ケースは " / " で結合
- ★ 後期高齢・2部位以下・3部位目実績なし → BR20 空欄（制度上正しい）
- ★ 残課題: multiCoef3 が 0.6 以外の設定の場合の判定精度 / 告示原文での制度確認

**D5 — 施術証明欄・委任欄**

- 施術証明欄（施術者氏名・施術所名・所在地）: 院側の固定情報 → 設定シートから自動入力可能
- 委任欄（患者の委任署名・日付・患者氏名記入）: 患者が手書きする必須欄 → 自動入力不可
- 現状は両欄とも空出力（py 実装なし）
- **明文化方針**: 施術証明欄は設定シートに院情報を登録して自動出力、委任欄は手書き前提として py は対象外とする

---

### 次タスク候補（優先順）

| 優先 | タスク | 分類 | 概要 |
|---|---|---|---|
| 1 | ~~runFixtureSuite() PASS確認~~ | ✅ **完了** | 57/57 PASS 確認済み（2026-03-19） |
| 2 | ~~transferData への新5列反映~~ | ✅ **実装済み（調査完了）** | transferCols に全5列記載済み・V3TR_buildRows_ でセット済み（2026-03-18）。write_application.py は5列を参照しない（申請書不要・監査列のため正しい）。schemaVersion "3.0" 継続で問題なし。コード変更不要。 |
| 3 | ~~B案メニュー実行確認~~ | ✅ **完了** | 疎通確認・メニュー実行・Drive出力まで一通り確認済み（2026-03-19）|
| **次** | **B案 出力内容確認** | 🔵 **次の作業** | 生成された申請書のレイアウト・金額・患者情報・部位負傷名・請求額の整合確認 |

**保留継続:**
- 運動後療料 月2回特例 → `docs/JREC-01_運動後療料_月2回特例メモ.md` 参照（根拠資料未確認のため）
- 既存データ一括再計算メニュー → 低優先度
- 保存先フォルダIDやURLを設定値・ログ・ドキュメントに明記 → B案出力内容確認フェーズで実施

### ✅ 温罨法初検日特例 実装完了（2026-03-17）

- **33/33 PASS 確認済み**（TC01〜TC17b + M01〜M05）
- TC17a（初検日特例・warm=0）/ TC17b（後療日通常算定・warm=75）すべてPASS
- `calcOnePartAmount_V3_`: kubun=初検 時に warm=0 固定（初検日特例）

### ✅ 金属副子等加算 Phase 2 実装済み（2026-03-17）— clasp push 後 40/40 PASS 確認待ち

- TC20a/b/c 実装済み（1回目・3回目・上限超）
- `buildMetalCountByCaseKey_V3_`: 施術明細から caseKey 単位の通算算定回数を集計（beforeDate 以前、visitKey 重複除去）
- `calcOnePartAmount_V3_`: `metalPriorCount` 引数追加 → 3回以上で 要確認「金属副子等加算 算定上限超（通算3回）」
- `calcCaseDetailAmount_V3_`: `detailValues`/`detailMap` 引数追加 → `buildMetalCountByCaseKey_V3_` を呼び出し
- `calcHeaderAmountsByVisitKey_V3_`: 施術明細シート読み込みを追加
- `recalcAmountsByVisitKey_V3_`: metalPriorCount を計算して渡す

### ✅ 金属副子等加算 Phase 1 実装完了（2026-03-17）— 37/37 PASS 確認済み

- TC19a/b 実装済み（骨折=算定可・捻挫=要確認）
- `AM_SET_KEYS.metalAddon` / `loadSettings_V3_` に `金属副子等加算` = 1,000 追加
- `AM_DETAIL_COLS` に `metalChk / metalOut` 追加（施術明細列）
- `CASE_COLS` に `metal1 / metal2` 追加（来院ケース列）
- `calcOnePartAmount_V3_`: `metalChk` 引数追加 → 骨折/不全骨折/脱臼→1,000円, C群→0+要確認
- `metalOut` は逓減（coef・ltCoef）対象外 → `total += metalOut`（乗算なし）

### ✅ 長期継続理由書アラート 実装完了（2026-03-17）— 35/35 PASS 確認済み

- TC18a/b PASS 確認済み。TC14a/b・TC16a/b/c expected 更新済み
- `calcMonthsElapsed_V3_`: 受傷日から来院日までの月数を計算（共通ヘルパー）
- `calcOnePartAmount_V3_`: monthsElapsed ≥ 3 → `"長期施術3か月超（継続理由書確認）"` を needCheck reason に追加
- 長期減額 reason（あれば）が先、継続理由書 reason が後（セミコロン区切り）

### ✅ 長期50%逓減 実装完了（2026-03-17）

- **31/31 PASS 確認済み**（TC01〜TC16c + M01〜M05）
- TC16a（50%適用）/ TC16b（75%維持・頻回未達）/ TC16c（4か月目・条件未達）すべてPASS
- `buildMonthlyVisitCounts_V3_`: 来院ヘッダから caseKey 単位の月別来院数を集計
- `calcLongTermCoef_V3_`: 4引数化。monthlyVisitCounts 全月≥10 → 0.50、そうでなければ 0.75
- 起算月ルール: 初検日<16日→当月起算、≥16日→翌月起算（ユーザー確認済み 2026-03-17）
- 確認済み単価: koryoDakkyu=720 / seifukuDakkyu=5200 / warm=75 / electro=33 / taiki=5 / cold=85
- `runFixtureSuite()` で一括実行可能（31 件→35 件）

### 未実装制度論点（優先順）

| 優先 | 項目 | 状況 |
|---|---|---|
| 高 | 温罨法 初検日特例 | ✅ 実装済み（TC17a/b PASS）|
| 中 | 長期継続理由書アラート | ✅ 実装済み（TC18a/b PASS 確認済み）|
| 中 | 金属副子等加算 Phase 1 | ✅ 実装完了（TC19a/b PASS 確認済み）|
| 低 | 金属副子等加算 Phase 2（回数制限） | ✅ 実装完了（TC20a/b/c PASS 確認済み）|
| 中 | 特殊骨折制限（3部位目以降の制限等） | 未調査。骨折+多部位の制限条件があれば fixture で境界確認が必要 |
| 中 | transferData への新5列反映 | 申請書データへの反映可否を検討 |
| 低 | 既存データ一括再計算メニュー | 過去来院ヘッダへの新5列遡及反映 |

### ✅ B案メニュー実行・Drive出力確認完了（2026-03-19）

#### 実施内容

| 手順 | 結果 |
|---|---|
| 新PCで `.clasp.json` 復旧（Script ID から `clasp clone`） | ✅ 完了 |
| `jyu-gas-ver3.1` フォルダに `.clasp.json` コピー | ✅ 完了 |
| `clasp push` 実施 | ✅ 完了 |
| `Ver3_core.js:228` メニュー登録確認 | ✅ 確認済み |
| `Ver3_transferData.js:1984` `V3TR_menuGenerateApplication_B()` 実装確認 | ✅ 確認済み |

#### 疎通確認結果

| テスト | エンドポイント | 結果 | レスポンス |
|---|---|---|---|
| V3TR_smokeHealth | `https://jrec-appgen-server-j6vlxdvqaa-an.a.run.app/health` | HTTP 200 | `{"status":"ok"}` |
| V3TR_smokeGenerate | `/generate` | HTTP 200 | `{"status":"ok","patients":[],"month":"2026-03","generatedAt":"..."}` |

#### B案メニュー実行結果

- **メニュー:** 柔整ツール → 「【B案】申請書を生成して Drive に保存」
- **実行結果:** OK
- **Drive出力:** OK
- **対象患者数:** 1件
- **エラー:** なし
- **出力先フォルダ:** 確認済み

#### 重要判断（記録）

- B案は「Cloud Run 疎通確認 → GAS連携 → メニュー実行 → 実ファイル出力」まで通過済み
- 新PCでも Apps Script / clasp 復旧手順が確認できた（`SETUP.md` §8章に手順追記）
- この時点で **B案はスモークテスト段階を通過**。次は出力内容確認フェーズ

#### 次フェーズ（出力内容確認）

| 確認項目 | 内容 |
|---|---|
| レイアウト崩れ | 帳票の枠・位置ずれがないか |
| 金額整合 | 当月合計・窓口負担額・請求金額が正しいか |
| 患者情報 | 氏名・生年月日・保険者番号・住所 |
| 対象月 | ヘッダに正しい月が入っているか |
| 部位・負傷名 | 記載内容が転記データと一致しているか |
| 請求額 | write_application.py の A案出力と比較確認 |

---

### ✅ Cloud Run デプロイ完了（2026-03-19）

| 項目 | 状態 |
|---|---|
| Secret Manager `JREC_APPGEN_SECRET_KEY` 登録 | ✅ 完了 |
| Cloud Run SA に Secret Accessor 権限付与 | ✅ 完了 |
| Docker build / tag / push | ✅ 完了 |
| Cloud Run `jrec-appgen-server` デプロイ | ✅ 完了 |
| `/health` エンドポイント 200 OK 確認 | ✅ 完了（`{"status":"ok"}`）|
| GAS Script Properties `APPGEN_ENDPOINT` / `APPGEN_SECRET` 設定 | ✅ 完了 |

**次アクション:**

スモークテスト関数を `Ver3_smokeTest.js` に追加済み（2026-03-19）。以下の手順で実行する。

### STEP 1: clasp push

```bash
cd gas-projects/jyu-gas-ver3.1
clasp push
```

### STEP 2: /health 疎通確認

1. Apps Script エディタを開く（スプレッドシート > 拡張機能 > Apps Script）
2. 関数プルダウンで **`V3TR_smokeHealth`** を選択して「実行」
3. 期待: アラートに `✅ /health OK / HTTP: 200 / Body: {"status":"ok"}`

### STEP 3: /generate 疎通確認（患者0件の最小 NDJSON）

1. 同エディタで **`V3TR_smokeGenerate`** を選択して「実行」
2. 送信内容: 患者データなし・meta行のみ（実来院データ不要）
3. 期待: アラートに `✅ /generate OK / HTTP: 200 / Body: {"status":"ok","patients":[],...}`

### STEP 4: 本番メニューで実データ送信

上記2ステップ成功後:
1. スプレッドシートを開いてメニュー「柔整ツール」>「**【B案】申請書を生成して Drive に保存**」
2. 月を確認して OK
3. 完了アラートで「エラー: 0 件」を確認
4. Drive フォルダに xlsx が保存されているか確認
5. `_申請書生成ログ` シートに `OK` 行が追記されているか確認

### 失敗時の確認点

| 症状 | 確認先 |
|---|---|
| `APPGEN_ENDPOINT が未設定` | Script Properties の値を再確認 |
| HTTP 401 | `APPGEN_SECRET` の値と Cloud Run の `JREC_APPGEN_SECRET_KEY` が一致しているか |
| HTTP 400 | NDJSON フォーマット / schemaVersion 確認 |
| HTTP 500 | GCP Console > Cloud Logging でスタックトレース確認 |
| 接続失敗 | `APPGEN_ENDPOINT` の URL が正しいか（末尾スラッシュなし）|

### 次フェーズ候補

1. **申請書生成フロー B案** — ✅ Cloud Run デプロイ完了・/health 確認済み。次: GAS → Cloud Run 疎通確認 → 本処理エンドポイント確認
2. **特殊骨折制限** — 骨折+多部位の制限条件調査と fixture 追加
3. ~~transferData への新5列反映~~ — ✅ 実装済み確認済み（2026-03-19）

### 中長期

- 申請書生成フローの実運用確認
- 現場運用で `会計区分` と `区分` の混同が起きないかを入力確認
- 次段階で `保険新規 / 自費直新規` の実入力運用を設計

---

## 保留事項

- 実スプレッドシート上での最終確認状況は人手確認が必要
- 単価や算定条件の制度変更時は `SPEC.md` と設定シートの両方を見直す
- `保険新規 / 自費直新規 / 再来` の分離運用は次段階で必ず着手する
- 現在のローカル設定では container-bound GAS の script ID が取れておらず、`clasp run` / Execution API による live 関数実行確認は未完了
- bound GAS の script ID / `.clasp.json` / `executionApi.access=MYSELF` / API executable deployment までは確認済み。2026-03-15 時点の残課題は `scripts.run` 実行権限で、`clasp run ensureSettingsRows_V3` は devMode で permission エラー、`--nondev` では API executable 未解決エラーになる
- Apps Script Execution API の 403 条件として「呼び出し側 OAuth client とスクリプト側が同じ Google Cloud project を共有していること」が公式要件。現状はここが最後の有力候補で、最短ルートは Apps Script エディタから `ensureSettingsRows_V3` を手動実行して live 反映確認しつつ、必要なら標準 GCP プロジェクト側の紐付けを確認すること

---

## 直近の重要判断

- 来院ヘッダの追加位置は `caseIndex` 右側の末尾追加を第一案とする
- 追加する正式列名は `会計区分 / 自費メニュー区分 / 自費売上額 / 慢性候補フラグ / 次回予約あり / 新規区分`
- 選択肢マスタは `設定` シート右側の `E:I` を第一案とし、既存の `A:D` 用途を崩さない
- 既存コードは見出し名ベース参照のため、末尾列追加なら既存処理影響は限定的と判断
- `新規区分` は今回は受け皿だけ用意し、`保険新規 / 自費直新規` の必須運用は次段階で行う
- save/export 経路で来院ヘッダ不足列を自動補完し、設定シート側では選択肢マスタと入力候補を一括で整える
- live 実行の切り分けでは、`ensureSettingsRows_V3` 自体はトップレベル関数として存在し、API executable deployment も作成済みのため、実装本体より execution 条件側を優先確認する

---

## テスト状況

- テストケース文書: `TESTCASES.md` あり
- fixture テスト基盤: `Ver3_test.js` + `tests/jrec01/fixtures/` + `tests/jrec01/expected/` 整備済み
- fixture 件数: 57件（TC01〜TC25b + TC09b + M01〜M05 + M06b）
- **✅ 57/57 PASS 確認済み（2026-03-19）** TC01〜TC25b 全件 runFixtureSuite() で通過確認済み
- 実シート確認済み: M01 / M02 / M03 / M04 / M05 / TC09b
- Apps Script メニューから `runFixtureSuite()` で一括実行可能
- 確認済み単価: koryoDakkyu=720 / seifukuDakkyu=5200 / warm=75 / electro=33 / taiki=5 / cold=85

---

## 重要ファイル

- `README.md`
- `SPEC.md`
- `PLAN.md`
- `TESTCASES.md`
- `Ver3_core.js`
- `Ver3_amounts.js`
- `Ver3_transferData.js`
- `write_application.py`

---

## コード正本と同期ルール（2026-03-16 確定）

### 正本の定義

| 対象 | 正本 | 参照元 |
|---|---|---|
| GAS コード（.js）| GitHub `feature/auto-dev-phase3-loop` | Claude Code / ChatGPT はここを読む |
| 申請書スクリプト（.py）| GitHub 同上 | 同上 |
| 療養費算定ルール | `SPEC.md` / `JREC-01_制度SPEC_v0.9.md` | GitHub |
| 実運用データ | Google スプレッドシート | Apps Script で書き込み |

**Apps Script エディタは編集場所ではなく実行場所**。コードの変更は必ず GitHub 経由で行い、その後 `clasp push` で Apps Script に反映する。

### GAS 修正後の必須手順

```
1. ローカルでコードを編集
2. git add / commit / push → GitHub に反映
3. clasp push → Apps Script エディタに反映
```

```bash
# 手順3のコマンド（jyu-gas-ver3.1 ディレクトリで実行）
cd gas-projects/jyu-gas-ver3.1
clasp push
```

### やってはいけないこと

- Apps Script エディタで直接コードを編集する（GitHub と乖離する）
- `clasp pull` でローカルを上書きする（GitHub の変更が失われる）
- clasp push せずに GitHub だけ更新したまま放置する

### 最終 clasp push 状況

| ファイル | 最終 GitHub commit | Apps Script 反映 |
|---|---|---|
| Ver3_amounts.js | `209ceb9`（2026-03-18）| ✅ clasp push 済み |
| Ver3_core.js | `7dd0790`（2026-03-17）| ✅ clasp push 済み |
| Ver3_test.js | `209ceb9`（2026-03-18）| ✅ clasp push 済み |
| Ver3_transferData.js | 2026-03-20（U7請求区分実装）| ✅ clasp push 済み（2026-03-20）|
| write_application.py | 2026-03-20（U7請求区分 put()追加）| N/A（ローカルのみ）|
| Ver3_patientPicker.js | 変更なし | 問題なし |
| SPEC.md | `22447fd`（2026-03-17）| N/A（ローカル文書のみ）|

### clasp status について

`clasp status` はファイルの追跡状況のみ表示し、Apps Script との内容差分は表示しない。
内容差分の確認には `clasp pull`（ローカル上書き）が必要だが、GitHub 正本運用下では原則使わない。

---

## 再開メモ

作業再開時は、まず `README.md`、`SPEC.md`、`TESTCASES.md` を確認し、次に対象ロジックの実装ファイルを読む。
制度変更や単価変更に関わる作業では、コードより前に仕様との整合を確認する。
JBIZ-04 には日次入力を持たせず、このブックを現場入力の正本として使う前提を崩さない。
**コード修正後は必ず `clasp push` まで行うこと（上記「コード正本と同期ルール」参照）。**

---

## 2026-03-15 完了整理

- 実装完了: 来院ヘッダ6列追加と `設定!E:I` 候補マスタ反映の最小実装まで完了
- live 確認完了: Apps Script エディタから `ensureSettingsRows_V3` を手動実行し、`設定!E:I` と来院ヘッダ6列の反映、既存列・既存データ非破壊を確認
- 保留: `clasp run` / Execution API 調査は別タスク。現時点ではコードではなく実行条件側の課題の可能性が高い

---

## 2026-03-17 再検料月内上限ロジック修正 + amounts.js 治癒後初検抑制解除

### 修正概要

| 対象ファイル | 対象関数 | 変更内容 |
|---|---|---|
| Ver3_transferData.js | `V3TR_countKubunInCases_` | `reCount` を `Math.min(rawReCount, validInitCount)` に変更（cebeffe）|
| Ver3_transferData.js | `V3TR_countKubunInCases_` | `initCount` を `Math.min(rawInitCount, validInitCount)` に変更（本 commit）|
| Ver3_amounts.js | `getMonthlyBilledStatus_` | 治癒後別負傷 [B] 判定を追加（opt_caseSh / opt_caseMap / opt_treatDate）|
| Ver3_amounts.js | ─ | `isCaseEndedBefore_` ヘルパー追加 |

### 判定ロジック（全層整合済み）

```
V3TR_countKubunInCases_（transferData）:
  validInitCount:
    [A] 施術継続中 Mixed: 先行ケース終了日なし or >= 後続初検日 → 1
    [B] 治癒後別負傷:     先行ケース終了日 < 後続初検日（厳密）   → 2
  initCount = Math.min(rawInitCount, validInitCount)
  reCount   = Math.min(rawReCount,   validInitCount)

getMonthlyBilledStatus_（amounts.js）:
  initFee > 0 の行を発見した場合:
    → isCaseEndedBefore_ で、そのケースが現在の treatDate より前に終了しているか確認
    → 終了していれば suppressInitBilled=true → initBilled=false を維持（治癒後 [B]）
    → 終了していなければ initBilled=true（施術継続中 [A]）

isCaseEndedBefore_（amounts.js）:
  caseKey の全行を走査し、施術終了日_部位1/2 の最遅値を取得
  最遅終了日 < treatDate → true（治癒済み）/ それ以外 → false
```

### エッジケース明文化済み

| ケース | 扱い |
|---|---|
| `endDate == later.initDate`（同日） | [A] 保守扱い（`<` 厳密）|
| `endDate` 空欄（Date でない） | [A] 保守扱い（施術継続中とみなす）|
| `caseKey` 列なし（headMap に未存在） | `ckVals=null` → `suppressInitBilled=false` → 従来動作 |
| `caseNo` 列なし | 全行 caseNo=1 扱い → `initCases.length<=1` → `validInitCount=min(rawInitCount,1)` |

### 到達点

| 項目 | 状態 |
|---|---|
| transferData 再検料集計（reCount） | ✅ [A]=1 / [B]=2 |
| transferData 初検料集計（initCount） | ✅ [A]=1 / [B]=2 |
| amounts.js 初検抑制（getMonthlyBilledStatus_）| ✅ 治癒後別負傷 [B] で suppressInitBilled |
| isCaseEndedBefore_ ヘルパー | ✅ 追加済み |
| M06a（施術継続中）既存 M01〜M05 | ✅ 変化なし（validInitCount=1 → 旧挙動と等価）|
| M06b fixture / 実シート確認 | ⚠️ 未実施（fixture 追加・실시후 확인が必要）|

### M06b 全層整合の確認結果（コード分析）

```
[B] 治癒後別負傷 シナリオ（例: case1 終了 2/10、case2 初検 2/15）

amounts.js（per-visit 算定）:
  case1 の初検（2/1）: initBilled=false → initFee=1550 ✅ billed
  case2 の初検（2/15）:
    getMonthlyBilledStatus_ → case1 caseKey の endDate=2/10 < treatDate=2/15 → suppressInitBilled=true
    → initBilled=false → initFee=1550 ✅ billed（抑制されない）
  来院ヘッダ initFee 合計 = 3100

transferData 月次集計:
  rawInitCount=2, validInitCount=2 → initCount=2 → initFee = 1550×2 = 3100 ✅
  rawReCount=2,   validInitCount=2 → reCount=2   → reFee  = 410×2  = 820  ✅

全層整合: ✅ amounts.js ↔ transferData で initFee / reFee が一致
```

> **ステータス: 実装受理 / 運用完了は未了（2026-03-17 確認）**
> M06b は amounts.js（per-visit）と transferData（月次集計）の両層が修正されたことで、
> 「治癒後別負傷の初検料・再検料を各エピソードで独立算定する」という制度要件を充足している。
>
> **運用完了条件（残タスク）:**
> 1. ~~実シートで M06b パターン入力 → initFee=3100 / reFee=820 を確認~~ ✅ NDJSON・申請書生成で確認済み（2026-03-17）
> 2. Dashboard 反映: `de -ProjectId JREC-01` ✅ 本セッションで実施
> 3. M06b fixture 追加（TESTCASES.md 追記）⚠️ 未実施
> 4. caseKey 欠落フォールバック時のログ化（任意）⚠️ 未実施

## 2026-03-17 M06b 実シート確認（write_application.py バッチ実行）

### 確認条件

| 項目 | 内容 |
|---|---|
| 実行コマンド | `python write_application.py --batch` |
| NDJSON | transfer_batch_2026-03.ndjson（再生成） |
| 実行環境 | .venv（Pillow 不足で一度失敗 → pip install Pillow 後に成功）|
| 出力ファイル | output\2026-03\申請書_hirayamaka_2026-03.xlsx |
| セル書込数 | 86 |
| 検証 | 全件パス ✅ |

### hirayamaka M06b データ確認

| 項目 | 値 | 確認 |
|---|---|---|
| case1 caseKey | hirayamaka_2026-03-02_C1 | — |
| case1 施術終了年月日 | 2026-03-09 | 治癒 |
| case2 caseKey | hirayamaka_2026-03-16_C2 | — |
| case2 初検日 | 2026-03-16 | 治癒後の新規別負傷 |
| isPostRecovery 判定 | 2026-03-09 < 2026-03-16 → true | ✅ [B] 治癒後別負傷 |
| 初検料_月額 | 3,100 | ✅ 期待値通り（1550×2） |
| 再検料_月額 | 820 | ✅ 期待値通り（410×2） |
| 当月合計 | 6,936 | — |
| 窓口負担額 | 2,080 | — |
| 請求金額 | 4,856 | — |

### 確認余地（事実として記録、未解決）

| 項目 | 内容 |
|---|---|
| case要約表示 | case1要約="case1:再検" / case2要約="case2:再検" — 両ケースとも再検表示。M06b では case2 に初検（3/16）があるが case2要約が "再検" を示す。表示仕様として問題ないか確認余地あり（billing 正確性に影響なし）|

### Pillow 依存追加（再発防止）

- .venv に Pillow 未インストール状態で実行 → `ModuleNotFoundError: No module named 'PIL'`
- `pip install Pillow` 後に再実行し成功
- `requirements.txt` を新規作成し openpyxl / Pillow を明記（本コミット）

---

## 2026-03-17 請求前チェックリスト実施結果（2026-03 2件）

### 実施条件

| 項目 | 内容 |
|---|---|
| 転記データ再生成日時 | 2026-03-17T16:57:58+09:00（post-fix: 施療料 caseTotal 算入済み） |
| 対象月 | 2026-03 |
| 患者件数 | 2件（hirayamaka / touji） |
| SHEETS.ui | `"患者画面"` ✅（commit 7dd0790 で確認） |

### 金額確認（post-fix 値）

| 患者 | 当月合計 | 窓口負担額 | 請求金額 | pre-fix 当月合計 | 差分 |
|---|---|---|---|---|---|
| hirayamaka | 5,481 | 1,640 | 3,841 | 3,961 | +1,520 ✅（施療料 760×2 case） |
| touji | 4,363 | 1,310 | 3,053 | 2,843 | +1,520 ✅（施療料 760×2 case） |

### チェックリスト結果

| チェック項目 | hirayamaka | touji |
|---|---|---|
| 初検取得モード = caseKey | ✅ | ✅ |
| 当月合計 / 窓口負担額 / 請求金額 計算整合 | ✅ | ✅ |
| 保険者番号 | 1280015 ✅ | 32280414 ✅ |
| 患者氏名 | 平山克士 ✅ | 田路吾子 ✅ |
| 患者生年月日 | 1973-10-10 ✅ | 1969-05-23 ✅ |
| 住所 | 兵庫県朝来市立野 169-1 ✅ | **⚠️ 空欄（要入力）** |
| 負傷名1 | 頸部 捻挫 ✅ | 頸部 捻挫 ✅ |
| 転帰 | 空欄（治療継続中なら可）| 空欄（治療継続中なら可）|
| Mixed 区分 | Mixed ✅ | Mixed ✅ |
| case1要約 / case2要約 | 後療 / 再検 ✅ | 再検 / 初検 ✅ |

### 請求確定できる項目

- 施療料欠落修正（commit 09129b7）反映済み ✅
- 当月合計・窓口負担額・請求金額の計算整合 ✅
- 初検取得モード caseKey ✅
- effectiveKubun → kubun 修正（commit 4f6419d）反映済み ✅

### 請求確定前に人間が確認する項目

| 項目 | 内容 |
|---|---|
| ⚠️ touji 住所 | 申請書の住所欄が空欄。患者画面で入力してから再生成すること |
| ⚠️ 転帰 | 両患者とも空欄。治療継続中なら空欄可。終了の場合は記入要 |

### 保留論点（制度確認待ち・今回変更なし）

**再検料 Mixed 2エピソード算定キャップ → 2026-03-17 一部解消**

- commit `cebeffe` で `Math.min(reCount, 1)` を `Math.min(reCount, validInitCount)` に修正済み
- hirayamaka / touji 両患者とも validInitCount=1 のため今回の請求には影響なし

---

## 2026-03-16 帳票番号飛び修正 完了

### 対象

- `write_application.py`

### 問題

- case2 のみ実データがある場合（例: touji）、以下の飛び番が発生していた
  - 施療料: `(1)` @ AC35 の次が `(3)` @ BG35 になる（`(2)` が抜ける）
  - 部位明細: ラベルが `⑴` の次が `⑶` になり、書き込み行も 行38 → 行40 と飛ぶ

### 原因

- `build_injury_rows` は L385 で後フィルタ（名称が空の行を除去）し詰めて書き込んでいた
- `build_shoryo_array` と `build_part_detail_array` はソース配列のインデックスをそのまま使っていたため、空スロットが挟まるとインデックスが飛んだ
  - `build_shoryo_array`: ゼロ値エントリを `continue` でスキップするが、`SHORYO_CELLS[i]["no"]` は元のインデックス `i` を参照
  - `build_part_detail_array`: `has_data=False` をスキップするが、`labels[i]` と `PART_ROWS[i]` は元のインデックス `i` を参照

### 対応（commit: 93b228e）

- **Fix-S**: `build_shoryo_array` の返り値を書き込み前にリスト内包でフィルタし、非ゼロ値だけに詰めてから `enumerate` → `SHORYO_CELLS[i]` で連番書き込み
- **Fix-P**: `build_part_detail_array` の書き込みループに `display_idx` を導入。`has_data=True` のときだけ `display_idx` を進め、`PART_ROWS[display_idx]` と `labels[display_idx]` で連続行・連番を保証

### 結果（実機確認済み）

| 確認項目 | 修正前 | 修正後 |
|---|---|---|
| touji 施療料 | (1) @ AC35 / **(3)** @ BG35 | (1) @ AC35 / **(2) @ AR35** |
| touji 部位ラベル | ⑴ @ 行38 / **⑶ @ 行40** | ⑴ @ 行38 / **⑵ @ 行39** |
| hirayamaka（case2=null） | 変化なし | 変化なし（影響なし） |

- Permission denied エラーが1回発生したが、原因は出力 xlsx ファイルのロック（Excel で開いたまま実行）。コード側の問題ではなく成功判定。

### 参考 commit

- `93b228e` — fix(JREC-01): 施療料・部位明細の番号付けを詰め連番に修正 (Fix-S / Fix-P)

---

## 2026-03-16 mixed case 表示改善 完了

### 対象

- `Ver3_amounts.js`（calcHeaderAmountsByVisitKey_V3_ に新5列生成ロジック追加）
- `Ver3_core.js`（HEADER_COLS / appendHeaderRow_V3_ に5列配線追加）
- `docs/JREC-01_mixed_case_display_memo.md`（設計判断メモ追加）

### 実装内容

来院ヘッダに以下5列を追加し、mixed case の説明性を強化した。

| 列名 | 内容 |
|---|---|
| 算定区分 | 実際に課金した区分（初検/再検/後療/算定なし） |
| Mixed区分 | 複数ケース同日かどうか（Mixed/通常） |
| case1要約 | case1 の区分を短縮表示 |
| case2要約 | case2 の区分と抑制状況を短縮表示 |
| 課金理由要約 | なぜその算定区分になったかを短文で説明 |

### 実シート確認結果

| パターン | 確認結果 |
|---|---|
| M01（case1=再検 / case2=初検抑制）| ✅ OK |
| M03（case1=後療 / case2=初検抑制）| ✅ OK |
| M05（case1=後療 / case2=再検）| ✅ OK（e931fe5 で課金理由要約バグ修正後） |

### バグ修正（e931fe5）

- 原因: case1=後療 / case2=再検 の mixed で `initSuppressed=false` のため M01 条件を通過できず `else → "算定なし"` に落ちていた
- 修正: `!hasBillableInitial && reFee>0 && isMixed && !initSuppressed` 分岐を追加し `"再検ありのため再検採用"` を返すようにした

### 実シート確認状況

| テストケース | 確認結果 |
|---|---|
| M01（case1=再検 / case2=初検抑制） | ✅ OK |
| M02（case1=再検 / case2=初検抑制なし） | ✅ OK（2026-03-17 fixture PASS確認） |
| M03（case1=後療 / case2=初検抑制） | ✅ OK |
| M04（case1=初検 / case2=初検） | ✅ OK |
| M05（case1=後療 / case2=再検） | ✅ OK（e931fe5 修正後） |

### 未対応範囲（次スコープ）

- `exportHeaderFromCases_V3` への新5列配線
- `transferData` への新5列反映（月次転記への影響検討）
- 既存データの一括再計算メニュー
- `区分` → `表示区分` へのリネーム（将来候補）

### 参考 commit

- `ff7d0ab` — docs(JREC-01): mixed case 表示改善メモ追加
- `5077920` — feat(JREC-01): 来院ヘッダ新5列実装（算定区分/Mixed区分/case要約）
- `e931fe5` — fix(JREC-01): chargeReason に「後療+再検 mixed」分岐を追加

---

## プレオープン体制整備（2026-03-30）

### 判定: ✅ 条件付きプレオープン可能

電気治療機器が未選定のため「電療なし」での運用を前提とする。
それ以外のシステム機能（保険算定・自費明細・申請書生成）はすべて実装・確認済み。

### 未整備として新規作成したドキュメント

| ファイル | 内容 | 作成日 |
|---|---|---|
| `docs/JREC-01_プレオープン運用手順書.md` | 全体フロー・プレオープン制限事項・事故ポイント | 2026-03-30 |
| `docs/JREC-01_受付者向け手順書.md` | 受付・会計・次回案内の操作手順 | 2026-03-30 |
| `docs/JREC-01_施術者向け手順書.md` | 患者画面入力・保険/自費判定・施術録記録 | 2026-03-30 |
| `docs/JREC-01_新患問診票テンプレ.md` | 新患記入用問診票（印刷配布用）+ スタッフ確認欄 | 2026-03-30 |
| `docs/JREC-01_初期評価テンプレ.md` | 施術者記入用初期評価・赤旗チェック・院長確認欄 | 2026-03-30 |
| `docs/JREC-01_再診経過記録テンプレ.md` | 再診時の経過記録・JREC-01 入力チェックリスト | 2026-03-30 |
| `docs/JREC-01_運用ポータル_シート設計.md` | 運用ポータルシート設計書 v1.1（13列: 整備状況・実務進行段階・必須区分を分離）| 2026-03-30 |

### プレオープン中の制限・ルール

| 項目 | ルール |
|---|---|
| 電気治療 | 機器未選定のため施術・算定禁止。`INS_OPTION_ELECTRO15` は選ばない |
| 申請書生成 | プレオープン中は院長確認後に実施。受付・施術者が単独で生成しない |
| 新患マスタ | 問診票回収 → 院長確認 → マスタ登録の順を厳守 |
| 要確認フラグ | E5（橙背景）が立ったら即院長報告。確認前に会計に進まない |

### プレオープン前の院長 TO-DO（未完了分）

| # | TO-DO | 状態 |
|---|---|---|
| 1 | 保険者情報シートの整備（請求先保険者の情報入力）| 要確認 |
| 2 | 受付者・施術者への手順書の配布・説明 | 本ドキュメント作成後 |
| 3 | 新患問診票の印刷・設置 | 本ドキュメント作成後 |
| 4 | 電気治療機器の選定（プレオープン後）| 選定中 |
| 5 | 運用ポータルシートを来店管理施術録ver3.1 に手動作成 | ~~設計v1.1完了・未実装~~ → **GAS実装完了（2026-03-30）** |

### 運用ポータル GAS 実装（2026-03-30）

| 項目 | 内容 |
|---|---|
| コード | `gas-projects/jrec-portal/Code.gs` v1.1（onEdit追加）|
| 対象 SS | `121BkW7jEnKUjmU_NNVAPyJRs_UVmmoqkHDPMHL-RJeA` |
| 主要関数 | `setupOperationPortal_()` / `onEdit(e)` / `refreshFormatOnly_()` / `resetDataRows_()` |
| 初期データ | 新患フロー最小セット 11行（OP-011〜OP-033） |
| 再実行安全性 | 既存シートがある場合は書式のみ更新・データ行を保持する設計 |
| H列自動反映 | container-bound なら onEdit(e) で背景色が自動更新される |
| ディレクトリ分離理由 | 別SS = 別clasp設定が技術的必然。jyu-gas-ver3.1の clasp.json に混在不可 |
| Dashboard同期 | 不要。今回は「保険請求システム機能」の実装ではなく「運用補助ツール」。次アクションに変化なし |
| 次のステップ | 院長が Apps Script エディタにコードを貼り付けて実行するだけで完成 |

### 運用ポータル設計方針メモ（2026-03-30 v1.1）

初版（11列）に対して以下の方針で修正。

- H列「状態」→「整備状況」に改名: 患者対応状況と工程整備状況が混在していたため分離
- I列「実務進行段階」を新規追加: 未着手/受付中/施術者待ち/入力中/保存済/会計待ち/完了の7段階
- K列「必須区分」を新規追加: 必須/条件付き/任意。プレオープン安全確認で「必須」のみフィルタ可能
- 「表示順」列は追加しない: 管理IDの連番体系（OP-001/010/...）が表示順を兼ねており二重管理になるため
- 合計13列（A〜M）。結合セルなし・行追加のみで拡張可能

---

### 現場フロー / 関連シート一覧 シートレビュー（2026-03-30）

対象SS: `121BkW7jEnKUjmU_NNVAPyJRs_UVmmoqkHDPMHL-RJeA`（運用ポータル）

#### 現場フロー シート — 役割と現状

**役割:** 1来院の工程をステップ番号で並べた「現場用ざっくりフロー」。新患専用14ステップ。保険/非保険の2列構成でリンクを配置。

**残すべき点（現場フローとして適切）:**
- ステップ番号 + 担当（受付/施術者）+ 1行アクション
- JRECへの入力リンク・JASSESS-01 初回評価リンク
- 保険/非保険の分岐表示

**運用ポータルへ寄せるべき点（詳細すぎる or 条件分岐が複雑）:**
- 保険/自費判定の詳細基準（外傷性の有無・医師同意）
- 問診票確認チェックリスト
- E5要確認フラグの対処方法
- プレオープン特別ルールの詳細

**修正が必要な箇所（院長確認・実施待ち）:**

| # | 問題 | 修正案 |
|---|---|---|
| ① | Step 4「JRECに入力」が受付フロー（1〜5）に混在 | 施術者フロー（Step 12 付近）に移動。受付はJRECを操作しない |
| ② | 患者マスタ入力リンクが Step 1（保険証を預かる）の横にある | 施術者フロー冒頭（Step 6 〜 7 の間）に移動。受付者はマスタ登録しない |
| ③ | 「施術実施（電療or施術）」— プレオープン中は電療不可 | 「施術実施（電療不可 / 施術のみ）※プレオープン中」に修正 |
| ④ | 保存後の院長確認ステップが存在しない | Step 12 後に「⑬ 院長確認（保存後・プレオープン全件）」を追加 |
| ⑤ | 領収書ステップが存在しない | 支払いの下に「領収書（手書き・院長確認後）」を追加 |
| ⑥ | 「遠背初回評価」リンクテキスト | 正式名称を JASSESS-01 に合わせて確認・修正（誤字の可能性）|
| ⑦ | 再診フローがない | 同シートに再診フロー行を追加するか、別列で並べる（院長判断）|

#### 関連シート一覧 シート — 役割と現状

**役割:** 関連スプレッドシートへのナビゲーションリンク集。

**現在の内容:**
- 平山接骨院 運動器初期評価システム JASSESS-01
- 平山接骨院 慢性疼痛強化プロジェクト 管理表（価格設定 / KPI目標）
- 【毎日記録】来店管理施術録ver3.1

**改善提案（軽微）:**
- 来店管理施術録ver3.1 を最上部へ移動（日常使用の主要ツール）
- 各リンクに役割の短い説明を1セル追加（例: 「JASSESS-01 = 運動器初期評価システム」）
- JBIZスプレッドシート（価格設定）のリンクを追加（現在なし）

#### 修正優先度（プレオープン前必須 / 後でよい）

| 対応 | 優先度 | 担当 |
|---|---|---|
| 現場フロー①②（JRECと患者マスタの位置修正）| **プレオープン前必須** | 院長が手動修正 |
| 現場フロー③（電療注記）| **プレオープン前必須** | 院長が手動修正 |
| 現場フロー④（院長確認ステップ追加）| **プレオープン前必須** | 院長が手動追加 |
| 現場フロー⑤（領収書ステップ）| プレオープン前推奨 | 院長が手動追加 |
| 現場フロー⑥（遠背の誤字確認）| 確認次第修正 | 院長が確認 |
| 現場フロー⑦（再診フロー追加）| プレオープン後でよい | 院長が判断 |
| 関連シート一覧の整備 | プレオープン後でよい | 院長が手動整備 |

---

### 担当役割正本変更（2026-03-30 確定）

前回レビューで「受付者はマスタ登録しない」としていたが、院長の指示により以下を正本とする。

#### 確定ルール

| 担当 | 業務 | セル |
|---|---|---|
| **受付** | 新患: 患者マスタ登録（保険証コピーから転記）| 患者マスタ シート |
| **受付** | 新患・再診: UI画面で患者IDと来院日を入力 | B2（患者ID）/ B4（来院日）|
| **受付** | 会計徴収・次回案内・D8チェック | E3 / H7 / F7 / D8 |
| **院長** | 施術内容入力（区分・部位・傷病名・治療法・会計区分） | 各施術入力欄 / B7 |
| **院長** | 自費明細入力（自費ありの場合）| Drawing ボタン → ダイアログ |
| **院長** | 保存（「登録・計算・出力」ボタン） | GAS メニュー or ボタン |
| **院長** | 保存後 E5（要確認）確認・対処 | E5 / E6 |
| **再診のみ** | 院長: 前回記録確認・変更があれば修正 | 施術内容欄 |

#### 変更したファイル（2026-03-30）

| ファイル | 変更内容 |
|---|---|
| `docs/JREC-01_受付者向け手順書.md` | §2: STEP3（マスタ登録）・STEP4（UI入力）・STEP5（引き継ぎ）を追加。旧「受付者はマスタ登録しない」を削除 / §3: STEP2（UI入力）・STEP3（院長引き継ぎ）を追加 |
| `docs/JREC-01_施術者向け手順書.md` | 対象を「院長」に更新 / STEP1をB2/B4確認（受付入力済み前提）に変更 / §3マスタ登録を「受付が実施・院長は確認」に変更 / §9更新 |
| `docs/JREC-01_プレオープン運用手順書.md` | §1全体フロー再構成: 受付①にマスタ登録・UI入力追加 / 施術内容④⑤を院長に変更 / E5確認⑥を院長 / 会計⑦を受付 |
| `gas-projects/jrec-portal/Code.gs` | INITIAL_DATA OP-014〜OP-023の担当修正 / OP-016（受付UI入力）新規追加 / `setupFieldFlow_()` 新規追加 / onOpen() にメニュー「現場フローを更新」追加 |

#### 現場フロー GAS 自動生成（2026-03-30 追加）

| 項目 | 内容 |
|---|---|
| 関数 | `setupFieldFlow_()` in `jrec-portal/Code.gs` |
| シート名 | `現場フロー` |
| レイアウト | A〜C列 = 新患15ステップ / D列 = スペーサー / E〜G列 = 再診10ステップ |
| 色分け | 薄緑 = 受付担当 / 薄青 = 院長担当 |
| メニュー | 「運用ポータル」>「現場フローを更新」で実行可能 |
| 対象 SS | `121BkW7jEnKUjmU_NNVAPyJRs_UVmmoqkHDPMHL-RJeA` |

---

### 名称変更方針確定（2026-03-31）

2026-03-31 に以下 2 点の名称変更可否を調査し、院長が方針を確定した。
調査詳細: `docs/JREC01_RENAME_INVESTIGATION_2026-03-31.md`

| 変更案 | 方針 | 判定理由（要約） |
|---|---|---|
| ローカルフォルダ名 `gas-projects` → `JREC-01` | **断念・現状維持** | `gas-projects/` に `jrec-portal/` が同居しており JREC-01 専用でない。scripts/ に 7 ファイル以上のハードコードパス参照あり。2026-03-13 命名移行時に「フォルダ名は維持する」と意図的に記録済み |
| スプレッドシート名 `【毎日記録】来店管理施術録ver3.1` → `JREC-01来店管理記録` | **当面見送り・現状維持** | GAS コードは ID ベース運用で技術的には安全だが、プレオープン直前のため現場手順書の混乱リスクが高い。必要性が生じたときに再検討 |

**今後の取り扱い:**
- フォルダ名: 変更しない。`gas-projects/jyu-gas-ver3.1/` を正本パスとして固定
- スプレッドシート名: 変更しない。`【毎日記録】来店管理施術録ver3.1` を正本名として固定
- Dashboard の `project_id = JREC-01` は既に正しく設定済みのため追加作業不要

---

### ジム会員フラグ Phase A 実装完了（2026-03-31）

設計調査: `docs/JREC-01_GYM_MEMBER_FLAG_DESIGN_2026-03-31.md`

#### 実装内容

患者画面 A5/B5 に「ジム会員」チェックボックスを追加し、来院ヘッダに保存できるようにした。
保険算定ロジック・申請書生成への影響なし。Phase B（価格切替）・Phase C（患者マスタ連携）への布石。

| 変更項目 | 内容 |
|---|---|
| `UI.gymMember = "B5"` | `kubun: "B5"`（死セル）を `gymMember: "B5"` に改名 |
| `HEADER_COLS.gymMemberFlag` | 来院ヘッダに `"ジム会員フラグ"` 列を追加（`ensureHeaderCols_` で自動追加・既存データ影響なし）|
| `readSelfPayFromUI_V3_` | B5 チェック値を `gymMemberFlag` として返却 |
| `appendHeaderRow_V3_` | `gymMemberFlag` を来院ヘッダ書き込みオブジェクトに追加 |
| `clearAfterSaveUI_V3_` | B5 を `setValue(false)` でリセット（保存後・チェックボックス前提の明示的リセット）|
| `clearEntryUI_V3` | `"B5:B7"` 一括クリア → B5 は `setValue(false)`・B6:B7 は `clearContent()` に分割 |
| `setupSelfPayValidation_V3_` | A5="ジム会員"（LABEL_BG/太字）・B5=チェックボックス（INPUT_BG）・A5:B5 罫線・A6:B6 クリア |
| メニューラベル | `"UI初期設定（行5:ジム会員 / 行7〜8:会計ブロック）"` に改称 |

#### 実機確認結果（2026-03-31 全件OK）

| テストID | 内容 | 結果 |
|---|---|---|
| T-GYM-01 | B5チェックあり保存 → 来院ヘッダ「ジム会員フラグ」= TRUE | ✅ OK |
| T-GYM-02 | B5チェックなし保存 → 来院ヘッダ「ジム会員フラグ」= FALSE | ✅ OK |
| T-GYM-03 | 保存後に B5 チェックが外れる | ✅ OK |
| T-GYM-04 | 「患者画面クリア」後に B5 チェックが外れる | ✅ OK |

---

### ジム会員フラグ Phase B 実装完了（2026-03-31）

T-GYM-01〜04 全件 OK（Phase A 完了）を受けて Phase B を実装。
詳細設計: `docs/JREC-01_GYM_MEMBER_FLAG_DESIGN_2026-03-31.md`

| 変更ファイル | 変更内容 |
|---|---|
| `Ver3_core.js` — `getSelfPayMenuMaster_V3` | `memberPrice` を JBIZ H列から読み取り返却。fallback にも `memberPrice: 0` を追加 |
| `Ver3_core.js` — `getCurrentVisitKey_V3` | バッチ読み取り `"B2:C5"` に拡張。`isGymMember` を返却オブジェクトに追加 |
| `selfPayDialog.html` | 会員バッジ（緑）表示・プルダウン価格を `isGymMember` で切替。H列 0 の場合は G列にフォールバック |

#### 価格切替ロジック

```
B5=true かつ JBIZ H列 > 0 → H列（会員料金）
B5=true かつ JBIZ H列 = 0 → G列（一般料金）にフォールバック
B5=false                  → G列（一般料金）
```

#### 実機確認結果（2026-03-31 全件OK）

| テストID | 内容 | 結果 |
|---|---|---|
| T-GYM-B1 | B5チェックあり → 自費ダイアログで会員バッジ表示 | ✅ OK |
| T-GYM-B2 | B5チェックなし → バッジ非表示 | ✅ OK |
| T-GYM-B3 | 会員 + H列に料金あり → H列（会員料金）が単価欄に入る | ✅ OK |
| T-GYM-B4 | 会員 + H列が 0/空 → G列（一般料金）にフォールバック | ✅ OK |
| T-GYM-B5 | 非会員 → G列（一般料金）が入る | ✅ OK |

**運用注意:** JBIZ H列が未入力のメニューは、会員でも G列へフォールバック。
これは意図した仕様。会員価格を使いたいメニューから順に H列を整備する。

---

### ジム会員フラグ 現在地（2026-03-31）

| フェーズ | 内容 | 状態 |
|---|---|---|
| Phase A | A5/B5 チェックボックスUI + 来院ヘッダ「ジム会員フラグ」保存 | ✅ 完了・実機OK |
| Phase B | 自費ダイアログで isGymMember により G/H 列料金を自動切替 | ✅ 完了・実機OK |
| Phase C | 患者マスタ「ジム会員」列 → 患者ID入力時 B5 を自動セット | 🔲 未着手（将来）|

**現在の運用状態:** Phase A/B 完了。来院時に B5 を手動チェックすれば会員料金が自費ダイアログに反映される。

#### Phase C 設計メモ（将来実装用）

- 患者マスタに「ジム会員」列を追加し、boolean 値を持たせる
- 患者 ID 入力時（`onEdit` or `autofill`）に患者マスタを参照して B5 を自動セット
- **当日入会・当日変更を考慮し、B5 による当日 UI 上書きは Phase A/B の実装をそのまま維持**
- 方針: 「患者マスタ既定値 + 当日 UI 上書き」の2段構え
- 着手判断タイミング: 運用データが蓄積し、手動チェックの手間が問題になったとき

---

### 保存後会計サマリー兼領収証導線 — 案A v2.1 T-SUM-01〜06 全PASS 完了（2026-04-01）

設計書: `docs/JREC-01_RECEIPT_SUMMARY_DESIGN_2026-03-31.md`
ステータス: **✅ T-SUM-01〜06 全PASS 完了（2026-04-01）**

#### バージョン履歴

| バージョン | commit | 内容 |
|---|---|---|
| v1 | `0128a7c` | 案A 初実装（J55:Q62 横並び）|
| v2 | `b939f35` | 配置変更（J2:N22 縦並び）・値クリア分離・全行検索 |
| **v2.1** | **`4b06420`** | **正規化強化・旧残骸除去・ゼロ表示抑制（T-SUM-05/06 対応）** |

#### v2.1 変更内容（2026-04-01 確定）

| 変更 | 内容 |
|---|---|
| 正規化処理 | `writeSavedSummaryUI_V3_` 冒頭で `breakApart().clearContent()` を実行（想定外セル結合・旧文言を除去）|
| ゼロ表示抑制 | 金額 `setValue` を `v_()` ヘルパー経由に変更（0 → `""` で空欄表示）|
| 空オブジェクト対策 | 受取人・来院日を条件付き文字列（`?? ""` ガード）に変更 |
| クリア処理一元化 | `clearSummaryValuesUI_V3_` → `writeSavedSummaryUI_V3_(uiSh, {})` 委譲で構造一元化 |
| v1 残骸除去 | `setupSelfPayValidation_V3_` 内の J55:Q62 v1ブロックを完全削除 |
| alert テキスト修正 | 旧「J55〜」表記 → 「J2 右側」に統一 |

#### レイアウト（J2:N22 / 縦並び21行）

```
Row  2: ■ 直前保存サマリー（タイトル帯 / 青）
Row  3: 患者名 / [値]        Row 4: 来院日 / [値]
Row  5: 会計区分 / [値]      Row 6: ─── 区切り ───
Row  7: 保険分合計（参考）/ [¥ グレー小さく]
Row  8: ① 一部負担金 / [¥]  Row 9: ② 保険外（自費）/ [¥]
Row 10: ─── 区切り ───
Row 11: 合計金額（①+②）/ [¥ 大きく / 薄オレンジ]
Row 12: visitKey / [値]
Row 13: ──── 領 収 証 ────（薄黄）
Row 14: [患者名] 様
Row 15: 合計金額 / [¥ 強調]
Row 16:   一部負担金 / [¥]   Row 17:   保険外（自費）/ [¥]
Row 18: 上記合計金額を領収いたしました（固定）
Row 19: [施術所名]   Row 20: [住所]   Row 21: [電話]（設定シートから取得・固定）
Row 22: 来院日: [値]
```

#### 設定シートへの記入方法

設定シートの A列にラベル・B列に値の形式で3行を追記する（行の位置は問わない）：
`施術所名` / `住所` / `電話`

#### T-SUM-01〜06 実機確認結果（2026-04-01 全PASS）

| No | 操作 | 期待結果 | 結果 |
|---|---|---|---|
| T-SUM-01 | 保険のみ患者を保存 | J2:N22 にサマリー表示。①一部負担金=計算値、②保険外=¥0（非表示） | ✅ PASS |
| T-SUM-02 | 保険+自費患者を保存 | 保険外=自費明細合計、合計=①+② | ✅ PASS |
| T-SUM-03 | 自費のみ患者を保存 | 保険分合計=¥0（非表示）、一部負担金=¥0（非表示）、保険外=自費明細合計 | ✅ PASS |
| T-SUM-04 | 次の患者を保存 | 前回サマリーが新サマリーで上書きされる | ✅ PASS |
| **T-SUM-05** | **患者画面クリアボタン** | **値セル（患者名・日付・金額・visitKey）のみ空欄。ラベル・枠・領収証定型テキストは残る** | **✅ PASS** |
| **T-SUM-06** | **設定シート記入 → 保存** | **Row 19〜21 に施術所名・住所・電話が正しく表示される** | **✅ PASS** |

---

## 🗂 WS-SR: 施術録導線ワークストリーム（2026-04-01 開始）

**ステータス: T-SR-10 実機NG 5件修正完了（2026-04-02） / 次: T-SR-10v2 clasp push + 再テスト**

JREC の日次入力データを月次で施術録へ転記・確定保存する導線。
JREC-01 内の独立ワークストリームとして管理する（新 project_id は作らない）。

### 判断概要

- **管理区分:** JREC-01 内ワークストリーム `WS-SR`
- **理由:** データ基盤・GAS・スプレッドシートがすべて JREC-01 に依存するため独立プロジェクト化は不自然。申請書生成（B案）と同格の「月次出力機能」として収容するのが自然。
- **設計ドキュメント:** `docs/施術録導線/JREC-01_施術録導線_設計方針.md`
- **様式確認メモ:** `docs/施術録導線/JREC-01_施術録様式_構造理解メモ.md`

### 確定した方針（2026-04-02 様式確認後に更新）

| 方針 | 内容 | 確定度 |
|---|---|---|
| **帳票出力単位** | **1患者 × 1か月 = 1ファイル** | 現時点方針 ✅ |
| 内部管理単位 | 1患者 × 1負傷系列（caseKey）を維持 | 確定 ✅ |
| 複数負傷の帳票合算 | 同月内は1ファイル合算（表面に複数行） | 現時点方針 ✅ |
| 出力形式 | Word方式（docx / Google Docs）→ 最終 PDF 保存 | 現時点方針 ✅ |
| 元データ源 | 来院ヘッダ + 施術明細（中間データ層不要） | 現時点方針 ✅ |
| 転記後元データ | 削除しない。Archive化 / 退避前提 | 確定 ✅ |
| 優先範囲 | 保険施術録を先行。自費混在は初版後回し | 確定 ✅ |

### 様式構造の重要発見（2026-04-02）

- **裏面の月集計欄は①②③の3段のみ** → 1枚で最大3か月分。月次ファイル方式と自然に整合
- **施術経過所見は1来院日1行の短いフリーテキスト** → 日別に1行程度の所見を転記する設計が適切
- **初検時相談支援欄に3項目の記載例あり** → Word様式を転記フォーマットの基準とする

### 転記元調査結果（2026-04-02 確定）

**施術経過所見は来院ケースシートに既存列あり（新規追加不要）:**
- `CASE_COLS.shoken = "所見"` / `CASE_COLS.keikaNow = "経過_今回"`

**主要不足列（初版スコープ外）:**
- 時間外・休日・深夜加算（実務頻度低・手入力対応）
- 往療料（訪問時のみ・手入力対応）
- 明細書発行体制等加算（手入力対応）

**冷罨法・電療・金属副子・運動後療:**
- 施術明細に `coldOut`/`warmOut`/`electroOut`/`metalOut`/`exerciseOut`（確定列）が存在 → ✅ 可

### 技術検証サマリー（sandbox 実機確認完了 — 2026-04-02）

| 確認事項 | 結論 |
|---|---|
| GAS → Google Docs API の技術可否 | ✅ 実装可能 |
| テンプレート複製（makeCopy） | ✅ 正常動作 |
| 裏面テーブル検索（content-based） | ✅ 「後療料」含むテーブルで自動特定 |
| セル書き込み・レイアウト崩れ | ✅ なし |
| PDF 出力品質 | ✅ 印刷・保存に使用可能 |
| 差し込みアプローチ | 表面: `replaceText` / 裏面: content-based テーブル + セル書き込み |
| 所見列の主転記列 | `CASE_COLS.shoken`（"所見"）を優先、空なら `keikaNow` で補完 |

### Phase 1 実装タスク（T-SR-01〜T-SR-11）

| # | タスク | 種別 | 状態 |
|---|---|---|---|
| **T-SR-01** | **テンプレートへのプレースホルダー手入力（§6 最終確定版 30項目）** | **人間が実施** | **✅ 完了（院長側で実施済み）** |
| T-SR-02 | `Ver3_shuRecorder.js` 新規作成・設定定数定義 | GAS実装 | ✅ 完了 |
| T-SR-03 | データ取得関数（患者マスタ / 来院ケース / 来院ヘッダ+明細）| GAS実装 | ✅ 完了 |
| T-SR-04 | `srGetInitExamData_` 実装（初検情報履歴） | GAS実装 | ✅ 完了 |
| T-SR-05 | テンプレート複製 + 出力フォルダ管理 | GAS実装 | ✅ 完了 |
| T-SR-06 | `srInsertHyomenData_`（replaceText 全欄） | GAS実装 | ✅ 完了 |
| T-SR-07 | `srInsertUrameData_`（日別行 + ①集計） | GAS実装 | ✅ 完了 |
| T-SR-08 | `srExportPdf_` | GAS実装 | ✅ 完了 |
| T-SR-09 | ダイアログ表示 + 再実行チェック + メニュー登録（`Ver3_core.js` onOpen メニュー追加含む）| GAS実装 | ✅ 完了 |
| **T-SR-10** | **clasp push + 手動テスト（1患者・2026-04）** | **実機確認** | **🔄 v2修正完了 → 再clasp push・再テスト待ち** |
| T-SR-11 | テスト結果を TESTCASES.md に記録 | ドキュメント | 未着手 |

### 次のアクション（WS-SR）

**T-SR-10v2: clasp push + 再テスト（5件修正後）**

```
cd C:\hirayama-ai-workspace\workspace\gas-projects\jyu-gas-ver3.1
clasp push
```

スプレッドシートをリロード → 「施術録を出力」 → 患者IDと `2026-04` を入力して実行。

**v2 修正確認ポイント（目視）:**

| # | 修正 | 確認内容 |
|---|---|---|
| NG-01 | 自費のみ日除外 | 自費のみ日（会計区分=自費のみ）が裏面に出ないこと |
| NG-02 | 冷/温/電 分離 | col6=冷罨法料・col7=温罨法料・col8=電療料 が正しい列に入ること |
| NG-03 | 施術回数=visitDays | 表面の施術回数が保険来院日数と一致すること |
| NG-04 | 日数=visitDays | 表面の日数が保険来院日数と一致すること |
| NG-05 | 負傷名=部位+傷病 | 表面の負傷名が「右足関節 捻挫」形式になること |

**`SR_URAME_COL` 調整が必要な場合:**
- GDocs テンプレートの実列数と定数がずれている場合は `Ver3_shuRecorder.js` 先頭の `SR_URAME_COL` / `SR_SUM_COL` のインデックスのみ修正して再 clasp push する。

### 参照先

- 設計方針: `docs/施術録導線/JREC-01_施術録導線_設計方針.md`
- 様式構造メモ: `docs/施術録導線/JREC-01_施術録様式_構造理解メモ.md`
- 転記元対応表: `docs/施術録導線/JREC-01_施術録転記元対応表.md`
- 技術検証メモ: `docs/施術録導線/JREC-01_施術録GDocs技術検証.md`
- **実装設計: `docs/施術録導線/JREC-01_施術録実装設計.md`** ← 今回作成（プレースホルダー一覧・GASモジュール設計含む）
