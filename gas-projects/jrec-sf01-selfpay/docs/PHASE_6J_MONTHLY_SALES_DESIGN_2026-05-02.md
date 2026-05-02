# Phase 6-J 月別売上集計 — 設計調査メモ

作成: 2026-05-02（実装前調査）
対象フェーズ: Phase 6-J（月別売上集計）
関連フェーズ: Phase 6-K（メニュー別）/ Phase 6-L（未収管理）/ Phase 6-M（CSV/監査）

---

## 1. 現状の集計関連関数一覧

| 関数 | ファイル | 参照シート | 用途 | 速度 |
|---|---|---|---|---|
| `getDailyCheckoutList(dateStr)` | Billing.gs | SelfPayVisits + Payments + Receipts + Patients | 1日分の来院一覧（UI表示） | ◎ 高速 |
| `getDailySalesReport(dateStr)` | DailySales.gs | Payments + Patients + SelfPayVisits + SelfPayItems + Receipts + **Run_Log全スキャン** | 1日分の売上集計（監査証跡付き） | △ 低速 |
| `rebuildDailySales(dateStr)` | DailySales.gs | getDailySalesReport + DailySales シート書き込み | DailySales シートへ UPSERT | △ 低速 |
| `getMonthlyVisitCalendar(year, month)` | Billing.gs | SelfPayVisits のみ | ホームカレンダー用来院件数集計 | ◎ 高速 |
| `getPatientAccountingData(patientId)` | Billing.gs | Payments + Receipts + SelfPayVisits | 患者単位の会計状態 | ◎ 高速 |

---

## 2. 各シートの役割と月次集計への利用可否

| シート | 主キー | 日付列 | 月次集計用途 | 備考 |
|---|---|---|---|---|
| SelfPayVisits | selfPayVisitKey | visitDate（来院日） | 来院件数・会計状態 | isDeleted=true を除外 |
| Payments | paymentId | paymentDate（入金確定日） | 請求合計・入金合計・未収残高 | paidAmount col11 で実入金額を把握 |
| Receipts | receiptId | issuedDate（領収書発行日） | 発行済件数 | visitKey で JOIN |
| SelfPayItems | itemId | visitKey 経由 | メニュー別集計（Phase 6-K） | visitDate は visitKey→SelfPayVisits 経由 |
| DailySales | date | date（日次集計済み） | 月次サマリー | **rebuildDailySales 実行済み日のみ存在** |
| Run_Log | - | timestamp | 監査証跡・二重計上防止 | getDailySalesReport が全スキャン |

---

## 3. getDailySalesReport の速度リスク分析

```
getDailySalesReport(dateStr) の内部処理:
  (1) Payments 全件読み取り   → O(Payments行数)
  (2) Patients 全件読み取り   → O(Patients行数)
  (3) SelfPayVisits 全件読み取り → O(Visits行数)
  (4) SelfPayItems 全件読み取り → O(Items行数)
  (5) Receipts 全件読み取り   → O(Receipts行数)
  (6) Run_Log 全件読み取り後に日付フィルタ → O(Run_Log全行数) ← ここがボトルネック
```

**月次呼び出し時の試算:**
- 1ヶ月 = 最大31日 → `getDailySalesReport` を31回呼ぶ
- Run_Log が 1,000行あれば: 31,000行分のスキャン
- Run_Log が 5,000行になれば: 155,000行分のスキャン
- GAS の実行制限（6分）に抵触するリスクが高い

**結論: Phase 6-J で getDailySalesReport を月次分ループ呼び出しするのは禁止**

---

## 4. DailySales シートの空問題

- `DailySales` シートは `rebuildDailySales(dateStr)` を手動または自動で実行した日のみ行が作られる
- 2026-04-29 以前の全日・運用開始日から rebuildDailySales を実行していない日は**完全に空**
- DailySales を正本として月次集計すると「来院 0件」と誤判定する日が多数出る可能性がある

**DailySales が正本として使えるようになる条件:**
1. rebuildDailySales を対象月の全稼働日分実行済みであること
2. 実行後に Payments/Receipts が追記された場合は再実行が必要

---

## 5. 集計方式の採用候補比較

### 採用候補A: DailySales 正本方式

