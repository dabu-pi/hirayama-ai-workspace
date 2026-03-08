# dashboard-schema.md — ダッシュボードスプレッドシート スキーマ定義

Google スプレッドシート「Hirayama_AI_OS_Dashboard」の全シート定義。`workspace/ai-os/spec.md` のダッシュボード層に対応する。

> **注意:** スプレッドシートのID・URLはこのファイルに記載しない（セキュリティ上の理由）。

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
| 直近ログ | Run_Log | 最新 5〜10 件のセッション記録 |
| KPI スナップショット | Metrics | 最新値の抜粋（月次来院患者数・タスク完了数等） |
| プロジェクト数カウント | Projects | `稼働中` / `開発中` / `企画段階` の件数 |

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
| B | `phase`（フェーズ） | Projects | `構想` / `設計` / `実装` / `テスト` / `運用` / `安定運用` / `Phase1`〜`Phase4` / `PhaseB` / `Ops` |
| C | `type`（プロジェクト種別） | Projects | `本番` / `試行` / `ローカル専用` / `なし` |
| D | `system`（使用システム） | Run_Log | `Sheets` / `GitHub` / `GAS` / `Claude` / `ChatGPT` / `freee` / `Local`（英語維持・⚠️ 要ユーザー確認） |
| E | `assigned_to`（担当） | Task_Queue | `AI` / `人` / `AI+人` |
| F | `task_status`（タスクステータス） | Task_Queue | `未着手` / `進行中` / `待機` / `停止中` / `完了` |
| G | `task_type`（タスク種別） | Task_Queue | `実行` / `テスト` / `開発` / `文書` / `調査` / `設計` / `Ops` |
| H | `priority`（優先度） | Task_Queue | `高` / `中` / `低` |
| I | `idea_status`（アイデアステータス） | Ideas | `アイデア` / `調査中` / `計画済み` / `保留` / `プロジェクト化済み` |

> **補足グループ（Lists 外・変更禁止）:**
> - `run_result`: `SUCCESS` / `STOP` / `ERROR` / `PARTIAL`（GAS 参照のため英語固定）
> - `project_id`: `GAS-01` / `FREEE-02` / `WEB-03` / `STR-04` / `WST-05` / `AIOS-06`（識別子変更禁止）

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
| `project_id` | TEXT | プロジェクトID（Lists.project_id から選択）|
| `project_name` | TEXT | プロジェクト名（日本語可）|
| `directory` | TEXT | `workspace/` からの相対パス |
| `status` | TEXT | Lists.project_status から選択 |
| `phase` | TEXT | 現在のフェーズ（例: `Phase B - テスト`）|
| `priority` | NUMBER | 優先度（1が最高）|
| `last_updated` | DATE | 最終更新日（YYYY-MM-DD）|

### オプションカラム

| カラム | 型 | 説明 |
|---|---|---|
| `next_action` | TEXT | 次にやるべきこと（1行）|
| `blocker` | TEXT | 現在の阻害要因 |
| `notes` | TEXT | 備考・メモ |

### 初期データ（例）

| project_id | project_name | directory | status | phase | priority | last_updated | next_action |
|---|---|---|---|---|---|---|---|
| GAS-01 | 柔整GASシステム | gas-projects/jyu-gas-ver3.1 | 稼働中 | Phase B - テスト | 1 | 2026-03-06 | TC01〜TC10 スプレッドシートで実行確認 |
| FREEE-02 | freee見積自動化 | freee-automation | 開発中 | Phase 4 - 運用強化 | 2 | 2026-03-06 | Phase 4 タスク着手 |
| WEB-03 | 患者管理Webアプリ | patient-management | プロトタイプ | Phase A - 本番化準備 | 3 | 2026-03-06 | service_account.json のパスを.env化 |
| STR-04 | 接骨院戦略AI | hirayama-jyusei-strategy | 企画段階 | Phase A - データ入力 | 4 | 2026-03-06 | finance/ の実数値を入力 |
| WST-05 | 廃棄物日報GAS | waste-report-system | 企画段階 | 要件定義前 | 5 | 2026-03-06 | 収集業務フローのヒアリング |
| AIOS-06 | Hirayama AI OS | ai-os | 開発中 | Phase 1 - Setup | 0 | 2026-03-06 | 手動更新フローの試運転開始 |

### 更新ルール

- **更新者:** 人間のみ（GAS 書き込み禁止）
- **タイミング:** フェーズ完了時・ステータス変更時・週1回の定期確認時
- **行の追加:** 新プロジェクト開始時に末尾に追加。project_id は Lists に先に追加する
- **行の削除:** しない（停止プロジェクトは status を `停止` に変更）

---

## 4. Ideas

### 目的

新機能のアイデア・改善提案・将来やりたいことを収集・評価・分類する。思いついたら即座に登録し、後でまとめてレビューする。**アイデアは忘れないために必ずここに登録する。**

### 必須カラム

