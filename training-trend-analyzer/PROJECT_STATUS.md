# PROJECT_STATUS.md

最終更新: 2026-04-10

## 現在地

**Publication pipeline から safe candidate promotion CLI まで、公開レイヤの手動昇格フロー一式が実装完了した。**

このフェーズで完成した公開レイヤのスタック:

```
run_batch.py (artifact生成)
  → render_publish_markdown.py (Markdown変換)
    → build_publication_handoff.py (manifest/latest pointer)
      → rebuild_publication_latest.py (決定論的再構築)
        → run_publication_pipeline.py (operator entrypoint)

candidate layer                    release layer
publication_handoff_latest*.json → publication_release_latest*.json
                                 → publication_release_ledger.jsonl (audit)

review/promote CLIs:
  review_publication_candidate.py  (read-only 差分確認)
  promote_publication_candidate.py (kind指定 safe promotion)
  promote_publication_release.py   (manifest指定 promotion)
  show_publication_release_status.py (read-only status確認)
  verify_publication_release_state.py (verify/repair)
```

直近で完了している主要項目:

- alias 拡充の保守フロー整備
- Google Trends / Google Suggest / YouTube Suggest の 3 ソース収集・比較
- source health (`ok / review_only / blocked`) + console summary の最小実装
- publish-ready artifact (`schema_version=publish-ready/v1`) の生成契約
- Markdown renderer + YAML front matter (CMS/static site 向け handoff)
- handoff manifest / latest pointer の決定論的再構築
- publication pipeline CLI (artifact → markdown → handoff を一括)
- manual release gate: manifest 指定 / kind 指定の 2 promotion CLI
- release ledger (append-only JSONL audit trail)
- read-only status viewer + verify/repair CLI
- candidate vs release review CLI (pre-promotion 差分確認)
- thin wrapper (`release_promotion.py`) で 2 CLI がコア昇格ロジックを共有
- テスト: `test_promote_publication_candidate.py` 20 tests / 全体 154 tests PASS

**次フェーズ: 実運用確認・実データ検証**（週次昇格フローのリハーサル、実 DB での rank shift サンプル収集）

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

## 次アクション（実運用確認フェーズ）

1. 実週次データを使って `run_publication_pipeline.py → review_publication_candidate.py → promote_publication_candidate.py → verify_publication_release_state.py` のフロー全体を一度通しで確認する
2. 実 DB で rank shift が発生する週次のサンプルを収集し、compare review の実運用を確認する
3. GS / YT の source-wide failure と partial failure を再現する fixture / pytest を追加する（collector sidecar status artifact への接続は任意）

**未対応事項（現状許容）:**
- review 後の re-run による再昇格は現状 operator 手動で対応（自動 re-review pipeline は未実装）
- `--force` flag は未実装（同一 manifest への再昇格は `--allow-same-week` で代替）

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

## 2026-04-10 Safe Candidate Promotion CLI Update

- added `scripts/promote_publication_candidate.py` as a safe operator entrypoint for kind-based promotion
- added `src/publication/candidate_promotion.py` with eligibility check logic
- added `src/publication/release_promotion.py` to share core promotion logic between CLIs
- refactored `scripts/promote_publication_release.py` to use `release_promotion.py` (no behavior change)
- promotion eligibility rules:
  - `no_release` / `candidate_newer_than_release`: default promote
  - `candidate_differs_same_week`: requires `--allow-same-week`
  - `candidate_older_than_release`: requires `--allow-rollback` (records as `rollback_promote`)
  - `no_candidate` / `same_manifest` / `candidate_not_publish_ready`: always rejected
- `--dry-run` shows promotion plan without writing files
- `--json` emits machine-readable output for scripted workflows
- `--copy-markdown` copies stable release Markdown as before
- existing `promote_publication_release.py --manifest <path>` is retained unchanged
- both promotion CLIs share `src/publication/release_promotion.py`

Tests added in this step:

