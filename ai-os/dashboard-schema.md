# dashboard-schema.md - ダッシュボードスプレッドシート スキーマ定義

Google スプレッドシート「Hirayama_AI_OS_Dashboard」の全シート定義。`workspace/ai-os/spec.md` のダッシュボード層に対応する。

> 注意: スプレッドシートのID・URLはこのファイルに記載しない（セキュリティ上の理由）。

---

## シート構成（全7シート・この順序で配置）

| # | シート名 | 役割 | 更新者 |
|---|---|---|---|
| 1 | [Dashboard](#1-dashboard) | 集約ビュー・コントロールパネル（数式参照型） | 数式のみ |
| 2 | [Lists](#2-lists) | ドロップダウン用マスタ値・語彙の統制 | 人間のみ |
| 3 | [Projects](#3-projects) | プロジェクト一覧・現在状態 | 人間のみ |
| 4 | [Ideas](#4-ideas) | アイデア収集・パーキングロット | 人間のみ |
| 5 | [Task_Queue](#5-task_queue) | 直近タスクキュー・実行管理 | 人間 + Claude |
| 6 | [Run_Log](#6-run_log) | 実行ログ・監査履歴 | 人間（将来GAS） |
| 7 | [Metrics](#7-metrics) | KPI・定量指標 | 人間のみ |

---

## 1. Dashboard

### 目的

全シート（Projects / Ideas / Task_Queue / Run_Log / Metrics）のデータを参照・集約し、プロジェクト全体の状況を一画面で把握するコントロールパネル。

**このシートにはデータを直接入力しない。数式・参照セルのみで構成する。**

### 設計方針

| 方針 | 内容 |
|---|---|
| 更新方式 | 数式参照型（QUERY・FILTER・IMPORTRANGE 等）。データシートの変更に連動して自動反映 |
| GAS書き込み | 禁止 |
| 人間による直接入力 | 原則禁止。将来的に必要な場合は `[INPUT]` プレフィックスを付けたセルのみ許可 |

### 想定表示内容

| 表示項目 | 参照元 | 内容 |
|---|---|---|
| プロジェクトサマリ | Projects | 全プロジェクトのステータス・フェーズ一覧 |
| 直近タスク | Task_Queue | status が `実行中` / `待機` のタスク上位 N 件 |
| 直近ログ | Run_Log | 最新 5-10 件のセッション記録 |
| KPI スナップショット | Metrics | 最新値の抜粋（月次来院患者数・タスク完了数等） |
| プロジェクト数カウント | Projects | `稼働中` / `進行中` / `企画段階` の件数 |

### 更新ルール

- 数式セルの追加・変更は人間が明示的に行う
- `[INPUT]` プレフィックスのセルのみ手動入力を許可（現時点では未設置）
- GAS による書き込みは禁止
- このシートの構成変更は `dashboard-schema.md` のスキーマ変更履歴に記録する

---

## 2. Lists

### 目的

他シートのドロップダウン（データ検証）で使用する有効値を一元管理する。語彙の定義をここに集約することで、全シートの入力値が統制される。

**このシートが全語彙の単一ソース（Single Source of Truth）。**

### 語彙グループ定義

> **列レイアウト（2026-03-08 確定）:** Row 1 が列ヘッダー（グループ名）、Row 2 以降に有効値を縦展開。
> 詳細な対応表・日英変換・変更手順は `VOCAB_MASTER.md` を参照。

| 列 | グループ名 | 使用シート | 有効値（日本語表記） |
|---|---|---|---|
| A | `status`（プロジェクトステータス） | Projects | `稼働中` / `進行中` / `試作` / `保留` / `完了` |
| B | `phase`（フェーズ） | Projects | `構想` / `設計` / `実装` / `テスト` / `運用` / `安定運用` / `Phase1`-`Phase4` / `PhaseB` / `Ops` |
| C | `type`（プロジェクト種別） | Projects | `本番` / `試行` / `ローカル専用` / `なし` |
| D | `system`（実行系） | Run_Log | `Sheets` / `GitHub` / `GAS` / `Claude` / `ChatGPT` / `Codex` / `freee` / `Local` |
| E | `assigned_to`（担当） | Task_Queue | `AI` / `人` / `AI+人` |
| F | `task_status`（タスクステータス） | Task_Queue | `未着手` / `進行中` / `待機` / `停止中` / `完了` |
| G | `task_type`（タスク種別） | Task_Queue | `実行` / `テスト` / `開発` / `文書` / `調査` / `設計` / `Ops` |
| H | `priority`（優先度） | Task_Queue | `高` / `中` / `低` |
| I | `idea_status`（アイデアステータス） | Ideas | `アイデア` / `調査中` / `計画済み` / `保留` / `プロジェクト化済み` |

> **補足グループ（Lists 外・変更禁止）:**
> - `run_result`: `SUCCESS` / `STOP` / `ERROR` / `PARTIAL`
> - `project_id`: `GAS-01` / `FREEE-02` / `WEB-03` / `STR-04` / `WST-05` / `AIOS-06` / `AINV-07`

### シート構成（確定レイアウト）

**カラム型レイアウト（2026-03-08 確定）:** Row 1 に列ヘッダー（グループ名）を配置し、Row 2 以降に有効値を縦に並べる。各列が独立したドロップダウングループに対応する（A列=status / B列=phase / C列=type / D列=system / E列=assigned_to / F列=task_status / G列=task_type / H列=priority / I列=idea_status）。スプレッドシートのデータ検証は各列を範囲指定して参照する。

### 更新ルール

- **更新者:** 人間のみ（GAS 書き込み禁止）
- **タイミング:** 新プロジェクト追加時・語彙変更時のみ
- **project_id への追加:** 新プロジェクト開始時に末尾に追加する。既存 ID は変更しない
- **変更時:** `dashboard-schema.md` のスキーマ変更履歴にも記録する
- **削除:** 有効値を削除すると既存データの整合性が崩れるため、原則削除しない

---

## 3. Projects

### 目的

workspace の全プロジェクトの現在のステータス・フェーズ・優先度を一覧で管理する。週に1回程度、または大きな変化があった時に更新する。

### 必須カラム

| カラム | 型 | 説明 |
|---|---|---|
| `project_id` | TEXT | プロジェクトID（Lists.project_id から選択） |
| `project_name` | TEXT | プロジェクト名 |
| `directory` | TEXT | `workspace/` からの相対パス |
| `status` | TEXT | Lists.status から選択 |
| `phase` | TEXT | 現在のフェーズ |
| `priority` | NUMBER | 優先度（1が最高） |
| `last_updated` | DATE | 最終更新日（YYYY-MM-DD） |

### オプションカラム

| カラム | 型 | 説明 |
|---|---|---|
| `next_action` | TEXT | 次にやるべきこと（1行） |
| `blocker` | TEXT | 現在の阻害要因 |
| `notes` | TEXT | 備考・メモ |

### 2026-03-13 minimal sheet-management columns

| カラム | 型 | 説明 |
|---|---|---|
| `local_folder` | TEXT | 正規ローカル作業パス |
| `main_sheet_name` | TEXT | 正本スプレッドシート名 |
| `main_sheet_id` | TEXT | 正本スプレッドシートID |
| `current_folder` | TEXT | 現在のDriveフォルダ |
| `target_folder` | TEXT | 目標Driveフォルダ |
| `sheet_status` | TEXT | `source_of_truth` / `active` / `migration_target` など |
| `cleanup_status` | TEXT | `keep` / `archive_candidate` / `delete_candidate` など |
| `evidence_note` | TEXT | 根拠メモ |

### 2026-03-13 management note

- `GAS-01` uses `【毎日記録】来店管理施術録ver3.1` as the current source-of-truth sheet.
- `WEB-03` remains visible only as a migration / archive candidate and should not be treated as the current source of truth.
- `WST-05` uses `workspace/waste-report-system` as the canonical local folder path.
- `AINV-07` should remain visible as a registration candidate until the Projects row is finalized.

---

## 4. Ideas

### 目的

新機能のアイデア・改善提案・将来やりたいことを収集・評価・分類する。思いついたら即座に登録し、後でまとめてレビューする。

### 必須カラム

| カラム | 型 | 説明 |
|---|---|---|
| `idea_id` | TEXT | ID（例: `IDEA-001`） |
| `title` | TEXT | アイデアのタイトル |
| `project` | TEXT | 関連プロジェクト（Lists.project_id から選択、または `COMMON`） |
| `status` | TEXT | Lists.idea_status から選択 |
| `created_at` | DATE | 登録日 |

### オプションカラム

| カラム | 型 | 説明 |
|---|---|---|
| `description` | TEXT | 詳細説明 |
| `effort` | TEXT | 工数レベル |
| `impact` | TEXT | 影響度 |
| `source` | TEXT | 発生源 |
| `notes` | TEXT | 評価コメント |

---

## 5. Task_Queue

### 目的

直近に実行するタスクを優先順位付きで管理する。

### 必須カラム

| カラム | 型 | 説明 |
|---|---|---|
| `task_id` | TEXT | タスクID（例: `TASK-001`） |
| `title` | TEXT | タスクタイトル |
| `project` | TEXT | 関連プロジェクトID（Lists.project_id から選択） |
| `status` | TEXT | Lists.task_status から選択 |
| `priority` | NUMBER | 優先度（1が最高） |
| `created_at` | DATE | 登録日 |

### オプションカラム

| カラム | 型 | 説明 |
|---|---|---|
| `assigned_to` | TEXT | 担当（Lists.assigned_to から選択） |
| `due_date` | DATE | 期限 |
| `completed_at` | DATE | 完了日 |
| `notes` | TEXT | 備考・STOP理由 |
| `roadmap_ref` | TEXT | ROADMAP.md での対応タスク番号 |

---

## 6. Run_Log

### 目的

開発セッション・スクリプト実行の記録を時系列で保存する。セッション終了後に追記し、次回の引き継ぎ情報として活用する。

### 必須カラム

| カラム | 型 | 説明 |
|---|---|---|
| `log_id` | TEXT | ログID（例: `LOG-20260312-130846`） |
| `datetime` | DATETIME | 実行日時（YYYY-MM-DD HH:MM:SS） |
| `system` | TEXT | Lists.system から選択 |
| `project` | TEXT | 対象プロジェクトID（Lists.project_id から選択） |
| `summary` | TEXT | 実行内容の要約 |
| `result` | TEXT | `run_result` から選択 |

### オプションカラム

| カラム | 型 | 説明 |
|---|---|---|
| `commit_hash` | TEXT | git commit hash |
| `tasks_done` | TEXT | 完了タスクID（カンマ区切り） |
| `stop_reason` | TEXT | STOP または ERROR 時の原因 |
| `next_action` | TEXT | 次に取るべきアクション |

### 更新ルール

- **更新者:** 人間（セッション終了後に手動記録）、Phase 2 では `de` の補助出力を利用
- **タイミング:** 各開発セッション終了時に必ず記録
- **ID採番:** `LOG-YYYYMMDD-HHMMSS` を基本とする
- **削除禁止:** 過去行は絶対に削除・上書きしない（追記専用）
- **Phase 2:** まずはローカル JSON / TSV 出力、将来は GAS 連携へ移行

---

## 7. Metrics

### 目的

プロジェクト全体の KPI・定量指標を定期的に記録し、トレンドを把握する。

### 必須カラム

| カラム | 型 | 説明 |
|---|---|---|
| `date` | DATE | 記録日 |
| `metric_name` | TEXT | 指標名 |
| `value` | NUMBER | 数値 |
| `unit` | TEXT | 単位 |

### オプションカラム

| カラム | 型 | 説明 |
|---|---|---|
| `project` | TEXT | 関連プロジェクト（Lists.project_id から選択、`COMMON` 可） |
| `target` | NUMBER | 目標値 |
| `notes` | TEXT | 備考 |

---

## シート間参照関係

```text
Lists（語彙の起点）
  A列 status      -> Projects.status
  B列 phase       -> Projects.phase
  C列 type        -> Projects.type
  D列 system      -> Run_Log.system
  E列 assigned_to -> Task_Queue.assigned_to
  F列 task_status -> Task_Queue.status
  G列 task_type   -> Task_Queue.type
  H列 priority    -> Task_Queue.priority
  I列 idea_status -> Ideas.status
  run_result / project_id は Lists 外で管理

Dashboard（集約の終点）
  <- Projects
  <- Task_Queue
  <- Run_Log
  <- Metrics
```

---

## スキーマ変更履歴

| 日付 | 変更内容 | 変更者 |
|---|---|---|
| 2026-03-06 | 初版作成（5シート定義） | Claude |
| 2026-03-06 | 7シート構成に更新 | Claude |
| 2026-03-08 | Lists の日本語語彙移行、全シート語彙移行を完了として記録 | Claude |
| 2026-03-12 | 実シートとのズレ確認後、Run_Log の正本を `system` ベース10列に整理。Lists.system に `Codex` を追加 | Codex |
| 2026-03-13 | `ai-invest` 追加に備えて `AINV-07` を canonical project_id に追加 | Codex |

---

最終更新: 2026-03-13
