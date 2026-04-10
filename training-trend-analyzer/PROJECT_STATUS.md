# PROJECT_STATUS.md

最終更新: 2026-04-11

## 現在地

Phase 4 の入口として、Google Trends / Google Suggest / YouTube Suggest の 3 ソース比較を見やすく出す差分サマリを追加した上で、compare review 部分の pytest 化と境界ケース整理を進めました。2026-04-09 時点では、以後の自動開発を `docs/ROADMAP.md` 起点で進める段階に入っています。現在の主軸は内部向け判断支援の基盤整備であり、外部向け Web 公開は将来フェーズの対象として位置づけ直しています。

直近で完了している主要項目:

- alias 拡充の保守フロー整備
- Google Trends collector の live / mock / auto 運用
- `google_trends_interest` の初期安定化
- Google Suggest collector 初版
- YouTube Suggest collector 初版
- `source_metrics` と `run_batch.py` への接続確認
- `run_batch.py` で 3 パターン比較を 1 コマンド表示できるようにした
- compare 行生成 → significant 注釈 → 表示行選別の流れを helper に分け、console / CSV / pytest から追いやすくした
- significant-only の review summary を 0 件でも 3 行固定にそろえた
- compare pytest に rank shift 実例、summary 0件 / 1件 / 複数件、driver tie-break、CSV に summary 行が混ざらない確認を追加した
- compare CLI 専用 fixture `tests/fixtures/compare_source_sets_cli_fixture.json` を追加し、実 DB に rank shift がない週でも CLI 出力全体を回帰確認できるようにした
- `docs/ROADMAP.md` を実務ロードマップとして更新し、compare / collectors / ranking / regression / 定期運用の優先順位と DoD を整理した
- `docs/COLLECTOR_FALLBACK_PLAN.md` を追加し、collector 障害時の hard fail / soft fail / review-only 判断と console / CSV の役割分担を文書化した
- `docs/WEB_PUBLICATION_PLAN.md` を追加し、内部向け出力と外部向け公開レイヤの境界を文書化した
- `run_batch.py` に source health の最小実装を追加し、run 単位の `ok / review_only / blocked`、source 別 status、理由、`publish_ready` を console に出せるようにした
- health pytest を追加し、主要 source 完備時の `ok`、partial failure 時の `review_only`、GT 欠落時の `blocked`、CLI health summary 表示を固定した

## プロジェクト境界

今回の作業対象は `C:\hirayama-ai-workspace\workspace\training-trend-analyzer` 配下のみです。

今回変更した領域:

- `config/`
- `data/mock/google_suggest/`
- `data/mock/youtube_suggest/`
- `docs/`
- `scripts/`
- `src/collectors/`
- `src/scorer/`
- `tests/`
- `README.md`
- `PROJECT_STATUS.md`

触っていない領域:

- `C:\hirayama-ai-workspace\workspace\scripts`
- `C:\hirayama-ai-workspace\workspace\docs`
- `C:\hirayama-ai-workspace\workspace\config`
- 他プロジェクト配下すべて

混在していない根拠:

- collector / fixture / score / docs / tests をすべて当該プロジェクト配下に配置
- import 先 DB も `training-trend-analyzer/data/db/trend.db` のみを使用

## 完了済み

### Google Trends

- `pytrends==4.9.2` と `urllib3<2` を requirements へ整理
- live / mock / auto の挙動を CLI と docs に反映
- live 成功と fail-safe artifact を確認
- `google_trends_interest` に軽量補助指標としての安定化を追加

### Google Suggest

- `src/collectors/google_suggest.py` を追加
- `scripts/run_google_suggest.py` を追加
- `data/mock/google_suggest/jp_seed_fixture.json` を追加
- live / mock 両対応で raw / observation / import-ready を出力
- `search_suggest_count` と `search_suggest_presence` を import 可能化
- `search_suggest_count` を低ウェイトで ranking に接続

### YouTube Suggest

