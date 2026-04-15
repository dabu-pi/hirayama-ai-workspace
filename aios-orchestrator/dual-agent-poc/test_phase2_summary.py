"""
test_phase2_summary.py — Phase 2 summary 自動更新の dry-run 検証

実行:
    python test_phase2_summary.py

前提:
    API キー不要（dry_run=True で mock_summary を使う）
    独立した data/test_phase2.db を使うので既存 DB は壊さない

検証項目:
    1. 通常フロー: Turn 1 終了後に summary が書き込まれる
    2. 通常フロー: Turn 2 (TASK_COMPLETE) で event=task_complete の summary が入る
    3. 承認フロー: waiting_approval 時に summary が更新される
    4. build_context() が summary を返す
    5. run_log に summary_updated / summary_update_failed イベントが残る
    6. summary 更新失敗（例外）で会話本体が壊れないこと（monkey patch で generate_summary を差し替え）
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# このスクリプトと同じディレクトリをモジュール検索パスに追加
sys.path.insert(0, str(Path(__file__).parent))

from store import (
    init_db,
    create_conversation,
    get_conversation,
    get_run_log,
    build_context,
    append_message,
)
from orchestrator import run_loop, run_single_turn
from run_logger import log_session_start
import orchestrator as orch_mod


_DB = str(Path(__file__).parent / "data" / "test_phase2.db")

# テスト間で DB を作り直す
if Path(_DB).exists():
    Path(_DB).unlink()


def _assert(cond: bool, msg: str) -> None:
    if not cond:
        print(f"  [FAIL] {msg}")
        sys.exit(1)
    print(f"  [OK]   {msg}")


def _start_conv(goal: str, project_id: str = "test-phase2") -> str:
    init_db(_DB)
    conv_id = create_conversation(
        _DB,
        title=goal[:80],
        role_system="test",
        project_id=project_id,
    )
    append_message(
        _DB, conv_id,
        turn_id=0,
        role_executor="planner",
        source_model="human",
        target_model="gpt-4o",
        content=f"[GOAL] {goal}",
    )
    log_session_start(_DB, conv_id, goal=goal)
    return conv_id


# ─── 1. 通常フロー（TASK_COMPLETE まで） ─────────────────────────────────────
print("\n=== [Test 1] 通常フロー: summary が各ターンで更新される ===")

conv_id = _start_conv("九九表をMarkdownで出力")
result = run_loop(_DB, conv_id, max_turns=3, dry_run=False, verbose=False) \
    if False else run_loop(_DB, conv_id, max_turns=3, dry_run=True, verbose=False)

conv = get_conversation(_DB, conv_id)
_assert(conv["status"] == "completed", f"status=completed (actual: {conv['status']})")
_assert(conv.get("summary") is not None and len(conv["summary"]) > 0,
        "summary が空ではない")
_assert(conv.get("summary_updated_at") is not None,
        "summary_updated_at が設定されている")

# run_log に summary_updated が 2 件以上（Turn 1 turn_end + Turn 2 task_complete）
logs = get_run_log(_DB, conv_id)
summary_logs = [r for r in logs if r["event_type"] == "summary_updated"]
_assert(len(summary_logs) >= 2,
        f"summary_updated が 2 件以上記録されている (actual: {len(summary_logs)})")

# event=task_complete が最後の summary_updated に含まれる
last_meta = summary_logs[-1]["metadata"] or ""
_assert("task_complete" in last_meta,
        f"最後の summary_updated が event=task_complete (meta: {last_meta})")

# build_context() が summary を返す
ctx = build_context(_DB, conv_id, limit=10)
_assert(ctx["summary"] is not None and len(ctx["summary"]) > 0,
        "build_context() が summary を返す")
print(f"\n  [summary preview]\n{ctx['summary'][:200]}\n")


# ─── 2. 承認フロー ──────────────────────────────────────────────────────────
print("\n=== [Test 2] 承認フロー: waiting_approval 時に summary が入る ===")

conv_id = _start_conv("危険操作を要求する会話", project_id="test-phase2-approval")
result = run_loop(_DB, conv_id, max_turns=2,
                  dry_run=True, approval_test=True, verbose=False)

conv = get_conversation(_DB, conv_id)
_assert(conv["status"] == "waiting_approval",
        f"status=waiting_approval (actual: {conv['status']})")
_assert(conv.get("summary") is not None and len(conv["summary"]) > 0,
        "waiting_approval 時も summary が入っている")

logs = get_run_log(_DB, conv_id)
summary_logs = [r for r in logs if r["event_type"] == "summary_updated"]
_assert(len(summary_logs) >= 1,
        f"summary_updated が 1 件以上 (actual: {len(summary_logs)})")

meta_str = " ".join(r["metadata"] or "" for r in summary_logs)
_assert("waiting_approval" in meta_str,
        "event=waiting_approval で summary が記録されている")


# ─── 3. 失敗時に会話本体が壊れないこと ──────────────────────────────────────
print("\n=== [Test 3] summary 生成が例外を投げても会話本体は継続 ===")

conv_id = _start_conv("例外テスト", project_id="test-phase2-err")

# mock_summary を差し替えて例外を投げる
def _raise(*args, **kwargs):
    raise RuntimeError("forced failure for test")

orig = orch_mod.mock_summary
orch_mod.mock_summary = _raise

try:
    result = run_loop(_DB, conv_id, max_turns=2, dry_run=True, verbose=False)
finally:
    orch_mod.mock_summary = orig

conv = get_conversation(_DB, conv_id)
_assert(conv["status"] in ("completed", "in_progress"),
        f"会話は継続（status={conv['status']}）")

logs = get_run_log(_DB, conv_id)
fail_logs = [r for r in logs if r["event_type"] == "summary_update_failed"]
_assert(len(fail_logs) >= 1,
        f"summary_update_failed が記録されている (actual: {len(fail_logs)})")
meta = fail_logs[0]["metadata"] or ""
_assert("forced failure" in meta,
        f"失敗理由が metadata に残っている (meta: {meta[:80]})")


# ─── 4. build_context の後方互換: summary=None でも壊れない ────────────────
print("\n=== [Test 4] summary なし（新規会話）でも build_context が動く ===")

conv_id = _start_conv("summary なしテスト", project_id="test-phase2-none")
ctx = build_context(_DB, conv_id, limit=10)
_assert(ctx["summary"] is None, "初期会話では summary=None")
_assert(len(ctx["recent_history"]) == 1, "recent_history に GOAL 1件のみ")


# ─── 5. summary が履歴に含まれない長い会話でも context 圧縮が効く ───────────
print("\n=== [Test 5] summary が LLM コンテキストへ渡される（_build_messages_for_llm） ===")

from orchestrator import _build_messages_for_llm

conv_id = _start_conv("コンテキスト圧縮テスト", project_id="test-phase2-ctx")
# 1 ターン動かして summary を生成
run_single_turn(_DB, conv_id, dry_run=True, verbose=False)

ctx = build_context(_DB, conv_id, limit=10)
messages = _build_messages_for_llm(ctx)
_assert(any("[会話の要約]" in m["content"] for m in messages if m["role"] == "user"),
        "LLM に渡す messages の先頭付近に [会話の要約] が含まれる")


print("\n=== 全テスト成功 ===\n")
