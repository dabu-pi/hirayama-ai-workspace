# PROJECT_NAMING_MIGRATION_CHECKLIST.md

最終更新: 2026-03-13
ステータス: Prepared

> `docs/PROJECT_NAMING_RULE.md` に基づいて実変更フェーズへ入るときの棚卸しチェックリスト。
> 今回はチェック項目の整理のみで、実変更は行わない。

---

## 使い方

- 実変更開始前に全項目を確認対象として棚卸しする
- 影響範囲が確定するまでは `project_id` の一括変更を行わない
- チェック結果は別途作業ログまたは移行メモに残す

---

## 棚卸しチェックリスト

- [ ] Dashboard / schema 文書内の `project_id` 参照
- [ ] scripts 内の `project_id` 定数、マップ、正規表現
- [ ] Run_Log / Projects / Task_Queue / Ideas の live data
- [ ] JSON / example ファイル内の既存 `project_id`
- [ ] handoff / automation / validator 系スクリプト
- [ ] 文書内の旧 `project_name` / 旧 `project_id` の記述

---

## 実変更前の確認

- [ ] 正式基準表が最新である
- [ ] 変更対象 ID と名称の対応表が確定している
- [ ] live sheet 側の更新順を決めている
- [ ] スクリプト側の置換対象を洗い出している
- [ ] ロールバック方針を決めている
