"""
test_phase15_artifact_export_e2e.py — Phase 15: artifact-export 統合E2Eテスト

Phase 11〜14 で確立した完成仕様を 1 本の流れで固定する。
新機能のテストではなく「現在の正しい挙動」の回帰防止が目的。

テスト戦略:
  - CLI レベル（subprocess で orchestrator.py artifact-export を呼び出す）を優先
  - fixture DB を tempdir に構築して完全独立
  - 同一 fixture で複数シナリオを横断確認

fixture 構成（_build_fixture_db で構築）:
  Turn 1 (T01):
    art1: explicit  'calculator.py'   python  (normal explicit)
    art2: inferred  'utils.py'        python  (normal inferred)
    art3: explicit  'schema.sql'      sql     (non-python explicit)
    art4: explicit  'config.yaml'     yaml    (non-python explicit)
  Turn 2 (T02):
    art5: explicit  'calculator.py'   python  (collision with art1 → calculator_2.py)
    art6: none      ''                md      (content-inference → .md)
    art7: none      ''                txt     (content-inference → .txt)
    art8: none      (empty content)           (skipped)

完成仕様として固定する不変条件:
  1. filename 優先順位: explicit > inferred > default (Phase 11)
  2. collision 回避: <stem>_2<ext>, _3, ... (Phase 11)
  3. safe filename 制約: .. / / control chars 拒否 (Phase 11)
  4. lang='' の場合は content ベースで拡張子推定 (Phase 13)
  5. normalize_lang: 記号のみタグ → '' (Phase 13)
  6. manifest は output_dir に JSON で生成 (Phase 14)
  7. dry_run 時: 実ファイルなし・manifest あり・dry_run=true (Phase 14)
  8. --no-manifest: export 成功・manifest なし (Phase 14)
  9. --artifact-id: 1 件のみ export (Phase 11)
 10. manifest の collision_resolved / requested_filename が正確 (Phase 14)

実行:
    cd aios-orchestrator/dual-agent-poc
    python test_phase15_artifact_export_e2e.py
"""

from __future__ import annotations

import gc
import json
import subprocess
import sys
import tempfile
from pathlib import Path

# テスト対象モジュール（直接呼び出しシナリオ用）
sys.path.insert(0, str(Path(__file__).parent))
from store import init_db, create_conversation, append_message, append_artifact
from artifact_exporter import export_artifacts, write_manifest, MANIFEST_FILENAME

_ORCHESTRATOR = str(Path(__file__).parent / "orchestrator.py")

# ─────────────────────────────────────────────────────────────────────────────
# テストユーティリティ
# ─────────────────────────────────────────────────────────────────────────────

PASS_COUNT = 0
FAIL_COUNT = 0


def ok(label: str, cond: bool, got=None) -> None:
    global PASS_COUNT, FAIL_COUNT
    if cond:
        PASS_COUNT += 1
        print(f"  [OK]   {label}")
    else:
        FAIL_COUNT += 1
        detail = f"  (got: {got!r})" if got is not None else ""
        print(f"  [FAIL] {label}{detail}")


# ─────────────────────────────────────────────────────────────────────────────
# fixture DB 構築
# ─────────────────────────────────────────────────────────────────────────────

_PY_CONTENT   = "def add(a, b):\n    return a + b\n\nif __name__ == '__main__':\n    print(add(1, 2))\n"
_TEST_CONTENT = "import unittest\nfrom calculator import add\n\nclass TestAdd(unittest.TestCase):\n    def test_add(self):\n        self.assertEqual(add(1, 2), 3)\n"
_SQL_CONTENT  = "CREATE TABLE users (\n    id INTEGER PRIMARY KEY,\n    name TEXT NOT NULL\n);\n"
_YAML_CONTENT = "app:\n  name: my_app\n  debug: false\n  port: 8080\n"
_MD_CONTENT   = "| Name  | Score |\n|-------|-------|\n| Alice | 95    |\n| Bob   | 82    |\n| Carol | 78    |\n"
_LOG_CONTENT  = "test_add (TestAdd) ... ok\ntest_sub (TestAdd) ... ok\n----------------------------------------------------------------------\nRan 2 tests in 0.001s\n\nOK\n"
_COLL_CONTENT = "def multiply(a, b):\n    return a * b\n"  # collision artifact


