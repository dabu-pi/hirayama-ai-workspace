# training-trend-analyzer

## 目的の二層構造

このプロジェクトは、次の 2 層目的を持ちます。

- 内部向け:
  仕入れ判断支援のために、AI が複数ソースから週次トレンド候補を安定収集・比較できること
- 外部向け:
  ジムオーナー、トレーニー、業界関係者へ継続発信できる Web 向けトレンド情報基盤を作ること

現在はまだ内部基盤整備が中心です。外部向けの公開レイヤは、内部の ranking / compare / review / source health を安定化した上で段階的に接続します。全体方針は [ROADMAP.md](/C:/hirayama-ai-workspace/workspace/training-trend-analyzer/docs/ROADMAP.md)、公開側の補助方針は [WEB_PUBLICATION_PLAN.md](/C:/hirayama-ai-workspace/workspace/training-trend-analyzer/docs/WEB_PUBLICATION_PLAN.md) を参照してください。

トレーニング機器の brand / model / category ごとのトレンド信号を収集し、少数ソースでも安全にランキングへ流せるようにするプロジェクトです。

## このプロジェクトの方針

- 手動 CSV と collector の両方から `source_metrics` へ取り込める形を維持する
- normalizer で brand / model / category を保守的に canonical 化する
- review / unresolved から alias を育てるが、短い別名や曖昧語は無理に採用しない
- raw / observation / import-ready を残し、再投入と再計算をやりやすくする
- Google Trends / Google Suggest / YouTube Suggest は補助指標として扱い、単独で順位を決めすぎない

## 現在地

2026-04-09 時点で compare / fixture / regression の土台が一段固まり、以後は [docs/ROADMAP.md](/C:/hirayama-ai-workspace/workspace/training-trend-analyzer/docs/ROADMAP.md) を起点に進める段階に入っています。Phase 2 の入口として、collector 障害時の degrade 方針は [COLLECTOR_FALLBACK_PLAN.md](/C:/hirayama-ai-workspace/workspace/training-trend-analyzer/docs/COLLECTOR_FALLBACK_PLAN.md) を正本にします。あわせて `run_batch.py` に run 単位の source health (`ok / review_only / blocked`) と console health summary の最小実装を入れました。

- alias 拡充の初期フローを整備済み
- Google Trends collector は live / mock / auto で運用可能
- `google_trends_interest` には初期安定化ロジックを追加済み
- Google Suggest collector 初版を追加し、GT を補完する軽量ソースを 1 本追加済み
- YouTube Suggest collector 初版を追加し、同じ seed 群で使える第 3 ソースを接続済み
- `run_batch.py` に source health summary を追加し、ranking / compare の前提として overall status / source 別 status / reasons を console で読めるようにした
- source health は console 側の前提情報として扱い、CSV は引き続き行データ中心のまま維持した

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
- console の compare 表では raw delta 列 (`d(GT->GS)` / `d(GS->3)`) も丸め後ゼロなら `-` 表示にする
- `--compare-threshold` と `--compare-only-significant` で、有意差分だけを compare 表から拾える
- `--compare-only-significant` では `Impact` を出し、priority 高い順に tuning 対象を見やすくする
- `--compare-only-significant` では `Hint` も出し、GS / YT / mixed / rank shift の見方をすぐ判断できる
- `--show-metric-details` で source / metric ごとの寄与を確認できる
- `google_trends_interest`、`search_suggest_count`、`youtube_suggest_count` はどれも軽量補助指標として扱う
- 観測不足や低値のモデルは metric rule で score 対象から外す
- commercial / discontinued フィルタと両立させる

### 3パターン比較

```bash
python scripts/run_batch.py --use-db --week 2026-04-06 --only-commercial --compare-source-sets
python scripts/run_batch.py --use-db --week 2026-04-06 --only-commercial --compare-source-sets --compare-only-significant
python scripts/run_batch.py --use-db --week 2026-04-06 --only-commercial --compare-source-sets --output-csv
```

比較表で見えるもの:

- model ごとの `GT only` score
- `GT + GS` score
- `GT + GS + YT` score
- `GT only -> GT + GS` delta
- `GT + GS -> GT + GS + YT` delta
  - console 表では `+0.0 / -0.0 / 0.0` は `-`
- `GS:+x.x / YT:+y.y` の差分要約
  - `+0.0 / -0.0` は省略し、差分なしは `-`
