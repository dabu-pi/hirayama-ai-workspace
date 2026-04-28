# README Task1 — SQLite 共有ストア実装記録

## 実装内容

Task 1 として以下の2ファイルを新規作成した。

| ファイル | 役割 |
|---|---|
| `schema.sql` | テーブル定義・インデックス定義 |
| `store.py` | SQLite CRUD 関数群 |

---

## schema.sql — 作成したテーブル

| テーブル | 主な用途 |
|---|---|
| `conversations` | 1ゴール = 1行。ステータス・要約を保持 |
| `messages` | Planner / Executor の全発言を時系列で保持 |
| `artifacts` | LLM が生成したコード・ファイル等を分離保存 |
| `run_log` | API コール・承認操作の監査ログ（追記専用） |

インデックス:
- `idx_messages_conv_turn` — messages(conversation_id, turn_id)
- `idx_artifacts_message` — artifacts(message_id)
- `idx_run_log_conv_turn` — run_log(conversation_id, turn_id)

---

## store.py — 実装した関数

| 関数 | 返り値 | 説明 |
|---|---|---|
| `init_db(db_path)` | None | schema.sql を実行して DB を初期化する |
| `get_conn(db_path)` | Connection | Row を dict として扱える接続を返す |
| `create_conversation(db_path, title, role_system)` | str | 会話を新規作成し conversation_id を返す |
| `set_conversation_status(db_path, conv_id, status, ...)` | None | ステータス・要約を更新する |
| `increment_turn_count(db_path, conv_id)` | None | turn_count を +1 する |
| `append_message(db_path, conv_id, turn_id, ...)` | str | メッセージを追記し message_id を返す |
| `set_message_approval(db_path, msg_id, approved, ...)` | None | 承認・却下を記録する |
| `append_artifact(db_path, msg_id, type, filename, content)` | str | 成果物を追記し artifact_id を返す |
| `append_run_log(db_path, conv_id, turn_id, event_type, ...)` | str | 実行ログを追記し log_id を返す |
| `get_history(db_path, conv_id)` | list[dict] | 全メッセージを OpenAI 形式で返す |
| `get_pending_approvals(db_path)` | list[dict] | 承認待ちメッセージ一覧を返す |

---

## get_history() の返り値形式

```python
[
    {
        "role": "user",            # planner → user（OpenAI API 形式）
        "content": "...",
        "turn_id": 1,
        "source_model": "gpt-4o",
        "role_executor": "planner",
        "message_id": "uuid...",
        "status": "pending",
        "requires_approval": False,
    },
    {
        "role": "assistant",       # executor → assistant
        "content": "...",
        ...
    },
]
```

`role` は OpenAI API の messages 形式に合わせてある。
Anthropic API に渡す際は `anthropic_client.py` 内で system を分離する。

---

## DB 初期化の確認手順

```bash
# dual-agent-poc/ ディレクトリで実行
cd aios-orchestrator/dual-agent-poc

python -c "
from store import init_db, create_conversation, append_message, get_history

DB = 'data/store.db'
init_db(DB)
print('init_db: OK')

conv_id = create_conversation(DB, 'テスト会話', 'テスト用 system prompt')
print(f'create_conversation: {conv_id}')

msg_id = append_message(
    DB, conv_id, 1, 'planner', 'gpt-4o', 'claude-sonnet-4-6',
    'こんにちは。1+1を計算してください。'
)
print(f'append_message: {msg_id}')

history = get_history(DB, conv_id)
print(f'get_history: {len(history)} messages')
print(history[0])
"
```

期待される出力:
```
init_db: OK
create_conversation: <uuid>
append_message: <uuid>
get_history: 1 messages
{'role': 'user', 'content': 'こんにちは。1+1を計算してください。', ...}
```

---

## gitignore 追加済み

```
aios-orchestrator/data/
aios-orchestrator/.env
aios-orchestrator/src/__pycache__/
```

---

## 次のタスク

Task 2: `openai_client.py` と `anthropic_client.py` の実装
→ `07_next_tasks.md` の Task 2 を参照
