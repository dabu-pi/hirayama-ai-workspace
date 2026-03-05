#Requires -Version 5.1
<#
.SYNOPSIS
    AI開発プロジェクトのディレクトリ構造とテンプレートを自動生成します。

.DESCRIPTION
    指定したプロジェクト名でディレクトリ構造・CLAUDE.md・README.md・.gitignore を
    カレントディレクトリ配下に生成します。

.PARAMETER ProjectName
    作成するプロジェクト名（ハイフン区切り推奨）

.PARAMETER Path
    作成先ディレクトリ（省略時はカレントディレクトリ）

.EXAMPLE
    .\create-ai-project.ps1 freee-api-test
    .\create-ai-project.ps1 patient-v2 -Path C:\hirayama-ai-workspace\claude-sandbox
#>

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$ProjectName,

    [Parameter(Position = 1)]
    [string]$Path = (Get-Location).Path
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# --- ヘルパー -----------------------------------------------------------
function Write-Step {
    param([string]$Icon, [string]$Message, [string]$Color = "Cyan")
    Write-Host "$Icon $Message" -ForegroundColor $Color
}

# --- 前処理 -------------------------------------------------------------
$projectRoot = Join-Path $Path $ProjectName

if (Test-Path $projectRoot) {
    Write-Host "ERROR: '$projectRoot' はすでに存在します。" -ForegroundColor Red
    exit 1
}

$createdAt = Get-Date -Format "yyyy-MM-dd"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

# --- ディレクトリ構造 ---------------------------------------------------
$dirs = @(
    "src",
    "scripts",
    "logs\run",
    "logs\error",
    "logs\notes",
    "artifacts",
    "docs"
)

Write-Step "🚀" "Creating project: $ProjectName"
Write-Step "📁" "Location: $projectRoot"
Write-Host ""

foreach ($dir in $dirs) {
    $fullPath = Join-Path $projectRoot $dir
    New-Item -ItemType Directory -Force -Path $fullPath | Out-Null
    Write-Host "  + $dir" -ForegroundColor DarkGray
}

# --- .gitkeep（空ディレクトリをgitで追跡するため）----------------------
@("logs\notes", "artifacts", "docs") | ForEach-Object {
    $keepFile = Join-Path $projectRoot "$_\.gitkeep"
    New-Item -ItemType File -Force -Path $keepFile | Out-Null
}

# --- .gitignore ---------------------------------------------------------
$gitignoreContent = @"
# ========================================
# $ProjectName — .gitignore
# ========================================

# 実行ログ・エラーログ（自動生成・git管理外）
logs/run/
logs/error/

# 成果物（自動生成・git管理外）
artifacts/

# logs/notes/ は git 管理対象のため除外しない

# Python
__pycache__/
*.py[cod]
venv/
.venv/
*.egg-info/
dist/
build/

# Node.js
node_modules/

# 認証情報（絶対にコミットしない）
.env
*.env
service_account.json
credentials.json
token.json
.clasp.json

# IDE
.vscode/
.idea/

# OS
.DS_Store
Thumbs.db
~$*
*.tmp
*.bak
"@

$gitignorePath = Join-Path $projectRoot ".gitignore"
Set-Content -Path $gitignorePath -Value $gitignoreContent -Encoding UTF8
Write-Host "  + .gitignore" -ForegroundColor DarkGray

# --- CLAUDE.md ----------------------------------------------------------
$claudeMdContent = @"
# CLAUDE.md — $ProjectName

作成日: $createdAt

---

## プロジェクト概要

<!-- ここにプロジェクトの目的・背景を記載 -->

---

## ディレクトリ構成

``````
$ProjectName/
├── src/            # ソースコード
├── scripts/        # 実行スクリプト（PS1 / sh）
├── logs/
│   ├── run/        # 実行ログ（gitignore 対象）
│   ├── error/      # エラーログ（gitignore 対象）
│   └── notes/      # 開発メモ（git 管理対象）
├── artifacts/      # 出力物・生成ファイル（gitignore 対象）
└── docs/           # ドキュメント
``````

---

## Claudeへの行動指針

- 仕様が不明な場合は実装せず、質問してから進める
- 認証情報（.env / service_account.json 等）は生成・コミットしない
- 不可逆操作（API POST / メール送信）の前に確認を挟む
- 実験コードは claude-sandbox/ で試作し、完成後に本プロジェクトへ移植する

---

## 技術スタック

| 技術 | 用途 |
|---|---|
| <!-- 技術名 --> | <!-- 用途 --> |

---

## 開発ステータス

| フェーズ | 内容 | ステータス |
|---|---|---|
| Phase 1 | <!-- 内容 --> | ⏸ 待機 |

---

## 参照ドキュメント

- [AI_DEV_ENV.md](../../docs/AI_DEV_ENV.md) — AI開発環境の運用ガイド
"@

$claudeMdPath = Join-Path $projectRoot "CLAUDE.md"
Set-Content -Path $claudeMdPath -Value $claudeMdContent -Encoding UTF8
Write-Host "  + CLAUDE.md" -ForegroundColor DarkGray

# --- README.md ----------------------------------------------------------
$readmeMdContent = @"
# $ProjectName

<!-- プロジェクト概要 -->

---

## セットアップ

``````bash
# Python プロジェクトの場合
python -m venv venv
source venv/Scripts/activate   # Windows (Git Bash)
pip install -r requirements.txt
``````

---

## 実行方法

``````powershell
# ログ付き実行
..\..\scripts\run-with-log.ps1 python src/main.py

# 開発メモ保存
..\..\scripts\note.ps1 "実装完了：〇〇機能"
``````

---

## ログ

| 種類 | 場所 | Git管理 |
|---|---|---|
| 実行ログ | \`logs/run/\` | 対象外 |
| エラーログ | \`logs/error/\` | 対象外 |
| 開発メモ | \`logs/notes/\` | 管理対象 ✅ |
| 成果物 | \`artifacts/\` | 対象外 |

---

作成: $timestamp
"@

$readmeMdPath = Join-Path $projectRoot "README.md"
Set-Content -Path $readmeMdPath -Value $readmeMdContent -Encoding UTF8
Write-Host "  + README.md" -ForegroundColor DarkGray

# --- 完了メッセージ -----------------------------------------------------
Write-Host ""
Write-Step "✅" "Project '$ProjectName' created successfully!" "Green"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. cd '$projectRoot'"
Write-Host "  2. CLAUDE.md を編集してプロジェクト概要を記載する"
Write-Host "  3. git init（または親リポジトリで git add する）"
Write-Host ""
