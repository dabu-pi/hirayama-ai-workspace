# WEB_PUBLICATION_PLAN.md

最終更新: 2026-04-09

## 1. 目的

この文書は、`training-trend-analyzer` の外部向け目的を明文化するための補助文書です。

このプロジェクトの外部向け目的は、ジムオーナー、トレーニー、業界関係者が市場トレンドや注目マシン動向を把握できるよう、Web で継続発信できる情報基盤を作ることです。

ここでいう「公開」は、内部の ranking / compare / review 結果をそのまま出すことではありません。review 済みで source health が確認された結果だけを、公開向けに再構成して出すことを意味します。

## 2. 公開対象

- ジムオーナー
  導入・更新候補の市場感や注目カテゴリを把握したい人
- トレーニー
  どのマシン系統が注目されているか、どのカテゴリが伸びているかを知りたい人
- 業界関係者
  週次の市場変化、注目カテゴリ、機種群の動向を俯瞰したい人

## 3. 何を公開する想定か

- 注目カテゴリ
  週次で伸びているカテゴリや関心が集まっている分野
- 伸びているマシン系統
  具体機種名の羅列ではなく、どの系統が伸びているか
- 比較トレンド
  GT / GS / YT の比較から見える傾向を、公開向けの言葉に翻訳したもの
- 週次の変化要因
  `top drivers` や review 補助を元にした説明的要約

## 4. 何は公開しないか

- raw JSON や raw collector 出力そのもの
- 実験中の暫定値や source health 未確認の結果
- `review only` / `blocked` の run を通常品質として見せること
- 内部仕入れ判断ロジックの全文や、内部向けの細かい weight / threshold 調整ロジックの丸出し
- DB 内の行データそのもの

## 5. 公開品質を担保するために必要なもの

- source health
  どの source が使えたか、欠落が無いかを確認する
- review-only 判定
  内部では見せてよくても、公開には回さない run を分ける
- fallback 時の注意表示
  mock fallback や source 欠落があった週を通常品質扱いしない
- fixture / regression による再現性
  同じ週次結果や表示契約を再現できるようにする
- compare / review 補助
  変化要因を公開向け要約へ変換するための材料にする

## 6. 内部向けと外部向けの接続

公開レイヤは、内部の次のレイヤを順に通った結果だけを使う。

1. collectors
2. ranking
3. compare
4. review 補助
5. source health / fallback 判定
6. publish-ready artifact
7. Web 公開

原則:

- public layer は internal layer の上に乗る
- raw collector 出力から直接公開しない
- review 済みで health を通った結果だけを公開候補にする
- current artifact consumer must validate `schema_version`, and only `publish-ready/v1` is supported

## 7. 内部向け出力と公開向け出力の差

### 内部向け

- ranking table
- compare table
- raw delta
- Impact / Hint / rank path
- source health の詳細
- tuning や仕入れ判断に使う詳細情報

### 公開向け

- 注目カテゴリ
- 伸びているマシン系統
- 比較トレンドの解説
- 週次の変化要因の要約
- 注意表示付きの公開可否判定

## 8. fallback と公開品質の関係

fallback 設計は、内部向けの運用安定化だけでなく、外部向け公開品質にも直結する。

公開時の原則:

- `ok`:
  review 後に公開候補にできる
- `review_only`:
  内部 review には使えるが、通常公開しない
- `blocked`:
  公開しない

fallback が使われた週に公開する場合でも、通常品質と同じ見せ方はしない。必要なら注意表示付きの限定的な公開か、公開見送りにする。

## 9. 現段階の非ゴール

- Web サイトそのものの実装を急ぐこと
- collector の raw data を公開すること
- degraded 状態を隠して公開運用だけ先に始めること

## 10. 次に整理すべきこと

1. publish-ready artifact の最小形式を決める
2. `review only` / `blocked` を public layer にどう伝えるか決める
3. 公開向けに出す週次 summary の最小テンプレートを設計する

## 2026-04-09 Source Health �ǋL

- internal layer �ɂ� `ok / review_only / blocked` �̍ŏ� source health ����� console summary ��������
- public layer �͂��̔����b��O��ɁApublish-ready / not publish-ready �𕪂���
- `review_only` �� `blocked` ��ʏ���J�i���Ƃ��Č����Ȃ��A�Ƃ������j�͈ێ�����

## 2026-04-09 Publish-ready Artifact Update

The public layer now has a planned input contract:

- input:
  `data/output/publish_ready_YYYYMMDD.json`
- not input:
  raw collector output, full CLI tables, CSV row dumps

Publication handling:

- `publish_ready=true`
  can move into editorial review
- `publish_ready=false`
  hold for internal review only
- blocked run
  no publication artifact is emitted

Reference:

- [PUBLISH_READY_ARTIFACT_SPEC.md](/C:/hirayama-ai-workspace/workspace/training-trend-analyzer/docs/PUBLISH_READY_ARTIFACT_SPEC.md)

## 2026-04-10 Markdown Renderer Update

The first public-layer consumer is now the Markdown renderer.

- input:
  publish-ready artifact JSON
- output:
  `data/output/*.md`
- `publish_ready=true`:
  draft Markdown for publication workflow
- `publish_ready=false`:
  hold Markdown for internal review only

This keeps the publication layer artifact-first and avoids raw CLI table reuse.

