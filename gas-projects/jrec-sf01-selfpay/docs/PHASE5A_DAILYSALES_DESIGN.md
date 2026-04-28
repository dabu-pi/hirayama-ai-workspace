# Phase 5-A DailySales 集計 設計調査書

**作成日:** 2026-04-28
**対象プロジェクト:** JREC-SF01 自費カルテ・会計システム
**ステータス:** 設計調査中（コード変更なし）

---

## 1. 現状調査

### 1-1. DailySales シートの現在状態

| 項目 | 状態 |
|---|---|
| シート存在 | ✅ `setupAll_()` で作成済み |
| データ行 | ❌ **空（0件）** — 集計ロジックは未実装 |
| ヘッダー | ✅ 確認済み |

**確認済みヘッダー（9列）:**
```
日付 / 来院数 / 売上合計（税込）/ 売上合計（税別）/ 消費税合計
/ 未収発生額 / 未収回収額 / 主力来院数 / 備考
```

現状、どの GAS 関数も DailySales に書き込む処理を持っていない。

---

### 1-2. Payments シートの列構造（源泉データ）

| 列 | 内容 | 型 | 備考 |
|---|---|---|---|
| 1 | paymentId | string | `SPP_{visitKey}` |
| 2 | selfPayVisitKey | string | 集計の結合キー |
| 3 | 税別合計 | integer | SelfPayItems から集計済み |
| 4 | 消費税額合計 | integer | 同上 |
| 5 | 税込合計 | integer | 売上・未収の正本 |
| 6 | 支払方法 | string | 現金/カード/電子マネー/未収/etc |
| 7 | 入金状態 | string | **入金済 / 未収 / 一部入金** |
| 8 | 入金日 | date | 当日入金は createdAt ≈ 入金日。回収時は createdAt ≠ 入金日 |
| 9 | メモ | string | 回収時は `回収済(日付)` が追記される |
| 10 | createdAt | datetime | Payment 作成日時（PAYMENT_SAVE 実行日）|

---

### 1-3. SelfPayVisits シートの列構造

| 列 | 内容 | 型 | 備考 |
|---|---|---|---|
| 1 | selfPayVisitKey | string | `SPV_YYYYMMDD_patientId_001` |
| 2 | patientId | string | — |
| 3 | 来院日 | date | **集計の日付基準（主力来院数）** |
| 4 | 来院区分 | string | 初診/再診 |
| 5 | 担当者 | string | — |
| 6 | 主訴 | string | — |
| 7 | VAS | integer | — |
| 8 | 次回方針 | string | — |
| 9 | 会計状態 | string | 未会計/会計済/未収 |
| 10 | createdAt | datetime | — |
| 11 | updatedAt | datetime | — |

visitKey から `SPV_YYYYMMDD_P0001_001` → `YYYYMMDD` = 来院日 として解析可能。

---

### 1-4. Receipts シートの列構造

| 列 | 内容 | 型 | 備考 |
|---|---|---|---|
| 1 | receiptId | string | `R_YYYY_0001` |
| 2 | selfPayVisitKey | string | — |
| 3 | receiptNo | string | receiptId と同値 |
| 4 | 発行日 | date | 領収書発行日 |
| 5 | 宛名 | string | — |
| 6 | 金額（税込）| integer | Payments.totalTaxInc と同値 |
| 7 | 消費税額 | integer | — |
| 8 | 但し書き | string | — |
| 9 | 再発行回数 | integer | 未使用（現在 0 固定）|
| 10 | createdAt | datetime | — |

Receipts は DailySales 集計に直接使わない（Payments が正本）。

---

### 1-5. Run_Log の記録形式と問題点

**現在の `appendRunLog_` シグネチャ:**
```javascript
function appendRunLog_(action, patientId, detail)
```

| Run_Log 列 | 内容 | 備考 |
|---|---|---|
| timestamp | 実行日時 | 集計の日付判定に使用可能 |
| action | PAYMENT_SAVE / PAYMENT_COLLECT / VISIT_CREATE / RECEIPT_ISSUE | — |
| selfPayVisitKey | **常に空文字 `""`** | ⚠️ バグ。visitKey が記録されない |
| patientId | patientId（P0001 形式）| visitKey から split で抽出 |
| result | SUCCESS | — |
| detail | テキスト形式の詳細 | `"visitKey: SPV_... 回収額: ¥3850"` 等 |
| operator | メールアドレス | — |

**⚠️ 重要な既存バグ:** `appendRunLog_` は Run_Log の `selfPayVisitKey` 列（col 3）に **常に空文字**を書く。
実際の visitKey は `detail` テキストに埋め込まれている。これは DailySales 集計を複雑にする。

