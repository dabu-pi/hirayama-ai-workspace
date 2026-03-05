#Requires -Version 5.1
<#
.SYNOPSIS
    Project status dashboard: git state, log counts, notes, ROADMAP summary.

.PARAMETER LogDir
    Log root directory (default: ./logs).

.PARAMETER NoRoadmap
    Skip ROADMAP.md summary.

.EXAMPLE
    .\dev-status.ps1
    .\dev-status.ps1 -NoRoadmap
#>

param(
    [string]$LogDir    = "logs",
    [switch]$NoRoadmap
)

Set-StrictMode -Version Latest

# -------------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------------
function Write-Sec  { param([string]$T) Write-Host ""; Write-Host "  [$T]"; Write-Host ("  " + "-" * 52) }
function Write-Row  { param([string]$L, [string]$V) Write-Host ("  {0,-14}: {1}" -f $L, $V) }
function Fmt-Size   { param([long]$B)
    if ($B -ge 1MB) { return "{0:N1} MB" -f ($B / 1MB) }
    if ($B -ge 1KB) { return "{0:N1} KB" -f ($B / 1KB) }
    return "$B B"
}
function Fmt-Time   { param($F) if ($null -eq $F) { return "n/a" }; $F.LastWriteTime.ToString("MM-dd HH:mm") }

$today     = Get-Date -Format "yyyyMMdd"
$projectId = Split-Path (Get-Location) -Leaf

# =========================================================================
Write-Host ""
Write-Host ("=" * 64)
Write-Host "  dev-status  |  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "  Project     |  $projectId"
Write-Host ("=" * 64)

# =========================================================================
# GIT
# =========================================================================
Write-Sec "GIT"

$isGit = $false
try {
    $null = git rev-parse --is-inside-work-tree 2>&1
    $isGit = ($LASTEXITCODE -eq 0)
} catch {}

if ($isGit) {
    $branch = (git rev-parse --abbrev-ref HEAD 2>&1).Trim()
    Write-Row "Branch" $branch

    # ahead / behind
    $ahead  = (git rev-list --count "@{u}..HEAD" 2>&1).Trim()
    $behind = (git rev-list --count "HEAD..@{u}" 2>&1).Trim()
    if ($LASTEXITCODE -eq 0) {
        Write-Row "Remote sync" "ahead:$ahead  behind:$behind"
    }

    # working tree
    $dirty = @(git status --short 2>&1 | Where-Object { $_ -ne "" })
    Write-Row "Working tree" ("$(if ($dirty.Count -eq 0) { 'clean' } else { "$($dirty.Count) modified" })")

    # recent commits
    Write-Host ""
    Write-Host "  Recent commits:"
    git log --oneline -5 2>&1 | ForEach-Object { Write-Host "    $_" }
} else {
    Write-Row "Status" "not a git repository"
}

# =========================================================================
# LOGS
# =========================================================================
Write-Sec "LOGS"

$runLogDir   = Join-Path $LogDir "run"
$errorLogDir = Join-Path $LogDir "error"
$notesDir    = Join-Path $LogDir "notes"

# run logs
if (Test-Path $runLogDir) {
    $allRuns    = @(Get-ChildItem $runLogDir -Filter "run_*.log"           -ErrorAction SilentlyContinue)
    $todayRuns  = @(Get-ChildItem $runLogDir -Filter "run_${today}_*.log"  -ErrorAction SilentlyContinue)
    $latestRun  = $allRuns | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    Write-Row "Run logs" "today:$($todayRuns.Count)  total:$($allRuns.Count)  latest:$(Fmt-Time $latestRun)"
} else {
    Write-Row "Run logs" "(logs/run/ not found)"
}

# error logs
if (Test-Path $errorLogDir) {
    $allErrs   = @(Get-ChildItem $errorLogDir -Filter "error_*.log"           -ErrorAction SilentlyContinue)
    $todayErrs = @(Get-ChildItem $errorLogDir -Filter "error_${today}_*.log"  -ErrorAction SilentlyContinue)
    $latestErr = $allErrs | Sort-Object LastWriteTime -Descending | Select-Object -First 1

    $errLabel = "today:$($todayErrs.Count)  total:$($allErrs.Count)  latest:$(Fmt-Time $latestErr)"
    Write-Row "Error logs" $errLabel

    if ($allErrs.Count -gt 0) {
        Write-Host "  Latest errors (top 3):"
        $allErrs | Sort-Object LastWriteTime -Descending | Select-Object -First 3 |
            ForEach-Object { Write-Host "    [FAIL] $($_.Name)  $(Fmt-Time $_)" }
        Write-Host "  -> run analyze-error.ps1 to inspect"
    }
} else {
    Write-Row "Error logs" "(logs/error/ not found)"
}

# =========================================================================
# NOTES (today)
# =========================================================================
Write-Sec "NOTES (today)"

$noteFile = Join-Path $notesDir "note_${today}.md"

if (Test-Path $noteFile) {
    $entries = @(Get-Content $noteFile -Encoding UTF8 -ErrorAction SilentlyContinue |
                 Where-Object { $_ -match '^- ' })
    Write-Row "Note file" $noteFile
    Write-Row "Entries" "$($entries.Count) today"

    if ($entries.Count -gt 0) {
        Write-Host ""
        $entries | Select-Object -Last 8 | ForEach-Object { Write-Host "  $_" }
        if ($entries.Count -gt 8) {
            Write-Host "  ... ($($entries.Count - 8) more -- see $noteFile)"
        }
    }
} else {
    Write-Host "  No notes today. Use note.ps1 to add one."
}

# =========================================================================
# ROADMAP summary
# =========================================================================
if (-not $NoRoadmap) {
    Write-Sec "ROADMAP"

    # Search for ROADMAP.md in current dir or parent
    $rmFile = "ROADMAP.md"
    if (-not (Test-Path $rmFile)) {
        $rmFile = Join-Path (Split-Path (Get-Location)) "ROADMAP.md"
    }

    if (Test-Path $rmFile) {
        $rm = Get-Content $rmFile -Encoding UTF8 -ErrorAction SilentlyContinue

        # Use [char] to avoid emoji literals in script source
        $chkDone  = [char]0x2705                              # U+2705 checkmark (BMP)
        $chkPause = [char]0x23F8                              # U+23F8 pause (BMP)
        # U+1F504 (rotating arrows) is outside BMP -- use surrogate pair
        $chkWIP   = [char]::ConvertFromUtf32(0x1F504)

        $nDone    = ($rm | Where-Object { $_.Contains($chkDone)  }).Count
        $nWIP     = ($rm | Where-Object { $_.Contains($chkWIP)   }).Count
        $nPause   = ($rm | Where-Object { $_.Contains($chkPause) }).Count

        Write-Row "File" $rmFile
        Write-Row "[DONE] tasks"  "$nDone"
        Write-Row "[WIP]  tasks"  "$nWIP"
        Write-Row "[WAIT] tasks"  "$nPause"

        $wipLines = @($rm | Where-Object { $_.Contains($chkWIP) } | Select-Object -First 5)
        if ($wipLines.Count -gt 0) {
            Write-Host ""
            Write-Host "  In-progress tasks:"
            $wipLines | ForEach-Object { Write-Host "    $($_.Trim())" }
        }
    } else {
        Write-Host "  ROADMAP.md not found"
    }
}

# =========================================================================
Write-Host ""
Write-Host ("=" * 64)
Write-Host ""

exit 0
