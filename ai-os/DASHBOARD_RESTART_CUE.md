# DASHBOARD_RESTART_CUE.md - ダッシュボード作業 再開キュー

> このファイルは「次回のAIセッションがここから迷わず再開できる」ことを目的とする。
> セッションをまたぐたびに更新する。
>
> 最終更新: 2026-03-12（Run_Log 10列正本を確定）

---

## 現在の完成度

| 観点 | 完成度 | 根拠 |
|---|---|---|
| 設計 | 95% | 主要文書・スキーマ・役割分担は揃っている |
| 実装 | 95% | Phase 1 構造整備は完了 |
| 自動化 | 35% | Run_Log 用 JSON / TSV の 10列出力を実装済み。シート自動書き込みは未実装 |
| 運用実効性 | 65% | 実シート整合方針、バックアップ確認、Run_Log 正本確定まで完了 |
| 総合 | 約82% | 次は実シート Lists / Run_Log の修正作業 |

---

## 今わかっていること（確認済みの事実）

| カテゴリ | 内容 |
|---|---|
| スプレッドシート | `Hirayama_AI_OS_Dashboard` として実体あり |
| メインタブ | `Dashboard` / `Lists` / `Projects` / `Ideas` / `Task_Queue` / `Run_Log` / `Metrics` |
| バックアップ | `Lists_backup_20260308` / `Projects_backup_20260308` / `Ideas_backup_20260308` / `Task_Queue_backup_20260308` が存在 |
| Lists | 英語系語彙と日本語系語彙の両方の痕跡がある |
| Run_Log | 実シートは英語8列だが、正本は `system` ベース 10列に確定した |
| ローカル自動化 | `de` で Run_Log 用 JSON / TSV 10列出力ができる |
| ローカルファイル | `SHEET_ALIGNMENT_PLAN.md` を追加し、ローカル設計を正本とする方針を文書化済み |

---

## 今の判断

- Phase 1 は構造整備としては完了扱いでよい
- 手動運用が回っていないため、「定着待ち」はやめる
- Phase 2 は `Run_Log` 最小自動化から始める
- `dev-end.ps1` から Run_Log 用 JSON / TSV を生成する初期実装は追加済み
- ローカル設計を正本とし、実シートを順に寄せる
- 2026-03-08 のバックアップタブは退避として残し、現行メインタブ側を修正対象にする
- Run_Log は `system` ベース 10列正本へ確定済み
- 初期自動化の書き込み先はローカル出力に限定し、シート直書きはまだ行わない

---

## 未解決事項

| # | 項目 | 確認方法 |
|---|---|---|
| 1 | Lists の現物語彙をどこまで残すか | 実シートの現行 Lists とローカル設計を照合する |
| 2 | Dashboard / Metrics の参照がメインタブを向いているか | シート数式を確認する |
| 3 | 実シート Run_Log を 10列へ直した後に貼り付け運用が崩れないか | `de` の TSV を1回貼って確認する |

---

## 次にやるべき 5手

| 順 | 作業 | 場所 | 所要時間 | 担当 |
|---|---|---|---|---|
| 1 | `SHEET_ALIGNMENT_PLAN.md` を基準に、Lists の現物語彙を確定する | ローカル + シート | 10分 | AI + 人間 |
| 2 | 実シート Run_Log を 10列へ修正する | スプレッドシート | 10-15分 | 人間 |
| 3 | `de` の TSV を実シートへ 1 回貼って確認する | ローカル + シート | 10分 | AI + 人間 |
| 4 | Projects の採用列を確定する | ローカル | 15分 | AI |
| 5 | その後に Task_Queue を整理する | ローカル | 15分 | AI |

---

## 再開合図

「ダッシュボード Phase 2 / Run_Log 10列整合」

現在地:
- Hirayama AI OS / Phase 2 前半

状況:
- `de` で Run_Log 用 JSON / TSV は出せる
- Run_Log 正本は `system` ベース 10列に確定済み
- 実シートはまだ英語寄りの旧8列構成が残っている
- 次は Lists の語彙確認と、Run_Log 実シートの列修正

## 2026-03-12 Projects restore cue

