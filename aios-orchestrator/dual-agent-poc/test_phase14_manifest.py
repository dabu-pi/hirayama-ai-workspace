"""
test_phase14_manifest.py — Phase 14: manifest 出力テスト

テスト対象:
  - write_manifest() が artifact_export_manifest.json を生成する
  - manifest の件数サマリーが export 結果と一致する
  - skipped / error の情報が manifest に含まれる
  - filename_source が正しく記録される
  - collision 回避時に collision_resolved=True が記録される
  - --artifact-id 単体 export でも正しく出る
  - dry_run 時は manifest に dry_run=true が含まれる
  - --no-manifest 相当（write_manifest を呼ばない）時はファイルが生成されない
  - Phase 11 / 13 の regression（既存 export 動作が壊れていない）

実行:
    cd aios-orchestrator/dual-agent-poc
    python test_phase14_manifest.py
"""

from __future__ import annotations

import gc
import json
import os
import sys
import tempfile
from pathlib import Path

# テスト対象モジュール
sys.path.insert(0, str(Path(__file__).parent))
from artifact_exporter import (
    export_artifacts,
    write_manifest,
    MANIFEST_FILENAME,
)

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


def _make_art(
    art_id: str,
    content: str,
    lang: str = "python",
    filename: str | None = None,
    filename_source: str = "inferred",
    turn_id: int = 1,
) -> dict:
    return {
        "artifact_id":    art_id,
        "artifact_type":  "code",
        "language":       lang,
        "filename":       filename,
        "filename_source": filename_source,
        "content":        content,
        "turn_id":        turn_id,
    }


# ─────────────────────────────────────────────────────────────────────────────
# T01: manifest ファイルが生成される
# ─────────────────────────────────────────────────────────────────────────────

def test_manifest_file_created():
    print("\n=== [T01] manifest ファイルが生成される ===")
    arts = [_make_art("aaa-001", "print('hello')", filename="hello.py")]
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as td:
        out = Path(td) / "out"
        results = export_artifacts(arts, out, dry_run=False, verbose=False)
        mp = write_manifest(results, out, conv_id="conv-001")
        ok("manifest ファイルが存在する", mp.exists())
        ok("ファイル名が artifact_export_manifest.json", mp.name == MANIFEST_FILENAME)
        data = json.loads(mp.read_text(encoding="utf-8"))
        ok("conv_id が記録される", data["conv_id"] == "conv-001")
        ok("total == 1", data["total"] == 1)
        ok("exported == 1", data["exported"] == 1)
        ok("skipped == 0", data["skipped"] == 0)
        ok("errors == 0", data["errors"] == 0)
        ok("artifacts リストが 1 件", len(data["artifacts"]) == 1)
        ok("dry_run == false", data["dry_run"] is False)
        ok("export_timestamp が存在する", "export_timestamp" in data)
        ok("output_dir が存在する", "output_dir" in data)
    gc.collect()


# ─────────────────────────────────────────────────────────────────────────────
# T02: exported 件数と manifest 件数が一致する
# ─────────────────────────────────────────────────────────────────────────────

def test_counts_match():
    print("\n=== [T02] exported 件数と manifest 件数が一致する ===")
    arts = [
        _make_art("aaa-001", "print('a')", filename="a.py"),
        _make_art("aaa-002", "print('b')", filename="b.py"),
        _make_art("aaa-003", "print('c')", filename="c.py"),
    ]
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as td:
        out = Path(td) / "out"
        results = export_artifacts(arts, out, dry_run=False, verbose=False)
        mp = write_manifest(results, out, conv_id="conv-002")
        data = json.loads(mp.read_text(encoding="utf-8"))
        ok("total == 3", data["total"] == 3)
        ok("exported == 3", data["exported"] == 3)
        ok("artifacts リストが 3 件", len(data["artifacts"]) == 3)
    gc.collect()


# ─────────────────────────────────────────────────────────────────────────────
# T03: skipped 情報が manifest に含まれる
# ─────────────────────────────────────────────────────────────────────────────

def test_skipped_in_manifest():
    print("\n=== [T03] skipped 情報が manifest に含まれる ===")
    arts = [
        _make_art("aaa-001", "print('hello')", filename="ok.py"),
        _make_art("aaa-002", "",               filename="empty.py"),   # 空コンテンツ
        _make_art("aaa-003", "   \n  ",        filename="blank.py"),   # スペースのみ
    ]
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as td:
        out = Path(td) / "out"
        results = export_artifacts(arts, out, dry_run=False, verbose=False)
        mp = write_manifest(results, out, conv_id="conv-003")
        data = json.loads(mp.read_text(encoding="utf-8"))
        ok("total == 3", data["total"] == 3)
        ok("exported == 1", data["exported"] == 1)
        ok("skipped == 2", data["skipped"] == 2, got=data["skipped"])
        # skipped エントリに skipped_reason が含まれる
        skipped_entries = [a for a in data["artifacts"] if a["status"] == "skipped"]
        ok("skipped エントリが 2 件", len(skipped_entries) == 2)
        ok("skipped_reason == 'empty_content'", all(
            a.get("skipped_reason") == "empty_content" for a in skipped_entries
        ))
    gc.collect()


