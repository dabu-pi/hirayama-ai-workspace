#Requires -Version 5.1
<#
.SYNOPSIS
    Workspace handoff command: commit, push, Run_Log export, optional live sheet sync,
    and optional Google Drive export sync.
#>

param(
    [Parameter(Position = 0)]
    [string]$Message = '',
    [switch]$NoPush,
    [switch]$AutoCleanupKnownTaskQueueRow,
    [switch]$AutoCleanupFailAfterBackup,
    [string]$ProjectId = '',
    [ValidateSet('SUCCESS', 'STOP', 'ERROR', 'PARTIAL')]
    [string]$Result = 'SUCCESS',
    [string]$NextAction = '',
    [switch]$SkipRunLogExport,
    [switch]$SkipRunLogSheetWrite,
    [switch]$SkipDriveSync,
    [switch]$Yes
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$gscPath = Join-Path $scriptDir 'git-safe-commit.ps1'
$runLogExportPath = Join-Path $scriptDir 'export-run-log-entry.ps1'
$runLogSheetWritePath = Join-Path $scriptDir 'append-runlog-to-sheet.mjs'
$projectRunLogSyncPath = Join-Path $scriptDir 'sync-project-from-runlog.mjs'
$taskQueueCleanupPath = Join-Path $scriptDir 'cleanup-known-taskqueue-row.mjs'
$driveSyncPath = Join-Path $scriptDir 'sync-workspace-to-drive.ps1'
$gitBaseArgs = @('-c', 'core.excludesfile=')

function Write-Line { Write-Host ('=' * 62) }
function Write-Ok   { param([string]$Message) Write-Host "  [OK]   $Message" -ForegroundColor Green }
function Write-Warn { param([string]$Message) Write-Host "  [WARN] $Message" -ForegroundColor Yellow }
function Write-Err  { param([string]$Message) Write-Host "  [ERR]  $Message" -ForegroundColor Red }

function Get-LatestRunLogJsonPath {
    param([string]$LogRoot = 'logs')

    $runlogDir = Join-Path $LogRoot 'runlog'
    if (-not (Test-Path -LiteralPath $runlogDir)) {
        return ''
    }

    $latest = Get-ChildItem -LiteralPath $runlogDir -Filter 'runlog_*.json' -File |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1

    if ($null -eq $latest) {
        return ''
    }

    return $latest.FullName
}

function Invoke-GitLines {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    $output = & git @gitBaseArgs @Arguments 2>&1
    return @($output | Where-Object { $_ -and $_ -notmatch '^warning:' })
}

if (-not (Test-Path -LiteralPath $gscPath)) {
    Write-Err "git-safe-commit.ps1 was not found: $gscPath"
    exit 1
}

if (-not $SkipRunLogExport -and -not (Test-Path -LiteralPath $runLogExportPath)) {
    Write-Warn "export-run-log-entry.ps1 was not found: $runLogExportPath"
    $SkipRunLogExport = $true
}

$canWriteRunLogSheet = $false
if (-not $SkipRunLogExport -and -not $SkipRunLogSheetWrite -and (Test-Path -LiteralPath $runLogSheetWritePath)) {
    if ($env:AIOS_DASHBOARD_SPREADSHEET_ID -and $env:AIOS_SERVICE_ACCOUNT_PATH) {
        $canWriteRunLogSheet = $true
    }
}

try { $null = Invoke-GitLines -Arguments @('rev-parse', '--is-inside-work-tree') } catch {}
if ($LASTEXITCODE -ne 0) {
    Write-Err "Current directory is not a git repository: $(Get-Location)"
    exit 1
}

$branch = ((Invoke-GitLines -Arguments @('rev-parse', '--abbrev-ref', 'HEAD')) -join "`n").Trim()

Write-Host ''
Write-Line
Write-Host "  dev-end  |  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "  Branch   |  $branch"
Write-Line

$taskQueueCleanupExit = 0
if ($AutoCleanupKnownTaskQueueRow) {
    Write-Host ''
    Write-Host '  known incomplete row cleanup (opt-in)...'

    if (-not (Test-Path -LiteralPath $taskQueueCleanupPath)) {
        Write-Err "cleanup-known-taskqueue-row.mjs was not found: $taskQueueCleanupPath"
        exit 1
    }

    if (-not $env:AIOS_DASHBOARD_SPREADSHEET_ID -or -not $env:AIOS_SERVICE_ACCOUNT_PATH) {
        Write-Err 'AIOS_DASHBOARD_SPREADSHEET_ID and AIOS_SERVICE_ACCOUNT_PATH are required for known-row cleanup.'
        exit 1
    }

    try {
        $cleanupArgs = @('--write')
        if ($AutoCleanupFailAfterBackup) {
            $cleanupArgs += '--fail-after-backup'
        }

        & node $taskQueueCleanupPath @cleanupArgs
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

$statusRaw = Invoke-GitLines -Arguments @('status', '--short')
$dirty = @($statusRaw | Where-Object { $_ })

if ($dirty.Count -eq 0) {
    Write-Ok 'No changes to commit.'
    Write-Host ''
    exit 0
}

Write-Host ''
Write-Host '  Files to be committed:'
$dirty | ForEach-Object { Write-Host "    $_" }
Write-Host "  Total: $($dirty.Count)"
Write-Host ''

if (-not $Message.Trim()) {
    $readMessage = Read-Host '  Commit message'
    $Message = if ($null -ne $readMessage) { $readMessage.Trim() } else { '' }
    if (-not $Message) {
        Write-Warn 'Commit message is empty. Aborting.'
        exit 1
    }
}

if (-not $NextAction.Trim() -and -not $Yes) {
    $readNext = Read-Host '  Next action (optional)'
    $NextAction = if ($null -ne $readNext) { $readNext.Trim() } else { '' }
}

Write-Host "  Commit message : $Message"
Write-Host "  Push to GitHub : $(if ($NoPush) { 'no (commit only)' } else { 'yes' })"
Write-Host "  Run_Log export : $(if ($SkipRunLogExport) { 'skip' } else { 'enabled' })"
Write-Host "  Run_Log sheet  : $(if ($canWriteRunLogSheet) { 'enabled' } elseif ($SkipRunLogSheetWrite) { 'skip' } else { 'not configured' })"
Write-Host "  Drive sync     : $(if ($SkipDriveSync) { 'skip' } else { 'enabled after push' })"
Write-Host ''

Write-Host '  Staging changes (git add -A)...'
& git @gitBaseArgs add -A
if ($LASTEXITCODE -ne 0) {
    Write-Err 'git add failed.'
    exit 1
}

Write-Host '  Starting commit flow...'
Write-Host ''
Write-Line
Write-Host ''

$gscParams = @{ Message = $Message }
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
$projectRunLogSyncExit = 0
$driveSyncExit = 0
$driveSyncAttempted = $false
$commitHash = ''
$jsonPath = ''

if ($exitCode -eq 0) {
    $commitHash = ((Invoke-GitLines -Arguments @('rev-parse', '--short', 'HEAD')) -join "`n").Trim()

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
            Write-Warn 'Run_Log JSON was not found, so live sheet append was skipped.'
            $runLogSheetExit = 1
        }
    }

    if ($runLogSheetExit -eq 0 -and $Result -eq 'SUCCESS' -and $ProjectId -and $jsonPath -and (Test-Path -LiteralPath $projectRunLogSyncPath)) {
        try {
            & node $projectRunLogSyncPath --json $jsonPath --project-id $ProjectId --expected-commit $commitHash --write
            $projectRunLogSyncExit = $LASTEXITCODE
        } catch {
            Write-Warn $_.Exception.Message
            $projectRunLogSyncExit = 1
        }
    }

    if (-not $NoPush -and -not $SkipDriveSync) {
        if (Test-Path -LiteralPath $driveSyncPath) {
            $driveSyncAttempted = $true
            try {
                & $driveSyncPath
                $driveSyncExit = $LASTEXITCODE
            } catch {
                Write-Warn $_.Exception.Message
                $driveSyncExit = 1
            }
        } else {
            Write-Warn "sync-workspace-to-drive.ps1 was not found: $driveSyncPath"
        }
    }
}

Write-Host ''
Write-Line
if ($exitCode -eq 0) {
    Write-Ok 'Handoff flow completed.'
    Write-Ok "Commit: $commitHash"
    if (-not $NoPush) {
        Write-Ok 'Push completed.'
    } else {
        Write-Host '  [INFO] Commit only.'
    }

    if (-not $SkipRunLogExport) {
        if ($runLogExit -eq 0) {
            Write-Ok 'Run_Log JSON/TSV generated.'
        } else {
            Write-Warn "Run_Log export failed (exit code: $runLogExit)"
        }
    }

    if ($canWriteRunLogSheet) {
        if ($runLogSheetExit -eq 0) {
            Write-Ok 'Run_Log live sheet append completed.'
        } else {
            Write-Warn "Run_Log live sheet append failed (exit code: $runLogSheetExit)"
        }
    }

    if ($projectRunLogSyncExit -ne 0 -and $runLogSheetExit -eq 0 -and $ProjectId) {
        Write-Warn "Projects sync failed (exit code: $projectRunLogSyncExit)"
    } elseif ($projectRunLogSyncExit -eq 0 -and $ProjectId) {
        Write-Ok 'Projects minimal sync completed.'
    }

    if ($driveSyncAttempted) {
        if ($driveSyncExit -eq 0) {
            Write-Ok 'Google Drive export sync completed.'
        } else {
            Write-Warn "Google Drive export sync failed (exit code: $driveSyncExit)"
        }
    } elseif ($SkipDriveSync) {
        Write-Host '  [INFO] Drive sync skipped.'
    }
} else {
    Write-Err "Commit or push failed (exit code: $exitCode)"
}
Write-Host ''

exit $exitCode
