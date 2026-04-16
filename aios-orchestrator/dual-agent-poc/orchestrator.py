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
from typing import Any, Optional

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
    update_summary,
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
    log_summary_updated,
    log_summary_failed,
    log_dashboard_reported,
    log_dashboard_failed,
    log_dashboard_skipped,
    log_artifact_saved,
    log_artifact_failed,
    log_artifact_skipped,
    calc_cost,
)
from summarizer import generate_summary, mock_summary
from dashboard_reporter import report_session as _report_to_dashboard
from artifact_parser import parse_artifacts
from store import get_artifacts, get_artifacts_by_conv, append_artifact as _store_artifact
from artifact_diff import (
    group_artifacts, group_artifacts_all,
    compute_diff, diff_stat, consecutive_pairs,
    find_by_prefix, find_prev_in_group, find_next_in_group,
)
from artifact_exporter import export_artifacts

# ─── デフォルト設定 ───────────────────────────────────────────────────────────
_DEFAULT_DB   = str(Path(__file__).parent / "data" / "store.db")
_DEFAULT_MAX_TURNS = 5
_SEP = "─" * 70

# ─── ターン内での連続 BLOCKED 上限 ───────────────────────────────────────────
_MAX_CONSECUTIVE_BLOCKED = 3


# ─────────────────────────────────────────────────────────────────────────────
# Dry-run モック（APIキー未設定環境でのフロー検証用）
# ─────────────────────────────────────────────────────────────────────────────

def _mock_planner_response(turn_id: int, goal_hint: str) -> dict:
    """
    dry-run 時に Planner (OpenAI) の代わりに返すモック応答。
    turn_id=2 以降で TASK_COMPLETE を含めて会話を終わらせる。
    """
    if turn_id >= 2:
        content = (
            f"TASK_COMPLETE\n"
            f"ターン {turn_id} でタスクが完了しました。"
            f"Executor の報告を確認し、目標を達成したと判断します。"
        )
    else:
        content = f"[DRY-RUN Turn {turn_id}] {goal_hint} について、まず概要を Markdown 形式で作成してください。"
    return {
        "content": content,
        "model": "dry-run-gpt-4o",
        "usage": {"prompt_tokens": 100, "completion_tokens": 50},
        "duration_ms": 0,
    }


def _mock_executor_response(turn_id: int) -> dict:
    """
    dry-run 時に Executor (Anthropic) の代わりに返すモック応答。
    """
    content = (
        f"[DRY-RUN Turn {turn_id}] 実行結果を報告します。\n\n"
        f"```markdown\n# 結果\n- 計算完了\n- 値: 2\n```\n\n"
        f"以上です。"
    )
    return {
        "content": content,
        "model": "dry-run-claude-sonnet",
        "usage": {"input_tokens": 120, "output_tokens": 80},
        "duration_ms": 0,
    }


def _mock_approval_planner_response(turn_id: int) -> dict:
    """dry-run 承認テスト用: 必ず REQUIRES_APPROVAL: true を含む。"""
    return {
        "content": (
            f"REQUIRES_APPROVAL: true\n"
            f"[DRY-RUN Turn {turn_id}] sample.txt を削除する手順:\n"
            f"1. os.remove('sample.txt') を実行する"
        ),
        "model": "dry-run-gpt-4o",
        "usage": {"prompt_tokens": 80, "completion_tokens": 60},
        "duration_ms": 0,
    }


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
# Summary 自動更新（Phase 2）
# ─────────────────────────────────────────────────────────────────────────────