- `tests/test_promote_publication_candidate.py` (20 tests, all PASS)
  - ranking no_release promote
  - ranking candidate_newer promote
  - compare candidate_newer promote
  - same_manifest reject
  - candidate_not_publish_ready reject
  - no_candidate reject
  - candidate_differs_same_week reject without flag / allow with flag
  - candidate_older_than_release reject without flag / rollback_promote with flag
  - dry-run writes nothing
  - --json success / dry-run / rejection output
  - --copy-markdown creates stable file
  - schema validation failure
  - unit tests: check_promotion_eligibility for each status

---

## 2026-04-10 Manifest Immutability — generated_at 付き dated manifest 実装

### 何が直ったか

同週 re-run で manifest が上書きされ `verify` が ERROR になる問題を解消した。

**変更前**: `publication_handoff_{week_token}.json`（例: `publication_handoff_20260406.json`）
- 同じ週を再実行すると同一ファイルを上書き
- release pointer が古い manifest 内容を参照したままになり `verify` が ERROR

**変更後**: `publication_handoff_{week_token}_{gen_token}.json`（例: `publication_handoff_20260406_20260410T001000.json`）
- 同じ週を再実行しても異なる `generated_at` → 異なるファイル名 → 上書きなし
- 両 manifest が `data/output/` に共存
- `rebuild_publication_latest.py` の `week → generated_at → filename` 選択ロジックが latest を正しく更新
- `review_publication_candidate.py` が manifest path の差異から `candidate_differs_same_week` を正しく検出
- 旧形式（週だけのファイル名）は glob パターン `{prefix}*.json` で引き続き拾われる（後方互換あり）

### 実装詳細

- `src/publication/handoff_manifest.py`
  - `_generated_at_token(generated_at)` 追加: ISO 文字列 → `YYYYMMDDTHHMMSS` 変換（Z / +00:00 安全処理）
  - `_path_for_manifest()` に `generated_at` 引数を追加し新形式 filename を生成
  - `handoff_output_paths()` に `generated_at` 必須キーワード引数を追加
  - `iter_dated_manifest_paths()` はそのまま（glob `{prefix}*.json` が旧形式・新形式の両方を拾う）
- `scripts/build_publication_handoff.py`
  - `handoff_output_paths()` 呼び出しに `generated_at=artifact_payload["generated_at"]` を追加

### テスト状況

- `tests/test_build_publication_handoff.py`: 期待 manifest path を新形式に更新（3件）
- `tests/test_run_publication_pipeline.py`: 期待 manifest path を新形式に更新（5件）+ same-week re-run テスト追加（1件）
- `tests/test_rebuild_publication_latest.py`: 新形式 filename テスト（1件）+ 旧形式/新形式混在テスト（1件）追加
- `tests/test_review_publication_candidate.py`: 新形式 filename で `candidate_differs_same_week` 確認テスト（1件）追加
- **158 tests PASS（154 → +4）**

### 後方互換の扱い

- `iter_dated_manifest_paths()` は `{prefix}*.json` glob で旧形式・新形式どちらも取得
- `data/output/` に旧形式ファイルが残っていても `rebuild_publication_latest` は正しく動作する
- 旧形式ファイルは migration 不要。共存で OK

### 未対応事項

- `review` の `same_manifest` 判定は manifest path の一致で行う。新形式化により `same_manifest` が出る状況は「同一 generated_at で二重実行した場合」のみとなり、実運用で起きる可能性は大幅に低下した

---

## 2026-04-10 実運用確認フェーズ — End-to-End 検証結果

対象週: `2026-04-06` / Python 3.13.1 / 154 tests PASS

### 実行コマンドと結果

