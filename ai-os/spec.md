# Hirayama AI OS — システム仕様書

---

## 1. Purpose（目的）

平山克司ワークスペースにおけるAI開発・業務自動化プロジェクトを**横断的に管理・可視化・改善する制御構造**を提供する。

個々のプロジェクト（柔整GAS・freee自動化・患者管理等）の実装はそれぞれのディレクトリで管理する。Hirayama AI OS は「**どのプロジェクトが何の状態にあり、次に何をすべきか**」を常に把握・記録・提示する役割を担う。

---

## 2. Scope（スコープ）

### 対象（In Scope）

| カテゴリ | 内容 |
|---|---|
| プロジェクト管理 | 全5プロジェクトの状態・優先度・フェーズの追跡 |
| タスクキュー | 次のアクションの登録・優先順位付け・完了管理 |
| アイデア管理 | 新機能・改善案の収集・評価・分類 |
| ログ管理 | 日次ノート・実行結果・エラーの構造化記録 |
| ダッシュボード | Google スプレッドシートによる可視化 |
| AI セッション管理 | Claude / ChatGPT へのプロンプト・指示書・引き継ぎ情報の管理 |

### 対象外（Out of Scope）

- 個別プロジェクトのソースコード実装
- freee API・GASの直接呼び出し
- 外部サービスへの自動送信・自動実行

---

## 3. Architecture（アーキテクチャ）

```
[人間]
  │
  ├──→ [Google スプレッドシート ダッシュボード]
  │         ├── Dashboard（集約ビュー・数式参照型）
  │         ├── Lists（語彙制御・マスタ値）
  │         ├── Projects（プロジェクト一覧）
  │         ├── Ideas（アイデア収集）
  │         ├── Task_Queue（タスクキュー）
  │         ├── Run_Log（実行ログ）
  │         └── Metrics（KPI・指標）
  │
  ├──→ [workspace/ai-os/ ドキュメント群]
  │         ├── spec.md（この仕様書）
  │         ├── dashboard-schema.md（スキーマ定義）
  │         └── PROJECT_STATUS.md（現在地）
  │
  └──→ [Claude Code セッション]
            ├── CLAUDE.md（AIルール）
            ├── ROADMAP.md（タスク計画）
            └── docs/PROJECT_STATUS.md（引き継ぎ）
```

**現フェーズでは人間が手動でダッシュボードを更新する。** 将来フェーズでGASスクリプトによる自動更新を導入する。

---

## 4. Components（コンポーネント）

### 4.1 ドキュメント層（ai-os/）

| ファイル | 役割 |
|---|---|
| `README.md` | 概要・ナビゲーション |
| `spec.md` | システム仕様（このファイル） |
| `PROJECT_STATUS.md` | AI OS自体の現在地・引き継ぎ情報 |
| `dashboard-schema.md` | ダッシュボードスキーマ定義 |

### 4.2 ダッシュボード層（Google スプレッドシート）

| シート | 役割 | 更新者 |
|---|---|---|
| `Dashboard` | 全シートを集約した視覚的コントロールパネル（数式参照型・読み取り専用） | 数式のみ |
| `Lists` | ドロップダウン用マスタ値・語彙の統制（全語彙の単一ソース） | 人間のみ |
| `Projects` | 全プロジェクトのステータス一覧 | 人間のみ |
| `Ideas` | アイデア・改善提案の収集 | 人間のみ |
| `Task_Queue` | 直近のタスクキュー | 人間 + Claude |
| `Run_Log` | 実行ログ・セッション記録 | 人間（将来GAS）|
| `Metrics` | KPI・定量指標の追跡 | 人間のみ |

詳細なスキーマは `dashboard-schema.md` を参照。

### 4.3 ログ層（workspace/logs/）

| パス | 内容 |
|---|---|
| `logs/notes/note_YYYYMMDD.md` | 日次作業ノート |
| `logs/artifacts/` | スクリプト実行の成果物（gitignore） |
| `docs/PROJECT_STATUS.md` | AI開発セッション引き継ぎ用ステータス |

### 4.4 AI 管理層

| ツール | 管理対象 | 管理場所 |
|---|---|---|
| Claude Code | セッションログ・タスク・プロンプト | `workspace/docs/PROMPTS/` |
| ChatGPT | 指示書・ペルソナ・テンプレート | Phase2で `ai-os/chatgpt/` を追加予定 |
| GitHub | リポジトリ・ブランチ・マイルストーン | `workspace/ROADMAP.md` |

---

## 5. Data Flow（データフロー）

```
[作業発生]
    │
    ▼
[workspace/logs/ に日次ノート記録]
    │
    ▼
[ダッシュボード Run_Log シートに要約記録]
    │
    ├──→ タスク完了 → Task_Queue を更新 → Projects ステータスを更新
    │
    ├──→ アイデア発生 → Ideas シートに登録
    │
    └──→ KPI更新 → Metrics シートに記録
```

---

## 6. Dashboard Integration（ダッシュボード統合）

### 更新タイミング

| イベント | 更新するシート |
|---|---|
| 開発セッション終了時 | Run_Log, Task_Queue |
| プロジェクトフェーズ完了時 | Projects |
| アイデア・改善案の発生時 | Ideas |
| 月初（または週初） | Metrics |

