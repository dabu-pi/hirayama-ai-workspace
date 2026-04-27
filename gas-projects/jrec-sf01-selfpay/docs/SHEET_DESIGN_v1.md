# JREC-SF01 シート設計書 v1

**作成日:** 2026-04-27
**バージョン:** v1.0
**ステータス:** 確定（実装前最終仕様）
**参照元:** `hirayama-jyusei-strategy/menu/pricing-v2-update-2026-04-25.md`

---

## 1. 確定方針（設計の前提）

### 1-1. 消費税

| 項目 | 決定値 | 根拠 |
|---|---|---|
| 税率 | **10%** | 柔整の自費施術は消費税課税対象（保険外のため非課税にならない）|
| 価格管理 | **税別管理** | `pricing-v2-update-2026-04-25.md` で確定済み。全価格は税別で保持する |
| 患者向け表示 | 税込で表示 | 領収書・会計画面はすべて税込金額を表示する |
| 端数処理 | **切り捨て（floor）** | 消費税計算後の端数は切り捨て。Settings で変更可 |
| 計算式 | `小計(税込) = floor(単価(税別) × 数量 × 1.10)` | 明細行ごとに計算する |

**例：**
```
継続標準施術 1回: 3,500円 × 1.10 = 3,850円（端数なし）
メンテナンス施術 1回: 2,500円 × 1.10 = 2,750円（端数なし）
```

### 1-2. 患者ID

| 項目 | 決定値 |
|---|---|
| フォーマット | `P` + 4桁ゼロ埋め連番 |
| 例 | P0001, P0002, ... P9999 |
| 採番方式 | `Patients` シートの最終行の patientId から自動インクリメント |
| JREC本体との紐づけ | 任意。同一患者の場合は `jrecPatientId` カラムに保険JREC側IDを記録する |
| 上限 | P9999（9,999人）。超えた場合は P5桁以上への拡張で対応 |

### 1-3. ジム会員割引

**廃止（2026-04-25 院長判断）。** MenuMaster にジム会員価格列は持たない。通常価格（税別）のみで運用する。

### 1-4. 主要ID体系

| ID種別 | フォーマット | 例 | 生成タイミング |
|---|---|---|---|
| patientId | `P` + 4桁 | `P0001` | 患者登録時 |
| selfPayVisitKey | `SPV_YYYYMMDD_patientId_3桁連番` | `SPV_20260427_P0001_001` | 来院登録時 |
| chartId | `SPC_YYYYMMDD_patientId_3桁連番` | `SPC_20260427_P0001_001` | カルテ保存時 |
| itemId | `SPI_selfPayVisitKey_3桁連番` | `SPI_SPV_20260427_P0001_001_001` | 会計明細保存時 |
| paymentId | `SPP_selfPayVisitKey` | `SPP_SPV_20260427_P0001_001` | 支払登録時（来院1件に1支払）|
| receiptId | `SPR_YYYY_4桁通し連番` | `SPR_2026_0001` | 領収書発行時 |

---

## 2. MenuMaster 初期データ

### 2-1. カテゴリ定義

| カテゴリコード | 表示名 | 説明 |
|---|---|---|
| `主力` | 主力自費メニュー | 患者向けの主力3メニュー。単体で完結する |
| `個別パーツ` | 自費個別パーツ | 主力メニューの内訳・追加時に使う個別パーツ |
| `評価入口` | 保険外評価入口 | 症状別初回評価メニュー（保険→自費への導線）|
| `特別対応` | 特別対応/保留 | 現在主力ではないが残すメニュー |
| `運動再教育` | 運動再教育・卒業設計 | パーソナル・コース系 |

### 2-2. MenuMaster 初期データ一覧

#### 主力自費メニュー（有効・確定）

