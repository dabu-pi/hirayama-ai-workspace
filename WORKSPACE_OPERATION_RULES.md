# WORKSPACE_OPERATION_RULES.md

workspace 内の複数プロジェクト・複数 repo を扱う際の混線防止ルール。

**作成日:** 2026-05-07
**対象:** `C:\hirayama-ai-workspace\workspace`
**ブランチ:** `feature/auto-dev-phase3-loop`（parent workspace）

---

## 1. 基本方針

```
ローカルフォルダ構造は当面変更しない。
混線防止は、まず運用ルール・preflight・repo別 commit で対応する。
大規模な repo 分離やフォルダ移動は、必要性が明確になってから段階的に行う。
```

---

## 2. Repo の種類と境界

### 独立 repo（parent workspace から切り離された独立 git repo）

| プロジェクト | パス | branch | remote |
|---|---|---|---|
| desktop-work-status-overlay | `desktop-work-status-overlay/` | master | desktop-work-status-overlay.git |
| wildboar-member-management | `wildboar-member-management/` | feature/wildboar-member-phase4 | （該当 repo）|
| training-program-platform-jp | `training-program-platform-jp/` | main | training-program-platform-jp.git |
| subsidy-grants-projects | `subsidy-grants-projects/` | main | subsidy-grants-projects.git |
| hirayama-jyusei-strategy (JBIZ-04) | `hirayama-jyusei-strategy/` | main | hirayama-jyusei-strategy.git (private) |

これらは **独立 repo なので parent workspace の `git add` / `git commit` の対象外**。
作業時は必ずそのディレクトリ内で `git status / commit / push` する。

> **JBIZ-04 補足（2026-05-11）:** 作業場所は workspace 配下 (`workspace/hirayama-jyusei-strategy/`)
> のままだが、git repo としては親 workspace から独立している（nested 独立 repo）。
> parent workspace の `.gitignore` に `/hirayama-jyusei-strategy/` を追加し、
> `git rm --cached -r` で追跡解除済み。**`standalone-repos\` 配下には置かない**。

### parent workspace 管理（workspace repo に含まれる）

| プロジェクト | パス | 備考 |
|---|---|---|
| jyu-gas-ver3.1 | `gas-projects/jyu-gas-ver3.1/` | 現状 workspace 管理 |
| live-check-runner | `tools/live-check-runner/` | 共有テストツール |
| freee-automation | `freee-automation/` | 開発中 |
| waste-report-system | `waste-report-system/` | セットアップ待ち |
| docs / ROADMAP 等 | ルート直下 | 共通ドキュメント |

---

## 3. 作業開始時の必須 preflight

Claude は **全作業の開始前** に以下を実行する。

```powershell
# 現在地確認
pwd

# parent workspace 状態
cd C:\hirayama-ai-workspace\workspace
git status --short
git branch --show-current
git log -1 --oneline
git remote -v

# 対象が独立 repo の場合はそのディレクトリでも確認
cd <target-repo-path>
git status --short
git log -1 --oneline
```

または、`scripts/check-workspace-status.ps1` を実行する（後述）。

**dirty がある場合:** 棚卸しして分類してから作業を始める。

---

## 4. 対象 repo 宣言ルール

作業前に必ず以下を明記する。

```text
TARGET_REPO:
  <repo名>

WORKDIR:
  <絶対パス>

BRANCH:
  <ブランチ名>

EXPECTED_DIRTY:
  <事前にわかっている dirty ファイル、なければ "なし">

TOUCH_ALLOWED:
  <触ってよいパス>

TOUCH_FORBIDDEN:
  <触ってはいけないパス>
```

**例（desktop-overlay 作業時）:**

```text
TARGET_REPO: desktop-work-status-overlay
WORKDIR: C:\hirayama-ai-workspace\workspace\desktop-work-status-overlay
BRANCH: master
EXPECTED_DIRTY: なし
TOUCH_ALLOWED: desktop-work-status-overlay/ 配下のみ
TOUCH_FORBIDDEN:
  gas-projects/jyu-gas-ver3.1
  wildboar-member-management
  training-program-platform-jp
  subsidy-grants-projects
```

**例（jyu-gas 作業時）:**

```text
TARGET_REPO: jyu-gas-ver3.1 (parent workspace 管理)
WORKDIR: C:\hirayama-ai-workspace\workspace
BRANCH: feature/auto-dev-phase3-loop
TOUCH_ALLOWED:
  gas-projects/jyu-gas-ver3.1/
  tools/live-check-runner/projects/jyu-gas-ver31/ (livecheck 変更がある場合のみ)
  tools/live-check-runner/package.json (script 追加がある場合のみ)
TOUCH_FORBIDDEN:
  desktop-work-status-overlay
  wildboar-member-management
  training-program-platform-jp