def _update_summary_safely(
    db_path: str,
    conversation_id: str,
    turn_id: int,
    planner_content: str,
    executor_content: Optional[str],
    goal: Optional[str],
    event: str,
    verbose: bool = True,
    dry_run: bool = False,
) -> None:
    """
    conversations.summary を増分更新する。失敗しても会話本体は壊さない。

    - 成功時: update_summary() で書き込み + log_summary_updated で記録
    - 失敗時: log_summary_failed に例外を記録し、ログ出力して続行
    - dry_run: API を呼ばず mock_summary を書き込む（フロー検証専用）

    Args:
        event: 'turn_end' | 'task_complete' | 'waiting_approval'
    """
    conv = get_conversation(db_path, conversation_id)
    existing = conv.get("summary") if conv else None

    try:
        if dry_run:
            new_summary = mock_summary(
                existing_summary=existing,
                planner_content=planner_content,
                executor_content=executor_content,
                goal=goal,
                turn_id=turn_id,
                event=event,
            )
            update_summary(db_path, conversation_id, new_summary)
            log_summary_updated(
                db_path, conversation_id, turn_id,
                model="dry-run-summarizer",
                metadata={"event": event, "mode": "dry_run"},
            )
            if verbose:
                print(f"[Turn {turn_id}] summary 更新 (dry-run / event={event})")
            return

        result = generate_summary(
            existing_summary=existing,
            planner_content=planner_content,
            executor_content=executor_content,
            goal=goal,
            turn_id=turn_id,
            event=event,
        )
        new_summary = result["summary"]
        if not new_summary:
            # 空応答は更新しない（既存 summary を残す）
            log_summary_failed(
                db_path, conversation_id, turn_id,
                metadata={"event": event, "error": "empty summary returned"},
                model=result.get("model"),
            )
            if verbose:
                print(f"[Turn {turn_id}] [WARN] summary 更新スキップ: 空応答")
            return

        update_summary(db_path, conversation_id, new_summary)
        meta: dict[str, Any] = {"event": event}
        if result.get("over_limit"):
            meta["over_limit"] = True
            meta["char_count"] = result.get("char_count")
            if verbose:
                print(f"[Turn {turn_id}] [WARN] summary が {result.get('char_count')} 字（上限500字超過）")
        log_summary_updated(
            db_path, conversation_id, turn_id,
            model=result.get("model"),
            tokens_in=result.get("tokens_in"),
            tokens_out=result.get("tokens_out"),
            duration_ms=result.get("duration_ms"),
            metadata=meta,
        )
        if verbose:
            cost = calc_cost(
                result.get("model") or "",
                result.get("tokens_in") or 0,
                result.get("tokens_out") or 0,
            )
            print(f"[Turn {turn_id}] summary 更新 OK (event={event}, ${cost:.5f})")
    except Exception as exc:
        # 会話本体を壊さず、失敗だけ記録して続行
        log_summary_failed(
            db_path, conversation_id, turn_id,
            metadata={
                "event": event,
                "error": str(exc),
                "type": type(exc).__name__,
            },
        )
        if verbose:
            print(f"[Turn {turn_id}] [WARN] summary 更新失敗 (event={event}): {exc}")


# ─────────────────────────────────────────────────────────────────────────────
# Artifact 自動保存（Phase 6）
# ─────────────────────────────────────────────────────────────────────────────

def _save_artifacts_safely(
    db_path: str,
    conversation_id: str,
    message_id: str,
    executor_content: str,
    turn_id: int,
    verbose: bool = True,
) -> None:
    """
    Executor 発言からコードブロックを抽出し artifacts テーブルへ保存する。
    失敗しても orchestrator 本体は止まらない。

    冪等性:
      - 同一 message_id に対して既に artifact が存在する場合はスキップする。
      - 別ターンで同内容が出た場合はそれぞれ保存する（message_id が異なるため別行）。

    Args:
        db_path:          SQLite ファイルのパス
        conversation_id:  対象会話 ID
        message_id:       Executor メッセージの ID
        executor_content: Executor の発言テキスト
        turn_id:          ターン番号
        verbose:          ログ出力フラグ
    """
    try:
        # 冪等チェック: 同一 message_id に artifact が既にあればスキップ
        existing = get_artifacts(db_path, message_id)
        if existing:
            log_artifact_skipped(
                db_path, conversation_id, turn_id,
                metadata={
                    "reason":     "already_saved",
                    "message_id": message_id,
                    "count":      len(existing),
                },
            )
            if verbose:
                print(f"[Turn {turn_id}] artifact スキップ: 既に {len(existing)} 件保存済み")
            return

        candidates = parse_artifacts(executor_content)
        if not candidates:
            if verbose:
                print(f"[Turn {turn_id}] artifact: 0 件（コードブロックなし）")
            return

        saved_ids: list[str] = []
        for art in candidates:
            art_id = _store_artifact(
                db_path=db_path,
                message_id=message_id,
                artifact_type=art["artifact_type"],
                filename=art["filename"],
                content=art["body"],
                language=art["language"],
                filename_source=art.get("filename_source", "inferred"),
            )
            saved_ids.append(art_id)
            log_artifact_saved(
                db_path, conversation_id, turn_id,
                metadata={
                    "artifact_id":      art_id,
                    "artifact_type":    art["artifact_type"],
                    "language":         art["language"],
                    "filename":         art["filename"],
                    "filename_source":  art.get("filename_source", "inferred"),
                    "body_length":      len(art["body"]),
                },
            )

        if verbose:
            types_str = ", ".join(
                f"{a['language'] or a['artifact_type']}"
                f"{'[E]' if a.get('filename_source') == 'explicit' else ''}"
                for a in candidates
            )
            print(f"[Turn {turn_id}] artifact 保存: {len(saved_ids)} 件 ({types_str})")

    except Exception as exc:  # noqa: BLE001
        try:
            log_artifact_failed(
                db_path, conversation_id, turn_id,
                metadata={"error": str(exc), "type": type(exc).__name__},
            )
        except Exception:
            pass
        if verbose:
            print(f"[Turn {turn_id}] [WARN] artifact 保存失敗（無視して続行）: {exc}")


