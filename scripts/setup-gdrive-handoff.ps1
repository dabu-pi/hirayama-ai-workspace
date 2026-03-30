#Requires -Version 5.1
<#
.SYNOPSIS
    Bootstraps the Google Drive handoff setup on a PC.

.DESCRIPTION
    Prepares the PC for the workspace -> workspace-export -> Google Drive flow.
    The script can install rclone to a user-local path, create or validate a
    dedicated Drive remote rooted at a specified folder ID, write the required
    user environment variables, run export sync, and perform the first upload
    in copy mode.

    Safety rules:
    - GitHub/local workspace remains the source of truth.
    - The Google Drive folder ID may already contain files.
    - Uploads always target a dedicated child path such as
      `hirayama-ai-workspace/workspace-export`, not the folder ID root itself.
    - The first upload uses copy, never sync.
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$DriveFolderId,
    [string]$RemoteName = 'hirayama_gdrive_handoff',
    [string]$RemotePath = 'hirayama-ai-workspace/workspace-export',
    [string]$ExportRoot = '',
    [string]$RcloneExe = '',
    [switch]$SkipRcloneInstall,
    [switch]$SkipEnvVarWrite,
    [switch]$SkipExportSync,
    [switch]$SkipUploadDryRun,
    [switch]$SkipUpload,
    [switch]$SkipVerify
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

function Get-RcloneCandidatePaths {
    param(
        [string]$Hint,
        [string]$WorkspaceRoot
    )

    $candidates = [System.Collections.Generic.List[string]]::new()

    if ($env:HIRAYAMA_RCLONE_EXE) {
        $candidates.Add([Environment]::ExpandEnvironmentVariables($env:HIRAYAMA_RCLONE_EXE))
    }

    if ($Hint) {
        $candidates.Add([Environment]::ExpandEnvironmentVariables($Hint))
    }

    if ($env:LOCALAPPDATA) {
        $candidates.Add((Join-Path $env:LOCALAPPDATA 'Programs\rclone\rclone.exe'))
    }

    if ($env:ProgramFiles) {
        $candidates.Add((Join-Path $env:ProgramFiles 'rclone\rclone.exe'))
        $candidates.Add((Join-Path $env:ProgramFiles 'Rclone\rclone.exe'))
    }

    $programFilesX86 = [Environment]::GetEnvironmentVariable('ProgramFiles(x86)')
    if ($programFilesX86) {
        $candidates.Add((Join-Path $programFilesX86 'rclone\rclone.exe'))
        $candidates.Add((Join-Path $programFilesX86 'Rclone\rclone.exe'))
    }

    if ($WorkspaceRoot) {
        $candidates.Add((Join-Path $WorkspaceRoot 'tools\rclone\rclone.exe'))
    }

    return @($candidates | Where-Object { $_ } | Select-Object -Unique)
}

function Resolve-RcloneExecutable {
    param(
        [string]$Hint,
        [string]$WorkspaceRoot
    )

    if ($Hint) {
        $command = Get-Command -Name $Hint -ErrorAction SilentlyContinue
        if ($null -ne $command) {
            return (if ($command.Path) { $command.Path } else { $command.Source })
        }
    }

    if (-not $Hint -or $Hint -eq 'rclone') {
        $command = Get-Command -Name 'rclone' -ErrorAction SilentlyContinue
        if ($null -ne $command) {
            return (if ($command.Path) { $command.Path } else { $command.Source })
        }
    }

    foreach ($candidate in (Get-RcloneCandidatePaths -Hint $Hint -WorkspaceRoot $WorkspaceRoot)) {
        if (Test-Path -LiteralPath $candidate -PathType Leaf) {
            return (Resolve-Path -LiteralPath $candidate -ErrorAction Stop).Path
        }
    }

    return ''
}

function Install-RcloneUserLocal {
    $installRoot = Join-Path $env:LOCALAPPDATA 'Programs\rclone'
    $zipPath = Join-Path $env:TEMP 'rclone-current-windows-amd64.zip'
    $extractRoot = Join-Path $env:TEMP 'rclone-install'

    if (Test-Path -LiteralPath $extractRoot) {
        Remove-Item -LiteralPath $extractRoot -Recurse -Force
    }

    New-Item -ItemType Directory -Force -Path $installRoot | Out-Null

    Write-Info 'Downloading rclone from the official release archive.'
    Invoke-WebRequest -Uri 'https://downloads.rclone.org/rclone-current-windows-amd64.zip' -OutFile $zipPath
    Expand-Archive -LiteralPath $zipPath -DestinationPath $extractRoot -Force

    $rcloneExeItem = Get-ChildItem -Path $extractRoot -Recurse -Filter 'rclone.exe' | Select-Object -First 1
    if ($null -eq $rcloneExeItem) {
        throw 'rclone.exe was not found in the downloaded archive.'
    }

    $installedPath = Join-Path $installRoot 'rclone.exe'
    Copy-Item -LiteralPath $rcloneExeItem.FullName -Destination $installedPath -Force

    $currentUserPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    $paths = @()
    if ($currentUserPath) {
        $paths = $currentUserPath -split ';' | Where-Object { $_ }
    }

    if ($paths -notcontains $installRoot) {
        [Environment]::SetEnvironmentVariable('Path', ((@($paths) + $installRoot) -join ';'), 'User')
    }

    return $installedPath
}

