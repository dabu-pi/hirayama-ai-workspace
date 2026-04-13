"""
Inspect imported rows in source_metrics by source and metric.

Usage:
    python scripts/check_source_metrics.py --source-name google_suggest
    python scripts/check_source_metrics.py --source-name google_trends --metric-type google_trends_interest --week 2026-04-06
"""

import argparse
import io
import sqlite3
import sys
from pathlib import Path

if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

ROOT = Path(__file__).parent.parent
DEFAULT_DB = ROOT / "data" / "db" / "trend.db"


def main() -> None:
    parser = argparse.ArgumentParser(description="Inspect source_metrics rows")
    parser.add_argument("--db-path", default=str(DEFAULT_DB))
    parser.add_argument("--source-name", required=True)
    parser.add_argument("--metric-type")
    parser.add_argument("--week")
    args = parser.parse_args()

    conn = sqlite3.connect(args.db_path)
    cur = conn.cursor()

    sql = """
        SELECT s.name, b.name, m.name, sm.week_start, sm.metric_type, sm.value, sm.sample_size
        FROM source_metrics sm
        JOIN sources s ON sm.source_id = s.id
        LEFT JOIN models m ON sm.model_id = m.id
        LEFT JOIN brands b ON m.brand_id = b.id
        WHERE s.name = ?
    """
    params = [args.source_name]

    if args.metric_type:
        sql += " AND sm.metric_type = ?"
        params.append(args.metric_type)
    if args.week:
        sql += " AND sm.week_start = ?"
        params.append(args.week)

    sql += " ORDER BY sm.week_start, b.name, m.name, sm.metric_type"
    rows = cur.execute(sql, params).fetchall()
    print(f"rows={len(rows)}")
    for row in rows:
        print(row)
    conn.close()


if __name__ == "__main__":
    main()