| ステップ | コマンド | 結果 |
|---|---|---|
| 1a | `run_publication_pipeline.py --week 2026-04-06 --use-db --only-commercial` | `publish_hold` (health=review_only, YT missing) |
| 1b | YT mock import → pipeline 再実行 | `publish_hold` 継続 (GT 4/13, GS 4/13, YT 4/13 で coverage 不足) |
| 1c | `run_publication_pipeline.py --from-artifact tests/fixtures/publish_ready_ranking_artifact.json` | ranking `publish_ready=yes`, handoff/latest 生成 OK |
| 1d | `run_publication_pipeline.py --from-artifact tests/fixtures/publish_ready_compare_artifact.json` | compare `publish_ready=yes` OK |
| 2 | `review_publication_candidate.py --kind all --verbose` | `no_release` / `promotable=True` |
| 3a | `promote_publication_candidate.py --kind ranking --dry-run --json` | JSON 出力 OK, ファイル書き込みなし確認 |
| 3b | `promote_publication_candidate.py --kind ranking --copy-markdown` | release pointer + ledger + stable markdown 生成 OK |
| 3c | `promote_publication_candidate.py --kind compare --copy-markdown` | compare release OK |
| 4 | `show_publication_release_status.py --kind all --limit 5 --verbose` | 昇格記録2件・履歴表示 OK |
| 5 | `verify_publication_release_state.py --kind all` | `overall_status: OK` |

### 発見した運用課題

**課題1 (重要): 同週 re-run でmanifest が上書きされ verify が ERROR になる**

- 問題: `run_publication_pipeline.py` が同週を再実行すると `publication_handoff_{week}.json` を上書きする
- 症状: release pointer が古い内容を参照しているのに manifest が更新され、`verify` が `pointer_manifest_*_mismatch` を5件検出
- `review` は `same_manifest` (no action) と報告して見逃す
- `repair` は ledger との整合が取れないため失敗
- **回復パス**: `promote_publication_release.py --manifest data/output/publication_handoff_{week}.json --copy-markdown` で直接再昇格 → `verify` が OK になる
- 根本原因: manifest filename が週単位 (`publication_handoff_20260406.json`) のため、同週re-runが常に上書きする

**課題2 (バグ修正済み): `resolve_release_reference` の project root フォールバックでテスト汚染**

- 問題: `src/publication/release_pointer.py` の `resolve_release_reference()` が、CWD に存在しない場合に project root へフォールバックしていた
- 症状: e2e テスト後に `data/output/` にファイルが存在すると、test の `tmp_path` で削除したファイルが project root から解決され、`manifest_missing` / `markdown_missing` が検出されなくなる → 2 tests FAIL
- **修正済み**: フォールバックを削除し CWD 解決のみに統一 (コミット済み)
- **修正後: 154 tests PASS**

**課題3: 実 DB の coverage が低く publish_ready=true が得られない**

- 現状: 21 active models のうち GT/GS/YT データがある商用モデルは 4〜4〜4 のみ
- 影響: `run_batch.py` のヘルス判定が常に `review_only` → pipeline は `publish_hold` のみ生成
- YT mock import 後でも同様: coverage warning が GS/GT/YT 全ソースに出る
- **暫定対応**: `--from-artifact` で `publish_ready=true` fixture を使って promotion フローを確認
- **実対応**: 実週次で商用モデル全体を対象にした collector 実行と import が必要

**課題4: `review` が same_manifest の場合に manifest 内容変化を検知しない**

- `review_publication_candidate.py` は manifest path の一致のみで `same_manifest` を判定する
- 同週 re-run で manifest 内容が変わっても `same_manifest` と報告し、operator がスルーしやすい
- `verify` が後から ERROR を出す仕組みは機能しているが、review 段階での早期検知がない

### 実運用で手動介入が必要なケース

| ケース | 状態 | 対応 |
|---|---|---|
| 同週 re-run 後に release が古い | `verify` → ERROR | `promote_publication_release.py --manifest` で再昇格 |
| `review_only` health でも内部確認用に昇格したい | `publish_hold` が生成されるが promote は拒否 | 現状 promote 不可。fixture 経由の `--from-artifact` で代用 |
| 誤昇格のロールバック | `--allow-rollback` で古い manifest を昇格 | ledger に `rollback_promote` として記録される |
| release pointer と ledger の不整合 | `verify` → ERROR / `repair` 失敗 | 上記の再昇格パスで回復。`repair` は ledger 整合が前提 |

### 追加すべき fixture / test 候補

