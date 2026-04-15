"""
test_phase5_long_summary.py — 長会話における summary 品質検証 (Phase 5)

実行:
    PYTHONIOENCODING=utf-8 PYTHONUTF8=1 python test_phase5_long_summary.py

概要:
    12 ターン相当のスクリプト会話を real API (gpt-4o-mini) で走らせ、
    summary が各ターンでどう変化するかを観察・検証する。

    LLM コール (Planner/Executor) は不要。summarizer.generate_summary() だけを
    ターンごとに直接呼び出して summary の変化を追う。

検証シナリオ:
    目標: "ECサイトのバックエンドAPIをFastAPIで実装する"
    Turn 1  : Python 3.11 + FastAPI 採用決定
    Turn 2  : PostgreSQL + /users /products エンドポイント設計
    Turn 3  : JWT 認証採用
    Turn 4  : Docker デプロイ方針
    Turn 5  : [waiting_approval] DBマイグレーション（危険操作）
    Turn 6  : マイグレーション承認・実行完了
    Turn 7  : レート制限の追加タスク発生
    Turn 8  : Redis でレート制限実装決定
    Turn 9  : ロギング要件追加
    Turn 10 : structlog 採用・実装完了
    Turn 11 : モニタリング設定タスク
    Turn 12 : [task_complete] 全タスク完了

追跡する「忘れてはいけない事実」:
    KEY_FACTS = {
        "python311":     "Python 3.11",
        "fastapi":       "FastAPI",
        "postgresql":    "PostgreSQL",
        "jwt":           "JWT",
        "docker":        "Docker",
        "redis":         "Redis",
        "structlog":     "structlog",
    }
"""

from __future__ import annotations

import sys
import json
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).parent))

# .env を読み込む
try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent / ".env", override=True)
except ImportError:
    pass

from summarizer import generate_summary


# ─── 検証対象の事実 ───────────────────────────────────────────────────────────
KEY_FACTS = {
    # value: メインキーワード。スペースなし別表記も _ALIASES で補完する
    "python311":  "Python 3.11",
    "fastapi":    "FastAPI",
    "postgresql": "PostgreSQL",
    "jwt":        "JWT",
    "docker":     "Docker",
    "redis":      "Redis",
    "structlog":  "structlog",
}

# LLM がスペースや大文字を変えて書く可能性のある別表記
_ALIASES: dict[str, list[str]] = {
    "python311": ["python3.11", "python 3.11"],
}

GOAL = "ECサイトのバックエンドAPIをFastAPIで実装する"

# ─── 12 ターン分のスクリプト ──────────────────────────────────────────────────
# (turn_id, event, planner_content, executor_content)
SCRIPT: list[tuple[int, str, str, Optional[str]]] = [
    (1, "turn_end",
     "Python 3.11 と FastAPI フレームワークを使ってバックエンドAPIを構築します。"
     "まず requirements.txt と main.py の雛形を作成してください。",
     "requirements.txt と main.py を作成しました。"
     "Python 3.11、fastapi==0.110.0、uvicorn を記載しています。"),

    (2, "turn_end",
     "データベースには PostgreSQL を採用します。"
     "/users と /products の REST エンドポイントを設計してください。",
     "PostgreSQL 接続設定と /users, /products のCRUDエンドポイントを実装しました。"
     "SQLAlchemy ORM を使用しています。"),

    (3, "turn_end",
     "認証方式として JWT (JSON Web Token) を実装してください。"
     "ログインエンドポイントと Bearer トークン検証を含めること。",
     "JWT 認証を実装しました。/auth/login エンドポイントとトークン検証ミドルウェアを追加しました。"),

    (4, "turn_end",
     "デプロイ方針として Docker コンテナ化を進めます。"
     "Dockerfile と docker-compose.yml を作成してください。",
     "Dockerfile（マルチステージビルド）と docker-compose.yml（app + db + redis コンテナ）を作成しました。"),

    (5, "waiting_approval",
     "REQUIRES_APPROVAL: true\n"
     "データベースの本番マイグレーションを実行します。"
     "Alembic で既存テーブルに NOT NULL カラムを追加します。この操作は不可逆です。",
     None),  # 承認待ちなので Executor なし

    (6, "turn_end",
     "マイグレーションが承認されました。Alembic マイグレーションを実行してください。",
     "Alembic マイグレーション完了。users テーブルに email_verified カラムを追加しました。"
     "ロールバックスクリプトも用意しました。"),

    (7, "turn_end",
     "API のレート制限機能を追加するタスクが発生しました。"
     "1IP あたり 100req/min の制限をかけてください。",
     "レート制限の設計を検討中です。Redis を使うスライディングウィンドウ方式を提案します。"),

    (8, "turn_end",
     "Redis を使ったレート制限実装を進めます。slowapi ライブラリを採用してください。",
     "Redis + slowapi によるレート制限を実装しました。"
     "100req/min の制限を全エンドポイントに適用しています。"),

    (9, "turn_end",
     "ロギング要件が追加されました。"
     "構造化ログで request_id / user_id / latency_ms を記録する仕組みを作ってください。",
     "structlog ライブラリの導入を提案します。JSONフォーマットで出力します。"),

    (10, "turn_end",
     "structlog の実装を完了してください。ミドルウェアで request_id を付与すること。",
     "structlog を実装しました。全リクエストに request_id を付与し、"
     "latency_ms と user_id もJSONログに含めています。"),

    (11, "turn_end",
     "最後にモニタリング設定を追加します。"
     "Prometheus メトリクスエンドポイント /metrics を実装してください。",
     "prometheus-client ライブラリで /metrics エンドポイントを実装しました。"
     "リクエスト数・レイテンシ・エラー率のメトリクスを公開しています。"),

    (12, "task_complete",
     "TASK_COMPLETE\n"
     "全タスクが完了しました。FastAPI バックエンドAPI の実装が完成です。",
     None),  # TASK_COMPLETE なので Executor なし
]


