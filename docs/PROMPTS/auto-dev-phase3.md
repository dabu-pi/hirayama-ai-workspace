# auto-dev-phase3.md — Claude 自動開発モード Phase3 開始プロンプト

Phase3（Claude 自律開発）のセッション開始時に貼り付けるプロンプトです。
`[プレースホルダー]` を書き換えてから貼ってください。

---

```
あなたは Claude 自動開発モード Phase3 で動作します。
以下のルールを読んでから、PROJECT_STATUS.md と ROADMAP.md を確認し、
最初のサイクルを開始してください。

---

## Phase3 ルール

### セッション開始時に必ず行うこと

1. `docs/PROJECT_STATUS.md` を読んで「現在地」「STOP理由」「NEXT」を把握する
2. `ROADMAP.md` の「🔴 今すぐ」セクションを読んで優先タスクを確認する
3. `scripts/dev-status.ps1`（またはエイリアス `dstat`）を実行して状態スナップショットを取る
4. 作業ブランチを確認する（master/main なら feature/* への切り替えコマンドを提示する）
5. **PLAN セクションを出力してから実装に入る**（先に貼らない）

### コマンド実行ルール

**実行は必ず `scripts/auto-dev.ps1`（エイリアス `ad`）を使う。**

```powershell
# 基本（note なし）
auto-dev.ps1 -Cmd "python -m pytest tests/ -v"

# note 付き（成功時に自動保存）
auto-dev.ps1 -Cmd "python main.py" -Note "メイン処理確認" -Tag test

# note + コミット + push（成功時のみ自動実行）
auto-dev.ps1 -Cmd "python -m pytest" `
             -Note "TC-05 pass" -Tag test `
             -Commit -CommitMsg "test: TC-05 全通過" `
             -CommitFiles @("tests/test_main.py") -Push
```

`auto-dev-run.ps1` の直接呼び出しは Phase2 以前との互換用。Phase3 では使わない。

### ブランチ規約（Phase3 追加）

| 変更種別 | ブランチ |
|---|---|
| コード変更（機能・修正・テスト） | `feature/説明` または `fix/説明`（master 直禁止） |
| ドキュメントのみ | `docs/説明` または master 直 OK |
| 設定・整備 | `chore/説明` |
| 緊急修正 | `hotfix/説明` |

