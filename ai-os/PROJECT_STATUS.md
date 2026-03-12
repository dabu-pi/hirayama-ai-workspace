# PROJECT_STATUS.md - Hirayama AI OS 進捗トラッキング

> AIセッション引き継ぎ用。このファイルの内容を再開プロンプトの冒頭に貼る。

---

## プロジェクトサマリ

| 項目 | 内容 |
|---|---|
| プロジェクト名 | Hirayama AI OS |
| ディレクトリ | `workspace/ai-os/` |
| 目的 | Claude・ChatGPT・GAS・GitHub・ダッシュボードを横断管理するコマンドセンター |
| 開始日 | 2026-03-06 |
| 最終更新 | 2026-03-12（Run_Log 10列正本を確定） |

---

## 現在のステータス

| 項目 | 状態 |
|---|---|
| 分類 | In Progress |
| フェーズ | Phase 2 - 最小自動化（Run_Log 自動追記から開始） |
| 実装 | 7シート整備済み・Phase 1 構造整備完了・手動運用は未定着 |
| コード | `de` の Run_Log JSON / TSV 10列出力まで実装済み |
| ランタイム | 未起動 |

---

## 現状認識

- Phase 1 の構造整備タスクは完了済み
- Run_Log の手動記録フローは開始したが、習慣としては定着していない
- 「手動で定着するまで待つ」より、「続かない部分だけ最小自動化する」方針へ切り替える
- Phase 2 の対象はまず `Run_Log` への 1行自動追記に限定する
- 実シート確認の結果、ローカル設計を正本として実シートを順に寄せる方針に決定
- 実シートには `*_backup_20260308` タブが残っており、2026-03-08 時点で移行作業が行われた痕跡がある
- `Run_Log` の正本は `system` ベース 10列に確定した
- `de` から生成する TSV / JSON もこの 10列正本へ合わせた

---

## 進行中

| タスク | 内容 |
|---|---|
| 実シート整合の具体化 | `SHEET_ALIGNMENT_PLAN.md` を基準に Lists / Run_Log / Projects / Task_Queue の修正順を固める |
| Run_Log 実シート反映準備 | 10列正本に合わせてシート側列を直す前提が固まった |

---

## バックログ

| 優先度 | タスク | 内容 |
|---|---|---|
| 高 | Lists 整合 | 実シート語彙をローカル設計へ寄せる |
| 高 | Run_Log 実シート修正 | `system` ベース 10列正本へ移行する |
| 高 | `de` 連携確認 | 実シート列に合わせた貼り付け運用を確認する |
| 中 | 試運転 1週間 | 記録漏れがなくなるか確認する |
| 中 | Dashboard 数式参照の詳細確認 | QUERY / FILTER の完全自動参照か確認する |
| 低 | `Task_Queue` / `Projects` 補助更新 | Phase 2 後半以降 |

---

## 次のアクション

1. `ai-os/SHEET_ALIGNMENT_PLAN.md` を基準に Lists の現物語彙を確定する
2. 実シート Run_Log を 10列正本へ修正する
3. `de` で出る TSV を実シート列に1回貼って確認する
4. その後に Projects / Task_Queue の列整理に入る

---

## 参照

- `workspace/AGENTS.md`
- `workspace/PROJECTS.md`
- `workspace/ROADMAP.md`
- `workspace/docs/PROJECT_STATUS.md`
- `ai-os/spec.md`
- `ai-os/dashboard-schema.md`
- `ai-os/DASHBOARD_ROADMAP.md`
- `ai-os/DASHBOARD_RESTART_CUE.md`
- `ai-os/SHEET_ALIGNMENT_PLAN.md`
- `ai-os/PHASE2_MIN_AUTOMATION_SPEC.md`

---

## Codex 直接書き込みメモ

- 2026-03-12 に `scripts/append-runlog-to-sheet.mjs` を追加
- `de` 実行後、`AIOS_SERVICE_ACCOUNT_PATH` と `AIOS_DASHBOARD_SPREADSHEET_ID` がある PC では `Run_Log` へ直接 1 行追記できる構成にした
- 認証情報がない PC では従来どおりローカル JSON / TSV 出力のみ
- 実運用前に、サービスアカウントを `Hirayama AI OS Dashboard` の編集者として共有する必要がある

追加参照:

- `ai-os/CODEX_SHEETS_DIRECT_WRITE_SETUP.md`
- `scripts/append-runlog-to-sheet.mjs`

---

## 2026-03-12 Run_Log 移行完了メモ

