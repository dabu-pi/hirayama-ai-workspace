#Requires -Version 5.1
<#
.SYNOPSIS
    Uploads the prepared workspace export folder to Google Drive via rclone.

.DESCRIPTION
    Keeps GitHub/local workspace as the source of truth. This script assumes
    `sync-workspace-to-drive.ps1` has already prepared a safe local export
    folder such as `workspace-export`, then performs a one-way upload to a
    dedicated Google Drive path using rclone.

    Missing rclone or missing remote configuration is treated as a skipped
    upload so that the main handoff flow can continue.
#>

[CmdletBinding()]
param(
    [string]$ExportRoot = '',
    [string]$Remote = '',
    [string]$RemotePath = '',
    [string]$LogDir = '',
    [string]$RcloneExe = 'rclone',
    [ValidateSet('sync', 'copy')]
    [string]$Mode = 'sync',
    [switch]$DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Info { param([string]$Message) Write-Host "  [INFO] $Message" -ForegroundColor Cyan }
function Write-Ok   { param([string]$Message) Write-Host "  [OK]   $Message" -ForegroundColor Green }
function Write-Warn { param([string]$Message) Write-Host "  [WARN] $Message" -ForegroundColor Yellow }
function Write-Err  { param([string]$Message) Write-Host "  [ERR]  $Message" -ForegroundColor Red }

function Resolve-AbsolutePath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [switch]$AllowMissingLeaf
    )

    $expanded = [Environment]::ExpandEnvironmentVariables($Path)

    if ($AllowMissingLeaf) {
        $parent = Split-Path -Parent $expanded
        if (-not $parent) {
            throw "Could not resolve parent directory for path: $Path"
        }

        $resolvedParent = Resolve-Path -LiteralPath $parent -ErrorAction Stop
        $leaf = Split-Path -Leaf $expanded
        return (Join-Path $resolvedParent.Path $leaf)
    }

    return (Resolve-Path -LiteralPath $expanded -ErrorAction Stop).Path
}

function Normalize-RemotePath {
    param([string]$Path)

    $normalized = $Path.Replace('\', '/').Trim()
    $normalized = $normalized.Trim('/')
    return $normalized
}

function Write-SummaryFile {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SummaryPath,
        [Parameter(Mandatory = $true)]
        [object]$Payload
    )

    $Payload | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $SummaryPath -Encoding UTF8
}

$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$sourceRoot = Split-Path -Parent $scriptDir

if (-not $ExportRoot) {
    if ($env:HIRAYAMA_DRIVE_SYNC_EXPORT_ROOT) {
        $ExportRoot = $env:HIRAYAMA_DRIVE_SYNC_EXPORT_ROOT
    } else {
        $ExportRoot = Join-Path (Split-Path -Parent $sourceRoot) 'workspace-export'
    }
}

if (-not $Remote) {
    $Remote = $env:HIRAYAMA_GDRIVE_REMOTE
}

if (-not $RemotePath) {
    $RemotePath = $env:HIRAYAMA_GDRIVE_REMOTE_PATH
}

if (-not $LogDir) {
    $LogDir = Join-Path $sourceRoot 'logs\gdrive-upload'
}

$ExportRoot = Resolve-AbsolutePath -Path $ExportRoot
New-Item -ItemType Directory -Path $LogDir -Force | Out-Null

$uploadedAt = Get-Date
$stamp = $uploadedAt.ToString('yyyyMMdd_HHmmss')
$logPath = Join-Path $LogDir ("gdrive-upload_{0}.log" -f $stamp)
$summaryPath = Join-Path $LogDir ("gdrive-upload_{0}.json" -f $stamp)
$markerPath = Join-Path $ExportRoot '.drive-export-root'
$indexPath = Join-Path $ExportRoot 'INDEX.md'

Write-Host ''
Write-Host ('=' * 68)
Write-Host "  upload-workspace-export-to-gdrive |  $($uploadedAt.ToString('yyyy-MM-dd HH:mm:ss'))"
Write-Host ('=' * 68)
Write-Info "ExportRoot : $ExportRoot"
Write-Info "Mode       : $Mode$(if ($DryRun) { ' (DRY RUN)' } else { '' })"

if (-not (Test-Path -LiteralPath $markerPath)) {
    throw "ExportRoot is missing marker file: $markerPath"
}

if (-not (Test-Path -LiteralPath $indexPath)) {
    throw "ExportRoot is missing INDEX.md: $indexPath"
}

$remote = if ($null -ne $Remote) { $Remote.Trim() } else { '' }
$remotePathInput = if ($null -ne $RemotePath) { $RemotePath } else { '' }
$remotePath = Normalize-RemotePath -Path $remotePathInput

