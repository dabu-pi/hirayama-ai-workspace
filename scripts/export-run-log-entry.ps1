#Requires -Version 5.1
<#
.SYNOPSIS
    dev-end 実行後の Run_Log 用エントリを JSON / TSV で生成します。

.DESCRIPTION
    Google スプレッドシートへ直接書き込まず、貼り付け用の 1 行データを
    logs/runlog/ に保存します。将来の自動連携用に JSON も同時出力します。
#>

param(
    [Parameter(Mandatory = $true)]
    [string]$Summary,

    [string]$Result = "SUCCESS",
    [string]$CommitHash = "",
    [string]$NextAction = "",
    [string]$ProjectId = "",
    [string]$TasksDone = "",
    [string]$StopReason = "",
    [string]$LogDir = "logs"
)

Set-StrictMode -Version Latest

function Resolve-ProjectId {
    param([string]$Path)

    $normalized = $Path.Replace('/', '\')

    if ($normalized -match '\\ai-os(\\|$)') { return 'AIOS-06' }
    if ($normalized -match '\\freee-automation(\\|$)') { return 'FREEE-02' }
    if ($normalized -match '\\gas-projects\\jyu-gas-ver3\.1(\\|$)') { return 'GAS-01' }
    if ($normalized -match '\\patient-management(\\|$)') { return 'WEB-03' }
    if ($normalized -match '\\hirayama-jyusei-strategy(\\|$)') { return 'STR-04' }
    return 'COMMON'
}

$runlogDir = Join-Path $LogDir 'runlog'
New-Item -ItemType Directory -Force -Path $runlogDir | Out-Null

$now = Get-Date
$stamp = $now.ToString('yyyyMMdd_HHmmss')
$logId = 'LOG-{0}' -f $now.ToString('yyyyMMdd-HHmmss')

if (-not $ProjectId) {
    $ProjectId = Resolve-ProjectId -Path (Get-Location).Path
}

$entry = [ordered]@{
    log_id      = $logId
    datetime    = $now.ToString('yyyy-MM-dd HH:mm:ss')
    system      = 'Codex'
    project     = $ProjectId
    summary     = $Summary
    result      = $Result
    commit_hash = $CommitHash
    tasks_done  = $TasksDone
    stop_reason = $StopReason
    next_action = $NextAction
}

$jsonPath = Join-Path $runlogDir ("runlog_{0}.json" -f $stamp)
$tsvPath  = Join-Path $runlogDir ("runlog_{0}.tsv" -f $stamp)

$entry | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 -Path $jsonPath

$tsvHeader = 'log_id	datetime	system	project	summary	result	commit_hash	tasks_done	stop_reason	next_action'
$tsvRow = @(
    $entry.log_id,
    $entry.datetime,
    $entry.system,
    $entry.project,
    $entry.summary,
    $entry.result,
    $entry.commit_hash,
    $entry.tasks_done,
    $entry.stop_reason,
    $entry.next_action
) -join "`t"

@($tsvHeader, $tsvRow) | Set-Content -Encoding UTF8 -Path $tsvPath

Write-Host ''
Write-Host '[OK] Run_Log entry generated' -ForegroundColor Green
Write-Host "  JSON : $jsonPath"
Write-Host "  TSV  : $tsvPath"
Write-Host '  Paste row:'
Write-Host "    $tsvRow"
Write-Host ''

exit 0
