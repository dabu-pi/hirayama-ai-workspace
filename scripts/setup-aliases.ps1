#Requires -Version 5.1
<#
.SYNOPSIS
    Adds Phase1+Phase2+Phase3 workspace aliases to PowerShell $PROFILE.

.DESCRIPTION
    Registers the following function aliases:
      Phase1: cap (create-ai-project)  rwl (run-with-log)  note (note)
      Phase2: adr (auto-dev-run)  gsc (git-safe-commit)  aerr (analyze-error)  dstat (dev-status)
      Phase3: ds (dev-start)  de (dev-end)

.PARAMETER WorkspaceRoot
    Path to workspace/. Auto-detected from script location if omitted.

.PARAMETER ProfilePath
    Target $PROFILE path. Uses current $PROFILE if omitted.

.PARAMETER Force
    Overwrite existing alias blocks without prompting.

.PARAMETER DryRun
    Preview changes without writing to $PROFILE.

.EXAMPLE
    .\setup-aliases.ps1
    .\setup-aliases.ps1 -DryRun
    .\setup-aliases.ps1 -Force
    .\setup-aliases.ps1 -WorkspaceRoot "C:\hirayama-ai-workspace\workspace"
#>

param(
    [string]$WorkspaceRoot = "",
    [string]$ProfilePath   = "",
    [switch]$Force,
    [switch]$DryRun
)

Set-StrictMode -Version Latest

# --- Resolve paths ---
if (-not $WorkspaceRoot) {
    $sd = if ($PSScriptRoot) { $PSScriptRoot } else { Split-Path -Parent $MyInvocation.MyCommand.Path }
    $WorkspaceRoot = Split-Path $sd -Parent
}

$resolved = Resolve-Path $WorkspaceRoot -ErrorAction SilentlyContinue
if (-not $resolved) {
    Write-Error "workspace root not found: $WorkspaceRoot"
    exit 1
}
$WorkspaceRoot = $resolved.Path
$scriptsDir    = Join-Path $WorkspaceRoot "scripts"

if (-not $ProfilePath) { $ProfilePath = $PROFILE }

$profileDir = Split-Path $ProfilePath -Parent
if (-not (Test-Path $profileDir) -and -not $DryRun) {
    New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
}

# --- Alias definitions ---
$aliases = [ordered]@{
    "cap"   = @{ Script = "create-ai-project.ps1"; Desc = "new project scaffold (Phase1)" }
    "rwl"   = @{ Script = "run-with-log.ps1";      Desc = "log-wrapped execution (Phase1)" }
    "note"  = @{ Script = "note.ps1";              Desc = "save dev note (Phase1)" }
    "adr"   = @{ Script = "auto-dev-run.ps1";      Desc = "Phase2 commander" }
    "gsc"   = @{ Script = "git-safe-commit.ps1";   Desc = "safe commit + push (Phase2)" }
    "aerr"  = @{ Script = "analyze-error.ps1";     Desc = "error log analysis (Phase2)" }
    "dstat" = @{ Script = "dev-status.ps1";        Desc = "project dashboard (Phase2)" }
    "ds"    = @{ Script = "dev-start.ps1";          Desc = "git pull + status (Phase3)" }
    "de"    = @{ Script = "dev-end.ps1";            Desc = "commit + push (Phase3)" }
}

# --- Header ---
Write-Host ""
Write-Host ("=" * 66)
Write-Host "  setup-aliases.ps1 -- workspace alias registration"
Write-Host ("=" * 66)
Write-Host "  Workspace : $WorkspaceRoot"
Write-Host "  Profile   : $ProfilePath"
if ($DryRun) { Write-Host "  Mode      : DRY RUN (no changes written)" }
Write-Host ("=" * 66)

# --- Script presence check ---
Write-Host ""
Write-Host "  Script check:"
foreach ($alias in $aliases.Keys) {
    $path   = Join-Path $scriptsDir $aliases[$alias].Script
    $exists = Test-Path $path
    $mark   = if ($exists) { "[OK]" } else { "[--]" }
    Write-Host ("  $mark  {0,-6}  {1}" -f $alias, $path)
}

# --- Read existing profile ---
$profileContent = if (Test-Path $ProfilePath) {
    Get-Content $ProfilePath -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
} else { "" }
if (-not $profileContent) { $profileContent = "" }

# --- Check which aliases exist ---
Write-Host ""
Write-Host "  Alias status:"
$toAdd    = [System.Collections.Generic.List[string]]::new()
$toUpdate = [System.Collections.Generic.List[string]]::new()

foreach ($alias in $aliases.Keys) {
    if ($profileContent -match "function\s+$alias\s*\{") {
        Write-Host ("  [exists] {0,-6}  {1}" -f $alias, $aliases[$alias].Desc)
        $toUpdate.Add($alias)
    } else {
        Write-Host ("  [new]    {0,-6}  {1}" -f $alias, $aliases[$alias].Desc)
        $toAdd.Add($alias)
    }
}

if ($toAdd.Count -eq 0 -and $toUpdate.Count -eq 0) {
    Write-Host "  All aliases already registered."; exit 0
}

# --- Overwrite confirmation ---
$doUpdate = $Force
if ($toUpdate.Count -gt 0 -and -not $Force -and -not $DryRun) {
    Write-Host ""
    $ans = Read-Host "  Overwrite $($toUpdate.Count) existing alias(es)? [y/N]"
    $doUpdate = ($ans -match '^[yY]')
}

# --- Build block ---
$lines = [System.Collections.Generic.List[string]]::new()
$lines.Add("")
$lines.Add("# ===== hirayama-ai-workspace aliases =====")
$lines.Add("# Added: $(Get-Date -Format 'yyyy-MM-dd HH:mm')  by setup-aliases.ps1")

foreach ($alias in $aliases.Keys) {
    if ($toAdd.Contains($alias) -or ($toUpdate.Contains($alias) -and $doUpdate)) {
        $path = Join-Path $scriptsDir $aliases[$alias].Script
        $lines.Add("function $alias { & `"$path`" @args } # $($aliases[$alias].Desc)")
    }
}
$lines.Add("# ===== end aliases =====")

$block = $lines -join "`n"

# --- DryRun ---
if ($DryRun) {
    Write-Host ""
    Write-Host "  --- Preview: would be appended to $ProfilePath ---"
    Write-Host $block
    Write-Host "  --- end preview ---"
    Write-Host ""
    Write-Host "  Run without -DryRun to apply."
    exit 0
}

# --- Remove existing block and individual aliases ---
if ($doUpdate) {
    $profileContent = $profileContent -replace '(?ms)# ===== hirayama-ai-workspace aliases =====.*?# ===== end aliases =====\s*', ''
    foreach ($alias in $toUpdate) {
        $profileContent = $profileContent -replace "(?m)^function\s+$alias\s*\{[^}]*\}[^\r\n]*[\r\n]*", ''
    }
    Set-Content -Path $ProfilePath -Value $profileContent.TrimEnd() -Encoding UTF8
}

# --- Append block ---
Add-Content -Path $ProfilePath -Value $block -Encoding UTF8

# --- Done ---
Write-Host ""
Write-Host ("=" * 66)
Write-Host "  Done -- $ProfilePath updated."
Write-Host ("=" * 66)
Write-Host ""
Write-Host "  Reload now:  . `$PROFILE"
Write-Host "  Commands  :  Phase1: cap / rwl / note"
Write-Host "               Phase2: adr / gsc / aerr / dstat"
    Write-Host "               Phase3: ds (dev-start) / de (dev-end)"
Write-Host ""

exit 0