if (-not $remote -or -not $remotePath) {
    $summary = [ordered]@{
        uploaded_at  = $uploadedAt.ToString('s')
        export_root  = $ExportRoot
        remote       = $remote
        remote_path  = $remotePath
        dry_run      = [bool]$DryRun
        mode         = $Mode
        stage        = 'upload'
        result       = 'SKIPPED'
        reason       = 'Missing HIRAYAMA_GDRIVE_REMOTE or HIRAYAMA_GDRIVE_REMOTE_PATH.'
        log_path     = $logPath
        summary_path = $summaryPath
    }

    Write-SummaryFile -SummaryPath $summaryPath -Payload $summary
    Write-Warn 'Google Drive upload is not configured. Set HIRAYAMA_GDRIVE_REMOTE and HIRAYAMA_GDRIVE_REMOTE_PATH.'
    Write-Warn "Summary: $summaryPath"
    exit 2
}

if ($remotePath -match '^\.+$') {
    throw 'RemotePath must point to a dedicated folder, not ".".'
}

$rcloneCommand = Get-Command -Name $RcloneExe -ErrorAction SilentlyContinue
if ($null -eq $rcloneCommand) {
    $summary = [ordered]@{
        uploaded_at  = $uploadedAt.ToString('s')
        export_root  = $ExportRoot
        remote       = $remote
        remote_path  = $remotePath
        dry_run      = [bool]$DryRun
        mode         = $Mode
        stage        = 'upload'
        result       = 'SKIPPED'
        reason       = "rclone command was not found: $RcloneExe"
        log_path     = $logPath
        summary_path = $summaryPath
    }

    Write-SummaryFile -SummaryPath $summaryPath -Payload $summary
    Write-Warn "rclone was not found: $RcloneExe"
    Write-Warn "Summary: $summaryPath"
    exit 2
}

$rclonePath = if ($rcloneCommand.Path) { $rcloneCommand.Path } else { $rcloneCommand.Source }

$listRemotes = & $rclonePath listremotes 2>&1
if ($LASTEXITCODE -ne 0) {
    $summary = [ordered]@{
        uploaded_at  = $uploadedAt.ToString('s')
        export_root  = $ExportRoot
        remote       = $remote
        remote_path  = $remotePath
        dry_run      = [bool]$DryRun
        mode         = $Mode
        stage        = 'upload'
        result       = 'FAILED'
        reason       = 'rclone listremotes failed.'
        rclone_output = @($listRemotes)
        log_path     = $logPath
        summary_path = $summaryPath
    }

    Write-SummaryFile -SummaryPath $summaryPath -Payload $summary
    Write-Err 'rclone listremotes failed.'
    exit 1
}

$remoteName = "${remote}:"
if (-not (@($listRemotes) -contains $remoteName)) {
    $summary = [ordered]@{
        uploaded_at  = $uploadedAt.ToString('s')
        export_root  = $ExportRoot
        remote       = $remote
        remote_path  = $remotePath
        dry_run      = [bool]$DryRun
        mode         = $Mode
        stage        = 'upload'
        result       = 'SKIPPED'
        reason       = "Configured rclone remote was not found: $remote"
        log_path     = $logPath
        summary_path = $summaryPath
    }

    Write-SummaryFile -SummaryPath $summaryPath -Payload $summary
    Write-Warn "Configured rclone remote was not found: $remote"
    Write-Warn "Summary: $summaryPath"
    exit 2
}

$remoteSpec = "{0}:{1}" -f $remote, $remotePath
$rcloneArgs = [System.Collections.Generic.List[string]]::new()
$rcloneArgs.Add($Mode)
$rcloneArgs.Add($ExportRoot)
$rcloneArgs.Add($remoteSpec)
$rcloneArgs.Add('--create-empty-src-dirs')
$rcloneArgs.Add('--links')
$rcloneArgs.Add('--fast-list')
$rcloneArgs.Add('--log-file')
$rcloneArgs.Add($logPath)
$rcloneArgs.Add('--log-level')
$rcloneArgs.Add('INFO')

if ($DryRun) {
    $rcloneArgs.Add('--dry-run')
}

Write-Info "RcloneExe  : $rclonePath"
Write-Info "RemoteSpec : $remoteSpec"
Write-Info 'Running rclone upload.'

& $rclonePath @rcloneArgs
$rcloneExit = $LASTEXITCODE

$summary = [ordered]@{
    uploaded_at   = $uploadedAt.ToString('s')
    export_root   = $ExportRoot
    remote        = $remote
    remote_path   = $remotePath
    remote_spec   = $remoteSpec
    dry_run       = [bool]$DryRun
    mode          = $Mode
    stage         = 'upload'
    rclone_exit   = $rcloneExit
    result        = if ($rcloneExit -eq 0) { 'SUCCESS' } else { 'FAILED' }
    log_path      = $logPath
    summary_path  = $summaryPath
}

Write-SummaryFile -SummaryPath $summaryPath -Payload $summary

if ($rcloneExit -ne 0) {
    Write-Err "rclone upload failed (exit code: $rcloneExit)"
    Write-Err "Log: $logPath"
    Write-Err "Summary: $summaryPath"
    exit $rcloneExit
}

Write-Host ''
Write-Ok 'Google Drive upload completed.'
Write-Ok "Log     : $logPath"
Write-Ok "Summary : $summaryPath"
Write-Host ''

exit 0
