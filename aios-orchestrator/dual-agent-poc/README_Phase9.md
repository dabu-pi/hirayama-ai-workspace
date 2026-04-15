# README_Phase9 — Artifact Diff（ターン間差分表示）

実施日: 2026-04-15
ステータス: **CLOSED**

---

## 目的

同一会話内で artifact がターンをまたいでどう変化したかを CLI から確認できるようにする。
「どこが改善されたか」を再利用前に素早く把握するためのコマンドとして実装。

---

## 比較単位と自動選択ルール

### グルーピングキー

| 優先度 | 条件 | キー |
|---|---|---|
| 第一 | `filename` が空でない | `filename`（例: `artifact.py`） |
| 補助 | `filename` が None / 空 | `lang=<language>\|type=<artifact_type>` |

- 同一キーを持つ artifact を「同一系統」として扱う
- 系統内は `turn_id` 昇順にソートし、隣接ペアを順番に diff する

### 比較対象の選定ルール

| ケース | 動作 |
|---|---|
| 系統内が 2 件以上 | 隣接ターン間をすべて diff する |
| 系統内が 1 件のみ | diff 対象なしとして表示（エラーにならない） |
| `--artifact-id` 指定 | 指定 artifact と系統内の直前 artifact を diff。直前がない（先頭）場合は直後を試みる |
| `--left --right` 指定 | 指定した 2 artifact を明示的に diff（系統・ファイル名の一致は不要） |

---

## CLI 使い方

### デフォルト: 全系統の連続 diff

```bash
python orchestrator.py artifact-diff --conv-id <conversation_id>
```

出力例:
```
Artifact Diff: Python の requests サンプル...
  conv_id : 4fba3263-...
  diff 対象系統: 3
──────────────────────────────────────────────
  系統: artifact.py  (2 バージョン / 1 diff)

    T01  ca42d8e9...  →  T02  cdfec557...
    +20 行追加 / -9 行削除

  --- artifact.py  (T01  ca42d8e9...)
  +++ artifact.py  (T02  cdfec557...)
  @@ -1,25 +1,37 @@
   import requests
  +import yaml
  -def get_request(url: str, params: dict = None) -> None:
  +def fetch_data(url: str, params: dict = None, timeout: int = 10) -> None:
  ...
```

### --artifact-id 起点: 直前バージョンとの diff

```bash
python orchestrator.py artifact-diff --conv-id <id> --artifact-id <prefix>
```

- 指定 artifact の系統内で直前のバージョンと比較
- 直前がない（先頭）場合は直後と比較してフォールバック

### --left --right: 明示比較

```bash
python orchestrator.py artifact-diff --conv-id <id> --left <prefix> --right <prefix>
```

- 系統・ファイル名・言語に関係なく 2 つの artifact を直接比較

### --context: 前後行数調整

```bash
python orchestrator.py artifact-diff --conv-id <id> --context 3
```

- デフォルト 5 行。小さくすると出力が短くなる

---

## 実測結果（Phase 8 real API データ）

| 項目 | 値 |
|---|---|
| 対象 conv_id | 4fba3263-ba51-40f8-86e4-cf713d6a75de |
| diff 対象系統数 | 3（artifact.py / artifact_1.sh / artifact_2.yaml） |
| artifact.py: T01→T02 | +20 行追加 / -9 行削除 |
| artifact_1.sh: T01→T02 | +1 行追加 / -1 行削除（pyyaml 追加） |
| artifact_2.yaml: T01→T02 | 差分なし（同内容） |

### artifact.py T01→T02 の主な変更

- `import yaml` 追加
- `get_request()` → `fetch_data()` にリネーム
- `load_config()` 関数が新規追加（YAML 設定読み込み）
- `response.raise_for_status()` 追加
- タイムアウトが定数から引数に変更

---

## 実施した変更ファイル

| ファイル | 変更内容 |
|---|---|
| `artifact_diff.py` | **新規**。グルーピング・diff 計算・前後検索ロジック |
| `orchestrator.py` | `artifact_diff` import 追加 / `command_artifact_diff()` + `_print_single_diff()` 追加 / `_build_parser()` に `artifact-diff` subcommand 追加 / dispatch dict に追加 |
| `test_phase9_artifact_diff.py` | **新規**。9 テスト（グループ化・diff計算・CLI全モード・失敗ケース・real API） |
| `README_Phase9.md` | **新規**（このファイル） |
| `README_E2E.md` | Phase 9 行を追記 |

---

## 検証結果

| # | テスト | 結果 |
|---|---|---|
| 1 | group_artifacts: filename / lang\|type キー / turn_id ソート | OK |
| 2 | compute_diff: 追加・削除・変更行の確認 | OK |
| 3 | compute_diff: 差分なし → 空文字 | OK |
| 4 | diff_stat: 追加 2 / 削除 1 行カウント | OK |
| 5 | command_artifact_diff デフォルト（全系統） | OK |
| 6 | --artifact-id 起点 / 先頭フォールバック | OK |
| 7 | --left --right 明示比較 / 片方のみエラー | OK |
| 8 | 失敗ケース: 0件 / 1件 / 差分なし / 存在しない id | OK |
| 9 | Phase 8 real API データで artifact.py T01→T02 diff確認 (+20/-9) | OK |

Phase 6 / Phase 7 既存テストの regression なし。

---

## 既知の制限

| 項目 | 内容 |
|---|---|
| filename 推定精度 | `artifact.py` / `artifact_1.sh` 等の自動推定。実ファイル名と一致しない場合あり |
| 同一 turn 内の複数 artifact | turn_id が同じ場合は created_at でソート（通常は発生しない） |
| ANSI カラーなし | 現状は色なしテキスト diff。ターミナルの色付けは未対応 |
| export 未実装 | diff 結果をファイルに書き出す機能は未実装（拡張候補） |
| 3件以上の系統 | 連続ペアをすべて表示するため出力が長くなる場合がある |

---

## 今後の拡張候補

| 候補 | 内容 |
|---|---|
| artifact export | `--export ./output/` でファイルとして書き出し |
| ANSI カラー diff | `+` 行を緑、`-` 行を赤で表示 |
| ファイル名明示指定 | Executor が `// filename: foo.py` コメントをつけた場合にパース |
| side-by-side diff | 左右並列表示モード |
