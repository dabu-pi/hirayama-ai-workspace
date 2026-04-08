# IMPORT_PIPELINE.md — CSV インポートパイプライン仕様

## 概要

`scripts/import_csv.py` は収集データ CSV を読み込み、正規化・バリデーションを経て
`source_metrics` テーブルに投入するパイプライン。
解決できない行は `unclassified_queue` に保留し、`data/review/` にレビュー用 CSV を書き出す。

---

## CSV フォーマット仕様

### 必須列

| 列名 | 型 | 説明 |
|---|---|---|
| `collected_date` | YYYY-MM-DD | 収集日（週に変換して week_start を計算） |
| `source_name` | text | データソース名（例: google_trends, amazon_jp） |
| `metric_type` | text | 指標種別（下表参照） |
| `metric_value` | 数値 | 指標値 |

### 任意列

| 列名 | 型 | 説明 |
|---|---|---|
| `raw_brand` | text | ブランド名の生テキスト |
| `raw_category` | text | カテゴリの生テキスト |
| `raw_name` | text | 製品名の生テキスト（優先） |
| `region` | text | 地域コード（例: jp） |
| `note` | text | 備考 |
| `source_url` | text | データ元URL |
| `country` | text | 国コード |
| `language` | text | 言語コード |

> **raw_brand / raw_name / raw_category のどれか1つ以上が必要**

### metric_type 正規化マップ

| 入力値 | 正規化後 |
|---|---|
| search_volume, search, 検索ボリューム | search_volume |
| mention_count, mention, 言及数 | mention_count |
| review_count, review, レビュー数 | review_count |
| avg_rating, rating, 評価 | avg_rating |
| media_count, media, メディア掲載 | media_count |
| inquiry_count, inquiry, 問い合わせ | inquiry_count |

---

## 実行方法

```bash
# 投入件数のみ確認（DB書き込みなし）
python scripts/import_csv.py --file data/import/sample_metrics.csv --dry-run

# 実際に投入
python scripts/import_csv.py --file data/import/sample_metrics.csv

# 家庭用ブランドを除外
python scripts/import_csv.py --file data/import/sample_metrics.csv --only-commercial

# 未解決行をスキップ（レビューキューに入れない）
python scripts/import_csv.py --file data/import/sample_metrics.csv --skip-unresolved

# エラー行で即停止
python scripts/import_csv.py --file data/import/sample_metrics.csv --strict
```

---

## 処理フロー

```
CSV 行
  ↓
1. バリデーション（必須列・日付形式・metric_value 数値チェック）
  ↓ エラー → cnt_error（--strict なら即停止）
2. metric_type 正規化
  ↓
3. week_start 計算（collected_date の週月曜日に変換）
  ↓
4. 正規化エンジン（NormalizerEngine）
   - NFKC 正規化（全角→半角）
   - ブランド解決（alias / canonical / hint_brand）
   - カテゴリ解決
   - モデル解決
  ↓
5. use_type フィルタ（--only-commercial 時に consumer ブランド除外）
  ↓
6. 信頼度チェック（LOW / UNKNOWN → REVIEW）
  ↓ REVIEW → unclassified_queue + review CSV
7. discontinued チェック（廃番モデル → REVIEW）
  ↓
8. 重複チェック（同 source / model / week_start / metric_type → SKIP）
  ↓
9. source_metrics INSERT
```

---

## 解決戦略: raw_name / raw_brand の使い分け

| パターン | raw_name | raw_brand | 処理 |
|---|---|---|---|
| 複合形（ブランド+モデル） | "TECHNOGYM RUN" | "TECHNOGYM" | raw_name をメインテキストに使用 |
| モデル名のみ | "TRM445" | "Precor" | raw_name をメインテキストに使用し raw_brand を hint として渡す |
| ブランド名のみ | "" | "Matrix" | raw_brand をメインテキストに使用 |
| カテゴリのみ | "" | "" | raw_category をメインテキストに使用 |

### hint_brand の補完ロジック

raw_name がモデル名のみ（ブランドが含まれない）場合でも、
`hint_brand = raw_brand` をエンジンに渡すことでブランドを解決する。

```python
brand_hint_raw = raw_brand if raw_brand and raw_text != raw_brand else None
norm = engine.normalize(raw_text, hint_brand=brand_hint_raw)
```

---

## レビュー行の処理

### 未解決になる条件

| 条件 | review_reason |
|---|---|
| 信頼度 LOW / UNKNOWN | 「信頼度 {label}（{confidence}）」 |
| ブランド未登録 | 「ブランド '{name}' がDBに未登録」 |
| 廃番モデル | 「廃番モデル: {brand} {model}」 |
| 正規化完全不能 | 「No match found for: '{text}'」 |

### unclassified_queue に保存されるフィールド

- `raw_text`: 正規化エンジンに渡したテキスト
- `raw_brand`, `raw_category`, `raw_name`: CSV の生値
- `certainty_label`, `unresolved_reason`: 解決状況
- `metric_type`, `metric_value`, `week_start`: 指標データ
- `import_batch_id`: バッチ追跡用
- `file_row_num`: CSV の行番号

### レビュー CSV の構造

`data/review/{batch_id}_review.csv` に書き出す。

| 列 | 説明 |
|---|---|
| `file_row_num` | CSV 行番号 |
| `review_reason` | レビューが必要な理由 |
| `certainty_label` | 信頼度ラベル |
| `norm_brand` / `norm_model` / `norm_category` | 推定された正規化値 |
| `action` | 人が記入: `ok` / `ignore` / `remap:BRAND::MODEL` |

---

## バッチ管理（import_batches テーブル）

実行のたびに `batch_id`（`YYYYMMDD_HHMMSS_{filename}`）でバッチを追跡する。

| 列 | 内容 |
|---|---|
| `batch_id` | 一意なバッチ識別子 |
| `file_name` | 取り込んだCSVファイル名 |
| `rows_total` / `rows_ok` / `rows_review` / `rows_skipped` / `rows_error` | 行数集計 |
| `is_dry_run` | dry-run フラグ |

---

## 重複検知ルール

同一の（source_id, model_id, brand_id, week_start, metric_type）組み合わせが既に存在する場合はスキップ。
`source_metrics` の `INSERT OR IGNORE` も二重保険として動作する。

---

## 全角表記への対応

NFKC 正規化により `ＴＥＣＨＮＯＧＹＭ　ＲＵＮ`（全角）→ `TECHNOGYM RUN`（半角）に変換してから解決する。

---

## サンプルドライラン結果（sample_metrics.csv 20行）

```
合計=20  OK=16  レビュー=4  スキップ=0  エラー=0

REVIEW 内訳:
- 廃番モデル: TECHNOGYM ARTIS Run
- ブランド不明: 謎のランニングマシンX（brand なし）
- 未登録ブランド: XYZ FITNESS PRO 3000
- 不完全行: brand も name も空
```

2回目インポート時（重複あり）:
```
合計=20  OK=0  レビュー=4  スキップ=16  エラー=0
```
