# PROJECT_STATUS.md — AIOS Dual-Agent Orchestrator

最終更新: 2026-04-26（Phase 20 実装）

---

## 現在地

**Phase 20 CLOSED — artifact 内容 diff 比較（content-diff サブコマンド）が完成した状態**

`dual-agent-poc/` 配下に Task 1〜5 および Phase 5〜20 がすべて実装・テスト済み。

---

## 完了済みフェーズ一覧

| フェーズ | 内容 | 完了日 |
|---|---|---|
| Task 1 | schema.sql + store.py（SQLite）| 2026-04-15 |
| Task 2 | openai_client.py + anthropic_client.py | 2026-04-15 |
| Task 3 | approval_gate.py + run_logger.py | 2026-04-15 |
| Task 4 | orchestrator.py（CLI: start / run / pending / approve / reject / log）| 2026-04-15 |
| Task 5 | E2E dry-run（シナリオ A〜D 全通過）| 2026-04-15 |
| Phase 5 | summary 長会話品質検証・改善 | 2026-04-15 |
| Phase 6 | Artifact 自動パース・保存 | 2026-04-15 |
| Phase 7 | Artifacts CLI + false positive フィルタ | 2026-04-15 |
| Phase 8 | Artifact 保存 E2E 実測検証（real API）| 2026-04-15 |
| Phase 9 | Artifact Diff（ターン間差分表示）| 2026-04-15 |
| Phase 10 | Artifact Filename 明示指定 | 2026-04-15 |
| Phase 11 | Artifact Export CLI（`artifact-export` サブコマンド）| 2026-04-16 |
| Phase 12 | Executor Prompt filename 記法追加 + explicit E2E 確認 | 2026-04-16 |
| Phase 13 | language tag 正規化 + 内容ベース拡張子推定（56/56 PASS）| 2026-04-16 |
| Phase 14 | artifact-export manifest 出力（63/63 PASS）| 2026-04-16 |
| Phase 15 | artifact-export 統合 E2E テスト・仕様固定（121/121 PASS）| 2026-04-16 |
| Phase 16 | real API 実データ artifact-export 運用 E2E 確認 | 2026-04-16 |
| Phase 17 | real API 実データ collision 確認 E2E | 2026-04-16 |
| Phase 18 | manifest diff（`manifest-diff` サブコマンド、88/88 PASS）| 2026-04-16 |
| Phase 19 | export 差分レポート自動生成（`--report-output` / `--fail-on-diff`、CI 連携）| 2026-04-26 |
| Phase 20 | artifact 内容 diff 比較（`content-diff` サブコマンド、15 テストケース）| 2026-04-26 |

---

## 主要ファイル（dual-agent-poc/）

| ファイル | 役割 |
|---|---|
| `orchestrator.py` | CLI エントリポイント（全サブコマンド）|
| `store.py` | SQLite CRUD（conversations / messages / artifacts / run_log）|
| `anthropic_client.py` | Anthropic API クライアント |
| `openai_client.py` | OpenAI API クライアント |
| `approval_gate.py` | CLI 承認フロー（DANGER_KEYWORDS チェック）|
| `run_logger.py` | run_log 書き込み・コスト計算 |
| `summarizer.py` | 長会話の context 圧縮 |
| `artifact_parser.py` | Executor 出力から artifact を抽出 |
| `artifact_exporter.py` | artifact を実ファイルとして書き出す |
| `artifact_diff.py` | ターン間 artifact 差分表示 |
| `artifact_manifest_diff.py` | manifest 間 diff（added/removed/changed/unchanged）|
| `export_diff_reporter.py` | manifest diff 結果をファイルに書き出す（CI 連携）|
| `artifact_content_diff.py` | artifact 実ファイル内容の unified diff 比較（Phase 20）|
| `dashboard_reporter.py` | 実行結果サマリを表示する |
| `schema.sql` | DB スキーマ定義 |
| `requirements.txt` | openai / anthropic / python-dotenv |

---

## 利用可能な CLI サブコマンド

```bash
cd dual-agent-poc/

# 会話開始
python orchestrator.py start --project-id <id> --goal "<goal>" [--max-turns N] [--dry-run]

# ターン実行（承認ゲート付き）
python orchestrator.py run --conv-id <uuid> [--dry-run]

# 承認待ち一覧
python orchestrator.py pending

# 承認 / 拒否
python orchestrator.py approve --conv-id <uuid>
python orchestrator.py reject  --conv-id <uuid>

# ログ表示
python orchestrator.py log [--conv-id <uuid>]

# artifact export
python orchestrator.py artifact-export --conv-id <uuid> --output ./data/export/

# manifest diff
python orchestrator.py manifest-diff \
    --old-manifest ./data/v1/artifact_export_manifest.json \
    --new-manifest ./data/v2/artifact_export_manifest.json \
    [--verbose] [--json] \
    [--report-output ./reports/diff.txt] \
    [--fail-on-diff]

# content-diff（Phase 20: artifact ファイル内容の diff 比較）
python orchestrator.py content-diff \
    --old-dir ./data/export_v1 \
    --new-dir ./data/export_v2 \
    [--context 3] \
    [--verbose] [--no-diff] [--json] \
    [--report-output ./reports/content_diff.txt] \
    [--fail-on-diff]
```

---

## 次フェーズ候補（未着手）

| フェーズ候補 | 内容 | 優先度 |
|---|---|---|
| Phase B | context 圧縮（古い messages を summary 化してトークン削減）| 低 |
| Phase C | Google Sheets（Run_Log シート）への run_log 書き込み連携 | 低 |

---

## 注意事項

- `dual-agent-poc/.env` に API キーが設定されている（中身は読まない）
- `data/` ディレクトリに SQLite DB と export 結果が入る（git 管理外）
- real API テストは API キーが有効な環境でのみ実行可能
- workspace monorepo の一部（`feature/auto-dev-phase3-loop` ブランチ）
