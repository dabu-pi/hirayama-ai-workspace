#Requires -Version 5.1
<#
.SYNOPSIS
    最新のエラーログを整形表示します。
    失敗した auto-dev-run の直後に呼び出して根本原因を確認するのに使います。

.DESCRIPTION
    logs/error/ ディレクトリ内の最新 error_*.log を読み込み、
    - ファイル情報（名前・サイズ・日時）
    - STDERR 行のみ抽出（[STDERR] プレフィックス）
    - ログ末尾 N 行（コマンドの終了付近）
    - 終了コード・ステータス
    をハイライト付きで表示します。

.PARAMETER LogDir
    ログ保存先ルート（省略時: ./logs）。

.PARAMETER Lines
    末尾から表示する行数（省略時: 50）。

.PARAMETER All
    全行を表示します（-Lines より優先）。

.PARAMETER ListAll
    error ログの一覧を表示します（最新10件）。

.EXAMPLE
    # 最新エラーログを確認
    .\analyze-error.ps1

    # 表示行数を増やす
    .\analyze-error.ps1 -Lines 100

    # 全行表示
    .\analyze-error.ps1 -All

    # エラーログ一覧を確認
    .\analyze-error.ps1 -ListAll
#>

param(
    [string]$LogDir  = "logs",
    [int]   $Lines   = 50,
    [switch]$All,
    [switch]$ListAll
)

Set-StrictMode -Version Latest

# --- ヘルパー ---------------------------------------------------------------
function Write-Header {
    param([string]$Title, [string]$Color = "Cyan")
    Write-Host ""
    Write-Host ("=" * 62) -ForegroundColor $Color
    Write-Host "  $Title" -ForegroundColor $Color
    Write-Host ("=" * 62) -ForegroundColor $Color
}

function Format-FileSize {
    param([long]$Bytes)
    if ($Bytes -ge 1MB) { return "{0:N1} MB" -f ($Bytes / 1MB) }
    if ($Bytes -ge 1KB) { return "{0:N1} KB" -f ($Bytes / 1KB) }
    return "$Bytes B"
}

# --- エラーログディレクトリ確認 ------------------------------------------------
$errorLogDir = Join-Path $LogDir "error"

if (-not (Test-Path $errorLogDir)) {
    Write-Host ""
    Write-Host "  エラーログディレクトリが存在しません: $errorLogDir" -ForegroundColor Yellow
    Write-Host "  logs/error/ はエラー発生時に run-with-log.ps1 が自動生成します。" -ForegroundColor DarkGray
    Write-Host ""
    exit 0
}

$errorLogs = @(
    Get-ChildItem $errorLogDir -Filter "error_*.log" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending
)

if ($errorLogs.Count -eq 0) {
    Write-Host ""
    Write-Host "  エラーログが見つかりません。" -ForegroundColor Green
    Write-Host "  logs/error/ にファイルがない = 直近の実行でエラーなし。" -ForegroundColor DarkGray
    Write-Host ""
    exit 0
}

# --- 一覧表示モード ------------------------------------------------------------
if ($ListAll) {
    Write-Header "エラーログ一覧 (直近 10 件)"
    Write-Host ""
    $recent = $errorLogs | Select-Object -First 10
    $i = 1
    foreach ($log in $recent) {
        $size = Format-FileSize $log.Length
        $time = $log.LastWriteTime.ToString("yyyy-MM-dd HH:mm:ss")
        $prefix = if ($i -eq 1) { "  * [最新]" } else { "    [$i]   " }
        Write-Host "${prefix} $($log.Name)  ($size)  $time" -ForegroundColor $(if ($i -eq 1) { "Yellow" } else { "DarkGray" })
        $i++
    }
    Write-Host ""
    exit 0
}

# --- 最新エラーログを解析 -------------------------------------------------------
$targetLog = $errorLogs[0]
$logContent = Get-Content $targetLog.FullName -Encoding UTF8 -ErrorAction SilentlyContinue

Write-Header "analyze-error : エラーログ解析" "Yellow"
Write-Host ""
Write-Host "  ファイル  : $($targetLog.Name)" -ForegroundColor White
Write-Host "  パス      : $($targetLog.FullName)" -ForegroundColor DarkGray
Write-Host "  サイズ    : $(Format-FileSize $targetLog.Length)" -ForegroundColor DarkGray
Write-Host "  更新日時  : $($targetLog.LastWriteTime.ToString('yyyy-MM-dd HH:mm:ss'))" -ForegroundColor DarkGray

