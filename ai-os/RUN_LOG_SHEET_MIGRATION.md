# RUN_LOG_SHEET_MIGRATION.md - Run_Log 実シート修正手順

最終更新: 2026-03-12

---

## 目的

Google スプレッドシート `Hirayama_AI_OS_Dashboard` の `Run_Log` シートを、旧8列構成から正本10列構成へ移行する。

正本:
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

---

## 現在の実シート構成

- `Date`
- `Project`
- `System`
- `Action`
- `Result`
- `Error Count`
- `Reference`
- `Notes`

---

## 変更方針

- 旧8列をそのまま上書きせず、列見出しを正本へ置き換える
- 既存データはできるだけ意味対応で残す
- 削除される概念は `Error Count` のみ
- `tasks_done` と `stop_reason` は初期段階では空欄運用を許可する

---

## 列対応表

| 旧列 | 新列 | 対応 |
|---|---|---|
| `Date` | `datetime` | そのまま移す |
| `Project` | `project` | そのまま移す |
| `System` | `system` | そのまま移す |
| `Action` | `summary` | そのまま移す |
| `Result` | `result` | そのまま移す |
| `Error Count` | `stop_reason` | 原則は空欄へ。必要なら `Errors=n` として一時退避 |
| `Reference` | `commit_hash` | そのまま移す |
| `Notes` | `next_action` | そのまま移す |
| 追加 | `log_id` | 新規追加 |
| 追加 | `tasks_done` | 新規追加 |

---

## 推奨レイアウト

左から次の順に並べる。

1. `log_id`
2. `datetime`
3. `system`
4. `project`
5. `summary`
6. `result`
7. `commit_hash`
8. `tasks_done`
9. `stop_reason`
10. `next_action`

---

## 実施手順

1. `Run_Log` シートの先頭行をバックアップする
2. A列の左側に1列追加し、見出しを `log_id` にする
3. 既存 `Date` 見出しを `datetime` に変更する
4. 既存 `Project` 見出しを `project` に変更する
5. 既存 `System` 見出しを `system` に変更する
6. 既存 `Action` 見出しを `summary` に変更する
7. 既存 `Result` 見出しを `result` に変更する
8. 既存 `Reference` 見出しを `commit_hash` に変更する
9. 既存 `Notes` 見出しを `next_action` に変更する
10. `commit_hash` の右に1列追加し、見出しを `tasks_done` にする
11. `tasks_done` の右に1列追加し、見出しを `stop_reason` にする
12. 旧 `Error Count` 列は、必要な履歴がなければ削除する
13. 既存行の `log_id` は空欄のままでもよいが、可能なら `LEGACY-001` 形式で採番する
14. 既存行の `stop_reason` は必要なものだけ埋める。不要なら空欄でよい

---

## 既存データの扱い

- 過去行を完璧に埋め直す必要はない
- 最低限、見出しが新構成に揃っていればよい
- `log_id` / `tasks_done` / `stop_reason` の既存行は空欄許容
- 新規行から `de` の TSV に合わせて埋めていく

---

## 移行後の確認ポイント

- 1行目の見出しが 10列正本と完全一致している
- `system` 列に `Codex` を入れても違和感がない
- `project` 列には `AIOS-06` など project_id が入る
- `result` は `SUCCESS` / `STOP` / `ERROR` / `PARTIAL` のまま運用できる
- `de` の TSV を貼ったときに列ずれが起きない

---

## 移行後にやること

1. `de` で 1 回コミット・push を実行する
2. 生成された TSV の 1 行を `Run_Log` に貼る
3. 列ずれがないことを確認する
4. 問題なければ `Projects` と `Task_Queue` の整合に進む
