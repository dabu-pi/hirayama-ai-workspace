#Requires -Version 5.1
<#
.SYNOPSIS
    AI Development Automatic Loop -- auto-loop.ps1 v2

    Full autonomous development loop:
      - Multi-task sequential execution (-Cmd / -Tasks / -TaskFile / -FromRoadmap)
      - Pre-flight STOP check per task (API keys / credentials / destructive ops)
      - Error handling with auto-retry via analyze-error.ps1
      - Per-task AI REPORT generation on failure
      - Optional git-safe-commit after each successful task
      - Loop summary saved to logs/notes/loop_TIMESTAMP.md
      - Structured output: RESULT / TASK BREAKDOWN / LOG PATHS / FIX NEXT / GIT NEXT

.DESCRIPTION
    Loop flow (per task):
      Check-StopConditions
      -> Execute-AutoTask (wraps auto-dev.ps1)
           -> SUCCESS / WARNING: Write-AutoLog + note + (optional commit) + next task
           -> FAILURE: Handle-Error (analyze-error.ps1 + AI REPORT) -> retry
                 -> retry SUCCESS: note + (optional commit) + next task
                 -> retry FAILURE: log + skip (or abort if -AbortOnFailure)

    Task sources (pick one):
      -Cmd          Single command string (v1 backward compatible)
      -Tasks        Inline array of strings or task hashtables
      -TaskFile     Path to tasks.json
      -FromRoadmap  List pending tasks from ROADMAP.md (no execution)

    Required Functions:
      Start-AutoLoop      -- main loop orchestrator
      Execute-AutoTask    -- runs one task via auto-dev.ps1, classifies result
      Handle-Error        -- calls analyze-error.ps1, decides retry or give_up
      Write-AutoLog       -- structured timestamped log (file + console)
      Check-StopConditions -- STOP guard (API keys / credentials / destructive ops)

.PARAMETER Project
    Project name recorded in loop summary (e.g., "freee-automation").

.PARAMETER Cmd
    Single command to execute (v1 compat). Mutually exclusive with -Tasks/-TaskFile/-FromRoadmap.

.PARAMETER Note
    Work memo for single-task mode (-Cmd).

.PARAMETER Plan
    Plan description for single-task mode (-Cmd).

.PARAMETER Tag
    Note tag (default: done).

.PARAMETER CommitMsg
    Commit message for single-task mode.

.PARAMETER CommitFiles
    Files to stage for commit in single-task mode.

.PARAMETER Tasks
    Inline array of tasks. Each element can be:
      - a string: treated as Cmd
      - a hashtable: @{ Cmd="..."; Note="..."; Plan="..."; Tag="..."; CommitMsg="..."; CommitFiles=@() }

.PARAMETER TaskFile
    Path to a JSON task file.
    Schema: [{ "cmd":"...", "note":"...", "plan":"...", "tag":"...", "commitMsg":"...", "commitFiles":[] }]

.PARAMETER FromRoadmap
    Parse ROADMAP.md for pending tasks and display them (does not execute).

.PARAMETER RoadmapPath
    Path to ROADMAP.md (default: ROADMAP.md in current directory).

.PARAMETER Mode
    "workspace" (default, stricter STOP checks) or "sandbox" (relaxed).

.PARAMETER MaxRetry
    Maximum retry attempts per task on failure (default: 1).

.PARAMETER Commit
    Run git-safe-commit.ps1 after each successful task.

.PARAMETER Push
    Push after each commit.

.PARAMETER AbortOnFailure
    Abort the entire loop if any task fails after all retries.
    Default: skip failed task and continue to next.

.PARAMETER DryRun
    Show the task plan without executing anything.

.PARAMETER LogDir
    Log root directory (default: logs).

.PARAMETER SkipStopCheck
    Bypass STOP check. Use only when the command is confirmed safe.

.EXAMPLE
    # Single task (v1 compat)
    .\scripts\auto-loop.ps1 -Cmd "python -m pytest tests/ -v" -Note "TC-01 pass"

    # Multi-task inline
    .\scripts\auto-loop.ps1 -Project "freee" -Tasks @(
        @{ Cmd="python validate.py"; Plan="Validate inputs"; Note="OK" },
        @{ Cmd="python -m pytest";   Plan="Run tests";       Note="all pass" }
    )

    # Task file
    .\scripts\auto-loop.ps1 -Project "freee" -TaskFile "scripts\tasks.json" -Commit -Push

    # List ROADMAP pending tasks (no execution)
    .\scripts\auto-loop.ps1 -FromRoadmap

    # Dry run
    .\scripts\auto-loop.ps1 -TaskFile "scripts\tasks.json" -DryRun

    # With abort on first failure
    .\scripts\auto-loop.ps1 -Tasks @("cmd1","cmd2","cmd3") -AbortOnFailure

