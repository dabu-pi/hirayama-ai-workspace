# README Task3 — 承認ゲート / run_logger 実装記録

## 実装内容

Task 3 として以下のファイルを新規作成した。

| ファイル | 役割 |
|---|---|
| `approval_gate.py` | Planner 指示の危険フラグ検出 + CLI 承認対話 |
| `run_logger.py` | run_log テーブルへの書き込みラッパー |

---

## approval_gate.py — 関数一覧

| 関数 | 返り値 | 役割 |
|---|---|---|
| `parse_requires_approval(text)` | bool | `REQUIRES_APPROVAL: true` を正規表現で検出 |
| `has_danger_keyword(text)` | bool | DANGER_KEYWORDS リストとマッチングする二重チェック |
| `needs_approval(text, planner_flagged)` | bool | 上記2つの OR 総合判定 |
| `prompt_approval(text)` | bool | CLI で y/n を聞く。不正入力は再入力を求める |
| `prompt_approval_with_message_id(text, message_id)` | bool | message_id を表示しつつ承認確認する |

### orchestrator からの呼び方（想定）

```python
from approval_gate import needs_approval, prompt_approval_with_message_id

planner_flagged = parse_requires_approval(planner_content)
if needs_approval(planner_content, planner_flagged):
    approved = prompt_approval_with_message_id(planner_content, message_id)
    if not approved:
        # 却下 → failed で終了
        set_conversation_status(db_path, conv_id, "failed")
        return
```

### DANGER_KEYWORDS（抜粋）

```python
DANGER_KEYWORDS = [
    "削除", "delete", "DROP TABLE", "rm ",
    "os.remove", "shutil.rmtree",
    "POST ", "send_mail", "freee",
    "overwrite", "上書き",
    ".env", "secret", "credential",
    "subprocess", "os.system", "exec(",
]
```

Planner の申告フラグと独立して動く二重チェック機構。
リストは `approval_gate.py` の `DANGER_KEYWORDS` を直接編集して拡張する。

---

## run_logger.py — 関数一覧

| 関数 | event_type | 説明 |
|---|---|---|
| `log_event(...)` | 任意 | 汎用。専用関数がない場合に使う |
| `log_api_call(...)` | `api_call` | OpenAI / Anthropic 呼び出し後に使う |
| `log_approval_requested(...)` | `approval_requested` | 承認ゲート発動時 |
| `log_approved(...)` | `approved` | Human が y を入力したとき |
| `log_rejected(...)` | `rejected` | Human が n を入力したとき |
| `log_error(...)` | `error` | 例外発生時 |
| `log_session_start(...)` | `session_start` | セッション開始時 |
| `log_session_end(...)` | `session_end` | セッション終了時 |
| `calc_cost(model, tokens_in, tokens_out)` | — | コスト概算（USD）を返す |

### orchestrator からの呼び方（想定）

```python
from run_logger import log_api_call, log_approval_requested, log_approved, log_rejected, log_error

# API 呼び出し後
result = chat_openai(system, messages)
usage = result.get("usage") or {}
log_api_call(
    db_path, conv_id, turn_id,
    model=result["model"],
    tokens_in=usage.get("prompt_tokens"),
    tokens_out=usage.get("completion_tokens"),
    duration_ms=result["duration_ms"],
)

# 承認フロー
log_approval_requested(db_path, conv_id, turn_id, {"message_id": msg_id})
approved = prompt_approval_with_message_id(content, msg_id)
if approved:
    log_approved(db_path, conv_id, turn_id)
else:
    log_rejected(db_path, conv_id, turn_id, {"reason": "human rejection"})

# エラー時
except Exception as e:
    log_error(db_path, conv_id, turn_id, {"error": str(e), "type": type(e).__name__})
```

### event_type 一覧

| event_type | 発生タイミング |
|---|---|
| `session_start` | orchestrator.py start コマンド実行時 |
| `api_call` | OpenAI / Anthropic API を呼んだとき（成功・失敗問わず） |
| `approval_requested` | approval_gate が発動したとき |
| `approved` | Human が y を入力したとき |
| `rejected` | Human が n を入力したとき |
| `error` | 例外が発生したとき |
| `session_end` | 会話が completed / failed になったとき |

---

## コスト概算レート（2026-04 時点）

| モデル | input ($/1M tokens) | output ($/1M tokens) |
|---|---|---|
| gpt-4o | $2.50 | $10.00 |
| claude-sonnet-4-6 | $3.00 | $15.00 |
| claude-opus-4-6 | $15.00 | $75.00 |
| claude-haiku-4-5 | $0.80 | $4.00 |

---

## 動作確認結果

| 確認項目 | 結果 |
|---|---|
| `parse_requires_approval` 10ケース | 全 PASS |
| `needs_approval` 3ケース（flag/kw/neither） | 全 PASS |
| `log_*` 8関数の DB 書き込み | OK（8行確認） |
| `_serialize_metadata` dict/str/None | OK |
| `calc_cost` gpt-4o / claude-sonnet / unknown | OK |
| `prompt_approval` CLI 対話 | 未実施（インタラクティブ入力）|

---

## store.py への修正

**修正なし。** `run_logger.py` は `store.append_run_log()` をそのまま呼ぶ。

---

## 次のタスク

Task 4: `orchestrator.py` の実装
→ `07_next_tasks.md` の Task 4 を参照
