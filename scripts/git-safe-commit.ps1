#Requires -Version 5.1
<#
.SYNOPSIS
    安全確認付き git コミット & push スクリプト。
    秘密情報ファイルの誤コミットを自動検出してブロックします。

.DESCRIPTION
    コミット前に以下のチェックを実施します:
    - 禁止ファイル（.env / token.json / service_account.json 等）が含まれていないか
    - logs/run/ や logs/error/ の実行ログが含まれていないか
    - git add . の痕跡（大量ファイルの一括ステージング）を警告

    制約:
    - git push --force は使用しません
    - git reset --hard は使用しません
    - Co-Authored-By を自動付与します

.PARAMETER Message
    コミットメッセージ（必須）。例: "feat: freee 見積書POST実装"

.PARAMETER Files
    コミットするファイルのリスト。省略時は既にステージされているファイルを使用。
    例: @("src/main.py", "tests/test_main.py")

.PARAMETER Push
    コミット後に git push を実行するかどうか。

.PARAMETER Remote
    push 先のリモート名（省略時: origin）。

.EXAMPLE
    # ファイル指定 + push
    .\git-safe-commit.ps1 -Message "feat: 見積書POST実装" -Files @("src/main.py") -Push

    # ステージ済みファイルのみコミット（-Files 省略）
    .\git-safe-commit.ps1 -Message "docs: README 更新" -Push

    # push なしコミット
    .\git-safe-commit.ps1 -Message "chore: .gitignore 更新" -Files @(".gitignore")
#>

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Message,

    [Parameter(Position = 1)]
    [string[]]$Files = @(),

    [switch]$Push,

    [string]$Remote = "origin"
)

Set-StrictMode -Version Latest

# --- 定数定義 -------------------------------------------------------------------

# コミット禁止ファイルパターン（部分マッチ）
$FORBIDDEN_PATTERNS = @(
    '\.env$',
    '\.env\.',
    'token\.json',
    'token_.*\.json',
    'service_account\.json',
    'credentials\.json',
    'client_secret.*\.json',
    '\.pem$',
    '\.p12$',
    '\.pfx$',
    'id_rsa',
    'id_ed25519'
)

# ログディレクトリパターン（含まれていたら警告）
$LOG_DIR_PATTERNS = @(
    'logs[/\\]run[/\\]',
    'logs[/\\]error[/\\]',
    'artifacts[/\\]'
)

$CO_AUTHOR = "Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

# --- ヘルパー関数 ---------------------------------------------------------------

function Write-Header {
    param([string]$Title)
    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor Cyan
    Write-Host "  $Title" -ForegroundColor Cyan
    Write-Host ("=" * 60) -ForegroundColor Cyan
}

function Write-Check {
    param([string]$Label, [bool]$Pass, [string]$Detail = "")
    if ($Pass) {
        Write-Host "  [PASS] $Label" -ForegroundColor Green
    } else {
        Write-Host "  [FAIL] $Label" -ForegroundColor Red
        if ($Detail) {
            Write-Host "         $Detail" -ForegroundColor Yellow
        }
    }
}

# --- git が利用可能か確認 -------------------------------------------------------
try {
    $null = git --version 2>&1
} catch {
    Write-Error "git が見つかりません。git をインストールしてパスを通してください。"
    exit 1
}

# --- git リポジトリ確認 ---------------------------------------------------------
$gitRoot = git rev-parse --show-toplevel 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "git リポジトリではありません: $(Get-Location)"
    exit 1
}

# --- ファイルのステージング（-Files 指定時）--------------------------------------
Write-Header "git-safe-commit : 安全コミット"

if ($Files.Count -gt 0) {
    Write-Host ""
    Write-Host "  ステージング:" -ForegroundColor White
    foreach ($f in $Files) {
        if (Test-Path $f) {
            git add $f
            Write-Host "    git add $f" -ForegroundColor DarkGray
        } else {
            Write-Host "  [WARN] ファイルが存在しません: $f" -ForegroundColor Yellow
        }
    }
}

# --- ステージされているファイルを取得 -------------------------------------------
$stagedFiles = @(git diff --cached --name-only 2>&1)

