"""
test_phase3_dashboard.py — Phase 3 Dashboard 反映の dry-run 検証

実行:
    PYTHONIOENCODING=utf-8 PYTHONUTF8=1 python test_phase3_dashboard.py

前提:
    API キー不要（dry_run=True で mock）
    独立した data/test_phase3.db を使う
    Sheet への実書き込みなし（dry_run モード）

検証項目:
    1. エントリ構築: 5つの status に対して正しく result をマッピング
    2. ローカル JSON が logs/aios-orchestrator/ に書き出される
    3. dry-run で run_loop → command_run → Dashboard ローカル保存まで通る
    4. 冪等チェック: 同じ conv_id を 2 回報告してもスキップされる
    5. 失敗耐性: _report_to_dashboard が例外を投げても run_loop が止まらない
    6. run_log に dashboard_reported / dashboard_skipped が残る
    7. next_action が summary から正しく抽出される
"""

from __future__ import annotations

import sys
import json
import shutil
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from store import (
    init_db, create_conversation, get_conversation,
    get_run_log, append_message, update_summary,
)
from orchestrator import run_loop, _report_to_dashboard_safely
from run_logger import log_session_start
from dashboard_reporter import (
    build_entry, export_local, _load_reported, _save_reported,
    _REPORTED_FILE, _LOCAL_LOG_DIR,
)
import dashboard_reporter as dr_mod


_DB = str(Path(__file__).parent / "data" / "test_phase3.db")

# テスト用 reported_sessions.json は別パスに隔離
_TEST_REPORTED = _LOCAL_LOG_DIR / "test_reported_sessions.json"

if Path(_DB).exists():
    Path(_DB).unlink()

# reported_sessions.json をテスト用に差し替え
_orig_reported_file = dr_mod._REPORTED_FILE
dr_mod._REPORTED_FILE = _TEST_REPORTED
if _TEST_REPORTED.exists():
    _TEST_REPORTED.unlink()


def _assert(cond: bool, msg: str) -> None:
    if not cond:
        print(f"  [FAIL] {msg}")
        sys.exit(1)
    print(f"  [OK]   {msg}")


def _start_conv(goal: str, project_id: str = "test-phase3") -> str:
    init_db(_DB)
    conv_id = create_conversation(_DB, title=goal[:80], role_system="test", project_id=project_id)
    append_message(_DB, conv_id, turn_id=0, role_executor="planner",
                   source_model="human", target_model="gpt-4o", content=f"[GOAL] {goal}")
    log_session_start(_DB, conv_id, goal=goal)
    return conv_id


# ─── Test 1: build_entry の status → result マッピング ──────────────────────
print("\n=== [Test 1] build_entry: status → result マッピング ===")

cases = [
    ("completed",        "SUCCESS"),
    ("waiting_approval", "STOP"),
    ("failed",           "ERROR"),
    ("in_progress",      "PARTIAL"),
    ("unknown_xyz",      "PARTIAL"),
]
for status, expected_result in cases:
    fake_conv = {
        "conversation_id": "aaaa-bbbb-cccc-dddd",
        "project_id":      "test-proj",
        "title":           "test goal",
        "status":          status,
        "turn_count":      3,
        "summary":         "目的: test\n次アクション: 次のステップを実行",
        "updated_at":      "2026-04-15T12:00:00+00:00",
    }
    entry = build_entry(fake_conv, [])
    _assert(entry["result"] == expected_result,
            f"status={status} → result={entry['result']} (expected {expected_result})")
    _assert(entry["system"] == "aios-orchestrator", "system フィールドが正しい")

# next_action 抽出テスト
entry = build_entry({
    "conversation_id": "x", "project_id": "p", "title": "t",
    "status": "completed", "turn_count": 1,
    "summary": "目的: xxx\n重要な決定事項:\n- abc\n次アクション: フィルタを追加",
    "updated_at": "2026-04-15T00:00:00+00:00",
}, [])
_assert(entry["next_action"] == "フィルタを追加",
        f"next_action を summary から正しく抽出 (actual: '{entry['next_action']}')")

# ─── Test 2: ローカル JSON 保存 ──────────────────────────────────────────────
print("\n=== [Test 2] ローカル JSON が logs/aios-orchestrator/ に書き出される ===")

fake_entry = build_entry({
    "conversation_id": "test-local-save",
    "project_id": "test", "title": "local save test",
    "status": "completed", "turn_count": 2,
    "summary": None, "updated_at": "2026-04-15T12:00:00+00:00",
}, [])
path = export_local(fake_entry, timestamp="20260415_120000")
_assert(path.exists(), f"JSON ファイルが作成された: {path.name}")
content = json.loads(path.read_text(encoding="utf-8"))
_assert(content["system"] == "aios-orchestrator", "system フィールドが JSON に含まれる")
_assert(content["result"] == "SUCCESS", "result フィールドが JSON に含まれる")
print(f"  ローカル保存先: {path}")

