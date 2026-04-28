---
name: project-sync
description: PROJECTS.md・ROADMAP.md・PROJECT_STATUS.md の3ファイル間の整合を確認し、ズレを修正する。フェーズ移行時・長期ブランク後の再開時に使う。
argument-hint: "[-ProjectId <id>] [-AutoFix] [-DryRun]"
allowed-tools: Read, Edit, Bash
---

# project-sync — プロジェクト整合確認スキル

**用途:** PROJECTS.md・ROADMAP.md・PROJECT_STATUS.md の3ファイル間の整合を確認し、ズレを修正する。フェーズ移行時・長期ブランク後の再開時に使う。

---

## 実行手順

### Step 1: 3ファイル読込
1. `PROJECTS.md` — 各プロジェクトの詳細設計・フェーズ定義
2. `ROADMAP.md` — タスクステータス（`[x]`/`[ ]`/`[-]`）
3. 対象プロジェクトの `PROJECT_STATUS.md` または `*_STATUS.md`

### Step 2: 整合チェック

以下の整合点を確認する:

| チェック項目 | 正常状態 |
|---|---|
| フェーズ番号 | PROJECTS.md と ROADMAP.md で一致している |
| 完了タスク | ROADMAP の `[x]` が PROJECT_STATUS.md に記録されている |
| 次アクション | ROADMAP の `[ ]` 最上位と PROJECT_STATUS.md の「次アクション」が一致 |
| プロジェクト名 | PROJECTS.md の正式名称と STATUS.md が一致（改名対応済みか） |
| スプレッドシートID | PROJECTS.md と STATUS.md で同一IDが記載されている |

### Step 3: 差分レポート出力

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROJECT SYNC REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROJECT: <プロジェクトID>
CHECKED: <確認日時>

CONSISTENT:
  ✓ <整合が取れている項目>
  ...

INCONSISTENT:
  ✗ <差分項目>: <PROJECTS.md の値> ≠ <STATUS.md の値>
  ...

FIX_REQUIRED:
  1. <修正が必要なファイル名>: <修正内容>
  ...

AUTO_FIX: 可能 / 要確認（理由: ）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Step 4: 自動修正（確認後）

`-AutoFix` 指定時のみ、軽微な差分（日付・フェーズ番号・次アクション）を自動修正してコミット。
構造変更が必要な差分はユーザー確認を求める。

---

## オプション引数

| 引数 | 説明 |
|---|---|
| `-ProjectId <id>` | 特定プロジェクトのみチェック |
| `-AutoFix` | 軽微な差分を自動修正 |
| `-DryRun` | 差分確認のみ（修正なし） |

---

## 使用例

```
/project-sync -ProjectId JASSESS-01
/project-sync -ProjectId JREC-01 -AutoFix
/project-sync -DryRun
```
