# auto-dev-start.md — 自動開発モード 開始プロンプト

セッション開始時（最初の1回）にチャットへ貼り付けるプロンプトです。
`[プレースホルダー]` の部分を書き換えてから使ってください。

---

```
あなたは Claude 自動開発モードで動作します。
以下のルールをすべて読んで、最初のサイクルを開始してください。

---

## 前提（必ず守ること）

### ディレクトリ運用
- 本番開発 : `workspace/` 配下（Git管理・commit/push 必須）
- 実験・試作: `claude-sandbox/` 配下（Git任意・commit不要）
- 判断基準  : 仕様が確定していれば `workspace/`、「まず試す」なら `claude-sandbox/`

### ログ運用
- スクリプト実行は必ず `rwl` を使う（`python main.py` の直接実行は禁止）
- メモは `note` コマンドで保存する（1サイクル最低1件）
- `logs/run/` `logs/error/` は gitignore、`logs/notes/` は git 管理対象

### 禁止事項
- 認証情報（APIキー・パスワード・トークン）の生成・入力・コミット
- freee API など外部への本番 POST
- `git push --force` / `git reset --hard` / `rm -rf` 系操作

---

## 出力フォーマット（毎回このセクション構成で出力する）

```
## PLAN
（このサイクルで何をするか・なぜするか・どのファイルを変更するか）

## CHANGES
（実際に変更したファイルと変更内容の概要リスト）
- path/to/file.py : 〇〇を修正

## COMMANDS
（rwl で実行したコマンドと結果）
rwl python -m pytest tests/
→ 結果: PASSED 5 tests

## NOTES
（重要な決定・発見・懸念点 / note コマンドで保存した内容）
- note "〇〇の実装完了" -Tag done

## NEXT
（次のサイクルでやること / ROADMAP 上のタスク ID）
- ROADMAP: [タスク名] → [次のタスク名]
```

---

## git 運用ルール

- ブランチ命名: `feature/説明` `fix/説明` `docs/説明` `refactor/説明` `hotfix/説明`
- コミットメッセージ: `feat:` `fix:` `docs:` `refactor:` `test:` `chore:` + 変更内容
- 1コミット = 1つの論理的変更
- `git add .` は禁止、ファイルを個別指定する

---

## STOP 条件（即座に実装を中断して確認を求める）

**即時STOP（絶対禁止）**
- 認証情報の生成・入力・コミット
- 外部 API への本番 POST
- 破壊的 git 操作

**REPORT & STOP（状況を報告して止まる）**
- 仕様・要件が不明確でコードが書けない
- 同じエラーが3回以上繰り返す
- 変更範囲が想定外に広がる
- テストが存在して失敗したまま進もうとしている
- ROADMAP.md に記載のない新機能を実装しようとしている

---

## 今回の作業内容

**プロジェクト:** [プロジェクト名 例: freee-automation]
**作業ディレクトリ:** [例: workspace/freee-automation/]
**タスク:** [ROADMAP.md のタスク名・タスクID 例: フェーズ2 タスク2-1 見積書POST実装]
**追加コンテキスト:** [あれば記載、なければ削除]

---

まず以下を実行してください:
1. `git pull origin master`
2. `ROADMAP.md` で上記タスクの詳細を確認
3. `CLAUDE.md` で仕様・制約を確認
4. 作業ブランチを作成
5. **PLAN セクション**を出力して実装方針を提示する
```
