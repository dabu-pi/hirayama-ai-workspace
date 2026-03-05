#Requires -Version 5.1
<#
.SYNOPSIS
    Phase2 commander: runs a command via run-with-log.ps1 and optionally auto-saves a note.

.PARAMETER Cmd
    Command string to run. Example: "python -m pytest tests/ -v"

.PARAMETER AutoNote
    Note message to save. Omit to skip note. Success saves with -Tag, failure saves as "bug".

.PARAMETER Tag
    Note tag on success (default: done). On failure always uses "bug".

.PARAMETER LogDir
    Log root directory (default: ./logs).

.EXAMPLE
    .\auto-dev-run.ps1 -Cmd "python -m pytest tests/ -v"
    .\auto-dev-run.ps1 -Cmd "python main.py" -AutoNote "main process" -Tag done
    .\auto-dev-run.ps1 -Cmd "python -m pytest" -AutoNote "tests" -Tag test -LogDir "logs"
#>

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Cmd,

    [Parameter(Position = 1)]
    [string]$AutoNote = "",

    [string]$Tag = "done",

    [string]$LogDir = "logs"
)

Set-StrictMode -Version Latest

# --- Resolve script directory ---
$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else {
    Split-Path -Parent $MyInvocation.MyCommand.Path
}

$rwlScript  = Join-Path $scriptDir "run-with-log.ps1"
$noteScript = Join-Path $scriptDir "note.ps1"

if (-not (Test-Path $rwlScript)) {
    Write-Error "run-with-log.ps1 not found: $rwlScript"
    exit 1
}

# --- Split command into executable + arguments ---
$parts      = $Cmd.Trim() -split '\s+', 2
$executable = $parts[0]
$argsStr    = if ($parts.Length -gt 1) { $parts[1] } else { "" }
$argsArray  = if ($argsStr) { $argsStr -split '\s+' } else { @() }

# --- Snapshot existing run logs (to detect newly created log) ---
$runLogDir     = Join-Path $LogDir "run"
$errorLogDir   = Join-Path $LogDir "error"
$beforeRunLogs = @()

if (Test-Path $runLogDir) {
    $beforeRunLogs = @(
        Get-ChildItem $runLogDir -Filter "run_*.log" -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty FullName
    )
}

# --- Header ---
Write-Host ""
Write-Host ("=" * 62)
Write-Host "  auto-dev-run : Phase2 cycle execution"
Write-Host ("=" * 62)
Write-Host "  Command : $Cmd"
Write-Host "  LogDir  : $LogDir"
Write-Host ("=" * 62)
Write-Host ""

# --- Execute via rwl ---
$exitCode = 0

try {
    if ($argsArray.Count -gt 0) {
        & $rwlScript $executable @argsArray -LogDir $LogDir
    } else {
        & $rwlScript $executable -LogDir $LogDir
    }
    $exitCode = if ($null -ne $LASTEXITCODE) { $LASTEXITCODE } else { 0 }
} catch {
    Write-Host ""
    Write-Host "  [ERROR] Failed to invoke rwl: $_"
    $exitCode = 1
}

# --- Find generated log files ---
$latestRunLog   = $null
$latestErrorLog = $null

if (Test-Path $runLogDir) {
    $newLogs = @(
        Get-ChildItem $runLogDir -Filter "run_*.log" -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notin $beforeRunLogs } |
        Sort-Object LastWriteTime -Descending
    )
    $latestRunLog = if ($newLogs.Count -gt 0) { $newLogs[0] } else {
        Get-ChildItem $runLogDir -Filter "run_*.log" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending |
        Select-Object -First 1
    }
}

if (Test-Path $errorLogDir) {
    $latestErrorLog = Get-ChildItem $errorLogDir -Filter "error_*.log" -ErrorAction SilentlyContinue |
                     Sort-Object LastWriteTime -Descending |
                     Select-Object -First 1
}

# --- Result summary ---
Write-Host ""
Write-Host ("=" * 62)
Write-Host "  RESULT"
Write-Host ("=" * 62)

if ($exitCode -eq 0) {
    Write-Host "  STATUS  : [OK] SUCCESS (exit 0)"
} else {
    Write-Host "  STATUS  : [FAIL] FAILED (exit $exitCode)"
}

if ($latestRunLog) {
    Write-Host "  RUN LOG : $($latestRunLog.FullName)"
} else {
    Write-Host "  RUN LOG : (not generated)"
}

if ($exitCode -ne 0 -and $latestErrorLog) {
    Write-Host "  ERR LOG : $($latestErrorLog.FullName)"
    Write-Host "  TIP     : run analyze-error.ps1 to inspect the error"
}

Write-Host ("=" * 62)
Write-Host ""

# --- AutoNote ---
if ($AutoNote -and (Test-Path $noteScript)) {
    $noteTag = if ($exitCode -eq 0) { $Tag } else { "bug" }

    $noteMessage = if ($exitCode -eq 0) {
        "${AutoNote} -- OK (exit 0)"
    } else {
        $errLogName = if ($latestErrorLog) { " / errlog: $($latestErrorLog.Name)" } else { "" }
        "${AutoNote} -- FAILED (exit ${exitCode})${errLogName}"
    }

    & $noteScript $noteMessage -Tag $noteTag -LogDir $LogDir
}

exit $exitCode
