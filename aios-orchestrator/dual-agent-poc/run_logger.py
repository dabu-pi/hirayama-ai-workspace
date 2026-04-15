"""
run_logger.py — 実行ログ書き込みラッパー

store.py の append_run_log() を orchestrator から使いやすい形で薄くラップする。
event_type ごとに専用関数を用意することで、呼び出し側のコードを簡潔にする。

設計根拠: aios-orchestrator/06_run_log_spec.md
"""

from __future__ import annotations

import json
from typing import Any, Optional, Union

from store import append_run_log

# ─── event_type 定数 ─────────────────────────────────────────────────────────
EVENT_API_CALL            = "api_call"
EVENT_APPROVAL_REQUESTED  = "approval_requested"
EVENT_APPROVED            = "approved"
EVENT_REJECTED            = "rejected"
EVENT_ERROR               = "error"
EVENT_SESSION_START       = "session_start"
EVENT_SESSION_END         = "session_end"
# Phase 2
EVENT_SUMMARY_UPDATED     = "summary_updated"
EVENT_SUMMARY_FAILED      = "summary_update_failed"
# Phase 3
EVENT_DASHBOARD_REPORTED  = "dashboard_reported"
EVENT_DASHBOARD_FAILED    = "dashboard_report_failed"
EVENT_DASHBOARD_SKIPPED   = "dashboard_skipped"


# ─── 内部ユーティリティ ───────────────────────────────────────────────────────

def _serialize_metadata(metadata: Union[dict, str, None]) -> Optional[str]:
    """
    metadata を JSON 文字列化する。

    - dict → json.dumps（失敗した場合は str() にフォールバック）
    - str  → そのまま返す
    - None → None を返す

    秘密情報はこの関数を通す前に除外すること。
    """
    if metadata is None:
        return None
    if isinstance(metadata, str):
        return metadata
    try:
        return json.dumps(metadata, ensure_ascii=False)
    except (TypeError, ValueError):
        # JSON化できない値（循環参照など）は文字列化して保存する
        return str(metadata)


# ─── 汎用ログ ─────────────────────────────────────────────────────────────────

def log_event(
    db_path: str,
    conversation_id: str,
    turn_id: Optional[int],
    event_type: str,
    model: Optional[str] = None,
    tokens_in: Optional[int] = None,
    tokens_out: Optional[int] = None,
    duration_ms: Optional[int] = None,
    metadata: Union[dict, str, None] = None,
) -> str:
    """
    任意の event_type で run_log に1件追記する汎用関数。

    専用関数（log_api_call 等）が用意されている event_type では
    そちらを使うことを推奨する。

    Args:
        db_path:         SQLite ファイルのパス
        conversation_id: 対象会話の ID
        turn_id:         ターン番号（session_start 等は None 可）
        event_type:      イベント種別文字列
        model:           呼び出したモデル名（承認操作等は None）
        tokens_in:       入力トークン数
        tokens_out:      出力トークン数
        duration_ms:     処理時間（ミリ秒）
        metadata:        追加情報（dict または JSON 文字列。None 可）

    Returns:
        生成した log_id（UUID4 文字列）
    """
    return append_run_log(
        db_path=db_path,
        conversation_id=conversation_id,
        turn_id=turn_id,
        event_type=event_type,
        model=model,
        tokens_in=tokens_in,
        tokens_out=tokens_out,
        duration_ms=duration_ms,
        metadata=_serialize_metadata(metadata),
    )


# ─── 専用ログ関数 ─────────────────────────────────────────────────────────────

def log_api_call(
    db_path: str,
    conversation_id: str,
    turn_id: int,
    model: str,
    tokens_in: Optional[int] = None,
    tokens_out: Optional[int] = None,
    duration_ms: Optional[int] = None,
    metadata: Optional[dict] = None,
) -> str:
    """
    API コール（OpenAI / Anthropic）のログを記録する。

    orchestrator.py は chat_openai() / chat_anthropic() の戻り値から
    usage["prompt_tokens"] 等を取り出してこの関数に渡す。

    Args:
        db_path:         SQLite ファイルのパス
        conversation_id: 対象会話の ID
        turn_id:         ターン番号
        model:           呼び出したモデル名
        tokens_in:       入力トークン数（usage から取得）
        tokens_out:      出力トークン数（usage から取得）
        duration_ms:     API 呼び出し時間（ミリ秒）
        metadata:        追加情報（任意）

    Returns:
        生成した log_id
    """
    return log_event(
        db_path=db_path,
        conversation_id=conversation_id,
        turn_id=turn_id,
        event_type=EVENT_API_CALL,
        model=model,
        tokens_in=tokens_in,
        tokens_out=tokens_out,
        duration_ms=duration_ms,
        metadata=metadata,
    )


