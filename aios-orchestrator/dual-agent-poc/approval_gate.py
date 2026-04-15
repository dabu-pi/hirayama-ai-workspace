"""
approval_gate.py — 人間承認ゲート

Planner が生成した指示に危険操作が含まれる場合、
CLI 経由で人間に確認を取る。

役割分担:
  - parse_requires_approval(): テキスト解析（フラグ検出）
  - prompt_approval():          CLI 対話（y/n 入力受付）
  - prompt_approval_with_message_id(): message_id 付き表示版

設計根拠: aios-orchestrator/04_risks.md (R2: 誤実行対策)
"""

from __future__ import annotations

import re
import sys
from typing import Optional

# ─── 危険キーワード（Orchestrator 側の二重チェック用）─────────────────────────
# Planner が REQUIRES_APPROVAL を書き忘れた場合でも検出する
DANGER_KEYWORDS: list[str] = [
    "削除", "delete", "DROP TABLE", "rm ",
    "os.remove", "shutil.rmtree",
    "POST ", "send_mail", "freee",
    "overwrite", "上書き",
    ".env", "secret", "credential",
    "subprocess", "os.system", "exec(",
]


# ─── フラグ検出 ───────────────────────────────────────────────────────────────

_APPROVAL_PATTERN = re.compile(
    r"REQUIRES_APPROVAL\s*:\s*true",
    re.IGNORECASE,
)


def parse_requires_approval(text: str) -> bool:
    """
    テキスト中に ``REQUIRES_APPROVAL: true`` が含まれるか検出する。

    大文字小文字・前後空白のゆれに対応する。
    Planner の自己申告フラグを検出するために使う。

    Args:
        text: Planner が生成した応答テキスト

    Returns:
        True  — フラグあり（承認が必要）
        False — フラグなし
    """
    return bool(_APPROVAL_PATTERN.search(text))


def has_danger_keyword(text: str) -> bool:
    """
    DANGER_KEYWORDS のいずれかがテキストに含まれるか検出する。

    parse_requires_approval() の二重チェックとして orchestrator から呼ぶ。
    Planner がフラグを書き忘れた場合でも危険操作を捕捉する。

    Args:
        text: Planner が生成した応答テキスト

    Returns:
        True — 危険キーワードあり
    """
    return any(kw.lower() in text.lower() for kw in DANGER_KEYWORDS)


def needs_approval(text: str, planner_flagged: bool = False) -> bool:
    """
    承認が必要かどうかを総合判定する。

    Planner の自己申告（planner_flagged）と
    キーワード二重チェック（has_danger_keyword）のいずれかが
    True であれば承認を要求する。

    Args:
        text:            Planner の応答テキスト
        planner_flagged: parse_requires_approval() の結果を渡す（省略可）

    Returns:
        True — 承認が必要
    """
    return planner_flagged or parse_requires_approval(text) or has_danger_keyword(text)


# ─── CLI 対話 ─────────────────────────────────────────────────────────────────

_SEPARATOR = "─" * 60


def _print_approval_prompt(text: str, message_id: Optional[str] = None) -> None:
    """承認確認の表示を整形して出力する（内部ユーティリティ）。"""
    print()
    print(_SEPARATOR)
    print("[承認待ち] Planner の指示に危険操作が含まれています")
    if message_id:
        print(f"message_id : {message_id}")
    print(_SEPARATOR)
    print(text.strip())
    print(_SEPARATOR)
    print("この操作は不可逆になる可能性があります。")


def prompt_approval(text: str) -> bool:
    """
    CLI で承認確認を行い、承認なら True / 却下なら False を返す。

    y / yes → True（承認）
    n / no  → False（却下）
    それ以外 → 再入力を求める（無限に聞き続ける）

    EOF（Ctrl-D / Ctrl-Z）が来た場合は安全側に倒して False を返す。

    Args:
        text: Planner の指示テキスト（確認画面に表示する）

    Returns:
        True  — 承認（実行を続行する）
        False — 却下（実行を中断する）
    """
    _print_approval_prompt(text)

    while True:
        try:
            raw = input("承認しますか？ [y/n]: ").strip().lower()
        except EOFError:
            print("\n[EOF 検出] 安全のため却下します。")
            return False

        if raw in ("y", "yes"):
            print("[承認] 実行を続行します。")
            return True
        if raw in ("n", "no"):
            try:
                reason = input("却下理由（省略可、Enter でスキップ）: ").strip()
            except EOFError:
                reason = ""
            if reason:
                print(f"[却下] 理由: {reason}")
            else:
                print("[却下] 実行を中断します。")
            return False

        print(f"  入力が不正です: '{raw}'。y / yes / n / no で入力してください。")


def prompt_approval_with_message_id(
    text: str,
    message_id: Optional[str] = None,
) -> bool:
    """
    message_id を表示しつつ CLI で承認確認を行う。

    orchestrator.py から呼ぶ際に message_id を渡すことで、
    run_log や DB レコードとの紐付けを人間が確認しやすくなる。

    Args:
        text:       Planner の指示テキスト
        message_id: 対象メッセージの UUID（省略可）

    Returns:
        True  — 承認
        False — 却下
    """
    _print_approval_prompt(text, message_id=message_id)

    while True:
        try:
            raw = input("承認しますか？ [y/n]: ").strip().lower()
        except EOFError:
            print("\n[EOF 検出] 安全のため却下します。")
            return False

        if raw in ("y", "yes"):
            print("[承認] 実行を続行します。")
            return True
        if raw in ("n", "no"):
            try:
                reason = input("却下理由（省略可、Enter でスキップ）: ").strip()
            except EOFError:
                reason = ""
            if reason:
                print(f"[却下] 理由: {reason}")
            else:
                print("[却下] 実行を中断します。")
            return False

        print(f"  入力が不正です: '{raw}'。y / yes / n / no で入力してください。")
