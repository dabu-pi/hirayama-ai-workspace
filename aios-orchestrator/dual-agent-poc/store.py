"""
store.py — AIOS Dual-Agent Orchestrator 共有ストア

SQLite に対する CRUD を提供する唯一のモジュール。
ビジネスロジックは持たない。純粋な永続化レイヤー。

設計根拠: aios-orchestrator/02_data_model.md
"""

from __future__ import annotations

import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

# schema.sql はこのファイルと同じディレクトリに置く
_SCHEMA_PATH = Path(__file__).parent / "schema.sql"


# ─────────────────────────────────────────────
# 内部ユーティリティ
# ─────────────────────────────────────────────

def _now() -> str:
    """現在時刻を ISO8601（UTC）文字列で返す。"""
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _new_id() -> str:
    """UUID4 を文字列で返す。"""
    return str(uuid.uuid4())


# ─────────────────────────────────────────────
# 接続・初期化
# ─────────────────────────────────────────────

def get_conn(db_path: str) -> sqlite3.Connection:
    """
    SQLite 接続を返す。

    - Row を dict として扱えるよう row_factory を設定する
    - foreign_keys を有効化する
    呼び出し側で close() / with 文を使うこと。
    """
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db(db_path: str) -> None:
    """
    DB を初期化する。

    schema.sql を読み込んでテーブル・インデックスを作成する。
    既にテーブルが存在する場合は何もしない（IF NOT EXISTS）。
    db_path の親ディレクトリが存在しない場合は自動作成する。

    [Phase 2] 既存 DB に summary_updated_at 列が欠けていたら
    自動で ALTER TABLE を実行する（冪等マイグレーション）。
    """
    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    schema = _SCHEMA_PATH.read_text(encoding="utf-8")

    with get_conn(db_path) as conn:
        conn.executescript(schema)

        # Phase 2: summary_updated_at 列のマイグレーション（既存 DB 互換）
        cols = conn.execute("PRAGMA table_info(conversations)").fetchall()
        col_names = {c["name"] for c in cols}
        if "summary_updated_at" not in col_names:
            conn.execute(
                "ALTER TABLE conversations ADD COLUMN summary_updated_at TEXT"
            )


# ─────────────────────────────────────────────
# conversations
# ─────────────────────────────────────────────

def create_conversation(
    db_path: str,
    title: str,
    role_system: str,
    project_id: str = "default",
) -> str:
    """
    会話セッションを新規作成し、conversation_id を返す。

    Args:
        db_path:     SQLite ファイルのパス
        title:       ゴールの概要（人間が読む）
        role_system: 全体の方針（Planner system prompt の基盤）
        project_id:  プロジェクト識別子（未指定時は "default"）

    Returns:
        生成した conversation_id（UUID4 文字列）
    """
    conv_id = _new_id()
    now = _now()

    with get_conn(db_path) as conn:
        conn.execute(
            """
            INSERT INTO conversations
                (conversation_id, project_id, title, role_system, status,
                 turn_count, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'in_progress', 0, ?, ?)
            """,
            (conv_id, project_id, title, role_system, now, now),
        )

    return conv_id


def set_conversation_status(
    db_path: str,
    conversation_id: str,
    status: str,
    summary: Optional[str] = None,
    latest_output: Optional[str] = None,
) -> None:
    """
    会話のステータスを更新する。

    Args:
        db_path:         SQLite ファイルのパス
        conversation_id: 対象の会話 ID
        status:          in_progress | waiting_approval | completed | failed
        summary:         現在地の要約（省略時は更新しない）
        latest_output:   直近の Executor 出力（省略時は更新しない）
    """
    now = _now()

    # 動的に SET 句を組み立てる（None は更新しない）
    fields: list[str] = ["status = ?", "updated_at = ?"]
    values: list = [status, now]

    if summary is not None:
        fields.append("summary = ?")
        values.append(summary)

    if latest_output is not None:
        fields.append("latest_output = ?")
        values.append(latest_output)

    values.append(conversation_id)

    with get_conn(db_path) as conn:
        conn.execute(
            f"UPDATE conversations SET {', '.join(fields)} WHERE conversation_id = ?",
            values,
        )