# ─────────────────────────────────────────────────────────────────────────────
# 1ターン実行
# ─────────────────────────────────────────────────────────────────────────────

def run_single_turn(
    db_path: str,
    conversation_id: str,
    max_turns: int = _DEFAULT_MAX_TURNS,
    verbose: bool = True,
    dry_run: bool = False,
    approval_test: bool = False,
) -> str:
    """
    Planner → 承認チェック → Executor の 1 ターンを実行する。

    Args:
        db_path:         SQLite ファイルのパス
        conversation_id: 対象会話の ID
        max_turns:       system prompt に渡すターン上限ヒント
        verbose:         進捗を stdout に出力するか
        dry_run:         True の場合 API を呼ばずモック応答を使う
        approval_test:   dry_run=True 時に承認フロー確認用モック応答を使う

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
        mode = "[DRY-RUN]" if dry_run else ""
        print(f"[Turn {turn_id}] Planner (OpenAI) 呼び出し中... {mode}")
    try:
        if dry_run:
            goal_hint = (ctx.get("recent_history") or [{}])[0].get("content", "")[:40]
            planner_result = (
                _mock_approval_planner_response(turn_id)
                if approval_test
                else _mock_planner_response(turn_id, goal_hint)
            )
        else:
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
        # Phase 2: 最終状態を summary に反映（Executor は呼ばれていない）
        _update_summary_safely(
            db_path, conversation_id, turn_id,
            planner_content=planner_content,
            executor_content=None,
            goal=conv.get("title"),
            event="task_complete",
            verbose=verbose,
            dry_run=dry_run,
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
        # Phase 2: 承認待ちを summary に記録（Executor は呼ばれていない）
        _update_summary_safely(
            db_path, conversation_id, turn_id,
            planner_content=planner_content,
            executor_content=None,
            goal=conv.get("title"),
            event="waiting_approval",
            verbose=verbose,
            dry_run=dry_run,
        )
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
        mode = "[DRY-RUN]" if dry_run else ""
        print(f"[Turn {turn_id}] Executor (Anthropic) 呼び出し中... {mode}")
    try:
        if dry_run:
            executor_result = _mock_executor_response(turn_id)
        else:
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
    executor_msg_id = append_message(
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

    # Phase 2: 正常完了したターンの summary 更新
    # （BLOCKED の場合も「差し戻しが必要」と記録するため同じフックで書き込む）
    _update_summary_safely(
        db_path, conversation_id, turn_id,
        planner_content=planner_content,
        executor_content=executor_content,
        goal=conv.get("title"),
        event="turn_end",
        verbose=verbose,
        dry_run=dry_run,
    )

    # Phase 6: artifact 自動抽出・保存
    _save_artifacts_safely(
        db_path=db_path,
        conversation_id=conversation_id,
        message_id=executor_msg_id,
        executor_content=executor_content,
        turn_id=turn_id,
        verbose=verbose,
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
    dry_run: bool = False,
    approval_test: bool = False,
) -> str:
    """
    max_turns を上限に run_single_turn を繰り返す。

    停止条件:
        - 'waiting_approval' — 承認待ち（人間が approve/reject するまで停止）
        - 'completed'        — TASK_COMPLETE 検出
        - 'failed'           — エラーまたは reject
        - turn_count >= max_turns — ターン上限到達

    Args:
        dry_run:       True の場合 API を呼ばずモック応答を使う
        approval_test: dry_run=True 時に承認フロー確認用モックを使う

    Returns:
        最後の run_single_turn の戻り値（または 'max_turns_reached'）
    """
    if dry_run and verbose:
        print("[DRY-RUN] モード: 実 API は呼びません。モック応答を使います。")

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

        result = run_single_turn(
            db_path, conversation_id,
            max_turns=max_turns, verbose=verbose,
            dry_run=dry_run, approval_test=approval_test,
        )

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
    --dry-run フラグで実 API を呼ばずモック応答でフローを検証できる。
    """
    db_path       = args.db
    conv_id       = args.conv_id
    max_turns     = args.max_turns
    dry_run       = getattr(args, "dry_run", False)
    approval_test = getattr(args, "approval_test", False)

    init_db(db_path)

    conv = get_conversation(db_path, conv_id)
    if conv is None:
        print(f"[ERROR] conversation_id が見つかりません: {conv_id}", file=sys.stderr)
        return 1

    mode_str = " [DRY-RUN]" if dry_run else ""
    print(f"\n[run{mode_str}] conv_id={conv_id[:8]}... max_turns={max_turns}")
    print(f"  title      : {conv['title']}")
    print(f"  project_id : {conv.get('project_id', '-')}")
    print(f"  status     : {conv['status']}")
    print(f"  turns      : {conv['turn_count']}")

    result = run_loop(
        db_path, conv_id,
        max_turns=max_turns,
        dry_run=dry_run,
        approval_test=approval_test,
    )
    print(f"\n[run] 終了ステータス: {result}")

    # 最終状態を表示
    conv = get_conversation(db_path, conv_id)
    if conv:
        print(f"  conversations.status : {conv['status']}")
        print(f"  turn_count           : {conv['turn_count']}")

    # ── Phase 3: Dashboard Run_Log シートへ反映 ───────────────────────────
    _report_to_dashboard_safely(
        db_path=db_path,
        conversation_id=conv_id,
        dry_run=dry_run,
        verbose=True,
    )
    return 0


