# PROJECT_NAMING_MIGRATION_ROLLBACK.md

最終更新: 2026-03-13
ステータス: Prepared

> 命名実変更フェーズで問題が出たときに、案件単位で安全に戻すためのロールバック手順メモ。
> 正本は `docs/PROJECT_NAMING_RULE.md`、事前確認は `docs/PROJECT_NAMING_MIGRATION_CHECKLIST.md`、実施順は `docs/PROJECT_NAMING_MIGRATION_RUNBOOK.md`、当日コマンドは `docs/PROJECT_NAMING_MIGRATION_COMMAND_MEMO.md` を参照する。
> 今回はロールバック手順の整理のみで、実変更は行わない。

---

## 目的

命名実変更の途中で問題が発生した場合に、

- どの段階まで戻すか
- 何を優先して戻すか
- commit 状態ごとにどう扱うか

を明文化する。

対象置換:

- `STR-04` -> `JBIZ-04`
- `GAS-01` -> `JREC-01`
- `WST-05` -> `HAIKI-05`
- `WEB-03` -> `JWEB-03`

---

## 基本方針

- ロールバックは**案件単位**で行う
- 次の案件へ進む前に、その案件のロールバック要否を確定する
- **文書+script 更新は1セットとして戻す**
- **live sheet 更新を行った後は、live sheet を優先して戻す**
- 旧値と新値が混在した状態で終了しない
- destructive な git 操作は使わず、基本は逆変更コミットで戻す

---

## 状態別ロールバック方針

### 1. 未commit

- その案件の変更だけを見直し、手元差分を元に戻す
- 旧値 / 新値の混在がない状態にしてから次へ進む
- 可能なら案件単位で差分を分離してから戻す

### 2. commit済み / 未push

- その案件だけを戻す**逆変更コミット**を作る
- `git reset --hard` は使わない
- 先にローカルファイル整合を戻し、その後に必要なら live sheet を戻す

### 3. push後

- 原則として **revert 相当の逆変更コミット** で戻す
- すでに live sheet も更新済みなら、git 側より先に運用影響の大きい live sheet を戻す
- push 後は「何を戻したか」を必ず記録する

---

## 段階別ロールバック

## A. 文書+script 更新後に戻す場合

戻す対象:

- `PROJECTS.md`
- `ai-os/` 配下の設計・状態文書
- 各 project の `README.md` / `PROJECT_STATUS.md`
- `scripts/` 配下の ID / name / metadata 参照

戻し方:

1. 対象案件の旧値 / 新値の差分を確認する
2. 文書と script を同じ変更セットとして旧値へ戻す
3. 旧値残存確認ではなく、**新値が意図せず残っていないか**を確認する
4. `update-live-projects-sheet-metadata.mjs` をまだ実行していないなら、live sheet は触らない

確認ポイント:

- `scripts/export-run-log-entry.ps1`
- `scripts/update-live-projects-sheet-metadata.mjs`
- `scripts/upsert-projects.mjs`
- `scripts/upsert-ideas.mjs`
- `scripts/upsert-task-queue.mjs`

## B. live sheet 更新後に戻す場合

戻す対象:

- live `Projects`
- live `Run_Log`
- live `Task_Queue`
- live `Ideas`
- lifecycle allowlist 関連の live 運用結果

戻し方:

1. 先にローカルの正式変更内容を固定するか、ローカルも戻すかを決める
2. live `Projects` の `project_id` / `project_name` を旧値へ戻す
3. その案件に関連する `Run_Log` / `Task_Queue` / `Ideas` の新値残存を確認する
4. lifecycle allowlist が絡む案件は allowlist を先に旧値へ戻す
5. live sheet 側の表示と helper の出力が旧値へ戻ったことを確認する

確認ポイント:

- `scripts/update-live-projects-sheet-metadata.mjs`
- `ai-os/lifecycle-projects.json`
- helper の出力値
- Dashboard / Projects / Run_Log の見え方

---

## 案件別ロールバック方針

## 1. `STR-04` -> `JBIZ-04`

### 文書+script 更新後に戻す

- `JBIZ-04` を `STR-04` に戻す
- `接骨院経営戦略AI` を `接骨院戦略AI` に戻す
- `main_sheet_name` と `local_folder` は変更していない前提なのでそのままでよい

### live sheet 更新後に戻す

