"""
orchestrator.py — AIOS Dual-Agent Orchestrator メインループ

Planner (OpenAI) と Executor (Anthropic) を共通 SQLite ストア経由で連携させる。
人間は CLI で監視・承認を行う。

使い方:
    python orchestrator.py start --goal "Pythonで九九表をMarkdownで作る"
    python orchestrator.py run   --conv-id <uuid> [--max-turns 5]
    python orchestrator.py pending
    python orchestrator.py approve --message-id <uuid>
    python orchestrator.py reject  --message-id <uuid>
    python orchestrator.py log  --conv-id <uuid>
    python orchestrator.py show --conv-id <uuid>

設計根拠: aios-orchestrator/03_flow.md / 05_poc_plan.md
"""

from __future__ import annotations

import argparse
import sys
import textwrap
from pathlib import Path
from typing import Optional

# ─── 依存モジュール（同一ディレクトリ）────────────────────────────────────────
from store import (
    init_db,
    create_conversation,
    get_conversation,
    get_message,
    get_run_log,
    get_pending_approvals,
    build_context,
    get_recent_history,
    append_message,
    set_message_approval,
    set_conversation_status,
    increment_turn_count,
)
# get_history は残っているが orchestrator 本体では使わない（全履歴読み防止）
from openai_client import chat_openai
from anthropic_client import chat_anthropic
from approval_gate import parse_requires_approval, needs_approval, prompt_approval_with_message_id
from run_logger import (
    log_api_call,
    log_approval_requested,
    log_approved,
    log_rejected,
    log_error,
    log_session_start,
    log_session_end,
    calc_cost,
)

# ─── デフォルト設定 ───────────────────────────────────────────────────────────
_DEFAULT_DB   = str(Path(__file__).parent / "data" / "store.db")
_DEFAULT_MAX_TURNS = 5
_SEP = "─" * 70

# ─── ターン内での連続 BLOCKED 上限 ───────────────────────────────────────────
_MAX_CONSECUTIVE_BLOCKED = 3


# ─────────────────────────────────────────────────────────────────────────────
# System Prompt 構築
# ─────────────────────────────────────────────────────────────────────────────

# ─── context 構築設定 ────────────────────────────────────────────────────────
# Planner / Executor に渡す最大メッセージ件数
# 全履歴ではなく直近 N 件のみを渡す（トークン肥大化・他会話混入を防ぐ）
_CONTEXT_LIMIT = 10


def _build_messages_for_llm(ctx: dict) -> list[dict[str, str]]:
    """
    build_context() の戻り値から LLM に渡す messages リストを構築する。

    構成:
      1. summary があれば先頭に user ロールで要約を挿入する
      2. recent_history をそのまま連結する

    summary は assistant ではなく user として渡す（OpenAI/Anthropic の
    先頭 role 制約を回避し、会話文脈として自然に読ませるため）。

    他 conversation_id / project_id のデータは混ぜない。
    """
    messages: list[dict[str, str]] = []

    if ctx.get("summary"):
        messages.append({
            "role": "user",
            "content": f"[会話の要約]\n{ctx['summary']}",
        })
        # summary に対する形式上の返答（Anthropic の交互制約対策）
        messages.append({
            "role": "assistant",
            "content": "了解しました。要約を踏まえて続けます。",
        })

    # recent_history（role / content のみを渡す）
    for msg in ctx.get("recent_history", []):
        messages.append({
            "role": msg["role"],
            "content": msg["content"],
        })

    return messages


def build_planner_system_prompt(max_turns: int = _DEFAULT_MAX_TURNS) -> str:
    """
    Planner (OpenAI) 用の system prompt を返す。

    - 次の1本の指示だけを書く
    - 危険操作は REQUIRES_APPROVAL: true を明示する
    - タスク完了時は TASK_COMPLETE を書く
    """
    return textwrap.dedent(f"""
        あなたは Planner です。Executor に対して次の実行指示を 1 つだけ書いてください。

        【ルール】
        - 指示は具体的かつ 1 ステップに限定すること
        - 曖昧な表現は避け、短く明確に書くこと
        - 最大 {max_turns} ターンで完了するように計画すること

        【危険操作の申告】
        以下の操作を指示する場合は、必ず応答の 1 行目に
        「REQUIRES_APPROVAL: true」と書いてから指示を続けること。
          - ファイルの削除・上書き
          - 外部 API への POST（freee / Gmail 等）
          - 環境変数・設定ファイルの変更
          - シェルコマンドの実行

        【完了申告】
        タスクが完了したと判断したら、応答に「TASK_COMPLETE」と書くこと。
        完了の根拠を 1〜2 文で添えること。

        【禁止事項】
        - 1 回の応答で複数の指示を書かないこと
        - Executor の役割（実行）を自分でやらないこと
    """).strip()


