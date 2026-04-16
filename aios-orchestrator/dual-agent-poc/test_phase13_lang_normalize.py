"""
test_phase13_lang_normalize.py — Phase 13: language tag 正規化 + 内容ベース拡張子推定

実行:
    PYTHONIOENCODING=utf-8 PYTHONUTF8=1 python test_phase13_lang_normalize.py

前提:
    API キー不要（normalize_lang / _infer_ext_from_content / parse_artifacts / export_artifacts 直接呼び出し）

検証項目:
    [normalize_lang]
    1.  空文字 → ''
    2.  空白のみ → ''
    3.  '.....' → '' （記号のみ）
    4.  '---'   → '' （記号のみ）
    5.  '###'   → '' （記号のみ）
    6.  '+-+'   → '' （記号のみ）
    7.  'PYTHON' → 'python'（大文字正規化）
    8.  ' md '  → 'markdown'（空白除去 + エイリアス）
    9.  'py'    → 'python'（エイリアス）
    10. 'js'    → 'javascript'（エイリアス）
    11. 'ts'    → 'typescript'（エイリアス）
    12. 'sh'    → 'bash'（エイリアス）
    13. 'c++'   → 'cpp'（エイリアス）
    14. '123'   → '123'（数字のみだが _is_valid_lang で後処理される）
    15. 'a' * 31 → ''（30 文字超）
    16. 'python' → 'python'（変化なし）
    17. 'rust'   → 'rust'（エイリアス登録なし → そのまま）

    [_infer_ext_from_content]
    18. Markdown テーブル 3 行以上 → '.md'
    19. Markdown テーブル 1 行 + 見出し → '.md'
    20. 箇条書き + 番号付きリスト → '.md'
    21. unittest verbose 出力（... ok）→ '.txt'（高信頼度）
    22. 'Ran N tests' → '.txt'（高信頼度）
    23. 区切り線 + 独立した OK → '.txt'（中信頼度 2 件）
    24. Python コード（def + コロン終端 + 4スペース）→ '.py'
    25. Python コード（import + def）→ '.py'
    26. bash（shebang）→ '.sh'
    27. bash（echo/python コマンド）→ '.sh'
    28. 空文字 → '.txt'
    29. 不明テキスト → '.txt'（デフォルト）

    [parse_artifacts との統合]
    30. lang='.....' のブロック → language='' として保存
    31. lang='PYTHON' のブロック → language='python' として保存
    32. lang='py' のブロック → language='python' として保存
    33. lang='' のブロック → language='' として保存（変化なし）
    34. 既存仕様: explicit filename 優先は不変
    35. 既存仕様: inferred filename は変化なし

    [export_artifacts との統合]
    36. lang='' + Markdown テーブル本文 → .md 拡張子
    37. lang='' + テスト結果テキスト → .txt 拡張子
    38. lang='.....' → normalize → '' → テスト結果 → .txt
    39. lang='python' → .py（既知タグは content 推定しない）
    40. lang='' + Python コード → .py（内容推定）
    41. Phase 11 既存テストが通ること（回帰確認）
    42. explicit > inferred > default 優先順位が不変
"""

from __future__ import annotations

import gc
import sys
import tempfile
import uuid
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env", override=True)
except ImportError:
    pass

from artifact_parser import normalize_lang, parse_artifacts
from artifact_exporter import _infer_ext_from_content, export_artifacts, resolve_filename
from store import init_db, create_conversation, append_message, append_artifact
from store import get_artifacts_by_conv


# ─── テストユーティリティ ─────────────────────────────────────────────────────

_PASS = 0
_FAIL = 0


def _assert(cond: bool, msg: str) -> None:
    global _PASS, _FAIL
    if not cond:
        print(f"  [FAIL] {msg}")
        _FAIL += 1
    else:
        print(f"  [OK]   {msg}")
        _PASS += 1


def _make_artifact(
    turn_id: int = 1,
    artifact_type: str = "code",
    language: str = "python",
    filename: str | None = None,
    filename_source: str = "inferred",
    content: str = "print('hello')",
) -> dict:
    return {
        "artifact_id":     str(uuid.uuid4()),
        "turn_id":         turn_id,
        "artifact_type":   artifact_type,
        "language":        language,
        "filename":        filename,
        "filename_source": filename_source,
        "content":         content,
    }


# ─────────────────────────────────────────────────────────────────────────────
# [normalize_lang] Tests 1–17
# ─────────────────────────────────────────────────────────────────────────────
print("\n=== [normalize_lang Tests 1-17] ===")