def _build_fixture_db(db_path: str) -> tuple[str, dict[str, str]]:
    """
    fixture DB を構築する。

    Returns:
        (conv_id, art_ids) のタプル。
        art_ids は {'art1': uuid, 'art2': uuid, ...} の辞書。
    """
    init_db(db_path)
    conv_id = create_conversation(db_path, "Phase15 E2E Test Fixture", "test")

    # ── Turn 1 ─────────────────────────────────────────────────────────────
    msg1 = append_message(db_path, conv_id, turn_id=1,
                          role_executor="executor", source_model="test",
                          target_model=None, content="T01 output")

    art1 = append_artifact(db_path, msg1, "code",     "calculator.py", _PY_CONTENT,
                           language="python", filename_source="explicit")
    art2 = append_artifact(db_path, msg1, "code",     "utils.py",      _TEST_CONTENT,
                           language="python", filename_source="inferred")
    art3 = append_artifact(db_path, msg1, "code",     "schema.sql",    _SQL_CONTENT,
                           language="sql",    filename_source="explicit")
    art4 = append_artifact(db_path, msg1, "file",     "config.yaml",   _YAML_CONTENT,
                           language="yaml",   filename_source="explicit")

    # ── Turn 2 ─────────────────────────────────────────────────────────────
    msg2 = append_message(db_path, conv_id, turn_id=2,
                          role_executor="executor", source_model="test",
                          target_model=None, content="T02 output")

    art5 = append_artifact(db_path, msg2, "code",  "calculator.py", _COLL_CONTENT,
                           language="python", filename_source="explicit")  # collision
    art6 = append_artifact(db_path, msg2, "code",  None,            _MD_CONTENT,
                           language="",       filename_source="none")   # → .md
    art7 = append_artifact(db_path, msg2, "code",  None,            _LOG_CONTENT,
                           language="",       filename_source="none")   # → .txt
    art8 = append_artifact(db_path, msg2, "code",  None,            "",
                           language="",       filename_source="none")   # empty → skipped

    art_ids = {
        "art1": art1, "art2": art2, "art3": art3, "art4": art4,
        "art5": art5, "art6": art6, "art7": art7, "art8": art8,
    }
    return conv_id, art_ids


def _run_cli(db_path: str, conv_id: str, output_dir: str,
             *extra_args: str) -> subprocess.CompletedProcess:
    """orchestrator.py artifact-export をサブプロセスで実行する。"""
    cmd = [
        sys.executable, _ORCHESTRATOR,
        "--db", db_path,
        "artifact-export",
        "--conv-id", conv_id,
        "--output", output_dir,
    ] + list(extra_args)
    return subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        cwd=str(Path(_ORCHESTRATOR).parent),
    )


# ─────────────────────────────────────────────────────────────────────────────
# S01: フルエクスポート — 完成仕様の全要素を 1 本で確認（CLI レベル）
# ─────────────────────────────────────────────────────────────────────────────

