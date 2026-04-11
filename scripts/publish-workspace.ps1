#Requires -Version 5.1
<#
.SYNOPSIS
    Standard workspace publish flow: commit/push, export refresh, and Drive upload.

.DESCRIPTION
    Uses existing scripts to keep logic centralized.
    Publish is complete only when push, workspace-export refresh, and Drive upload all succeed.
#>

[CmdletBinding()]
param(
    [string]$Message = '',
    [string[]]$Files = @(),
    [switch]$Yes,
    [string]$ExportRoot = '',
    [string]$Remote = '',
    [string]$RemotePath = '',
    [string]$RcloneExe = 'rclone',
    [ValidateSet('sync', 'copy')]
    [string]$UploadMode = 'sync'
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Info { param([string]$Message) Write-Host "  [INFO] $Message" -ForegroundColor Cyan }
function Write-Ok   { param([string]$Message) Write-Host "  [OK]   $Message" -ForegroundColor Green }
function Write-Warn { param([string]$Message) Write-Host "  [WARN] $Message" -ForegroundColor Yellow }
function Write-Err  { param([string]$Message) Write-Host "  [ERR]  $Message" -ForegroundColor Red }

function Write-SummaryFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SummaryPath,
        [Parameter(Mandatory = $true)]
        [object]$Payload
    )

    $Payload | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $SummaryPath -Encoding UTF8
}

function Invoke-GitLines {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    $output = & git -c core.excludesfile= @Arguments 2>&1
    return @($output | Where-Object { $_ -and $_ -notmatch '^warning:' })
}

function Get-GitStatusLines {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RepoRoot
    )

    $output = & git -c core.excludesfile= -C $RepoRoot status --short 2>&1
    return @($output | Where-Object { $_ -and $_ -notmatch '^warning:' })
}

$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$repoRoot = Split-Path -Parent $scriptDir
$gitSafeCommitPath = Join-Path $scriptDir 'git-safe-commit.ps1'
$driveSyncPath = Join-Path $scriptDir 'sync-workspace-to-drive.ps1'
$gdriveUploadPath = Join-Path $scriptDir 'upload-workspace-export-to-gdrive.ps1'
$logDir = Join-Path $repoRoot 'logs\publish-workspace'

foreach ($requiredPath in @($gitSafeCommitPath, $driveSyncPath, $gdriveUploadPath)) {
    if (-not (Test-Path -LiteralPath $requiredPath)) {
        throw "Required script was not found: $requiredPath"
    }
}

$null = Invoke-GitLines -Arguments @('-C', $repoRoot, 'rev-parse', '--is-inside-work-tree')
if ($LASTEXITCODE -ne 0) {
    throw "Not a git repository: $repoRoot"
}

New-Item -ItemType Directory -Path $logDir -Force | Out-Null

$startedAt = Get-Date
$stamp = $startedAt.ToString('yyyyMMdd_HHmmss')
$summaryPath = Join-Path $logDir ("publish-workspace_{0}.json" -f $stamp)
$branch = ((Invoke-GitLines -Arguments @('-C', $repoRoot, 'rev-parse', '--abbrev-ref', 'HEAD')) -join "`n").Trim()
$statusBefore = @(Get-GitStatusLines -RepoRoot $repoRoot)
$hasWorkingTreeChanges = ($statusBefore.Count -gt 0)

Write-Host ''
Write-Host ('=' * 70)
Write-Host "  publish-workspace |  $($startedAt.ToString('yyyy-MM-dd HH:mm:ss'))"
Write-Host ('=' * 70)
Write-Info "RepoRoot    : $repoRoot"
Write-Info "Branch      : $branch"
Write-Info "UploadMode  : $UploadMode"
Write-Info "Remote      : $(if ($Remote) { $Remote } elseif ($env:HIRAYAMA_GDRIVE_REMOTE) { $env:HIRAYAMA_GDRIVE_REMOTE } else { '(env/default)' })"
Write-Info "RemotePath  : $(if ($PSBoundParameters.ContainsKey('RemotePath')) { if ($RemotePath) { $RemotePath } else { '(root)' } } elseif ($env:HIRAYAMA_GDRIVE_REMOTE_PATH) { $env:HIRAYAMA_GDRIVE_REMOTE_PATH } else { '(root)' })"
Write-Info "Worktree    : $(if ($hasWorkingTreeChanges) { 'dirty' } else { 'clean' })"

$summary = [ordered]@{
    started_at    = $startedAt.ToString('s')
    repo_root     = $repoRoot
    branch        = $branch
    message       = $Message
    files         = @($Files)
    upload_mode   = $UploadMode
    export_root   = $ExportRoot
    remote        = $Remote
    remote_path   = $RemotePath
    result        = 'PENDING'
    failed_stage  = ''
    summary_path  = $summaryPath
    stages        = [ordered]@{
        precheck    = [ordered]@{ result = 'SUCCESS' }
        commit_push = [ordered]@{ result = 'PENDING' }
        export_sync = [ordered]@{ result = 'PENDING' }
        drive_upload = [ordered]@{ result = 'PENDING' }
    }
}

