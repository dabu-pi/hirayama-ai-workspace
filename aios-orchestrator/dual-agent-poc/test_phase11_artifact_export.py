"""
test_phase11_artifact_export.py — Phase 11: artifact-export 検証

実行:
    PYTHONIOENCODING=utf-8 PYTHONUTF8=1 python test_phase11_artifact_export.py

前提:
    API キー不要（fixture DB + export_artifacts 直接呼び出し）
    real API / 実データ確認は fixture DB 上の conv_id で代替

検証項目:
    1. explicit filename → そのまま書き出し
    2. inferred filename → そのまま書き出し
    3. filename_source='none' → safe-default で書き出し
    4. 同名衝突 → <stem>_2<ext> で回避
    5. 空コンテンツ → skipped
    6. パストラバーサル試行 (filename: ../evil.txt) → default fallback で安全に書き出し
    7. サブディレクトリ含む filename (sub/evil.py) → default fallback
    8. conv_id 単位での全 artifact 書き出し (fixture DB)
    9. --artifact-id 単体 export (fixture DB)
    10. --dry-run で実ファイル生成なし
    11. 空件数（artifact なし）でゼロ件正常終了
    12. resolve_filename: explicit > inferred > default の優先順位
    13. is_safe_filename: 各種不正入力の拒否確認
    14. 実データ DB が存在する場合、最新 conv_id での dry-run export

"""

from __future__ import annotations

import gc
import os
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