def _report_to_dashboard_safely(
    db_path: str,
    conversation_id: str,
    dry_run: bool = False,
    verbose: bool = True,
) -> None:
    """
    Dashboard Run_Log シートへセッション結果を反映する。
    失敗しても orchestrator 本体は止まらない。

    Phase 3: report_session() を呼び出し、結果を run_log に記録する。
    """
    try:
        conv = get_conversation(db_path, conversation_id)
        if conv is None:
            return

        run_logs = get_run_log(db_path, conversation_id)
        report = _report_to_dashboard(
            conv=conv,
            run_logs=run_logs,
            dry_run=dry_run,
            verbose=verbose,
        )

        if report["idempotent_skip"]:
            log_dashboard_skipped(
                db_path, conversation_id,
                metadata={"reason": "already_reported"},
            )
        elif report["success"]:
            log_dashboard_reported(
                db_path, conversation_id,
                metadata={
                    "local_path":   report.get("local_path"),
                    "sheet_result": report.get("sheet_result", "")[:200],
                    "dry_run":      dry_run,
                },
            )
        else:
            log_dashboard_failed(
                db_path, conversation_id,
                metadata={
                    "sheet_result": report.get("sheet_result", "")[:200],
                    "local_path":   report.get("local_path"),
                },
            )

    except Exception as exc:  # noqa: BLE001
        # 最終安全網: 予期しない例外でも本体は止まらない
        if verbose:
            print(f"[Dashboard] [WARN] 予期しないエラー（無視して続行）: {exc}")
        try:
            log_dashboard_failed(
                db_path, conversation_id,
                metadata={"error": str(exc), "type": type(exc).__name__},
            )
        except Exception:  # noqa: BLE001
            pass  # ログ書き込みも失敗した場合は完全に無視


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
        updated_at = conv.get("summary_updated_at") or "-"
        print(f"\n  [summary] (updated_at={updated_at})\n  " + conv["summary"].replace("\n", "\n  "))
    if conv.get("latest_output"):
        preview = conv["latest_output"][:300].replace("\n", "\n  ")
        print(f"\n  [latest_output]\n  {preview}"
              f"{'...' if len(conv['latest_output']) > 300 else ''}")
    print(_SEP)
    return 0


