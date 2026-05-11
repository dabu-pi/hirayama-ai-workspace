# JREC-SF01 自費カルテ・会計システム — ロードマップ

最終更新: 2026-05-02（Phase 6-L CLOSED @35）

---

## 現在の本番状態

| デプロイ | 内容 |
|---|---|
| @36 | Phase AI-1 + AI-2: 患者マスター・カルテ項目追加 + AI評価補助UI 含む（**最新本番** `AKfycbxP9beCl8tZ4t41irDgFa...YA`） |
| @35 | Phase 6-L 未収・回収管理 / outstandingReport ページ 含む |
| @34 | Phase 6-K メニュー別売上分析 / menuSalesReport ページ 含む |
| @33 | Phase 6-J 月別売上集計 / monthlyReport ページ 含む |
| @32 | Phase 6-I 集計メニュー / reports ページ 含む |
| @31 | Phase 6-H dailyCheckout 日別金額合計カード 含む |
| @30 | Phase 6-N-1 共通タブナビゲーション 含む |
| @29 | Phase 6-G-1 カレンダー月移動ナビ 含む |
| @28 | Phase 6-F ホーム月間カレンダー 含む |
| @27 | Phase 6-E カルテ再編集 含む |

---

## ステータス凡例

| マーク | 意味 |
|---|---|
| ✅ | CLOSED（実機確認・本番反映済み） |
| 🔄 | 進行中 |
| ⏸ | planned（未着手） |

---

## 完了済みフェーズ

| フェーズ | 内容 | CLOSED |
|---|---|---|
| Phase 5-A | DailySales シート設計調査 | ✅ |
| Phase 5-B | 会計入力フロー基盤 | ✅ |
| Phase 5-C | 領収書発行フロー | ✅ 2026-04-29 |
| Phase 5-D | カルテ連動会計フロー | ✅ 2026-04-29 |
| Phase 6-A | 患者基本情報編集 | ✅ 2026-04-29 |
| Phase 6-B | 来院履歴ゴミ箱機能 | ✅ 2026-04-29 |
| Phase 6-D | トップメニュー + 本日会計待ち一覧 | ✅ 2026-04-29 |
| Phase 6-E | カルテ再編集機能 + 主訴 textarea 化 | ✅ 2026-05-01 |
| Phase 6-F | ホーム月間カレンダー + 日別来院確認 | ✅ 2026-05-01 |
| Phase 6-G-1 | ホームカレンダー 前月/今月/翌月 切替 | ✅ 2026-05-02 |
| Phase 6-N-1 | 共通タブナビゲーション | ✅ 2026-05-02 |
| Phase 6-H | dailyCheckout 日別金額合計カード | ✅ 2026-05-02 |
| Phase 6-I | 集計メニュー / reports ページ新設 | ✅ 2026-05-02 |
| Phase 6-J | 月別売上集計 / monthlyReport ページ | ✅ 2026-05-02 |
| Phase 6-K | メニュー別売上分析 / menuSalesReport ページ | ✅ 2026-05-02 |
| Phase 6-L | 未収・回収管理 / outstandingReport ページ | ✅ 2026-05-02 |

> Phase 6-C（来院完全削除）は保留中。集計系フェーズ後に判断。

---

## 今後のフェーズ（Phase 6-G 以降）

### Phase 6-G: カレンダー機能強化 ✅

**目的:** ホームカレンダーを当月固定から前月/翌月に移動できるようにする

| タスク | 内容 | 状態 |
|---|---|---|
| 6-G-1 | ホームカレンダー 前月/今月/翌月 切替（URL パラメータ year/month） | ✅ CLOSED 2026-05-02 @29 |
| 6-G-2 | 月移動後も来院件数マーク + 日付クリック遷移を維持 | ✅（6-G-1 に含む） |
| 6-G-3 | （オプション）カレンダーに日別売上簡易表示 | ⏸（6-H/6-J 完了後に検討） |

**変更ファイル:** `JREC_SF01_Main.gs` / `home.html`

---

