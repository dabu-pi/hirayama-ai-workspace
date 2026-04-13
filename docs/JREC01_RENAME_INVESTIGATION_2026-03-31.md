# JREC-01 名称変更 影響調査レポート

作成日: 2026-03-31
ステータス: **方針確定（2026-03-31）**
実施者: Claude Code（調査のみ。変更・commit・push はなし）

---

## 院長確定方針（2026-03-31）

| 変更案 | 方針 | 理由 |
|---|---|---|
| ① フォルダ名 `gas-projects` → `JREC-01` | **断念・現状維持** | 調査結果の断念推奨を採用 |
| ② スプレッドシート名変更 | **当面見送り・現状維持** | プレオープン優先。必要性が生じたときに再検討 |

> この方針は `gas-projects/jyu-gas-ver3.1/PROJECT_STATUS.md` にも記録済み。

---

## 調査対象

| 変更案 | 現状 | 変更案 |
|---|---|---|
| ① ローカルフォルダ名 | `workspace/gas-projects/` | `workspace/JREC-01/` |
| ② スプレッドシート名 | `【毎日記録】来店管理施術録ver3.1` | `JREC-01来店管理記録` |

---

## 事前確認：最重要事実

### ❌ `gas-projects/` は JREC-01 専用フォルダではない

```
workspace/gas-projects/
├── jyu-gas-ver3.1/   ← JREC-01 本体（来店管理施術録 clasp プロジェクト）
└── jrec-portal/      ← 運用ポータル用 GAS プロジェクト（別 SS・別 clasp）
```

**`gas-projects/` を `JREC-01/` にリネームすると、`jrec-portal/` も一緒に移動する。**
`jrec-portal/` は JREC-01 本体と別のスプレッドシートに紐付いた独立した GAS プロジェクトであり、
`JREC-01/jrec-portal/` という配置は意味的に不整合になる。

---

## A. フォルダ名変更の技術的可否

### GASコード・clasp — Low リスク

- `.clasp.json` は `scriptId` のみで管理。ローカルフォルダ名を見ていない
- GAS コード（`.js`）はファイル内で完結。ローカルパスを持たない
- `clasp push` はカレントディレクトリから実行するため、`cd` 先が変わるだけ

### scripts/ 配下 — **High リスク（要修正 7 箇所）**

| ファイル | 参照方法 | 内容 |
|---|---|---|
| `scripts/export-run-log-entry.ps1` (L33) | 正規表現パターン | `\\gas-projects\\jyu-gas-ver3\.1` → JREC-01 判定に使用 |
| `scripts/aios-dashboard-v2.mjs` (L170,178,180) | 文字列 | `directory`, `spec_path`, `aliases` |
| `scripts/update-live-projects-sheet-metadata.mjs` (L51-52) | 文字列 | `directory`, `local_folder` → Live Sheets に書き込む値 |
| `scripts/migrate-projects-schema.mjs` (L29,38,48) | 文字列 | スキーマ移行スクリプト |
| `scripts/preview-projects-migration.mjs` (L13,23) | 文字列 | プレビュー用スクリプト |
| `scripts/suggest-next-task.mjs` (L32) | エイリアス配列 | `gas-projects/jyu-gas-ver3.1` がエイリアスとして登録 |
| `scripts/sync-workspace-to-drive.ps1` (L203,216) | 文字列 | Drive 同期 INDEX.md のリンク生成 |

### `.claude/settings.local.json` — Medium リスク

bash の許可コマンドリストに絶対パス込みのコマンドが 3 箇所ハードコード:
```
Bash(grep -n "..." C:/hirayama-ai-workspace/workspace/gas-projects/jyu-gas-ver3.1/*.js)
Bash(ls /c/hirayama-ai-workspace/workspace/gas-projects/jyu-gas-ver3.1/*.md)
Bash(grep -n "..." /c/hirayama-ai-workspace/workspace/gas-projects/jyu-gas-ver3.1/*.js)
```
→ パス変更後は Claude Code がこれらのコマンドを実行しようとしてもパスが見つからずエラーになる

### ドキュメント — Medium リスク（25 ファイル以上）

