# 02 Data Model — データ構造

## テーブル一覧

| テーブル | 役割 |
|---|---|
| conversations | 会話セッションの親レコード |
| messages | 各ターンの発言・指示・応答 |
| artifacts | LLMが生成したコード・ファイル等 |
| run_log | API コール・承認操作の監査ログ |

---

## conversations

```sql
CREATE TABLE conversations (
    conversation_id   TEXT PRIMARY KEY,   -- uuid4
    title             TEXT,               -- ゴールの概要（人間が読む）
    role_system       TEXT,               -- 全体の方針（Plannerへのsystem prompt基盤）
    status            TEXT DEFAULT 'in_progress',
                                          -- in_progress | waiting_approval | completed | failed
    summary           TEXT,              -- 現在地の要約（Executorが毎ターン更新）
    latest_output     TEXT,              -- 直近の Executor 出力
    turn_count        INTEGER DEFAULT 0,
    created_at        TEXT,              -- ISO8601
    updated_at        TEXT               -- ISO8601
);
```

**なぜこの構造か:**
- `status` を conversations 側に持つことで、`pending` コマンドが全件スキャンせずに済む
- `summary` / `latest_output` は別PCや別セッションで再開するときのコンテキスト復元に使う

---

## messages

```sql
CREATE TABLE messages (
    message_id        TEXT PRIMARY KEY,   -- uuid4
    conversation_id   TEXT REFERENCES conversations(conversation_id),
    turn_id           INTEGER,            -- 1始まりの連番
    role_executor     TEXT,               -- 'planner' | 'executor'
    source_model      TEXT,              -- 'gpt-4o' | 'claude-sonnet-4-6'
    target_model      TEXT,              -- 次に渡すモデル
    content           TEXT NOT NULL,     -- 発言内容
    requires_approval INTEGER DEFAULT 0, -- 0 | 1
    approved_by       TEXT,              -- 'human' | NULL
    approved_at       TEXT,              -- ISO8601
    status            TEXT DEFAULT 'pending',
                                         -- pending | approved | rejected | executed
    created_at        TEXT               -- ISO8601
);
```

**なぜこの構造か:**
- `role_executor` + `source_model` を分けることで、将来モデルを差し替えても履歴が読める
- `requires_approval` は LLM が自己申告し、Orchestrator が二重チェックする（どちらか一方でも true なら停止）
- `target_model` は Orchestrator がルーティングの記録として書く（分析用）

---

## artifacts

```sql
CREATE TABLE artifacts (
    artifact_id       TEXT PRIMARY KEY,
    message_id        TEXT REFERENCES messages(message_id),
    artifact_type     TEXT,             -- 'code' | 'file' | 'json' | 'markdown' | 'shell'
    filename          TEXT,
    content           TEXT,
    created_at        TEXT
);
```

**なぜこの構造か:**
- LLM の応答本文（`messages.content`）から artifacts を分離することで、コードと説明文が混在しない
- `artifact_type` で `shell` を識別し、自動実行を防ぐ（保存のみ）

---

## run_log

```sql
CREATE TABLE run_log (
    log_id            TEXT PRIMARY KEY,
    conversation_id   TEXT,
    turn_id           INTEGER,
    event_type        TEXT,             -- 'api_call' | 'approval_requested' | 'approved' | 'rejected' | 'error'
    model             TEXT,
    tokens_in         INTEGER,
    tokens_out        INTEGER,
    duration_ms       INTEGER,
    metadata          TEXT,             -- JSON文字列（任意の追加情報）
    created_at        TEXT
);
```

**なぜこの構造か:**
- `event_type` でコスト発生イベント（api_call）と操作イベント（approval等）を区別する
- `tokens_in` / `tokens_out` を記録することで、1会話あたりのコストを後から計算できる
- `metadata` を JSON 文字列にすることで、将来フィールドを追加してもスキーマ変更不要

---

## メッセージの正規化形式

OpenAI / Anthropic の両APIに渡すとき、messages は以下に統一する。

```python
# 共通形式（OpenAI 準拠）
[
    {"role": "user",      "content": "..."},
    {"role": "assistant", "content": "..."},
    ...
]

# Anthropic への変換時
# → messages から role="system" を除去し、system= パラメータへ移動する
```

---

## ステータス遷移

```
conversations.status:
  in_progress → waiting_approval → in_progress（承認後）
  in_progress → completed（終了条件を満たした時）
  in_progress → failed（エラー・reject 時）

messages.status:
  pending → approved → executed
  pending → rejected
```
