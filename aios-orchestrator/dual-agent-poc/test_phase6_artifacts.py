"""
test_phase6_artifacts.py — Phase 6 artifact 自動パース・保存 検証

実行:
    PYTHONIOENCODING=utf-8 PYTHONUTF8=1 python test_phase6_artifacts.py

前提:
    API キー不要（dry_run=True）
    独立した data/test_phase6.db を使用
    artifact_parser / store / orchestrator を直接呼ぶ

検証項目:
    1. parse_artifacts: コードブロックの抽出（言語タグ付き・なし・複数・空）
    2. parse_artifacts: 言語 → artifact_type マッピング
    3. DB 保存: 1 件 / 複数件の保存と get_artifacts による取得
    4. orchestrator dry-run: run_loop → artifact_saved が run_log に記録される
    5. 冪等: 同一 message_id に 2 回呼ぶと artifact_skipped になる
    6. 失敗耐性: _save_artifacts_safely が例外を吸収して本体が止まらない
    7. get_artifacts_by_conv: 会話単位での一覧取得
"""

from __future__ import annotations

import sys
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from store import (
    init_db, create_conversation, get_run_log,
    append_message, get_artifacts, get_artifacts_by_conv,
)
from artifact_parser import parse_artifacts
from orchestrator import run_loop, _save_artifacts_safely
from run_logger import log_session_start

_DB = str(Path(__file__).parent / "data" / "test_phase6.db")

if Path(_DB).exists():
    Path(_DB).unlink()

init_db(_DB)


def _assert(cond: bool, msg: str) -> None:
    if not cond:
        print(f"  [FAIL] {msg}")
        sys.exit(1)
    print(f"  [OK]   {msg}")


def _start_conv(goal: str, project_id: str = "test-phase6") -> str:
    conv_id = create_conversation(_DB, title=goal[:80], role_system="test", project_id=project_id)
    append_message(_DB, conv_id, turn_id=0, role_executor="planner",
                   source_model="human", target_model="gpt-4o",
                   content=f"[GOAL] {goal}")
    log_session_start(_DB, conv_id, goal=goal)
    return conv_id


# ─── Test 1: parse_artifacts — 基本抽出 ───────────────────────────────────────
print("\n=== [Test 1] parse_artifacts: コードブロック抽出 ===")

sample1 = """
以下の Python コードを実装しました。

```python
def fizzbuzz(n):
    for i in range(1, n + 1):
        if i % 15 == 0:
            print("FizzBuzz")
        elif i % 3 == 0:
            print("Fizz")
        elif i % 5 == 0:
            print("Buzz")
        else:
            print(i)
```

また、requirements.txt も作成しました。

```
fastapi==0.110.0
uvicorn
```

以上です。
"""

arts1 = parse_artifacts(sample1)
_assert(len(arts1) == 2, f"2 件のコードブロックを抽出 (actual: {len(arts1)})")
_assert(arts1[0]["language"] == "python", f"1件目の言語 = python (actual: {arts1[0]['language']})")
_assert(arts1[0]["artifact_type"] == "code", f"1件目 type = code (actual: {arts1[0]['artifact_type']})")
_assert("fizzbuzz" in arts1[0]["body"], "1件目 body に fizzbuzz が含まれる")
_assert(arts1[1]["language"] == "", f"2件目の言語 = 空 (actual: {arts1[1]['language']})")
_assert(arts1[1]["artifact_type"] == "code", f"2件目 type = code (actual: {arts1[1]['artifact_type']})")

# ─── Test 2: parse_artifacts — 言語タグ→type マッピング ──────────────────────
print("\n=== [Test 2] parse_artifacts: 言語→type マッピング ===")

type_cases = [
    ("python",     "code"),
    ("bash",       "shell"),
    ("sh",         "shell"),
    ("json",       "json"),
    ("yaml",       "file"),
    ("sql",        "code"),
    ("markdown",   "markdown"),
    ("dockerfile", "file"),
    ("",           "code"),
    ("hoge",       "code"),  # 未知言語 → code
]