### Phase 6-H: 日別会計集計強化 ✅

**目的:** dailyCheckout にその日の売上合計・入金状況サマリを表示する

| タスク | 内容 | 状態 |
|---|---|---|
| 6-H-1 | dailyCheckout に日別合計カード追加（来院数・請求合計・入金合計・未収残高） | ✅ CLOSED 2026-05-02 @31 |
| 6-H-2 | ~~`getDailySalesReport` 呼び出し~~ → **B案採用**: getDailyCheckoutList の list から集計 | ✅（6-H-1 に含む） |
| 6-H-3 | `getDailySalesReport` と `getDailyCheckoutList` の連携整理 | ⏸ 月次集計 Phase 6-J 時に判断 |
| 6-H-4 | （オプション）rebuildDailySales 手動実行導線 | ⏸ |

**変更ファイル:** `daily-checkout.html`（GAS 側変更なし）  
**リスク対応:** getDailySalesReport（Run_Log 全スキャン）は **採用しない**。DailySales シート依存なし。  
**Phase 6-J との責務分離:** 当 Phase は当日 UI 確認用。月次正本は Phase 6-J で DailySales / Run_Log から集計する。

---

### Phase 6-I: 集計メニュー / 集計ページ新設 ✅

**目的:** ホームから集計系機能へ入れる専用ページを整備する

| タスク | 内容 | 状態 |
|---|---|---|
| 6-I-1 | ホーム業務メニューに「売上・レポート」カードを追加 | ✅ CLOSED 2026-05-02 @32 |
| 6-I-2 | `?page=reports`（集計トップ）を新設 | ✅（含む） |
| 6-I-3 | 日別集計・月別集計・メニュー別集計への入口カードを配置 | ✅（含む） |
| 6-I-4 | 最初は入口カードのみ。未実装カードに「Phase X-X 予定」を表示 | ✅（含む） |

**変更ファイル:** `reports.html`（新規）/ `JREC_SF01_Main.gs` / `home.html` / `index.html`  
**スコープ制御:** 集計計算・DailySales/Run_Log 依存なし。ナビゲーション追加のみ。  
**Phase 6-J 以降の責務:** 月次売上集計・メニュー別分析・未収管理・CSV 出力は各フェーズで実装する。

---

### Phase 6-J: 月別売上集計 ✅（CLOSED 2026-05-02）

**目的:** 月単位で売上・入金・未収を確認できるページを作る

**設計方針（2026-05-02 確定）:**

| 項目 | 決定内容 |
|---|---|
| 集計方式 | **候補B採用**: SelfPayVisits + Payments + Receipts から月次直接集計 |
| 集計基準 | visitDate（来院日）ベース |
| getDailySalesReport | **使用しない**（Run_Log 全スキャン × 31日 = タイムアウトリスク） |
| DailySales 依存 | **なし**（空問題を完全回避） |
| DailySales/Run_Log の位置づけ | Phase 6-M 監査レポートで活用。Phase 6-J では不使用 |

**リスク解消:**
- getDailySalesReport を月次でループ呼び出しすると Run_Log を31回全スキャン → タイムアウト確実。採用しない。
- DailySales シートは rebuildDailySales 実行済み日のみ行が存在。未実行日は欠損。Phase 6-J では非依存。

| タスク | 内容 |
|---|---|
| 6-J-1 | `getMonthlyRevenueSummary(year, month)` を `Billing.gs` に追加（visitDate ベース、DailySales 非依存） | ✅ CLOSED 2026-05-02 @33 |
| 6-J-2 | 月間サマリーカード（来院件数・請求合計・入金合計・未収残高・件数内訳） | ✅（含む） |
| 6-J-3 | 日別内訳テーブル + dailyCheckout 日付リンク | ✅（含む） |
| 6-J-4 | 月別レポート画面（`?page=monthlyReport`）を新設。月移動ナビ（◀ 前月 / 今月 / 翌月 ▶） | ✅（含む） |
| 6-J-5 | reports.html の「月次売上レポート」カードを有効化（`?page=monthlyReport` リンクに更新） | ✅（含む） |