def scenario_full_export():
    print("\n=== [S01] フルエクスポート（CLI レベル）===")
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as td:
        db   = str(Path(td) / "test.db")
        out  = str(Path(td) / "out")
        conv_id, art_ids = _build_fixture_db(db)

        result = _run_cli(db, conv_id, out)

        # ── 終了コード ────────────────────────────────────────────────────
        ok("終了コード 0（エラーなし）", result.returncode == 0, got=result.returncode)

        # ── 書き出しファイルの存在確認 ─────────────────────────────────────
        out_dir = Path(out)
        written = {f.name for f in out_dir.iterdir() if f.name != MANIFEST_FILENAME}
        ok("calculator.py が生成された",    "calculator.py"   in written)
        ok("utils.py が生成された",          "utils.py"        in written)
        ok("schema.sql が生成された",        "schema.sql"      in written)
        ok("config.yaml が生成された",       "config.yaml"     in written)
        ok("collision → calculator_2.py",   "calculator_2.py" in written, got=written)
        ok(".md ファイルが生成された",        any(f.endswith(".md")  for f in written))
        ok(".txt ファイルが生成された",       any(f.endswith(".txt") for f in written))
        ok("manifest が生成された",          (out_dir / MANIFEST_FILENAME).exists())
        ok("empty artifact はファイル未生成", len(written) == 7, got=len(written))

        # ── ファイル内容 ──────────────────────────────────────────────────
        ok("calculator.py の内容が正しい",
           (out_dir / "calculator.py").read_text(encoding="utf-8") == _PY_CONTENT)
        ok("collision ファイルの内容が正しい",
           (out_dir / "calculator_2.py").read_text(encoding="utf-8") == _COLL_CONTENT)

        # ── manifest 内容 ─────────────────────────────────────────────────
        data = json.loads((out_dir / MANIFEST_FILENAME).read_text(encoding="utf-8"))
        ok("manifest: conv_id が一致",  data["conv_id"] == conv_id)
        ok("manifest: total == 8",      data["total"]    == 8, got=data["total"])
        ok("manifest: exported == 7",   data["exported"] == 7, got=data["exported"])
        ok("manifest: skipped == 1",    data["skipped"]  == 1, got=data["skipped"])
        ok("manifest: errors == 0",     data["errors"]   == 0)
        ok("manifest: dry_run == false", data["dry_run"] is False)
        ok("manifest: artifacts リストが 8 件", len(data["artifacts"]) == 8)

        # ── manifest × filename_source ────────────────────────────────────
        entries = {e["artifact_id"]: e for e in data["artifacts"]}
        ok("art1: filename_source == explicit",
           entries[art_ids["art1"]]["filename_source"] == "explicit")
        ok("art2: filename_source == inferred",
           entries[art_ids["art2"]]["filename_source"] == "inferred")
        ok("art6: filename_source == default (none→default)",
           entries[art_ids["art6"]]["filename_source"] == "default")

        # ── manifest × collision ──────────────────────────────────────────
        ok("art1: collision_resolved == False",
           entries[art_ids["art1"]]["collision_resolved"] is False)
        ok("art5: collision_resolved == True",
           entries[art_ids["art5"]]["collision_resolved"] is True)
        ok("art5: requested_filename == 'calculator.py'",
           entries[art_ids["art5"]]["requested_filename"] == "calculator.py")
        ok("art5: final_filename == 'calculator_2.py'",
           entries[art_ids["art5"]]["final_filename"] == "calculator_2.py",
           got=entries[art_ids["art5"]]["final_filename"])

        # ── manifest × skipped ────────────────────────────────────────────
        ok("art8: status == skipped",
           entries[art_ids["art8"]]["status"] == "skipped")
        ok("art8: skipped_reason == empty_content",
           entries[art_ids["art8"]].get("skipped_reason") == "empty_content")

        # ── manifest × content inference ─────────────────────────────────
        art6_fname = entries[art_ids["art6"]]["final_filename"] or ""
        art7_fname = entries[art_ids["art7"]]["final_filename"] or ""
        ok("art6 (MD content) → .md",  art6_fname.endswith(".md"),  got=art6_fname)
        ok("art7 (log content) → .txt", art7_fname.endswith(".txt"), got=art7_fname)

        # ── manifest × final_path（絶対パス） ────────────────────────────
        ok("art1: final_path が絶対パス",
           Path(entries[art_ids["art1"]]["final_path"]).is_absolute())

        # ── CLI 出力に manifest パスが含まれる ─────────────────────────────
        ok("stdout に manifest パスが表示される", "manifest" in result.stdout.lower())
    gc.collect()


# ─────────────────────────────────────────────────────────────────────────────
# S02: dry-run — 実ファイルなし・manifest あり・dry_run=true（CLI レベル）
# ─────────────────────────────────────────────────────────────────────────────