1. **GS source-wide failure fixture**: `overall=review_only` を再現し、pipeline が `publish_hold` を生成することを pytest で固定する
2. **YT source-wide failure fixture**: 同上
3. **同週 re-run → manifest 上書き → verify ERROR → 再昇格回復** のシナリオを integration test で固定する
4. **review が `same_manifest` を返すが manifest 内容が変わっているケース**を検知する test（現在は未カバー）

### 次に直すべき優先1件

**「同週 re-run で manifest が上書きされ verify が ERROR になる」問題への設計改善**
- 案A: manifest filename に `generated_at` のタイムスタンプを含める (`publication_handoff_20260406_20260410T090000.json`)。同週複数 manifest が残り、latest pointer が最新を指す。既存の `rebuild_publication_latest.py` の決定論的選択がそのまま使える
- 案B: すでに promote 済みの週の manifest re-run は警告のみで上書き拒否する (--force が必要)
- **推奨: 案A**（manifest の不変性を高め、既存の latest 再構築ロジックが活きる。`--force` 実装も不要になる）

---

## 2026-04-10 GS / YT Source-wide Failure Regression

Added fixture-backed regression coverage for secondary source-wide failures:

- `tests/fixtures/publish_artifact_gs_source_wide_failure_fixture.json`
- `tests/fixtures/publish_artifact_youtube_source_wide_failure_fixture.json`
- `tests/test_publication_source_wide_failure.py`
- `tests/test_run_batch_health.py` source-wide GS / YT health cases

What this protects:

- GS source-wide failure now degrades run health to `review_only`, not `ok`
- YT source-wide failure now degrades run health to `review_only`, not `ok`
- `run_batch.py --output-publish-artifact` still emits a `publish-ready/v1` artifact with `publish_ready=false`
- artifact health keeps the source-level missing reason (`GS/YT metrics unavailable (0/2 models)`)
- Markdown and handoff generated from the artifact become `content_kind=publish_hold`
- hold reason keeps the review-only publication gate reason:
  `source coverage is incomplete; ranking and compare are advisory only`

Implementation note:

- Collector behavior was not changed. The health gate now treats a missing optional secondary source across all expected models as review-affecting.

Verification:

- `uv run --with-requirements requirements.txt ...` could not be executed on this PC because `uv` is not installed / not on PATH.
- Equivalent local verification was run with Python 3.13.1 and pytest 9.0.3:
  - `python -m pytest tests/test_run_batch_health.py tests/test_publication_source_wide_failure.py tests/test_run_batch_publish_artifact.py tests/test_run_publication_pipeline.py -q` -> 20 passed
  - `python -m pytest -q` -> 162 passed

Remaining unchecked:

- Real DB full coverage still needs a weekly dataset where GT / GS / YT all cover the commercial model set enough to produce `publish_ready=true` without fixture substitution.

---

## 2026-04-10 Commercial Coverage Audit

Added `docs/COMMERCIAL_SOURCE_COVERAGE_20260406.md` to make the real DB coverage gap explicit before trying to force `publish_ready=true`.

Target week: `2026-04-06`

Current publication-health denominator:

- 13 entities in `run_batch.py --use-db --week 2026-04-06 --only-commercial`
- 11 resolved model rows
- 2 brand-only rows with `model_id=NULL`

Coverage:

- GT `google_trends_interest`: 4/13
- GS `search_suggest_count`: 4/13
- YT `youtube_suggest_count`: 4/13

Present in all three gate sources:

- `Concept2 SkiErg`
- `Life Fitness T5`
- `Precor TRM 445`
- `TECHNOGYM Run`

Resolved model gaps shared by GT / GS / YT:

- `CYBEX 770T`
- `Concept2 Model D`
- `Life Fitness 95T`
- `Life Fitness IC5`
- `Life Fitness IC7`
- `Matrix A50`
- `TECHNOGYM Run Now`

Data hygiene blocker:

- `JOHNSON (model_id NULL)`
- `TECHNOGYM (model_id NULL)`

Next shortest route:

