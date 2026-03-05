# SETUP.md — 新PCセットアップ手順

このドキュメントは新しいPC（ジムPCなど）でこのワークスペースを使い始めるための手順書です。

---

## 前提・注意事項

- **OneDrive管理下のフォルダにクローンしない**（同期競合やファイルロックが発生する）
- 作業フォルダは `C:\hirayama-ai-workspace\` を使う
- 認証情報ファイル（`service_account.json`、`.env` 等）はGitに含まれていない。別途配置が必要

---

## Step 1 — ツールのインストール

以下を順番にインストールする。

### Git

```
https://git-scm.com/download/win
```

インストール後、Git Bash または PowerShell で確認:

```bash
git --version
```

### Node.js（clasp用）

```
https://nodejs.org/  （LTS版を選ぶ）
```

### clasp（GAS用CLIツール）

```bash
npm install -g @google/clasp
```

### Python（patient-management用）

```
https://www.python.org/downloads/  （3.11以上を選ぶ）
```

---

## Step 2 — リポジトリのクローン

```bash
cd C:\
mkdir hirayama-ai-workspace
cd hirayama-ai-workspace
git clone https://github.com/dabu-pi/hirayama-ai-workspace.git workspace
```

クローン後の構造:

```
C:\hirayama-ai-workspace\
└── workspace\   ← ここが開発ディレクトリ
```

---

## Step 3 — Gitの初期設定（新PCで初回のみ）

```bash
git config --global user.name "Katsushi Hirayama"
git config --global user.email "your-email@example.com"
```

---

## Step 4 — プロジェクト別の初期設定

### 4-1. 柔整GAS / freee自動化（GASプロジェクト）

claspのGoogle認証:

```bash
clasp login
```

ブラウザが開くので、Googleアカウントでログインして認証を完了させる。

各GASプロジェクトの `.clasp.json` は**gitに含まれていない**（PC固有設定）。
スプレッドシートのエディタで「拡張機能 → Apps Script」を開き、スクリプトIDを確認して以下を作成する:

```bash
# gas-projects/jyu-gas-ver3.1/ に作成
cd workspace/gas-projects/jyu-gas-ver3.1
```

`.clasp.json`（各自作成・コミット不可）:

```json
{
  "scriptId": "ここにスクリプトIDを貼る",
  "rootDir": "."
}
```

### 4-2. patient-management（Flask Webアプリ）

仮想環境の作成とパッケージインストール:

```bash
cd workspace/patient-management
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

`service_account.json` を配置する（gitに含まれていないため別途入手）:

```
workspace/patient-management/service_account.json
```

`.env` ファイルを作成（gitに含まれていないため自分で作成）:

```
GOOGLE_SERVICE_ACCOUNT_PATH=service_account.json
FLASK_SECRET_KEY=任意のランダム文字列
```

起動確認:

```bash
python app.py
# → http://localhost:5000 で動作確認
```

---

## Step 5 — 日常の開発フロー

### 作業開始時（毎回必ず実行）

```bash
cd C:\hirayama-ai-workspace\workspace
git pull origin master
```

### 作業後

```bash
git add <変更したファイル>
git commit -m "変更内容の説明"
git push origin master
```

> `git add .` は使わず、変更したファイルを個別に指定する（認証情報の誤コミット防止）

---

## Step 6 — 動作確認チェックリスト

| 項目 | 確認コマンド | 期待結果 |
|---|---|---|
| Git | `git status` | `On branch master` と表示される |
| clasp認証 | `clasp whoami` | Googleアカウントのメールが表示される |
| Python仮想環境 | `python --version`（venv内） | 3.11以上 |
| Flaskアプリ | `python app.py` | localhost:5000 でアクセス可能 |

---

## トラブルシューティング

### `clasp login` でブラウザが開かない

```bash
clasp login --no-localhost
```

表示されたURLをブラウザで手動で開いて認証する。

### `git pull` でコンフリクトが発生した

```bash
git status          # コンフリクト対象ファイルを確認
# ファイルを手動で編集してコンフリクトを解消
git add <ファイル>
git commit -m "Resolve merge conflict"
```

### `service_account.json` が見つからないエラー

`patient-management/` に `service_account.json` が配置されているか確認する。
gitには含まれていないため、別のPCから直接コピーするか、Google Cloud Consoleで再発行する。
