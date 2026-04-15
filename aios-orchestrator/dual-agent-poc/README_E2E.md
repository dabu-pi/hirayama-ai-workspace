# README_E2E — E2E テスト記録（Task 5 完了後）

実施日: 2026-04-15
環境: Windows 11 / Python 3.x / SQLite（`data/store.db`）
API 実呼び出し: **未実施（dry-run で代替）**

---

## 実施した E2E シナリオ

### シナリオ A — 通常フロー（TASK_COMPLETE まで）

| 項目 | 内容 |
|---|---|
| goal | `1+1を計算してMarkdownで報告せよ` |
| project_id | `aios-poc` |
| max-turns | `3` |
| dry-run | YES |

**実行コマンド:**

```bash
python orchestrator.py start --project-id aios-poc --goal "1+1を計算してMarkdownで報告せよ"
# → conversation_id: 4b9a6c84-5a50-4b0a-8c50-12bf1e1fb215

python orchestrator.py show --conv-id 4b9a6c84-5a50-4b0a-8c50-12bf1e1fb215
# → status: in_progress / turn_count: 0

# (Pythonスクリプトで run_loop を直接呼び出し)
run_loop(db, conv_id, max_turns=3, dry_run=True)
```

**結果:**

```
[DRY-RUN] モード: 実 API は呼びません。モック応答を使います。

[Turn 1] 開始  project=aios-poc
[Turn 1] context: recent=1件  summary=なし
[Turn 1] Planner (OpenAI) 呼び出し中... [DRY-RUN]
[Turn 1] Planner: [DRY-RUN Turn 1] 1+1を計算してMarkdownで報告せよ について、
         まず概要を Markdown 形式で作成してください。
[Turn 1] Executor (Anthropic) 呼び出し中... [DRY-RUN]
[Turn 1] Executor: [DRY-RUN Turn 1] 実行結果を報告します。
         ```markdown
         # 結果
         - 計算完了
         - 値: 2
         ```
[Turn 1] 完了 | コスト概算: $0.00000

[Turn 2] 開始  project=aios-poc
[Turn 2] context: recent=3件  summary=なし
[Turn 2] Planner: TASK_COMPLETE ターン 2 でタスクが完了しました。
[Turn 2] TASK_COMPLETE 検出 — 会話を完了にします
run_loop result: completed
```

**最終状態（DB確認）:**

| 項目 | 値 |
|---|---|
| conversations.status | `completed` |
| turn_count | `2` |
| run_log 件数 | `5`（session_start / api_call×3 / session_end） |

**確認済み項目:**

- [x] `start` — DB 作成・会話レコード保存（project_id=aios-poc）
- [x] `show` — project_id / status / turn_count 表示
- [x] Turn 1: Planner モック応答 → Executor モック応答 → DB保存
- [x] Turn 2: TASK_COMPLETE 検出 → status=completed
- [x] `log` — session_start / api_call（モデル名・トークン数）/ session_end 記録
- [x] context の recent 件数が会話の進行とともに増加
- [x] summary なし時は recent_history のみ送信（Turn 1: 1件 → Turn 2: 3件）

---

### シナリオ B — 承認フロー（REQUIRES_APPROVAL 検出）

| 項目 | 内容 |
|---|---|
| goal | `sample.txt を削除する手順を提案せよ` |
| project_id | `aios-poc` |
| dry-run | YES |
| approval-test | YES（必ず `REQUIRES_APPROVAL: true` を含む Planner モック） |

**実行コマンド:**

```bash
# start は Python スクリプトで直接 create_conversation
run_loop(db, conv_b, max_turns=3, dry_run=True, approval_test=True)
```

**結果:**

```
[Turn 1] 開始  project=aios-poc
[Turn 1] Planner: REQUIRES_APPROVAL: true
         [DRY-RUN Turn 1] sample.txt を削除する手順:
         1. os.remove('sample.txt') を実行する

[承認待ち] Turn 1 — Planner が危険操作を要求しています
  message_id : 864e6b39-d074-46a3-bf4b-2f7e03aea054
  承認: python orchestrator.py approve --message-id 864e6b39-d074-46a3-bf4b-2f7e03aea054
  却下: python orchestrator.py reject  --message-id 864e6b39-d074-46a3-bf4b-2f7e03aea054
run_loop result: waiting_approval
```

