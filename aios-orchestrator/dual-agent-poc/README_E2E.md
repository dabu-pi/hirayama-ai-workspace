# README_E2E — E2E テスト記録（Task 5 完了後）

実施日: 2026-04-15
環境: Windows 11 / Python 3.x / SQLite（`data/store.db`）
API 実呼び出し: **未実施（dry-run で代替）**

---

## 実施した E2E シナリオ

### シナリオ A — 通常フロー（TASK_COMPLETE まで）

| 項目 | 内容 |
|---|---|
| goal | `1+1を計算してMarkdownで報告せよ` |
| project_id | `aios-poc` |
| max-turns | `3` |
| dry-run | YES |

**実行コマンド:**

```bash
python orchestrator.py start --project-id aios-poc --goal "1+1を計算してMarkdownで報告せよ"
# → conversation_id: 4b9a6c84-5a50-4b0a-8c50-12bf1e1fb215

python orchestrator.py show --conv-id 4b9a6c84-5a50-4b0a-8c50-12bf1e1fb215
# → status: in_progress / turn_count: 0

# (Pythonスクリプトで run_loop を直接呼び出し)
run_loop(db, conv_id, max_turns=3, dry_run=True)
```

**結果:**

```
[DRY-RUN] モード: 実 API は呼びません。モック応答を使います。

[Turn 1] 開始  project=aios-poc
[Turn 1] context: recent=1件  summary=なし
[Turn 1] Planner (OpenAI) 呼び出し中... [DRY-RUN]
[Turn 1] Planner: [DRY-RUN Turn 1] 1+1を計算してMarkdownで報告せよ について、
         まず概要を Markdown 形式で作成してください。
[Turn 1] Executor (Anthropic) 呼び出し中... [DRY-RUN]
[Turn 1] Executor: [DRY-RUN Turn 1] 実行結果を報告します。
         ```markdown
         # 結果
         - 計算完了
         - 値: 2
         ```
[Turn 1] 完了 | コスト概算: $0.00000

[Turn 2] 開始  project=aios-poc
[Turn 2] context: recent=3件  summary=なし
[Turn 2] Planner: TASK_COMPLETE ターン 2 でタスクが完了しました。
[Turn 2] TASK_COMPLETE 検出 — 会話を完了にします
run_loop result: completed
```

**最終状態（DB確認）:**

| 項目 | 値 |
|---|---|
| conversations.status | `completed` |
| turn_count | `2` |
| run_log 件数 | `5`（session_start / api_call×3 / session_end） |

**確認済み項目:**

- [x] `start` — DB 作成・会話レコード保存（project_id=aios-poc）
- [x] `show` — project_id / status / turn_count 表示
- [x] Turn 1: Planner モック応答 → Executor モック応答 → DB保存
- [x] Turn 2: TASK_COMPLETE 検出 → status=completed
- [x] `log` — session_start / api_call（モデル名・トークン数）/ session_end 記録
- [x] context の recent 件数が会話の進行とともに増加
- [x] summary なし時は recent_history のみ送信（Turn 1: 1件 → Turn 2: 3件）

---

### シナリオ B — 承認フロー（REQUIRES_APPROVAL 検出）

| 項目 | 内容 |
|---|---|
| goal | `sample.txt を削除する手順を提案せよ` |
| project_id | `aios-poc` |
| dry-run | YES |
| approval-test | YES（必ず `REQUIRES_APPROVAL: true` を含む Planner モック） |

**実行コマンド:**

```bash
# start は Python スクリプトで直接 create_conversation
run_loop(db, conv_b, max_turns=3, dry_run=True, approval_test=True)
```

**結果:**

