# PROJECT_NAMING_MIGRATION_COMMAND_MEMO.md

最終更新: 2026-03-13
ステータス: Prepared

> 命名実変更フェーズ当日に、上から順に確認・編集・検証を進めるためのコマンド実行順メモ。
> 正本は `docs/PROJECT_NAMING_RULE.md`、全体手順は `docs/PROJECT_NAMING_MIGRATION_RUNBOOK.md`、棚卸しは `docs/PROJECT_NAMING_MIGRATION_CHECKLIST.md` を参照する。
> 今回はメモ作成のみで、実変更は行わない。

---

## 実施順

1. `STR-04` -> `JBIZ-04`
2. `GAS-01` -> `JREC-01`
3. `WST-05` -> `HAIKI-05`
4. `WEB-03` -> `JWEB-03`

---

## 共通事前確認

```powershell
git status --short --branch
Get-Content docs\PROJECT_NAMING_RULE.md
Get-Content docs\PROJECT_NAMING_MIGRATION_CHECKLIST.md
Get-Content docs\PROJECT_NAMING_MIGRATION_RUNBOOK.md
```

```powershell
# 置換前の全体確認
Select-String -Path PROJECTS.md,ai-os\*.md,scripts\* -SimpleMatch -Pattern 'GAS-01','WEB-03','STR-04','WST-05'
Select-String -Path PROJECTS.md,ai-os\*.md,scripts\* -SimpleMatch -Pattern '柔整GASシステム','接骨院戦略AI','廃棄物日報GAS'
```

---

## 1. STR-04 -> JBIZ-04

### 事前確認コマンド

```powershell
Select-String -Path PROJECTS.md,ai-os\*.md,scripts\*,'hirayama-jyusei-strategy\README.md','hirayama-jyusei-strategy\PROJECT_STATUS.md' -SimpleMatch -Pattern 'STR-04','接骨院戦略AI','平山接骨院 慢性疼痛強化プロジェクト 管理表','workspace/hirayama-jyusei-strategy'
```

### 変更対象確認

```powershell
Select-String -Path scripts\export-run-log-entry.ps1,scripts\migrate-projects-schema.mjs,scripts\migrate-runlog-schema.mjs,scripts\preview-projects-migration.mjs,scripts\promote-idea-to-task.mjs,scripts\suggest-next-task.mjs,scripts\update-live-projects-sheet-metadata.mjs,scripts\upsert-ideas.mjs,scripts\upsert-projects.mjs,scripts\upsert-task-queue.mjs -SimpleMatch -Pattern 'STR-04','接骨院戦略AI'
```

### 変更後確認

```powershell
Select-String -Path PROJECTS.md,ai-os\*.md,scripts\*,'hirayama-jyusei-strategy\README.md','hirayama-jyusei-strategy\PROJECT_STATUS.md' -SimpleMatch -Pattern 'JBIZ-04','接骨院経営戦略AI'
git diff -- PROJECTS.md ai-os scripts hirayama-jyusei-strategy
```

### live sheet 更新前確認

```powershell
Get-Content scripts\update-live-projects-sheet-metadata.mjs
Select-String -Path scripts\update-live-projects-sheet-metadata.mjs -SimpleMatch -Pattern 'STR-04','JBIZ-04','接骨院戦略AI','接骨院経営戦略AI'
```

### 更新後検証

```powershell
Select-String -Path PROJECTS.md,ai-os\*.md,scripts\*,'hirayama-jyusei-strategy\README.md','hirayama-jyusei-strategy\PROJECT_STATUS.md' -SimpleMatch -Pattern 'STR-04','接骨院戦略AI'
Select-String -Path PROJECTS.md,ai-os\*.md,scripts\*,'hirayama-jyusei-strategy\README.md','hirayama-jyusei-strategy\PROJECT_STATUS.md' -SimpleMatch -Pattern 'JBIZ-04','接骨院経営戦略AI'
```

---

## 2. GAS-01 -> JREC-01

### 事前確認コマンド

```powershell
Select-String -Path PROJECTS.md,ai-os\*.md,scripts\*,'gas-projects\jyu-gas-ver3.1\README.md','gas-projects\jyu-gas-ver3.1\PROJECT_STATUS.md' -SimpleMatch -Pattern 'GAS-01','柔整GASシステム','【毎日記録】来店管理施術録ver3.1','workspace/gas-projects/jyu-gas-ver3.1'
```

### 変更対象確認

