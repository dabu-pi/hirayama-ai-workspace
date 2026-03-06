#Requires -Version 5.1
<#
.SYNOPSIS
    AI Development Automatic Loop -- auto-loop.ps1

    Wraps auto-dev.ps1 with:
      - Pre-flight STOP check (API keys / credentials / destructive ops)
      - Result classification: SUCCESS / WARNING / FAILURE
      - Cycle summary saved to logs/notes/cycle_TIMESTAMP.md
      - Structured output: RESULT / LOG PATHS / ERROR SUMMARY / FIX NEXT / GIT NEXT

.DESCRIPTION
    One-command dev cycle with full traceability.
    Human confirmation is required at STOP conditions and before git commit/push.

    Cycle flow:
      STOP check -> auto-dev.ps1 (rwl -> note -> gsc) -> classify -> summary -> output

.PARAMETER Project
    Project name used in cycle summary (e.g., "freee-automation").

.PARAMETER Cmd
    Command to execute. Required.

.PARAMETER Note
    Work memo saved to notes log on success.

.PARAMETER Mode
    "workspace" (default, stricter STOP checks) or "sandbox".

.PARAMETER Tag
    Note tag on success (default: done).

.PARAMETER Commit
    If set, run git-safe-commit.ps1 after successful command.

.PARAMETER CommitMsg
    Commit message. If omitted with -Commit, you will be prompted.

.PARAMETER CommitFiles
    Files to stage for commit.

.PARAMETER Push
    Push after commit.

.PARAMETER LogDir
    Log root directory (default: ./logs).

.PARAMETER Plan
    Description of what this cycle is doing (included in cycle summary).

.PARAMETER SkipStopCheck
    Bypass STOP check. Use only when you are certain the command is safe.

.EXAMPLE
    # Basic run
    .\auto-loop.ps1 -Project "freee-automation" -Cmd "python -m pytest tests/ -v" -Note "TC-01 pass"

    # Run + commit + push
    .\auto-loop.ps1 -Project "freee-automation" `
        -Cmd "python -m pytest tests/ -v" `
        -Note "all pass" -Tag test `
        -Commit -CommitMsg "test: all pass" -Push

    # Sandbox mode (relaxed STOP checks)
    .\auto-loop.ps1 -Project "experiment" -Cmd "python run.py" -Mode sandbox

    # With plan description
    .\auto-loop.ps1 -Project "patient-mgmt" `
        -Cmd "python app.py" `
        -Plan "Test Flask startup after env var change" `
        -Note "app start OK"

.NOTES
    Exit codes:
      0  = SUCCESS or WARNING (command succeeded)
      1  = FAILURE (command failed)
      99 = STOP (pre-flight check blocked execution)
#>

param(
    [string]   $Project     = "",

    [Parameter(Mandatory = $true, Position = 0)]
    [string]   $Cmd,

    [string]   $Note        = "",
    [string]   $Mode        = "workspace",
    [string]   $Tag         = "done",
    [switch]   $Commit,
    [string]   $CommitMsg   = "",
    [string[]] $CommitFiles = @(),
    [switch]   $Push,
    [string]   $LogDir      = "logs",
    [string]   $Plan        = "",
    [switch]   $SkipStopCheck
)

# =========================================================================
# Script resolution
# =========================================================================
$sd = if ($PSScriptRoot) { $PSScriptRoot } else {
    Split-Path -Parent $MyInvocation.MyCommand.Path
}

$autoDevScript = Join-Path $sd "auto-dev.ps1"
$aerrScript    = Join-Path $sd "analyze-error.ps1"

if (-not (Test-Path $autoDevScript)) {
    Write-Error "Required script not found: $autoDevScript"
    exit 1
}

# =========================================================================
# Metadata
# =========================================================================
$LOOP_VERSION = "1.0"
$loopStart    = Get-Date

# =========================================================================
# STOP condition patterns
# =========================================================================

