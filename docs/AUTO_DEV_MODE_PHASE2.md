# AUTO_DEV_MODE_PHASE2.md — Claude自動開発モード Phase2 仕様

平山克司ワークスペース — Phase1（手動ループ）から Phase2（スクリプト固定ループ）への移行仕様。

最終更新: 2026-03-05

---

## 目次

1. [Phase1 の要点（参照）](#1-phase1-の要点参照)
2. [Phase2 の追加点と目的](#2-phase2-の追加点と目的)
3. [1サイクルの完了条件（Definition of Done）](#3-1サイクルの完了条件definition-of-done)
4. [Phase2 スクリプト一覧](#4-phase2-スクリプト一覧)
5. [Phase2 の1サイクル手順](#5-phase2-の1サイクル手順)
6. [ブランチ規約と粒度](#6-ブランチ規約と粒度)
7. [失敗時の巻き戻し手順](#7-失敗時の巻き戻し手順)
8. [外部API・課金のSTOP条件](#8-外部api課金のstop条件)

---

## 1. Phase1 の要点（参照）

Phase1 仕様の完全版は **[docs/AUTO_DEV_MODE.md](AUTO_DEV_MODE.md)** を参照。

Phase1 のポイント（Phase2 でも有効）:

| 項目 | 内容 |
|---|---|
| サイクル構造 | PDCA（Plan → Do → Check → Act） |
| 実行ルール | スクリプト実行は必ず `rwl` 経由 |
| 記録ルール | `note` で1サイクル最低1件 |
| 出力フォーマット | `PLAN / CHANGES / COMMANDS / NOTES / NEXT` |
| STOP 条件 | 認証情報 / 本番 API POST / 仕様不明 / 同じエラー3回 |

---

## 2. Phase2 の追加点と目的

### Phase1（半自動）との違い

| 観点 | Phase1 | Phase2 |
|---|---|---|
| コマンド実行 | `rwl` を個別に呼ぶ | `auto-dev-run.ps1` で一括実行 |
| コミット | `git add` + `git commit` を手動 | `git-safe-commit.ps1` で安全確認付き実行 |
| エラー解析 | ログを手動で確認 | `analyze-error.ps1` で最新エラーを整形表示 |
| 状態確認 | 個別コマンドを叩く | `dev-status.ps1` で一覧表示 |
| 出力フォーマット | 5セクション | 6セクション（GIT セクション追加） |

### Phase2 の4つの追加目的

1. **安全コミット**: 秘密情報の誤コミットを `git-safe-commit.ps1` が自動検出・ブロック
2. **ログ解析**: `analyze-error.ps1` でエラーの根本原因をすぐ確認できる
3. **ダッシュボード**: `dev-status.ps1` でブランチ・コミット・ログ状態を一覧表示
4. **ループ手順の固定**: `auto-dev-run.ps1` で「実行 → note 自動生成」を1コマンド化

---

## 3. 1サイクルの完了条件（Definition of Done）

以下 **すべて** を満たした状態が「1サイクル完了」。

### 必須条件

| # | 条件 | 確認方法 |
|---|---|---|
| 1 | 実装コードが意図通りに動作する | `auto-dev-run.ps1 -Cmd "..."` で exit 0 |
| 2 | `logs/run/` に実行ログが存在する | `dev-status.ps1` で確認 |
| 3 | `logs/error/` に **新規** エラーログが存在しない | `dev-status.ps1` または直接確認 |
| 4 | `git diff` がクリーン（コミット済み） | `git status` で確認 |
| 5 | `logs/notes/` に今サイクルのメモが保存済み | note コマンドで確認 |
| 6 | `ROADMAP.md` のステータスが更新済み（完了タスクは ✅） | 目視確認 |
| 7 | `## NEXT` セクションに次タスクが明記されている | 出力確認 |

### テストがある場合の追加条件

| # | 条件 |
|---|---|
| 8 | テストがすべてパスしている（失敗は DoD 未達成） |
| 9 | 新しい機能にはテストが追加されている（または追加予定が NEXT に明記） |

### DoD 未達成の対処

- 条件 1〜3: STOP & REPORT → 原因を `analyze-error.ps1` で特定してから修正
- 条件 4〜7: 実装は終わっているが記録・git が未完 → ACT フェーズを再実行
- 条件 8〜9: テスト失敗 → 修正してから再実行（テスト失敗のまま進まない）

---

## 4. Phase2 スクリプト一覧

| スクリプト | 役割 | 呼び出し例 |
|---|---|---|
| `scripts/auto-dev-run.ps1` | 司令塔：rwl 経由で実行 + 自動 note | `auto-dev-run -Cmd "python -m pytest" -AutoNote "テスト"` |
| `scripts/git-safe-commit.ps1` | 安全確認付きコミット & push | `git-safe-commit -Message "feat: 〇〇" -Files @("src/main.py")` |
| `scripts/analyze-error.ps1` | 最新エラーログ整形表示 | `analyze-error` または `analyze-error -Lines 100` |
| `scripts/dev-status.ps1` | プロジェクト状態ダッシュボード | `dev-status` |

### Phase1 スクリプト（引き続き使用）

| スクリプト | 役割 |
|---|---|
| `scripts/run-with-log.ps1`（rwl） | 実行 + ログ保存（auto-dev-run が内部で使用） |
| `scripts/note.ps1`（note） | 開発メモ保存（auto-dev-run が自動呼び出し可能） |
| `scripts/create-ai-project.ps1`（cap） | 新規プロジェクト作成 |

---

## 5. Phase2 の1サイクル手順

```
┌────────────────────────────────────────────────────────────────┐
│                      PHASE2 CYCLE                              │
│                                                                │
│  PLAN  → git pull / dev-status で状態確認                      │
│          ROADMAP・CLAUDE.md を確認 / ブランチ作成               │
│          PLAN セクションを出力                                  │
│                                                                │
│  DO    → コードを実装                                           │
│          auto-dev-run -Cmd "..." [-AutoNote "..." -Tag ...]    │
│                                                                │
│  CHECK → exit コード確認 / analyze-error で原因特定（失敗時）   │
│          git diff で変更差分確認                                │
│                                                                │
│  ACT   → note で記録（自動生成されない内容のみ）                │
│          git-safe-commit -Message "..." -Files @(...) -Push    │
│          ROADMAP.md を更新 → NEXT セクションを出力              │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### Phase2 出力フォーマット（6セクション固定）

```
## PLAN
（このサイクルで何をするか・なぜするか・どのファイルを変更するか）

## CHANGES
（実際に変更したファイルと変更内容の概要リスト）
- path/to/file.py : 〇〇を修正

## COMMANDS
（auto-dev-run で実行したコマンドと結果）
auto-dev-run -Cmd "python -m pytest tests/ -v" -AutoNote "テスト実行" -Tag test
→ exit 0 / PASSED 5 tests

## NOTES
（重要な決定・発見・懸念点 / note で保存した内容）
- note "〇〇の仕様を△△に変更" -Tag decision

## GIT
（git-safe-commit の実行内容と結果）
git-safe-commit -Message "feat: 〇〇実装" -Files @("src/main.py") -Push
→ commit abc1234 / pushed to origin/master

## NEXT
（次のサイクルでやること / ROADMAP タスクID）
- ROADMAP: [現在タスク] 完了 → [次タスク] へ
```

---

## 6. ブランチ規約と粒度

### 命名規則

| 種類 | パターン | 例 |
|---|---|---|
| 新機能 | `feature/短い説明` | `feature/freee-quotation-post` |
| バグ修正 | `fix/短い説明` | `fix/oauth-redirect-uri` |
| 設定・整備 | `chore/短い説明` | `chore/update-gitignore` |
| ドキュメント | `docs/短い説明` | `docs/add-phase2-spec` |
| 緊急修正 | `hotfix/短い説明` | `hotfix/freee-token-expired` |

`refactor/` は Phase1 と共通。上記に当てはまらない場合は `chore/` を使う。

### コミット粒度のルール

- **1コミット = 1つの論理的変更**（機能実装1つ、バグ修正1つ、等）
- 機能実装とテスト追加は同じコミットでよい（セットで意味をなす場合）
- 機能実装とドキュメント更新は **別コミット**
- `git-safe-commit` を使う際も1変更1コミットを守る

### コミットメッセージ規約

```
<プレフィックス>: <変更内容の要約>

[本文（任意）]
[Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>]
```

| プレフィックス | 用途 |
|---|---|
| `feat` | 新機能 |
| `fix` | バグ修正 |
| `docs` | ドキュメント |
| `refactor` | リファクタリング |
| `test` | テスト追加・修正 |
| `chore` | 設定・依存・整理 |

---

## 7. 失敗時の巻き戻し手順

### 基本方針

```
revert  → 推奨（コミット履歴に「取り消した」記録が残る）
reset   → 原則禁止（履歴を書き換えるため）
```

### revert の手順

```bash
# 直前の1コミットを取り消す
git revert HEAD --no-edit
git push origin <branch>

# 特定コミットを取り消す
git revert <commit-hash> --no-edit
git push origin <branch>
```

### reset を使える例外条件

**以下のすべてを満たす場合のみ** `reset --soft` を使える:

1. まだ `push` していないコミットのみを対象にする
2. 変更内容そのものは正しく、コミットメッセージだけ修正したい
3. 人間が明示的に「reset してよい」と確認している

```bash
# ✅ 例外的に許可: push前のコミットメッセージ修正
git reset --soft HEAD~1
# ファイルはステージに残る → 正しいメッセージで再コミット
```

### `reset --hard` / `push --force` は絶対禁止

```bash
# ❌ 絶対禁止 — 変更が消える
git reset --hard

# ❌ 絶対禁止 — 他PCの履歴と矛盾する
git push --force
```

これらが必要に見える状況は、revert で解決できる。

### ファイル単位のロールバック

```bash
# 特定ファイルを直前コミット時点に戻す
git checkout HEAD -- path/to/file.py

# ステージ済みの変更を取り消す（コミット前）
git restore --staged path/to/file.py
```

---

## 8. 外部API・課金のSTOP条件

### 絶対STOP（即時中断・人間に確認）

以下のいずれかに「触れようとした」時点で即座に停止する。

| 条件 | 具体例 |
|---|---|
| 認証情報の読み取り | `.env`・`token.json`・`service_account.json`・`credentials.json` を開く |
| 認証情報の書き込み | APIキー・トークン・パスワードをファイルに書く |
| 認証情報のコミット | 上記ファイルを `git add` する |
| 外部APIへの本番POST | freee見積書作成・メール送信・Slack通知・SMS送信 |
| 課金が発生するAPI呼び出し | OpenAI API・Anthropic API・各種有料 SaaS API |
| OAuth トークン更新 | refresh_token を使ったトークン再発行 |

### 判断に迷う場合のルール

```
「これは本番データに書き込む可能性があるか？」
「これは課金が発生するか？」
「これは外部サービスのアカウントに何かを行うか？」

→ 1つでも YES なら STOP
```

### STOP 時の出力

```
## STOP — 理由: 外部API/課金操作

**状況:** （何をしようとしていたか）
**問題:** （なぜ止まったか）

**確認事項:**
1. この操作を実施してよいですか？
2. テスト環境 / 本番環境 どちらを対象にしますか？

**再開手順:** 確認後に「実施してください」と明示してください。
```

---

## 参照ドキュメント

| ドキュメント | 内容 |
|---|---|
| `docs/AUTO_DEV_MODE.md` | Phase1 全体仕様 |
| `docs/PROMPTS/auto-dev-phase2.md` | Phase2 開始プロンプト |
| `scripts/auto-dev-checklist.md` | サイクル別チェックリスト |
| `docs/AI_DEV_ENV.md` | 環境構成・スクリプト使い方 |
