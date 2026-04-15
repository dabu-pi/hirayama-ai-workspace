# README_Task6 — run_log → Dashboard 連携（Phase 3）

実装日: 2026-04-15
ステータス: **CLOSED**

---

## 目的

orchestrator セッション完了時に、既存の Dashboard Run_Log シートへ
実行結果を自動反映する。ローカル `run_log` だけで終わらず、
Dashboard 運用と接続する。

---

## 実装ファイル

| ファイル | 役割 |
|---|---|
| `dashboard_reporter.py` | **新規**。エントリ構築・ローカル保存・Sheet 書き込み・冪等管理 |
| `orchestrator.py` | `command_run()` 終端に `_report_to_dashboard_safely()` を追加 |
| `run_logger.py` | `dashboard_reported` / `dashboard_report_failed` / `dashboard_skipped` イベント追加 |

---

## アーキテクチャ

```
orchestrator run_loop
        ↓  完了（completed / failed / waiting_approval / max_turns）
command_run()
        ↓
_report_to_dashboard_safely()
        ├── get_conversation() + get_run_log()
        ├── dashboard_reporter.report_session()
        │       ├── build_entry()           ← 10列 dict 構築
        │       ├── export_local()          ← logs/aios-orchestrator/*.json 保存（常時）
        │       ├── idempotency check       ← reported_sessions.json 照合
        │       └── post_to_sheet()         ← node scripts/append-runlog-to-sheet.mjs 呼び出し
        └── run_log に dashboard_reported / dashboard_skipped / dashboard_report_failed を記録
```

---

## 反映対象項目（Run_Log シート 10 列）

| 列 | 内容 | orchestrator の値 |
|---|---|---|
| `log_id` | ログ識別子 | `"aios-{conv_id[:8]}"` |
| `datetime` | 更新日時 | `conv.updated_at`（YYYY-MM-DD HH:MM:SS） |
| `system` | システム名 | `"aios-orchestrator"` |
| `project` | project_id | `conv.project_id` |
| `summary` | 概要 | `"{title} [{status}/{turn}turns]"` |
| `result` | 実行結果 | `completed→SUCCESS / waiting_approval→STOP / failed→ERROR / other→PARTIAL` |
| `commit_hash` | 識別子 | `conv_id[:8]`（git hash の代わり） |
| `tasks_done` | ターン数 | `conv.turn_count` |
| `stop_reason` | 停止理由 | `"" / "waiting_approval" / error メッセージ` |
| `next_action` | 次アクション | summary の「次アクション:」行を抽出 |

---

## 実行トリガー

- `orchestrator.py run` コマンドの完了後（ループ結果問わず）
- `completed` / `failed` / `waiting_approval` / `max_turns_reached` すべてで呼ばれる

---

## Idempotency 方針

- `logs/aios-orchestrator/reported_sessions.json` で報告済み `conversation_id` を追跡
- 同一 `conversation_id` が 2 回 `report_session()` を呼ばれた場合:
  - Sheet への書き込みをスキップ
  - `run_log.event_type = "dashboard_skipped"` を記録
  - ローカル JSON は**毎回**書き出す（上書きではなく新しいタイムスタンプで追記）
- `reported_sessions.json` への記録は Sheet 書き込み成功後のみ

---

## 失敗時挙動

| 失敗パターン | 動作 |
|---|---|
| env vars 未設定（`AIOS_DASHBOARD_SPREADSHEET_ID` 等） | Sheet スキップ / ローカルのみ |
| Node スクリプトが見つからない | Sheet スキップ / ローカルのみ |
| Node スクリプトが exit code 1 | Sheet 失敗 / ローカルは保存 / `dashboard_report_failed` を run_log に記録 |
| Node タイムアウト（30s） | 同上 |
| `report_session()` 内で予期しない例外 | `_report_to_dashboard_safely()` が吸収 / orchestrator 継続 |
| `_report_to_dashboard_safely()` 内で予期しない例外 | 最終安全網 try/except / orchestrator 継続 |
| `log_dashboard_*` の DB 書き込みも失敗 | 完全に無視（pass） |