# Patterns that trigger STOP when found in the -Cmd string
$STOP_CMD_PATTERNS = @(
    'api[_\-]?key\s*=',           # api_key=VALUE
    '(client|app)[_\-]?secret\s*=', # client_secret=VALUE
    'password\s*=',                # password=VALUE
    '\.env\b',                     # .env file reference
    'service_account',             # service_account.json
    'credentials\.json',           # credentials.json
    'DELETE\s+FROM',               # SQL DELETE
    'DROP\s+(TABLE|DATABASE|SCHEMA)', # SQL DROP
    'rm\s+-rf\s+[/\\]',            # rm -rf /...
    'Format-Volume',               # Windows disk format
    'Clear-Disk'                   # Windows disk wipe
)

# Patterns that trigger STOP when found in commit file names
$STOP_COMMIT_PATTERNS = @(
    '\.env$', '\.env\.',
    'service_account\.json',
    'credentials\.json',
    'token\.json',
    '\.pem$', '\.key$',
    'id_rsa$', 'id_ed25519$',
    '\.pfx$', '\.p12$'
)

# Additional patterns enforced only in workspace mode
$STOP_WORKSPACE_PATTERNS = @(
    'Remove-Item.+\-Recurse.+\-Force',  # PowerShell recursive delete
    'rmdir\s+/[sS]',                    # Windows cmd recursive rmdir
    'del\s+/[sS]'                       # Windows cmd recursive del
)

# Patterns in run log output that indicate warnings (for WARNING classification)
$WARN_LOG_PATTERNS = @(
    '^\[STDERR\].*[Ww]arning',
    'DeprecationWarning',
    'UserWarning',
    'FutureWarning',
    'PendingDeprecationWarning',
    'RuntimeWarning'
)

# =========================================================================
# Functions
# =========================================================================

function Test-StopCondition {
    param(
        [string]   $Cmd,
        [string[]] $Files,
        [string]   $Mode
    )

    foreach ($pat in $STOP_CMD_PATTERNS) {
        if ($Cmd -imatch $pat) {
            return "Command matches STOP pattern [$pat]"
        }
    }

    foreach ($f in $Files) {
        foreach ($pat in $STOP_COMMIT_PATTERNS) {
            if ($f -imatch $pat) {
                return "Commit file matches STOP pattern [$pat]: $f"
            }
        }
    }

    if ($Mode -eq "workspace") {
        foreach ($pat in $STOP_WORKSPACE_PATTERNS) {
            if ($Cmd -imatch $pat) {
                return "Destructive operation blocked in workspace mode [$pat]"
            }
        }
    }

    return $null
}

function Get-ResultClass {
    param([int]$ExitCode, [string[]]$LogLines)

    if ($ExitCode -eq 0) {
        foreach ($pat in $WARN_LOG_PATTERNS) {
            if ($LogLines | Where-Object { $_ -imatch $pat }) {
                return "WARNING"
            }
        }
        return "SUCCESS"
    }
    return "FAILURE"
}

function New-CycleSummaryMd {
    param(
        [string] $Project,
        [string] $Mode,
        [string] $Branch,
        [string] $Cmd,
        [string] $Plan,
        [string] $Note,
        [int]    $ExitCode,
        [string] $ResultClass,
        [string] $RunLogPath,
        [string] $ErrLogPath,
        [string] $ArtifactPath,
        [string] $CycleSummaryPath,
        [string] $CommitHash,
        [int]    $ElapsedSec
    )

    $ts      = $loopStart.ToString("yyyy-MM-dd HH:mm:ss")
    $runP    = if ($RunLogPath)    { $RunLogPath }    else { "(none)" }
    $errP    = if ($ErrLogPath)    { $ErrLogPath }    else { "(none)" }
    $artP    = if ($ArtifactPath)  { $ArtifactPath }  else { "(none)" }
    $hash    = if ($CommitHash)    { $CommitHash }    else { "(no commit)" }
    $planTxt = if ($Plan)          { $Plan }          else { "(not specified)" }
    $noteTxt = if ($Note)          { $Note }          else { "(not specified)" }
    $projTxt = if ($Project)       { $Project }       else { "(not specified)" }

    return @(
        "# Cycle Summary",
        "",
        "Generated  : $ts",
        "Version    : $LOOP_VERSION",
        "Project    : $projTxt",
        "Mode       : $Mode",
        "Branch     : $Branch",
        "Command    : $Cmd",
        "Exit Code  : $ExitCode",
        "Result     : $ResultClass",
        "Elapsed    : ${ElapsedSec}s",
        "",
        "## Plan",
        $planTxt,
        "",
        "## Note",
        $noteTxt,
        "",
        "## Log Paths",
        "- Run log    : $runP",
        "- Error log  : $errP",
        "- AI artifact: $artP",
        "- This file  : $CycleSummaryPath",
        "",
        "## Commit",
        $hash,
        "",
        "## Next",
        "(update this section after reviewing the result)",
        "",
        "---",
        "*Generated by auto-loop.ps1 v$LOOP_VERSION*"
    )
}

