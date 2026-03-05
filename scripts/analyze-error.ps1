#Requires -Version 5.1
<#
.SYNOPSIS
    Reads the latest error log, formats it for human/AI review,
    and saves a ready-to-paste debug report to artifacts/.

.PARAMETER LogDir
    Log root directory (default: ./logs).

.PARAMETER Lines
    Tail lines to show (default: 50).

.PARAMETER All
    Show all lines (overrides -Lines).

.PARAMETER ListAll
    List recent error logs instead of analyzing the latest.

.EXAMPLE
    .\analyze-error.ps1
    .\analyze-error.ps1 -Lines 100
    .\analyze-error.ps1 -All
    .\analyze-error.ps1 -ListAll
#>

param(
    [string]$LogDir  = "logs",
    [int]   $Lines   = 50,
    [switch]$All,
    [switch]$ListAll
)

Set-StrictMode -Version Latest

# -------------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------------
function Format-Bytes {
    param([long]$B)
    if ($B -ge 1MB) { return "{0:N1} MB" -f ($B / 1MB) }
    if ($B -ge 1KB) { return "{0:N1} KB" -f ($B / 1KB) }
    return "$B B"
}

function Write-Sep { param([string]$C = "White"); Write-Host ("=" * 64) }

# -------------------------------------------------------------------------
# Check error log directory
# -------------------------------------------------------------------------
$errorLogDir = Join-Path $LogDir "error"

if (-not (Test-Path $errorLogDir)) {
    Write-Host ""
    Write-Host "  No error log directory found: $errorLogDir"
    Write-Host "  errors/run/ are created automatically when a command fails via rwl."
    Write-Host ""
    exit 0
}

$errorLogs = @(
    Get-ChildItem $errorLogDir -Filter "error_*.log" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending
)

if ($errorLogs.Count -eq 0) {
    Write-Host ""
    Write-Host "  [OK] No error logs found -- no recent failures."
    Write-Host ""
    exit 0
}

# -------------------------------------------------------------------------
# List mode
# -------------------------------------------------------------------------
if ($ListAll) {
    Write-Host ""
    Write-Sep
    Write-Host "  Error log list (last 10)"
    Write-Sep
    Write-Host ""
    $i = 1
    foreach ($log in ($errorLogs | Select-Object -First 10)) {
        $sz   = Format-Bytes $log.Length
        $time = $log.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
        $mark = if ($i -eq 1) { "[latest]" } else { "        " }
        Write-Host ("  {0} {1}  {2}  {3}" -f $mark, $log.Name, $sz, $time)
        $i++
    }
    Write-Host ""
    exit 0
}

# -------------------------------------------------------------------------
# Analyze latest error log
# -------------------------------------------------------------------------
$target     = $errorLogs[0]
$logContent = Get-Content $target.FullName -Encoding UTF8 -ErrorAction SilentlyContinue

Write-Host ""
Write-Sep
Write-Host "  analyze-error : latest error report"
Write-Sep
Write-Host ""
Write-Host "  File    : $($target.Name)"
Write-Host "  Path    : $($target.FullName)"
Write-Host "  Size    : $(Format-Bytes $target.Length)"
Write-Host "  Time    : $($target.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'))"

if (-not $logContent -or $logContent.Count -eq 0) {
    Write-Host "  (empty log)"
    Write-Host ""
    exit 0
}

# -------------------------------------------------------------------------
# Find corresponding run log (nearest timestamp before error)
# -------------------------------------------------------------------------
$runLogDir  = Join-Path $LogDir "run"
$linkedRunLog = $null

if (Test-Path $runLogDir) {
    # error log name: error_YYYYMMDD_HHmmss.log
    # run log name  : run_YYYYMMDD_HHmmss.log
    # Try to match same timestamp first, then find nearest before
    $errBase = $target.Name -replace '^error_', '' -replace '\.log$', ''
    $sameTs  = Get-ChildItem $runLogDir -Filter "run_${errBase}.log" -ErrorAction SilentlyContinue

    if ($sameTs) {
        $linkedRunLog = $sameTs
    } else {
        # Find the most recent run log that is earlier than the error log
        $linkedRunLog = Get-ChildItem $runLogDir -Filter "run_*.log" -ErrorAction SilentlyContinue |
                        Where-Object { $_.LastWriteTime -le $target.LastWriteTime } |
                        Sort-Object LastWriteTime -Descending |
                        Select-Object -First 1
    }
}

if ($linkedRunLog) {
    Write-Host "  Run log : $($linkedRunLog.Name)"
} else {
    Write-Host "  Run log : (not found)"
}

