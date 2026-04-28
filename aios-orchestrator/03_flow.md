# 03 Flow — 実行フロー

## 1ターンの流れ

```
┌─────────────────────────────────────────────────┐
│  Turn N                                          │
│                                                  │
│  1. store.get_history(conv_id)                   │
│     → messages 全件を時系列で取得                 │
│                                                  │
│  2. openai_client.chat(system_planner, history)  │
│     → Planner（ChatGPT）が次の指示を1つ書く        │
│     → requires_approval フラグを自己申告           │
│                                                  │
│  3. store.append_message(..., role='planner')    │
│     run_logger.log('api_call', 'gpt-4o', ...)   │
│                                                  │
│  4. [approval check]                             │
│     requires_approval == true                    │
│       → conversations.status = waiting_approval  │
│       → approval_gate.prompt(content) → y/n      │
│         y: messages.status = approved, 続行       │
│         n: messages.status = rejected            │
│            conversations.status = failed         │
│            → ループ終了                           │
│                                                  │
│  5. store.get_history(conv_id)  ← 再取得          │
│     （Plannerの発言を含む最新状態）                 │
│                                                  │
│  6. anthropic_client.chat(system_exec, history)  │
│     → Executor（Claude）が指示を読んで実行・報告   │
│                                                  │
│  7. store.append_message(..., role='executor')   │
│     run_logger.log('api_call', 'claude-...', ...)│
│     artifacts があれば store.save_artifacts()    │
│                                                  │
│  8. 終了条件チェック（→ 下記）                    │
│                                                  │
└─────────────────────────────────────────────────┘
```

---

## System Prompt の設計

### Planner (OpenAI) へのsystem prompt

```
あなたはPlannerです。
Executorへの次の実行指示を1つだけ書いてください。

ルール:
- 指示は具体的かつ1ステップに限定すること
- 以下の操作を指示する場合は必ず1行目に「REQUIRES_APPROVAL: true」と書くこと
  - ファイルの削除・上書き
  - 外部APIへのPOST（freee・Gmail等）
  - 環境変数・設定ファイルの変更
- タスクが完了したと判断したら「TASK_COMPLETE」と書くこと
- 1回の応答で複数の指示を書かないこと
```

### Executor (Anthropic) へのsystem prompt

```
あなたはExecutorです。
Plannerの最新指示を読んで実行し、結果を報告してください。

ルール:
- 実行結果は必ず報告すること（成功・失敗・不明を明記）
- コードを生成した場合は ```コードブロック``` で囲むこと
- ファイルを生成した場合は「ARTIFACT: filename.ext」と宣言してから内容を書くこと
- 実行できない・判断できない場合は「BLOCKED: 理由」と書いてPlannerへ差し戻すこと
```

---

## 承認フロー

```
Orchestrator が以下のいずれかを検知した場合に停止する:

  条件A: Planner の応答に「REQUIRES_APPROVAL: true」が含まれる
  条件B: Orchestrator が独自ルール（キーワードリスト）で危険と判断した

停止後の動作:
  1. 承認待ちの内容を CLI に表示する
  2. Human が [y/n] で応答する
  3. y → 承認・実行継続
     n → rejection を記録し、conversations.status = 'failed' で終了
         (rejection 理由を metadata に保存)
```

---

## 終了条件

| 条件 | 判定方法 | 動作 |
|---|---|---|
| タスク完了 | Planner が「TASK_COMPLETE」を含む応答をした | `status = completed` で終了 |
| ターン上限 | `turn_count >= max_turns` | 警告を表示して終了 |
| Executor が Blocked | Executor が「BLOCKED:」で始まる応答をした | Planner に差し戻すが、3回連続なら中断 |
| Human が Reject | approval_gate で `n` を入力 | `status = failed` で終了 |
| API エラー | 例外が発生した | run_log にエラーを記録し終了 |

---

## 1セッション全体の流れ

```
$ python orchestrator.py start --goal "九九表をMarkdownで生成しファイル保存せよ"

  → conversation_id: abc-123 を生成
  → turn 1 開始

[Turn 1] Planner → "Pythonで9x9の乗算表を生成するコードを書いてください"
[Turn 1] Executor → "コードを生成しました。\n```python\n...\n```"
          ARTIFACT: multiplication_table.md

[Turn 2] Planner → "生成したコードをファイルに保存してください"
         REQUIRES_APPROVAL: true  ← 検知

>>> [承認待ち] Planner が以下を要求しています:
    "ファイル multiplication_table.md を data/ に保存する"
    承認しますか？ [y/n]: y

[Turn 2] Executor → "ファイルを data/multiplication_table.md に保存しました"

[Turn 3] Planner → "TASK_COMPLETE。目標達成を確認しました"

  → conversations.status = completed
  → セッション終了
```