def build_executor_system_prompt() -> str:
    """
    Executor (Anthropic) 用の system prompt を返す。

    - Planner の最新指示に従い結果を返す
    - 実ファイル変更・外部送信・コード実行はしない（PoC）
    - 実行できない場合は BLOCKED: を明示する
    """
    return textwrap.dedent("""
        あなたは Executor です。Planner の最新指示を読んで、実行結果を報告してください。

        【ルール】
        - 実行結果は必ず報告すること（成功・失敗・不明を明記）
        - コードを生成した場合は ```コードブロック``` で囲むこと
        - 応答は簡潔にまとめること（長文は避ける）

        【PoC 期間中の制約】
        - 実ファイルの変更・外部 API の呼び出し・シェルコマンドの実行は行わない
        - 「実行した体での結果要約」として応答してよい
        - ファイル生成の場合は内容を ```コードブロック``` で示せば十分

        【実行不能時】
        - 指示が不明確・矛盾している・実行不可能な場合は
          「BLOCKED: <理由>」と書いて Planner に差し戻すこと
    """).strip()


# ─────────────────────────────────────────────────────────────────────────────
# 1ターン実行
# ─────────────────────────────────────────────────────────────────────────────

def run_single_turn(
    db_path: str,
    conversation_id: str,
    max_turns: int = _DEFAULT_MAX_TURNS,
    verbose: bool = True,
) -> str:
    """
    Planner → 承認チェック → Executor の 1 ターンを実行する。

    Args:
        db_path:         SQLite ファイルのパス
        conversation_id: 対象会話の ID
        max_turns:       system prompt に渡すターン上限ヒント
        verbose:         進捗を stdout に出力するか

    Returns:
        'continue'          — 正常完了。次のターンへ
        'waiting_approval'  — 承認待ちで停止
        'completed'         — TASK_COMPLETE を検出。会話終了
        'failed'            — エラーまたは reject。会話終了
    """
    conv = get_conversation(db_path, conversation_id)
    if conv is None:
        print(f"[ERROR] conversation_id が見つかりません: {conversation_id}", file=sys.stderr)
        return "failed"

    turn_id = conv["turn_count"] + 1
    if verbose:
        print(f"\n{_SEP}")
        print(f"[Turn {turn_id}] 開始  project={conv.get('project_id', 'default')}")

    # ── 1. 文脈構築（全履歴ではなく summary + recent_history のみ） ───────────
    ctx = build_context(db_path, conversation_id, limit=_CONTEXT_LIMIT)
    planner_messages = _build_messages_for_llm(ctx)

    if verbose:
        print(f"[Turn {turn_id}] context: recent={len(ctx['recent_history'])}件"
              f"  summary={'あり' if ctx['summary'] else 'なし'}")

    # ── 2. Planner 呼び出し (OpenAI) ─────────────────────────────────────────
    planner_system = build_planner_system_prompt(max_turns)
    if verbose:
        print(f"[Turn {turn_id}] Planner (OpenAI) 呼び出し中...")
    try:
        planner_result = chat_openai(planner_system, planner_messages)
    except Exception as exc:
        log_error(db_path, conversation_id, turn_id,
                  {"error": str(exc), "type": type(exc).__name__}, model="openai")
        set_conversation_status(db_path, conversation_id, "failed")
        print(f"[ERROR] Planner 呼び出し失敗: {exc}", file=sys.stderr)
        return "failed"

    planner_content = planner_result["content"]
    planner_usage   = planner_result.get("usage") or {}
    planner_model   = planner_result["model"]

    if verbose:
        preview = planner_content[:120].replace("\n", " ")
        print(f"[Turn {turn_id}] Planner: {preview}{'...' if len(planner_content) > 120 else ''}")

    # ── 3. Planner メッセージ保存 ─────────────────────────────────────────────
    planner_flagged = parse_requires_approval(planner_content)
    req_approval    = needs_approval(planner_content, planner_flagged)

    planner_msg_id = append_message(
        db_path, conversation_id, turn_id,
        role_executor="planner",
        source_model=planner_model,
        target_model="claude-sonnet-4-6",
        content=planner_content,
        requires_approval=req_approval,
    )

    # run_log: api_call (Planner)
    log_api_call(
        db_path, conversation_id, turn_id,
        model=planner_model,
        tokens_in=planner_usage.get("prompt_tokens"),
        tokens_out=planner_usage.get("completion_tokens"),
        duration_ms=planner_result.get("duration_ms"),
    )

    # ── 4. TASK_COMPLETE 検出 ─────────────────────────────────────────────────
    if "TASK_COMPLETE" in planner_content:
        if verbose:
            print(f"[Turn {turn_id}] TASK_COMPLETE 検出 — 会話を完了にします")
        increment_turn_count(db_path, conversation_id)
        set_conversation_status(
            db_path, conversation_id, "completed",
            latest_output=planner_content,
        )
        log_session_end(db_path, conversation_id, "completed", total_turns=turn_id)
        return "completed"

    # ── 5. 承認チェック ───────────────────────────────────────────────────────
    if req_approval:
        log_approval_requested(
            db_path, conversation_id, turn_id,
            {"message_id": planner_msg_id, "flagged_by_planner": planner_flagged},
        )
        set_conversation_status(db_path, conversation_id, "waiting_approval")
        print(f"\n[承認待ち] Turn {turn_id} — Planner が危険操作を要求しています")
        print(f"  message_id : {planner_msg_id}")
        print(f"  承認: python orchestrator.py approve --message-id {planner_msg_id}")
        print(f"  却下: python orchestrator.py reject  --message-id {planner_msg_id}")
        return "waiting_approval"

    # ── 6. Executor 呼び出し (Anthropic) ─────────────────────────────────────
    # Planner 発言を含む最新状態で context を再構築する
    ctx_exec = build_context(db_path, conversation_id, limit=_CONTEXT_LIMIT)
    executor_messages = _build_messages_for_llm(ctx_exec)

    executor_system = build_executor_system_prompt()
    if verbose:
        print(f"[Turn {turn_id}] Executor (Anthropic) 呼び出し中...")
    try:
        executor_result = chat_anthropic(executor_system, executor_messages)
    except Exception as exc:
        log_error(db_path, conversation_id, turn_id,
                  {"error": str(exc), "type": type(exc).__name__}, model="anthropic")
        set_conversation_status(db_path, conversation_id, "failed")
        print(f"[ERROR] Executor 呼び出し失敗: {exc}", file=sys.stderr)
        return "failed"

    executor_content = executor_result["content"]
    executor_usage   = executor_result.get("usage") or {}
    executor_model   = executor_result["model"]

    if verbose:
        preview = executor_content[:120].replace("\n", " ")
        print(f"[Turn {turn_id}] Executor: {preview}{'...' if len(executor_content) > 120 else ''}")

    # ── 7. Executor メッセージ保存 ────────────────────────────────────────────
    append_message(
        db_path, conversation_id, turn_id,
        role_executor="executor",
        source_model=executor_model,
        target_model=planner_model,
        content=executor_content,
        requires_approval=False,
    )

    # run_log: api_call (Executor)
    log_api_call(
        db_path, conversation_id, turn_id,
        model=executor_model,
        tokens_in=executor_usage.get("input_tokens"),
        tokens_out=executor_usage.get("output_tokens"),
        duration_ms=executor_result.get("duration_ms"),
    )

    # ── 8. 会話状態更新 ───────────────────────────────────────────────────────
    increment_turn_count(db_path, conversation_id)
    set_conversation_status(
        db_path, conversation_id, "in_progress",
        latest_output=executor_content,
    )

    # BLOCKED 検出（差し戻し通知のみ。ループ継続はrun_loop側で上限管理）
    if executor_content.strip().startswith("BLOCKED:"):
        if verbose:
            print(f"[Turn {turn_id}] Executor BLOCKED — Planner に差し戻し")
        return "blocked"

    if verbose:
        cost_p = calc_cost(planner_model,
                           planner_usage.get("prompt_tokens", 0),
                           planner_usage.get("completion_tokens", 0))
        cost_e = calc_cost(executor_model,
                           executor_usage.get("input_tokens", 0),
                           executor_usage.get("output_tokens", 0))
        print(f"[Turn {turn_id}] 完了 | コスト概算: ${cost_p + cost_e:.5f}")

    return "continue"