```

---

## 5. live-check-runner の扱い

`tools/live-check-runner/` は **parent workspace 管理の共有テストツール**。

どのプロジェクトを作業していても live-check-runner に変更が入ると **parent workspace に差分が出る**。

### 変更時の記録必須事項

```text
LIVE_CHECK_CHANGE_FOR: desktop-overlay / jyu-gas / wildboar / jrec / training / other
FILES_CHANGED:
  tools/live-check-runner/projects/<project>/
  tools/live-check-runner/package.json (新 script 追加の場合のみ)
REASON: <なぜ変更したか>
COMMIT_WITH: parent workspace
```

### 混在禁止

- **jyu-gas 用 livecheck** と **desktop-overlay 用 livecheck** を同じ commit に混ぜない
- 例:
  - OK: `test(desktop-overlay): add Phase 3-F livechecks` — desktop 用のみ
  - OK: `test(jyu-gas): add WEB-3.4 livecheck` — jyu-gas 用のみ
  - NG: 両方を1つの commit に入れる

### desktop-overlay 作業時に live-check-runner を変更した場合

desktop-overlay repo と parent workspace を **分けて commit / push** する。

```
1. desktop-overlay 側の変更 → desktop-overlay/ 内で git commit / push
2. live-check-runner 変更 → C:\workspace\ で git add tools/live-check-runner/... && git commit
```

---

## 6. 複数 repo dirty 時のルール

複数 repo に dirty が出た場合、Claude は作業を進める前に **必ず棚卸し** する。

```powershell
git status --short
git diff --stat
git diff --name-only
```

分類:

```text
A: 今回の作業対象 → commit 対象
B: 別プロジェクト由来 → commit しない / 別作業として扱う
C: 共有ツール（live-check-runner 等）由来 → どのプロジェクト由来かを確認して commit
D: 判定不能 → commit しない、人間に確認する
```

**D（判定不能）の場合は commit しない。** 報告して人間判断を仰ぐ。

---

## 7. commit ルール

```
1 commit = 1プロジェクト または 1共有ツール目的
```

### 禁止

- jyu-gas の変更と desktop-overlay の変更を同一 commit に混ぜる
- 複数プロジェクトの livecheck を同一 commit に混ぜる
- フォルダ移動・削除と機能追加を同一 commit に混ぜる

### commit message フォーマット

```
<type>(<scope>): <summary>

type: feat / fix / test / docs / refactor / chore
scope: jyu-gas / desktop-overlay / wildboar / workspace / live-check-runner など
```

**例:**

```
test(desktop-overlay): add Phase 3-F livechecks (DWSO-3F-1/2/3)
feat(jyu-gas): WEB-3.4 申請書PDF生成 (LiveCheck 9/10 PASS)
docs(workspace): add repo boundary rules
chore(live-check-runner): add test:web34 script for jyu-gas WEB-3.4
```

---

## 8. 作業終了時の報告ルール

```text
TARGET_REPO:
  <作業した repo>
COMMIT:
  <commit hash> — <commit message>
PUSH:
  済み / 未実施
GIT_STATUS:
  <対象 repo の git status>
WORKSPACE_STATUS:
  clean / dirty
OTHER_DIRTY:
  <他 repo の dirty があれば列挙>
TOUCHED_FILES:
  <変更したファイル一覧>
NOT_TOUCHED:
  <明示的に触らなかった repo>
NEXT:
  <次の作業>
```

---

## 9. 当面の repo 分離方針

```
現時点ではローカルフォルダ構造を変更しない。
まずは本ルール（WORKSPACE_OPERATION_RULES.md）で混線防止する。
それでも混線が続く場合に限り、以下を段階的に検討する。

1. live-check-runner の独立 repo 化
2. jyu-gas-ver3.1 の独立 repo 化
3. jrec-sf01-selfpay の独立 repo 化
4. parent workspace を管理メモ専用 repo に縮小
```

repo 分離を行う場合は、**事前に人間と合意**してから実施する。
Claude 単独では判断しない。

---

## 10. 状態確認スクリプト

`scripts/check-workspace-status.ps1` を使うと全 repo を一括確認できる。

```powershell
# workspace 直下から実行
.\scripts\check-workspace-status.ps1
```

---

## 付録: 現時点の repo 状態スナップショット（2026-05-07）

`.\scripts\check-workspace-status.ps1` で確認。

| repo | パス | branch | 状態 | 最終 commit |
|---|---|---|---|---|
| parent workspace | `workspace/` | feature/auto-dev-phase3-loop | clean（本ドキュメント追加後） | cfc2ac2 jyu-gas B-1 fixture 57 PASS |
| desktop-work-status-overlay | `desktop-work-status-overlay/` | master | clean | 0c388f3 Phase 3-F CLOSED |
| wildboar-member-management | `wildboar-member-management/` | feature/wildboar-member-phase4 | DIRTY（会員登録フロー作業中） | a566a7c FeeRules確定 |
| training-program-platform-jp | `training-program-platform-jp/` | main | clean | 68997f2 Phase U-4A |
| subsidy-grants-projects | `subsidy-grants-projects/` | main | clean | 35a44b9 gitignore 強化 |

> スナップショットは時間とともに古くなる。最新状態は `.\scripts\check-workspace-status.ps1` で確認すること。