- `src/collectors/youtube_suggest.py` を追加
- `src/collectors/suggest_common.py` を追加
- `scripts/run_youtube_suggest.py` を追加
- `data/mock/youtube_suggest/jp_seed_fixture.json` を追加
- live / mock 両対応で raw / observation / import-ready を出力
- `youtube_suggest_count` と `youtube_suggest_presence` を import 可能化
- `youtube_suggest_count` を Google Suggest よりさらに低ウェイトで ranking に接続

### scoring / ranking

- `config/score_weights.json` に `search_suggest_count` を追加
- `config/score_weights.json` に `youtube_suggest_count` を追加
- `calculator.py` に `min_value` 対応を追加
- 軽量検索系 metric だけで前週比較を作らない change suppression を維持
- `run_batch.py` で metric 除外比較と寄与明細確認を継続利用
- `run_batch.py --compare-source-sets` を追加し、`GT only / GT + GS / GT + GS + YT` の score / delta / rank path を横並び表示
- 比較表に `GS:+x.x / YT:+y.y` の短い差分要約を追加し、`0.0` 差分は省略して source 差分の当たりを一目で追えるようにした
- console compare 表の raw delta 列も、丸め後ゼロなら `-` 表示にして視認性をそろえた
- `--compare-threshold` / `--compare-only-significant` を追加し、閾値超えまたは rank change の行だけを tuning 対象として抽出できるようにした
- significant-only 時は `Impact` と短い summary を出し、`rank change` 優先、その後 `impact_score` 順で見るべき行を前に出す
- significant-only 時は `Hint` も追加し、GS 主因 / YT 主因 / mixed / rank shift を review 補助として一目で読めるようにした
- significant-only 時の summary は `significant rows`, `top drivers`, `largest impact` を中心に整理し、後から見返しやすい review summary に寄せた
- summary は significant 0 件でも `largest impact: none` まで含めた 3 行固定にし、空ケースでも形が崩れないようにした
- `top drivers` は件数降順、同数時は表示順優先で安定表示する仕様を pytest で固定した

## 直近の重要判断

- Google Suggest は Google Trends の代替ではなく、低ウェイト補助指標として扱う
- YouTube Suggest も同様に補助寄与のみとし、Google Suggest よりさらに軽く扱う
- 初版は model seed のみ import-ready に流し、category / compare は ranking に入れない
- query と完全一致する suggestion は count しない
- `search_suggest_presence` は import しても score には使わない
- `youtube_suggest_presence` も import しても score には使わない
- `search_suggest_count` は `min_value=2` と低 weight で過大評価を抑える
- `youtube_suggest_count` は `weight=0.02`, `contribution_scale=0.35`, `norm_cap=0.35` でさらに抑制する
- YouTube Suggest は `ds=yt` を使うが、live JSON 取得のため `client=firefox` を採用する
- Suggest 系 endpoint は軽量利用に留め、仕様変更前提で mock fixture を維持する
- console summary は人間向け、CSV は行データ中心という責務分離を維持する

## テスト状況

実行済み:

- `python -m py_compile src/collectors/suggest_common.py src/collectors/google_suggest.py src/collectors/youtube_suggest.py scripts/run_google_suggest.py scripts/run_youtube_suggest.py scripts/import_csv.py`
  - 結果: PASS
- pytest は利用中 interpreter に未導入だったため、collector / scorer のテスト関数を Python から直接呼び出して確認
  - 結果: `manual-tests-ok`
- `python scripts/run_google_suggest.py --mode live --seed-id concept2_skierg_model --seed-id technogym_run_model --max-seeds 2`
  - 結果: `mode_used=live`, `observations=39`, `import_rows=4`, error 0
- `python scripts/run_google_suggest.py --mode mock --max-seeds 4`
  - 結果: `observations=28`, `import_rows=8`, error 0
- `python scripts/run_google_suggest.py --mode mock --max-seeds 4 --import-db --replace-existing`
  - 結果: 8 行 import
- `python scripts/check_source_metrics.py --source-name google_suggest`
  - 結果: `source_metrics` に 8 行を確認
