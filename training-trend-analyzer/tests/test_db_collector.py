"""
DB collector publication-denominator behavior.
"""

import sqlite3
from pathlib import Path

from src.collectors.db import DbCollector


def _create_test_db(path: Path) -> None:
    conn = sqlite3.connect(path)
    try:
        conn.executescript(
            """
            CREATE TABLE brands (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                market_type TEXT
            );
            CREATE TABLE categories (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL
            );
            CREATE TABLE models (
                id INTEGER PRIMARY KEY,
                brand_id INTEGER,
                category_id INTEGER,
                name TEXT NOT NULL,
                discontinued INTEGER
            );
            CREATE TABLE sources (
                id INTEGER PRIMARY KEY,
                name TEXT NOT NULL
            );
            CREATE TABLE source_metrics (
                id INTEGER PRIMARY KEY,
                source_id INTEGER,
                brand_id INTEGER,
                model_id INTEGER,
                week_start TEXT NOT NULL,
                metric_type TEXT NOT NULL,
                value REAL NOT NULL,
                is_estimated INTEGER DEFAULT 0,
                raw_input TEXT,
                review_status TEXT NOT NULL
            );
            """
        )
        conn.executemany(
            "INSERT INTO brands (id, name, market_type) VALUES (?, ?, ?)",
            [
                (1, "TECHNOGYM", "commercial"),
                (2, "JOHNSON", "commercial"),
            ],
        )
        conn.execute("INSERT INTO categories (id, name) VALUES (1, 'treadmill')")
        conn.execute(
            "INSERT INTO models (id, brand_id, category_id, name, discontinued) VALUES (1, 1, 1, 'Run', 0)"
        )
        conn.execute("INSERT INTO sources (id, name) VALUES (1, 'google_trends')")
        conn.executemany(
            """
            INSERT INTO source_metrics (
                id,
                source_id,
                brand_id,
                model_id,
                week_start,
                metric_type,
                value,
                is_estimated,
                raw_input,
                review_status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (1, 1, 1, 1, "2026-04-06", "google_trends_interest", 64.0, 0, None, "ok"),
                (2, 1, 2, None, "2026-04-06", "google_trends_interest", 12.0, 0, None, "ok"),
            ],
        )
        conn.commit()
    finally:
        conn.close()


def test_only_commercial_excludes_brand_only_rows_from_publication_targets(tmp_path):
    db_path = tmp_path / "trend.db"
    _create_test_db(db_path)

    collector = DbCollector(db_path=db_path, only_commercial=True)

    result = collector.collect(keywords=[], week_start="2026-04-06")

    assert not result.errors
    assert [(metric.brand_name, metric.model_name) for metric in result.metrics] == [
        ("TECHNOGYM", "Run"),
    ]


def test_db_collector_keeps_brand_only_rows_when_not_using_commercial_publication_filter(tmp_path):
    db_path = tmp_path / "trend.db"
    _create_test_db(db_path)

    collector = DbCollector(db_path=db_path, only_commercial=False)

    result = collector.collect(keywords=[], week_start="2026-04-06")

    assert not result.errors
    assert [(metric.brand_name, metric.model_name) for metric in result.metrics] == [
        ("TECHNOGYM", "Run"),
        ("JOHNSON", ""),
    ]