# ─── 検証実行 ─────────────────────────────────────────────────────────────────
def _contains_fact(summary: str, fact_key: str) -> bool:
    """KEY_FACTS と _ALIASES を使って summary にキーワードが含まれるか確認。"""
    lower = summary.lower()
    # メインキーワード
    if KEY_FACTS[fact_key].lower() in lower:
        return True
    # 別表記
    for alias in _ALIASES.get(fact_key, []):
        if alias.lower() in lower:
            return True
    return False


def _check_facts(summary: str, turn_id: int, expected_facts: list[str]) -> dict[str, bool]:
    """指定した事実が summary に含まれているか確認する。"""
    return {k: _contains_fact(summary, k) for k in KEY_FACTS if k in expected_facts}


def run_long_summary_test(use_real_api: bool = True) -> dict:
    """
    12 ターン分 summary を連続生成し、各ターンの summary と保持率を返す。
    """
    current_summary: Optional[str] = None
    history: list[dict] = []

    print(f"\n{'='*60}")
    print(f"Phase 5: 長会話 summary 品質検証 ({'real API' if use_real_api else 'mock'})")
    print(f"ゴール: {GOAL}")
    print(f"ターン数: {len(SCRIPT)}")
    print(f"{'='*60}\n")

    for turn_id, event, planner, executor in SCRIPT:
        print(f"--- Turn {turn_id} [{event}] ---")

        if use_real_api:
            result = generate_summary(
                existing_summary=current_summary,
                planner_content=planner,
                executor_content=executor,
                goal=GOAL,
                turn_id=turn_id,
                event=event,
            )
            new_summary = result["summary"]
            tokens_in  = result.get("tokens_in")
            tokens_out = result.get("tokens_out")
        else:
            from summarizer import mock_summary
            new_summary = mock_summary(
                existing_summary=current_summary,
                planner_content=planner,
                executor_content=executor,
                goal=GOAL,
                turn_id=turn_id,
                event=event,
            )
            tokens_in = tokens_out = None

        current_summary = new_summary
        char_count = len(new_summary)

        # Turn ごとに含まれるべき事実を判定
        # Turn N 以降に登場した事実は以後ずっと保持されるべき
        appeared_by_turn = {
            "python311":  1, "fastapi":    1,
            "postgresql": 2, "jwt":        3,
            "docker":     4, "redis":      8,
            "structlog":  10,
        }
        expected = [k for k, t in appeared_by_turn.items() if t <= turn_id]
        retention = _check_facts(new_summary, turn_id, expected)
        retention_rate = sum(retention.values()) / len(retention) if retention else 1.0

        print(f"  文字数: {char_count} / 500")
        print(f"  保持率: {retention_rate*100:.0f}% ({sum(retention.values())}/{len(retention)}件)")
        missing = [KEY_FACTS[k] for k, v in retention.items() if not v]

        if missing:
            print(f"  [欠落] {', '.join(missing)}")
        if tokens_in:
            print(f"  tokens: in={tokens_in} out={tokens_out}")
        print()

        history.append({
            "turn_id":        turn_id,
            "event":          event,
            "summary":        new_summary,
            "char_count":     char_count,
            "retention":      retention,
            "retention_rate": retention_rate,
            "missing_facts":  missing,
            "tokens_in":      tokens_in,
            "tokens_out":     tokens_out,
        })

    # ─── 最終サマリー表示 ──────────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print("最終 summary（Turn 12）:")
    print(f"{'='*60}")
    print(current_summary)
    print(f"\n文字数: {len(current_summary)} 字")

    print(f"\n{'='*60}")
    print("各ターンの保持率推移:")
    print(f"{'='*60}")
    for h in history:
        bar = "█" * int(h["retention_rate"] * 20)
        missing_str = f" 欠落: {', '.join(h['missing_facts'])}" if h["missing_facts"] else ""
        print(f"  Turn {h['turn_id']:>2} [{h['event']:<18}] {h['retention_rate']*100:5.1f}% {bar}{missing_str}")

    final = history[-1]
    print(f"\n最終保持率: {final['retention_rate']*100:.1f}%")
    print(f"最終文字数: {final['char_count']} / 500 字")

    return {
        "history":         history,
        "final_summary":   current_summary,
        "final_retention": final["retention_rate"],
        "all_facts_kept":  final["retention_rate"] == 1.0,
    }


if __name__ == "__main__":
    # デフォルトは real API（gpt-4o-mini）
    mode = "--mock" not in sys.argv
    results = run_long_summary_test(use_real_api=mode)

    # JSON で詳細を出力（解析用）
    out_path = Path(__file__).parent / "logs" / "phase5_summary_test.json"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "goal":    GOAL,
                "history": [
                    {k: v for k, v in h.items() if k != "summary"}
                    for h in results["history"]
                ],
                "final_summary":   results["final_summary"],
                "final_retention": results["final_retention"],
            },
            f, ensure_ascii=False, indent=2,
        )
    print(f"\n詳細ログ: {out_path}")

    if results["all_facts_kept"]:
        print("\n[PASS] 全事実が最終 summary に保持されています。")
    else:
        missing = [KEY_FACTS[k] for k, v in results["history"][-1]["retention"].items() if not v]

        print(f"\n[WARN] 最終 summary で欠落: {', '.join(missing)}")