| menuCode | メニュー名 | 標準時間(分) | 税別価格 | 税込価格(参考) | カテゴリ | 有効 | 表示順 | 備考 |
|---|---|---|---|---|---|---|---|---|
| SELFPAY_INITIAL_FULL | 初回標準施術 | 48 | 5,000 | 5,500 | 主力 | TRUE | 10 | 初回のみ。初診料込みのフルパッケージ |
| SELFPAY_CONTINUE20 | 継続標準施術 | 33 | 3,500 | 3,850 | 主力 | TRUE | 20 | **主力（KPI基準単価）**。物療2種+手技 |
| SELFPAY_MAINT15 | メンテナンス施術 | 23 | 2,500 | 2,750 | 主力 | TRUE | 30 | 軽度症状・維持管理向け |

#### 自費個別パーツ（有効・確定）

| menuCode | メニュー名 | 標準時間(分) | 税別価格 | 税込価格(参考) | カテゴリ | 有効 | 表示順 | 備考 |
|---|---|---|---|---|---|---|---|---|
| SELFPAY_FIRST_FEE15 | 初診料 | 15 | 1,500 | 1,650 | 個別パーツ | TRUE | 40 | 初回標準施術に含む |
| SELFPAY_IFC10 | 干渉波 | 10 | 1,000 | 1,100 | 個別パーツ | TRUE | 50 | — |
| SELFPAY_MICROCURRENT | マイクロカレント | 10 | 1,000 | 1,100 | 個別パーツ | TRUE | 60 | — |
| SELFPAY_HIGHVOLTAGE | ハイボルテージ | 5 | 500 | 550 | 個別パーツ | TRUE | 70 | 2026-04-25 価格1,000→500に訂正 |
| SELFPAY_ULTRASOUND | 超音波 | 5 | 500 | 550 | 個別パーツ | TRUE | 80 | — |
| SELFPAY_MANUAL3 | 手技 | 3 | 500 | 550 | 個別パーツ | TRUE | 90 | 軟膏塗布込み対応可 |

#### 評価入口（有効・一旦TRUE・要現場確認）

| menuCode | メニュー名 | 標準時間(分) | 税別価格 | 税込価格(参考) | カテゴリ | 有効 | 表示順 | 備考 |
|---|---|---|---|---|---|---|---|---|
| SELFPAY_EVAL_LOWBACK30 | 腰痛改善 運動療法 初回評価 | 30 | 3,300 | 3,630 | 評価入口 | TRUE | 100 | 初回限定。導線商品。※要現場確認 |
| SELFPAY_EVAL_NECKSHOULDER30 | 首肩こり改善 運動療法 初回評価 | 30 | 3,300 | 3,630 | 評価入口 | TRUE | 110 | 同上 |
| SELFPAY_EVAL_KNEE30 | 膝改善 運動療法 初回評価 | 30 | 3,300 | 3,630 | 評価入口 | TRUE | 120 | 同上 |

> **⚠️ 要確認:** 評価入口3メニューは `pricing-v2-update-2026-04-25.md` で「現在受付・広告で使っているか不明」として要確認中。院長が実際に使っている場合は TRUE のまま、使っていない場合は FALSE に変更する。

#### 特別対応・保留・運動再教育（有効フラグ=FALSE）

| menuCode | メニュー名 | 標準時間(分) | 税別価格 | 税込価格(参考) | カテゴリ | 有効 | 表示順 | 備考 |
|---|---|---|---|---|---|---|---|---|
| SELFPAY_CHRONIC50 | 慢性ケア手技50分 | 50 | 5,500 | 6,050 | 特別対応 | FALSE | 200 | 特別対応/保留。主力フラグ外れ済み |
| SELFPAY_PT60 | パーソナルトレーニング | 60 | 8,800 | 9,680 | 運動再教育 | FALSE | 210 | 要確認。実運用中なら TRUE に変更 |
| TRAINING_4PASS | 4回集中コース | 240 | 35,200 | 38,720 | 運動再教育 | FALSE | 220 | 価格見直し保留中 |

### 2-3. MenuMaster カラム定義

