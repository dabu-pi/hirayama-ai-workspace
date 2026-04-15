"""
test_phase10_real_api.py — Phase 10: explicit filename E2E 確認

実行:
    PYTHONIOENCODING=utf-8 PYTHONUTF8=1 python test_phase10_real_api.py

概要:
    パート A: _save_artifacts_safely() に explicit filename 付き Executor 出力を直接注入して
              DB 保存・取得を確認する（API コール不要）
    パート B: real API で 1 本実行し、保存された filename に unsafe なパスが含まれないことを確認する
              （LLM が # filename: 記法を使うかは non-deterministic のため WARN 扱い）
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env", override=True)
except ImportError:
    pass

from store import (
    init_db, create_conversation, append_message,
    get_artifacts_by_conv,
)
from orchestrator import run_loop, _save_artifacts_safely
from run_logger import log_session_start

_DB = str(Path(__file__).parent / "data" / "test_phase10.db")

if Path(_DB).exists():
    Path(_DB).unlink()
init_db(_DB)


def _assert(cond: bool, msg: str) -> None:
    if not cond:
        print(f"  [FAIL] {msg}")
        sys.exit(1)
    print(f"  [OK]   {msg}")


# ─────────────────────────────────────────────────────────────────────────────
# パート A: _save_artifacts_safely() 直接注入で explicit filename 保存確認
# ─────────────────────────────────────────────────────────────────────────────
print("\n=== [Part A] explicit filename 直接保存確認 ===")

EXECUTOR_OUTPUT_WITH_FILENAMES = """
実装しました。

# filename: main.py
```python
import requests
import yaml

def fetch(url):
    resp = requests.get(url, timeout=10)
    resp.raise_for_status()
    return resp.json()

if __name__ == "__main__":
    with open("config.yaml") as f:
        cfg = yaml.safe_load(f)
    print(fetch(cfg["endpoint"]))
```

# filename: requirements.txt
```text
requests>=2.31.0
pyyaml>=6.0
```

