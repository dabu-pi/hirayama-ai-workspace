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
