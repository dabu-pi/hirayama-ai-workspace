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
