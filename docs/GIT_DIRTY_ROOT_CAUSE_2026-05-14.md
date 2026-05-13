# Git dirty root cause and prevention — 2026-05-14

> 本書は、毎日のように発生していた `git status` の dirty 状態の **根本原因** を特定し、**恒久的な再発防止策** を定めるためのものである。
> 表面上の `git checkout --` / `git rm` で済ませず、原因と対策を一次情報として残す。

---

## 1. 背景

前日（2026-05-14）の workspace 全 11 repo の同期作業で以下が発生した。

- 作業開始時: 全 11 repo `git status --short` 空 → CLEAN 判定
- 作業後: 2 repo が dirty 化
  - `gas-projects/jyu-gas-ver3.1`: 6 ファイル `D`（deleted from working tree）
  - `hirayama-jyusei-strategy`: 18 ファイル `D`
- `git pull` / `git fetch` 自体は破壊操作を伴っていない（safe な `--ff-only` のみ）

ユーザ報告では同様の dirty が「毎日のように出ている」とのこと。

---

## 2. 切り分けで確認した観点と結果

### A. Git index / filesystem cache の問題 → **無関係（除外）**

| 確認項目 | 結果 |
|---|---|
| `core.fsmonitor` | 未設定（3 repo 共通） |
| `core.untrackedCache` | 未設定 |
| `core.ignorecase` | true（Windows 既定、問題なし） |
| `core.autocrlf` | true（同上） |
| sparse-checkout | 未設定 |
| `git update-index -q --refresh` 後の status | `D` 表示は変わらず |

→ Git の内部 cache に騙されているのではなく、**実ファイルが genuinely 欠損している** ことが確定。

### B. OneDrive / クラウド同期による仮想化 → **無関係（除外）**

| 確認項目 | 結果 |
|---|---|
| `$env:OneDrive` | `C:\Users\pinsh\OneDrive` |
| workspace 物理パス | `C:\hirayama-ai-workspace\workspace`（OneDrive 配下ではない） |
| workspace ディレクトリの reparse point | なし（`fsutil reparsepoint query` で Error 4390） |
| 欠損ファイルのあったディレクトリの Attributes | `Directory` のみ（`Offline`/`ReparsePoint` なし） |

→ OneDrive の Files On-Demand による placeholder ではない。

### C. 旧構造ファイルが HEAD に残っている問題（JBIZ） → **PRIMARY CAUSE**

JBIZ の 18 ファイルは以下のパターン:

- すべて HEAD（= origin/main）に tracked
- いずれも単一 commit `d72a5d0 restore(JBIZ-04): recover hirayama-jyusei-strategy from 54add16 parent`（2026-05-11）が最終 touch
- どの commit からも削除されていない（`git log --diff-filter=D` 該当なし）
- 同じディレクトリ（`finance/` / `menu/` / `operations/` / `strategy/`）には **日付付き新版**（`-2026-04-25` / `-2026-05-11`）が存在し、内容が新版へ移管済み
- `marketing/` は丸ごとディレクトリが消失（古い 3 ファイルすべて欠損）

→ 2026-05-11 の repo split / restore の際にいったん追加されたが、その後ユーザが新構造（STRATEGY_ONE_PAGE.md ＋ 日付付きファイル群 ＋ Portal Gateway）に移行する過程でディスクから手動削除された。しかし `git rm` を commit していないため、index には残り続け、毎回 `D` として表面化していた。

### D. JYU-GAS の管理方式の問題 → **SECONDARY CAUSE（緊急度 HIGH）**

JYU-GAS の 6 ファイル（`Ver3_amounts.js` / `Ver3_core.js` / `Ver3_patientPicker.js` / `Ver3_transferData.js` / `SPEC.md` / `appsscript.json`）は以下:

- 全て HEAD に tracked、合計 800KB 超のコード本体
- 現行 disk のコード（`Ver3_test.js:11`、`Ver3_shuRecorder.js:11/194`）が **欠損 6 ファイル内の関数 `calcOnePartAmount_V3_`、`V3TR_buildTransferDataForMonth_` 等を実コード上で参照**
- PROJECT_STATUS.md（2026-05-08）で `Ver3_transferData.js` への WEB-4A 修正が記録されており、active 中の中核ファイル
- standalone init `e99a2cc`（2026-05-08）で repo に追加、その後の commit で削除した形跡なし

→ いずれかのタイミングでディスクから消えたが、**もしこの状態で `clasp push` を実行すれば GAS の production code を削除してしまう極めて危険な状態**だった。

### E. 監査手順の不備 → **PROCESS CAUSE**

