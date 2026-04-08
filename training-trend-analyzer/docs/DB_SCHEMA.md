# DB_SCHEMA.md

最終更新: 2026-04-08

## 主なテーブル

| テーブル | 役割 |
|---|---|
| `brands` | canonical brand master |
| `categories` | canonical category master |
| `models` | canonical model master |
| `aliases` | normalizer が参照する alias |
| `sources` | source master |
| `source_metrics` | source ごとの週次 metric |
| `trend_scores` | 週次ランキング結果 |
| `unclassified_queue` | unresolved / review キュー |
| `import_batches` | import batch 追跡 |

## `source_metrics`

collector や CSV import の最終投入先です。Google Trends / Google Suggest / YouTube Suggest の import-ready CSV はここへ流れます。

主なカラム:

| カラム | 説明 |
|---|---|
| `source_id` | `sources.name` から解決した source |
| `model_id` | canonical model |
| `brand_id` | canonical brand |
| `week_start` | 集計週の開始日 |
| `metric_type` | metric 名 |
| `value` | 集計済み metric 値 |
| `sample_size` | その値に使った query 数や観測件数 |
| `raw_data` | import 時の metadata JSON |
| `raw_input` | import-ready CSV 行の JSON |
| `import_batch_id` | import batch 追跡 |
| `review_status` | `ok` / `review` / `skipped` |

## 現在の主要 `metric_type`

- `search_volume`
- `google_trends_interest`
- `search_suggest_count`
- `search_suggest_presence`
- `youtube_suggest_count`
- `youtube_suggest_presence`
- `mention_count`
- `review_count`
- `avg_rating`
- `media_count`
- `inquiry_count`
- `price_index`

## Google Trends metric

### `google_trends_interest`

- Google Trends の相対指数
- import-ready では model seed のみを `source_metrics` へ流す
- compare / category seed は raw artifact 側に保持する
- `sample_size` には集計に使った query term 数を入れる
- `raw_data` / `raw_input` には `seed_id`, `query_group`, `timeframe`, `geo`, `collection_mode` などを残す

## Google Suggest metric

### `search_suggest_count`

- query ごとの有効 suggestion 件数の平均
- ranking に入れる対象
- 初版では model seed のみ import-ready へ流す
- `sample_size` には試行した query term 数を入れる
- `raw_data` / `raw_input` に `suggestion_count_by_query`, `query_terms`, `seed_id`, `collection_mode` を保持する

### `search_suggest_presence`

- suggestion が 1 件以上あったかの補助フラグ
- raw / import 保持用
- 初版では `score_weights.json` に weight を持たせず、ranking には使わない

## YouTube Suggest metric

### `youtube_suggest_count`

- query ごとの有効 suggestion 件数の平均
- ranking に入れる対象
- 初版では model seed のみ import-ready へ流す
- `sample_size` には試行した query term 数を入れる
- `raw_data` / `raw_input` に `suggestion_count_by_query`, `query_terms`, `seed_id`, `collection_mode`, `endpoint_family` を保持する

### `youtube_suggest_presence`

- suggestion が 1 件以上あったかの補助フラグ
- raw / import 保持用
- 初版では `score_weights.json` に weight を持たせず、ranking には使わない

## import-ready CSV の補助列

collector から import-ready CSV へ残す代表列:

- `query_term`
- `seed_id`
- `seed_label`
- `seed_type`
- `query_group`
- `timeframe`
- `geo`
- `language`
- `collection_mode`
- `canonical_target`
- `sample_size`
- `metadata_json`
- `week_start`
- `suggestion_text`
- `suggestion_rank`

## raw / observation / import の分離

### raw JSON

- live / mock のレスポンスや status を保持する
- 失敗時も artifact を残す

### observation CSV

- query 単位、または suggestion 単位の観測を残す
- Google / YouTube Suggest では suggestion text と rank を保持する

### import-ready CSV

- model seed / week / metric に集約した投入用データ
- duplicate 回避や再投入のために collector とは分離して保存する

## schema 上の注意

- 検索系 metric は補助指標であり、`value` を絶対需要と見なさない
- `source_name=google_trends` や `source_name=google_suggest` で絞るより、必要に応じて `metric_type` でも絞って検証する
- `sample_size` と `raw_data` を見れば、観測不足や source 固有の癖を後から追いやすい
