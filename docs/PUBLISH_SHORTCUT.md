# Publish Shortcut

このPCで `workspace` の publish を最短で回すためのメモです。

## 前提

- `HIRAYAMA_GDRIVE_REMOTE=hirayama_gdrive` をユーザー環境変数として設定済み
- このPCでは `hirayama_gdrive` remote が `root_folder_id` 固定なので `HIRAYAMA_GDRIVE_REMOTE_PATH` は不要
- publish 完了条件は `push + workspace-export 更新 + Drive sync`

## 最短実行

`workspace` 直下で次を実行します。

```powershell
.\scripts\publish-workspace.ps1 -Message "chore: update workspace"
```

## PowerShell alias 例

PowerShell profile（シェル起動時に読む設定ファイル）へ入れるなら、この形で短縮できます。

```powershell
function pubws {
    param([Parameter(Mandatory = $true)][string]$Message)
    & 'C:\hirayama-ai-workspace\workspace\scripts\publish-workspace.ps1' -Message $Message
}
```

呼び出し例:

```powershell
pubws "docs: update handoff memo"
```
