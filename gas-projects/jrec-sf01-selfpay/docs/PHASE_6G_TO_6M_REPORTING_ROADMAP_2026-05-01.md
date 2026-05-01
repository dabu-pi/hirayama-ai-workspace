# Phase 6-G〜6-M 集計・レポート機能 ロードマップ設計メモ

**作成日:** 2026-05-01  
**ステータス:** 設計メモ（実装未着手）  
**対象プロジェクト:** JREC-SF01 自費カルテ・会計システム

---

## 作成背景

Phase 6-F（ホーム月間カレンダー）の CLOSED に伴い、Phase 6-G 着手前調査を実施。
以下の不足機能を確認し、Phase 6-G〜6-M としてロードマップ化した。

---

## 着手前調査結果サマリ（2026-05-01）

### 現時点で実装済み

| 機能 | 関数 / ファイル | 状態 |
|---|---|---|
| 日別来院一覧 + 会計状態表示 | `getDailyCheckoutList` / daily-checkout.html | ✅ 稼働中 |
| 日別売上集計（Run_Log ベース） | `getDailySalesReport` in DailySales.gs | ✅ 実装済み（画面未連携） |
| DailySales シート UPSERT | `rebuildDailySales` | ✅ 実装済み（手動実行のみ） |
| 月別来院件数集計 | `getMonthlyVisitCalendar` in Billing.gs | ✅ 稼働中（金額なし） |
| 未収一覧取得 | `getAllOutstandingByPatient` in Billing.gs | ✅ 実装済み（画面なし） |
| 患者単位累計 | `getPatientAccountingData` | ✅ 稼働中 |

### 現時点で未実装

| 機能 | 状態 | 備考 |
|---|---|---|
| カレンダー前月/翌月切替 | ❌ 未実装 | home.html は当月固定 |
| dailyCheckout の¥合計表示 | ❌ 未実装 | getDailySalesReport は存在するが画面に渡していない |
| 月別売上集計関数 | ❌ 未実装 | DailySales シートを月集計するだけで実現可能 |
| 月別売上集計ページ | ❌ 未実装 | — |
| メニュー別集計関数 | ❌ 未実装 | SelfPayItems.menuCode は読める |
| メニュー別集計ページ | ❌ 未実装 | — |
| 集計トップページ | ❌ 未実装 | ホームからの集計導線がない |
| 未収管理レポートページ | ❌ 未実装 | 関数は存在 |
| CSV 出力 | ❌ 未実装 | — |
| 印刷用画面 | ❌ 未実装 | — |

---

## 既存データ構造（集計に使うもの）

### SelfPayVisits

| 列 | 内容 |
|---|---|
| col0 | selfPayVisitKey |
| col1 | patientId |
| col2 | visitDate |
| col3 | visitType |
| col11 | isDeleted |

### SelfPayItems

| 列 | 内容 |
|---|---|
| col0 | itemId |
| col1 | selfPayVisitKey |
| col2 | menuCode |
| col3〜 | itemName / qty / unitPrice / taxCategory 等（Setup.gs で確認要） |

### Payments

| 列 | 内容 |
|---|---|
| col2 | totalTaxEx |
| col3 | totalTaxAmt |
| col4 | totalTaxInc |
| col5 | paymentMethod |
| col10 | paidAmount（実入金累積額） |
| — | paymentStatus（未収/一部入金/入金済） |

### Receipts

| 列 | 内容 |
|---|---|
| col1 | selfPayVisitKey |
| col2 | receiptNo |
| col3 | 発行日 |
| col5 | 金額（税込） |

### DailySales シート（rebuildDailySales が書き込む）

| 列 | 内容 |
|---|---|
| date | 対象日（YYYY-MM-DD） |
| totalSales | 当日売上合計 |
| paymentSaveTotal | 新規入金合計 |
| paymentCollectTotal | 未収回収合計 |
| unpaidTotal | 現時点の未収残高合計 |

> **注意:** DailySales シートは `rebuildDailySales` を手動実行しないと書き込まれない。
> 月別集計で DailySales シートを使う場合、「当日分が未記録」のケースを考慮した fallback が必要。

### Run_Log

| 列 | 内容 |
|---|---|
| col0 | timestamp |
| col1 | action（PAYMENT_SAVE / PAYMENT_COLLECT 等） |
| col2 | selfPayVisitKey |
| col3 | patientId |
| col5 | detail（入金額: ¥N / 今回回収額: ¥N を含む） |

---

## フェーズ別実装設計メモ

### Phase 6-G: カレンダー前月/翌月切替