# ─────────────────────────────────────────────────────────────────────────────
# ループ実行
# ─────────────────────────────────────────────────────────────────────────────

def run_loop(
    db_path: str,
    conversation_id: str,
    max_turns: int = _DEFAULT_MAX_TURNS,
    verbose: bool = True,
) -> str:
    """
    max_turns を上限に run_single_turn を繰り返す。

    停止条件:
        - 'waiting_approval' — 承認待ち（人間が approve/reject するまで停止）
        - 'completed'        — TASK_COMPLETE 検出
        - 'failed'           — エラーまたは reject
        - turn_count >= max_turns — ターン上限到達

    Returns:
        最後の run_single_turn の戻り値（または 'max_turns_reached'）
    """
    blocked_streak = 0

    for _ in range(max_turns):
        conv = get_conversation(db_path, conversation_id)
        if conv is None:
            return "failed"

        # 実行前にステータスを確認（外部から変更された場合を考慮）
        current_status = conv["status"]
        if current_status in ("completed", "failed"):
            if verbose:
                print(f"\n[INFO] 会話はすでに {current_status} です。ループを終了します。")
            return current_status
        if current_status == "waiting_approval":
            if verbose:
                print("\n[INFO] 承認待ち中です。approve / reject してから run を再実行してください。")
            return "waiting_approval"

        result = run_single_turn(db_path, conversation_id, max_turns=max_turns, verbose=verbose)

        if result == "blocked":
            blocked_streak += 1
            if blocked_streak >= _MAX_CONSECUTIVE_BLOCKED:
                print(f"\n[WARN] BLOCKED が {_MAX_CONSECUTIVE_BLOCKED} 回連続しました。会話を failed にします。")
                set_conversation_status(db_path, conversation_id, "failed")
                log_session_end(db_path, conversation_id, "failed",
                                total_turns=conv["turn_count"])
                return "failed"
            continue
        else:
            blocked_streak = 0

        if result in ("waiting_approval", "completed", "failed"):
            return result

    # ターン上限到達
    conv = get_conversation(db_path, conversation_id)
    if verbose:
        print(f"\n[WARN] max_turns ({max_turns}) に到達しました。会話を終了します。")
    if conv and conv["status"] == "in_progress":
        set_conversation_status(db_path, conversation_id, "failed")
        log_session_end(db_path, conversation_id, "max_turns_reached",
                        total_turns=conv["turn_count"])
    return "max_turns_reached"


