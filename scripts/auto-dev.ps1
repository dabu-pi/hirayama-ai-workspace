#Requires -Version 5.1
<#
.SYNOPSIS
    Phase2 unified commander: one command runs the full dev cycle.
    run-with-log -> note -> git-safe-commit (in order, stops on failure).

.DESCRIPTION
    Usage pattern:
      .\auto-dev.ps1 -Cmd "python -m pytest -v" -Note "TC-05 all pass" -Tag test -Commit

    Cycle:
      1. Execute -Cmd via run-with-log.ps1 (rwl)
      2. If exit 0 and -Note: save note via note.ps1
      3. If exit 0 and -Commit: run git-safe-commit.ps1 interactively
      4. If exit != 0: STOP -- do NOT commit -- show error summary

    Output follows the 6-section format:
      PLAN / CHANGES / COMMANDS / NOTES / GIT / NEXT

.PARAMETER Cmd
    Command to execute. Example: "python -m pytest tests/ -v"

.PARAMETER Note
    Note message to save on success. Omit to skip note.

.PARAMETER Tag
    Note tag on success (default: done). Failure always uses "bug".

.PARAMETER Commit
    If set, launch git-safe-commit.ps1 after successful run.

.PARAMETER CommitMsg
    Commit message. If omitted with -Commit, you will be prompted.

.PARAMETER CommitFiles
    Files to stage for commit. Passed to git-safe-commit.ps1 -Files.

.PARAMETER Push
    Push after commit (passed to git-safe-commit.ps1 -Push).

.PARAMETER LogDir
    Log root directory (default: ./logs).

.PARAMETER Plan
    Free-text description of what this cycle is doing (for PLAN section).

