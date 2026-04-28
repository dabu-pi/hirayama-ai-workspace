# COLLECTORS_GOOGLE_TRENDS.md

最終更新: 2026-04-08

## 役割

Google Trends を、少数 seed で安全に観測し、既存の import / `source_metrics` / ranking フローへ接続するための collector です。

初版の優先順位:

- live 成功率より再現性
- 大量取得より少数 seed
- 直接スコア化より raw 保全

## 関連ファイル

- `src/collectors/google_trends.py`
- `config/trends/seed_queries.json`
- `data/mock/google_trends/jp_seed_fixture.json`
- `scripts/run_google_trends.py`

## seed 設計

seed は後で増やせるように、最低限以下の属性を持ちます。

- `seed_id`
- `label`
- `seed_type`
- `canonical_target`
- `query_group`
- `queries`
- `emit_to_source_metrics`
- `timeframe`
- `geo`

現行 seed の考え方:

- model seed
  例: `Concept2::SkiErg`
- category seed
  例: `leg_press`, `hack_squat`, `belt_squat`
- compare seed
  例: `stairmaster` を含む stair climber 比較、商用ブランド比較

## mode

### `mock`

- fixture から観測値を再生する
- ネットワーク不要
- テスト / 再確認の標準経路

### `live`

- `pytrends` を使って live 取得を試みる
- `urllib3<2` を前提とする
- seed ごとに失敗を握りつぶさず error に残す
- 失敗時も raw / observation / import artifact を残せる設計
- 日次結果は週次平均へ集約してから observation / import に流す

### `auto`

- まず live を試す
- collector 全体の live 失敗時、または live 観測が 0 件のときは mock にフォールバックする

## 出力

### raw JSON

`data/collected/google_trends/raw/`

- seed ごとの live/mock payload
- mode requested / used
- errors

### observation CSV

`data/collected/google_trends/observations/`

- query term 単位の週次観測
- `metric_type=google_trends_interest`
- `query_term`
- `seed_id`
- `collection_mode`
- `metadata_json`

### import-ready CSV

`data/collected/google_trends/import/`

- model seed のみ出力
- 1 seed / 1 week / 1 metric に集約
- `import_csv.py` へそのまま流せる

## import 方針

- raw は必ず残す
- ranking へ入れるのは model seed の集約値だけ
- category / compare seed は初版では raw 観測に留める
- import batch 単位で DB へ追跡できる
- `--replace-existing` で同一 source / metric / week / model の既存 Google Trends 行だけを差し替えられる

## metric の意味

`google_trends_interest` は Google Trends の相対指数です。

注意:

- 絶対需要ではない
- seed 内 query 群の相対値である
- 一時的な話題で跳ねることがある
- 他ソースで補完しない限り、単独で強い結論に使わない

## レート制限 / 失敗時の扱い

- 初版は少数 seed のみ
- seed ごとの live 失敗は error に残して継続
- `auto` は mock fallback を持つ
- fixture を常設し、live 不能でもパイプライン全体は検証できる
- console には seed ごとの `status=ok/failed` を表示する

## 実行例

```bash
python scripts/run_google_trends.py --mode mock
python scripts/run_google_trends.py --mode live --seed-id concept2_skierg_model
python scripts/run_google_trends.py --mode auto --seed-id concept2_skierg_model --seed-id technogym_run_model --max-seeds 2
python scripts/run_google_trends.py --mode mock --max-seeds 4 --import-db --replace-existing
python scripts/run_batch.py --use-db --week 2026-04-06 --only-commercial
```

## Google Trends 安定化ルール

- `google_trends_interest` は base weight を低めに開始
- `observation_weeks >= 3`
- `sample_size >= 2`
- cohort 内で GT を持つ model 数が一定未満なら不採用
- current 値は前週値で少し平滑化
- normalized contribution を cap
- 前週比較が GT 単独なら `change_rate` を出さない

## 今回の制約

- query の自動拡張はしない
- compare seed は ranking へ直接入れない
- live 実行の可否は環境依存
- 2026-04-08 時点で `pytrends` 導入後に 1〜2 seed の live 成立は確認済み
- canonical への接続は seed 設定に依存する

## 次アクション

1. live 取得結果の安定性を seed ごとに確認する
2. compare seed を raw 分析用に別集計する
3. Google Trends 以外の補助ソースを追加して相対指標の偏りを薄める
