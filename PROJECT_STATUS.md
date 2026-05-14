# workspace PROJECT_STATUS.md

最終更新: 2026-05-14（Portal-15 production deploy @18 / Git dirty 根本原因解消）

## 2026-05-14: JBIZ Portal-15 production deploy @18

JBIZ `gas/portal-gateway-v1.gs` を `clasp push --force` で push、既存 deploymentId に `@18 - Portal-15: chronic-pain self-pay conversion funnel KPI view` で deploy 完了（bookmark URL 維持）。

| 項目 | 値 |
|---|---|
| version | `@18` |
| deploymentId | `AKfycbw20tWvhR5nnRzCiUAMybtfrebRg-BK-EgDamvZYt-clSwf4TK9FGTKNZRmsO3wj7QSiQ` |
| JBIZ head | `bb1a099`（前セッション commit）|
| JBIZ smoke (post-deploy) | 194 PASS / 4 skipped / 0 FAIL — regression なし |

### tools/live-check-runner 側 追加

- `scripts/verify-portal15-deploy.ts` 新規追加（次回 auth 復元後の自動 verify 用）
- `projects/jbiz/config.json` の `currentPhaseDeployment` を `@18` に更新、`webAppPortal15SetupUrl` / `webAppChronicPainViewUrl` を追加

### 残作業（manual TODO）

auth.json が JBIZ domain で期限切れのため、以下は人間がブラウザで実行:
1. `.../exec?action=setupPortal15` を Google ログイン済みブラウザで 1 回開く
2. `.../exec?view=chronicpain` を開いて 4 セクション正常表示確認

詳細は `hirayama-jyusei-strategy/PROJECT_STATUS.md` 参照。

### 別 Claude セッション handoff note

本セッション開始時に **別 Claude プロセス PID 2448（09:12 起動）** を検出した。
ユーザ判断（「その Claude を停めて進める」）に従って **`Stop-Process -Id 2448 -Force` で停止**。git index.lock なし → 安全停止。

停止前にその Claude が行った作業の痕跡:
- workspace に commit `d0fd6dd docs(workspace): record shadow copy cleanup for JREC-SF01` を push 済み（履歴に残存・無害）
- **`life-design-project`** に 4 ファイル未 commit の変更を残置:
  - `logs/check-log.md` / `logs/completed-tasks.md` / `logs/pending-items.md` / `logs/work-log.md`
  - 内容は Nishio 初回面談関連の log 追記（最新 commit `8be2f8d` 等と整合）
  - **私（本セッション）は触らず原状保存**（破棄回避）

→ 本セッションでは life-design-project の作業に介入していない。
→ 次セッションで人間が中身を確認し、必要なら commit / 破棄判断してください。

---



このファイルは workspace 全体の最新セッション状態を 1 ページで把握するためのもの。
各プロジェクトの詳細状態は配下 repo の `PROJECT_STATUS.md` を参照する。

---

## 2026-05-14: Git dirty 根本原因解消（緊急対応）

### 発生事象

workspace 11 repo の同期確認で、2 repo に **HEAD は tracked だが disk から欠損** している
ファイルが存在し、毎日のように `git status` で dirty として表示されていた。

| repo | 件数 | 状態 |
|---|---|---|
| `gas-projects/jyu-gas-ver3.1` | 6 | active production code（`Ver3_core.js` 等）が disk から消失。`clasp push` 実行で GAS 上の production を削除する危険状態 |
| `hirayama-jyusei-strategy` | 18 | 旧構造の経営戦略文書（pre-Portal phase）。新版に置き換え済みだが `git rm` 漏れ |

### 切り分け結果

| 仮説 | 結論 |
|---|---|
| Git index / cache の問題 | **無関係**（`update-index --refresh` 後も `D` 表示） |
| OneDrive / 仮想化 | **無関係**（workspace は OneDrive 配下ではない） |
| 旧構造ファイルの `git rm` 漏れ | **PRIMARY CAUSE（JBIZ）** |
| JYU-GAS 中核ファイルの disk 欠損 | **SECONDARY CAUSE（緊急度 HIGH）** |
| 監査手順の不備 | **PROCESS CAUSE**（`git status --short` だけで判定していた） |

### 対応

