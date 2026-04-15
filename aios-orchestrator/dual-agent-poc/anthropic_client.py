"""
anthropic_client.py — Anthropic API ラッパー（Executor 役）

orchestrator.py から呼ばれる薄いクライアント層。
役割分担（planner / executor）はこのモジュールでは決め打ちしない。
system prompt と messages（OpenAI共通形式）を受け取り、応答を dict で返す。

Anthropic API は OpenAI と以下の点が異なるため、このモジュール内で吸収する:
  - system prompt は messages リストではなく別パラメータ（system=）で渡す
  - messages に role="system" を混ぜてはいけない
  - 先頭メッセージは role="user" でなければならない

設計根拠: aios-orchestrator/01_architecture.md
"""

from __future__ import annotations

import os
import time
from pathlib import Path
from typing import Any, Optional

import anthropic
from dotenv import load_dotenv

# このファイルと同じディレクトリの .env を優先して読む
_ENV_PATH = Path(__file__).parent / ".env"

# モデルのフォールバック（.env に ANTHROPIC_MODEL が未設定の場合）
_DEFAULT_MODEL = "claude-sonnet-4-6"

# max_tokens のデフォルト値（Anthropic は必須パラメータ）
_DEFAULT_MAX_TOKENS = 2048


def load_anthropic_config() -> dict[str, str]:
    """
    .env を読み込み、Anthropic 接続に必要な設定を dict で返す。

    Returns:
        {
            "api_key": str,
            "model":   str,
        }

    Raises:
        ValueError: ANTHROPIC_API_KEY が未設定の場合
    """
    load_dotenv(dotenv_path=_ENV_PATH, override=False)

    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise ValueError(
            "ANTHROPIC_API_KEY が未設定です。"
            f"{_ENV_PATH} に設定するか、環境変数として渡してください。"
        )

    model = os.getenv("ANTHROPIC_MODEL", _DEFAULT_MODEL)

    return {"api_key": api_key, "model": model}


def normalize_for_anthropic(messages: list[dict[str, str]]) -> list[dict[str, str]]:
    """
    共通形式の messages を Anthropic API に渡せる形式へ変換する。

    変換ルール:
    1. role="system" のメッセージを除去する（system= パラメータに移動済みの前提）
    2. 先頭が role="assistant" の場合、空の role="user" を先頭に挿入する
    3. role は "user" / "assistant" のみを通す（それ以外は除外する）
    4. 連続する同 role を1件にマージする（Anthropic は交互でなければならない）

    Args:
        messages: 共通形式の会話履歴
                  [{"role": "user" | "assistant", "content": str}, ...]

    Returns:
        Anthropic API に渡せる messages リスト
    """
    # system を除去し、user / assistant のみを残す
    filtered = [
        m for m in messages
        if m.get("role") in ("user", "assistant")
        and isinstance(m.get("content"), str)
        and m["content"].strip()
    ]

    if not filtered:
        return [{"role": "user", "content": "(no prior messages)"}]

    # 先頭が assistant なら user を補完する
    if filtered[0]["role"] == "assistant":
        filtered = [{"role": "user", "content": "(conversation start)"}] + filtered

    # 連続する同 role をマージする
    merged: list[dict[str, str]] = []
    for msg in filtered:
        if merged and merged[-1]["role"] == msg["role"]:
            # 同 role が連続 → 改行で連結
            merged[-1] = {
                "role": merged[-1]["role"],
                "content": merged[-1]["content"] + "\n\n" + msg["content"],
            }
        else:
            merged.append({"role": msg["role"], "content": msg["content"]})

    return merged


def chat_anthropic(
    system: str,
    messages: list[dict[str, str]],
    model: Optional[str] = None,
) -> dict[str, Any]:
    """
    Anthropic Messages API を1回呼び出し、応答を dict で返す。

    Args:
        system:   system prompt の文字列
        messages: 会話履歴のリスト。共通形式:
                  [{"role": "user" | "assistant", "content": str}, ...]
                  ※ role="system" は含めないこと（system 引数で渡す）
        model:    使用するモデル名。省略時は .env の ANTHROPIC_MODEL を使う

    Returns:
        {
            "content": str,          # アシスタントの応答テキスト
            "model":   str,          # 実際に使用したモデル名
            "usage":   {             # トークン使用量（API が返した場合）
                "input_tokens":  int,
                "output_tokens": int,
            } | None,
            "duration_ms": int,      # 呼び出し時間（ミリ秒）
            "raw":     object,       # SDK が返した Message オブジェクト
        }

    Raises:
        ValueError:     APIキーが未設定の場合
        anthropic.*:    API エラー（握りつぶさない）
    """
    config = load_anthropic_config()
    used_model = model or config["model"]

    client = anthropic.Anthropic(api_key=config["api_key"])

    # Anthropic 形式へ変換
    anthropic_messages = normalize_for_anthropic(messages)

    start = time.monotonic()
    response = client.messages.create(
        model=used_model,
        system=system,
        messages=anthropic_messages,  # type: ignore[arg-type]
        max_tokens=_DEFAULT_MAX_TOKENS,
    )
    duration_ms = int((time.monotonic() - start) * 1000)

    # TextBlock から文字列を取り出す
    content = "".join(
        block.text
        for block in response.content
        if hasattr(block, "text")
    )

    usage: Optional[dict[str, int]] = None
    if response.usage:
        usage = {
            "input_tokens":  response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens,
        }

    return {
        "content":     content,
        "model":       response.model,
        "usage":       usage,
        "duration_ms": duration_ms,
        "raw":         response,
    }
