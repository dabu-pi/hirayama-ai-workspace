# PROJECT_STATUS.md — Hirayama AI OS 進捗トラッキング

> AIセッション引き継ぎ用。このファイルの内容を再開プロンプトの冒頭に貼る。

---

## プロジェクトサマリ

| 項目 | 内容 |
|---|---|
| プロジェクト名 | Hirayama AI OS |
| ディレクトリ | `workspace/ai-os/` |
| 目的 | Claude・ChatGPT・GAS・GitHub・ダッシュボードを横断管理するコマンドセンター |
| 開始日 | 2026-03-06 |
| 最終更新 | 2026-03-08（Phase 1 構造タスク全完了・Run_Log 習慣化フェーズへ） |

---

## 現在のステータス

| 項目 | 状態 |
|---|---|
| 分類 | In Progress |
| フェーズ | Phase 1 — 手動運用基盤確立（構造タスク全完了・Run_Log 習慣化フェーズ） |
| 実装 | 7シート整備済み・構造タスク全完了（ドロップダウン検証・KPIヘッダー含む）・Run_Log 記録習慣化中 |
| コード | 未着手 |
| ランタイム | 未起動 |

---

## スコープ

### 対象

- `workspace/ai-os/` ディレクトリ内のドキュメント整備
- Google スプレッドシートダッシュボードのスキーマ定義
- 他プロジェクト（GAS・freee・患者管理等）のソースコードは変更しない

### 制約

- `ai-os/` 外のファイルは変更しない
- コードより先にドキュメントを整備する（ドキュメントファースト）
- シンプルに保つ — 管理システムが管理対象より複雑にならないようにする

---

## 完了済み

| 日時 | 内容 |
|---|---|
| 2026-03-06 | `ai-os/` ディレクトリ作成・4ファイルのスキャフォールド作成 |
| 2026-03-06 | `README.md` 記入（概要・役割・フォルダ構造・関係性） |
| 2026-03-06 | `spec.md` 記入（目的・スコープ・アーキテクチャ・安全規則・将来フェーズ） |
| 2026-03-06 | `PROJECT_STATUS.md` 記入（このファイル） |
| 2026-03-06 | `dashboard-schema.md` 記入（全5シートのスキーマ定義） |
| 2026-03-06 | スプレッドシート「Hirayama_AI_OS_Dashboard」作成（7シート構成・Excelプロトタイプから移行）|
| 2026-03-06 | ギャップ分析実施（ドキュメント vs 実スプレッドシートの整合確認）|
| 2026-03-06 | 全4ドキュメントを7シート構成に整合化（Dashboard・Lists のスキーマ追加）|
| 2026-03-08 | スプレッドシート全7シート監査実施（Projects 5件・Task_Queue 10件・Ideas 7件・Run_Log 4件 確認）|
| 2026-03-08 | DASHBOARD_MASTER_PLAN.md 新規作成（全体設計・役割分担・完成条件）|
| 2026-03-08 | DASHBOARD_ROADMAP.md 新規作成（Phase 1〜4 ロードマップ・STOP条件）|
| 2026-03-08 | DASHBOARD_RESTART_CUE.md 新規作成（再開キュー・次の5手・指示テンプレ）|
| 2026-03-08 | 【人間作業】Metrics「200%」誤り修正済み |
| 2026-03-08 | 【人間作業】Lists シート Row 1 に列ヘッダー追加済み |
| 2026-03-08 | 【人間作業】Projects シートに AIOS-06 追加済み（6件体制確立）|
| 2026-03-08 | 【人間作業】Dashboard の参照方式を確認（詳細は未確認として残す）|
| 2026-03-08 | 【人間作業】Run_Log に本日の記録を追加・手動更新フロー開始 |
| 2026-03-08 | 【人間作業】Projects シート：Type / Status / Phase のドロップダウン検証設定済み |
| 2026-03-08 | 【人間作業】Task_Queue シート：Project / Type / Priority / Status / Assigned To のドロップダウン検証設定済み |
| 2026-03-08 | 【人間作業】Lists シートのヘッダー行を実データに整合（A=status / B=phase / C=type / D=system / E=assigned_to / F=task_status / G=task_type / H=priority / I=idea_status） |
| 2026-03-08 | 【人間作業】Metrics シートに業績KPI 行ヘッダー追加（A13:Business KPI〜A19:Profit）。数値入力は 4月以降 |
| 2026-03-08 | 【人間作業】Run_Log に Phase 1 手修正内容を記録（AIOS-06 / Phase 1 manual fixes / OK） |

---

## 進行中

| タスク | 内容 |
|---|---|
| Run_Log 手動記録フローの習慣化 | 毎セッション終了後 1行追記を継続する（2026-03-08 開始・2026-03-22 まで継続目標）|

---

## バックログ

