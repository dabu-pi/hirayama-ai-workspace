# Weekly Publication Update Memo

## 1. Gate確認

```bash
python scripts/run_batch.py --use-db --week YYYY-MM-DD --only-commercial --show-metric-details --output-publish-artifact
```

見る場所:

- `[NORMALIZE]`
- `[HEALTH] overall=... publish_ready=...`
- `GT=... GS=... YT=...`

## 2. Candidate生成

```bash
python scripts/run_publication_pipeline.py --week YYYY-MM-DD --use-db --only-commercial
python scripts/run_publication_pipeline.py --week YYYY-MM-DD --use-db --only-commercial --compare-source-sets
```

見る場所:

- `[PIPELINE] content_kind=...`
- `[PIPELINE] publish_ready=...`
- handoff path

## 3. Review

```bash
python scripts/review_publication_candidate.py --kind all --verbose
python scripts/review_publication_candidate.py --kind all --json
```

見る場所:

- `status`
- `promotable`
- manifest path
- field diff notes

## 4. Promote

```bash
python scripts/promote_publication_candidate.py --kind ranking --copy-markdown
python scripts/promote_publication_candidate.py --kind compare --copy-markdown
```

## 5. Verify / Status

```bash
python scripts/verify_publication_release_state.py --kind all
python scripts/show_publication_release_status.py --kind all --limit 5 --verbose
```

`overall_status=OK` になったら、その週の publication 運用は閉じてよい状態です。

## 6. Dashboard View 更新

- `Weekly_Overview.csv`: 週全体の状態を1行追加または更新
- `Coverage_Check.csv`: coverage と不足モデルを更新
- `Release_Log.csv`: ranking / compare の操作履歴を追加
- `PROJECT_STATUS.md`: 最後に重要結果を記録
