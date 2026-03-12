#Requires -Version 5.1
<#
.SYNOPSIS
    作業終了スクリプト。変更をコミットして push し、Run_Log 用の1行データを生成します。
#>

param(
    [Parameter(Position = 0)]
    [string]$Message = '',
    [switch]$NoPush,
    [switch]$AutoCleanupKnownTaskQueueRow,
    [string]$ProjectId = '',
    [ValidateSet('SUCCESS', 'STOP', 'ERROR', 'PARTIAL')]
    [string]$Result = 'SUCCESS',
    [string]$NextAction = '',
    [switch]$SkipRunLogExport,
    [switch]$SkipRunLogSheetWrite,
    [switch]$Yes
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$sd = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$gscPath = Join-Path $sd 'git-safe-commit.ps1'
$runLogExportPath = Join-Path $sd 'export-run-log-entry.ps1'
$runLogSheetWritePath = Join-Path $sd 'append-runlog-to-sheet.mjs'
$taskQueueCleanupPath = Join-Path $sd 'cleanup-known-taskqueue-row.mjs'

if (-not (Test-Path $gscPath)) {
    Write-Host "  [ERR] git-safe-commit.ps1 が見つかりません:" -ForegroundColor Red
    Write-Host "        $gscPath"
    exit 1
}

if (-not $SkipRunLogExport -and -not (Test-Path $runLogExportPath)) {
    Write-Host "  [WARN] export-run-log-entry.ps1 が見つかりません。Run_Log 出力はスキップします。" -ForegroundColor Yellow
    $SkipRunLogExport = $true
}

$canWriteRunLogSheet = $false
if (-not $SkipRunLogExport -and -not $SkipRunLogSheetWrite -and (Test-Path $runLogSheetWritePath)) {
    if ($env:AIOS_DASHBOARD_SPREADSHEET_ID -and $env:AIOS_SERVICE_ACCOUNT_PATH) {
        $canWriteRunLogSheet = $true
    }
}

function Write-Line { Write-Host ('=' * 62) }
function Write-Ok   { param([string]$msg) Write-Host "  [OK]   $msg" -ForegroundColor Green }
function Write-Warn { param([string]$msg) Write-Host "  [WARN] $msg" -ForegroundColor Yellow }
function Write-Err  { param([string]$msg) Write-Host "  [ERR]  $msg" -ForegroundColor Red }
function Get-LatestRunLogJsonPath {
    param([string]$LogRoot = 'logs')

    $runlogDir = Join-Path $LogRoot 'runlog'
    if (-not (Test-Path $runlogDir)) { return '' }

    $latest = Get-ChildItem -Path $runlogDir -Filter 'runlog_*.json' -File |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    if ($null -eq $latest) { return '' }
    return $latest.FullName
}

try { $null = git rev-parse --is-inside-work-tree 2>&1 } catch {}
if ($LASTEXITCODE -ne 0) {
    Write-Host ''
    Write-Err "このフォルダは Git で管理されていません: $(Get-Location)"
    exit 1
}

$branch = (git rev-parse --abbrev-ref HEAD 2>&1).Trim()

Write-Host ''
Write-Line
Write-Host "  dev-end  |  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "  Branch   |  $branch"
Write-Line

$taskQueueCleanupExit = 0
if ($AutoCleanupKnownTaskQueueRow) {
    Write-Host ''
    Write-Host '  known incomplete row cleanup (opt-in)...'

    if (-not (Test-Path $taskQueueCleanupPath)) {
        Write-Err "cleanup-known-taskqueue-row.mjs was not found: $taskQueueCleanupPath"
        exit 1
    }

    if (-not $env:AIOS_DASHBOARD_SPREADSHEET_ID -or -not $env:AIOS_SERVICE_ACCOUNT_PATH) {
        Write-Err 'AIOS_DASHBOARD_SPREADSHEET_ID / AIOS_SERVICE_ACCOUNT_PATH is required for known-row cleanup.'
        exit 1
    }

    try {
        & node $taskQueueCleanupPath --write
        $taskQueueCleanupExit = $LASTEXITCODE
    } catch {
        Write-Err $_.Exception.Message
        $taskQueueCleanupExit = 1
    }

    if ($taskQueueCleanupExit -ne 0) {
        Write-Err "known incomplete row cleanup failed (exit code: $taskQueueCleanupExit)"
        exit $taskQueueCleanupExit
    }
}

$statusRaw = @(git status --short 2>&1)
$dirty = @($statusRaw | Where-Object { $_ -and $_ -notmatch '^warning:' })

if ($dirty.Count -eq 0) {
    Write-Host ''
    Write-Ok '変更はありません。コミットするものがないです。'
    Write-Host ''
    exit 0
}

Write-Host ''
Write-Host '  変更ファイル一覧（コミット対象）:'
$dirty | ForEach-Object { Write-Host "    $_" }
Write-Host "  合計: $($dirty.Count) 件"
Write-Host ''

if (-not $Message.Trim()) {
    $readMessage = Read-Host '  メッセージ'
    $Message = if ($null -ne $readMessage) { $readMessage.Trim() } else { '' }
    if (-not $Message) {
        Write-Warn 'メッセージが空です。中断します。'
        Write-Host ''
        exit 1
    }
}

if (-not $NextAction.Trim() -and -not $Yes) {
    $readNext = Read-Host '  次の作業（任意・空可）'
    $NextAction = if ($null -ne $readNext) { $readNext.Trim() } else { '' }
}

Write-Host "  コミットメッセージ: $Message"
Write-Host "  push する　　　　: $(if ($NoPush) { 'いいえ（コミットのみ）' } else { 'はい（GitHub にアップロード）' })"
Write-Host "  Run_Log 出力　  : $(if ($SkipRunLogExport) { 'スキップ' } else { '生成する' })"
Write-Host "  Run_Log シート : $(if ($canWriteRunLogSheet) { '直接書き込む（Codex）' } elseif ($SkipRunLogSheetWrite) { 'スキップ' } else { '未設定（ローカル出力のみ）' })"
Write-Host ''

Write-Host '  変更をステージング中（git add -A）...'
cmd /c "git add -A >nul 2>nul"
if ($LASTEXITCODE -ne 0) {
    Write-Err 'git add に失敗しました。'
    exit 1
}

Write-Host '  コミット処理を開始します...'
Write-Host ''
Write-Line
Write-Host ''

$gscParams = @{
    Message = $Message
}
if (-not $NoPush) { $gscParams.Push = $true }
if ($Yes) { $gscParams.Yes = $true }

$exitCode = 0
try {
    & $gscPath @gscParams
    $exitCode = $LASTEXITCODE
} catch {
    Write-Err $_.Exception.Message
    $exitCode = 1
}

$runLogExit = 0
$runLogSheetExit = 0
$commitHash = ''
if ($exitCode -eq 0) {
    $commitHash = (git rev-parse --short HEAD 2>&1).Trim()
    if (-not $SkipRunLogExport) {
        try {
            & $runLogExportPath -Summary $Message -Result $Result -CommitHash $commitHash -NextAction $NextAction -ProjectId $ProjectId
            $runLogExit = $LASTEXITCODE
        } catch {
            Write-Warn $_.Exception.Message
            $runLogExit = 1
        }
    }

    if ($runLogExit -eq 0 -and $canWriteRunLogSheet) {
        $jsonPath = Get-LatestRunLogJsonPath
        if ($jsonPath) {
            try {
                & node $runLogSheetWritePath --json $jsonPath --write
                $runLogSheetExit = $LASTEXITCODE
            } catch {
                Write-Warn $_.Exception.Message
                $runLogSheetExit = 1
            }
        } else {
            Write-Warn 'Run_Log JSON が見つからないためシート書き込みをスキップしました。'
            $runLogSheetExit = 1
        }
    }
}

Write-Host ''
Write-Line
if ($exitCode -eq 0) {
    Write-Ok 'お疲れ様でした。作業終了処理が完了しました。'
    Write-Ok "Commit: $commitHash"
    if (-not $NoPush) {
        Write-Ok 'GitHub に push 済みです。'
        Write-Ok '別の PC でも ds（dev-start）を実行すれば最新コードが使えます。'
    } else {
        Write-Host '  [INFO] コミットのみ完了（push はまだです）'
    }
    if (-not $SkipRunLogExport) {
        if ($runLogExit -eq 0) { Write-Ok 'Run_Log 用 JSON / TSV を生成しました。' }
        else { Write-Warn "Run_Log 出力に失敗しました（終了コード: $runLogExit）" }
    }
    if ($canWriteRunLogSheet) {
        if ($runLogSheetExit -eq 0) { Write-Ok 'Run_Log シートへ直接追記しました。' }
        else { Write-Warn "Run_Log シート書き込みに失敗しました（終了コード: $runLogSheetExit）" }
    }
} else {
    Write-Err "コミットまたは push に失敗しました（終了コード: $exitCode）"
}
Write-Host ''
exit $exitCode

