# 次回最優先: デスクトップPC再起動後の hirayama-ai-workspace 整理完了

## STATUS

未完了の最終手動作業あり。  
`C:\hirayama-ai-workspace` 直下整理はほぼ完了しており、root git は clean。  
ただし、プロセスロックにより root 側の旧 `gas-projects` 空ディレクトリだけが残っている可能性あり。

## 最優先でやること

デスクトップPCを再起動した後、以下を最優先で実行する。

```powershell
Remove-Item "C:\hirayama-ai-workspace\gas-projects" -Recurse -Force
```

その後、確認する。

```powershell
Test-Path "C:\hirayama-ai-workspace\gas-projects"
Test-Path "C:\hirayama-ai-workspace\workspace\gas-projects"
```

期待結果:

```text
False
True
```

## 意味

* `C:\hirayama-ai-workspace\gas-projects`

  * 旧root側の残骸
  * 現在は使用しない
  * 削除してよい

* `C:\hirayama-ai-workspace\workspace\gas-projects`

  * 正本
  * 今後も使用する

## 重要ルール

今後の通常作業は必ず以下で行う。

```text
C:\hirayama-ai-workspace\workspace\各プロジェクト
```

`C:\hirayama-ai-workspace` 直下では通常作業しない。

## 任意の後日削除候補

以下は `ai-invest` 復元済みの確認用バックアップ。数日使って問題なければ削除可。

```text
C:\hirayama-ai-workspace\_archive_workspace_cleanup_20260502\ai-invest_restore_backup_20260502
```

削除する場合:

```powershell
Remove-Item "C:\hirayama-ai-workspace\_archive_workspace_cleanup_20260502\ai-invest_restore_backup_20260502" -Recurse -Force
```

## 完了条件

以下になれば、hirayama-ai-workspace フォルダ整理は完了扱い。

```text
C:\hirayama-ai-workspace\gas-projects
→ False

C:\hirayama-ai-workspace\workspace\gas-projects
→ True

root git
→ clean

今後の作業場所
→ workspace 配下のみ
```

## 次回 Claude Code に確認させる場合の一言

デスクトップPC再起動後の最優先作業です。
`C:\hirayama-ai-workspace\gas-projects` は旧root側の残骸なので削除し、
`C:\hirayama-ai-workspace\workspace\gas-projects` が正本として残っていることを確認してください。
削除後、root git status と workspace 側の存在確認を行い、必要なら整理完了をレポートに追記してください。