# ─────────────────────────────────────────────────────────────────────────────
# T04: filename_source が正しく記録される
# ─────────────────────────────────────────────────────────────────────────────

def test_filename_source_recorded():
    print("\n=== [T04] filename_source が正しく記録される ===")
    arts = [
        _make_art("aaa-001", "x=1", filename="explicit.py", filename_source="explicit"),
        _make_art("aaa-002", "x=2", filename="inferred.py", filename_source="inferred"),
        _make_art("aaa-003", "x=3", filename=None,          filename_source="none"),
    ]
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as td:
        out = Path(td) / "out"
        results = export_artifacts(arts, out, dry_run=False, verbose=False)
        mp = write_manifest(results, out, conv_id="conv-004")
        data = json.loads(mp.read_text(encoding="utf-8"))
        entries = {a["artifact_id"]: a for a in data["artifacts"]}
        ok("explicit が記録される", entries["aaa-001"]["filename_source"] == "explicit")
        ok("inferred が記録される", entries["aaa-002"]["filename_source"] == "inferred")
        # none → safe-default → 'default'
        ok("none→default が記録される", entries["aaa-003"]["filename_source"] == "default")
    gc.collect()


# ─────────────────────────────────────────────────────────────────────────────
# T05: collision 回避時に collision_resolved=True が記録される
# ─────────────────────────────────────────────────────────────────────────────

def test_collision_resolved_in_manifest():
    print("\n=== [T05] collision 回避時に collision_resolved=True が記録される ===")
    arts = [
        _make_art("aaa-001", "print(1)", filename="out.py", filename_source="explicit"),
        _make_art("aaa-002", "print(2)", filename="out.py", filename_source="explicit"),  # 衝突
    ]
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as td:
        out = Path(td) / "out"
        results = export_artifacts(arts, out, dry_run=False, verbose=False)
        mp = write_manifest(results, out, conv_id="conv-005")
        data = json.loads(mp.read_text(encoding="utf-8"))
        entries = data["artifacts"]
        ok("1 件目は collision_resolved=False", entries[0]["collision_resolved"] is False)
        ok("2 件目は collision_resolved=True",  entries[1]["collision_resolved"] is True)
        ok("2 件目の requested_filename == 'out.py'", entries[1]["requested_filename"] == "out.py")
        ok("2 件目の final_filename != 'out.py'", entries[1]["final_filename"] != "out.py")
    gc.collect()


# ─────────────────────────────────────────────────────────────────────────────
# T06: --artifact-id 単体 export でも manifest が正しく出る
# ─────────────────────────────────────────────────────────────────────────────

def test_single_artifact_manifest():
    print("\n=== [T06] 単体 artifact export でも manifest が正しく出る ===")
    # artifact-id でフィルタ後の 1 件だけを渡す（CLI がフィルタする想定）
    arts = [_make_art("bbb-001", "x=42", filename="single.py", filename_source="explicit")]
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as td:
        out = Path(td) / "out"
        results = export_artifacts(arts, out, dry_run=False, verbose=False)
        mp = write_manifest(results, out, conv_id="conv-006")
        data = json.loads(mp.read_text(encoding="utf-8"))
        ok("total == 1", data["total"] == 1)
        ok("exported == 1", data["exported"] == 1)
        ok("artifact_id が記録される", data["artifacts"][0]["artifact_id"] == "bbb-001")
        ok("final_filename == 'single.py'", data["artifacts"][0]["final_filename"] == "single.py")
    gc.collect()


# ─────────────────────────────────────────────────────────────────────────────
# T07: dry_run 時に manifest に dry_run=true が含まれる
# ─────────────────────────────────────────────────────────────────────────────

def test_dry_run_manifest():
    print("\n=== [T07] dry_run 時に manifest に dry_run=true が含まれる ===")
    arts = [
        _make_art("aaa-001", "print('a')", filename="a.py"),
        _make_art("aaa-002", "print('b')", filename="b.py"),
    ]
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as td:
        out = Path(td) / "out"
        results = export_artifacts(arts, out, dry_run=True, verbose=False)
        mp = write_manifest(results, out, conv_id="conv-007", dry_run=True)
        # dry_run では実ファイルは生成されない（manifest のみ）
        written_files = [f.name for f in out.iterdir() if f.name != MANIFEST_FILENAME]
        ok("実 artifact ファイルが生成されていない", len(written_files) == 0, got=written_files)
        ok("manifest ファイルは生成される", mp.exists())
        data = json.loads(mp.read_text(encoding="utf-8"))
        ok("dry_run == true", data["dry_run"] is True)
        ok("artifacts が 2 件", len(data["artifacts"]) == 2)
        ok("status == 'exported' (dry_run では exported 扱い)",
           all(a["status"] == "exported" for a in data["artifacts"]))
    gc.collect()


