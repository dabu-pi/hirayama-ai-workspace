# 04 Risks — リスクと対策

## リスク一覧

| # | リスク | 深刻度 | 対策 |
|---|---|---|---|
| R1 | 無限ループ | 高 | max_turns + TASK_COMPLETE 強制 |
| R2 | 誤実行（不可逆操作） | 高 | approval_gate の二重判定 |
| R3 | コスト暴走 | 中 | ターン上限 + 起動時コスト警告 |
| R4 | APIキー漏洩 | 高 | .env 管理 + コミット前チェック |
| R5 | artifacts の自動実行 | 高 | 保存のみ・実行コードは生成しない |
| R6 | LLM の指示逸脱 | 中 | system prompt の厳密化 + Blocked 機構 |

---

## R1: 無限ループ

**発生条件:**
- Planner と Executor が互いに「次の指示をください」「指示を待っています」を繰り返す
- TASK_COMPLETE が出ないまま max_turns に到達する

**対策:**

```python
# orchestrator.py
MAX_TURNS_DEFAULT = 10  # 起動時に --max-turns で上書き可能

# Planner の system prompt に必ず含める
"タスクが完了したと判断したら「TASK_COMPLETE」と書くこと。"
"最大{MAX_TURNS}ターンで完了するように計画を立てること。"

# ターン上限到達時の動作
if turn_count >= max_turns:
    print(f"[警告] max_turns ({max_turns}) に到達しました。会話を終了します。")
    store.update_status(conv_id, 'failed')
    break
```

**検出サイン:** 同じ内容の messages が3ターン以上続く場合は中断を検討する。

---

## R2: 誤実行（不可逆操作）

**発生条件:**
- Planner が `REQUIRES_APPROVAL: true` を書かずに危険操作を指示する
- Human が内容を確認せずに承認する

**対策（二重チェック）:**

```python
# approval_gate.py
DANGER_KEYWORDS = [
    "削除", "delete", "DROP", "rm ", "os.remove",
    "POST", "send_mail", "freee",
    "overwrite", "上書き", ".env",
]

def needs_approval(content: str, planner_flagged: bool) -> bool:
    keyword_hit = any(kw in content for kw in DANGER_KEYWORDS)
    return planner_flagged or keyword_hit
```

**承認 UI:**

```
>>> [承認待ち] Turn 3 — Planner の指示
────────────────────────────────────
ファイル data/output.csv を削除してください
────────────────────────────────────
この操作は不可逆です。実行しますか？ [y/n]: 
```

---

## R3: コスト暴走

**発生条件:**
- max_turns を大きく設定してセッションを放置する
- 長い context を毎ターン全件送信する

**対策:**

```python
# 起動時に概算コストを表示する
# gpt-4o: input $2.50/1M tokens, output $10.00/1M tokens
# claude-sonnet-4-6: input $3.00/1M tokens, output $15.00/1M tokens

def estimate_cost(max_turns, avg_tokens_per_turn=2000):
    openai_cost = max_turns * avg_tokens_per_turn * 2.50 / 1_000_000
    anthropic_cost = max_turns * avg_tokens_per_turn * 3.00 / 1_000_000
    total = (openai_cost + anthropic_cost) * 2  # in + out
    print(f"[コスト概算] max_turns={max_turns}: 約 ${total:.4f}")
```

**追加対策:**
- context が長くなりすぎた場合、古い messages を summary に圧縮するオプションを将来追加する
- run_log の tokens_in / tokens_out を毎ターン表示し、Human が把握できるようにする

---

## R4: APIキー漏洩

**発生条件:**
- `.env` を git commit する
- `openai_client.py` や `orchestrator.py` にキーを直書きする

**対策:**

```
# .gitignore に追加
.env
data/store.db
data/

# .env.example を代わりにコミットする
OPENAI_API_KEY=your-key-here
ANTHROPIC_API_KEY=your-key-here
```

```python
# store.py の init_db() で実行時チェック
import os
assert not os.path.exists('.env') or 'your-key-here' not in open('.env').read(), \
    ".env にサンプルキーが残っています"
```

---

## R5: artifacts の自動実行

**発生条件:**
- Executor が生成したシェルスクリプトや Python コードを Orchestrator が自動実行する

**対策:**
- artifacts テーブルへの保存のみ行う
- `artifact_type = 'shell'` のものは保存時に警告を表示する
- 実行は Human が手動で確認してから行う
- `exec()` / `subprocess.run()` / `os.system()` は Orchestrator コードに一切書かない

---

## R6: LLM の指示逸脱

**発生条件:**
- Planner が role（Planner）を忘れ、自分で実行しようとする
- Executor が指示を無視して別の行動をとる

**対策:**
- system prompt の先頭に「あなたは〇〇です」を毎回入れる（stateless API なので必須）
- Executor の応答に「BLOCKED:」パターンを用意し、逸脱時に明示的に報告させる
- 3ターン連続 BLOCKED の場合は Orchestrator が強制終了する