# ─────────────────────────────────────────────────────────────────────────────
# CLI コマンド
# ─────────────────────────────────────────────────────────────────────────────

def command_start(args: argparse.Namespace) -> int:
    """
    新しい会話を開始し conversation_id を表示する。

    - DB を初期化（初回のみスキーマ作成）
    - conversation を新規作成（project_id を保存）
    - ゴールを最初の user メッセージとして保存
    - run_log に session_start を記録
    """
    db_path    = args.db
    goal       = args.goal
    project_id = getattr(args, "project_id", "default") or "default"

    init_db(db_path)

    title = goal[:80]

    role_system = (
        "ChatGPT（Planner）と Claude（Executor）が協調してタスクを実行する。"
        "Planner が指示を書き、Executor が実行・報告する。"
    )

    conv_id = create_conversation(
        db_path,
        title=title,
        role_system=role_system,
        project_id=project_id,
    )

    # ゴールを最初の user メッセージとして保存
    append_message(
        db_path, conv_id,
        turn_id=0,
        role_executor="planner",
        source_model="human",
        target_model="gpt-4o",
        content=f"[GOAL] {goal}",
        requires_approval=False,
    )

    log_session_start(db_path, conv_id, goal=goal)

    print(f"\n会話を開始しました。")
    print(f"  conversation_id : {conv_id}")
    print(f"  project_id      : {project_id}")
    print(f"  goal            : {goal}")
    print(f"\n次のステップ:")
    print(f"  python orchestrator.py run --conv-id {conv_id}")
    return 0


def command_run(args: argparse.Namespace) -> int:
    """
    指定した会話で run_loop を実行する。
    """
    db_path   = args.db
    conv_id   = args.conv_id
    max_turns = args.max_turns

    init_db(db_path)

    conv = get_conversation(db_path, conv_id)
    if conv is None:
        print(f"[ERROR] conversation_id が見つかりません: {conv_id}", file=sys.stderr)
        return 1

    print(f"\n[run] conv_id={conv_id[:8]}... max_turns={max_turns}")
    print(f"  title  : {conv['title']}")
    print(f"  status : {conv['status']}")
    print(f"  turns  : {conv['turn_count']}")

    result = run_loop(db_path, conv_id, max_turns=max_turns)
    print(f"\n[run] 終了ステータス: {result}")

    # 最終状態を表示
    conv = get_conversation(db_path, conv_id)
    if conv:
        print(f"  conversations.status : {conv['status']}")
        print(f"  turn_count           : {conv['turn_count']}")
    return 0


