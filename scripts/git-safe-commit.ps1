#Requires -Version 5.1
<#
.SYNOPSIS
    Safe git commit with pre-flight security checks and optional push.
    Detects secrets, log files, and direct main/master commits before proceeding.

.PARAMETER Message
    Commit message (required). Prefix with feat/fix/docs/refactor/test/chore.

.PARAMETER Files
    Files to stage. Omit to use already-staged files.

.PARAMETER Push
    Push to remote after commit.

.PARAMETER Remote
    Remote name (default: origin).

.PARAMETER SkipBranchWarn
    Suppress the direct-main/master commit warning.

.EXAMPLE
    .\git-safe-commit.ps1 -Message "feat: add quotation POST" -Files @("src/main.py") -Push
    .\git-safe-commit.ps1 -Message "docs: update README" -Push
    .\git-safe-commit.ps1 -Message "chore: update .gitignore" -Files @(".gitignore")
#>

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Message,

    [Parameter(Position = 1)]
    [string[]]$Files = @(),

    [switch]$Push,

    [string]$Remote = "origin",

    [switch]$SkipBranchWarn
)

Set-StrictMode -Version Latest

# -------------------------------------------------------------------------
# Constants
# -------------------------------------------------------------------------
$FORBIDDEN_PATTERNS = @(
    '\.env$',
    '\.env\.',
    'token\.json$',
    'token_.*\.json$',
    'service_account\.json$',
    'credentials\.json$',
    'client_secret.*\.json$',
    '\.pem$',
    '\.p12$',
    '\.pfx$',
    'id_rsa$',
    'id_ed25519$'
)

$LOG_DIR_PATTERNS = @(
    'logs[/\\]run[/\\]',
    'logs[/\\]error[/\\]',
    'artifacts[/\\]'
)

$VALID_PREFIXES = @('feat', 'fix', 'docs', 'refactor', 'test', 'chore', 'hotfix', 'style', 'perf', 'ci')

$CO_AUTHOR = "Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

# -------------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------------
function Write-Sep { Write-Host ("=" * 60) }

function Show-Check {
    param([string]$Label, [bool]$Pass, [string]$Detail = "")
    $mark = if ($Pass) { "[PASS]" } else { "[FAIL]" }
    Write-Host ("  {0} {1}" -f $mark, $Label)
    if (-not $Pass -and $Detail) {
        Write-Host "       $Detail"
    }
    return $Pass
}

# -------------------------------------------------------------------------
# Verify git is available
# -------------------------------------------------------------------------
try { $null = git --version 2>&1 }
catch {
    Write-Error "git not found. Install git and add it to PATH."
    exit 1
}

$gitRoot = git rev-parse --show-toplevel 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Error "Not a git repository: $(Get-Location)"
    exit 1
}

# -------------------------------------------------------------------------
# Header
# -------------------------------------------------------------------------
Write-Host ""
Write-Sep
Write-Host "  git-safe-commit"
Write-Sep

# -------------------------------------------------------------------------
# Current branch check (warn if on main/master)
# -------------------------------------------------------------------------
$currentBranch = (git rev-parse --abbrev-ref HEAD 2>&1).Trim()
Write-Host "  Branch  : $currentBranch"

if (-not $SkipBranchWarn -and ($currentBranch -eq "master" -or $currentBranch -eq "main")) {
    Write-Host ""
    Write-Host "  [WARN] Direct commit to '$currentBranch' detected."
    Write-Host "  Recommended: create a feature/fix branch first."
    Write-Host "    git checkout -b feature/your-feature"
    Write-Host ""
    $ans = Read-Host "  Continue commit to '$currentBranch'? [y/N]"
    if ($ans -notmatch '^[yY]') {
        Write-Host "  Aborted."
        exit 1
    }
}

# -------------------------------------------------------------------------
# Stage files (if -Files specified)
# -------------------------------------------------------------------------
if ($Files.Count -gt 0) {
    Write-Host ""
    Write-Host "  Staging files:"
    foreach ($f in $Files) {
        if (Test-Path $f) {
            git add $f
            Write-Host "    + $f"
        } else {
            Write-Host "    [WARN] Not found: $f"
        }
    }
}

# -------------------------------------------------------------------------
# Get list of staged files
# -------------------------------------------------------------------------
$stagedFiles = @(git diff --cached --name-only 2>&1 | Where-Object { $_ -ne "" })

if ($stagedFiles.Count -eq 0) {
    Write-Host ""
    Write-Host "  No staged files. Use -Files or git add manually."
    exit 1
}

