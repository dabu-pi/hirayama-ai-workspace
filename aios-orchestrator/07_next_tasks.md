# 07 Next Tasks — 次にやること

最終更新: 2026-04-26

---

## 現在のステータス

| 状態 | 内容 |
|---|---|
| 完了 | 設計文書（00〜07）の正本化 |
| 完了 | Task 1〜5（実装）|
| 完了 | Phase 5〜18（Artifact / Export / Diff 系）|
| 完了 | Phase 19（manifest diff export レポート）|
| 完了 | Phase 20（artifact 内容 diff 比較）|
| 未着手 | Phase B / Phase C / Phase D |
| ブランチ | `feature/auto-dev-phase3-loop` |
| 作業ディレクトリ | `workspace/aios-orchestrator/` |

---

## ✅ 完了済み（historical）

### Task 1〜5（2026-04-15 完了）

| Task | 内容 |
|---|---|
| Task 1 | schema.sql + store.py（SQLite）|
| Task 2 | openai_client.py + anthropic_client.py |
| Task 3 | approval_gate.py + run_logger.py |
| Task 4 | orchestrator.py（CLI: start / run / pending / approve / reject / log）|
| Task 5 | E2E dry-run（シナリオ A〜D 全通過）|

### Phase 5〜18（2026-04-15〜16 完了）

| Phase | 内容 |
|---|---|
| Phase 5 | summary 長会話品質検証・改善 |
| Phase 6 | Artifact 自動パース・保存 |
| Phase 7 | Artifacts CLI + false positive フィルタ |
| Phase 8 | Artifact 保存 E2E 実測検証（real API）|
| Phase 9 | Artifact Diff（ターン間差分表示）|
| Phase 10 | Artifact Filename 明示指定 |
| Phase 11 | Artifact Export CLI（artifact-export）|
| Phase 12 | Executor Prompt filename 記法追加 + E2E |
| Phase 13 | language tag 正規化 + 内容ベース拡張子推定（56 PASS）|
| Phase 14 | artifact-export manifest 出力（63 PASS）|
| Phase 15 | artifact-export 統合 E2E テスト（121 PASS）|
| Phase 16 | real API 実データ artifact-export 運用 E2E |
| Phase 17 | real API 実データ collision 確認 E2E |
| Phase 18 | manifest-diff サブコマンド（88 PASS）|

### Phase 19（2026-04-26 完了）

manifest diff を使った export 差分レポート自動生成。

- `export_diff_reporter.py`: `write_diff_report()` 追加
- `manifest-diff --report-output <path>` / `--fail-on-diff`
- tests: 10/10 PASS

### Phase 20（2026-04-26 完了）

artifact ファイル内容の unified diff 比較。

- `artifact_content_diff.py`: `compare_exports()` + unified diff 生成
- `content-diff --old-dir / --new-dir` / `--context / --verbose / --no-diff / --json / --report-output / --fail-on-diff`
- tests: 15/15 PASS

---

## 優先タスク（この順番で実施する）

---

### Phase B — context 圧縮

**優先度:** 中

**内容:**

長い会話で蓄積された古い messages を summary に変換してトークン使用量を削減する。
`summarizer.py` を拡張し、一定ターン数以上の古いメッセージを自動圧縮する。

**完了条件:**
```bash
python orchestrator.py start --project-id test --goal "context圧縮テスト" --max-turns 10 --dry-run
# → ターン数が閾値を超えると ancient messages が summary に置き換えられる
```

---

### Phase C — Google Sheets 連携

**優先度:** 低

**内容:**

run_log を Google Sheets の Run_Log シートに書き込む。
`de` コマンド経由の handoff と統合することを想定。

**完了条件:**
```bash
python orchestrator.py log --conv-id <uuid> --sheets
# → Google Sheets Run_Log タブに run 情報が書き込まれる
```

---

### Phase D — CI 統合

**優先度:** 低

**内容:**

GitHub Actions ワークフローで `manifest-diff` / `content-diff` を自動実行し、
export 差分を PR コメントとして投稿する。

**完了条件:**
```yaml
# .github/workflows/artifact-diff.yml
# artifact-export を 2 回実行して manifest-diff / content-diff を走らせる
# 差分があれば PR にコメントを投稿する
```

---

## 将来フェーズ（今は手をつけない）

| フェーズ | 内容 |
|---|---|
| Phase E | 複数会話の並列実行対応（SQLite WAL mode + threading）|
| Phase F | Web UI（Flask 等）で conversation 一覧・承認画面を提供 |