| カラム名 | 型 | 必須 | 説明 |
|---|---|---|---|
| menuCode | string | ○ | メニューコード（主キー）。既存の menu_id をそのまま使う |
| メニュー名 | string | ○ | 患者・施術者向け表示名 |
| 標準時間 | integer | — | 施術の標準時間（分）。0=時間なし |
| 税別価格 | integer | ○ | 税別価格（円）。0=無料 |
| 税込価格 | integer | — | 参照用。実際の計算は `税別価格 × 1.10` で行う |
| カテゴリ | string | ○ | カテゴリコード（主力/個別パーツ/評価入口/特別対応/運動再教育）|
| 有効フラグ | boolean | ○ | TRUE=現在提供中。FALSE の場合は入力画面に表示しない |
| 表示順 | integer | ○ | 入力画面・選択UIでの表示順 |
| 備考 | string | — | 特記事項・変更履歴メモ |

---

## 3. Settings シート

システム設定をすべて Settings シートで一元管理する。コード内にハードコードしない。

| key | value | 説明 |
|---|---|---|
| clinic_name | 平山接骨院 | 院名（領収書・画面タイトル用）|
| tax_rate | 0.10 | 消費税率（10%）|
| tax_rounding | floor | 端数処理（floor=切り捨て / round=四捨五入 / ceil=切り上げ）|
| tax_unit | item | 税計算単位（item=明細行ごと / total=合計一括）|
| patient_id_prefix | P | 患者IDプレフィックス |
| patient_id_digits | 4 | 患者ID連番の桁数 |
| receipt_no_prefix | R | 領収書番号プレフィックス |
| receipt_no_digits | 4 | 領収書番号の桁数 |
| receipt_no_reset | yearly | 領収書番号リセット単位（yearly=年度ごと / never=リセットなし）|
| default_tax_category | 課税 | 会計明細のデフォルト税区分 |
| selfpay_spreadsheet_id | （スプレッドシートIDを設定）| 本スプレッドシートのID（自己参照）|
| version | 1.0 | 設定バージョン |

---

## 4. Patients シート

| # | カラム名 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| 1 | patientId | string | ○ | 自費患者ID（P0001形式）。主キー |
| 2 | 氏名 | string | ○ | 患者氏名 |
| 3 | フリガナ | string | ○ | カタカナ読み仮名 |
| 4 | 生年月日 | date | — | YYYY-MM-DD形式 |
| 5 | 性別 | string | — | 男性 / 女性 / その他 |
| 6 | 電話番号 | string | ○ | 主連絡先電話番号 |
| 7 | 住所 | string | — | 住所（任意）|
| 8 | 備考 | string | — | アレルギー・注意事項など |
| 9 | jrecPatientId | string | — | JREC本体（保険）側の患者ID。同一患者の場合のみ記録 |
| 10 | createdAt | datetime | ○ | 登録日時（自動）|
| 11 | updatedAt | datetime | ○ | 最終更新日時（自動）|

---

## 5. SelfPayVisits シート

1行 = 1来院。カルテ・明細・支払はすべてこの selfPayVisitKey で紐づく。

| # | カラム名 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| 1 | selfPayVisitKey | string | ○ | 来院キー（主キー）。`SPV_YYYYMMDD_patientId_3桁連番` |
| 2 | patientId | string | ○ | 患者ID（外部キー → Patients）|
| 3 | 来院日 | date | ○ | 施術日（YYYY-MM-DD）|
| 4 | 来院区分 | string | ○ | 初診 / 再診 |
| 5 | 担当者 | string | ○ | 施術担当者名 |
| 6 | 主訴 | string | ○ | 患者が訴える主な症状 |
| 7 | VAS | integer | — | 痛み評価（0〜10）。0=痛みなし |
| 8 | 次回方針 | string | — | 次回の施術方針・提案内容 |
| 9 | 会計状態 | string | ○ | 未会計 / 会計済 / 未収 |
| 10 | createdAt | datetime | ○ | 登録日時（自動）|
| 11 | updatedAt | datetime | ○ | 最終更新日時（自動）|

---

## 6. SelfPayChart シート

1行 = 1来院のカルテ。selfPayVisitKey と 1対1 対応。