`gas-projects` を参照している Markdown ファイル（主要なもの）:

| カテゴリ | ファイル |
|---|---|
| 設計・仕様 | `CLAUDE.md` / `PROJECTS.md` / `ROADMAP.md` / `README.md` |
| 命名ルール系 | `docs/PROJECT_NAMING_RULE.md` / `PROJECT_NAMING_RULE_DRAFT.md` / `PROJECT_NAMING_MIGRATION_RUNBOOK.md` / `PROJECT_NAMING_MIGRATION_COMMAND_MEMO.md` |
| JREC-01 内部 | `PROJECT_STATUS.md` / `SETUP.md` / `COLUMN_MIGRATION_C_MENUID.md` / `docs/JREC-01_別PC再開手順.md` / `docs/JREC-01_月次運用フロー.md` / `docs/JREC-01_CloudRun_デプロイ手順.md` / `docs/JREC-01_申請書生成B案_MVP実装設計.md` / `docs/JREC-01_運用ポータル_シート設計.md` |
| 周辺プロジェクト | `hirayama-jyusei-strategy/README.md` / `IMPLEMENTATION_LINK.md` / `JBIZ04_JREC01_INTEGRATION_REVIEW.md` |
| AI-OS | `ai-os/README.md` / `ai-os/PHASE2_MIN_AUTOMATION_SPEC.md` |
| その他 | `docs/WORKSPACE_CLEANUP_2026-03-25.md` / `docs/AI_DEV_ENV.md` / `archive/README.md` / `.claude/skills/project-resume/SKILL.md` |

特に `SETUP.md` と `JREC-01_別PC再開手順.md` には `cd` コマンドとして絶対パスが書かれており、
別PC再開時の実際の作業手順に直結する。

### Dashboard / Live Sheets — Medium リスク

- `scripts/update-live-projects-sheet-metadata.mjs` が Projects シートへ `local_folder: 'workspace/gas-projects/jyu-gas-ver3.1'` を書き込み済み
- `scripts/aios-dashboard-v2.mjs` の `directory` フィールドに参照あり
- `PROJECT_NAMING_MIGRATION_RUNBOOK.md` に「`local_folder` は `workspace/gas-projects/jyu-gas-ver3.1` を維持する」と明記された歴史的経緯あり（2026-03-13 に命名移行を既に実施済みで、この時点でフォルダ名変更は意図的にスキップされた）

### 手動運用 — Medium リスク

- `SETUP.md`・`別PC再開手順.md`・`月次運用フロー.md` に `cd C:\hirayama-ai-workspace\workspace\gas-projects\jyu-gas-ver3.1` が複数記述
- 別PC再開手順を使う運用者（院長）が混乱する

---

## B. フォルダ名変更の影響範囲まとめ

| 分類 | 影響件数 | 影響度 |
|---|---|---|
| コード（GAS本体） | 0 | **Low** |
| clasp 設定 | 0 | **Low** |
| scripts/ (PS1/mjs) | 7 ファイル・10 箇所以上 | **High** |
| settings.local.json | 3 箇所 | **Medium** |
| Markdown ドキュメント | 25 ファイル以上 | **Medium** |
| Dashboard / Live Sheets | 2 フィールド | **Medium** |
| 手動運用（別PC手順） | 3 ファイル・5 箇所以上 | **Medium** |
| **設計的整合性** | `jrec-portal/` が混在 | **High（断念理由筆頭）** |

---

## C. スプレッドシート名変更の技術的可否

### GASコード — **Low リスク（技術的に安全）**

GAS コード全体を調査した結果、`SpreadsheetApp.openByName()` / `getSpreadsheetByName()` の使用は**ゼロ**。
`getActiveSpreadsheet()` ベースで動作しており、スプレッドシート名に依存しない。
**→ コードは名前変更しても壊れない。**

### clasp — **Low リスク**

`.clasp.json` は `scriptId` のみ。スプレッドシート名に依存しない。

### ドキュメント — Medium リスク（15 ファイル以上）

`来店管理施術録` を参照しているファイル:

| カテゴリ | ファイル・箇所 |
|---|---|
| 設計正本 | `PROJECTS.md` (1) / `docs/PROJECT_NAMING_RULE.md` (1) / `docs/PROJECT_NAMING_RULE_DRAFT.md` (1) |
| Dashboard スクリプト | `scripts/aios-dashboard-v2.mjs` `main_sheet_name` (1) / `scripts/update-live-projects-sheet-metadata.mjs` `main_sheet_name` (1) |
| AI-OS文書 | `ai-os/DASHBOARD_MASTER_PLAN.md` (1) / `ai-os/PROJECT_STATUS.md` (1) |
| 戦略文書 | `hirayama-jyusei-strategy/IMPLEMENTATION_LINK.md` (3) / `hirayama-jyusei-strategy/README.md` (1) |
| 命名履歴 | `docs/PROJECT_NAMING_MIGRATION_RUNBOOK.md`（`main_sheet_name は維持する` と明記）|
| JREC-01 内部 | `PROJECT_STATUS.md` (2) / `docs/JREC-01_運用ポータル_シート設計.md` (3) |
| GAS コメント | `gas-projects/jrec-portal/Code.gs` (コメント 1 箇所) |
| **現場手順書** | `docs/JREC-01_プレオープン運用手順書.md` (2) / `docs/JREC-01_施術者向け手順書.md` (2) / `docs/JREC-01_受付者向け手順書.md` (2) |

### 現場手順書 — **High リスク（プレオープン直前）**

施術者・受付者向け手順書に以下のような表現が多数:
- 「スプレッドシート **来店管理施術録ver3.1** を開く」
- 「スプレッドシート **来店管理施術録ver3.1** の患者画面シートを開く」

プレオープン運用直前に名前変更すると：
- 現場スタッフが新しい名前を知らずに旧名で検索して見つからないリスク
- 手順書の印刷物があれば、印刷し直しが必要になる

### Dashboard / Live Sheets — Medium リスク

- `main_sheet_name` フィールドが Projects シートに Live 書き込み済み
- 変更後は `update-live-projects-sheet-metadata.mjs` の再実行が必要

---

## D. スプレッドシート名変更の影響範囲まとめ

| 分類 | 影響件数 | 影響度 |
|---|---|---|
| GASコード | **0** | **Low** |
| clasp | **0** | **Low** |
| Markdown ドキュメント | 15 ファイル以上 | Medium |
| scripts（main_sheet_name） | 2 ファイル | Medium |
| Dashboard / Live Sheets | 1 フィールド | Medium |
| **現場手順書（プレオープン直前）** | 3 ファイル・6 箇所 | **High** |

---

## E. 変更可否 判定

### ① フォルダ名 `gas-projects` → `JREC-01`

**判定: 断念推奨**

断念理由（優先順）:
1. `gas-projects/` に `jrec-portal/` が同居しており、`JREC-01` にリネームすると意味的に不整合になる
2. 2026-03-13 の命名移行（`GAS-01 → JREC-01`）の際、意図的にフォルダ名変更をスキップし「維持する」と記録済み
3. scripts/ に 7 ファイル以上のハードコード参照があり、修正範囲が広い
4. `.claude/settings.local.json` の許可コマンドが壊れる（Claude Code 動作への影響）
5. 25 ファイル以上のドキュメント修正が必要
6. Dashboard Live Sheets の `directory` / `local_folder` を更新する必要がある

**代替案:**
- フォルダ名は `gas-projects/jyu-gas-ver3.1/` のまま維持
- CLAUDE.md・README・PROJECTS.md 上の**表示名**を `JREC-01（gas-projects/jyu-gas-ver3.1）` のように明記する
- Dashboard の `project_id` = `JREC-01` は既に正しく設定済み（名前変更不要）

### ② スプレッドシート名 `【毎日記録】来店管理施術録ver3.1` → `JREC-01来店管理記録`

**判定: 条件付きで可能（プレオープン後に実施推奨）**

技術的にはコードへの影響なし（ID ベース運用で安全）。
ただし現場手順書に「来店管理施術録ver3.1 を開く」という操作案内が多数あり、
**プレオープン直前のこのタイミングでの変更はリスクが高い。**