**変更ファイル:** `JREC_SF01_Billing.gs` / `JREC_SF01_Main.gs` / `monthly-report.html`（新規）/ `reports.html`  
**設計詳細:** `docs/PHASE_6J_MONTHLY_SALES_DESIGN_2026-05-02.md`

---

### Phase 6-K: メニュー別集計 ✅（CLOSED 2026-05-02）

**目的:** 自費メニューごとの件数・売上を分析できるようにする

**SelfPayItems 列構造確認:** 確認済み（2026-05-02）。カテゴリ列なし。menuCode + メニュー名で集計。

| タスク | 内容 | 状態 |
|---|---|---|
| 6-K-1 | `getMenuSalesSummary(year, month)` を Billing.gs に追加（visitDate ベース・isDeleted 除外・請求ベース） | ✅ CLOSED 2026-05-02 @34 |
| 6-K-2 | 月指定でメニュー別分析（売上降順・来院数・明細行数・数量・平均単価） | ✅（含む） |
| 6-K-3 | メニュー別集計画面（`?page=menuSalesReport`）を新設 | ✅（含む） |
| 6-K-4 | 自費メニュー改善・補助金効果測定への活用 |

**変更ファイル候補:** `JREC_SF01_Billing.gs` / `JREC_SF01_Main.gs` / html 追加  
**リスク:** 中（SelfPayItems の列構造を Setup.gs で再確認が必要）

---

### Phase 6-L: 未収・回収管理レポート ✅（CLOSED 2026-05-02）

**目的:** 未収・一部入金の残高を管理し、回収漏れを防ぐ

**既存関数 `getAllOutstandingByPatient()` の確認結果:**
患者別合計のみ返す設計。visitKey / visitDate / chiefComplaint が返らないため詳細テーブルに使えない。
→ **新規 `getOutstandingReport()` を追加**（既存関数の変更なし）

| タスク | 内容 | 状態 |
|---|---|---|
| 6-L-1 | 未収一覧を来院日昇順・患者別で確認できるページ | ✅ CLOSED 2026-05-02 @35 |
| 6-L-2 | 一部入金残高・支払済との差額確認（paidAmount / remainingAmount 表示） | ✅（含む） |
| 6-L-3 | ~~`getAllOutstandingByPatient()` の活用~~ → **新規 `getOutstandingReport()`** を追加 | ✅（含む） |
| 6-L-4 | 月末未収残高レポート |

**変更ファイル候補:** `JREC_SF01_Billing.gs` / `JREC_SF01_Main.gs` / html 追加  
**リスク:** 低（既存 `getAllOutstandingByPatient` が使える）

---

### Phase 6-M: 出力・監査レポート ⏸

**目的:** 税理士提出・月次確認・監査対応用の出力を整備する

| タスク | 内容 |
|---|---|
| 6-M-1 | CSV 出力（日別・月別・メニュー別） |
| 6-M-2 | 印刷用画面（@media print CSS） |
| 6-M-3 | 税理士・月次確認用レポート |
| 6-M-4 | Run_Log / DailySales / Payments / Receipts の突合確認機能 |

**変更ファイル候補:** 各集計ページに出力ボタン追加  
**リスク:** 低〜中（CSV 出力は GAS の ContentService を使う）

---

### Phase 6-N: 共通タブナビゲーション整備 ✅

**目的:** 主要画面をホームに戻らず切り替えやすくする

**方針（2026-05-02 決定）:**

| 項目 | 内容 |
|---|---|
| 採用 | 共通タブ型ナビゲーション（既存 page ルーティング維持） |
| 非採用 | 完全 SPA 化・ページ内のみの非同期タブ切替 |
| 理由 | GAS iframe 環境での画面遷移事故を避ける。既存ルーティングを壊さない。各画面の責務を分離したままUIだけ改善できる。将来、必要な画面だけ部分更新へ拡張可能 |

**対象タブ候補:**