| カラム | 型 | 説明 |
|---|---|---|
| `idea_id` | TEXT | ID（例: `IDEA-001`）|
| `title` | TEXT | アイデアのタイトル（1行）|
| `project` | TEXT | 関連プロジェクト（Lists.project_id から選択、または `COMMON`）|
| `status` | TEXT | Lists.idea_status から選択 |
| `created_at` | DATE | 登録日（YYYY-MM-DD）|

### オプションカラム

| カラム | 型 | 説明 |
|---|---|---|
| `description` | TEXT | 詳細説明 |
| `effort` | TEXT | Lists.effort_level から選択 |
| `impact` | TEXT | Lists.impact_level から選択 |
| `source` | TEXT | アイデアの発生源（Lists.ai_tool から選択）|
| `notes` | TEXT | 評価コメント・採用/見送りの理由 |

### 例

| idea_id | title | project | status | created_at | effort | impact |
|---|---|---|---|---|---|---|
| IDEA-001 | 月次レポート自動生成（接骨院戦略AI） | STR-04 | 採用 | 2026-03-05 | 大 | 大 |
| IDEA-002 | freee エラー通知をSlack連携 | FREEE-02 | 新規 | 2026-03-06 | 中 | 中 |
| IDEA-003 | 患者Webアプリに来院履歴グラフを追加 | WEB-03 | 新規 | 2026-03-06 | 中 | 中 |

### 更新ルール

- **更新者:** 人間のみ
- **タイミング:** アイデア発生時に即時登録
- **ID採番:** `IDEA-` + 3桁連番（001〜）
- **行の削除:** しない（見送りは status を `見送り` に変更）

---

## 5. Task_Queue

### 目的

直近（1〜2週間）に実行するタスクを優先順位付きで管理する。`workspace/ROADMAP.md` の粒度が粗いタスクを、実行可能な単位に分解して登録する。

### 必須カラム

| カラム | 型 | 説明 |
|---|---|---|
| `task_id` | TEXT | タスクID（例: `TASK-001`）|
| `title` | TEXT | タスクタイトル（1行）|
| `project` | TEXT | 関連プロジェクトID（Lists.project_id から選択）|
| `status` | TEXT | Lists.task_status から選択 |
| `priority` | NUMBER | 優先度（1が最高）|
| `created_at` | DATE | 登録日（YYYY-MM-DD）|

### オプションカラム

| カラム | 型 | 説明 |
|---|---|---|
| `assigned_to` | TEXT | 担当（Lists.assigned_to から選択）|
| `due_date` | DATE | 期限（YYYY-MM-DD）|
| `completed_at` | DATE | 完了日（YYYY-MM-DD）|
| `notes` | TEXT | 備考・STOP理由 |
| `roadmap_ref` | TEXT | ROADMAP.mdでの対応タスク番号（例: `B-1`）|

### 例

| task_id | title | project | status | priority | assigned_to | roadmap_ref |
|---|---|---|---|---|---|---|
| TASK-001 | TC01〜TC10 スプレッドシートで実行確認 | GAS-01 | 待機 | 1 | 人間 | B-1 |
| TASK-002 | 手動更新フロー試運転（1〜2週間） | AIOS-06 | 実行中 | 2 | 人間 | - |
| TASK-003 | service_account.json のパスを.env化 | WEB-03 | 待機 | 3 | Claude | A-1 |

### 更新ルール

- **更新者:** 人間（タスク登録・優先度変更）、Claude（完了・STOP時の状態更新）
- **タイミング:** 開発セッション開始時に確認、終了時に status を更新
- **ID採番:** `TASK-` + 3桁連番（001〜）
- **完了タスクの扱い:** status を `完了` に変更 + completed_at を記録。削除しない

---

## 6. Run_Log

### 目的

開発セッション・スクリプト実行の記録を時系列で保存する。セッション終了後に記録し、次回の引き継ぎ情報として活用する。

### 必須カラム

| カラム | 型 | 説明 |
|---|---|---|
| `log_id` | TEXT | ログID（例: `LOG-0001`）|
| `datetime` | DATETIME | 実行日時（YYYY-MM-DD HH:MM）|
| `ai_tool` | TEXT | Lists.ai_tool から選択 |
| `project` | TEXT | 対象プロジェクトID（Lists.project_id から選択）|
| `summary` | TEXT | 実行内容の要約（1〜2行）|
| `result` | TEXT | Lists.run_result から選択 |

### オプションカラム

| カラム | 型 | 説明 |
|---|---|---|
| `commit_hash` | TEXT | git commit hash（あれば）|
| `tasks_done` | TEXT | 完了タスクID（カンマ区切り）|
| `stop_reason` | TEXT | STOPまたはERROR時の原因 |
| `next_action` | TEXT | 次に取るべきアクション |

### 例

| log_id | datetime | ai_tool | project | summary | result | commit_hash |
|---|---|---|---|---|---|---|
| LOG-0001 | 2026-03-06 14:00 | Claude | AIOS-06 | AI OS初期ドキュメント4ファイル記入完了 | SUCCESS | （コミットハッシュ）|
| LOG-0002 | 2026-03-06 15:00 | Claude | AIOS-06 | 7シート構成への整合化・Dashboard/Lists スキーマ追加 | SUCCESS | （コミットハッシュ）|

