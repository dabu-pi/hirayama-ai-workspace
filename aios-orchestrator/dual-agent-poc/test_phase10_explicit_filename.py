"""
test_phase10_explicit_filename.py — Phase 10: filename 明示指定検証

実行:
    PYTHONIOENCODING=utf-8 PYTHONUTF8=1 python test_phase10_explicit_filename.py

前提:
    API キー不要（parse_artifacts 直接呼び出し + fixture DB）
    real API シナリオは test_phase10_real_api.py で別途実施

検証項目:
    1. // filename: 記法  → explicit filename が採用される
    2. # filename: 記法   → explicit filename が採用される
    3. -- filename: 記法  → explicit filename が採用される
    4. filename: 記法（プレーン）→ explicit filename が採用される
    5. ブロック先頭行での filename: 記法 → explicit filename が採用される
    6. 明示なし → 推定 filename にフォールバック
    7. 複数ブロック：各ブロックが独立して filename を解決
    8. 不正 filename（パストラバーサル / パス含む / 空 / 長過ぎ）→ 推定にフォールバック
    9. filename_source フィールドが 'explicit' / 'inferred' / 'none' で返る
    10. 既存 Phase 6 / 7 テストへの後方互換確認（parse_artifacts 呼び出し互換）
    11. artifact-diff の系統グルーピングに explicit filename が有効に効く
    12. real API ゴール: 複数 explicit filename を含むシナリオの保存確認
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env", override=True)
except ImportError:
    pass

from artifact_parser import (
    parse_artifacts, _sanitize_filename, _extract_explicit_filename,
)
from artifact_diff import group_artifacts


def _assert(cond: bool, msg: str) -> None:
    if not cond:
        print(f"  [FAIL] {msg}")
        sys.exit(1)
    print(f"  [OK]   {msg}")


# ─── Test 1: // filename: 記法 ────────────────────────────────────────────────
print("\n=== [Test 1] // filename: 記法 ===")

sample1 = """
以下のコードを実装しました。

// filename: main.py
```python
def hello():
    print("hello")
```
"""
arts1 = parse_artifacts(sample1)
_assert(len(arts1) == 1,                      "1 件抽出")
_assert(arts1[0]["filename"] == "main.py",    f"filename=main.py (actual: {arts1[0]['filename']})")
_assert(arts1[0]["filename_source"] == "explicit", "filename_source=explicit")

# ─── Test 2: # filename: 記法 ─────────────────────────────────────────────────
print("\n=== [Test 2] # filename: 記法 ===")

sample2 = """
# filename: setup.sh
```bash
pip install requests
```
"""
arts2 = parse_artifacts(sample2)
_assert(arts2[0]["filename"] == "setup.sh",   f"filename=setup.sh (actual: {arts2[0]['filename']})")
_assert(arts2[0]["filename_source"] == "explicit", "filename_source=explicit")

# ─── Test 3: -- filename: 記法（SQL スタイル）────────────────────────────────
print("\n=== [Test 3] -- filename: 記法 ===")

sample3 = """
-- filename: schema.sql
```sql
CREATE TABLE users (id INT, name TEXT);
```
"""
arts3 = parse_artifacts(sample3)
_assert(arts3[0]["filename"] == "schema.sql",  f"filename=schema.sql (actual: {arts3[0]['filename']})")
_assert(arts3[0]["filename_source"] == "explicit", "filename_source=explicit")

# ─── Test 4: filename: 記法（プレーン）────────────────────────────────────────
print("\n=== [Test 4] filename: 記法（プレーン）===")

sample4 = """
設定ファイルです。

filename: config.yaml
```yaml
key: value
```
"""
arts4 = parse_artifacts(sample4)
_assert(arts4[0]["filename"] == "config.yaml",  f"filename=config.yaml (actual: {arts4[0]['filename']})")
_assert(arts4[0]["filename_source"] == "explicit", "filename_source=explicit")

# ─── Test 5: ブロック先頭行での指定 ──────────────────────────────────────────
print("\n=== [Test 5] ブロック先頭行での filename: 指定 ===")

sample5 = """
```python
# filename: utils.py
def add(a, b):
    return a + b
```
"""
arts5 = parse_artifacts(sample5)
_assert(arts5[0]["filename"] == "utils.py",    f"filename=utils.py (actual: {arts5[0]['filename']})")
_assert(arts5[0]["filename_source"] == "explicit", "filename_source=explicit")

# ─── Test 6: 明示なし → 推定にフォールバック ──────────────────────────────────
print("\n=== [Test 6] 明示なし → 推定 filename にフォールバック ===")

sample6 = """
```python
def foo():
    pass
```
"""
arts6 = parse_artifacts(sample6)
_assert(arts6[0]["filename"] == "artifact.py",      f"filename=artifact.py (actual: {arts6[0]['filename']})")
_assert(arts6[0]["filename_source"] == "inferred",  "filename_source=inferred")

# ─── Test 7: 複数ブロック — 各ブロック独立解決 ─────────────────────────────────
print("\n=== [Test 7] 複数ブロック: 各ブロックが独立して filename を解決 ===")

sample7 = """
メインコード:

// filename: app.py
```python
def main():
    pass
```

実行スクリプト:

# filename: run.sh
```bash
python app.py
```

設定（filename 指定なし）:

```yaml
debug: true
```
"""
arts7 = parse_artifacts(sample7)
_assert(len(arts7) == 3,                                 f"3 件抽出 (actual: {len(arts7)})")
_assert(arts7[0]["filename"] == "app.py",                f"1件目: app.py (actual: {arts7[0]['filename']})")
_assert(arts7[0]["filename_source"] == "explicit",       "1件目: explicit")
_assert(arts7[1]["filename"] == "run.sh",                f"2件目: run.sh (actual: {arts7[1]['filename']})")
_assert(arts7[1]["filename_source"] == "explicit",       "2件目: explicit")
# yaml は明示なし → 推定
_assert(arts7[2]["filename_source"] == "inferred",       f"3件目: inferred (actual: {arts7[2]['filename_source']})")
_assert(arts7[2]["filename"] is not None,                "3件目: 推定 filename が存在する")

# ─── Test 8: 不正 filename → 推定にフォールバック ───────────────────────────
print("\n=== [Test 8] 不正 filename → 推定 filename にフォールバック ===")

_assert(_sanitize_filename("") is None,              "空文字 → None")
_assert(_sanitize_filename("   ") is None,           "空白のみ → None")
_assert(_sanitize_filename("../etc/passwd") is None, "パストラバーサル → None")
_assert(_sanitize_filename("/etc/passwd") is None,   "絶対パス → None")
_assert(_sanitize_filename("foo/bar.py") is None,    "パス含む → None")
_assert(_sanitize_filename("foo\\bar.py") is None,   "Windowsパス含む → None")
_assert(_sanitize_filename("a" * 256) is None,       "256 文字超 → None")
_assert(_sanitize_filename("foo.py") == "foo.py",    "正常 → foo.py")
_assert(_sanitize_filename("  foo.py  ") == "foo.py", "前後空白除去")
_assert(_sanitize_filename("Dockerfile") == "Dockerfile", "拡張子なし許可")
_assert(_sanitize_filename("a" * 255) == "a" * 255,  "255 文字はOK")

# 不正 filename を含む実際のブロック
bad_fname_sample = """
// filename: ../secrets.env
```bash
SECRET=xxx
```
"""
arts_bad = parse_artifacts(bad_fname_sample)
_assert(arts_bad[0]["filename_source"] != "explicit",  "不正パス → explicit にならない")
# bash のデフォルト推定は artifact.sh
_assert(arts_bad[0]["filename_source"] in ("inferred", "none"), "推定 or none にフォールバック")

# ─── Test 9: filename_source フィールドの値 ───────────────────────────────────
print("\n=== [Test 9] filename_source フィールドの値 ===")

# explicit
ex = parse_artifacts("// filename: test.py\n```python\nx=1\n```")
_assert(ex[0]["filename_source"] == "explicit",  "explicit ケース")

# inferred
inf = parse_artifacts("```python\nx=1\n```")
_assert(inf[0]["filename_source"] == "inferred",  "inferred ケース")

# none（言語不明で推定できない）
none_case = parse_artifacts("```unknownlang123\nsome content\n```")
_assert(none_case[0]["filename_source"] in ("inferred", "none"), "none or inferred ケース")

# ─── Test 10: 後方互換確認（Phase 6 テストと同じ入力で挙動維持） ────────────────
print("\n=== [Test 10] 後方互換: Phase 6 と同じ入力で artifact_type / language / body 維持 ===")

compat_sample = """
以下の Python コードを実装しました。

```python
def fizzbuzz(n):
    for i in range(1, n + 1):
        if i % 15 == 0:
            print("FizzBuzz")
        elif i % 3 == 0:
            print("Fizz")
        elif i % 5 == 0:
            print("Buzz")
        else:
            print(i)
```

また、requirements.txt も作成しました。

```
fastapi==0.110.0
uvicorn
```
"""
compat_arts = parse_artifacts(compat_sample)
_assert(len(compat_arts) == 2,                        "2 件抽出（後方互換）")
_assert(compat_arts[0]["language"] == "python",       "1件目 language=python")
_assert(compat_arts[0]["artifact_type"] == "code",    "1件目 type=code")
_assert("fizzbuzz" in compat_arts[0]["body"],         "1件目 body に fizzbuzz が含まれる")
_assert(compat_arts[1]["language"] == "",             "2件目 language=空")
# filename_source キーが必ず存在する（Phase 10 追加フィールド）
_assert("filename_source" in compat_arts[0],          "filename_source キーが存在する")
_assert("filename_source" in compat_arts[1],          "2件目 filename_source キーが存在する")

# ─── Test 11: artifact-diff グルーピングに explicit filename が効く ────────────
print("\n=== [Test 11] artifact-diff: explicit filename がグルーピングキーに効く ===")

arts11 = [
    {"artifact_id": "t01", "turn_id": 1, "filename": "app.py",  "language": "python", "artifact_type": "code",  "content": "v1", "created_at": ""},
    {"artifact_id": "t02", "turn_id": 2, "filename": "app.py",  "language": "python", "artifact_type": "code",  "content": "v2", "created_at": ""},
    {"artifact_id": "t03", "turn_id": 1, "filename": "run.sh",  "language": "bash",   "artifact_type": "shell", "content": "v1", "created_at": ""},
    {"artifact_id": "t04", "turn_id": 2, "filename": "run.sh",  "language": "bash",   "artifact_type": "shell", "content": "v2", "created_at": ""},
]
grps11 = group_artifacts(arts11)
_assert("app.py" in grps11,  "app.py グループが存在する")
_assert("run.sh" in grps11,  "run.sh グループが存在する")
_assert(len(grps11["app.py"]) == 2, "app.py 2 バージョン")

# explicit filename が違えば別グループ
arts11b = [
    {"artifact_id": "x01", "turn_id": 1, "filename": "app.py",    "language": "python", "artifact_type": "code", "content": "v1", "created_at": ""},
    {"artifact_id": "x02", "turn_id": 2, "filename": "server.py", "language": "python", "artifact_type": "code", "content": "v2", "created_at": ""},
]
grps11b = group_artifacts(arts11b)
_assert(len(grps11b) == 0, "filename が違う → 連続 diff なし（別グループ 1 件ずつ）")

print("\n=== 全テスト成功 ===\n")
