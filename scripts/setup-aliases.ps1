#Requires -Version 5.1
<#
.SYNOPSIS
    hirayama-ai-workspace の PowerShell エイリアスを $PROFILE に自動登録します。

.DESCRIPTION
    以下のエイリアスを PowerShell $PROFILE に追加します:

    Phase1:
      cap   → create-ai-project.ps1  新規プロジェクト作成
      rwl   → run-with-log.ps1       ログ付き実行（直接）
      note  → note.ps1               開発メモ保存

    Phase2:
      adr   → auto-dev-run.ps1       司令塔：rwl経由実行 + 自動note
      gsc   → git-safe-commit.ps1    安全確認付き commit & push
      aerr  → analyze-error.ps1      最新エラーログ整形表示
      dstat → dev-status.ps1         プロジェクト状態ダッシュボード

    既にエイリアスが存在する場合は上書きするか確認します（-Force で強制上書き）。

.PARAMETER WorkspaceRoot
    workspace/ のルートパス。省略時はスクリプトの2つ上のディレクトリを自動検出。

.PARAMETER ProfilePath
    書き込む $PROFILE のパス。省略時は現在の $PROFILE を使用。

.PARAMETER Force
    既存のエイリアス定義を確認なしに上書きします。

.PARAMETER DryRun
    実際には書き込まず、追加予定の内容を表示します。

.EXAMPLE
    # 通常実行（対話確認あり）
    .\setup-aliases.ps1

    # workspace ルートを明示して実行
    .\setup-aliases.ps1 -WorkspaceRoot "C:\hirayama-ai-workspace\workspace"

    # 確認なしに上書き
    .\setup-aliases.ps1 -Force

    # 何が追加されるか確認だけ
    .\setup-aliases.ps1 -DryRun
#>

param(
    [string]$WorkspaceRoot = "",
    [string]$ProfilePath   = "",
    [switch]$Force,
    [switch]$DryRun
)

Set-StrictMode -Version Latest

# --- ワークスペースルートの解決 -----------------------------------------------
if (-not $WorkspaceRoot) {
    # スクリプトは workspace/scripts/ にあるので、2つ上が workspace/
    $scriptDir = if ($PSScriptRoot) { $PSScriptRoot } else {
        Split-Path -Parent $MyInvocation.MyCommand.Path
    }
    $WorkspaceRoot = Split-Path $scriptDir -Parent
}

# パスを絶対パスに変換
$WorkspaceRoot = (Resolve-Path $WorkspaceRoot -ErrorAction SilentlyContinue).Path
if (-not $WorkspaceRoot) {
    Write-Error "workspace ルートが見つかりません。-WorkspaceRoot で正しいパスを指定してください。"
    exit 1
}

$scriptsDir = Join-Path $WorkspaceRoot "scripts"

# --- $PROFILE パスの解決 -------------------------------------------------------
if (-not $ProfilePath) {
    $ProfilePath = $PROFILE
}

# $PROFILE のディレクトリが存在しない場合は作成
$profileDir = Split-Path $ProfilePath -Parent
if (-not (Test-Path $profileDir)) {
    if (-not $DryRun) {
        New-Item -ItemType Directory -Path $profileDir -Force | Out-Null
    }
}

# --- エイリアス定義 ----------------------------------------------------------

$aliases = [ordered]@{
    # Phase1
    "cap"   = @{
        Script  = "create-ai-project.ps1"
        Comment = "新規プロジェクト作成 (Phase1)"
    }
    "rwl"   = @{
        Script  = "run-with-log.ps1"
        Comment = "ログ付き実行 (Phase1)"
    }
    "note"  = @{
        Script  = "note.ps1"
        Comment = "開発メモ保存 (Phase1)"
    }
    # Phase2
    "adr"   = @{
        Script  = "auto-dev-run.ps1"
        Comment = "司令塔：rwl経由実行+自動note (Phase2)"
    }
    "gsc"   = @{
        Script  = "git-safe-commit.ps1"
        Comment = "安全確認付きcommit & push (Phase2)"
    }
    "aerr"  = @{
        Script  = "analyze-error.ps1"
        Comment = "最新エラーログ整形表示 (Phase2)"
    }
    "dstat" = @{
        Script  = "dev-status.ps1"
        Comment = "プロジェクト状態ダッシュボード (Phase2)"
    }
}