**変更方針:**
- `JREC_SF01_Main.gs` の home ルートで URL パラメータ `year` / `month` を受け取る
- 未指定時は当月（JST）をデフォルト
- `home.html` に「◀ 前月」「今月」「翌月 ▶」ボタンを追加
- ボタン onclick で `?page=home&year=YYYY&month=MM` に遷移
- 翌月制限: 当月+1まで（それ以上への遷移は不要）

**実装リスク:** 低

---

### Phase 6-H: dailyCheckout 日別金額合計

**変更方針:**
- `JREC_SF01_Main.gs` dailyCheckout ルートで `getDailySalesReport(targetDate)` を追加呼び出し
- `daily-checkout.html` のサマリバー直下に「日別合計カード」を追加
- 表示項目: 来院数 / 売上合計（税込）/ 新規入金 / 未収回収 / 現在未収残

**実装リスク:** 中（`getDailySalesReport` は Run_Log 全スキャンのため、データ量が増えると遅くなる可能性）

**速度対策候補:**
- DailySales シートが当日分を持っていれば優先参照し、なければ getDailySalesReport を呼ぶ

---

### Phase 6-I: 集計メニュー / 集計ページ新設

**変更方針:**
- `home.html` 業務メニューに「📊 集計・レポート」カードを追加
- `?page=reports` を新設（`JREC_SF01_Main.gs` に case 追加 / `reports.html` 新規作成）
- reports.html には以下の入口カードを配置:
  - 月別売上集計 → `?page=monthlyReport`
  - メニュー別集計 → `?page=menuReport`
  - 未収管理 → `?page=outstandingReport`

---

### Phase 6-J: 月別売上集計

**関数設計案:**

```javascript
function getMonthlyRevenueSummary(year, month) {
  // DailySales シートを月内でフィルタ → 集計
  // DailySales が空なら Payments から直接集計（fallback）
  return {
    ok, year, month,
    visitCount, totalSales, paymentSaveTotal,
    paymentCollectTotal, unpaidTotal, receiptIssuedCount
  };
}
```

**DailySales シートが空の場合の fallback:**
- Payments シートを visitDate（SelfPayVisits join）で当月フィルタして直集計
- Run_Log ベースの精度は犠牲になるが、金額合計としては正確

---

### Phase 6-K: メニュー別集計

**関数設計案:**

```javascript
function getMenuBreakdown(year, month) {
  // SelfPayItems を SelfPayVisits.visitDate で当月フィルタ
  // menuCode / itemName 別に count / qty / totalAmount を集計
  // MenuMaster と join して表示名を取得
  return { ok, year, month, items: [ { menuCode, menuName, count, qty, totalAmount } ] };
}
```

**前提確認事項:** SelfPayItems の col3 以降（itemName・qty・unitPrice の列番号）を Setup.gs で確認してから実装する。

---

### Phase 6-L: 未収・回収管理レポート

**既存活用:**
- `getAllOutstandingByPatient()` が既に実装済み → 未収一覧は関数を呼ぶだけ
- 患者別 / 日別の絞り込みを追加して表示

---

### Phase 6-M: 出力・監査レポート

**CSV 出力:**
- GAS `ContentService.createTextOutput(csv).setMimeType(MimeType.CSV)` を使う
- doGet の case に `csvExport` を追加して `?page=csvExport&type=monthly&year=2026&month=5` で呼ぶ

**印刷用:**
- `@media print` CSS を追加してボタン1つで印刷

---

## 依存関係と実装順序の根拠

```
6-G（カレンダー月移動）
  └── 独立。影響なし。最小で実装可能。

6-H（日別金額合計）
  └── getDailySalesReport は実装済み。Main.gs に1行追加 + HTML 修正のみ。

6-I（集計導線）
  └── 6-J/6-K より先に作ると、後続フェーズの画面置き場が決まる。

6-J（月別集計）
  └── 6-I の集計ページが先にあると、実装後すぐ導線を繋げられる。

6-K（メニュー別集計）
  └── SelfPayItems の列確認が前提。6-J の後が安全。

6-L（未収管理）
  └── 関数は存在するので、画面作成のみ。どのタイミングでも実装可能。

6-M（出力・監査）
  └── 集計データが揃ってから。最後。
```

---

## 注意事項

| 事項 | 内容 |
|---|---|
| DailySales シート空問題 | rebuildDailySales を手動実行しないと書き込まれない。月別集計で使う場合は fallback 設計が必須 |
| getDailySalesReport の速度 | Run_Log 全件スキャン。データ増加で遅くなる可能性。DailySales シートのキャッシュ活用を優先 |
| SelfPayItems 列確認 | col3 以降の列番号を実装前に Setup.gs / 実シートで確認すること |
| GAS iframe 原則 | google.script.run の success handler 内で自動遷移しない。クリック操作のみで遷移 |
| 本番デプロイ | 各フェーズ CLOSED 後に versioned deployment を作成。@28 が現在最新 |
