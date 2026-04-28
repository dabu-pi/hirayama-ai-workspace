# 01 Architecture — システム構成

## 全体構成図

```
Human (CLI)
    │
    │  ① ゴール入力 / ④ 承認応答
    ▼
┌──────────────────────────────────────────────────────┐
│                  Orchestrator (Python)                │
│                                                      │
│  ・ターン管理（Planner → Executor → Planner …）       │
│  ・approval_gate 判定                                 │
│  ・run_log 書き込み                                   │
│  ・終了条件チェック                                    │
└────────┬─────────────────────────┬────────────────────┘
         │ ② Planner呼び出し        │ ③ Executor呼び出し
         ▼                         ▼
  [OpenAI Client]           [Anthropic Client]
   gpt-4o (Planner)          claude-sonnet-4-6
   次の指示を1つ書く           指示を読んで実行・報告
         │                         │
         └──────────┬──────────────┘
                    │ 読み書き
                    ▼
         ┌─────────────────────┐
         │   Shared Store      │
         │   (SQLite)          │
         │                     │
         │  conversations      │
         │  messages           │
         │  artifacts          │
         │  run_log            │
         └─────────────────────┘
```

---

## コンポーネントの責務

### orchestrator.py — メインループ

- `start`: 会話を新規作成し、ゴールを最初のメッセージとして登録する
- `run`: 指定ターン数だけ Planner→Executor を繰り返す
- `pending`: 承認待ちのメッセージ一覧を表示する
- `approve` / `reject`: 承認ゲートを手動操作する
- `log`: 会話の run_log を表示する

### store.py — SQLite CRUD

- DB 初期化（schema.sql を実行）
- conversations / messages / artifacts / run_log への読み書き
- ビジネスロジックは持たない。純粋な永続化レイヤー

### openai_client.py — OpenAI API ラッパー

- `chat(system, messages) -> str` の1関数のみ公開
- モデル名・温度・タイムアウトはここで設定する
- トークン数を返り値に含める

### anthropic_client.py — Anthropic API ラッパー

- `chat(system, messages) -> str` の1関数のみ公開（openai_client と同インターフェース）
- system prompt を messages から分離して Anthropic API 形式へ変換する処理を内包

### approval_gate.py — CLI 承認プロンプト

- `prompt(content) -> bool` の1関数
- 内容を表示し `[y/n]` で入力を受け付ける
- `n` の場合は rejection 理由を任意入力させる

### run_logger.py — 実行ログ

- `log(conv_id, turn_id, event_type, model, tokens_in, tokens_out, duration_ms, metadata)` の1関数
- run_log テーブルへ INSERT するだけ

---

## Planner / Executor / Orchestrator の関係

```
Orchestrator がターンを制御する。
Planner と Executor は直接会話しない。
すべてのやりとりは Shared Store を経由する。

turn N:
  1. Orchestrator が messages から全履歴を取得
  2. Orchestrator → OpenAI API（Planner として呼び出す）
  3. Planner の応答を messages に記録
  4. requires_approval が true なら approval_gate で停止
  5. Orchestrator が最新の messages を取得
  6. Orchestrator → Anthropic API（Executor として呼び出す）
  7. Executor の応答を messages に記録
  8. artifacts があれば artifacts テーブルに記録
  9. 終了条件チェック → 継続 or 終了
```

---

## ファイル構成（PoC完成時）

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
└── data/
    └── store.db          # gitignore
```
