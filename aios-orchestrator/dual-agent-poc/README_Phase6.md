# README_Phase6 — Artifact 自動パース・保存

実施日: 2026-04-15
ステータス: **CLOSED**

---

## 目的

Executor の Markdown 出力に埋もれているコードブロックを自動抽出し、
`artifacts` テーブルへ分離保存する。
後から成果物だけを参照・比較・再利用できるようにする。

---

## 抽出対象

Markdown のフェンスコードブロック（``` ``` ```）のみを対象とする。

インデントコードブロック（4スペース / タブ）は対象外。
誤検知が多く、構造解析が複雑なため今回は見送り。

---

## 言語 → artifact_type マッピング

| 言語タグ | artifact_type |
|---|---|
| python / py / javascript / js / typescript / ts / rust / go / java / c / cpp / sql 等 | code |
| bash / sh / shell / zsh / powershell | shell |
| json | json |
| yaml / yml / toml / ini / xml / html / css / dockerfile | file |
| markdown / md | markdown |
| 未指定 / 未登録 | code |

---

## 保存項目（artifacts テーブル）

| 列 | 内容 | Phase 6 追加 |
|---|---|---|
| artifact_id | UUID4 | 既存 |
| message_id | 親メッセージ ID | 既存 |
| artifact_type | code / shell / json / file / markdown | 既存 |
| language | コードブロックの言語タグ | **新規（Phase 6）** |
| filename | 推定ファイル名（.py / .sh / .json 等） | 既存 |
| content | コードブロック本文 | 既存 |
| created_at | ISO8601 | 既存 |

### スキーママイグレーション

`init_db()` で `artifacts.language` 列が欠けていれば自動で `ALTER TABLE` を実行する（冪等）。
既存 DB でも再作成不要。

---

## アーキテクチャ

```
run_single_turn()
    ↓ Executor 応答保存（executor_msg_id を取得）
    ↓
_save_artifacts_safely(db, conv_id, executor_msg_id, executor_content, turn_id)
    ├── get_artifacts(message_id)  ← 冪等チェック
    ├── parse_artifacts(content)  ← コードブロック抽出
    ├── _store_artifact() × N     ← 件数分保存
    └── log_artifact_saved × N    ← run_log に記録
```

---

## 冪等方針

| ケース | 動作 |
|---|---|
| 同一 message_id に既に artifact が存在する | スキップ / `artifact_skipped` を run_log に記録 |
| 別ターンで同内容のコードブロックが出た | それぞれ保存（message_id が異なるため別行） |
| 同一メッセージ内の同一内容の重複ブロック | parse_artifacts() 内でフィルタして 1 件に絞る |

---

## 失敗時挙動

| 失敗パターン | 動作 |
|---|---|
| `parse_artifacts()` が例外 | `_save_artifacts_safely()` が吸収 / `artifact_save_failed` を記録 |
| `_store_artifact()` が DB エラー | 同上 |
| `_save_artifacts_safely()` 自体の例外 | try/except で吸収 / orchestrator 継続 |

**artifact 保存失敗で orchestrator 本体は一切止まらない。**

---

## run_log イベント（Phase 6 追加）

| event_type | 記録タイミング |
|---|---|
| `artifact_saved` | 1 件保存成功ごとに記録 |
| `artifact_skipped` | 冪等スキップ時に記録 |
| `artifact_save_failed` | 保存失敗時に記録 |

---

## 実施した変更ファイル

| ファイル | 変更内容 |
|---|---|
| `artifact_parser.py` | **新規**。フェンスコードブロック抽出・言語→type マッピング |
| `schema.sql` | `artifacts.language` 列追加（v4） |
| `store.py` | `append_artifact()` に `language` 追加 / `get_artifacts()` / `get_artifacts_by_conv()` 追加 / `init_db()` に language 列マイグレーション追加 |
| `run_logger.py` | `EVENT_ARTIFACT_SAVED` / `EVENT_ARTIFACT_FAILED` / `EVENT_ARTIFACT_SKIPPED` 定数 + ログ関数 3 つ追加 |
| `orchestrator.py` | `_save_artifacts_safely()` 追加 / `run_single_turn()` に呼び出しフック / `executor_msg_id` を受け取るよう修正 / artifact 関連 import 追加 |
| `test_phase6_artifacts.py` | **新規**。dry-run 検証スクリプト（7 テスト） |

---

## 検証結果

### dry-run テスト（test_phase6_artifacts.py）

| # | テスト | 結果 |
|---|---|---|
| 1 | parse_artifacts: 複数コードブロック抽出 | OK |
| 2 | 言語タグ→type マッピング（10パターン）・空ブロック除外・重複除外 | OK |
| 3 | DB 保存 / get_artifacts（1件・2件） | OK |
| 4 | orchestrator dry-run → artifact_save_failed 無し | OK |
| 5 | 冪等: 同一 message_id 2回呼び出し → artifact_skipped | OK |
| 6 | 失敗耐性: 例外吸収 → artifact_save_failed + 本体継続 | OK |
| 7 | get_artifacts_by_conv: 3件取得・turn_id 昇順 | OK |

### real API テスト

| 項目 | 内容 |
|---|---|
| goal | FizzBuzz を Python で実装 |
| モデル | gpt-4o (Planner) / claude-sonnet-4-5 (Executor) |
| 結果 | Turn 1 で artifact 2 件保存（python コード + 実行出力） |
| artifact 1 | lang=python / type=code / 195 字 / artifact.py |
| artifact 2 | lang=1 / type=code / 55 字（実行出力。false positive — 後述） |

---

## 既知の制限

| 項目 | 内容 |
|---|---|
| false positive：lang=数字 | Executor が実行出力を ` ```1 ` のように書いた場合（行番号をタグと誤認）。保存はされるが language タグが無意味。実害は小さい |
| インデントブロック非対応 | 4スペース / タブのコードブロックは抽出しない |
| ファイル名推定の精度 | 言語拡張子から推定するが、実際のファイル名とは異なる場合がある |
| 本文の long-run 重複 | 別ターンで同内容が繰り返し出た場合はそれぞれ保存される（意図的な設計）|

---

## 今後の拡張候補

| 候補 | 内容 |
|---|---|
| ファイル名の明示指定 | Executor が `// filename: foo.py` のようなコメントをつけた場合にパース |
| artifact 検索 API | `show artifacts --conv-id` コマンドで成果物一覧を CLI 表示 |
| artifact diff | 同一ファイル名の artifact を複数ターン間で diff 表示 |
| false positive フィルタ | lang が数字のみ / 1 文字の場合はスキップ |
