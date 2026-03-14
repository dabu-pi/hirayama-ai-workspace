# PROJECT_STATUS.md - Hirayama AI OS 進捗トラッキング

> AIセッション引き継ぎ用。このファイルの内容を再開プロンプトの冒頭に貼る。

---
## 2026-03-14 Mojibake tab cleanup memo

- live `Hirayama AI OS Dashboard` を監査した結果、指定されていた
  `å¹³å±± AI OS ãƒ€ãƒƒã‚·ãƒ¥ãƒœãƒ¼ãƒ‰` と
  `å¹³å±± AI OS - æ¡ˆä»¶ãƒžã‚¹ã‚¿ãƒ¼`
  は実タブ名ではなく、canonical `Dashboard` / `Projects` の `A1` 見出しセルの文字化けだった。
- 正本タブは引き続き
  `Dashboard / Projects / Task_Queue / Ideas / Run_Log / Metrics / Lists`
  とする。
- `Dashboard / Projects / Task_Queue / Ideas / Run_Log / Metrics` の監査範囲で、
  上記文字化け文字列を参照する数式は 0 件だった。
- 削除対象の実タブは存在しなかったため、
  `archive_mojibake_*` への退避やタブ削除は未実施。
- live 修正として `Dashboard!A1:N3` と `Projects!A1:M3` の
  文字化け見出しだけを正常な日本語へ更新した。
- 再確認結果:
  - direct tab hits = 0
  - header cell hits = 0
  - formula hits = 0

## 2026-03-13 Dashboard final polish memo

- `Dashboard` の `開く / SPEC` は `Projects` 正本参照の `HYPERLINK()` に更新済み。
- `Projects` は canonical 4案件だけでなく、backup/current seed を元に全案件台帳として再構成済み。live は 7 案件。
- `Dashboard` 27行目以降は空化し、row 27+ を hidden 化。旧凡例ブロックは撤去済み。
- `Dashboard` は白ベース + 淡色配色へ更新。タイトル帯は淡青、KPI は白地と淡色ラベル、文字は濃いグレー。
- `Dashboard` 右上から `Projects を開く` で全案件正本へ遷移できる。

---

## プロジェクトサマリ

| 項目 | 内容 |
|---|---|
| プロジェクト名 | Hirayama AI OS |
| ディレクトリ | `workspace/ai-os/` |
| 目的 | Claude・ChatGPT・GAS・GitHub・ダッシュボードを横断管理するコマンドセンター |
| 開始日 | 2026-03-06 |
| 最終更新 | 2026-03-13 (Dashboard の運用仕上げ: canonical URL 確定 / 優先度調整確認 / 最近の更新整理 / 表示レイアウト整形) |

---

## 現在のステータス

| 項目 | 状態 |
|---|---|
| 分類 | In Progress |
| フェーズ | Phase 2 - Japanese daily operations dashboard |
| 実装 | Dashboard / Projects / Task_Queue / Ideas / 優先度調整 の live 再設計を完了。 |
| コード | `scripts/apply-dashboard-japanese-redesign.mjs` と `scripts/aios-dashboard-v2.mjs` で新スキーマ適用と再実行安全な復元を一括化。 |
| ランタイム | Dashboard は表示専用。priority overrides are handled in `優先度調整`. |

---

## 現状認識

- Dashboard は `Projects` を案件名・リンクの正本にする表示専用シートへ寄せる
- canonical project IDs は `JREC-01 / JBIZ-04 / HAIKI-05 / JWEB-03` の4件に絞る
- `Task_Queue` は project 名直書きをやめ、`project_id` + 参照表示の案件名へ変更する
- `優先度調整` シートを追加し、人が今日の優先順位を上書きできるようにする
- `Ideas` は 10段階の段階管理へ更新する
- 既存の英語 UI はバックアップタブへ退避し、日本語中心の daily-use layout へ移行する

---

## 完了済み

