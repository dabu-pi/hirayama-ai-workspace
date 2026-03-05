#Requires -Version 5.1
<#
.SYNOPSIS
    コマンドを実行し、実行ログ・エラーログを自動保存します。

.DESCRIPTION
    指定したコマンドを実行しながらリアルタイムで出力を表示し、
    カレントディレクトリの logs/run/ にログを保存します。
    終了コードが 0 以外の場合は logs/error/ にもコピーします。

.PARAMETER Executable
    実行するコマンド（例: python, node, pwsh）

.PARAMETER Arguments
    コマンドへの引数（残りすべて）

.PARAMETER LogDir
    ログ保存先のルートディレクトリ（省略時: ./logs）

.EXAMPLE
    .\run-with-log.ps1 python main.py
    .\run-with-log.ps1 node src/index.js --port 3000
    .\run-with-log.ps1 python -m pytest tests/
#>

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Executable,

    [Parameter(Position = 1, ValueFromRemainingArguments = $true)]
    [string[]]$Arguments = @(),

    [string]$LogDir = "logs"
)

Set-StrictMode -Version Latest

# --- ディレクトリ準備 ---------------------------------------------------
$runDir   = Join-Path $LogDir "run"
$errorDir = Join-Path $LogDir "error"

New-Item -ItemType Directory -Force -Path $runDir   | Out-Null
New-Item -ItemType Directory -Force -Path $errorDir | Out-Null

# --- タイムスタンプ・ファイル名 -----------------------------------------
$timestamp  = Get-Date -Format "yyyyMMdd_HHmmss"
$logFile    = Join-Path $runDir   "run_$timestamp.log"
$errorFile  = Join-Path $errorDir "error_$timestamp.log"
$fullCmd    = "$Executable $($Arguments -join ' ')".Trim()

# --- ヘッダー書き込み ---------------------------------------------------
$header = @"
# ============================================================
# Run Log
# ============================================================
# Command  : $fullCmd
# Start    : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
# WorkDir  : $(Get-Location)
# LogFile  : $logFile
# ============================================================

"@

Set-Content -Path $logFile -Value $header -Encoding UTF8

# --- 実行 ---------------------------------------------------------------
Write-Host ""
Write-Host "🚀 $fullCmd" -ForegroundColor Cyan
Write-Host "📄 $logFile" -ForegroundColor DarkGray
Write-Host ""

$startTime   = Get-Date
$outputLines = [System.Collections.Generic.List[string]]::new()
$hasError    = $false

try {
    # リアルタイム表示しながら出力を収集
    & $Executable @Arguments 2>&1 | ForEach-Object {
        $line = if ($_ -is [System.Management.Automation.ErrorRecord]) {
            $hasError = $true
            "[STDERR] $_"
        } else {
            "$_"
        }
        Write-Host $line
        $outputLines.Add($line)
    }
    $exitCode = $LASTEXITCODE
    if ($null -eq $exitCode) { $exitCode = 0 }
}
catch {
    $hasError = $true
    $exitCode = 1
    $errLine  = "[EXCEPTION] $_"
    Write-Host $errLine -ForegroundColor Red
    $outputLines.Add($errLine)
}

$duration = (Get-Date) - $startTime

# --- 本文・フッター書き込み ---------------------------------------------
Add-Content -Path $logFile -Value ($outputLines -join "`n") -Encoding UTF8

$footer = @"


# ============================================================
# End      : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
# Duration : $([math]::Round($duration.TotalSeconds, 2))s
# ExitCode : $exitCode
# Status   : $(if ($exitCode -eq 0) { 'SUCCESS' } else { 'FAILED' })
# ============================================================
"@

Add-Content -Path $logFile -Value $footer -Encoding UTF8

# --- エラー時の処理 -----------------------------------------------------
Write-Host ""
if ($exitCode -ne 0) {
    Copy-Item -Path $logFile -Destination $errorFile
    Write-Host "❌ Failed (exit: $exitCode)  →  $errorFile" -ForegroundColor Red
} else {
    Write-Host "✅ Done in $([math]::Round($duration.TotalSeconds, 2))s  →  $logFile" -ForegroundColor Green
}
Write-Host ""

exit $exitCode
