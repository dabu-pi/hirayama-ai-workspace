# PHASE2_MIN_AUTOMATION_SPEC.md - ai-os Phase 2 最小自動化仕様

最終更新: 2026-03-12

---

## 目的

Hirayama AI OS ダッシュボードの `Run_Log` を、手動で続けられない問題を解消するために、まずは **作業終了時に貼り付け用の 1 行データを自動生成する** ところから始める。

この段階では Google スプレッドシートへの直接書き込みは行わない。認証情報や接続方式が未確定でも運用改善できる最小単位を優先する。

---

## Phase 2 初期スコープ

対象:
- `scripts/dev-end.ps1` 実行後に Run_Log 用のデータを自動生成する
- JSON と TSV の 2 形式で保存する
- 画面に貼り付け用の 1 行を表示する

対象外:
- Google スプレッドシートへの自動書き込み
- `Task_Queue` / `Projects` への自動更新
- KPI 分析やサマリ生成

---

## 出力先

- `logs/runlog/runlog_YYYYMMDD_HHmmss.json`
- `logs/runlog/runlog_YYYYMMDD_HHmmss.tsv`

用途:
- JSON は将来の自動連携用
- TSV は `Run_Log` シートへ手貼りするための即用データ

---

## 採用する Run_Log 列構成

Phase 2 では、ローカル設計を正本にしつつ、実運用しやすい 10 列を採用する。

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

補足:
- `system` は `Lists.system` を参照し、当面の Codex 実行では `Codex` を出力する
- `tasks_done` と `stop_reason` は初期段階では空欄許容とする

---

## 生成項目

| 項目 | 内容 |
|---|---|
| `log_id` | `LOG-YYYYMMDD-HHMMSS` 形式 |
| `datetime` | 実行日時 |
| `system` | `Codex` 固定 |
| `project` | 対象プロジェクトID |
| `summary` | 作業要約（基本はコミットメッセージ） |
| `result` | `SUCCESS` / `STOP` / `ERROR` / `PARTIAL` |
| `commit_hash` | 直近コミット短縮ハッシュ |
| `tasks_done` | 完了タスクID群（初期は空欄可） |
| `stop_reason` | STOP / ERROR 時の理由（初期は空欄可） |
| `next_action` | 次の作業 1 行 |

---

## project の決め方

`dev-end.ps1` 実行位置から推定する。

| パス | project |
|---|---|
| `ai-os/` | `AIOS-06` |
| `freee-automation/` | `FREEE-02` |
| `gas-projects/jyu-gas-ver3.1/` | `GAS-01` |
| `patient-management/` | `WEB-03` |
| `hirayama-jyusei-strategy/` | `STR-04` |
| その他 | `COMMON` |

必要なら `-ProjectId` で明示指定できるようにする。

---

## 実行フロー

1. `dev-end.ps1` でコミット・push を実行
2. 成功時のみ Run_Log 用エントリを生成
3. `logs/runlog/` に JSON / TSV を保存
4. 画面に保存先と貼り付け用 1 行を表示する

---

## この方式を選ぶ理由

- スプレッドシート認証が未整備でもすぐ始められる
- `Run_Log` の記録漏れを減らせる
- 将来、GAS や API 連携へ切り替えるときも JSON を再利用できる
- 初期自動化の書き込み先をローカルファイルに限定でき、安全性が高い

---

## 次の段階

1. TSV をクリップボードへ自動コピー
2. スプレッドシート Web App / GAS への自動送信
3. `Task_Queue` / `Projects` の補助更新

## 2026-03-12 実シート反映結果

- `Run_Log` タブは live シート上でも正本10列へ移行済み
- Row 1-2 のタイトル/説明は維持
- Row 3 を正本ヘッダーへ更新
- Row 4 以降の旧8列ログは `LEGACY-*` 形式で10列へ正規化済み
- 以後は `append-runlog-to-sheet.mjs` の直接追記で列ずれなく継続できる

## 2026-03-12 拡張スコープ

- `Task_Queue` 更新時に、同一プロジェクトの `Projects` 行を安全に補助更新できるようにした
- 更新対象は `last_updated / next_action / blocker / notes.progress` に限定する
- `status / phase` の自動変更はまだ行わない
## 2026-03-12 Ideas helper follow-up

- `Ideas` can now be updated safely on the current live 10-column layout via `scripts/upsert-ideas.mjs`.
- The helper is intentionally scoped to the existing live schema so dashboard formulas do not need to change first.
- `Projects.status / phase` remains manual until guarded promotion rules are explicitly defined.
## 2026-03-12 Lifecycle guardrail follow-up

- `scripts/sync-project-from-taskqueue.mjs` now computes guarded `status / phase` suggestions from Task signals.
- The default remains preview-only so existing Task_Queue writes do not silently change project lifecycle fields.
- Lifecycle writes require an explicit `--apply-status-phase` flag.
- Guardrails are limited to forward-only changes and skip custom project phases.
## 2026-03-12 Lifecycle allowlist follow-up

- Even when `--apply-status-phase` is requested, lifecycle writes stay disabled unless `--lifecycle-projects` explicitly matches the target project.
- This keeps the default behavior preview-first and avoids accidental cross-project lifecycle updates.
## 2026-03-12 Lifecycle default allowlist follow-up

- Lifecycle apply can now be enabled by a tracked allowlist file (`ai-os/lifecycle-projects.json`) rather than only ad hoc CLI flags.
- The initial tracked allowlist is intentionally limited to `WST-05`.
- This keeps the default behavior narrow while still allowing one real end-to-end lifecycle path to run without per-command allowlist typing.
## 2026-03-12 Metrics task-queue hardening follow-up

- Dashboard metrics now ignore incomplete `Task_Queue` rows when counting open tasks.
- This keeps KPI counts stable even if a human leaves a partial task title in the live sheet.
## 2026-03-12 Ideas to Task follow-up

- Added a minimum `Ideas -> Task_Queue` promotion helper (`scripts/promote-idea-to-task.mjs`).
- The promotion path is intentionally small:
  - read one idea row
  - fill `Project / Type / Priority / Status` before any Task write
  - append/update one Task row
  - leave a trace note back on the idea row
- `scripts/upsert-task-queue.mjs` now fails fast if an automation run would leave required Task fields blank.
- This keeps Phase 1 manual operation intact while reducing the chance that future automation creates more incomplete `Task_Queue` rows.
## 2026-03-12 Ideas override follow-up

- The minimum Ideas-to-Task path keeps its default behavior: use the source idea's related project unless an operator explicitly overrides it.
- `workspace全体` remains non-canonical, so KPI definitions and `Projects` row counts stay unchanged.
- Explicit canonical targeting is still possible by passing `AIOS-06` to `scripts/promote-idea-to-task.mjs`.
- The promotion samples are now split into a workspace-preserving version and an AIOS override version.
- `26b9cec` has been added to the live `Run_Log`, and `Dashboard Latest Run` now reflects that commit.