| タブ | 遷移先 |
|---|---|
| ホーム | `?page=home` |
| 本日の受付・会計 | `?page=dailyCheckout` |
| 患者一覧 | `?page=list` |
| 新規患者登録 | `?page=newPatient` |
| カルテ入力 | `?page=list`（患者選択から） |
| 売上・レポート | `?page=reports`（Phase 6-I 以降で追加） |

**初期スコープ（実装時）:**

| タスク | 内容 |
|---|---|
| 6-N-1 | 共通タブナビ HTML / CSS の整理（`index.html` または新規 `nav.html` として抽出） | ✅ CLOSED 2026-05-02 @30 |
| 6-N-2 | 現在ページの active タブ表示（テンプレート変数で `currentPage` を渡す） | ✅（6-N-1 に含む） |
| 6-N-3 | 各タブから `?page=xxx` への安全なリンク生成（`APP_URL` ベース） | ✅（6-N-1 に含む） |
| 6-N-4 | スマホ表示確認（横スクロール型 or flex-wrap で折り返し） | ✅（6-N-1 に含む） |

**スコープ外:**

- 完全 SPA 化
- ページ内のみの非同期タブ切替
- 既存 page ルーティングの全面変更
- 会計・集計ロジック変更

**変更ファイル候補:** `index.html` / `styles.html` / `JREC_SF01_Main.gs`（`currentPage` 変数追加）  
**リスク:** 低（既存ルーティング維持・UIのみ変更）

> **ステータス:** ✅ CLOSED（2026-05-02 N1-1〜N1-8 全 PASS @30）

---

## 推奨実装順序

```
1. ✅ Phase 6-G — カレンダー前月/翌月切替（完了 @29）
2. ✅ Phase 6-N — 共通タブナビゲーション（完了 @30）
3. ✅ Phase 6-H — dailyCheckout 日別金額合計カード（完了 @31）
4. ✅ Phase 6-I — 集計導線ページ新設（完了 @32）
5. ✅ Phase 6-J — 月別売上集計（完了 @33）
6. ✅ Phase 6-K — メニュー別集計（完了 @34）
7. ✅ Phase 6-L — 未収・回収管理（完了 @35）
8. Phase 6-M — CSV・印刷・監査（出力整備）
```

---

## AI補助判定ロードマップ（Phase AI 系列）

> Phase 6-M 等の既存ロードマップとは独立した系列。
> 自費カルテへの AI補助判定機能追加を段階的に実装する計画。
> 設計書: `docs/PHASE_AI_CHART_ASSIST_DESIGN_2026-05-02.md`

---

### Phase AI-0: 設計調査 ✅（CLOSED 2026-05-02）

**目的:** 現状構造確認・影響範囲確認・設計書作成

| タスク | 内容 | 状態 |
|---|---|---|
| AI-0-1 | 現状シート構造確認（Patients / SelfPayVisits / SelfPayChart） | ✅ |
| AI-0-2 | 現状画面構造確認（visit-form.html / patient-form.html） | ✅ |
| AI-0-3 | 追加候補項目の影響範囲分析 | ✅ |
| AI-0-4 | AI入力・出力データ設計 | ✅ |
| AI-0-5 | AI_Assessments 保存設計 | ✅ |
| AI-0-6 | 実装ロードマップ作成 | ✅ |
| AI-0-7 | 設計書作成 `docs/PHASE_AI_CHART_ASSIST_DESIGN_2026-05-02.md` | ✅ |

**コード変更なし。clasp push なし。**

---

### Phase AI-1: 患者マスター・カルテ項目追加 ✅（HEAD /dev LiveCheck PASS 2026-05-03）

**目的:** AI補助判定が活用する入力情報の基盤を整備する

