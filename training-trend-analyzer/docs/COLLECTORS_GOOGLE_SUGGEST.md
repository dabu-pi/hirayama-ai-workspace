# COLLECTORS_GOOGLE_SUGGEST.md

最終更新: 2026-04-08

## 役割

Google Suggest collector は、Google Trends を補完する軽量検索補完ソースです。

目的:

- GT の相対指数だけに依存しない
- 同じ seed 群から再利用できる第 2 ソースを持つ
- live が難しい環境でも mock fixture で再確認できるようにする

この collector は GT の代替ではなく、低ウェイト補助指標として使います。

## 対象ファイル

- `src/collectors/google_suggest.py`
- `scripts/run_google_suggest.py`
- `data/mock/google_suggest/jp_seed_fixture.json`
- `tests/test_google_suggest_collector.py`

## 取得元

初版では Google Suggest / autocomplete 系 endpoint を少数 query で利用します。

運用上の注意:

- 非公式 endpoint 依存なので、仕様変更や応答形式変更の可能性がある
- 大量 query を投げない
- 過度なスクレイピング用途には広げない
- mock fixture を常に維持し、live 不可でも再確認できるようにする

## mode

### `mock`

- fixture から deterministic に再現する
- 回帰確認や test に使う

### `live`

- 少数 seed だけを実行する
- raw / observation / import-ready を必ず残す
- 失敗しても batch status と artifact を残す

### `auto`

- 初版では必須ではないが、将来 live 優先 fallback の整理対象
- 現時点の運用は `live` と `mock` を明示的に使い分ける方針

## seed の扱い

seed は `config/trends/seed_queries.json` を再利用します。

初版の import-ready 対象:

- `seed_type=model`
- `emit_to_source_metrics=true`

初版で ranking に入れないもの:

- category seed
- compare seed

理由:

- suggest は一般語や比較語の影響を受けやすい
- model seed の方が canonical へ安全に結び付きやすい

## metric

### `search_suggest_count`

- query ごとの有効 suggestion 件数の平均
- 有効 suggestion:
  - 空文字でない
  - query 文字列そのものと完全一致でない
- ranking に入れる対象

### `search_suggest_presence`

- suggestion が 1 件以上あったかの補助フラグ
- raw / import では保持する
- 初版では ranking へ入れない

## 出力

### raw JSON

- path: `data/collected/google_suggest/raw/`
- 内容:
  - seed ごとの query 実行結果
  - status
  - error
  - collection mode

### observation CSV

- path: `data/collected/google_suggest/observations/`
- 内容:
  - collected_date
  - source_name
  - raw_name
  - query_term
  - suggestion_text
  - suggestion_rank
  - metric_type
  - metric_value
  - geo / language
  - collection_mode
  - source_url / query context

### import-ready CSV

- path: `data/collected/google_suggest/import/`
- 内容:
  - model seed / week / metric 単位の集約値
  - `sample_size`
  - `metadata_json`
  - `seed_id`
  - `canonical_target`
  - `collection_mode`

## `source_metrics` 接続

`scripts/run_google_suggest.py --import-db` で import-ready CSV を `source_metrics` へ流します。

再投入時の考え方:

- 生データは raw / observation / import-ready で残す
- `--replace-existing` で対象 metric を安全に差し替えやすくする
- import batch 単位で追跡できる

## ranking での扱い

初版では `search_suggest_count` のみ score に使います。

安全策:

- base weight は小さくする
- `min_query_terms` を要求する
- `min_value` を要求する
- normalized contribution に cap をかける
- `search_suggest_presence` は score に使わない
- 軽量検索系 metric だけで `change_rate` を作らない

## live / mock 検証

確認済み:

- mock:
  - 4 seed で `observations=28`, `import_rows=8`
- live:
  - 2 seed で `observations=39`, `import_rows=4`

mock と live は raw / observation / import-ready の形式を揃えています。

## 制約

- suggestion 件数は需要そのものではない
- query 設計の影響を受けやすい
- 一般語やブランド一般語では誤判定しやすい
- endpoint の応答形式が変わる可能性がある

## 次アクション

1. 第 3 ソース候補を追加して、GT と Suggest の偏りをさらに分散する
2. Suggest seed を model 中心に整理し、0 件や一般語混入を減らす
3. compare / category seed の raw 解釈レイヤを別設計する