def command_artifacts(args: argparse.Namespace) -> int:
    """
    会話の artifact 一覧を表示する。
    --artifact-id を指定した場合はその artifact の本文も出力する。
    """
    db_path  = args.db
    conv_id  = args.conv_id
    art_id   = getattr(args, "artifact_id", None)
    init_db(db_path)

    conv = get_conversation(db_path, conv_id)
    if conv is None:
        print(f"[ERROR] conversation_id が見つかりません: {conv_id}", file=sys.stderr)
        return 1

    arts = get_artifacts_by_conv(db_path, conv_id)

    print(f"\nArtifacts: {conv['title'][:60]}")
    print(f"  conv_id : {conv_id}")
    print(f"  count   : {len(arts)}")
    print(_SEP)

    if not arts:
        print("  (artifact なし)")
        print(_SEP)
        return 0

    for a in arts:
        body_preview = (a["content"] or "")[:80].replace("\n", "\\n")
        ellipsis     = "..." if len(a["content"] or "") > 80 else ""
        lang_str     = f"  lang={a['language']}" if a.get("language") else ""
        print(
            f"  T{a['turn_id']:02d}  {a['artifact_id'][:8]}..."
            f"  type={a['artifact_type']}{lang_str}"
            f"  file={a.get('filename') or '-'}"
        )
        print(f"       {body_preview}{ellipsis}")

    print(_SEP)

    # --artifact-id 指定時は本文全体を表示
    if art_id:
        target = next((a for a in arts if a["artifact_id"].startswith(art_id)), None)
        if target is None:
            print(f"[ERROR] artifact_id が見つかりません: {art_id}", file=sys.stderr)
            return 1
        lang = target.get("language") or ""
        fence = f"```{lang}" if lang else "```"
        print(f"\n  artifact_id : {target['artifact_id']}")
        print(f"  type        : {target['artifact_type']}")
        print(f"  language    : {lang or '(未指定)'}")
        print(f"  filename    : {target.get('filename') or '-'}")
        print(f"  turn_id     : {target['turn_id']}")
        print(f"\n{fence}")
        print(target["content"])
        print("```")

    return 0