# ─── Test 3: dry-run での run_loop → Dashboard ローカル保存 ─────────────────
print("\n=== [Test 3] dry-run run_loop → Dashboard ローカル保存まで通る ===")
# run_loop は会話ループのみ。Dashboard 反映は command_run() が呼ぶ。
# ここでは run_loop 後に _report_to_dashboard_safely を明示呼び出しして
# command_run と同等のフローを再現する。

conv_id = _start_conv("FizzBuzz dry-run test", project_id="test-phase3-dryrun")
result = run_loop(_DB, conv_id, max_turns=3, dry_run=True, verbose=False)
_assert(result == "completed", f"run_loop completed (actual: {result})")

conv = get_conversation(_DB, conv_id)
_assert(conv["status"] == "completed", "status=completed")

# command_run と同じ Dashboard 反映フックを呼ぶ
_report_to_dashboard_safely(
    db_path=_DB, conversation_id=conv_id,
    dry_run=True, verbose=False,
)

logs = get_run_log(_DB, conv_id)
dash_logs = [r for r in logs if r["event_type"] in
             ("dashboard_reported", "dashboard_skipped", "dashboard_report_failed")]
_assert(len(dash_logs) >= 1, f"dashboard 系イベントが 1件以上 (actual: {len(dash_logs)})")
_assert(dash_logs[0]["event_type"] == "dashboard_reported",
        f"最初のイベントが dashboard_reported (actual: {dash_logs[0]['event_type']})")

# ─── Test 4: 冪等チェック（同じ conv_id を 2 回報告） ────────────────────────
print("\n=== [Test 4] 冪等: 同じ conv_id を 2 回報告してもスキップされる ===")

# 2 回目の run はスキップになるはず
_report_to_dashboard_safely(
    db_path=_DB, conversation_id=conv_id,
    dry_run=True, verbose=False,
)
logs2 = get_run_log(_DB, conv_id)
skip_logs = [r for r in logs2 if r["event_type"] == "dashboard_skipped"]
_assert(len(skip_logs) >= 1, f"2回目呼び出しで dashboard_skipped が記録された (actual: {len(skip_logs)})")

# ─── Test 5: 失敗耐性（例外を投げても run_loop が止まらない） ──────────────
print("\n=== [Test 5] 失敗耐性: _report_to_dashboard が例外を投げても本体継続 ===")

import orchestrator as orch_mod

def _raise_always(*args, **kwargs):
    raise RuntimeError("forced dashboard failure")

# orchestrator モジュール内の _report_to_dashboard を差し替える
orig_orch = orch_mod._report_to_dashboard
orch_mod._report_to_dashboard = _raise_always

try:
    conv_id2 = _start_conv("失敗耐性テスト", project_id="test-phase3-err")
    # run_loop はフロー検証
    result2 = run_loop(_DB, conv_id2, max_turns=3, dry_run=True, verbose=False)
    _assert(result2 == "completed",
            f"Dashboard 例外前の run_loop は completed (actual: {result2})")
    conv2 = get_conversation(_DB, conv_id2)
    _assert(conv2["status"] == "completed",
            f"会話 status が壊れていない (actual: {conv2['status']})")

    # _report_to_dashboard_safely を直接呼ぶ（command_run と同等）
    # orch_mod._report_to_dashboard は _raise_always なので内部で例外が起きる
    orch_mod._report_to_dashboard_safely(
        db_path=_DB, conversation_id=conv_id2,
        dry_run=True, verbose=False,
    )
    # ここに到達できることが「本体を止めない」の証明
    _assert(True, "_report_to_dashboard_safely が例外を吸収して正常リターン")
finally:
    orch_mod._report_to_dashboard = orig_orch

logs3 = get_run_log(_DB, conv_id2)
fail_logs = [r for r in logs3 if r["event_type"] == "dashboard_report_failed"]
_assert(len(fail_logs) >= 1,
        f"dashboard_report_failed が記録されている (actual: {len(fail_logs)})")
meta_str = fail_logs[0]["metadata"] or ""
_assert("forced dashboard failure" in meta_str,
        f"失敗理由が metadata に残っている (meta: {meta_str[:80]})")

# ─── Test 6: reported_sessions.json にエントリが残る ───────────────────────
print("\n=== [Test 6] reported_sessions.json にエントリが残る ===")

reported = _load_reported()
_assert(conv_id in reported,
        f"test 3 の conv_id が reported_sessions.json に記録されている")
_assert("reported_at" in reported[conv_id],
        "reported_at フィールドが含まれる")

# ─── クリーンアップ ──────────────────────────────────────────────────────────
dr_mod._REPORTED_FILE = _orig_reported_file
if _TEST_REPORTED.exists():
    _TEST_REPORTED.unlink()

print("\n=== 全テスト成功 ===\n")
