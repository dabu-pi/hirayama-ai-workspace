# SETUP.md — 新PCセットアップ手順

このドキュメントは新しいPC（ジムPC・自宅PC・ノートPC）でこのワークスペースを使い始めるための手順書です。
Codex / Claude Code のどちらを使う場合も、この手順を共通で使います。

---

## 前提・注意事項

- **OneDrive管理下のフォルダにクローンしない**（同期競合やファイルロックが発生する）
- 作業フォルダは `C:\hirayama-ai-workspace\` 固定で使う
- GitHub を正本とし、ローカルの未push状態を基準にしない
- 認証情報ファイル（`service_account.json`、`.env` 等）はGitに含まれていないため別途配置が必要
- PC固有ファイルは GitHub に上げない

---

## Step 1 — ツールのインストール

以下を順番にインストールする。インストール後は新しいターミナルを開いてパスを反映させる。

### Git

公式サイトからインストール（Windows用インストーラー）:
```
https://git-scm.com/download/win
```

確認:
```bash
git --version
# git version 2.x.x
```

### Node.js（clasp用）

LTS版をインストール:
```
https://nodejs.org/
```

### clasp（GAS用CLIツール）

```bash
npm install -g @google/clasp
```

### Python（patient-management用）

3.11以上をインストール:
```
https://www.python.org/downloads/
```

インストール時に「Add Python to PATH」にチェックを入れる。

---

## Step 2 — リポジトリのクローン

Git Bash または PowerShell で実行:

```bash
mkdir -p /c/hirayama-ai-workspace
cd /c/hirayama-ai-workspace
git clone https://github.com/dabu-pi/hirayama-ai-workspace.git workspace
```

クローン後の構造:

```
C:\hirayama-ai-workspace\
└── workspace\   ← ここが本番開発ディレクトリ
```

---

## Step 3 — Gitの初期設定（新PCで初回のみ）

```bash
git config --global user.name "Katsushi Hirayama"
git config --global user.email "ここに自分のGitHubメールアドレスを入力"
# 例: git config --global user.email "dabu-pi@users.noreply.github.com"
```

設定確認:

```bash
git config --global --list
# user.name=Katsushi Hirayama
# user.email=...
```

リモート確認:

```bash
cd /c/hirayama-ai-workspace/workspace
git remote -v
# origin https://github.com/dabu-pi/hirayama-ai-workspace.git
```

---

## Step 4 — プロジェクト別の初期設定

### 4-1. 柔整GAS / freee自動化（GASプロジェクト）

claspのGoogle認証:

```bash
clasp login
```

ブラウザが開くのでGoogleアカウントでログインして認証を完了させる。

認証確認:

```bash
clasp whoami
# Logged in as: xxxx@gmail.com
```

各GASプロジェクトの `.clasp.json` は **gitに含まれていない**（PC固有設定）。
スプレッドシートのエディタで「拡張機能 → Apps Script」を開き、スクリプトIDを確認して作成する。

```bash
cd /c/hirayama-ai-workspace/workspace/gas-projects/jyu-gas-ver3.1
```

`.clasp.json`（各自作成・コミット不可）:

```json
{
  "scriptId": "ここにスクリプトIDを貼る",
  "rootDir": "."
}
```

### 4-2. patient-management（Flask Webアプリ）

```bash
cd /c/hirayama-ai-workspace/workspace/patient-management
python -m venv venv
source venv/Scripts/activate
pip install -r requirements.txt
```

`service_account.json` を配置する（gitに含まれていないため別途入手）:

```
C:\hirayama-ai-workspace\workspace\patient-management\service_account.json
```

`.env` ファイルを作成（gitに含まれていないため自分で作成）:

```
GOOGLE_SERVICE_ACCOUNT_PATH=service_account.json
FLASK_SECRET_KEY=任意のランダム文字列
```

起動確認:

```bash
python app.py
# → ブラウザで http://localhost:5000 にアクセスして動作確認
```

---

## Step 5 — PowerShell エイリアスの設定

PowerShell でショートコマンドを使えるようにします。
Git Bash でなく **PowerShell (5.1 または 7)** で実行してください。

### 5-1. 実行ポリシーの変更（初回のみ）

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 5-2. エイリアスの自動登録

```powershell
cd C:\hirayama-ai-workspace\workspace\scripts
.\setup-aliases.ps1
```

確認だけしたい場合（DryRun）:

```powershell
.\setup-aliases.ps1 -DryRun
```

### 5-3. $PROFILE の即時反映

```powershell
. $PROFILE
```

新しいターミナルを開いても自動で反映されます。

### 登録されるコマンド

| コマンド | 役割 | フェーズ |
|---|---|---|
| `ds` | 作業開始：git pull + 状態確認 | **Phase3** |
| `de` | 作業終了：commit + push | **Phase3** |
| `cap` | 新規プロジェクト作成 | Phase1 |
| `rwl` | ログ付き実行（直接） | Phase1 |
| `note` | 開発メモ保存 | Phase1 |
| `adr` | 司令塔：rwl 経由実行 + 自動 note | Phase2 |
| `gsc` | 安全確認付き commit & push | Phase2 |
| `aerr` | 最新エラーログ整形表示 | Phase2 |
| `dstat` | プロジェクト状態ダッシュボード | Phase2 |

動作確認:

```powershell
ds            # 最新コードを取得
dstat         # プロジェクト状態を表示
note "セットアップ完了" -Tag done
```

---

## Step 6 — Codex / Claude 共通の起動ルール

AI に作業を依頼する前に、次を確認する。

```powershell
cd C:\hirayama-ai-workspace\workspace
git status
git pull
```

AI には、まず次を読むように指示する。

1. `README.md`
2. `PROJECTS.md`
3. `ROADMAP.md`
4. `docs/PROJECT_STATUS.md`
5. 対象プロジェクトの `README.md`
6. 対象プロジェクトの `PROJECT_STATUS.md`
7. 必要に応じて `spec.md` / `SPEC.md`

定型指示例:

```text
まず README.md、PROJECTS.md、ROADMAP.md、docs/PROJECT_STATUS.md と、
今回触るプロジェクトの README / PROJECT_STATUS / spec を読んでから作業してください。
作業前に git status を確認し、最後に変更点・検証結果・次の作業を整理してください。
```

---

## Step 7 — 3台のPCを切り替える日常運用

### 7-1. 作業開始時

```powershell
cd C:\hirayama-ai-workspace\workspace
git status
git pull
```

確認ポイント:

- 今のPCに未コミット差分が残っていないか
- 別PCで push 済みの変更を取得できたか
- 対象プロジェクトの `PROJECT_STATUS.md` を読んだか

### 7-2. 作業終了時

最低限、次をやる。

- `PROJECT_STATUS.md` または関連メモを更新する
- 必要なテスト・確認を実行する
- `git status` で差分を確認する
- `git add` → `git commit` → `git push`

例:

```powershell
cd C:\hirayama-ai-workspace\workspace
git status
git add .
git commit -m "docs: update project status"
git push origin feature/auto-dev-phase3-loop
```

### 7-3. PC を切り替える前の禁止事項

- push 前の変更を残したまま他のPCで続きを始めない
- AIとの会話だけに重要判断を残さない
- 同じファイルを複数PCで同時に編集しない
- `.env` や `service_account.json` をコミットしない

---

## Step 8 — 動作確認チェックリスト

| 項目 | 確認コマンド | 期待結果 |
|---|---|---|
| Git | `git status` | ブランチ名と作業状態が表示される |
| Git設定 | `git config --global --list` | name / email が表示される |
| GitHubリモート | `git remote -v` | `origin` が `dabu-pi/hirayama-ai-workspace.git` を指す |
| clasp認証 | `clasp whoami` | Googleアカウントのメールが表示される |
| Python仮想環境 | `python --version`（venv内） | 3.11以上 |
| Flaskアプリ | `python app.py` | localhost:5000 でアクセス可能 |
| エイリアス（PS）ds | `ds` | git pull + 状態表示が出る |
| エイリアス（PS）de | `de "テスト"` | コミット・push 完了と表示される |
| エイリアス（PS） | `dstat` | プロジェクト状態が表示される |
| エイリアス（PS） | `note "test" -Tag done` | logs/notes/ にメモが保存される |

---

## トラブルシューティング

### `clasp login` でブラウザが開かない

```bash
clasp login --no-localhost
```

表示されたURLをブラウザで手動で開いて認証する。

### `git pull` でコンフリクトが発生した

```bash
git status                     # コンフリクト対象ファイルを確認
# ファイルを手動で編集してコンフリクトを解消
git add <ファイル名>
git commit -m "Resolve merge conflict"
```

### `service_account.json` が見つからないエラー

`patient-management/` に `service_account.json` が配置されているか確認する。
gitには含まれていないため、別のPCから直接コピーするか、Google Cloud Consoleで再発行する。

### Python仮想環境が見つからない / activate できない

```bash
cd /c/hirayama-ai-workspace/workspace/patient-management
python -m venv venv          # 再作成
source venv/Scripts/activate
pip install -r requirements.txt
```

---

## 関連ドキュメント

- `AGENTS.md`
- `docs/CODEX_MIGRATION_CHECKLIST.md`
- `CLAUDE.md`
- `docs/AI_DEV_ENV.md`

## ai-os 直接書き込み補足

`Codex` から `Run_Log` を直接 Google Sheets へ追記する場合は、サービスアカウント JSON と環境変数が必要です。
詳しくは [ai-os/CODEX_SHEETS_DIRECT_WRITE_SETUP.md](C:/hirayama-ai-workspace/workspace/ai-os/CODEX_SHEETS_DIRECT_WRITE_SETUP.md) を参照してください。

最小設定:

```powershell
[Environment]::SetEnvironmentVariable('AIOS_SERVICE_ACCOUNT_PATH', 'C:\hirayama-ai-workspace\secrets\aios-service-account.json', 'User')
[Environment]::SetEnvironmentVariable('AIOS_DASHBOARD_SPREADSHEET_ID', '1EvZMtMiX5TKsSBYPhF5VrCcK9JEWHhUHuuYkUTRSIfk', 'User')
[Environment]::SetEnvironmentVariable('AIOS_RUNLOG_SHEET_NAME', 'Run_Log', 'User')
[Environment]::SetEnvironmentVariable('AIOS_RUNLOG_SHEET_WRITE', '1', 'User')
```