.NOTES
    Exit codes:
      0  = All tasks succeeded (SUCCESS or WARNING)
      1  = One or more tasks failed (partial failure)
      2  = All tasks failed
      99 = STOP condition triggered (blocked before execution)

    PS 5.1 only. All string literals in this source are ASCII-safe (no embedded Unicode).
#>

param(
    [string]   $Project       = "",

    # --- Single-task mode (v1 compat) ---
    [Parameter(Position = 0)]
    [string]   $Cmd           = "",
    [string]   $Note          = "",
    [string]   $Plan          = "",
    [string]   $Tag           = "done",
    [string]   $CommitMsg     = "",
    [string[]] $CommitFiles   = @(),

    # --- Multi-task mode ---
    [object[]] $Tasks         = @(),
    [string]   $TaskFile      = "",
    [switch]   $FromRoadmap,
    [string]   $RoadmapPath   = "ROADMAP.md",

    # --- Behavior ---
    [string]   $Mode          = "workspace",
    [int]      $MaxRetry      = 1,
    [switch]   $Commit,
    [switch]   $Push,
    [switch]   $AbortOnFailure,
    [switch]   $DryRun,
    [string]   $LogDir        = "logs",
    [switch]   $SkipStopCheck
)

# =========================================================================
# Script resolution
# =========================================================================
$sd = if ($PSScriptRoot) { $PSScriptRoot } else {
    Split-Path -Parent $MyInvocation.MyCommand.Path
}
$autoDevScript    = Join-Path $sd "auto-dev.ps1"
$analyzeErrScript = Join-Path $sd "analyze-error.ps1"

if (-not (Test-Path $autoDevScript)) {
    Write-Error "Required script not found: $autoDevScript"
    exit 1
}

# =========================================================================
# Metadata
# =========================================================================
$LOOP_VERSION = "2.0"
$loopStart    = Get-Date

# =========================================================================
# STOP condition patterns
# =========================================================================

# Blocked in any mode
$STOP_CMD_PATTERNS = @(
    'api[_\-]?key\s*=',
    '(client|app)[_\-]?secret\s*=',
    'password\s*=',
    '\.env\b',
    'service_account',
    'credentials\.json',
    'DELETE\s+FROM',
    'DROP\s+(TABLE|DATABASE|SCHEMA)',
    'rm\s+-rf\s+[/\\]',
    'Format-Volume',
    'Clear-Disk'
)

# Blocked in commit file names (any mode)
$STOP_COMMIT_PATTERNS = @(
    '\.env$', '\.env\.',
    'service_account\.json',
    'credentials\.json',
    'token\.json',
    '\.pem$', '\.key$',
    'id_rsa$', 'id_ed25519$',
    '\.pfx$', '\.p12$'
)

# Additional destructive-op patterns blocked in workspace mode
$STOP_WORKSPACE_PATTERNS = @(
    'Remove-Item.+\-Recurse.+\-Force',
    'rmdir\s+/[sS]',
    'del\s+/[sS]'
)

# Warning indicators in run log output
$WARN_LOG_PATTERNS = @(
    '^\[STDERR\].*[Ww]arning',
    'DeprecationWarning',
    'UserWarning',
    'FutureWarning',
    'PendingDeprecationWarning',
    'RuntimeWarning'
)

# =========================================================================
# FUNCTIONS
# =========================================================================

