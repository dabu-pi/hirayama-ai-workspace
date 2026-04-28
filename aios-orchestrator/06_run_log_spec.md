# 06 Run Log Spec — 実行ログ仕様

## 目的

- **コスト追跡:** 1会話あたりのトークン数・推定費用を記録する
- **監査:** どのモデルがいつ何を実行したかを追跡する
- **デバッグ:** エラー発生時の原因特定に使う
- **将来の Dashboard 連携:** AIOS の Run_Log シートと統合する前提で設計する

---

## event_type 定義

| event_type | 発生タイミング |
|---|---|
| `api_call` | OpenAI / Anthropic API を呼び出した（成功・失敗問わず） |
| `approval_requested` | approval_gate が起動した（Human に判断を求めた） |
| `approved` | Human が `y` を入力した |
| `rejected` | Human が `n` を入力した |
| `error` | 例外が発生した |
| `session_start` | `orchestrator.py start` が実行された |
| `session_end` | 会話が `completed` / `failed` になった |

---

## Human が run_log を読む方法

### CLIで確認する（PoC段階）

```bash
# 1会話のログを表示
python orchestrator.py log --conv-id abc-123

# 出力イメージ
[session_start] 2026-04-15T10:00:00  goal: "九九表を生成してMarkdownで保存せよ"
[api_call]      Turn 1  gpt-4o         in:820  out:180  312ms
[api_call]      Turn 1  claude-s-4-6   in:1200 out:420  580ms
[approval_req]  Turn 2  ---            "ファイル書き込みを要求"
[approved]      Turn 2  human          y
[api_call]      Turn 2  gpt-4o         in:1400 out:150  290ms
[api_call]      Turn 2  claude-s-4-6   in:1800 out:680  710ms
[session_end]   Turn 3  completed      total_tokens: 7650  cost: $0.0245
```

### SQLite を直接クエリする

```sql
-- 会話のコスト集計
SELECT
    conversation_id,
    SUM(tokens_in)  AS total_in,
    SUM(tokens_out) AS total_out,
    COUNT(*)        AS api_calls,
    MIN(created_at) AS started,
    MAX(created_at) AS ended
FROM run_log
WHERE event_type = 'api_call'
GROUP BY conversation_id;

-- 承認操作の一覧
SELECT * FROM run_log
WHERE event_type IN ('approval_requested', 'approved', 'rejected')
ORDER BY created_at DESC;
```

---

## コスト計算の基準値（2026-04時点）

| モデル | input ($/1M tokens) | output ($/1M tokens) |
|---|---|---|
| gpt-4o | $2.50 | $10.00 |
| claude-sonnet-4-6 | $3.00 | $15.00 |

```python
# run_logger.py に含めるコスト計算関数
COST_TABLE = {
    "gpt-4o":              {"in": 2.50, "out": 10.00},
    "claude-sonnet-4-6":   {"in": 3.00, "out": 15.00},
}

def calc_cost(model, tokens_in, tokens_out):
    rate = COST_TABLE.get(model, {"in": 0, "out": 0})
    return (tokens_in * rate["in"] + tokens_out * rate["out"]) / 1_000_000
```

---

## 将来の Dashboard 連携（前提設計）

AIOS の de コマンドが書き込む `Run_Log` シートと将来統合する前提で、以下の列を run_log に持たせる。

| run_log カラム | Run_Log シート列（将来） |
|---|---|
| conversation_id | 案件ID相当 |
| event_type | イベント種別 |
| model | 実行モデル |
| tokens_in + tokens_out | トークン合計 |
| duration_ms | 実行時間 |
| created_at | 実行日時 |

統合時は `scripts/append-runlog-to-sheet.mjs` の拡張として実装する。
PoC 段階では SQLite への記録のみで十分であり、シート書き込みは実装しない。

---

## run_logger.py のインターフェース

```python
def log(
    conv_id: str,
    turn_id: int,
    event_type: str,   # api_call | approval_requested | approved | rejected | error | ...
    model: str | None,
    tokens_in: int = 0,
    tokens_out: int = 0,
    duration_ms: int = 0,
    metadata: dict | None = None,
) -> None:
    """run_log テーブルに1レコードを INSERT する。例外は握り潰さず呼び出し元に伝播する。"""
```