- plain rank の `rank path`

補足:

- `--compare-threshold` の既定値は `0.5`
- significance 判定は `abs(d(GT->GS)) >= threshold` または `abs(d(GS->3)) >= threshold`
- rank path が変わる行は、delta が threshold 未満でも tuning 対象として `significant` 扱い
- `--compare-only-significant` 指定時だけ、この判定を満たす行に絞って表示
- `Impact` は `max(abs(d(GT->GS)), abs(d(GS->3)))`
- significant-only の並び順は `rank change あり` → `Impact 大きい順` → 元の compare 順
- `driver_source` は主に絶対値の大きい delta 側で決める
  - `GS` / `YT`
  - 近い値なら `BOTH`
  - rank change 主体で delta が弱い場合は `RANK`
- `driver_direction` は主因側 delta の符号で `UP` / `DOWN`、rank 主体なら `RANK`
- console の significant-only では `review_hint` を `Hint` 列で短く表示
- compare CSV の raw delta 列は downstream 用に数値のまま保持
- compare CSV には `is_significant`, `has_rank_change`, `impact_score`, `driver_source`, `driver_direction`, `review_hint` の軽い補助列を追加
- `-` 整形は console compare 表だけに適用
- significant-only 実行時は review summary として `significant rows`, `top drivers`, `largest impact` を 3 行固定で短く出す
- `top drivers` は件数降順、同数なら表示順優先で並べる
- console summary は人間向けの振り返り要約で、CSV には summary 行を混ぜない

## 関連ドキュメント

- [ROADMAP.md](/C:/hirayama-ai-workspace/workspace/training-trend-analyzer/docs/ROADMAP.md)
- [COLLECTOR_FALLBACK_PLAN.md](/C:/hirayama-ai-workspace/workspace/training-trend-analyzer/docs/COLLECTOR_FALLBACK_PLAN.md)
- [WEB_PUBLICATION_PLAN.md](/C:/hirayama-ai-workspace/workspace/training-trend-analyzer/docs/WEB_PUBLICATION_PLAN.md)
- [PROJECT_STATUS.md](/C:/hirayama-ai-workspace/workspace/training-trend-analyzer/PROJECT_STATUS.md)
- [SPEC.md](/C:/hirayama-ai-workspace/workspace/training-trend-analyzer/docs/SPEC.md)
- [NORMALIZER.md](/C:/hirayama-ai-workspace/workspace/training-trend-analyzer/docs/NORMALIZER.md)
- [DB_SCHEMA.md](/C:/hirayama-ai-workspace/workspace/training-trend-analyzer/docs/DB_SCHEMA.md)
- [COLLECTORS_GOOGLE_TRENDS.md](/C:/hirayama-ai-workspace/workspace/training-trend-analyzer/docs/COLLECTORS_GOOGLE_TRENDS.md)
- [COLLECTORS_GOOGLE_SUGGEST.md](/C:/hirayama-ai-workspace/workspace/training-trend-analyzer/docs/COLLECTORS_GOOGLE_SUGGEST.md)
- [COLLECTORS_YOUTUBE_SUGGEST.md](/C:/hirayama-ai-workspace/workspace/training-trend-analyzer/docs/COLLECTORS_YOUTUBE_SUGGEST.md)

## compare の自動テスト観点

- `pytest tests/test_run_batch_compare.py` で compare 専用ケースを回す
- `pytest tests/test_run_batch_compare_cli.py` で CLI 寄りの compare 回帰確認を、fixture `tests/fixtures/compare_source_sets_cli_fixture.json` で回す
- 3 ソース比較の score / delta / rank path が崩れていないこと
- `--compare-only-significant` の significance 判定が、threshold 超えだけでなく rank shift も拾うこと
- review summary が 0件 / 1件 / 複数件でも 3 行固定で崩れないこと
- `top drivers` の tie-break が件数降順、同数時は表示順で安定すること
- compare CSV に summary 行を混ぜず、行データだけを出すこと
- 実 DB に rank shift が出ていない週でも、fixture で compare の人間向け出力全体を回帰確認できること

## 2026-04-09 Publish-ready Artifact

- `python scripts/run_batch.py --week 2026-04-13 --output-publish-artifact`
- `python scripts/run_batch.py --week 2026-04-13 --compare-source-sets --output-publish-artifact`