推奨タイミング: プレオープン後、運用が安定してから（目安: 2〜4 週間後）

実施条件（条件が揃えばやってよい）:
- プレオープン初期運用が安定していること
- 施術者・受付者への周知（「スプレッドシート名が変わります」）を事前に行うこと
- 手順書を改訂して再配布できること

---

## F. 安全に実施するなら: スプレッドシート名変更の手順

（プレオープン後に実施する場合の最小リスク手順）

| ステップ | 作業 | 担当 |
|---|---|---|
| 1 | Google Sheets でスプレッドシート名を `JREC-01来店管理記録` に変更 | 院長 |
| 2 | 施術者・受付者に変更を口頭周知 | 院長 |
| 3 | `scripts/aios-dashboard-v2.mjs` の `main_sheet_name` を更新 | Claude Code |
| 4 | `scripts/update-live-projects-sheet-metadata.mjs` の `main_sheet_name` を更新 | Claude Code |
| 5 | `PROJECTS.md` / `PROJECT_NAMING_RULE.md` 等のドキュメントを一括更新 | Claude Code |
| 6 | `docs/JREC-01_施術者向け手順書.md` / `受付者向け手順書.md` / `プレオープン運用手順書.md` を更新 | Claude Code |
| 7 | `node scripts/update-live-projects-sheet-metadata.mjs` で Dashboard 反映 | Claude Code |
| 8 | commit & push | Claude Code |

---

## G. 断念すべき条件

### フォルダ名変更を断念すべき条件

以下がひとつでも当てはまる場合は断念:

- [x] `gas-projects/` が JREC-01 専用フォルダでない（`jrec-portal/` が同居している）← **現在該当**
- [x] 命名移行の記録に「フォルダ名は維持する」と明記されている ← **現在該当**
- [ ] scripts/ のハードコード修正に 1 時間以上かかる工数が発生する
- [ ] Dashboard Live Sheets の `directory` フィールドが参照されているレポート・集計が存在する

### スプレッドシート名変更を後回しにすべき条件

- [x] プレオープン直前で現場への周知時間がない ← **現在該当**
- [ ] 施術者・受付者が手順書をすでに印刷・配布している
- [ ] 旧スプレッドシート名でブックマーク・Google Drive の「共有」が設定されている

---

## 調査まとめ

```
CHECKED_TARGETS:
  - gas-projects/ 配下の全ファイル（jyu-gas-ver3.1/ + jrec-portal/）
  - .clasp.json（jyu-gas-ver3.1・freee-automation・jrec-portal・tmp）
  - GAS コード全体（Ver3_core.js 等・openByName 使用なし確認）
  - scripts/ 配下（PS1 / mjs 全件）
  - .claude/settings.local.json（bash 許可コマンドの絶対パス）
  - CLAUDE.md / PROJECTS.md / ROADMAP.md / README.md
  - docs/PROJECT_NAMING_RULE*.md / *_RUNBOOK.md / *_MEMO.md
  - gas-projects/jyu-gas-ver3.1/docs/ 配下の全 Markdown
  - hirayama-jyusei-strategy/ 配下の参照ドキュメント
  - ai-os/ 配下の参照ドキュメント
  - Dashboard / Projects / Run_Log 更新スクリプト
  - PROJECT_NAMING_MIGRATION_RUNBOOK（過去の命名移行履歴）

RECOMMENDATION:
  - フォルダ名変更 → 断念推奨（意味的不整合 + 影響範囲広大 + 移行履歴で維持確定済み）
  - スプレッドシート名変更 → 条件付き可能（技術的には安全。プレオープン後に実施推奨）

NEXT:
  院長の判断が必要な1点:
  「スプレッドシート名変更をプレオープン後（2〜4週間後）に実施するか、
   それとも現状名称のままで永続運用とするか、方針を決定すること」
```

---

## 変更禁止確認

本調査では以下を実施していない:

- [x] フォルダ名変更 → **未実施**
- [x] スプレッドシート名変更 → **未実施**
- [x] コード書き換え → **未実施**
- [x] commit / push → **未実施**
- [x] Dashboard の本更新 → **未実施**
