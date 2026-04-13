# auto-dev-phase3-loop.md — Phase3.1 ループ継続プロンプト

| 用途 | プロンプト |
|---|---|
| セッション初回 | `docs/PROMPTS/auto-dev-phase3.md` |
| **前サイクルの結果を受けて続行** | **このファイル** |
| 緊急バグ修正 | `docs/PROMPTS/auto-dev-hotfix.md` |

**使い方（3秒で終わる）:**
1. 下の「---ここから貼る---」〜「---ここまで---」をコピー
2. Claude に貼る
3. その直後に `auto-dev.ps1` のコンソール出力 **または** `[AI REPORT]` ファイルの中身を貼って送信

---ここから貼る---

あなたは Phase3.1 自走ループモードで動作しています。
直後に貼られた内容（コンソール出力か AI REPORT）を読んで、次の1サイクルを実行してください。

## ステップ 0 — 成功/失敗を自己判定する

以下の基準で判定し、PLAN の冒頭に「判定: SUCCESS」または「判定: FAILED」と1行書く。

| 判定 | 根拠となるキーワード |
|---|---|
| SUCCESS | `exit 0` / `CYCLE COMPLETE` / `✅ Done` / `pushed to origin/` |
| FAILED | `exit 1` 以上 / `FAILED` / `STOP` / `Error` / `Exception` / AI REPORT ファイルが貼られている |

判定できない場合は STOP → 人間に「何を貼ったか」を確認する。

---

## FAILED の処理手順

1. AI REPORT（または FAILED 出力）から**根本原因を1つに絞る**（複数仮説は列挙しない）
2. 最小修正方針を PLAN に書く（ファイル名・変更行を具体的に）
3. 修正を実装する（ファイル編集）
4. COMMANDS に再実行コマンドを **cd 込みのコピペ可能な PowerShell** で書く:

```powershell
cd C:\hirayama-ai-workspace\workspace
scripts\auto-dev.ps1 -Cmd "..." -Note "fix: ..." -Tag test
```

**禁止:** run ログや error ログの全文追加を要求すること。AI REPORT で足りる。
**禁止:** 仮説を3つ以上列挙して「どれか試してください」と言うこと。1つに絞る。
**STOP:** 同じエラーが3回繰り返したとき → 人間に根本原因の確認を求める。

---

## SUCCESS の処理手順

1. 何が成功したかを PLAN に1〜2文でまとめる
2. コミットが未完なら COMMANDS に git-safe-commit コマンドを書く（自動実行しない）:

```powershell
cd C:\hirayama-ai-workspace\workspace
scripts\git-safe-commit.ps1 -Message "feat: ..." -Files @("path\to\file.py") -Push
```

3. ブランチが `master` または `main` の場合: docs 変更以外は **STOP** して feature/* への切り替えを求める
4. NEXT に PROJECT_STATUS.md 更新テンプレを出力する

---

## STOP 条件（即停止・人間に確認事項を列挙する）

**絶対 STOP:**

| 条件 | 例 |
|---|---|
| 認証情報の読み書き・コミット | `.env` `token.json` `service_account.json` |
| 外部 API 本番 POST | freee / Gmail / Slack / LINE |
| 課金 API 呼び出し | Claude API / OpenAI / 有料 SaaS |
| 削除・DROP 操作 | ファイル削除 / DB レコード削除 / シート削除 |
| 本番環境への書き込み | 本番スプレッドシート / 本番 DB |
| 変更ファイル 20 以上 または diff が巨大 | 分割を提案する |
| `git reset --hard` / `git push --force` | 履歴破壊操作 |

**REPORT & STOP（自律判断不可）:**
- 仕様・要件が不明確でコードが書けない
- 同じエラーが3回繰り返す
- ROADMAP に記載のない新機能を実装しようとしている
- テストが失敗したまま進もうとしている

**STOP 時の出力:**

```
## STOP — [理由]
状況: （何をしようとしていたか）
問題: （なぜ止まったか）
確認事項:
1. （人間が判断すべき事項）
2. ...
再開手順: 確認後に「実施してください」と明示してください。
```

---

## 出力フォーマット（5 セクション・省略禁止）

### FAILED パス

```
## PLAN
判定: FAILED
根本原因: [AI REPORT のN行目 "エラー文字列" を根拠に]
修正方針: [1文で]
変更対象: path\to\file.py（約+N / -N 行）

## CHANGES
- path\to\file.py : [具体的な変更内容]（根拠: AI REPORT "...")

## COMMANDS
cd C:\hirayama-ai-workspace\workspace
scripts\auto-dev.ps1 -Cmd "..." -Note "fix: ..." -Tag test

（このコマンドを実行してコンソール出力を次のメッセージに貼ってください）

## NOTES
- [bug] 根本原因: ...
- [decision] この修正を選んだ理由: ...

## NEXT
- 上の COMMANDS を実行して exit 0 を確認する
- 成功後: scripts\git-safe-commit.ps1 -Message "fix: ..." -Files @("...") -Push
- 成功後: PROJECT_STATUS.md と ROADMAP.md を更新する
```

### SUCCESS パス

```
## PLAN
判定: SUCCESS
完了内容: [何が成功したか 1〜2文]
ROADMAP タスク: [タスクID] [タスク名]

## CHANGES
- path\to\file.py : [変更内容]（+N / -N 行）
（変更なし / docs のみの場合はその旨記載）

## COMMANDS
（前サイクル実行済み — 確認用）
scripts\auto-dev.ps1 -Cmd "..." -Note "..." -> exit 0

（次に実行するコミットコマンド — 確認後に手動実行）
cd C:\hirayama-ai-workspace\workspace
scripts\git-safe-commit.ps1 -Message "feat: ..." -Files @("path\to\file.py") -Push

## NOTES
- [done] ...
- [decision] ...（重要な判断があれば）

## NEXT
- ROADMAP: [現タスクID] 完了 → [次タスクID] [次タスク名] へ
- PROJECT_STATUS.md 更新テンプレ:
  最後の実行: scripts\auto-dev.ps1 -Cmd "..."
  終了コード: 0 (SUCCESS)
  コミット  : <git rev-parse --short HEAD 後に記入>
  次のNEXT  : [次タスク名]
- ROADMAP.md の [タスクID] を ✅ に更新する
- 次サイクル: この auto-dev-phase3-loop.md を再度貼って続行
```

---以下にコンソール出力か AI REPORT の内容を貼ってください:

---ここまで---
