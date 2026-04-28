# README_Phase12 — Executor Prompt filename記法追加 + explicit E2E確認

実施日: 2026-04-16
ステータス: **CLOSED（explicit filename E2E 確認 PASS）**

---

## 目的

Executor system prompt に `# filename: <name>` 記法の案内を追加し、
real API E2E で `filename_source='explicit'` が実際に保存・export 採用されることを確認する。

---

## 変更箇所

`orchestrator.py` の `build_executor_system_prompt()` に `【ファイル名の明示（Phase 12）】` セクションを追加。

### 追加した文言

```
【ファイル名の明示（Phase 12）】
コードブロックを出力するときは、ブロック直前の行にファイル名を書くこと。
言語に応じて以下の記法を使い分ける（どれか 1 つでよい）。
  # filename: main.py          （Python / bash）
  // filename: index.js        （JavaScript / TypeScript / Java）
  -- filename: schema.sql      （SQL）
  filename: config.yaml        （YAML / その他）
複数ファイルを出力する場合は、各ブロックの直前にそれぞれ書くこと。
```

### 変更方針

- 既存の `【ルール】` `【PoC 期間中の制約】` `【実行不能時】` は無変更
- セクション名に `（Phase 12）` を付記してトレーサビリティを確保
- 記法は artifact_parser.py の認識パターンに合わせた（4 種類）

---

## 実行コマンド

### 会話開始

```
python orchestrator.py start \
  --goal "calculator.py（加減乗除の関数）と test_calculator.py（unittestのテストコード）の2ファイルをPythonで作成してください"
```

### 会話実行

```
python orchestrator.py run \
  --conv-id 8982d82f-e701-4311-b5a5-f7fb3d45dae7 \
  --max-turns 5
```

### conv_id 単位 export

```
python orchestrator.py artifact-export \
  --conv-id 8982d82f-e701-4311-b5a5-f7fb3d45dae7 \
  --output ./data/export_phase12_e2e/
```

---

## conv_id

`8982d82f-e701-4311-b5a5-f7fb3d45dae7`

---

## 会話の経過

| ターン | Planner 指示 | Executor 動作 | artifact 保存 |
|---|---|---|---|
| Turn 1 | 「calculator.py に加減乗除の関数を定義してください」 | `# filename: calculator.py` / `# filename: test_calculator.py` を使って 2 ファイル + 実行コマンドを出力 | 3 件（python[E], python[E], bash） |
| Turn 2 | 「shell で `python -m unittest` を実行してください」 | PoC 制約に従いモック実行、bash コマンド + テスト結果を出力 | 2 件（bash, code） |
| Turn 3 | TASK_COMPLETE | — | 0 件 |

---

## export 件数

5 件（成功: 5、スキップ: 0、エラー: 0）

---

## filename_source 内訳と出力ファイル名

| ファイル名 | ターン | source | 決定理由 |
|---|---|---|---|
| `calculator.py` | T01 | explicit [E] | `# filename: calculator.py` を Executor が明示 |
| `test_calculator.py` | T01 | explicit [E] | `# filename: test_calculator.py` を Executor が明示 |
| `artifact_2.sh` | T01 | inferred [I] | bash → artifact.sh だが artifact.sh は T02 が先 → _2 付与 |
| `artifact.sh` | T02 | inferred [I] | bash → artifact.sh |
| `artifact_t02_04.py` | T02 | default [D] | lang='.....'（記号のみ）→ safe-default |

> artifact.sh / artifact_2.sh の順序注記: T01 の bash が i=2（index=2）で `artifact_2.sh` になったのは、
> T02 の `artifact.sh` が export 処理の順に先行して used_names に登録されていないためではなく、
> T01 の bash (fa068d71) の filename が DB 上すでに `artifact_2.sh` として保存済みだったため（inferred 段階で _2 が付与されていた）。

---

## 確認結果

| 検証項目 | 結果 |
|---|---|
| explicit filename が 1 件以上保存された | OK（2 件: calculator.py, test_calculator.py） |
| export 時に [E] が出た | OK（2 件） |
| 実ファイル名が明示 filename を採用した | OK（calculator.py, test_calculator.py） |
| inferred / default との優先順位が崩れていない | OK（[E] > [I] > [D] 順序維持） |
| 同名衝突時の回避が壊れていない | OK（artifact.sh / artifact_2.sh が分離） |
| ファイル内容が壊れていない | OK（全 5 件確認） |

---

## 内容目視確認

### calculator.py（explicit）

```python
def add(a, b): return a + b
def subtract(a, b): return a - b
def multiply(a, b): return a * b
def divide(a, b):
    if b == 0: raise ZeroDivisionError("0で割ることはできません")
    return a / b
```

正常な Python コード。ファイル名が明示されたものと一致。

### test_calculator.py（explicit）

`from calculator import add, subtract, multiply, divide` を含む完全な unittest。内容壊れなし。

---

## 観察事項（バグではない）

| 観察 | 内容 |
|---|---|
| lang='.....' | T02 4381c862 のテスト結果テキストが lang='.....' として保存された。これは artifact_parser がコードブロックの言語行をそのまま取得した結果で、safe-default 経由で .py が付く（Phase 11 E2E と同じ挙動）。修正対象としない |
| bash artifact に filename が付かない | Executor がコマンドブロックには `# filename:` を付けなかった（bash の場合は記法として使いにくい）。許容範囲 |

---

## 改善余地（今回は修正しない）

- Planner system prompt に「複数ファイルを扱う際は各ファイルを個別の指示に分けること」を追加すると、Turn 1 に過負荷がかからない
- bash コマンドブロックへの filename 記法は現状 inferred になることが多い（許容）

---

## 新規ファイル・変更ファイル

| ファイル | 内容 |
|---|---|
| `orchestrator.py` | `build_executor_system_prompt()` に `【ファイル名の明示（Phase 12）】` 追加 |
| `README_Phase12.md` | 本ドキュメント（新規） |