1. Resolve or exclude the two brand-only rows from the publication-health denominator.
2. Add model seeds for the seven resolved missing models.
3. Run GT / GS / YT collectors with the new seed IDs and `--import-db --replace-existing --skip-unresolved --only-commercial`.
4. Rerun `run_batch.py --use-db --week 2026-04-06 --only-commercial --output-publish-artifact` and confirm `overall=ok publish_ready=yes`.

---

## 2026-04-10 Commercial Denominator + Seed Prep

Decision:

- `JOHNSON (model_id NULL)` and `TECHNOGYM (model_id NULL)` are brand-only source rows, not collector-fillable model targets.
- `DbCollector(..., only_commercial=True)` now excludes `sm.model_id IS NULL` so publication-health coverage is based on resolved model rows only.
- This changes the 2026-04-06 DB-backed commercial denominator from 13 entities to 11 resolved model targets.

Seeds added to `config/trends/seed_queries.json`:

- `cybex_770t_model` -> `CYBEX::770T`
- `concept2_model_d_model` -> `Concept2::Model D`
- `lifefitness_95t_model` -> `Life Fitness::95T`
- `lifefitness_ic5_model` -> `Life Fitness::IC5`
- `lifefitness_ic7_model` -> `Life Fitness::IC7`
- `matrix_a50_model` -> `Matrix::A50`
- `technogym_run_now_model` -> `TECHNOGYM::Run Now`

Mock fixture coverage was also added for the seven seed IDs in GT / GS / YT so local collector tests and mock fallback do not break before live import.

Expected current gate after denominator cleanup, before live collection/import:

- GT `google_trends_interest`: 4/11
- GS `search_suggest_count`: 4/11
- YT `youtube_suggest_count`: 4/11
- `publish_ready=false` / `review_only` remains expected until the seven added seeds are collected and imported for all three gate sources.

Next action:

1. Run GT / GS / YT collectors for the seven new seed IDs with `--import-db --replace-existing --skip-unresolved --only-commercial`.
2. Rerun `python scripts/run_batch.py --use-db --week 2026-04-06 --only-commercial --show-metric-details --output-publish-artifact`.
3. Confirm whether GT / GS / YT all reach 11/11 and `publish_ready=true`.

---

## 2026-04-10 Commercial Full Coverage Live Import

Target week: `2026-04-06`

The seven added commercial model seeds were collected and imported for GT / GS / YT, then the publication gate was rerun against the real DB.

Collector results:

- GT first 7-seed auto run: `mode_used=live`, `observations=84`, `import_rows=42`, `errors=4`, import OK 42 / skipped 0 / unresolved 0
  - succeeded initially: `lifefitness_ic5_model`, `lifefitness_ic7_model`, `matrix_a50_model`
  - initial gaps: `cybex_770t_model`, `concept2_model_d_model`, `lifefitness_95t_model`, `technogym_run_now_model`
- GS 7-seed auto run: `mode_used=live`, `observations=125`, `import_rows=14`, `errors=0`, import OK 14 / skipped 0 / unresolved 0
- YT 7-seed auto run: `mode_used=live`, `observations=76`, `import_rows=14`, `errors=0`, import OK 14 / skipped 0 / unresolved 0
- GT live retries:
  - `technogym_run_now_model`: `observations=28`, `import_rows=14`, import OK
  - `lifefitness_95t_model`: `observations=28`, `import_rows=14`, import OK after retry
  - `cybex_770t_model`: initially live no data; after GT query expansion, `observations=70`, `import_rows=14`, import OK
  - `concept2_model_d_model`: initially live no data; after GT query expansion, `observations=70`, `import_rows=14`, import OK

Seed query adjustment:

- `cybex_770t_model` GT query variants were expanded to include `cybex 770 t`, `cybex 770`, and `サイベックス 770t`.
- `concept2_model_d_model` GT query variants were expanded to include `concept2 rowerg`, `concept 2 rower`, and `コンセプト2 ローイング`.
- Canonical targets were not changed.

Final gate result:

```text
[NORMALIZE] 11 models
[HEALTH] overall=ok publish_ready=yes
[HEALTH] GT=ok(11/11) GS=ok(11/11) YT=ok(11/11)
```