| タスク | 内容 | 状態 |
|---|---|---|
| AI-1-1 | JREC_SF01_Setup.gs: Patients ヘッダーに occupation / medicalHistory 追加 | ✅ |
| AI-1-2 | JREC_SF01_Patient.gs: `getPatientById` 読取列数を 13 へ拡張 | ✅ |
| AI-1-3 | JREC_SF01_Patient.gs: `createPatient` に occupation / medicalHistory 追加 | ✅ |
| AI-1-4 | JREC_SF01_Patient.gs: `updatePatient` に occupation / medicalHistory 更新処理追加 | ✅ |
| AI-1-5 | patient-form.html: 職業（text）・既往歴（textarea）の入力欄追加 | ✅ |
| AI-1-6 | JREC_SF01_Setup.gs: SelfPayVisits ヘッダーに injuryTrigger / relatedHistoryNote 追加 | ✅ |
| AI-1-7 | JREC_SF01_Visit.gs: `getVisitFormData` 読取列数を 16 へ拡張。戻り値に追加 | ✅ |
| AI-1-8 | JREC_SF01_Visit.gs: `createVisitWithChart` / `updateVisitWithChart` に追加 | ✅ |
| AI-1-9 | visit-form.html: 患者情報参照欄（年齢・性別・職業・患者マスター既往歴）追加 | ✅ |
| AI-1-10 | visit-form.html: 受傷起点・今回追記既往歴の入力欄追加 | ✅ |
| AI-1-11 | patient-detail.html: 患者基本情報カード（職業・既往歴）追加 | ✅ |

**変更ファイル:** Setup.gs / Patient.gs / Visit.gs / patient-form.html / visit-form.html / patient-detail.html
**既存会計・集計への影響:** なし
**clasp push:** ✅ 実施済み（2026-05-02）
**versioned deployment:** ⏸ 未実施（HEAD /dev LiveCheck PASS 済み・任意タイミングで @36 を実施可能）

**事前実行必須:** GAS エディタから `runAddPatientColumns()` / `runAddVisitColumns()` を手動実行してシートに列を追加してください。

---

### Phase AI-2: AI評価補助UI追加 ⏸

**目的:** visit-form.html にAI評価補助セクションを追加する（API連携なし・UI枠のみ）

> **方針確定（2026-05-03）:** AI補助の対象は「カルテ文案生成」だけでなく「評価補助」も含む。
> 詳細: `docs/PHASE_AI_CHART_ASSIST_DESIGN_2026-05-02.md`

**AI評価補助が出力する候補:**

| 出力候補 | 内容 |
|---|---|
| 評価の観点整理 | 主訴・症状・年齢・職業・受傷起点から評価すべき視点を整理 |
| 鑑別の方向性 | 症状パターンから考慮すべき鑑別を提示（断定しない） |
| 危険サイン確認 | red flags / 受診勧奨が必要な所見の確認促し |
| 追加問診候補 | 情報不足時に有効な追加問診の提案 |
| 施術方針案 | 既往歴・職業・受傷起点を踏まえた施術アプローチ案 |
| 受診勧奨の目安 | 医療機関紹介が適切なケースの目安 |
| カルテ下書き | 所見・施術内容の文章化候補（施術者が確認・修正） |

**入力として使う情報:**

| 情報 | 送信方法 |
|---|---|
| 主訴 | そのまま送信 |
| 症状・所見・施術内容 | そのまま送信 |
| 年齢・性別 | 年齢（または年代）に変換して送信 |
| 職業 | そのまま送信 |
| 既往歴・受傷起点・関連履歴 | そのまま送信 |
| 氏名・住所・電話番号 | **送信しない**（外販前提・個人情報保護） |
| 生年月日 | **送信しない**（年齢/年代に変換） |

**UI表記方針（画面上で明示すること）:**
- セクション名: 「AI評価補助」
- 補足表記: 「参考情報 — 施術者が確認・判断してください」
- 診断確定・断定は行わない（免責表示を必ず表示する）