| タスク | 内容 |
|---|---|
| dashboard redesign | Dashboard / Projects / Task_Queue / Ideas / Metrics / Lists を日本語中心の daily-use layout へ移行した。 |
| live verification | live sheet で `総案件数=4 / 本番運用中=1 / 進行中=3 / 未完了タスク=7 / 保留アイデア数=1` を確認した。 |
| rerun safety | 再適用時に Task_Queue / Ideas を current v2 または backup から復元できるようにした。 |
| direct URLs | canonical 4案件の `メインシートURL` を直接 URL へ確定し、Dashboard `開く` は `Projects!H` 参照であることを live 数式で確認した。 |
| priority flow | `優先度調整` で `TASK-003` に「はい」を入れると `最終優先度 70 -> 170` となり Dashboard 先頭へ上がることを確認し、空欄へ戻して復元した。 |
| latest updates | Dashboard `最近の更新` は `JREC-01 / JBIZ-04 / HAIKI-05 / JWEB-03` のみを表示する式へ更新し、FREEE-02 混在を解消した。 |
| dashboard layout | Dashboard のみタイトル・説明・KPI・セクション見出しを結合し、一覧本体は非結合のまま列幅・行高・折り返し・配置・背景色・罫線を整えた。 |

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

1. Run `de` and `node scripts/validate-task-queue.mjs --warn-only` several more times to confirm the handoff flow stays stable.
2. Increase real usage of `優先度調整` and `Ideas -> Task_Queue -> Projects`, then revisit automation scope only if it becomes necessary.
3. If daily use exposes friction, add presets or validation guidance for `優先度調整` rather than widening automation first.
4. Keep Dashboard `最近の更新` canonical-only unless a cross-project operations need appears later.

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
- Verified guarded dry-run preview with `廃棄物日報システム`:
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
- Verified allowed preview with `--lifecycle-projects HAIKI-05`:
  - same guarded suggestion (`保留 -> 進行中`, `構想 -> 設計`)
  - message: `previewing status/phase because allowlist matched`
- Verified ordinary write path still works unchanged for non-lifecycle sync:
  - `Task_Queue!A9:K9`
  - `Projects!A6:J6`
- Recommended operational stance for now: keep lifecycle apply as operator-only and pass `--lifecycle-projects` explicitly per run.
## 2026-03-12 Lifecycle default allowlist memo

- Added tracked default allowlist file: `ai-os/lifecycle-projects.json`.
- Initial allowed project set is intentionally tiny: `HAIKI-05` only.
- `scripts/sync-project-from-taskqueue.mjs` and `scripts/upsert-task-queue.mjs` now read that file by default when no CLI/env allowlist is provided.
- Verified default-file dry-run with no explicit allowlist args:
  - preview task target `Task_Queue!A15:K15`
  - preview project target `Projects!A8:J8`
  - lifecycle apply became available because the default allowlist matched `HAIKI-05`
- Verified live end-to-end apply with the default allowlist:
  - `Task_Queue!A15:K15` appended `要件定義たたき台作成 / 廃棄物日報システム / 設計 / 進行中`
  - `Projects!A8:J8` updated to `status = 進行中`, `phase = 設計`, `last_updated = 2026-03-12`, `next_action = 要件定義たたき台作成`
- Next design choice: keep the tracked allowlist at `HAIKI-05` only, or add one more low-risk project after a short observation period.
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
## 2026-03-12 Run_Log discipline + Task_Queue validation

- Appended `14c86b4` to the live `Run_Log` so `Dashboard` Latest Run can move off the older `26b9cec` entry.
- Minimum Run_Log rule for handoff:
  - if a commit changes dashboard automation behavior or live-sheet operation, append a `Run_Log` row before ending the session
  - if you intentionally keep `Dashboard` Latest Run pinned to an older commit, leave that reason in `PROJECT_STATUS.md`
- Added `scripts/validate-task-queue.mjs` as a read-only check for manual `Task_Queue` drift.
- The previously known manual incomplete `Task_Queue` row has now been removed from the live sheet.


## 2026-03-12 end-to-end handoff loop memo

- Deleted the known manual incomplete row from live `Task_Queue` after confirming there was no reliable metadata to fill it safely.
- Verified `node scripts/validate-task-queue.mjs --warn-only` returns 0 findings after the cleanup.
- The remaining Phase 2 priority is stable handoff operation: change, commit/push, `de`, live `Run_Log`, and `Dashboard Latest Run`.

## 2026-03-12 de minimum implementation split

- Ready to implement first inside `de`:
  - treat inspect / read-only / validator / help / `node --check` / `git status`-class commands as no-pause operations
  - add opt-in cleanup flags around the existing handoff flow, not inside the commit core
  - keep cleanup scope to one known incomplete row only
