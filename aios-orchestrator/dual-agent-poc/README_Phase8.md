# README_Phase8 — Artifact 保存 E2E 実測検証（real API）

実施日: 2026-04-15
ステータス: **CLOSED**

---

## 目的

Phase 6（artifact 自動保存）・Phase 7（CLI + false positive 修正）を real API で
end-to-end 確認し、実運用での成立を実測で固める。

---

## 実行シナリオ

| 項目 | 内容 |
|---|---|
| goal | Python の requests ライブラリを使った GET リクエストのサンプルコードと、Bash 実行例、設定 YAML を書いてください |
| Planner モデル | gpt-4o |
| Executor モデル | claude-sonnet-4-6（または claude-sonnet-4-5） |
| max_turns | 3 |
| dry_run | False（実 API） |
| DB | data/test_phase8.db |

---

## 実行結果

### run_loop 結果

| 項目 | 値 |
|---|---|
| conversation_id | 4fba3263-ba51-40f8-86e4-cf713d6a75de |
| run_result | completed（Turn 3 で Planner が TASK_COMPLETE 発行） |
| 総コスト概算 | ～$0.034 |

### ターン別ログ

| Turn | Planner | Executor | artifact 保存 |
|---|---|---|---|
| T01 | requests GET サンプル作成を指示 | python / bash / yaml の 3 ブロックを出力 | 3 件 |
| T02 | 前回コードの改善版を指示 | 改善版 python / bash / yaml を出力 | 3 件（別 message_id） |
| T03 | TASK_COMPLETE | — | — |

---

## artifact 保存確認

### 保存件数・属性

| # | turn_id | artifact_id（先頭 8 桁） | artifact_type | language | filename |
|---|---|---|---|---|---|
| 1 | T01 | ca42d8e9 | code | python | artifact.py |
| 2 | T01 | 4eafa584 | shell | bash | artifact_1.sh |
| 3 | T01 | bd25898c | file | yaml | artifact_2.yaml |
| 4 | T02 | cdfec557 | code | python | artifact.py |
| 5 | T02 | 0efd6039 | shell | bash | artifact_1.sh |
| 6 | T02 | 4afa2d13 | file | yaml | artifact_2.yaml |

- 総 artifact 件数: **6 件**
- 検出 language タグ: `python`, `bash`, `yaml`
- message_id / conv_id との紐付け: **正常**

### false positive 確認

- 数字のみ language タグの artifact: **0 件**（Phase 7 フィルタ有効）

---

## CLI 一覧表示（artifacts --conv-id）

```
Artifacts: Python の requests ライブラリを使った GET リクエストのサンプルコードと...
  conv_id : 4fba3263-ba51-40f8-86e4-cf713d6a75de
  count   : 6
──────────────────────────────────────────────────────────────────────
  T01  ca42d8e9...  type=code  lang=python  file=artifact.py
       import requests\n\ndef get_request(url: str, params: dict = None) -> None:...
  T01  4eafa584...  type=shell  lang=bash  file=artifact_1.sh
       # 依存ライブラリのインストール\npip install requests\n\n# スクリプトの実行...
  T01  bd25898c...  type=file  lang=yaml  file=artifact_2.yaml
       api:\n  endpoint: "https://jsonplaceholder.typicode.com/posts/1"...
  T02  cdfec557...  type=code  lang=python  file=artifact.py
       import requests\nimport yaml\n\ndef load_config(config_path: str = "config.yaml")...
  T02  0efd6039...  type=shell  lang=bash  file=artifact_1.sh
       # 依存ライブラリのインストール\npip install requests pyyaml...
  T02  4afa2d13...  type=file  lang=yaml  file=artifact_2.yaml
       api:\n  endpoint: "https://jsonplaceholder.typicode.com/posts/1"...
──────────────────────────────────────────────────────────────────────
```

**終了コード: 0**

---

## CLI 本文取得（--artifact-id ca42d8e9）

```
  artifact_id : ca42d8e9-d43c-40c7-b70b-50d06930c9b8
  type        : code
  language    : python
  filename    : artifact.py
  turn_id     : 1

```python
import requests

def get_request(url: str, params: dict = None) -> None:
    """
    指定した URL に GET リクエストを送信し、
    ステータスコードとレスポンス本文を出力する。
    """
    try:
        response = requests.get(url, params=params, timeout=10)
        print(f"ステータスコード: {response.status_code}")
        print(f"レスポンス本文:\n{response.text}")
    except requests.exceptions.Timeout:
        print("エラー: リクエストがタイムアウトしました。")
    except requests.exceptions.ConnectionError:
        print("エラー: 接続に失敗しました。")
    except requests.exceptions.RequestException as e:
        print(f"エラー: {e}")

if __name__ == "__main__":
    endpoint = "https://jsonplaceholder.typicode.com/posts/1"
    query_params = {"userId": 1}
    get_request(endpoint, params=query_params)
```

**終了コード: 0 / フェンスブロック表示: OK**

---

## 失敗時挙動確認

| ケース | 動作 | 終了コード |
|---|---|---|
| artifact 0 件の会話に `artifacts --conv-id` | "artifact なし" メッセージ表示 | 0 |
| 存在しない `--artifact-id 00000000` | "[ERROR] artifact_id が見つかりません" 表示 | 1 |

---

## 検証結果まとめ

| 検証項目 | 結果 |
|---|---|
| real API 実行 → artifact 自動保存 | **OK**（6 件保存） |
| artifact_type / language の正確性 | **OK**（code/shell/file × python/bash/yaml） |
| CLI 一覧表示（artifacts --conv-id） | **OK**（全 6 件・プレビュー付き） |
| CLI 本文取得（--artifact-id prefix） | **OK**（フェンスブロック全文表示） |
| false positive（lang=数字のみ）フィルタ | **OK**（0 件、Phase 7 修正有効） |
| 0 件会話の安全表示 | **OK**（終了コード 0・メッセージあり） |
| 存在しない artifact-id のエラー表示 | **OK**（終了コード 1・明示メッセージ） |

---

## 実施した変更ファイル

| ファイル | 変更内容 |
|---|---|
| `test_phase8_real_api.py` | **新規**。6 ステップ E2E 検証スクリプト |
| `README_Phase8.md` | **新規**（このファイル） |
| `README_E2E.md` | Phase 8 行を追記 |

---

## 既知の制限

| 項目 | 内容 |
|---|---|
| 同一ターンの重複 artifact | ターンをまたいで同内容のコードが繰り返されると別行に保存（意図的設計）|
| ファイル名の精度 | `artifact.py` / `artifact_1.sh` 等の自動推定。実ファイル名と異なる場合あり |
| インデントブロック非対応 | 4スペース / タブのコードブロックは引き続き抽出しない |
| artifact diff 未実装 | 同一ファイル名で複数ターン保存されたコードの差分表示は未実装（拡張候補）|

---

## 今後の拡張候補

| 候補 | 内容 |
|---|---|
| artifact diff | 同一ファイル名の artifact を複数ターン間で `diff` 表示 |
| ファイル名明示指定 | Executor が `// filename: foo.py` コメントをつけた場合にパース |
| artifact export | `artifacts --conv-id <id> --export ./output/` でファイルとして書き出し |