**記録される action 一覧:**
| action | 発生タイミング |
|---|---|
| `PATIENT_CREATE` | createPatient() 呼び出し時 |
| `VISIT_CREATE` | createVisitWithChart() 呼び出し時 |
| `PAYMENT_SAVE` | savePaymentWithItems() 呼び出し時（会計保存）|
| `PAYMENT_COLLECT` | collectOutstandingPayment() 呼び出し時（未収回収）|
| `RECEIPT_ISSUE` | issueReceipt() 呼び出し時 |

---

### 1-6. collectOutstandingPayment() の更新内容

```
Payments.paymentStatus  → "入金済"
Payments.入金日          → today (または payload.paymentDate)
Payments.メモ            → 既存メモ + "回収済(日付)"
Payments.支払方法         → payload.paymentMethod（任意）
SelfPayVisits.会計状態   → "会計済"
Run_Log                  → action="PAYMENT_COLLECT", detail="visitKey: ... 回収額: ¥..."
```

---

### 1-7. billing 保存時の入金記録フロー

```
savePaymentWithItems(payload)
  → SelfPayItems に明細保存（複数行）
  → Payments に1行保存
      paymentStatus: "入金済" or "未収"
      入金日: 入金済の場合は当日、未収の場合は空
      createdAt: 現在日時
  → SelfPayVisits.会計状態 → "会計済" or "未収"
  → Run_Log.action = "PAYMENT_SAVE"
```

---

### 1-8. 日次集計に使うべき正本データ

| 集計列 | 正本シート | 集計キー | 注意点 |
|---|---|---|---|
| 来院数 | SelfPayVisits | 来院日 | 会計状態問わず全来院をカウント |
| 売上合計（税込/税別/消費税）| Payments | 入金日 | paymentStatus = "入金済" のみ |
| 未収発生額 | Payments | createdAt（日付部分）| paymentStatus = "未収"/"一部入金" |
| 未収回収額 | Payments + Run_Log | Run_Log.timestamp（PAYMENT_COLLECT）| createdAt ≠ 入金日 でも検出可 |
| 主力来院数 | SelfPayItems JOIN SelfPayVisits | SelfPayVisits.来院日 | menuCode = "SELFPAY_CONTINUE20" |

---

## 2. 集計対象・除外対象の定義

### 2-1. 売上（当日入金）

```
対象: Payments.paymentStatus = "入金済"
      AND Payments.入金日 = 集計日
除外: paymentStatus = "未収" / "一部入金"
除外: 入金日が異なる日の Payments
```

### 2-2. 未収発生額

```
対象: Payments.paymentStatus IN ("未収", "一部入金")
      AND DATE(Payments.createdAt) = 集計日
除外: 未会計の来院（Payments が存在しない visitKey）
除外: paymentStatus = "入金済"
```

**「未会計は未収に含めない」**: Payments が存在しない visitKey（未会計）は金額未確定のため除外。

### 2-3. 未収回収額

```
対象: Run_Log.action = "PAYMENT_COLLECT"
      AND DATE(Run_Log.timestamp) = 集計日
金額: Run_Log.detail から "回収額: ¥N" を正規表現で抽出
      OR Payments.totalTaxInc（visitKey で JOIN）
```

または:
```
対象: Payments.paymentStatus = "入金済"
      AND DATE(Payments.入金日) = 集計日
      AND DATE(Payments.createdAt) ≠ 集計日  ← 後日回収を示す
```

2つの方法のどちらを使うかは実装案で比較する。

### 2-4. 主力来院数

```
対象: SelfPayItems.menuCode = "SELFPAY_CONTINUE20"
      JOIN SelfPayVisits ON selfPayVisitKey
      WHERE SelfPayVisits.来院日 = 集計日
```

---

## 3. 二重計上防止ルール

| ケース | 防止方法 |
|---|---|
| 同一 visitKey に Payments が複数 | `savePaymentWithItems()` の先頭で二重保存チェック済み → 起こらない |
| 同一 visitKey が PAYMENT_COLLECT で2回 | `collectOutstandingPayment()` の先頭でステータスチェック済み → 起こらない |
| 売上 + 未収回収の二重計上 | 入金済は「売上」のみ計上。未収回収額は Run_Log を正本とするか、createdAt ≠ 入金日 判定で区別 |
| DailySales 行の重複 | UPSERT 方式（同日行が存在すればUPDATE、なければINSERT）を採用 |

---

## 4. 実装案 A / B

### 案 A: オンデマンド集計（DailySales シートを使わない）

```
getDailySalesReport(startDate, endDate) → { [date]: { totalInc, visitCount, ... } }
```

- SelfPayVisits / Payments / SelfPayItems を日付範囲で読み取り、毎回集計して返す
- DailySales シートには書き込まない（将来の参照用として空のまま保持）
- Phase 5-A MVP として最初に実装する

**メリット:**
- 常に最新データ。DailySales とのズレが起きない
- 実装がシンプル

**デメリット:**
- 日付範囲が広い場合（月次）は読み取りが遅い
- 外部ダッシュボード連携が難しい

---