# -------------------------------------------------------------------------
# Check-StopConditions
#   Returns a STOP reason string, or $null if safe to proceed.
# -------------------------------------------------------------------------
function Check-StopConditions {
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

# -------------------------------------------------------------------------
# Write-AutoLog
#   Writes a timestamped, leveled log line to console and optionally to file.
# -------------------------------------------------------------------------
function Write-AutoLog {
    param(
        [string] $Message,
        [string] $Level   = "INFO",
        [string] $LogPath = ""
    )
    $ts   = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
    $line = "[$ts] [$Level] $Message"
    Write-Host $line
    if ($LogPath) {
        try {
            Add-Content -Path $LogPath -Value $line -Encoding UTF8 -ErrorAction SilentlyContinue
        } catch {}
    }
}

# -------------------------------------------------------------------------
# Get-ResultClass  (internal helper)
# -------------------------------------------------------------------------
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

# -------------------------------------------------------------------------
# Execute-AutoTask
#   Runs one task via auto-dev.ps1, finds new logs, classifies result.
#   Returns hashtable: { ExitCode, Result, RunLog, ErrLog, Artifact }
# -------------------------------------------------------------------------
function Execute-AutoTask {
    param(
        [hashtable] $Task,
        [string]    $LogDir,
        [bool]      $DoCommit = $false,
        [bool]      $DoPush   = $false,
        [string]    $LogPath  = ""
    )

    $tCmd   = [string]($Task.Cmd)
    $tNote  = if ($Task.Note)        { [string]($Task.Note) }        else { "" }
    $tPlan  = if ($Task.Plan)        { [string]($Task.Plan) }        else { "" }
    $tTag   = if ($Task.Tag)         { [string]($Task.Tag) }         else { "done" }
    $tCmsg  = if ($Task.CommitMsg)   { [string]($Task.CommitMsg) }   else { "" }
    $tCf    = if ($Task.CommitFiles) { @($Task.CommitFiles) }        else { @() }

    # Snapshot existing logs before execution
    $runLogDir = Join-Path $LogDir "run"
    $artDir    = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) "artifacts"))

    $priorRun = @(
        if (Test-Path $runLogDir) {
            Get-ChildItem $runLogDir -Filter "run_*.log" -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty FullName
        }
    )
    $priorArt = @(
        if (Test-Path $artDir) {
            Get-ChildItem $artDir -Filter "debug_*.txt" -ErrorAction SilentlyContinue |
            Select-Object -ExpandProperty FullName
        }
    )

    # Build auto-dev.ps1 parameters
    $adp = @{ Cmd = $tCmd; LogDir = $LogDir; Tag = $tTag }
    if ($tNote)          { $adp.Note        = $tNote }
    if ($tPlan)          { $adp.Plan        = $tPlan }
    if ($DoCommit)       { $adp.Commit      = $true }
    if ($tCmsg)          { $adp.CommitMsg   = $tCmsg }
    if ($tCf.Count -gt 0){ $adp.CommitFiles = $tCf }
    if ($DoPush)         { $adp.Push        = $true }

    Write-AutoLog -Message ("Execute: {0}" -f $tCmd) -Level "INFO" -LogPath $LogPath

    & $autoDevScript @adp
    $ec = if ($null -ne $LASTEXITCODE) { $LASTEXITCODE } else { 0 }

    # Find newly generated run log
    $newRun = $null
    if (Test-Path $runLogDir) {
        $newRuns = @(
            Get-ChildItem $runLogDir -Filter "run_*.log" -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -notin $priorRun } |
            Sort-Object LastWriteTime -Descending
        )
        $newRun = if ($newRuns.Count -gt 0) { $newRuns[0] } else {
            Get-ChildItem $runLogDir -Filter "run_*.log" -ErrorAction SilentlyContinue |
            Sort-Object LastWriteTime -Descending | Select-Object -First 1
        }
    }

    # Find newly generated AI artifact
    $newArt = $null
    if (Test-Path $artDir) {
        $newArts = @(
            Get-ChildItem $artDir -Filter "debug_*.txt" -ErrorAction SilentlyContinue |
            Where-Object { $_.FullName -notin $priorArt } |
            Sort-Object LastWriteTime -Descending
        )
        $newArt = if ($newArts.Count -gt 0) { $newArts[0] } else { $null }
    }

    # Latest error log
    $errLogDir = Join-Path $LogDir "error"
    $latestErr = $null
    if (Test-Path $errLogDir) {
        $latestErr = Get-ChildItem $errLogDir -Filter "error_*.log" -ErrorAction SilentlyContinue |
                     Sort-Object LastWriteTime -Descending | Select-Object -First 1
    }

    # Classify result
    $logLines = @()
    if ($newRun) {
        try { $logLines = @(Get-Content $newRun.FullName -Encoding UTF8 -ErrorAction SilentlyContinue) } catch {}
    }
    $rc = Get-ResultClass -ExitCode $ec -LogLines $logLines

    return @{
        ExitCode = $ec
        Result   = $rc
        RunLog   = if ($newRun)    { $newRun.FullName }    else { "" }
        ErrLog   = if ($latestErr) { $latestErr.FullName } else { "" }
        Artifact = if ($newArt)    { $newArt.FullName }    else { "" }
    }
}

