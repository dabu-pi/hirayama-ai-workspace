#Requires -Version 5.1
<#
.SYNOPSIS
    作業開始スクリプト。git pull で最新コードを取得し、状態を表示します。

.DESCRIPTION
    1. 現在のフォルダとブランチを確認します
    2. 未コミットの変更がある場合は警告します
    3. git pull を実行して最新コードを取得します
    4. 結果を分かりやすく表示します

.PARAMETER Force
    未コミット変更の確認をスキップして pull を実行します。

.EXAMPLE
    .\dev-start.ps1
    .\dev-start.ps1 -Force
    ds                        # エイリアス設定後
#>

param(
    [switch]$Force
)

Set-StrictMode -Version Latest

# ─── ヘルパー ──────────────────────────────────────────────────
function Write-Line { Write-Host ("=" * 62) }
function Write-Row  { param([string]$L, [string]$V) Write-Host ("  {0,-12}: {1}" -f $L, $V) }
function Write-Ok   { param([string]$msg) Write-Host "  [OK]   $msg" -ForegroundColor Green }
function Write-Warn { param([string]$msg) Write-Host "  [WARN] $msg" -ForegroundColor Yellow }
function Write-Err  { param([string]$msg) Write-Host "  [ERR]  $msg" -ForegroundColor Red }
function Write-Info { param([string]$msg) Write-Host "  [INFO] $msg" }

# ─── ヘッダー ──────────────────────────────────────────────────
Write-Host ""
Write-Line
Write-Host "  dev-start  |  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Line

# ─── 現在位置の確認 ─────────────────────────────────────────
$currentDir = (Get-Location).Path
Write-Row "現在地" $currentDir

# ─── Git リポジトリ確認 ──────────────────────────────────────
$isGit = $false
try {
    $null = git rev-parse --is-inside-work-tree 2>&1
    $isGit = ($LASTEXITCODE -eq 0)
} catch {}

if (-not $isGit) {
    Write-Host ""
    Write-Err "このフォルダは Git で管理されていません。"
    Write-Host ""
    Write-Host "  workspace フォルダに移動する場合:"
    Write-Host "    cd C:\hirayama-ai-workspace\workspace"
    Write-Host ""
    exit 1
}

# ─── ブランチ・リモート確認 ──────────────────────────────────
$branch = (git rev-parse --abbrev-ref HEAD 2>&1).Trim()
$remote = (git remote 2>&1 | Select-Object -First 1).Trim()
if (-not $remote) { $remote = "origin" }

Write-Row "ブランチ" $branch
Write-Row "リモート" $remote

# ─── ahead / behind の確認（fetch は行わず現在の情報で判定）
$ahead  = (git rev-list --count "@{u}..HEAD" 2>&1).Trim()
$behind = (git rev-list --count "HEAD..@{u}" 2>&1).Trim()
if ($LASTEXITCODE -eq 0 -and $ahead -match '^\d+$' -and $behind -match '^\d+$') {
    $aheadN  = [int]$ahead
    $behindN = [int]$behind
    if ($aheadN -gt 0) {
        Write-Warn "まだ push されていないコミットが ${aheadN} 件あります"
    }
    if ($behindN -gt 0) {
        Write-Info "リモートより ${behindN} コミット遅れています（pull で取得します）"
    }
    if ($aheadN -eq 0 -and $behindN -eq 0) {
        Write-Ok  "リモートと同期済みです（pull 前の確認）"
    }
}

# ─── 未コミット変更のチェック ────────────────────────────────
Write-Host ""
$dirty = @(git status --short 2>&1 | Where-Object { $_ -ne "" })

if ($dirty.Count -gt 0) {
    Write-Warn "未コミットの変更が $($dirty.Count) 件あります:"
    $dirty | Select-Object -First 10 | ForEach-Object { Write-Host "    $_" }
    if ($dirty.Count -gt 10) {
        Write-Host "    ... 他 $($dirty.Count - 10) 件"
    }
    Write-Host ""
    Write-Host "  ★ pull で競合が起きる場合があります。"
    Write-Host "    先にコミットしたい場合は Ctrl+C で中断し、"
    Write-Host "    de コマンド（dev-end）でコミットしてから ds を再実行してください。"
    Write-Host ""

    if (-not $Force) {
        $ans = Read-Host "  このまま pull しますか？ [y/N]"
        if ($ans -notmatch '^[yY]') {
            Write-Host ""
            Write-Host "  中断しました。de コマンドでコミット後、ds を再実行してください。"
            Write-Host ""
            exit 0
        }
    }
} else {
    Write-Ok "未コミットの変更はありません（クリーン）"
}

# ─── git pull 実行 ──────────────────────────────────────────
Write-Host ""
Write-Host "  git pull を実行中..."
Write-Host ""

$pullOutput = git pull $remote $branch 2>&1
$pullExit   = $LASTEXITCODE
$pullOutput | ForEach-Object { Write-Host "  $_" }
Write-Host ""

if ($pullExit -eq 0) {
    $isUpToDate = $pullOutput | Where-Object { $_ -match 'Already up.to.date|Already up to date' }
    if ($isUpToDate) {
        Write-Ok "すでに最新です（変更なし）"
    } else {
        Write-Ok "pull 完了！最新コードを取得しました"
    }
} else {
    Write-Err "pull に失敗しました（終了コード: $pullExit）"
    Write-Host ""
    Write-Host "  よくある原因と対処法:"
    Write-Host "    ・未コミット変更が競合している → de でコミット後に再実行"
    Write-Host "    ・ネットワークに繋がっていない → インターネット接続を確認"
    Write-Host "    ・リモートブランチがない       → git branch -a で確認"
    Write-Host ""
    exit 1
}

# ─── 最近のコミット表示 ─────────────────────────────────────
Write-Host ""
Write-Host "  最近のコミット（直近 3 件）:"
git log --oneline -3 2>&1 | ForEach-Object { Write-Host "    $_" }

# ─── フッター ───────────────────────────────────────────────
Write-Host ""
Write-Line
Write-Host "  準備完了！作業を始めてください。"
Write-Host "  終了時は:  de ""コミットメッセージ"""
Write-Line
Write-Host ""

exit 0