# --- ヘッダ出力 ---------------------------------------------------------------
Write-Host ""
Write-Host ("=" * 66) -ForegroundColor Cyan
Write-Host "  setup-aliases.ps1 — PowerShell エイリアス登録" -ForegroundColor Cyan
Write-Host ("=" * 66) -ForegroundColor Cyan
Write-Host "  Workspace : $WorkspaceRoot" -ForegroundColor DarkGray
Write-Host "  Profile   : $ProfilePath" -ForegroundColor DarkGray
if ($DryRun) {
    Write-Host "  Mode      : DRY RUN（実際には書き込みません）" -ForegroundColor Yellow
}
Write-Host ("=" * 66) -ForegroundColor Cyan

# --- スクリプト存在確認 -------------------------------------------------------
Write-Host ""
Write-Host "  スクリプトの存在確認:" -ForegroundColor White

$allExist = $true
foreach ($alias in $aliases.Keys) {
    $scriptPath = Join-Path $scriptsDir $aliases[$alias].Script
    $exists = Test-Path $scriptPath
    if ($exists) {
        Write-Host ("  [OK] {0,-6} → {1}" -f $alias, $scriptPath) -ForegroundColor Green
    } else {
        Write-Host ("  [--] {0,-6} → {1} (見つかりません)" -f $alias, $scriptPath) -ForegroundColor Yellow
        # 存在しないスクリプトのエイリアスは登録しない（警告のみ）
    }
}

# --- 既存 $PROFILE の内容確認 --------------------------------------------------
$profileContent = ""
if (Test-Path $ProfilePath) {
    $profileContent = Get-Content $ProfilePath -Raw -Encoding UTF8 -ErrorAction SilentlyContinue
    if (-not $profileContent) { $profileContent = "" }
}

# --- 追加/上書きが必要なエイリアスを判定 ----------------------------------------
Write-Host ""
Write-Host "  エイリアス登録状態:" -ForegroundColor White

$toAdd    = [System.Collections.Generic.List[string]]::new()
$toUpdate = [System.Collections.Generic.List[string]]::new()

foreach ($alias in $aliases.Keys) {
    $scriptPath = Join-Path $scriptsDir $aliases[$alias].Script
    $comment    = $aliases[$alias].Comment

    # 既存の関数定義パターン（function <alias> {で始まる行）
    $existsInProfile = $profileContent -match "function\s+$alias\s*\{"

    if ($existsInProfile) {
        Write-Host ("  [存在] {0,-6}  {1}" -f $alias, $comment) -ForegroundColor DarkGray
        $toUpdate.Add($alias)
    } else {
        Write-Host ("  [追加] {0,-6}  {1}" -f $alias, $comment) -ForegroundColor Cyan
        $toAdd.Add($alias)
    }
}

if ($toAdd.Count -eq 0 -and $toUpdate.Count -eq 0) {
    Write-Host ""
    Write-Host "  すべてのエイリアスが既に登録されています。" -ForegroundColor Green
    Write-Host ""
    exit 0
}

# --- 上書き確認 ---------------------------------------------------------------
$willUpdate = $toUpdate.Count -gt 0 -and (-not $Force)
if ($willUpdate -and -not $DryRun) {
    Write-Host ""
    Write-Host "  既存のエイリアス ($($toUpdate.Count) 件) を上書きしますか？" -ForegroundColor Yellow
    Write-Host "  既存定義を削除して新しい定義を末尾に追加します。" -ForegroundColor DarkGray
    $answer = Read-Host "  [y/N]"
    if ($answer -notmatch '^[yY]') {
        Write-Host ""
        Write-Host "  上書きをスキップしました。新規エイリアスのみ追加します。" -ForegroundColor DarkGray
        $toUpdate.Clear()
    }
}

