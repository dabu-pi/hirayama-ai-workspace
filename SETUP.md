# SETUP.md — 新PCセットアップ手順

このドキュメントは、hirayama-ai-workspace を新しい PC で安全に再開するための共通セットアップ手順です。  
Codex / Claude Code のどちらを使う場合も、この手順を基準にしてください。

---

## 基本方針

- 作業ディレクトリは `C:\hirayama-ai-workspace\workspace` を正本として使う
- GitHub を正本とし、未 push の変更を残したまま別 PC へ移らない
- `workspace` 本体を OneDrive / Google Drive / Dropbox などの常駐同期フォルダに置かない
- secrets は Git に入れず、PC ごとに手動配置する
- Google Drive は後段の export / upload 用に使い、Drive 側コピーでは Git 作業しない

---

## Step 1 — ツールのインストール

### Git

Windows 版 Git をインストールします。

```text
https://git-scm.com/download/win
```

確認:

```powershell
git --version
```

### Node.js

LTS 版をインストールします。

```text
https://nodejs.org/
```

### clasp

Google Apps Script 用 CLI を入れます。

```powershell
npm install -g @google/clasp
```

### Python

`patient-management` などで使うため、Python 3.11 系を推奨します。

```text
https://www.python.org/downloads/
```

インストール時は `Add Python to PATH` を有効にしてください。

---

## Step 2 — リポジトリのクローン

PowerShell か Git Bash で、作業用ディレクトリへ clone します。

```powershell
New-Item -ItemType Directory -Force -Path C:\hirayama-ai-workspace | Out-Null
Set-Location C:\hirayama-ai-workspace
git clone https://github.com/dabu-pi/hirayama-ai-workspace.git workspace
```

完成形:

```text
C:\hirayama-ai-workspace\
  workspace\
```

---

## Step 3 — Git の初期設定

各 PC で最低限これを確認します。

```powershell
git config --global user.name  "Your Name"
git config --global user.email "your-github-email@example.com"
git config --global --list
```

remote 確認:

```powershell
cd C:\hirayama-ai-workspace\workspace
git remote -v
```

`origin` が `dabu-pi/hirayama-ai-workspace.git` を向いていれば OK です。

---

## Step 4 — プロジェクト別のローカル設定

### 4-1. GAS / freee 系

Google アカウントで `clasp login` を行います。

```powershell
clasp login
clasp whoami
```

`.clasp.json` はローカル専用です。Git へ入れません。  
必要な PC に手動配置してください。

例:

```json
{
  "scriptId": "YOUR_SCRIPT_ID",
  "rootDir": "./"
}
```

### 4-2. patient-management

`service_account.json` と `.env` をローカル配置します。どちらも Git へ入れません。

例:

```text
patient-management\service_account.json
patient-management\.env
```

`.env` 例:

```env
FLASK_SECRET_KEY=replace-with-random-string
```

必要なら動作確認:

```powershell
cd C:\hirayama-ai-workspace\workspace\patient-management
python app.py
```

---

## Step 5 — PowerShell エイリアス設定

workspace には日常運用用の PowerShell エイリアスがあります。`setup-aliases.ps1` で `$PROFILE` に登録します。

Dry run:

```powershell
cd C:\hirayama-ai-workspace\workspace
.\scripts\setup-aliases.ps1 -DryRun
```

適用:

```powershell
.\scripts\setup-aliases.ps1
. $PROFILE
```

主なコマンド:

| コマンド | 用途 |
|---|---|
| `ds` | `dev-start`。pull + status 確認 |
| `de` | `dev-end`。commit + push + handoff |
| `dstat` | 状況確認 |
| `gsc` | safe commit |
| `note` | 作業メモ保存 |

---

## Step 6 — Claude Code / Codex のローカル設定

権限制御やローカル設定は `.claude/settings.json` などで管理します。  
これらはローカル専用で、Git には入れません。

確認:

```powershell
Get-Content $env:USERPROFILE\.claude\settings.json
```

`git push` や `clasp push` の承認方針は、各 PC のローカル設定に合わせて調整してください。

---

## Step 7 — AI 共通ルール

AI に作業を依頼するときは、まず次を読む運用にします。

1. `README.md`
2. `PROJECTS.md`
3. `ROADMAP.md`
4. `docs/PROJECT_STATUS.md`
5. 対象プロジェクトの `README.md`
6. 対象プロジェクトの `PROJECT_STATUS.md`
7. 必要に応じて `spec.md` / `SPEC.md`

作業前には必ず:

```powershell
cd C:\hirayama-ai-workspace\workspace
git status
git pull
```

作業後は、変更内容・検証結果・次アクションを状態ファイルへ残してから handoff します。

---

## Step 8 — 3台PC運用ルール

### 開始時

```powershell
cd C:\hirayama-ai-workspace\workspace
git status
git pull
```

### 終了時

- `PROJECT_STATUS.md` を更新する
- 不要な差分がないか確認する
- `git status` を確認する
- `de` か `git add / commit / push` で handoff する

### PC を切り替える前

- push 前の変更を残したまま別 PC へ移らない
- secrets は GitHub ではなく各 PC へ手動配置する
- 同じファイルを複数 PC で同時に編集しない

---

## Step 9 — `de` 用 env vars の設定

`de` は workspace 全体の handoff コマンドです。  
環境変数が設定されていると、1 回の実行で次まで自動化できます。

