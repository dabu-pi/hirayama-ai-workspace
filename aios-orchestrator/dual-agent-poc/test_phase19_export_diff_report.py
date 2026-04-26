"""
test_phase19_export_diff_report.py — Phase 19: export 差分レポート自動生成テスト

テスト対象:
  - write_diff_report() text 形式でファイル書き出し
  - write_diff_report() json 形式でファイル書き出し
  - 差分なし → text report が差分なしメッセージを含む
  - 親ディレクトリ不在でも自動作成
  - 不正 fmt → ValueError
  - CLI --report-output でファイルが生成される（text）
  - CLI --report-output --json でファイルが生成される（JSON）
  - CLI --fail-on-diff × 差分あり → exit 1
  - CLI --fail-on-diff × 差分なし → exit 0
  - CLI --fail-on-diff + --report-output 組み合わせ

実行:
    cd aios-orchestrator/dual-agent-poc
    python test_phase19_export_diff_report.py
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from artifact_manifest_diff import compare_manifests
from export_diff_reporter import write_diff_report

_ORCHESTRATOR = str(Path(__file__).parent / "orchestrator.py")

# ─────────────────────────────────────────────────────────────────────────────
# ユーティリティ
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


def _make_manifest(artifacts: list[dict], conv_id: str = "conv-test",
                   ts: str = "2026-01-01T00:00:00Z") -> dict:
    return {
        "conv_id": conv_id,
        "export_timestamp": ts,
        "output_dir": "/tmp/out",
        "dry_run": False,
        "total": len(artifacts),
        "exported": len(artifacts),
        "skipped": 0,
        "errors": 0,
        "artifacts": artifacts,
    }


def _art(art_id: str, final_filename: str, filename_source: str = "explicit",
         collision_resolved: bool = False, turn_no: int = 1,
         language: str = "python", status: str = "exported") -> dict:
    return {
        "artifact_id":        art_id,
        "turn_no":            turn_no,
        "artifact_index":     0,
        "language":           language,
        "filename_source":    filename_source,
        "requested_filename": final_filename,
        "final_filename":     final_filename,
        "final_path":         f"/tmp/out/{final_filename}",
        "collision_resolved": collision_resolved,
        "status":             status,
    }


def _write_manifest_file(manifest: dict, path: Path) -> None:
    path.write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")


# ─────────────────────────────────────────────────────────────────────────────
# T01: text 形式でファイル書き出し
# ─────────────────────────────────────────────────────────────────────────────

def test_write_text_report():
    print("\n=== [T01] text 形式でファイル書き出し ===")
    old = _make_manifest([_art("aaa", "a.py")])
    new = _make_manifest([_art("aaa", "a.py"), _art("bbb", "b.py")])
    result = compare_manifests(old, new)

    with tempfile.TemporaryDirectory() as td:
        out_path = Path(td) / "report.txt"
        saved = write_diff_report(result, out_path, fmt="text")

        ok("ファイルが生成された",       out_path.exists())
        ok("返り値が絶対パス",           saved.is_absolute())
        content = out_path.read_text(encoding="utf-8")
        ok("内容に Manifest Diff を含む", "Manifest Diff" in content)
        ok("内容に [ADDED] を含む",       "[ADDED]"       in content)
        ok("内容に added:1 を示す数字",    "1" in content)


# ─────────────────────────────────────────────────────────────────────────────
# T02: json 形式でファイル書き出し
# ─────────────────────────────────────────────────────────────────────────────

def test_write_json_report():
    print("\n=== [T02] json 形式でファイル書き出し ===")
    old = _make_manifest([_art("aaa", "a.py")])
    new = _make_manifest([_art("aaa", "a.py"), _art("bbb", "b.py")])
    result = compare_manifests(old, new)

    with tempfile.TemporaryDirectory() as td:
        out_path = Path(td) / "report.json"
        saved = write_diff_report(result, out_path, fmt="json")

        ok("ファイルが生成された",        out_path.exists())
        data = json.loads(out_path.read_text(encoding="utf-8"))
        ok("JSON パース成功",             True)
        ok("summary.added == 1",          data["summary"]["added"]     == 1)
        ok("summary.unchanged == 1",      data["summary"]["unchanged"] == 1)
        ok("has_diff == True",            data["has_diff"]             is True)
        ok("added[0].artifact_id == bbb", data["added"][0]["artifact_id"] == "bbb")


# ─────────────────────────────────────────────────────────────────────────────
# T03: 差分なし → text report が差分なしメッセージを含む
# ─────────────────────────────────────────────────────────────────────────────

def test_write_no_diff_text_report():
    print("\n=== [T03] 差分なし → text report が差分なしメッセージを含む ===")
    m = _make_manifest([_art("aaa", "a.py"), _art("bbb", "b.py")])
    result = compare_manifests(m, m)

    with tempfile.TemporaryDirectory() as td:
        out_path = Path(td) / "nodiff.txt"
        write_diff_report(result, out_path, fmt="text")
        content = out_path.read_text(encoding="utf-8")
        ok("has_diff == False",           result.has_diff is False)
        ok("内容に差分なしメッセージ",     "差分なし" in content)


# ─────────────────────────────────────────────────────────────────────────────
# T04: 親ディレクトリ不在でも自動作成
# ─────────────────────────────────────────────────────────────────────────────

def test_auto_mkdir():
    print("\n=== [T04] 親ディレクトリ不在でも自動作成 ===")
    old = _make_manifest([_art("aaa", "a.py")])
    new = _make_manifest([_art("aaa", "a.py"), _art("bbb", "b.py")])
    result = compare_manifests(old, new)

    with tempfile.TemporaryDirectory() as td:
        nested = Path(td) / "deep" / "nested" / "dir" / "report.txt"
        ok("親ディレクトリは存在しない", not nested.parent.exists())
        write_diff_report(result, nested, fmt="text")
        ok("ファイルが生成された",       nested.exists())


# ─────────────────────────────────────────────────────────────────────────────
# T05: 不正 fmt → ValueError
# ─────────────────────────────────────────────────────────────────────────────

def test_invalid_fmt():
    print("\n=== [T05] 不正 fmt → ValueError ===")
    m = _make_manifest([_art("aaa", "a.py")])
    result = compare_manifests(m, m)

    with tempfile.TemporaryDirectory() as td:
        out_path = Path(td) / "report.xyz"
        try:
            write_diff_report(result, out_path, fmt="xml")
            ok("ValueError が発生すべき", False)
        except ValueError as exc:
            ok("ValueError が送出された",       True)
            ok("エラーメッセージに fmt を含む",  "fmt" in str(exc) or "xml" in str(exc))


# ─────────────────────────────────────────────────────────────────────────────
# T06: CLI --report-output でファイルが生成される（text）
# ─────────────────────────────────────────────────────────────────────────────

def test_cli_report_output_text():
    print("\n=== [T06] CLI --report-output でファイルが生成される（text）===")
    old = _make_manifest([_art("aaa", "a.py"), _art("bbb", "b.py")])
    new = _make_manifest([
        _art("aaa", "a_2.py", collision_resolved=True),
        _art("ccc", "c.py"),
    ])
    with tempfile.TemporaryDirectory() as td:
        old_path    = Path(td) / "old.json"
        new_path    = Path(td) / "new.json"
        report_path = Path(td) / "report.txt"
        _write_manifest_file(old, old_path)
        _write_manifest_file(new, new_path)

        result = subprocess.run(
            [sys.executable, _ORCHESTRATOR,
             "manifest-diff",
             "--old-manifest", str(old_path),
             "--new-manifest", str(new_path),
             "--report-output", str(report_path)],
            capture_output=True, text=True, encoding="utf-8",
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
            cwd=str(Path(_ORCHESTRATOR).parent),
        )
        ok("終了コード 0",               result.returncode == 0, got=result.returncode)
        ok("レポートファイルが生成された", report_path.exists())
        content = report_path.read_text(encoding="utf-8")
        ok("レポートに Manifest Diff",    "Manifest Diff" in content)
        ok("レポートに [ADDED]",          "[ADDED]"       in content)
        ok("レポートに [CHANGED]",        "[CHANGED]"     in content)
        ok("レポートに [REMOVED]",        "[REMOVED]"     in content)


# ─────────────────────────────────────────────────────────────────────────────
# T07: CLI --report-output --json でファイルが生成される（JSON）
# ─────────────────────────────────────────────────────────────────────────────

def test_cli_report_output_json():
    print("\n=== [T07] CLI --report-output --json でファイルが生成される（JSON）===")
    old = _make_manifest([_art("aaa", "a.py")])
    new = _make_manifest([_art("aaa", "a.py"), _art("bbb", "b.py")])
    with tempfile.TemporaryDirectory() as td:
        old_path    = Path(td) / "old.json"
        new_path    = Path(td) / "new.json"
        report_path = Path(td) / "report.json"
        _write_manifest_file(old, old_path)
        _write_manifest_file(new, new_path)

        result = subprocess.run(
            [sys.executable, _ORCHESTRATOR,
             "manifest-diff",
             "--old-manifest", str(old_path),
             "--new-manifest", str(new_path),
             "--json",
             "--report-output", str(report_path)],
            capture_output=True, text=True, encoding="utf-8",
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
            cwd=str(Path(_ORCHESTRATOR).parent),
        )
        ok("終了コード 0",               result.returncode == 0, got=result.returncode)
        ok("レポートファイルが生成された", report_path.exists())
        data = json.loads(report_path.read_text(encoding="utf-8"))
        ok("JSON パース成功",              True)
        ok("summary.added == 1",           data["summary"]["added"] == 1)
        ok("has_diff == True",             data["has_diff"]         is True)


# ─────────────────────────────────────────────────────────────────────────────
# T08: CLI --fail-on-diff × 差分あり → exit 1
# ─────────────────────────────────────────────────────────────────────────────

def test_cli_fail_on_diff_with_diff():
    print("\n=== [T08] CLI --fail-on-diff × 差分あり → exit 1 ===")
    old = _make_manifest([_art("aaa", "a.py")])
    new = _make_manifest([_art("aaa", "a.py"), _art("bbb", "b.py")])
    with tempfile.TemporaryDirectory() as td:
        old_path = Path(td) / "old.json"
        new_path = Path(td) / "new.json"
        _write_manifest_file(old, old_path)
        _write_manifest_file(new, new_path)

        result = subprocess.run(
            [sys.executable, _ORCHESTRATOR,
             "manifest-diff",
             "--old-manifest", str(old_path),
             "--new-manifest", str(new_path),
             "--fail-on-diff"],
            capture_output=True, text=True, encoding="utf-8",
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
            cwd=str(Path(_ORCHESTRATOR).parent),
        )
        ok("終了コード 1（差分あり）", result.returncode == 1, got=result.returncode)
        ok("stdout に Manifest Diff",  "Manifest Diff" in result.stdout)


# ─────────────────────────────────────────────────────────────────────────────
# T09: CLI --fail-on-diff × 差分なし → exit 0
# ─────────────────────────────────────────────────────────────────────────────

def test_cli_fail_on_diff_no_diff():
    print("\n=== [T09] CLI --fail-on-diff × 差分なし → exit 0 ===")
    m = _make_manifest([_art("aaa", "a.py"), _art("bbb", "b.py")])
    with tempfile.TemporaryDirectory() as td:
        old_path = Path(td) / "old.json"
        new_path = Path(td) / "new.json"
        _write_manifest_file(m, old_path)
        _write_manifest_file(m, new_path)

        result = subprocess.run(
            [sys.executable, _ORCHESTRATOR,
             "manifest-diff",
             "--old-manifest", str(old_path),
             "--new-manifest", str(new_path),
             "--fail-on-diff"],
            capture_output=True, text=True, encoding="utf-8",
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
            cwd=str(Path(_ORCHESTRATOR).parent),
        )
        ok("終了コード 0（差分なし）", result.returncode == 0, got=result.returncode)
        ok("stdout に差分なしメッセージ", "差分なし" in result.stdout)


# ─────────────────────────────────────────────────────────────────────────────
# T10: CLI --fail-on-diff + --report-output 組み合わせ
# ─────────────────────────────────────────────────────────────────────────────

def test_cli_fail_on_diff_with_report_output():
    print("\n=== [T10] CLI --fail-on-diff + --report-output 組み合わせ ===")
    old = _make_manifest([_art("aaa", "a.py")])
    new = _make_manifest([_art("aaa", "a.py"), _art("bbb", "b.py")])
    with tempfile.TemporaryDirectory() as td:
        old_path    = Path(td) / "old.json"
        new_path    = Path(td) / "new.json"
        report_path = Path(td) / "ci_report.txt"
        _write_manifest_file(old, old_path)
        _write_manifest_file(new, new_path)

        result = subprocess.run(
            [sys.executable, _ORCHESTRATOR,
             "manifest-diff",
             "--old-manifest", str(old_path),
             "--new-manifest", str(new_path),
             "--report-output", str(report_path),
             "--fail-on-diff"],
            capture_output=True, text=True, encoding="utf-8",
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
            cwd=str(Path(_ORCHESTRATOR).parent),
        )
        ok("終了コード 1（差分あり）",    result.returncode == 1, got=result.returncode)
        ok("レポートファイルが生成された", report_path.exists())
        content = report_path.read_text(encoding="utf-8")
        ok("レポートに差分内容が含まれる", "[ADDED]" in content)


# ─────────────────────────────────────────────────────────────────────────────
# メイン
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    test_write_text_report()
    test_write_json_report()
    test_write_no_diff_text_report()
    test_auto_mkdir()
    test_invalid_fmt()
    test_cli_report_output_text()
    test_cli_report_output_json()
    test_cli_fail_on_diff_with_diff()
    test_cli_fail_on_diff_no_diff()
    test_cli_fail_on_diff_with_report_output()

    print()
    print("=" * 60)
    print(f"PASS: {PASS_COUNT}  /  FAIL: {FAIL_COUNT}")
    if FAIL_COUNT == 0:
        print("全テストパス。")
    else:
        print(f"*** {FAIL_COUNT} 件失敗 ***")
        sys.exit(1)
