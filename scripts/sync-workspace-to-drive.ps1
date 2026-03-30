#Requires -Version 5.1
<#
.SYNOPSIS
    Safely mirrors the workspace into a Google Drive export folder.

.DESCRIPTION
    Keeps GitHub/local workspace as the source of truth and writes a guarded
    mirror into a separate export folder such as `workspace-export`.
    Secrets, `.git`, and large generated folders are excluded by config.
    An `INDEX.md` file is generated in the export root for Drive readers.
#>

[CmdletBinding()]
param(
    [string]$SourceRoot = '',
    [string]$ExportRoot = '',
    [string]$ExcludeConfig = '',
    [string]$LogDir = '',
    [switch]$DryRun,
    [switch]$SkipIndex
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

function Test-PathPrefix {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Candidate,
        [Parameter(Mandatory = $true)]
        [string]$Prefix
    )

    $comparison = [System.StringComparison]::OrdinalIgnoreCase
    $normalizedCandidate = $Candidate.TrimEnd('\')
    $normalizedPrefix = $Prefix.TrimEnd('\')

    if ($normalizedCandidate.Length -le $normalizedPrefix.Length) {
        return $false
    }

    return $normalizedCandidate.StartsWith("$normalizedPrefix\", $comparison)
}

function Assert-SafeMirrorPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Source,
        [Parameter(Mandatory = $true)]
        [string]$Destination
    )

    if ($Source.TrimEnd('\') -ieq $Destination.TrimEnd('\')) {
        throw 'ExportRoot must not equal SourceRoot.'
    }

    if (Test-PathPrefix -Candidate $Destination -Prefix $Source) {
        throw 'ExportRoot must not live under SourceRoot.'
    }

    if (Test-PathPrefix -Candidate $Source -Prefix $Destination) {
        throw 'ExportRoot must not be a parent of SourceRoot.'
    }

    if ($Destination -match '^[A-Za-z]:\\?$') {
        throw 'ExportRoot must not point to a drive root.'
    }
}

function Get-ExcludeArguments {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ConfigPath,
        [Parameter(Mandatory = $true)]
        [string]$Source
    )

    $dirArgs = [System.Collections.Generic.List[string]]::new()
    $fileArgs = [System.Collections.Generic.List[string]]::new()

    foreach ($rawLine in (Get-Content -LiteralPath $ConfigPath -Encoding UTF8)) {
        $line = $rawLine.Trim()
        if (-not $line -or $line.StartsWith('#')) {
            continue
        }

        $normalized = $line.Replace('/', '\')
        $hasWildcard = $normalized.IndexOfAny([char[]]'*?') -ge 0

        if ($normalized.EndsWith('\')) {
            $trimmed = $normalized.TrimEnd('\')
            if (-not $trimmed) {
                continue
            }

            if ($trimmed.Contains('\')) {
                $dirArgs.Add((Join-Path $Source $trimmed))
            } else {
                $dirArgs.Add($trimmed)
            }
            continue
        }

        if (-not $hasWildcard -and $normalized.Contains('\')) {
            $fileArgs.Add((Join-Path $Source $normalized))
            continue
        }

        $fileArgs.Add($normalized)
    }

    return [ordered]@{
        Directories = @($dirArgs)
        Files       = @($fileArgs)
    }
}

function Get-GitValue {
    param(
        [Parameter(Mandatory = $true)]
        [string]$RepoRoot,
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    try {
        $value = (& git -c core.excludesfile= -C $RepoRoot @Arguments 2>$null)
        if ($LASTEXITCODE -eq 0) {
            return ($value -join "`n").Trim()
        }
    } catch {
        return ''
    }

    return ''
}

function New-DriveIndexContent {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Branch,
        [Parameter(Mandatory = $true)]
        [string]$Commit,
        [Parameter(Mandatory = $true)]
        [string]$Source,
        [Parameter(Mandatory = $true)]
        [string]$Export,
        [Parameter(Mandatory = $true)]
        [datetime]$SyncedAt
    )

    $syncedAtText = $SyncedAt.ToString('yyyy-MM-dd HH:mm:ss')

    return (@(
        '# INDEX.md',
        '',
        'This folder is a Google Drive export of the workspace. GitHub and the local',
        'workspace remain the source of truth. This export is for reading, searching,',
        'sharing, and backup.',
        '',
        '## Start Here',
        '',
        '- [README.md](README.md)',
        '- [PROJECTS.md](PROJECTS.md)',
        '- [ROADMAP.md](ROADMAP.md)',
        '- [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md)',
        '',
        '## Key Status Docs',
        '',
        '- [ai-os/PROJECT_STATUS.md](ai-os/PROJECT_STATUS.md)',
        '- [gas-projects/jyu-gas-ver3.1/PROJECT_STATUS.md](gas-projects/jyu-gas-ver3.1/PROJECT_STATUS.md)',
        '- [freee-automation/PROJECT_STATUS.md](freee-automation/PROJECT_STATUS.md)',
        '- [patient-management/PROJECT_STATUS.md](patient-management/PROJECT_STATUS.md)',
        '- [hirayama-jyusei-strategy/PROJECT_STATUS.md](hirayama-jyusei-strategy/PROJECT_STATUS.md)',
        '- [msk-assessment-platform/PROJECT_STATUS.md](msk-assessment-platform/PROJECT_STATUS.md)',
        '- [waste-report-system/PROJECT_STATUS.md](waste-report-system/PROJECT_STATUS.md)',
        '- [ai-invest/PROJECT_STATUS.md](ai-invest/PROJECT_STATUS.md)',
        '',
        '## Project Docs',
        '',
        '| Project | Main docs |',
        '|---|---|',
        '| Hirayama AI OS | [ai-os/README.md](ai-os/README.md) / [ai-os/PROJECT_STATUS.md](ai-os/PROJECT_STATUS.md) |',
        '| Jyu GAS | [gas-projects/jyu-gas-ver3.1/README.md](gas-projects/jyu-gas-ver3.1/README.md) / [gas-projects/jyu-gas-ver3.1/PROJECT_STATUS.md](gas-projects/jyu-gas-ver3.1/PROJECT_STATUS.md) / [gas-projects/jyu-gas-ver3.1/SPEC.md](gas-projects/jyu-gas-ver3.1/SPEC.md) |',
        '| freee automation | [freee-automation/README.md](freee-automation/README.md) / [freee-automation/PROJECT_STATUS.md](freee-automation/PROJECT_STATUS.md) / [freee-automation/spec.md](freee-automation/spec.md) |',
        '| patient-management | [patient-management/README.md](patient-management/README.md) / [patient-management/PROJECT_STATUS.md](patient-management/PROJECT_STATUS.md) / [patient-management/spec.md](patient-management/spec.md) |',
        '| hirayama-jyusei-strategy | [hirayama-jyusei-strategy/README.md](hirayama-jyusei-strategy/README.md) / [hirayama-jyusei-strategy/PROJECT_STATUS.md](hirayama-jyusei-strategy/PROJECT_STATUS.md) / [hirayama-jyusei-strategy/SPEC.md](hirayama-jyusei-strategy/SPEC.md) |',
        '| msk-assessment-platform | [msk-assessment-platform/PROJECT_STATUS.md](msk-assessment-platform/PROJECT_STATUS.md) / [msk-assessment-platform/SPEC.md](msk-assessment-platform/SPEC.md) |',
        '| waste-report-system | [waste-report-system/README.md](waste-report-system/README.md) / [waste-report-system/PROJECT_STATUS.md](waste-report-system/PROJECT_STATUS.md) / [waste-report-system/SPEC.md](waste-report-system/SPEC.md) |',
        '| ai-invest | [ai-invest/README.md](ai-invest/README.md) / [ai-invest/PROJECT_STATUS.md](ai-invest/PROJECT_STATUS.md) |',
        '',
        '## Resume Rule',
        '',
        '1. Read [README.md](README.md), [PROJECTS.md](PROJECTS.md),',
        '   [ROADMAP.md](ROADMAP.md), and [docs/PROJECT_STATUS.md](docs/PROJECT_STATUS.md).',
        '2. Read the target project''s README, PROJECT_STATUS, and spec.',
        '3. Do not perform Git work inside the export folder.',
        '',
        '## Export Metadata',
        '',
        "- SourceRoot: `$Source",
        "- ExportRoot: `$Export",
        "- Branch: `$Branch",
        "- Commit: `$Commit",
        "- SyncedAt: `$syncedAtText"
    ) -join [Environment]::NewLine)
}

$scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }

if (-not $SourceRoot) {
    $SourceRoot = Split-Path -Parent $scriptDir
}
if (-not $ExportRoot) {
    if ($env:HIRAYAMA_DRIVE_SYNC_EXPORT_ROOT) {
        $ExportRoot = $env:HIRAYAMA_DRIVE_SYNC_EXPORT_ROOT
    } else {
        $ExportRoot = Join-Path (Split-Path -Parent $SourceRoot) 'workspace-export'
    }
}
if (-not $ExcludeConfig) {
    $ExcludeConfig = Join-Path $SourceRoot 'config\drive-sync-exclude.txt'
}
if (-not $LogDir) {
    $LogDir = Join-Path $SourceRoot 'logs\drive-sync'
}

$SourceRoot = Resolve-AbsolutePath -Path $SourceRoot
$ExportRoot = Resolve-AbsolutePath -Path $ExportRoot -AllowMissingLeaf
$ExcludeConfig = Resolve-AbsolutePath -Path $ExcludeConfig

Assert-SafeMirrorPath -Source $SourceRoot -Destination $ExportRoot

if (-not (Test-Path -LiteralPath (Join-Path $SourceRoot '.git'))) {
    throw "SourceRoot is not a git workspace: $SourceRoot"
}

New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
$syncedAt = Get-Date
$stamp = $syncedAt.ToString('yyyyMMdd_HHmmss')
$logPath = Join-Path $LogDir ("drive-sync_{0}.log" -f $stamp)
$summaryPath = Join-Path $LogDir ("drive-sync_{0}.json" -f $stamp)
$markerPath = Join-Path $ExportRoot '.drive-export-root'
$indexPath = Join-Path $ExportRoot 'INDEX.md'

Write-Host ''
Write-Host ('=' * 66)
Write-Host "  sync-workspace-to-drive  |  $($syncedAt.ToString('yyyy-MM-dd HH:mm:ss'))"
Write-Host ('=' * 66)
Write-Info "SourceRoot   : $SourceRoot"
Write-Info "ExportRoot   : $ExportRoot"
Write-Info "ExcludeConfig: $ExcludeConfig"
Write-Info "Mode         : $(if ($DryRun) { 'DRY RUN' } else { 'MIRROR' })"

$exportExists = Test-Path -LiteralPath $ExportRoot
if ($exportExists) {
    $exportItems = @(Get-ChildItem -LiteralPath $ExportRoot -Force)
    $hasMarker = Test-Path -LiteralPath $markerPath

    if (-not $hasMarker) {
        if ($exportItems.Count -gt 0) {
            throw "ExportRoot exists without marker file: $ExportRoot"
        }

        if ($DryRun) {
            Write-Warn 'Empty ExportRoot detected. Marker will be created on a real run.'
        } else {
            Set-Content -LiteralPath $markerPath -Value "source_root=$SourceRoot`ncreated_at=$($syncedAt.ToString('s'))" -Encoding UTF8
            Write-Ok 'Initialized marker file in empty ExportRoot.'
        }
    }
} else {
    if ($DryRun) {
        Write-Warn 'ExportRoot does not exist yet. It will be created on a real run.'
    } else {
        New-Item -ItemType Directory -Path $ExportRoot -Force | Out-Null
        Set-Content -LiteralPath $markerPath -Value "source_root=$SourceRoot`ncreated_at=$($syncedAt.ToString('s'))" -Encoding UTF8
        Write-Ok 'Created ExportRoot.'
    }
}

$exclude = Get-ExcludeArguments -ConfigPath $ExcludeConfig -Source $SourceRoot
$robocopyArgs = [System.Collections.Generic.List[string]]::new()
$robocopyArgs.Add($SourceRoot)
$robocopyArgs.Add($ExportRoot)
$robocopyArgs.Add('/MIR')
$robocopyArgs.Add('/FFT')
$robocopyArgs.Add('/R:2')
$robocopyArgs.Add('/W:2')
$robocopyArgs.Add('/XJ')
$robocopyArgs.Add('/NP')
$robocopyArgs.Add('/TEE')
$robocopyArgs.Add("/LOG:$logPath")

if ($DryRun) {
    $robocopyArgs.Add('/L')
}

if ($exclude.Directories.Count -gt 0) {
    $robocopyArgs.Add('/XD')
    foreach ($dir in $exclude.Directories) {
        $robocopyArgs.Add($dir)
    }
}

if ($exclude.Files.Count -gt 0) {
    $robocopyArgs.Add('/XF')
    foreach ($file in $exclude.Files) {
        $robocopyArgs.Add($file)
    }
}

Write-Host ''
Write-Info 'Running robocopy.'
& robocopy @robocopyArgs
$robocopyExit = $LASTEXITCODE

$branch = Get-GitValue -RepoRoot $SourceRoot -Arguments @('rev-parse', '--abbrev-ref', 'HEAD')
$commit = Get-GitValue -RepoRoot $SourceRoot -Arguments @('rev-parse', '--short', 'HEAD')

if ($robocopyExit -ge 8) {
    $summary = [ordered]@{
        synced_at          = $syncedAt.ToString('s')
        source_root        = $SourceRoot
        export_root        = $ExportRoot
        exclude_config     = $ExcludeConfig
        dry_run            = [bool]$DryRun
        branch             = $branch
        commit             = $commit
        robocopy_exit_code = $robocopyExit
        result             = 'FAILED'
        log_path           = $logPath
        summary_path       = $summaryPath
    }

    $summary | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $summaryPath -Encoding UTF8
    Write-Err "robocopy failed with exit code: $robocopyExit"
    Write-Err "Log: $logPath"
    exit $robocopyExit
}

if (-not $DryRun) {
    Set-Content -LiteralPath $markerPath -Value "source_root=$SourceRoot`nsynced_at=$($syncedAt.ToString('s'))`nbranch=$branch`ncommit=$commit" -Encoding UTF8

    if (-not $SkipIndex) {
        $indexBody = New-DriveIndexContent -Branch $branch -Commit $commit -Source $SourceRoot -Export $ExportRoot -SyncedAt $syncedAt
        Set-Content -LiteralPath $indexPath -Value $indexBody -Encoding UTF8
    }
}

$summary = [ordered]@{
    synced_at          = $syncedAt.ToString('s')
    source_root        = $SourceRoot
    export_root        = $ExportRoot
    exclude_config     = $ExcludeConfig
    dry_run            = [bool]$DryRun
    branch             = $branch
    commit             = $commit
    robocopy_exit_code = $robocopyExit
    result             = 'SUCCESS'
    log_path           = $logPath
    summary_path       = $summaryPath
    marker_path        = if ($DryRun) { '' } else { $markerPath }
    index_path         = if ($DryRun -or $SkipIndex) { '' } else { $indexPath }
}

$summary | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $summaryPath -Encoding UTF8

Write-Host ''
Write-Ok "Drive export sync completed (robocopy exit: $robocopyExit)"
Write-Ok "Log     : $logPath"
Write-Ok "Summary : $summaryPath"
if (-not $DryRun -and -not $SkipIndex) {
    Write-Ok "INDEX   : $indexPath"
}
Write-Host ''

exit 0