# filename: config.yaml
```yaml
endpoint: https://jsonplaceholder.typicode.com/posts/1
timeout: 10
```
"""

conv_a = create_conversation(
    _DB, title="Part A explicit filename test",
    role_system="test", project_id="AIOS-TEST-P10A",
)
msg_a = append_message(
    _DB, conv_a, turn_id=1, role_executor="executor",
    source_model="claude", target_model="gpt-4o",
    content=EXECUTOR_OUTPUT_WITH_FILENAMES,
)
log_session_start(_DB, conv_a, goal="Part A explicit filename test")

_save_artifacts_safely(
    _DB, conv_a, msg_a,
    EXECUTOR_OUTPUT_WITH_FILENAMES,
    turn_id=1, verbose=True,
)

arts_a = get_artifacts_by_conv(_DB, conv_a)
print(f"\n  保存件数: {len(arts_a)}")
for a in arts_a:
    src = a.get("filename_source") or "?"
    print(f"    T{a['turn_id']:02d}  {a['artifact_id'][:8]}...  "
          f"type={a['artifact_type']:<8}  lang={a['language']:<8}  "
          f"file={a.get('filename') or '-':<22}  src={src}")

_assert(len(arts_a) == 3,  f"3 件保存 (actual: {len(arts_a)})")

# main.py
main_art = next((a for a in arts_a if a.get("filename") == "main.py"), None)
_assert(main_art is not None,                             "main.py が保存されている")
_assert(main_art["language"] == "python",                 "main.py lang=python")
_assert(main_art["artifact_type"] == "code",              "main.py type=code")
_assert(main_art.get("filename_source") == "explicit",    "main.py filename_source=explicit")

# requirements.txt
req_art = next((a for a in arts_a if a.get("filename") == "requirements.txt"), None)
_assert(req_art is not None,                              "requirements.txt が保存されている")
_assert(req_art.get("filename_source") == "explicit",     "requirements.txt filename_source=explicit")

# config.yaml
cfg_art = next((a for a in arts_a if a.get("filename") == "config.yaml"), None)
_assert(cfg_art is not None,                              "config.yaml が保存されている")
_assert(cfg_art["language"] == "yaml",                    "config.yaml lang=yaml")
_assert(cfg_art.get("filename_source") == "explicit",     "config.yaml filename_source=explicit")

# false positive / unsafe filename なし
digit_arts = [a for a in arts_a if (a.get("language") or "").strip().isdigit()]
_assert(len(digit_arts) == 0,  "lang=数字のみ artifact: 0 件")

unsafe = [a for a in arts_a if a.get("filename") and (
    ".." in (a.get("filename") or "") or "/" in (a.get("filename") or "")
)]
_assert(len(unsafe) == 0,  "unsafe filename: 0 件")

print("  [PASS] Part A 全確認 OK")

# ─────────────────────────────────────────────────────────────────────────────
# パート B: real API — 安全性確認（filename_source は non-deterministic で WARN 扱い）
# ─────────────────────────────────────────────────────────────────────────────
print("\n=== [Part B] real API 実行 — filename 安全性確認 ===")

GOAL_B = (
    "Python の requests ライブラリで GET リクエストを送るスクリプトを実装してください。"
    "コードブロックの直前に # filename: <ファイル名> の形式でファイル名を明示してください。"
)

conv_b = create_conversation(
    _DB, title=GOAL_B[:80],
    role_system=(
        "ChatGPT（Planner）と Claude（Executor）が協調してタスクを実行する。"
        "Planner が指示を書き、Executor が実行・報告する。"
    ),
    project_id="AIOS-TEST-P10B",
)
append_message(_DB, conv_b, turn_id=0, role_executor="planner",
               source_model="human", target_model="gpt-4o",
               content=f"[GOAL] {GOAL_B}", requires_approval=False)
log_session_start(_DB, conv_b, goal=GOAL_B)

print(f"  conv_id: {conv_b[:8]}...")
result_b = run_loop(_DB, conv_b, max_turns=3, dry_run=False, verbose=True)
print(f"\n  run_loop result: {result_b}")
_assert(result_b in ("completed", "max_turns_reached"), f"正常終了 (actual: {result_b})")

arts_b = get_artifacts_by_conv(_DB, conv_b)
print(f"\n  保存件数: {len(arts_b)}")
for a in arts_b:
    src = a.get("filename_source") or "?"
    print(f"    T{a['turn_id']:02d}  {a['artifact_id'][:8]}...  "
          f"lang={a['language']:<8}  file={a.get('filename') or '-':<22}  src={src}")

# unsafe filename が含まれていないことは必須チェック
unsafe_b = [a for a in arts_b if a.get("filename") and (
    ".." in (a.get("filename") or "")
    or "/" in (a.get("filename") or "")
    or "\\" in (a.get("filename") or "")
)]
_assert(len(unsafe_b) == 0,  f"unsafe filename: 0 件 (actual: {len(unsafe_b)})")

# digit lang なし
digit_b = [a for a in arts_b if (a.get("language") or "").strip().isdigit()]
_assert(len(digit_b) == 0,  f"lang=数字のみ artifact: 0 件 (actual: {len(digit_b)})")

# explicit filename は LLM 次第 → WARN のみ
explicit_b = [a for a in arts_b if a.get("filename_source") == "explicit"]
if explicit_b:
    print(f"\n  [INFO] LLM が # filename: を使用: {len(explicit_b)} 件")
    for a in explicit_b:
        print(f"    explicit: {a.get('filename')} (lang={a['language']})")
else:
    print("\n  [WARN] LLM が # filename: 記法を使わなかった（inferred にフォールバック）")
    print("         Phase 10 実装は正常（フォールバック動作）。")

print(f"\n  Part B conv_id: {conv_b}")
print("  [PASS] Part B 安全性確認 OK")
print("\n=== Phase 10 real API 完了 ===\n")

# サマリ
print("=" * 60)
print("Phase 10 実測結果サマリ")
print("=" * 60)
print(f"  Part A conv_id  : {conv_a}")
print(f"  Part A artifacts: {len(arts_a)} 件 (main.py/requirements.txt/config.yaml)")
print(f"  Part A explicit : {sum(1 for a in arts_a if a.get('filename_source')=='explicit')} 件")
print(f"  Part B conv_id  : {conv_b}")
print(f"  Part B artifacts: {len(arts_b)} 件")
print(f"  Part B explicit : {len(explicit_b)} 件 ({'LLM が記法を使用' if explicit_b else 'WARN: 推定にフォールバック'})")
print(f"  unsafe filename : 0 件")
print("=" * 60)