from artifact_exporter import (
    export_artifacts,
    resolve_filename,
    is_safe_filename,
)
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
    artifact_id: str | None = None,
    turn_id: int = 1,
    artifact_type: str = "code",
    language: str = "python",
    filename: str | None = None,
    filename_source: str = "inferred",
    content: str = "print('hello')",
) -> dict:
    """テスト用 artifact dict を生成する。"""
    return {
        "artifact_id":     artifact_id or str(uuid.uuid4()),
        "turn_id":         turn_id,
        "artifact_type":   artifact_type,
        "language":        language,
        "filename":        filename,
        "filename_source": filename_source,
        "content":         content,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Test 1: explicit filename → そのまま採用
# ─────────────────────────────────────────────────────────────────────────────
print("\n=== [Test 1] explicit filename がそのまま採用される ===")

art1 = _make_artifact(filename="main.py", filename_source="explicit")
name, src = resolve_filename(art1, 0)
_assert(name == "main.py",   f"name == 'main.py' (got '{name}')")
_assert(src  == "explicit",  f"src == 'explicit' (got '{src}')")


# ─────────────────────────────────────────────────────────────────────────────
# Test 2: inferred filename → そのまま採用
# ─────────────────────────────────────────────────────────────────────────────
print("\n=== [Test 2] inferred filename がそのまま採用される ===")

art2 = _make_artifact(filename="utils.py", filename_source="inferred")
name, src = resolve_filename(art2, 0)
_assert(name == "utils.py",  f"name == 'utils.py' (got '{name}')")
_assert(src  == "inferred",  f"src == 'inferred' (got '{src}')")


# ─────────────────────────────────────────────────────────────────────────────
# Test 3: filename_source='none' → safe-default
# ─────────────────────────────────────────────────────────────────────────────
print("\n=== [Test 3] filename_source='none' → safe-default ===")

art3 = _make_artifact(filename=None, filename_source="none",
                      language="python", turn_id=3)
name, src = resolve_filename(art3, 0)
_assert(src  == "default",               f"src == 'default' (got '{src}')")
_assert(name.startswith("artifact_t03"), f"name starts with 'artifact_t03' (got '{name}')")
_assert(name.endswith(".py"),            f"name ends with '.py' (got '{name}')")


# ─────────────────────────────────────────────────────────────────────────────
# Test 4: 同名衝突 → <stem>_2<ext> で回避
# ─────────────────────────────────────────────────────────────────────────────
print("\n=== [Test 4] 同名衝突 → <stem>_2<ext> で回避 ===")

with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
    tmp_path = Path(tmp)
    arts4 = [
        _make_artifact(filename="output.py", filename_source="explicit", content="# v1"),
        _make_artifact(filename="output.py", filename_source="explicit", content="# v2"),
    ]
    results4 = export_artifacts(arts4, output_dir=tmp_path, verbose=False)
    filenames4 = [r["filename"] for r in results4]
    _assert("output.py"   in filenames4, f"output.py in filenames: {filenames4}")
    _assert("output_2.py" in filenames4, f"output_2.py in filenames: {filenames4}")
    _assert(all(r["status"] == "exported" for r in results4),
            f"all exported: {[r['status'] for r in results4]}")
    written4 = [p.name for p in tmp_path.iterdir()]
    _assert(len(written4) == 2, f"2 files written (got {len(written4)}): {written4}")


# ─────────────────────────────────────────────────────────────────────────────
# Test 5: 空コンテンツ → skipped
# ─────────────────────────────────────────────────────────────────────────────
print("\n=== [Test 5] 空コンテンツ → skipped ===")

with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp:
    arts5 = [
        _make_artifact(content=""),
        _make_artifact(content="   \n  "),
    ]
    results5 = export_artifacts(arts5, output_dir=tmp, verbose=False)
    _assert(all(r["status"] == "skipped" for r in results5),
            f"all skipped: {[r['status'] for r in results5]}")
    _assert(all(r["reason"] == "empty_content" for r in results5),
            f"reason=empty_content: {[r['reason'] for r in results5]}")
    written5 = list(Path(tmp).iterdir())
    _assert(len(written5) == 0, f"no files written (got {len(written5)})")


# ─────────────────────────────────────────────────────────────────────────────
# Test 6: パストラバーサル filename → default fallback で安全に書き出し
# ─────────────────────────────────────────────────────────────────────────────
print("\n=== [Test 6] パストラバーサル filename → default fallback ===")

art6_cases = [
    ("../evil.txt",        "explicit"),
    ("../../etc/passwd",   "explicit"),
    ("sub/evil.py",        "explicit"),
    ("sub\\evil.py",       "inferred"),
    ("a" * 300 + ".py",    "explicit"),
]
for fname, fsource in art6_cases:
    art6 = _make_artifact(filename=fname, filename_source=fsource, turn_id=1)
    name6, src6 = resolve_filename(art6, 0)
    _assert(src6 == "default",
            f"'{fname}' → default fallback (got src='{src6}', name='{name6}')")
    _assert(is_safe_filename(name6),
            f"fallback name '{name6}' is safe")


# ─────────────────────────────────────────────────────────────────────────────
# Test 7: is_safe_filename の境界ケース
# ─────────────────────────────────────────────────────────────────────────────
print("\n=== [Test 7] is_safe_filename 境界ケース ===")

_assert(is_safe_filename("main.py"),                "main.py → safe")
_assert(is_safe_filename("schema.sql"),             "schema.sql → safe")
_assert(is_safe_filename("Makefile"),               "Makefile (拡張子なし) → safe")
_assert(is_safe_filename("artifact_t01_00.py"),     "artifact_t01_00.py → safe")
_assert(not is_safe_filename(""),                   "'' → unsafe")
_assert(not is_safe_filename("   "),                "'   ' → unsafe")
_assert(not is_safe_filename("../etc/passwd"),      "../etc/passwd → unsafe")
_assert(not is_safe_filename("sub/file.py"),        "sub/file.py → unsafe")
_assert(not is_safe_filename("sub\\file.py"),       "sub\\file.py → unsafe")
_assert(not is_safe_filename("foo\x00.py"),         "foo\\x00.py → unsafe")
_assert(not is_safe_filename("a" * 256),            "256文字 → unsafe")
_assert(is_safe_filename("a" * 255),                "255文字 → safe")


# ─────────────────────────────────────────────────────────────────────────────
# Test 8: conv_id 単位での全 artifact 書き出し (fixture DB)
# ─────────────────────────────────────────────────────────────────────────────
print("\n=== [Test 8] conv_id 単位での全 artifact 書き出し ===")

with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp_dir:
    db_path8 = str(Path(tmp_dir) / "test8.db")
    out_dir8 = Path(tmp_dir) / "export"

    init_db(db_path8)

    # fixture 会話を作成
    conv_id8 = create_conversation(db_path8, title="Phase11 Test", role_system="test")
    msg_id8  = append_message(db_path8, conv_id8, turn_id=1,
                              role_executor="executor", source_model="claude",
                              target_model="gpt-4o", content="dummy")

    # explicit + inferred + none の混在
    append_artifact(db_path8, msg_id8,
                    artifact_type="code", filename="hello.py",
                    content="print('hello')", language="python",
                    filename_source="explicit")
    append_artifact(db_path8, msg_id8,
                    artifact_type="code", filename="utils.py",
                    content="def add(a, b): return a + b", language="python",
                    filename_source="inferred")
    append_artifact(db_path8, msg_id8,
                    artifact_type="json", filename=None,
                    content='{"key": "value"}', language="json",
                    filename_source="none")

    arts8    = get_artifacts_by_conv(db_path8, conv_id8)
    results8 = export_artifacts(arts8, output_dir=out_dir8, verbose=False)

    exported8 = [r for r in results8 if r["status"] == "exported"]
    skipped8  = [r for r in results8 if r["status"] == "skipped"]

    _assert(len(exported8) == 3, f"3 件 exported (got {len(exported8)})")
    _assert(len(skipped8)  == 0, f"0 件 skipped (got {len(skipped8)})")

    written8 = sorted(p.name for p in out_dir8.iterdir())
    _assert("hello.py" in written8, f"'hello.py' が書き出されている: {written8}")
    _assert("utils.py" in written8, f"'utils.py' が書き出されている: {written8}")

    # none → default filename（.json 拡張子）
    json_files = [n for n in written8 if n.endswith(".json")]
    _assert(len(json_files) >= 1, f"json ファイルが書き出されている: {written8}")

    # ファイル内容確認
    hello_content = (out_dir8 / "hello.py").read_text(encoding="utf-8")
    _assert("print('hello')" in hello_content, "hello.py の内容が正しい")

    # Windows: SQLite 接続を明示的に解放してから tempdir cleanup
    gc.collect()


# ─────────────────────────────────────────────────────────────────────────────
# Test 9: --artifact-id 単体 export
# ─────────────────────────────────────────────────────────────────────────────
print("\n=== [Test 9] --artifact-id 単体 export ===")

with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp_dir:
    db_path9 = str(Path(tmp_dir) / "test9.db")
    out_dir9 = Path(tmp_dir) / "export9"

    init_db(db_path9)
    conv_id9 = create_conversation(db_path9, title="Test9", role_system="test")
    msg_id9  = append_message(db_path9, conv_id9, turn_id=1,
                              role_executor="executor", source_model="claude",
                              target_model="gpt-4o", content="dummy")

    target_art_id = str(uuid.uuid4())

    # 複数 artifact を保存（うち 1 件が target）
    append_artifact(db_path9, msg_id9,
                    artifact_type="code", filename="target.py",
                    content="# target file", language="python",
                    filename_source="explicit")
    append_artifact(db_path9, msg_id9,
                    artifact_type="code", filename="other.py",
                    content="# other file", language="python",
                    filename_source="explicit")

    all_arts9  = get_artifacts_by_conv(db_path9, conv_id9)
    target_art = next(a for a in all_arts9 if a["filename"] == "target.py")

    # prefix で絞り込み（orchestrator.py の --artifact-id 相当）
    prefix    = target_art["artifact_id"][:8]
    filtered9 = [a for a in all_arts9 if a["artifact_id"].startswith(prefix)]
    results9  = export_artifacts(filtered9, output_dir=out_dir9, verbose=False)

    _assert(len(results9) == 1, f"1 件のみ export (got {len(results9)})")
    _assert(results9[0]["filename"] == "target.py",
            f"filename == 'target.py' (got '{results9[0]['filename']}')")
    _assert((out_dir9 / "target.py").exists(), "target.py が書き出された")
    _assert(not (out_dir9 / "other.py").exists(), "other.py は書き出されない")
    gc.collect()


# ─────────────────────────────────────────────────────────────────────────────
# Test 10: --dry-run でファイル未生成
# ─────────────────────────────────────────────────────────────────────────────
print("\n=== [Test 10] --dry-run でファイル未生成 ===")

with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp_dir:
    out_dir10 = Path(tmp_dir) / "dry_export"

    arts10 = [
        _make_artifact(filename="dry_test.py", filename_source="explicit",
                       content="print('dry')", turn_id=1),
    ]
    results10 = export_artifacts(arts10, output_dir=out_dir10,
                                 dry_run=True, verbose=False)

    _assert(len(results10) == 1,                       "1 件処理")
    _assert(results10[0]["status"] == "exported",      "status == 'exported'")
    _assert(results10[0]["reason"] == "dry_run",       "reason == 'dry_run'")
    _assert(not out_dir10.exists() or len(list(out_dir10.iterdir())) == 0,
            "実ファイルが生成されない")


# ─────────────────────────────────────────────────────────────────────────────
# Test 11: 空件数でゼロ件正常終了
# ─────────────────────────────────────────────────────────────────────────────
print("\n=== [Test 11] 空件数でゼロ件正常終了 ===")

with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmp_dir:
    results11 = export_artifacts([], output_dir=tmp_dir, verbose=False)
    _assert(len(results11) == 0, f"0 件 (got {len(results11)})")


# ─────────────────────────────────────────────────────────────────────────────
# Test 12: explicit > inferred > default の優先順位
# ─────────────────────────────────────────────────────────────────────────────
print("\n=== [Test 12] resolve_filename 優先順位 ===")

# explicit が inferred より優先
art12a = _make_artifact(filename="explicit.py", filename_source="explicit")
n, s = resolve_filename(art12a, 0)
_assert(s == "explicit" and n == "explicit.py", f"explicit 優先: ({n}, {s})")

# inferred が default より優先
art12b = _make_artifact(filename="inferred.py", filename_source="inferred")
n, s = resolve_filename(art12b, 0)
_assert(s == "inferred" and n == "inferred.py", f"inferred 優先: ({n}, {s})")

# explicit でも unsafe なら default
art12c = _make_artifact(filename="../hacked.py", filename_source="explicit")
n, s = resolve_filename(art12c, 0)
_assert(s == "default", f"unsafe explicit → default: ({n}, {s})")

# inferred でも unsafe なら default
art12d = _make_artifact(filename="sub/hacked.py", filename_source="inferred")
n, s = resolve_filename(art12d, 0)
_assert(s == "default", f"unsafe inferred → default: ({n}, {s})")


# ─────────────────────────────────────────────────────────────────────────────
# Test 13: 実データ DB dry-run（存在する場合のみ）
# ─────────────────────────────────────────────────────────────────────────────
print("\n=== [Test 13] 実データ DB dry-run（存在する場合のみ） ===")

REAL_DB = Path(__file__).parent / "data" / "store.db"

if not REAL_DB.exists():
    print("  [SKIP] data/store.db が存在しないためスキップ")
else:
    # 実 DB にマイグレーション（language / filename_source 列など）を適用
    init_db(str(REAL_DB))

    from store import get_conn
    with get_conn(str(REAL_DB)) as conn:
        row = conn.execute(
            "SELECT conversation_id FROM conversations ORDER BY created_at DESC LIMIT 1"
        ).fetchone()

    if row is None:
        print("  [SKIP] 会話レコードが 0 件のためスキップ")
    else:
        real_conv_id = row["conversation_id"]
        real_arts    = get_artifacts_by_conv(str(REAL_DB), real_conv_id)
        print(f"  conv_id  : {real_conv_id[:8]}...")
        print(f"  artifacts: {len(real_arts)} 件")

        with tempfile.TemporaryDirectory() as tmp_real:
            results_real = export_artifacts(
                real_arts,
                output_dir=tmp_real,
                dry_run=True,
                verbose=True,
            )
            exp_real = [r for r in results_real if r["status"] == "exported"]
            skp_real = [r for r in results_real if r["status"] == "skipped"]
            _assert(
                len(exp_real) + len(skp_real) == len(real_arts),
                f"全 artifact が処理された: {len(real_arts)} 件"
            )
            print(f"  exported(dry): {len(exp_real)}  skipped: {len(skp_real)}")
            for r in results_real:
                src = r.get("filename_source", "-")
                fn  = r.get("filename") or "-"
                st  = r["status"]
                print(f"    [{st[:3].upper()}] {fn}  [{src}]")


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