- `python scripts/run_batch.py --use-db --week 2026-04-06 --only-commercial --show-metric-details`
  - 結果: Google Suggest を含む ranking を確認
- `python scripts/run_batch.py --use-db --week 2026-04-06 --only-commercial --exclude-metric search_suggest_count`
  - 結果: Suggest 除外時の比較を確認
- `python scripts/run_youtube_suggest.py --mode live --seed-id concept2_skierg_model --seed-id technogym_run_model --max-seeds 2`
  - 結果: `mode_used=live`, `observations=31`, `import_rows=4`, error 0
- `python scripts/run_youtube_suggest.py --mode mock --max-seeds 4 --import-db --dry-run-import --replace-existing`
  - 結果: `observations=24`, `import_rows=8`, dry-run import 8 行 OK / rollback 済み
- `python scripts/run_youtube_suggest.py --mode mock --max-seeds 4 --import-db --replace-existing`
  - 結果: `observations=24`, `import_rows=8`, `source_metrics` へ 8 行 import
- `python scripts/check_source_metrics.py --source-name youtube_suggest --week 2026-04-06`
  - 結果: 8 行確認
- `python scripts/run_batch.py --use-db --week 2026-04-06 --only-commercial --show-metric-details --exclude-metric search_suggest_count --exclude-metric youtube_suggest_count`
  - 結果: GT 単独比較を確認
- `python scripts/run_batch.py --use-db --week 2026-04-06 --only-commercial --show-metric-details`
  - 結果: 3ソース比較を確認
- `python scripts/run_batch.py --use-db --week 2026-04-06 --only-commercial --compare-source-sets`
  - 結果: 3 パターン比較を 1 表で確認。`Why` 列の `0.0` 差分省略に加え、`d(GT->GS)` / `d(GS->3)` も丸め後ゼロは `-` で表示
- `python scripts/run_batch.py --use-db --week 2026-04-06 --only-commercial --compare-source-sets --compare-only-significant`
  - 結果: 既定 threshold `0.5` 以上、または rank change ありの行だけに絞って確認できる
- `python scripts/run_batch.py --use-db --week 2026-04-06 --only-commercial --compare-source-sets --compare-only-significant --output-csv`
  - 結果: significant 行のみを priority 順で出力し、CSV に `impact_score` / `is_significant` / `has_rank_change` を保持
  - 結果: さらに `driver_source` / `driver_direction` / `review_hint` も保持し、significant-only の console では `Hint` 列と review summary を確認
  - 結果: review summary は console の人間向け要約に留め、CSV へ summary 行は入れない
- `uv run --with-requirements requirements.txt python -m py_compile scripts/run_batch.py tests/test_run_batch_compare.py`
  - 結果: PASS
- `uv run --with-requirements requirements.txt pytest tests/test_run_batch_compare.py -q`
  - 結果: PASS（27 tests）
- `uv run --with-requirements requirements.txt pytest tests/test_run_batch_compare_cli.py -q`
  - 結果: PASS（3 tests, fixture ベースの CLI compare 回帰確認）
- `uv run --with-requirements requirements.txt pytest -q`
  - 結果: PASS（61 tests）
- `uv run --with-requirements requirements.txt python scripts/run_batch.py --use-db --week 2026-04-06 --only-commercial --compare-source-sets`
  - 結果: PASS（4 models, compare 通常表示）
- `uv run --with-requirements requirements.txt python scripts/run_batch.py --use-db --week 2026-04-06 --only-commercial --compare-source-sets --compare-only-significant`
  - 結果: PASS（3 significant rows / 4, rank shifts 0）
- `uv run --with-requirements requirements.txt python scripts/run_batch.py --use-db --week 2026-04-06 --only-commercial --compare-source-sets --compare-only-significant --output-csv`
  - 結果: PASS（CSV は行データのみ、summary 行混入なし）

## 残課題