def command_pending(args: argparse.Namespace) -> int:
    """
    承認待ちのメッセージ一覧を表示する。
    """
    db_path = args.db
    init_db(db_path)

    items = get_pending_approvals(db_path)
    if not items:
        print("承認待ちのメッセージはありません。")
        return 0

    print(f"\n承認待ち: {len(items)} 件\n{_SEP}")
    for item in items:
        preview = item["content"][:100].replace("\n", " ")
        print(f"  message_id  : {item['message_id']}")
        print(f"  conv_id     : {item['conversation_id'][:8]}...")
        print(f"  project_id  : {item.get('project_id', '-')}")
        print(f"  title       : {item['title']}")
        print(f"  turn_id     : {item['turn_id']}")
        print(f"  created_at  : {item['created_at']}")
        print(f"  content     : {preview}{'...' if len(item['content']) > 100 else ''}")
        print(f"  承認: python orchestrator.py approve --message-id {item['message_id']}")
        print(f"  却下: python orchestrator.py reject  --message-id {item['message_id']}")
        print(_SEP)
    return 0


def command_approve(args: argparse.Namespace) -> int:
    """
    メッセージを承認し、会話を in_progress に戻す。
    """
    db_path    = args.db
    message_id = args.message_id
    init_db(db_path)

    msg = get_message(db_path, message_id)
    if msg is None:
        print(f"[ERROR] message_id が見つかりません: {message_id}", file=sys.stderr)
        return 1

    conv_id = msg["conversation_id"]
    turn_id = msg["turn_id"]

    # CLI 承認確認をスキップするフラグ（--yes）
    if getattr(args, "yes", False):
        confirmed = True
    else:
        print(f"\n承認対象メッセージ:\n{_SEP}")
        print(msg["content"])
        print(_SEP)
        try:
            raw = input("この内容を承認しますか？ [y/n]: ").strip().lower()
        except EOFError:
            raw = "n"
        confirmed = raw in ("y", "yes")

    if confirmed:
        set_message_approval(db_path, message_id, approved=True)
        set_conversation_status(db_path, conv_id, "in_progress")
        log_approved(db_path, conv_id, turn_id, {"message_id": message_id})
        print(f"[承認] message_id={message_id[:8]}... を承認しました。")
        print(f"  会話を続行するには: python orchestrator.py run --conv-id {conv_id}")
    else:
        set_message_approval(db_path, message_id, approved=False)
        set_conversation_status(db_path, conv_id, "failed")
        log_rejected(db_path, conv_id, turn_id, {"message_id": message_id})
        print(f"[却下] message_id={message_id[:8]}... を却下しました。会話を failed にしました。")
    return 0


def command_reject(args: argparse.Namespace) -> int:
    """
    メッセージを却下し、会話を failed にする。
    """
    db_path    = args.db
    message_id = args.message_id
    init_db(db_path)

    msg = get_message(db_path, message_id)
    if msg is None:
        print(f"[ERROR] message_id が見つかりません: {message_id}", file=sys.stderr)
        return 1

    conv_id = msg["conversation_id"]
    turn_id = msg["turn_id"]

    set_message_approval(db_path, message_id, approved=False)
    set_conversation_status(db_path, conv_id, "failed")
    log_rejected(db_path, conv_id, turn_id, {"message_id": message_id, "via": "reject command"})

    print(f"[却下] message_id={message_id[:8]}... を却下しました。")
    print(f"  conversations.status = failed")
    return 0