- `scripts/lib-sheets.mjs` を追加して、service account でダッシュボードを読む共通処理を実装
- `scripts/inspect-dashboard-sheet.mjs` で実シートの先頭行確認を自動化
- `scripts/migrate-runlog-schema.mjs` で `Run_Log` を旧8列から正本10列へ移行
- 実シート `Run_Log` は 2026-03-12 に `log_id / datetime / system / project / summary / result / commit_hash / tasks_done / stop_reason / next_action` へ更新済み
- 旧ログ 5件は `LEGACY-*` 形式の `log_id` で保持し、既存の Codex 追記行もそのまま維持した
- 今後の `de` 追記はこの10列前提でそのまま整合する

## 2026-03-12 Projects 次段メモ

- live `Projects` タブは旧14列のまま継続していることを確認
- `scripts/preview-projects-migration.mjs` を追加し、旧14列を正本10列へどう写すかを JSON プレビューで出せるようにした
- `Projects` は Dashboard 数式依存の可能性が高いため、Run_Log のような即時 live 移行はまだ行っていない
- 次に live 変更する前に、Dashboard が `Projects` のどの列を参照しているか確認する

## 2026-03-12 Projects formula dependency note

- Dashboard rows 12-16 reference `Projects!A`, `D`, `E`, `F`, `G`, `I`, `M` directly
- Because of that, the live `Projects` tab cannot be migrated to the canonical schema yet without first rewriting Dashboard formulas
- `scripts/preview-projects-migration.mjs` is safe to use because it only exports a preview and does not touch the live sheet

## 2026-03-12 Dashboard remap prep

- `scripts/preview-dashboard-projects-remap.mjs` で、Projects 正本化後の Dashboard `Project Snapshot` ヘッダー/数式プレビューを生成できるようにした
- `scripts/apply-dashboard-projects-remap.mjs` を追加し、Projects 移行後に `Dashboard!H11:N*` をまとめて更新できるようにした
- ただし現在は `Projects` live 移行前なので、Dashboard への実適用はまだ行わない

## 2026-03-12 Projects recovery memo

- Restored the live `Projects` tab from `Projects_backup_20260308` after a bad re-migration corrupted the canonical rows.
- `scripts/migrate-projects-schema.mjs` now defaults to the backup tab as the source sheet and can rebuild the canonical 10-column layout safely.
- Verified live `Projects` rows 4-9 are back to canonical values and `Dashboard!H11:N16` now reads from the repaired project names and dates again.
- Remaining follow-up: decide whether the AIOS row should keep `project_name=AIOS-06` or be normalized to `Hirayama AI OS` in a later cleanup pass.

## 2026-03-12 Task_Queue automation memo

- Added `scripts/upsert-task-queue.mjs` to upsert live `Task_Queue` rows without migrating the sheet schema first.
- The helper targets the current 11-column live layout and matches rows by `title + project`.
- English vocabulary input is normalized to the current Japanese live values (`Docs` -> `文書`, `Pending` -> `未着手`, `High` -> `高`, `Human` -> `人`).
- Verified a live no-op update against `Task_Queue!A12:K12` for `PROJECT_STATUS.md 補完`.
- Added `scripts/task-queue-entry.example.json` as a sample payload for future Codex runs.

## 2026-03-12 Lists alignment memo

- Added `scripts/migrate-lists-schema.mjs` to rewrite the live `Lists` sheet to the canonical vocabulary layout from `dashboard-schema.md`.
- Updated the live `Lists` tab to the canonical `A:I` headers (`status / phase / type / system / assigned_to / task_status / task_type / priority / idea_status`).
- Cleared the stale extra values that had remained in columns `J:L` from the earlier mixed-layout sheet.
- Verified live `Lists!A1:I13` now contains the intended Japanese vocabulary plus `Codex` in `system`.
- Remaining follow-up: inspect Dashboard / Metrics formulas that still reflect old numeric progress assumptions.

## 2026-03-12 Dashboard metrics repair memo

- Added `scripts/apply-dashboard-metrics-fixes.mjs` to rewrite the live `Metrics` formulas and the `Dashboard` latest run block in one step.
- Verified live `Metrics!A1:F12` now shows stable values on the canonical schema:
  - `Total Projects = 6`
  - `Production Systems = 1`
  - `Projects In Progress = 2`
  - `Average Progress = 45%`
  - `Open Tasks = 11`
  - `Idea Count = 7`
- Verified live `Dashboard!H21:N26` now points at canonical `Run_Log` columns (`datetime / project / system / summary / result / commit_hash / next_action`) and sorts by latest date descending.
- `Average Progress` now comes from `progress=NN%` parsed out of `Projects!J` notes instead of the old numeric column assumption.