# --- 追加内容の生成 -----------------------------------------------------------
$linesToAdd = [System.Collections.Generic.List[string]]::new()
$linesToAdd.Add("")
$linesToAdd.Add("# ===== hirayama-ai-workspace aliases =====")
$linesToAdd.Add("# 追加日時: $(Get-Date -Format 'yyyy-MM-dd HH:mm')")
$linesToAdd.Add("# setup-aliases.ps1 によって自動生成")

foreach ($alias in $aliases.Keys) {
    if ($toAdd.Contains($alias) -or ($toUpdate.Contains($alias) -and ($Force -or $willUpdate))) {
        $scriptPath = Join-Path $scriptsDir $aliases[$alias].Script
        $comment    = $aliases[$alias].Comment
        $linesToAdd.Add("function $alias { & `"$scriptPath`" @args } # $comment")
    }
}
$linesToAdd.Add("# ===== end aliases =====")

$blockText = $linesToAdd -join "`n"

# --- DryRun 表示 ---------------------------------------------------------------
if ($DryRun) {
    Write-Host ""
    Write-Host "  --- $ProfilePath に追加される内容 ---" -ForegroundColor Yellow
    Write-Host $blockText -ForegroundColor DarkGray
    Write-Host "  --- ここまで ---" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  DryRun 完了。実際に追加するには -DryRun なしで実行してください。" -ForegroundColor Cyan
    Write-Host ""
    exit 0
}

# --- 既存エイリアスブロックを削除（上書きモード） --------------------------------
if ($toUpdate.Count -gt 0 -and ($Force -or $answer -match '^[yY]')) {
    # hirayama-ai-workspace aliases ブロックを削除
    if ($profileContent -match '# ===== hirayama-ai-workspace aliases =====') {
        $cleanedContent = $profileContent -replace '(?ms)# ===== hirayama-ai-workspace aliases =====.*?# ===== end aliases =====\s*', ''
        if (-not $DryRun) {
            Set-Content -Path $ProfilePath -Value $cleanedContent.TrimEnd() -Encoding UTF8
            $profileContent = $cleanedContent
        }
    }

    # 個別の関数定義を削除（旧形式対応）
    foreach ($alias in $toUpdate) {
        $cleanedContent = $profileContent -replace "(?m)^function\s+$alias\s*\{[^}]*\}[^\r\n]*[\r\n]*", ''
        if (-not $DryRun) {
            Set-Content -Path $ProfilePath -Value $cleanedContent.TrimEnd() -Encoding UTF8
            $profileContent = $cleanedContent
        }
    }
}

# --- $PROFILE にブロックを追記 --------------------------------------------------
if (-not $DryRun) {
    Add-Content -Path $ProfilePath -Value $blockText -Encoding UTF8
}

Write-Host ""
Write-Host ("=" * 66) -ForegroundColor Green
Write-Host "  完了: $ProfilePath にエイリアスを追加しました" -ForegroundColor Green
Write-Host ("=" * 66) -ForegroundColor Green
Write-Host ""
Write-Host "  新しいターミナルを開くと有効になります。" -ForegroundColor White
Write-Host "  または現在のターミナルで以下を実行してすぐ反映: " -ForegroundColor White
Write-Host ""
Write-Host "    . `$PROFILE" -ForegroundColor Cyan
Write-Host ""
Write-Host "  使えるコマンド:" -ForegroundColor White
Write-Host "    Phase1: cap / rwl / note" -ForegroundColor DarkGray
Write-Host "    Phase2: adr / gsc / aerr / dstat" -ForegroundColor DarkGray
Write-Host ""

exit 0