### 案 B: 書き込みトリガー型（DailySales をリアルタイム更新）

```
updateDailySales_(date) を以下の後に呼ぶ:
  savePaymentWithItems()
  collectOutstandingPayment()
```

- 各書き込みイベント発生時に DailySales 該当日行を UPSERT
- DailySales シートが常に集計結果を保持する

**メリット:**
- DailySales シートがそのまま確認可能（GAS や外部ツールで参照できる）
- 日次集計ページのロードが高速

**デメリット:**
- savePaymentWithItems / collectOutstandingPayment に副作用追加 → テスト・デバッグが複雑
- updateDailySales_ が失敗しても主処理は成功させる必要がある（try-catch で吸収）
- 日付をまたいだ修正時に過去行の再計算が必要

---

### 案 C: バッチ再計算（手動または定期実行）

```
rebuildDailySales(startDate, endDate)
  → 指定期間の DailySales 行を scratch から再計算・上書き
```

- 案 A の計算ロジックを使い、結果を DailySales シートに書き込む
- 手動実行またはタイムトリガー（毎日 AM 2時など）

**メリット:**
- ロジックがシンプル（常に全件再計算）
- 過去修正にも対応
- 案 A のロジックを再利用できる

**デメリット:**
- リアルタイムではない（前日までの集計しか保持されない）

---

## 5. 推奨実装案

### Phase 5-A: 案 A（オンデマンド）から着手 → 案 C（バッチ）へ移行

```
Step 1: getDailySalesReport(date) を実装
  → Payments + SelfPayVisits + SelfPayItems を読み取り、日付で集計して返す
  → 未収回収額は Run_Log から PAYMENT_COLLECT を検索して算出

Step 2: 日次集計画面（Phase 5-S07）で getDailySalesReport を呼び出す

Step 3: rebuildDailySales(date) を実装して DailySales シートに書き込む
  → Step 1 のロジックを再利用
  → 手動実行ボタンまたはタイムトリガーで実行

Step 4: （将来）案 B（書き込みトリガー）への移行
  → Step 3 の rebuildDailySales を savePaymentWithItems / collectOutstandingPayment に組み込む
```

---

## 6. 変更予定ファイル一覧

| ファイル | 変更内容 | ステップ |
|---|---|---|
| `JREC_SF01_Billing.gs` | `getDailySalesReport(date)` 追加 | Step 1 |
| `JREC_SF01_Billing.gs` | `rebuildDailySales(date)` 追加（案 C）| Step 3 |
| `JREC_SF01_Main.gs` | `dailySales` ルート追加（`?page=dailySales&date=...`）| Step 2 |
| `daily-sales.html` | 日次集計画面（新規作成）| Step 2 |
| `JREC_SF01_Patient.gs` | `appendRunLog_` に visitKey 列修正（バグ Fix）| 事前 |

---

## 7. リスク

| リスク | 内容 | 対策 |
|---|---|---|
| 未収回収額の検出 | Run_Log.selfPayVisitKey が常に空のため detail テキストを解析する必要がある | appendRunLog_ バグを修正して visitKey 列に記録するよう変更する（事前 Fix）|
| 日付基準の不一致 | 来院日（visitDate）と入金日（paymentDate）が異なる場合、どの日に計上するか | 売上は入金日、来院数は来院日で統一。混在を避ける |
| DailySales の再計算 | 過去の Payment を修正したとき DailySales が古い値を保持する | rebuildDailySales で対象日を再計算する運用ルールを設ける |
| 一部入金の差額 | 現在一部入金は全額を未収または入金済で管理している | 差額管理が必要な場合は Payments スキーマ変更が必要（後フェーズ）|
| 主力来院数の定義変更 | SELFPAY_CONTINUE20 が廃止・統合された場合 | MenuMaster の KPI フラグ列で管理することを将来検討 |

---

## 8. 実装前確認事項（ユーザーへの質問）

| # | 確認事項 | 影響 |
|---|---|---|
| 1 | **売上の日付基準**: 来院日・入金日・領収書発行日のどれを「売上日」とするか | 集計クエリのキー列が変わる |
| 2 | **未収回収額の帰属**: 回収日（=入金日）と来院日のどちらでカウントするか | DailySales の「未収回収額」列の定義が変わる |
| 3 | **Run_Log バグ修正の優先度**: `appendRunLog_` で selfPayVisitKey 列が空の問題を先に修正するか | 修正しないと PAYMENT_COLLECT の集計に detail テキスト解析が必要 |
| 4 | **主力来院数の KPI 基準**: SELFPAY_CONTINUE20 固定でよいか、他のメニューも含めるか | SelfPayItems の集計対象が変わる |
| 5 | **日次集計画面の要否**: DailySales シートを直接スプレッドシートで見るか、Web画面を作るか | Phase 5 の実装スコープが変わる |

---

## 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-04-28 | Phase 5-A 設計調査書 初版作成 |