## 2026-03-12 Projects helper memo

- Added `scripts/upsert-projects.mjs` to update or append canonical `Projects` rows by `project_id` or `directory`.
- Added `scripts/project-entry.example.json` as a sample payload for live project updates.
- Verified a live update against `Projects!A9:J9` for `AIOS-06`.
- The helper preserved the structured `notes` metadata while updating the visible project fields (`project_name / phase / last_updated / next_action`).
- `AIOS-06` is now labeled `Hirayama AI OS` in the live `Projects` sheet and has `Phase2` recorded on `2026-03-12`.

## 2026-03-12 Task_Queue to Projects sync memo

- Added `scripts/sync-project-from-taskqueue.mjs` to derive `Projects` updates from the live `Task_Queue` sheet.
- Added deeper sync to `scripts/upsert-task-queue.mjs`, so task updates now preview or apply a linked `Projects` update in the same run.
- Current auto-reflection scope is limited to safe fields:
  - `Projects.last_updated`
  - `Projects.next_action`
  - `Projects.blocker`
  - `Projects.notes` 内の `progress=NN%`（既存値を下げず、Task_Queue 完了率より大きい方を保持）
- Verified live end-to-end sync with `患者管理Webアプリ`:
  - `Task_Queue!A9:K9` was updated to `requirements.txt整備 / 進行中`
  - `Projects!A6:J6` now reflects `last_updated = 2026-03-12` and `next_action = requirements.txt整備`
- Status / phase の自動変更はまだ行わず、誤更新リスクの低い範囲に限定している.
## 2026-03-12 Ideas helper memo

- Added `scripts/upsert-ideas.mjs` to upsert live `Ideas` rows without migrating the sheet schema first.
- The helper targets the current 10-column live layout and matches rows by `title + related project` when possible.
- English input is normalized for `domain / status / impact`, and project IDs like `AIOS-06` are mapped to the live project labels.
- Added `scripts/idea-entry.example.json` as a sample payload for future Codex runs.
- Verified dry-run append target: `Ideas!A11:J11`.
- Verified a live no-op update against `Ideas!A9:J9` for `freee Phase4 エラー通知`.
- With `Ideas` automation in place, the next design choice is whether `Projects.status / phase` should remain manual or move to guarded task-signal rules.
## 2026-03-12 Projects lifecycle guardrail memo

- Added guarded `status / phase` suggestions to `scripts/sync-project-from-taskqueue.mjs`.
- Default behavior remains preview-only; `Projects` writes include lifecycle changes only when `--apply-status-phase` is explicitly passed.
- Current guarded rules are intentionally narrow:
  - `status`: only `保留 -> 進行中` when the project has an active task (`進行中 / 待機 / 停止中`)
  - `phase`: only for standard phases (`構想 / 設計 / 実装 / テスト / 運用 / 安定運用`), promoted forward from active task types (`設計 / 開発 / テスト / 実行`)
  - no downgrades, no custom-phase rewrites (`Phase1-4`, `PhaseB`, `Ops`)
- `scripts/upsert-task-queue.mjs` dry-run now passes the pending Task row into the sync preview, so lifecycle suggestions can be inspected before writing.
- Verified guarded dry-run preview with `廃棄物日報GAS`:
  - preview task target `Task_Queue!A15:K15`
  - preview project target `Projects!A8:J8`
  - suggested `保留 -> 進行中`, `構想 -> 設計`
- Verified normal no-op write path still works with `患者管理Webアプリ`:
  - `Task_Queue!A9:K9`
  - `Projects!A6:J6`
- Next design choice: keep lifecycle changes preview-only, or allow `--apply-status-phase` on a limited project subset after human review.
## 2026-03-12 Lifecycle allowlist hardening memo

- `--apply-status-phase` alone is no longer enough to write lifecycle changes.
- Lifecycle writes now require both:
  - `--apply-status-phase`
  - `--lifecycle-projects` matching the target `project_id`, `project_name`, or `directory`
- Verified blocked preview with no allowlist:
  - `Task_Queue!A15:K15`
  - `Projects!A8:J8`
  - message: `blocked (no lifecycle allowlist configured)`
- Verified allowed preview with `--lifecycle-projects WST-05`:
  - same guarded suggestion (`保留 -> 進行中`, `構想 -> 設計`)
  - message: `previewing status/phase because allowlist matched`
- Verified ordinary write path still works unchanged for non-lifecycle sync:
  - `Task_Queue!A9:K9`
  - `Projects!A6:J6`
- Recommended operational stance for now: keep lifecycle apply as operator-only and pass `--lifecycle-projects` explicitly per run.
## 2026-03-12 Lifecycle default allowlist memo

