"""
dashboard_reporter.py — run_log → Dashboard Run_Log シート反映 (Phase 3)

orchestrator セッション完了時に、会話の集計情報を既存の
Dashboard Run_Log シートへ書き込む。

設計方針:
  - 既存の scripts/append-runlog-to-sheet.mjs を subprocess 経由で呼び出す
    （Node → Sheets API の認証パスを再利用する）
  - 失敗しても orchestrator 本体は止まらない
  - 同一 conversation_id に対する重複書き込みは logs/aios-orchestrator/reported_sessions.json
    でローカル追跡して防ぐ（idempotent）
  - ローカル JSON は常に書き出す（Sheet 反映が失敗しても後で追える）

Run_Log シート列 (10列):
  log_id / datetime / system / project / summary /
  result / commit_hash / tasks_done / stop_reason / next_action

設計根拠: aios-orchestrator/dual-agent-poc/README_Task6.md
"""

from __future__ import annotations

import json
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional


# ─── ワークスペースルートの特定 ──────────────────────────────────────────────
# dual-agent-poc/  →  aios-orchestrator/  →  workspace/
_WORKSPACE_ROOT = Path(__file__).parents[2]

# ローカル出力先（logs/aios-orchestrator/）
_LOCAL_LOG_DIR = _WORKSPACE_ROOT / "logs" / "aios-orchestrator"

# 報告済み conv_id トラッキングファイル
_REPORTED_FILE = _LOCAL_LOG_DIR / "reported_sessions.json"

# Node スクリプトのパス（workspace ルートからの相対）
_APPEND_SCRIPT = _WORKSPACE_ROOT / "scripts" / "append-runlog-to-sheet.mjs"

# Run_Log に書き込む system 名
_SYSTEM_NAME = "aios-orchestrator"


# ─── ユーティリティ ──────────────────────────────────────────────────────────

def _now_jst_str() -> str:
    """現在時刻を YYYY-MM-DD HH:MM:SS（UTC）で返す（Run_Log 形式）。"""
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")


def _iso_to_display(iso: Optional[str]) -> str:
    """ISO8601 文字列を YYYY-MM-DD HH:MM:SS に変換する。失敗したら空文字。"""
    if not iso:
        return ""
    try:
        # "2026-04-15T12:33:42+00:00" → datetime → フォーマット
        dt = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d %H:%M:%S")
    except ValueError:
        return iso[:19].replace("T", " ")


def _extract_next_action(summary: Optional[str]) -> str:
    """
    summary 本文から「次アクション:」行を取り出す。
    見つからない場合は空文字を返す。
    """
    if not summary:
        return ""
    for line in summary.splitlines():
        stripped = line.strip()
        if stripped.startswith("次アクション:"):
            return stripped[len("次アクション:"):].strip()
    return ""