def command_artifact_diff(args: argparse.Namespace) -> int:
    """
    会話内の artifact ターン間差分を表示する。

    モード:
      (デフォルト)   同一系統の全連続ペアを diff 表示
      --artifact-id  指定 artifact と直前バージョンを diff
      --left --right 明示的な 2 artifact を diff
    """
    db_path     = args.db
    conv_id     = args.conv_id
    art_id      = getattr(args, "artifact_id", None)
    left_prefix = getattr(args, "left",        None)
    right_prefix= getattr(args, "right",       None)
    context     = getattr(args, "context",     5)
    init_db(db_path)

    conv = get_conversation(db_path, conv_id)
    if conv is None:
        print(f"[ERROR] conversation_id が見つかりません: {conv_id}", file=sys.stderr)
        return 1

    arts = get_artifacts_by_conv(db_path, conv_id)

    if not arts:
        print(f"[INFO] {conv_id[:8]}... に artifact がありません。")
        return 0

    # ── モード 1: --left / --right 明示比較 ───────────────────────────────
    if left_prefix or right_prefix:
        if not (left_prefix and right_prefix):
            print("[ERROR] --left と --right は両方指定してください。", file=sys.stderr)
            return 1
        left_art  = find_by_prefix(arts, left_prefix)
        right_art = find_by_prefix(arts, right_prefix)
        if left_art is None:
            print(f"[ERROR] --left artifact_id が見つかりません: {left_prefix}", file=sys.stderr)
            return 1
        if right_art is None:
            print(f"[ERROR] --right artifact_id が見つかりません: {right_prefix}", file=sys.stderr)
            return 1
        return _print_single_diff(left_art, right_art, context)

    # ── モード 2: --artifact-id 起点 ─────────────────────────────────────
    if art_id:
        target = find_by_prefix(arts, art_id)
        if target is None:
            print(f"[ERROR] artifact_id が見つかりません: {art_id}", file=sys.stderr)
            return 1

        # 同一系統グループを全量で取得（1件でも返す all グループ）
        all_groups = group_artifacts_all(arts)
        from artifact_diff import _group_key
        gkey = _group_key(target)
        group_arts = all_groups.get(gkey, [target])

        prev_art = find_prev_in_group(target, group_arts)
        if prev_art is None:
            # 直後を試みる
            next_art = find_next_in_group(target, group_arts)
            if next_art is None:
                print(f"[INFO] {art_id} は系統内に比較対象がありません（1件のみ）。")
                return 0
            print(f"[INFO] 直前バージョンがないため、直後との diff を表示します。")
            return _print_single_diff(target, next_art, context)

        return _print_single_diff(prev_art, target, context)

    # ── モード 3: デフォルト — 全系統の連続 diff ─────────────────────────
    groups = group_artifacts(arts)

    if not groups:
        # 比較できる系統がない（全系統が 1 件のみ）
        all_groups = group_artifacts_all(arts)
        print(f"\nArtifact Diff: {conv['title'][:60]}")
        print(f"  conv_id : {conv_id}")
        print(f"  系統数  : {len(all_groups)}  /  diff 可能: 0")
        print(_SEP)
        print("  (すべての系統が 1 件のみ — diff 対象なし)")
        print(_SEP)
        return 0

    print(f"\nArtifact Diff: {conv['title'][:60]}")
    print(f"  conv_id : {conv_id}")
    print(f"  diff 対象系統: {len(groups)}")
    print(_SEP)

    for gkey, sorted_arts in groups.items():
        pairs = consecutive_pairs(sorted_arts)
        print(f"\n  系統: {gkey}  ({len(sorted_arts)} バージョン / {len(pairs)} diff)")
        print()
        for left, right in pairs:
            rc = _print_single_diff(left, right, context, indent="  ")
            if rc != 0:
                return rc

    print(_SEP)
    return 0


def command_artifact_export(args: argparse.Namespace) -> int:
    """
    保存済み artifact を実ファイルとして書き出す（Phase 11）。

    --conv-id   : 対象会話。この会話の全 artifact を書き出す。
    --output    : 書き出し先ディレクトリ（存在しない場合は自動作成）。
    --artifact-id: 指定した場合はその 1 件のみ書き出す（前方一致）。
    --dry-run   : ファイルを書かず、書き出し計画だけ表示する。

    filename 決定優先順位:
      1. explicit filename (filename_source='explicit') かつ安全
      2. inferred filename (filename_source='inferred') かつ安全
      3. safe-default: artifact_t<turn>_<index><ext>

    同名衝突時は <stem>_<n><ext> で回避（上書きしない）。
    """
    db_path  = args.db
    conv_id  = args.conv_id
    out_dir  = args.output
    art_id   = getattr(args, "artifact_id", None)
    dry_run  = getattr(args, "dry_run", False)
    init_db(db_path)

    conv = get_conversation(db_path, conv_id)
    if conv is None:
        print(f"[ERROR] conversation_id が見つかりません: {conv_id}", file=sys.stderr)
        return 1

    arts = get_artifacts_by_conv(db_path, conv_id)

    # --artifact-id 指定時は 1 件に絞る
    if art_id:
        arts = [a for a in arts if a["artifact_id"].startswith(art_id)]
        if not arts:
            print(f"[ERROR] artifact_id が見つかりません: {art_id}", file=sys.stderr)
            return 1

    mode_str = " [DRY-RUN]" if dry_run else ""
    print(f"\nArtifact Export{mode_str}: {conv['title'][:60]}")
    print(f"  conv_id    : {conv_id}")
    print(f"  artifacts  : {len(arts)} 件")
    print(f"  output_dir : {out_dir}")
    print(_SEP)

    if not arts:
        print("  (artifact なし — 書き出し対象ゼロ)")
        print(_SEP)
        return 0

    results = export_artifacts(arts, output_dir=out_dir, dry_run=dry_run, verbose=True)

    exported = [r for r in results if r["status"] == "exported"]
    skipped  = [r for r in results if r["status"] == "skipped"]
    errors   = [r for r in results if r["status"] == "error"]

    print(_SEP)
    print(f"  成功: {len(exported)} 件  /  スキップ: {len(skipped)} 件  /  エラー: {len(errors)} 件")
    if exported and not dry_run:
        print(f"  出力先: {out_dir}")
    if errors:
        print(f"  [WARN] エラーが {len(errors)} 件ありました。")
        for r in errors:
            print(f"    {r['artifact_id'][:8]}...  {r['reason']}")

    return 1 if errors else 0