function Get-RcloneRemoteConfig {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RclonePath,
        [Parameter(Mandatory = $true)]
        [string]$RemoteName
    )

    $lines = & $RclonePath config show $RemoteName 2>$null
    if ($LASTEXITCODE -ne 0 -or -not $lines) {
        return @{}
    }

    $config = [ordered]@{}
    foreach ($line in @($lines)) {
        if ($line -match '^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$') {
            $config[$matches[1]] = $matches[2]
        }
    }

    return $config
}

function Invoke-RcloneJson {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RclonePath,
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    $output = & $RclonePath @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "rclone command failed: $($Arguments -join ' ')"
    }

    $text = (@($output) -join "`n").Trim()
    if (-not $text) {
        return $null
    }

    return ($text | ConvertFrom-Json)
}

function Broadcast-EnvironmentChange {
    Add-Type -Namespace Win32 -Name NativeMethods -MemberDefinition @'
[DllImport("user32.dll", SetLastError=true, CharSet=CharSet.Auto)]
public static extern IntPtr SendMessageTimeout(IntPtr hWnd, int Msg, IntPtr wParam, string lParam, int fuFlags, int uTimeout, out IntPtr lpdwResult);
'@

    $HWND_BROADCAST = [intptr]0xffff
    $WM_SETTINGCHANGE = 0x001A
    $SMTO_ABORTIFHUNG = 0x0002
    $result = [intptr]::Zero
    [void][Win32.NativeMethods]::SendMessageTimeout($HWND_BROADCAST, $WM_SETTINGCHANGE, [intptr]::Zero, 'Environment', $SMTO_ABORTIFHUNG, 5000, [ref]$result)
}

$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
$sourceRoot = Split-Path -Parent $scriptDir
$syncScript = Join-Path $scriptDir 'sync-workspace-to-drive.ps1'
$uploadScript = Join-Path $scriptDir 'upload-workspace-export-to-gdrive.ps1'

if (-not (Test-Path -LiteralPath (Join-Path $sourceRoot '.git'))) {
    throw "SourceRoot is not a git workspace: $sourceRoot"
}

if (-not (Test-Path -LiteralPath $syncScript)) {
    throw "sync-workspace-to-drive.ps1 was not found: $syncScript"
}

if (-not (Test-Path -LiteralPath $uploadScript)) {
    throw "upload-workspace-export-to-gdrive.ps1 was not found: $uploadScript"
}

if (-not $ExportRoot) {
    if ($env:HIRAYAMA_DRIVE_SYNC_EXPORT_ROOT) {
        $ExportRoot = $env:HIRAYAMA_DRIVE_SYNC_EXPORT_ROOT
    } else {
        $ExportRoot = Join-Path (Split-Path -Parent $sourceRoot) 'workspace-export'
    }
}

$ExportRoot = Resolve-AbsolutePath -Path $ExportRoot -AllowMissingLeaf
$RemotePath = Normalize-RemotePath -Path $RemotePath

if (-not $RemotePath -or $RemotePath -match '^\.+$') {
    throw 'RemotePath must be a dedicated child folder such as hirayama-ai-workspace/workspace-export.'
}

Write-Host ''
Write-Host ('=' * 68)
Write-Host "  setup-gdrive-handoff |  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Write-Host ('=' * 68)
Write-Info "DriveFolderId : $DriveFolderId"
Write-Info "RemoteName    : $RemoteName"
Write-Info "RemotePath    : $RemotePath"
Write-Info "ExportRoot    : $ExportRoot"

$rclonePath = Resolve-RcloneExecutable -Hint $RcloneExe -WorkspaceRoot $sourceRoot
if (-not $rclonePath) {
    if ($SkipRcloneInstall) {
        throw 'rclone was not found and -SkipRcloneInstall was specified.'
    }

    $rclonePath = Install-RcloneUserLocal
    Write-Ok "Installed rclone: $rclonePath"
} else {
    Write-Ok "Using rclone: $rclonePath"
}

$listRemotes = @(& $rclonePath listremotes 2>&1)
if ($LASTEXITCODE -ne 0) {
    throw 'rclone listremotes failed.'
}