if ($hasWorkingTreeChanges -and -not $Message.Trim()) {
    $summary.stages.commit_push.result = 'FAILED'
    $summary.result = 'FAILED'
    $summary.failed_stage = 'commit_push'
    $summary.reason = 'Working tree has changes but commit message was not provided.'
    Write-SummaryFile -SummaryPath $summaryPath -Payload $summary
    Write-Err 'Working tree has changes. Provide -Message to publish.'
    exit 1
}

$commitHash = ''

Write-Host ''
Write-Info 'Stage 1/3: commit / push'

if ($hasWorkingTreeChanges) {
    if ($Files.Count -gt 0) {
        & $gitSafeCommitPath -Message $Message -Files $Files -Push -Yes:$Yes
    } else {
        Push-Location $repoRoot
        try {
            & git -c core.excludesfile= add -A
            if ($LASTEXITCODE -ne 0) {
                throw 'git add -A failed.'
            }
        } finally {
            Pop-Location
        }

        & $gitSafeCommitPath -Message $Message -Push -Yes:$Yes
    }

    if ($LASTEXITCODE -ne 0) {
        $summary.stages.commit_push.result = 'FAILED'
        $summary.stages.commit_push.exit_code = $LASTEXITCODE
        $summary.result = 'FAILED'
        $summary.failed_stage = 'commit_push'
        Write-SummaryFile -SummaryPath $summaryPath -Payload $summary
        Write-Err "Commit / push failed (exit code: $LASTEXITCODE)"
        exit $LASTEXITCODE
    }

    $summary.stages.commit_push.result = 'SUCCESS'
} else {
    $branchStatus = ((Invoke-GitLines -Arguments @('-C', $repoRoot, 'status', '--short', '--branch')) -join "`n")
    if ($branchStatus -match '\[ahead [0-9]+') {
        Push-Location $repoRoot
        try {
            & git -c core.excludesfile= push
        } finally {
            Pop-Location
        }

        if ($LASTEXITCODE -ne 0) {
            $summary.stages.commit_push.result = 'FAILED'
            $summary.stages.commit_push.exit_code = $LASTEXITCODE
            $summary.result = 'FAILED'
            $summary.failed_stage = 'commit_push'
            Write-SummaryFile -SummaryPath $summaryPath -Payload $summary
            Write-Err "Push failed (exit code: $LASTEXITCODE)"
            exit $LASTEXITCODE
        }

        $summary.stages.commit_push.result = 'SUCCESS'
        $summary.stages.commit_push.note = 'Existing local commits were pushed.'
    } else {
        $summary.stages.commit_push.result = 'SUCCESS'
        $summary.stages.commit_push.note = 'No local changes and no pending push.'
    }
}

$commitHash = ((Invoke-GitLines -Arguments @('-C', $repoRoot, 'rev-parse', '--short', 'HEAD')) -join "`n").Trim()
$summary.stages.commit_push.commit_hash = $commitHash

Write-Host ''
Write-Info 'Stage 2/3: workspace-export refresh'

$syncArgs = @{}
if ($ExportRoot) {
    $syncArgs.ExportRoot = $ExportRoot
}

& $driveSyncPath @syncArgs
if ($LASTEXITCODE -ne 0) {
    $summary.stages.export_sync.result = 'FAILED'
    $summary.stages.export_sync.exit_code = $LASTEXITCODE
    $summary.result = 'FAILED'
    $summary.failed_stage = 'export_sync'
    Write-SummaryFile -SummaryPath $summaryPath -Payload $summary
    Write-Err "Workspace-export refresh failed (exit code: $LASTEXITCODE)"
    exit $LASTEXITCODE
}

$summary.stages.export_sync.result = 'SUCCESS'

Write-Host ''
Write-Info 'Stage 3/3: Drive upload'

$uploadArgs = @{
    Mode = $UploadMode
}
if ($ExportRoot) {
    $uploadArgs.ExportRoot = $ExportRoot
}
if ($Remote) {
    $uploadArgs.Remote = $Remote
}
if ($PSBoundParameters.ContainsKey('RemotePath')) {
    $uploadArgs.RemotePath = $RemotePath
}
if ($PSBoundParameters.ContainsKey('RcloneExe') -and $RcloneExe) {
    $uploadArgs.RcloneExe = $RcloneExe
}

& $gdriveUploadPath @uploadArgs
if ($LASTEXITCODE -ne 0) {
    $summary.stages.drive_upload.result = 'FAILED'
    $summary.stages.drive_upload.exit_code = $LASTEXITCODE
    $summary.result = 'FAILED'
    $summary.failed_stage = 'drive_upload'
    Write-SummaryFile -SummaryPath $summaryPath -Payload $summary
    Write-Err "Drive upload failed (exit code: $LASTEXITCODE)"
    exit $LASTEXITCODE
}

$summary.stages.drive_upload.result = 'SUCCESS'
$summary.result = 'SUCCESS'
$summary.commit_hash = $commitHash
$summary.finished_at = (Get-Date).ToString('s')
Write-SummaryFile -SummaryPath $summaryPath -Payload $summary

Write-Host ''
Write-Ok 'Publish completed.'
Write-Ok "Commit  : $commitHash"
Write-Ok "Summary : $summaryPath"
Write-Host ''

exit 0