# ─────────────────────────────────────────────────────────────────────────────
# T08: --no-manifest 相当（write_manifest を呼ばない）時はファイルが生成されない
# ─────────────────────────────────────────────────────────────────────────────

def test_no_manifest_flag():
    print("\n=== [T08] write_manifest を呼ばない時はファイルが生成されない ===")
    arts = [_make_art("aaa-001", "x=1", filename="x.py")]
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as td:
        out = Path(td) / "out"
        results = export_artifacts(arts, out, dry_run=False, verbose=False)
        # write_manifest を呼ばない（--no-manifest 相当）
        manifest_path = out / MANIFEST_FILENAME
        ok("manifest が存在しない", not manifest_path.exists())
        ok("artifact ファイルは正常に書き出された", (out / "x.py").exists())
    gc.collect()


# ─────────────────────────────────────────────────────────────────────────────
# T09: manifest に language / turn_no / artifact_index が記録される
# ─────────────────────────────────────────────────────────────────────────────

def test_manifest_detail_fields():
    print("\n=== [T09] manifest に language / turn_no / artifact_index が記録される ===")
    arts = [
        _make_art("aaa-001", "import json", lang="python",  filename="a.py", turn_id=2),
        _make_art("aaa-002", "SELECT 1",    lang="sql",     filename="b.sql", turn_id=3),
    ]
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as td:
        out = Path(td) / "out"
        results = export_artifacts(arts, out, dry_run=False, verbose=False)
        mp = write_manifest(results, out, conv_id="conv-009")
        data = json.loads(mp.read_text(encoding="utf-8"))
        e0, e1 = data["artifacts"][0], data["artifacts"][1]
        ok("e0: language == 'python'",      e0["language"] == "python")
        ok("e0: turn_no == 2",              e0["turn_no"] == 2)
        ok("e0: artifact_index == 0",       e0["artifact_index"] == 0)
        ok("e1: language == 'sql'",         e1["language"] == "sql")
        ok("e1: turn_no == 3",              e1["turn_no"] == 3)
        ok("e1: artifact_index == 1",       e1["artifact_index"] == 1)
    gc.collect()


# ─────────────────────────────────────────────────────────────────────────────
# T10: requested_filename と final_filename が区別される
# ─────────────────────────────────────────────────────────────────────────────

def test_requested_vs_final_filename():
    print("\n=== [T10] requested_filename と final_filename が区別される ===")
    arts = [
        _make_art("aaa-001", "x=1", filename="result.py", filename_source="explicit"),
        _make_art("aaa-002", "x=2", filename="result.py", filename_source="explicit"),
    ]
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as td:
        out = Path(td) / "out"
        results = export_artifacts(arts, out, dry_run=False, verbose=False)
        mp = write_manifest(results, out, conv_id="conv-010")
        data = json.loads(mp.read_text(encoding="utf-8"))
        e0, e1 = data["artifacts"][0], data["artifacts"][1]
        ok("e0: requested == final",
           e0["requested_filename"] == e0["final_filename"])
        ok("e1: requested == 'result.py'",
           e1["requested_filename"] == "result.py")
        ok("e1: final != 'result.py' (衝突回避)",
           e1["final_filename"] != "result.py")
        ok("e1: final_filename は result_2.py",
           e1["final_filename"] == "result_2.py", got=e1["final_filename"])
    gc.collect()


# ─────────────────────────────────────────────────────────────────────────────
# T11: manifest に final_path が絶対パスで記録される
# ─────────────────────────────────────────────────────────────────────────────

def test_final_path_is_absolute():
    print("\n=== [T11] manifest に final_path が絶対パスで記録される ===")
    arts = [_make_art("aaa-001", "x=1", filename="abs_test.py")]
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as td:
        out = Path(td) / "out"
        results = export_artifacts(arts, out, dry_run=False, verbose=False)
        mp = write_manifest(results, out, conv_id="conv-011")
        data = json.loads(mp.read_text(encoding="utf-8"))
        final_path = data["artifacts"][0]["final_path"]
        ok("final_path が絶対パス", Path(final_path).is_absolute(), got=final_path)
        ok("output_dir も絶対パス", Path(data["output_dir"]).is_absolute())
    gc.collect()


# ─────────────────────────────────────────────────────────────────────────────
# T12: zero artifact 時も manifest が生成される（空リスト）
# ─────────────────────────────────────────────────────────────────────────────

