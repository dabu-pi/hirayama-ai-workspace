# このフォルダは運用対象外（ローカル専用メタ管理）

この root フォルダでは Git 作業をしないこと。

## 正規作業場所

```
C:\hirayama-ai-workspace\workspace
```

## root git の状態（2026-05-02 更新）

| 項目 | 内容 |
|---|---|
| git root | C:\hirayama-ai-workspace |
| remote | **削除済み**（git remote remove origin 実行済み） |
| 用途 | ローカル専用メタ管理のみ |
| commit / push | **禁止** |
| pull / fetch | **禁止** |

remote を削除した理由:
- workspace git と同一 remote（GitHub）を向いていた
- 誤って `git push` / `git push --force` した場合、workspace の最新作業を上書きするリスクがあった

## workspace git の状態

| 項目 | 内容 |
|---|---|
| git root | C:\hirayama-ai-workspace\workspace |
| remote | origin → https://github.com/dabu-pi/hirayama-ai-workspace.git |
| 用途 | **すべての開発作業・commit・push はここで行う** |

## Claude Code への指示

1. 作業開始時に必ず以下を確認する:
   ```
   git rev-parse --show-toplevel
   git remote -v
   git branch --show-current
   git status
   ```

2. git root が `C:/hirayama-ai-workspace/workspace` でない場合は作業を停止する

3. Bash ツールを使う場合、毎回 workspace パスを明示する:
   ```
   cd C:\hirayama-ai-workspace\workspace
   ```
   または PowerShell で:
   ```
   $repo = "C:\hirayama-ai-workspace\workspace"
   git -C $repo ...
   ```

4. root（C:\hirayama-ai-workspace）での git 操作は一切禁止