### 更新方法（現在）

**データシート（Projects / Ideas / Task_Queue / Run_Log / Metrics）:** 手動更新（人間がスプレッドシートを直接編集）。

**Dashboard シート:** 数式参照型。データシートの変更に連動して自動反映。直接入力は行わない。

**Lists シート:** 人間のみが更新。語彙・マスタ値の変更時のみ編集する。

### 更新方法（将来 Phase2）

GASスクリプトが `workspace/logs/` を読み取り、Run_Log を自動更新。

---

## 7. Log System（ログシステム）

### ファイルログ

| ファイル | 形式 | 更新者 |
|---|---|---|
| `logs/notes/note_YYYYMMDD.md` | Markdown | 人間 / Claude |
| `docs/PROJECT_STATUS.md` | Markdown テーブル | Claude |

### ダッシュボードログ

`Run_Log` シートに以下を記録する：

| 項目 | 内容 |
|---|---|
| 日時 | セッション開始日時 |
| AI | Claude / ChatGPT / 人間 |
| プロジェクト | 対象プロジェクト名 |
| 内容 | 実行内容の要約（1〜2行） |
| 結果 | SUCCESS / STOP / ERROR |
| コミット | git commit hash（あれば） |

---

## 8. Safety Rules（安全規則）

Hirayama AI OS 固有の安全規則。`workspace/CLAUDE.md` の全体規則に加えて適用する。

| 規則 | 内容 |
|---|---|
| 自動実行禁止 | AI OS のスクリプトは自動トリガーを設定しない（手動実行のみ） |
| GAS書き込み境界 | GASの書き込みは `Run_Log` と `Metrics` のみ許可。他シートへの書き込みは禁止 |
| Dashboard シート保護 | GAS・人間ともにデータ直接入力を禁止。数式・参照セルのみで構成する。将来の限定的な手入力セルは `[INPUT]` プレフィックスで明示する |
| Lists シート保護 | 人間のみが更新可。GAS書き込み禁止。変更時は `dashboard-schema.md` のスキーマ変更履歴にも記録する |
| ログの上書き禁止 | 過去の `Run_Log` 行は削除・上書きしない（追記のみ） |
| スキーマ変更の文書化 | `dashboard-schema.md` を変更する場合は変更理由・日付をコメントで残す |
| 認証情報の非格納 | スプレッドシートID・GAS スクリプトIDは `dashboard-schema.md` に記載しない |

---

## 9. Future Phases（将来フェーズ）

### Phase 1（現在）— ドキュメント基盤の確立

- [x] README.md・spec.md・PROJECT_STATUS.md・dashboard-schema.md の整備
- [x] ダッシュボードスプレッドシートの初期作成（7シート構成で完了）
- [x] Dashboard / Lists シートのスキーマを dashboard-schema.md に追加
- [ ] 手動更新フローの確立・試運転（次タスク）

### Phase 2 — GAS自動連携

- [ ] `workspace/logs/` から Run_Log を自動更新するGASスクリプト
- [ ] タスク完了時に Task_Queue を自動更新するトリガー
- [ ] ChatGPT 管理ディレクトリ（`ai-os/chatgpt/`）の作成

### Phase 3 — Claude API 統合

- [ ] 週次サマリレポートを Claude API で自動生成
- [ ] KPI異常検知（Metrics シートの閾値超え時にアラート）
- [ ] `AI_PROJECT_REGISTRY.md` による全AIプロジェクトの統合登録

---

## 2026-03-14 Live operation sync

- The live spreadsheet currently operates as:
  - `Dashboard`: read-only reference view
  - `Projects`: source ledger for project metadata and link targets
  - `Task_Queue`: active task queue keyed by `project_id`
  - `Metrics`: formula-only KPI sheet
  - `Run_Log`: append-only execution history
  - `Lists`: source vocabulary sheet
- Older wording in this file that says all data sheets are manual-only should
  now be read as "human or curated maintenance script". Current curated script
  operations exist for `Projects`, `Task_Queue`, and `Run_Log`.
- Current dashboard link policy:
  - `開く` uses `Projects.メインシートURL`
  - `SPEC` uses `Projects.SPEC URL`
  - missing URL fallback is `未設定`
- Current canonical Japanese operating vocabulary:
  - project status:
    `本番運用中 / 進行中 / 保留 / 構想 / アーカイブ`
  - project phase:
    `構想 / 設計 / SPEC作成 / 実装 / 試作 / テスト / 運用`
  - task status:
    `未着手 / 進行中 / 待機 / 保留 / 完了`
- Current KPI counting rules verified on live:
  - production = `Projects.状態 = 本番運用中`
  - active = `Projects.状態 = 進行中`
  - open tasks = `Task_Queue.状態 <> 完了`
  - parked ideas = `Ideas.段階 = 保留`
- `Run_Log` intentionally keeps the English append schema:
  `log_id / datetime / system / project / summary / result / commit_hash /
  tasks_done / stop_reason / next_action`.

最終更新: 2026-03-14（live 運用同期・Projects 正本台帳・Dashboard 導線・日本語語彙を反映）