# -------------------------------------------------------------------------
# Handle-Error
#   Invokes analyze-error.ps1 to generate AI REPORT.
#   Returns: "retry" | "give_up"
# -------------------------------------------------------------------------
function Handle-Error {
    param(
        [hashtable] $Task,
        [hashtable] $ExecResult,
        [int]       $AttemptNum,
        [int]       $MaxRetry,
        [string]    $LogPath,
        [string]    $LogDir
    )

    Write-AutoLog `
        -Message ("FAIL  attempt={0}/{1}  exit={2}  cmd={3}" -f `
                  $AttemptNum, ($MaxRetry + 1), $ExecResult.ExitCode, $Task.Cmd) `
        -Level   "ERROR" `
        -LogPath $LogPath

    # Invoke analyze-error.ps1 to generate AI REPORT for root cause analysis
    if (Test-Path $analyzeErrScript) {
        Write-AutoLog -Message "Invoking analyze-error.ps1 for AI REPORT..." -Level "INFO" -LogPath $LogPath
        try {
            & $analyzeErrScript -LogDir $LogDir 2>&1 | Out-Null
        } catch {}
        Write-AutoLog -Message "analyze-error.ps1 complete." -Level "INFO" -LogPath $LogPath
    }

    if ($ExecResult.Artifact) {
        Write-AutoLog `
            -Message ("AI REPORT ready: {0}  -> paste to Claude for root cause analysis" -f $ExecResult.Artifact) `
            -Level   "INFO" `
            -LogPath $LogPath
    } elseif ($ExecResult.ErrLog) {
        Write-AutoLog `
            -Message ("Error log: {0}" -f $ExecResult.ErrLog) `
            -Level   "INFO" `
            -LogPath $LogPath
    }

    if ($AttemptNum -le $MaxRetry) {
        Write-AutoLog -Message "Scheduling retry..." -Level "WARN" -LogPath $LogPath
        return "retry"
    }

    Write-AutoLog -Message "Max retries reached -- giving up on this task." -Level "ERROR" -LogPath $LogPath
    return "give_up"
}

# -------------------------------------------------------------------------
# Read-TaskFile
#   Parses a JSON task file and returns an array of task hashtables.
# -------------------------------------------------------------------------
function Read-TaskFile {
    param([string] $Path)

    if (-not (Test-Path $Path)) {
        Write-Error "Task file not found: $Path"
        return @()
    }

    try {
        $raw = Get-Content $Path -Raw -Encoding UTF8
        $arr = $raw | ConvertFrom-Json
        $out = @()
        foreach ($item in $arr) {
            $t = @{ Cmd = [string]$item.cmd }
            if ($item.note)        { $t.Note        = [string]$item.note }
            if ($item.plan)        { $t.Plan        = [string]$item.plan }
            if ($item.tag)         { $t.Tag         = [string]$item.tag }
            if ($item.commitMsg)   { $t.CommitMsg   = [string]$item.commitMsg }
            if ($item.commitFiles) { $t.CommitFiles = @($item.commitFiles) }
            $out += $t
        }
        return $out
    } catch {
        Write-Error "Failed to parse task file: $Path / $_"
        return @()
    }
}

# -------------------------------------------------------------------------
# Get-RoadmapPendingTasks
#   Parses ROADMAP.md and returns pending (waiting) tasks as display objects.
#   Uses [char]0x23F8 (the waiting/pause character) at runtime to avoid
#   embedding non-ASCII in source.
# -------------------------------------------------------------------------
function Get-RoadmapPendingTasks {
    param([string] $Path)

    if (-not (Test-Path $Path)) {
        Write-Host "ROADMAP not found: $Path"
        return @()
    }

    $waitChar = [string][char]0x23F8   # the hourglass/pause marker used in ROADMAP.md
    $lines    = @(Get-Content $Path -Encoding UTF8 -ErrorAction SilentlyContinue)
    $pending  = @()
    $section  = ""

    foreach ($line in $lines) {
        if ($line -match '^#+\s+(.+)') { $section = $Matches[1].Trim() }
        if ($line.TrimStart().StartsWith('|') -and $line.IndexOf($waitChar) -ge 0) {
            $cols = $line -split '\|' |
                    ForEach-Object { $_.Trim() } |
                    Where-Object   { $_ -ne "" }
            if ($cols.Count -ge 2) {
                $pending += @{
                    Section = $section
                    Task    = $cols[1]
                    Raw     = $line.Trim()
                }
            }
        }
    }
    return $pending
}

