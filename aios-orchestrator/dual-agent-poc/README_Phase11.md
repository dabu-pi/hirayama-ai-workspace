# README_Phase11 — Artifact Export CLI

実施日: 2026-04-16
ステータス: **CLOSED**

---

## 目的

Phase 10 で filename 精度が上がったので、保存済み artifact を実ファイルとして書き出す `artifact-export` CLI を実装する。
保存 → 確認 → 差分 → 書き出しの流れを完成させる。

---

## CLI 使い方

### 会話単位で全 artifact を書き出す

```
python orchestrator.py artifact-export \
    --conv-id <conversation_id> \
    --output ./output/
```

### 単体 artifact を書き出す（--artifact-id 前方一致）

```
python orchestrator.py artifact-export \
    --conv-id <conversation_id> \
    --artifact-id <prefix> \
    --output ./output/
```

### 書き出し計画だけ確認する（ファイル未生成）

```
python orchestrator.py artifact-export \
    --conv-id <conversation_id> \
    --output ./output/ \
    --dry-run
```

### 出力例

```
Artifact Export: Pythonで九九表をMarkdownで作る
  conv_id    : a1b2c3d4-...
  artifacts  : 3 件
  output_dir : ./output/
──────────────────────────────────────────────────────────────────────
  [OK]   T01  a1b2c3d4...  → main.py        [E]
  [OK]   T01  e5f6g7h8...  → schema.sql     [E]
  [OK]   T02  i9j0k1l2...  → artifact_t02_02.json  [D]
──────────────────────────────────────────────────────────────────────
  成功: 3 件  /  スキップ: 0 件  /  エラー: 0 件
  出力先: ./output/
```

filename ソース表示:
- `[E]` = explicit（Executor が明示したファイル名）
- `[I]` = inferred（言語から推定されたファイル名）
- `[D]` = default（safe-default: `artifact_t<turn>_<index><ext>`）

---

## filename 決定ルール

| 優先度 | 条件 | 採用ソース |
|---|---|---|
| 1 (高) | `filename_source='explicit'` かつ `is_safe_filename()` | explicit |
| 2 | `filename_source='inferred'` かつ `is_safe_filename()` | inferred |
| 3 (低) | 上記以外（unsafe / None / source='none'） | default |

### safe-default 命名規則

```
artifact_t<turn_id>_<index><ext>
例: artifact_t01_00.py, artifact_t02_01.json
```

拡張子は言語タグ → artifact_type の順で解決する。

---

## 同名衝突ルール

- 同一 export 実行内で同名が衝突した場合、`<stem>_<n><ext>` を付与する（n=2 から）
- 既にファイルが存在する場合も同様に連番回避する
- **上書きはデフォルト禁止**

例: `output.py` が 3 件 → `output.py`, `output_2.py`, `output_3.py`

---

## 安全化（path traversal 対策）

`is_safe_filename()` による入力チェック：

| 条件 | 例 | 結果 |
|---|---|---|
| 空文字 / 空白 | `filename: ` | default fallback |
| `..` を含む | `../etc/passwd` | default fallback |
| `/` または `\` を含む | `sub/file.py` | default fallback |
| 制御文字を含む | `foo\x00.py` | default fallback |
| 255 文字超 | 256 文字以上 | default fallback |

`is_safe_filename()` を通過した後も、`Path.is_relative_to()` による二重チェックを実施する（resolve() ベース）。

---

## 新規ファイル・変更ファイル

| ファイル | 内容 |
|---|---|
| `artifact_exporter.py` | export ロジック本体（新規） |
| `orchestrator.py` | `artifact-export` サブコマンド追加 |
| `test_phase11_artifact_export.py` | 56 テスト・全パス（新規） |
| `README_Phase11.md` | 本ドキュメント（新規） |

---

## 検証結果

| テスト | 結果 |
|---|---|
| T1: explicit filename 採用 | PASS |
| T2: inferred filename 採用 | PASS |
| T3: filename_source='none' → safe-default | PASS |
| T4: 同名衝突 → `_2` 回避 | PASS |
| T5: 空コンテンツ → skipped | PASS |
| T6: パストラバーサル試行 → default fallback | PASS |
| T7: `is_safe_filename` 境界ケース 12 件 | PASS |
| T8: fixture DB — conv_id 単位 full export | PASS |
| T9: --artifact-id 単体 export | PASS |
| T10: --dry-run でファイル未生成 | PASS |
| T11: 空件数で正常終了 | PASS |
| T12: explicit > inferred > default 優先順位 | PASS |
| T13: 実データ DB dry-run（存在する場合） | PASS |

**合計: PASS 56 / FAIL 0**

---

## 既知の制限

| 制限 | 内容 |
|---|---|
| サブディレクトリ非対応 | 書き出しは常に output_dir 直下のフラット構造 |
| エンコーディング固定 | UTF-8 固定（バイナリ artifact 非対応） |
| 上書きオプションなし | 常に衝突回避。強制上書き (`--force`) は未実装 |
| Windows 一時 DB ロック | テスト内 SQLite を tempdir と同居する際は `ignore_cleanup_errors=True` が必要 |

---

## フロー完成図

```
start → run → artifacts → artifact-diff → artifact-export
                ↑                               ↓
         (保存・確認)                    (実ファイル書き出し)
```

Phase 11 で保存 → 確認 → 差分 → 書き出しの流れが完成した。
