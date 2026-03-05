#Requires -Version 5.1
<#
.SYNOPSIS
    開発メモを logs/notes/note_YYYYMMDD.md へ追記保存します。

.DESCRIPTION
    指定したメッセージをタイムスタンプ付きで日次メモファイルに追記します。
    logs/notes/ はgit管理対象のため、重要な決定・進捗・ハマりどころを
    その場で記録する用途に使います。

.PARAMETER Message
    保存するメモの内容

.PARAMETER Tag
    タグ（カテゴリ分類用、省略可）
    例: bug, done, todo, idea, warn

.PARAMETER LogDir
    ログ保存先ルート（省略時: ./logs）

.EXAMPLE
    .\note.ps1 "freee API OAuth修正完了"
    .\note.ps1 "redirect_uri の不一致が原因だった" -Tag bug
    .\note.ps1 "次回: テストケースTC-05を実行する" -Tag todo
#>

param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$Message,

    [Parameter(Position = 1)]
    [string]$Tag = "",

    [string]$LogDir = "logs"
)

Set-StrictMode -Version Latest

# --- ディレクトリ準備 ---------------------------------------------------
$notesDir = Join-Path $LogDir "notes"
New-Item -ItemType Directory -Force -Path $notesDir | Out-Null

# --- ファイル名・エントリ組み立て ---------------------------------------
$date      = Get-Date -Format "yyyyMMdd"
$time      = Get-Date -Format "HH:mm"
$noteFile  = Join-Path $notesDir "note_$date.md"

# タグ整形（指定あれば `#tag` 形式で付与）
$tagStr = if ($Tag) { " ``#$Tag``" } else { "" }
$entry  = "- $time$tagStr — $Message"

# --- ファイル新規作成（当日初回のみヘッダを書く）----------------------
if (-not (Test-Path $noteFile)) {
    $header = @"
# 開発メモ — $(Get-Date -Format 'yyyy-MM-dd')

<!-- このファイルは note.ps1 で自動生成されます。git 管理対象です。 -->

"@
    Set-Content -Path $noteFile -Value $header -Encoding UTF8
}

# --- メモを追記 ---------------------------------------------------------
Add-Content -Path $noteFile -Value $entry -Encoding UTF8

# --- 表示 ---------------------------------------------------------------
Write-Host ""
Write-Host "📝 Note saved" -ForegroundColor Green
Write-Host "   File : $noteFile" -ForegroundColor DarkGray
Write-Host "   Entry: $entry" -ForegroundColor White
Write-Host ""
