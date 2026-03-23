---
name: resume
description: 新しい Claude Code セッション開始時・別PC引き継ぎ時に、現在地・未完了・次アクションを即座に把握する。引数で -ProjectId を指定すると特定案件のみ絞り込める。
argument-hint: "[-ProjectId <id>] [-Quick] [-Focus <keyword>]"
allowed-tools: Read, Grep, Glob, Bash
---

# resume — セッション再開スキル

**用途:** 新しい Claude Code セッション開始時・別PC引き継ぎ時に、現在地・未完了・次アクションを即座に把握する。

---

## 実行手順

以下を **この順番で** 実行すること。途中でユーザーに確認を求めない。

### Step 1: Git 状態確認
```bash
git branch --show-current
git log --oneline -5
git status
```

### Step 2: コアドキュメント読込
以下を順に読む。

1. `CLAUDE.md` — 作業ルール・禁止事項・設計方針
2. `ROADMAP.md` — 全タスクのステータス（進行中・未着手・完了）
3. `PROJECTS.md` — 各プロジェクトの詳細設計

### Step 3: アクティブプロジェクトの STATUS.md 読込

引数で `-ProjectId` が指定されていれば、そのプロジェクトの STATUS.md のみ読む。
指定がなければ、ルート直下の `*_STATUS.md` をすべて読む。

既知の STATUS ファイル一覧:
- `慢性疼痛_管理表_STATUS.md`
- `msk-assessment-platform/PROJECT_STATUS.md`
- `gas-projects/jyu-gas-ver3.1/TESTCASES.md`（GAS案件の場合）

### Step 4: 出力

以下のフォーマットで出力する。省略・要約しない。

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SESSION RESUME
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
BRANCH:      <現在ブランチ名>
LAST_COMMIT: <最終コミットID（7桁）> — <コミットメッセージ>
DIRTY:       <未コミット変更ファイル。なければ "clean">

ACTIVE_PROJECTS:
  <案件ID>: <フェーズ> — <現在の状態1行>
  ...

INCOMPLETE:
  - <未完了タスク（ROADMAP の 進行中/未着手 から抽出）>
  - ...

BLOCKED:
  - <ブロッカー・未解決論点があれば。なければ "(なし)">

NEXT_ACTION（優先順）:
  1. <最優先タスク — 具体的なアクション>
  2. <次タスク>
  3. <その次>

NOTES:
  <STATUS.md から読み取った重要メモ・仮置き値・注意点>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## オプション引数

| 引数 | 説明 | 例 |
|---|---|---|
| `-ProjectId <id>` | 特定プロジェクトのみに絞る | `-ProjectId JASSESS-01` |
| `-Quick` | Step 2（PROJECTS.md）をスキップして高速化 | `-Quick` |
| `-Focus <keyword>` | 特定キーワードを含むタスクのみ抽出 | `-Focus GAS` |

---

## 使用例

```
/resume
/resume -ProjectId JASSESS-01
/resume -Quick
/resume -Focus 慢性疼痛
```

---

## 注意事項

- このスキルは**読み取り専用**。ファイルの変更・コミットは行わない
- Git 操作は `git status` と `git log` のみ（破壊的操作は行わない）
- ROADMAP.md のタスクステータス（`[x]` / `[ ]` / `[-]`）を正確に読み取ること
- 「前回やったこと」を推測で補完しない。ファイルに書いてあることだけを報告する
