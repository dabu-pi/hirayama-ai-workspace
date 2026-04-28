"""
test_phase7_artifacts_cli.py — Phase 7: false positive フィルタ + artifacts CLI 検証

実行:
    PYTHONIOENCODING=utf-8 PYTHONUTF8=1 python test_phase7_artifacts_cli.py

前提:
    API キー不要（dry_run=True / 直接呼び出し）
    独立した data/test_phase7.db を使用

検証項目:
    1. false positive フィルタ: lang=数字のみ → スキップ
    2. false positive フィルタ: lang=スペース含む → スキップ
    3. false positive フィルタ: lang=正常（"c", "r" 等 1文字）→ 通過
    4. parse_artifacts: 有効 + 無効タグ混在 → 有効分だけ抽出
    5. command_artifacts: 一覧表示（stderr なし・0件表示含む）
    6. command_artifacts: --artifact-id で本文全体表示
    7. command_artifacts: 存在しない conv_id → exit code 1
"""

from __future__ import annotations

import sys
import io
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from store import (
    init_db, create_conversation, append_message,
    append_artifact, get_artifacts_by_conv,
)
from artifact_parser import parse_artifacts
from orchestrator import command_artifacts
from run_logger import log_session_start
import argparse

_DB = str(Path(__file__).parent / "data" / "test_phase7.db")

if Path(_DB).exists():
    Path(_DB).unlink()

init_db(_DB)


def _assert(cond: bool, msg: str) -> None:
    if not cond:
        print(f"  [FAIL] {msg}")
        sys.exit(1)
    print(f"  [OK]   {msg}")


def _start_conv(goal: str) -> str:
    conv_id = create_conversation(_DB, title=goal[:80], role_system="test",
                                  project_id="test-phase7")
    append_message(_DB, conv_id, turn_id=0, role_executor="planner",
                   source_model="human", target_model="gpt-4o",
                   content=f"[GOAL] {goal}")
    log_session_start(_DB, conv_id, goal=goal)
    return conv_id


def _run_command_artifacts(conv_id: str, artifact_id: str | None = None) -> tuple[str, int]:
    """command_artifacts を呼んで stdout を返す。"""
    ns = argparse.Namespace(db=_DB, conv_id=conv_id, artifact_id=artifact_id)
    buf = io.StringIO()
    orig_stdout = sys.stdout
    sys.stdout = buf
    try:
        rc = command_artifacts(ns)
    finally:
        sys.stdout = orig_stdout
    return buf.getvalue(), rc


# ─── Test 1: lang=数字のみ はスキップ ─────────────────────────────────────────
print("\n=== [Test 1] false positive: lang=数字のみ → スキップ ===")

# Executor が実行出力を ```1 ... ``` で書いた場合
fp_sample = "```1\n1 Fizz\n2 Buzz\n```"
result1 = parse_artifacts(fp_sample)
_assert(len(result1) == 0, f"lang='1' の artifact は抽出されない (actual: {len(result1)})")

fp_sample2 = "```123\nsome output\n```"
result1b = parse_artifacts(fp_sample2)
_assert(len(result1b) == 0, f"lang='123' の artifact は抽出されない (actual: {len(result1b)})")

# ─── Test 2: lang=スペース含む はスキップ ─────────────────────────────────────
print("\n=== [Test 2] false positive: lang=スペース含む → スキップ ===")

# 通常はフェンス正規表現が [\w+\-\.]* でスペース含む言語タグはマッチしないが、
# _is_valid_lang() の防衛も確認する
from artifact_parser import _is_valid_lang
_assert(not _is_valid_lang("python code"), "lang='python code' は無効")
_assert(not _is_valid_lang("py\tcode"), "lang='py\\tcode' は無効")

# ─── Test 3: 1文字有効タグ（c / r）は通過 ─────────────────────────────────────
print("\n=== [Test 3] 1文字タグ（c / r）は有効 ===")

_assert(_is_valid_lang("c"),  "lang='c' は有効")
_assert(_is_valid_lang("r"),  "lang='r' は有効")
_assert(_is_valid_lang(""),   "lang='' は有効（言語未指定）")
_assert(_is_valid_lang("go"), "lang='go' は有効")

c_block = "```c\nint main() { return 0; }\n```"
r_block  = "```r\nprint('hello')\n```"
_assert(len(parse_artifacts(c_block)) == 1, "lang='c' の artifact は抽出される")
_assert(len(parse_artifacts(r_block))  == 1, "lang='r' の artifact は抽出される")

# ─── Test 4: 有効 + 無効タグ混在 → 有効分だけ ────────────────────────────────
print("\n=== [Test 4] 有効 + 無効タグ混在 → 有効分だけ抽出 ===")

mixed = """
以下が実装です。

```python
def hello():
    print("hello")
```

実行結果:

```1
hello
```

設定ファイル:

```yaml
name: test
```
"""

mixed_results = parse_artifacts(mixed)
_assert(len(mixed_results) == 2,
        f"python + yaml の 2 件のみ抽出（lang=1 は除外）(actual: {len(mixed_results)})")
langs = [a["language"] for a in mixed_results]
_assert("python" in langs, "python artifact が含まれる")
_assert("yaml"   in langs, "yaml artifact が含まれる")
_assert("1"      not in langs, "lang='1' は含まれない")

# ─── Test 5: command_artifacts 一覧表示 ───────────────────────────────────────
print("\n=== [Test 5] command_artifacts: 一覧表示 ===")

conv5 = _start_conv("CLI artifact 一覧テスト")
msg5 = append_message(_DB, conv5, turn_id=1, role_executor="executor",
                      source_model="claude", target_model="gpt-4o",
                      content="```python\nprint('hello')\n```")
art5a = append_artifact(_DB, msg5, "code",  "artifact.py",  "print('hello')", language="python")
art5b = append_artifact(_DB, msg5, "shell", "setup.sh",     "echo done",       language="bash")

out5, rc5 = _run_command_artifacts(conv5)
_assert(rc5 == 0,                   f"終了コード 0 (actual: {rc5})")
_assert("python" in out5,           "出力に python が含まれる")
_assert("bash"   in out5,           "出力に bash が含まれる")
_assert("artifact.py" in out5,      "出力に artifact.py が含まれる")
_assert("count   : 2" in out5,      f"count=2 が表示される")

# 0 件の場合
conv5z = _start_conv("artifact なし会話")
out5z, rc5z = _run_command_artifacts(conv5z)
_assert(rc5z == 0,                  "0件でも終了コード 0")
_assert("artifact なし" in out5z,   "0件メッセージが表示される")

# ─── Test 6: --artifact-id で本文全体表示 ─────────────────────────────────────
print("\n=== [Test 6] command_artifacts: --artifact-id で本文表示 ===")

out6, rc6 = _run_command_artifacts(conv5, artifact_id=art5a[:8])
_assert(rc6 == 0,                              f"終了コード 0 (actual: {rc6})")
_assert("print('hello')" in out6,             "本文に print('hello') が含まれる")
_assert("artifact_id" in out6,                "artifact_id ラベルが表示される")
_assert("```python" in out6,                  "フェンスブロックで囲まれている")

# ─── Test 7: 存在しない conv_id → exit code 1 ────────────────────────────────
print("\n=== [Test 7] 存在しない conv_id → exit code 1 ===")

out7, rc7 = _run_command_artifacts("nonexistent-conv-id-0000")
_assert(rc7 == 1, f"終了コード 1 (actual: {rc7})")

print("\n=== 全テスト成功 ===\n")