# ログが空の場合
if (-not $logContent -or $logContent.Count -eq 0) {
    Write-Host ""
    Write-Host "  ログが空です。" -ForegroundColor Yellow
    Write-Host ""
    exit 0
}

# --- ヘッダ情報（コマンド・開始時刻）を抽出 ------------------------------------
Write-Host ""
Write-Host ("  " + "-" * 58) -ForegroundColor DarkGray
Write-Host "  ログヘッダ:" -ForegroundColor White

$headerLines = $logContent | Where-Object { $_ -match '^#' } | Select-Object -First 8
foreach ($line in $headerLines) {
    if ($line -match 'Command|Start|WorkDir|ExitCode|Status') {
        $color = if ($line -match 'ExitCode.*[^0]$' -or $line -match 'Status.*FAIL') { "Red" }
                 elseif ($line -match 'Status.*SUCCESS') { "Green" }
                 else { "DarkGray" }
        Write-Host "  $line" -ForegroundColor $color
    }
}

# --- STDERR 行を抽出 -----------------------------------------------------------
$stderrLines = @($logContent | Where-Object { $_ -match '^\[STDERR\]' })

if ($stderrLines.Count -gt 0) {
    Write-Host ""
    Write-Host ("  " + "-" * 58) -ForegroundColor DarkGray
    Write-Host "  STDERR 行 ($($stderrLines.Count) 件):" -ForegroundColor Red
    Write-Host ""

    $displayLines = if ($stderrLines.Count -gt 30) {
        Write-Host "  ※ 多数あるため最初の30件のみ表示" -ForegroundColor DarkGray
        $stderrLines | Select-Object -First 30
    } else {
        $stderrLines
    }

    foreach ($line in $displayLines) {
        # エラーキーワードをハイライト
        if ($line -match 'Error|Exception|Traceback|FAILED|fatal') {
            Write-Host "  $line" -ForegroundColor Red
        } elseif ($line -match 'Warning|warn') {
            Write-Host "  $line" -ForegroundColor Yellow
        } else {
            Write-Host "  $line" -ForegroundColor DarkGray
        }
    }
}

# --- 末尾 N 行（実行結果の末尾を確認）------------------------------------------
$bodyLines = @($logContent | Where-Object { $_ -notmatch '^#' })

$displayCount = if ($All) { $bodyLines.Count } else { [Math]::Min($Lines, $bodyLines.Count) }
$startIndex   = [Math]::Max(0, $bodyLines.Count - $displayCount)
$tailLines    = $bodyLines[$startIndex..($bodyLines.Count - 1)]

Write-Host ""
Write-Host ("  " + "-" * 58) -ForegroundColor DarkGray

$label = if ($All) {
    "全ログ ($($bodyLines.Count) 行):"
} else {
    "末尾 $displayCount 行 (全 $($bodyLines.Count) 行中):"
}
Write-Host "  $label" -ForegroundColor White
Write-Host ""

foreach ($line in $tailLines) {
    if ($line -match 'Error|Exception|Traceback|FAILED|fatal') {
        Write-Host "  $line" -ForegroundColor Red
    } elseif ($line -match 'Warning|warn|WARN') {
        Write-Host "  $line" -ForegroundColor Yellow
    } elseif ($line -match 'PASSED|SUCCESS|OK|passed') {
        Write-Host "  $line" -ForegroundColor Green
    } elseif ($line -match '^\[STDERR\]') {
        Write-Host "  $line" -ForegroundColor DarkGray
    } else {
        Write-Host "  $line"
    }
}

# --- 複数エラーログの警告 -------------------------------------------------------
if ($errorLogs.Count -gt 1) {
    Write-Host ""
    Write-Host ("  " + "-" * 58) -ForegroundColor DarkGray
    Write-Host "  他に $($errorLogs.Count - 1) 件のエラーログがあります。" -ForegroundColor DarkGray
    Write-Host "  一覧を見るには: analyze-error -ListAll" -ForegroundColor DarkGray
}

Write-Host ""
Write-Host ("=" * 62) -ForegroundColor Yellow
Write-Host ""

exit 0