```
getMonthlyRevenueSummary(year, month):
  → DailySales シートから対象月の行を全件取得
  → totalSales / visitCount / unpaidTotal / receiptIssuedCount を集計
```

| 観点 | 評価 |
|---|---|
| 速度 | ◎ DailySales 1シートのみ読み取り（1回の getRange） |
| 信頼性 | ✖ rebuildDailySales 未実行日は欠損 |
| 監査耐性 | ◎ Run_Log 由来の厳密な集計値 |
| 実装複雑度 | △ 欠損日の fallback が必要 |
| DailySales 空問題 | ✖ 対応必須 |

**適合フェーズ:** Phase 6-M（監査レポート）に向いている

---

### 採用候補B: Payments 等から月次直接集計方式

```
getMonthlyRevenueSummary(year, month):
  → SelfPayVisits から対象月 visitDate の来院一覧を取得（isDeleted 除外）
  → Payments / Receipts を visitKey で JOIN
  → totalTaxInc / paidAmount / remainingAmount / displayStatus を集計
```

**集計基準:** **visitDate（来院日ベース）**
- 来院した月として計上するのが業務的に自然
- getDailyCheckoutList と同じ集計基準で一貫性がある

| 観点 | 評価 |
|---|---|
| 速度 | ○ SelfPayVisits + Payments + Receipts の3シート読み取り |
| 信頼性 | ○ 常に最新状態を反映 |
| 監査耐性 | △ Run_Log 二重計上防止なし（ただし月次サマリーには十分） |
| 実装複雑度 | ◎ Phase 6-H と同じパターン |
| DailySales 空問題 | ◎ 完全非依存 |

**適合フェーズ:** Phase 6-J（月次 UI サマリー）に最適

---

### 採用候補C: DailySales 優先 + 欠損日は直接再計算の Hybrid 方式

```
getMonthlyRevenueSummary(year, month):
  → DailySales で対象月の既存行を取得
  → 月内で欠損している日を特定
  → 欠損日分を Payments から直接集計（getDailySalesReport は呼ばない）
  → 両者をマージして返す
```

| 観点 | 評価 |
|---|---|
| 速度 | ○ DailySales 既存分は高速、欠損分のみ追加読み取り |
| 信頼性 | ○ DailySales 既存分は監査品質 |
| 監査耐性 | △ 欠損日は DailySales 品質でない |
| 実装複雑度 | ✖ 複雑・テストが難しい |
| DailySales 空問題 | △ 緩和するが完全解決ではない |

**適合フェーズ:** 運用が安定した後の Phase 6-M 高精度版

---

## 6. 推奨案

### Phase 6-J: **採用候補B（Payments 等から月次直接集計方式）を採用**

**理由:**
1. Phase 6-H の `getDailyCheckoutList` と全く同じアーキテクチャ → 実績あり・安全
2. DailySales/Run_Log に依存しないため、空問題・速度リスクを完全回避
3. 月次サマリー表示に十分な精度（二重計上は現実データで発生しにくい）
4. 実装コストが低く、Phase 6-I の「入口整備」に続く自然なステップ

**Phase 6-M（監査レポート）では候補Aを採用する**（rebuildDailySales で DailySales を事前構築する前提で）

---

## 7. Phase 6-J で表示する項目と根拠

| 表示項目 | 集計元フィールド | 集計基準 |
|---|---|---|
| 来院件数 | SelfPayVisits の visitDate | visitDate が対象月（isDeleted 除外） |
| 未会計件数 | paymentMap に visitKey が存在しない来院 | — |
| 未収件数 | paymentStatus === "未収" | — |
| 一部入金件数 | paymentStatus === "一部入金" | — |
| 発行済件数 | receiptMap に visitKey が存在する来院 | — |
| 月間請求合計 | Σ totalTaxInc（会計済み来院のみ） | Payments.col5 |
| 月間入金合計 | Σ paidAmount | Payments.col11 |
| 月間未収残高 | Σ remainingAmount（totalTaxInc - paidAmount） | — |
| 日別内訳 | 上記を visitDate でグループ化 | YYYY-MM-DD ごと |

**日別内訳の dailyCheckout リンク:** YES
- 日別行をクリックで `?page=dailyCheckout&date=YYYY-MM-DD` に遷移
- Phase 6-H で実装済みの日別金額合計カードと組み合わせて使える

---