| タスク | 内容 | 状態 |
|---|---|---|
| AI-2-1 | visit-form.html: AI評価補助セクション追加（#aiAssistCard / 免責文 / 7種の出力プレースホルダー） | ✅ 2026-05-04 |
| AI-2-2 | visit-form.html: カルテ保存前は AI ボタンを disabled 制御・保存後に enableAiAssist() で有効化 | ✅ 2026-05-04 |
| AI-2-3 | visit-form.html: AI出力枠（評価観点 / 鑑別方向 / 危険サイン / 追加問診 / 施術方針案 / 受診勧奨 / カルテ下書き / disclaimer） | ✅ 2026-05-04 |
| AI-2-4 | styles.html: スタイル変更なし（インラインスタイルで対応） | — 不要 |
| AI-2-5 | live-check-runner: ai2.spec.ts 追加（LC-4 確認） | ✅ 2026-05-04 |

**変更ファイル:** visit-form.html（clasp push 済み 2026-05-04）
**API実装:** なし（Phase AI-3 で実装予定）
**LiveCheck:** ✅ ai2.spec.ts 4 PASS / 2 SKIP（手動確認）/ 0 FAIL（2026-05-04）

> **ステータス:** ✅ CLOSED（clasp push 済み / LiveCheck PASS 2026-05-04）

---

### Phase AI-3: OpenAI API連携 ✅（CLOSED 2026-05-11 @37）

**目的:** カルテ入力内容と患者マスター情報をAIに送り、補助判定を取得する

| タスク | 内容 | 状態 |
|---|---|---|
| AI-3-1 | JREC_SF01_Main.gs: `runAIAssessment(visitKey)` 関数追加 | ✅ |
| AI-3-2 | JREC_SF01_Main.gs: API Key は ScriptProperties から取得 | ✅ |
| AI-3-3 | JREC_SF01_Main.gs: 入力データ収集（visit + chart + patient 結合） | ✅ |
| AI-3-4 | JREC_SF01_Main.gs: 年齢層変換（dob → ageBand）・個人情報除去 | ✅ |
| AI-3-5 | JREC_SF01_Main.gs: UrlFetchApp で OpenAI Chat Completion API 呼び出し | ✅ |
| AI-3-6 | visit-form.html: `google.script.run.runAIAssessment(visitKey)` 呼び出し | ✅ |
| AI-3-7 | visit-form.html: AI出力を各セクションに表示する JS 実装 | ✅ |
| AI-3-8 | appsscript.json: `script.external_request` スコープ追加 | ✅ |
| AI-3-9 | live-check-runner: ai3.spec.ts 追加（AI3-1〜3 自動 + AI3-H1〜H3 手動 SKIP） | ✅ |

**変更ファイル:** `JREC_SF01_Main.gs` / `visit-form.html` / `appsscript.json` / `tools/live-check-runner/projects/jrec-sf01/ai3.spec.ts` / `package.json`
**採用 API:** OpenAI gpt-4o-mini（response_format: json_object, temperature: 0.3, max_tokens: 1500）
**clasp push:** ✅ 2026-05-11
**OPENAI_API_KEY:** ✅ ScriptProperties 設定済み（2026-05-11）
**GAS外部通信権限:** ✅ 再認証完了（testExternalRequestAuth HTTP 200確認 2026-05-11）
**LiveCheck:** ✅ 3 passed / 3 skipped / 0 failed（`npm run test:jrec:ai3`）
**実機確認:** ✅ /dev AIボタン押下 → 結果カード表示 PASS（AI3-H1 2026-05-11）
**PII除外:** ✅ コードレビュー確認済み（name/kana/phone/address/dob/jrecPatientId 送信なし）
**versioned deployment @37:** ✅ 本番反映済み（2026-05-11）
  - deploymentId: AKfycbxP9beCl8tZ4t41irDgFa-fg54KyDjt8-xM4ogefuwMaZ9Pmkx5-D7JvkLS_nn1G5utYA
  - /exec URL: https://script.google.com/macros/s/AKfycbxP9beCl8tZ4t41irDgFa-fg54KyDjt8-xM4ogefuwMaZ9Pmkx5-D7JvkLS_nn1G5utYA/exec

> **個人情報保護:** 氏名 / 住所 / 電話 / 生年月日 / jrecPatientId は API に送信しない。
> dob は年齢/年代に変換してから送信。

---