def scenario_dry_run():
    print("\n=== [S02] dry-run（CLI レベル）===")
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as td:
        db   = str(Path(td) / "test.db")
        out  = str(Path(td) / "out")
        conv_id, art_ids = _build_fixture_db(db)

        result = _run_cli(db, conv_id, out, "--dry-run")
        ok("終了コード 0", result.returncode == 0, got=result.returncode)

        out_dir = Path(out)
        # manifest 以外のファイルは生成されない
        written = [f.name for f in out_dir.iterdir() if f.name != MANIFEST_FILENAME]
        ok("実 artifact ファイルが生成されていない", len(written) == 0, got=written)

        # manifest は生成される
        manifest_path = out_dir / MANIFEST_FILENAME
        ok("manifest が生成された", manifest_path.exists())
        data = json.loads(manifest_path.read_text(encoding="utf-8"))
        ok("dry_run == true", data["dry_run"] is True)
        ok("exported == 7（dry_run でも計画件数）", data["exported"] == 7)
        ok("skipped == 1",  data["skipped"] == 1)

        # planned final_path が記録されている
        entries = {e["artifact_id"]: e for e in data["artifacts"]}
        art1_entry = entries[art_ids["art1"]]
        ok("dry_run でも final_path が記録される",
           art1_entry["final_path"] is not None)
        ok("dry_run でも final_filename が記録される",
           art1_entry["final_filename"] == "calculator.py")

        # collision 計画も記録
        art5_entry = entries[art_ids["art5"]]
        ok("dry_run: collision_resolved が計画段階で記録",
           art5_entry["collision_resolved"] is True)

        # [DRY] が CLI 出力に含まれる
        ok("stdout に [DRY] が含まれる", "[DRY]" in result.stdout)
    gc.collect()


# ─────────────────────────────────────────────────────────────────────────────
# S03: --artifact-id 単体エクスポート（CLI レベル）
# ─────────────────────────────────────────────────────────────────────────────

def scenario_single_artifact_id():
    print("\n=== [S03] --artifact-id 単体エクスポート（CLI レベル）===")
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as td:
        db   = str(Path(td) / "test.db")
        out  = str(Path(td) / "out")
        conv_id, art_ids = _build_fixture_db(db)

        # art3 の先頭 8 文字で指定
        art3_prefix = art_ids["art3"][:8]
        result = _run_cli(db, conv_id, out, "--artifact-id", art3_prefix)
        ok("終了コード 0", result.returncode == 0, got=result.returncode)

        out_dir = Path(out)
        written = {f.name for f in out_dir.iterdir() if f.name != MANIFEST_FILENAME}
        ok("1 件のみ書き出された", len(written) == 1, got=written)
        ok("schema.sql が書き出された", "schema.sql" in written)

        # 他のファイルは書き出されない
        ok("calculator.py は書き出されない", "calculator.py" not in written)

        # manifest が 1 件
        data = json.loads((out_dir / MANIFEST_FILENAME).read_text(encoding="utf-8"))
        ok("manifest: total == 1", data["total"]    == 1)
        ok("manifest: exported == 1", data["exported"] == 1)
        ok("manifest: artifact_id が art3 と一致",
           data["artifacts"][0]["artifact_id"] == art_ids["art3"])
        ok("manifest: final_filename == schema.sql",
           data["artifacts"][0]["final_filename"] == "schema.sql")
    gc.collect()


# ─────────────────────────────────────────────────────────────────────────────
# S04: --no-manifest — export 成功・manifest 非生成（CLI レベル）
# ─────────────────────────────────────────────────────────────────────────────

def scenario_no_manifest():
    print("\n=== [S04] --no-manifest（CLI レベル）===")
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as td:
        db   = str(Path(td) / "test.db")
        out  = str(Path(td) / "out")
        conv_id, _ = _build_fixture_db(db)

        result = _run_cli(db, conv_id, out, "--no-manifest")
        ok("終了コード 0", result.returncode == 0, got=result.returncode)

        out_dir = Path(out)
        ok("manifest が生成されない", not (out_dir / MANIFEST_FILENAME).exists())
        written = {f.name for f in out_dir.iterdir()}
        ok("artifact ファイルは正常に書き出された（7 件）",
           len(written) == 7, got=len(written))
    gc.collect()


# ─────────────────────────────────────────────────────────────────────────────
# S05: filename 優先順位の不変条件（関数レベル詳細確認）
# ─────────────────────────────────────────────────────────────────────────────

