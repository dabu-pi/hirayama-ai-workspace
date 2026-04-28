# PROJECT_NAMING_MIGRATION_LOG_2026-03-13.md

最終更新: 2026-03-13
ステータス: Completed

> 命名 migration 実施結果の正本ログ。
> 正本ルールは `docs/PROJECT_NAMING_RULE.md`、事前棚卸しは `docs/PROJECT_NAMING_MIGRATION_CHECKLIST.md`、実施手順は `docs/PROJECT_NAMING_MIGRATION_RUNBOOK.md` を参照する。

---

## 実施情報

- 実施日: 2026-03-13
- 実施者: Codex + Human
- ブランチ: `feature/auto-dev-phase3-loop`
- 実施順:
  1. `STR-04` -> `JBIZ-04`
  2. `GAS-01` -> `JREC-01`
  3. `WST-05` -> `HAIKI-05`
  4. `WEB-03` -> `JWEB-03`
- 開始前 `git status`: clean
- 完了後 `git status`: clean

---

## 実施前の共通チェック結果

- [x] 正式基準表が最新である
- [x] 変更対象 4 件の旧値 / 新値対応を確認した
- [x] 当日の実施順を確認した
- [x] 文書+script を同一変更セットで扱うことを確認した
- [x] live sheet 更新は最後に行うことを確認した
- [x] rollback 方針を確認した
- [x] `ai-os/lifecycle-projects.json` の現値を確認した
- [x] `scripts/export-run-log-entry.ps1` の現値を確認した
- [x] `scripts/update-live-projects-sheet-metadata.mjs` の現値を確認した
- [x] `WEB-03` は完全一致置換で扱うことを確認した

---

## 案件記録 1

- 案件名: 接骨院経営戦略AI
- 旧ID / 新ID: `STR-04` -> `JBIZ-04`
- 開始時刻: 当日実施 / 個別開始時刻は未記録
- 終了時刻: `2026-03-13 14:03:54 +0900`
- commit: `560485b` `refactor: rename STR-04 to JBIZ-04`
- 結果: local / live / push 完了
- 検証: `Projects!A7:R7` 更新、`Run_Log` の旧 `STR-04` 1セル補正、旧値残存 0 件を確認
- rollback要否: 不要

## 案件記録 2

- 案件名: 柔整毎日記録システム
- 旧ID / 新ID: `GAS-01` -> `JREC-01`
- 開始時刻: 当日実施 / 個別開始時刻は未記録
- 終了時刻: `2026-03-13 14:08:41 +0900`
- commit: `8d2f81b` `refactor: rename GAS-01 to JREC-01`
- 結果: local / live / push 完了
- 検証: `Projects!A5:R5` 更新、metadata 再実行で整合、`Run_Log` の旧 `GAS-01` 1セル補正、旧値残存 0 件を確認
- rollback要否: 不要

## 案件記録 3

- 案件名: 廃棄物日報システム
- 旧ID / 新ID: `WST-05` -> `HAIKI-05`
- 開始時刻: 当日実施 / 個別開始時刻は未記録
- 終了時刻: `2026-03-13 14:17:25 +0900`
- commit: `d0f3343` `refactor: rename WST-05 to HAIKI-05`
- 結果: local / live / push 完了
- 検証: `Projects!A8:R8` 更新、`ai-os/lifecycle-projects.json` allowlist 更新、旧値残存 0 件を確認
- rollback要否: 不要
- 備考: 文書側の重複表記は commit 前に解消

## 案件記録 4

- 案件名: 患者管理Webアプリ
- 旧ID / 新ID: `WEB-03` -> `JWEB-03`
- 開始時刻: 当日実施 / 個別開始時刻は未記録
- 終了時刻: `2026-03-13 14:29:05 +0900`
- commit: `be025f1` `refactor: rename WEB-03 to JWEB-03`
- 結果: local / live / push 完了
- 検証: 完全一致置換で反映、`Projects!A6:R6` 更新、`Run_Log` の旧 `WEB-03` 1セル補正、誤置換なしを確認
- rollback要否: 不要

---

## 実施後の共通チェック

- [x] 4案件すべての記録を埋めた
- [x] 文書+script の変更内容を確認した
- [x] live sheet 更新結果を確認した
- [x] 旧値残存確認を実施した
- [x] rollback の要否を案件ごとに判断した
- [x] 問題があれば内容を記録した
- [x] 当日の最終 `git status` を確認した
- [x] 次アクションを整理した

---

## 当日まとめ

- 全体結果: 対象4案件の命名 migration を local / live / push まで完了
- 実施した commit: `560485b`, `8d2f81b`, `d0f3343`, `be025f1`
- push 状況: 4案件すべて push 済み
- 発生した問題: live `Run_Log` の旧ID残存3セル、`JREC-01` metadata 初回未検出、`HAIKI-05` 文書重複表記
- rollback 実施有無: なし
- 次アクション: 準備文書の役割を閉じ、以後は `docs/PROJECT_NAMING_RULE.md` を正本として運用する
- 備考: `local_folder` と `main_sheet_name` は今回の方針どおり据え置き