def log_approval_requested(
    db_path: str,
    conversation_id: str,
    turn_id: int,
    metadata: Optional[dict] = None,
) -> str:
    """
    承認ゲートが発動した（Human に判断を求めた）ことを記録する。

    Args:
        db_path:         SQLite ファイルのパス
        conversation_id: 対象会話の ID
        turn_id:         ターン番号
        metadata:        追加情報（message_id 等を入れると追跡しやすい）

    Returns:
        生成した log_id
    """
    return log_event(
        db_path=db_path,
        conversation_id=conversation_id,
        turn_id=turn_id,
        event_type=EVENT_APPROVAL_REQUESTED,
        metadata=metadata,
    )


def log_approved(
    db_path: str,
    conversation_id: str,
    turn_id: int,
    metadata: Optional[dict] = None,
) -> str:
    """
    Human が承認した（y を入力した）ことを記録する。

    Args:
        db_path:         SQLite ファイルのパス
        conversation_id: 対象会話の ID
        turn_id:         ターン番号
        metadata:        追加情報

    Returns:
        生成した log_id
    """
    return log_event(
        db_path=db_path,
        conversation_id=conversation_id,
        turn_id=turn_id,
        event_type=EVENT_APPROVED,
        metadata=metadata,
    )


def log_rejected(
    db_path: str,
    conversation_id: str,
    turn_id: int,
    metadata: Optional[dict] = None,
) -> str:
    """
    Human が却下した（n を入力した）ことを記録する。

    Args:
        db_path:         SQLite ファイルのパス
        conversation_id: 対象会話の ID
        turn_id:         ターン番号
        metadata:        追加情報（却下理由を入れると分析しやすい）

    Returns:
        生成した log_id
    """
    return log_event(
        db_path=db_path,
        conversation_id=conversation_id,
        turn_id=turn_id,
        event_type=EVENT_REJECTED,
        metadata=metadata,
    )


def log_error(
    db_path: str,
    conversation_id: str,
    turn_id: int,
    metadata: Optional[dict] = None,
    model: Optional[str] = None,
) -> str:
    """
    例外・エラーが発生したことを記録する。

    metadata に {"error": str(e), "type": type(e).__name__} を渡すと
    後から原因を追跡しやすい。
    ただし、スタックトレースに秘密情報が含まれないよう注意すること。

    Args:
        db_path:         SQLite ファイルのパス
        conversation_id: 対象会話の ID
        turn_id:         ターン番号
        metadata:        エラー情報（{"error": "...", "type": "..."} 推奨）
        model:           エラー発生時に呼んでいたモデル（任意）

    Returns:
        生成した log_id
    """
    return log_event(
        db_path=db_path,
        conversation_id=conversation_id,
        turn_id=turn_id,
        event_type=EVENT_ERROR,
        model=model,
        metadata=metadata,
    )


def log_summary_updated(
    db_path: str,
    conversation_id: str,
    turn_id: Optional[int],
    model: Optional[str] = None,
    tokens_in: Optional[int] = None,
    tokens_out: Optional[int] = None,
    duration_ms: Optional[int] = None,
    metadata: Optional[dict] = None,
) -> str:
    """
    conversations.summary の更新が成功したことを記録する（Phase 2）。

    Args:
        db_path:         SQLite ファイルのパス
        conversation_id: 対象会話の ID
        turn_id:         ターン番号
        model:           summary 生成に使ったモデル
        tokens_in:       入力トークン数
        tokens_out:      出力トークン数
        duration_ms:     処理時間（ミリ秒）
        metadata:        追加情報（event='turn_end'|'task_complete'|'waiting_approval' 等）

    Returns:
        生成した log_id
    """
    return log_event(
        db_path=db_path,
        conversation_id=conversation_id,
        turn_id=turn_id,
        event_type=EVENT_SUMMARY_UPDATED,
        model=model,
        tokens_in=tokens_in,
        tokens_out=tokens_out,
        duration_ms=duration_ms,
        metadata=metadata,
    )


def log_summary_failed(
    db_path: str,
    conversation_id: str,
    turn_id: Optional[int],
    metadata: Optional[dict] = None,
    model: Optional[str] = None,
) -> str:
    """
    conversations.summary の更新に失敗したことを記録する（Phase 2）。

    summary 更新の失敗は会話本体を壊さない設計のため、
    呼び出し側は例外を握りつぶした上でこの関数だけ叩く。

    Args:
        db_path:         SQLite ファイルのパス
        conversation_id: 対象会話の ID
        turn_id:         ターン番号
        metadata:        エラー情報（{"error": "...", "type": "...", "event": "..."}）
        model:           summary 生成で呼んでいたモデル（任意）

    Returns:
        生成した log_id
    """
    return log_event(
        db_path=db_path,
        conversation_id=conversation_id,
        turn_id=turn_id,
        event_type=EVENT_SUMMARY_FAILED,
        model=model,
        metadata=metadata,
    )