### 更新ルール

- **更新者:** 人間（セッション終了後に手動記録）
- **タイミング:** 各開発セッション終了時に必ず記録
- **ID採番:** `LOG-` + 4桁連番（0001〜）
- **削除禁止:** 過去行は絶対に削除・上書きしない（追記専用）
- **Phase 2以降:** GASスクリプトによる自動記録を予定

---

## 7. Metrics

### 目的

プロジェクト全体のKPI・定量指標を定期的に記録し、トレンドを把握する。接骨院経営の実績数値もここで追跡する。

### 必須カラム

| カラム | 型 | 説明 |
|---|---|---|
| `date` | DATE | 記録日（YYYY-MM-DD、週初または月初）|
| `metric_name` | TEXT | 指標名 |
| `value` | NUMBER | 数値 |
| `unit` | TEXT | 単位（`件` / `円` / `%` / `人` 等）|

### オプションカラム

| カラム | 型 | 説明 |
|---|---|---|
| `project` | TEXT | 関連プロジェクト（Lists.project_id から選択、`COMMON` = 全体）|
| `target` | NUMBER | 目標値 |
| `notes` | TEXT | 備考 |

### 追跡指標（初期定義）

| metric_name | 単位 | 更新頻度 | 対象 |
|---|---|---|---|
| 柔整GAS: テスト通過数 | 件 | フェーズ完了時 | GAS-01 |
| freee: 自動作成見積件数 | 件 | 週次 | FREEE-02 |
| 患者管理: 登録患者数 | 人 | 月次 | WEB-03 |
| 月次来院患者数 | 人 | 月次 | COMMON |
| 月次保険請求額 | 円 | 月次 | COMMON |
| AI開発セッション数 | 回 | 週次 | COMMON |
| タスク完了数 | 件 | 週次 | COMMON |

### 例

| date | metric_name | value | unit | project | notes |
|---|---|---|---|---|---|
| 2026-03-01 | 月次来院患者数 | 120 | 人 | COMMON | 3月実績（暫定）|
| 2026-03-01 | freee: 自動作成見積件数 | 3 | 件 | FREEE-02 | Phase 3完成後初週 |
| 2026-03-06 | AI開発セッション数 | 8 | 回 | COMMON | 3月1〜6日計 |

### 更新ルール

- **更新者:** 人間のみ
- **タイミング:** 週次（毎週月曜）または月次（月初）
- **形式:** 同じ指標でも日付が異なる場合は新しい行として追記
- **削除禁止:** 過去データは削除しない（履歴として保存）

---

## シート間参照関係

```
Lists（語彙の起点）
  ├── A列: status      → Projects.status のドロップダウン
  ├── B列: phase       → Projects.phase のドロップダウン
  ├── C列: type        → Projects.type のドロップダウン
  ├── D列: system      → Run_Log.system のドロップダウン（⚠️ 要確認）
  ├── E列: assigned_to → Task_Queue.assigned_to のドロップダウン
  ├── F列: task_status → Task_Queue.status のドロップダウン
  ├── G列: task_type   → Task_Queue.type のドロップダウン
  ├── H列: priority    → Task_Queue.priority のドロップダウン
  └── I列: idea_status → Ideas.status のドロップダウン
  ※ run_result（SUCCESS/STOP/ERROR/PARTIAL）・project_id は Lists 外で管理

Dashboard（集約の終点・読み取り専用）
  ├── ← Projects（参照）
  ├── ← Task_Queue（参照）
  ├── ← Run_Log（参照）
  └── ← Metrics（参照）
```

---

## スキーマ変更履歴

| 日付 | 変更内容 | 変更者 |
|---|---|---|
| 2026-03-06 | 初版作成（5シート定義） | Claude |
| 2026-03-06 | 7シート構成に更新（Dashboard・Lists の2セクション追加、シート間参照関係を明示） | Claude |
| 2026-03-08 | Lists 語彙グループ定義を実シート構成（A〜I列カラム型）に整合化。語彙を日本語優先表記に移行（詳細は VOCAB_MASTER.md を参照）。シート間参照関係図も列名ベースに更新 | Claude |
| 2026-03-08 | **語彙移行完了。** Projects・Ideas・Task_Queue の全ドロップダウン値を日本語に移行。Metrics シートの COUNTIF 数式（B3〜B10）および補助テーブル（D3:D7 Status ラベル・E3:E7 Status カウント数式・G3:G7 Idea Status ラベル・H3:H7 Idea Status カウント数式）を英語 → 日本語に更新。Dashboard サマリー数値が正常表示（Production Systems: 2・In Progress: 2 等）されることを確認済み | Claude |

---

最終更新: 2026-03-08（全シート語彙移行完了・Metrics COUNTIF 数式日本語化）
