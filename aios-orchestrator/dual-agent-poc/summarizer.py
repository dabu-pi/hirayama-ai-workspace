"""
summarizer.py — conversations.summary 自動更新モジュール (Phase 2)

Planner / Executor の 1 ターンと「現在の summary」を LLM に渡し、
**増分更新**した新しい summary を返す。全履歴の再要約はしない。

設計方針:
  - 既存 summary を維持しつつ、新規 turn の差分だけを反映する
  - 出力は 5 項目固定構造（目的 / 決定事項 / 未完了 / 保留 / 次アクション）
  - 冗長な逐語引用・コードブロックは入れない
  - 500 字以内に収めることで context 送信時のトークンコストを抑える

設計根拠: aios-orchestrator/07_next_tasks.md / README_E2E.md (Phase 2)
"""

from __future__ import annotations

import os
import textwrap
from typing import Any, Optional

from openai_client import chat_openai


# ─── 定数 ────────────────────────────────────────────────────────────────────
# .env の SUMMARY_MODEL で上書き可。未設定なら gpt-4o-mini（低コスト）を使う。
_DEFAULT_SUMMARY_MODEL = "gpt-4o-mini"

# summary の文字数上限（system prompt と一致させること）
_SUMMARY_CHAR_LIMIT = 500


def _summary_model() -> str:
    return os.getenv("SUMMARY_MODEL", _DEFAULT_SUMMARY_MODEL)


def _strip_code_block(text: str) -> str:
    """
    LLM がコードブロック記法（``` ... ``` や ` ... `）で
    summary を囲んで返した場合に除去する。

    system prompt で禁止しているが、モデルが無視することがあるため
    Python 側でもガードする。
    """
    stripped = text.strip()
    # ``` で始まる場合（言語名付き ``` yaml など含む）
    if stripped.startswith("```"):
        lines = stripped.splitlines()
        # 先頭行（```lang）と末尾行（```）を除去
        if len(lines) >= 2:
            inner_lines = lines[1:]
            # 末尾の ``` を除去
            if inner_lines and inner_lines[-1].strip() == "```":
                inner_lines = inner_lines[:-1]
            return "\n".join(inner_lines).strip()
    return stripped


# ─── Summarizer system prompt ────────────────────────────────────────────────
_SUMMARY_SYSTEM_PROMPT = textwrap.dedent("""
    あなたは会話要約アシスタントです。
    Planner(ChatGPT) と Executor(Claude) の二者間会話の「現在地」を
    常に最新・簡潔に保つことがあなたの責務です。

    【出力する 5 項目（順序固定・変更禁止）】
    1. 目的: 会話の最終ゴール（1 行）
    2. 重要な決定事項: 採用した方針・仕様（箇条書き、最大 5 項目）
    3. 未完了タスク: 残っている作業（箇条書き、最大 5 項目）
    4. 保留 / 承認待ち: 承認待ち項目・危険操作（該当なしなら「なし」）
    5. 次アクション: 直近で Planner が出すべき 1 手（1 行）

    【重要な決定事項の書き方 — 必ず守ること】
    - 1 行目は必ず「技術スタック: 言語/FW/DB/認証/インフラ/ライブラリ...」の形式で
      採用した全技術を / 区切りで 1 行に収める。
      例: 技術スタック: Python3.11/FastAPI/PostgreSQL/JWT/Docker/Redis/structlog
    - 2 行目以降は「完了した主要タスク」を最大 4 件まで箇条書きにする。
    - 既存の技術スタック行に新技術が加わった場合は 1 行目を更新する（削除禁止）。
    - 箇条書きは 20 字以内に圧縮する。

    【500 字厳守ルール — 最重要】
    - 出力全体を必ず 500 字以内に収めること。これは絶対条件。
    - 500 字を超えそうな場合は、以下の優先順位で圧縮すること:
      a) 完了タスク欄（2 行目以降）を最新 3 件に絞る。
      b) 各行を 15 字以内に短縮する。
      c) 未完了タスクを最新 2 件に絞る。
    - 技術スタック行（1 行目）は文字数超過時も削除禁止。

    【増分更新ルール】
    - 新規 turn で「変わった項目」だけを更新する。
    - 解決済みの未完了タスクは削除するだけでよい（他欄への移動禁止）。
    - 重複・冗長表現は削ぎ落とす。

    【厳禁事項】
    - コードブロック記法（``` や ` など）を一切使わないこと。
    - 5 項目以外の自由記述を追加しないこと。
    - 重要な決定事項の箇条書きが 5 件を超えること（1行目の技術スタック行 + 4件まで）。
    - 500 字を超えること。

    【出力フォーマット（このまま使用）】
    目的: ...
    重要な決定事項:
    - 技術スタック: X/Y/Z
    - ...
    未完了タスク:
    - ...
    保留 / 承認待ち: ...
    次アクション: ...
""").strip()