def log_dashboard_reported(
    db_path: str,
    conversation_id: str,
    metadata: Optional[dict] = None,
) -> str:
    """
    Dashboard Run_Log シートへの書き込みが成功したことを記録する（Phase 3）。

    Args:
        db_path:         SQLite ファイルのパス
        conversation_id: 対象会話の ID
        metadata:        追加情報（local_path / sheet_result / idempotent_skip 等）

    Returns:
        生成した log_id
    """
    return log_event(
        db_path=db_path,
        conversation_id=conversation_id,
        turn_id=None,
        event_type=EVENT_DASHBOARD_REPORTED,
        metadata=metadata,
    )


def log_dashboard_failed(
    db_path: str,
    conversation_id: str,
    metadata: Optional[dict] = None,
) -> str:
    """
    Dashboard 反映が失敗したことを記録する（Phase 3）。

    失敗は orchestrator 本体を止めない設計のため、
    呼び出し側は例外を握りつぶした上でこの関数だけ叩く。

    Args:
        db_path:         SQLite ファイルのパス
        conversation_id: 対象会話の ID
        metadata:        エラー情報（{"error": "...", "sheet_result": "..."}）

    Returns:
        生成した log_id
    """
    return log_event(
        db_path=db_path,
        conversation_id=conversation_id,
        turn_id=None,
        event_type=EVENT_DASHBOARD_FAILED,
        metadata=metadata,
    )


def log_dashboard_skipped(
    db_path: str,
    conversation_id: str,
    metadata: Optional[dict] = None,
) -> str:
    """
    Dashboard 反映を冪等スキップしたことを記録する（Phase 3）。

    Args:
        db_path:         SQLite ファイルのパス
        conversation_id: 対象会話の ID
        metadata:        スキップ理由（{"reason": "already_reported"}）

    Returns:
        生成した log_id
    """
    return log_event(
        db_path=db_path,
        conversation_id=conversation_id,
        turn_id=None,
        event_type=EVENT_DASHBOARD_SKIPPED,
        metadata=metadata,
    )


def log_session_start(
    db_path: str,
    conversation_id: str,
    goal: Optional[str] = None,
) -> str:
    """
    セッション開始を記録する。

    Args:
        db_path:         SQLite ファイルのパス
        conversation_id: 対象会話の ID
        goal:            ゴール文字列（任意）

    Returns:
        生成した log_id
    """
    meta = {"goal": goal} if goal else None
    return log_event(
        db_path=db_path,
        conversation_id=conversation_id,
        turn_id=None,
        event_type=EVENT_SESSION_START,
        metadata=meta,
    )


def log_session_end(
    db_path: str,
    conversation_id: str,
    status: str,
    total_turns: Optional[int] = None,
) -> str:
    """
    セッション終了を記録する。

    Args:
        db_path:         SQLite ファイルのパス
        conversation_id: 対象会話の ID
        status:          completed / failed / interrupted など
        total_turns:     総ターン数

    Returns:
        生成した log_id
    """
    meta: dict[str, Any] = {"status": status}
    if total_turns is not None:
        meta["total_turns"] = total_turns
    return log_event(
        db_path=db_path,
        conversation_id=conversation_id,
        turn_id=None,
        event_type=EVENT_SESSION_END,
        metadata=meta,
    )


# ─── コスト集計（診断用） ─────────────────────────────────────────────────────

# モデル別レート（$/1M tokens）。2026-04 時点。
# API が返すモデル名は日付サフィックス付き（例: gpt-4o-2024-08-06）なので
# プレフィックス前方一致で検索する（calc_cost 参照）。
_COST_RATES: dict[str, dict[str, float]] = {
    "gpt-4o":            {"in": 2.50,  "out": 10.00},
    "claude-opus-4-6":   {"in": 15.00, "out": 75.00},
    "claude-sonnet-4-6": {"in": 3.00,  "out": 15.00},
    "claude-sonnet-4-5": {"in": 3.00,  "out": 15.00},
    "claude-haiku-4-5":  {"in": 0.80,  "out": 4.00},
}


def calc_cost(model: str, tokens_in: int, tokens_out: int) -> float:
    """
    モデル・トークン数からコスト（USD）を概算する。

    レートが未登録のモデルは 0.0 を返す。
    あくまで概算値であり、公式の請求額とは異なる場合がある。

    API が返すモデル名は日付サフィックス付き（例: gpt-4o-2024-08-06）の場合がある。
    完全一致を優先し、なければプレフィックス前方一致で検索する。

    Args:
        model:      モデル名（API 返却値またはショートネーム）
        tokens_in:  入力トークン数
        tokens_out: 出力トークン数

    Returns:
        推定コスト（USD）
    """
    # 完全一致優先
    if model in _COST_RATES:
        rate = _COST_RATES[model]
    else:
        # プレフィックス前方一致（日付サフィックス付きモデル名の吸収）
        rate = next(
            (v for k, v in _COST_RATES.items() if model.startswith(k)),
            {"in": 0.0, "out": 0.0},
        )
    return (tokens_in * rate["in"] + tokens_out * rate["out"]) / 1_000_000