## 8. Phase 6-J の実装候補手順

### GAS 側

```javascript
// JREC_SF01_Billing.gs に追加
// 月次集計サマリーを返す（visitDate ベース、DailySales 非依存）
function getMonthlyRevenueSummary(year, month) {
  // 1. SelfPayVisits から対象月の来院を抽出（isDeleted 除外）
  // 2. Payments をインデックス化（visitKey → payment）
  // 3. Receipts をインデックス化（visitKey → receiptNo）
  // 4. 日別グループで集計
  // 5. { summary: {...}, days: { "YYYY-MM-DD": {...} }, list: [...] } を返す
}
```

### Main.gs 側

```javascript
case "monthlyReport": {
  var year  = ...; // URL パラメータ year（バリデーション必須）
  var month = ...; // URL パラメータ month
  var data  = getMonthlyRevenueSummary(year, month);
  var tm = HtmlService.createTemplateFromFile("monthly-report");
  tm.appUrl      = appUrl;
  tm.currentPage = "reports";  // 売上・レポートタブを active に
  tm.year        = year;
  tm.month       = month;
  tm.summary     = data.summary;
  tm.days        = data.days;
  return evalTemplate_(tm);
}
```

### HTML 側
- `monthly-report.html` を新規作成
- 月移動ナビ（◀ 前月 / 今月 / 翌月 ▶）← Phase 6-G-1 と同パターン
- サマリーカード（月間請求合計・入金合計・未収残高・来院件数など）
- 日別内訳テーブル（日付クリックで dailyCheckout 遷移）

### reports.html 連携
- 月次売上レポートカードの `onclick` を `?page=monthlyReport` に変更
- Phase 6-J 完了後に reports.html の該当カードを有効化する

---

## 9. Phase 6-J でやる範囲と残す範囲

| 項目 | Phase 6-J | 残すフェーズ |
|---|---|---|
| `getMonthlyRevenueSummary(year, month)` 実装 | ✅ | — |
| `?page=monthlyReport` ページ新設 | ✅ | — |
| 月間サマリーカード（件数・金額）| ✅ | — |
| 日別内訳テーブル + dailyCheckout リンク | ✅ | — |
| 月移動ナビ（前月/今月/翌月）| ✅ | — |
| reports.html の月次カード有効化 | ✅ | — |
| メニュー別集計 | ✖ | Phase 6-K |
| 未収一覧・患者別未収 | ✖ | Phase 6-L |
| DailySales 活用・Run_Log 監査 | ✖ | Phase 6-M |
| CSV 出力 | ✖ | Phase 6-M |

---

## 10. 実機確認項目案（Phase 6-J 用）

| Test | 確認内容 |
|---|---|
| J1-1 | reports ページの「月次売上レポート」カードがクリック可能になる |
| J1-2 | monthlyReport ページに月間サマリーカードが表示される |
| J1-3 | 月間請求合計・入金合計・未収残高が dailyCheckout の合計と一致する |
| J1-4 | 日別内訳テーブルで来院件数が月間カレンダーと一致する |
| J1-5 | 日付クリックで dailyCheckout に date 付き遷移できる |
| J1-6 | ◀ 前月 / 今月 / 翌月 ▶ ナビが動作する |
| J1-7 | 来院 0件月でも表示が壊れない（空状態表示） |
| J1-8 | isDeleted=true の来院が集計から除外される |
| J1-9 | DailySales シートが空でも表示が壊れない（非依存） |
| J1-10 | スマホ表示でカード・テーブルが崩れない |

---

## 11. 速度リスクと対策

| リスク | 内容 | 対策 |
|---|---|---|
| Payments 全件読み取り | 患者が増えると O(Payments行数) | 月別フィルタは visitKey 経由になるため、Payments は全件インデックス化が必要。現状は許容範囲（数百行程度） |
| SelfPayVisits 全件読み取り | 月ごとに全件スキャン | visitDate で月フィルタ。現状は許容範囲 |
| GAS タイムアウト | 上記2シートで数千行になった場合 | `SpreadsheetApp.getActive()` ではなく `openById` を使い、`getRange` の範囲を最小化する |
| getDailySalesReport ループ | **絶対に使わない** | Phase 6-J では getDailySalesReport を呼ばない。Payments 直接集計のみ |