- Proposed minimum `de` flow with opt-in cleanup:
  1. run `node scripts/validate-task-queue.mjs --warn-only`
  2. if `-AutoCleanupKnownTaskQueueRow` is set and the validator finds exactly one known row, save a backup under `logs/taskqueue/`
  3. delete that one row
  4. rerun `node scripts/validate-task-queue.mjs --warn-only` and require 0 findings
  5. continue the existing `de` path: commit / push / Run_Log export / live Run_Log append
  6. finish with inspect-only confirmation of `Run_Log` and `Dashboard Latest Run`
- Feasibility split:
  - backup: easy, can be added first with local JSON output only
  - delete: feasible, but should stay opt-in and single-row only
  - revalidate: easy, already supported by `validate-task-queue.mjs`
  - Run_Log: already implemented in `de`
  - Dashboard Latest Run inspect: easy, but still separate from `de` unless we add a small inspect helper call
- Keep as documentation-only for now:
  - cleanup of multiple incomplete rows
  - auto-filling a row from guessed project/type metadata
  - automatic cleanup without backup
  - any cleanup touching Projects or external systems

## 2026-03-12 Auto approval rule memo

- Added `ai-os/AUTO_APPROVAL_RULES.md` to reduce confirmation branching for the AIOS auto-loop.
- inspect / read-only / validator / help / `node --check` / `git status`-class commands are now treated as auto-approved.
- known incomplete row deletion is only conditionally auto-approved:
  - validator finds exactly one row
  - the row has no safe reconstruction path
  - backup is taken first
  - validator is rerun after delete
  - the cleanup is written to `Run_Log`
- Proposed `de` integration stays opt-in:
  - backup
  - delete
  - revalidate
  - `Run_Log`
  - `Dashboard Latest Run`

## 2026-03-12 ?????? -> de??????

- `scripts/dev-end.ps1` now accepts `-AutoCleanupKnownTaskQueueRow` as an opt-in cleanup flag.
- `scripts/cleanup-known-taskqueue-row.mjs` was added for the minimum `backup -> delete -> revalidate` path.
- `scripts/task-queue-validation-lib.mjs` now centralizes the validator logic so cleanup and validator use the same rule set.
- The current implementation scope is intentionally narrow:
  - no-pause operations: inspect / read-only / validator / help / `node --check` / `git status`-class commands
  - cleanup only when exactly one known incomplete row is found
  - multiple-row cleanup, auto-fill, and Projects linkage are still out of scope
- Current live baseline before the first `de` test: `validate-task-queue --warn-only` returns 0 findings, so the opt-in cleanup path should safely no-op.

## 2026-03-12 Task_Queue cleanup verification

- no-op確認済み:
  - `de -AutoCleanupKnownTaskQueueRow` was run once against a clean live `Task_Queue`.
  - Result: no candidate row was found, cleanup stayed no-op, and the handoff loop still completed through `Run_Log` and `Dashboard Latest Run`.
- positive path確認済み:
  - Injected exactly one live known incomplete row at `Task_Queue!A16:K16` with only `Task = AUTO CLEANUP CONTROL TEST`.
  - Ran `de -AutoCleanupKnownTaskQueueRow` and confirmed `backup -> delete -> revalidate(0) -> commit/push -> Run_Log append`.
  - Verified live after the run: `Task_Queue` returned to 0 findings, `Run_Log!A20:J20` recorded `e767ace`, and `Dashboard Latest Run` refreshed to the same commit.

## 2026-03-13 Cleanup failure-path verification

- Tested one safe failure case only:
  - injected `AUTO CLEANUP FAILURE TEST` at `Task_Queue!A16:K16`
  - ran `de -AutoCleanupKnownTaskQueueRow -AutoCleanupFailAfterBackup`
  - helper wrote `logs/taskqueue/taskqueue_cleanup_backup_20260313_052227.json`
  - delete was skipped intentionally and `de` stopped before commit / push / Run_Log append
- Verified stopped state:
  - live validator still reported the same single known row
  - `Dashboard Latest Run` stayed on `e767ace`
  - no new `Run_Log` row was appended during the stopped run
- Recovery verification:
  - reran normal cleanup and saved `logs/taskqueue/taskqueue_cleanup_backup_20260313_052308.json`
  - deleted `Task_Queue!A16:K16`
  - revalidated back to 0 findings before resuming the normal handoff path

## 2026-03-13 Projects handoff snapshot memo