def _load_reported() -> dict:
    """reported_sessions.json を読み込む。ファイルがなければ空 dict を返す。"""
    if not _REPORTED_FILE.exists():
        return {}
    try:
        return json.loads(_REPORTED_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def _save_reported(data: dict) -> None:
    """reported_sessions.json を上書き保存する。"""
    _LOCAL_LOG_DIR.mkdir(parents=True, exist_ok=True)
    _REPORTED_FILE.write_text(
        json.dumps(data, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


# ─── エントリ構築 ────────────────────────────────────────────────────────────

def build_entry(
    conv: dict,
    run_logs: list[dict],
) -> dict:
    """
    conversations レコード + run_log リストから Dashboard Run_Log 行を構築する。

    Returns:
        {
            "log_id":       str,   # "aios-<conv_id[:8]>"
            "datetime":     str,   # "YYYY-MM-DD HH:MM:SS"
            "system":       str,   # "aios-orchestrator"
            "project":      str,   # conv.project_id
            "summary":      str,   # title [status / turns]
            "result":       str,   # SUCCESS | STOP | ERROR | PARTIAL
            "commit_hash":  str,   # conv_id[:8]（git hash の代わり）
            "tasks_done":   str,   # turn_count
            "stop_reason":  str,   # 空 or 理由
            "next_action":  str,   # summary から取得 or 空
            # 以下は Sheet には送らないが JSON に残す追加フィールド
            "conversation_id": str,
            "source":          str,
        }
    """
    status     = conv.get("status", "")
    turn_count = conv.get("turn_count", 0)
    summary    = conv.get("summary") or ""
    conv_id    = conv.get("conversation_id", "")

    # result マッピング
    result_map = {
        "completed":        "SUCCESS",
        "waiting_approval": "STOP",
        "failed":           "ERROR",
    }
    result = result_map.get(status, "PARTIAL")

    # stop_reason
    if status == "waiting_approval":
        stop_reason = "waiting_approval"
    elif status == "failed":
        # run_log の error イベントから最初のメッセージを取る
        errors = [
            r for r in run_logs
            if r.get("event_type") == "error"
        ]
        if errors:
            try:
                meta = json.loads(errors[0].get("metadata") or "{}")
                stop_reason = meta.get("error", "error")[:80]
            except (json.JSONDecodeError, AttributeError):
                stop_reason = "error"
        else:
            stop_reason = "failed"
    else:
        stop_reason = ""

    # next_action: summary の「次アクション:」行、なければ空
    next_action = _extract_next_action(summary)

    # summary 列: title + ブラケットでメタ情報
    sheet_summary = (
        f"{conv.get('title', '')[:60]} "
        f"[{status}/{turn_count}turns]"
    )

    return {
        "log_id":          f"aios-{conv_id[:8]}",
        "datetime":        _iso_to_display(conv.get("updated_at")),
        "system":          _SYSTEM_NAME,
        "project":         conv.get("project_id", "default"),
        "summary":         sheet_summary,
        "result":          result,
        "commit_hash":     conv_id[:8],
        "tasks_done":      str(turn_count),
        "stop_reason":     stop_reason,
        "next_action":     next_action,
        # 追加フィールド（Sheet には送らない）
        "conversation_id": conv_id,
        "source":          "aios-orchestrator",
    }


# ─── ローカル保存 ────────────────────────────────────────────────────────────

def export_local(
    entry: dict,
    timestamp: Optional[str] = None,
) -> Path:
    """
    エントリを logs/aios-orchestrator/<timestamp>_<conv_id[:8]>.json に書き出す。

    Returns:
        書き出したファイルの Path
    """
    _LOCAL_LOG_DIR.mkdir(parents=True, exist_ok=True)

    ts = timestamp or datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    conv_short = (entry.get("conversation_id") or "")[:8] or "unknown"
    filename = f"aios_{ts}_{conv_short}.json"
    path = _LOCAL_LOG_DIR / filename

    path.write_text(
        json.dumps(entry, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    return path


# ─── Sheet への書き込み ──────────────────────────────────────────────────────

def _check_env_ready() -> tuple[bool, str]:
    """
    Sheet 書き込みに必要な env vars が揃っているかを確認する。

    Returns:
        (ready: bool, reason: str)
    """
    required = [
        "AIOS_DASHBOARD_SPREADSHEET_ID",
        "AIOS_SERVICE_ACCOUNT_PATH",
    ]
    missing = [k for k in required if not os.getenv(k)]
    if missing:
        return False, f"env vars 未設定: {', '.join(missing)}"
    if not _APPEND_SCRIPT.exists():
        return False, f"Node スクリプトが見つかりません: {_APPEND_SCRIPT}"
    return True, "OK"


def post_to_sheet(json_path: Path, timeout: int = 30) -> tuple[bool, str]:
    """
    `node scripts/append-runlog-to-sheet.mjs --json <path>` を実行する。

    Returns:
        (success: bool, message: str)
    """
    ready, reason = _check_env_ready()
    if not ready:
        return False, f"Sheet 書き込みスキップ: {reason}"

    try:
        result = subprocess.run(
            ["node", str(_APPEND_SCRIPT), "--json", str(json_path)],
            cwd=str(_WORKSPACE_ROOT),
            capture_output=True,
            text=True,
            timeout=timeout,
            encoding="utf-8",
            errors="replace",
        )
        stdout = (result.stdout or "").strip()
        stderr = (result.stderr or "").strip()

        if result.returncode != 0:
            msg = stderr or stdout or f"exit code {result.returncode}"
            return False, f"Node エラー: {msg[:200]}"

        return True, stdout or "OK"

    except subprocess.TimeoutExpired:
        return False, f"Node スクリプトがタイムアウト ({timeout}s)"
    except FileNotFoundError:
        return False, "node コマンドが見つかりません"
    except OSError as exc:
        return False, f"subprocess 起動失敗: {exc}"


# ─── トップレベル関数 ────────────────────────────────────────────────────────

def report_session(
    conv: dict,
    run_logs: list[dict],
    dry_run: bool = False,
    verbose: bool = True,
) -> dict[str, Any]:
    """
    1 セッションの実行結果を Dashboard Run_Log シートへ反映する。

    処理フロー:
      1. エントリ構築
      2. ローカル JSON 保存（常時実行）
      3. 冪等チェック（reported_sessions.json）→ 既報告なら Sheet スキップ
      4. Sheet 書き込み（dry_run=True のときはスキップ）
      5. 結果を reported_sessions.json に記録

    失敗は ValueError / OSError で raise せず、全て戻り値に包む。
    呼び出し側は例外を期待せず、戻り値の "success" キーで判断する。

    Returns:
        {
            "success":        bool,
            "local_path":     str | None,   # 書き出したローカル JSON パス
            "sheet_result":   str,           # Sheet 書き込み結果メッセージ
            "idempotent_skip": bool,          # 重複のためスキップしたか
            "entry":          dict,           # 構築したエントリ
        }
    """
    conv_id = conv.get("conversation_id", "")
    result: dict[str, Any] = {
        "success":         False,
        "local_path":      None,
        "sheet_result":    "",
        "idempotent_skip": False,
        "entry":           {},
    }

    try:
        # 1. エントリ構築
        entry = build_entry(conv, run_logs)
        result["entry"] = entry

        # 2. ローカル JSON 保存
        ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
        local_path = export_local(entry, timestamp=ts)
        result["local_path"] = str(local_path)
        if verbose:
            print(f"[Dashboard] ローカル保存: {local_path.name}")

        # 3. 冪等チェック
        reported = _load_reported()
        if conv_id in reported:
            result["idempotent_skip"] = True
            result["success"]        = True
            result["sheet_result"]   = "skip (already reported)"
            if verbose:
                print(f"[Dashboard] スキップ: {conv_id[:8]}... は既に報告済み")
            return result

        # 4. Sheet 書き込み
        if dry_run:
            result["sheet_result"] = "skip (dry_run=True)"
            if verbose:
                print(f"[Dashboard] Sheet 書き込みスキップ (dry_run)")
            sheet_ok = True
        else:
            sheet_ok, msg = post_to_sheet(local_path)
            result["sheet_result"] = msg
            if verbose:
                status_label = "OK" if sheet_ok else "WARN"
                print(f"[Dashboard] Sheet 書き込み [{status_label}]: {msg[:120]}")

        # 5. reported_sessions.json を更新（Sheet 成功 or dry_run のみ記録）
        if sheet_ok:
            reported[conv_id] = {
                "reported_at": _now_jst_str(),
                "entry":       entry,
            }
            _save_reported(reported)
            result["success"] = True

    except Exception as exc:  # noqa: BLE001
        result["sheet_result"] = f"予期しないエラー: {type(exc).__name__}: {exc}"
        if verbose:
            print(f"[Dashboard] [WARN] 予期しないエラー: {exc}")

    return result
