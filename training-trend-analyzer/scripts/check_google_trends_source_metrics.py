"""
Inspect google_trends rows already imported into source_metrics.

Usage:
    python scripts/check_google_trends_source_metrics.py
    python scripts/check_google_trends_source_metrics.py --week 2026-04-06
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
    parser = argparse.ArgumentParser(description="Inspect google_trends rows in source_metrics")
    parser.add_argument("--db-path", default=str(DEFAULT_DB))
    parser.add_argument("--week")
    parser.add_argument("--metric-type")
    args = parser.parse_args()

    conn = sqlite3.connect(args.db_path)
    cur = conn.cursor()

    sql = """
        SELECT b.name, m.name, sm.week_start, sm.metric_type, sm.value
        FROM source_metrics sm
        JOIN models m ON sm.model_id = m.id
        JOIN brands b ON m.brand_id = b.id
        JOIN sources s ON sm.source_id = s.id
        WHERE s.name = 'google_trends'
    """
    params = []
    if args.week:
        sql += " AND sm.week_start = ?"
        params.append(args.week)
    if args.metric_type:
        sql += " AND sm.metric_type = ?"
        params.append(args.metric_type)
    sql += " ORDER BY sm.week_start, b.name, m.name"

    rows = cur.execute(sql, params).fetchall()
    print(f"rows={len(rows)}")
    for row in rows:
        print(row)
    conn.close()


if __name__ == "__main__":
    main()