function Write-Sep { Write-Host ("=" * 72) }
function Write-Sep2 { Write-Host ("  " + "-" * 68) }

# =========================================================================
# MAIN
# =========================================================================

# --- Branch ---
$branch = "n/a"
try { $branch = (git rev-parse --abbrev-ref HEAD 2>&1).Trim() } catch {}

# --- Header ---
Write-Host ""
Write-Sep
Write-Host ("  AUTO-LOOP  v{0}  |  {1}" -f $LOOP_VERSION, (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
Write-Host ("  Project  :  {0}" -f $(if ($Project) { $Project } else { "(unspecified)" }))
Write-Host ("  Mode     :  {0}" -f $Mode)
Write-Host ("  Branch   :  {0}" -f $branch)
Write-Host ("  Command  :  {0}" -f $Cmd)
Write-Sep
Write-Host ""

# =========================================================================
# [1] STOP check
# =========================================================================
if (-not $SkipStopCheck) {
    $stopReason = Test-StopCondition -Cmd $Cmd -Files $CommitFiles -Mode $Mode
    if ($null -ne $stopReason) {
        Write-Host ""
        Write-Sep
        Write-Host "  [STOP]  Manual confirmation required -- auto-loop halted"
        Write-Sep
        Write-Host ""
        Write-Host "  Reason : $stopReason"
        Write-Host ""
        Write-Host "  The command may touch sensitive or destructive operations:"
        Write-Host "    API keys / credentials / prod DB / recursive delete / billing"
        Write-Host ""
        Write-Host "  Options:"
        Write-Host "    a) Run scripts\auto-dev.ps1 directly with your own review"
        Write-Host "    b) Re-run auto-loop.ps1 -SkipStopCheck  (only if 100% safe)"
        Write-Host ""
        Write-Sep
        Write-Host ""
        exit 99
    }
}

# =========================================================================
# [2] Snapshot existing logs before execution
# =========================================================================
$runLogDir = Join-Path $LogDir "run"
$errLogDir = Join-Path $LogDir "error"
$artDir    = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) "artifacts"))

$priorRunLogs   = @(
    if (Test-Path $runLogDir) {
        Get-ChildItem $runLogDir -Filter "run_*.log" -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty FullName
    }
)
$priorArtifacts = @(
    if (Test-Path $artDir) {
        Get-ChildItem $artDir -Filter "debug_*.txt" -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty FullName
    }
)

# =========================================================================
# [3] Call auto-dev.ps1
# =========================================================================
$adParams = @{ Cmd = $Cmd; LogDir = $LogDir; Tag = $Tag }
if ($Note)                    { $adParams.Note         = $Note }
if ($Plan)                    { $adParams.Plan         = $Plan }
if ($Commit)                  { $adParams.Commit       = $true }
if ($CommitMsg)               { $adParams.CommitMsg    = $CommitMsg }
if ($CommitFiles.Count -gt 0) { $adParams.CommitFiles  = $CommitFiles }
if ($Push)                    { $adParams.Push         = $true }

& $autoDevScript @adParams
$exitCode = if ($null -ne $LASTEXITCODE) { $LASTEXITCODE } else { 0 }

$elapsed = [int]((Get-Date) - $loopStart).TotalSeconds

# =========================================================================
# [4] Find newly generated logs
# =========================================================================
$latestRunLog   = $null
$latestErrLog   = $null
$latestArtifact = $null

