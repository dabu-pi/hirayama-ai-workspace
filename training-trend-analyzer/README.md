# training-trend-analyzer

トレーニング機器の brand / model / category ごとのトレンド信号を収集し、少数ソースでも安全にランキングへ流せるようにするプロジェクトです。

## このプロジェクトの方針

- 手動 CSV と collector の両方から `source_metrics` へ取り込める形を維持する
- normalizer で brand / model / category を保守的に canonical 化する
- review / unresolved から alias を育てるが、短い別名や曖昧語は無理に採用しない
- raw / observation / import-ready を残し、再投入と再計算をやりやすくする
- Google Trends / Google Suggest / YouTube Suggest は補助指標として扱い、単独で順位を決めすぎない

## 現在地

2026-04-08 時点で Phase 4 入口まで到達しています。

- alias 拡充の初期フローを整備済み
- Google Trends collector は live / mock / auto で運用可能
- `google_trends_interest` には初期安定化ロジックを追加済み
- Google Suggest collector 初版を追加し、GT を補完する軽量ソースを 1 本追加済み
- YouTube Suggest collector 初版を追加し、同じ seed 群で使える第 3 ソースを接続済み

## 主な構成

```text
training-trend-analyzer/
├─ PROJECT_STATUS.md
├─ README.md
├─ requirements.txt
├─ config/
│  ├─ score_weights.json
│  └─ trends/seed_queries.json
├─ data/
│  ├─ master/
│  ├─ review/
│  ├─ mock/google_trends/
│  ├─ mock/google_suggest/
│  ├─ mock/youtube_suggest/
│  └─ collected/
│     ├─ google_trends/
│     ├─ google_suggest/
│     └─ youtube_suggest/
├─ docs/
│  ├─ SPEC.md
│  ├─ NORMALIZER.md
│  ├─ DB_SCHEMA.md
│  ├─ COLLECTORS_GOOGLE_TRENDS.md
│  ├─ COLLECTORS_GOOGLE_SUGGEST.md
│  └─ COLLECTORS_YOUTUBE_SUGGEST.md
├─ scripts/
│  ├─ import_csv.py
│  ├─ run_batch.py
│  ├─ run_google_trends.py
│  ├─ run_google_suggest.py
│  ├─ run_youtube_suggest.py
│  ├─ review_alias_candidates.py
│  └─ check_source_metrics.py
├─ src/
│  ├─ collectors/
│  │  ├─ google_trends.py
│  │  ├─ google_suggest.py
│  │  ├─ youtube_suggest.py
│  │  └─ suggest_common.py
│  ├─ normalizer/
│  └─ scorer/
└─ tests/
```

## セットアップ

```bash
python -m pip install -r requirements.txt
python scripts/init_db.py
python scripts/migrate_add_import_meta.py
python scripts/load_master_data.py
```

### live 実行の前提

- Google Trends live には `pytrends==4.9.2` と `urllib3<2` が必要
- Google Suggest live は `requests` で少数 query を投げる前提
- YouTube Suggest live は `ds=yt` + `client=firefox` で少数 query を投げる前提
- どれも最初は 1 から 2 seed 程度で確認する
- live が失敗しても raw artifact を残し、mock で再確認できる構成を維持する

## CSV 取り込み

```bash
python scripts/import_csv.py --file data/import/your_data.csv --dry-run
python scripts/import_csv.py --file data/import/your_data.csv
python scripts/run_batch.py --use-db --week 2026-04-06
```

## alias 候補の整理

```bash
python scripts/review_alias_candidates.py
```

出力先:

- `data/review/alias_candidates_summary.csv`

この summary は alias 自動追加ではなく、保守的な見送り / review / 低信頼保留の判断材料として使います。

## Google Trends collector

```bash
python scripts/run_google_trends.py --mode mock
python scripts/run_google_trends.py --mode live --seed-id concept2_skierg_model
python scripts/run_google_trends.py --mode auto --seed-id concept2_skierg_model --seed-id technogym_run_model --max-seeds 2
python scripts/run_google_trends.py --mode mock --max-seeds 4 --import-db --replace-existing
python scripts/check_google_trends_source_metrics.py --metric-type google_trends_interest
```

出力:

- raw JSON: `data/collected/google_trends/raw/`
- observation CSV: `data/collected/google_trends/observations/`
- import-ready CSV: `data/collected/google_trends/import/`

運用メモ:

- `live`: pytrends で収集し、失敗時も artifact と error を残す
- `mock`: fixture で再現確認する
- `auto`: live 優先、live が失敗または観測 0 件なら mock に落とす
- ranking では `google_trends_interest` を軽めの補助指標として扱う

## Google Suggest collector

```bash
python scripts/run_google_suggest.py --mode mock --max-seeds 4
python scripts/run_google_suggest.py --mode live --seed-id concept2_skierg_model --seed-id technogym_run_model --max-seeds 2
python scripts/run_google_suggest.py --mode mock --max-seeds 4 --import-db --replace-existing
python scripts/check_source_metrics.py --source-name google_suggest
python scripts/run_batch.py --use-db --week 2026-04-06 --only-commercial --show-metric-details
python scripts/run_batch.py --use-db --week 2026-04-06 --only-commercial --exclude-metric search_suggest_count
```

