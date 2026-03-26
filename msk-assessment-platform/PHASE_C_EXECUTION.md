# PHASE_C_EXECUTION.md — JASSESS-01 Phase C 実行主経路

最終更新: 2026-03-26

---

## 目的

Phase C の日常運用を、`clasp run` で止まりにくい構成から切り離し、毎回同じ順番で進められる主経路に固定する。

---

## 主経路

### 1. ローカル修正

- 正本:
  - `msk-assessment-platform/gas/setup_neck_shoulder.js`
  - `msk-assessment-platform/gas/logic_engine_neck_shoulder.js`
- コメント定義の正本は `setup_neck_shoulder.js`

### 2. 構文チェック

```powershell
node --check msk-assessment-platform/gas/setup_neck_shoulder.js
node --check msk-assessment-platform/gas/logic_engine_neck_shoulder.js
node --check scripts/sync-jassess-ns-comment-master.mjs
node --check scripts/ns-live-smoke-test.mjs
```

### 3. Apps Script へ反映

`clasp` は `msk-assessment-platform/gas` を作業ディレクトリに固定して実行する。

```powershell
Set-Location C:\hirayama-ai-workspace\workspace\msk-assessment-platform\gas
C:\Users\pinsh\AppData\Roaming\npm\clasp.cmd push -f
```

### 4. live comment master 同期

```powershell
Set-Location C:\hirayama-ai-workspace\workspace
node scripts/sync-jassess-ns-comment-master.mjs --json true
```

### 5. Sheets API live read/write smoke test

```powershell
Set-Location C:\hirayama-ai-workspace\workspace
node scripts/ns-live-smoke-test.mjs --json true
```

この smoke test は 5 パターンすべてについて以下を確認する。

- live シートへ書き込める
- 書いた値を read back できる
- 元の値へ復元できる
- `nsOnEdit` が発火したかどうかを結果に残せる

---

## 補助経路

以下は補助経路として残すが、Phase C の主経路には含めない。

- `clasp run syncNsCommentMasterSheet`
- `clasp run nsRunFivePatternSmokeTests`
- Apps Script エディタからの関数実行
- 人手による live シート編集

---

## `clasp push` 安定運用ルール

### 作業ディレクトリ

- 正しい作業ディレクトリは `msk-assessment-platform/gas`
- `msk-assessment-platform/` 直下や workspace 直下から `clasp push` しない

### `.clasp.json`

- ローカル実体は `msk-assessment-platform/gas/.clasp.json`
- git には含めず、雛形として `msk-assessment-platform/gas/.clasp.json.example` を置く
- `rootDir` は `.` に固定する
  - 理由: `appsscript.json` と GAS ソース一式が `gas/` にまとまっているため

### manifest

- manifest 正本は `msk-assessment-platform/gas/appsscript.json`
- `executionApi` をここで管理する
- `clasp push` は `gas/` 直下の manifest を読む前提で運用する

### `Skipping push.` の見方

- まず確認すること:
  - `gas/.clasp.json` があるか
  - カレントディレクトリが `msk-assessment-platform/gas` か
  - `gas/appsscript.json` が存在するか
- 上記がずれていると、期待した JASSESS-01 GAS を見ずに push 判定される
- 上記が正しい状態で `Skipping push.` なら、remote と local に実質差分がない可能性が高い

---

## 既知の停止要因

1. `clasp` を `gas/` 以外で実行すると、`.clasp.json` / manifest の認識がずれて push 判定が不安定になる
2. `C:\Users\pinsh\AppData\Roaming\npm\clasp.cmd` が PATH に乗っていないため、絶対パスで呼ぶほうが安定する
3. `clasp run` は permission error で止まりやすく、主経路に向かない
4. service account / Sheets API の書込では `nsOnEdit` が発火しない
5. そのため 5 パターン live smoke test は「read/write/restore と blocker 記録」までは主経路で安定実行できるが、最終コメント自動生成の完全再現は補助経路が必要

---

## 今後の運用ルール

1. Phase C の反映確認は `clasp run` ではなく `clasp push -f` を主軸にする
2. live `頚肩こり_コメントマスタ` 同期は `scripts/sync-jassess-ns-comment-master.mjs` を標準手順にする
3. 5 パターン smoke test は `scripts/ns-live-smoke-test.mjs` を標準手順にし、`triggerObserved=false` は blocker として記録する
4. `nsOnEdit` 実発火が必要な確認だけ、Apps Script エディタ実行か人手編集へ切り替える
5. 既存腰痛ロジックには触れず、頚肩こり側の追加ファイルと運用文書だけで進める

---

## 2026-03-26 実測結果

- `msk-assessment-platform/` 直下の `clasp status` は `Project settings not found.`
- `msk-assessment-platform/gas` 直下の `clasp status` は tracked files を正常認識
- `msk-assessment-platform/gas` 直下の `clasp push -f` は 6 files push 成功
- `node scripts/sync-jassess-ns-comment-master.mjs --json true`
  - `synced=true`
  - live row count `48 -> 48`
- `node scripts/ns-live-smoke-test.mjs --json true`
  - `mainRouteStable=true`
  - 5 / 5 で `inputsApplied=true`
  - 5 / 5 で `restored=true`
  - `triggerObservedCount=0`
  - `blockedByOnEditCount=5`
