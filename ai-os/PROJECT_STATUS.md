# PROJECT_STATUS.md - Hirayama AI OS 進捗トラッキング

> AIセッション引き継ぎ用。このファイルの内容を再開プロンプトの冒頭に貼る。

---
## 2026-03-16 de Projects sync 一般化（AIOS-06 固定 → 全 project_id 対応）

### 変更ファイル

| ファイル | 変更内容 |
|---|---|
| `scripts/sync-project-from-runlog.mjs` | AIOS-06 固定除去・Projects 13列日本語スキーマ対応・未登録 project_id はスキップ+警告 |
| `scripts/dev-end.ps1` | L214 の `$ProjectId -eq 'AIOS-06'` 条件を `$ProjectId`（非空チェック）へ変更 |

### スキーマ変更対応

旧: 10列英語スキーマ（`project_name / directory / status / ...`）を期待
新: 13列日本語スキーマ（`案件名 / 状態 / 段階 / 優先度 / 次アクション / 最終更新日 / ... / 補足`）へ対応

sync で更新する列は最小限 3 列のみ:
- col F (`次アクション`) ← Run_Log.next_action
- col G (`最終更新日`) ← Run_Log.datetime
- col M (`補足`) ← latest_handoff block を upsert

その他の列（状態・段階・優先度・URL 系）は一切変更しない。

### 確認結果

| パターン | 結果 |
|---|---|
| AIOS-06 dry-run（commit 一致） | ✅ Projects!A9:M9 を正しく preview |
| JREC-01 dry-run（latest Run_Log project=AIOS-06 で不一致） | ✅ skip（設計通り）|
| UNKNOWN-99（未登録 project_id） | ✅ `[WARN] Skip: no auto-append` |
| AIOS-06 --write（実書き込み） | ✅ Projects!A9:M9 更新・他 6 行無変更・URL 等保持確認済み |

### 未登録 project_id の方針

- **スキップ + 警告**を採用（auto-append なし）
- 理由: Projects は手動で管理される台帳。自動 append は誤登録リスクが高い
- 新 project_id を同期対象にするには、先に Projects シートへ手動で行を追加する

### 残リスク

- `de` で ProjectId を指定しないケース（従来通り `-ProjectId ''`）は sync をスキップ（変更なし）
- `Run_Log` の latest project が同一セッション内でのみ一致するため、複数プロジェクトを 1 session で連続 de する場合は最後の Run_Log row のみが参照される（設計通り）

---
## 2026-03-16 de -AutoCleanupKnownTaskQueueRow 試運転確認（完了）

### 実施手順

1. **ベースライン**: `cleanup-known-taskqueue-row.mjs` dry-run → findings 0、no candidate 確認
2. **inject**: `Task_Queue!A11` に `task_id=AUTO CLEANUP CONTROL TEST`（他列空）を注入
3. **validate**: `validate-task-queue.mjs --warn-only` → 1 finding、`[INFO] Known row: Task_Queue!A11:O11` 確認
4. **fail-after-backup**: `--write --fail-after-backup` → backup JSON 生成 → delete skip → exit 2 → 行は残存確認
5. **de 経由実 cleanup**: `de -AutoCleanupKnownTaskQueueRow` → cleanup → backup → delete → revalidate 0 → commit / push
6. **最終確認**: `validate-task-queue.mjs --warn-only` → 0 findings

### 確認結果

| 確認項目 | 結果 |
|---|---|
| cleanup-known-taskqueue-row.mjs が `de` 経由で呼ばれるか | ✅ PASS |
| backup JSON が削除前に生成されるか | ✅ PASS (`logs/taskqueue/taskqueue_cleanup_backup_*.json`) |
| 対象 1 行だけ削除されるか | ✅ PASS (Task_Queue!A11 のみ) |
| 削除後 revalidate で 0 件になるか | ✅ PASS |
| Run_Log / Projects 同期に副作用なし | ✅ PASS (cleanup は commit 前処理のため sync には非依存) |

### 残リスク（解消済みに更新）

旧「残リスク」の cleanup パス未確認は本試運転で解消。

---
## 2026-03-16 RESOLVED — validate-task-queue スキーマ不一致（解消済み）

### Google 疎通確認（コード変更なし・最小コマンドで切り分け）

```
node -e "import('./scripts/lib-sheets.mjs').then(async ({ getAuthorizedContext, getSpreadsheetMetadata }) => {
  const ctx = await getAuthorizedContext({});
  console.log('[OK] auth');
  const meta = await getSpreadsheetMetadata({ spreadsheetId: ctx.spreadsheetId, accessToken: ctx.accessToken });
  console.log('[OK] sheets:', (meta.sheets||[]).map(s=>s.properties.title));
});"
```

