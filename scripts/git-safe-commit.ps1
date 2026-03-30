#Requires -Version 5.1
<#+
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

.PARAMETER Yes
    Skip interactive confirmations.

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

    [switch]$SkipBranchWarn,

    [switch]$Yes
)

Set-StrictMode -Version Latest

$gitBaseArgs = @('-c', 'core.excludesfile=')

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
    'artifacts[/\\]',
    'logs[/\\]runlog[/\\]'
)

$VALID_PREFIXES = @('feat', 'fix', 'docs', 'refactor', 'test', 'chore', 'hotfix', 'style', 'perf', 'ci')
$CO_AUTHOR = 'Co-Authored-By: OpenAI Codex <noreply@openai.com>'

function Write-Sep { Write-Host ('=' * 60) }

function Invoke-GitLines {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    $output = & git @gitBaseArgs @Arguments 2>&1
    $filtered = @($output | Where-Object { $_ -and $_ -notmatch '^warning:' })
    return ,$filtered
}

function Show-Check {
    param([string]$Label, [bool]$Pass, [string]$Detail = '')
    $mark = if ($Pass) { '[PASS]' } else { '[FAIL]' }
    Write-Host ("  {0} {1}" -f $mark, $Label)
    if (-not $Pass -and $Detail) {
        Write-Host "       $Detail"
    }
    return $Pass
}

try { $null = Invoke-GitLines -Arguments @('--version') }
catch {
    Write-Error 'git not found. Install git and add it to PATH.'
    exit 1
}

$gitRoot = Invoke-GitLines -Arguments @('rev-parse', '--show-toplevel')
if ($LASTEXITCODE -ne 0) {
    Write-Error "Not a git repository: $(Get-Location)"
    exit 1
}

Write-Host ''
Write-Sep
Write-Host '  git-safe-commit'
Write-Sep

$currentBranch = ((Invoke-GitLines -Arguments @('rev-parse', '--abbrev-ref', 'HEAD')) -join "`n").Trim()
Write-Host "  Branch  : $currentBranch"

if (-not $SkipBranchWarn -and ($currentBranch -eq 'master' -or $currentBranch -eq 'main')) {
    Write-Host ''
    Write-Host "  [WARN] Direct commit to '$currentBranch' detected."
    Write-Host '  Recommended: create a feature/fix branch first.'
    Write-Host '    git checkout -b feature/your-feature'
    Write-Host ''
    if (-not $Yes) {
        $ans = Read-Host "  Continue commit to '$currentBranch'? [y/N]"
        if ($ans -notmatch '^[yY]') {
            Write-Host '  Aborted.'
            exit 1
        }
    }
}

if ($Files.Count -gt 0) {
    Write-Host ''
    Write-Host '  Staging files:'
    foreach ($f in $Files) {
        if (Test-Path $f) {
            & git @gitBaseArgs add $f
            Write-Host "    + $f"
        } else {
            Write-Host "    [WARN] Not found: $f"
        }
    }
}

$stagedFiles = Invoke-GitLines -Arguments @('diff', '--cached', '--name-only')

if ($stagedFiles.Count -eq 0) {
    Write-Host ''
    Write-Host '  No staged files. Use -Files or git add manually.'
    exit 1
}

Write-Host ''
Write-Host "  Staged files ($($stagedFiles.Count)):"
foreach ($f in $stagedFiles) {
    Write-Host "    $f"
}

Write-Host ''
Write-Host '  Diff summary:'
$diffStat = Invoke-GitLines -Arguments @('diff', '--cached', '--stat')
foreach ($line in $diffStat) {
    Write-Host "    $line"
}

Write-Host ''
Write-Host '  Security checks:'

$allClear = $true

$forbidden = @($stagedFiles | Where-Object {
    $f = $_
    $FORBIDDEN_PATTERNS | Where-Object { $f -match $_ }
})

$allClear = (Show-Check 'No secret files' ($forbidden.Count -eq 0) "BLOCKED: $($forbidden -join ', ')  -> git restore --staged <file>") -and $allClear

if ($forbidden.Count -gt 0) {
    foreach ($f in $forbidden) { Write-Host "       -> $f" }
}

$logFiles = @($stagedFiles | Where-Object {
    $f = $_
    $LOG_DIR_PATTERNS | Where-Object { $f -match $_ }
})

$allClear = (Show-Check 'No log/artifact files' ($logFiles.Count -eq 0) "These should be in .gitignore: $($logFiles -join ', ')") -and $allClear

if ($stagedFiles.Count -gt 30) {
    Write-Host "  [WARN] $($stagedFiles.Count) files staged. Verify git add . was not used."
}

$hasPrefix = $VALID_PREFIXES | Where-Object { $Message -match "^$_[:\(]" }
if (-not $hasPrefix) {
    Write-Host '  [WARN] No conventional prefix detected.'
    Write-Host '         Suggest: feat / fix / docs / refactor / test / chore / hotfix'
}

if (-not $allClear) {
    Write-Host ''
    Write-Sep
    Write-Host '  ABORT: security check failed. Commit cancelled.'
    Write-Sep
    Write-Host ''
    exit 1
}

Write-Host ''
Write-Host '  Commit message:'
Write-Host "    $Message"
Write-Host ''
if (-not $Yes) {
    $confirm = Read-Host '  Proceed with commit? [Y/n]'
    if ($confirm -match '^[nN]') {
        Write-Host '  Cancelled.'
        exit 0
    }
}

$fullMessage = "$Message`n`n$CO_AUTHOR"
& git @gitBaseArgs commit -m $fullMessage

if ($LASTEXITCODE -ne 0) {
    Write-Host ''
    Write-Host "  [ERROR] git commit failed (exit $LASTEXITCODE)"
    exit 1
}

$commitHash = ((Invoke-GitLines -Arguments @('rev-parse', '--short', 'HEAD')) -join "`n").Trim()
Write-Host ''
Write-Host "  [OK] Committed: $commitHash -- $Message"

if ($Push) {
    Write-Host ''
    Write-Host "  Pushing to $Remote/$currentBranch ..."
    & git @gitBaseArgs push $Remote $currentBranch

    if ($LASTEXITCODE -ne 0) {
        Write-Host '  [ERROR] git push failed.'
        Write-Host "  TIP: run 'git pull $Remote $currentBranch' then retry."
        exit 1
    }

    Write-Host "  [OK] Pushed to $Remote/$currentBranch"
}

Write-Host ''
Write-Sep
Write-Host "  Done: commit$(if ($Push) { ' + push' } else { '' }) succeeded ($commitHash)"
Write-Sep
Write-Host ''

exit 0
