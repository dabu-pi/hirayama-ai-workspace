"""
init_db.py — SQLite DB 初期化スクリプト

使い方:
    python scripts/init_db.py
    python scripts/init_db.py --db-path data/db/trend.db
"""

import argparse
import sqlite3
from pathlib import Path

DDL = """
-- ブランドマスタ
CREATE TABLE IF NOT EXISTS brands (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE,
    name_ja     TEXT,
    country     TEXT,
    market_type TEXT    NOT NULL DEFAULT 'commercial',
    website_url TEXT,
    notes       TEXT,
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- カテゴリマスタ
CREATE TABLE IF NOT EXISTS categories (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL UNIQUE,
    name_ja    TEXT,
    parent_id  INTEGER REFERENCES categories(id),
    use_type   TEXT    NOT NULL DEFAULT 'both',
    notes      TEXT,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- 機種マスタ
CREATE TABLE IF NOT EXISTS models (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_id        INTEGER NOT NULL REFERENCES brands(id),
    category_id     INTEGER NOT NULL REFERENCES categories(id),
    name            TEXT    NOT NULL,
    model_number    TEXT,
    use_type        TEXT    NOT NULL DEFAULT 'commercial',
    release_year    INTEGER,
    discontinued    INTEGER NOT NULL DEFAULT 0,
    parent_model_id INTEGER REFERENCES models(id),
    notes           TEXT,
    is_active       INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (brand_id, name)
);

-- 別名・表記ゆれ辞書
CREATE TABLE IF NOT EXISTS aliases (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    alias_text  TEXT    NOT NULL UNIQUE,
    entity_type TEXT    NOT NULL,
    brand_id    INTEGER REFERENCES brands(id),
    model_id    INTEGER REFERENCES models(id),
    source      TEXT,
    confidence  REAL    NOT NULL DEFAULT 1.0,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- データソースマスタ
CREATE TABLE IF NOT EXISTS sources (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL UNIQUE,
    source_type TEXT    NOT NULL,
    region      TEXT    NOT NULL DEFAULT 'jp',
    is_active   INTEGER NOT NULL DEFAULT 1,
    notes       TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- ソース別週次指標値
CREATE TABLE IF NOT EXISTS source_metrics (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id    INTEGER NOT NULL REFERENCES sources(id),
    model_id     INTEGER REFERENCES models(id),
    brand_id     INTEGER REFERENCES brands(id),
    week_start   TEXT    NOT NULL,
    metric_type  TEXT    NOT NULL,
    value        REAL,
    value_prev   REAL,
    sample_size  INTEGER,
    is_estimated INTEGER NOT NULL DEFAULT 0,
    raw_data     TEXT,
    collected_at TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (source_id, model_id, brand_id, week_start, metric_type)
);

-- 合成トレンドスコア
CREATE TABLE IF NOT EXISTS trend_scores (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id         INTEGER NOT NULL REFERENCES models(id),
    week_start       TEXT    NOT NULL,
    score            REAL,
    score_prev       REAL,
    change_rate      REAL,
    rank_label       TEXT,
    rank_in_all      INTEGER,
    rank_in_cat      INTEGER,
    score_version    TEXT    NOT NULL DEFAULT '1.0',
    weights_snapshot TEXT,
    missing_sources  TEXT,
    calculated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (model_id, week_start, score_version)
);

-- 未分類キュー
CREATE TABLE IF NOT EXISTS unclassified_queue (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    raw_text    TEXT    NOT NULL,
    source_id   INTEGER REFERENCES sources(id),
    context     TEXT,
    status      TEXT    NOT NULL DEFAULT 'pending',
    resolved_to TEXT,
    notes       TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    resolved_at TEXT
);

-- バッチ実行ログ
CREATE TABLE IF NOT EXISTS batch_logs (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_type     TEXT    NOT NULL,
    week_start     TEXT,
    status         TEXT    NOT NULL,
    records_input  INTEGER,
    records_output INTEGER,
    errors_count   INTEGER NOT NULL DEFAULT 0,
    error_detail   TEXT,
    started_at     TEXT    NOT NULL,
    finished_at    TEXT
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_trend_scores_week     ON trend_scores (week_start, rank_in_all);
CREATE INDEX IF NOT EXISTS idx_trend_scores_model    ON trend_scores (model_id, week_start);
CREATE INDEX IF NOT EXISTS idx_source_metrics_model  ON source_metrics (model_id, week_start);
CREATE INDEX IF NOT EXISTS idx_source_metrics_source ON source_metrics (source_id, week_start);
CREATE INDEX IF NOT EXISTS idx_aliases_text          ON aliases (alias_text);
"""

