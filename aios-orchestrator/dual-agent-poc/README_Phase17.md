# README_Phase17 — real API 実データ collision 確認 E2E

実施日: 2026-04-16
ステータス: **CLOSED（collision_resolved=true を real API で実証 / 問題なし）**

---

## 目的

Phase 11〜15 で固めた collision 回避仕様（`_2`, `_3` 命名）と
manifest の `collision_resolved=true` 記録が、
real API で生成した実際の Executor 出力に対しても正しく動作することを最終確認する。

---

## 使用した goal

```
Python で utils.py に文字列ユーティリティ関数（strip_spaces, to_upper, to_lower）を
実装してください。その後、同じ utils.py に正規表現を使った関数（remove_digits, extract_emails）
を追加した完全版の utils.py も出力してください。最終的に utils.py を使うサンプルスクリプト
main.py も作成してください。
```

**collision 誘発の意図:** 複数ターンに渡って同じ `# filename: utils.py` を Executor が出力するよう誘導。

---

## conv_id

`3ad4ac80-9049-47ae-acee-392d753cbf65`

---

## 会話の経過

| ターン | Planner 指示 | Executor 動作 | artifact |
|---|---|---|---|
| T01 | `strip_spaces` を utils.py に実装 | `# filename: utils.py` を明示して出力 | python[E] |
| T02 | `to_upper` を utils.py に追加 | `# filename: utils.py` を明示して出力（累積版）| python[E] |
| T03 | `to_lower` を utils.py に追加 | `# filename: utils.py` を明示して出力（累積版）| python[E] |
| T04 | TASK_COMPLETE | — | 0件 |

計: 3 artifact、全て `filename=utils.py`、`filename_source=explicit`

---

## 実行コマンド

### フル export

```bash
python orchestrator.py artifact-export \
  --conv-id 3ad4ac80-9049-47ae-acee-392d753cbf65 \
  --output ./data/export_phase17_live_collision/
```

### --artifact-id 単体 export（collision artifact を指定）

```bash
python orchestrator.py artifact-export \
  --conv-id 3ad4ac80-9049-47ae-acee-392d753cbf65 \
  --artifact-id f4302e87 \
  --output ./data/export_phase17_single/
```

---

## フル export 結果

```
[OK]   T01  782a9af0...  → utils.py    [E]
[OK]   T02  f4302e87...  → utils_2.py  [E]
[OK]   T03  08f275e5...  → utils_3.py  [E]
成功: 3 件  /  スキップ: 0 件  /  エラー: 0 件
```

---

## exported 件数 / filename_source 内訳

| 項目 | 値 |
|---|---|
| total | 3 |
| exported | 3 |
| skipped | 0 |
| errors | 0 |

| source | 件数 |
|---|---|
| explicit [E] | 3（全件）|
| inferred [I] | 0 |
| default [D] | 0 |

---

## collision 発生内容

| artifact_id (8桁) | turn | requested_filename | final_filename | collision_resolved |
|---|---|---|---|---|
| 782a9af0 | T01 | utils.py | **utils.py** | **false**（先頭・衝突なし）|
| f4302e87 | T02 | utils.py | **utils_2.py** | **true**（1回目の衝突）|
| 08f275e5 | T03 | utils.py | **utils_3.py** | **true**（2回目の衝突）|

3件とも `filename_source=explicit`・`requested_filename=utils.py` であり、
collision 回避が連番サフィックス `_2`, `_3` で正しく動作した。

---

## manifest の collision_resolved 確認結果

manifest（`artifact_export_manifest.json`）から抜粋:

```json
{
  "artifact_id": "f4302e87-...",
  "turn_no": 2,
  "language": "python",
  "filename_source": "explicit",
  "requested_filename": "utils.py",
  "final_filename": "utils_2.py",
  "collision_resolved": true,
  "status": "exported"
},
{
  "artifact_id": "08f275e5-...",
  "turn_no": 3,
  "language": "python",
  "filename_source": "explicit",
  "requested_filename": "utils.py",
  "final_filename": "utils_3.py",
  "collision_resolved": true,
  "status": "exported"
}
```

`collision_resolved=true` が real API データで正しく記録された。

---

## 実ファイル内容の確認

| ファイル | 内容 |
|---|---|
| `utils.py` (T01) | `strip_spaces()` のみ |
| `utils_2.py` (T02) | `strip_spaces()` + `to_upper()` |
| `utils_3.py` (T03) | `strip_spaces()` + `to_upper()` + `to_lower()` |

各ターンの Executor が出力した累積版 Python コードと一致。内容の壊れなし。

---

## --artifact-id 単体 export の観察

collision artifact（f4302e87 / T02 版 utils.py）を単体で export した場合:

| 項目 | 値 |
|---|---|
| total | 1 |
| exported | 1 |
| requested_filename | utils.py |
| final_filename | **utils.py**（回避されない）|
| collision_resolved | **false** |

**これは正しい挙動。** 単体 export では競合する他の artifact が存在しないため、
`utils.py` をそのまま使用でき、衝突回避は発生しない。

`collision_resolved` はあくまで「当該 export バッチ内での衝突回避発生有無」を示す。
フル export では他の `utils.py` が先行するため `true` になる。

---

## 問題の有無

**なし。** 以下を real API 実データで確認した:

- explicit filename が3件衝突 → `_2`, `_3` で正しく回避
- manifest に `collision_resolved: true` が2件記録
- `requested_filename=utils.py` / `final_filename=utils_2.py` の整合
- 実ファイル名と manifest の `final_filename` が完全一致
- 単体 export では衝突しないため `collision_resolved=false`（正しい）

---

## コード変更

なし（`README_Phase17.md` の追加のみ）。

---

## 新規ファイル

| ファイル | 内容 |
|---|---|
| `README_Phase17.md` | 本ドキュメント（新規）|
| `data/export_phase17_live_collision/` | collision export 結果（gitignore 対象）|
| `data/export_phase17_single/` | 単体 export 結果（gitignore 対象）|
