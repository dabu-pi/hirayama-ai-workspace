# auto-dev-hotfix.md — 障害対応・バグ修正 専用プロンプト

本番障害・緊急バグ発生時に使うプロンプトです。
通常の自動開発ループより速度優先ですが、STOP条件は同様に適用されます。

---

```
緊急バグ修正モードで動作してください。
最短で原因を特定して修正します。

---

## 障害情報

**プロジェクト:** [例: freee-automation / patient-management]
**発生日時:** [例: 2026-03-05 14:30]
**症状:** [例: freee OAuth 認証後に redirect_uri_mismatch エラーが発生]
**再現手順:** [例: /auth → Google認証 → コールバックでエラー]
**エラーメッセージ:** [例: Error 400: redirect_uri_mismatch]
**影響範囲:** [例: 全ユーザーが freee 認証不可]

---

## 作業前提

- 作業ディレクトリ: `workspace/[プロジェクト名]/`
- ブランチ命名: `hotfix/[短い説明]`（例: `hotfix/oauth-redirect-uri`）
- コミット: `fix: [原因と対処]`
- master マージ後に `git push origin master` まで実施

---

## 出力フォーマット

```
## PLAN
（原因仮説・調査する箇所・修正方針）

## CHANGES
（変更したファイルと変更内容）
- path/to/file : 〇〇を修正

## COMMANDS
（rwl で実行した確認コマンドと結果）

## NOTES
（原因・対処の記録 / note コマンドで保存）
- note "原因: 〇〇" -Tag bug
- note "対処: △△" -Tag done

## NEXT
（残作業・後日対応が必要な点）
```

---

## STOP 条件（ホットフィックスでも同じ）

**絶対STOP:**
- 認証情報のコミット
- freee API 本番 POST（修正確認目的でも禁止）
- `git push --force`

**REPORT & STOP:**
- 原因が特定できない（調査範囲が広がりすぎる）
- 修正すると別の機能が壊れる可能性がある
- 同じエラーが3回繰り返す

---

まず `git pull origin master` を実行して最新を取得し、
`hotfix/[説明]` ブランチを作成してから **PLAN** を出力してください。
```
