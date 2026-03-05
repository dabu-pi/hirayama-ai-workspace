# AI開発環境 運用ガイド

平山克司ワークスペース — Claude Code自動開発モードの安定運用ドキュメント
最終更新: 2026-03-05

---

## 目次

1. [環境構成](#1-環境構成)
2. [workspace と claude-sandbox の使い分け](#2-workspace-と-claude-sandbox-の使い分け)
3. [スクリプト使用方法](#3-スクリプト使用方法)
4. [ログ運用ルール](#4-ログ運用ルール)
5. [AI開発フロー](#5-ai開発フロー)
6. [Claudeとの役割分担](#6-claudeとの役割分担)
7. [PATH設定・初回セットアップ](#7-path設定初回セットアップ)

---

## 1. 環境構成

```
C:\hirayama-ai-workspace\
├── workspace\               ← 本番開発（Git管理・GitHub連携）
│   ├── scripts\             ← 共有自動化スクリプト（git管理）
│   │   ├── create-ai-project.ps1
│   │   ├── run-with-log.ps1
│   │   └── note.ps1
│   ├── docs\                ← ワークスペース共通ドキュメント
│   │   └── AI_DEV_ENV.md    ← このファイル
│   ├── gas-projects\
│   ├── freee-automation\
│   ├── patient-management\
│   ├── hirayama-jyusei-strategy\
│   └── archive\
│
├── claude-sandbox\          ← 実験・プロトタイプ専用（別リポジトリ）
│
├── _shared\                 ← 複数プロジェクト共有リソース（git管理外）
│
└── _logs\                   ← ワークスペース共通ログ（git管理外）
```

---

## 2. workspace と claude-sandbox の使い分け

### 基本原則

| ディレクトリ | 用途 | Git管理 | commit/push |
|---|---|---|---|
| `workspace/` | 本番開発・確定コード | ✅ あり | 作業完了時に必須 |
| `claude-sandbox/` | 実験・試作・動作確認 | 任意 | 不要 |

### 判断フロー

```
タスクを受け取る
      ↓
  仕様は明確か？
   ↙        ↘
  Yes         No
   ↓           ↓
workspace/   まず質問 → claude-sandbox/ で試作
   ↓                          ↓
実装 → commit → push    動作確認 → workspace/ に移植
```

### 具体的な使い分け例

| 状況 | 作業場所 |
|---|---|
| 柔整GASのバグ修正 | `workspace/gas-projects/` |
| freee APIの新エンドポイントを試す | `claude-sandbox/` |
| Claude API の新機能を検証する | `claude-sandbox/` |
| 患者管理アプリに機能追加（仕様確定済み） | `workspace/patient-management/` |
| 新プロジェクトの要件が曖昧 | `claude-sandbox/` でプロトタイプ後に移植 |

---

## 3. スクリプト使用方法

スクリプトは `workspace/scripts/` に格納されています。
PATH設定後はどのディレクトリからでも呼び出せます（[Section 7](#7-path設定初回セットアップ) 参照）。

---

### 3-1. `create-ai-project.ps1` — 新規プロジェクト作成

```powershell
# 基本：カレントディレクトリに作成
create-ai-project.ps1 freee-api-v2

# 作成先を指定
create-ai-project.ps1 quick-test -Path C:\hirayama-ai-workspace\claude-sandbox
```

**作成されるディレクトリ構造:**

```
freee-api-v2/
├── src/              # ソースコード
├── scripts/          # プロジェクト固有スクリプト
├── logs/
│   ├── run/          # 実行ログ（gitignore）
│   ├── error/        # エラーログ（gitignore）
│   └── notes/        # 開発メモ（git管理）
├── artifacts/        # 成果物・出力ファイル（gitignore）
├── docs/             # ドキュメント
├── CLAUDE.md         # AI向けガイド
├── README.md
└── .gitignore
```

---

### 3-2. `run-with-log.ps1` — ログ付き実行

```powershell
# Python スクリプト実行
run-with-log.ps1 python main.py

# 引数あり
run-with-log.ps1 python -m pytest tests/ -v

# Node.js
run-with-log.ps1 node src/index.js --port 3000
```

**保存されるファイル:**

| 状況 | 保存先 | ファイル名 |
|---|---|---|
| 常時 | `logs/run/` | `run_YYYYMMDD_HHMMSS.log` |
| エラー時（exit ≠ 0） | `logs/error/` | `error_YYYYMMDD_HHMMSS.log` |

**ログの内容:**

```
# ============================================================
# Run Log
# ============================================================
# Command  : python main.py
# Start    : 2026-03-05 14:30:00
# WorkDir  : C:\hirayama-ai-workspace\workspace\freee-automation
# ============================================================

（実行出力）

# ============================================================
# End      : 2026-03-05 14:30:12
# Duration : 12.3s
# ExitCode : 0
# Status   : SUCCESS
# ============================================================
```

---

### 3-3. `note.ps1` — 開発メモ保存

```powershell
# 基本
note.ps1 "freee API OAuth修正完了"

# タグ付き
note.ps1 "redirect_uri の不一致が原因" -Tag bug
note.ps1 "次回: TC-05を実行する" -Tag todo
note.ps1 "新しいアプローチを試す価値あり" -Tag idea
```

**保存先:** `logs/notes/note_YYYYMMDD.md`（日次・追記式）

**ファイルの例:**

```markdown
# 開発メモ — 2026-03-05

- 14:30 `#bug` — redirect_uri の不一致が原因
- 15:20 `#done` — OAuth再構築完了・フェーズ2動作確認
- 16:00 `#todo` — 次回: 取引先自動作成のテストケースを追加
```

> `logs/notes/` は **git管理対象**です。commit することでメモが両PCで共有されます。

---

## 4. ログ運用ルール

### Git管理の分類

| ログ種別 | ディレクトリ | Git管理 | 理由 |
|---|---|---|---|
| 実行ログ | `logs/run/` | 対象外 | 量が多い・再現可能 |
| エラーログ | `logs/error/` | 対象外 | 量が多い・再現可能 |
| 成果物 | `artifacts/` | 対象外 | バイナリ・大容量 |
| 開発メモ | `logs/notes/` | **管理対象** ✅ | 知識・経緯の記録 |

### `.gitignore` 設定（プロジェクト単位）

```gitignore
# 実行ログ・エラーログ（自動生成・git管理外）
logs/run/
logs/error/

# 成果物（自動生成・git管理外）
artifacts/

# logs/notes/ は git 管理対象のため除外しない
```

### workspace全体の `.gitignore` 設定

```gitignore
# プロジェクトログ自動生成
*/logs/run/
*/logs/error/
*/artifacts/

# ルートレベル一時ログ
_logs/
```

### メモのコミットタイミング

- 1日の作業終了時にまとめてコミットする
- 重要な発見（バグ原因・設計判断）は即座にメモ → 当日中にコミット

```powershell
# 開発メモをコミットする例
cd C:\hirayama-ai-workspace\workspace
git add */logs/notes/
git commit -m "notes: 2026-03-05 開発メモ追加"
git push origin master
```

---

## 5. AI開発フロー

### 標準フロー

```
【作業開始】
  git pull origin master      ← 毎回必ず実行

【開発サイクル】
  1. タスク確認（ROADMAP.md）
  2. 仕様確認（CLAUDE.md / PROJECTS.md / spec.md）
  3. 実装（workspace/ or claude-sandbox/）
  4. 実行確認
     run-with-log.ps1 python main.py
  5. メモ保存
     note.ps1 "〇〇の実装完了" -Tag done
  6. commit & push（workspace の場合）

【作業終了】
  note.ps1 "本日の作業: 〇〇完了。次回: △△" -Tag todo
  git add ... && git commit && git push
```

### 新規プロジェクト開始フロー

```powershell
# workspace 内に本番プロジェクトを作成
cd C:\hirayama-ai-workspace\workspace
create-ai-project.ps1 waste-report-system

# または claude-sandbox で試作から始める場合
cd C:\hirayama-ai-workspace\claude-sandbox
create-ai-project.ps1 waste-report-poc
```

### 実験→本番化フロー

```
claude-sandbox/waste-report-poc/   ← 試作・検証
         ↓ 動作確認OK
workspace/waste-report-system/     ← 本番コードとして移植
```

---

## 6. Claudeとの役割分担

| 役割 | Claude | 人間 |
|---|---|---|
| コード実装 | ✅ 実装・修正 | 要件定義・仕様確認 |
| ドキュメント更新 | ✅ 自動更新 | 承認・内容確認 |
| ROADMAP ステータス更新 | ✅ 完了マーク | 優先順位の決定 |
| commit & push | ✅ 実施 | 内容確認 |
| GASのスプレッドシート確認 | ❌ 不可 | **人間が実施** |
| freee API 本番POST | ❌ 禁止 | 下書き確認後に人間が実施 |
| メール送信 | ❌ 禁止（下書きまで） | 送信は人間が実施 |
| 認証情報の入力 | ❌ 禁止 | 人間が直接入力 |

### Claudeへの指示テンプレート

```
# 新機能実装を依頼する場合
「freee-automation/ に〇〇機能を追加してください。
 仕様: [仕様を明記]
 workspace/ で作業してください。」

# 実験的な試作を依頼する場合
「claude-sandbox/ でfreee PDFダウンロードの動作確認コードを作ってください。
 本番には反映しなくて構いません。」
```

---

## 7. PATH設定・初回セットアップ

### PowerShell PATH への追加（永続化）

```powershell
# PowerShell プロファイルを開く（なければ作成）
notepad $PROFILE

# 以下を追記して保存
$env:PATH += ";C:\hirayama-ai-workspace\workspace\scripts"

# または Function として登録（より簡単に呼び出せる）
function cap  { & "C:\hirayama-ai-workspace\workspace\scripts\create-ai-project.ps1" @args }
function rwl  { & "C:\hirayama-ai-workspace\workspace\scripts\run-with-log.ps1" @args }
function note { & "C:\hirayama-ai-workspace\workspace\scripts\note.ps1" @args }
```

保存後、新しいターミナルを開くと有効になります。

### 実行ポリシーの確認

初回実行時に「スクリプトの実行が無効」エラーが出た場合:

```powershell
# 現在のポリシー確認
Get-ExecutionPolicy

# ユーザー単位でスクリプト実行を許可（推奨）
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 動作確認

```powershell
# スクリプトが動作するか確認
create-ai-project.ps1 test-project -Path $env:TEMP
note.ps1 "セットアップ完了"
```

---

## 付録: よく使うコマンド一覧

```powershell
# プロジェクト作成
create-ai-project.ps1 <project-name>

# ログ付き実行
run-with-log.ps1 python main.py
run-with-log.ps1 python -m pytest tests/

# メモ保存
note.ps1 "メモ内容"
note.ps1 "メモ内容" -Tag bug|done|todo|idea|warn

# Git 日常操作
git pull origin master                    # 作業開始前に必ず
git add <files> && git commit -m "..."    # 変更をコミット
git push origin master                    # プッシュ
```