**結果:**
- `[OK] auth: access token obtained`
- `[OK] spreadsheet reached`
- `Task_Queue` タブ: **存在確認済み**
- Google 側の問題は **なし**

### ブロッカー根本原因

`scripts/task-queue-validation-lib.mjs` の `LIVE_HEADERS` が旧英語スキーマを期待している:

```js
// task-queue-validation-lib.mjs（現行コード）
LIVE_HEADERS = ['Task', 'Project', 'Type', 'Priority', 'Status', 'Assigned To', ...]
```

ライブ `Task_Queue` は 2026-03-13 再設計で日本語スキーマに変更済み:

```
// ライブシート 実際のヘッダー（行3）
['task_id', 'タスク', 'project_id', '案件名', '種別', '優先度区分', '基本優先度', '優先度調整', '最終優先度', '状態', '担当', '期限', '完了日', '依存', 'メモ']
```

加えて、行1〜2 がタイトル・説明行であり、ヘッダーが行3 にある。

### エラーメッセージ

```
[ERR] Task_Queue header row was not found inside Task_Queue!1:200
```

### 対応方針（コード変更を許可されたときに実施）

1. `task-queue-validation-lib.mjs` の `LIVE_HEADERS` を現行日本語スキーマへ更新
2. `REQUIRED_FIELDS` の列インデックスをライブ列順に合わせる（`タスク=1, 状態=9` 等）
3. ヘッダー検索ロジックは `findHeaderRowIndex` が既にスキャン方式のため変更不要

### 解消済み（2026-03-16）

- `scripts/task-queue-validation-lib.mjs` の `LIVE_HEADERS` / `REQUIRED_FIELDS` / `KNOWN_CLEANUP_MISSING` を日本語スキーマへ更新
- `validate-task-queue.mjs --warn-only` → `[OK] No incomplete Task_Queue rows detected.` (exit 0) 確認済み
- `formatTaskQueueRowRange` は `LIVE_HEADERS.length` ベースのため自動で 15列（`A:O`）に対応済み
- `cleanup-known-taskqueue-row.mjs` はライブラリ経由のため変更不要・整合済み
- `de` フローでのバリデーション統合は引き続き利用可能

### 残リスク

- `cleanup-known-taskqueue-row.mjs` のテスト（`-AutoCleanupKnownTaskQueueRow` での de 試運転）は次回セッションで確認推奨
- `KNOWN_CLEANUP_MISSING` パターンは「col 0（task_id）のみ入力で他が全空」の 1 パターンに限定。他の部分不完全行はfindings に上がるが known candidate にはならない（設計通り）

---
## 2026-03-15 AIOS sheet notes live apply memo

- `ai-os/config/aios06-sheet-notes.json` を使い、共通 engine で `Dashboard / Ideas / Lists` に live 反映を実施した。
- 反映セル:
  - `Dashboard!P2:P5`
  - `Ideas!L2:L5`
  - `Lists!K2:K5`
- write 後の再読込で文面一致を確認し、再 dry-run でも同じセルへ upsert されることを確認した。
- `Projects / Run_Log / Metrics` 本体、数式、表構造の変更は未実施。

---
## 2026-03-15 SHEET_NOTES_STANDARD AIOS dry-run memo

- `docs/SHEET_NOTES_STANDARD.md` の横展開確認として、AIOS-06 用 config を追加した。
- 今回は live 書き込みは行わず、共通 engine `scripts/sheets/apply-sheet-notes.mjs` で dry-run のみ実施。
- 候補配置:
  - `Dashboard!P2:P5`
  - `Ideas!L2:L5`
  - `Lists!K2:K5`
- 対象は説明・運用メモ系のみ。`Projects / Run_Log / Metrics` 本体や数式変更は未実施。

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

## 2026-03-14 Japanese dashboard label repair memo

- live `Dashboard` シートの日本語ダッシュボード表示に文字化けが残っていたため、
  `Dashboard!A1:N26` の式込みセルを直接監査した。
- `Projects` シートは更新対象から除外し、live 読み戻しでも
  `平山 AI OS - 案件マスター` の先頭行が未変更であることを確認した。
