"""
run_batch.py — バッチ実行エントリポイント（MVP版）

モックデータを使ってスコア計算・ランキングをCLI出力する。

使い方:
    python scripts/run_batch.py
    python scripts/run_batch.py --week 2026-03-30
    python scripts/run_batch.py --week 2026-03-30 --category treadmill
    python scripts/run_batch.py --week 2026-03-30 --output-csv
"""

import argparse
import csv
import sys
import io
from collections import defaultdict
from datetime import datetime
from pathlib import Path

# Windows端末のCP932文字化け対策
if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if sys.stderr.encoding != "utf-8":
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# プロジェクトルートを sys.path に追加
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.collectors.mock import MockCollector
from src.scorer.calculator import ScoreCalculator

try:
    from tabulate import tabulate
    HAS_TABULATE = True
except ImportError:
    HAS_TABULATE = False


def build_metrics_by_model(raw_metrics: list) -> dict:
    """RawMetric リストを機種別の辞書に変換"""
    by_model = defaultdict(lambda: {"brand": "", "model": "", "category": "", "week_start": "", "metrics": {}})

    for m in raw_metrics:
        key = f"{m.brand_name}::{m.model_name}::{m.category_name}"
        entry = by_model[key]
        entry["brand"] = m.brand_name
        entry["model"] = m.model_name
        entry["category"] = m.category_name
        entry["week_start"] = m.week_start
        if m.metric_type not in entry["metrics"]:
            entry["metrics"][m.metric_type] = {}
        entry["metrics"][m.metric_type]["value"] = m.value
        entry["metrics"][m.metric_type]["value_prev"] = m.value_prev

    return dict(by_model)


def print_ranking(scores: list, category_filter: str | None = None) -> None:
    filtered = scores
    if category_filter:
        filtered = [s for s in scores if s.category_name == category_filter]

    # ランキング番号付与
    rows = []
    for i, s in enumerate(filtered, 1):
        label_emoji = {
            "rising_fast": "↑↑",
            "rising":      "↑ ",
            "stable":      "→ ",
            "falling":     "↓ ",
            "falling_fast":"↓↓",
            "unknown":     "? ",
        }.get(s.rank_label, "  ")

        change_str = f"{s.change_rate:+.1f}%" if s.change_rate is not None else "N/A"
        rows.append([
            i,
            label_emoji,
            s.brand_name,
            s.model_name,
            s.category_name,
            f"{s.score:.1f}" if s.score is not None else "N/A",
            f"{s.score_prev:.1f}" if s.score_prev is not None else "N/A",
            change_str,
            s.rank_label,
        ])

    headers = ["#", "", "Brand", "Model", "Category", "Score", "Prev", "Change", "Label"]

    print(f"\n=== トレンドランキング {scores[0].week_start if scores else ''} ===")
    if category_filter:
        print(f"カテゴリ: {category_filter}")
    print()

    if HAS_TABULATE:
        print(tabulate(rows, headers=headers, tablefmt="simple"))
    else:
        # tabulate 未インストール時の簡易出力
        print("\t".join(headers))
        for row in rows:
            print("\t".join(str(c) for c in row))

    print(f"\n合計 {len(filtered)} 機種")


def export_csv(scores: list, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(["rank", "brand", "model", "category", "week_start",
                         "score", "score_prev", "change_rate", "rank_label"])
        for i, s in enumerate(scores, 1):
            writer.writerow([
                i, s.brand_name, s.model_name, s.category_name, s.week_start,
                s.score, s.score_prev, s.change_rate, s.rank_label
            ])
    print(f"\n[CSV] {output_path.resolve()}")


def main():
    parser = argparse.ArgumentParser(description="トレンドランキング バッチ実行（MVP版）")
    parser.add_argument("--week", default="2026-03-30", help="集計週（ISO 8601 月曜日）")
    parser.add_argument("--category", help="カテゴリ絞り込み（例: treadmill）")
    parser.add_argument("--output-csv", action="store_true", help="CSV出力")
    parser.add_argument("--use-mock", action="store_true", default=True, help="モックデータ使用（デフォルト）")
    args = parser.parse_args()

    print(f"[START] {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} week={args.week}")

    # 1. 収集
    collector = MockCollector()
    result = collector.collect(keywords=[], week_start=args.week)

    if result.errors:
        for err in result.errors:
            print(f"[ERROR] {err}", file=sys.stderr)
        if not result.metrics:
            sys.exit(1)

    print(f"[COLLECT] {len(result.metrics)} metrics loaded from '{result.source_name}'")

    # 2. 機種別に集約
    metrics_by_model = build_metrics_by_model(result.metrics)
    print(f"[NORMALIZE] {len(metrics_by_model)} models")

    # 3. スコア計算
    calc = ScoreCalculator()
    scores = calc.calculate(metrics_by_model)
    print(f"[SCORE] {len(scores)} models scored")

    # 4. 出力
    print_ranking(scores, category_filter=args.category)

    if args.output_csv:
        ts = args.week.replace("-", "")
        export_csv(scores, Path(f"data/output/ranking_{ts}.csv"))

    print(f"\n[END] {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")


if __name__ == "__main__":
    main()
