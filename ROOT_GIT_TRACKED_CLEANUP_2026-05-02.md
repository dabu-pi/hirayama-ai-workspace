# Root Git Tracked Cleanup 2026-05-02

## STATUS
完了（9件すべて git rm 実施・commit/push 済み）

---

## REMOVED_BY_GIT_RM
`git rm -r --force` で削除したフォルダー（計9件・509ファイル staged）

| フォルダー | 削除前 tracked 数 | dirty (D) | workspace 正本 | 備考 |
|---|---|---|---|---|
| `gas-projects/` | 238 | 1件 D | workspace/gas-projects/ ✓ | `.clasp.json` が gitignore 対象 untracked として残存。物理削除は手動で |
| `scripts/` | 87 | 0 | workspace/scripts/ ✓ | 完全削除済み |
| `aios-orchestrator/` | 70 | 0 | workspace/aios-orchestrator/ ✓ | 完全削除済み |
| `hirayama-jyusei-strategy/` | 44 | 10件 D | workspace/hirayama-jyusei-strategy/ ✓ | 完全削除済み |
| `docs/` | 29 | 0 | workspace/docs/ ✓ | 完全削除済み |
| `ai-os/` | 17 | 6件 D | workspace/ai-os/ ✓ | 完全削除済み |
| `patient-management/` | 13 | 10件 D | workspace/patient-management/ ✓ | 完全削除済み |
| `freee-automation/` | 10 | 5件 D | workspace/freee-automation/ ✓ | 完全削除済み |
| `config/` | 1 | 0 | workspace/config/ ✓ | 完全削除済み |

合計: 509ファイル staged deletion

---

## NOT_REMOVED
削除しなかったフォルダー

今回の対象9件はすべて git rm を実施済み。

---

## NEEDS_REVIEW
人間確認が必要なもの

### 1. `gas-projects/jrec-sf01-selfpay/.clasp.json` （物理ファイル残存）
- **状況:** gitignore 対象の untracked ファイル。git rm では削除されない。
- **内容:** clasp の認証設定ファイル（projectId 等を含む可能性あり）
- **対応:** オーナーが不要と判断した場合、手動削除可: `Remove-Item "C:\hirayama-ai-workspace\gas-projects" -Recurse -Force`
- **リスク:** 削除しても workspace/gas-projects 側には影響なし

### 2. root git の unstaged D エントリ（前回リネーム由来）
- **状況:** 前回 `削除可__*` にリネームした9フォルダーの元ファイルが root git で ` D` (unstaged deleted) 状態。
  - `PMOD-08/`, `削除可__`系フォルダー元パス等、740件
- **対応:** これらは git rm すれば root git がさらにクリーンになるが、今回のスコープ外。
  次の root git 整理フェーズで対応する。
- **現在の影響:** workspace 運用には影響なし

### 3. AGENTS.md の `docs/` 参照
- **状況:** `docs/PROJECT_STATUS.md` などを参照しているが、workspace から実行する場合は `workspace/docs/PROJECT_STATUS.md` を参照する。
- **対応:** AGENTS.md のパス表記が root 目線の場合、workspace 目線に修正することを検討。

---

## PROTECTED
触っていない重要フォルダー

| フォルダー | 確認 |
|---|---|
| `workspace/` | 完全無変更 ✓ |
| `automation/` | 完全無変更 ✓ |
| `backups/` | 完全無変更 ✓ |
| `local-secret-backups/` | 完全無変更 ✓ |
| `workspace-export/` | 完全無変更 ✓ |
| `claude-sandbox/` | 完全無変更 ✓ |
| `_archive_root_cleanup_20260502/` | 完全無変更 ✓ |
| `_archive_workspace_cleanup_20260502/` | 完全無変更 ✓ |
| `.claude/` | 完全無変更 ✓ |
| `削除可__*` 各フォルダー | 完全無変更 ✓（前回リネーム済み） |

---

## VALIDATION

| チェック | 結果 |
|---|---|
| workspace/ 存在 | ✓ True |
| automation/ 存在 | ✓ True |
| local-secret-backups/ 存在 | ✓ True |
| workspace/gas-projects 正本存在 | ✓ True |
| workspace/scripts 正本存在 | ✓ True |
| workspace/aios-orchestrator 正本存在 | ✓ True |
| workspace/hirayama-jyusei-strategy 正本存在 | ✓ True |
| workspace/docs 正本存在 | ✓ True |
| workspace/ai-os 正本存在 | ✓ True |
| workspace/patient-management 正本存在 | ✓ True |
| workspace/freee-automation 正本存在 | ✓ True |
| workspace/config 正本存在 | ✓ True |
| git rm staged deletions 件数 | 509件 ✓ |
| Remove-Item / 手動削除 ゼロ | ✓ |

---

## NEXT
残作業

1. **手動確認推奨:** `C:\hirayama-ai-workspace\gas-projects\` ディレクトリに `.clasp.json` が残存。不要なら `Remove-Item "C:\hirayama-ai-workspace\gas-projects" -Recurse -Force` で手動削除可
2. **将来対応:** root git の unstaged D エントリ（前回 `削除可__` リネーム由来 ~700件）を git rm または git clean で整理する
3. **将来対応:** root の `削除可__*` フォルダー9件を手動確認後に `Remove-Item -Recurse -Force` で削除
4. **将来対応:** `_archive_workspace_cleanup_20260502/ai-invest_restore_backup_20260502/` を確認後に手動削除