def update_summary(
    db_path: str,
    conversation_id: str,
    summary: str,
) -> None:
    """
    conversations.summary を更新する（status は変更しない）。

    Phase 2: 毎ターン増分更新を想定した専用関数。
    summary_updated_at と updated_at を同時に更新する。

    Args:
        db_path:         SQLite ファイルのパス
        conversation_id: 対象の会話 ID
        summary:         新しい summary 本文
    """
    now = _now()
    with get_conn(db_path) as conn:
        conn.execute(
            """
            UPDATE conversations
            SET summary = ?, summary_updated_at = ?, updated_at = ?
            WHERE conversation_id = ?
            """,
            (summary, now, now, conversation_id),
        )


def increment_turn_count(db_path: str, conversation_id: str) -> None:
    """turn_count を 1 増やし、updated_at を更新する。"""
    with get_conn(db_path) as conn:
        conn.execute(
            """
            UPDATE conversations
            SET turn_count = turn_count + 1, updated_at = ?
            WHERE conversation_id = ?
            """,
            (_now(), conversation_id),
        )


# ─────────────────────────────────────────────
# messages
# ─────────────────────────────────────────────

def append_message(
    db_path: str,
    conversation_id: str,
    turn_id: int,
    role_executor: str,
    source_model: str,
    target_model: Optional[str],
    content: str,
    requires_approval: bool = False,
) -> str:
    """
    メッセージを追記し、message_id を返す。

    Args:
        db_path:           SQLite ファイルのパス
        conversation_id:   親会話の ID
        turn_id:           ターン番号（1始まり）
        role_executor:     'planner' | 'executor'
        source_model:      発言したモデル名（例: 'gpt-4o'）
        target_model:      次に渡すモデル名（Orchestrator が記録。不明なら None）
        content:           発言内容
        requires_approval: 承認が必要な場合は True

    Returns:
        生成した message_id（UUID4 文字列）
    """
    msg_id = _new_id()
    now = _now()
    req_app = 1 if requires_approval else 0

    with get_conn(db_path) as conn:
        conn.execute(
            """
            INSERT INTO messages
                (message_id, conversation_id, turn_id, role_executor,
                 source_model, target_model, content,
                 requires_approval, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
            """,
            (msg_id, conversation_id, turn_id, role_executor,
             source_model, target_model, content, req_app, now),
        )

    return msg_id


def set_message_approval(
    db_path: str,
    message_id: str,
    approved: bool,
    approved_by: str = "human",
) -> None:
    """
    メッセージの承認・却下を記録する。

    Args:
        db_path:     SQLite ファイルのパス
        message_id:  対象メッセージの ID
        approved:    True → approved、False → rejected
        approved_by: 承認者（デフォルト: 'human'）
    """
    now = _now()
    new_status = "approved" if approved else "rejected"
    by = approved_by if approved else None

    with get_conn(db_path) as conn:
        conn.execute(
            """
            UPDATE messages
            SET status = ?, approved_by = ?, approved_at = ?
            WHERE message_id = ?
            """,
            (new_status, by, now, message_id),
        )


# ─────────────────────────────────────────────
# artifacts
# ─────────────────────────────────────────────

