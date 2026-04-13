# PROJECT_NAMING_MIGRATION_RUNBOOK.md

最終更新: 2026-03-13
ステータス: Executed

> `docs/PROJECT_NAMING_RULE.md` を正本とし、命名実変更フェーズへ入る直前に使う手順書。
> 2026-03-13 にこの手順で 4 案件の命名移行を実施済み。詳細は `docs/PROJECT_NAMING_MIGRATION_LOG_2026-03-13.md` を参照する。

---

## 実施済みメモ

- 実施日: 2026-03-13
- local / live / push: 完了
- `WST-05 -> HAIKI-05` では `ai-os/lifecycle-projects.json` の allowlist も更新済み
- `WEB-03 -> JWEB-03` は完全一致置換で実施し、live `Run_Log` の残存1セルも補正済み
- 実績詳細: `docs/PROJECT_NAMING_MIGRATION_LOG_2026-03-13.md`

---

## 目的

命名実変更フェーズで、旧値から新値への置換を安全に進めるための実施順序を固定する。

対象置換:

- `GAS-01` -> `JREC-01`
- `WEB-03` -> `JWEB-03`
- `STR-04` -> `JBIZ-04`
- `WST-05` -> `HAIKI-05`

---

## 実施原則

- **文書更新と script 更新は同一変更セットで扱う**
- **live sheet 更新は最後に行う**
- 各案件とも、実施順は必ず次の4段階で固定する
  1. 文書更新
  2. script更新
  3. live sheet更新
  4. 検証
- `project_id` の置換は原則として完全一致で扱う
- 部分一致の可能性がある置換は、自動置換後に手動確認を必須とする

---

## 共通の要注意項目

### 1. `ai-os/lifecycle-projects.json`

- `WST-05` を allowlist として直接保持している
- `WST-05` -> `HAIKI-05` の実変更時に未更新だと lifecycle apply が壊れる

### 2. `scripts/export-run-log-entry.ps1`

- directory / path から `project_id` を直接返している
- ここを更新しないと Run_Log 出力が旧IDのまま残る

### 3. `scripts/update-live-projects-sheet-metadata.mjs`

- `project_id` / `project_name` / `main_sheet_name` / `local_folder` をまとめて持つ中核ファイル
- live `Projects` 更新の入口なので、実変更フェーズでは最重要ファイルとして扱う

### 4. `WEB-03` と `JWEB-03` の部分一致問題

- `JWEB-03` は `WEB-03` を含むため、雑な文字列置換は誤爆する
- `WEB-03` の置換は完全一致前提で行い、置換後の差分を手動確認する

---

## 変更順序案

### Phase 1. 文書更新

対象:

- `PROJECTS.md`
- `ai-os/` 配下の設計・状態文書
- 各 project の `README.md` / `PROJECT_STATUS.md`
- 命名・移行関連 docs

目的:

- 説明文と基準名を先に揃える
- 旧値が「運用上の正式値」として残らない状態にする

### Phase 2. script更新

対象:

- `scripts/export-run-log-entry.ps1`
- `scripts/update-live-projects-sheet-metadata.mjs`
- `scripts/migrate-projects-schema.mjs`
- `scripts/migrate-runlog-schema.mjs`
- `scripts/preview-projects-migration.mjs`
- `scripts/upsert-projects.mjs`
- `scripts/upsert-ideas.mjs`
- `scripts/upsert-task-queue.mjs`
- `scripts/promote-idea-to-task.mjs`
- `scripts/suggest-next-task.mjs`
- その他 `project_id` / `project_name` のマップを持つ helper

目的:

- ローカル実行時の生成物と live sheet helper を新命名へ揃える
- 旧IDの再出力を止める

### Phase 3. live sheet更新

対象:

- live `Projects`
- live `Run_Log`
- live `Task_Queue`
- live `Ideas`
- lifecycle allowlist とその関連挙動

目的:

- 実データ側を正式基準へ寄せる
- ローカルの helper と live sheet の値を一致させる

### Phase 4. 検証

対象:

- Run_Log 出力
- Projects metadata
- Task_Queue / Ideas の project 名寄せ
- lifecycle allowlist の適用挙動
- 旧値の残存有無

目的:

- 旧IDが残っていないこと
- 旧 `project_name` が helper 内に残っていないこと
- live sheet 側の参照ずれが起きていないこと

---

## 案件別手順

## 1. `GAS-01` -> `JREC-01`

### 文書更新

