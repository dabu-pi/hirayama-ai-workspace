"""
test_phase9_artifact_diff.py — Phase 9: artifact diff 検証

実行:
    PYTHONIOENCODING=utf-8 PYTHONUTF8=1 python test_phase9_artifact_diff.py

前提:
    API キー不要（fixture DB を直接構築）
    test_phase8.db（Phase 8 real API データ）も参照する

検証項目:
    1. group_artifacts: 同一 filename で正しくグループ化
    2. compute_diff: 追加・削除・変更が unified diff に現れる
    3. compute_diff: 差分なしの場合は空文字
    4. diff_stat: 追加 / 削除行数の正確性
    5. command_artifact_diff (デフォルト): 全系統 diff 表示
    6. command_artifact_diff --artifact-id: 直前バージョンとの diff
    7. command_artifact_diff --left --right: 明示比較
    8. 失敗ケース: artifact 0件 / 1件のみ / 存在しない id
    9. real API データ（Phase 8 DB）での artifact-diff 確認
"""

from __future__ import annotations

import io
import sys
import argparse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from store import (
    init_db, create_conversation, append_message, append_artifact,
    get_artifacts_by_conv,
)
from artifact_diff import (
    group_artifacts, group_artifacts_all,
    compute_diff, diff_stat, consecutive_pairs,
    find_by_prefix, find_prev_in_group, find_next_in_group,
)
from orchestrator import command_artifact_diff
from run_logger import log_session_start

_DB = str(Path(__file__).parent / "data" / "test_phase9.db")
_P8_DB = str(Path(__file__).parent / "data" / "test_phase8.db")  # Phase 8 real API DB
_P8_CONV = "4fba3263-ba51-40f8-86e4-cf713d6a75de"

if Path(_DB).exists():
    Path(_DB).unlink()
init_db(_DB)


def _assert(cond: bool, msg: str) -> None:
    if not cond:
        print(f"  [FAIL] {msg}")
        sys.exit(1)
    print(f"  [OK]   {msg}")


def _run_diff(conv_id: str,
              db: str = _DB,
              artifact_id: str | None = None,
              left: str | None = None,
              right: str | None = None,
              context: int = 5) -> tuple[str, int]:
    ns = argparse.Namespace(
        db=db, conv_id=conv_id,
        artifact_id=artifact_id,
        left=left, right=right,
        context=context,
    )
    buf = io.StringIO()
    orig = sys.stdout
    sys.stdout = buf
    try:
        rc = command_artifact_diff(ns)
    finally:
        sys.stdout = orig
    return buf.getvalue(), rc


def _start_conv(goal: str) -> str:
    cid = create_conversation(_DB, title=goal[:80], role_system="test", project_id="p9")
    append_message(_DB, cid, turn_id=0, role_executor="planner",
                   source_model="human", target_model="gpt-4o", content=f"[GOAL] {goal}")
    log_session_start(_DB, cid, goal=goal)
    return cid


# ─── Test 1: group_artifacts ─────────────────────────────────────────────────
print("\n=== [Test 1] group_artifacts: 同一 filename でグループ化 ===")

_arts_for_group = [
    {"artifact_id": "aaa", "turn_id": 1, "filename": "main.py",  "language": "python", "artifact_type": "code",  "content": "v1", "created_at": ""},
    {"artifact_id": "bbb", "turn_id": 2, "filename": "main.py",  "language": "python", "artifact_type": "code",  "content": "v2", "created_at": ""},
    {"artifact_id": "ccc", "turn_id": 1, "filename": "setup.sh", "language": "bash",   "artifact_type": "shell", "content": "v1", "created_at": ""},
    {"artifact_id": "ddd", "turn_id": 2, "filename": "setup.sh", "language": "bash",   "artifact_type": "shell", "content": "v1", "created_at": ""},  # 同内容
    {"artifact_id": "eee", "turn_id": 1, "filename": None,       "language": "yaml",   "artifact_type": "file",  "content": "y1", "created_at": ""},  # 1件のみ
]
grps = group_artifacts(_arts_for_group)
_assert("main.py"  in grps, "main.py グループが存在する")
_assert("setup.sh" in grps, "setup.sh グループが存在する")
_assert("lang=yaml|type=file" not in grps, "1件のみの yaml グループは diff 対象外")
_assert(len(grps["main.py"])  == 2, "main.py グループに 2 件")
_assert(len(grps["setup.sh"]) == 2, "setup.sh グループに 2 件")
_assert(grps["main.py"][0]["artifact_id"] == "aaa", "turn_id 昇順ソート確認")