**pending 確認:**

```
pending count: 1
  message_id : 864e6b39-d074-46a3-bf4b-2f7e03aea054
  conv_id    : 2cc62df0...
  project_id : aios-poc
  turn_id    : 1
  content    : REQUIRES_APPROVAL: true ...
```

**確認済み項目:**

- [x] `REQUIRES_APPROVAL: true` を Planner 応答に検出
- [x] `needs_approval()` が true を返す
- [x] conversations.status = `waiting_approval` に遷移
- [x] Executor を呼ばずに停止
- [x] message_id / approve/reject コマンドを表示
- [x] `pending` — project_id 付きで承認待ち 1件を表示

---

## 軽微修正（dry-run モード追加）

E2E 実施時に `.env` が未配置であり API キー未設定のため、
以下を orchestrator.py に追加した。

| 追加内容 | 詳細 |
|---|---|
| `_mock_planner_response()` | turn_id>=2 で TASK_COMPLETE を含むモック |
| `_mock_executor_response()` | Markdown 形式の実行結果モック |
| `_mock_approval_planner_response()` | 常に `REQUIRES_APPROVAL: true` を含むモック |
| `run_single_turn(dry_run, approval_test)` | dry-run 時はモック応答を使用 |
| `run_loop(dry_run, approval_test)` | パラメータを run_single_turn に転送 |
| `command_run()` | `args.dry_run` / `args.approval_test` を読む |
| `_build_parser()` | `run` サブコマンドに `--dry-run` / `--approval-test` 追加 |

---

## 発生した問題と対処

| 問題 | 原因 | 対処 |
|---|---|---|
| `sqlite3.OperationalError: no such column: project_id` | `data/store.db` が Task 5 以前の旧スキーマのまま残っていた | `store.db` を削除して再作成（PoC 段階は DB 再作成推奨。README_Task5.md 記載の方針に従う） |
| Windows ターミナルの日本語文字化け | Windows cp932 環境 vs UTF-8 の不一致 | Python スクリプト内で `io.TextIOWrapper(encoding='utf-8')` でラップして出力。コアロジックに影響なし |

---

## 次に直すべきこと（実 API E2E）

| 優先度 | 内容 |
|---|---|
| 1 | `.env` に `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` を設定する |
| 2 | `python orchestrator.py run --conv-id <uuid> --max-turns 3`（dry-run なし）を実行 |
| 3 | `run_log` のトークン数・コスト概算が実数で記録されることを確認 |
| 4 | `summary` フィールドの更新ロジックを実装する（現状: Executor が更新しない。別 Phase で対応） |
| 5 | artifacts の自動パース・保存（Phase 2） |

---

## 動作確認結果まとめ（Task 1〜5 + E2E dry-run）

| タスク | 内容 | 結果 |
|---|---|---|
| Task 1 | schema.sql / store.py 基本 CRUD | OK |
| Task 2 | openai_client / anthropic_client | OK（PoC）|
| Task 3 | approval_gate / run_logger | OK |
| Task 4 | orchestrator.py CLI（7コマンド） | OK |
| Task 5 | project_id 隔離 / build_context(limit=10) | OK |
| E2E dry-run A | 通常フロー（TASK_COMPLETE まで 2ターン） | **OK** |
| E2E dry-run B | 承認フロー（REQUIRES_APPROVAL 検出・停止） | **OK** |
| E2E 実 API | OPENAI / ANTHROPIC 実呼び出し | 未実施（.env 未配置） |

---

## 実 API E2E — 第1回試行（2026-04-15）

実施日: 2026-04-15
環境: Windows 11 / Python 3.x / openai 2.31.0 / anthropic 0.95.0

### 使用モデル

| 役割 | モデル |
|---|---|
| Planner (OpenAI) | `gpt-4o`（.env 設定値） |
| Executor (Anthropic) | `claude-sonnet-4-5`（.env 設定値）→ 実 API 返却: `claude-sonnet-4-5-20250929` |

---

### 軽微修正: load_dotenv override=True 化

**問題:** `.env` を配置したにもかかわらず Anthropic API キーが読まれなかった。

