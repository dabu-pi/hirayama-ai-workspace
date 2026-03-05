#Requires -Version 5.1
<#
.SYNOPSIS
    Phase3 wrapper: snapshot -> branch check -> auto-dev.ps1 -> post-cycle guidance.

.DESCRIPTION
    Wraps auto-dev.ps1 with Phase3-specific guardrails:
      1. Shows dev-status snapshot
      2. Warns if on master/main and suggests a feature/* branch command
      3. Executes the cycle via auto-dev.ps1 (required in Phase3)
      4. On success: shows git-safe-commit command and PROJECT_STATUS update template
      5. On failure: shows [AI REPORT] path and next-action guidance

    This script does NOT auto-commit or auto-push.
    Destructive operations always require human approval.

.PARAMETER Cmd
    Command to execute (passed to auto-dev.ps1 -Cmd).

.PARAMETER Note
    Note message saved on success (passed to auto-dev.ps1 -Note).

.PARAMETER Tag
    Note tag on success. Default: done.

.PARAMETER CommitMsg
    Commit message hint shown in post-cycle guidance.

.PARAMETER CommitFiles
    Files to stage (shown in post-cycle guidance, not auto-committed).

.PARAMETER LogDir
    Log root directory. Default: ./logs.

.PARAMETER Plan
    Free-text description of this cycle (for auto-dev.ps1 PLAN section).

.EXAMPLE
    .\auto-dev-phase3.ps1 -Cmd "python -m pytest tests/ -v" -Note "TC-05 pass" -Tag test
    .\auto-dev-phase3.ps1 -Cmd "python main.py" -CommitMsg "feat: main process verified"
#>

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Cmd,

    [string]$Note         = "",
    [string]$Tag          = "done",
    [string]$CommitMsg    = "",
    [string[]]$CommitFiles = @(),
    [string]$LogDir       = "logs",
    [string]$Plan         = ""
)

Set-StrictMode -Version Latest

# -------------------------------------------------------------------------
# Resolve sibling scripts
# -------------------------------------------------------------------------
$sd = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }

$devStatusScript = Join-Path $sd "dev-status.ps1"
$autoDevScript   = Join-Path $sd "auto-dev.ps1"
$gscScript       = Join-Path $sd "git-safe-commit.ps1"

if (-not (Test-Path $autoDevScript)) {
    Write-Host "  [ERROR] auto-dev.ps1 not found: $autoDevScript"
    exit 1
}

$sep = "=" * 68
$now = Get-Date -Format "yyyy-MM-dd HH:mm:ss"

# =========================================================================
# STEP 1: Dev-status snapshot
# =========================================================================
Write-Host ""
Write-Host $sep
Write-Host "  auto-dev-phase3  |  Phase3 cycle  |  $now"
Write-Host $sep
Write-Host ""
Write-Host "  [1/4] Project snapshot"
Write-Host ("  " + "-" * 64)
Write-Host ""

if (Test-Path $devStatusScript) {
    & $devStatusScript
} else {
    Write-Host "  [WARN] dev-status.ps1 not found -- skipping snapshot"
}

# =========================================================================
# STEP 2: Branch check
# =========================================================================
Write-Host ""
Write-Host "  [2/4] Branch check"
Write-Host ("  " + "-" * 64)
Write-Host ""

$currentBranch = (git rev-parse --abbrev-ref HEAD 2>&1).Trim()
$onProtected   = ($currentBranch -eq "master" -or $currentBranch -eq "main")

if ($onProtected) {
    $ts        = Get-Date -Format "yyyyMMdd_HHmm"
    $suggested = "feature/auto-$ts"

    Write-Host "  [WARN] Current branch: $currentBranch"
    Write-Host "  Phase3 rule: feature/* branch required for code changes."
    Write-Host "  Docs-only commits may proceed directly on $currentBranch."
    Write-Host ""
    Write-Host "  --- Run this command to create a branch (if changing code) ---"
    Write-Host "    git checkout -b $suggested"
    Write-Host "  ---------------------------------------------------------------"
    Write-Host ""
    Write-Host "  Proceeding on $currentBranch -- confirm branch is correct before committing."
} else {
    Write-Host "  Branch: $currentBranch  [OK -- not master/main]"
}

# =========================================================================
# STEP 3: Execute via auto-dev.ps1
# =========================================================================
Write-Host ""
Write-Host "  [3/4] Cycle execution via auto-dev.ps1"
Write-Host ("  " + "-" * 64)
Write-Host ""

$splat = @{
    Cmd    = $Cmd
    LogDir = $LogDir
    Tag    = $Tag
}
if ($Note)                     { $splat.Note    = $Note }
if ($Plan)                     { $splat.Plan    = $Plan }

& $autoDevScript @splat

$exitCode = if ($null -ne $LASTEXITCODE) { $LASTEXITCODE } else { 0 }

# =========================================================================
# STEP 4: Post-cycle guidance
# =========================================================================
Write-Host ""
Write-Host $sep
Write-Host "  [4/4] Phase3 post-cycle guidance"
Write-Host $sep
Write-Host ""

if ($exitCode -ne 0) {
    # ---- FAILURE PATH ----
    Write-Host "  STATUS : FAILED (exit $exitCode)"
    Write-Host ""

    # Find latest AI report
    $artifactDir = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) "artifacts"))
    $aiReport    = $null
    if (Test-Path $artifactDir) {
        $aiReport = Get-ChildItem $artifactDir -Filter "debug_*.txt" -ErrorAction SilentlyContinue |
                    Sort-Object LastWriteTime -Descending | Select-Object -First 1
    }

    if ($aiReport) {
        Write-Host ("  " + "-" * 64)
        Write-Host "  [AI REPORT] $($aiReport.FullName)"
        Write-Host "  Paste the contents of this file to Claude for diagnosis."
        Write-Host ("  " + "-" * 64)
        Write-Host ""
    }

    Write-Host "  NEXT ACTIONS:"
    Write-Host "    1. Read the [AI REPORT] above and paste it to Claude"
    Write-Host "    2. Apply the fix Claude suggests"
    Write-Host "    3. Re-run this command after fixing:"
    Write-Host ""
    $rerunNote  = if ($Note)      { " -Note `"$Note`""      } else { "" }
    $rerunMsg   = if ($CommitMsg) { " -CommitMsg `"$CommitMsg`"" } else { "" }
    Write-Host "    auto-dev-phase3.ps1 -Cmd `"$Cmd`"$rerunNote$rerunMsg"
    Write-Host ""
    Write-Host "  STOP CHECK:"
    Write-Host "    If the error involves auth / API keys / billing / deletion / production"
    Write-Host "    data -- STOP and get human approval before retrying."

} else {
    # ---- SUCCESS PATH ----
    Write-Host "  STATUS : SUCCESS (exit 0)"
    Write-Host ""

    # git-safe-commit command hint
    Write-Host ("  " + "-" * 64)
    Write-Host "  COMMIT STEP (run manually when ready):"
    Write-Host ("  " + "-" * 64)

    $msgArg   = if ($CommitMsg) { $CommitMsg } else { "feat: <describe this change>" }
    $filesArg = if ($CommitFiles.Count -gt 0) {
        $quoted = ($CommitFiles | ForEach-Object { "`"$_`"" }) -join ", "
        " -Files @($quoted)"
    } else { "" }
    $branchNote = if ($onProtected) {
        "  [NOTE] You are on $currentBranch. Consider committing to feature/* instead."
    } else {
        "  [NOTE] Branch: $currentBranch"
    }

    Write-Host ""
    Write-Host "    scripts/git-safe-commit.ps1 -Message `"$msgArg`"$filesArg -Push"
    Write-Host ""
    Write-Host $branchNote
    Write-Host ""

    # PROJECT_STATUS.md update template
    $ts2 = Get-Date -Format "yyyy-MM-dd HH:mm"
    Write-Host ("  " + "-" * 64)
    Write-Host "  PROJECT_STATUS.md update template:"
    Write-Host ("  " + "-" * 64)
    Write-Host ""
    Write-Host "  ## 最後の実行 (Last Execution)"
    Write-Host "  ```"
    Write-Host "  コマンド  : $Cmd"
    Write-Host "  終了コード: 0 (SUCCESS)"
    Write-Host "  コミット  : <git rev-parse --short HEAD after commit>"
    Write-Host "  ステータス: SUCCESS"
    Write-Host "  ```"
    Write-Host ""
    Write-Host "  ## 現在地 (Current Position)"
    Write-Host "  | 最終更新 | $ts2 |"
    Write-Host ""
    Write-Host "  ## 次のアクション (NEXT)"
    Write-Host "  1. <fill from ## NEXT section above>"
    Write-Host "  2. ROADMAP.md の完了タスクを ✅ に更新する"
    Write-Host "  3. PROJECT_STATUS.md を commit & push する"
    Write-Host ""
    Write-Host ("  " + "-" * 64)
}

Write-Host ""
Write-Host $sep
Write-Host ""

exit $exitCode