.EXAMPLE
    # Run tests, save note, commit and push
    .\auto-dev.ps1 -Cmd "python -m pytest tests/ -v" `
                   -Note "TC-05 pass" -Tag test `
                   -Commit -CommitMsg "test: TC-05 all pass" `
                   -CommitFiles @("tests/test_main.py") -Push

    # Run only (no note, no commit)
    .\auto-dev.ps1 -Cmd "python main.py"

    # Run + note only
    .\auto-dev.ps1 -Cmd "python -m pytest" -Note "quick smoke test" -Tag test
#>

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Cmd,

    [string]$Note        = "",
    [string]$Tag         = "done",
    [switch]$Commit,
    [string]$CommitMsg   = "",
    [string[]]$CommitFiles = @(),
    [switch]$Push,
    [string]$LogDir      = "logs",
    [string]$Plan        = ""
)

Set-StrictMode -Version Latest

# -------------------------------------------------------------------------
# Resolve sibling scripts
# -------------------------------------------------------------------------
$sd = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }

$rwlScript  = Join-Path $sd "run-with-log.ps1"
$noteScript = Join-Path $sd "note.ps1"
$gscScript  = Join-Path $sd "git-safe-commit.ps1"
$aerrScript = Join-Path $sd "analyze-error.ps1"

foreach ($s in @($rwlScript, $noteScript, $gscScript)) {
    if (-not (Test-Path $s)) {
        Write-Error "Required script not found: $s"
        exit 1
    }
}

# -------------------------------------------------------------------------
# State tracking
# -------------------------------------------------------------------------
$cycleStart  = Get-Date
$exitCode    = 0
$latestRunLog = $null
$latestErrLog = $null
$commitHash   = ""
$noteSaved    = $false

# -------------------------------------------------------------------------
# Snapshot run logs before execution
# -------------------------------------------------------------------------
$runLogDir   = Join-Path $LogDir "run"
$errLogDir   = Join-Path $LogDir "error"
$priorLogs   = @()
if (Test-Path $runLogDir) {
    $priorLogs = @(Get-ChildItem $runLogDir -Filter "run_*.log" -ErrorAction SilentlyContinue |
                   Select-Object -ExpandProperty FullName)
}

# -------------------------------------------------------------------------
# Print PLAN section
# -------------------------------------------------------------------------
$branch = if ((git rev-parse --is-inside-work-tree 2>&1) -eq "true") {
    (git rev-parse --abbrev-ref HEAD 2>&1).Trim()
} else { "n/a" }

Write-Host ""
Write-Host ("=" * 68)
Write-Host "  auto-dev.ps1  |  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host "  Branch        |  $branch"
Write-Host ("=" * 68)
Write-Host ""
Write-Host "## PLAN"
Write-Host "  Command : $Cmd"
Write-Host "  Note    : $(if ($Note) { $Note } else { '(none)' })"
Write-Host "  Commit  : $(if ($Commit) { 'yes' + $(if ($Push) { ' + push' } else { '' }) } else { 'no' })"
if ($Plan) { Write-Host "  Context : $Plan" }

# =========================================================================
# STEP 1: Execute command via rwl
# =========================================================================
Write-Host ""
Write-Host ("  " + "-" * 64)
Write-Host "  [1/3] Running command ..."
Write-Host ("  " + "-" * 64)
Write-Host ""

$parts     = $Cmd.Trim() -split '\s+', 2
$exe       = $parts[0]
$argsStr   = if ($parts.Length -gt 1) { $parts[1] } else { "" }
$argsArray = if ($argsStr) { $argsStr -split '\s+' } else { @() }

try {
    if ($argsArray.Count -gt 0) {
        & $rwlScript $exe @argsArray -LogDir $LogDir
    } else {
        & $rwlScript $exe -LogDir $LogDir
    }
    $exitCode = if ($null -ne $LASTEXITCODE) { $LASTEXITCODE } else { 0 }
} catch {
    Write-Host "  [ERROR] rwl invocation failed: $_"
    $exitCode = 1
}

# Find generated logs
if (Test-Path $runLogDir) {
    $newLogs = @(Get-ChildItem $runLogDir -Filter "run_*.log" -ErrorAction SilentlyContinue |
                 Where-Object { $_.FullName -notin $priorLogs } |
                 Sort-Object LastWriteTime -Descending)
    $latestRunLog = if ($newLogs.Count -gt 0) { $newLogs[0] } else {
        Get-ChildItem $runLogDir -Filter "run_*.log" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    }
}
if (Test-Path $errLogDir) {
    $latestErrLog = Get-ChildItem $errLogDir -Filter "error_*.log" -ErrorAction SilentlyContinue |
                   Sort-Object LastWriteTime -Descending | Select-Object -First 1
}

# =========================================================================
# STEP 2: Handle failure -- STOP before note/commit
# =========================================================================
if ($exitCode -ne 0) {
    Write-Host ""
    Write-Host ("=" * 68)
    Write-Host "  ## STOP -- command failed (exit $exitCode)"
    Write-Host ("=" * 68)
    Write-Host ""
    Write-Host "  ## COMMANDS (result)"
    Write-Host "    $Cmd  ->  FAILED (exit $exitCode)"
    if ($latestRunLog)  { Write-Host "    Run log : $($latestRunLog.FullName)" }
    if ($latestErrLog)  { Write-Host "    Err log : $($latestErrLog.FullName)" }
    Write-Host ""
    Write-Host "  ## NOTES"
    Write-Host "    No note saved (failure stops the cycle)."
    Write-Host ""
    Write-Host "  ## GIT"
    Write-Host "    No commit (failure stops the cycle)."
    Write-Host ""
    Write-Host "  ## NEXT"
    Write-Host "    1. Inspect the error:"
    Write-Host "       analyze-error.ps1 -LogDir $LogDir"
    Write-Host "    2. Fix the issue"
    Write-Host "    3. Re-run this command"
    Write-Host ""

    # Auto-save failure note if requested
    if ($Note -and (Test-Path $noteScript)) {
        $errName = if ($latestErrLog) { " errlog:$($latestErrLog.Name)" } else { "" }
        & $noteScript "${Note} -- FAILED (exit ${exitCode})${errName}" -Tag bug -LogDir $LogDir
        Write-Host "  (failure note saved with tag:bug)"
    }

    # Show error snippet from analyze-error if available
    if (Test-Path $aerrScript) {
        Write-Host ""
        Write-Host "  --- Error snippet ---"
        & $aerrScript -LogDir $LogDir -Lines 20
    }

    Write-Host ("=" * 68)
    exit $exitCode
}

# =========================================================================
# STEP 3: Save note (on success)
# =========================================================================
Write-Host ""
Write-Host ("  " + "-" * 64)
Write-Host "  [2/3] Saving note ..."
Write-Host ("  " + "-" * 64)

if ($Note -and (Test-Path $noteScript)) {
    $noteMsg = "${Note} -- OK (exit 0)"
    & $noteScript $noteMsg -Tag $Tag -LogDir $LogDir
    $noteSaved = $true
} else {
    Write-Host "  (no note -- omit -Note to skip)"
}

# =========================================================================
# STEP 4: Commit (on success, if requested)
# =========================================================================
$commitDone = $false

if ($Commit) {
    Write-Host ""
    Write-Host ("  " + "-" * 64)
    Write-Host "  [3/3] Committing ..."
    Write-Host ("  " + "-" * 64)
    Write-Host ""

    # Prompt for message if not provided
    if (-not $CommitMsg) {
        $CommitMsg = Read-Host "  Enter commit message (prefix:feat/fix/docs/refactor/test/chore)"
    }
    if (-not $CommitMsg) {
        Write-Host "  [WARN] No commit message. Skipping commit."
    } else {
        if ($CommitFiles.Count -gt 0) {
            & $gscScript -Message $CommitMsg -Files $CommitFiles -Push:$Push
        } else {
            & $gscScript -Message $CommitMsg -Push:$Push
        }

        if ($LASTEXITCODE -eq 0) {
            $commitHash  = (git rev-parse --short HEAD 2>&1).Trim()
            $commitDone  = $true
        } else {
            Write-Host "  [WARN] git-safe-commit failed. Cycle complete without commit."
        }
    }
} else {
    Write-Host ""
    Write-Host "  [3/3] Commit skipped (-Commit not specified)"
}

# =========================================================================
# Final report (6-section format)
# =========================================================================
$elapsed = [int]((Get-Date) - $cycleStart).TotalSeconds

Write-Host ""
Write-Host ("=" * 68)
Write-Host "  CYCLE COMPLETE  ($elapsed s)"
Write-Host ("=" * 68)
Write-Host ""
Write-Host "## PLAN"
Write-Host "  $Cmd"
if ($Plan) { Write-Host "  Context: $Plan" }

Write-Host ""
Write-Host "## CHANGES"
Write-Host "  (fill in what files were modified in this cycle)"

Write-Host ""
Write-Host "## COMMANDS"
Write-Host "  auto-dev.ps1 -Cmd `"$Cmd`""
Write-Host "  -> exit 0  (SUCCESS)"
if ($latestRunLog) { Write-Host "  -> run log: $($latestRunLog.FullName)" }

Write-Host ""
Write-Host "## NOTES"
if ($noteSaved) {
    Write-Host "  note saved: `"$Note`" [tag:$Tag]"
} else {
    Write-Host "  (no note)"
}

Write-Host ""
Write-Host "## GIT"
if ($commitDone) {
    Write-Host "  gsc -Message `"$CommitMsg`"$(if ($Push) { ' -Push' } else { '' })"
    Write-Host "  -> commit: $commitHash"
    if ($Push) { Write-Host "  -> pushed to $(git remote get-url origin 2>&1)" }
} else {
    Write-Host "  (no commit)"
}

Write-Host ""
Write-Host "## NEXT"
Write-Host "  Update ROADMAP.md if this task is now complete."
Write-Host "  Use auto-dev-loop.md prompt for the next cycle."
Write-Host ""
Write-Host ("=" * 68)
Write-Host ""

exit 0