**原因:** `load_dotenv(override=False)` のため、Claude Code 実行環境が
`ANTHROPIC_API_KEY=""` を空文字で環境変数にセット済みであり、
`override=False` では「すでに設定済み」と判断して `.env` の値で上書きしなかった。
（OpenAI キーは環境変数自体が存在しなかったため `.env` から正常に読まれていた）

**修正内容:**

| ファイル | 変更箇所 | 変更内容 |
|---|---|---|
| `openai_client.py` | `load_openai_config()` | `override=False` → `override=True` |
| `anthropic_client.py` | `load_anthropic_config()` | `override=False` → `override=True` |

**効果:** `.env` が常に優先されるようになり Anthropic API キーが正常に読み込まれた。

---

### Anthropic API 単独テスト結果

```
Anthropic API: OK
  model: claude-sonnet-4-5-20250929
  content: 2
  usage: {'input_tokens': 41, 'output_tokens': 5}
  duration_ms: 1039ms
```

Executor (Anthropic) は単独で正常動作を確認。

---

### シナリオ A — 実 API 通常フロー（結果: 失敗）

**実行コマンド:**

```bash
python orchestrator.py start --project-id aios-poc --goal "1+1を計算してMarkdownで報告せよ"
# → conversation_id: 39a77036-a9a2-45f2-91ac-45c16b1a0d08

python orchestrator.py run --conv-id 39a77036-a9a2-45f2-91ac-45c16b1a0d08 --max-turns 3
```

**エラー内容:**

```
[ERROR] Planner 呼び出し失敗: Error code: 429 - {
  'error': {
    'message': 'You exceeded your current quota, please check your plan and billing details.',
    'type': 'insufficient_quota',
    'code': 'insufficient_quota'
  }
}
run_loop result: failed
```

**原因:** OpenAI API アカウントの quota 不足（billing 問題。コードではなくアカウント設定の問題）。

**run_log 確認:**

```
run_log (2 rows):
  event_type=session_start  model=None    turn=None
  event_type=error          model=openai  turn=1   meta={error: RateLimitError 429...}
status=failed  turn_count=0
```

error イベントが run_log に正常記録されていることを確認。

**シナリオ B（承認系）:** Planner (OpenAI) が同様に quota 不足のため未実施。

---

### 発生した問題まとめ（実 API 試行）

| 問題 | 種別 | 原因 | 対処 |
|---|---|---|---|
| Anthropic API キーが読まれない | コードバグ | `load_dotenv(override=False)` が空文字の環境変数を「設定済み」と判断 | `override=True` に変更（軽微修正済み） |
| OpenAI 429 quota 不足 | アカウント問題 | OpenAI API アカウントにクレジットがない | OpenAI アカウントに課金追加が必要 |

---

### 次にやること（実 API E2E 完了に向けて）

| 優先度 | 内容 |
|---|---|
| 1 | **OpenAI アカウントにクレジットを追加**（`platform.openai.com` → Billing） |
| 2 | `python orchestrator.py run --conv-id <uuid> --max-turns 3`（quota 解消後） |
| 3 | run_log のトークン数・コスト概算（実数）を確認 |
| 4 | 承認系（シナリオ B）を実 API で確認 |
| 5 | `summary` フィールドの更新ロジック実装（別 Phase） |
| 6 | artifacts 自動パース・保存（Phase 2） |

---

## 実 API E2E — 第2回試行（2026-04-15）

実施日: 2026-04-15
環境: Windows 11 / Python 3.x / openai 2.31.0 / anthropic 0.95.0

### 使用モデル（実 API 返却値）

| 役割 | モデル（.env 設定） | API 実返却モデル名 |
|---|---|---|
| Planner (OpenAI) | `gpt-4o` | `gpt-4o-2024-08-06` |
| Executor (Anthropic) | `claude-sonnet-4-5` | `claude-sonnet-4-5-20250929` |

---

### 事前疎通確認

```
OpenAI API:    OK — gpt-4o-2024-08-06 / 2015ms
Anthropic API: OK — claude-sonnet-4-5-20250929 / 1039ms
```

前回の 429 quota 不足が解消したことを確認。

---

### 軽微修正: calc_cost プレフィックス前方一致対応

**問題:** API が返すモデル名は `gpt-4o-2024-08-06` のように日付サフィックス付きであり、
`_COST_RATES` の完全一致キーにヒットせずコストが常に `$0.000000` になっていた。

