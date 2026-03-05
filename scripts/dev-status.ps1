#Requires -Version 5.1
<#
.SYNOPSIS
    プロジェクトの現在状態をダッシュボード形式で表示します。

.DESCRIPTION
    以下の情報を一覧表示します:
    - git: 現在のブランチ・直近コミット・未コミット変更
    - logs/run/: 本日の実行ログ件数
    - logs/error/: エラーログ件数（直近5件）
    - logs/notes/: 本日の開発メモ
    - ROADMAP.md: 直近タスクの状況

.PARAMETER LogDir
    ログ保存先ルート（省略時: ./logs）。

.PARAMETER NoRoadmap
    ROADMAP.md の表示をスキップします。

.EXAMPLE
    .\dev-status.ps1
    .\dev-status.ps1 -LogDir "logs" -NoRoadmap
#>

param(
    [string]$LogDir    = "logs",
    [switch]$NoRoadmap
)

Set-StrictMode -Version Latest

# --- ヘルパー ---------------------------------------------------------------
function Write-Section {
    param([string]$Title, [string]$Color = "Cyan")
    Write-Host ""
    Write-Host "  [$Title]" -ForegroundColor $Color
    Write-Host ("  " + "-" * 50) -ForegroundColor DarkGray
}

function Write-Row {
    param([string]$Label, [string]$Value, [string]$Color = "White")
    Write-Host ("  {0,-14}: {1}" -f $Label, $Value) -ForegroundColor $Color
}

function Format-FileSize {
    param([long]$Bytes)
    if ($Bytes -ge 1MB) { return "{0:N1} MB" -f ($Bytes / 1MB) }
    if ($Bytes -ge 1KB) { return "{0:N1} KB" -f ($Bytes / 1KB) }
    return "$Bytes B"
}

$today = Get-Date -Format "yyyyMMdd"

# ============================================================
Write-Host ""
Write-Host ("=" * 62) -ForegroundColor Cyan
Write-Host "  dev-status : プロジェクト状態ダッシュボード" -ForegroundColor Cyan
Write-Host "  $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor DarkGray
Write-Host ("=" * 62) -ForegroundColor Cyan

# ============================================================
# 1. Git 状態
# ============================================================
Write-Section "GIT"

$isGitRepo = $false
try {
    $null = git rev-parse --is-inside-work-tree 2>&1
    $isGitRepo = ($LASTEXITCODE -eq 0)
} catch { }

if ($isGitRepo) {
    # ブランチ
    $branch = (git rev-parse --abbrev-ref HEAD 2>&1).Trim()
    $branchColor = if ($branch -eq "master" -or $branch -eq "main") { "Yellow" } else { "Green" }
    Write-Row "Branch" $branch $branchColor

    # 直近コミット5件
    Write-Host "  Recent commits:" -ForegroundColor White
    $commits = git log --oneline -5 2>&1
    foreach ($c in $commits) {
        Write-Host "    $c" -ForegroundColor DarkGray
    }

    # 未コミット変更
    $statusLines = @(git status --short 2>&1 | Where-Object { $_ -ne "" })
    if ($statusLines.Count -eq 0) {
        Write-Row "Working tree" "クリーン (変更なし)" "Green"
    } else {
        Write-Row "変更あり" "$($statusLines.Count) ファイル" "Yellow"
        foreach ($s in $statusLines) {
            Write-Host "    $s" -ForegroundColor Yellow
        }
    }

    # リモートとの差分
    $ahead  = (git rev-list --count "@{u}..HEAD" 2>&1).Trim()
    $behind = (git rev-list --count "HEAD..@{u}" 2>&1).Trim()
    if ($LASTEXITCODE -eq 0) {
        $syncMsg = "ahead:$ahead / behind:$behind"
        $syncColor = if ($ahead -gt 0 -or $behind -gt 0) { "Yellow" } else { "Green" }
        Write-Row "Remote sync" $syncMsg $syncColor
    }
} else {
    Write-Row "Status" "git リポジトリではありません" "DarkGray"
}

# ============================================================
# 2. 実行ログ
# ============================================================
Write-Section "LOGS"

$runLogDir   = Join-Path $LogDir "run"
$errorLogDir = Join-Path $LogDir "error"

# 本日の run ログ
if (Test-Path $runLogDir) {
    $todayRuns = @(Get-ChildItem $runLogDir -Filter "run_${today}_*.log" -ErrorAction SilentlyContinue)
    $allRuns   = @(Get-ChildItem $runLogDir -Filter "run_*.log" -ErrorAction SilentlyContinue)
    Write-Row "Run logs" "本日: $($todayRuns.Count) 件 / 合計: $($allRuns.Count) 件"

    # 最新実行ログ
    $latestRun = $allRuns | Sort-Object LastWriteTime -Descending | Select-Object -First 1
    if ($latestRun) {
        Write-Host "  Latest run : $($latestRun.Name)  [$(Format-FileSize $latestRun.Length)]" -ForegroundColor DarkGray
    }
} else {
    Write-Row "Run logs" "logs/run/ が存在しません" "DarkGray"
}