# -------------------------------------------------------------------------
# Extract header info from log
# -------------------------------------------------------------------------
$headerLines = @($logContent | Where-Object { $_ -match '^#' } | Select-Object -First 10)
$bodyLines   = @($logContent | Where-Object { $_ -notmatch '^#' })

Write-Host ""
Write-Host ("  " + "-" * 60)
Write-Host "  Log header:"
foreach ($h in $headerLines) {
    Write-Host "    $h"
}

# -------------------------------------------------------------------------
# STDERR lines
# -------------------------------------------------------------------------
$stderrLines = @($logContent | Where-Object { $_ -match '^\[STDERR\]' })

if ($stderrLines.Count -gt 0) {
    Write-Host ""
    Write-Host ("  " + "-" * 60)
    Write-Host "  STDERR ($($stderrLines.Count) lines):"
    Write-Host ""
    $displayStderr = if ($stderrLines.Count -gt 30) {
        Write-Host "  (showing first 30 of $($stderrLines.Count))"
        $stderrLines | Select-Object -First 30
    } else { $stderrLines }

    foreach ($l in $displayStderr) { Write-Host "    $l" }
}

# -------------------------------------------------------------------------
# Tail lines
# -------------------------------------------------------------------------
$showCount  = if ($All) { $bodyLines.Count } else { [Math]::Min($Lines, $bodyLines.Count) }
$startIdx   = [Math]::Max(0, $bodyLines.Count - $showCount)
$tailLines  = $bodyLines[$startIdx..($bodyLines.Count - 1)]

Write-Host ""
Write-Host ("  " + "-" * 60)
$label = if ($All) { "All $($bodyLines.Count) lines" } else { "Last $showCount of $($bodyLines.Count) lines" }
Write-Host "  $label :"
Write-Host ""
foreach ($l in $tailLines) { Write-Host "    $l" }

# -------------------------------------------------------------------------
# Build AI-ready debug report and save to artifacts/
# -------------------------------------------------------------------------
$now         = Get-Date
$ts          = $now.ToString("yyyyMMdd_HHmmss")
$artifactDir = Join-Path $LogDir "..\artifacts"

# Resolve artifacts path relative to working dir
$artifactDir = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) "artifacts"))

if (-not (Test-Path $artifactDir)) {
    New-Item -ItemType Directory -Path $artifactDir -Force | Out-Null
}

$reportPath = Join-Path $artifactDir "debug_${ts}.txt"

# Extract command from header
$cmdLine   = ($headerLines | Where-Object { $_ -match '# Command:' } | Select-Object -First 1) -replace '# Command:\s*', ''
$exitLine  = ($headerLines | Where-Object { $_ -match '# ExitCode:' } | Select-Object -First 1) -replace '# ExitCode:\s*', ''
$startLine = ($headerLines | Where-Object { $_ -match '# Start:' } | Select-Object -First 1) -replace '# Start:\s*', ''

$reportLines = @(
    "=== AI Debug Report ===",
    "Generated : $($now.ToString('yyyy-MM-dd HH:mm:ss'))",
    "Project   : $(Split-Path (Get-Location) -Leaf)",
    "Error log : $($target.Name)",
    "Run log   : $(if ($linkedRunLog) { $linkedRunLog.Name } else { '(none)' })",
    "Command   : $cmdLine",
    "Exit code : $exitLine",
    "Run start : $startLine",
    "",
    "=== STDERR (error lines) ===",
    ($stderrLines | ForEach-Object { $_ -replace '^\[STDERR\] ', '' }),
    "",
    "=== LAST $showCount LINES OF OUTPUT ===",
    $tailLines,
    "",
    "=== PLEASE HELP ===",
    "The above error occurred when running: $cmdLine",
    "What is the likely cause and how can I fix it?"
)

$reportContent = $reportLines | ForEach-Object {
    if ($_ -is [array]) { $_ -join "`n" } else { $_ }
}

[System.IO.File]::WriteAllLines($reportPath, ($reportContent | Where-Object { $null -ne $_ }), [System.Text.Encoding]::UTF8)

# -------------------------------------------------------------------------
# Summary + artifact path
# -------------------------------------------------------------------------
Write-Host ""
Write-Sep
Write-Host "  AI debug report saved:"
Write-Host "  $reportPath"
Write-Host ""
Write-Host "  Copy-paste the report into Claude or any AI chat for analysis."

if ($errorLogs.Count -gt 1) {
    Write-Host ""
    Write-Host "  ($($errorLogs.Count - 1) more error log(s) -- use -ListAll to see all)"
}

Write-Host ""
Write-Sep
Write-Host ""

exit 0