$remoteExists = @($listRemotes) -contains "${RemoteName}:"
if ($remoteExists) {
    $remoteConfig = Get-RcloneRemoteConfig -RclonePath $rclonePath -RemoteName $RemoteName

    if ($remoteConfig.type -and $remoteConfig.type -ne 'drive') {
        throw "Existing remote '$RemoteName' is not a Google Drive remote."
    }

    if ($remoteConfig.root_folder_id -and $remoteConfig.root_folder_id -ne $DriveFolderId) {
        throw "Existing remote '$RemoteName' points to a different root_folder_id. Choose another RemoteName."
    }

    Write-Ok "Remote already exists and is safe to reuse: $RemoteName"
} else {
    Write-Info 'Creating the Google Drive remote. A browser may open for OAuth.'

    $step1 = Invoke-RcloneJson -RclonePath $rclonePath -Arguments @(
        'config', 'create', $RemoteName, 'drive',
        'scope', 'drive',
        'root_folder_id', $DriveFolderId,
        '--non-interactive'
    )

    if ($null -ne $step1 -and $step1.State) {
        $step2 = Invoke-RcloneJson -RclonePath $rclonePath -Arguments @(
            'config', 'create', $RemoteName, 'drive',
            'scope', 'drive',
            'root_folder_id', $DriveFolderId,
            '--continue',
            '--state', $step1.State,
            '--result', 'true'
        )

        if ($null -ne $step2 -and $step2.State) {
            $null = Invoke-RcloneJson -RclonePath $rclonePath -Arguments @(
                'config', 'create', $RemoteName, 'drive',
                'scope', 'drive',
                'root_folder_id', $DriveFolderId,
                '--continue',
                '--state', $step2.State,
                '--result', 'false'
            )
        }
    }

    Write-Ok "Created remote: $RemoteName"
}

if (-not $SkipEnvVarWrite) {
    [Environment]::SetEnvironmentVariable('HIRAYAMA_GDRIVE_REMOTE', $RemoteName, 'User')
    [Environment]::SetEnvironmentVariable('HIRAYAMA_GDRIVE_REMOTE_PATH', $RemotePath, 'User')
    [Environment]::SetEnvironmentVariable('HIRAYAMA_DRIVE_SYNC_EXPORT_ROOT', $ExportRoot, 'User')
    [Environment]::SetEnvironmentVariable('HIRAYAMA_RCLONE_EXE', $rclonePath, 'User')

    Broadcast-EnvironmentChange
    Write-Ok 'Updated user environment variables.'
} else {
    Write-Warn 'Skipped writing user environment variables.'
}

$rootItems = @(& $rclonePath lsf "${RemoteName}:" 2>$null)
if ($LASTEXITCODE -eq 0 -and $rootItems.Count -gt 0) {
    Write-Warn 'The Drive folder ID root already contains items.'
    Write-Warn "Uploads will stay under the dedicated child path: $RemotePath"
}

$targetItems = @(& $rclonePath lsf "${RemoteName}:$RemotePath" 2>$null)
if ($LASTEXITCODE -eq 0 -and $targetItems.Count -gt 0) {
    Write-Warn 'The dedicated upload path already contains items.'
    Write-Warn 'This is still safe for the first run because copy mode will not delete remote files.'
}

if (-not $SkipExportSync) {
    Write-Host ''
    Write-Info 'Running export dry-run.'
    & $syncScript -ExportRoot $ExportRoot -DryRun
    if ($LASTEXITCODE -ne 0) {
        throw "sync-workspace-to-drive.ps1 -DryRun failed with exit code $LASTEXITCODE"
    }

    Write-Host ''
    Write-Info 'Running export sync.'
    & $syncScript -ExportRoot $ExportRoot
    if ($LASTEXITCODE -ne 0) {
        throw "sync-workspace-to-drive.ps1 failed with exit code $LASTEXITCODE"
    }
} else {
    Write-Warn 'Skipped export sync.'
}

if (-not $SkipUploadDryRun) {
    Write-Host ''
    Write-Info 'Running the first upload dry-run in copy mode.'
    & $uploadScript -ExportRoot $ExportRoot -Remote $RemoteName -RemotePath $RemotePath -RcloneExe $rclonePath -Mode copy -DryRun
    if ($LASTEXITCODE -ne 0) {
        throw "upload-workspace-export-to-gdrive.ps1 -Mode copy -DryRun failed with exit code $LASTEXITCODE"
    }
} else {
    Write-Warn 'Skipped upload dry-run.'
}

if (-not $SkipUpload) {
    Write-Host ''
    Write-Info 'Running the first upload in copy mode.'
    & $uploadScript -ExportRoot $ExportRoot -Remote $RemoteName -RemotePath $RemotePath -RcloneExe $rclonePath -Mode copy
    if ($LASTEXITCODE -ne 0) {
        throw "upload-workspace-export-to-gdrive.ps1 -Mode copy failed with exit code $LASTEXITCODE"
    }
} else {
    Write-Warn 'Skipped the real upload.'
}

if (-not $SkipVerify) {
    Write-Host ''
    Write-Info 'Verifying uploaded entry points.'
    $null = & $rclonePath lsjson "${RemoteName}:$RemotePath/INDEX.md"
    if ($LASTEXITCODE -ne 0) {
        throw 'Failed to verify INDEX.md on Google Drive.'
    }

    $null = & $rclonePath lsjson "${RemoteName}:$RemotePath/docs/PROJECT_STATUS.md"
    if ($LASTEXITCODE -ne 0) {
        throw 'Failed to verify docs/PROJECT_STATUS.md on Google Drive.'
    }

    Write-Ok 'Verified INDEX.md and docs/PROJECT_STATUS.md on Google Drive.'
} else {
    Write-Warn 'Skipped Google Drive verification.'
}

Write-Host ''
Write-Ok 'Google Drive handoff bootstrap completed.'
Write-Host ''