- Added tracked default allowlist file: `ai-os/lifecycle-projects.json`.
- Initial allowed project set is intentionally tiny: `WST-05` only.
- `scripts/sync-project-from-taskqueue.mjs` and `scripts/upsert-task-queue.mjs` now read that file by default when no CLI/env allowlist is provided.
- Verified default-file dry-run with no explicit allowlist args:
  - preview task target `Task_Queue!A15:K15`
  - preview project target `Projects!A8:J8`
  - lifecycle apply became available because the default allowlist matched `WST-05`
- Verified live end-to-end apply with the default allowlist:
  - `Task_Queue!A15:K15` appended `要件定義たたき台作成 / 廃棄物日報GAS / 設計 / 進行中`
  - `Projects!A8:J8` updated to `status = 進行中`, `phase = 設計`, `last_updated = 2026-03-12`, `next_action = 要件定義たたき台作成`
- Next design choice: keep the tracked allowlist at `WST-05` only, or add one more low-risk project after a short observation period.
## 2026-03-12 Metrics task-queue hardening memo

- Hardened `scripts/apply-dashboard-metrics-fixes.mjs` so `Open Tasks` and `High Priority Open Tasks` ignore incomplete `Task_Queue` rows.
- The new formulas require nonblank `Task`, nonblank `Project`, and nonblank `Status` before a row is counted as open.
- Reason: the live sheet currently contains at least one partial row with a title but no project/status, which should not inflate KPI counts.
- Verified live after reapplying metrics fixes:
  - `Dashboard!A6:K6` now shows `Open Tasks = 11`
  - `Metrics!A2:E11` now shows `Open Tasks = 11`, `High Priority Open Tasks = 6`, `Projects In Progress = 3`
- The partial row still exists in `Task_Queue`; the fix is formula-side hardening, not data deletion.
## 2026-03-12 Ideas to Task helper memo

- Added `scripts/promote-idea-to-task.mjs` as the light Ideas -> Task_Queue promotion entrypoint.
- The helper reads one live `Ideas` row, builds a complete Task_Queue row with enforced defaults, and writes a trace note back to the source idea.
- Default Task values are intentionally narrow and beginner-safe:
  - `type = 調査`
  - `priority` falls back from `Ideas.impact`
  - `status = 未着手`
  - `assigned_to` falls back from `Ideas.owner`
  - `planned_date = today`
- Hardened `scripts/upsert-task-queue.mjs` so automation-side writes now fail fast when `Task / Project / Type / Priority / Status` are missing.
- Verified guardrail dry-run:
  - `node scripts/upsert-task-queue.mjs --title "validation guard test" --project AIOS-06`
  - result: `Task_Queue row is missing required fields: Type, Priority, Status`
- Verified live apply with the safe workspace-level sample:
  - `Ideas!A4:J4` updated with `Task化 2026-03-12: ダッシュボード運用入口の見直し`
  - `Task_Queue!A16:K16` appended `ダッシュボード運用入口の見直し / workspace全体 / 調査 / 中 / 未着手`
  - linked `Projects` sync was skipped intentionally because `workspace全体` has no canonical Projects row
  - `Dashboard!A6:K6` now shows `Open Tasks = 12`
  - `Metrics!A2:E11` now shows `Open Tasks = 12`, `High Priority Open Tasks = 6`, `Idea Count = 7`
- Split the reusable promotion sample payload into `scripts/idea-to-task-workspace.example.json` and `scripts/idea-to-task-aios.example.json`.
## 2026-03-12 Ideas override rule memo

- `workspace全体` is intentionally not being added as a canonical `Projects` row.
- `scripts/promote-idea-to-task.mjs` now has an explicit operator rule:
  - default: keep the Task `Project` aligned to the source idea's `Related Project`
  - override only when needed: pass `project=AIOS-06` (or `--project AIOS-06`) so the Task points at the canonical `Hirayama AI OS` project row
- The source `Ideas` row stays unchanged except for status/note trace updates.
- The single generic promotion sample has been split into:
  - `scripts/idea-to-task-workspace.example.json`
  - `scripts/idea-to-task-aios.example.json`
- Verified dry-run behavior:
  - workspace sample keeps `Project = workspace全体` and skips `Projects` sync
  - AIOS sample overrides to `Project = Hirayama AI OS` and previews sync against `Projects!A9:J9`
- Appended the missing `26b9cec` Run_Log entry:
  - `Run_Log!A15:J15`
  - `Dashboard` Latest Run now shows `commit = 26b9cec`, `project = AIOS-06`