# ─── Prompt 組み立て ─────────────────────────────────────────────────────────
def build_summary_update_messages(
    existing_summary: Optional[str],
    planner_content: str,
    executor_content: Optional[str],
    goal: Optional[str] = None,
    turn_id: Optional[int] = None,
    event: str = "turn_end",
) -> list[dict[str, str]]:
    """
    summary 更新用の user message を 1 件だけ組み立てる。

    増分更新のため、全履歴ではなく「現在の summary」と「直前 1 ターン」だけを渡す。

    Args:
        existing_summary: conversations.summary の現在値（None 可）
        planner_content:  このターンの Planner 発言
        executor_content: このターンの Executor 発言（承認待ち / 完了時は None 可）
        goal:             会話の最終ゴール（初回の文脈補助）
        turn_id:          ターン番号（ログ用の参考情報）
        event:            'turn_end' | 'task_complete' | 'waiting_approval'
    """
    parts: list[str] = []

    if goal:
        parts.append(f"[ゴール]\n{goal}")

    parts.append(
        "[現在の summary]\n"
        + (existing_summary if existing_summary else "（まだありません。初回要約です）")
    )

    turn_label = f"Turn {turn_id}" if turn_id is not None else "最新ターン"
    parts.append(f"[このターンの Planner 発言 — {turn_label}]\n{planner_content}")

    if executor_content is not None:
        parts.append(f"[このターンの Executor 発言 — {turn_label}]\n{executor_content}")
    else:
        note = {
            "waiting_approval": "（承認待ちのため Executor は未実行）",
            "task_complete":    "（TASK_COMPLETE のため Executor は呼ばれていない）",
        }.get(event, "（Executor 発言なし）")
        parts.append(f"[このターンの Executor 発言 — {turn_label}]\n{note}")

    footer = {
        "waiting_approval": "保留 / 承認待ち 欄に、今このターンで承認待ちになった内容を反映してください。",
        "task_complete":    "未完了タスクを空にし、次アクションは「（完了）」としてください。",
        "turn_end":         "",
    }.get(event, "")

    instruction = "上記を踏まえて、新しい summary を 5 項目で出力してください。"
    if footer:
        instruction += " " + footer

    parts.append(instruction)
    return [{"role": "user", "content": "\n\n".join(parts)}]


# ─── Summary 生成本体 ────────────────────────────────────────────────────────
def generate_summary(
    existing_summary: Optional[str],
    planner_content: str,
    executor_content: Optional[str],
    goal: Optional[str] = None,
    turn_id: Optional[int] = None,
    event: str = "turn_end",
    model: Optional[str] = None,
) -> dict[str, Any]:
    """
    既存 summary + 新規 1 ターンから更新版 summary を 1 回の LLM コールで生成する。

    Returns:
        {
            "summary":     str,             # 更新後の summary 本文
            "model":       str,             # 実際に使ったモデル名
            "tokens_in":   int | None,
            "tokens_out":  int | None,
            "duration_ms": int | None,
        }

    Raises:
        openai.*, ValueError: 呼び出し側で握りつぶすこと（会話本体を壊さない設計）
    """
    messages = build_summary_update_messages(
        existing_summary=existing_summary,
        planner_content=planner_content,
        executor_content=executor_content,
        goal=goal,
        turn_id=turn_id,
        event=event,
    )

    used_model = model or _summary_model()
    result = chat_openai(_SUMMARY_SYSTEM_PROMPT, messages, model=used_model)

    usage = result.get("usage") or {}
    raw = (result.get("content") or "").strip()
    cleaned = _strip_code_block(raw)

    return {
        "summary":     cleaned,
        "model":       result.get("model", used_model),
        "tokens_in":   usage.get("prompt_tokens"),
        "tokens_out":  usage.get("completion_tokens"),
        "duration_ms": result.get("duration_ms"),
        "char_count":  len(cleaned),
        "over_limit":  len(cleaned) > _SUMMARY_CHAR_LIMIT,
    }


# ─── Dry-run 用モック summary ────────────────────────────────────────────────
def mock_summary(
    existing_summary: Optional[str],
    planner_content: str,
    executor_content: Optional[str],
    goal: Optional[str] = None,
    turn_id: Optional[int] = None,
    event: str = "turn_end",
) -> str:
    """
    API を呼ばずに 5 項目構造のダミー summary を返す（dry-run 検証用）。
    フローが summary を書き込むかを確認するだけで、内容の品質は問わない。
    """
    goal_line = goal or "（未設定）"
    if event == "task_complete":
        pending = "なし"
        next_action = "（完了）"
        decision = f"- Turn {turn_id} で TASK_COMPLETE を検出"
    elif event == "waiting_approval":
        pending = f"Turn {turn_id} の Planner 指示（承認待ち）"
        next_action = "Human の approve / reject を待つ"
        decision = "- 危険操作を検出し承認ゲートで停止"
    else:
        pending = "なし"
        next_action = f"Turn {(turn_id or 0) + 1} の Planner 指示を生成"
        decision = f"- Turn {turn_id} の Executor 応答を受領"

    prev = existing_summary.strip() if existing_summary else "（初回）"

    return textwrap.dedent(f"""
        目的: {goal_line}
        重要な決定事項:
        {decision}
        未完了タスク:
        - Turn {turn_id} 以降の処理継続
        保留 / 承認待ち: {pending}
        次アクション: {next_action}
        （dry-run mock / previous={prev[:30]}）
    """).strip()