`publish_ready_YYYYMMDD.json` is the minimum bridge from the internal CLI layer to the future public layer.

Contract:

- required version field:
  `schema_version`
- current supported value:
  `publish-ready/v1`
- writer:
  always emits `schema_version="publish-ready/v1"`
- renderer:
  accepts `publish-ready/v1` only
- legacy artifact without `schema_version`:
  explicit failure

- console health summary:
  human-facing run context
- CSV:
  row-data export for downstream analysis
- publish-ready artifact:
  compact JSON handoff for editorial / web reuse

Blocked runs do not emit the artifact.
`review_only` runs emit it with `publish_ready=false` and preserved reasons.

References:

- [PUBLISH_READY_ARTIFACT_SPEC.md](/C:/hirayama-ai-workspace/workspace/training-trend-analyzer/docs/PUBLISH_READY_ARTIFACT_SPEC.md)
- [ROADMAP.md](/C:/hirayama-ai-workspace/workspace/training-trend-analyzer/docs/ROADMAP.md)
- [WEB_PUBLICATION_PLAN.md](/C:/hirayama-ai-workspace/workspace/training-trend-analyzer/docs/WEB_PUBLICATION_PLAN.md)

Note:

- ranking artifact path:
  `data/output/publish_ready_YYYYMMDD.json`
- compare artifact path:
  `data/output/publish_ready_compare_YYYYMMDD.json`

## 2026-04-10 Markdown Renderer

- `python scripts/run_batch.py --week 2026-04-06 --output-publish-artifact`
- `python scripts/render_publish_markdown.py --artifact data/output/publish_ready_20260406.json`
- `python scripts/run_batch.py --week 2026-04-06 --compare-source-sets --output-publish-artifact`
- `python scripts/render_publish_markdown.py --artifact data/output/publish_ready_compare_20260406.json`

The Markdown renderer is the minimum public-layer consumer.
It reads artifact JSON only and writes publication-oriented Markdown under `data/output/`.

The renderer validates `schema_version` before any ranking / compare rendering path.
Current support is limited to `publish-ready/v1`.

Behavior:

- `publish_ready=true`
  render a public draft Markdown
- `publish_ready=false`
  render a hold-only Markdown for internal review

Renderer output now includes YAML front matter before the Markdown body so the file can move more easily into CMS, static site, or manual publication flows.

Example front matter:

```yaml
---
schema_version: 'publish-ready/v1'
content_kind: 'ranking'
week: '2026-04-06'
generated_at: '2026-04-10T00:10:00'
publish_ready: true
title: 'Weekly Training Trend Update: 2026-04-06'
slug: 'training-trends-20260406'
summary: 'TECHNOGYM Run leads this week''s treadmill trend candidates.'
internal_reference:
  collector_source: 'db'
  normalized_models: 4
  compare_enabled: false
publication_notice: 'Ready for publication after editorial review.'
---
```

## 2026-04-10 Publication Handoff

- `python scripts/build_publication_handoff.py --artifact data/output/publish_ready_20260406.json --markdown data/output/publish_ready_20260406.md`
- `python scripts/build_publication_handoff.py --artifact data/output/publish_ready_compare_20260406.json --markdown data/output/publish_ready_compare_20260406.md`

This step keeps the contract layered:

1. artifact JSON
2. rendered Markdown with front matter
3. dated handoff manifest
4. candidate latest pointer

Output examples:

- ranking manifest:
  `data/output/publication_handoff_YYYYMMDD.json`
- compare manifest:
  `data/output/publication_handoff_compare_YYYYMMDD.json`
- hold manifest:
  `data/output/publication_handoff_hold_YYYYMMDD.json`
- ranking candidate latest pointer:
  `data/output/publication_handoff_latest.json`
- compare candidate latest pointer:
  `data/output/publication_handoff_compare_latest.json`
- hold candidate latest pointer:
  `data/output/publication_handoff_hold_latest.json`

## 2026-04-10 Publication Pipeline

The shortest operator entrypoint is now:

```bash
python scripts/run_publication_pipeline.py --week 2026-04-06 --use-db --only-commercial
python scripts/run_publication_pipeline.py --week 2026-04-06 --use-db --only-commercial --compare-source-sets
```

This thin pipeline orchestrates:

1. artifact generation
2. markdown rendering
3. publication handoff manifest generation
4. candidate latest pointer update

