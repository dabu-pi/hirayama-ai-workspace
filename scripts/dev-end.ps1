#Requires -Version 5.1
<#
.SYNOPSIS
    作業終了スクリプト。変更をコミットして push します。

.DESCRIPTION
    1. git status で変更ファイルの一覧を表示します
    2. コミットメッセージを入力（または引数で指定）します
    3. すべての変更をステージングします（git add -A）
    4. git-safe-commit.ps1 でコミット + push します
       （.env などの危険ファイルは git-safe-commit が自動で検知・拒否します）

.PARAMETER Message
    コミットメッセージ（省略すると入力画面が出ます）

.PARAMETER NoPush
    push せずコミットだけ行います（別のPCでまだ続けたいときなど）

.EXAMPLE
    .\dev-end.ps1 "freee Phase3 実装完了"
    .\dev-end.ps1 -NoPush "作業中断・続きは明日"
    de "今日の作業まとめ"    # エイリアス設定後
    de                       # メッセージ省略→入力画面が出る
#>

param(
    [Parameter(Position = 0)]
    [string]$Message = "",

    [switch]$NoPush
)

Set-StrictMode -Version Latest

# ─── git-safe-commit.ps1 のパスを解決 ───────────────────────
$sd = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$gscPath = Join-Path $sd "git-safe-commit.ps1"

if (-not (Test-Path $gscPath)) {
    Write-Host "  [ERR] git-safe-commit.ps1 が見つかりません:" -ForegroundColor Red
    Write-Host "        $gscPath"
    Write-Host "  scripts/ フォルダに git-safe-commit.ps1 が必要です。"
    exit 1
}

# ─── ヘルパー ──────────────────────────────────────────────────
function Write-Line { Write-Host ("=" * 62) }
function Write-Ok   { param([string]$msg) Write-Host "  [OK]   $msg" -ForegroundColor Green }
function Write-Warn { param([string]$msg) Write-Host "  [WARN] $msg" -ForegroundColor Yellow }
function Write-Err  { param([string]$msg) Write-Host "  [ERR]  $msg" -ForegroundColor Red }

# ─── Git リポジトリ確認 ──────────────────────────────────────
try { $null = git rev-parse --is-inside-work-tree 2>&1 } catch {}
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Err "このフォルダは Git で管理されていません: $(Get-Location)"
    Write-Host "  workspace フォルダで実行してください:"
    Write-Host "    cd C:\hirayama-ai-workspace\workspace"
    Write-Host ""
    exit 1
}

# ─── ヘッダー ──────────────────────────────────────────────────
$branch = (git rev-parse --abbrev-ref HEAD 2>&1).Trim()

Write-Host ""
Write-Line
Write-Host "  dev-end  |  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "  Branch   |  $branch"
Write-Line

# ─── 変更ファイルの確認 ──────────────────────────────────────
$dirty = @(git status --short 2>&1 | Where-Object { $_ -ne "" })

if ($dirty.Count -eq 0) {
    Write-Host ""
    Write-Ok "変更はありません。コミットするものがないです。"
    Write-Host ""
    exit 0
}

Write-Host ""
Write-Host "  変更ファイル一覧（コミット対象）:"
$dirty | ForEach-Object { Write-Host "    $_" }
Write-Host "  合計: $($dirty.Count) 件"

# ─── コミットメッセージの入力 ────────────────────────────────
Write-Host ""
if (-not $Message.Trim()) {
    Write-Host "  コミットメッセージを入力してください。"
    Write-Host "  （例）"
    Write-Host "    feat: 新しい機能を追加したとき"
    Write-Host "    fix:  バグを直したとき"
    Write-Host "    docs: メモや説明文を更新したとき"
    Write-Host "    chore: 設定ファイルや雑多な変更"
    Write-Host ""
    $Message = (Read-Host "  メッセージ").Trim()

    if (-not $Message) {
        Write-Warn "メッセージが空です。中断します。"
        Write-Host ""
        exit 1
    }
}

# ─── 内容の確認 ──────────────────────────────────────────────
Write-Host ""
Write-Host "  コミットメッセージ: $Message"
Write-Host "  push する　　　　: $(if ($NoPush) { 'いいえ（コミットのみ）' } else { 'はい（GitHub にアップロード）' })"
Write-Host ""

# ─── すべての変更をステージング ─────────────────────────────
#   ※ .env などの危険ファイルは次の git-safe-commit が自動で検知・拒否します
Write-Host "  変更をステージング中（git add -A）..."
git add -A 2>&1 | Out-Null

if ($LASTEXITCODE -ne 0) {
    Write-Err "git add に失敗しました。"
    exit 1
}

# ─── git-safe-commit.ps1 を呼び出す ─────────────────────────
Write-Host "  コミット処理を開始します..."
Write-Host ""
Write-Line
Write-Host ""

$gscArgs = @("-Message", $Message)
if (-not $NoPush) {
    $gscArgs += "-Push"
}

& $gscPath @gscArgs
$exitCode = $LASTEXITCODE

# ─── 結果表示 ────────────────────────────────────────────────
Write-Host ""
Write-Line

if ($exitCode -eq 0) {
    Write-Ok "お疲れ様でした！作業終了処理が完了しました。"
    if (-not $NoPush) {
        Write-Ok "GitHub に push 済みです。"
        Write-Ok "別の PC でも ds（dev-start）を実行すれば最新コードが使えます。"
    } else {
        Write-Host "  [INFO] コミットのみ完了（push はまだです）"
        Write-Host "         push するときは: git push"
    }
} else {
    Write-Err "コミットまたは push に失敗しました（終了コード: $exitCode）"
    Write-Host ""
    Write-Host "  よくある原因:"
    Write-Host "    ・.env などの危険ファイルが含まれている → git restore --staged <ファイル名>"
    Write-Host "    ・ネットワークエラー（push 失敗）       → インターネット接続を確認"
    Write-Host "    ・リモートとの競合                     → ds（dev-start）で pull 後に再実行"
}

Write-Host ""
exit $exitCode