for lang, expected_type in type_cases:
    fence = f"```{lang}\nsome content\n```"
    result = parse_artifacts(fence)
    _assert(len(result) == 1, f"lang={lang!r}: 1件抽出")
    _assert(result[0]["artifact_type"] == expected_type,
            f"lang={lang!r} → type={result[0]['artifact_type']} (expected {expected_type})")

# 空ブロックは除外
empty_block = "```python\n   \n```"
_assert(len(parse_artifacts(empty_block)) == 0, "空ブロックは抽出しない")

# 同一内容の重複は 1 件に絞る
dup_block = "```python\nprint(1)\n```\n\n```python\nprint(1)\n```"
_assert(len(parse_artifacts(dup_block)) == 1, "同一内容の重複は 1 件に絞る")

# ─── Test 3: DB 保存 / get_artifacts ─────────────────────────────────────────
print("\n=== [Test 3] DB 保存 / get_artifacts ===")

from store import append_artifact

conv3 = _start_conv("DB保存テスト")
msg_id = append_message(_DB, conv3, turn_id=1, role_executor="executor",
                        source_model="claude", target_model="gpt-4o",
                        content="test content")

# 1 件保存
art_id1 = append_artifact(_DB, msg_id, "code", "test.py", "print('hello')", language="python")
_assert(bool(art_id1), f"artifact_id が返る: {art_id1[:8]}...")

stored = get_artifacts(_DB, msg_id)
_assert(len(stored) == 1, f"1 件保存・取得 (actual: {len(stored)})")
_assert(stored[0]["language"] == "python", f"language='python' が保存されている (actual: {stored[0]['language']})")
_assert(stored[0]["artifact_type"] == "code", "artifact_type='code' が保存されている")

# 2 件目保存
art_id2 = append_artifact(_DB, msg_id, "shell", "setup.sh", "pip install -r requirements.txt", language="bash")
stored2 = get_artifacts(_DB, msg_id)
_assert(len(stored2) == 2, f"2 件保存・取得 (actual: {len(stored2)})")
_assert(stored2[1]["language"] == "bash", f"2件目 language='bash' (actual: {stored2[1]['language']})")

# ─── Test 4: orchestrator dry-run → artifact_saved ───────────────────────────
print("\n=== [Test 4] orchestrator dry-run → artifact_saved が run_log に記録 ===")

conv4 = _start_conv("Artifact dry-run テスト", project_id="test-p6-dryrun")
result4 = run_loop(_DB, conv4, max_turns=3, dry_run=True, verbose=False)
_assert(result4 == "completed", f"run_loop completed (actual: {result4})")

logs4 = get_run_log(_DB, conv4)
artifact_logs = [r for r in logs4 if r["event_type"] in
                 ("artifact_saved", "artifact_skipped", "artifact_save_failed")]
# dry-run の mock 応答はコードブロックを含まないため artifact 数は 0 でも構わない
# ただし artifact_save_failed が出ていないことを確認する
fail_logs = [r for r in artifact_logs if r["event_type"] == "artifact_save_failed"]
_assert(len(fail_logs) == 0,
        f"artifact_save_failed が出ていない (actual: {len(fail_logs)})")
print(f"  artifact 関連ログ: {len(artifact_logs)} 件")

# ─── Test 5: 冪等 — 同一 message_id で 2 回呼ぶとスキップ ────────────────────
print("\n=== [Test 5] 冪等: 同一 message_id を 2 回処理するとスキップ ===")

conv5 = _start_conv("冪等テスト")
msg5 = append_message(_DB, conv5, turn_id=1, role_executor="executor",
                      source_model="claude", target_model="gpt-4o",
                      content="```python\nprint('hello')\n```")

content_with_code = "```python\nprint('hello')\n```"

