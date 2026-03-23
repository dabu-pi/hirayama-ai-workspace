---
name: gas-report
description: Apps Script での動作確認結果を TESTCASES.md / PROJECT_STATUS.md へ標準フォーマットで記録する。GAS実機テスト後に使う。
argument-hint: "-ProjectId <id> -TestId <ids> -Result <PASS|FAIL> [-Notes \"備考\"]"
allowed-tools: Read, Edit, Bash
---

# gas-report — GAS実機確認レポート

**用途:** Apps Script での動作確認結果を TESTCASES.md / PROJECT_STATUS.md へ標準フォーマットで記録する。

---

## 実行手順

### Step 1: 現状読込
- 対象プロジェクトの `TESTCASES.md` を読む
- 指定テストIDの現在ステータス（未実施/PASS/FAIL）を確認する

### Step 2: 結果記録

TESTCASES.md の該当テストケース行を更新する:
```
| TC-XX | テスト内容 | PASS / FAIL | YYYY-MM-DD | <備考> |
```

### Step 3: PROJECT_STATUS.md 更新

「実施済みテスト」または「テスト記録」セクションに結果を追記する。

### Step 4: レポート出力

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
GAS 実機確認レポート
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PROJECT: <プロジェクトID>
DATE:    <実施日>

RESULTS:
  <TestId>: PASS / FAIL — <内容1行>
  ...

SUMMARY: <全体所見>
BLOCKED: <FAIL したテストの対応方針。なければ "(なし)">

COMMIT_MSG: <自動生成コミットメッセージ案>
  例: test(JREC-01): T1〜T6 PASS — 来院登録・区分判定・金額計算 実機確認完了
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## オプション引数

| 引数 | 説明 | 例 |
|---|---|---|
| `-ProjectId <id>` | 対象プロジェクトID | `-ProjectId JREC-01` |
| `-TestId <ids>` | テストID（カンマ区切り） | `-TestId T1,T2,T3` |
| `-Result PASS/FAIL` | 一括結果指定 | `-Result PASS` |
| `-Notes "備考"` | 補足メモ | `-Notes "長期患者の月上限確認"` |

---

## 使用例

```
/gas-report -ProjectId JREC-01 -TestId T1,T2,T3 -Result PASS
/gas-report -ProjectId JASSESS-01 -TestId T1 -Result FAIL -Notes "プルダウン未設定"
```