def command_log(args: argparse.Namespace) -> int:
    """
    会話の run_log を見やすく表示する。
    """
    db_path = args.db
    conv_id = args.conv_id
    init_db(db_path)

    conv = get_conversation(db_path, conv_id)
    if conv is None:
        print(f"[ERROR] conversation_id が見つかりません: {conv_id}", file=sys.stderr)
        return 1

    rows = get_run_log(db_path, conv_id)
    print(f"\nRun Log: {conv['title'][:60]}")
    print(f"  conv_id : {conv_id}")
    print(f"  status  : {conv['status']}")
    print(_SEP)

    total_cost = 0.0
    for row in rows:
        turn_str  = f"T{row['turn_id']:02d}" if row["turn_id"] is not None else "  -"
        model_str = (row["model"] or "-")[:22]
        ti        = row["tokens_in"]  or 0
        to        = row["tokens_out"] or 0
        dur       = row["duration_ms"] or 0
        cost      = calc_cost(row["model"] or "", ti, to)
        total_cost += cost

        print(
            f"  {row['created_at']}  {turn_str}  "
            f"{row['event_type']:22s}  {model_str:22s}  "
            f"in={ti:5d}  out={to:5d}  {dur:5d}ms  ${cost:.5f}"
        )

    print(_SEP)
    print(f"  総コスト概算: ${total_cost:.5f}  |  ログ件数: {len(rows)}")
    return 0


def command_show(args: argparse.Namespace) -> int:
    """
    会話の要約を表示する。
    """
    db_path = args.db
    conv_id = args.conv_id
    init_db(db_path)

    conv = get_conversation(db_path, conv_id)
    if conv is None:
        print(f"[ERROR] conversation_id が見つかりません: {conv_id}", file=sys.stderr)
        return 1

    print(f"\n{_SEP}")
    print(f"  conversation_id : {conv['conversation_id']}")
    print(f"  project_id      : {conv.get('project_id', '-')}")
    print(f"  title           : {conv['title']}")
    print(f"  status          : {conv['status']}")
    print(f"  turn_count      : {conv['turn_count']}")
    print(f"  created_at      : {conv['created_at']}")
    print(f"  updated_at      : {conv['updated_at']}")

    if conv.get("summary"):
        print(f"\n  [summary]\n  {conv['summary']}")
    if conv.get("latest_output"):
        preview = conv["latest_output"][:300].replace("\n", "\n  ")
        print(f"\n  [latest_output]\n  {preview}"
              f"{'...' if len(conv['latest_output']) > 300 else ''}")
    print(_SEP)
    return 0


# ─────────────────────────────────────────────────────────────────────────────
# argparse エントリポイント
# ─────────────────────────────────────────────────────────────────────────────

def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="orchestrator",
        description="AIOS Dual-Agent Orchestrator — Planner(OpenAI) × Executor(Anthropic)",
    )
    parser.add_argument(
        "--db",
        default=_DEFAULT_DB,
        help=f"SQLite DB パス (デフォルト: {_DEFAULT_DB})",
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # start
    p_start = sub.add_parser("start", help="会話を新規開始する")
    p_start.add_argument("--goal", required=True, help="達成したいゴール")
    p_start.add_argument("--project-id", default="default", dest="project_id",
                         help="プロジェクト識別子（未指定: default）")

    # run
    p_run = sub.add_parser("run", help="会話を指定ターン数実行する")
    p_run.add_argument("--conv-id", required=True, dest="conv_id", help="conversation_id")
    p_run.add_argument("--max-turns", type=int, default=_DEFAULT_MAX_TURNS,
                       dest="max_turns", help=f"最大ターン数 (デフォルト: {_DEFAULT_MAX_TURNS})")

    # pending
    sub.add_parser("pending", help="承認待ちメッセージの一覧を表示する")

    # approve
    p_approve = sub.add_parser("approve", help="メッセージを承認する")
    p_approve.add_argument("--message-id", required=True, dest="message_id")
    p_approve.add_argument("--yes", action="store_true", help="確認プロンプトをスキップする")

    # reject
    p_reject = sub.add_parser("reject", help="メッセージを却下する")
    p_reject.add_argument("--message-id", required=True, dest="message_id")

    # log
    p_log = sub.add_parser("log", help="run_log を表示する")
    p_log.add_argument("--conv-id", required=True, dest="conv_id")

    # show
    p_show = sub.add_parser("show", help="会話の要約を表示する")
    p_show.add_argument("--conv-id", required=True, dest="conv_id")

    return parser


def main() -> int:
    parser = _build_parser()
    args   = parser.parse_args()

    dispatch = {
        "start":   command_start,
        "run":     command_run,
        "pending": command_pending,
        "approve": command_approve,
        "reject":  command_reject,
        "log":     command_log,
        "show":    command_show,
    }

    handler = dispatch.get(args.command)
    if handler is None:
        parser.print_help()
        return 1

    return handler(args)


if __name__ == "__main__":
    sys.exit(main())
