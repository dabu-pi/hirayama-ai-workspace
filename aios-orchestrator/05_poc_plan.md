# 05 PoC Plan — 最小実装計画

## PoC の範囲

**含める:**
- Python + SQLite によるローカル動作
- CLI ベースの操作（start / run / pending / approve / log）
- Planner（OpenAI）→ Executor（Anthropic）の1ターン往復
- approval_gate（CLI の y/n）
- run_log への記録

**含めない（将来フェーズ）:**
- Dashboard / Google Sheets 連携
- context 圧縮（summary 自動生成）
- Web UI
- 並列実行
- 他モデルへの差し替え対応

---

## 実装順序

### Phase 1 — 土台（DBとスキーマ）

| # | ファイル | 内容 |
|---|---|---|
| 1 | `schema.sql` | conversations / messages / artifacts / run_log の CREATE TABLE |
| 2 | `.env.example` | OPENAI_API_KEY / ANTHROPIC_API_KEY のテンプレ |
| 3 | `requirements.txt` | openai anthropic python-dotenv |
| 4 | `store.py` | init_db / create_conversation / append_message / get_history / set_approval |

**確認方法:** `python -c "from store import init_db; init_db()"` で `data/store.db` が生成される。

---

### Phase 2 — 周辺コンポーネント

| # | ファイル | 内容 |
|---|---|---|
| 5 | `run_logger.py` | run_log テーブルへの INSERT 1関数 |
| 6 | `approval_gate.py` | CLIで内容表示 + y/n 入力受付 |
| 7 | `openai_client.py` | `chat(system, messages) -> (str, int, int)` (応答, tokens_in, tokens_out) |
| 8 | `anthropic_client.py` | 同上（Anthropic API 形式へ変換する処理を内包） |

**確認方法:** 各クライアントを単体で呼び出して応答が返ることを確認する。

```python
# 単体テスト（手動）
from openai_client import chat
resp, t_in, t_out = chat("あなたはテストです", [{"role": "user", "content": "ping"}])
print(resp)
```

---

### Phase 3 — Orchestrator 本体

| # | ファイル | 内容 |
|---|---|---|
| 9 | `orchestrator.py` | start / run / pending / approve / reject / log コマンド |

**実装する関数:**
- `cmd_start(goal, max_turns)` → conversation 生成、1ターン目を即実行
- `cmd_run(conv_id, max_turns)` → ターンループ実行
- `run_turn(conv_id, turn_id, max_turns)` → 1ターン実行（Planner → Gate → Executor）
- `cmd_pending()` → 承認待ち一覧表示
- `cmd_approve(message_id)` → 承認実行
- `cmd_log(conv_id)` → run_log 表示

---

## 完了条件

以下がすべて満たせた時点で PoC 完了とする。

```
□ python orchestrator.py start --goal "..." で会話が始まる
□ data/store.db に conversations と messages が記録される
□ Planner の応答に「REQUIRES_APPROVAL: true」が含まれると CLI が止まる
□ y を入力すると Executor が続きを実行する
□ n を入力すると conversations.status = failed になる
□ Planner が「TASK_COMPLETE」を書くと conversations.status = completed になる
□ python orchestrator.py log --conv-id <uuid> でターン履歴が見える
□ run_log に全 API コールの tokens と duration が記録されている
□ .env なしで起動すると明確なエラーメッセージが出る
□ max_turns 到達で強制終了する
```

---

## ディレクトリ構成（PoC 完成時）

```
aios-orchestrator/
├── src/
│   ├── orchestrator.py
│   ├── store.py
│   ├── openai_client.py
│   ├── anthropic_client.py
│   ├── approval_gate.py
│   └── run_logger.py
├── schema.sql
├── requirements.txt
├── .env.example
├── data/             ← gitignore
│   └── store.db
├── 00_overview.md
├── 01_architecture.md
├── 02_data_model.md
├── 03_flow.md
├── 04_risks.md
├── 05_poc_plan.md    ← このファイル
├── 06_run_log_spec.md
└── 07_next_tasks.md
```

---

## gitignore に追加するもの

```
aios-orchestrator/data/
aios-orchestrator/.env
aios-orchestrator/src/__pycache__/
```
