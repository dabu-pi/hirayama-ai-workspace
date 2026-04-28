# README_Phase5 — summary 長会話品質検証・改善

実施日: 2026-04-15  
ステータス: **CLOSED**

---

## 目的

Phase 2 で実装した `conversations.summary` 自動更新が、
10 ターン超の長会話でも重要情報を脱落させずに維持できるかを検証し、
問題があれば最小修正で改善する。

---

## 検証シナリオ

| 項目 | 内容 |
|---|---|
| ゴール | 「ECサイトのバックエンドAPIをFastAPIで実装する」 |
| ターン数 | 12 |
| モデル | gpt-4o-mini |
| 特徴 | 複数の技術採用決定 / waiting_approval 1回 / task_complete 1回 |

### 追跡した「忘れてはいけない事実」（7件）

| キー | キーワード | 登場ターン |
|---|---|---|
| python311 | Python 3.11 | Turn 1 |
| fastapi | FastAPI | Turn 1 |
| postgresql | PostgreSQL | Turn 2 |
| jwt | JWT | Turn 3 |
| docker | Docker | Turn 4 |
| redis | Redis | Turn 8 |
| structlog | structlog | Turn 10 |

### ターン別スクリプト概要

| ターン | イベント | 主な内容 |
|---|---|---|
| 1 | turn_end | Python 3.11 + FastAPI 採用 |
| 2 | turn_end | PostgreSQL + CRUD エンドポイント |
| 3 | turn_end | JWT 認証実装 |
| 4 | turn_end | Docker コンテナ化 |
| 5 | waiting_approval | DB マイグレーション（危険操作 → 承認待ち） |
| 6 | turn_end | マイグレーション承認・完了 |
| 7 | turn_end | レート制限タスク発生 |
| 8 | turn_end | Redis + slowapi でレート制限実装 |
| 9 | turn_end | structlog ロギング要件追加 |
| 10 | turn_end | structlog 実装完了 |
| 11 | turn_end | Prometheus /metrics エンドポイント |
| 12 | task_complete | 全タスク完了 |

---

## 第1回検証（修正前）の結果

| 指標 | 結果 | 評価 |
|---|---|---|
| 最終保持率 | 100% | ✓ |
| 500字制限遵守 | **違反**（Turn 7〜12、最大 673 字） | ✗ |
| 決定事項の項目数 | **12件**（上限 5件を大幅超過） | ✗ |
| コードブロック出力 | **あり**（全出力が ``` ``` ``` で囲まれていた） | ✗ |

### 発見した弱点

1. **500字制限をモデルが無視する**
   system prompt で禁止しているが、Turn 7 から超過し始め Turn 11 で 673 字に達した。
   → 実運用では `build_context()` に渡す summary が肥大化し、
     全後続ターンのトークンコストが上昇する。

2. **「最大5項目」もモデルが無視する**
   最終的に重要な決定事項が 12 件に膨れた。
   解決済みタスクが順次「重要な決定事項」に移動し続けるため、古いものが増え続けた。

3. **コードブロック出力**
   system prompt で「箇条書き以外の装飾禁止」と明示しているにもかかわらず、
   全出力が ` ``` ` で囲まれていた。

---

## 修正内容（summarizer.py）

### 1. 技術スタック 1行集約ルール（新規）

```
重要な決定事項:
- 技術スタック: Python3.11/FastAPI/PostgreSQL/JWT/Docker/Redis/structlog
- （完了タスク最大4件）
```

採用した技術全体を "/" 区切りで 1 行に収め、**削除禁止**とした。
新技術が加わる都度この行を更新する。
→ 技術スタックが何件あっても 1 行に収まるため、項目数制限を圧迫しない。

### 2. 圧縮優先順位の明示

従来: 漠然と「重複・冗長を削ぎ落とす」  
修正後: 500字超過時の削減順序を明記

```
a) 完了タスク欄を最新 3 件に絞る
b) 各行を 15 字以内に短縮
c) 未完了タスクを最新 2 件に絞る
技術スタック行（1行目）は削除禁止
```

