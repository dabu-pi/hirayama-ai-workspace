# SHEET_ALIGNMENT_PLAN.md - AI OSダッシュボード実シート整合計画

最終更新: 2026-03-12

---

## 結論

**ローカル設計を正本とし、実シートをそれに合わせて修正する。**

理由:
- ローカル文書に変更履歴が残っている
- `dashboard-schema.md` に 2026-03-08 の語彙移行・日本語化方針が明記されている
- 実シートは現在も動いているが、構造と語彙が古い状態のまま残っている

---

## 実シート確認でわかったこと

対象:
- Google スプレッドシート `Hirayama_AI_OS_Dashboard`

確認できた事実:
- 現在のメインタブは `Dashboard` / `Lists` / `Projects` / `Ideas` / `Task_Queue` / `Run_Log` / `Metrics`
- 2026-03-08 付のバックアップタブが残っている
- バックアップタブは `Lists_backup_20260308` / `Projects_backup_20260308` / `Ideas_backup_20260308` / `Task_Queue_backup_20260308`
- `Run_Log` を含む主要シートは、現在のメインタブ側では英語ヘッダーが主になっている
- `Lists` 系の語彙には英語系と日本語系の両方の痕跡がある

判断:
- 2026-03-08 に移行作業は実際に行われた
- ただし移行は完全には終わっていないか、途中で一部が英語構成のまま運用継続された
- よって「ローカル設計の方針」と「実シートの現物」がズレている

---

## 正本として扱うもの

- `ai-os/dashboard-schema.md`
- `ai-os/DASHBOARD_ROADMAP.md`
- `ai-os/PROJECT_STATUS.md`
- `ai-os/DASHBOARD_RESTART_CUE.md`

---

## 実シートとの差分

### 1. Run_Log

実シート:
- `Date`
- `Project`
- `System`
- `Action`
- `Result`
- `Error Count`
- `Reference`
- `Notes`

採用する正本:
- `log_id`
- `datetime`
- `system`
- `project`
- `summary`
- `result`
- `commit_hash`
- `tasks_done`
- `stop_reason`
- `next_action`

判断:
- Phase 2 実装都合も踏まえ、Run_Log は 10 列正本へ統一する
- `ai_tool` ではなく `system` を採用し、Lists.system と整合させる
- `de` の TSV もこの 10 列へ合わせる

### 2. Projects

実シート:
- `Project`
- `Directory`
- `Type`
- `Status`
- `Phase`
- `Runtime`
- `Progress %`
- `Last Update`
- `Next Action`
- `Completion Condition`
- `Owner`
- `Repo`
- `Risk`
- `Notes`

ローカル設計:
- `project_id`
- `project_name`
- `directory`
- `status`
- `phase`
- `priority`
- `last_updated`
- `next_action`
- `blocker`
- `notes`

### 3. Task_Queue

実シート:
- `Task`
- `Project`
- `Type`
- `Priority`
- `Status`
- `Assigned To`
- `Planned Date`
- `Done Date`
- `Dependency`
- `Score`
- `Notes`

ローカル設計:
- `task_id`
- `title`
- `project`
- `status`
- `priority`
- `created_at`
- `assigned_to`
- `due_date`
- `completed_at`
- `notes`
- `roadmap_ref`

### 4. Ideas

実シート:
- `Idea`
- `Domain`
- `Status`
- `Impact`
- `Effort`
- `Owner`
- `Related Project`
- `Why It Matters`
- `Next Review`
- `Notes`

ローカル設計:
- `idea_id`
- `title`
- `project`
- `status`
- `created_at`
- `description`
- `effort`
- `impact`
- `source`
- `notes`

### 5. Lists

確認できた痕跡:
- 英語系語彙: `status/Active`, `phase/Concept`, `type/Production` など
- 日本語系語彙: `状態/稼働中`, `フェーズ/構想`, `区分/本番` など

判断:
- `Lists` は移行途中または二重状態の可能性が高い
- 実行系語彙には `Codex` を追加対象とする

---

## 優先順位

### 優先 1

- Lists
- Run_Log

### 優先 2

- Projects
- Task_Queue

### 優先 3

- Ideas
- Metrics
- Dashboard 詳細参照の微調整

---

## 実シート修正の順番

1. `Lists_backup_20260308` を残したまま、現行 `Lists` の列ヘッダーと語彙をローカル設計と照合する
2. `Run_Log` を 10 列正本へ寄せる
3. `de` 生成 TSV を 10 列へ合わせる
4. `Projects` の採用列を確定する
5. `Task_Queue` の採用列を確定する
6. `Ideas` の採用列を確定する
7. `Dashboard` / `Metrics` の参照ずれを確認する

---

## 今のおすすめ判断

- 正本はローカル設計
- `Run_Log` は `system` ベース 10 列で確定
- `Codex` を Lists.system に追加する
- 2026-03-08 のバックアップタブは退避として残し、現行メインタブを順番に修正する

---

## 次にやること

1. Lists の現物語彙を確定
2. 実シート Run_Log を 10 列へ修正
3. `de` の TSV 形式を確認
4. Projects / Task_Queue の採用列整理に入る