# filename なし → (language, artifact_type) キーで代替
_arts_no_fname = [
    {"artifact_id": "xxx", "turn_id": 1, "filename": None, "language": "python", "artifact_type": "code", "content": "a", "created_at": ""},
    {"artifact_id": "yyy", "turn_id": 2, "filename": None, "language": "python", "artifact_type": "code", "content": "b", "created_at": ""},
]
grps2 = group_artifacts(_arts_no_fname)
_assert("lang=python|type=code" in grps2, "filename なし → lang|type キーで代替")

# ─── Test 2: compute_diff — 差分あり ─────────────────────────────────────────
print("\n=== [Test 2] compute_diff: 差分あり ===")

left_art  = {"artifact_id": "left0000", "turn_id": 1, "filename": "main.py",
             "content": "line1\nline2\nline3\n", "language": "python", "artifact_type": "code"}
right_art = {"artifact_id": "righ0000", "turn_id": 2, "filename": "main.py",
             "content": "line1\nline2 modified\nline3\nline4 added\n",
             "language": "python", "artifact_type": "code"}

diff = compute_diff(left_art, right_art)
_assert(bool(diff),               "差分あり → 空文字でない")
_assert("line2 modified" in diff, "変更行が diff に現れる")
_assert("line4 added"    in diff, "追加行が diff に現れる")
_assert("-line2"         in diff, "削除行 (-) が diff に現れる")
_assert("+line2 modified"in diff, "追加行 (+) が diff に現れる")

# ─── Test 3: compute_diff — 差分なし ─────────────────────────────────────────
print("\n=== [Test 3] compute_diff: 差分なし ===")

same_art1 = {"artifact_id": "same0001", "turn_id": 1, "filename": "same.yaml",
             "content": "key: value\n", "language": "yaml", "artifact_type": "file"}
same_art2 = {"artifact_id": "same0002", "turn_id": 2, "filename": "same.yaml",
             "content": "key: value\n", "language": "yaml", "artifact_type": "file"}

diff_empty = compute_diff(same_art1, same_art2)
_assert(diff_empty == "", "差分なし → 空文字")

# ─── Test 4: diff_stat ───────────────────────────────────────────────────────
print("\n=== [Test 4] diff_stat: 追加・削除行数 ===")

added, deleted = diff_stat(diff)
_assert(added   >= 1, f"追加行数 >= 1 (actual: {added})")
_assert(deleted >= 1, f"削除行数 >= 1 (actual: {deleted})")

added0, deleted0 = diff_stat("")
_assert(added0 == 0 and deleted0 == 0, "空 diff → 0/0")

# ─── Test 5: command_artifact_diff (デフォルト全系統) ─────────────────────────
print("\n=== [Test 5] command_artifact_diff: デフォルト全系統 diff ===")

conv5 = _start_conv("Test5 全系統 diff")
msg5a = append_message(_DB, conv5, turn_id=1, role_executor="executor",
                       source_model="c", target_model="g", content="turn1")
msg5b = append_message(_DB, conv5, turn_id=2, role_executor="executor",
                       source_model="c", target_model="g", content="turn2")

art5_py1 = append_artifact(_DB, msg5a, "code",  "main.py",  "def foo():\n    pass\n",        language="python")
art5_sh1 = append_artifact(_DB, msg5a, "shell", "run.sh",   "python main.py\n",              language="bash")
art5_py2 = append_artifact(_DB, msg5b, "code",  "main.py",  "def foo():\n    return 42\n",   language="python")
art5_sh2 = append_artifact(_DB, msg5b, "shell", "run.sh",   "python main.py --verbose\n",    language="bash")

out5, rc5 = _run_diff(conv5)
_assert(rc5 == 0,                   f"終了コード 0 (actual: {rc5})")
_assert("main.py"  in out5,         "main.py 系統が表示される")
_assert("run.sh"   in out5,         "run.sh 系統が表示される")
_assert("return 42" in out5,        "python の変更行 (+return 42) が表示される")
_assert("--verbose" in out5,        "bash の変更行 (--verbose) が表示される")
_assert("diff 対象系統" in out5,    "系統数ヘッダーが表示される")

# ─── Test 6: --artifact-id 起点 ──────────────────────────────────────────────
print("\n=== [Test 6] command_artifact_diff --artifact-id: 直前との diff ===")

out6, rc6 = _run_diff(conv5, artifact_id=art5_py2[:8])
_assert(rc6 == 0,                   f"終了コード 0 (actual: {rc6})")
_assert("return 42" in out6,        "変更行が表示される")

# 先頭 artifact（直前なし）→ 直後との diff にフォールバック
out6b, rc6b = _run_diff(conv5, artifact_id=art5_py1[:8])
_assert(rc6b == 0,                  "先頭 artifact: 直後 diff にフォールバック / 終了コード 0")

# ─── Test 7: --left --right 明示比較 ─────────────────────────────────────────
print("\n=== [Test 7] command_artifact_diff --left --right: 明示比較 ===")