| # | カラム名 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| 1 | chartId | string | ○ | カルテID（主キー）。`SPC_YYYYMMDD_patientId_3桁連番` |
| 2 | selfPayVisitKey | string | ○ | 来院キー（外部キー → SelfPayVisits）|
| 3 | 評価 | string | — | 身体評価・機能評価の記録 |
| 4 | 所見 | string | — | 施術者所見 |
| 5 | 施術内容 | string | ○ | 実施した施術の詳細 |
| 6 | 使用機器 | string | — | 使用した機器・器具（複数の場合はカンマ区切り）|
| 7 | 説明内容 | string | — | 患者への説明内容 |
| 8 | 禁忌確認 | string | — | 禁忌事項の確認状況（確認済 / 該当なし等）|
| 9 | 生活指導 | string | — | 生活指導・セルフケア内容 |
| 10 | 次回予定 | string | — | 次回施術の予定・目標 |
| 11 | createdAt | datetime | ○ | 登録日時（自動）|
| 12 | updatedAt | datetime | ○ | 最終更新日時（自動）|

---

## 7. SelfPayItems シート

1行 = 1明細。1来院に複数行。

| # | カラム名 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| 1 | itemId | string | ○ | 明細ID（主キー）。`SPI_selfPayVisitKey_3桁連番` |
| 2 | selfPayVisitKey | string | ○ | 来院キー（外部キー）|
| 3 | menuCode | string | ○ | メニューコード（MenuMaster.menuCode 参照）|
| 4 | メニュー名 | string | ○ | メニュー名スナップショット（変更時の履歴保全用）|
| 5 | 数量 | integer | ○ | 数量（通常1）|
| 6 | 単価（税別）| integer | ○ | 税別単価（MenuMaster.税別価格をコピー）|
| 7 | 税区分 | string | ○ | 課税 / 非課税（デフォルト: Settings の default_tax_category）|
| 8 | 小計（税別）| integer | ○ | `単価(税別) × 数量`（自動計算）|
| 9 | 消費税額 | integer | ○ | `floor(小計(税別) × 税率)`（自動計算）|
| 10 | 小計（税込）| integer | ○ | `小計(税別) + 消費税額`（自動計算）|
| 11 | createdAt | datetime | ○ | 登録日時（自動）|

---

## 8. Payments シート

1行 = 1来院の支払記録（来院と 1対1）。

| # | カラム名 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| 1 | paymentId | string | ○ | 支払ID（主キー）。`SPP_selfPayVisitKey` |
| 2 | selfPayVisitKey | string | ○ | 来院キー（外部キー）|
| 3 | 税別合計 | integer | ○ | `SUM(SelfPayItems.小計(税別))` |
| 4 | 消費税額合計 | integer | ○ | `SUM(SelfPayItems.消費税額)` |
| 5 | 税込合計 | integer | ○ | `税別合計 + 消費税額合計` |
| 6 | 支払方法 | string | ○ | 現金 / カード / 電子マネー / 未収 |
| 7 | 入金状態 | string | ○ | 入金済 / 未収 / 一部入金 |
| 8 | 入金日 | date | — | 実際の入金日（未収の場合は空欄）|
| 9 | メモ | string | — | 備考・特記事項 |
| 10 | createdAt | datetime | ○ | 登録日時（自動）|

---

## 9. Receipts シート

| # | カラム名 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| 1 | receiptId | string | ○ | 領収書ID（主キー）。`SPR_YYYY_4桁連番`（例: SPR_2026_0001）|
| 2 | selfPayVisitKey | string | ○ | 来院キー（外部キー）|
| 3 | receiptNo | string | ○ | 領収書番号（表示用）。`receiptId` と同値 |
| 4 | 発行日 | date | ○ | 領収書発行日 |
| 5 | 宛名 | string | ○ | 宛名（氏名 または 指定名義）|
| 6 | 金額（税込）| integer | ○ | 領収金額（税込）|
| 7 | 消費税額 | integer | ○ | 内消費税額 |
| 8 | 但し書き | string | ○ | 但し書き（例: 施術費として）|
| 9 | 再発行回数 | integer | ○ | 再発行した回数（0=初回発行）|
| 10 | createdAt | datetime | ○ | 発行日時（自動）|