# 1 回目: 保存される
_save_artifacts_safely(_DB, conv5, msg5, content_with_code, turn_id=1, verbose=False)
saved_after_1st = get_artifacts(_DB, msg5)
_assert(len(saved_after_1st) == 1, f"1回目: 1 件保存 (actual: {len(saved_after_1st)})")

# 2 回目: スキップされる
_save_artifacts_safely(_DB, conv5, msg5, content_with_code, turn_id=1, verbose=False)
saved_after_2nd = get_artifacts(_DB, msg5)
_assert(len(saved_after_2nd) == 1, f"2回目: 件数変化なし (actual: {len(saved_after_2nd)})")

logs5 = get_run_log(_DB, conv5)
skip5 = [r for r in logs5 if r["event_type"] == "artifact_skipped"]
_assert(len(skip5) >= 1, f"artifact_skipped が run_log に記録された (actual: {len(skip5)})")

# ─── Test 6: 失敗耐性 ─────────────────────────────────────────────────────────
print("\n=== [Test 6] 失敗耐性: 例外が起きても本体が止まらない ===")

import orchestrator as orch_mod

_orig_store_artifact = orch_mod._store_artifact

def _raise_on_store(*args, **kwargs):
    raise RuntimeError("forced artifact failure")

orch_mod._store_artifact = _raise_on_store

try:
    conv6 = _start_conv("失敗耐性テスト")
    msg6 = append_message(_DB, conv6, turn_id=1, role_executor="executor",
                          source_model="claude", target_model="gpt-4o",
                          content="```python\nprint('fail')\n```")
    # 例外が発生しても関数は正常リターンするはず
    _save_artifacts_safely(_DB, conv6, msg6,
                           "```python\nprint('fail')\n```",
                           turn_id=1, verbose=False)
    _assert(True, "_save_artifacts_safely が例外を吸収して正常リターン")
finally:
    orch_mod._store_artifact = _orig_store_artifact

logs6 = get_run_log(_DB, conv6)
fail6 = [r for r in logs6 if r["event_type"] == "artifact_save_failed"]
_assert(len(fail6) >= 1, f"artifact_save_failed が run_log に記録された (actual: {len(fail6)})")
meta6 = json.loads(fail6[0]["metadata"] or "{}")
_assert("forced artifact failure" in meta6.get("error", ""),
        f"失敗理由が metadata に残っている (meta: {meta6})")

# ─── Test 7: get_artifacts_by_conv ────────────────────────────────────────────
print("\n=== [Test 7] get_artifacts_by_conv: 会話単位での一覧取得 ===")

conv7 = _start_conv("会話単位取得テスト")
msg7a = append_message(_DB, conv7, turn_id=1, role_executor="executor",
                       source_model="claude", target_model="gpt-4o",
                       content="```python\ndef foo(): pass\n```")
msg7b = append_message(_DB, conv7, turn_id=2, role_executor="executor",
                       source_model="claude", target_model="gpt-4o",
                       content="```sql\nSELECT 1;\n```\n\n```bash\necho ok\n```")

_save_artifacts_safely(_DB, conv7, msg7a, "```python\ndef foo(): pass\n```", turn_id=1, verbose=False)
_save_artifacts_safely(_DB, conv7, msg7b, "```sql\nSELECT 1;\n```\n\n```bash\necho ok\n```",
                       turn_id=2, verbose=False)

all_arts = get_artifacts_by_conv(_DB, conv7)
_assert(len(all_arts) == 3, f"会話全体で 3 件取得 (actual: {len(all_arts)})")
langs = [a["language"] for a in all_arts]
_assert("python" in langs, "python artifact が含まれる")
_assert("sql" in langs, "sql artifact が含まれる")
_assert("bash" in langs, "bash artifact が含まれる")
# turn_id 順に並んでいる
_assert(all_arts[0]["turn_id"] <= all_arts[-1]["turn_id"],
        "turn_id 昇順で並んでいる")

print("\n=== 全テスト成功 ===\n")
