"""
test_phase4_real.py — Phase 4 承認フロー → Dashboard 2行書き込み検証

実行:
    PYTHONIOENCODING=utf-8 PYTHONUTF8=1 python test_phase4_real.py

前提:
    AIOS_DASHBOARD_SPREADSHEET_ID / AIOS_SERVICE_ACCOUNT_PATH / AIOS_RUNLOG_SHEET_WRITE=1 が
    環境変数に設定されていること（未設定なら Sheet スキップで dry_run 相当になる）
    LLM コールは dry_run=True（approval_test モック）で節約。
    Dashboard 書き込みは dry_run=False → 実 Sheet に書く。

検証シナリオ:
    1. waiting_approval で停止 → STOP 行を Sheet に書く
    2. approve → completed → SUCCESS 行を Sheet に書く（Phase 3 のバグではスキップされた）
    3. 3回目呼び出し → dashboard_skipped（冪等）
    4. reported_sessions.json に STOP / SUCCESS の両キーが残る
"""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from store import (
    init_db, create_conversation, get_conversation,
    get_run_log, append_message, get_pending_approvals,
    set_message_approval, set_conversation_status,
)
from orchestrator import run_loop, _report_to_dashboard_safely
from run_logger import log_session_start
import dashboard_reporter as dr_mod
from dashboard_reporter import _load_reported

_DB = str(Path(__file__).parent / "data" / "test_phase4.db")

# テスト用 reported_sessions.json を隔離
_TEST_REPORTED = dr_mod._LOCAL_LOG_DIR / "test_phase4_reported_sessions.json"
_orig_reported_file = dr_mod._REPORTED_FILE
dr_mod._REPORTED_FILE = _TEST_REPORTED
if _TEST_REPORTED.exists():
    _TEST_REPORTED.unlink()

if Path(_DB).exists():
    Path(_DB).unlink()


def _assert(cond: bool, msg: str) -> None:
    if not cond:
        print(f"  [FAIL] {msg}")
        sys.exit(1)
    print(f"  [OK]   {msg}")


# ─── セットアップ ─────────────────────────────────────────────────────────────
init_db(_DB)
conv_id = create_conversation(
    _DB,
    title="Phase4 承認フロー検証: FizzBuzz",
    role_system="test",
    project_id="AIOS-TEST-P4",
)
append_message(
    _DB, conv_id, turn_id=0, role_executor="planner",
    source_model="human", target_model="gpt-4o",
    content="[GOAL] FizzBuzz を Python で実装してください",
)
log_session_start(_DB, conv_id, goal="FizzBuzz 承認フロー検証")

print(f"\n[Phase 4 real] conv_id={conv_id[:8]}...")

# ─── ① waiting_approval まで実行（approval_test=True で承認ゲートを発火） ────
print("\n=== [Step 1] run_loop → waiting_approval ===")
result1 = run_loop(
    _DB, conv_id,
    max_turns=5,
    dry_run=True,           # LLM コール: モック
    approval_test=True,     # 承認ゲートを発火させるモック応答を使う
    verbose=True,
)
print(f"  run_loop result: {result1}")
_assert(result1 == "waiting_approval", f"waiting_approval で停止 (actual: {result1})")

conv1 = get_conversation(_DB, conv_id)
_assert(conv1["status"] == "waiting_approval",
        f"conversations.status = waiting_approval (actual: {conv1['status']})")

# ─── ② STOP を Dashboard に報告（dry_run=False → 実 Sheet） ──────────────────
print("\n=== [Step 2] STOP → Dashboard 報告 ===")
_report_to_dashboard_safely(
    db_path=_DB, conversation_id=conv_id,
    dry_run=False,  # 実 Sheet 書き込み（env vars 未設定なら自動スキップ）
    verbose=True,
)
logs_after_stop = get_run_log(_DB, conv_id)
stop_reported = [r for r in logs_after_stop
                 if r["event_type"] == "dashboard_reported"]
_assert(len(stop_reported) >= 1,
        f"STOP が dashboard_reported として記録 (actual: {len(stop_reported)})")

reported_mid = _load_reported()
key_stop = f"{conv_id}_STOP"
_assert(key_stop in reported_mid,
        f"STOP キーが reported_sessions.json に記録された")

# ─── ③ 承認して再実行 → completed ────────────────────────────────────────────
print("\n=== [Step 3] approve → run → completed ===")

# pending approvals を取得して承認
all_pendings = get_pending_approvals(_DB)
pendings = [p for p in all_pendings if p.get("conversation_id") == conv_id]
_assert(len(pendings) >= 1, f"承認待ちメッセージが存在する (actual: {len(pendings)})")

for p in pendings:
    set_message_approval(_DB, p["message_id"], approved=True)
    print(f"  approved: message_id={p['message_id'][:8]}...")
# command_approve と同等: 会話を in_progress に戻す
set_conversation_status(_DB, conv_id, "in_progress")

# 再実行（既に approval 済みなので続行するはず）
result2 = run_loop(
    _DB, conv_id,
    max_turns=5,
    dry_run=True,
    approval_test=False,  # 通常モック応答（承認フローなし → completed まで進む）
    verbose=True,
)
print(f"  run_loop result: {result2}")
_assert(result2 == "completed", f"completed で終了 (actual: {result2})")

conv2 = get_conversation(_DB, conv_id)
_assert(conv2["status"] == "completed",
        f"conversations.status = completed (actual: {conv2['status']})")

# ─── ④ SUCCESS を Dashboard に報告（dry_run=False → 実 Sheet） ───────────────
print("\n=== [Step 4] SUCCESS → Dashboard 報告（Phase 3 ではスキップされたケース） ===")
_report_to_dashboard_safely(
    db_path=_DB, conversation_id=conv_id,
    dry_run=False,
    verbose=True,
)
logs_after_success = get_run_log(_DB, conv_id)
success_reported = [r for r in logs_after_success
                    if r["event_type"] == "dashboard_reported"]
_assert(len(success_reported) == 2,
        f"STOP + SUCCESS の 2件が dashboard_reported (actual: {len(success_reported)})")

reported_final = _load_reported()
key_success = f"{conv_id}_SUCCESS"
_assert(key_stop    in reported_final, "STOP キーが残っている")
_assert(key_success in reported_final, "SUCCESS キーが追加された（Phase 4 修正の核心）")

# ─── ⑤ 3回目呼び出し → スキップ ────────────────────────────────────────────
print("\n=== [Step 5] 3回目呼び出し → dashboard_skipped ===")
_report_to_dashboard_safely(
    db_path=_DB, conversation_id=conv_id,
    dry_run=False,
    verbose=True,
)
logs_final = get_run_log(_DB, conv_id)
skip_events = [r for r in logs_final if r["event_type"] == "dashboard_skipped"]
_assert(len(skip_events) >= 1,
        f"3回目は dashboard_skipped (actual: {len(skip_events)})")

# ─── クリーンアップ ──────────────────────────────────────────────────────────
dr_mod._REPORTED_FILE = _orig_reported_file
if _TEST_REPORTED.exists():
    _TEST_REPORTED.unlink()

print("\n=== Phase 4 real 検証 全成功 ===")
print(f"  conv_id   : {conv_id}")
print(f"  STOP key  : {key_stop}")
print(f"  SUCCESS key: {key_success}")
print("  Sheet 書き込み状況は Run_Log シートで確認してください。")
print()