def append_artifact(
    db_path: str,
    message_id: str,
    artifact_type: str,
    filename: Optional[str],
    content: str,
) -> str:
    """
    成果物を追記し、artifact_id を返す。

    artifact_type が 'shell' の場合でも保存は行う。
    自動実行は orchestrator.py 側で禁止する。

    Args:
        db_path:       SQLite ファイルのパス
        message_id:    親メッセージの ID
        artifact_type: 'code' | 'file' | 'json' | 'markdown' | 'shell'
        filename:      ファイル名（任意）
        content:       成果物本文

    Returns:
        生成した artifact_id（UUID4 文字列）
    """
    art_id = _new_id()
    now = _now()

    with get_conn(db_path) as conn:
        conn.execute(
            """
            INSERT INTO artifacts
                (artifact_id, message_id, artifact_type, filename, content, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (art_id, message_id, artifact_type, filename, content, now),
        )

    return art_id


# ─────────────────────────────────────────────
# run_log
# ─────────────────────────────────────────────

def append_run_log(
    db_path: str,
    conversation_id: str,
    turn_id: Optional[int],
    event_type: str,
    model: Optional[str] = None,
    tokens_in: Optional[int] = None,
    tokens_out: Optional[int] = None,
    duration_ms: Optional[int] = None,
    metadata: Optional[str] = None,
) -> str:
    """
    実行ログを追記し、log_id を返す。

    run_log は追記専用。UPDATE / DELETE は行わない。

    Args:
        db_path:         SQLite ファイルのパス
        conversation_id: 対象会話の ID
        turn_id:         ターン番号（session_start 等は None 可）
        event_type:      'api_call' | 'approval_requested' | 'approved' |
                         'rejected' | 'error' | 'session_start' | 'session_end'
        model:           呼び出したモデル名（承認操作等は None）
        tokens_in:       入力トークン数（None 可）
        tokens_out:      出力トークン数（None 可）
        duration_ms:     API 呼び出し時間（ミリ秒）（None 可）
        metadata:        JSON 文字列（任意の追加情報）

    Returns:
        生成した log_id（UUID4 文字列）
    """
    log_id = _new_id()
    now = _now()

    with get_conn(db_path) as conn:
        conn.execute(
            """
            INSERT INTO run_log
                (log_id, conversation_id, turn_id, event_type,
                 model, tokens_in, tokens_out, duration_ms, metadata, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (log_id, conversation_id, turn_id, event_type,
             model, tokens_in, tokens_out, duration_ms, metadata, now),
        )

    return log_id


# ─────────────────────────────────────────────
# 履歴取得
# ─────────────────────────────────────────────

def get_history(db_path: str, conversation_id: str) -> list[dict]:
    """
    会話の全メッセージを時系列で取得し、OpenAI 形式に近い dict リストで返す。

    各要素に以下のキーを含む:
        - role:           'user'（planner）| 'assistant'（executor）
                          ※ OpenAI messages API の role 名に合わせる
        - content:        発言内容
        - turn_id:        ターン番号
        - source_model:   発言したモデル名
        - role_executor:  'planner' | 'executor'（元の DB 値）
        - message_id:     メッセージ ID
        - status:         pending | approved | rejected | executed
        - requires_approval: bool

    Args:
        db_path:         SQLite ファイルのパス
        conversation_id: 対象会話の ID

    Returns:
        メッセージの dict リスト（turn_id, created_at 昇順）
    """
    with get_conn(db_path) as conn:
        rows = conn.execute(
            """
            SELECT
                message_id,
                turn_id,
                role_executor,
                source_model,
                content,
                requires_approval,
                status,
                created_at
            FROM messages
            WHERE conversation_id = ?
            ORDER BY turn_id ASC, created_at ASC
            """,
            (conversation_id,),
        ).fetchall()

    result: list[dict] = []
    for row in rows:
        # OpenAI API の role 名へ変換
        # planner → user（ChatGPT が指示を出す側）
        # executor → assistant（Claude が応答する側）
        api_role = "user" if row["role_executor"] == "planner" else "assistant"

        result.append(
            {
                "role": api_role,
                "content": row["content"],
                "turn_id": row["turn_id"],
                "source_model": row["source_model"],
                "role_executor": row["role_executor"],
                "message_id": row["message_id"],
                "status": row["status"],
                "requires_approval": bool(row["requires_approval"]),
            }
        )

    return result


def get_pending_approvals(db_path: str) -> list[dict]:
    """
    承認待ちのメッセージ一覧を返す。

    Returns:
        message_id / conversation_id / turn_id / content / created_at を含む dict リスト
    """
    with get_conn(db_path) as conn:
        rows = conn.execute(
            """
            SELECT
                m.message_id,
                m.conversation_id,
                m.turn_id,
                m.content,
                m.created_at,
                c.title,
                c.project_id
            FROM messages m
            JOIN conversations c ON m.conversation_id = c.conversation_id
            WHERE m.requires_approval = 1
              AND m.status = 'pending'
            ORDER BY m.created_at ASC
            """,
        ).fetchall()

    return [dict(row) for row in rows]


# ─────────────────────────────────────────────
# 単件取得（orchestrator / コマンドから使う）
# ─────────────────────────────────────────────

def get_conversation(db_path: str, conversation_id: str) -> Optional[dict]:
    """
    conversation_id で会話を1件取得する。

    Returns:
        conversations の全カラムを含む dict。存在しない場合は None。
    """
    with get_conn(db_path) as conn:
        row = conn.execute(
            "SELECT * FROM conversations WHERE conversation_id = ?",
            (conversation_id,),
        ).fetchone()
    return dict(row) if row else None


def get_message(db_path: str, message_id: str) -> Optional[dict]:
    """
    message_id でメッセージを1件取得する。

    Returns:
        messages の全カラムを含む dict。存在しない場合は None。
    """
    with get_conn(db_path) as conn:
        row = conn.execute(
            "SELECT * FROM messages WHERE message_id = ?",
            (message_id,),
        ).fetchone()
    return dict(row) if row else None


def get_run_log(db_path: str, conversation_id: str) -> list[dict]:
    """
    conversation_id に紐づく run_log を時系列で返す。

    Returns:
        run_log の全カラムを含む dict リスト（created_at 昇順）
    """
    with get_conn(db_path) as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM run_log
            WHERE conversation_id = ?
            ORDER BY created_at ASC
            """,
            (conversation_id,),
        ).fetchall()
    return [dict(row) for row in rows]


# ─────────────────────────────────────────────
# project_id / context 制御（Task 5 追加）
# ─────────────────────────────────────────────

def get_conversation_project_id(db_path: str, conversation_id: str) -> str:
    """
    conversation_id から project_id を返す。

    Args:
        db_path:         SQLite ファイルのパス
        conversation_id: 対象会話の ID

    Returns:
        project_id 文字列。会話が見つからない場合は "default" を返す。
    """
    with get_conn(db_path) as conn:
        row = conn.execute(
            "SELECT project_id FROM conversations WHERE conversation_id = ?",
            (conversation_id,),
        ).fetchone()
    return row["project_id"] if row else "default"


def get_recent_history(
    db_path: str,
    conversation_id: str,
    limit: int = 10,
) -> list[dict]:
    """
    指定 conversation_id のメッセージを新しい順に limit 件取得し、
    会話順（古い順）に並べ直して返す。

    全履歴ではなく直近 N 件だけを渡すことで、
    トークン肥大化と他会話の混入を防ぐ。

    Args:
        db_path:         SQLite ファイルのパス
        conversation_id: 対象会話の ID（他 conversation_id は一切参照しない）
        limit:           取得する最大件数（デフォルト 10）

    Returns:
        get_history() と同じ形式の dict リスト（turn_id 昇順）
    """
    if limit <= 0:
        limit = 10  # 0 以下は許容しない

    with get_conn(db_path) as conn:
        # 新しい順で limit 件取得してから古い順に並べ直す
        rows = conn.execute(
            """
            SELECT
                message_id,
                turn_id,
                role_executor,
                source_model,
                content,
                requires_approval,
                status,
                created_at
            FROM messages
            WHERE conversation_id = ?
            ORDER BY turn_id DESC, created_at DESC
            LIMIT ?
            """,
            (conversation_id, limit),
        ).fetchall()

    # 古い順に並べ直す
    rows = list(reversed(rows))

    result: list[dict] = []
    for row in rows:
        api_role = "user" if row["role_executor"] == "planner" else "assistant"
        result.append(
            {
                "role": api_role,
                "content": row["content"],
                "turn_id": row["turn_id"],
                "source_model": row["source_model"],
                "role_executor": row["role_executor"],
                "message_id": row["message_id"],
                "status": row["status"],
                "requires_approval": bool(row["requires_approval"]),
            }
        )

    return result


def build_context(
    db_path: str,
    conversation_id: str,
    limit: int = 10,
) -> dict:
    """
    LLM に渡す文脈を構築して返す。

    全履歴ではなく summary + recent_history の組み合わせを使うことで、
    トークン数を抑え、他会話の混入を防ぐ。

    Returns:
        {
            "conversation_id": str,
            "project_id":      str,
            "summary":         str | None,   # conversations.summary
            "latest_output":   str | None,   # 直近の Executor 出力
            "recent_history":  list[dict],   # get_recent_history() の結果
            "latest_message":  dict | None,  # recent_history の最末尾
        }

    Args:
        db_path:         SQLite ファイルのパス
        conversation_id: 対象会話の ID（他会話・他プロジェクトは参照しない）
        limit:           recent_history の最大件数（デフォルト 10）
    """
    conv = get_conversation(db_path, conversation_id)
    if conv is None:
        return {
            "conversation_id": conversation_id,
            "project_id":      "default",
            "summary":         None,
            "latest_output":   None,
            "recent_history":  [],
            "latest_message":  None,
        }

    recent = get_recent_history(db_path, conversation_id, limit=limit)
    latest = recent[-1] if recent else None

    return {
        "conversation_id": conversation_id,
        "project_id":      conv.get("project_id", "default"),
        "summary":         conv.get("summary"),
        "latest_output":   conv.get("latest_output"),
        "recent_history":  recent,
        "latest_message":  latest,
    }
