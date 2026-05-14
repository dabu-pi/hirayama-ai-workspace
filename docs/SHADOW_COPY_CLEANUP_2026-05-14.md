# Shadow Copy Cleanup — JREC-SF01 (2026-05-14)

## 概要

| 項目 | 内容 |
|---|---|
| 発生日 | 2026-05-14 |
| 誤って開いたフォルダ | `C:\hirayama-ai-workspace\gas-projects\jrec-sf01-selfpay` |
| 正本フォルダ | `C:\hirayama-ai-workspace\workspace\gas-projects\jrec-sf01-selfpay` |
| 結果 | 中身（6 ファイル）削除済み + 空ディレクトリ・親ディレクトリ削除完了（2026-05-14 同日中） |

## 原因

Claude Code を root 直下の `C:\hirayama-ai-workspace\gas-projects\jrec-sf01-selfpay` で起動してしまった。
このフォルダは古い shadow copy（2026-05-02 時点の残骸）で、以下の点で正本ではない。

- 独立した `.git` を持たず、root の `C:\hirayama-ai-workspace` リポジトリに吸収されている
- root リポジトリには remote が設定されておらず、pull / push できない
- ファイル数 6（正本は 37）、すべて 2026-05-02 時点で古い
- CLAUDE.md の運用ルール「正本・作業場所・commit / push は `C:\hirayama-ai-workspace\workspace` のみ」「root では Git 作業しない」に違反する

## 削除前安全策

1. 正本（`workspace/gas-projects/jrec-sf01-selfpay`）に独立 `.git` と `origin = github.com/dabu-pi/jrec-sf01-selfpay.git` を確認
2. 正本との差分比較を実施
   - shadow にしかないファイル: なし
   - shadow の 6 ファイルはすべて正本にも同名で存在し、正本の方が新しい
3. zip 退避を作成
   - `C:\hirayama-ai-workspace-cleanup-archive\shadow-jrec-sf01-selfpay-20260514-091008.zip`（70,206 bytes）

## 削除実行結果

| 項目 | 状態 |
|---|---|
| shadow 内 6 ファイル削除 | 完了 |
| `.git` 等メタファイル削除 | 完了（shadow 直下は空） |
| shadow ディレクトリ本体 | **削除完了**（2026-05-14 同日中。Claude Code を `workspace` から再起動後に実施） |
| 親フォルダ `gas-projects` 削除 | **削除完了**（同上。空になっていたため一緒に削除） |

> 当初は Claude Code 親プロセスが cwd として保持していたため Windows のファイルロックで削除できなかった。
> Claude Code を `C:\hirayama-ai-workspace\workspace` から再起動し、cwd が shadow を保持しない状態にした上で削除を実施した。

## 空ディレクトリ削除実行ログ（2026-05-14）

```
Canonical exists: True
Shadow exists:    True
Shadow parent:    True

Shadow is empty (no children)

Shadow deleted. Exists after: False
Parent deleted: C:\hirayama-ai-workspace\gas-projects. Exists after: False

=== Final state ===
Canonical still exists: True
Shadow exists:          False
Shadow parent exists:   False
```

正本（`workspace/gas-projects/jrec-sf01-selfpay`）28 項目（`.git` + `docs` + 26 ファイル）を保持。

## 正本の安全性確認

| 項目 | 結果 |
|---|---|
| 正本パス | `C:\hirayama-ai-workspace\workspace\gas-projects\jrec-sf01-selfpay` |
| ファイル数 | 37（変更なし） |
| git status | clean |
| branch | `main` |
| latest commit | `e611456 chore(jrec-sf01): change access to ANYONE_ANONYMOUS @50 for Portal-12` |

## 再発防止ルール

1. **通常作業は必ず `C:\hirayama-ai-workspace\workspace` 配下で開始する**（3 台統一・CLAUDE.md §「workspace と claude-sandbox の運用ルール」のとおり）
2. `C:\hirayama-ai-workspace\gas-projects\` は **使用しない**。今回の cleanup 完了後にディレクトリごと存在しない状態とする
3. ターミナル / Claude Code / VS Code を起動するときは、起動直後に `git rev-parse --show-toplevel` と `git remote -v` の両方を確認し、`origin` が設定されている canonical repo の中にいることを確認する
4. ショートカット / ピン留めの起動先パスを `workspace\` 配下に修正する（Windows 側の運用）

## 関連

- 同日の root 周辺問題: [`GIT_DIRTY_ROOT_CAUSE_2026-05-14.md`](./GIT_DIRTY_ROOT_CAUSE_2026-05-14.md)
- ワークスペース運用ルール: [`../CLAUDE.md`](../CLAUDE.md) §「workspace と claude-sandbox の運用ルール」