if (Test-Path $runLogDir) {
    $newRun = @(
        Get-ChildItem $runLogDir -Filter "run_*.log" -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notin $priorRunLogs } |
        Sort-Object LastWriteTime -Descending
    )
    $latestRunLog = if ($newRun.Count -gt 0) { $newRun[0] } else {
        Get-ChildItem $runLogDir -Filter "run_*.log" -ErrorAction SilentlyContinue |
        Sort-Object LastWriteTime -Descending | Select-Object -First 1
    }
}

if (Test-Path $errLogDir) {
    $latestErrLog = Get-ChildItem $errLogDir -Filter "error_*.log" -ErrorAction SilentlyContinue |
                    Sort-Object LastWriteTime -Descending | Select-Object -First 1
}

if (Test-Path $artDir) {
    $newArt = @(
        Get-ChildItem $artDir -Filter "debug_*.txt" -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notin $priorArtifacts } |
        Sort-Object LastWriteTime -Descending
    )
    $latestArtifact = if ($newArt.Count -gt 0) { $newArt[0] } else { $null }
}

# =========================================================================
# [5] Classify result
# =========================================================================
$logLines = @()
if ($latestRunLog) {
    try {
        $logLines = @(Get-Content $latestRunLog.FullName -Encoding UTF8 -ErrorAction SilentlyContinue)
    } catch {}
}

$resultClass = Get-ResultClass -ExitCode $exitCode -LogLines $logLines

# =========================================================================
# [6] Commit hash (if commit was done)
# =========================================================================
$commitHash = ""
if ($Commit -and $exitCode -eq 0) {
    try {
        $h = (git rev-parse --short HEAD 2>&1).Trim()
        if ($h -match '^[0-9a-f]{5,}') { $commitHash = $h }
    } catch {}
}

# =========================================================================
# [7] Save cycle summary to logs/notes/cycle_TIMESTAMP.md
# =========================================================================
$notesDir = Join-Path $LogDir "notes"
if (-not (Test-Path $notesDir)) {
    New-Item -ItemType Directory -Path $notesDir -Force | Out-Null
}

$cycleTsStr       = $loopStart.ToString("yyyyMMdd_HHmmss")
$cycleSummaryPath = Join-Path $notesDir "cycle_${cycleTsStr}.md"
$cycleSummaryPath = [System.IO.Path]::GetFullPath($cycleSummaryPath)

$summaryLines = New-CycleSummaryMd `
    -Project          $Project `
    -Mode             $Mode `
    -Branch           $branch `
    -Cmd              $Cmd `
    -Plan             $Plan `
    -Note             $Note `
    -ExitCode         $exitCode `
    -ResultClass      $resultClass `
    -RunLogPath       (if ($latestRunLog)   { $latestRunLog.FullName }   else { "" }) `
    -ErrLogPath       (if ($latestErrLog)   { $latestErrLog.FullName }   else { "" }) `
    -ArtifactPath     (if ($latestArtifact) { $latestArtifact.FullName } else { "" }) `
    -CycleSummaryPath $cycleSummaryPath `
    -CommitHash       $commitHash `
    -ElapsedSec       $elapsed

[System.IO.File]::WriteAllLines(
    $cycleSummaryPath,
    $summaryLines,
    [System.Text.Encoding]::UTF8
)

# =========================================================================
# [8] Structured final output
# =========================================================================
$cwd = (Get-Location).Path

Write-Host ""
Write-Sep
Write-Host ("  AUTO-LOOP : CYCLE DONE  |  {0}s" -f $elapsed)
Write-Sep
Write-Host ""

# --- RESULT ---
$resultLabel = switch ($resultClass) {
    "SUCCESS" { "[OK]  SUCCESS" }
    "WARNING" { "[!!]  WARNING  (command succeeded but warnings found)" }
    "FAILURE" { "[NG]  FAILURE" }
    default   { "[??]  $resultClass" }
}
Write-Host "## RESULT"
Write-Host ("  {0}  (exit {1})" -f $resultLabel, $exitCode)
Write-Host ""