- `GAS-01` を `JREC-01` に更新する
- `柔整GASシステム` を `柔整毎日記録システム` に更新する
- `main_sheet_name` は `【毎日記録】来店管理施術録ver3.1` を維持する
- `local_folder` は `workspace/gas-projects/jyu-gas-ver3.1` を維持する

### script更新

- `directory -> project_id` マップの `GAS-01` を `JREC-01` に更新する
- `project_id -> project_name` マップの `柔整GASシステム` を `柔整毎日記録システム` に更新する
- Run_Log 変換ロジックで旧名称が残っていないか確認する

### live sheet更新

- live `Projects` の `project_id` と `project_name` を更新する
- 関連する `Run_Log` / `Task_Queue` / `Ideas` に旧IDが残るか確認する

### 検証

- helper 実行で `JREC-01` が返ること
- `柔整毎日記録システム` が表示名として使われること
- 旧 `GAS-01` / `柔整GASシステム` が残っていないこと

---

## 2. `WEB-03` -> `JWEB-03`

### 文書更新

- `WEB-03` を `JWEB-03` に更新する
- `project_name` は `患者管理Webアプリ` を維持する
- `main_sheet_name` は `整骨院 電子カルテ` を維持する
- `local_folder` は `workspace/patient-management` を維持する

### script更新

- `WEB-03` を完全一致で `JWEB-03` に更新する
- 部分一致誤爆を避けるため、置換後に差分を手動確認する
- `project_name` マップに変更が不要でも、旧ID参照が残っていないか確認する

### live sheet更新

- live `Projects` の `project_id` を更新する
- `Task_Queue` / `Ideas` / `Run_Log` の `WEB-03` 残存を確認する

### 検証

- `JWEB-03` が helper / metadata / export で一貫して使われること
- `WEB-03` の残存がないこと
- 部分一致による `JJWEB-03` や誤変換が起きていないこと

---

## 3. `STR-04` -> `JBIZ-04`

### 文書更新

- `STR-04` を `JBIZ-04` に更新する
- `接骨院戦略AI` を `接骨院経営戦略AI` に更新する
- `main_sheet_name` は `平山接骨院 慢性疼痛強化プロジェクト 管理表` を維持する
- `local_folder` は `workspace/hirayama-jyusei-strategy` を維持する

### script更新

- `directory -> project_id` マップの `STR-04` を `JBIZ-04` に更新する
- `project_id -> project_name` マップの `接骨院戦略AI` を `接骨院経営戦略AI` に更新する
- old label が helper や migration script に残っていないか確認する

### live sheet更新

- live `Projects` の `project_id` と `project_name` を更新する
- 関連する `Task_Queue` / `Ideas` / `Run_Log` の表記を確認する

### 検証

- helper 実行で `JBIZ-04` が返ること
- `接骨院経営戦略AI` が表示名として使われること
- `STR-04` / `接骨院戦略AI` が残っていないこと

---

## 4. `WST-05` -> `HAIKI-05`

### 文書更新

- `WST-05` を `HAIKI-05` に更新する
- `廃棄物日報GAS` を `廃棄物日報システム` に更新する
- `main_sheet_name` は `【UI日報・月報】2026年一般廃棄物業務報告書（日報・月報）` を維持する
- `local_folder` は `workspace/waste-report-system` を維持する

### script更新

- `WST-05` を `HAIKI-05` に更新する
- `廃棄物日報GAS` を `廃棄物日報システム` に更新する
- `ai-os/lifecycle-projects.json` の allowlist を必ず更新する
- lifecycle 周辺 helper の入力 / 出力に旧IDが残っていないか確認する

### live sheet更新

- live `Projects` の `project_id` と `project_name` を更新する
- lifecycle apply に使う対象値が `HAIKI-05` に揃っていることを確認する
- 関連 `Task_Queue` / `Ideas` / `Run_Log` の残存値を確認する

### 検証

- lifecycle allowlist が `HAIKI-05` で正常動作すること
- helper 実行で `HAIKI-05` が返ること
- `WST-05` / `廃棄物日報GAS` が残っていないこと

---

## 実施時の確認ポイント

- 置換は案件単位で完結させる
- 文書更新と script 更新は同じ変更セットで扱う
- live sheet 更新は最後にまとめて行う
- 1案件ごとに旧値残存チェックを行ってから次へ進む
- `WEB-03` のみ、部分一致問題のため差分確認を通常より厳密に行う

---

## 関連文書

- `docs/PROJECT_NAMING_RULE.md`
- `docs/PROJECT_NAMING_MIGRATION_CHECKLIST.md`