| repo | 対応 |
|---|---|
| `gas-projects/jyu-gas-ver3.1` | `git checkout --` で 6 ファイル復元 |
| `hirayama-jyusei-strategy` | `git checkout --` で復元 → `git mv` で `docs/legacy/pre-portal-strategy/` 配下へ退避 |
| workspace | `tools/git-health-check.ps1` を新規追加 / `docs/GIT_DIRTY_ROOT_CAUSE_2026-05-14.md` で根本原因と再発防止を記録 |

### 検証

全 11 repo を `tools/git-health-check.ps1` で確認 → missing tracked 0 件、porcelain clean を確認。

### 再発防止ルール

1. status 判定は 2 系統必須 — `git status --porcelain=v1` + `git ls-files -d`
2. ファイル削除は `git rm` + commit まで完結（disk 削除のみで放置しない）
3. clasp push / 任意 deploy 前に `git ls-files -d` が空であることを確認
4. 旧構造は legacy 配下へ `git mv` で保管（即 `git rm` しない）
5. branch 全 checkout 監査をやめ、現 branch の pull のみに限定
6. `tools/git-health-check.ps1` を sync 前後で実行

詳細:
- [`docs/GIT_DIRTY_ROOT_CAUSE_2026-05-14.md`](./docs/GIT_DIRTY_ROOT_CAUSE_2026-05-14.md)（workspace 全体）
- [`gas-projects/jyu-gas-ver3.1/docs/JYU_GAS_SOURCE_OF_TRUTH_2026-05-14.md`](./gas-projects/jyu-gas-ver3.1/docs/JYU_GAS_SOURCE_OF_TRUTH_2026-05-14.md)
- [`hirayama-jyusei-strategy/docs/JBIZ_LEGACY_STRUCTURE_RECONCILE_2026-05-14.md`](./hirayama-jyusei-strategy/docs/JBIZ_LEGACY_STRUCTURE_RECONCILE_2026-05-14.md)

---

## 11 repo 一覧（health-check 結果）

| repo | branch | status | 備考 |
|---|---|---|---|
| `workspace` | feature/auto-dev-phase3-loop | clean | + 本書 / `docs/GIT_DIRTY_ROOT_CAUSE_2026-05-14.md` / `tools/git-health-check.ps1` |
| `desktop-work-status-overlay` | master | clean | — |
| `gas-projects/jrec-sf01-selfpay` | main | clean | — |
| `gas-projects/jyu-gas-ver3.1` | main | clean | 6 ファイル復元・SOURCE_OF_TRUTH 文書追加 |
| `hirayama-jyusei-strategy` | main | clean | 18 ファイル legacy 移動・RECONCILE 文書追加 |
| `life-design-project` | feature/nishio-initial-interview | clean | — |
| `subsidy-grants-projects` | main | clean | — |
| `training-program-platform-jp` | main | clean | — |
| `training-trend-analyzer` | master | clean | — |
| `treadmill-motor-crusher-project` | main | clean | — |
| `wildboar-member-management` | feature/wildboar-member-phase4 | clean | — |

---

## 未対応として残すもの

| 項目 | 状態 | 対応方針 |
|---|---|---|
| workspace `master` branch | 未更新（feature/auto-dev-phase3-loop と作業ツリー競合） | 通常運用では触らない。整理が必要なら別途タスク化 |
| workspace `recovery/restore-training-platform-source` branch | 同上 | 同上 |
| workspace upstream なし branch（backup/* 等 4 件） | 通常運用対象外 | 整理は別タスク |
| remote-only branch（workspace: `origin/claude/objective-volhard` `origin/feature/auto-dev-phase3` / JYU-GAS: `origin/feat/dakkyu-validation-spec-update` `origin/master`）| ローカル未取得 | 必要なら `git checkout -t` で取得 |

これらの未対応 branch は通常の sync では触らない（`tools/git-health-check.ps1` も branch checkout を行わない設計）。

---

## 次の作業候補

1. Wildboar Phase 14-4A / import 後確認
2. JBIZ Portal-15 chronic low-back KPI
3. Dashboard formula `#ERROR!` / `#NAME?` root fix
4. workspace branch 整理（`master` / `recovery/*` / `backup/*` の扱い）