```powershell
Select-String -Path scripts\export-run-log-entry.ps1,scripts\migrate-projects-schema.mjs,scripts\migrate-runlog-schema.mjs,scripts\preview-projects-migration.mjs,scripts\promote-idea-to-task.mjs,scripts\suggest-next-task.mjs,scripts\update-live-projects-sheet-metadata.mjs,scripts\upsert-ideas.mjs,scripts\upsert-projects.mjs,scripts\upsert-task-queue.mjs -SimpleMatch -Pattern 'GAS-01','柔整GASシステム'
```

### 変更後確認

```powershell
Select-String -Path PROJECTS.md,ai-os\*.md,scripts\*,'gas-projects\jyu-gas-ver3.1\README.md','gas-projects\jyu-gas-ver3.1\PROJECT_STATUS.md' -SimpleMatch -Pattern 'JREC-01','柔整毎日記録システム'
git diff -- PROJECTS.md ai-os scripts gas-projects\jyu-gas-ver3.1
```

### live sheet 更新前確認

```powershell
Get-Content scripts\update-live-projects-sheet-metadata.mjs
Select-String -Path scripts\update-live-projects-sheet-metadata.mjs -SimpleMatch -Pattern 'GAS-01','JREC-01','柔整GASシステム','柔整毎日記録システム'
```

### 更新後検証

```powershell
Select-String -Path PROJECTS.md,ai-os\*.md,scripts\*,'gas-projects\jyu-gas-ver3.1\README.md','gas-projects\jyu-gas-ver3.1\PROJECT_STATUS.md' -SimpleMatch -Pattern 'GAS-01','柔整GASシステム'
Select-String -Path PROJECTS.md,ai-os\*.md,scripts\*,'gas-projects\jyu-gas-ver3.1\README.md','gas-projects\jyu-gas-ver3.1\PROJECT_STATUS.md' -SimpleMatch -Pattern 'JREC-01','柔整毎日記録システム'
```

---

## 3. WST-05 -> HAIKI-05

### 事前確認コマンド

```powershell
Select-String -Path PROJECTS.md,ai-os\*.md,scripts\*,'waste-report-system\README.md','waste-report-system\PROJECT_STATUS.md' -SimpleMatch -Pattern 'WST-05','廃棄物日報GAS','【UI日報・月報】2026年一般廃棄物業務報告書（日報・月報）','workspace/waste-report-system'
Get-Content ai-os\lifecycle-projects.json
```

### 変更対象確認

```powershell
Select-String -Path ai-os\lifecycle-projects.json,scripts\migrate-projects-schema.mjs,scripts\preview-projects-migration.mjs,scripts\promote-idea-to-task.mjs,scripts\suggest-next-task.mjs,scripts\update-live-projects-sheet-metadata.mjs,scripts\upsert-ideas.mjs,scripts\upsert-projects.mjs,scripts\upsert-task-queue.mjs -SimpleMatch -Pattern 'WST-05','廃棄物日報GAS'
```

### 変更後確認

```powershell
Get-Content ai-os\lifecycle-projects.json
Select-String -Path PROJECTS.md,ai-os\*.md,scripts\*,'waste-report-system\README.md','waste-report-system\PROJECT_STATUS.md' -SimpleMatch -Pattern 'HAIKI-05','廃棄物日報システム'
git diff -- PROJECTS.md ai-os scripts waste-report-system
```

### live sheet 更新前確認

```powershell
Get-Content scripts\update-live-projects-sheet-metadata.mjs
Select-String -Path scripts\update-live-projects-sheet-metadata.mjs,ai-os\lifecycle-projects.json -SimpleMatch -Pattern 'WST-05','HAIKI-05','廃棄物日報GAS','廃棄物日報システム'
```

### 更新後検証

```powershell
Get-Content ai-os\lifecycle-projects.json
Select-String -Path PROJECTS.md,ai-os\*.md,scripts\*,'waste-report-system\README.md','waste-report-system\PROJECT_STATUS.md' -SimpleMatch -Pattern 'WST-05','廃棄物日報GAS'
Select-String -Path PROJECTS.md,ai-os\*.md,scripts\*,'waste-report-system\README.md','waste-report-system\PROJECT_STATUS.md' -SimpleMatch -Pattern 'HAIKI-05','廃棄物日報システム'
```

---

## 4. WEB-03 -> JWEB-03

### 事前確認コマンド

```powershell
Select-String -Path PROJECTS.md,ai-os\*.md,scripts\*,'patient-management\README.md','patient-management\PROJECT_STATUS.md' -SimpleMatch -Pattern 'WEB-03','患者管理Webアプリ','整骨院 電子カルテ','workspace/patient-management'
```

