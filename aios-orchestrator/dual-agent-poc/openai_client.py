"""
openai_client.py — OpenAI API ラッパー（Planner 役）

orchestrator.py から呼ばれる薄いクライアント層。
役割分担（planner / executor）はこのモジュールでは決め打ちしない。
system prompt と messages を受け取り、応答を dict で返すことだけを責務とする。

設計根拠: aios-orchestrator/01_architecture.md
"""

from __future__ import annotations

import os
import time
from pathlib import Path
from typing import Any, Optional

from dotenv import load_dotenv
from openai import OpenAI

# このファイルと同じディレクトリの .env を優先して読む
_ENV_PATH = Path(__file__).parent / ".env"

# モデルのフォールバック（.env に OPENAI_MODEL が未設定の場合）
_DEFAULT_MODEL = "gpt-4o"

# max_tokens のデフォルト値
_DEFAULT_MAX_TOKENS = 2048


def load_openai_config() -> dict[str, str]:
    """
    .env を読み込み、OpenAI 接続に必要な設定を dict で返す。

    Returns:
        {
            "api_key": str,
            "model":   str,
        }

    Raises:
        ValueError: OPENAI_API_KEY が未設定の場合
    """
    load_dotenv(dotenv_path=_ENV_PATH, override=True)

    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise ValueError(
            "OPENAI_API_KEY が未設定です。"
            f"{_ENV_PATH} に設定するか、環境変数として渡してください。"
        )

    model = os.getenv("OPENAI_MODEL", _DEFAULT_MODEL)

    return {"api_key": api_key, "model": model}


def chat_openai(
    system: str,
    messages: list[dict[str, str]],
    model: Optional[str] = None,
) -> dict[str, Any]:
    """
    OpenAI Chat Completions API を1回呼び出し、応答を dict で返す。

    Args:
        system:   system prompt の文字列
        messages: 会話履歴のリスト。共通形式:
                  [{"role": "user" | "assistant", "content": str}, ...]
                  ※ role="system" は含めないこと（system 引数で渡す）
        model:    使用するモデル名。省略時は .env の OPENAI_MODEL を使う

    Returns:
        {
            "content": str,          # アシスタントの応答テキスト
            "model":   str,          # 実際に使用したモデル名
            "usage":   {             # トークン使用量（API が返した場合）
                "prompt_tokens":     int,
                "completion_tokens": int,
                "total_tokens":      int,
            } | None,
            "raw":     object,       # SDK が返した ChatCompletion オブジェクト
        }

    Raises:
        ValueError:  APIキーが未設定の場合
        openai.*:    API エラー（握りつぶさない）
    """
    config = load_openai_config()
    used_model = model or config["model"]

    client = OpenAI(api_key=config["api_key"])

    # system prompt を先頭に差し込む
    full_messages: list[dict[str, str]] = [
        {"role": "system", "content": system},
        *messages,
    ]

    start = time.monotonic()
    response = client.chat.completions.create(
        model=used_model,
        messages=full_messages,  # type: ignore[arg-type]
        max_tokens=_DEFAULT_MAX_TOKENS,
    )
    duration_ms = int((time.monotonic() - start) * 1000)

    content = response.choices[0].message.content or ""

    usage: Optional[dict[str, int]] = None
    if response.usage:
        usage = {
            "prompt_tokens":     response.usage.prompt_tokens,
            "completion_tokens": response.usage.completion_tokens,
            "total_tokens":      response.usage.total_tokens,
        }

    return {
        "content":     content,
        "model":       response.model,
        "usage":       usage,
        "duration_ms": duration_ms,
        "raw":         response,
    }