# -------------------------------------------------------------------------
# Show git status summary
# -------------------------------------------------------------------------
Write-Host ""
Write-Host "  Staged files ($($stagedFiles.Count)):"
foreach ($f in $stagedFiles) {
    $stat = (git diff --cached --stat -- $f 2>&1 | Select-String '\d+ insertion' | Select-Object -First 1)
    Write-Host "    $f"
}

# Show diff stat summary
Write-Host ""
Write-Host "  Diff summary:"
$diffStat = git diff --cached --stat 2>&1
foreach ($line in $diffStat) {
    Write-Host "    $line"
}

# -------------------------------------------------------------------------
# Security checks
# -------------------------------------------------------------------------
Write-Host ""
Write-Host "  Security checks:"

$allClear = $true

# Forbidden files
$forbidden = @($stagedFiles | Where-Object {
    $f = $_
    $FORBIDDEN_PATTERNS | Where-Object { $f -match $_ }
})

$allClear = (Show-Check "No secret files" ($forbidden.Count -eq 0) `
    "BLOCKED: $($forbidden -join ', ')  -> git restore --staged <file>") -and $allClear

if ($forbidden.Count -gt 0) {
    foreach ($f in $forbidden) { Write-Host "       -> $f" }
}

# Log directory files
$logFiles = @($stagedFiles | Where-Object {
    $f = $_
    $LOG_DIR_PATTERNS | Where-Object { $f -match $_ }
})

$allClear = (Show-Check "No log/artifact files" ($logFiles.Count -eq 0) `
    "These should be in .gitignore: $($logFiles -join ', ')") -and $allClear

# Large batch warning (>30 files)
if ($stagedFiles.Count -gt 30) {
    Write-Host "  [WARN] $($stagedFiles.Count) files staged. Verify git add . was not used."
}

# Commit message prefix
$hasPrefix = $VALID_PREFIXES | Where-Object { $Message -match "^$_[:\(]" }
if (-not $hasPrefix) {
    Write-Host "  [WARN] No conventional prefix detected."
    Write-Host "         Suggest: feat / fix / docs / refactor / test / chore / hotfix"
    Write-Host ""
    # Suggest prefix based on file extensions
    $hasPy   = $stagedFiles | Where-Object { $_ -match '\.py$' }
    $hasMd   = $stagedFiles | Where-Object { $_ -match '\.md$' }
    $hasPs1  = $stagedFiles | Where-Object { $_ -match '\.ps1$' }
    $hasTest = $stagedFiles | Where-Object { $_ -match 'test' }
    $suggest = if ($hasTest)    { "test" }
               elseif ($hasMd)  { "docs" }
               elseif ($hasPs1) { "chore" }
               elseif ($hasPy)  { "feat" }
               else             { "chore" }
    Write-Host "         Suggested prefix for this change: '${suggest}:'"
}

# -------------------------------------------------------------------------
# Abort if checks failed
# -------------------------------------------------------------------------
if (-not $allClear) {
    Write-Host ""
    Write-Sep
    Write-Host "  ABORT: security check failed. Commit cancelled."
    Write-Sep
    Write-Host ""
    exit 1
}

# -------------------------------------------------------------------------
# Confirm commit
# -------------------------------------------------------------------------
Write-Host ""
Write-Host "  Commit message:"
Write-Host "    $Message"
Write-Host ""
$confirm = Read-Host "  Proceed with commit? [Y/n]"
if ($confirm -match '^[nN]') {
    Write-Host "  Cancelled."
    exit 0
}

# -------------------------------------------------------------------------
# Commit
# -------------------------------------------------------------------------
$fullMessage = "$Message`n`n$CO_AUTHOR"
git commit -m $fullMessage

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "  [ERROR] git commit failed (exit $LASTEXITCODE)"
    exit 1
}

$commitHash = (git rev-parse --short HEAD 2>&1).Trim()
Write-Host ""
Write-Host "  [OK] Committed: $commitHash -- $Message"

# -------------------------------------------------------------------------
# Push (optional)
# -------------------------------------------------------------------------
if ($Push) {
    Write-Host ""
    Write-Host "  Pushing to $Remote/$currentBranch ..."
    git push $Remote $currentBranch

    if ($LASTEXITCODE -ne 0) {
        Write-Host "  [ERROR] git push failed."
        Write-Host "  TIP: run 'git pull $Remote $currentBranch' then retry."
        exit 1
    }

    Write-Host "  [OK] Pushed to $Remote/$currentBranch"
}

Write-Host ""
Write-Sep
Write-Host "  Done: commit$(if ($Push) { ' + push' } else { '' }) succeeded ($commitHash)"
Write-Sep
Write-Host ""

exit 0
