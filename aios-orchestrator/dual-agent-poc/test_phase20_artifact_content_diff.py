"""
test_phase20_artifact_content_diff.py — Phase 20: artifact 内容 diff 比較テスト

テスト対象:
  - hash_content() SHA-256 一貫性
  - read_artifact_file() 正常 / 不在 / バイナリ非対応
  - content_diff() / diff_stat() unified diff 生成と行数カウント
  - compare_export_dirs() same / changed / old_only / new_only / binary / missing
  - format_content_diff_report() テキストレポートの構造
  - result_to_json_dict() JSON シリアライズ
  - write_content_diff_report() ファイル書き出し（text / json / 不正 fmt）
  - CLI content-diff --json / --report-output / --fail-on-diff

実行:
    cd aios-orchestrator/dual-agent-poc
    python test_phase20_artifact_content_diff.py
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from artifact_content_diff import (
    hash_content,
    read_artifact_file,
    content_diff,
    diff_stat,
    compare_export_dirs,
    format_content_diff_report,
    result_to_json_dict,
    write_content_diff_report,
)

_ORCHESTRATOR = str(Path(__file__).parent / "orchestrator.py")
_MANIFEST_FILENAME = "artifact_export_manifest.json"

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
                   ts: str = "2026-01-01T00:00:00Z", output_dir: str = "/tmp/out") -> dict:
    return {
        "conv_id":          conv_id,
        "export_timestamp": ts,
        "output_dir":       output_dir,
        "dry_run":          False,
        "total":            len(artifacts),
        "exported":         len(artifacts),
        "skipped":          0,
        "errors":           0,
        "artifacts":        artifacts,
    }


def _art(art_id: str, final_filename: str, turn_no: int = 1,
         language: str = "python", status: str = "exported") -> dict:
    return {
        "artifact_id":        art_id,
        "turn_no":            turn_no,
        "artifact_index":     0,
        "language":           language,
        "filename_source":    "explicit",
        "requested_filename": final_filename,
        "final_filename":     final_filename,
        "final_path":         f"/tmp/out/{final_filename}",
        "collision_resolved": False,
        "status":             status,
    }


def _write_manifest(td: str, manifest: dict) -> None:
    Path(td, _MANIFEST_FILENAME).write_text(
        json.dumps(manifest, ensure_ascii=False), encoding="utf-8"
    )


def _write_file(td: str, filename: str, content: str) -> None:
    Path(td, filename).write_text(content, encoding="utf-8")


# ─────────────────────────────────────────────────────────────────────────────
# T01: hash_content — 同一テキスト → 同一ハッシュ、異なるテキスト → 異なるハッシュ
# ─────────────────────────────────────────────────────────────────────────────

def test_hash_content():
    print("\n=== [T01] hash_content ===")
    h1 = hash_content("hello")
    h2 = hash_content("hello")
    h3 = hash_content("world")
    ok("同一テキスト → 同一ハッシュ",           h1 == h2)
    ok("異なるテキスト → 異なるハッシュ",       h1 != h3)
    ok("ハッシュは 64 文字の hex",              len(h1) == 64)
    ok("空文字列もハッシュ生成可",              len(hash_content("")) == 64)


# ─────────────────────────────────────────────────────────────────────────────
# T02: read_artifact_file — 正常 / 不在
# ─────────────────────────────────────────────────────────────────────────────

def test_read_artifact_file():
    print("\n=== [T02] read_artifact_file ===")
    with tempfile.TemporaryDirectory() as td:
        p = Path(td)
        _write_file(td, "hello.py", "print('hello')\n")

        content = read_artifact_file(p, "hello.py")
        ok("存在するファイルを読み込む",           content == "print('hello')\n")
        ok("不在ファイルは None",                 read_artifact_file(p, "no_such.py") is None)


# ─────────────────────────────────────────────────────────────────────────────
# T03: content_diff / diff_stat — 差分あり・なし
# ─────────────────────────────────────────────────────────────────────────────

def test_content_diff_and_stat():
    print("\n=== [T03] content_diff / diff_stat ===")
    old = "line1\nline2\nline3\n"
    new = "line1\nline2_changed\nline3\nline4\n"
    diff = content_diff(old, new, "old.py", "new.py")
    added, removed = diff_stat(diff)

    ok("差分あり → diff_text が非空",            bool(diff))
    ok("追加行あり (line4, line2_changed)",       added >= 2)
    ok("削除行あり (line2)",                     removed >= 1)
    ok("差分なし → 空文字列",                    content_diff(old, old) == "")

    diff_none = content_diff(old, old)
    a, r = diff_stat(diff_none)
    ok("差分なし → added=0, removed=0",           a == 0 and r == 0)


# ─────────────────────────────────────────────────────────────────────────────
# T04: compare_export_dirs — same
# ─────────────────────────────────────────────────────────────────────────────

def test_compare_same():
    print("\n=== [T04] compare_export_dirs — same ===")
    with tempfile.TemporaryDirectory() as old_td, tempfile.TemporaryDirectory() as new_td:
        m = _make_manifest([_art("aaa", "a.py"), _art("bbb", "b.py")])
        for td in (old_td, new_td):
            _write_manifest(td, m)
            _write_file(td, "a.py", "x = 1\n")
            _write_file(td, "b.py", "y = 2\n")

        result = compare_export_dirs(Path(old_td), Path(new_td), m, m)
        ok("has_diff == False",              not result.has_diff)
        ok("same が 2 件",                   len(result.same) == 2)
        ok("changed が 0 件",               len(result.changed) == 0)


# ─────────────────────────────────────────────────────────────────────────────
# T05: compare_export_dirs — changed
# ─────────────────────────────────────────────────────────────────────────────

def test_compare_changed():
    print("\n=== [T05] compare_export_dirs — changed ===")
    with tempfile.TemporaryDirectory() as old_td, tempfile.TemporaryDirectory() as new_td:
        m = _make_manifest([_art("aaa", "a.py")])
        _write_manifest(old_td, m)
        _write_manifest(new_td, m)
        _write_file(old_td, "a.py", "x = 1\n")
        _write_file(new_td, "a.py", "x = 2\n")  # 変更あり

        result = compare_export_dirs(Path(old_td), Path(new_td), m, m)
        ok("has_diff == True",               result.has_diff)
        ok("changed が 1 件",               len(result.changed) == 1)
        ok("diff_text が非空",               bool(result.changed[0].diff_text))
        ok("added_lines >= 1",              result.changed[0].added_lines >= 1)
        ok("removed_lines >= 1",            result.changed[0].removed_lines >= 1)
        ok("old_hash != new_hash",          result.changed[0].old_hash != result.changed[0].new_hash)


# ─────────────────────────────────────────────────────────────────────────────
# T06: compare_export_dirs — old_only / new_only
# ─────────────────────────────────────────────────────────────────────────────

def test_compare_only():
    print("\n=== [T06] compare_export_dirs — old_only / new_only ===")
    with tempfile.TemporaryDirectory() as old_td, tempfile.TemporaryDirectory() as new_td:
        old_m = _make_manifest([_art("aaa", "a.py"), _art("bbb", "b.py")])
        new_m = _make_manifest([_art("aaa", "a.py"), _art("ccc", "c.py")])
        _write_manifest(old_td, old_m)
        _write_manifest(new_td, new_m)
        _write_file(old_td, "a.py", "x = 1\n")
        _write_file(old_td, "b.py", "y = 2\n")
        _write_file(new_td, "a.py", "x = 1\n")
        _write_file(new_td, "c.py", "z = 3\n")

        result = compare_export_dirs(Path(old_td), Path(new_td), old_m, new_m)
        ok("has_diff == True",              result.has_diff)
        ok("old_only が 1 件",              len(result.old_only) == 1)
        ok("old_only[0] は bbb",            result.old_only[0].artifact_id == "bbb")
        ok("new_only が 1 件",              len(result.new_only) == 1)
        ok("new_only[0] は ccc",            result.new_only[0].artifact_id == "ccc")
        ok("same が 1 件",                  len(result.same) == 1)


# ─────────────────────────────────────────────────────────────────────────────
# T07: compare_export_dirs — missing（実ファイル不在）
# ─────────────────────────────────────────────────────────────────────────────

def test_compare_missing():
    print("\n=== [T07] compare_export_dirs — missing ===")
    with tempfile.TemporaryDirectory() as old_td, tempfile.TemporaryDirectory() as new_td:
        m = _make_manifest([_art("zzz", "z.py")])
        _write_manifest(old_td, m)
        _write_manifest(new_td, m)
        # ファイルを書かない → 両側とも不在

        result = compare_export_dirs(Path(old_td), Path(new_td), m, m)
        ok("missing が 1 件",               len(result.skipped) == 1)
        ok("category == missing",           result.skipped[0].category == "missing")


# ─────────────────────────────────────────────────────────────────────────────
# T08: format_content_diff_report — 差分あり・なし
# ─────────────────────────────────────────────────────────────────────────────

def test_format_report():
    print("\n=== [T08] format_content_diff_report ===")
    with tempfile.TemporaryDirectory() as old_td, tempfile.TemporaryDirectory() as new_td:
        m = _make_manifest([_art("aaa", "a.py")])
        _write_manifest(old_td, m)
        _write_manifest(new_td, m)
        _write_file(old_td, "a.py", "x = 1\n")
        _write_file(new_td, "a.py", "x = 2\n")

        result = compare_export_dirs(Path(old_td), Path(new_td), m, m)
        report = format_content_diff_report(result)
        ok("Content Diff を含む",            "Content Diff" in report)
        ok("[CHANGED] を含む",               "[CHANGED]" in report)
        ok("diff テキストを含む",             "@@" in report)

        report_no_diff = format_content_diff_report(result, show_diff=False)
        ok("--no-diff 時は @@ を含まない",   "@@" not in report_no_diff)

    # 差分なし
    with tempfile.TemporaryDirectory() as old_td, tempfile.TemporaryDirectory() as new_td:
        m2 = _make_manifest([_art("aaa", "a.py")])
        for td in (old_td, new_td):
            _write_manifest(td, m2)
            _write_file(td, "a.py", "x = 1\n")
        result2 = compare_export_dirs(Path(old_td), Path(new_td), m2, m2)
        report2 = format_content_diff_report(result2)
        ok("差分なしメッセージを含む",        "差分なし" in report2)


# ─────────────────────────────────────────────────────────────────────────────
# T09: result_to_json_dict — JSON 変換
# ─────────────────────────────────────────────────────────────────────────────

def test_result_to_json():
    print("\n=== [T09] result_to_json_dict ===")
    with tempfile.TemporaryDirectory() as old_td, tempfile.TemporaryDirectory() as new_td:
        m = _make_manifest([_art("aaa", "a.py"), _art("bbb", "b.py")])
        _write_manifest(old_td, m)
        _write_manifest(new_td, m)
        _write_file(old_td, "a.py", "x = 1\n")
        _write_file(new_td, "a.py", "x = 2\n")  # changed
        _write_file(old_td, "b.py", "y = 2\n")
        _write_file(new_td, "b.py", "y = 2\n")  # same

        result = compare_export_dirs(Path(old_td), Path(new_td), m, m)
        d = result_to_json_dict(result)

        ok("JSON にシリアライズ可能",        json.dumps(d) is not None)
        ok("has_diff == True",               d["has_diff"] is True)
        ok("summary.changed == 1",           d["summary"]["changed"] == 1)
        ok("summary.same == 1",             d["summary"]["same"] == 1)
        ok("changed[0] に diff_text あり",   "diff_text" in d["changed"][0])
        ok("same[0] に diff_text なし",      "diff_text" not in d["same"][0])


# ─────────────────────────────────────────────────────────────────────────────
# T10: write_content_diff_report — text / json / 不正 fmt
# ─────────────────────────────────────────────────────────────────────────────

def test_write_content_diff_report():
    print("\n=== [T10] write_content_diff_report ===")
    with tempfile.TemporaryDirectory() as old_td, tempfile.TemporaryDirectory() as new_td:
        m = _make_manifest([_art("aaa", "a.py")])
        _write_manifest(old_td, m)
        _write_manifest(new_td, m)
        _write_file(old_td, "a.py", "x = 1\n")
        _write_file(new_td, "a.py", "x = 2\n")
        result = compare_export_dirs(Path(old_td), Path(new_td), m, m)

        with tempfile.TemporaryDirectory() as out_td:
            # text
            txt_path = Path(out_td) / "report.txt"
            saved = write_content_diff_report(result, txt_path, fmt="text")
            ok("text ファイル生成済み",        txt_path.exists())
            ok("返り値が絶対パス",             saved.is_absolute())
            ok("text に Content Diff 含む",    "Content Diff" in txt_path.read_text(encoding="utf-8"))

            # json
            json_path = Path(out_td) / "report.json"
            write_content_diff_report(result, json_path, fmt="json")
            ok("json ファイル生成済み",        json_path.exists())
            data = json.loads(json_path.read_text(encoding="utf-8"))
            ok("json.has_diff == True",       data["has_diff"] is True)

            # 不正 fmt → ValueError
            try:
                write_content_diff_report(result, Path(out_td) / "x.xyz", fmt="xml")
                ok("ValueError が発生すべき",  False)
            except ValueError:
                ok("ValueError が送出された",  True)

            # 親ディレクトリ不在でも自動作成
            nested = Path(out_td) / "deep" / "nested" / "report.txt"
            ok("親ディレクトリは不在",         not nested.parent.exists())
            write_content_diff_report(result, nested, fmt="text")
            ok("ネストされたファイル生成済み",  nested.exists())


# ─────────────────────────────────────────────────────────────────────────────
# T11: CLI content-diff — 差分あり（stdout に Content Diff を含む）
# ─────────────────────────────────────────────────────────────────────────────

def test_cli_content_diff_with_diff():
    print("\n=== [T11] CLI content-diff — 差分あり ===")
    with tempfile.TemporaryDirectory() as old_td, tempfile.TemporaryDirectory() as new_td:
        m_old = _make_manifest([_art("aaa", "a.py")])
        m_new = _make_manifest([_art("aaa", "a.py"), _art("bbb", "b.py")])
        _write_manifest(old_td, m_old)
        _write_manifest(new_td, m_new)
        _write_file(old_td, "a.py", "x = 1\n")
        _write_file(new_td, "a.py", "x = 1\n")
        _write_file(new_td, "b.py", "y = 2\n")

        result = subprocess.run(
            [sys.executable, _ORCHESTRATOR,
             "content-diff",
             "--old-dir", old_td,
             "--new-dir", new_td],
            capture_output=True, text=True, encoding="utf-8",
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
            cwd=str(Path(_ORCHESTRATOR).parent),
        )
        ok("終了コード 0",                 result.returncode == 0, got=result.returncode)
        ok("stdout に Content Diff",       "Content Diff" in result.stdout)
        ok("stdout に [NEW ONLY]",         "[NEW ONLY]" in result.stdout)


# ─────────────────────────────────────────────────────────────────────────────
# T12: CLI content-diff --fail-on-diff — 差分あり → exit 1
# ─────────────────────────────────────────────────────────────────────────────

def test_cli_fail_on_diff():
    print("\n=== [T12] CLI --fail-on-diff — 差分あり → exit 1 ===")
    with tempfile.TemporaryDirectory() as old_td, tempfile.TemporaryDirectory() as new_td:
        m_old = _make_manifest([_art("aaa", "a.py")])
        m_new = _make_manifest([_art("aaa", "a.py"), _art("bbb", "b.py")])
        _write_manifest(old_td, m_old)
        _write_manifest(new_td, m_new)
        _write_file(old_td, "a.py", "x = 1\n")
        _write_file(new_td, "a.py", "x = 1\n")
        _write_file(new_td, "b.py", "y = 2\n")

        result = subprocess.run(
            [sys.executable, _ORCHESTRATOR,
             "content-diff",
             "--old-dir", old_td,
             "--new-dir", new_td,
             "--fail-on-diff"],
            capture_output=True, text=True, encoding="utf-8",
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
            cwd=str(Path(_ORCHESTRATOR).parent),
        )
        ok("終了コード 1（差分あり）",      result.returncode == 1, got=result.returncode)


# ─────────────────────────────────────────────────────────────────────────────
# T13: CLI content-diff --fail-on-diff — 差分なし → exit 0
# ─────────────────────────────────────────────────────────────────────────────

def test_cli_no_diff_exit0():
    print("\n=== [T13] CLI --fail-on-diff — 差分なし → exit 0 ===")
    with tempfile.TemporaryDirectory() as old_td, tempfile.TemporaryDirectory() as new_td:
        m = _make_manifest([_art("aaa", "a.py")])
        for td in (old_td, new_td):
            _write_manifest(td, m)
            _write_file(td, "a.py", "x = 1\n")

        result = subprocess.run(
            [sys.executable, _ORCHESTRATOR,
             "content-diff",
             "--old-dir", old_td,
             "--new-dir", new_td,
             "--fail-on-diff"],
            capture_output=True, text=True, encoding="utf-8",
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
            cwd=str(Path(_ORCHESTRATOR).parent),
        )
        ok("終了コード 0（差分なし）",      result.returncode == 0, got=result.returncode)
        ok("stdout に差分なしメッセージ",   "差分なし" in result.stdout)


# ─────────────────────────────────────────────────────────────────────────────
# T14: CLI content-diff --json — JSON 形式出力
# ─────────────────────────────────────────────────────────────────────────────

def test_cli_json_output():
    print("\n=== [T14] CLI --json — JSON 形式出力 ===")
    with tempfile.TemporaryDirectory() as old_td, tempfile.TemporaryDirectory() as new_td:
        m = _make_manifest([_art("aaa", "a.py")])
        _write_manifest(old_td, m)
        _write_manifest(new_td, m)
        _write_file(old_td, "a.py", "x = 1\n")
        _write_file(new_td, "a.py", "x = 2\n")

        result = subprocess.run(
            [sys.executable, _ORCHESTRATOR,
             "content-diff",
             "--old-dir", old_td,
             "--new-dir", new_td,
             "--json"],
            capture_output=True, text=True, encoding="utf-8",
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
            cwd=str(Path(_ORCHESTRATOR).parent),
        )
        ok("終了コード 0",                 result.returncode == 0, got=result.returncode)
        try:
            data = json.loads(result.stdout)
            ok("JSON パース成功",           True)
            ok("has_diff == True",          data["has_diff"] is True)
            ok("summary.changed == 1",      data["summary"]["changed"] == 1)
        except (json.JSONDecodeError, KeyError) as exc:
            ok("JSON パース成功",           False, got=str(exc))
            ok("has_diff == True",          False)
            ok("summary.changed == 1",      False)


# ─────────────────────────────────────────────────────────────────────────────
# T15: CLI content-diff --report-output — ファイル保存
# ─────────────────────────────────────────────────────────────────────────────

def test_cli_report_output():
    print("\n=== [T15] CLI --report-output — ファイル保存 ===")
    with tempfile.TemporaryDirectory() as old_td, tempfile.TemporaryDirectory() as new_td:
        m = _make_manifest([_art("aaa", "a.py")])
        _write_manifest(old_td, m)
        _write_manifest(new_td, m)
        _write_file(old_td, "a.py", "x = 1\n")
        _write_file(new_td, "a.py", "x = 2\n")

        with tempfile.TemporaryDirectory() as out_td:
            report_path = Path(out_td) / "content_report.txt"
            result = subprocess.run(
                [sys.executable, _ORCHESTRATOR,
                 "content-diff",
                 "--old-dir", old_td,
                 "--new-dir", new_td,
                 "--report-output", str(report_path)],
                capture_output=True, text=True, encoding="utf-8",
                env={**os.environ, "PYTHONIOENCODING": "utf-8"},
                cwd=str(Path(_ORCHESTRATOR).parent),
            )
            ok("終了コード 0",                 result.returncode == 0, got=result.returncode)
            ok("レポートファイル生成済み",      report_path.exists())
            content = report_path.read_text(encoding="utf-8")
            ok("レポートに Content Diff 含む",  "Content Diff" in content)
            ok("レポートに [CHANGED] 含む",     "[CHANGED]" in content)


# ─────────────────────────────────────────────────────────────────────────────
# メイン
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    test_hash_content()
    test_read_artifact_file()
    test_content_diff_and_stat()
    test_compare_same()
    test_compare_changed()
    test_compare_only()
    test_compare_missing()
    test_format_report()
    test_result_to_json()
    test_write_content_diff_report()
    test_cli_content_diff_with_diff()
    test_cli_fail_on_diff()
    test_cli_no_diff_exit0()
    test_cli_json_output()
    test_cli_report_output()

    print()
    print("=" * 60)
    print(f"PASS: {PASS_COUNT}  /  FAIL: {FAIL_COUNT}")
    if FAIL_COUNT == 0:
        print("全テストパス。")
    else:
        print(f"*** {FAIL_COUNT} 件失敗 ***")
        sys.exit(1)