- `Dashboard` 側で正常化した表示:
  - `総案件数 / 本番運用中 / 進行中 / 未完了タスク / 保留アイデア数`
  - `今日の優先タスク / 案件の現況`
  - `タスク / 案件 / 状態 / 最終優先度 / 期限 / 段階 / 次アクション / 開く`
  - `未設定`
  - `最近の更新 / 日時 / 案件 / 実行元 / 内容 / 結果 / 次アクション`
- live 読み戻し確認:
  - `Dashboard!A5:I5` は日本語見出しで表示
  - `Dashboard!M11:M17` は `開く`
- `Dashboard!N15:N17` は `未設定`
- 再利用用に `scripts/repair-dashboard-japanese-labels.mjs` を追加した。

## 2026-03-14 Extra Projects metadata alignment memo

- live `Projects` の extra 案件 3 件を canonical 日本語語彙へそろえた。
  - `AINV-07`: `状態=構想`, `段階=構想`
  - `AIOS-06`: `状態=進行中`, `段階=運用`
  - `FREEE-02`: `状態=本番運用中`, `段階=運用`
- `Projects` の `SPEC URL` を補完した。
  - `AINV-07` → `ai-invest/INVESTMENT_POLICY.md`
  - `AIOS-06` → `ai-os/spec.md`
  - `FREEE-02` → `freee-automation/spec.md`
- `AINV-07` は専用 `spec.md` が未整備のため、現時点では
  `INVESTMENT_POLICY.md` を仕様相当ドキュメントとして `SPEC URL` に採用した。
- live 読み戻し確認:
  - `Projects!A8:M10` で 3 件の `状態 / 段階 / SPEC URL` を確認
  - `Dashboard!H15:N17` で 3 件とも `開く / SPEC` 表示へ更新されたことを確認
  - `Dashboard!M15:N17` の式は `Projects!H:I` 参照の `HYPERLINK()` のまま維持
- `Metrics` 影響:
  - `本番運用中` は `1 -> 2`
  - `進行中` は `4` のまま
  - `総案件数 / 未完了タスク / 保留アイデア数` は変更なし
- 再利用用に `scripts/update-extra-projects-metadata.mjs` を追加した。

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

## 2026-03-14 Projects vocabulary final alignment audit

- Read back live `Projects!C4:D10` and confirmed all 7 rows use canonical
  Japanese vocabulary for `状態 / 段階`:
  `本番運用中 / 進行中 / 構想` and `構想 / 設計 / 実装 / テスト / 運用`.
- Cross-checked live `Lists!A1:B8` as the source vocabulary and found no
  `Projects` value outside the defined `案件状態 / 作業段階` set.
- Audited live `Metrics!A1:B7` formulas. The counts use canonical labels only:
  `COUNTIF(Projects!C4:C20,"本番運用中")`,
  `COUNTIF(Projects!C4:C20,"進行中")`,
  `COUNTIFS(Task_Queue!J4:J200,"<>完了")`,
  `COUNTIF(Ideas!E4:E200,"保留")`.
- Audited live `Dashboard!A5:I6` and `Dashboard!H10:N18` formulas and labels.
  KPI labels, project snapshot `状態 / 段階`, and link fallback text
  `開く / SPEC / 未設定` are aligned with the current canonical Japanese terms.
- No live sheet value or formula update was needed in this pass.
- Updated `scripts/apply-dashboard-japanese-redesign.mjs` so rerunning the
  dashboard rebuild will keep the same correct Japanese labels instead of
  reintroducing mojibake in `Projects` / `Dashboard` headings and link text.

## 2026-03-14 Operations manual sync memo

- Read back live `Dashboard / Projects / Task_Queue / Metrics / Run_Log / Lists`
  and synced the operator-facing docs to the current sheet state.
- Updated `dashboard-schema.md` with the live rules for:
  - `Projects` as the source ledger
  - `Dashboard` as read-only reference view
  - `開く / SPEC / 未設定` link behavior
  - canonical Japanese status / phase / task vocabulary
  - current `Metrics` counting conditions
- Updated `spec.md` to clarify the current operating model:
  `Projects` / `Task_Queue` / `Run_Log` may be maintained by curated helper
  scripts, while `Dashboard` remains direct-edit prohibited and `Lists` remains
  the vocabulary source sheet.
- Updated `VOCAB_MASTER.md` with a clean live vocabulary snapshot derived from
  `Lists!A1:I13` and the current `Run_Log` result conventions.
- Updated `DASHBOARD_RESTART_CUE.md` with the latest verified live ranges,
  current KPI values, current `Projects` status/phase rows, and the current
  Dashboard link policy.

## 2026-03-14 Phase 1 completion gate memo

