# README_Phase7 — Artifacts CLI + false positive フィルタ

実施日: 2026-04-15
ステータス: **CLOSED**

---

## 目的

1. `show artifacts --conv-id <id>` 相当の CLI コマンドを追加し、会話単位で artifact 一覧を確認できるようにする。
2. Executor が実行出力を ` ```1 ... ``` ` のように書いた際に生じていた false positive（lang=数字のみ）を保存前にスキップする。

---

## false positive フィルタ

### 問題

FizzBuzz の実行出力など、Executor が出力を Markdown のフェンスコードブロックで囲む際に、
言語タグとして数字（例: `1`, `123`）を書くケースが確認された（Phase 6 既知の制限）。

```
```1
1
2
Fizz
```
```

これが `language="1"` として artifacts テーブルに保存されていた。

### 修正方針

`artifact_parser.py` に `_is_valid_lang(lang)` 関数を追加し、`parse_artifacts()` の抽出ループでフィルタする。

| 条件 | 判定 | 理由 |
|---|---|---|
| `lang = ""` | 有効 | 言語未指定（` ``` ` のみ）は通常のコードブロック |
| `lang` が数字のみ（`"1"`, `"123"`） | **無効** | 行番号の誤認 |
| `lang` にスペースまたはタブを含む | **無効** | 言語タグではなく説明文 |
| それ以外（`"c"`, `"r"`, `"go"`, `"python"` 等） | 有効 | 正常な言語タグ |

正当な 1 文字タグ（`c`, `r`）は数字でない限り有効として通過させる。

---

## artifacts CLI コマンド

### 使い方

```bash
# 会話の artifact 一覧
python orchestrator.py artifacts --conv-id <conversation_id>

# 特定 artifact の本文全文表示（artifact_id 前方一致）
python orchestrator.py artifacts --conv-id <conversation_id> --artifact-id <artifact_id_prefix>
```

### 出力例（一覧）

```
Artifacts: FizzBuzz を Python で実装
  conv_id : xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  count   : 2
──────────────────────────────────────────────────
  T01  abcd1234...  type=code  lang=python  file=artifact.py
       def fizzbuzz(n):\n    for i in range(1, n + 1):...
  T01  ef567890...  type=shell  lang=bash  file=setup.sh
       pip install -r requirements.txt
──────────────────────────────────────────────────
```

### 出力例（本文全文）

```
  artifact_id : abcd1234-xxxx-xxxx-xxxx-xxxxxxxxxxxx
  type        : code
  language    : python
  filename    : artifact.py
  turn_id     : 1

```python
def fizzbuzz(n):
    for i in range(1, n + 1):
        ...
```
```

---

## 実施した変更ファイル

| ファイル | 変更内容 |
|---|---|
| `artifact_parser.py` | `_INVALID_LANG_RE` / `_is_valid_lang()` 追加 + `parse_artifacts()` ループに filter 組み込み |
| `orchestrator.py` | `get_artifacts_by_conv` import 追加 / `command_artifacts()` 追加 / `_build_parser()` に `artifacts` subcommand 追加 / dispatch dict に `"artifacts"` 追加 |
| `test_phase7_artifacts_cli.py` | **新規**。7 テスト（false positive フィルタ × 4 + CLI × 3） |
| `README_Phase7.md` | **新規**（このファイル） |

---

## 検証結果

### test_phase7_artifacts_cli.py（7 テスト全 OK）

| # | テスト | 結果 |
|---|---|---|
| 1 | lang=数字のみ（"1", "123"）→ スキップ | OK |
| 2 | lang=スペース含む → _is_valid_lang() 判定 | OK |
| 3 | 1文字タグ（"c", "r"）+ 空文字 → 有効として通過 | OK |
| 4 | 有効タグ + lang=1 混在 → 有効分 2 件のみ抽出 | OK |
| 5 | command_artifacts 一覧表示（2件・0件） | OK |
| 6 | command_artifacts --artifact-id 本文全文表示 | OK |
| 7 | 存在しない conv_id → exit code 1 | OK |

### test_phase6_artifacts.py（既存 7 テスト）

Phase 7 の変更による Phase 6 テストの regression なし（全 OK）。

---

## 設計備考

### false positive: スペース含む lang タグについて

フェンス正規表現 `[\w+\-\.]*` はスペースを含むタグにマッチしないため、
実際にスペース付きタグが `parse_artifacts()` に到達することはほぼない。
ただし `_is_valid_lang()` に防衛的チェックを入れることで、正規表現変更時の safety net とした。

### artifact_id 前方一致

`--artifact-id` には UUID の先頭 8 文字など短い prefix を渡せる。
`next((a for a in arts if a["artifact_id"].startswith(art_id)), None)` で照合。

---

## 既知の残課題

| 項目 | 内容 |
|---|---|
| インデントブロック非対応 | 引き続き 4スペース / タブのコードブロックは抽出しない |
| ファイル名推定の精度 | 実際のファイル名とは異なる場合がある |
| false positive: lang=1文字数字 | `"0"` 等は数字のみルールでスキップ済み |