出力:

- raw JSON: `data/collected/google_suggest/raw/`
- observation CSV: `data/collected/google_suggest/observations/`
- import-ready CSV: `data/collected/google_suggest/import/`

初版の metric:

- `search_suggest_count`
  - query ごとの有効 suggestion 件数の平均
  - ranking に入れる対象
- `search_suggest_presence`
  - suggestion が存在したかの補助フラグ
  - raw / import には残すが、初版では ranking に使わない

安全策:

- query そのものと完全一致する suggestion は count しない
- model seed だけを import-ready に流す
- `search_suggest_count` は低ウェイトかつ `min_value` 付きで抑制する
- compare 的な query や一般語を canonical demand と直結しない

## YouTube Suggest collector

```bash
python scripts/run_youtube_suggest.py --mode mock --max-seeds 4
python scripts/run_youtube_suggest.py --mode live --seed-id concept2_skierg_model --seed-id technogym_run_model --max-seeds 2
python scripts/run_youtube_suggest.py --mode mock --max-seeds 4 --import-db --replace-existing
python scripts/check_source_metrics.py --source-name youtube_suggest --week 2026-04-06
python scripts/run_batch.py --use-db --week 2026-04-06 --only-commercial --show-metric-details
python scripts/run_batch.py --use-db --week 2026-04-06 --only-commercial --show-metric-details --exclude-metric youtube_suggest_count
python scripts/run_batch.py --use-db --week 2026-04-06 --only-commercial --show-metric-details --exclude-metric search_suggest_count --exclude-metric youtube_suggest_count
```

出力:

- raw JSON: `data/collected/youtube_suggest/raw/`
- observation CSV: `data/collected/youtube_suggest/observations/`
- import-ready CSV: `data/collected/youtube_suggest/import/`

初版の metric:

- `youtube_suggest_count`
  - query ごとの有効 suggestion 件数の平均
  - ranking に入れる対象
- `youtube_suggest_presence`
  - suggestion が存在したかの補助フラグ
  - raw / import には残すが、初版では ranking に使わない

安全策:

- YouTube 用 dataset `ds=yt` を使うが、JSON 取得安定化のため `client=firefox` を採用
- `youtube_suggest_count` は Google Suggest よりさらに低ウェイトで抑制する
- `min_value` / `min_query_terms` / `norm_cap` で補助寄与に留める
- 非公式 endpoint 依存なので mock fixture を維持する

## ranking の考え方

- `run_batch.py` は `--exclude-metric` で metric を切り替え可能
- `run_batch.py --compare-source-sets` で `GT only / GT + GS / GT + GS + YT` を 1 回で横並び比較できる
- 比較表と比較 CSV に `GS:+x.x / YT:+y.y` 形式の差分要約を付け、`+0.0 / -0.0` は省略して seed / weight 調整の当たりを見やすくする
- `--show-metric-details` で source / metric ごとの寄与を確認できる
- `google_trends_interest`、`search_suggest_count`、`youtube_suggest_count` はどれも軽量補助指標として扱う
- 観測不足や低値のモデルは metric rule で score 対象から外す
- commercial / discontinued フィルタと両立させる

### 3パターン比較

```bash
python scripts/run_batch.py --use-db --week 2026-04-06 --only-commercial --compare-source-sets
python scripts/run_batch.py --use-db --week 2026-04-06 --only-commercial --compare-source-sets --output-csv
```

比較表で見えるもの:

- model ごとの `GT only` score
- `GT + GS` score
- `GT + GS + YT` score
- `GT only -> GT + GS` delta
- `GT + GS -> GT + GS + YT` delta
- `GS:+x.x / YT:+y.y` の差分要約
  - `+0.0 / -0.0` は省略し、差分なしは `-`
- plain rank の `rank path`

## 関連ドキュメント

- [PROJECT_STATUS.md](/C:/hirayama-ai-workspace/workspace/training-trend-analyzer/PROJECT_STATUS.md)
- [SPEC.md](/C:/hirayama-ai-workspace/workspace/training-trend-analyzer/docs/SPEC.md)
- [NORMALIZER.md](/C:/hirayama-ai-workspace/workspace/training-trend-analyzer/docs/NORMALIZER.md)
- [DB_SCHEMA.md](/C:/hirayama-ai-workspace/workspace/training-trend-analyzer/docs/DB_SCHEMA.md)
- [COLLECTORS_GOOGLE_TRENDS.md](/C:/hirayama-ai-workspace/workspace/training-trend-analyzer/docs/COLLECTORS_GOOGLE_TRENDS.md)
- [COLLECTORS_GOOGLE_SUGGEST.md](/C:/hirayama-ai-workspace/workspace/training-trend-analyzer/docs/COLLECTORS_GOOGLE_SUGGEST.md)
- [COLLECTORS_YOUTUBE_SUGGEST.md](/C:/hirayama-ai-workspace/workspace/training-trend-analyzer/docs/COLLECTORS_YOUTUBE_SUGGEST.md)
