# Root Delete Candidate Rename 2026-05-02

## STATUS
一部完了 / NEEDS_REVIEW 項目あり

---

## RENAMED_TO_DELETE_OK
`削除可__` プレフィックスを付与したフォルダー（計9件）

| 元フォルダー | リネーム後 | 根拠 |
|---|---|---|
| `ai-invest/` | `削除可__ai-invest/` | workspace/ai-invest/ が正本。root 側は root git に追跡されていたが workspace 版が canonical（復元済み）。当セッション中に突然出現したため追加リネーム。|
| `archive/` | `削除可__archive/` | workspace/archive/ が正本（内容同一、root 版は 2026-03-06、workspace 版は 2026-03-10 の新しいコピー）|
| `life-design-project/` | `削除可__life-design-project/` | workspace/life-design-project/ が正本。root git 未追跡。|
| `msk-assessment-platform/` | `削除可__msk-assessment-platform/` | workspace/msk-assessment-platform/ が正本（JASSESS-01 稼働中）。root git 未追跡。|
| `PMOD-08/` | `削除可__PMOD-08/` | workspace/PMOD-08/ が正本。root git 未追跡。|
| `projects/` | `削除可__projects/` | workspace/projects/machine-sales-rebuild/ が正本。root 側は空ディレクトリ構造のみ（ファイルなし）。root git 未追跡。|
| `training-program-platform-jp/` | `削除可__training-program-platform-jp/` | workspace 版（2026-05-02）が root 版（2026-05-01）より新しい。root git 未追跡。|
| `training-trend-analyzer/` | `削除可__training-trend-analyzer/` | workspace/training-trend-analyzer/ が正本。root git 未追跡。|
| `waste-report-system/` | `削除可__waste-report-system/` | workspace/waste-report-system/ が正本（HAIKI-05 setup_pending）。root git 未追跡。|

---

## NOT_RENAMED
リネームしなかったフォルダーと理由

| フォルダー | 理由 |
|---|---|
| `ai-os/` | root git に 17ファイル追跡済み。git-dirty 状態に追加変更となるため NEEDS_REVIEW |
| `aios-orchestrator/` | root git に 70ファイル追跡済み。ファイル数が多く影響範囲が大きい。NEEDS_REVIEW |
| `freee-automation/` | root git に 7ファイル追跡済み。NEEDS_REVIEW |
| `gas-projects/` | root git に 95ファイル追跡済み（最多）。NEEDS_REVIEW |
| `hirayama-jyusei-strategy/` | root git に 44ファイル追跡済み。NEEDS_REVIEW |
| `patient-management/` | root git に 13ファイル追跡済み。NEEDS_REVIEW |
| `scripts/` | root git に 87ファイル追跡済み + 一般名フォルダー。慎重候補のため NEEDS_REVIEW |
| `docs/` | root git に 29ファイル追跡済み + 一般名フォルダー。NEEDS_REVIEW |
| `config/` | root git に 1ファイル追跡済み + 一般名フォルダー。NEEDS_REVIEW |

---

## NEEDS_REVIEW
人間確認が必要なフォルダー（計9件）

### 共通の状況
- root git（`C:\hirayama-ai-workspace`）は workspace git と同一リモート（`github.com/dabu-pi/hirayama-ai-workspace.git`）
- root git は `feature/auto-dev-phase3-loop` ブランチ
- root git はすでに dirty（32件の `D` unstaged deleted files）
- CLAUDE.md 規則「root では Git 作業しない」のため、root git はコミットしない

### 各フォルダー

| フォルダー | root git tracked | workspace 正本 | 推奨 |
|---|---|---|---|
| `gas-projects/` | 95ファイル | workspace/gas-projects/ ✓ | オーナー判断後リネーム可 |
| `scripts/` | 87ファイル | workspace/scripts/ ✓ | オーナー判断後リネーム可 |
| `aios-orchestrator/` | 70ファイル | workspace/aios-orchestrator/ ✓ | オーナー判断後リネーム可 |
| `hirayama-jyusei-strategy/` | 44ファイル | workspace/hirayama-jyusei-strategy/ ✓ | オーナー判断後リネーム可 |
| `docs/` | 29ファイル | workspace/docs/ ✓ | オーナー判断後リネーム可 |
| `ai-os/` | 17ファイル | workspace/ai-os/ ✓ | オーナー判断後リネーム可 |
| `patient-management/` | 13ファイル | workspace/patient-management/ ✓ | オーナー判断後リネーム可 |
| `freee-automation/` | 7ファイル | workspace/freee-automation/ ✓ | オーナー判断後リネーム可 |
| `config/` | 1ファイル | workspace/config/ ✓ | オーナー判断後リネーム可 |

**全件、workspace 側に正本が存在することは確認済み。**
リネームするには `root git が dirty になることを承知の上で実行可` という判断をオーナーが下す必要がある。
（root git は永続的にコミットしない前提のため、実害はないが root git の状態が崩れる）

---

## PROTECTED
今回触っていない重要フォルダー一覧

| フォルダー | 理由 |
|---|---|
| `workspace/` | 本番開発正本。絶対不可侵 |
| `automation/` | 指示で除外 |
| `backups/` | バックアップ。除外 |
| `claude-sandbox/` | 実験環境。除外 |
| `local-secret-backups/` | 認証情報。絶対触らない |
| `workspace-export/` | Drive sync 用 export。除外 |
| `.claude/` | Claude Code 設定 |
| `_archive_root_cleanup_20260502/` | 既存 archive |
| `_archive_workspace_cleanup_20260502/` | 既存 archive（ai-invest backup あり）|
| `.gitignore` `.md` 各ファイル | 除外 |

---

## VALIDATION

| チェック | 結果 |
|---|---|
| workspace/ 存在 | ✓ True |
| automation/ 存在 | ✓ True |
| local-secret-backups/ 存在 | ✓ True |
| workspace/ai-invest 存在（正本）| ✓ True |
| root/ai-invest 消滅（削除可__へ）| ✓ True |
| 削除可__ 9件 作成 | ✓ |
| 削除ゼロ | ✓ |
| workspace 配下 一切変更なし | ✓ |

---

## NEXT
ユーザーが判断すること

### すぐ手動削除してよい候補
数日使って問題なければ、以下を削除してよい:
- `削除可__archive/`
- `削除可__life-design-project/`
- `削除可__msk-assessment-platform/`
- `削除可__PMOD-08/`
- `削除可__projects/`（空ディレクトリ）
- `削除可__training-program-platform-jp/`
- `削除可__training-trend-analyzer/`
- `削除可__waste-report-system/`
- `削除可__ai-invest/`
- `_archive_workspace_cleanup_20260502/ai-invest_restore_backup_20260502/`（ai-invest 復元確認後）

### NEEDS_REVIEW 9件の次の判断
root git が dirty であることを承知した上で、以下の手順で残りをリネーム可能:
```powershell
cd "C:\hirayama-ai-workspace"
$targets = @("ai-os","aios-orchestrator","freee-automation","gas-projects","hirayama-jyusei-strategy","patient-management","scripts","docs","config")
foreach ($d in $targets) { Rename-Item $d "削除可__$d" }
```
root git の dirty 状態は増えるが、root git はコミットしない前提のため実害なし。