- 開始時チェックで `git status --short` だけを見て CLEAN 判定していた
- `git ls-files -d`（tracked だが disk に存在しないファイル）を見ていなかった
- そのため、本質的に dirty な状態のまま同期作業を進めてしまった
- `git checkout` のような index 再評価系操作の後に初めて `D` が表面化することがある

---

## 3. なぜ「作業開始時 CLEAN に見えた」のか

最も可能性が高いのは PowerShell スクリプトの判定ロジック側の問題。
ただし git 側にも、index の lstat cache に基づき初回 status が working tree の実走査を省略するケースがある（特に直前に他プロセスが触っていない場合）。

その後の `git fetch` / `git checkout` / `git pull` のいずれかのタイミングで index と working tree の照合が refresh され、欠損が `D` として表面化した。

つまり「同期作業によって dirty 化した」のではなく、「**もとから dirty だったが status の表示で見えていなかった**」が正解。

---

## 4. 今回採用した恒久対策

### 4-1. データ層の修正（実施済み）

| 対象 | 対策 |
|---|---|
| JYU-GAS 6 ファイル | `git checkout -- <files>` で HEAD から復元（active production code のため必須） |
| JBIZ 18 ファイル | `git checkout -- <files>` で復元 → `git mv` で `docs/legacy/pre-portal-strategy/` 配下へ移動（履歴保持 + 削除しない安全側） |
| `marketing/` 空ディレクトリ | git は空ディレクトリを追跡しないため放置（commit 後に物理的にも消える） |

### 4-2. 仕組みの修正

| 仕組み | 対策 |
|---|---|
| repo 監査スクリプト | `tools/git-health-check.ps1` を新規追加 — `git update-index -q --refresh` → `git status --porcelain=v1` → `git ls-files -d` → ahead/behind を全 repo に実行 |
| status 判定 | 今後は `--porcelain` だけでなく `ls-files -d` も同時にチェック |
| branch 全 checkout | 通常運用では現 branch の pull のみに限定。他 branch の確認は `git worktree` か一時 clone で行う |

### 4-3. 運用ルールの明文化

| ルール | 内容 |
|---|---|
| 削除は必ず git rm + commit | ディスクからのファイル削除のみで止めない。同じセッションで `git rm` + `git commit` まで実施 |
| clasp push 前の必須チェック | clasp push / clasp deploy の直前に必ず `git ls-files -d` で missing tracked がないか確認。1 件でも該当があれば push 停止 |
| 旧構造の保管場所 | 経営戦略・KPI 等の業務文書は削除せず `docs/legacy/<phase>/` へ `git mv` で移動 |
| 再発検知 | `tools/git-health-check.ps1` を sync 前後に実行 |

---

## 5. 実施した変更（commit 単位）

### JYU-GAS（`gas-projects/jyu-gas-ver3.1`）

- 復元: `SPEC.md` / `Ver3_amounts.js` / `Ver3_core.js` / `Ver3_patientPicker.js` / `Ver3_transferData.js` / `appsscript.json`
- 追加: `docs/JYU_GAS_SOURCE_OF_TRUTH_2026-05-14.md`

### JBIZ（`hirayama-jyusei-strategy`）

- 復元 + 移動: 18 ファイルを `docs/legacy/pre-portal-strategy/` 配下へ `git mv`
- 追加: `docs/JBIZ_LEGACY_STRUCTURE_RECONCILE_2026-05-14.md`

### workspace

- 追加: `docs/GIT_DIRTY_ROOT_CAUSE_2026-05-14.md`（本書）
- 追加: `tools/git-health-check.ps1`

---

## 6. 検証結果

| repo | 復元後 status | ls-files -d | 備考 |
|---|---|---|---|
| `gas-projects/jyu-gas-ver3.1` | clean | 0 | 6 ファイル復元成功 |
| `hirayama-jyusei-strategy` | 18 件すべて `R`（rename） | 0 | git mv による履歴保持 |
| `C:\hirayama-ai-workspace\workspace` | docs 追加分のみ | 0 | nested repo 変更は親に影響なし |

---

## 7. 再発防止ルール（要点）

1. **status 判定は 2 系統必須** — `git status --porcelain=v1` + `git ls-files -d`
2. **削除は git rm + commit 完結まで** — ディスク削除のみで放置しない
3. **clasp push / 任意 deploy 前** — `git ls-files -d` が空でなければ実行停止
4. **旧構造は legacy 配下へ git mv で保管** — 即 `git rm` しない
5. **branch 全 checkout 監査をやめる** — 現 branch の pull のみ。他 branch は worktree
6. **`tools/git-health-check.ps1` を sync 前後で実行** — missing tracked / ahead-behind を可視化