### 変更対象確認

```powershell
Select-String -Path scripts\export-run-log-entry.ps1,scripts\migrate-projects-schema.mjs,scripts\migrate-runlog-schema.mjs,scripts\preview-projects-migration.mjs,scripts\promote-idea-to-task.mjs,scripts\suggest-next-task.mjs,scripts\update-live-projects-sheet-metadata.mjs,scripts\upsert-ideas.mjs,scripts\upsert-projects.mjs,scripts\upsert-task-queue.mjs -SimpleMatch -Pattern 'WEB-03'
```

### 変更後確認

```powershell
# WEB-03 は JWEB-03 を含むため、完全一致置換を前提にする
Select-String -Path PROJECTS.md,ai-os\*.md,scripts\*,'patient-management\README.md','patient-management\PROJECT_STATUS.md' -SimpleMatch -Pattern 'JWEB-03'
Select-String -Path PROJECTS.md,ai-os\*.md,scripts\*,'patient-management\README.md','patient-management\PROJECT_STATUS.md' -Pattern '\bWEB-03\b'
git diff -- PROJECTS.md ai-os scripts patient-management
```

### live sheet 更新前確認

```powershell
Get-Content scripts\update-live-projects-sheet-metadata.mjs
Select-String -Path scripts\update-live-projects-sheet-metadata.mjs -Pattern '\bWEB-03\b|JWEB-03'
```

### 更新後検証

```powershell
# 完全一致で旧値が消えているか確認
Select-String -Path PROJECTS.md,ai-os\*.md,scripts\*,'patient-management\README.md','patient-management\PROJECT_STATUS.md' -Pattern '\bWEB-03\b'
Select-String -Path PROJECTS.md,ai-os\*.md,scripts\*,'patient-management\README.md','patient-management\PROJECT_STATUS.md' -SimpleMatch -Pattern 'JWEB-03'
```

---

## 文書+script 更新後の共通確認

```powershell
git diff -- PROJECTS.md ai-os docs scripts gas-projects\jyu-gas-ver3.1 patient-management hirayama-jyusei-strategy waste-report-system
```

```powershell
# 旧値残存の横断確認
Select-String -Path PROJECTS.md,ai-os\*.md,docs\*.md,scripts\*,'gas-projects\jyu-gas-ver3.1\PROJECT_STATUS.md','patient-management\PROJECT_STATUS.md','hirayama-jyusei-strategy\PROJECT_STATUS.md','waste-report-system\PROJECT_STATUS.md' -SimpleMatch -Pattern 'GAS-01','WEB-03','STR-04','WST-05','柔整GASシステム','接骨院戦略AI','廃棄物日報GAS'
```

---

## live sheet 更新前の共通確認

```powershell
Get-Content scripts\update-live-projects-sheet-metadata.mjs
Get-Content ai-os\lifecycle-projects.json
```

```powershell
Select-String -Path scripts\update-live-projects-sheet-metadata.mjs,ai-os\lifecycle-projects.json -SimpleMatch -Pattern 'JREC-01','JWEB-03','JBIZ-04','HAIKI-05','GAS-01','WEB-03','STR-04','WST-05'
```

---

## 更新後の最終検証

```powershell
# 新値の確認
Select-String -Path PROJECTS.md,ai-os\*.md,docs\*.md,scripts\*,'gas-projects\jyu-gas-ver3.1\PROJECT_STATUS.md','patient-management\PROJECT_STATUS.md','hirayama-jyusei-strategy\PROJECT_STATUS.md','waste-report-system\PROJECT_STATUS.md' -SimpleMatch -Pattern 'JREC-01','JWEB-03','JBIZ-04','HAIKI-05','柔整毎日記録システム','接骨院経営戦略AI','廃棄物日報システム'
```

```powershell
# 旧値の残存確認
Select-String -Path PROJECTS.md,ai-os\*.md,docs\*.md,scripts\*,'gas-projects\jyu-gas-ver3.1\PROJECT_STATUS.md','patient-management\PROJECT_STATUS.md','hirayama-jyusei-strategy\PROJECT_STATUS.md','waste-report-system\PROJECT_STATUS.md' -SimpleMatch -Pattern 'GAS-01','WEB-03','STR-04','WST-05','柔整GASシステム','接骨院戦略AI','廃棄物日報GAS'
```

```powershell
git status --short
```