- Added `scripts/sync-project-from-runlog.mjs` for the minimum AIOS-only handoff snapshot sync.
- Current scope is intentionally narrow:
  - target project: `AIOS-06` only
  - required latest live `Run_Log` match on the same commit hash
  - updates only `last_updated`, `next_action`, and a `latest_handoff=...` block inside `notes`
  - never touches `status`, `phase`, `blocker`, or `priority`
- Verified manual dry-run and live write against `Run_Log!A21:J21` (`c4a620b`) and `Projects!A9:J9`.
- `scripts/dev-end.ps1` now calls this helper after a successful live `Run_Log` append when `ProjectId = AIOS-06` and `Result = SUCCESS`.

## 2026-03-13 Next-task suggestion helper memo

- Added `scripts/suggest-next-task.mjs` as a read-only recommendation helper for the live `Task_Queue`.
- Scope is intentionally small:
  - complete rows only
  - excludes `完了`
  - ranks by `進行中`, priority, planned date, score, and row age
  - prints one suggested task plus human-readable reasons and the source row range
- Optional `--project` filter is supported for scoped inspection, but the helper never writes to any sheet.

- `--project AIOS-06` returns a clearer fallback message when no canonical AIOS-linked Task_Queue row exists yet.

## 2026-03-13 de guidance for read-only next-task helper

- `scripts/suggest-next-task.mjs` is guidance-only around `de` / `dev-end`.
- Current operator rule:
  - optional before `de`: inspect the next likely task if you want a quick human-facing recommendation
  - optional after `de`: inspect again only if you want to sanity-check what remains in `Task_Queue`
- The helper is not part of the `de` execution path and should not block handoff.
- `--project AIOS-06` is useful only when you expect a canonical AIOS-linked Task row.
- Zero matches on `--project AIOS-06` are currently normal because some AIOS work still lives under `workspace全体` rows.
## 2026-03-13 Projects / Sheets alignment memo

- `JREC-01` is the current operational source of truth and uses
  `【毎日記録】来店管理施術録ver3.1` as `main_sheet_name`.
- `JWEB-03` is no longer an active source-of-truth project. It should stay in the
  management view only as `migration_target` / `archive_candidate` until data
  handling is closed.
- `HAIKI-05` now uses `workspace/waste-report-system` as the canonical
  `local_folder`, even before full implementation files are added.
- `AINV-07` should remain visible as a Dashboard registration candidate.

Minimal Projects metadata set to carry in Dashboard-facing docs:
- `project_id`
- `project_name`
- `local_folder`
- `main_sheet_name`
- `main_sheet_id`
- `current_folder`
- `target_folder`
- `sheet_status`
- `cleanup_status`
- `evidence_note`

## 2026-03-13 live Projects metadata write memo

- Added live `Projects` metadata columns at the sheet tail:
  - `local_folder`
  - `main_sheet_name`
  - `main_sheet_id`
  - `current_folder`
  - `target_folder`
  - `sheet_status`
  - `cleanup_status`
  - `evidence_note`
- Wrote known values for the existing live project rows and added a minimal
  `AINV-07` row as a `registration_candidate`.
- `JWEB-03` now carries `migration_target` plus archive intent in
  `evidence_note`, while `JREC-01` is explicitly marked as the operational
  source of truth.
- Verified after the write that `Dashboard!H11:N17` formulas and
  `Metrics!A1:F15` formulas were unchanged.

## 2026-03-13 JWEB-03 archive completion memo

- `JWEB-03` can move from `migration_target` to archive-ready only when:
  - remaining operational handling is confirmed to live in `JREC-01`
  - no active workflow depends on `整骨院 電子カルテ` as the source of truth
  - any data that must be retained is preserved before archive handling

## 2026-03-13 Dashboard project snapshot expansion memo

- The live `Dashboard` project snapshot was showing only rows linked to
  `Projects!4:8`, so `AIOS-06` and `AINV-07` were not visible there.
- Because `AINV-07` is now a live `Projects` registration candidate, the
  snapshot was expanded to show all current project rows through
  `Projects!10`.
- Verified live snapshot range after the change: `Dashboard!H11:N18`.
- `JBIZ-04` main sheet candidate was also confirmed on Drive as
  `1FnJdALwFSv48WiD6NWr0DzG78kwB692R2pFeiTcZlCc` in `My Drive`.
