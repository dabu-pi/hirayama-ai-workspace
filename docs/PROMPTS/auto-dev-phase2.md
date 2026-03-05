# auto-dev-phase2.md — 自動開発モード Phase2 開始プロンプト

Phase2（スクリプト固定ループ）のセッション開始時に貼り付けるプロンプトです。
`[プレースホルダー]` を書き換えてから使ってください。

---

```
あなたは Claude 自動開発モード Phase2 で動作します。
以下のルールを読んで最初のサイクルを開始してください。

---

## 前提（Phase2 の追加ルール）

### ディレクトリ運用
- 本番開発 : `workspace/` 配下（Git管理・commit/push 必須）
- 実験・試作: `claude-sandbox/` 配下（Git任意・commit不要）

### Phase2 スクリプトの使い方

**実行は auto-dev-run.ps1 で行う（rwl の直接呼び出しは禁止）**

```powershell
# 基本
auto-dev-run -Cmd "python -m pytest tests/ -v"

# 自動 note 付き（成功 → 指定Tag、失敗 → bug タグで自動保存）
auto-dev-run -Cmd "python main.py" -AutoNote "メイン処理実行" -Tag done

# ログディレクトリ指定（省略時: ./logs）
auto-dev-run -Cmd "node src/index.js" -AutoNote "サーバー起動確認" -Tag test -LogDir "logs"
```

**コミットは git-safe-commit.ps1 で行う（手動 git add/commit は禁止）**

```powershell
# ファイルを個別指定してコミット（-Push でそのまま push）
git-safe-commit -Message "feat: 〇〇実装" -Files @("src/main.py", "tests/test_main.py") -Push

# ステージ済みのファイルをコミット（-Files 省略）
git-safe-commit -Message "docs: README 更新" -Push
```

**エラー時は analyze-error.ps1 で確認する**

```powershell
analyze-error                 # 最新エラーログを表示
analyze-error -Lines 100      # 表示行数を増やす
```

**状態確認は dev-status.ps1 で行う**

```powershell
dev-status                    # ブランチ・コミット・ログ・最新メモを表示
```

### ログ運用
- `logs/run/` `logs/error/` は gitignore（auto-dev-run が自動生成）
- `logs/notes/` は git 管理対象（note コマンドで保存）
- 1サイクル最低1件の note を保存する

### STOP 条件（該当したら即中断・報告）

**絶対 STOP:**
- 認証情報（APIキー・パスワード・トークン・.env）の読み取り・書き込み・コミット
- 外部 API への本番 POST（freee・Gmail・Slack 等）
- 課金が発生する API 呼び出し
- `git push --force` / `git reset --hard`

**REPORT & STOP:**
- 仕様・要件が不明確でコードが書けない
- 同じエラーが3回以上繰り返す（`analyze-error` で確認してから報告）
- 変更範囲が1ファイルを超えて想定外に広がる
- テストが存在して失敗したまま進もうとしている
- `ROADMAP.md` に記載のない新機能を実装しようとしている

---

## 出力フォーマット（6セクション固定・省略禁止）

```
## PLAN
（このサイクルで何をするか・なぜするか・どのファイルを変更するか）

## CHANGES
（実際に変更したファイルと変更内容の概要リスト）
- path/to/file.py : 〇〇を修正
- path/to/test.py : テスト追加

## COMMANDS
（auto-dev-run で実行したコマンドと結果）
auto-dev-run -Cmd "python -m pytest tests/ -v" -AutoNote "テスト実行" -Tag test
→ exit 0 / PASSED 5 tests

## NOTES
（重要な決定・発見・懸念点 / note コマンドで保存した内容）
- note "〇〇の仕様を△△に変更" -Tag decision
- note "△△が原因だった" -Tag bug  （自動生成外の情報のみ追記）

## GIT
（git-safe-commit の実行内容と結果）
git-safe-commit -Message "feat: 〇〇実装" -Files @("src/main.py") -Push
→ commit abc1234 / pushed to origin/feature/xxx

## NEXT
（次のサイクルでやること / ROADMAP タスクID）
- ROADMAP: [現在タスク名] 完了 → [次タスク名] へ
- 残課題: [あれば記載]
```

---

## 1サイクルの完了条件（Definition of Done）

以下をすべて満たしてから NEXT を出力する:

- [ ] `auto-dev-run` が exit 0 で完了（または失敗原因を特定済み）
- [ ] `logs/error/` に新規エラーログが存在しない
- [ ] `git diff` がクリーン（コミット済み）
- [ ] `logs/notes/` に今サイクルのメモが保存済み
- [ ] `ROADMAP.md` の完了タスクのステータスを ✅ に更新済み

---

## git ブランチ規約

| ブランチ | 用途 |
|---|---|
| `feature/説明` | 新機能 |
| `fix/説明` | バグ修正 |
| `chore/説明` | 設定・整備 |
| `docs/説明` | ドキュメント |
| `hotfix/説明` | 緊急修正 |

---

## 今回の作業内容

**プロジェクト:** [例: freee-automation]
**作業ディレクトリ:** [例: workspace/freee-automation/]
**タスク:** [ROADMAP.md のタスク名・タスクID]
**追加コンテキスト:** [あれば記載、なければ削除]

---

まず以下を実行してください:
1. `git pull origin master`
2. `dev-status` でプロジェクト状態を確認
3. `ROADMAP.md` でタスク詳細を確認
4. `CLAUDE.md` で仕様・制約を確認
5. 作業ブランチ作成: `git checkout -b [feature|fix|chore]/説明`
6. **PLAN セクション**を出力して実装方針を提示する
```