# --- LOG PATHS ---
Write-Host "## LOG PATHS"
Write-Host ("  Cycle    : {0}" -f $cycleSummaryPath)
Write-Host ("  Run      : {0}" -f $(if ($latestRunLog)   { $latestRunLog.FullName }   else { "(none)" }))
Write-Host ("  Error    : {0}" -f $(if ($latestErrLog)   { $latestErrLog.FullName }   else { "(none)" }))
Write-Host ("  Artifact : {0}" -f $(if ($latestArtifact) { $latestArtifact.FullName } else { "(none)" }))
Write-Host ""

# --- ERROR SUMMARY (failure only) ---
if ($resultClass -eq "FAILURE") {
    Write-Host "## ERROR SUMMARY"
    if ($latestErrLog) {
        try {
            $errContent = @(Get-Content $latestErrLog.FullName -Encoding UTF8 -ErrorAction SilentlyContinue)
            $stderrLines = @($errContent | Where-Object { $_ -match '^\[STDERR\]' } | Select-Object -First 5)
            if ($stderrLines.Count -gt 0) {
                Write-Host "  STDERR (first 5 lines):"
                foreach ($l in $stderrLines) {
                    Write-Host ("    {0}" -f ($l -replace '^\[STDERR\] ', ''))
                }
            } else {
                Write-Host "  (no STDERR lines extracted -- see full error log)"
            }
        } catch {}
        Write-Host ("  Full error : {0}" -f $latestErrLog.FullName)
    } else {
        Write-Host "  (no error log -- check logs\error\)"
    }
    if ($latestArtifact) {
        Write-Host ""
        Write-Host ("  [AI REPORT] {0}" -f $latestArtifact.FullName)
        Write-Host "  Paste this file to Claude for root cause analysis."
    }
    Write-Host ""
}

# --- FIX NEXT ---
Write-Host "## FIX NEXT"
$rerunNote = if ($Note) { " -Note `"$Note`"" } else { "" }
switch ($resultClass) {
    "SUCCESS" {
        Write-Host "  No fix needed -- cycle succeeded."
        if ($Note) { Write-Host ("  Note saved: `"{0}`"" -f $Note) }
    }
    "WARNING" {
        Write-Host "  Review warnings in run log, fix if needed:"
        Write-Host ("  {0}" -f $(if ($latestRunLog) { $latestRunLog.FullName } else { "logs\run\" }))
        Write-Host "  Then continue to GIT NEXT."
    }
    "FAILURE" {
        Write-Host "  Step 1 -- Diagnose (paste AI REPORT to Claude for analysis):"
        if ($latestArtifact) {
            Write-Host ("    {0}" -f $latestArtifact.FullName)
        } else {
            Write-Host ("    cd {0}" -f $cwd)
            Write-Host ("    scripts\analyze-error.ps1 -LogDir {0}" -f $LogDir)
        }
        Write-Host "  Step 2 -- Fix the root cause"
        Write-Host "  Step 3 -- Re-run this cycle:"
        Write-Host ("    cd {0}" -f $cwd)
        Write-Host ("    scripts\auto-loop.ps1 -Cmd `"{0}`"{1}" -f $Cmd, $rerunNote)
    }
}
Write-Host ""

# --- GIT NEXT ---
Write-Host "## GIT NEXT"
if ($resultClass -in @("SUCCESS", "WARNING")) {
    if ($commitHash) {
        Write-Host ("  Committed : {0}" -f $commitHash)
        if ($Push) { Write-Host "  Pushed to remote." }
        try {
            $st = (git status --short 2>&1)
            if ($st) { Write-Host ("  Status    : {0}" -f ($st | Out-String).Trim()) }
            else     { Write-Host "  Status    : clean (nothing to commit)" }
        } catch {}
    } else {
        Write-Host "  No commit was made. To commit:"
        Write-Host ("    cd {0}" -f $cwd)
        Write-Host "    scripts\git-safe-commit.ps1 -Message `"feat: <describe change>`" -Push"
    }
} else {
    Write-Host "  No commit (cycle did not succeed)."
    Write-Host "  Fix the issue first, then commit."
}
Write-Host ""
Write-Sep
Write-Host ""

exit $exitCode