- live `Projects` の `project_id` / `project_name` を旧値へ戻す
- `Task_Queue` / `Ideas` / `Run_Log` に `JBIZ-04` が残っていないか確認する

### 注意

- `project_name` も同時変更なので、ID だけ戻して名称が新しいまま残る事故に注意する

---

## 2. `GAS-01` -> `JREC-01`

### 文書+script 更新後に戻す

- `JREC-01` を `GAS-01` に戻す
- `柔整毎日記録システム` を `柔整GASシステム` に戻す
- `main_sheet_name` は維持前提なので戻し対象ではない

### live sheet 更新後に戻す

- live `Projects` の `project_id` / `project_name` を旧値へ戻す
- 生成 helper が再び `GAS-01` を返すか確認する
- `Run_Log` 系出力に `JREC-01` が残っていないか確認する

### 注意

- `project_name` の意味変更が大きいため、説明文もまとめて戻す

---

## 3. `WST-05` -> `HAIKI-05`

### 文書+script 更新後に戻す

- `HAIKI-05` を `WST-05` に戻す
- `廃棄物日報システム` を `廃棄物日報GAS` に戻す
- `ai-os/lifecycle-projects.json` の allowlist を必ず `WST-05` に戻す

### live sheet 更新後に戻す

- live `Projects` の `project_id` / `project_name` を旧値へ戻す
- lifecycle apply の対象値が `WST-05` に戻っていることを確認する
- `Task_Queue` / `Ideas` / `Run_Log` に `HAIKI-05` が残っていないか確認する

### 注意

- **allowlist を戻し忘れると運用上の不整合が残る**
- `ai-os/lifecycle-projects.json` は必ず個別確認する

---

## 4. `WEB-03` -> `JWEB-03`

### 文書+script 更新後に戻す

- `JWEB-03` を `WEB-03` に戻す
- `project_name` は `患者管理Webアプリ` のままなので、IDだけを戻す
- 自動置換事故が疑われる場合は、`WEB-03` の完全一致で旧値へ戻す

### live sheet 更新後に戻す

- live `Projects` の `project_id` を `WEB-03` に戻す
- `Task_Queue` / `Ideas` / `Run_Log` に `JWEB-03` が残っていないか確認する

### 注意

- **`WEB-03` と `JWEB-03` の部分一致事故を最優先で疑う**
- `JJWEB-03`、`JJWEB-03` 類似の誤置換、`WEB-03` の一部だけ残る事故を確認する
- `\bWEB-03\b` のような完全一致確認を使って戻す

---

## 事故パターン別メモ

### 1. 文書だけ新値、script が旧値

- script 側を新値に合わせるか、文書を旧値へ戻すかを案件単位で即決する
- 混在状態のまま live sheet 更新へ進まない

### 2. script だけ新値、文書が旧値

- 文書+script を同一変更セットに戻す原則に従い、どちらかへ統一する
- helper 出力が新値なら、文書も同じ案件内で揃えるまで次へ進まない

### 3. live sheet だけ新値、ローカルが旧値

- 最優先で live sheet を旧値へ戻す
- その後に helper / metadata / 文書を旧値前提で再確認する

### 4. push後に障害が見つかった

- reverse commit で戻す前提に切り替える
- 先に live sheet 側を運用安全な値へ戻し、その後 git 側を戻す
- 何を戻したかを作業ログへ必ず残す

---

## 最低限の確認コマンド

```powershell
git status --short --branch
git log --oneline -n 5
```

```powershell
# 旧値 / 新値 残存確認
Select-String -Path PROJECTS.md,ai-os\*.md,docs\*.md,scripts\* -SimpleMatch -Pattern 'STR-04','JBIZ-04','GAS-01','JREC-01','WST-05','HAIKI-05','WEB-03','JWEB-03'
```

```powershell
# allowlist 確認
Get-Content ai-os\lifecycle-projects.json
```

```powershell
# 中核 metadata 確認
Get-Content scripts\update-live-projects-sheet-metadata.mjs
Get-Content scripts\export-run-log-entry.ps1
```

---

## 関連文書

- `docs/PROJECT_NAMING_RULE.md`
- `docs/PROJECT_NAMING_MIGRATION_CHECKLIST.md`
- `docs/PROJECT_NAMING_MIGRATION_RUNBOOK.md`
- `docs/PROJECT_NAMING_MIGRATION_COMMAND_MEMO.md`