# 空文字・空白
_assert(normalize_lang("")    == "",  "T01: '' → ''")
_assert(normalize_lang("  ")  == "",  "T02: '  ' → ''")

# 記号のみ（英数字なし）
_assert(normalize_lang(".....") == "", "T03: '.....' → ''")
_assert(normalize_lang("---")   == "", "T04: '---' → ''")
_assert(normalize_lang("###")   == "", "T05: '###' → ''")
_assert(normalize_lang("+-+")   == "", "T06: '+-+' → ''")

# 大文字正規化
_assert(normalize_lang("PYTHON") == "python",     "T07: 'PYTHON' → 'python'")
_assert(normalize_lang(" md ")   == "markdown",   "T08: ' md ' → 'markdown'")

# エイリアス
_assert(normalize_lang("py")   == "python",      "T09: 'py' → 'python'")
_assert(normalize_lang("js")   == "javascript",  "T10: 'js' → 'javascript'")
_assert(normalize_lang("ts")   == "typescript",  "T11: 'ts' → 'typescript'")
_assert(normalize_lang("sh")   == "bash",        "T12: 'sh' → 'bash'")
_assert(normalize_lang("c++")  == "cpp",         "T13: 'c++' → 'cpp'")

# 数字のみ（_is_valid_lang でスキップされるが normalize は通す）
_assert(normalize_lang("123") == "123",  "T14: '123' → '123'（後段でスキップ）")

# 長すぎ
_assert(normalize_lang("a" * 31) == "", "T15: 31文字 → ''")
_assert(normalize_lang("a" * 30) == "a" * 30, "T15b: 30文字はOK")

# 変化なし
_assert(normalize_lang("python") == "python", "T16: 'python' → 'python'")
_assert(normalize_lang("rust")   == "rust",   "T17: 'rust' → 'rust'（エイリアスなし）")


# ─────────────────────────────────────────────────────────────────────────────
# [_infer_ext_from_content] Tests 18–29
# ─────────────────────────────────────────────────────────────────────────────
print("\n=== [_infer_ext_from_content Tests 18-29] ===")

# Markdown テーブル 3 行以上（高信頼度）
md_table = (
    "|   | 1 | 2 | 3 |\n"
    "|---|---|---|---|\n"
    "| 1 | 1 | 2 | 3 |\n"
    "| 2 | 2 | 4 | 6 |\n"
    "| 3 | 3 | 6 | 9 |"
)
_assert(_infer_ext_from_content(md_table) == ".md", "T18: テーブル3行以上 → .md")

# テーブル1行 + 見出し
md_heading_table = "# 九九表\n\n| a | b |\n|---|---|\n| 1 | 2 |"
_assert(_infer_ext_from_content(md_heading_table) == ".md", "T19: 見出し + テーブル → .md")

# 箇条書き + 番号付きリスト
md_list = "- item1\n- item2\n1. first\n2. second"
_assert(_infer_ext_from_content(md_list) == ".md", "T20: 箇条書き + 番号付きリスト → .md")

# unittest verbose（... ok）高信頼度
test_verbose = (
    "test_add (__main__.TestCalc) ... ok\n"
    "test_sub (__main__.TestCalc) ... ok\n"
    "test_mul (__main__.TestCalc) ... ok\n"
)
_assert(_infer_ext_from_content(test_verbose) == ".txt", "T21: unittest verbose → .txt")

# Ran N tests
test_summary = "Ran 5 tests in 0.001s\n\nOK"
_assert(_infer_ext_from_content(test_summary) == ".txt", "T22: 'Ran N tests' → .txt")

# 区切り線 + 独立した OK
test_sep_ok = "-" * 70 + "\n\nOK\n"
_assert(_infer_ext_from_content(test_sep_ok) == ".txt", "T23: 区切り線 + OK → .txt")

# Python コード（def + コロン終端 + 4スペース）
py_code = (
    "def add(a, b):\n"
    "    return a + b\n\n"
    "def sub(a, b):\n"
    "    return a - b\n"
)
_assert(_infer_ext_from_content(py_code) == ".py", "T24: Python コード (def+インデント) → .py")

# Python コード（import + def）
py_import = (
    "import unittest\n\n"
    "class TestFoo(unittest.TestCase):\n"
    "    def test_bar(self):\n"
    "        self.assertEqual(1, 1)\n"
)
_assert(_infer_ext_from_content(py_import) == ".py", "T25: Python (import + class + def) → .py")

# bash（shebang）
bash_shebang = "#!/bin/bash\necho 'hello'\n"
_assert(_infer_ext_from_content(bash_shebang) == ".sh", "T26: shebang → .sh")

# bash（コマンド）
bash_cmd = "python test_calc.py\npython -m unittest discover\n"
_assert(_infer_ext_from_content(bash_cmd) == ".sh", "T27: python コマンド → .sh")

# 空文字
_assert(_infer_ext_from_content("") == ".txt",   "T28: 空文字 → .txt")
_assert(_infer_ext_from_content("  ") == ".txt", "T28b: 空白 → .txt")

# 不明テキスト
_assert(_infer_ext_from_content("hello world") == ".txt", "T29: 不明テキスト → .txt")


# ─────────────────────────────────────────────────────────────────────────────
# [parse_artifacts 統合] Tests 30–35
# ─────────────────────────────────────────────────────────────────────────────
print("\n=== [parse_artifacts 統合 Tests 30-35] ===")

# T30: lang='.....' のブロック → language=''
sample30 = "```.....\nsome output text\n```"
arts30 = parse_artifacts(sample30)
_assert(len(arts30) == 1,            "T30: 1 件抽出")
_assert(arts30[0]["language"] == "", "T30: language='' に正規化")

# T31: lang='PYTHON'
sample31 = "```PYTHON\nprint('hello')\n```"
arts31 = parse_artifacts(sample31)
_assert(len(arts31) == 1,                    "T31: 1 件抽出")
_assert(arts31[0]["language"] == "python",   "T31: 'PYTHON' → 'python'")

# T32: lang='py'
sample32 = "```py\ndef foo(): pass\n```"
arts32 = parse_artifacts(sample32)
_assert(len(arts32) == 1,                    "T32: 1 件抽出")
_assert(arts32[0]["language"] == "python",   "T32: 'py' → 'python'")

# T33: lang='' （変化なし）
sample33 = "```\nsome code\n```"
arts33 = parse_artifacts(sample33)
_assert(len(arts33) == 1,             "T33: 1 件抽出")
_assert(arts33[0]["language"] == "",  "T33: '' → '' (変化なし)")

# T34: explicit filename 優先は不変
sample34 = (
    "# filename: myfile.py\n"
    "```python\n"
    "def hello(): pass\n"
    "```\n"
)
arts34 = parse_artifacts(sample34)
_assert(arts34[0]["filename_source"] == "explicit",  "T34: explicit 優先不変")
_assert(arts34[0]["filename"] == "myfile.py",         "T34: filename='myfile.py'")

# T35: inferred は変化なし（py→python でも artifact.py は同じ）
sample35 = "```py\ndef foo(): pass\n```"
arts35 = parse_artifacts(sample35)
_assert(arts35[0]["filename_source"] == "inferred",  "T35: inferred 不変")
_assert(arts35[0]["filename"] == "artifact.py",       "T35: 'py'→'python' でも artifact.py")


# ─────────────────────────────────────────────────────────────────────────────
# [export_artifacts 統合] Tests 36–42
# ─────────────────────────────────────────────────────────────────────────────
print("\n=== [export_artifacts 統合 Tests 36-42] ===")

# T36: lang='' + Markdown テーブル → .md
with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
    arts36 = [_make_artifact(language="", filename=None, filename_source="none",
                              content=md_table, artifact_type="code", turn_id=1)]
    r36 = export_artifacts(arts36, output_dir=tmp, dry_run=True, verbose=False)
    _assert(r36[0]["filename"].endswith(".md"), f"T36: lang='' + MD テーブル → .md  (got {r36[0]['filename']})")

# T37: lang='' + テスト結果 → .txt
with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
    arts37 = [_make_artifact(language="", filename=None, filename_source="none",
                              content=test_verbose, artifact_type="code", turn_id=2)]
    r37 = export_artifacts(arts37, output_dir=tmp, dry_run=True, verbose=False)
    _assert(r37[0]["filename"].endswith(".txt"), f"T37: lang='' + テスト結果 → .txt  (got {r37[0]['filename']})")

# T38: lang='.....' → 正規化で '' → テスト結果 → .txt
# (DBから読み込んだ時点でもう normalize されている想定。parser 経由で確認)
sample38 = f"```.....\n{test_verbose}```"
arts38_parsed = parse_artifacts(sample38)
_assert(len(arts38_parsed) == 1 and arts38_parsed[0]["language"] == "",
        "T38: parse で '.....' → ''")
