# 一部入金の差額管理 設計調査書

**作成日:** 2026-04-28
**対象:** JREC-SF01 自費カルテ・会計システム
**ステータス:** 設計調査中（コード変更なし）

---

## 1. 現状調査

### 1-1. Payments シートの列構造（10列）

| 列 | 名前 | 型 | 備考 |
|---|---|---|---|
| 1 | paymentId | string | `SPP_{visitKey}` |
| 2 | selfPayVisitKey | string | — |
| 3 | 税別合計 | integer | 請求総額（税別）|
| 4 | 消費税額合計 | integer | — |
| 5 | 税込合計 | integer | 請求総額（税込）**実入金額ではない** |
| 6 | 支払方法 | string | 現金/カード/電子マネー/未収 |
| 7 | 入金状態 | string | 入金済/未収/**一部入金** |
| 8 | 入金日 | date | 入金済の場合のみ設定 |
| 9 | メモ | string | 回収時に `回収済(日付)` 追記 |
| 10 | createdAt | datetime | — |

**⚠️ 重要:** `paidAmount`（実際の入金額）列が存在しない。

### 1-2. 現在の一部入金フロー

```
billing-form.html
  → paymentStatus = "一部入金" 選択
  → savePaymentWithItems(payload)
    ・totalTaxInc = 請求総額（例: ¥3,850）をそのまま保存
    ・paidAmount フィールドなし
    ・一部入金額（例: ¥2,000）は保存されない
  → Payments 行: totalTaxInc=3850, paymentStatus="一部入金"
  → 差額 ¥1,850 は記録不能
```

### 1-3. 現在の未収回収フロー

```
collectOutstandingPayment(visitKey, payload)
  → curStatus が "未収"/"一部入金" を確認
  → payload: { paymentMethod, paymentDate, memo } → collectedAmount なし
  → Payments.paymentStatus → "入金済"（全額回収として処理）
  → Payments.totalTaxInc は変更しない（¥3,850 のまま）
  → 実際に回収した金額（例: 残り ¥1,850）は記録されない
```

### 1-4. 未収残高計算の問題

現在の `getPatientListStats()` / `getPatientAccountingData()` の計算:

```javascript
// 問題のある計算
if (status === "一部入金") outstanding += totalTaxInc;  // 残額ではなく全額を加算
if (status === "一部入金") totalPaid   += totalTaxInc;  // 入金済みでも全額を加算
```

**例:** 請求 ¥3,850 のうち ¥2,000 を一部入金した場合:
- 正しい: `outstanding = ¥1,850`（残額）
- 現在: `outstanding = ¥3,850`（全額）→ **¥2,000 過大計上**

### 1-5. DailySales への影響

`getDailySalesReport` では:
- `PAYMENT_SAVE` の場合: `amount = payment.totalTaxInc` → 一部入金時でも全額を売上計上
- `unpaidTotal = SUM(totalTaxInc) WHERE status=未収/一部入金` → 残額でなく全額

**例:** ¥3,850 を 一部入金（¥2,000）→ 後日回収（¥1,850）の場合:
- PAYMENT_SAVE 日: paymentSaveTotal に ¥3,850 が計上 → **¥2,000 過大**
- PAYMENT_COLLECT 日: paymentCollectTotal に ¥3,850 が計上 → **¥1,850 過大**

### 1-6. Run_Log の PAYMENT_COLLECT 記録

```
action: "PAYMENT_COLLECT"
selfPayVisitKey: "SPV_..." (Step 0 以降修正済み)
patientId: "P0001"
detail: "visitKey: SPV_... 回収額: ¥3850 現金"
```

`detail` テキストに回収額が入っているが、構造化フィールドではない。

---

## 2. 現在の一部入金処理の問題点

| 問題 | 影響 |
|---|---|
| paidAmount 列がない | 一部入金額が永続的に失われる |
| collectOutstandingPayment に collectedAmount がない | 部分回収が全額回収として処理される |
| unpaidTotal に残額でなく全額を使用 | 患者一覧・患者詳細の未収残高が過大表示される |
| DailySales の売上に一部入金は全額計上 | 日次売上集計が不正確になる |
| Run_Log detail のテキストに金額が埋め込み | 回収額の監査・再集計が fragile |

---

## 3. 保存すべきデータ項目案

| 項目 | 内容 | 保存タイミング |
|---|---|---|
| `totalTaxInc` | 請求総額（税込）| 会計入力時（既存）|
| `paidAmount` | 実際に入金された累積額 | 会計入力時・回収時に更新 |
| `remainingAmount` | 未収残額 = totalTaxInc - paidAmount | 計算値（保存不要）|
| 回収履歴 | いつ・いくら・どの手段で | 回収時（PaymentCollections か Run_Log）|

---

## 4. 実装案 A / B / C

### 案 A: Payments に paidAmount 列を追加

```
Payments シートの列を 10 → 11 列に拡張:
  col 11: paidAmount (実際の入金済み累積額)
```

**savePaymentWithItems** の変更:
- 一部入金の場合: `paidAmount = payload.paidAmount`（フォームから入力）
- 入金済の場合:   `paidAmount = totalTaxInc`（全額入金）
- 未収の場合:     `paidAmount = 0`

**collectOutstandingPayment** の変更:
- `collectedAmount = payload.collectedAmount`（フォームから入力）
- `paidAmount += collectedAmount`（累積更新）
- 全額回収 (`paidAmount >= totalTaxInc`) の場合: `paymentStatus → 入金済`
- 部分回収 (`paidAmount < totalTaxInc`) の場合: `paymentStatus → 一部入金` に戻す

**メリット:**
- スキーマ変更は1列のみ
- 既存データへの影響が最小
- remainingAmount = totalTaxInc - paidAmount で計算可能

**デメリット:**
- 複数回の部分回収履歴が残らない（累積値のみ）
- 会計監査で「いつ・いくら払ったか」の詳細が追えない

---

### 案 B: PaymentCollections 新規シート追加

```
新シート: PaymentCollections
  collectionId / paymentId / selfPayVisitKey / amount / method / date / memo
```

- Payments は「請求レコード」として変更なし（または paymentStatus のみ更新）
- 各回収イベントは PaymentCollections に1行追加
- 未収残高 = totalTaxInc - SUM(PaymentCollections.amount WHERE paymentId=xxx)

**メリット:**
- 完全な回収履歴が残る
- 外販・会計監査に最も対応しやすい
- 複数回分割払いを完全サポート

**デメリット:**
- 新シート追加・setupAll_ 更新・全 billing 関連関数の更新が必要
- データ取得クエリが JOIN を必要とし複雑化
- 実装コストが最大

---

### 案 C: Run_Log + Payments 最小拡張（推奨）

```
Payments: paidAmount 列を追加（案 A と同じ）
Run_Log:  PAYMENT_COLLECT の detail に structured な金額フィールドを追加
```

- Payments.paidAmount で現在の入金済み累積額を管理
- Run_Log の PAYMENT_COLLECT でいつ・いくら・誰が回収したかを記録
- Run_Log は監査ログとして機能（計算には使わない）

具体的な変更:
1. Payments に `paidAmount` を追加（案 A と同じ）
2. appendRunLog_ の detail に `"回収額: ¥N"` を引き続き使用
3. DailySales の paymentCollectTotal には `collectedAmount`（今回回収額）を使用

**メリット:**
- 案 A のシンプルさ + Run_Log による監査証跡
- DailySales が正確になる
- 実装コストが案 B より大幅に低い

**デメリット:**
- Run_Log の detail がテキスト形式のまま（parseが必要なケースは残る）
- 案 B より履歴の検索性が低い

---

## 5. 各案のメリット・デメリット比較

| 観点 | 案 A | 案 B | 案 C（推奨）|
|---|---|---|---|
| 実装コスト | 低 | 高 | 中 |
| 履歴の完全性 | 累積値のみ | ✅ 完全 | Run_Log に履歴 |
| 監査耐性 | △ | ✅ | ✅（Run_Log）|
| DailySales 正確性 | ✅ | ✅ | ✅ |
| 既存データ互換 | ✅ | △（新シート） | ✅ |
| 外販対応 | △ | ✅ | ○ |
| クエリ複雑度 | 低 | 高 | 低〜中 |

---

## 6. 推奨案

**案 C（Run_Log + Payments 最小拡張）を推奨する。**

理由:
1. 小規模クリニックの運用では案 B の複雑度は過剰
2. paidAmount 1列の追加で未収残高・DailySales の計算が正確になる
3. Run_Log による回収履歴は監査目的に十分
4. 将来、案 B に移行が必要になった場合でも基本ロジックを流用できる

---

## 7. 変更予定ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `JREC_SF01_Setup.gs` | `setupPayments_` に `paidAmount` 列ヘッダーを追加 |
| `JREC_SF01_Billing.gs` | `savePaymentWithItems`: `paidAmount` を保存 |
| `JREC_SF01_Billing.gs` | `collectOutstandingPayment`: `collectedAmount` 受取・`paidAmount` 累積更新 |
| `JREC_SF01_Billing.gs` | `getPatientAccountingData`: `outstanding = totalTaxInc - paidAmount` に修正 |
| `JREC_SF01_Billing.gs` | `getPatientListStats`: 同上 |
| `JREC_SF01_Billing.gs` | `getVisitForBilling` / `getReceiptByVisit`: `paidAmount` を返す |
| `billing-form.html` | 一部入金選択時に `paidAmount` 入力フィールドを追加 |
| `receipt.html` | 未収回収 UI に `collectedAmount` 入力フィールドを追加 |
| `receipt.html` | `remainingAmount = totalTaxInc - paidAmount` を表示 |
| `JREC_SF01_DailySales.gs` | `paymentSaveTotal`: 一部入金の場合 paidAmount を使用 |
| `JREC_SF01_DailySales.gs` | `paymentCollectTotal`: `collectedAmount` を使用 |

---

## 8. Payments シート列追加案

現在の10列から11列に拡張:

| 列 | 名前 | 内容 | 変更 |
|---|---|---|---|
| 1〜10 | 既存列 | — | 変更なし |
| 11 | paidAmount | 実際の入金済み累積額 | **新規追加** |

初期値ルール:
- 既存の `paymentStatus=入金済` 行: `paidAmount = totalTaxInc`（全額入金済みとして補完）
- 既存の `paymentStatus=未収` 行: `paidAmount = 0`
- 既存の `paymentStatus=一部入金` 行: `paidAmount = 0`（不明のため 0。要手動補正）

---

## 9. DailySales への影響

案 C 導入後の DailySales 変更:

| 集計値 | 現在 | 変更後 |
|---|---|---|
| paymentSaveTotal（一部入金）| totalTaxInc（全額）| paidAmount（実入金額）|
| paymentCollectTotal | totalTaxInc（全額）| collectedAmount（今回回収額）|
| unpaidTotal | totalTaxInc（一部入金も全額）| totalTaxInc - paidAmount（残額）|

**注意:** この変更により、過去の DailySales 集計値（現在保存済みの DailySales 行）は再計算が必要になる。`rebuildDailySales` で再実行すれば更新できる。

---

## 10. 実装前にユーザーへ確認すべき事項

| # | 確認事項 | 影響 |
|---|---|---|
| 1 | 一部入金後の残額は「同じ receipt 画面」から回収するか、または「新しい会計入力」を作るか | UI フローが変わる |
| 2 | 複数回分割払いを完全にサポートしたいか（案 B）、累積管理で十分か（案 C）| スキーマ規模が変わる |
| 3 | 一部入金時の受領書は発行するか（部分領収書）、全額入金後のみ発行するか | 領収書 UI・Receipts シートへの影響 |
| 4 | 既存の `paymentStatus=一部入金` のデータ（¥5,500 の案件）をどう補正するか | 移行処理が必要 |
| 5 | `billing-form.html` の一部入金選択時に「今回入金額」を入力させてよいか | UI 変更 |
| 6 | 入金が 0円（完全未払い）を「一部入金」ではなく「未収」と呼ぶべきか | paymentStatus の定義 |

---

## 11. リスク

| リスク | 内容 | 対策 |
|---|---|---|
| 既存データの paidAmount が不明 | 一部入金の過去データは paidAmount=0 として補完 | 手動で正しい金額を入力する手順を用意 |
| DailySales の過去値が変わる | paidAmount 導入後に rebuildDailySales を再実行すると過去の totalSales が変わる | 再計算前後を記録し、差分を管理 |
| billing-form.html の UI 複雑化 | 一部入金時のみ入力フィールドが増える | 一部入金選択時のみ表示する条件付き UI |
| 二重回収の定義が変わる | 現在は「入金済への更新を1回だけ」。部分回収複数回対応後は「totalTaxInc = SUM(collections) で判定」 | paidAmount >= totalTaxInc を全額回収の条件にする |
| 外販時の互換性 | paidAmount 列を追加すると、外販先が旧 setupAll_ を使っている場合に列ズレが発生 | setupAll_ の再実行手順書を整備 |

---

## 12. Dashboard / Projects / Task_Queue / Run_Log への追加反映

**今回は不要。理由:**
- paidAmount は Payments シートの純粋な会計データ拡張
- Run_Log の PAYMENT_COLLECT には既に詳細が記録される
- DailySales は rebuildDailySales で再計算可能
- 外部 Dashboard との連携は実装確定後に検討する

---

## 13. 次の実装プロンプト案

```
Phase 5-B Step 1: Payments paidAmount 列追加と savePaymentWithItems 修正

対象:
1. JREC_SF01_Setup.gs の setupPayments_ に paidAmount 列を追加
2. JREC_SF01_Billing.gs の savePaymentWithItems に paidAmount 引数追加
3. billing-form.html の一部入金選択時に paidAmount 入力フィールドを追加
4. getPatientAccountingData / getPatientListStats の outstanding 計算を修正

今回は実装しないこと:
- collectOutstandingPayment の collectedAmount（次のステップ）
- 領収書の部分発行
- 既存データの補正スクリプト

参照: docs/PARTIAL_PAYMENT_DESIGN.md（設計調査書）
```

---

## 変更履歴

| 日付 | 内容 |
|---|---|
| 2026-04-28 | 初版作成。設計調査 → 推奨案 C（案 C: Run_Log + Payments 最小拡張）を確定 |