def scenario_filename_priority():
    print("\n=== [S05] filename 優先順位の不変条件（explicit > inferred > default）===")
    arts = [
        # explicit かつ safe → explicit 採用
        {"artifact_id": "p-001", "artifact_type": "code", "language": "python",
         "filename": "explicit.py", "filename_source": "explicit",
         "content": "x = 1", "turn_id": 1},
        # inferred かつ safe → inferred 採用
        {"artifact_id": "p-002", "artifact_type": "code", "language": "python",
         "filename": "inferred.py", "filename_source": "inferred",
         "content": "x = 2", "turn_id": 1},
        # explicit だが unsafe（パストラバーサル）→ default フォールバック
        {"artifact_id": "p-003", "artifact_type": "code", "language": "python",
         "filename": "../evil.py", "filename_source": "explicit",
         "content": "x = 3", "turn_id": 1},
        # filename_source='none' → default
        {"artifact_id": "p-004", "artifact_type": "code", "language": "python",
         "filename": None, "filename_source": "none",
         "content": "x = 4", "turn_id": 1},
    ]
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as td:
        out = Path(td) / "out"
        results = export_artifacts(arts, out, dry_run=False, verbose=False)
        by_id = {r["artifact_id"]: r for r in results}

        ok("explicit → filename_source == explicit",
           by_id["p-001"]["filename_source"] == "explicit")
        ok("explicit → filename == explicit.py",
           by_id["p-001"]["filename"] == "explicit.py")

        ok("inferred → filename_source == inferred",
           by_id["p-002"]["filename_source"] == "inferred")
        ok("inferred → filename == inferred.py",
           by_id["p-002"]["filename"] == "inferred.py")

        ok("unsafe explicit → filename_source == default",
           by_id["p-003"]["filename_source"] == "default")
        ok("unsafe explicit → filename は safe-default",
           by_id["p-003"]["filename"].startswith("artifact_t"))

        ok("none → filename_source == default",
           by_id["p-004"]["filename_source"] == "default")
        ok("none + python → .py",
           by_id["p-004"]["filename"].endswith(".py"))
    gc.collect()


# ─────────────────────────────────────────────────────────────────────────────
# S06: safe filename 不変条件（拒否ケースの確認）
# ─────────────────────────────────────────────────────────────────────────────

def scenario_safe_filename_invariants():
    print("\n=== [S06] safe filename 不変条件 ===")
    from artifact_exporter import is_safe_filename
    # 安全
    ok("main.py → safe",       is_safe_filename("main.py"))
    ok("schema.sql → safe",    is_safe_filename("schema.sql"))
    ok("Makefile → safe",      is_safe_filename("Makefile"))
    ok("255文字 → safe",        is_safe_filename("a" * 255))
    # 危険
    ok("'' → unsafe",          not is_safe_filename(""))
    ok("'..' → unsafe",        not is_safe_filename(".."))
    ok("'../evil.py' → unsafe", not is_safe_filename("../evil.py"))
    ok("'sub/file' → unsafe",  not is_safe_filename("sub/file"))
    ok("'sub\\\\file' → unsafe", not is_safe_filename("sub\\file"))
    ok("256文字 → unsafe",      not is_safe_filename("a" * 256))
    ok("制御文字 → unsafe",      not is_safe_filename("foo\x00.py"))
    gc.collect()


# ─────────────────────────────────────────────────────────────────────────────
# S07: collision 回避の不変条件（3 件衝突 → _2, _3）
# ─────────────────────────────────────────────────────────────────────────────

def scenario_collision_invariants():
    print("\n=== [S07] collision 回避の不変条件（3 件衝突）===")
    arts = [
        {"artifact_id": "c-001", "artifact_type": "code", "language": "python",
         "filename": "out.py", "filename_source": "explicit",
         "content": "x = 1", "turn_id": 1},
        {"artifact_id": "c-002", "artifact_type": "code", "language": "python",
         "filename": "out.py", "filename_source": "explicit",
         "content": "x = 2", "turn_id": 1},
        {"artifact_id": "c-003", "artifact_type": "code", "language": "python",
         "filename": "out.py", "filename_source": "explicit",
         "content": "x = 3", "turn_id": 1},
    ]
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as td:
        out = Path(td) / "out"
        results = export_artifacts(arts, out, dry_run=False, verbose=False)
        names = [r["filename"] for r in results]
        ok("1 件目 = out.py",   names[0] == "out.py",   got=names[0])
        ok("2 件目 = out_2.py", names[1] == "out_2.py", got=names[1])
        ok("3 件目 = out_3.py", names[2] == "out_3.py", got=names[2])
        ok("c-001: collision_resolved == False", results[0]["collision_resolved"] is False)
        ok("c-002: collision_resolved == True",  results[1]["collision_resolved"] is True)
        ok("c-003: collision_resolved == True",  results[2]["collision_resolved"] is True)
        # 実ファイルが 3 件存在する
        written = {f.name for f in out.iterdir()}
        ok("out.py が存在",   "out.py"   in written)
        ok("out_2.py が存在", "out_2.py" in written)
        ok("out_3.py が存在", "out_3.py" in written)
    gc.collect()