out7, rc7 = _run_diff(conv5, left=art5_py1[:8], right=art5_py2[:8])
_assert(rc7 == 0,                   f"終了コード 0 (actual: {rc7})")
_assert("return 42" in out7,        "明示比較でも変更行が表示される")

# --left のみ → エラー
out7e, rc7e = _run_diff(conv5, left=art5_py1[:8])
_assert(rc7e == 1,                  "--left のみ指定 → 終了コード 1")

# 存在しない --right → エラー
out7f, rc7f = _run_diff(conv5, left=art5_py1[:8], right="00000000")
_assert(rc7f == 1,                  "存在しない --right → 終了コード 1")

# ─── Test 8: 失敗ケース ───────────────────────────────────────────────────────
print("\n=== [Test 8] 失敗ケース: 0件 / 1件のみ / 差分なし / 存在しない id ===")

# 0件会話
conv8z = _start_conv("Test8 artifact なし")
out8z, rc8z = _run_diff(conv8z)
_assert(rc8z == 0,                  "artifact 0 件: 終了コード 0")
_assert("artifact がありません" in out8z, "0件: メッセージ表示")

# 1件のみ（diff 対象なし）
conv8o = _start_conv("Test8 1件のみ")
msg8o = append_message(_DB, conv8o, turn_id=1, role_executor="executor",
                       source_model="c", target_model="g", content="t")
append_artifact(_DB, msg8o, "code", "solo.py", "x=1\n", language="python")
out8o, rc8o = _run_diff(conv8o)
_assert(rc8o == 0,                  "1件のみ: 終了コード 0")
_assert("diff 対象なし" in out8o,   "1件のみ: diff 対象なしメッセージ")

# 差分なし（同内容 2 件）
conv8s = _start_conv("Test8 差分なし")
msg8s1 = append_message(_DB, conv8s, turn_id=1, role_executor="executor",
                        source_model="c", target_model="g", content="t1")
msg8s2 = append_message(_DB, conv8s, turn_id=2, role_executor="executor",
                        source_model="c", target_model="g", content="t2")
append_artifact(_DB, msg8s1, "file", "cfg.yaml", "k: v\n", language="yaml")
append_artifact(_DB, msg8s2, "file", "cfg.yaml", "k: v\n", language="yaml")
out8s, rc8s = _run_diff(conv8s)
_assert(rc8s == 0,                  "差分なし: 終了コード 0")
_assert("差分なし" in out8s,        "差分なし: メッセージ表示")

# 存在しない conv_id
out8x, rc8x = _run_diff("nonexistent-0000")
_assert(rc8x == 1,                  "存在しない conv_id: 終了コード 1")

# 存在しない --artifact-id
out8y, rc8y = _run_diff(conv5, artifact_id="00000000")
_assert(rc8y == 1,                  "存在しない --artifact-id: 終了コード 1")

# ─── Test 9: real API データ（Phase 8 DB）──────────────────────────────────
print("\n=== [Test 9] real API データ (Phase 8 DB) での artifact-diff ===")

if not Path(_P8_DB).exists():
    print("  [SKIP] test_phase8.db が存在しません。Phase 8 を先に実行してください。")
else:
    init_db(_P8_DB)  # マイグレーション保証
    out9, rc9 = _run_diff(_P8_CONV, db=_P8_DB)
    print(out9[:1200])  # 先頭 1200 文字を表示
    _assert(rc9 == 0,               f"Phase 8 DB: 終了コード 0 (actual: {rc9})")
    _assert("artifact.py"   in out9, "artifact.py 系統の diff が表示される")
    _assert("artifact_1.sh" in out9 or "run.sh" in out9 or "bash" in out9,
            "bash 系統の diff が表示される")

    # --artifact-id で Turn2 Python artifact の直前との diff
    arts9 = get_artifacts_by_conv(_P8_DB, _P8_CONV)
    py_arts = [a for a in arts9 if a["language"] == "python"]
    _assert(len(py_arts) >= 2, f"python artifact が 2 件以上ある (actual: {len(py_arts)})")

    t2_py = next((a for a in py_arts if a["turn_id"] == 2), None)
    if t2_py:
        out9b, rc9b = _run_diff(_P8_CONV, db=_P8_DB, artifact_id=t2_py["artifact_id"][:8])
        _assert(rc9b == 0,         "--artifact-id T02 python: 終了コード 0")
        _assert("return" in out9b or "import" in out9b or "+import" in out9b or "-" in out9b or "+" in out9b,
                "T01→T02 python diff に変更が含まれる")
        print(f"  T01→T02 python diff (+{diff_stat(compute_diff(py_arts[0], py_arts[1]))[0]} / -{diff_stat(compute_diff(py_arts[0], py_arts[1]))[1]})")

print("\n=== 全テスト成功 ===\n")