---

## 10. DailySales シート

| # | カラム名 | 型 | 必須 | 説明 |
|---|---|---|---|---|
| 1 | 日付 | date | ○ | 集計日 |
| 2 | 来院数 | integer | ○ | 当日の自費来院件数 |
| 3 | 売上合計（税込）| integer | ○ | 当日の自費売上合計（税込）|
| 4 | 売上合計（税別）| integer | ○ | 当日の自費売上合計（税別）|
| 5 | 消費税合計 | integer | ○ | 当日の消費税合計 |
| 6 | 未収発生額 | integer | ○ | 当日発生の未収合計（税込）|
| 7 | 未収回収額 | integer | ○ | 当日回収した未収合計（税込）|
| 8 | 主力来院数 | integer | — | SELFPAY_CONTINUE20 の来院件数（KPI用）|
| 9 | 備考 | string | — | 特記事項 |

> **主力来院数** は KPI `継続標準施術（3,500円）の月40回` 達成管理に使う。

---

## 11. Run_Log シート

GASの処理ログ。障害調査・監査用。

| # | カラム名 | 型 | 説明 |
|---|---|---|---|
| 1 | timestamp | datetime | 実行日時 |
| 2 | action | string | 処理内容（例: VISIT_CREATE / PAYMENT_SAVE）|
| 3 | selfPayVisitKey | string | 対象来院キー（なければ空欄）|
| 4 | patientId | string | 対象患者ID（なければ空欄）|
| 5 | result | string | SUCCESS / ERROR |
| 6 | detail | string | 詳細メッセージ |
| 7 | operator | string | 操作者（担当者名）|

---

## 12. シート間の関係図

```
MenuMaster
    ↑ menuCode 参照
SelfPayItems
    ↑ selfPayVisitKey 外部キー
SelfPayVisits ←── selfPayVisitKey ──→ SelfPayChart
    ↑ selfPayVisitKey 外部キー          （1対1）
    ├── SelfPayItems（1対多）
    ├── Payments（1対1）
    └── Receipts（1対1）

Patients
    ↑ patientId 外部キー
SelfPayVisits

Settings（全シートから参照）
DailySales（SelfPayItems・Payments から日次集計）
Run_Log（全処理から追記）
```

---

## 13. 入力フローと状態遷移

```
①来院登録（SelfPayVisits作成）
    ↓
②カルテ記録（SelfPayChart作成）
    ↓
③会計明細入力（SelfPayItems作成）
    ↓
④支払処理（Payments作成）
    SelfPayVisits.会計状態 → 入金済 / 未収 に更新
    ↓
⑤領収書発行（Receipts作成）
    ↓
⑥日次集計（DailySales更新）
```

---

## 14. 未確定事項（次フェーズで確定）

| # | 項目 | 現状 | 確認方法 |
|---|---|---|---|
| 1 | 評価入口3メニューの運用状況 | 要確認（策略シートで非表示中）| 院長に実運用確認。使っていれば有効フラグ=TRUE のまま |
| 2 | パーソナルトレーニング（SELFPAY_PT60）の運用状況 | 要確認（非表示中）| 院長に確認。実運用中なら有効フラグ=TRUE に変更 |
| 3 | TRAINING_4PASS の価格 | 保留（価格見直し必須）| 院長が価格決定後に更新 |
| 4 | 4回集中コースの支払方法 | 未設計 | 分割払い対応が必要か確認 |
| 5 | 未収の督促フロー | 未設計 | Phase 4（会計・領収書）で設計 |

---

## 変更履歴

| 日付 | バージョン | 変更内容 |
|---|---|---|
| 2026-04-27 | v1.0 | 初版作成。`pricing-v2-update-2026-04-25.md` を参照して MenuMaster 初期データ・税設計・ID設計・全シート定義を確定 |
