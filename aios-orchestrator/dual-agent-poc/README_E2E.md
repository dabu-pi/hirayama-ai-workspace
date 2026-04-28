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

## 次にやること（Phase 5 以降）

| 優先度 | 内容 |
|---|---|
| 1 | artifacts の自動パース・保存（コードブロックを artifacts テーブルへ分離） |
| 2 | 長時間会話（10ターン超）での summary 情報ロス確認（Phase 2 は 2 ターンのみ実測） |

---

## Phase 2 — conversations.summary 自動更新（2026-04-15）

### 目的
長い会話で `build_context()` が `summary` を活用できる状態にする。
Phase 1 までは Executor が summary を更新しておらず、Turn 2 以降も
`summary=null` のまま recent_history だけで文脈を送っていた。

### SPEC — summary 更新ルール

| 項目 | 内容 |
|---|---|
| 更新タイミング | ① ターン正常終了後 (`turn_end`) ② `TASK_COMPLETE` 検出時 ③ `waiting_approval` 遷移時 |
| 更新方式 | **増分更新**。既存 summary + 直前 1 ターンの Planner/Executor 発言だけを渡す。全履歴の再要約はしない |
| 使用モデル | `gpt-4o-mini`（`.env` の `SUMMARY_MODEL` で上書き可能） |
| 出力構造 | 5 項目固定: 目的 / 重要な決定事項 / 未完了タスク / 保留・承認待ち / 次アクション |
| 文字数 | 500 字以内をプロンプトで強制 |
| 失敗時 | 会話本体は続行。`run_log.event_type='summary_update_failed'` に例外を記録 |
| 補助列 | `conversations.summary_updated_at`（ISO8601） |
| マイグレーション | `init_db()` が `PRAGMA table_info` 確認 → 不足なら `ALTER TABLE`（冪等） |

**含める情報:**
- 目的（ゴール）
- 重要な決定事項（採用した方針・仕様）
- 未完了タスク（残っている作業）
- 保留 / 承認待ち（危険操作・approve/reject 待ち）
- 次アクション（直近で Planner が出すべき 1 手）

**含めない情報:**
- 逐語引用・長いコードブロック
- 生ログ・ターン毎の冗長な記録
- 5 項目以外の自由記述

### CHANGES — ファイル一覧

| ファイル | 変更内容 |
|---|---|
| `schema.sql` | `conversations.summary_updated_at TEXT` 列を追加 |
| `store.py` | `init_db()` に冪等マイグレーション / `update_summary()` 新設 |
| `summarizer.py` | **新規**。`generate_summary()` / `mock_summary()` / 5項目 system prompt |
| `run_logger.py` | `EVENT_SUMMARY_UPDATED` / `EVENT_SUMMARY_FAILED` 定数 + log ヘルパー 2 つ |
| `orchestrator.py` | `_update_summary_safely()` 追加 → 3 箇所にフック / `show` 表示強化 / `command_show` 改善 |
| `test_phase2_summary.py` | **新規**。dry-run 検証スクリプト（5 テスト） |
| `.gitignore` | `dual-agent-poc/.venv_phase2/` を追加 |

### CHECKS — 実施した確認（dry-run）

**テストスクリプト:** `python test_phase2_summary.py`

| # | シナリオ | 結果 |
|---|---|---|
| 1 | 通常フロー（TASK_COMPLETE 到達まで 2 ターン） | **OK** — summary が Turn 1 `turn_end` / Turn 2 `task_complete` で計 2 回更新 |
| 2 | 承認フロー（REQUIRES_APPROVAL 検出 → waiting_approval） | **OK** — summary 1 件更新、`event=waiting_approval` がメタデータに残る |
| 3 | summary 生成で例外を投げた場合 | **OK** — `status=completed` 到達、`summary_update_failed` が run_log に 2 件記録、会話本体は無傷 |
| 4 | summary なし（新規会話）での `build_context()` | **OK** — `summary=None` を返し、recent_history のみで従来動作 |
| 5 | `_build_messages_for_llm()` が summary を先頭注入 | **OK** — user ロールで `[会話の要約]` が messages に含まれる |

**回帰テスト（Phase 1 シナリオ A と同じコマンド）:**