def _print_single_diff(left: dict, right: dict, context: int, indent: str = "") -> int:
    """
    2 つの artifact の diff を表示するヘルパー。
    差分なしの場合も安全に表示する。
    """
    diff_text = compute_diff(left, right, context=context)
    added, deleted = diff_stat(diff_text) if diff_text else (0, 0)

    left_label  = f"T{left['turn_id']:02d}  {left['artifact_id'][:8]}..."
    right_label = f"T{right['turn_id']:02d}  {right['artifact_id'][:8]}..."

    print(f"{indent}  {left_label}  →  {right_label}")

    if not diff_text:
        print(f"{indent}  (差分なし — 本文は同一)")
        print()
        return 0

    print(f"{indent}  +{added} 行追加 / -{deleted} 行削除")
    print()
    for line in diff_text.splitlines():
        print(f"{indent}{line}")
    print()
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
    p_run.add_argument("--dry-run", action="store_true", dest="dry_run",
                       help="実 API を呼ばずモック応答でフローを検証する")
    p_run.add_argument("--approval-test", action="store_true", dest="approval_test",
                       help="dry-run 時に承認フロー確認用モックを使う")

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

    # artifacts
    p_arts = sub.add_parser("artifacts", help="会話の artifact 一覧を表示する")
    p_arts.add_argument("--conv-id", required=True, dest="conv_id", help="conversation_id")
    p_arts.add_argument("--artifact-id", default=None, dest="artifact_id",
                        help="指定時はその artifact の本文を全文表示（前方一致）")

    # artifact-export
    p_exp = sub.add_parser("artifact-export", help="保存済み artifact を実ファイルに書き出す")
    p_exp.add_argument("--conv-id",     required=True, dest="conv_id",     help="conversation_id")
    p_exp.add_argument("--output",      required=True, dest="output",      help="書き出し先ディレクトリ")
    p_exp.add_argument("--artifact-id", default=None,  dest="artifact_id",
                       help="指定した場合はその 1 件のみ書き出す（前方一致）")
    p_exp.add_argument("--dry-run",     action="store_true", dest="dry_run",
                       help="ファイルを書かず、書き出し計画だけ表示する")

    # artifact-diff
    p_diff = sub.add_parser("artifact-diff", help="artifact のターン間差分を表示する")
    p_diff.add_argument("--conv-id",      required=True, dest="conv_id",      help="conversation_id")
    p_diff.add_argument("--artifact-id",  default=None,  dest="artifact_id",
                        help="この artifact と直前バージョンを diff（前方一致）")
    p_diff.add_argument("--left",         default=None,  dest="left",
                        help="明示比較: 比較元 artifact_id（前方一致）")
    p_diff.add_argument("--right",        default=None,  dest="right",
                        help="明示比較: 比較先 artifact_id（前方一致）")
    p_diff.add_argument("--context",      type=int, default=5, dest="context",
                        help="diff に含める前後行数（デフォルト: 5）")

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
        "log":       command_log,
        "show":      command_show,
        "artifacts":       command_artifacts,
        "artifact-diff":   command_artifact_diff,
        "artifact-export": command_artifact_export,
    }

    handler = dispatch.get(args.command)
    if handler is None:
        parser.print_help()
        return 1

    return handler(args)


if __name__ == "__main__":
    sys.exit(main())