**修正内容（`run_logger.py`）:**

- `_COST_RATES` に `claude-sonnet-4-5` レートを追加
- `calc_cost()` を完全一致優先 → プレフィックス前方一致のフォールバックに変更

```python
# 変更前
rate = _COST_RATES.get(model, {"in": 0.0, "out": 0.0})

# 変更後
if model in _COST_RATES:
    rate = _COST_RATES[model]
else:
    rate = next(
        (v for k, v in _COST_RATES.items() if model.startswith(k)),
        {"in": 0.0, "out": 0.0},
    )
```

---

### シナリオ A — 実 API 通常フロー（結果: 成功）

**実行コマンド:**

```bash
# conv_id: 9094e5ce-d4fa-4819-b2f7-990afb711364
python orchestrator.py start --project-id aios-poc --goal "1+1を計算してMarkdownで報告せよ"
python orchestrator.py show  --conv-id 9094e5ce-d4fa-4819-b2f7-990afb711364
python orchestrator.py run   --conv-id 9094e5ce-d4fa-4819-b2f7-990afb711364 --max-turns 3
python orchestrator.py log   --conv-id 9094e5ce-d4fa-4819-b2f7-990afb711364
```

**実行ログ:**

```
[Turn 1] 開始  project=aios-poc
[Turn 1] context: recent=1件  summary=なし
[Turn 1] Planner: 1+1を計算してください。
[Turn 1] Executor: # 実行結果報告 / 計算結果: 1 + 1 = 2 / ステータス: 成功
[Turn 1] 完了 | コスト概算: $0.00384

[Turn 2] 開始  project=aios-poc
[Turn 2] context: recent=3件  summary=なし
[Turn 2] Planner: 1+1を計算してください。
[Turn 2] Executor: # 実行結果報告 / 計算完了 / 1 + 1 = 2
[Turn 2] 完了 | コスト概算: $0.00409

[Turn 3] 開始  project=aios-poc
[Turn 3] context: recent=5件  summary=なし
[Turn 3] Planner: TASK_COMPLETE
         1+1を計算し、Markdown形式での報告を完了しました。計算結果は期待通りでした。
[Turn 3] TASK_COMPLETE 検出 — 会話を完了にします
run_loop result: completed
```

**最終状態（DB確認）:**

| 項目 | 値 |
|---|---|
| conversations.status | `completed` |
| turn_count | `3` |
| project_id | `aios-poc` |
| latest_output | `TASK_COMPLETE\n\n1+1 を計算し、Markdown 形式での...` |

**run_log:**

| event_type | model | tokens_in | tokens_out | cost |
|---|---|---|---|---|
| session_start | - | 0 | 0 | $0.000000 |
| api_call | gpt-4o-2024-08-06 | 303 | 8 | $0.000838 |
| api_call | claude-sonnet-4-5-20250929 | 307 | 121 | $0.002736 |
| api_call | gpt-4o-2024-08-06 | 419 | 8 | $0.001128 |
| api_call | claude-sonnet-4-5-20250929 | 441 | 109 | $0.002958 |
| session_end | - | 0 | 0 | $0.000000 |
| api_call | gpt-4o-2024-08-06 | 525 | 32 | $0.001633 |
| **合計** | | **1,995** | **278** | **$0.009292** |

**確認済み項目:**

- [x] start — DB 保存・project_id=aios-poc
- [x] show — 全フィールド正常表示
- [x] Turn 1: Planner（OpenAI）実応答 → Executor（Anthropic）実応答 → DB 保存
- [x] Turn 2: 2回目の Planner → Executor → context が 3件に増加
- [x] Turn 3: Planner が自主的に TASK_COMPLETE → completed に遷移
- [x] run_log: session_start / api_call×5 / session_end 正常記録
- [x] トークン数・コスト概算（プレフィックス修正後）正常計算
- [x] latest_output に TASK_COMPLETE 応答が保存される

---

### シナリオ B — 実 API 承認フロー（結果: 成功）

**実行コマンド:**

```bash
# conv_id: ad987755-48fa-4894-a23c-df4648f79e60
python orchestrator.py start --project-id aios-poc --goal "sample.txt を削除する手順を提案せよ"
python orchestrator.py run   --conv-id ad987755-48fa-4894-a23c-df4648f79e60 --max-turns 2
python orchestrator.py pending
```