- `Projects` was temporarily corrupted by re-running the schema migration against already-migrated rows.
- Recovery succeeded by rebuilding `Projects` from `Projects_backup_20260308` and then reapplying `scripts/apply-dashboard-projects-remap.mjs`.
- Verified live ranges:
  - `Projects!A1:J9`
  - `Dashboard!H11:N16`
- If `Projects` needs to be migrated again, use the backup tab or a clean old-layout source sheet instead of the already-canonical main tab.

## 2026-03-12 Task_Queue helper cue

- `Task_Queue` is still on the live 11-column layout (`Task / Project / Type / Priority / Status / Assigned To / Planned Date / Done Date / Dependency / Score / Notes`).
- To avoid breaking the Dashboard, task automation now starts with `scripts/upsert-task-queue.mjs` instead of a schema migration.
- The helper accepts `--json` or CLI flags, normalizes English input to the Japanese live vocabulary, and updates rows by `title + project`.
- Verified live write: `Task_Queue!A12:K12`.

## 2026-03-12 Lists restore cue

- `Lists` has been rewritten to the canonical vocabulary layout defined in `dashboard-schema.md`.
- Live headers now match `status / phase / type / system / assigned_to / task_status / task_type / priority / idea_status`.
- Stale columns `J:L` were cleared so the sheet no longer mixes old `impact/size` leftovers with the active vocabulary range.
- Verified live range: `Lists!A1:I13`.

## 2026-03-12 Dashboard metrics repair cue

- `scripts/apply-dashboard-metrics-fixes.mjs` has already been applied to the live sheet.
- Verified live values:
  - `Metrics!A1:F12` shows `Total Projects = 6`, `Production Systems = 1`, `Projects In Progress = 2`, `Average Progress = 45%`, `Open Tasks = 11`, `Idea Count = 7`.
  - `Dashboard!H21:N26` now reads from canonical `Run_Log` fields and sorts by latest date descending.
- `Average Progress` is no longer tied to the old `Projects!G` numeric assumption; it now parses `progress=NN%` out of `Projects!J`.

## 2026-03-12 Projects helper cue

- Added `scripts/upsert-projects.mjs` for safe live updates on the canonical `Projects` sheet.
- The helper matches rows by `project_id` first and falls back to `directory`.
- Verified live write: `Projects!A9:J9`.
- `AIOS-06` is now normalized to `Hirayama AI OS`, with `Phase2`, `2026-03-12`, and a fresh next action recorded.
- Natural next step: decide whether to automate `Ideas` next or deepen `Task_Queue` / `Projects` sync logic.

## 2026-03-12 Task_Queue to Projects sync cue

- Added `scripts/sync-project-from-taskqueue.mjs` as the bridge from live `Task_Queue` rows to canonical `Projects` rows.
- `scripts/upsert-task-queue.mjs` now does two things in one flow:
  - update the target Task_Queue row
  - preview/apply the linked Projects sync for the same project
- Auto-reflected fields are intentionally narrow and safe:
  - `last_updated`
  - `next_action`
  - `blocker`
  - `notes.progress` (never decreases an existing progress percentage)
- Verified live sync path:
  - `Task_Queue!A9:K9`
  - `Projects!A6:J6`
- Example verified outcome: `患者管理Webアプリ` now shows `last_updated = 2026-03-12` and `next_action = requirements.txt整備` after the linked task update.
- Next design choice after reopening: automate `Ideas`, or decide whether `Projects.status / phase` should also be updated from task signals.
## 2026-03-12 Ideas helper cue

- Added `scripts/upsert-ideas.mjs` for safe live updates on the current `Ideas` sheet layout (`Idea / Domain / Status / Impact / Effort / Owner / Related Project / Why It Matters / Next Review / Notes`).
- The helper accepts `--json` or CLI flags, normalizes English vocabulary to the current Japanese live values, and maps project IDs like `AIOS-06` to the live project labels.
- Added `scripts/idea-entry.example.json` as a reusable sample payload.
- Verified dry-run append target: `Ideas!A11:J11`.
- Verified live no-op update: `Ideas!A9:J9`.
- Natural next step: decide whether `Projects.status / phase` can be promoted from task signals under strict guardrails.
## 2026-03-12 Projects lifecycle guardrail cue