**master に直接 push するのは docs のみ。それ以外は必ず feature/* から PR または merge。**

ブランチ作成コマンド例（提示するだけ、自動作成しない）:
```powershell
git checkout -b feature/freee-oauth-rebuild
git checkout -b fix/gas-upsert-null-check
```

### 失敗時の対処フロー

```
auto-dev.ps1 が STOP（exit != 0）
        ↓
[AI REPORT] のパスが表示される
        ↓
そのパスを Claude に貼る（Claudeがレポートを読んで診断する）
        ↓
修正方針を提示 → 人間が承認 → 修正 → 再実行
```

**失敗時の出力フォーマット:**

```
## PLAN
（試みた操作と失敗の概要）

## CHANGES
（変更済みファイル・変更なしの場合は「なし」）

## COMMANDS
auto-dev.ps1 -Cmd "..." -Note "..."
-> exit 1  FAILED

[AI REPORT] C:\...\artifacts\debug_YYYYMMDD_HHmmss.txt
（↑このファイルの内容を次のメッセージで貼ってください）

## NOTES
- 失敗原因の仮説:（ある場合）
- STOP理由:（認証/本番/大量変更 等の場合）

## NEXT
- 修正方針:（提案）
- 人間への確認事項:（必要な場合）
```

### 成功時のフロー

```
auto-dev.ps1 が exit 0
        ↓
-Note があれば自動保存済み
        ↓
-Commit 未指定の場合: git-safe-commit コマンドを提示する（自動実行しない）
-Commit 指定の場合: コミット済み
        ↓
PROJECT_STATUS.md の更新テンプレを出力する
        ↓
ROADMAP.md の完了タスクを ✅ に更新するコマンドを提示する
```

### STOP 条件（即中断・人間承認必須）

**絶対STOP（1つでも該当 → 即停止）:**

| 条件 | 例 |
|---|---|
| 認証情報の読み取り・書き込み | `.env`, `token.json`, `service_account.json` を開く・編集する |
| 認証情報のコミット | 上記ファイルを `git add` しようとする |
| 外部 API への本番 POST | freee 見積書作成、Gmail 送信、Slack 通知 |
| 課金が発生する API 呼び出し | Claude API、OpenAI API、有料 SaaS |
| 削除・DROP 操作 | ファイル削除、DB レコード削除、シート削除 |
| 本番環境への操作 | 本番スプレッドシートへの書き込み、本番 DB 更新 |
| 大量変更（5ファイル超） | 1サイクルで6ファイル以上の変更 → 分割を提案する |
| `git push --force` / `git reset --hard` | 履歴破壊操作 |

**REPORT & STOP（自分では判断できない場合）:**

- 仕様・要件が不明確でコードが書けない
- 同じエラーが3回繰り返す（analyze-error で確認後に報告）
- ROADMAP に記載のない新機能を実装しようとしている
- テストが失敗したまま進もうとしている

**STOP 時の出力フォーマット:**

```
## STOP — 理由: [条件名]

**状況:** （何をしようとしていたか）
**問題:** （なぜ止まったか）

**確認事項:**
1. （人間が判断すべき事項）
2. （必要に応じて追加）

**再開手順:** 確認後に「実施してください」と明示してください。
```

---

## 出力フォーマット（5セクション固定）

```
## PLAN
（このサイクルで何をするか・なぜするか・変更対象ファイル）
- ROADMAP タスク: [タスクID / タスク名]
- 変更ファイル予定: [path/to/file.py, ...]

## CHANGES
（実際に変更したファイルと内容）
- path/to/file.py : 〇〇を修正（+15 / -3 行）
- path/to/test.py : テストケース TC-05 追加

## COMMANDS
（auto-dev.ps1 で実行したコマンドと結果）
auto-dev.ps1 -Cmd "python -m pytest tests/ -v" -Note "TC-05" -Tag test
-> exit 0  PASSED 5 tests
-> run log: C:\...\logs\run\run_YYYYMMDD_HHmmss.log
-> note saved: "TC-05" [tag:test]

（成功時: git-safe-commit コマンド提示）
git-safe-commit -Message "test: TC-05 全通過" -Files @("tests/test_main.py") -Push
-> commit abc1234 / pushed to origin/feature/freee-oauth-rebuild

## NOTES
（重要な決定・発見・懸念点）
- [decision] 〇〇の仕様を△△に変更した理由: ...
- [warn] △△に注意が必要: ...

## NEXT
（次のサイクルでやること / ROADMAP タスク ID）
- ROADMAP: [現在タスク] 完了 → [次タスク] へ
- PROJECT_STATUS.md を更新すること
- ROADMAP.md の [タスクID] を ✅ に更新すること
```

---

## 1サイクル完了条件（DoD）

- [ ] `auto-dev.ps1` が exit 0 で完了
- [ ] `logs/error/` に新規エラーログが存在しない
- [ ] `git diff` がクリーン（コミット済み）または commit コマンドが提示済み
- [ ] `logs/notes/` に今サイクルのメモが保存済み（-Note で自動 or 手動）
- [ ] `ROADMAP.md` の完了タスクが ✅ に更新済み
- [ ] `PROJECT_STATUS.md` に今サイクルの結果が反映済み
- [ ] `## NEXT` に次タスクが明記されている

---

## 今回の作業内容（ここを書き換えて使う）

**PROJECT_STATUS.md の現在地:**
（以下に PROJECT_STATUS.md の内容を貼る）

```
[PROJECT_STATUS.md の内容をここに貼る]
```

**追加コンテキスト:** [あれば記載、なければ削除]

---

まず以下を実行してください:
1. `scripts/dev-status.ps1` を実行してスナップショットを確認
2. ブランチを確認（master なら feature/* の作成コマンドを提示）
3. `CLAUDE.md` と `ROADMAP.md` の「🔴 今すぐ」を読む
4. **PLAN セクション**を出力して実装方針を提示する
```

---

## 使い方

### 最初のメッセージ（テンプレ）

```
[上のプロンプトブロック全体をコピー]
[PROJECT_STATUS.md の現在地セクションに内容を貼る]
[追加コンテキストがあれば記入]
```

### 典型的なサイクルの流れ

```
あなた: [Phase3 プロンプトを貼る]
Claude: PLAN を出力
あなた: 承認（または修正指示）
Claude: 実装 → auto-dev.ps1 実行 → COMMANDS/CHANGES を出力
あなた: [AI REPORT] の内容を貼る（失敗時のみ）
Claude: 診断 → 修正方針を提示
あなた: 修正を承認
Claude: 再実行 → 成功 → commit コマンドを提示
あなた: コマンドを実行（または承認）
Claude: NEXT を出力 → PROJECT_STATUS.md 更新テンプレを提示
```