# エラーログ
if (Test-Path $errorLogDir) {
    $allErrors   = @(Get-ChildItem $errorLogDir -Filter "error_*.log" -ErrorAction SilentlyContinue)
    $todayErrors = @(Get-ChildItem $errorLogDir -Filter "error_${today}_*.log" -ErrorAction SilentlyContinue)

    if ($allErrors.Count -gt 0) {
        $countColor = if ($allErrors.Count -gt 0) { "Red" } else { "Green" }
        Write-Row "Error logs" "本日: $($todayErrors.Count) 件 / 合計: $($allErrors.Count) 件" $countColor

        # 直近5件のエラーログ
        $recentErrors = $allErrors | Sort-Object LastWriteTime -Descending | Select-Object -First 5
        Write-Host "  Recent errors:" -ForegroundColor $(if ($allErrors.Count -gt 0) { "Red" } else { "DarkGray" })
        foreach ($e in $recentErrors) {
            $time = $e.LastWriteTime.ToString("MM-dd HH:mm")
            Write-Host "    $($e.Name)  [$time]" -ForegroundColor Red
        }
        Write-Host "  TIP: analyze-error.ps1 で最新エラーを確認できます" -ForegroundColor DarkGray
    } else {
        Write-Row "Error logs" "0 件 (クリーン)" "Green"
    }
} else {
    Write-Row "Error logs" "logs/error/ が存在しません" "DarkGray"
}

# ============================================================
# 3. 開発メモ（本日分）
# ============================================================
Write-Section "NOTES (本日)"

$notesDir  = Join-Path $LogDir "notes"
$noteFile  = Join-Path $notesDir "note_${today}.md"

if (Test-Path $noteFile) {
    $noteLines = @(Get-Content $noteFile -Encoding UTF8 -ErrorAction SilentlyContinue |
                   Where-Object { $_ -match '^- ' })

    if ($noteLines.Count -gt 0) {
        Write-Host "  $noteFile" -ForegroundColor DarkGray
        Write-Host ""
        # 最新10件
        $displayNotes = $noteLines | Select-Object -Last 10
        foreach ($note in $displayNotes) {
            if ($note -match '`#bug`') {
                Write-Host "  $note" -ForegroundColor Red
            } elseif ($note -match '`#todo`') {
                Write-Host "  $note" -ForegroundColor Yellow
            } elseif ($note -match '`#done`') {
                Write-Host "  $note" -ForegroundColor Green
            } elseif ($note -match '`#decision`') {
                Write-Host "  $note" -ForegroundColor Cyan
            } else {
                Write-Host "  $note" -ForegroundColor White
            }
        }
        if ($noteLines.Count -gt 10) {
            Write-Host "  ... 他 $($noteLines.Count - 10) 件 (ファイルを直接確認: $noteFile)" -ForegroundColor DarkGray
        }
    } else {
        Write-Host "  本日のメモはまだありません。" -ForegroundColor DarkGray
    }
} else {
    Write-Host "  本日のメモファイルがありません: $noteFile" -ForegroundColor DarkGray
    Write-Host "  note.ps1 でメモを保存すると自動生成されます。" -ForegroundColor DarkGray
}

# ============================================================
# 4. ROADMAP.md サマリー
# ============================================================
if (-not $NoRoadmap) {
    Write-Section "ROADMAP"

    $roadmapFile = "ROADMAP.md"
    if (-not (Test-Path $roadmapFile)) {
        # 親ディレクトリも探す
        $roadmapFile = Join-Path (Split-Path (Get-Location)) "ROADMAP.md"
    }

    if (Test-Path $roadmapFile) {
        # 進行中(🔄)・未着手(⏸)・完了(✅) の件数を集計
        $roadmapLines = Get-Content $roadmapFile -Encoding UTF8 -ErrorAction SilentlyContinue
        $countDone    = @($roadmapLines | Where-Object { $_ -match '✅' }).Count
        $countInProg  = @($roadmapLines | Where-Object { $_ -match '🔄' }).Count
        $countPending = @($roadmapLines | Where-Object { $_ -match '⏸' }).Count

        Write-Host "  $roadmapFile" -ForegroundColor DarkGray
        Write-Host ""
        Write-Host ("  {0,-14}: {1}" -f "✅ 完了" "$countDone 件") -ForegroundColor Green
        Write-Host ("  {0,-14}: {1}" -f "🔄 進行中" "$countInProg 件") -ForegroundColor Cyan
        Write-Host ("  {0,-14}: {1}" -f "⏸ 未着手" "$countPending 件") -ForegroundColor Yellow

        # 進行中タスクを表示
        $inProgressLines = @($roadmapLines | Where-Object { $_ -match '🔄' } | Select-Object -First 5)
        if ($inProgressLines.Count -gt 0) {
            Write-Host ""
            Write-Host "  進行中タスク:" -ForegroundColor Cyan
            foreach ($line in $inProgressLines) {
                Write-Host "    $($line.Trim())" -ForegroundColor Cyan
            }
        }
    } else {
        Write-Host "  ROADMAP.md が見つかりません" -ForegroundColor DarkGray
    }
}

# ============================================================
Write-Host ""
Write-Host ("=" * 62) -ForegroundColor Cyan
Write-Host ""

exit 0
