# README_Phase11_E2E — artifact-export 実データ E2E 確認

実施日: 2026-04-16
ステータス: **CLOSED（全項目 PASS）**

---

## 概要

Phase 11 で実装した `artifact-export` CLI を real API（OpenAI + Anthropic）で生成した実データに対して検証した記録。

---

## 実行コマンド

### 会話開始

```
python orchestrator.py start --goal "Pythonで九九表をMarkdown形式で生成するコードを書いてください"
```

### 会話実行

```
python orchestrator.py run --conv-id 83ad36e0-2a6a-4a3f-8874-a0dcdce34af6 --max-turns 5
```

### artifact 一覧確認

```
python orchestrator.py artifacts --conv-id 83ad36e0-2a6a-4a3f-8874-a0dcdce34af6
```

### conv_id 単位 export（実実行）

```
python orchestrator.py artifact-export \
  --conv-id 83ad36e0-2a6a-4a3f-8874-a0dcdce34af6 \
  --output ./data/export_phase11_e2e/
```

### --artifact-id 単体 export

```
python orchestrator.py artifact-export \
  --conv-id 83ad36e0-2a6a-4a3f-8874-a0dcdce34af6 \
  --artifact-id 4853da45 \
  --output ./data/export_phase11_single/
```

---

## 使用した conv_id

`83ad36e0-2a6a-4a3f-8874-a0dcdce34af6`

---

## 会話の経過

| ターン | 内容 | artifact 保存 |
|---|---|---|
| Turn 1 | Planner → 「九九表を生成する関数を実装してください」/ Executor → 実装 + Markdown 出力 | 2 件 |
| Turn 2 | Planner → 「テストしてください」/ Executor → テストコード + 実行結果 | 2 件 |
| Turn 3 | Planner → TASK_COMPLETE（全テスト合格確認） | 0 件 |

---

## export 件数

4 件（スキップ: 0 件、エラー: 0 件）

---

## 出力ファイル一覧と filename_source

| ファイル名 | ターン | filename_source | 決定理由 |
|---|---|---|---|
| `artifact.py` | T01 | inferred [I] | lang=python → 拡張子 .py、名前は artifact_parser の推定 |
| `artifact_t01_01.py` | T01 | default [D] | lang=''、filename=None (source='none') → safe-default |
| `artifact_2.py` | T02 | inferred [I] | inferred 'artifact.py' だが T01 と同名 → 衝突回避 _2 付与 |
| `artifact_t02_03.py` | T02 | default [D] | lang=''、filename=None (source='none') → safe-default |

---

## 各ファイルの内容目視確認

### artifact.py（T01 inferred）

```python
def generate_multiplication_table():
    """九九表をMarkdown形式で生成する関数"""
    header = "|   |" + "|".join([f" {i} " for i in range(1, 10)]) + "|"
    separator = "|" + "|".join(["---" for _ in range(10)]) + "|"
    ...
```

- 完全な Python コード。内容壊れなし。

### artifact_t01_01.py（T01 safe-default）

Markdown テーブルの出力結果（実際は Markdown テキストだが lang='' のため .py 拡張子が付いた）。

```
|   | 1 | 2 | 3 | ... | 9 |
|---|---|---|---|-----|---|
| 1 |  1 |  2 | ...     9 |
...
```

- 内容壊れなし。ただし拡張子 .py は内容（Markdown）と不一致（後述の改善余地）。

### artifact_2.py（T02 inferred + 衝突回避）

```python
import unittest
class TestMultiplicationTable(unittest.TestCase):
    """九九表生成関数のテストクラス"""
    ...
```

- 完全な Python テストコード。内容壊れなし。衝突回避が正常動作。

### artifact_t02_03.py（T02 safe-default）

```
test_all_calculations (__main__.TestMultiplicationTable) ... ok
test_header_row (__main__.TestMultiplicationTable) ... ok
...
```

- テスト実行結果テキスト。内容壊れなし。

---

## --artifact-id 単体 export 確認

prefix `4853da45` 指定で T01 の `artifact.py` 1 件のみ書き出し成功。
他の 3 件は出力ディレクトリに存在しない。

---

## 期待通りだった点

| 検証項目 | 結果 |
|---|---|
| 4 件全 artifact が書き出された | OK |
| inferred filename が正しく使われた | OK（artifact.py） |
| source=none → safe-default が使われた | OK（artifact_t01_01.py, artifact_t02_03.py） |
| 同名衝突（T01/T02 ともに artifact.py）→ _2 で回避 | OK（artifact_2.py） |
| ファイル内容が壊れていない | OK（全 4 件確認） |
| --artifact-id 単体 export が 1 件のみ出力 | OK |
| エラーゼロ | OK |

---

## 改善余地（バグではない）

| 項目 | 内容 | 対応 |
|---|---|---|
| lang='' の artifact に .py 拡張子が付く | artifact_type='code' かつ lang='' の場合、_TYPE_TO_EXT['code'] = '.py' が採用される。Markdown テーブルが artifact_t01_01.py に書き出されたケース | 実用上は問題なし（内容は正確）。今後 lang を正確に推定すれば解消 |
| explicit filename が今回は 0 件 | Executor が `# filename:` 記法を使わなかったため。real API での explicit filename 採用は Phase 10 のテスト通り動作済み | Executor の system prompt に記法を促す記述を追加すれば改善可能 |

---

## 問題の有無

問題なし。全ロジックが想定通りに動作した。

---

## 実装修正

なし（不具合ゼロのためコード変更不要）