Publication pipeline result:

```text
[PIPELINE] content_kind=ranking
[PIPELINE] publish_ready=yes
[PIPELINE] artifact=data/output/publish_ready_20260406.json
[PIPELINE] markdown=data/output/publish_ready_20260406.md
[PIPELINE] handoff=data/output/publication_handoff_20260406_20260410T190547.json
[PIPELINE] latest=data/output/publication_handoff_latest.json
```

Remaining gaps:

- No 2026-04-06 publication gate coverage gap remains for the 11 resolved commercial model rows.
- The two brand-only `model_id=NULL` rows remain excluded from the publication-health denominator and are still source-data hygiene follow-up items.
- Some newly covered GT values are zero-valued observations, especially `Concept2 Model D`, `Life Fitness 95T`, `Life Fitness IC5`, `Life Fitness IC7`, `Matrix A50`, and `TECHNOGYM Run Now`; this is acceptable for coverage but still worth reviewing for signal quality before editorial publication.

Verification:

- `uv run --with-requirements requirements.txt python scripts/run_batch.py --use-db --week 2026-04-06 --only-commercial --show-metric-details --output-publish-artifact` -> PASS, `publish_ready=yes`
- `uv run --with-requirements requirements.txt python scripts/run_publication_pipeline.py --week 2026-04-06 --use-db --only-commercial` -> PASS, ranking handoff/latest generated
- `uv run --with-requirements requirements.txt python scripts/check_source_metrics.py --source-name google_trends --week 2026-04-06` -> 11 rows

Next action:

1. Run the weekly operator flow on the new candidate: `review_publication_candidate.py --kind all`, then promote the ranking candidate if the review is acceptable.
2. Inspect the low/zero GT rows in the editorial review so `publish_ready=true` is treated as a gate pass, not as a content-quality guarantee.

---

## 2026-04-10 Ranking Candidate Release Promotion

Target candidate:

- kind: `ranking`
- week: `2026-04-06`
- handoff: `data/output/publication_handoff_20260406_20260410T190547.json`
- markdown: `data/output/publish_ready_20260406.md`

Review result:

- `review_publication_candidate.py --kind all --verbose`
  - ranking: `status=no_release`, `promotable=True`
  - compare: `status=no_release`, `promotable=True`
- `review_publication_candidate.py --kind all --json`
  - ranking candidate points to `publication_handoff_20260406_20260410T190547.json`
  - compare was reviewed but intentionally not promoted in this operation

Editorial / signal check:

- Ranking Markdown only features the top 3 models and uses candidate/review language:
  - `Concept2 SkiErg`
  - `TECHNOGYM Run`
  - `Life Fitness T5`
- Low/zero GT rows are not directly promoted as strong public claims in the generated Markdown.
- Continue treating `publish_ready=true` as a coverage gate pass, not a content-quality guarantee.

Promotion result:

```text
[CANDIDATE-PROMOTE] kind=ranking review_status=no_release
[CANDIDATE-PROMOTE] manifest=data/output/publication_handoff_20260406_20260410T190547.json
[RELEASE] data/output/publication_release_latest.json
[RELEASE-MARKDOWN] data/output/publication_release_latest.md
[RELEASE-LEDGER] data/output/publication_release_ledger.jsonl
```

Verification:

- `verify_publication_release_state.py --kind all`
  - `overall_status=WARNING`
  - ranking: `status=OK`, issues none
  - compare: warning only because compare has no release pointer / stable markdown; this is expected because this operation promoted ranking only
- `verify_publication_release_state.py --kind ranking`
  - `overall_status=OK`
  - ranking release points to `publication_handoff_20260406_20260410T190547.json`
  - latest ledger action: `promote`
- `show_publication_release_status.py --kind ranking --limit 5 --verbose`
  - current release week: `2026-04-06`
  - slug: `training-trends-20260406`
  - promoted_at: `2026-04-10T19:16:44`
  - stable markdown updated: yes

Storage note:

- Release pointer / stable Markdown / ledger are under `data/output/`, which is ignored by Git for generated operational output.
- This `PROJECT_STATUS.md` entry is the committed handoff record for the promotion event.