- Google Suggest は非公式 endpoint 依存なので、仕様変更時の fallback 設計が今後必要
- YouTube Suggest も非公式 endpoint 依存なので、応答形式変更時の fallback 設計が必要
- live seed によって suggestion 0 件や偏りが出やすく、seed 設計の見直し余地がある
- `search_suggest_presence` の活用はまだ raw / import 保持段階で、score 反映は未実施
- `youtube_suggest_presence` の活用もまだ raw / import 保持段階で、score 反映は未実施
- compare seed / category seed の raw 活用ルールは今後整理が必要
- 実 DB の 2026-04-06 compare ではまだ `rank shifts: 0` で、rank shift の実運用サンプルは pytest の合成ケースで担保している
- fixture は CLI 出力回帰用の専用セットで、実運用のランキング妥当性を代替するものではない
- source health の最小骨格は入ったが、collector artifact / import / sidecar status artifact まで共通語彙でつなぐ実装はまだ未着手
- 公開向けの publish-ready artifact と品質ゲートはまだ設計段階で、Web 公開機能自体は未着手

## 次アクション

1. GS / YT の source-wide failure と partial failure を再現する fixture / pytest を追加する
2. source health を collector artifact / import 後 / sidecar status artifact へ広げる最小方針を決める
3. `docs/WEB_PUBLICATION_PLAN.md` に沿って publish-ready output の最小要件を整理する

## 2026-04-09 Publish-ready Artifact Update

- `run_batch.py` now supports `--output-publish-artifact`
- output path:
  `data/output/publish_ready_YYYYMMDD.json`
- `ok` runs emit the artifact with `publish_ready=true`
- `review_only` runs emit the artifact with `publish_ready=false` and retained reasons
- `blocked` runs do not emit the artifact
- compare mode can include a compact compare summary without exposing raw table output

Tests added in this step:

- `tests/test_run_batch_publish_artifact.py`
  - ok compare fixture emits publish-ready artifact
  - review-only fixture emits non-publishable artifact
  - blocked fixture skips artifact generation

Next actions:

1. Decide whether collector/import sidecars should adopt the same health vocabulary
2. Define the first publish-ready Markdown or CMS transform on top of the JSON artifact
3. Add fixture coverage for source-wide GS / YT failure patterns feeding publication hold decisions
- compare artifact path:
  `data/output/publish_ready_compare_YYYYMMDD.json`

## 2026-04-10 Markdown Renderer Update

- added `scripts/render_publish_markdown.py` as the minimum artifact consumer
- renderer reads JSON artifact only and outputs Markdown under `data/output/`
- `publish_ready=true` renders publication-oriented Markdown
- `publish_ready=false` renders review-hold Markdown instead of public body
- this moves the project one step closer to a real public layer without coupling back to DB or collectors

Tests added in this step:

- `tests/test_render_publish_markdown.py`
  - ranking artifact -> Markdown success
  - compare artifact -> Markdown success
  - review-only artifact -> hold Markdown success
  - required key missing -> explicit failure

## 2026-04-10 Publish-ready Schema Contract Update

- fixed the publish-ready artifact contract at `schema_version="publish-ready/v1"`
- `run_batch.py` now always emits `schema_version`
- `render_publish_markdown.py` now validates supported schema versions before rendering
- missing `schema_version` is treated as legacy and fails explicitly
- unsupported schema versions fail explicitly with the received version and supported version list
- docs / fixtures / renderer tests were updated so producer and consumer share the same contract

Tests added in this step:

- `tests/test_run_batch_publish_artifact.py`
  - writer emits `schema_version="publish-ready/v1"`
- `tests/test_render_publish_markdown.py`
  - ranking artifact (v1) -> success
  - compare artifact (v1) -> success
  - review-only artifact (v1) -> hold Markdown success
  - missing `schema_version` legacy artifact -> explicit failure
  - unsupported `schema_version` -> explicit failure

## 2026-04-11 Markdown Front Matter Update