# ─────────────────────────────────────────────────────────────────────────────
# S08: content inference の不変条件（lang='' 時の拡張子）
# ─────────────────────────────────────────────────────────────────────────────

def scenario_content_inference_invariants():
    print("\n=== [S08] content inference の不変条件（lang='' → .md/.txt/.py/.sh）===")
    cases = [
        # Markdown テーブル 3 行 → .md
        ("md", "| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |\n| 5 | 6 |\n"),
        # unittest 出力 → .txt
        ("log", "test_add ... ok\n----------------------------------------------------------------------\nRan 1 test in 0.001s\n\nOK\n"),
        # Python コード → .py
        ("py",  "def greet(name):\n    return f'Hello, {name}'\n"),
        # bash スクリプト → .sh
        ("sh",  "#!/bin/bash\necho 'Hello'\n"),
    ]
    expected = {
        "md":  ".md",
        "log": ".txt",
        "py":  ".py",
        "sh":  ".sh",
    }
    arts = [
        {"artifact_id": f"ci-{k}", "artifact_type": "code", "language": "",
         "filename": None, "filename_source": "none",
         "content": content, "turn_id": 1}
        for k, content in cases
    ]
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as td:
        out = Path(td) / "out"
        results = export_artifacts(arts, out, dry_run=False, verbose=False)
        for r in results:
            key = r["artifact_id"].split("-")[1]  # 'md', 'log', 'py', 'sh'
            ext = Path(r["filename"]).suffix
            ok(f"lang='' + {key} content → {expected[key]}",
               ext == expected[key], got=ext)
    gc.collect()


# ─────────────────────────────────────────────────────────────────────────────
# S09: manifest の不変条件（フィールド完全性確認）
# ─────────────────────────────────────────────────────────────────────────────

def scenario_manifest_field_invariants():
    print("\n=== [S09] manifest フィールド完全性の不変条件 ===")
    arts = [
        {"artifact_id": "mf-001", "artifact_type": "code", "language": "python",
         "filename": "target.py", "filename_source": "explicit",
         "content": "x = 1", "turn_id": 3},
    ]
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as td:
        out = Path(td) / "out"
        results = export_artifacts(arts, out, dry_run=False, verbose=False)
        mp = write_manifest(results, out, conv_id="test-conv-999")
        data = json.loads(mp.read_text(encoding="utf-8"))

        # ヘッダーフィールド
        for field in ["conv_id", "export_timestamp", "output_dir", "dry_run",
                      "total", "exported", "skipped", "errors", "artifacts"]:
            ok(f"ヘッダー: '{field}' が存在する", field in data)

        # エントリフィールド
        entry = data["artifacts"][0]
        for field in ["artifact_id", "turn_no", "artifact_index", "language",
                      "filename_source", "requested_filename", "final_filename",
                      "final_path", "collision_resolved", "status"]:
            ok(f"エントリ: '{field}' が存在する", field in entry)

        # 値の確認
        ok("conv_id が一致", data["conv_id"] == "test-conv-999")
        ok("output_dir が絶対パス", Path(data["output_dir"]).is_absolute())
        ok("entry: language == 'python'", entry["language"] == "python")
        ok("entry: turn_no == 3",         entry["turn_no"] == 3)
        ok("entry: artifact_index == 0",  entry["artifact_index"] == 0)
        ok("entry: status == 'exported'", entry["status"] == "exported")
        ok("entry: final_path が絶対パス", Path(entry["final_path"]).is_absolute())
    gc.collect()


# ─────────────────────────────────────────────────────────────────────────────
# S10: zero artifact conv_id でもエラーなし（CLI レベル）
# ─────────────────────────────────────────────────────────────────────────────

