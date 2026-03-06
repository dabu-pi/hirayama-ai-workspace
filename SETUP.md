# SETUP.md — 新PCセットアップ手順

このドキュメントは新しいPC（ジムPCなど）でこのワークスペースを使い始めるための手順書です。

---

## 前提・注意事項

- **OneDrive管理下のフォルダにクローンしない**（同期競合やファイルロックが発生する）
- 作業フォルダは `C:\hirayama-ai-workspace\` 固定で使う
- 認証情報ファイル（`service_account.json`、`.env` 等）はGitに含まれていないため別途配置が必要

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

## Step 6 — 日常の開発フロー

```powershell
cd C:\hirayama-ai-workspace\workspace
ds                        # 作業開始（git pull）
de "変更内容の説明"        # 作業終了（commit + push）
```

詳細ルールは [CLAUDE.md](./CLAUDE.md) を参照。

---

## Step 7 — 動作確認チェックリスト

| 項目 | 確認コマンド | 期待結果 |
|---|---|---|
| Git | `git status` | `On branch master` と表示される |
| Git設定 | `git config --global --list` | name / email が表示される |
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