# -------------------------------------------------------------------------
# New-LoopSummaryMd
#   Generates Markdown lines for the loop summary file.
# -------------------------------------------------------------------------
function New-LoopSummaryMd {
    param(
        [string]   $Project,
        [string]   $Mode,
        [string]   $Branch,
        [DateTime] $StartTime,
        [object[]] $TaskResults,
        [int]      $TotalSec,
        [string]   $OverallResult,
        [string]   $LogPath,
        [string]   $SummaryPath
    )

    $ts     = $StartTime.ToString("yyyy-MM-dd HH:mm:ss")
    $ok     = @($TaskResults | Where-Object { $_.Result -in @("SUCCESS","WARNING") }).Count
    $fail   = @($TaskResults | Where-Object { $_.Result -eq "FAILURE" }).Count
    $stop   = @($TaskResults | Where-Object { $_.Result -eq "STOP" }).Count
    $projTx = if ($Project) { $Project } else { "(not specified)" }

    $lines = @(
        "# Auto-Loop Summary",
        "",
        ("Generated     : {0}" -f $ts),
        ("Version       : {0}" -f $LOOP_VERSION),
        ("Project       : {0}" -f $projTx),
        ("Mode          : {0}" -f $Mode),
        ("Branch        : {0}" -f $Branch),
        ("Elapsed       : {0}s" -f $TotalSec),
        ("Overall Result: {0}" -f $OverallResult),
        ("Tasks         : {0} total / {1} ok / {2} failed / {3} stopped" -f `
          $TaskResults.Count, $ok, $fail, $stop),
        "",
        "## Task Details",
        ""
    )

    $i = 1
    foreach ($r in $TaskResults) {
        $icon = switch ($r.Result) {
            "SUCCESS" { "[OK]"   }
            "WARNING" { "[!!]"   }
            "FAILURE" { "[NG]"   }
            "STOP"    { "[STOP]" }
            "SKIPPED" { "[--]"   }
            default   { "[??]"   }
        }
        $lines += ("### Task {0}  {1}  {2}" -f $i, $icon, $r.Result)
        $lines += ""
        $lines += ("Command  : {0}" -f $r.Cmd)
        if ($r.Plan)     { $lines += ("Plan     : {0}" -f $r.Plan) }
        if ($r.Note)     { $lines += ("Note     : {0}" -f $r.Note) }
        $lines += ("Exit     : {0}  Attempts: {1}" -f $r.ExitCode, $r.Attempts)
        if ($r.RunLog)   { $lines += ("RunLog   : {0}" -f $r.RunLog) }
        if ($r.ErrLog)   { $lines += ("ErrLog   : {0}" -f $r.ErrLog) }
        if ($r.Artifact) { $lines += ("AI Report: {0}" -f $r.Artifact) }
        $lines += ""
        $i++
    }

    $lines += "## Fix Next"
    $lines += ""
    $failed = @($TaskResults | Where-Object { $_.Result -eq "FAILURE" })
    if ($failed.Count -gt 0) {
        foreach ($r in $failed) {
            $lines += ("- [ ] Fix: {0}" -f $r.Cmd)
            if ($r.Artifact) { $lines += ("  - AI Report: {0}" -f $r.Artifact) }
        }
    } else {
        $lines += "All tasks succeeded."
    }

    $lines += ""
    $lines += "## Log Files"
    $lines += ""
    $lines += ("Loop log : {0}" -f $LogPath)
    $lines += ("This file: {0}" -f $SummaryPath)
    $lines += ""
    $lines += "---"
    $lines += ("*auto-loop.ps1 v{0}*" -f $LOOP_VERSION)

    return $lines
}

# -------------------------------------------------------------------------
# Separator helpers
# -------------------------------------------------------------------------
function Write-Sep  { Write-Host ("=" * 72) }
function Write-Sep2 { Write-Host ("  " + "-" * 68) }

# =========================================================================
# Start-AutoLoop  --  main loop orchestrator
# =========================================================================
function Start-AutoLoop {
    param(
        [object[]] $TaskList,
        [string]   $Project,
        [string]   $Mode,
        [string]   $LogDir,
        [int]      $MaxRetry,
        [bool]     $DoCommit,
        [bool]     $DoPush,
        [bool]     $DoAbortOnFailure,
        [bool]     $DoSkipStopCheck,
        [bool]     $IsDryRun
    )

    $branch = "n/a"
    try { $branch = (git rev-parse --abbrev-ref HEAD 2>&1).Trim() } catch {}

    # Init loop log directory and file
    $loopLogDir = Join-Path $LogDir "loop"
    if (-not (Test-Path $loopLogDir)) {
        New-Item -ItemType Directory -Path $loopLogDir -Force | Out-Null
    }
    $loopTs  = $loopStart.ToString("yyyyMMdd_HHmmss")
    $loopLog = [System.IO.Path]::GetFullPath(
        (Join-Path $loopLogDir ("loop_{0}.log" -f $loopTs))
    )

    # Header
    Write-Host ""
    Write-Sep
    Write-Host ("  AUTO-LOOP v{0}  |  {1}" -f $LOOP_VERSION, (Get-Date -Format "yyyy-MM-dd HH:mm:ss"))
    Write-Host ("  Project  : {0}" -f $(if ($Project) { $Project } else { "(unspecified)" }))
    Write-Host ("  Mode     : {0}" -f $Mode)
    Write-Host ("  Branch   : {0}" -f $branch)
    Write-Host ("  Tasks    : {0}" -f $TaskList.Count)
    Write-Host ("  MaxRetry : {0}" -f $MaxRetry)
    Write-Host ("  DryRun   : {0}" -f $IsDryRun)
    Write-Sep
    Write-Host ""

    Write-AutoLog `
        -Message ("LOOP START  project={0}  tasks={1}  mode={2}  dryrun={3}" -f `
                  $Project, $TaskList.Count, $Mode, $IsDryRun) `
        -Level   "INFO" `
        -LogPath $loopLog

    $taskResults = @()

    for ($i = 0; $i -lt $TaskList.Count; $i++) {

        # Normalize task to hashtable
        $rawTask = $TaskList[$i]
        $task = if ($rawTask -is [hashtable]) { $rawTask }
                elseif ($rawTask -is [string]) { @{ Cmd = $rawTask } }
                else { @{ Cmd = [string]$rawTask } }

        $tCmd  = [string]($task.Cmd)
        $tPlan = if ($task.Plan) { [string]($task.Plan) } else { "" }
        $tNote = if ($task.Note) { [string]($task.Note) } else { "" }

        Write-Host ""
        Write-Sep2
        Write-Host ("  Task {0}/{1}  |  {2}" -f ($i + 1), $TaskList.Count, $tCmd)
        if ($tPlan) { Write-Host ("  Plan: {0}" -f $tPlan) }
        Write-Sep2
        Write-Host ""

        Write-AutoLog `
            -Message ("TASK {0}/{1}: {2}" -f ($i + 1), $TaskList.Count, $tCmd) `
            -Level   "INFO" `
            -LogPath $loopLog

        # --- Dry run ---
        if ($IsDryRun) {
            Write-Host ("  [DRY RUN] Would execute: {0}" -f $tCmd)
            $taskResults += @{
                Cmd = $tCmd; Plan = $tPlan; Note = $tNote
                Result = "SKIPPED"; ExitCode = 0; Attempts = 0
                RunLog = ""; ErrLog = ""; Artifact = ""
            }
            continue
        }

        # --- STOP check ---
        if (-not $DoSkipStopCheck) {
            $tFiles     = if ($task.CommitFiles) { @($task.CommitFiles) } else { @() }
            $stopReason = Check-StopConditions -Cmd $tCmd -Files $tFiles -Mode $Mode

            if ($null -ne $stopReason) {
                Write-Host ""
                Write-Sep
                Write-Host "  [STOP]  Task blocked -- manual confirmation required"
                Write-Sep
                Write-Host ("  Cmd   : {0}" -f $tCmd)
                Write-Host ("  Reason: {0}" -f $stopReason)
                Write-Host ""
                Write-Host "  Options:"
                Write-Host "    a) Run scripts\auto-dev.ps1 directly after reviewing the command"
                Write-Host "    b) Re-run with -SkipStopCheck (only if 100% safe)"
                Write-Host ""
                Write-Sep
                Write-Host ""

                Write-AutoLog `
                    -Message ("STOP  reason={0}" -f $stopReason) `
                    -Level   "STOP" `
                    -LogPath $loopLog

                $taskResults += @{
                    Cmd = $tCmd; Plan = $tPlan; Note = $tNote
                    Result = "STOP"; ExitCode = 99; Attempts = 0
                    RunLog = ""; ErrLog = ""; Artifact = ""
                }
                exit 99
            }
        }

        # --- Execute with retry ---
        $attempt     = 1
        $finalResult = $null

        while ($attempt -le ($MaxRetry + 1)) {

            if ($attempt -gt 1) {
                Write-Host ""
                Write-Host ("  [RETRY]  Attempt {0} of {1}" -f $attempt, ($MaxRetry + 1))
                Write-Host ""
                Write-AutoLog `
                    -Message ("RETRY  attempt={0}" -f $attempt) `
                    -Level   "WARN" `
                    -LogPath $loopLog
            }

            $execR = Execute-AutoTask `
                -Task      $task `
                -LogDir    $LogDir `
                -DoCommit  $DoCommit `
                -DoPush    $DoPush `
                -LogPath   $loopLog

            if ($execR.Result -in @("SUCCESS", "WARNING")) {
                $finalResult = $execR
                Write-AutoLog `
                    -Message ("TASK OK  result={0}  exit={1}" -f $execR.Result, $execR.ExitCode) `
                    -Level   "INFO" `
                    -LogPath $loopLog
                break
            }

            $decision = Handle-Error `
                -Task       $task `
                -ExecResult $execR `
                -AttemptNum $attempt `
                -MaxRetry   $MaxRetry `
                -LogPath    $loopLog `
                -LogDir     $LogDir

            if ($decision -eq "give_up") {
                $finalResult = $execR
                break
            }
            $attempt++
        }

        if ($null -eq $finalResult) {
            $finalResult = @{ Result = "FAILURE"; ExitCode = 1; RunLog = ""; ErrLog = ""; Artifact = "" }
        }

        $taskResults += @{
            Cmd      = $tCmd
            Plan     = $tPlan
            Note     = $tNote
            Result   = $finalResult.Result
            ExitCode = $finalResult.ExitCode
            Attempts = $attempt
            RunLog   = $finalResult.RunLog
            ErrLog   = $finalResult.ErrLog
            Artifact = $finalResult.Artifact
        }

        if ($finalResult.Result -eq "FAILURE" -and $DoAbortOnFailure) {
            Write-Host ""
            Write-Host "  [ABORT]  Task failed and -AbortOnFailure is set. Stopping loop."
            Write-AutoLog `
                -Message "ABORT: -AbortOnFailure triggered after task failure" `
                -Level   "ERROR" `
                -LogPath $loopLog
            break
        }
    }

    # --- Compute totals ---
    $totalSec = [int]((Get-Date) - $loopStart).TotalSeconds
    $okCnt    = @($taskResults | Where-Object { $_.Result -in @("SUCCESS","WARNING") }).Count
    $failCnt  = @($taskResults | Where-Object { $_.Result -eq "FAILURE" }).Count
    $stopCnt  = @($taskResults | Where-Object { $_.Result -eq "STOP" }).Count

    $overall = if     ($stopCnt -gt 0)                       { "STOP" }
               elseif ($failCnt -eq $taskResults.Count)      { "ALL_FAILED" }
               elseif ($failCnt -gt 0)                       { "PARTIAL_FAILURE" }
               elseif ($okCnt   -eq $taskResults.Count)      { "ALL_SUCCESS" }
               else                                          { "PARTIAL_SUCCESS" }

    # --- Save loop summary ---
    $notesDir = Join-Path $LogDir "notes"
    if (-not (Test-Path $notesDir)) {
        New-Item -ItemType Directory -Path $notesDir -Force | Out-Null
    }
    $summaryPath  = [System.IO.Path]::GetFullPath(
        (Join-Path $notesDir ("loop_{0}.md" -f $loopTs))
    )
    $summaryLines = New-LoopSummaryMd `
        -Project       $Project `
        -Mode          $Mode `
        -Branch        $branch `
        -StartTime     $loopStart `
        -TaskResults   $taskResults `
        -TotalSec      $totalSec `
        -OverallResult $overall `
        -LogPath       $loopLog `
        -SummaryPath   $summaryPath

    [System.IO.File]::WriteAllLines(
        $summaryPath,
        $summaryLines,
        [System.Text.Encoding]::UTF8
    )

    Write-AutoLog `
        -Message ("LOOP END  result={0}  ok={1}  fail={2}  elapsed={3}s" -f `
                  $overall, $okCnt, $failCnt, $totalSec) `
        -Level   "INFO" `
        -LogPath $loopLog

    # =====================================================================
    # Structured final output
    # =====================================================================
    $cwd = (Get-Location).Path

    Write-Host ""
    Write-Sep
    Write-Host ("  AUTO-LOOP : LOOP DONE  |  {0}s" -f $totalSec)
    Write-Sep
    Write-Host ""

    # RESULT
    Write-Host "## RESULT"
    $rl = switch ($overall) {
        "ALL_SUCCESS"      { "[OK]   ALL_SUCCESS  ({0}/{1} tasks ok)"   -f $okCnt,   $taskResults.Count }
        "PARTIAL_SUCCESS"  { "[!!]   PARTIAL_SUCCESS  ({0}/{1} ok)"     -f $okCnt,   $taskResults.Count }
        "PARTIAL_FAILURE"  { "[NG]   PARTIAL_FAILURE  ({0}/{1} failed)" -f $failCnt, $taskResults.Count }
        "ALL_FAILED"       { "[NG]   ALL_FAILED" }
        "STOP"             { "[STOP] STOP triggered" }
        default            { "[??]   $overall" }
    }
    Write-Host ("  {0}" -f $rl)
    Write-Host ""

    # TASK BREAKDOWN
    Write-Host "## TASK BREAKDOWN"
    for ($j = 0; $j -lt $taskResults.Count; $j++) {
        $r    = $taskResults[$j]
        $icon = switch ($r.Result) {
            "SUCCESS" { "[OK]"   }; "WARNING" { "[!!]"   }; "FAILURE" { "[NG]"   }
            "STOP"    { "[STOP]" }; "SKIPPED" { "[--]"   }; default   { "[??]"   }
        }
        Write-Host ("  {0} Task {1}: {2}  (exit={3}  attempts={4})" -f `
                    $icon, ($j + 1), $r.Result, $r.ExitCode, $r.Attempts)
        Write-Host ("      Cmd : {0}" -f $r.Cmd)
        if ($r.Artifact) { Write-Host ("      AI  : {0}" -f $r.Artifact) }
    }
    Write-Host ""

    # LOG PATHS
    Write-Host "## LOG PATHS"
    Write-Host ("  Loop log : {0}" -f $loopLog)
    Write-Host ("  Summary  : {0}" -f $summaryPath)
    Write-Host ""

    # FIX NEXT
    Write-Host "## FIX NEXT"
    $failedTasks = @($taskResults | Where-Object { $_.Result -eq "FAILURE" })
    if ($failedTasks.Count -gt 0) {
        Write-Host "  Failed tasks requiring attention:"
        foreach ($r in $failedTasks) {
            Write-Host ("  [NG] {0}" -f $r.Cmd)
            if ($r.Artifact) {
                Write-Host ("    -> AI REPORT (paste to Claude): {0}" -f $r.Artifact)
            } elseif ($r.ErrLog) {
                Write-Host ("    -> Run: scripts\analyze-error.ps1 -LogDir {0}" -f $LogDir)
            }
            Write-Host ("    -> Retry: .\scripts\auto-loop.ps1 -Cmd `"{0}`"" -f $r.Cmd)
        }
    } else {
        Write-Host "  All tasks succeeded. No fix needed."
    }
    Write-Host ""

    # GIT NEXT
    Write-Host "## GIT NEXT"
    if ($overall -in @("ALL_SUCCESS","PARTIAL_SUCCESS")) {
        if ($DoCommit) {
            Write-Host "  Commits were made per task during the loop."
        } else {
            Write-Host "  No commits made. To commit successful changes:"
            Write-Host ("    cd {0}" -f $cwd)
            Write-Host "    scripts\git-safe-commit.ps1 -Message `"feat: <describe change>`" -Push"
        }
    } else {
        Write-Host "  Loop did not fully succeed. Fix failures first, then commit."
    }
    Write-Host ""
    Write-Sep
    Write-Host ""

    # Return exit code to caller (Main)
    if ($stopCnt -gt 0)                  { return 99 }
    if ($failCnt -eq $taskResults.Count) { return 2 }
    if ($failCnt -gt 0)                  { return 1 }
    return 0
}

# =========================================================================
# MAIN
# =========================================================================

# --- Build task list from input source ---
$taskList = @()

if ($Cmd) {
    # v1 single-task compat
    $t = @{ Cmd = $Cmd }
    if ($Note)                    { $t.Note        = $Note }
    if ($Plan)                    { $t.Plan        = $Plan }
    if ($Tag)                     { $t.Tag         = $Tag }
    if ($CommitMsg)               { $t.CommitMsg   = $CommitMsg }
    if ($CommitFiles.Count -gt 0) { $t.CommitFiles = $CommitFiles }
    $taskList = @($t)

} elseif ($Tasks.Count -gt 0) {
    $taskList = $Tasks

} elseif ($TaskFile) {
    $taskList = Read-TaskFile -Path $TaskFile
    if ($taskList.Count -eq 0) { exit 1 }

} elseif ($FromRoadmap) {
    # List pending tasks -- display only, no execution
    $pending = Get-RoadmapPendingTasks -Path $RoadmapPath
    Write-Host ""
    if ($pending.Count -eq 0) {
        Write-Host ("No pending tasks found in {0}" -f $RoadmapPath)
    } else {
        Write-Host ("Pending tasks in {0}  ({1} found):" -f $RoadmapPath, $pending.Count)
        Write-Host ""
        $n = 1
        foreach ($p in $pending) {
            Write-Host ("[{0}] Section : {1}" -f $n, $p.Section)
            Write-Host ("    Task    : {0}" -f $p.Task)
            Write-Host ""
            $n++
        }
        Write-Host "To execute a task:"
        Write-Host '  .\scripts\auto-loop.ps1 -Cmd "<command>" -Note "<note>" -Plan "<task name>"'
        Write-Host ""
        Write-Host "To run multiple tasks from a file:"
        Write-Host '  .\scripts\auto-loop.ps1 -TaskFile "scripts\tasks.json" -Project "myproject"'
    }
    exit 0

} else {
    Write-Error "Specify -Cmd, -Tasks, -TaskFile, or -FromRoadmap."
    exit 1
}

if ($taskList.Count -eq 0) {
    Write-Error "No tasks to execute."
    exit 1
}

# --- Run the loop ---
$exitCode = Start-AutoLoop `
    -TaskList         $taskList `
    -Project          $Project `
    -Mode             $Mode `
    -LogDir           $LogDir `
    -MaxRetry         $MaxRetry `
    -DoCommit         $Commit.IsPresent `
    -DoPush           $Push.IsPresent `
    -DoAbortOnFailure $AbortOnFailure.IsPresent `
    -DoSkipStopCheck  $SkipStopCheck.IsPresent `
    -IsDryRun         $DryRun.IsPresent

exit $exitCode