**実行ログ:**

```
[Turn 1] 開始  project=aios-poc
[Turn 1] Planner: REQUIRES_APPROVAL: true
         sample.txt を削除する。

[承認待ち] Turn 1 — Planner が危険操作を要求しています
  message_id : 1f26bf31-a581-42b5-a24a-366d0ecd2442
  承認: python orchestrator.py approve --message-id 1f26bf31-...
  却下: python orchestrator.py reject  --message-id 1f26bf31-...
run_loop result: waiting_approval
```

**pending 表示:**

```
pending count: 2（dry-run 残 1件 + 実 API 新規 1件）
  message_id : 1f26bf31-a581-42b5-a24a-366d0ecd2442
  conv_id    : ad987755...
  project_id : aios-poc
  turn_id    : 1
  content    : REQUIRES_APPROVAL: true\nsample.txt を削除する。
```

**run_log（シナリオ B）:**

| event_type | model | tokens_in | tokens_out | cost |
|---|---|---|---|---|
| session_start | - | 0 | 0 | $0.000000 |
| api_call | gpt-4o-2024-08-06 | 302 | 15 | $0.000905 |
| approval_requested | - | 0 | 0 | $0.000000 |

**確認済み項目:**

- [x] 実 Planner（gpt-4o）が自主的に `REQUIRES_APPROVAL: true` を返した
- [x] conversations.status = `waiting_approval` に遷移
- [x] Executor を呼ばずに停止
- [x] message_id / approve/reject コマンドが表示される
- [x] run_log に `approval_requested` イベントが記録される
- [x] `pending` に project_id 付きで承認待ち 1件が表示される

---

## 発生した問題まとめ（全試行）

| 問題 | 種別 | 原因 | 対処 | ステータス |
|---|---|---|---|---|
| 旧スキーマ DB（project_id なし） | 旧DB残存 | Task 5 以前の DB が残っていた | store.db 削除・再作成 | 解消済み |
| Windows ターミナル文字化け | 環境 | cp932 vs UTF-8 不一致 | TextIOWrapper で UTF-8 ラップ | 運用回避済み |
| ANTHROPIC_API_KEY が読まれない | コードバグ | `override=False` が空文字を「設定済み」と判断 | `override=True` に変更 | **修正済み** |
| OpenAI 429 quota 不足 | アカウント | クレジット不足 | OpenAI Billing でクレジット追加 | **解消済み** |
| コスト計算が常に $0 | コードバグ | API 返却モデル名の日付サフィックスが完全一致しない | プレフィックス前方一致に変更 + claude-sonnet-4-5 追加 | **修正済み** |

---

## 次にやること（Phase 2 以降）

| 優先度 | 内容 |
|---|---|
| 1 | `summary` フィールドの更新ロジック実装（現状: Executor が更新しない） |
| 2 | artifacts の自動パース・保存（Phase 2） |
| 3 | context 件数が増えてきた際の summary 自動生成（Phase B） |
| 4 | run_log → Dashboard 連携（Phase C） |

---

## 動作確認結果まとめ（Task 1〜5 + E2E 全体）

| タスク | 内容 | 結果 |
|---|---|---|
| Task 1 | schema.sql / store.py 基本 CRUD | OK |
| Task 2 | openai_client / anthropic_client | OK（PoC）|
| Task 3 | approval_gate / run_logger | OK |
| Task 4 | orchestrator.py CLI（7コマンド） | OK |
| Task 5 | project_id 隔離 / build_context(limit=10) | OK |
| E2E dry-run A | 通常フロー（TASK_COMPLETE まで 2ターン） | **OK** |
| E2E dry-run B | 承認フロー（REQUIRES_APPROVAL 検出・停止） | **OK** |
| 実 API 第1回 Anthropic 単独 | Executor 単独 API 呼び出し | **OK**（1039ms） |
| 実 API 第1回 OpenAI | Planner API 呼び出し | **NG**（429 quota — 解消済み） |
| 実 API 第2回 シナリオ A | Planner → Executor → TASK_COMPLETE | **OK**（3ターン / $0.009292） |
| 実 API 第2回 シナリオ B | REQUIRES_APPROVAL 検出 → waiting_approval | **OK**（実 Planner が自主申告） |
