---
name: handoff
description: 作業終了時のコミット・プッシュ・完了報告を標準化する。de コマンドの Claude Code 版。認証情報チェック付き。
argument-hint: "[-ProjectId <id>] [-Message \"説明\"] [-NoPush] [-WIP]"
allowed-tools: Read, Bash
---

# handoff — セッション終了スキル

**用途:** 作業終了時のコミット・プッシュ・完了報告を標準化する。`de` コマンドの Claude Code 版。

---

## 実行手順

### Step 1: 変更確認
```bash
git status
git diff --stat
```
認証情報ファイル（.env / service_account.json / credentials.json / token.json）が含まれていないか確認する。含まれていれば即中断してユーザーに報告する。

### Step 2: コミット
```bash
git add <変更ファイル（個別指定）>
git commit -m "<自動生成メッセージ>"
```
コミットメッセージは `type(ProjectId): 内容` 形式。例: `feat(JASSESS-01): 腰痛評価モジュール共通基盤設計完了`

### Step 3: プッシュ（-NoPush 指定時はスキップ）
```bash
git push
```

### Step 4: 完了報告出力

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SESSION HANDOFF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STATUS:  完了 / 継続中 / 保留
BRANCH:  <ブランチ名>
COMMIT:  <コミットID>
PUSH:    実施済み / 未実施（理由: ）
SUMMARY: <変更要約>
NEXT:    <次の作業>
RISKS:   <未解決事項。なければ "(なし)">
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## オプション引数

| 引数 | 説明 |
|---|---|
| `-ProjectId <id>` | Projects シート同期対象の案件ID |
| `-Message "説明"` | コミットメッセージを手動指定 |
| `-NoPush` | push をスキップ（ローカル保持） |
| `-WIP` | WIP プレフィックスを付与して push |

---

## 使用例

```
/handoff -ProjectId JASSESS-01 -Message "Phase 0 完了: msk-assessment-platform 再設計"
/handoff -NoPush
/handoff -WIP
```