### Phase AI-4.5: 保存済みAI評価再読込 + AI参考見立て 🔄（@39 deploy 後に追加不具合 — 修正実装中 2026-05-12）

**目的:** 保存済みAI評価を編集画面で自動再表示 + AI参考見立て（aiImpression）を追加する

| タスク | 内容 | 状態 |
|---|---|---|
| AI-4.5-1 | `getLatestAIAssessmentForVisit(visitKey)` 追加（最新レコード1件返却） | ✅ |
| AI-4.5-2 | `AI_SYSTEM_PROMPT_` に `aiImpression` 追加 / promptVersion "v2" | ✅ |
| AI-4.5-3 | `visit-form.html`: 編集モード起動時に保存済みAI評価を自動読み込み | ✅ |
| AI-4.5-4 | `visit-form.html`: 青バナー「📂 保存済みAI評価補助を読み込みました」+ AI参考見立て表示 | ✅ |
| AI-4.5-5 | `visit-form.html`: AI参考見立てセクション（🧠）+ 免責注意文 | ✅ |
| AI-4.5-6 | `visit-form.html`: 新規AI実行後は新結果が青バナーを上書き（freshResult フラグ） | ✅ |
| AI-4.5-7 | `ai45.spec.ts` 追加（5自動 + 5手動 SKIP） | ✅ |
| AI-4.5-8 | 診断ログ強化 + `google.script.run` 未準備時リトライ（3回目 clasp push 2026-05-12） | ✅ |
| AI-4.5-9 | `getLatestAIAssessmentForVisitOrPatient` header lookup を trim+lowercase 化 + 比較値も trim + `debugAIAssessmentsRead` 追加（4回目 clasp push 2026-05-12 / @39 deploy 後の追加不具合対応） | ✅ |

**UI表現方針:**
- 表示名: 「AI参考見立て」
- 必須注意文: 「この内容はAIによる参考情報です。診断確定ではありません。最終判断は施術者が行ってください。」
- 禁止: AI診断 / 確定診断 / 保険請求上の判断 / 医師判断不要 / 必ず〜

**clasp push:** ✅ 2026-05-11（2回）+ 2026-05-12（診断強化 1回 = 計3回）
**LiveCheck ai45:** ✅ 5 passed / 5 skipped / 0 failed（2026-05-12 は auth 期限切れで skip）
**LiveCheck ai4（回帰）:** ✅ 4 passed / 0 failed
**LiveCheck ai3（回帰）:** ✅ 3 passed / 0 failed
**v2保存 / aiImpression保存:** ✅ スプレッドシートで目視確認 PASS
**実機確認 ステータス:** ✅ PASS（2026-05-12 /dev で 5項目すべて PASS）

**versioned deployment @39:** ✅ 本番反映済み（2026-05-12）
- deploymentId: `AKfycbxdngcgHbq4q52xPV3-ukDlun3s29Kbk8gy_oA11RGrwe4oPDBr4ocbeRyGUys8oxMCpw`
- exec URL: `https://script.google.com/macros/s/AKfycbxdngcgHbq4q52xPV3-ukDlun3s29Kbk8gy_oA11RGrwe4oPDBr4ocbeRyGUys8oxMCpw/exec`
- description: `@39 - Phase AI-4.5: 保存済みAI評価再読込 + AI参考見立て`

**実機確認 PASS 内訳（2026-05-12 /dev）:**
- ✅ 保存済みAI評価の再読み込み
- ✅ 青バナー「📂 保存済みAI評価補助を読み込みました」表示
- ✅ AI参考見立てセクション再表示
- ✅ カルテ下書きセクション再表示
- ✅ 新規AI実行（緑バナー・新結果上書き）も問題なし

**変更ファイル:** Main.gs / visit-form.html / ai45.spec.ts / package.json

---

### Phase AI-4: AI補助判定保存・レビュー ✅（CLOSED 2026-05-11 @38）

**目的:** AI判定を AI_Assessments シートに保存し、施術者がレビューできるようにする