if ($stagedFiles.Count -eq 0) {
    Write-Host ""
    Write-Host "  ステージされているファイルがありません。" -ForegroundColor Yellow
    Write-Host "  git add <files> を実行するか -Files オプションでファイルを指定してください。" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "  コミット対象ファイル ($($stagedFiles.Count) 件):" -ForegroundColor White
foreach ($f in $stagedFiles) {
    Write-Host "    - $f" -ForegroundColor DarkGray
}

# --- セキュリティチェック -------------------------------------------------------
Write-Host ""
Write-Host "  セキュリティチェック:" -ForegroundColor White

$checkPassed = $true

# 禁止ファイルチェック
$forbiddenFound = @()
foreach ($f in $stagedFiles) {
    foreach ($pattern in $FORBIDDEN_PATTERNS) {
        if ($f -match $pattern) {
            $forbiddenFound += $f
            break
        }
    }
}

if ($forbiddenFound.Count -gt 0) {
    $checkPassed = $false
    Write-Check "禁止ファイルなし" $false "以下のファイルはコミット禁止です:"
    foreach ($f in $forbiddenFound) {
        Write-Host "         ⛔ $f" -ForegroundColor Red
    }
    Write-Host "         → git restore --staged <file> でアンステージしてください" -ForegroundColor Yellow
} else {
    Write-Check "禁止ファイルなし" $true
}

# ログディレクトリチェック
$logFilesFound = @()
foreach ($f in $stagedFiles) {
    foreach ($pattern in $LOG_DIR_PATTERNS) {
        if ($f -match $pattern) {
            $logFilesFound += $f
            break
        }
    }
}

if ($logFilesFound.Count -gt 0) {
    $checkPassed = $false
    Write-Check "ログファイルなし" $false "以下のファイルは gitignore 対象です:"
    foreach ($f in $logFilesFound) {
        Write-Host "         ⚠ $f" -ForegroundColor Yellow
    }
    Write-Host "         → .gitignore を確認し git restore --staged <file> でアンステージしてください" -ForegroundColor Yellow
} else {
    Write-Check "ログファイルなし" $true
}

# 大量ファイル警告（30件超）
if ($stagedFiles.Count -gt 30) {
    Write-Host "  [WARN] ステージされているファイルが $($stagedFiles.Count) 件あります。" -ForegroundColor Yellow
    Write-Host "         git add . を使った可能性があります。意図通りか確認してください。" -ForegroundColor Yellow
}

# コミットメッセージ形式確認（prefix: で始まるか）
$validPrefixes = @('feat', 'fix', 'docs', 'refactor', 'test', 'chore', 'hotfix', 'style', 'perf', 'ci')
$hasValidPrefix = $false
foreach ($prefix in $validPrefixes) {
    if ($Message -match "^${prefix}[:\(]") {
        $hasValidPrefix = $true
        break
    }
}
if (-not $hasValidPrefix) {
    Write-Host "  [WARN] コミットメッセージの推奨プレフィックスが見つかりません。" -ForegroundColor Yellow
    Write-Host "         推奨: feat / fix / docs / refactor / test / chore / hotfix" -ForegroundColor DarkGray
}

# --- チェック失敗時は中断 -------------------------------------------------------
if (-not $checkPassed) {
    Write-Host ""
    Write-Host ("=" * 60) -ForegroundColor Red
    Write-Host "  ABORT: セキュリティチェックに失敗しました。コミットを中止します。" -ForegroundColor Red
    Write-Host ("=" * 60) -ForegroundColor Red
    Write-Host ""
    exit 1
}

# --- コミット -------------------------------------------------------------------
Write-Host ""
Write-Host "  コミット実行:" -ForegroundColor White

$fullMessage = "${Message}`n`n${CO_AUTHOR}"

git commit -m $fullMessage

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "  [ERROR] git commit に失敗しました (exit $LASTEXITCODE)" -ForegroundColor Red
    exit 1
}

# コミットハッシュを取得
$commitHash = git rev-parse --short HEAD 2>&1
Write-Host ""
Write-Host "  COMMIT: $commitHash — $Message" -ForegroundColor Green

# --- Push（オプション）----------------------------------------------------------
if ($Push) {
    Write-Host ""
    Write-Host "  push 実行:" -ForegroundColor White

    # 現在のブランチを取得
    $currentBranch = git rev-parse --abbrev-ref HEAD 2>&1

    git push $Remote $currentBranch

    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "  [ERROR] git push に失敗しました (exit $LASTEXITCODE)" -ForegroundColor Red
        Write-Host "  TIP: git pull $Remote $currentBranch で最新を取得してから再実行してください" -ForegroundColor Yellow
        exit 1
    }

    Write-Host "  PUSH  : $Remote/$currentBranch へ push 完了" -ForegroundColor Green
}

Write-Host ""
Write-Host ("=" * 60) -ForegroundColor Green
Write-Host "  完了: コミット$(if ($Push) { '& push' } else { '' }) が成功しました" -ForegroundColor Green
Write-Host ("=" * 60) -ForegroundColor Green
Write-Host ""

exit 0
