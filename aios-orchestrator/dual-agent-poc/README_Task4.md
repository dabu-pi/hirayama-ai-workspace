# README Task4 — orchestrator.py 実装記録

## 実装内容

Task 4 として以下のファイルを新規作成・修正した。

| ファイル | 内容 |
|---|---|
| `orchestrator.py` | CLI メインループ（新規作成） |
| `store.py` | `get_conversation` / `get_message` / `get_run_log` を追記 |

---

## コマンド一覧

```bash
# 会話開始
python orchestrator.py start --goal "Pythonで九九表をMarkdownで作る"

# ターンを実行（デフォルト max-turns=5）
python orchestrator.py run --conv-id <uuid> [--max-turns 3]

# 承認待ち一覧
python orchestrator.py pending

# 承認（確認プロンプトあり）
python orchestrator.py approve --message-id <uuid>

# 承認（--yes でスキップ）
python orchestrator.py approve --message-id <uuid> --yes

# 却下
python orchestrator.py reject --message-id <uuid>

# run_log 表示（コスト集計付き）
python orchestrator.py log --conv-id <uuid>

# 会話要約表示
python orchestrator.py show --conv-id <uuid>

# DB パスを変更する場合（全コマンド共通）
python orchestrator.py --db /path/to/custom.db start --goal "..."
```

---

## 状態遷移

```
conversations.status:

  [start]
      ↓
  in_progress
      ↓ run_single_turn() ×N
      ├─ TASK_COMPLETE 検出 → completed（終了）
      ├─ needs_approval = true → waiting_approval（停止）
      │       ↓
      │   approve → in_progress（続行）
      │   reject  → failed（終了）
      ├─ エラー / max_turns → failed（終了）
      └─ 正常完了 → in_progress（次ターンへ）
```

---

## 1ターンの内部フロー

```
run_single_turn(db_path, conv_id)
  1. get_conversation  → turn_id を決定
  2. get_history       → 全メッセージを取得
  3. chat_openai()     → Planner（OpenAI）応答
  4. append_message    → planner メッセージ保存
  5. log_api_call      → run_log 記録
  6. "TASK_COMPLETE"?  → status=completed / return "completed"
  7. needs_approval?   → status=waiting_approval / return "waiting_approval"
  8. get_history       → Planner 発言含む最新履歴
  9. chat_anthropic()  → Executor（Anthropic）応答
 10. append_message    → executor メッセージ保存
 11. log_api_call      → run_log 記録
 12. increment_turn    → turn_count +1
 13. set_status        → in_progress / latest_output 更新
 14. "BLOCKED:"?       → return "blocked"（ループ側でカウント）
 15. return "continue"
```

---

## store.py への追記

| 関数 | 用途 |
|---|---|
| `get_conversation(db_path, conv_id)` | show / run / approve で会話を取得 |
| `get_message(db_path, message_id)` | approve / reject でメッセージを取得 |
| `get_run_log(db_path, conv_id)` | log コマンドで run_log を一覧取得 |

---

## 動作確認結果

| 確認項目 | 結果 |
|---|---|
| import（全関数） | OK |
| argparse（7コマンド） | OK |
| `build_planner_system_prompt` 内容確認 | OK |
| `build_executor_system_prompt` 内容確認 | OK |
| `start` DB 作成・メッセージ保存 | OK |
| `show` 会話要約表示 | OK |
| `pending` 空・1件表示 | OK |
| `approve --yes` DB 更新確認 | OK（status: approved / in_progress） |
| `reject` DB 更新確認 | OK（status: rejected / failed） |
| `log` run_log 表示・コスト集計 | OK |
| `run` API 実呼び出し | 未実施（キー未設定環境） |

---

## 未対応事項（将来フェーズ）

| 項目 | フェーズ |
|---|---|
| artifacts の自動パース・保存 | Phase 2（orchestrator 拡張） |
| context 圧縮（長い履歴の summary 化） | Phase B |
| run_log → Dashboard Sheets 連携 | Phase C |
| `--dry-run` フラグ（API を呼ばずフローだけ確認） | 将来 |
| BLOCKED ループのより細かい制御 | 将来 |

---

## 次のタスク

Task 5: E2E テスト（API キーを設定した環境での手動確認）
→ `07_next_tasks.md` の Task 5 を参照
