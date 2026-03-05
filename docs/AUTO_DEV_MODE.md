# AUTO_DEV_MODE.md — Claude自動開発モード 運用仕様

平山克司ワークスペース — Claude Code が設計→実装→テスト→記録→次タスク化を
自律的にループ実行するためのルール・手順・制約をまとめたドキュメント。

最終更新: 2026-03-05

---

## 目次

1. [目的と原則](#1-目的と原則)
2. [1サイクルの標準手順（PDCA）](#2-1サイクルの標準手順pdca)
3. [1サイクルの成果物の型](#3-1サイクルの成果物の型)
4. [Claudeの出力フォーマット](#4-claudeの出力フォーマット)
5. [コマンド実行ルール（rwl必須）](#5-コマンド実行ルールrwl必須)
6. [note の書き方とタグ体系](#6-note-の書き方とタグ体系)
7. [git 運用ルール](#7-git-運用ルール)
8. [止める条件（STOP条件）](#8-止める条件stop条件)
9. [プロンプトファイルの使い方](#9-プロンプトファイルの使い方)

---

## 1. 目的と原則

### 目的

Claude Code を「指示待ち」ではなく、**一定のループで自律的に前進する開発エージェント**として機能させる。
1サイクルごとに必ず記録を残し、人間が後から検証・巻き戻し・判断できる状態を保つ。

### 3つの原則

| 原則 | 説明 |
|---|---|
| **安全** | 破壊的操作・外部API課金・認証情報は自動実行しない。必ず停止して確認を取る |
| **再現性** | すべての実行は `rwl` でログ化する。コミットは粒度を小さく保ち差分を明確にする |
| **小さく刻む** | 1サイクルの変更は1機能・1バグ修正・1ドキュメント更新のいずれか1つに絞る |

---

## 2. 1サイクルの標準手順（PDCA）

```
┌─────────────────────────────────────────────────────┐
│                    1 CYCLE                          │
│                                                     │
│  P → PLAN    : タスク確認・ブランチ作成・設計        │
│  D → DO      : 実装・rwlで実行確認                  │
│  C → CHECK   : ログ確認・エラー判定・品質チェック    │
│  A → ACT     : note保存・commit・次タスク特定        │
│                                                     │
│  所要時間目安: 15〜45分（1サイクル）                  │
└─────────────────────────────────────────────────────┘
```

### P — PLAN（計画）

1. `git pull origin master` を実行
2. `ROADMAP.md` で現在の最優先タスクを確認
3. `CLAUDE.md` / `spec.md` で仕様を確認
4. 作業ブランチを作成（命名規則は [Section 7](#7-git-運用ルール) 参照）
5. 実装方針を **PLAN セクション** として出力

### D — DO（実行）

1. コードを実装・修正
2. 実行が必要な場合は `rwl` を使う（必須）
3. 変更は1ファイルずつ差分を確認しながら進める
4. 途中で仕様不明・STOP条件に該当したら即停止

### C — CHECK（確認）

1. `logs/run/` のログを確認（エラーがないか）
2. `logs/error/` にファイルが生成されていないか確認
3. `git diff` で変更差分が意図通りか確認
4. テストがある場合は `rwl` で実行してパスを確認

### A — ACT（記録・次タスク化）

1. `note` でサイクルの記録を保存
2. `git add` → `git commit`（コミットメッセージ規約に従う）
3. `ROADMAP.md` のステータスを更新（✅/🔄/⏸）
4. 次サイクルの `NEXT` セクションを出力

---

## 3. 1サイクルの成果物の型

1サイクルが終わると、以下が必ず存在する状態にする。

| 成果物 | 場所 | 必須 | 説明 |
|---|---|---|---|
| 実行ログ | `logs/run/run_*.log` | ✅ | rwlで自動生成 |
| エラーログ | `logs/error/error_*.log` | エラー時 | rwlで自動生成 |
| 開発メモ | `logs/notes/note_YYYYMMDD.md` | ✅ | noteコマンドで保存 |
| Gitコミット | master or feature branch | ✅ | 変更がある場合 |
| ROADMAP更新 | `ROADMAP.md` | 完了タスクのみ | ✅→🔄→⏸ を更新 |

---

## 4. Claudeの出力フォーマット

Auto Dev Modeでは、Claudeは毎回以下のセクション構成で出力する。
セクションの省略は禁止。内容がない場合は「なし」と明記する。

```
## PLAN
（このサイクルで何をするか・なぜするか・どのファイルを変更するか）

## CHANGES
（実際に変更したファイルと変更内容の概要リスト）
- path/to/file.py : 〇〇を修正
- path/to/spec.md : △△を更新

## COMMANDS
（rwlで実行したコマンドと結果）
rwl python -m pytest tests/
→ 結果: PASSED 5 tests

## NOTES
（重要な決定・発見・懸念点 / noteコマンドで保存した内容）
- note "〇〇の実装完了" -Tag done
- note "△△の仕様が曖昧なため次回確認" -Tag todo

## NEXT
（次のサイクルでやること / ROADMAP上のタスクID）
- ROADMAP: freee自動化 フェーズ2 → タスク 2-2 取引先検索実装
```

---

## 5. コマンド実行ルール（rwl必須）

### ルール

- **テスト・スクリプト・ビルドなどの実行は、必ず `rwl` を経由する**
- `python main.py` を直接実行することは禁止
- ログが不要な `git`, `cd`, `ls` 等の確認コマンドは `rwl` 不要

### 正しい使い方

```powershell
# ✅ 正しい
rwl python main.py
rwl python -m pytest tests/ -v
rwl node src/index.js

# ❌ 禁止
python main.py
pytest tests/
```

### rwl が使えない環境での代替

Git Bash から呼び出す場合:

```bash
powershell -File "../../scripts/run-with-log.ps1" python main.py
```

---

## 6. note の書き方とタグ体系

### タグ一覧

| タグ | 用途 | 例 |
|---|---|---|
| `done` | 完了した作業の記録 | `note "OAuth再構築完了" -Tag done` |
| `todo` | 次回やること・積み残し | `note "取引先自動作成は次回" -Tag todo` |
| `bug` | バグ・不具合の記録 | `note "redirect_uri 不一致が原因" -Tag bug` |
| `decision` | 設計判断・方針決定の根拠 | `note "自動送信はしない方針で確定" -Tag decision` |
| `risk` | 懸念点・将来の問題になりうる点 | `note "取引先IDが空の場合の挙動が未定義" -Tag risk` |
| `idea` | 将来的に試したいアイデア | `note "月次レポートをPDF化する案" -Tag idea` |

### 書き方の原則

- **何をしたか**（done）だけでなく **なぜそうしたか**（decision）も残す
- エラーが出た場合は **原因と対処**（bug）を記録してから進む
- 1サイクルにつき最低1件の note を保存する

```powershell
# サイクル開始時
note "freee OAuth再構築 着手" -Tag done

# 発見・決定時（その場で即記録）
note "redirect_uri はWebアプリURL /exec と完全一致が必要" -Tag decision
note "invalid_grant は token が期限切れ or revoke 済みを意味する" -Tag bug

# サイクル終了時
note "freee OAuth再構築完了・フェーズ2（見積書作成）2-2へ" -Tag todo
```

---

## 7. git 運用ルール

### ブランチ命名規則

| 種類 | 命名パターン | 例 |
|---|---|---|
| 新機能 | `feature/短い説明` | `feature/freee-quotation-post` |
| バグ修正 | `fix/短い説明` | `fix/oauth-redirect-uri` |
| ドキュメント | `docs/短い説明` | `docs/add-auto-dev-mode` |
| リファクタ | `refactor/短い説明` | `refactor/ver3-core-cleanup` |
| 緊急修正 | `hotfix/短い説明` | `hotfix/initSupport-key-name` |

### ブランチ作成・マージ手順

```bash
# 1. 最新を取得
git pull origin master

# 2. 作業ブランチ作成
git checkout -b feature/freee-quotation-post

# 3. 実装・コミット（複数回）
git add <files>
git commit -m "feat: freee見積書POST実装"

# 4. masterへマージ（ローカル）
git checkout master
git merge feature/freee-quotation-post --no-ff

# 5. push
git push origin master

# 6. ブランチ削除
git branch -d feature/freee-quotation-post
```

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

### コミット粒度のルール

- **1コミット = 1つの論理的変更**
- 複数ファイルが同じ目的で変わる場合は1コミットにまとめてよい
- 機能実装とドキュメント更新は別コミットにする
- `git add .` は使わず、ファイルを個別指定する（認証情報誤コミット防止）

---

## 8. 止める条件（STOP条件）

以下に該当する場合、Claudeは**実装を中断し、人間に確認を求める**。

### 絶対に止める（即時STOP）

| 条件 | 理由 |
|---|---|
| 認証情報（APIキー・パスワード・トークン）の生成・入力・コミット | セキュリティ事故防止 |
| 外部APIへの本番POST（freee見積書作成・メール送信など） | 課金・不可逆操作 |
| `git push --force` / `git reset --hard` / `rm -rf` 系操作 | 破壊的・不可逆 |
| 本番DBへの直接書き込み | データ破壊リスク |

### 状況を報告して止まる（REPORT & STOP）

| 条件 | 理由 |
|---|---|
| 仕様・要件が不明確でコードが書けない | 誤った実装を防ぐ |
| 同じエラーが3回以上繰り返す | 根本原因の特定が必要 |
| 変更範囲が1ファイルを超えて広がる（想定外） | スコープクリープ防止 |
| テストが存在し、かつ失敗したまま進もうとしている | 品質保証 |
| `ROADMAP.md` に記載のない新機能を実装しようとしている | 優先度の確認が必要 |

### STOP時の出力フォーマット

```
## STOP — 理由: [条件名]

**状況:** （現在何をしようとしていたか）

**問題:** （なぜ止まったか、具体的に）

**確認事項:**
1. 〇〇について教えてください
2. △△を実施してよいですか？

**再開手順:** （確認後にどうすればループを再開できるか）
```

---

## 9. プロンプトファイルの使い方

`docs/PROMPTS/` に3種類のプロンプトが用意されている。

| ファイル | 用途 | タイミング |
|---|---|---|
| `auto-dev-start.md` | セッション開始・初回サイクル | 新しいClaude Codeセッションの冒頭 |
| `auto-dev-loop.md` | 2サイクル目以降 | NEXTセクションを受けて次のサイクルへ |
| `auto-dev-hotfix.md` | 障害対応・バグ修正専用 | 本番障害・緊急バグ発生時 |

使い方: 各ファイルの内容をコピーして、Claude Codeのチャットに貼り付ける。
`[プレースホルダー]` の部分は状況に応じて書き換える。