Next action:

1. If compare publication is desired, separately review and promote the compare candidate.
2. Run `verify_publication_release_state.py --kind all` after compare promotion to clear the expected compare warnings.

---

## 2026-04-10 Compare Candidate Release Promotion

Target candidate:

- kind: `compare`
- week: `2026-04-06`
- handoff: `data/output/publication_handoff_compare_20260406.json`
- markdown: `data/output/publish_ready_compare_20260406.md`

Review result:

- `review_publication_candidate.py --kind compare --verbose`
  - compare: `status=no_release`, `promotable=True`
  - same_manifest / same_week / rollback 判定ではなく、初回 promotion として eligible
- `review_publication_candidate.py --kind compare --json`
  - candidate `content_kind=compare`
  - `compare_mode=True`
  - slug: `training-trends-compare-20260406`

Promotion result:

```text
[CANDIDATE-PROMOTE] kind=compare review_status=no_release
[CANDIDATE-PROMOTE] manifest=data/output/publication_handoff_compare_20260406.json
[RELEASE] data/output/publication_release_compare_latest.json
[RELEASE-MARKDOWN] data/output/publication_release_compare_latest.md
[RELEASE-LEDGER] data/output/publication_release_ledger.jsonl
```

Verification:

- `verify_publication_release_state.py --kind all`
  - `overall_status=OK`
  - ranking: `status=OK`, issues none
  - compare: `status=OK`, issues none
- `show_publication_release_status.py --kind all --limit 5 --verbose`
  - ranking release:
    - week: `2026-04-06`
    - slug: `training-trends-20260406`
    - promoted_at: `2026-04-10T19:16:44`
  - compare release:
    - week: `2026-04-06`
    - slug: `training-trends-compare-20260406`
    - promoted_at: `2026-04-10T19:25:10`
    - `compare_mode=True`

Current publication state:

- 2026-04-06 ranking: release 済み
- 2026-04-06 compare: release 済み
- `verify --kind all`: OK

Storage note:

- Release pointer / stable Markdown / ledger are generated under `data/output/`, which is ignored by Git.
- This `PROJECT_STATUS.md` entry is the committed handoff record for the compare promotion and all-kind verification closure.

Next action:

1. Treat 2026-04-06 publication operations as closed unless editorial copy changes are needed.
2. For the next weekly run, repeat the operator flow: pipeline -> review -> promote ranking/compare -> verify all -> status.

---

## 2026-04-10 Publication Dashboard View

Purpose:

- 週次 publication 運用を、ユーザーが Google Sheets / Excel で見てすぐ分かる運用ビューにする。
- 正本は引き続き repo / Markdown / `data/output/` の生成物 / release ledger。今回のシートは正本ではなく見える化ビュー。

Added files:

- `ops/publication_dashboard/publication_weekly_view.xlsx`
- `ops/publication_dashboard/Weekly_Overview.csv`
- `ops/publication_dashboard/Coverage_Check.csv`
- `ops/publication_dashboard/Release_Log.csv`
- `ops/publication_dashboard/README.md`
- `ops/publication_dashboard/sample_weekly_update.md`
- `ops/publication_dashboard/generate_xlsx.py`

Sheet structure:

- `Weekly_Overview`
  - 週ごとの状態を1行で確認するシート
  - 2026-04-06 は `Closed`, `publish_ready=yes`, `ranking / compare closed`, GT/GS/YT `11/11`, `verify all=OK`
- `Coverage_Check`
  - GT / GS / YT coverage を週単位で見るシート
  - 2026-04-06 は対象モデル数 11、各 source present 11 / missing 0、gate `OK`
  - brand-only `model_id=NULL` 2件は denominator 外として備考に記録
- `Release_Log`
  - review / promote / verify / status の操作履歴を残すシート
  - 2026-04-06 の ranking / compare release 完了行を初期データとして投入

README / operation notes:

- `README.md` に「正本ではなく運用ビュー」であること、各シート/列の意味、毎週金曜の更新手順、xlsx 再生成コマンドを記載。
- `sample_weekly_update.md` に operator 向けの短い手順メモを追加。

Verification:

- CSV row/column check:
  - `Weekly_Overview.csv`: 2 rows / 16 cols
  - `Coverage_Check.csv`: 2 rows / 15 cols
  - `Release_Log.csv`: 3 rows / 13 cols
- xlsx package check:
  - `xl/worksheets/sheet1.xml`
  - `xl/worksheets/sheet2.xml`
  - `xl/worksheets/sheet3.xml`
  - `xl/workbook.xml`
- `python -m py_compile ops/publication_dashboard/generate_xlsx.py` -> PASS

Next action:

1. 必要に応じて `publication_weekly_view.xlsx` を Google Drive にアップロードし、Google Sheets として開く。
2. 次週以降は operator flow 完了後に CSV / xlsx view を更新し、重要結果は必ず `PROJECT_STATUS.md` に戻す。

---

## 2026-04-10 Publication Dashboard Drive Placement

Purpose:

- 週次 publication 運用ビューを Google Drive の project 配下に配置し、ユーザーが Google Sheets として確認できる状態にした。
- Drive 版は正本ではなく運用ビュー。正本は引き続き repo / Markdown / `data/output/` / release ledger / `PROJECT_STATUS.md`。

Drive placement:

- Saved to: `hirayama-ai-workspace/workspace-export/training-trend-analyzer/ops/publication_dashboard`
- File name: `training-trend-analyzer_週次publication運用ビュー`
- File URL: `https://docs.google.com/spreadsheets/d/1eFN_VjvOQ98ZreyqKO9aSrmbi5WBXFIjwzIv-uy1PJY/edit?usp=drivesdk`

Operation note:

- `ops` and `publication_dashboard` folders did not exist in Drive and were created under the training-trend-analyzer project folder.
- Duplicate check before upload found no same-name file in the target dashboard folder.
- Next weekly updates should regenerate the local workbook with `python ops/publication_dashboard/generate_xlsx.py`, then replace or update the Drive view as needed.

---

## 再開用要約（2026-04-10 時点）

**現在地:** publication pipeline → candidate promotion CLI まで実装完了。commercial denominator / seed prep と 2026-04-06 の GT / GS / YT live import が完了し、実DBで `publish_ready=true` を確認済み。2026-04-06 ranking / compare candidates はどちらも release 昇格済みで `verify --kind all` OK。週次運用を見える化する `ops/publication_dashboard/` を追加し、Google Drive の project 配下にも Google Sheets 運用ビューとして配置済み。164 tests PASS。

**できること:**
- `run_publication_pipeline.py` で weekly artifact / Markdown / handoff manifest を一括生成
- `review_publication_candidate.py --kind all` で candidate vs release の差分を確認
- `promote_publication_candidate.py --kind ranking` で最新 candidate を release layer へ昇格
- `show_publication_release_status.py` / `verify_publication_release_state.py` で audit / 整合確認
- `verify` は同週 re-run によるマニフェスト上書きを ERROR 検知、`promote_publication_release.py --manifest` で回復可能

**次にやること:**
1. 低/ゼロ値の GT 行を editorial review で確認し、公開本文に出す表現を調整する
2. 次週データで同じ operator flow を再実行し、dashboard view を更新する
3. Drive 上の運用ビューは正本ではなく見える化ビューとして扱い、正式な状態更新は `PROJECT_STATUS.md` に戻す
4. review が `same_manifest` を返すが manifest 内容が変わっているケースを検知する test を追加する

**注意点:**
- 実 DB の 2026-04-06 commercial gate は GT/GS/YT 各11/11 に到達したが、GT は一部0値が多い。`publish_ready=true` は coverage gate 通過であり、信号の強さは別途レビューする
- `verify --kind all` は ranking / compare release 後に OK
- 同週 re-run は新形式 manifest filename (generated_at token 付き) で別ファイルに書き出されるため上書きしない。`review` が `candidate_differs_same_week` を検出し `--allow-same-week` で昇格できる