Optional modes:

- `--from-artifact <path>`
  rerun downstream publication prep from an existing dated artifact
- `--artifact-only`
  stop after artifact generation / artifact pickup
- `--skip-handoff`
  stop after Markdown generation
- `--output-dir <path>`
  write copied pipeline outputs under a custom directory

## 2026-04-10 Deterministic Latest Rebuild

Latest candidate publication pointers are no longer defined by execution order alone.
They can be rebuilt deterministically from existing dated handoff manifests:

```bash
python scripts/rebuild_publication_latest.py --output-dir data/output
python scripts/rebuild_publication_latest.py --output-dir data/output --kind ranking
python scripts/rebuild_publication_latest.py --output-dir data/output --kind compare
python scripts/rebuild_publication_latest.py --output-dir data/output --kind publish_hold
```

Selection rules:

- ranking latest:
  latest manifest where `content_kind="ranking"` and `publish_ready=true`
- compare latest:
  latest manifest where `content_kind="compare"` and `publish_ready=true`
- hold latest:
  latest manifest where `content_kind="publish_hold"` and `publish_ready=false`
- ordering:
  `week` descending, then `generated_at` descending, then manifest filename as a deterministic tie-break

The publication pipeline still runs artifact -> markdown -> handoff in one command,
but the candidate latest pointer update now rebuilds from the dated manifest group for the same kind
instead of trusting "the last CLI run".

## 2026-04-11 Manual Release Promotion

Candidate latest is intentionally not the same as released latest.
`publication_handoff_latest*.json` means "most recent eligible candidate for operator review",
not "approved for public pickup".

Manual release is a separate thin layer on top of dated handoff manifests:

```bash
# 1. review candidate vs current release before promoting
python scripts/review_publication_candidate.py --kind all
python scripts/review_publication_candidate.py --kind ranking --json

# 2a. promote latest candidate (kind-based, recommended)
python scripts/promote_publication_candidate.py --kind ranking
python scripts/promote_publication_candidate.py --kind compare --copy-markdown
python scripts/promote_publication_candidate.py --kind ranking --dry-run
python scripts/promote_publication_candidate.py --kind ranking --allow-same-week
python scripts/promote_publication_candidate.py --kind ranking --allow-rollback

# 2b. promote specific manifest (path-based, for precise control)
python scripts/promote_publication_release.py --manifest data/output/publication_handoff_20260406.json
python scripts/promote_publication_release.py --manifest data/output/publication_handoff_20260330.json --allow-rollback

# 3. inspect and verify
python scripts/show_publication_release_status.py --kind all --limit 10
python scripts/verify_publication_release_state.py --kind all
python scripts/verify_publication_release_state.py --kind ranking --repair
```

Release outputs:

- ranking release pointer:
  `data/output/publication_release_latest.json`
- compare release pointer:
  `data/output/publication_release_compare_latest.json`
- append-only release ledger:
  `data/output/publication_release_ledger.jsonl`
- optional stable ranking release Markdown:
  `data/output/publication_release_latest.md`
- optional stable compare release Markdown:
  `data/output/publication_release_compare_latest.md`

Rules:

- release promotion reads a dated handoff manifest only
- release promotion does not re-read raw DB / collector output
- only `content_kind="ranking"` or `content_kind="compare"` can be promoted
- only `publish_ready=true` manifests can be promoted
- `publish_hold` manifests are rejected by default
- older manifests can be promoted as an explicit rollback with `--allow-rollback`
- successful promotion appends an audit record to the release ledger
- rollback promotion is recorded as `rollback_promote`
- `--dry-run` writes neither release pointer nor ledger

Operationally this makes publication a multi-step flow:

1. run pipeline to produce candidate outputs
2. **review** candidate vs release with `review_publication_candidate.py` (new)
3. if `promotable=True`, promote the approved dated manifest to the release pointer
4. keep the promotion / rollback audit trail in the release ledger
5. inspect current release + recent history with `show_publication_release_status.py`
6. verify pointer / ledger / stable markdown consistency with `verify_publication_release_state.py`
7. if needed, explicitly repair pointer and stable markdown from the latest ledger-backed release record

Public consumers should read the release pointer or the optional stable release Markdown,
not the candidate latest pointer.
Operators and audit tooling should read the release ledger when they need promotion history.
Maintenance operators should use verify/repair instead of editing pointer files by hand.
