# COLLECTORS_YOUTUBE_SUGGEST.md

最終更新: 2026-04-08

## 役割

YouTube Suggest collector は、Google Trends と Google Suggest に続く第 3 の軽量補助ソースです。

目的:

- GT の相対指数偏重をさらに薄める
- Google Suggest と似た query 再利用性を持たせる
- 動画検索・レビュー視聴寄りの補助需要を小さく拾う

この collector は順位を大きく動かす主ソースではなく、低ウェイト補助寄与に留めます。

## 対象ファイル

- `src/collectors/youtube_suggest.py`
- `src/collectors/suggest_common.py`
- `scripts/run_youtube_suggest.py`
- `data/mock/youtube_suggest/jp_seed_fixture.json`
- `tests/test_youtube_suggest_collector.py`

## 取得元

初版では YouTube 専用データセット `ds=yt` を使った suggestqueries endpoint を少数 query で利用します。

実装メモ:

- dataset: `ds=yt`
- transport: `client=firefox`
- endpoint: `https://suggestqueries.google.com/complete/search`

`client=youtube` では JSON でない応答にぶつかる場合があったため、初版は JSON 取得しやすい `client=firefox` を採用しています。

## 制約

- 非公式 endpoint 依存
- 応答形式変更の可能性あり
- 大量 query 前提にしない
- 動画タイトルやレビュー文脈の影響を受けやすい
- mock fixture を常に維持し、live 不可でも再確認できるようにする

## mode

### `mock`

- fixture から deterministic に再現する
- 回帰確認や import 形式の確認に使う

### `live`

- 少数 seed だけを実行する
- raw / observation / import-ready を残す
- 失敗しても artifact と error を残す

### `auto`

- live 優先、失敗または観測 0 件なら mock fallback
- 初版では live / mock 明示実行を優先し、`auto` は補助扱い

## seed の扱い

seed は `config/trends/seed_queries.json` を再利用します。

初版の import-ready 対象:

- `seed_type=model`
- `emit_to_source_metrics=true`

初版で ranking に入れないもの:

- category seed
- compare seed
- `youtube_suggest_presence`

## metric

### `youtube_suggest_count`

- query ごとの有効 suggestion 件数の平均
- 有効 suggestion:
  - 空文字でない
  - query 文字列そのものと完全一致でない
- ranking に入れる対象

### `youtube_suggest_presence`

- suggestion が 1 件以上あったかの補助フラグ
- raw / import には残す
- 初版では ranking に使わない

## 出力

### raw JSON

- path: `data/collected/youtube_suggest/raw/`
- 内容:
  - seed ごとの query 実行結果
  - suggestion 一覧
  - error
  - collection mode

### observation CSV

- path: `data/collected/youtube_suggest/observations/`
- 内容:
  - query 単位の suggestion text
  - suggestion rank
  - query context
  - seed metadata

### import-ready CSV

- path: `data/collected/youtube_suggest/import/`
- 内容:
  - model seed / week / metric 単位の集約値
  - `sample_size`
  - `metadata_json`
  - `seed_id`
  - `canonical_target`
  - `collection_mode`

## `source_metrics` 接続

`scripts/run_youtube_suggest.py --import-db` で import-ready CSV を `source_metrics` へ流します。

再投入時の考え方:

- `--replace-existing` で同一週・同一 metric の差し替えを行いやすくする
- raw / observation / import-ready は collector 側 artifact として残す
- import batch 単位で追跡できる

## ranking での扱い

初版では `youtube_suggest_count` だけを score に使います。

安全策:

- base weight は `0.02`
- `min_query_terms=2`
- `min_value=2`
- `contribution_scale=0.35`
- `norm_cap=0.35`
- `youtube_suggest_presence` は score に使わない
- 軽量検索系 metric だけで `change_rate` を作らない

## 実行確認

確認済み:

- live:
  - 2 seed で `observations=31`, `import_rows=4`, error 0
- mock:
  - 4 seed で `observations=24`, `import_rows=8`, error 0
- dry-run import:
  - 8 行 OK / rollback 済み
- import:
  - 8 行を `source_metrics` に投入

## 採用理由

- Google Suggest と同じ seed 群を再利用しやすい
- 動画レビュー・セットアップ・使い方文脈を軽く拾える
- 実装コストを抑えつつ、GT と Google Suggest の間にもう 1 本補助ソースを差し込める

## 次アクション

1. 検索系 3 ソースの寄与差分を score detail でさらに見やすくする
2. 0 件が出やすい seed を source ごとに見直す
3. fallback 設計と endpoint 変更検知の扱いを整理する
