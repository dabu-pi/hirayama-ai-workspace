# git-health-check.ps1
#
# workspace 配下の全 Git repo について、index 再評価を強制した上で
# dirty / missing tracked / ahead-behind / upstream 未設定を一括で報告する。
#
# 通常運用ではこのスクリプトは branch checkout を行わない（破壊的変更ゼロ）。
# 各 repo の現在 branch のみを対象に確認する。
#
# 使い方:
#   pwsh -File tools\git-health-check.ps1
#   pwsh -File tools\git-health-check.ps1 -Json   # JSON で出力（CI / 他ツール連携用）
#
# 背景: docs/GIT_DIRTY_ROOT_CAUSE_2026-05-14.md を参照。
# `git status --porcelain=v1` だけでは tracked-but-missing が見落とされる場合があるため、
# `git ls-files -d` を必ず併用する。

param(
  [switch]$Json
)

$ErrorActionPreference = "Continue"

$workspaceRoot = "C:\hirayama-ai-workspace\workspace"

$repos = @(
  ".",
  "desktop-work-status-overlay",
  "gas-projects\jrec-sf01-selfpay",
  "gas-projects\jyu-gas-ver3.1",
  "hirayama-jyusei-strategy",
  "life-design-project",
  "subsidy-grants-projects",
  "training-program-platform-jp",
  "training-trend-analyzer",
  "treadmill-motor-crusher-project",
  "wildboar-member-management"
)

$results = @()
$hasIssues = $false

foreach ($rel in $repos) {
  $repo = Join-Path $workspaceRoot $rel
  if (-not (Test-Path "$repo\.git")) {
    $results += [pscustomobject]@{
      repo               = $rel
      exists             = $false
      branch             = $null
      head               = $null
      porcelain_count    = $null
      deleted_tracked    = @()
      untracked_count    = $null
      ahead              = $null
      behind             = $null
      upstream_set       = $null
      issues             = @("no .git directory")
    }
    $hasIssues = $true
    continue
  }

  # 1. index refresh (no destructive change)
  & git -C $repo update-index -q --refresh 2>$null | Out-Null

  # 2. branch / HEAD
  $branch = (& git -C $repo branch --show-current 2>$null).Trim()
  $head   = (& git -C $repo rev-parse --short HEAD 2>$null).Trim()

  # 3. porcelain status
  $porcelain      = & git -C $repo status --porcelain=v1
  $porcelainCount = if ($porcelain) { ($porcelain | Measure-Object).Count } else { 0 }

  # 4. tracked but missing on disk (the key check)
  $missing      = & git -C $repo ls-files -d
  $missingArr   = @()
  if ($missing) { $missingArr = @($missing | ForEach-Object { $_ }) }

  # 5. untracked
  $untracked      = & git -C $repo ls-files --others --exclude-standard
  $untrackedCount = if ($untracked) { ($untracked | Measure-Object).Count } else { 0 }

  # 6. ahead / behind upstream
  $upstreamRef = & git -C $repo rev-parse --abbrev-ref --symbolic-full-name "@{u}" 2>$null
  $ahead  = $null
  $behind = $null
  $upstreamSet = [bool]$upstreamRef
  if ($upstreamSet) {
    $counts = & git -C $repo rev-list --left-right --count "HEAD...@{u}" 2>$null
    if ($counts -match '^(\d+)\s+(\d+)$') {
      $ahead  = [int]$matches[1]
      $behind = [int]$matches[2]
    }
  }

  $issues = @()
  if ($porcelainCount -gt 0) { $issues += "dirty=$porcelainCount" }
  if ($missingArr.Count -gt 0) { $issues += "missing_tracked=$($missingArr.Count)" }
  if (-not $upstreamSet) { $issues += "no_upstream" }
  if ($behind -and $behind -gt 0) { $issues += "behind=$behind" }
  if ($ahead -and $ahead -gt 0) { $issues += "ahead=$ahead" }

  if ($issues.Count -gt 0) { $hasIssues = $true }

  $results += [pscustomobject]@{
    repo            = $rel
    exists          = $true
    branch          = $branch
    head            = $head
    porcelain_count = $porcelainCount
    deleted_tracked = $missingArr
    untracked_count = $untrackedCount
    ahead           = $ahead
    behind          = $behind
    upstream_set    = $upstreamSet
    issues          = $issues
  }
}

if ($Json) {
  $results | ConvertTo-Json -Depth 5
} else {
  Write-Host "=== git-health-check ($(Get-Date -Format yyyy-MM-ddTHH:mm:ss)) ==="
  foreach ($r in $results) {
    Write-Host ""
    Write-Host "[$($r.repo)]"
    if (-not $r.exists) {
      Write-Host "  no .git"
      continue
    }
    Write-Host "  branch:          $($r.branch)"
    Write-Host "  head:            $($r.head)"
    Write-Host "  porcelain:       $($r.porcelain_count)"
    Write-Host "  missing tracked: $($r.deleted_tracked.Count)"
    if ($r.deleted_tracked.Count -gt 0) {
      foreach ($f in $r.deleted_tracked) { Write-Host "    - $f" }
    }
    Write-Host "  untracked:       $($r.untracked_count)"
    if ($r.upstream_set) {
      Write-Host "  ahead/behind:    $($r.ahead)/$($r.behind)"
    } else {
      Write-Host "  upstream:        (none)"
    }
    if ($r.issues.Count -gt 0) {
      Write-Host "  issues:          $($r.issues -join ', ')"
    }
  }
  Write-Host ""
  if ($hasIssues) {
    Write-Host "RESULT: issues found"
    exit 1
  } else {
    Write-Host "RESULT: all clean"
    exit 0
  }
}
