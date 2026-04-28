# PROJECT_NAMING_MIGRATION_LOG_TEMPLATE.md

最終更新: 2026-03-13
ステータス: Template

> 命名実変更フェーズ当日の記録テンプレート。
> 正本は `docs/PROJECT_NAMING_RULE.md`、事前確認は `docs/PROJECT_NAMING_MIGRATION_CHECKLIST.md`、実施順は `docs/PROJECT_NAMING_MIGRATION_RUNBOOK.md`、当日コマンドは `docs/PROJECT_NAMING_MIGRATION_COMMAND_MEMO.md`、ロールバック判断は `docs/PROJECT_NAMING_MIGRATION_ROLLBACK.md` を参照する。
> 今回はテンプレート作成のみで、実変更は行わない。

---

## 実施情報

- 実施日:
- 実施者:
- ブランチ:
- 開始前 `git status` 確認:
- 関連文書確認:
  - [ ] `docs/PROJECT_NAMING_RULE.md`
  - [ ] `docs/PROJECT_NAMING_MIGRATION_CHECKLIST.md`
  - [ ] `docs/PROJECT_NAMING_MIGRATION_RUNBOOK.md`
  - [ ] `docs/PROJECT_NAMING_MIGRATION_COMMAND_MEMO.md`
  - [ ] `docs/PROJECT_NAMING_MIGRATION_ROLLBACK.md`

---

## 実施前の共通チェック

- [ ] 正式基準表が最新である
- [ ] 変更対象 4 件の旧値 / 新値対応を確認した
- [ ] 当日の実施順を確認した
- [ ] 文書+script を同一変更セットで扱うことを確認した
- [ ] live sheet 更新は最後に行うことを確認した
- [ ] rollback 方針を確認した
- [ ] `ai-os/lifecycle-projects.json` の現値を確認した
- [ ] `scripts/export-run-log-entry.ps1` の現値を確認した
- [ ] `scripts/update-live-projects-sheet-metadata.mjs` の現値を確認した
- [ ] `WEB-03` は完全一致置換で扱うことを確認した

---

## 案件記録 1

- 案件名: 接骨院経営戦略AI
- 旧ID / 新ID: `STR-04` -> `JBIZ-04`
- 開始時刻:
- 終了時刻:

### 文書更新

- 実施:
- 対象ファイル:
- 結果:

### script更新

- 実施:
- 対象ファイル:
- 結果:

### live sheet更新

- 実施:
- 対象:
- 結果:

### 検証結果

- 旧値残存確認:
- 新値反映確認:
- helper / metadata / export 確認:

### 問題

- 問題の有無:
- 内容:

### rollback要否

- 要否:
- 判断理由:
- 実施した場合の内容:

### 備考

-

---

## 案件記録 2

- 案件名: 柔整毎日記録システム
- 旧ID / 新ID: `GAS-01` -> `JREC-01`
- 開始時刻:
- 終了時刻:

### 文書更新

- 実施:
- 対象ファイル:
- 結果:

### script更新

- 実施:
- 対象ファイル:
- 結果:

### live sheet更新

- 実施:
- 対象:
- 結果:

### 検証結果

- 旧値残存確認:
- 新値反映確認:
- helper / metadata / export 確認:

### 問題

- 問題の有無:
- 内容:

### rollback要否

- 要否:
- 判断理由:
- 実施した場合の内容:

### 備考

-

---

## 案件記録 3

- 案件名: 廃棄物日報システム
- 旧ID / 新ID: `WST-05` -> `HAIKI-05`
- 開始時刻:
- 終了時刻:

### 文書更新

- 実施:
- 対象ファイル:
- 結果:

### script更新

- 実施:
- 対象ファイル:
- 結果:

### live sheet更新

- 実施:
- 対象:
- 結果:

### 検証結果

- 旧値残存確認:
- 新値反映確認:
- helper / metadata / export 確認:
- lifecycle allowlist 確認:

### 問題

- 問題の有無:
- 内容:

### rollback要否

- 要否:
- 判断理由:
- 実施した場合の内容:

### 備考

-

---

## 案件記録 4

- 案件名: 患者管理Webアプリ
- 旧ID / 新ID: `WEB-03` -> `JWEB-03`
- 開始時刻:
- 終了時刻:

### 文書更新

- 実施:
- 対象ファイル:
- 結果:

### script更新

- 実施:
- 対象ファイル:
- 結果:

### live sheet更新

- 実施:
- 対象:
- 結果:

### 検証結果

- 旧値残存確認:
- 新値反映確認:
- helper / metadata / export 確認:
- 完全一致置換確認:

### 問題

- 問題の有無:
- 内容:

### rollback要否

- 要否:
- 判断理由:
- 実施した場合の内容:

### 備考

-

---

## 実施後の共通チェック

- [ ] 4案件すべての記録を埋めた
- [ ] 文書+script の変更内容を確認した
- [ ] live sheet 更新結果を確認した
- [ ] 旧値残存確認を実施した
- [ ] rollback の要否を案件ごとに判断した
- [ ] 問題があれば内容を記録した
- [ ] 当日の最終 `git status` を確認した
- [ ] 次アクションを整理した

---

## 当日まとめ

- 全体結果:
- 実施した commit:
- push 状況:
- 発生した問題:
- rollback 実施有無:
- 次アクション:
- 備考:
