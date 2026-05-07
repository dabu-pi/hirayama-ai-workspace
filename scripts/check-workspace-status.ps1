# check-workspace-status.ps1
# workspace 配下の全 repo の状態を一括確認する。
# 使い方: workspace 直下から .\scripts\check-workspace-status.ps1

$repos = @(
    @{ Label = "parent workspace";               Path = "C:\hirayama-ai-workspace\workspace" },
    @{ Label = "desktop-work-status-overlay";    Path = "C:\hirayama-ai-workspace\workspace\desktop-work-status-overlay" },
    @{ Label = "wildboar-member-management";     Path = "C:\hirayama-ai-workspace\workspace\wildboar-member-management" },
    @{ Label = "training-program-platform-jp";   Path = "C:\hirayama-ai-workspace\workspace\training-program-platform-jp" },
    @{ Label = "subsidy-grants-projects";        Path = "C:\hirayama-ai-workspace\workspace\subsidy-grants-projects" }
)

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Workspace Status Check" -ForegroundColor Cyan
Write-Host " $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

foreach ($repo in $repos) {
    $path = $repo.Path
    $label = $repo.Label

    if (-not (Test-Path "$path\.git")) {
        Write-Host "[$label]" -ForegroundColor DarkGray
        Write-Host "  (not a git repo — skip)" -ForegroundColor DarkGray
        Write-Host ""
        continue
    }

    $branch  = & git -C $path branch --show-current 2>$null
    $latest  = & git -C $path log -1 --oneline 2>$null
    $remote  = & git -C $path remote get-url origin 2>$null
    $statusLines = @(& git -C $path status --short 2>$null)
    $isDirty = $statusLines.Count -gt 0

    $statusLabel = if ($isDirty) { "DIRTY ($($statusLines.Count) file(s))" } else { "clean" }
    $statusColor = if ($isDirty) { "Yellow" } else { "Green" }

    Write-Host "[$label]" -ForegroundColor Cyan
    Write-Host "  path   : $path"
    Write-Host "  branch : $branch"
    Write-Host "  status : $statusLabel" -ForegroundColor $statusColor
    Write-Host "  latest : $latest"
    if ($remote) { Write-Host "  remote : $remote" }

    if ($isDirty) {
        Write-Host "  dirty files:" -ForegroundColor Yellow
        foreach ($line in $statusLines) {
            Write-Host "    $line" -ForegroundColor Yellow
        }
    }
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Done." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor White
Write-Host "  - DIRTY repos need attention before starting new work."
Write-Host "  - See WORKSPACE_OPERATION_RULES.md for repo boundary rules."
Write-Host ""
