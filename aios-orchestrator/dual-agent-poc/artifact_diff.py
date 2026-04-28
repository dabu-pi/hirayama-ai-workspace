"""
artifact_diff.py — artifact のターン間差分を計算する (Phase 9)

設計方針:
  - 比較単位: filename が同一なら同一系統とみなす（第一候補）
    filename が None / 空の場合は (language, artifact_type) をキーにする（補助候補）
  - ソート: turn_id 昇順（同一 turn_id 内は created_at 順）
  - 差分アルゴリズム: Python 標準 difflib.unified_diff（テキストベース）
  - 本モジュールは計算のみ担当。表示・DB アクセスは orchestrator.py 側が行う

公開 API:
  group_artifacts(arts)      → dict[str, list[dict]]  系統ごとのグループ
  compute_diff(left, right)  → str                    unified diff テキスト
  find_prev_in_group(art, group_arts) → dict | None   系統内の直前 artifact
  find_by_prefix(arts, prefix)        → dict | None   前方一致で artifact を探す
"""

from __future__ import annotations

import difflib
from typing import Optional


# ─── グルーピング ──────────────────────────────────────────────────────────────

def _group_key(art: dict) -> str:
    """
    artifact の系統キーを返す。

    filename がある場合はそれをキーとする。
    filename が空 / None の場合は "lang=<language>|type=<artifact_type>" を使う。
    """
    fname = (art.get("filename") or "").strip()
    if fname:
        return fname
    lang  = (art.get("language")      or "").strip()
    atype = (art.get("artifact_type") or "").strip()
    return f"lang={lang}|type={atype}"


def group_artifacts(arts: list[dict]) -> dict[str, list[dict]]:
    """
    artifact リストを系統ごとにグループ化して返す。

    - キー: _group_key() が返す文字列
    - 値: turn_id 昇順にソートされた artifact リスト
    - 2 件以上あるグループのみ返す（diff 対象が存在するグループ）
    - 1 件以下のグループは含まない

    Returns:
        { group_key: [art1, art2, ...], ... }
    """
    buckets: dict[str, list[dict]] = {}
    for a in arts:
        k = _group_key(a)
        buckets.setdefault(k, []).append(a)

    # 各バケツを turn_id → created_at でソート
    result: dict[str, list[dict]] = {}
    for k, bucket in buckets.items():
        sorted_bucket = sorted(bucket, key=lambda x: (x["turn_id"], x.get("created_at") or ""))
        if len(sorted_bucket) >= 2:
            result[k] = sorted_bucket

    return result


def group_artifacts_all(arts: list[dict]) -> dict[str, list[dict]]:
    """
    1 件のみのグループも含めて全グループを返す（表示用）。
    """
    buckets: dict[str, list[dict]] = {}
    for a in arts:
        k = _group_key(a)
        buckets.setdefault(k, []).append(a)

    return {
        k: sorted(bucket, key=lambda x: (x["turn_id"], x.get("created_at") or ""))
        for k, bucket in buckets.items()
    }


# ─── 前後検索 ────────────────────────────────────────────────────────────────

def find_by_prefix(arts: list[dict], prefix: str) -> Optional[dict]:
    """
    artifact_id の前方一致で artifact を返す。見つからなければ None。
    """
    prefix = prefix.strip()
    return next((a for a in arts if a["artifact_id"].startswith(prefix)), None)


def find_prev_in_group(art: dict, group_arts: list[dict]) -> Optional[dict]:
    """
    同一系統リストの中で、指定 artifact の直前（turn_id が小さい最新のもの）を返す。

    - group_arts は turn_id 昇順にソート済みであること
    - 先頭 artifact（前がない）なら None を返す
    """
    target_id = art["artifact_id"]
    prev = None
    for a in group_arts:
        if a["artifact_id"] == target_id:
            return prev
        prev = a
    return None  # group に含まれていない場合


def find_next_in_group(art: dict, group_arts: list[dict]) -> Optional[dict]:
    """
    同一系統リストの中で、指定 artifact の直後（turn_id が大きい最小のもの）を返す。
    """
    target_id = art["artifact_id"]
    found = False
    for a in group_arts:
        if found:
            return a
        if a["artifact_id"] == target_id:
            found = True
    return None


# ─── diff 計算 ───────────────────────────────────────────────────────────────

def compute_diff(left: dict, right: dict, context: int = 5) -> str:
    """
    2 つの artifact の unified diff を返す。

    Args:
        left:    比較元（古い方）
        right:   比較先（新しい方）
        context: diff に含める前後の行数（デフォルト 5）

    Returns:
        unified diff テキスト。差分がなければ空文字。
    """
    left_body  = (left.get("content")  or "").splitlines(keepends=True)
    right_body = (right.get("content") or "").splitlines(keepends=True)

    left_label  = (
        f"{left.get('filename') or left['artifact_id'][:8]}"
        f"  (T{left['turn_id']:02d}  {left['artifact_id'][:8]}...)"
    )
    right_label = (
        f"{right.get('filename') or right['artifact_id'][:8]}"
        f"  (T{right['turn_id']:02d}  {right['artifact_id'][:8]}...)"
    )

    diff_lines = list(difflib.unified_diff(
        left_body,
        right_body,
        fromfile=left_label,
        tofile=right_label,
        n=context,
    ))

    if not diff_lines:
        return ""

    return "".join(diff_lines)


def diff_stat(diff_text: str) -> tuple[int, int]:
    """
    unified diff テキストから追加行数・削除行数を返す。

    Returns:
        (added, deleted) のタプル
    """
    added   = sum(1 for ln in diff_text.splitlines() if ln.startswith("+") and not ln.startswith("+++"))
    deleted = sum(1 for ln in diff_text.splitlines() if ln.startswith("-") and not ln.startswith("---"))
    return added, deleted


# ─── 連続ペア生成 ─────────────────────────────────────────────────────────────

def consecutive_pairs(sorted_arts: list[dict]) -> list[tuple[dict, dict]]:
    """
    turn_id 昇順にソートされた artifact リストから、隣接ペアを返す。

    例: [a1, a2, a3] → [(a1, a2), (a2, a3)]
    """
    return [(sorted_arts[i], sorted_arts[i + 1]) for i in range(len(sorted_arts) - 1)]
