# JREC-SF01 自費カルテ・会計システム — ロードマップ

最終更新: 2026-05-02（Phase 6-K CLOSED @34）

---

## 現在の本番状態

| デプロイ | 内容 |
|---|---|
| @34 | Phase 6-K メニュー別売上分析 / menuSalesReport ページ 含む（**最新本番** `AKfycbxwdjQ0...5bf`） |
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

### Phase 6-L: 未収・回収管理レポート ⏸

**目的:** 未収・一部入金の残高を管理し、回収漏れを防ぐ

| タスク | 内容 |
|---|---|
| 6-L-1 | 未収一覧を日別・患者別で確認できるページ |
| 6-L-2 | 一部入金残高・支払済との差額確認 |
| 6-L-3 | 既存 `getAllOutstandingByPatient()` の活用 |
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
7. Phase 6-L — 未収・回収管理（財務リスク対応）
8. Phase 6-M — CSV・印刷・監査（出力整備）
```

---

## 保留フェーズ

| フェーズ | 内容 | 保留理由 |
|---|---|---|
| Phase 6-C | 来院完全削除 | 集計系フェーズ安定後に判断 |