### 3. コードブロック禁止の強化

従来: 「箇条書き以外の装飾禁止」（暗黙）  
修正後: 「コードブロック記法（``` や ` など）を一切使わないこと」（明示）

### 4. Python 側 post-processing（新規）

`generate_summary()` の戻り値に対して `_strip_code_block()` を適用。
モデルがルールを無視して ` ``` ` を出力した場合も Python 側で除去する。

### 5. 500字超過の run_log 記録

`_update_summary_safely()` で `over_limit=True` の場合に
`run_log` の metadata へ `{"over_limit": true, "char_count": N}` を記録する。

---

## 修正後の検証結果

### 保持率推移

| ターン | イベント | 保持率 | 文字数 |
|---|---|---|---|
| 1 | turn_end | 100% | 238 |
| 2 | turn_end | 100% | 277 |
| 3 | turn_end | 100% | 291 |
| 4 | turn_end | 100% | 319 |
| 5 | waiting_approval | 100% | 339 |
| 6 | turn_end | 100% | 327 |
| 7 | turn_end | 100% | 345 |
| 8 | turn_end | 100% | 342 |
| 9 | turn_end | 100% | 361 |
| 10 | turn_end | 100% | 352 |
| 11 | turn_end | 100% | 380 |
| 12 | task_complete | 100% | 333 |

### 最終 summary（Turn 12）

```
目的: ECサイトのバックエンドAPIをFastAPIで実装する
重要な決定事項:
- 技術スタック: Python3.11/FastAPI/uvicorn/PostgreSQL/SQLAlchemy/JWT/Docker/Alembic/Redis/slowapi/structlog/prometheus-client
- requirements.txt を作成
- main.py の雛形を作成
- FastAPI バージョンを指定
- /users, /products, /auth/login, /metrics エンドポイント実装
未完了タスク:
- なし
保留 / 承認待ち: なし
次アクション: （完了）
```

文字数: 333 字 / 500 字

### 最終スコア

| 指標 | 結果 | 評価 |
|---|---|---|
| 最終保持率 | 100%（7/7件） | ✓ |
| 500字制限遵守 | 全 12 ターンで 500 字以内 | ✓ |
| コードブロック出力 | なし | ✓ |
| 技術スタック集約 | 1 行に全技術をまとめて保持 | ✓ |

---

## 実施した変更ファイル

| ファイル | 変更内容 |
|---|---|
| `summarizer.py` | system prompt 改訂・`_SUMMARY_CHAR_LIMIT` 定数追加・`_strip_code_block()` 追加・`generate_summary()` に post-processing 追加 |
| `orchestrator.py` | `_update_summary_safely()` に over_limit 警告ログ追加・`from typing import Any` 追加 |
| `test_phase5_long_summary.py` | **新規**。12 ターン相当 real API 検証スクリプト |

---

## 既知の制限

| 項目 | 内容 |
|---|---|
| 技術スタック行の項目数上限なし | 技術が増えると 1 行が長くなる。実用的には 20 技術以下なら問題なし |
| 完了タスク欄が 5 件超えることがある | モデルが「最大 4 件」を無視する場合がある。文字数は守られており実害は小さい |
| 500字制限は「絶対保証」ではない | post-processing でコードブロックを除去しているが、モデルが極端に長い出力をした場合は Python 側で hard truncation は行っていない（summary が破壊されるリスクがあるため） |
| 日本語テキストの文字数換算 | 500 字 = 約 500 文字（全角1字）。トークンではなく文字数でカウント |
| 単一シナリオのみ検証 | FastAPI バックエンド実装 1 本のみ。他分野の会話でも同程度の品質が出るかは未確認 |

---

## 参照

- `summarizer.py` — 実装本体
- `test_phase5_long_summary.py` — 検証スクリプト
- `logs/phase5_summary_test.json` — 詳細ログ（各ターンの保持率・文字数）
- `README_E2E.md` — Phase 5 結果を追記済み
