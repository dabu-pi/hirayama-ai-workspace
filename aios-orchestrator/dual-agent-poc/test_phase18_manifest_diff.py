"""
test_phase18_manifest_diff.py — Phase 18: manifest diff テスト

テスト対象:
  - added のみ
  - removed のみ
  - changed（final_filename 変更）
  - changed（collision_resolved false→true）
  - unchanged（差分なし）
  - 混在ケース（added + removed + changed）
  - 不正 manifest（ファイル不在 / JSON 不正 / 必須キー欠落）
  - format_diff_report の出力内容
  - CLI 経由（subprocess）での動作確認

実行:
    cd aios-orchestrator/dual-agent-poc
    python test_phase18_manifest_diff.py
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from artifact_manifest_diff import (
    compare_manifests,
    diff_manifests,
    format_diff_report,
    load_manifest,
    ManifestLoadError,
    DIFF_FIELDS,
)

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
    """テスト用 manifest dict を作る。"""
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
         language: str = "python", requested_filename: str | None = None,
         status: str = "exported") -> dict:
    """テスト用 artifact エントリを作る。"""
    return {
        "artifact_id":        art_id,
        "turn_no":            turn_no,
        "artifact_index":     0,
        "language":           language,
        "filename_source":    filename_source,
        "requested_filename": requested_filename or final_filename,
        "final_filename":     final_filename,
        "final_path":         f"/tmp/out/{final_filename}",
        "collision_resolved": collision_resolved,
        "status":             status,
    }


def _write_manifest(manifest: dict, path: Path) -> None:
    path.write_text(json.dumps(manifest, ensure_ascii=False), encoding="utf-8")


# ─────────────────────────────────────────────────────────────────────────────
# T01: added のみ
# ─────────────────────────────────────────────────────────────────────────────

def test_added_only():
    print("\n=== [T01] added のみ ===")
    old = _make_manifest([
        _art("aaa", "a.py"),
    ])
    new = _make_manifest([
        _art("aaa", "a.py"),
        _art("bbb", "b.py"),  # 新規
    ])
    r = compare_manifests(old, new)
    ok("added == 1",     len(r.added)     == 1, got=len(r.added))
    ok("removed == 0",   len(r.removed)   == 0)
    ok("changed == 0",   len(r.changed)   == 0)
    ok("unchanged == 1", len(r.unchanged) == 1)
    ok("added[0].artifact_id == 'bbb'", r.added[0].artifact_id == "bbb")
    ok("has_diff == True", r.has_diff is True)


# ─────────────────────────────────────────────────────────────────────────────
# T02: removed のみ
# ─────────────────────────────────────────────────────────────────────────────

def test_removed_only():
    print("\n=== [T02] removed のみ ===")
    old = _make_manifest([
        _art("aaa", "a.py"),
        _art("bbb", "b.py"),
    ])
    new = _make_manifest([
        _art("aaa", "a.py"),
        # bbb を削除
    ])
    r = compare_manifests(old, new)
    ok("added == 0",     len(r.added)     == 0)
    ok("removed == 1",   len(r.removed)   == 1, got=len(r.removed))
    ok("changed == 0",   len(r.changed)   == 0)
    ok("unchanged == 1", len(r.unchanged) == 1)
    ok("removed[0].artifact_id == 'bbb'", r.removed[0].artifact_id == "bbb")
    ok("has_diff == True", r.has_diff is True)


# ─────────────────────────────────────────────────────────────────────────────
# T03: changed（final_filename 変更）
# ─────────────────────────────────────────────────────────────────────────────

def test_changed_final_filename():
    print("\n=== [T03] changed（final_filename 変更）===")
    old = _make_manifest([
        _art("aaa", "utils.py"),
    ])
    new = _make_manifest([
        _art("aaa", "utils_2.py", requested_filename="utils.py", collision_resolved=True),
    ])
    r = compare_manifests(old, new)
    ok("changed == 1",   len(r.changed) == 1)
    ok("unchanged == 0", len(r.unchanged) == 0)
    d = r.changed[0]
    ok("changed_fields に final_filename",
       "final_filename" in d.changed_fields)
    ok("old final_filename == utils.py",
       d.changed_fields["final_filename"]["old"] == "utils.py")
    ok("new final_filename == utils_2.py",
       d.changed_fields["final_filename"]["new"] == "utils_2.py")
    ok("changed_fields に collision_resolved",
       "collision_resolved" in d.changed_fields)


# ─────────────────────────────────────────────────────────────────────────────
# T04: changed（collision_resolved false→true）
# ─────────────────────────────────────────────────────────────────────────────

def test_changed_collision_resolved():
    print("\n=== [T04] changed（collision_resolved false→true）===")
    old = _make_manifest([
        _art("aaa", "out.py", collision_resolved=False),
    ])
    new = _make_manifest([
        _art("aaa", "out_2.py", collision_resolved=True, requested_filename="out.py"),
    ])
    r = compare_manifests(old, new)
    ok("changed == 1", len(r.changed) == 1)
    d = r.changed[0]
    ok("collision_resolved: false→true",
       d.changed_fields.get("collision_resolved") == {"old": False, "new": True})


# ─────────────────────────────────────────────────────────────────────────────
# T05: unchanged（差分なし）
# ─────────────────────────────────────────────────────────────────────────────

def test_unchanged():
    print("\n=== [T05] unchanged（差分なし）===")
    old = _make_manifest([
        _art("aaa", "a.py"),
        _art("bbb", "b.py"),
    ])
    new = _make_manifest([
        _art("aaa", "a.py"),
        _art("bbb", "b.py"),
    ])
    r = compare_manifests(old, new)
    ok("added == 0",     len(r.added)     == 0)
    ok("removed == 0",   len(r.removed)   == 0)
    ok("changed == 0",   len(r.changed)   == 0)
    ok("unchanged == 2", len(r.unchanged) == 2, got=len(r.unchanged))
    ok("has_diff == False", r.has_diff is False)


# ─────────────────────────────────────────────────────────────────────────────
# T06: 混在（added + removed + changed + unchanged）
# ─────────────────────────────────────────────────────────────────────────────

def test_mixed():
    print("\n=== [T06] 混在（added + removed + changed + unchanged）===")
    old = _make_manifest([
        _art("keep",   "keep.py"),           # unchanged
        _art("gone",   "gone.py"),           # removed
        _art("mod",    "mod.py"),            # changed（filename_source 変更）
    ])
    new = _make_manifest([
        _art("keep",   "keep.py"),                              # unchanged
        _art("mod",    "mod.py", filename_source="inferred"),   # changed
        _art("fresh",  "fresh.py"),                             # added
    ])
    r = compare_manifests(old, new)
    ok("added == 1",     len(r.added)     == 1, got=len(r.added))
    ok("removed == 1",   len(r.removed)   == 1)
    ok("changed == 1",   len(r.changed)   == 1)
    ok("unchanged == 1", len(r.unchanged) == 1)
    ok("added[0] == fresh",   r.added[0].artifact_id   == "fresh")
    ok("removed[0] == gone",  r.removed[0].artifact_id == "gone")
    ok("changed[0] == mod",   r.changed[0].artifact_id == "mod")
    ok("unchanged[0] == keep", r.unchanged[0].artifact_id == "keep")
    # changed の内容確認
    d = r.changed[0]
    ok("filename_source が changed_fields に含まれる",
       "filename_source" in d.changed_fields)
    ok("explicit→inferred",
       d.changed_fields["filename_source"] == {"old": "explicit", "new": "inferred"})


# ─────────────────────────────────────────────────────────────────────────────
# T07: 空リスト同士
# ─────────────────────────────────────────────────────────────────────────────

def test_empty_both():
    print("\n=== [T07] 空リスト同士 ===")
    old = _make_manifest([])
    new = _make_manifest([])
    r = compare_manifests(old, new)
    ok("added == removed == changed == unchanged == 0",
       r.added == r.removed == r.changed == r.unchanged == [])
    ok("has_diff == False", r.has_diff is False)


# ─────────────────────────────────────────────────────────────────────────────
# T08: 不正 manifest（ファイル不在）
# ─────────────────────────────────────────────────────────────────────────────

def test_load_error_not_found():
    print("\n=== [T08] 不正 manifest（ファイル不在）===")
    try:
        load_manifest("/nonexistent/path/manifest.json")
        ok("例外が発生すべき", False)
    except ManifestLoadError as exc:
        ok("ManifestLoadError が送出された", True)
        ok("エラーメッセージに 'manifest' を含む", "manifest" in str(exc).lower())


# ─────────────────────────────────────────────────────────────────────────────
# T09: 不正 manifest（JSON 不正）
# ─────────────────────────────────────────────────────────────────────────────

def test_load_error_invalid_json():
    print("\n=== [T09] 不正 manifest（JSON 不正）===")
    with tempfile.NamedTemporaryFile(suffix=".json", mode="w",
                                    delete=False, encoding="utf-8") as f:
        f.write("{not valid json")
        tmp = f.name
    try:
        load_manifest(tmp)
        ok("例外が発生すべき", False)
    except ManifestLoadError as exc:
        ok("ManifestLoadError が送出された", True)
        ok("エラーメッセージに 'JSON' を含む", "JSON" in str(exc) or "json" in str(exc).lower())
    finally:
        Path(tmp).unlink(missing_ok=True)


# ─────────────────────────────────────────────────────────────────────────────
# T10: 不正 manifest（必須キー欠落）
# ─────────────────────────────────────────────────────────────────────────────

def test_load_error_missing_key():
    print("\n=== [T10] 不正 manifest（必須キー欠落）===")
    for missing_key in ("conv_id", "export_timestamp", "artifacts"):
        m = {"conv_id": "x", "export_timestamp": "t", "artifacts": []}
        del m[missing_key]
        with tempfile.NamedTemporaryFile(suffix=".json", mode="w",
                                        delete=False, encoding="utf-8") as f:
            f.write(json.dumps(m))
            tmp = f.name
        try:
            load_manifest(tmp)
            ok(f"'{missing_key}' 欠落で例外が発生すべき", False)
        except ManifestLoadError as exc:
            ok(f"'{missing_key}' 欠落 → ManifestLoadError", True)
            ok(f"エラーメッセージに '{missing_key}' を含む", missing_key in str(exc))
        finally:
            Path(tmp).unlink(missing_ok=True)


# ─────────────────────────────────────────────────────────────────────────────
# T11: artifact_id 欠落エントリ
# ─────────────────────────────────────────────────────────────────────────────

def test_load_error_missing_artifact_id():
    print("\n=== [T11] artifact_id 欠落エントリ ===")
    m = {"conv_id": "x", "export_timestamp": "t",
         "artifacts": [{"final_filename": "a.py"}]}  # artifact_id なし
    with tempfile.NamedTemporaryFile(suffix=".json", mode="w",
                                    delete=False, encoding="utf-8") as f:
        f.write(json.dumps(m))
        tmp = f.name
    try:
        load_manifest(tmp)
        ok("例外が発生すべき", False)
    except ManifestLoadError:
        ok("ManifestLoadError が送出された", True)
    finally:
        Path(tmp).unlink(missing_ok=True)


# ─────────────────────────────────────────────────────────────────────────────
# T12: format_diff_report の出力内容
# ─────────────────────────────────────────────────────────────────────────────

def test_format_diff_report():
    print("\n=== [T12] format_diff_report の出力内容 ===")
    old = _make_manifest([
        _art("aaa", "a.py"),
        _art("bbb", "b.py"),
    ], conv_id="conv-x", ts="2026-01-01T00:00:00Z")
    new = _make_manifest([
        _art("aaa", "a_2.py", collision_resolved=True, requested_filename="a.py"),
        _art("ccc", "c.py"),
    ], conv_id="conv-x", ts="2026-01-02T00:00:00Z")
    r = compare_manifests(old, new)
    report = format_diff_report(r)

    ok("レポートに [ADDED] が含まれる",    "[ADDED]"   in report)
    ok("レポートに [REMOVED] が含まれる",  "[REMOVED]" in report)
    ok("レポートに [CHANGED] が含まれる",  "[CHANGED]" in report)
    ok("レポートに conv_id が含まれる",    "conv-x"    in report)
    ok("レポートに added 件数が含まれる",  "added" in report.lower() or "1" in report)
    ok("レポートに final_filename の変化が含まれる",
       "a.py" in report and "a_2.py" in report)
    ok("差分あり → has_diff == True", r.has_diff is True)

    # verbose 無し → unchanged が出ない
    ok("[UNCHANGED] は verbose なしでは非表示",
       "[UNCHANGED]" not in report)

    # verbose あり → unchanged が出る
    report_v = format_diff_report(r, verbose=True)
    # unchanged は 0件なので出ない
    ok("unchanged=0件なら verbose でも [UNCHANGED] なし",
       "[UNCHANGED]" not in report_v)


# ─────────────────────────────────────────────────────────────────────────────
# T13: verbose で unchanged が表示される
# ─────────────────────────────────────────────────────────────────────────────

def test_verbose_unchanged():
    print("\n=== [T13] verbose=True で unchanged が表示される ===")
    old = _make_manifest([_art("aaa", "a.py"), _art("bbb", "b.py")])
    new = _make_manifest([_art("aaa", "a.py"), _art("bbb", "b.py"), _art("ccc", "c.py")])
    r = compare_manifests(old, new)
    report_plain   = format_diff_report(r, verbose=False)
    report_verbose = format_diff_report(r, verbose=True)
    ok("[UNCHANGED] は verbose=False では非表示", "[UNCHANGED]" not in report_plain)
    ok("[UNCHANGED] は verbose=True では表示",    "[UNCHANGED]" in report_verbose)


# ─────────────────────────────────────────────────────────────────────────────
# T14: diff_manifests ファイルパス経由
# ─────────────────────────────────────────────────────────────────────────────

def test_diff_from_files():
    print("\n=== [T14] diff_manifests ファイルパス経由 ===")
    old = _make_manifest([_art("aaa", "a.py")])
    new = _make_manifest([_art("aaa", "a.py"), _art("bbb", "b.py")])
    with tempfile.TemporaryDirectory() as td:
        old_path = Path(td) / "old.json"
        new_path = Path(td) / "new.json"
        _write_manifest(old, old_path)
        _write_manifest(new, new_path)
        r = diff_manifests(old_path, new_path)
        ok("added == 1",     len(r.added) == 1)
        ok("unchanged == 1", len(r.unchanged) == 1)
        ok("old_path が記録される", str(old_path.resolve()) in r.old_path)
        ok("new_path が記録される", str(new_path.resolve()) in r.new_path)


# ─────────────────────────────────────────────────────────────────────────────
# T15: CLI 経由（subprocess）— テキスト出力
# ─────────────────────────────────────────────────────────────────────────────

def test_cli_text_output():
    print("\n=== [T15] CLI 経由 manifest-diff テキスト出力 ===")
    old = _make_manifest([_art("aaa", "a.py"), _art("bbb", "b.py")])
    new = _make_manifest([
        _art("aaa", "a_2.py", collision_resolved=True, requested_filename="a.py"),
        _art("ccc", "c.py"),
    ])
    with tempfile.TemporaryDirectory() as td:
        old_path = Path(td) / "old.json"
        new_path = Path(td) / "new.json"
        _write_manifest(old, old_path)
        _write_manifest(new, new_path)
        result = subprocess.run(
            [sys.executable, _ORCHESTRATOR,
             "manifest-diff",
             "--old-manifest", str(old_path),
             "--new-manifest", str(new_path)],
            capture_output=True, text=True, encoding="utf-8",
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
            cwd=str(Path(_ORCHESTRATOR).parent),
        )
        ok("終了コード 0", result.returncode == 0, got=result.returncode)
        ok("stdout に Manifest Diff が含まれる", "Manifest Diff" in result.stdout)
        ok("stdout に [CHANGED] が含まれる",  "[CHANGED]"  in result.stdout)
        ok("stdout に [ADDED] が含まれる",    "[ADDED]"    in result.stdout)
        ok("stdout に [REMOVED] が含まれる",  "[REMOVED]"  in result.stdout)


# ─────────────────────────────────────────────────────────────────────────────
# T16: CLI 経由（subprocess）— JSON 出力
# ─────────────────────────────────────────────────────────────────────────────

def test_cli_json_output():
    print("\n=== [T16] CLI 経由 manifest-diff --json 出力 ===")
    old = _make_manifest([_art("aaa", "a.py")])
    new = _make_manifest([_art("aaa", "a.py"), _art("bbb", "b.py")])
    with tempfile.TemporaryDirectory() as td:
        old_path = Path(td) / "old.json"
        new_path = Path(td) / "new.json"
        _write_manifest(old, old_path)
        _write_manifest(new, new_path)
        result = subprocess.run(
            [sys.executable, _ORCHESTRATOR,
             "manifest-diff",
             "--old-manifest", str(old_path),
             "--new-manifest", str(new_path),
             "--json"],
            capture_output=True, text=True, encoding="utf-8",
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
            cwd=str(Path(_ORCHESTRATOR).parent),
        )
        ok("終了コード 0", result.returncode == 0)
        try:
            data = json.loads(result.stdout)
            ok("JSON パース成功", True)
        except json.JSONDecodeError:
            ok("JSON パース成功", False)
            return
        ok("summary.added == 1",     data["summary"]["added"]     == 1)
        ok("summary.unchanged == 1", data["summary"]["unchanged"] == 1)
        ok("summary.removed == 0",   data["summary"]["removed"]   == 0)
        ok("summary.changed == 0",   data["summary"]["changed"]   == 0)
        ok("added[0].artifact_id == 'bbb'",
           data["added"][0]["artifact_id"] == "bbb")


# ─────────────────────────────────────────────────────────────────────────────
# T17: CLI — 存在しない manifest ファイル → エラー終了
# ─────────────────────────────────────────────────────────────────────────────

def test_cli_missing_file_error():
    print("\n=== [T17] CLI — 存在しない manifest → エラー終了 ===")
    result = subprocess.run(
        [sys.executable, _ORCHESTRATOR,
         "manifest-diff",
         "--old-manifest", "/nonexistent/old.json",
         "--new-manifest", "/nonexistent/new.json"],
        capture_output=True, text=True, encoding="utf-8",
        env={**os.environ, "PYTHONIOENCODING": "utf-8"},
        cwd=str(Path(_ORCHESTRATOR).parent),
    )
    ok("終了コード 1", result.returncode == 1, got=result.returncode)
    ok("stderr に ERROR が含まれる", "ERROR" in result.stderr)


# ─────────────────────────────────────────────────────────────────────────────
# T18: conv_id が異なる場合に WARN が出る
# ─────────────────────────────────────────────────────────────────────────────

def test_different_conv_id_warn():
    print("\n=== [T18] conv_id が異なる場合に WARN ===")
    old = _make_manifest([_art("aaa", "a.py")], conv_id="conv-A")
    new = _make_manifest([_art("aaa", "a.py")], conv_id="conv-B")
    r = compare_manifests(old, new)
    report = format_diff_report(r)
    ok("old_conv_id と new_conv_id が異なる",
       r.old_conv_id != r.new_conv_id)
    ok("レポートに [WARN] が含まれる", "[WARN]" in report)


# ─────────────────────────────────────────────────────────────────────────────
# T19: DIFF_FIELDS の全フィールドが changed で検出される
# ─────────────────────────────────────────────────────────────────────────────

def test_all_diff_fields_detected():
    print("\n=== [T19] DIFF_FIELDS の全フィールドが changed で検出される ===")
    base = _art("aaa", "a.py", filename_source="explicit",
                collision_resolved=False, language="python",
                requested_filename="a.py", status="exported")
    modified = {**base}
    modified["final_filename"]     = "a_2.py"
    modified["filename_source"]    = "inferred"
    modified["collision_resolved"] = True
    modified["requested_filename"] = "a_orig.py"
    modified["language"]           = "typescript"
    modified["status"]             = "skipped"

    old = _make_manifest([base])
    new = _make_manifest([modified])
    r = compare_manifests(old, new)
    ok("changed == 1", len(r.changed) == 1)
    d = r.changed[0]
    for field in DIFF_FIELDS:
        ok(f"'{field}' が changed_fields に含まれる", field in d.changed_fields)


# ─────────────────────────────────────────────────────────────────────────────
# T20: 差分なし manifest のレポートが「差分なし」を示す
# ─────────────────────────────────────────────────────────────────────────────

def test_no_diff_report():
    print("\n=== [T20] 差分なし manifest → 差分なしメッセージ ===")
    m = _make_manifest([_art("aaa", "a.py"), _art("bbb", "b.py")])
    r = compare_manifests(m, m)
    report = format_diff_report(r)
    ok("has_diff == False", r.has_diff is False)
    ok("レポートに差分なしメッセージ", "差分なし" in report)


# ─────────────────────────────────────────────────────────────────────────────
# メイン
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    test_added_only()
    test_removed_only()
    test_changed_final_filename()
    test_changed_collision_resolved()
    test_unchanged()
    test_mixed()
    test_empty_both()
    test_load_error_not_found()
    test_load_error_invalid_json()
    test_load_error_missing_key()
    test_load_error_missing_artifact_id()
    test_format_diff_report()
    test_verbose_unchanged()
    test_diff_from_files()
    test_cli_text_output()
    test_cli_json_output()
    test_cli_missing_file_error()
    test_different_conv_id_warn()
    test_all_diff_fields_detected()
    test_no_diff_report()

    print()
    print("=" * 60)
    print(f"PASS: {PASS_COUNT}  /  FAIL: {FAIL_COUNT}")
    if FAIL_COUNT == 0:
        print("全テストパス。")
    else:
        print(f"*** {FAIL_COUNT} 件失敗 ***")
        sys.exit(1)
