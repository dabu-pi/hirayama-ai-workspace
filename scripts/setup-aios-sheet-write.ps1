#Requires -Version 5.1
<#
.SYNOPSIS
    AI OS Run_Log の Google Sheets 直接書き込み用ユーザー環境変数を設定します。
#>

param(
    [string]$ServiceAccountPath = 'C:\hirayama-ai-workspace\workspace\secrets\aios-service-account.json',
    [string]$SpreadsheetId = '1EvZMtMiX5TKsSBYPhF5VrCcK9JEWHhUHuuYkUTRSIfk',
    [string]$SheetName = 'Run_Log',
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Write-Ok   { param([string]$msg) Write-Host "[OK]   $msg" -ForegroundColor Green }
function Write-Warn { param([string]$msg) Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Err  { param([string]$msg) Write-Host "[ERR]  $msg" -ForegroundColor Red }

if (-not (Test-Path $ServiceAccountPath)) {
    Write-Err "service_account.json が見つかりません: $ServiceAccountPath"
    Write-Host ''
    Write-Host '次のどちらかを行ってから再実行してください。'
    Write-Host '  1. 既存の service_account.json をこのPCへコピーする'
    Write-Host '  2. Google Cloud で新しいサービスアカウント鍵を発行して配置する'
    exit 1
}

try {
    $account = Get-Content -Raw -Path $ServiceAccountPath | ConvertFrom-Json
} catch {
    Write-Err 'service_account.json の読み込みに失敗しました。JSON形式を確認してください。'
    exit 1
}

if (-not $account.client_email) {
    Write-Err 'service_account.json に client_email がありません。'
    exit 1
}

$existing = [Environment]::GetEnvironmentVariable('AIOS_SERVICE_ACCOUNT_PATH', 'User')
if ($existing -and -not $Force) {
    Write-Warn "AIOS_SERVICE_ACCOUNT_PATH は既に設定されています: $existing"
    Write-Host '上書きする場合は -Force を付けて再実行してください。'
    exit 1
}

[Environment]::SetEnvironmentVariable('AIOS_SERVICE_ACCOUNT_PATH', $ServiceAccountPath, 'User')
[Environment]::SetEnvironmentVariable('AIOS_DASHBOARD_SPREADSHEET_ID', $SpreadsheetId, 'User')
[Environment]::SetEnvironmentVariable('AIOS_RUNLOG_SHEET_NAME', $SheetName, 'User')
[Environment]::SetEnvironmentVariable('AIOS_RUNLOG_SHEET_WRITE', '1', 'User')

Write-Host ''
Write-Ok 'AI OS Sheets 直接書き込み用の環境変数を設定しました。'
Write-Host "       service account : $ServiceAccountPath"
Write-Host "       client_email    : $($account.client_email)"
Write-Host "       spreadsheet id  : $SpreadsheetId"
Write-Host "       sheet name      : $SheetName"
Write-Host ''
Write-Host 'まだ必要な作業:'
Write-Host '  - Google Sheets でこの client_email を編集者として共有する'
Write-Host '  - 新しい PowerShell を開くか、ターミナルを再起動する'
Write-Host '  - その後 de を1回実行して Run_Log への live append を確認する'