## 2026-04-11 Front Matter Update

Renderer output now adds minimal YAML front matter so the Markdown can hand off cleanly to:

- CMS draft import
- static site content folders
- manual editorial publication flows

Current minimum metadata:

- `schema_version`
- `content_kind`
- `week`
- `generated_at`
- `publish_ready`
- `title`
- `slug`
- `summary`
- `internal_reference`
- `publication_notice` when present
- `compare_mode` for compare artifacts
- `hold_reason` for hold documents

This metadata is renderer-derived from the artifact and does not expand the artifact schema itself.

## 2026-04-10 Handoff Index Update

Public consumers now have a thin machine entrypoint after Markdown rendering:

- dated handoff manifest
- latest pointer

Policy:

- publish-ready ranking candidate:
  `publication_handoff_latest.json`
- publish-ready compare candidate:
  `publication_handoff_compare_latest.json`
- hold-only output:
  `publication_handoff_hold_latest.json`

This keeps normal publication pickup separate from hold-only review output,
but these are still candidate pointers, not release approval.

## 2026-04-10 Publication Pipeline Update

For operators, the main entrypoint is now the publication pipeline CLI.

- ranking:
  `python scripts/run_publication_pipeline.py --week <week> --use-db --only-commercial`
- compare:
  `python scripts/run_publication_pipeline.py --week <week> --use-db --only-commercial --compare-source-sets`

This keeps the internal layering intact while making the public-prep workflow reproducible in one command.

## 2026-04-10 Deterministic Latest Rebuild Update

Latest pointers are now rebuildable from the dated manifest group for each kind.

- ranking latest:
  selected from publish-ready ranking manifests only
- compare latest:
  selected from publish-ready compare manifests only
- hold latest:
  selected from hold-only manifests only

Selection order is deterministic:

1. newer `week`
2. newer `generated_at`
3. manifest filename tie-break

Operationally this means the candidate layer can treat the dated manifests as the
source of truth and regenerate the thin latest pointers with:

```bash
python scripts/rebuild_publication_latest.py --output-dir data/output
```

The publication pipeline still updates latest automatically, but it now does so
through this same manifest-scan rule instead of trusting execution order.

## 2026-04-11 Manual Release Promotion Update

The public consumer entrypoint is now the release layer, not the candidate latest layer.

Candidate layer:

- dated handoff manifests
- deterministic candidate latest pointers
- operator review input

Release layer:

- `publication_release_latest.json`
- `publication_release_compare_latest.json`
- `publication_release_ledger.jsonl`
- optional stable Markdown copies for simple file-based pickup

Rules:

- only manually promoted dated handoff manifests enter the release layer
- only `ranking` / `compare` with `publish_ready=true` are promotable
- `publish_hold` stays in candidate / internal review space and is not promoted by default
- rollback is allowed only as an explicit operator action that promotes an older dated manifest
- public consumer reads the release pointer
- operator / audit review reads the append-only release ledger

Operator flow:

1. run the publication pipeline to produce dated candidate outputs
2. inspect dated manifest and dated Markdown
3. promote the approved dated manifest with `scripts/promote_publication_release.py`
4. release pointer is updated and the release ledger appends an audit record
5. public consumer reads the release pointer or the stable release Markdown copy

Operator / audit check path:

- `scripts/show_publication_release_status.py --kind ranking`
- `scripts/show_publication_release_status.py --kind compare`
- `scripts/show_publication_release_status.py --kind all --limit 10`
- `scripts/verify_publication_release_state.py --kind all`
- `scripts/verify_publication_release_state.py --kind ranking --repair`

This read-only CLI is for human confirmation of:

- what is currently released
- what was recently promoted
- whether a rollback was recorded

Maintenance path:

- verify checks pointer / ledger / manifest / stable markdown consistency
- repair is explicit opt-in and only rebuilds release pointer plus stable markdown
- ledger remains append-only and is never rewritten by repair

## 2026-04-10 Candidate vs Release Review Update

Before promoting a candidate, operators can compare the candidate latest with the
current release in one command:

```bash
python scripts/review_publication_candidate.py --kind ranking
python scripts/review_publication_candidate.py --kind compare
python scripts/review_publication_candidate.py --kind all
python scripts/review_publication_candidate.py --kind all --json
```

Review summary statuses:

- `no_candidate`: no candidate latest pointer found for the kind
- `no_release`: candidate exists but no release has been promoted yet (initial promotion eligible)
- `same_manifest`: candidate and release point to the same manifest (no action needed)
- `candidate_newer_than_release`: candidate is from a newer week (promote review recommended)
- `candidate_differs_same_week`: same week but candidate was regenerated later (re-promote candidate)
- `candidate_older_than_release`: candidate is older than the release (not a promotion candidate)
- `candidate_not_publish_ready`: candidate is not publish_ready and cannot be promoted

The review CLI is read-only and does not write any files.
It is intended as the pre-promotion decision step between pipeline output and
`promote_publication_release.py`.

Operator pre-promotion flow:

1. run pipeline → candidate output
2. **review** candidate vs release with `review_publication_candidate.py`
3. if `promotable=True`, promote with `promote_publication_release.py`
4. verify with `verify_publication_release_state.py`
5. inspect status with `show_publication_release_status.py`