- Added guarded lifecycle suggestions to `scripts/sync-project-from-taskqueue.mjs` and surfaced them through `scripts/upsert-task-queue.mjs`.
- Default behavior is still preview-only; `status / phase` are written back to `Projects` only when `--apply-status-phase` is passed.
- Current guardrails are intentionally narrow:
  - only `保留 -> 進行中`
  - only standard phase promotions from active task types (`設計 / 開発 / テスト / 実行`)
  - never downgrade and never rewrite custom phases like `Phase2` or `Phase3`
- Verified dry-run lifecycle preview:
  - `Task_Queue!A15:K15`
  - `Projects!A8:J8`
  - suggested `保留 -> 進行中`, `構想 -> 設計`
- Verified normal no-op sync path still works:
  - `Task_Queue!A9:K9`
  - `Projects!A6:J6`
- Natural next step: decide whether `--apply-status-phase` should stay operator-only, or be enabled for a small safe subset of projects.
## 2026-03-12 Lifecycle allowlist hardening cue

- `--apply-status-phase` is now gated by `--lifecycle-projects`.
- A lifecycle write is allowed only when the allowlist matches the target `project_id`, `project_name`, or `directory`.
- Verified blocked preview with no allowlist:
  - `Task_Queue!A15:K15`
  - `Projects!A8:J8`
  - `blocked (no lifecycle allowlist configured)`
- Verified allowed preview with `--lifecycle-projects WST-05`:
  - same suggestion (`保留 -> 進行中`, `構想 -> 設計`)
  - `previewing status/phase because allowlist matched`
- Normal non-lifecycle sync still works on the existing path:
  - `Task_Queue!A9:K9`
  - `Projects!A6:J6`
- Natural next step: decide whether to formalize a tiny default allowlist, or keep explicit per-run allowlists only.
## 2026-03-12 Lifecycle default allowlist cue

- Added tracked default allowlist file: `ai-os/lifecycle-projects.json`.
- Current default allowlist contains only `WST-05`.
- `scripts/sync-project-from-taskqueue.mjs` and `scripts/upsert-task-queue.mjs` now read that file automatically when no CLI/env allowlist is passed.
- Verified default-allowlist live apply:
  - `Task_Queue!A15:K15`
  - `Projects!A8:J8`
  - `廃棄物日報GAS` moved from `保留 / 構想` to `進行中 / 設計`
- If expanding lifecycle apply later, add projects to the tracked file deliberately instead of relying on ad hoc CLI flags.
## 2026-03-12 Metrics task-queue hardening cue

- `scripts/apply-dashboard-metrics-fixes.mjs` now counts open tasks only when `Task`, `Project`, and `Status` are all present.
- This was added because the live `Task_Queue` contains a partial row that should not count as an open task.
- Verified live values after reapplying the formulas:
  - `Dashboard` summary shows `Open Tasks = 11`
  - `Metrics` shows `Open Tasks = 11`, `High Priority Open Tasks = 6`, `Projects In Progress = 3`
- The hardening is formula-side only; no live `Task_Queue` rows were deleted.
## 2026-03-12 Ideas to Task cue

- Added `scripts/promote-idea-to-task.mjs` for the minimum operational path from `Ideas` to `Task_Queue`.
- The helper always writes a complete Task row and then leaves a trace note on the source idea, so the operator does not need to open `Task_Queue` manually just to avoid incomplete rows.
- `scripts/upsert-task-queue.mjs` now rejects automation writes that would leave `Task / Project / Type / Priority / Status` blank.
- Verified guard behavior with a dry-run missing-field call:
  - `Task_Queue row is missing required fields: Type, Priority, Status`
- Verified live sample apply:
  - `Ideas!A4:J4`
  - `Task_Queue!A16:K16`
  - new task: `ダッシュボード運用入口の見直し / workspace全体 / 調査 / 中 / 未着手`
- Verified dashboard consistency after the apply:
  - `Dashboard` summary shows `Open Tasks = 12`
  - `Metrics` shows `Open Tasks = 12`, `High Priority Open Tasks = 6`, `Idea Count = 7`
- The old partial `Task_Queue` row still exists, but the new promotion path does not create more incomplete rows.