| 優先度 | タスク | 内容 |
|---|---|---|
| 高 | ~~Lists シートへの語彙値入力~~ | ✅ 完了（2026-03-08 列ヘッダー追加済み）|
| 高 | ~~初期データ投入~~ | ✅ 完了（AIOS-06 を含む6件登録済み）|
| 高 | 手動更新フローの試運転 | Run_Log 継続記録（2026-03-08 開始。2週間の継続が目標）|
| 高 | ~~ドロップダウン検証設定~~ | ✅ 完了（2026-03-08）Projects・Task_Queue ともに設定済み |
| 中 | ~~Dashboard シートへの数式設定~~ | ✅ 参照方式確認済み（QUERY/FILTER 完全自動参照かどうかの詳細は未確認として残す）|
| 中 | ~~Metrics 業績KPI 行ヘッダー追加~~ | ✅ 完了（2026-03-08）A13:Business KPI〜A19:Profit まで追加済み。数値入力は 4月以降 |
| 低 | GAS自動連携（Phase 2） | Run_Log 自動追記 GAS スクリプトの設計（Phase 1 完了宣言後）|
| 低 | ChatGPT 管理ディレクトリ作成 | `ai-os/chatgpt/` に指示書・テンプレートを整備（Phase 2 以降）|
| 低 | AI_PROJECT_REGISTRY.md（Phase 2） | 必要になったら作成 |

---

## 運用フロー

```
[作業開始]
    │
    ▼
ダッシュボード Task_Queue を確認 → 今日のタスクを決定
    │
    ▼
Claude Code でタスク実行
    │
    ├── 完了 → Task_Queue 更新 + Run_Log 記録 + git commit
    │
    └── STOP → PROJECT_STATUS.md に理由を記録 → セッション終了
    │
    ▼
[作業終了]
ダッシュボード更新（Run_Log・Task_Queue・必要に応じ Projects）
```

---

## 安全規則（ai-os 固有）

| 規則 | 内容 |
|---|---|
| 他プロジェクト不変 | `ai-os/` 外のソースコードを変更しない |
| 自動実行なし | Phase 1 ではすべて手動実行 |
| ログ追記のみ | Run_Log の過去行は削除・上書きしない |
| スキーマ変更は文書化 | `dashboard-schema.md` 変更時は理由と日付を残す |

---

## ファイルマップ

```
workspace/ai-os/
├── README.md                    概要・ナビゲーション・関係性
├── spec.md                      システム仕様（アーキテクチャ・コンポーネント・安全規則）
├── PROJECT_STATUS.md            このファイル（AI引き継ぎ・進捗トラッキング）
├── dashboard-schema.md          ダッシュボードスプレッドシートのスキーマ定義
├── DASHBOARD_MASTER_PLAN.md     全体設計・役割分担・完成条件（2026-03-08 追加）
├── DASHBOARD_ROADMAP.md         フェーズロードマップ・今週やること・STOP条件（2026-03-08 追加）
└── DASHBOARD_RESTART_CUE.md     再開キュー・次の5手・指示テンプレ（2026-03-08 追加）
```

---

## 次のアクション

> 詳細は `DASHBOARD_RESTART_CUE.md` の「次にやるべき5手」を参照。

1. **Run_Log を 2026-03-22 まで毎セッション継続**（毎セッション1行追記。手動運用フロー習慣化）
2. **2026-03-22 頃 Phase 1 完了宣言** → DASHBOARD_ROADMAP.md / PROJECT_STATUS.md を更新（Claude 担当）
3. **Phase 2 入口: GAS スクリプト設計草案を作成**（Run_Log 自動追記仕様・Phase 1 完了宣言後）
4. Dashboard シートの数式参照（QUERY/FILTER）動作確認 — 余裕があれば（任意）

---

## 再開キュー（Restart Cue）

> 詳細な再開キューは `DASHBOARD_RESTART_CUE.md` を参照（2026-03-08 版が最新）。

```
現在地: Hirayama AI OS / Phase 1 終盤・Run_Log 習慣化フェーズ（完成度 約85%）
ステータス: 構造タスク全完了（ドロップダウン検証・KPIヘッダー含む）・手動運用フロー稼働中。
設計書: ai-os/ 配下の7ファイル整備済み。
次のタスク: Run_Log 2週間継続（〜2026-03-22）→ Phase 1 完了宣言 → GAS 設計草案。
未確認: Dashboard QUERY/FILTER 完全自動参照かどうか（任意）。
```

---

## STOP 理由

なし（Phase 1 ドキュメント整備は正常完了）

---

## 参照

- `workspace/CLAUDE.md` — AIアシスタント向けルール（全体）
- `workspace/ROADMAP.md` — 全プロジェクト開発計画
- `workspace/PROJECTS.md` — プロジェクト設計図
- `workspace/docs/PROJECT_STATUS.md` — AI開発インフラの進捗
- `ai-os/spec.md` — AI OS システム仕様
- `ai-os/dashboard-schema.md` — ダッシュボードスキーマ
