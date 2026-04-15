"""
test_phase8_real_api.py — Phase 8: artifact 保存 E2E 実測検証（real API）

実行:
    PYTHONIOENCODING=utf-8 PYTHONUTF8=1 python test_phase8_real_api.py

前提:
    OPENAI_API_KEY / ANTHROPIC_API_KEY が .env または環境変数に設定済み
    LLM コール: 実 API（gpt-4o Planner + claude-sonnet-4-6 Executor）
    DB: data/test_phase8.db（独立）

ゴール:
    "Python の requests ライブラリを使った GET リクエストのサンプルコードと
     Bash 実行例、および設定 YAML を書いてください"

検証内容:
    1. real API 実行 → artifact が DB に保存される
    2. 保存件数 / artifact_type / language の確認
    3. command_artifacts() で一覧表示できる
    4. --artifact-id で本文取得できる
    5. false positive（lang=数字のみ）が保存されていない
    6. 0件会話・存在しない artifact-id の安全確認
"""

from __future__ import annotations

import io
import sys
import argparse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

# .env を読み込む
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env", override=True)
except ImportError:
    pass

from store import (
    init_db, create_conversation, get_artifacts_by_conv,
    append_message,
)
from orchestrator import run_loop, command_artifacts
from run_logger import log_session_start

_DB = str(Path(__file__).parent / "data" / "test_phase8.db")

if Path(_DB).exists():
    Path(_DB).unlink()

init_db(_DB)

GOAL = (
    "Python の requests ライブラリを使った GET リクエストのサンプルコードと、"
    "そのスクリプトを実行する Bash コマンド例、"
    "および設定を表す YAML ファイルを書いてください。"
    "コードブロックは必ずフェンス記法（```python, ```bash, ```yaml）で書いてください。"
)


def _assert(cond: bool, msg: str) -> None:
    if not cond:
        print(f"  [FAIL] {msg}")
        sys.exit(1)
    print(f"  [OK]   {msg}")


def _run_cmd_artifacts(conv_id: str, artifact_id: str | None = None) -> tuple[str, int]:
    ns = argparse.Namespace(db=_DB, conv_id=conv_id, artifact_id=artifact_id)
    buf = io.StringIO()
    orig = sys.stdout
    sys.stdout = buf
    try:
        rc = command_artifacts(ns)
    finally:
        sys.stdout = orig
    return buf.getvalue(), rc


# ─── Step 1: real API 実行 ────────────────────────────────────────────────────
print("\n=== [Step 1] real API 実行 ===")
print(f"  GOAL: {GOAL[:60]}...")

conv_id = create_conversation(
    _DB,
    title=GOAL[:80],
    role_system=(
        "ChatGPT（Planner）と Claude（Executor）が協調してタスクを実行する。"
        "Planner が指示を書き、Executor が実行・報告する。"
    ),
    project_id="AIOS-TEST-P8",
)

append_message(
    _DB, conv_id,
    turn_id=0,
    role_executor="planner",
    source_model="human",
    target_model="gpt-4o",
    content=f"[GOAL] {GOAL}",
    requires_approval=False,
)
log_session_start(_DB, conv_id, goal=GOAL)

print(f"  conv_id: {conv_id[:8]}...")

result = run_loop(_DB, conv_id, max_turns=3, dry_run=False, verbose=True)
print(f"\n  run_loop result: {result}")
_assert(result in ("completed", "max_turns_reached"),
        f"run_loop が正常終了 (actual: {result})")

# ─── Step 2: artifact 保存確認 ───────────────────────────────────────────────
print("\n=== [Step 2] artifact 保存確認 ===")

arts = get_artifacts_by_conv(_DB, conv_id)
print(f"  保存件数: {len(arts)}")

for a in arts:
    print(f"    T{a['turn_id']:02d}  {a['artifact_id'][:8]}...  "
          f"type={a['artifact_type']}  lang={a['language']!r:12s}  "
          f"file={a.get('filename') or '-'}")

_assert(len(arts) >= 1, f"artifact が 1 件以上保存されている (actual: {len(arts)})")

# false positive: 数字のみの language tag が保存されていない
digit_only = [a for a in arts if a["language"].strip().isdigit()]
_assert(len(digit_only) == 0,
        f"lang=数字のみ の artifact が存在しない (digit_only: {len(digit_only)})")

# 期待される言語タグが含まれているか（最低 1 つ）
found_langs = {a["language"] for a in arts}
print(f"  検出された language タグ: {sorted(found_langs)}")
_assert(bool(found_langs - {""}),
        f"空文字以外の language タグが 1 つ以上存在する")

# ─── Step 3: CLI 一覧表示 ────────────────────────────────────────────────────
print("\n=== [Step 3] CLI: artifacts --conv-id ===")

out3, rc3 = _run_cmd_artifacts(conv_id)
print(out3)
_assert(rc3 == 0,                   f"終了コード 0 (actual: {rc3})")
_assert(str(len(arts)) in out3 or f"count   : {len(arts)}" in out3,
        "出力に件数が含まれる")
_assert(conv_id[:8] in out3,        "出力に conv_id が含まれる")

# ─── Step 4: CLI --artifact-id で本文取得 ───────────────────────────────────
print("\n=== [Step 4] CLI: --artifact-id で本文取得 ===")

target = arts[0]
prefix = target["artifact_id"][:8]
out4, rc4 = _run_cmd_artifacts(conv_id, artifact_id=prefix)
print(out4)
_assert(rc4 == 0,                   f"終了コード 0 (actual: {rc4})")
_assert("artifact_id" in out4,      "artifact_id ラベルが表示される")
_assert("```" in out4,              "フェンスブロックが含まれる")

# ─── Step 5: false positive 確認 ─────────────────────────────────────────────
print("\n=== [Step 5] false positive: lang=数字のみ は 0 件 ===")

_assert(len(digit_only) == 0,
        f"保存された artifact の中に lang=数字のみ が存在しない（{len(digit_only)} 件）")
print(f"  全 language タグ: {sorted(found_langs)}")
print(f"  数字のみタグ件数: {len(digit_only)}")

# ─── Step 6: 失敗時挙動 ──────────────────────────────────────────────────────
print("\n=== [Step 6] 失敗時挙動確認 ===")

# 6a: 0 件会話
conv_empty = create_conversation(
    _DB, title="artifact なし会話", role_system="test", project_id="AIOS-TEST-P8"
)
out6a, rc6a = _run_cmd_artifacts(conv_empty)
_assert(rc6a == 0,                   "0件会話: 終了コード 0")
_assert("artifact なし" in out6a,    "0件会話: メッセージが表示される")

# 6b: 存在しない artifact_id
out6b, rc6b = _run_cmd_artifacts(conv_id, artifact_id="00000000")
_assert(rc6b == 1,                   "存在しない artifact_id: 終了コード 1")

print("\n=== 全ステップ成功 ===\n")

# ─── 結果サマリ ────────────────────────────────────────────────────────────────
print("=" * 60)
print("Phase 8 Real API 実測結果サマリ")
print("=" * 60)
print(f"  conv_id     : {conv_id}")
print(f"  run_result  : {result}")
print(f"  artifact 件数: {len(arts)}")
for i, a in enumerate(arts):
    body_preview = (a.get("content") or "")[:60].replace("\n", "\\n")
    print(f"  [{i+1}] type={a['artifact_type']:<8} lang={a['language']!r:<12} "
          f"file={a.get('filename') or '-'}")
    print(f"      body: {body_preview}...")
print(f"  false positive (digit lang): {len(digit_only)} 件")
print("=" * 60)