| タスク | 内容 | 状態 |
|---|---|---|
| AI-4-1 | JREC_SF01_Setup.gs: AI_Assessments シート定義 + `setupAIAssessments_()` + `runMigrateAddAIAssessmentsSheet()` | ✅ |
| AI-4-2 | JREC_SF01_Main.gs: `saveAIAssessment_()` 内部関数（AI実行後に自動保存） | ✅ |
| AI-4-3 | JREC_SF01_Main.gs: `getAIAssessmentsByVisitKey(visitKey)` 追加 | ✅ |
| AI-4-4 | visit-form.html: 保存バナー（#aiSavedBanner: assessmentId + reviewStatus「レビュー未確認」） | ✅ |
| AI-4-5 | visit-form.html: adoptedMemo テキストエリア | ⏸ Phase AI-5 で検討 |
| AI-4-6 | visit-form.html: 過去AI判定表示 | ⏸ Phase AI-5 で検討 |

**実装方針（確定）:**
- AI実行成功時に自動で `AI_Assessments` に保存（手動保存ボタンは不要）
- 初期 reviewStatus は `unreviewed`
- 保存失敗時は UI を壊さずログのみ（fail-safe）
- PII 非保存: outputJson = AI出力のみ。name/phone/address/dob/jrecPatientId は記録しない

**AI_Assessments カラム:**
```
assessmentId / visitKey / patientId / createdAt / model / promptVersion /
outputJson / reviewStatus / reviewedAt / reviewedBy / reviewNote /
adoptedToChart / errorCode / errorMessage / updatedAt
```

**clasp push:** ✅ 2026-05-11
**migrate:** ✅ `runMigrateAddAIAssessmentsSheet()` 実行済み
**実機確認:** ✅ 緑バナー（assessmentId + レビュー未確認）表示 PASS（2026-05-11）
**シート記録目視確認:** ✅ AI_Assessments に記録確認 PASS（2026-05-11）
  - assessmentId=`ASMNT_...` / visitKey=`SPV_20260511_P0001_001` / patientId=`P0001` / model=`gpt-4o-mini-2024-07-18` 確認済み
  - 記録は 502行目以降（事前設定した検証・チェックボックス 500行分の影響。機能上問題なし）
  - cleanup 候補: 将来 `appendRow` → `setValues` 方式に変更して空行を解消
**LiveCheck ai4:** ✅ 4 passed / 4 skipped / 0 failed
**LiveCheck ai3（回帰）:** ✅ 3 passed / 3 skipped / 0 failed
**PII除外:** ✅ コードレビュー確認済み
**デバッグ:** 初期実装で `SHEET_NAMES.AI_ASSESSMENTS` が webapp 実行時に未解決 → シート名ハードコード + エラー伝播で解消
**versioned deployment @38:** ✅ 本番反映済み（2026-05-11）
  - deploymentId: AKfycbxP9beCl8tZ4t41irDgFa-fg54KyDjt8-xM4ogefuwMaZ9Pmkx5-D7JvkLS_nn1G5utYA

**変更ファイル:** Setup.gs / Main.gs / visit-form.html / ai4.spec.ts / package.json
**既存会計・集計への影響:** なし（AI_Assessments は独立した新規シート）

---

### Phase AI-5: 運用改善 ⏸

**目的:** 実際の運用からのフィードバックでプロンプト・UIを改善する

| タスク | 内容 | 状態 |
|---|---|---|
| AI-5-1 | 部位別プロンプト調整（肩・腰・膝・首・肘・足首） | ⏸ |
| AI-5-2 | 年齢層・職業別注意点の強化 | ⏸ |
| AI-5-3 | 赤旗チェックリスト精度向上 | ⏸ |
| AI-5-4 | 過去カルテとの比較（同患者の前回AI判定との差分） | ⏸ |
| AI-5-5 | 院内標準パッケージ化の検討 | ⏸ |

---

## 保留フェーズ

| フェーズ | 内容 | 保留理由 |
|---|---|---|
| Phase 6-C | 来院完全削除 | 集計系フェーズ安定後に判断 |