- kept publish-ready artifact schema at `publish-ready/v1`
- added renderer-side YAML front matter for ranking / compare / hold outputs
- front matter is derived from artifact only and includes `schema_version`, `content_kind`, `week`, `generated_at`, `publish_ready`, `title`, `slug`, `summary`, `internal_reference`
- compare output also includes `compare_mode: true`
- hold output uses `content_kind: publish_hold` and includes `hold_reason`
- existing public / hold body generation stays intact under the front matter

Tests added in this step:

- `tests/test_render_publish_markdown.py`
  - ranking artifact -> front matter keys present
  - compare artifact -> front matter keys present with `compare_mode: true`
  - review-only artifact -> hold front matter keys present with `content_kind: publish_hold`
  - unsupported schema fail behavior remains unchanged

## 2026-04-11 Publication Handoff Index Update

- added `scripts/build_publication_handoff.py` as a thin post-render handoff step
- input is dated artifact JSON plus dated Markdown only
- output is a dated manifest plus a same-kind latest pointer under `data/output/`
- ranking / compare / publish_hold are tracked separately
- normal latest pointers do not mix in hold output
- handoff validation checks Markdown front matter against artifact-derived expectations and fails clearly on mismatch

Tests added in this step:

- `tests/test_build_publication_handoff.py`
  - ranking manifest success
  - compare manifest success
  - hold manifest success
  - latest pointer points to expected dated manifest
  - compare includes `compare_mode`
  - hold includes `hold_reason`
  - content kind mismatch fails
  - unsupported artifact schema fail remains

## 2026-04-10 Publication Pipeline Update

- added `scripts/run_publication_pipeline.py` as the single operator entrypoint for publication prep
- pipeline remains thin and orchestrates existing artifact / markdown / handoff steps instead of reimplementing them
- supports ranking, compare, and hold flows
- keeps hold output isolated from ranking latest / compare latest
- supports `--from-artifact`, `--artifact-only`, `--skip-handoff`, and `--output-dir`

Tests added in this step:

- `tests/test_run_publication_pipeline.py`
  - ranking pipeline success
  - compare pipeline success
  - hold pipeline success
  - ranking latest is not replaced by hold latest
  - compare latest is not replaced by hold latest
  - markdown-stage failure stops before handoff
  - unsupported schema artifact stops the pipeline before downstream output

## 2026-04-10 Deterministic Latest Rebuild Update

- added `scripts/rebuild_publication_latest.py` to rebuild latest pointers from
  dated handoff manifests under `data/output/`
- latest selection is now deterministic by `week`, then `generated_at`, then
  manifest filename as a tie-break
- ranking / compare / hold latest remain isolated by kind and publishability
- `scripts/build_publication_handoff.py` and
  `scripts/run_publication_pipeline.py` now update latest through the same
  manifest-group rebuild path instead of relying on execution order

Tests added in this step:

- `tests/test_rebuild_publication_latest.py`
  - ranking / compare / hold latest rebuild success
  - same-week `generated_at` tie-break success
  - hold manifests do not leak into ranking / compare latest
  - unsupported handoff schema fails explicitly
- `tests/test_run_publication_pipeline.py`
  - rerunning an older artifact does not overwrite a newer ranking latest when
    the dated manifest set already contains the newer week

## 2026-04-11 Manual Release Gate Update

- added `scripts/promote_publication_release.py` as a thin manual promotion CLI
- input is a dated handoff manifest only; promotion does not re-read raw DB / collector output
- candidate latest (`publication_handoff_latest*.json`) remains deterministic review input
- release latest (`publication_release_latest*.json`) is now a separate operator-approved layer
- only `ranking` / `compare` with `publish_ready=true` can be promoted
- `publish_hold` manifests are rejected by default and stay outside the release layer
- optional `--copy-markdown` creates stable release Markdown paths for simple file-based public pickup
- rollback to an older week is allowed only as explicit promotion with `--allow-rollback`
- successful promotion now also appends an audit record to `data/output/publication_release_ledger.jsonl`
- dry-run leaves both the release pointer and the release ledger unchanged

Tests added in this step:

- `tests/test_promote_publication_release.py`
  - ranking promotion success
  - compare promotion success
  - hold rejection
  - not-ready rejection
  - unsupported schema rejection
  - explicit rollback success
  - candidate latest remains independent from release latest
  - stable release Markdown copy and dry-run behavior

## 2026-04-11 Release Ledger / Audit Trail Update

- added `src/publication/release_ledger.py` as an append-only JSONL ledger helper
- promotion CLI now records successful release actions to `publication_release_ledger.jsonl`
- normal promotion uses `action=promote`
- rollback promotion uses `action=rollback_promote`
- ledger records can include previous release manifest / week so rollback intent stays visible after the pointer moves
- hold / not-ready / unsupported schema failures do not append ledger entries

Tests added in this step:

- `tests/test_promote_publication_release.py`
  - ranking promotion appends one ledger row
  - compare promotion appends one ledger row
  - rollback promotion appends `rollback_promote`
  - dry-run / rejection paths do not append ledger rows

## 2026-04-11 Release Status / History CLI Update

- added `scripts/show_publication_release_status.py` as a read-only operator / audit CLI
- CLI reads release pointer + release ledger only and does not re-read DB / collectors
- supports `--kind ranking|compare|all`, `--limit`, `--json`, and `--verbose`
- shows current release and recent history in one command
- recent history makes rollback entries visible via `action=rollback_promote`
- can warn when current release pointer and latest ledger row for a kind do not match

Tests added in this step:

- `tests/test_show_publication_release_status.py`
  - ranking current release display
  - compare current release display
  - history limit
  - rollback visibility
  - missing pointer / empty ledger display
  - JSON output
  - invalid pointer / ledger schema failure
  - read-only behavior

## 2026-04-11 Release Verify / Repair CLI Update

- added `scripts/verify_publication_release_state.py` for operator / maintenance verification
- verify checks release pointer, latest ledger entry, handoff manifest, source markdown, and stable markdown consistency
- default mode is read-only and reports `OK / WARNING / ERROR`
- `--repair` rebuilds release pointer and stable markdown from the latest validated ledger entry for the selected kind
- repair does not mutate or append the release ledger
- `--dry-run` shows the repair plan without writing files

Tests added in this step:

- `tests/test_verify_publication_release_state.py`
  - ranking verify success
  - compare verify success
  - pointer / ledger mismatch detection
  - missing manifest / markdown detection
  - stable markdown mismatch detection
  - JSON output
  - repair success
  - repair dry-run
  - repair refusal for not-ready manifest
  - schema failure

## 2026-04-10 Candidate vs Release Review CLI Update

- added `scripts/review_publication_candidate.py` as a read-only pre-promotion review CLI
- CLI compares candidate latest pointer + manifest with the current release pointer
- supports `--kind ranking|compare|all`, `--output-dir`, `--json`, and `--verbose`
- outputs three sections per kind: Current Release / Latest Candidate / Review Summary
- review summary statuses: `no_candidate`, `no_release`, `same_manifest`,
  `candidate_newer_than_release`, `candidate_differs_same_week`,
  `candidate_older_than_release`, `candidate_not_publish_ready`
- `promotable=True` indicates the candidate is eligible for promotion
- field diff notes are shown when title / slug / markdown_path differ between candidate and release
- `--json` emits machine-readable structure suitable for scripted promotion decisions
- no writes at any point; the CLI is read-only by design
- added `src/publication/candidate_review.py` as the core review helper module

Tests added in this step:

- `tests/test_review_publication_candidate.py`
  - ranking candidate newer than release
  - compare candidate newer than release
  - no release / with candidate (initial promotion eligible)
  - no candidate / with release
  - same manifest (no action)
  - candidate older than release (rollback path)
  - candidate not publish_ready (hold)
  - `--json` expected structure
  - `--json` no candidate / no release
  - `--json` all kinds
  - invalid release pointer schema fails
  - field diff notes when slug changes
  - read-only behavior
  - candidate_differs_same_week