- commit
- push
- Run_Log JSON / TSV 出力
- Run_Log シート追記
- Projects 最小同期
- Google Drive export / upload

### 必須ではない env vars

下の 2 つは Dashboard 連携用です。未設定でも `de` 自体は動きますが、Run_Log シート追記と Projects 同期はスキップされます。

| 変数 | 用途 |
|---|---|
| `AIOS_DASHBOARD_SPREADSHEET_ID` | Hirayama AI OS Dashboard の spreadsheet ID |
| `AIOS_SERVICE_ACCOUNT_PATH` | service account JSON のローカルパス |

推奨パス:

```text
C:\hirayama-ai-workspace\workspace\secrets\aios-service-account.json
```

### 一時設定

```powershell
$env:AIOS_DASHBOARD_SPREADSHEET_ID = '1EvZMtMiX5TKsSBYPhF5VrCcK9JEWHhUHuuYkUTRSIfk'
$env:AIOS_SERVICE_ACCOUNT_PATH     = 'C:\hirayama-ai-workspace\workspace\secrets\aios-service-account.json'
```

### 永続設定

```powershell
[Environment]::SetEnvironmentVariable('AIOS_DASHBOARD_SPREADSHEET_ID', '1EvZMtMiX5TKsSBYPhF5VrCcK9JEWHhUHuuYkUTRSIfk', 'User')
[Environment]::SetEnvironmentVariable('AIOS_SERVICE_ACCOUNT_PATH', 'C:\hirayama-ai-workspace\workspace\secrets\aios-service-account.json', 'User')
[Environment]::SetEnvironmentVariable('AIOS_RUNLOG_SHEET_NAME', 'Run_Log', 'User')
[Environment]::SetEnvironmentVariable('AIOS_RUNLOG_SHEET_WRITE', '1', 'User')
```

確認:

```powershell
$env:AIOS_DASHBOARD_SPREADSHEET_ID
$env:AIOS_SERVICE_ACCOUNT_PATH
Test-Path $env:AIOS_SERVICE_ACCOUNT_PATH
```

### 未設定時の挙動

未設定でも次は動きます。

- commit / push
- ローカル Run_Log JSON / TSV 出力
- workspace export / gdrive upload 試行

未設定だとスキップされるもの:

- Run_Log シート追記
- Projects 最小同期

必要なら後から手動で次を実行します。

```powershell
$json = (Get-ChildItem logs/runlog/runlog_*.json |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1).FullName

node scripts/append-runlog-to-sheet.mjs --json $json --write
node scripts/sync-project-from-runlog.mjs --json $json --project-id AIOS-06 --expected-commit <commit> --write
```

詳細: [ai-os/CODEX_SHEETS_DIRECT_WRITE_SETUP.md](./ai-os/CODEX_SHEETS_DIRECT_WRITE_SETUP.md)

---

## Step 10 — Google Drive export / upload のセットアップ

### 基本方針

- `workspace` は GitHub 正本の作業ディレクトリとして運用する
- `workspace-export` は Google Drive upload 用の安全な export として使う
- `de` 実行後に `workspace -> workspace-export` を更新し、その後 rclone で Google Drive へ upload する
- Google Drive for desktop の常駐同期は前提にしない
- Drive 側コピーや `workspace-export` 側では Git 作業をしない

### export の確認

```powershell
cd C:\hirayama-ai-workspace\workspace
.\scripts\sync-workspace-to-drive.ps1 -DryRun
.\scripts\sync-workspace-to-drive.ps1
```

既定の export 先:

```text
C:\hirayama-ai-workspace\workspace-export
```

### export 先を変更したい場合

```powershell
[Environment]::SetEnvironmentVariable('HIRAYAMA_DRIVE_SYNC_EXPORT_ROOT', 'D:\shared\workspace-export', 'User')
```

### rclone の設定

```powershell
rclone config
rclone listremotes
[Environment]::SetEnvironmentVariable('HIRAYAMA_GDRIVE_REMOTE', 'gdrive', 'User')
[Environment]::SetEnvironmentVariable('HIRAYAMA_GDRIVE_REMOTE_PATH', 'hirayama-ai-workspace/workspace-export', 'User')
```

### 初回 upload の確認

初回は安全重視で `copy` を使います。

```powershell
.\scripts\upload-workspace-export-to-gdrive.ps1 -Mode copy -DryRun
.\scripts\upload-workspace-export-to-gdrive.ps1 -Mode copy
```

### 通常運用

専用保存先だと確認できた後は `de` で通常運用します。`de` からの既定 upload は `sync` です。

```powershell
de -ProjectId AIOS-06 "chore: verify gdrive handoff"
```

### 一時的に回避したい場合

```powershell
de -ProjectId AIOS-06 -SkipDriveSync "docs: skip drive sync for this handoff"
de -ProjectId AIOS-06 -SkipGDriveUpload "docs: export only for this handoff"
```

### 確認ポイント

- `workspace-export\INDEX.md` が生成されているか
- `logs/drive-sync/drive-sync_*.log` と `drive-sync_*.json` が生成されているか
- `logs/gdrive-upload/gdrive-upload_*.json` が生成されているか
- `rclone listremotes` に指定 remote が見えるか

詳細: [docs/GOOGLE_DRIVE_SYNC.md](./docs/GOOGLE_DRIVE_SYNC.md)