with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
    arts38 = [_make_artifact(language="", filename=None, filename_source="none",
                              content=test_verbose, artifact_type="code", turn_id=2)]
    r38 = export_artifacts(arts38, output_dir=tmp, dry_run=True, verbose=False)
    _assert(r38[0]["filename"].endswith(".txt"), f"T38: ''（元 '.....'）+ テスト → .txt  (got {r38[0]['filename']})")

# T39: lang='python' → .py（既知タグは content 推定しない）
with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
    arts39 = [_make_artifact(language="python", filename=None, filename_source="none",
                              content="print('hello')", artifact_type="code", turn_id=1)]
    r39 = export_artifacts(arts39, output_dir=tmp, dry_run=True, verbose=False)
    _assert(r39[0]["filename"].endswith(".py"), f"T39: lang='python' → .py  (got {r39[0]['filename']})")

# T40: lang='' + Python コード → .py（内容推定）
with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
    arts40 = [_make_artifact(language="", filename=None, filename_source="none",
                              content=py_code, artifact_type="code", turn_id=3)]
    r40 = export_artifacts(arts40, output_dir=tmp, dry_run=True, verbose=False)
    _assert(r40[0]["filename"].endswith(".py"), f"T40: lang='' + Python → .py  (got {r40[0]['filename']})")

# T41: Phase 11 回帰 — fixture DB で explicit/inferred/none 混在 3 件が全て exported
print("\n  [T41 Phase 11 regression]")
with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp_dir:
    db41 = str(Path(tmp_dir) / "test41.db")
    out41 = Path(tmp_dir) / "export41"
    init_db(db41)
    conv41 = create_conversation(db41, title="regression", role_system="test")
    msg41  = append_message(db41, conv41, turn_id=1,
                            role_executor="executor", source_model="claude",
                            target_model="gpt-4o", content="dummy")
    append_artifact(db41, msg41, artifact_type="code", filename="hello.py",
                    content="print('hello')", language="python", filename_source="explicit")
    append_artifact(db41, msg41, artifact_type="code", filename="utils.py",
                    content="def add(a, b): return a + b", language="python",
                    filename_source="inferred")
    append_artifact(db41, msg41, artifact_type="json", filename=None,
                    content='{"key": "value"}', language="json", filename_source="none")
    arts41 = get_artifacts_by_conv(db41, conv41)
    res41  = export_artifacts(arts41, output_dir=out41, verbose=False)
    exported41 = [r for r in res41 if r["status"] == "exported"]
    _assert(len(exported41) == 3,              "T41: 3 件 exported")
    written41 = sorted(p.name for p in out41.iterdir())
    _assert("hello.py" in written41,           "T41: hello.py が書き出された")
    _assert("utils.py" in written41,           "T41: utils.py が書き出された")
    json_files41 = [n for n in written41 if n.endswith(".json")]
    _assert(len(json_files41) >= 1,            "T41: json ファイルが書き出された")
    gc.collect()

# T42: explicit > inferred > default 優先順位不変
print("\n  [T42 優先順位不変]")
# explicit (safe) → そのまま採用
art42e = _make_artifact(language="python", filename="my_file.py",
                         filename_source="explicit", content="x=1")
n42e, s42e = resolve_filename(art42e, 0)
_assert(s42e == "explicit" and n42e == "my_file.py", f"T42 explicit: ({n42e},{s42e})")

# inferred (safe) → そのまま採用
art42i = _make_artifact(language="python", filename="artifact.py",
                         filename_source="inferred", content="x=1")
n42i, s42i = resolve_filename(art42i, 0)
_assert(s42i == "inferred" and n42i == "artifact.py", f"T42 inferred: ({n42i},{s42i})")

# unsafe explicit → default（内容から .py）
art42d = _make_artifact(language="python", filename="../hack.py",
                         filename_source="explicit", content=py_code)
n42d, s42d = resolve_filename(art42d, 0)
_assert(s42d == "default", f"T42 unsafe→default: ({n42d},{s42d})")


# ─────────────────────────────────────────────────────────────────────────────
# 結果サマリー
# ─────────────────────────────────────────────────────────────────────────────
print(f"\n{'='*60}")
print(f"PASS: {_PASS}  /  FAIL: {_FAIL}")
if _FAIL > 0:
    print("テスト失敗があります。上記 [FAIL] 行を確認してください。")
    sys.exit(1)
else:
    print("全テストパス。")
    sys.exit(0)