def scenario_zero_artifacts_cli():
    print("\n=== [S10] zero artifact conv_id でもエラーなし（CLI レベル）===")
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as td:
        db  = str(Path(td) / "test.db")
        out = str(Path(td) / "out")
        init_db(db)
        empty_conv = create_conversation(db, "empty conv", "test")

        result = _run_cli(db, empty_conv, out)
        ok("終了コード 0", result.returncode == 0, got=result.returncode)
        ok("output_dir が存在しない（0 件なので未作成）",
           not Path(out).exists() or len(list(Path(out).iterdir())) == 0)
        ok("manifest 非生成（0 件）", not Path(out, MANIFEST_FILENAME).exists())
    gc.collect()


# ─────────────────────────────────────────────────────────────────────────────
# S11: --dry-run + --no-manifest（CLI レベル）
# ─────────────────────────────────────────────────────────────────────────────

def scenario_dryrun_no_manifest():
    print("\n=== [S11] --dry-run + --no-manifest（CLI レベル）===")
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as td:
        db   = str(Path(td) / "test.db")
        out  = str(Path(td) / "out")
        conv_id, _ = _build_fixture_db(db)

        result = _run_cli(db, conv_id, out, "--dry-run", "--no-manifest")
        ok("終了コード 0", result.returncode == 0, got=result.returncode)

        out_dir = Path(out)
        # manifest も実ファイルも生成されない
        if out_dir.exists():
            all_files = list(out_dir.iterdir())
            ok("ファイルが何も生成されない", len(all_files) == 0, got=[f.name for f in all_files])
        else:
            ok("output_dir 自体が存在しない（= ファイル未生成）", True)

        # CLI 出力に [DRY] が含まれる
        ok("stdout に [DRY] が含まれる", "[DRY]" in result.stdout)
    gc.collect()


# ─────────────────────────────────────────────────────────────────────────────
# S12: manifest と export ファイルの対応整合（cross-check）
# ─────────────────────────────────────────────────────────────────────────────

def scenario_manifest_file_cross_check():
    print("\n=== [S12] manifest × export ファイルの対応整合 ===")
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as td:
        db   = str(Path(td) / "test.db")
        out  = str(Path(td) / "out")
        conv_id, _ = _build_fixture_db(db)

        result = _run_cli(db, conv_id, out)
        ok("終了コード 0", result.returncode == 0)

        out_dir = Path(out)
        data = json.loads((out_dir / MANIFEST_FILENAME).read_text(encoding="utf-8"))

        exported_entries = [e for e in data["artifacts"] if e["status"] == "exported"]
        skipped_entries  = [e for e in data["artifacts"] if e["status"] == "skipped"]

        # exported エントリの final_path が実際に存在する
        all_exist = all(Path(e["final_path"]).exists() for e in exported_entries)
        ok("exported エントリの final_path が全件存在する", all_exist)

        # skipped エントリの final_path は None
        all_none = all(e["final_path"] is None for e in skipped_entries)
        ok("skipped エントリの final_path が全件 None", all_none)

        # manifest の final_filename と実ファイル名が一致
        actual_files = {f.name for f in out_dir.iterdir() if f.name != MANIFEST_FILENAME}
        manifest_filenames = {e["final_filename"] for e in exported_entries}
        ok("manifest の final_filename と実ファイルが完全一致",
           actual_files == manifest_filenames, got=(actual_files, manifest_filenames))
    gc.collect()


# ─────────────────────────────────────────────────────────────────────────────
# メイン
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    scenario_full_export()
    scenario_dry_run()
    scenario_single_artifact_id()
    scenario_no_manifest()
    scenario_filename_priority()
    scenario_safe_filename_invariants()
    scenario_collision_invariants()
    scenario_content_inference_invariants()
    scenario_manifest_field_invariants()
    scenario_zero_artifacts_cli()
    scenario_dryrun_no_manifest()
    scenario_manifest_file_cross_check()

    print()
    print("=" * 60)
    print(f"PASS: {PASS_COUNT}  /  FAIL: {FAIL_COUNT}")
    if FAIL_COUNT == 0:
        print("全テストパス。")
    else:
        print(f"*** {FAIL_COUNT} 件失敗 ***")
        sys.exit(1)