```
[Turn 1] context: recent=1件  summary=なし         ← 初回は従来通り
[Turn 1] summary 更新 (dry-run / event=turn_end)
[Turn 2] context: recent=3件  summary=あり         ← Phase 2 で有効化された箇所
[Turn 2] TASK_COMPLETE 検出 — 会話を完了にします
[Turn 2] summary 更新 (dry-run / event=task_complete)
```

`log` コマンド出力にも `summary_updated` が T01 / T02 で 2 件記録される。

### RISKS — 残る限界

| リスク | 内容 | 対処方針 |
|---|---|---|
| 実 API での品質未検証 | dry-run mock で書き込みパスは確認済み。LLM が 5 項目構造を安定維持するかは未実測 | 実 API での Phase 2 実測を Phase 3 の優先事項に |
| コスト加算 | summary 生成で 1 ターンあたり 1 回の追加 API コール（gpt-4o-mini） | `SUMMARY_MODEL` で上書き可。ターンあたり数百トークン想定で過大にはならない |
| summary 更新失敗の連鎖 | 毎ターン失敗し続けると summary は古いまま。次ターンには反映されない | 現状は `run_log` に残すのみ。閾値超えでアラートは Phase 3 以降 |
| approved 後のフォロー更新なし | `approve` / `reject` コマンドで summary は更新しない（次 `run` ターンで自然に更新） | 運用上の問題が出たら専用フックを追加 |

### 次に進むべき 1 手

~~Phase 2 は dry-run 全シナリオ通過・回帰なし。実 API での Phase 2 動作確認を行ってから CLOSED にする。~~
**→ 実 API 実測完了（2026-04-15）。Phase 2 CLOSED。**

---

## Phase 2 — 実 API 実測結果（2026-04-15）

**ステータス: CLOSED**

### 実行内容

| 項目 | 内容 |
|---|---|
| 実施日時 | 2026-04-15 12:33 UTC |
| goal | `FizzBuzzをPythonで実装し、1〜15の結果をMarkdownリストで報告せよ` |
| project_id | `phase2-real` |
| max-turns | 4（実際は 2 ターンで TASK_COMPLETE） |
| 使用 Planner モデル | `gpt-4o-2024-08-06` |
| 使用 Executor モデル | `claude-sonnet-4-6` |
| 使用 summary モデル | `gpt-4o-mini-2024-07-18` |
| 総コスト | $0.01878 |

### summary 品質確認

| 確認項目 | 結果 |
|---|---|
| 文字数（500字以内） | **275字 — OK** |
| 5 項目すべて存在 | **OK** （目的 / 重要な決定事項 / 未完了タスク / 保留・承認待ち / 次アクション） |
| 増分更新 | **OK** （Turn 1: `turn_end` / Turn 2: `task_complete` で各 1 回更新） |
| 完了時の最終状態反映 | **OK** （未完了タスク: なし / 次アクション: （完了）） |

**Turn 2 完了時の summary 内容:**

```
目的: FizzBuzzをPythonで実装し、1〜15の結果をMarkdownリストで報告せよ
重要な決定事項:
- 1から15までの数値のループ処理で結果を生成する方針
- 数値が3で割り切れる場合は「Fizz」、5で割り切れる場合は「Buzz」、両方で割り切れる場合は「FizzBuzz」とする
- その他の場合はその数値をそのまま出力する仕様を採用
- 1〜15の出力結果をMarkdownリスト形式で報告
- 全15件を正常に処理したことを確認
未完了タスク:
- なし
保留 / 承認待ち: なし
次アクション: （完了）
```

### run_log 確認

| event_type | count | 内容 |
|---|---|---|
| `session_start` | 1 | — |
| `api_call` (gpt-4o) | 2 | T01: in=313/out=94 / T02: in=895/out=47 |
| `api_call` (claude-sonnet) | 1 | T01: in=430/out=356 |
| `summary_updated` | 2 | T01 `turn_end` / T02 `task_complete` |
| `summary_update_failed` | **0** | 失敗なし |
| `session_end` | 1 | — |

### 確認済み項目

- [x] 実 Planner (gpt-4o) / 実 Executor (claude-sonnet-4-6) が正常に連携
- [x] Turn 2 で `context: recent=3件 summary=あり` → summary が次ターンの文脈に使用された
- [x] summary が 5 項目固定構造・500字以内に収まった
- [x] 増分更新: Turn 1 `turn_end` → Turn 2 `task_complete` の 2 段階で更新
- [x] `summary_update_failed` が 0 件 — エラーなし
- [x] `summary_updated_at` が DB に記録された
- [x] `show` コマンドで summary と更新日時が表示された

