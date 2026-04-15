# 07 Next Tasks — 次にやること

## 優先タスク（この順番で実施する）

---

### Task 1 — schema.sql と store.py を作る

**優先度:** 最高（他すべての前提）

**内容:**
- `schema.sql` に conversations / messages / artifacts / run_log を定義する
- `store.py` に init_db / create_conversation / append_message / get_history / set_approval を実装する
- `data/` ディレクトリを gitignore に追加する

**完了条件:**
```bash
python -c "from src.store import init_db; init_db()"
# → data/store.db が生成される
```

---

### Task 2 — openai_client.py と anthropic_client.py を作る

**優先度:** 高

**内容:**
- 両クライアントとも `chat(system, messages) -> (str, int, int)` のシグネチャで統一する
- `anthropic_client.py` は messages から system を取り出して Anthropic API 形式へ変換する
- `.env` から API キーを読み込む（python-dotenv 使用）

**完了条件:**
```bash
python -c "
from src.openai_client import chat
resp, ti, to = chat('test', [{'role':'user','content':'ping'}])
print(resp, ti, to)
"
```

---

### Task 3 — approval_gate.py と run_logger.py を作る

**優先度:** 高

**内容:**
- `approval_gate.py`: 内容表示 + `[y/n]` 入力 + 理由入力（n の場合）
- `run_logger.py`: `log()` 関数 1つのみ。コスト計算込み
- キーワードリスト（DANGER_KEYWORDS）を `approval_gate.py` に持たせる

**完了条件:**
```bash
python -c "
from src.approval_gate import prompt
result = prompt('ファイルを削除します')
print(result)  # True / False
"
```

---

### Task 4 — orchestrator.py を作る

**優先度:** 高（PoC の本体）

**内容:**
- CLI サブコマンド: `start` / `run` / `pending` / `approve` / `reject` / `log`
- `run_turn()` に1ターンのロジックをまとめる
- TASK_COMPLETE / REQUIRES_APPROVAL / BLOCKED の3パターンを処理する

**完了条件:**
```bash
python src/orchestrator.py start --goal "1+1を計算してmarkdownで報告せよ" --max-turns 3
# → Planner と Executor が往復し、完了する
```

---

### Task 5 — E2E テスト（手動）を実施する

**優先度:** 中（Task 4 完了後）

**内容:**
以下のシナリオを手動で実行し、各完了条件（05_poc_plan.md）をチェックする。

```
シナリオA: タスク正常完了
  → ゴール設定 → 3ターン以内に TASK_COMPLETE → completed

シナリオB: 承認ゲート発動
  → Planner が REQUIRES_APPROVAL: true を書く → y → 続行

シナリオC: Reject
  → Planner が REQUIRES_APPROVAL: true を書く → n → failed

シナリオD: ターン上限
  → --max-turns 2 で起動 → 2ターンで強制終了
```

---

## 将来フェーズ（今は手をつけない）

| フェーズ | 内容 |
|---|---|
| Phase B | context 圧縮（古い messages を summary に変換してトークンを削減） |
| Phase C | Google Sheets（Run_Log シート）への run_log 書き込み連携 |
| Phase D | Web UI（Flask 等）で conversation 一覧・承認画面を提供 |
| Phase E | 複数会話の並列実行対応（SQLite WAL mode + threading） |

---

## 現在のステータス

| 状態 | 内容 |
|---|---|
| 完了 | 設計文書（00〜07）の正本化 |
| 未着手 | Task 1〜5（実装） |
| ブランチ | `feature/auto-dev-phase3-loop` |
| 作業ディレクトリ | `workspace/aios-orchestrator/` |