```
[Turn 1] 開始  project=aios-poc
[Turn 1] Planner: REQUIRES_APPROVAL: true
         [DRY-RUN Turn 1] sample.txt を削除する手順:
         1. os.remove('sample.txt') を実行する

[承認待ち] Turn 1 — Planner が危険操作を要求しています
  message_id : 864e6b39-d074-46a3-bf4b-2f7e03aea054
  承認: python orchestrator.py approve --message-id 864e6b39-d074-46a3-bf4b-2f7e03aea054
  却下: python orchestrator.py reject  --message-id 864e6b39-d074-46a3-bf4b-2f7e03aea054
run_loop result: waiting_approval
```

**pending 確認:**

```
pending count: 1
  message_id : 864e6b39-d074-46a3-bf4b-2f7e03aea054
  conv_id    : 2cc62df0...
  project_id : aios-poc
  turn_id    : 1
  content    : REQUIRES_APPROVAL: true ...
```

**確認済み項目:**

- [x] `REQUIRES_APPROVAL: true` を Planner 応答に検出
- [x] `needs_approval()` が true を返す
- [x] conversations.status = `waiting_approval` に遷移
- [x] Executor を呼ばずに停止
- [x] message_id / approve/reject コマンドを表示
- [x] `pending` — project_id 付きで承認待ち 1件を表示

---

## 軽微修正（dry-run モード追加）

E2E 実施時に `.env` が未配置であり API キー未設定のため、
以下を orchestrator.py に追加した。

| 追加内容 | 詳細 |
|---|---|
| `_mock_planner_response()` | turn_id>=2 で TASK_COMPLETE を含むモック |
| `_mock_executor_response()` | Markdown 形式の実行結果モック |
| `_mock_approval_planner_response()` | 常に `REQUIRES_APPROVAL: true` を含むモック |
| `run_single_turn(dry_run, approval_test)` | dry-run 時はモック応答を使用 |
| `run_loop(dry_run, approval_test)` | パラメータを run_single_turn に転送 |
| `command_run()` | `args.dry_run` / `args.approval_test` を読む |
| `_build_parser()` | `run` サブコマンドに `--dry-run` / `--approval-test` 追加 |

---

## 発生した問題と対処

| 問題 | 原因 | 対処 |
|---|---|---|
| `sqlite3.OperationalError: no such column: project_id` | `data/store.db` が Task 5 以前の旧スキーマのまま残っていた | `store.db` を削除して再作成（PoC 段階は DB 再作成推奨。README_Task5.md 記載の方針に従う） |
| Windows ターミナルの日本語文字化け | Windows cp932 環境 vs UTF-8 の不一致 | Python スクリプト内で `io.TextIOWrapper(encoding='utf-8')` でラップして出力。コアロジックに影響なし |

---

## 次に直すべきこと（実 API E2E）

| 優先度 | 内容 |
|---|---|
| 1 | `.env` に `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` を設定する |
| 2 | `python orchestrator.py run --conv-id <uuid> --max-turns 3`（dry-run なし）を実行 |
| 3 | `run_log` のトークン数・コスト概算が実数で記録されることを確認 |
| 4 | `summary` フィールドの更新ロジックを実装する（現状: Executor が更新しない。別 Phase で対応） |
| 5 | artifacts の自動パース・保存（Phase 2） |

---

## 動作確認結果まとめ（Task 1〜5 + E2E dry-run）

| タスク | 内容 | 結果 |
|---|---|---|
| Task 1 | schema.sql / store.py 基本 CRUD | OK |
| Task 2 | openai_client / anthropic_client | OK（PoC）|
| Task 3 | approval_gate / run_logger | OK |
| Task 4 | orchestrator.py CLI（7コマンド） | OK |
| Task 5 | project_id 隔離 / build_context(limit=10) | OK |
| E2E dry-run A | 通常フロー（TASK_COMPLETE まで 2ターン） | **OK** |
| E2E dry-run B | 承認フロー（REQUIRES_APPROVAL 検出・停止） | **OK** |
| E2E 実 API | OPENAI / ANTHROPIC 実呼び出し | 未実施（.env 未配置） |
