"""
migrate_add_import_meta.py — DBマイグレーション: importメタ情報追加

既存 DB に以下を追加する:
- テーブル: import_batches（インポートバッチ管理）
- source_metrics に列追加: import_batch_id, raw_input, imported_at, review_status
- unclassified_queue に列追加: import_batch_id, raw_brand, raw_category, raw_name,
                                certainty_label, unresolved_reason, metric_type,
                                metric_value, week_start, file_row_num

冪等性あり（既に存在するカラム/テーブルはスキップ）

使い方:
    python scripts/migrate_add_import_meta.py
    python scripts/migrate_add_import_meta.py --db-path data/db/trend.db
"""

import argparse
import sqlite3
import sys
import io
from pathlib import Path

if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

DEFAULT_DB = Path(__file__).parent.parent / "data" / "db" / "trend.db"


def _existing_columns(conn: sqlite3.Connection, table: str) -> set[str]:
    rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return {r[1] for r in rows}


def _existing_tables(conn: sqlite3.Connection) -> set[str]:
    rows = conn.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall()
    return {r[0] for r in rows}


def migrate(db_path: Path) -> None:
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        tables = _existing_tables(conn)

        # ---- 1. import_batches テーブル（新規） ----
        if "import_batches" not in tables:
            conn.execute("""
                CREATE TABLE import_batches (
                    id            INTEGER PRIMARY KEY AUTOINCREMENT,
                    batch_id      TEXT    NOT NULL UNIQUE,
                    file_name     TEXT    NOT NULL,
                    imported_at   TEXT    NOT NULL DEFAULT (datetime('now')),
                    rows_total    INTEGER NOT NULL DEFAULT 0,
                    rows_ok       INTEGER NOT NULL DEFAULT 0,
                    rows_review   INTEGER NOT NULL DEFAULT 0,
                    rows_skipped  INTEGER NOT NULL DEFAULT 0,
                    rows_error    INTEGER NOT NULL DEFAULT 0,
                    is_dry_run    INTEGER NOT NULL DEFAULT 0,
                    notes         TEXT
                )
            """)
            print("  [ADD TABLE] import_batches")
        else:
            print("  [SKIP] import_batches already exists")

        # ---- 2. source_metrics に列追加 ----
        sm_cols = _existing_columns(conn, "source_metrics")
        new_sm_cols = [
            ("import_batch_id", "INTEGER"),
            ("raw_input",       "TEXT"),
            ("imported_at",     "TEXT"),
            ("review_status",   "TEXT NOT NULL DEFAULT 'ok'"),
        ]
        for col_name, col_def in new_sm_cols:
            if col_name not in sm_cols:
                conn.execute(f"ALTER TABLE source_metrics ADD COLUMN {col_name} {col_def}")
                print(f"  [ADD COL] source_metrics.{col_name}")
            else:
                print(f"  [SKIP] source_metrics.{col_name} already exists")

        # ---- 3. unclassified_queue に列追加 ----
        uq_cols = _existing_columns(conn, "unclassified_queue")
        new_uq_cols = [
            ("import_batch_id",   "INTEGER"),
            ("raw_brand",         "TEXT"),
            ("raw_category",      "TEXT"),
            ("raw_name",          "TEXT"),
            ("certainty_label",   "TEXT"),
            ("unresolved_reason", "TEXT"),
            ("metric_type",       "TEXT"),
            ("metric_value",      "REAL"),
            ("week_start",        "TEXT"),
            ("file_row_num",      "INTEGER"),
        ]
        for col_name, col_def in new_uq_cols:
            if col_name not in uq_cols:
                conn.execute(f"ALTER TABLE unclassified_queue ADD COLUMN {col_name} {col_def}")
                print(f"  [ADD COL] unclassified_queue.{col_name}")
            else:
                print(f"  [SKIP] unclassified_queue.{col_name} already exists")

        # ---- インデックス追加 ----
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_source_metrics_batch
            ON source_metrics (import_batch_id)
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_source_metrics_review
            ON source_metrics (review_status)
        """)
        conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_unclassified_batch
            ON unclassified_queue (import_batch_id)
        """)

        conn.commit()
        print("\n[OK] マイグレーション完了")

    except Exception as e:
        conn.rollback()
        print(f"\n[ERROR] ロールバック: {e}", file=sys.stderr)
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="DBマイグレーション: importメタ情報追加")
    parser.add_argument("--db-path", default=str(DEFAULT_DB))
    args = parser.parse_args()
    migrate(Path(args.db_path))