def test_zero_artifacts_manifest():
    print("\n=== [T12] zero artifact 時も manifest が生成される ===")
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as td:
        out = Path(td) / "out"
        results = export_artifacts([], out, dry_run=False, verbose=False)
        mp = write_manifest(results, out, conv_id="conv-012")
        data = json.loads(mp.read_text(encoding="utf-8"))
        ok("manifest が存在する", mp.exists())
        ok("total == 0", data["total"] == 0)
        ok("artifacts == []", data["artifacts"] == [])
    gc.collect()


# ─────────────────────────────────────────────────────────────────────────────
# T13: Phase 11 regression — 既存 export 動作が壊れていない
# ─────────────────────────────────────────────────────────────────────────────

def test_phase11_regression():
    print("\n=== [T13 Phase11 regression] 既存の export 動作が壊れていない ===")
    arts = [
        {
            "artifact_id":    "reg-001",
            "artifact_type":  "code",
            "language":       "python",
            "filename":       "hello.py",
            "filename_source": "explicit",
            "content":        "print('hello')",
            "turn_id":        1,
        },
        {
            "artifact_id":    "reg-002",
            "artifact_type":  "code",
            "language":       "python",
            "filename":       "utils.py",
            "filename_source": "inferred",
            "content":        "def add(a,b): return a+b",
            "turn_id":        1,
        },
        {
            "artifact_id":    "reg-003",
            "artifact_type":  "json",
            "language":       "json",
            "filename":       "artifact_t01_02.json",
            "filename_source": "inferred",
            "content":        '{"key": "value"}',
            "turn_id":        1,
        },
    ]
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as td:
        out = Path(td) / "out"
        results = export_artifacts(arts, out, dry_run=False, verbose=False)
        exported_names = {r["filename"] for r in results if r["status"] == "exported"}
        ok("3 件 exported", len([r for r in results if r["status"] == "exported"]) == 3)
        ok("hello.py が書き出された", "hello.py" in exported_names)
        ok("utils.py が書き出された", "utils.py" in exported_names)
        ok("json ファイルが書き出された", "artifact_t01_02.json" in exported_names)
        # manifest も確認
        mp = write_manifest(results, out, conv_id="conv-reg")
        data = json.loads(mp.read_text(encoding="utf-8"))
        ok("manifest の exported == 3", data["exported"] == 3)
        ok("manifest の skipped == 0",  data["skipped"] == 0)
    gc.collect()


# ─────────────────────────────────────────────────────────────────────────────
# T14: Phase 13 regression — lang='' + Markdown → .md も manifest に記録される
# ─────────────────────────────────────────────────────────────────────────────

def test_phase13_regression_manifest():
    print("\n=== [T14 Phase13 regression] lang=''+Markdown → .md が manifest に記録される ===")
    md_content = "| A | B | C |\n|---|---|---|\n| 1 | 2 | 3 |\n| 4 | 5 | 6 |"
    arts = [{
        "artifact_id":    "p13-001",
        "artifact_type":  "code",
        "language":       "",
        "filename":       None,
        "filename_source": "none",
        "content":        md_content,
        "turn_id":        1,
    }]
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as td:
        out = Path(td) / "out"
        results = export_artifacts(arts, out, dry_run=False, verbose=False)
        ok("exported status", results[0]["status"] == "exported")
        ok("final_filename ends with .md", results[0]["filename"].endswith(".md"),
           got=results[0]["filename"])
        mp = write_manifest(results, out, conv_id="conv-p13")
        data = json.loads(mp.read_text(encoding="utf-8"))
        entry = data["artifacts"][0]
        ok("manifest: language == ''",     entry["language"] == "")
        ok("manifest: final_filename .md", entry["final_filename"].endswith(".md"))
        ok("manifest: filename_source == 'default'", entry["filename_source"] == "default")
    gc.collect()


# ─────────────────────────────────────────────────────────────────────────────
# メイン
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    test_manifest_file_created()
    test_counts_match()
    test_skipped_in_manifest()
    test_filename_source_recorded()
    test_collision_resolved_in_manifest()
    test_single_artifact_manifest()
    test_dry_run_manifest()
    test_no_manifest_flag()
    test_manifest_detail_fields()
    test_requested_vs_final_filename()
    test_final_path_is_absolute()
    test_zero_artifacts_manifest()
    test_phase11_regression()
    test_phase13_regression_manifest()

    print()
    print("=" * 60)
    print(f"PASS: {PASS_COUNT}  /  FAIL: {FAIL_COUNT}")
    if FAIL_COUNT == 0:
        print("全テストパス。")
    else:
        print(f"*** {FAIL_COUNT} 件失敗 ***")
        sys.exit(1)