### 問題・未解決事項

| 項目 | 内容 |
|---|---|
| 問題 | なし |
| 未解決 | なし（approval 分岐は dry-run で済んでいるため追加実測は不要と判断） |

---

## Phase 4 — Dashboard 冪等修正（2026-04-15）

### 問題

Phase 3 の冪等キーは `conversation_id` 単体だった。
`waiting_approval` で STOP を報告した後、`approve → run → completed` で SUCCESS を
報告しようとすると `if conv_id in reported` でスキップされ、Sheet に SUCCESS 行が書かれなかった。

### 修正内容

| 変更箇所 | Phase 3 | Phase 4 |
|---|---|---|
| 冪等キー | `conversation_id` | `{conversation_id}_{result}` |
| `log_id` (Sheet 列) | `aios-{conv_id[:8]}` | `aios-{conv_id[:8]}-{result_lower}` |
| ローカル JSON ファイル名 | `aios_TS_HASH.json` | `aios_TS_HASH_result.json` |

### 検証（dry-run / test_phase3_dashboard.py Test 7）

| # | シナリオ | 結果 |
|---|---|---|
| 7a | waiting_approval → STOP 報告 | **OK** (`dashboard_reported` 記録) |
| 7b | completed → SUCCESS 報告（スキップされない） | **OK** (`dashboard_reported` 2件目) |
| 7c | 3回目 completed → `dashboard_skipped` | **OK** |
| 7d | reported_sessions.json に STOP / SUCCESS 両キー | **OK** |

### 検証（実 API / test_phase4_real.py）

実施日: 2026-04-15  
LLM: dry_run=True（approval_test モック）/ Dashboard 書き込み: dry_run=False（実 Sheet）

| Step | 内容 | 結果 |
|---|---|---|
| 1 | run_loop → waiting_approval | **OK** |
| 2 | STOP → Sheet 書き込み | **OK**（`aios_..._stop.json` → Sheet 反映） |
| 3 | approve → set_conversation_status(in_progress) → run → completed | **OK** |
| 4 | SUCCESS → Sheet 書き込み（Phase 3 バグでスキップされたケース） | **OK** |
| 5 | 3回目呼び出し → `dashboard_skipped` | **OK** |

**ステータス: CLOSED**

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
| **Phase 2 dry-run** | summary 自動更新・5 シナリオ | **OK** |
| **Phase 2 実 API** | summary 品質・増分更新・run_log 確認 | **OK（CLOSED）** |
| **Phase 3 dry-run** | Dashboard 反映・冪等・失敗耐性（6 シナリオ） | **OK** |
| **Phase 3 実 API** | 4 ターン → Sheet 書き込み → 冪等確認 | **OK（CLOSED）** |
| **Phase 4 dry-run** | 承認フロー冪等修正（7 シナリオ） | **OK** |
| **Phase 4 実 API** | waiting_approval→STOP / completed→SUCCESS 各 1 行 Sheet 書き込み | **OK（CLOSED）** |
| **Phase 5 調査** | 修正前: 500字超過(最大673字)・12件超過・コードブロック出力を確認 | **問題検出** |
| **Phase 5 修正後 実 API** | 12 ターン・全 7 事実保持・全ターン 500字以内 | **OK（CLOSED）** |
| **Phase 6 dry-run** | artifact 抽出・保存・冪等・失敗耐性（7 テスト） | **OK** |
| **Phase 6 実 API** | FizzBuzz → python コード artifact 保存確認 | **OK（CLOSED）** |
| **Phase 7 dry-run** | false positive フィルタ + artifacts CLI（7 テスト） | **OK（CLOSED）** |
| **Phase 8 実 API** | artifact E2E: 3ターン / 6件保存 / CLI一覧・本文取得 / false positive 0件 | **OK（CLOSED）** |
| **Phase 9 dry-run** | artifact diff: グループ化・diff計算・CLI全モード・失敗ケース・実データ確認（9テスト） | **OK（CLOSED）** |
| **Phase 10 dry-run** | filename 明示指定: 4記法・安全化・後方互換・diff連携（11テスト） | **OK（CLOSED）** |
| **Phase 10 実 API** | explicit 3件保存 / real API unsafe 0件・explicit 1件確認 | **OK（CLOSED）** |
