#Requires -Version 5.1
<#
.SYNOPSIS
    Auto Dev Mode Phase2 — 司令塔スクリプト。
    1サイクルの「実行コマンド」を run-with-log.ps1 経由で実行し、
    結果を判定してオプションで note を自動生成します。

.DESCRIPTION
    - 実行は必ず run-with-log.ps1 (rwl) を経由します
    - 成功 (exit 0): 指定した -Tag でメモを保存
    - 失敗 (exit != 0): "bug" タグでエラー情報を自動メモ保存
    - 実行後、ログファイルのパスを表示します

.PARAMETER Cmd
    実行するコマンド文字列。例: "python -m pytest tests/ -v"
    ※ 引数内にスペース区切りを含むクォート付き引数は -Args で渡してください。

.PARAMETER AutoNote
    自動 note に使うメッセージ。省略すると note は生成されません。

.PARAMETER Tag
    成功時の note タグ（省略時: done）。失敗時は常に "bug" になります。

.PARAMETER LogDir
    ログ保存先ルート（省略時: ./logs）。run-with-log.ps1 と note.ps1 両方に渡します。

.EXAMPLE
    # 基本実行
    .\auto-dev-run.ps1 -Cmd "python -m pytest tests/ -v"

    # 自動 note 付き（成功→done、失敗→bug で自動保存）
    .\auto-dev-run.ps1 -Cmd "python main.py" -AutoNote "メイン処理実行" -Tag done

    # テスト実行 + note
    .\auto-dev-run.ps1 -Cmd "python -m pytest tests/ -v" -AutoNote "テスト実行" -Tag test

    # ログディレクトリ指定
    .\auto-dev-run.ps1 -Cmd "node src/index.js" -AutoNote "起動確認" -Tag test -LogDir "logs"
#>

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Cmd,

    [Parameter(Position = 1)]
    [string]$AutoNote = "",

    [string]$Tag = "done",

    [string]$LogDir = "logs"
)

Set-StrictMode -Version Latest

# --- スクリプトディレクトリの解決 -----------------------------------------------
$scriptDir = if ($PSScriptRoot) {
    $PSScriptRoot
} else {
    Split-Path -Parent $MyInvocation.MyCommand.Path
}

$rwlScript  = Join-Path $scriptDir "run-with-log.ps1"
$noteScript = Join-Path $scriptDir "note.ps1"

if (-not (Test-Path $rwlScript)) {
    Write-Error "run-with-log.ps1 が見つかりません: $rwlScript"
    exit 1
}

# --- コマンドを Executable + Arguments に分割 ------------------------------------
# シンプルなスペース分割（引数内にスペースを含む場合は -Args オプションを推奨）
$parts      = $Cmd.Trim() -split '\s+', 2
$executable = $parts[0]
$argsStr    = if ($parts.Length -gt 1) { $parts[1] } else { "" }
$argsArray  = if ($argsStr) { $argsStr -split '\s+' } else { @() }

# --- 実行前の状態を記録（新規ログを後で特定するため）----------------------------
$runLogDir     = Join-Path $LogDir "run"
$errorLogDir   = Join-Path $LogDir "error"
$beforeRunLogs = @()

if (Test-Path $runLogDir) {
    $beforeRunLogs = @(
        Get-ChildItem $runLogDir -Filter "run_*.log" -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty FullName
    )
}

# --- ヘッダ出力 -----------------------------------------------------------------
Write-Host ""
Write-Host ("=" * 62) -ForegroundColor Cyan
Write-Host "  auto-dev-run : Phase2 サイクル実行" -ForegroundColor Cyan
Write-Host ("=" * 62) -ForegroundColor Cyan
Write-Host "  Command : $Cmd" -ForegroundColor White
Write-Host "  LogDir  : $LogDir" -ForegroundColor DarkGray
Write-Host ("=" * 62) -ForegroundColor Cyan
Write-Host ""

# --- rwl 経由で実行 -------------------------------------------------------------
$exitCode = 0

try {
    if ($argsArray.Count -gt 0) {
        & $rwlScript $executable @argsArray -LogDir $LogDir
    } else {
        & $rwlScript $executable -LogDir $LogDir
    }
    $exitCode = if ($LASTEXITCODE -ne $null) { $LASTEXITCODE } else { 0 }
} catch {
    Write-Host ""
    Write-Host "  [ERROR] rwl の呼び出しに失敗しました: $_" -ForegroundColor Red
    $exitCode = 1
}

# --- 生成されたログファイルを特定 -----------------------------------------------
$latestRunLog   = $null
$latestErrorLog = $null

if (Test-Path $runLogDir) {
    # 実行前には存在しなかった新規ログを優先
    $newLogs = @(
        Get-ChildItem $runLogDir -Filter "run_*.log" -ErrorAction SilentlyContinue |
        Where-Object { $_.FullName -notin $beforeRunLogs } |
        Sort-Object LastWriteTime -Descending
    )
    if ($newLogs.Count -gt 0) {
        $latestRunLog = $newLogs[0]
    } else {
        # フォールバック: 最新のログ
        $latestRunLog = Get-ChildItem $runLogDir -Filter "run_*.log" -ErrorAction SilentlyContinue |
                        Sort-Object LastWriteTime -Descending |
                        Select-Object -First 1
    }
}

if (Test-Path $errorLogDir) {
    $latestErrorLog = Get-ChildItem $errorLogDir -Filter "error_*.log" -ErrorAction SilentlyContinue |
                     Sort-Object LastWriteTime -Descending |
                     Select-Object -First 1
}

# --- 結果サマリー ---------------------------------------------------------------
Write-Host ""
Write-Host ("=" * 62) -ForegroundColor Cyan
Write-Host "  RESULT" -ForegroundColor Cyan
Write-Host ("=" * 62) -ForegroundColor Cyan

if ($exitCode -eq 0) {
    Write-Host "  STATUS   : SUCCESS (exit 0)" -ForegroundColor Green
} else {
    Write-Host "  STATUS   : FAILED  (exit $exitCode)" -ForegroundColor Red
}

if ($latestRunLog) {
    Write-Host "  RUN LOG  : $($latestRunLog.FullName)" -ForegroundColor DarkGray
} else {
    Write-Host "  RUN LOG  : (生成されませんでした)" -ForegroundColor DarkGray
}

if ($exitCode -ne 0 -and $latestErrorLog) {
    Write-Host "  ERR LOG  : $($latestErrorLog.FullName)" -ForegroundColor Yellow
    Write-Host "  TIP      : analyze-error.ps1 でエラー内容を確認してください" -ForegroundColor Yellow
}

Write-Host ("=" * 62) -ForegroundColor Cyan
Write-Host ""

# --- AutoNote 処理 --------------------------------------------------------------
if ($AutoNote -and (Test-Path $noteScript)) {
    $noteTag = if ($exitCode -eq 0) { $Tag } else { "bug" }

    if ($exitCode -eq 0) {
        $noteMessage = "${AutoNote} — 成功 (exit 0)"
    } else {
        $errLogName = if ($latestErrorLog) { " / errlog: $($latestErrorLog.Name)" } else { "" }
        $noteMessage = "${AutoNote} — 失敗 (exit ${exitCode})${errLogName}"
    }

    & $noteScript $noteMessage -Tag $noteTag -LogDir $LogDir
}

# --- 終了 -----------------------------------------------------------------------
exit $exitCode