**会話本体（run_loop）は Dashboard 失敗でも一切止まらない。**

---

## 必要な環境変数

| 変数名 | 説明 | 未設定時の動作 |
|---|---|---|
| `AIOS_DASHBOARD_SPREADSHEET_ID` | Dashboard の Google Spreadsheet ID | Sheet スキップ（ローカル保存のみ） |
| `AIOS_SERVICE_ACCOUNT_PATH` | Service Account JSON のパス | Sheet スキップ |
| `AIOS_RUNLOG_SHEET_NAME` | 書き込むシート名（デフォルト: `Run_Log`） | デフォルト値を使用 |
| `AIOS_RUNLOG_SHEET_WRITE` | `"1"` で書き込み有効化 | `0` 扱い → Sheet スキップ |

**設定場所:** Windows ユーザー環境変数（`[Environment]::SetEnvironmentVariable`）
**参考:** `ai-os/CODEX_SHEETS_DIRECT_WRITE_SETUP.md`

---

## ローカル保存パス

```
workspace/logs/aios-orchestrator/
├── aios_YYYYMMDD_HHMMSS_<conv_id[:8]>.json   ← セッション毎に出力
└── reported_sessions.json                      ← 冪等管理ファイル
```

**ローカル JSON 形式（10列 + 追加フィールド）:**
```json
{
  "log_id":          "aios-9e32f23a",
  "datetime":        "2026-04-15 12:49:27",
  "system":          "aios-orchestrator",
  "project":         "AIOS-06",
  "summary":         "素数判定関数をPythonで実装し… [completed/4turns]",
  "result":          "SUCCESS",
  "commit_hash":     "9e32f23a",
  "tasks_done":      "4",
  "stop_reason":     "",
  "next_action":     "（完了）",
  "conversation_id": "9e32f23a-3e61-4fc4-9a93-0e5eee6f3d1c",
  "source":          "aios-orchestrator"
}
```

---

## 今回の制限事項

| 項目 | 内容 |
|---|---|
| Projects シート同期なし | `de` コマンドが行う Projects 列更新（次アクション / 最終更新日 / 補足）は未実装。Run_Log への append のみ |
| `waiting_approval` → 再 run 後の再報告 | `approve` 後に `run` を再実行すると conv_id が同一なので冪等スキップになる。最終状態が Sheet に反映されない |
| `failed` セッションの再試行 | 同上。`failed` 後に新 session を立てれば別 conv_id として記録される |
| summary なし時の `next_action` | summary が書き込まれていない場合は `next_action = ""`（空） |
| timestamp 精度 | `reported_sessions.json` は UTC 秒精度 |

---

## run_log イベント一覧（Phase 3 追加分）

| event_type | 記録タイミング |
|---|---|
| `dashboard_reported` | Sheet 書き込み成功（または dry_run） |
| `dashboard_report_failed` | Sheet 書き込み失敗 / 予期しない例外 |
| `dashboard_skipped` | 冪等チェックで既報告と判断 |

---

## 検証結果サマリ

| # | テスト | 結果 |
|---|---|---|
| 1 | status → result マッピング（5ケース） | OK |
| 2 | ローカル JSON 保存 | OK |
| 3 | dry-run run_loop → Dashboard ローカル保存 | OK |
| 4 | 冪等: 2 回報告 → `dashboard_skipped` | OK |
| 5 | 失敗耐性: 例外吸収 → `dashboard_report_failed` | OK |
| 6 | `reported_sessions.json` 保存 | OK |
| 実 API | 4 ターン → Sheet 書き込み → `dashboard_reported` | OK |
| 冪等 real | 同 conv_id に 2 回呼び出し → Sheet 書き込みなし | OK |
