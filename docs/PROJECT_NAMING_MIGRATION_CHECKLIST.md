# PROJECT_NAMING_MIGRATION_CHECKLIST.md

最終更新: 2026-03-13
ステータス: Completed

> `docs/PROJECT_NAMING_RULE.md` に基づいて実変更フェーズへ入るときの棚卸しチェックリスト。
> 2026-03-13 に 4 案件の命名移行を完了し、結果は `docs/PROJECT_NAMING_MIGRATION_LOG_2026-03-13.md` に記録した。

---

## 使い方

- 実変更開始前に全項目を確認対象として棚卸しする
- 影響範囲が確定するまでは `project_id` の一括変更を行わない
- チェック結果は別途作業ログまたは移行メモに残す

---

## 棚卸しチェックリスト

- [x] Dashboard / schema 文書内の `project_id` 参照
- [x] scripts 内の `project_id` 定数、マップ、正規表現
- [x] Run_Log / Projects / Task_Queue / Ideas の live data
- [x] JSON / example ファイル内の既存 `project_id`
- [x] handoff / automation / validator 系スクリプト
- [x] 文書内の旧 `project_name` / 旧 `project_id` の記述

---

## 実変更前の確認

- [x] 正式基準表が最新である
- [x] 変更対象 ID と名称の対応表が確定している
- [x] live sheet 側の更新順を決めている
- [x] スクリプト側の置換対象を洗い出している
- [x] ロールバック方針を決めている

---

## 完了メモ

- 実施日: 2026-03-13
- 実施順: `STR-04 -> JBIZ-04` -> `GAS-01 -> JREC-01` -> `WST-05 -> HAIKI-05` -> `WEB-03 -> JWEB-03`
- 実施結果: local / live / push 完了
- 実績ログ: `docs/PROJECT_NAMING_MIGRATION_LOG_2026-03-13.md`