- Compared the current live `Run_Log` against the documented Phase 1 completion
  conditions in `spec.md` and `DASHBOARD_MASTER_PLAN.md`.
- Current live `Run_Log` state:
  - schema is already on the canonical 10-column append format
  - legacy rows are preserved
  - live rows continue through `2026-03-13 23:59:00`
  - latest confirmed handoff row is `FREEE-02 / 3d68757 / SUCCESS`
- What is already true for Phase 1:
  - the 7-sheet manual operations base exists and is stable
  - `Run_Log` is operational and no longer empty
  - `Projects / Task_Queue / Metrics / Dashboard / Lists` are aligned to the
    current live schema and vocabulary
  - the manual handoff loop is documented, and direct-write helpers for
    `Run_Log` are available
- What still blocks a clean Phase 1 completion declaration:
  - the "append one `Run_Log` row after every dashboard-affecting session"
    habit is not yet fully evidenced in live for the newest 2026-03-14 AIOS
    maintenance commits
  - the documented 1-2 week manual-flow continuity gate
    (`2026-03-08` start, `2026-03-22` target) is not yet satisfied by elapsed
    time alone
- Remaining human tasks before declaring Phase 1 complete:
  1. Decide whether the 2026-03-14 dashboard/docs maintenance commits should be
     backfilled into live `Run_Log`, or explicitly treated as documentation-only
     exceptions.
  2. Keep the end-of-session `Run_Log` append habit in place through at least
     `2026-03-22`, with no ambiguity about whether a session was intentionally
     excluded.
  3. Once the continuity window is satisfied, update the Phase 1 status in the
     planning docs from `進行中` to an explicit completion decision.
- Recommended Phase 1 completion declaration criteria:
  - live `Run_Log` remains on the canonical 10-column schema
  - at least one more normal handoff cycle is appended without manual recovery
  - no unresolved mismatch remains between live sheets and the current docs
  - the operator explicitly accepts the handling of any skipped/backfilled
    2026-03-14 maintenance commits
- Short next-phase discussion points:
  - GAS: keep Phase 2 write scope narrow and start with `Run_Log` append only
  - auto-update: decide whether `de` should stop at `Run_Log`, or also keep the
    current AIOS-only `Projects` handoff snapshot sync
  - auto-aggregation: formulas already cover current KPI totals, so the next
    automation value is scheduled refresh/alerting rather than more sheet writes

## 2026-03-14 Run_Log backfill + gate update memo

- Backfilled the 2026-03-14 dashboard/docs maintenance handoff to live
  `Run_Log!A24:J24` as:
  `AIOS-06 / docs: sync ai-os dashboard operations manuals / 5df7e44 / SUCCESS`.
- Run_Log rule:
  every dashboard-affecting commit must leave either one live `Run_Log` row in
  the same session or an explicit documented exception in `PROJECT_STATUS.md`.
- Phase 1 may switch from `進行中` to complete only after the continuity window
  passes `2026-03-22` and all of these remain true:
  live `Run_Log` stays on the 10-column schema, no unresolved docs-vs-live
  mismatch remains, and recent dashboard-affecting sessions are all accounted
  for by append or explicit exception.
- Phase 2 starting assumption:
  start with append-only GAS for `Run_Log`, keep other sheets out of scope, and
  treat `Projects` sync / auto-aggregation as follow-on decisions after the
  append path is stable.

## 2026-03-14 Continuity window monitoring memo

- Continuity-window mode is now active through `2026-03-22`.
- Remaining human task is now narrow:
  keep end-of-session `Run_Log` append coverage for every dashboard-affecting
  session through `2026-03-22`, and if any session is intentionally excluded,
  record that exception in `PROJECT_STATUS.md` the same day.
- Current Phase 1 gate no longer needs a backfill decision for 2026-03-14
  because the maintenance commit was already appended to live `Run_Log`.
- Prepared docs update proposal for the `2026-03-22` switch:
  - `DASHBOARD_MASTER_PLAN.md`: change Phase 1 from `進行中` to `完了`
  - `spec.md`: mark the manual-flow establishment item complete
  - `PROJECT_STATUS.md`: collapse the Phase 1 gate memo into a short completion
    record with the continuity window outcome and the Phase 2 starting point
- Phase 2 design memo stays intentionally small:
  start with append-only GAS for `Run_Log`, require no writes to `Projects /
  Task_Queue / Dashboard / Lists`, and treat automatic refresh/aggregation as a
  later design step after append reliability is proven.