INITIAL_DATA = """
-- 初期ソースマスタ
INSERT OR IGNORE INTO sources (name, source_type, region, notes) VALUES
    ('google_trends', 'search',   'jp', 'Google Trends / pytrends'),
    ('amazon_jp',     'ec',       'jp', 'Amazon.co.jp（手動CSV or PA-API）'),
    ('rakuten',       'ec',       'jp', '楽天市場API'),
    ('youtube',       'sns',      'jp', 'YouTube Data API v3'),
    ('instagram',     'sns',      'global', 'Instagram Graph API'),
    ('media_manual',  'media',    'jp', '業界メディア手動入力'),
    ('internal',      'internal', 'jp', '自社引き合いデータ（社内専用）'),
    ('mock',          'mock',     'jp', 'モックデータ（開発・テスト用）');

-- 初期カテゴリ（有酸素系）
INSERT OR IGNORE INTO categories (name, name_ja, use_type) VALUES
    ('cardio',             '有酸素系全般',      'both'),
    ('treadmill',          'トレッドミル',       'both'),
    ('bike',               'バイク・エルゴメーター', 'both'),
    ('rowing',             'ローイングマシン',   'both'),
    ('elliptical',         'クロストレーナー',   'both'),
    ('strength',           '筋力系全般',        'both'),
    ('smith_machine',      'スミスマシン',       'commercial'),
    ('cable_machine',      'ケーブルマシン',     'commercial'),
    ('leg_press',          'レッグプレス',       'commercial'),
    ('chest_press',        'チェストプレス',     'commercial'),
    ('functional_trainer', 'ファンクショナルトレーナー', 'commercial');

-- 有酸素系に親カテゴリを設定
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE name = 'cardio')
    WHERE name IN ('treadmill', 'bike', 'rowing', 'elliptical');
UPDATE categories SET parent_id = (SELECT id FROM categories WHERE name = 'strength')
    WHERE name IN ('smith_machine', 'cable_machine', 'leg_press', 'chest_press', 'functional_trainer');

-- 初期ブランドマスタ（主要業務用メーカー）
INSERT OR IGNORE INTO brands (name, name_ja, country, market_type) VALUES
    ('TECHNOGYM',     'テクノジム',         'IT', 'commercial'),
    ('Life Fitness',  'ライフフィットネス', 'US', 'both'),
    ('Precor',        'プレコー',           'US', 'commercial'),
    ('Matrix',        'マトリックス',       'TW', 'both'),
    ('CYBEX',         'サイベックス',       'US', 'commercial'),
    ('Panatta',       'パナッタ',           'IT', 'commercial'),
    ('BH Fitness',    'BHフィットネス',     'ES', 'both'),
    ('JOHNSON',       'ジョンソン',         'TW', 'both');

-- 初期別名（aliases）
INSERT OR IGNORE INTO aliases (alias_text, entity_type, brand_id) VALUES
    ('TECHNOGYM',      'brand', (SELECT id FROM brands WHERE name = 'TECHNOGYM')),
    ('テクノジム',      'brand', (SELECT id FROM brands WHERE name = 'TECHNOGYM')),
    ('technogym',      'brand', (SELECT id FROM brands WHERE name = 'TECHNOGYM')),
    ('Life Fitness',   'brand', (SELECT id FROM brands WHERE name = 'Life Fitness')),
    ('ライフフィットネス', 'brand', (SELECT id FROM brands WHERE name = 'Life Fitness')),
    ('life fitness',   'brand', (SELECT id FROM brands WHERE name = 'Life Fitness')),
    ('Matrix',         'brand', (SELECT id FROM brands WHERE name = 'Matrix')),
    ('マトリックス',    'brand', (SELECT id FROM brands WHERE name = 'Matrix')),
    ('matrix fitness', 'brand', (SELECT id FROM brands WHERE name = 'Matrix'));
"""


def init_db(db_path: str) -> None:
    path = Path(db_path)
    path.parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(path)
    try:
        conn.executescript(DDL)
        conn.executescript(INITIAL_DATA)
        conn.commit()
        print(f"[OK] DB initialized: {path.resolve()}")
    finally:
        conn.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="SQLite DB 初期化スクリプト")
    parser.add_argument("--db-path", default="data/db/trend.db", help="DB ファイルパス")
    args = parser.parse_args()
    init_db(args.db_path)
