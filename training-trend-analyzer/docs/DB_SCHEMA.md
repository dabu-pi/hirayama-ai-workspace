# DB_SCHEMA.md — データベーステーブル設計

最終更新: 2026-04-08
DB: SQLite（MVP）→ PostgreSQL（公開版）

---

## テーブル一覧

| テーブル名 | 役割 |
|---|---|
| brands | ブランドマスタ |
| categories | カテゴリマスタ |
| models | 機種マスタ |
| aliases | ブランド・機種の別名・表記ゆれ辞書 |
| sources | データソースマスタ |
| source_metrics | ソース別・週次の生指標値 |
| trend_scores | 合成トレンドスコア・変化率・ランクラベル |
| unclassified_queue | 未正規化の生テキストキュー |
| batch_logs | バッチ実行ログ |

---

## brands（ブランドマスタ）

```sql
CREATE TABLE brands (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL UNIQUE,       -- 正規ブランド名（英語表記を基本とする）
    name_ja      TEXT,                           -- 日本語表記
    country      TEXT,                           -- 本社所在国（ISO 3166-1 alpha-2）
    market_type  TEXT    NOT NULL                -- 'commercial'（業務用）/ 'consumer'（家庭用）/ 'both'
                 DEFAULT 'commercial',
    website_url  TEXT,
    notes        TEXT,
    is_active    INTEGER NOT NULL DEFAULT 1,     -- 0: 廃業・非アクティブ
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

**補足:**
- `market_type` で業務用/家庭用を分類。`both` は両方展開しているブランド
- `is_active = 0` は廃業ブランド（データ履歴は保持）

---

## categories（カテゴリマスタ）

```sql
CREATE TABLE categories (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL UNIQUE,        -- 例: 'treadmill', 'cable_machine', 'smith_machine'
    name_ja      TEXT,                           -- 例: 'トレッドミル', 'ケーブルマシン'
    parent_id    INTEGER REFERENCES categories(id), -- 親カテゴリ（階層構造対応）
    use_type     TEXT    NOT NULL                -- 'commercial' / 'consumer' / 'both'
                 DEFAULT 'both',
    notes        TEXT,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

**カテゴリ例（初期データ）:**
```
有酸素系
  ├── treadmill（トレッドミル）
  ├── bike（バイク・エルゴメーター）
  ├── rowing（ローイングマシン）
  └── elliptical（クロストレーナー）
筋力系
  ├── smith_machine（スミスマシン）
  ├── cable_machine（ケーブルマシン）
  ├── leg_press（レッグプレス）
  ├── chest_press（チェストプレス）
  └── functional_trainer（ファンクショナルトレーナー）
```

---

## models（機種マスタ）

```sql
CREATE TABLE models (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    brand_id         INTEGER NOT NULL REFERENCES brands(id),
    category_id      INTEGER NOT NULL REFERENCES categories(id),
    name             TEXT    NOT NULL,           -- 正規機種名
    model_number     TEXT,                       -- 型番（例: T100, E-CF300）
    use_type         TEXT    NOT NULL            -- 'commercial' / 'consumer'
                     DEFAULT 'commercial',
    release_year     INTEGER,                    -- 発売年
    discontinued     INTEGER NOT NULL DEFAULT 0, -- 1: 廃番
    parent_model_id  INTEGER REFERENCES models(id), -- バリエーション親機種
    notes            TEXT,
    is_active        INTEGER NOT NULL DEFAULT 1,
    created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at       TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (brand_id, name)
);
```

**補足:**
- `parent_model_id` でバリエーション（色違い・仕様違い）を親機種に紐付け
- `discontinued = 1` でも `source_metrics` の履歴は保持

---

## aliases（別名・表記ゆれ辞書）

```sql
CREATE TABLE aliases (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    alias_text     TEXT    NOT NULL UNIQUE,      -- 別名テキスト（正規化前処理済み）
    entity_type    TEXT    NOT NULL,             -- 'brand' または 'model'
    brand_id       INTEGER REFERENCES brands(id),
    model_id       INTEGER REFERENCES models(id),
    source         TEXT,                         -- どこで見つけた別名か（例: 'amazon', 'instagram'）
    confidence     REAL    NOT NULL DEFAULT 1.0, -- マッチング信頼度 0〜1
    created_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

**aliases の例:**
```
alias_text         entity_type  brand_id  model_id
"テクノジム"        brand        1         NULL
"TECHNOGYM"        brand        1         NULL      ← 正規名称も登録
"T100"             model        NULL      5
"Treadmill T100"   model        NULL      5
"ライフフィットネス" brand        3         NULL
```

---

## sources（データソースマスタ）

```sql
CREATE TABLE sources (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    name         TEXT    NOT NULL UNIQUE,        -- 例: 'google_trends', 'amazon_jp', 'instagram'
    source_type  TEXT    NOT NULL,               -- 'search', 'ec', 'sns', 'media', 'internal'
    region       TEXT    NOT NULL DEFAULT 'jp',  -- 'jp' / 'global'
    is_active    INTEGER NOT NULL DEFAULT 1,
    notes        TEXT,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

---

## source_metrics（ソース別・週次の生指標値）

```sql
CREATE TABLE source_metrics (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id      INTEGER NOT NULL REFERENCES sources(id),
    model_id       INTEGER REFERENCES models(id),
    brand_id       INTEGER REFERENCES brands(id),  -- ブランド単位のメトリクス用
    week_start     TEXT    NOT NULL,               -- ISO 8601 週初（月曜日）例: '2026-03-30'
    metric_type    TEXT    NOT NULL,               -- 'search_volume', 'mention_count', 'review_count', 'rating', etc.
    value          REAL,                           -- 指標値（NULL = データ欠損）
    value_prev     REAL,                           -- 前週値（計算用キャッシュ）
    sample_size    INTEGER,                        -- サンプル数（信頼性の参考）
    is_estimated   INTEGER NOT NULL DEFAULT 0,     -- 1: 推定値・補完値
    raw_data       TEXT,                           -- 生データJSON（デバッグ・再計算用）
    collected_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (source_id, model_id, brand_id, week_start, metric_type)
);
```

**metric_type の候補:**
```
search_volume     Google Trends の相対検索ボリューム（0〜100）
mention_count     SNS 言及数
review_count      EC レビュー件数
avg_rating        EC 平均評価（1〜5）
media_count       メディア掲載回数
inquiry_count     自社問い合わせ数（社内用）
price_index       価格指数
```

---

## trend_scores（合成トレンドスコア）

```sql
CREATE TABLE trend_scores (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    model_id        INTEGER NOT NULL REFERENCES models(id),
    week_start      TEXT    NOT NULL,            -- ISO 8601 週初
    score           REAL,                        -- 合成トレンドスコア 0〜100
    score_prev      REAL,                        -- 前週スコア
    change_rate     REAL,                        -- 変化率（%）
    rank_label      TEXT,                        -- 'rising_fast' / 'rising' / 'stable' / 'falling' / 'falling_fast'
    rank_in_all     INTEGER,                     -- 全体ランキング順位
    rank_in_cat     INTEGER,                     -- カテゴリ内ランキング順位
    score_version   TEXT    NOT NULL DEFAULT '1.0', -- スコア計算バージョン
    weights_snapshot TEXT,                       -- 計算時の重みJSONスナップショット
    missing_sources TEXT,                        -- 欠損ソースのJSON配列
    calculated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    UNIQUE (model_id, week_start, score_version)
);
```

---

## unclassified_queue（未正規化キュー）

```sql
CREATE TABLE unclassified_queue (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    raw_text     TEXT    NOT NULL,               -- 正規化できなかった生テキスト
    source_id    INTEGER REFERENCES sources(id),
    context      TEXT,                           -- どの文脈で見つかったか（URL等）
    status       TEXT    NOT NULL DEFAULT 'pending', -- 'pending' / 'resolved' / 'ignored'
    resolved_to  TEXT,                           -- 解決後の紐付け先（brand_id / model_id）
    notes        TEXT,
    created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
    resolved_at  TEXT
);
```

---

## batch_logs（バッチ実行ログ）

```sql
CREATE TABLE batch_logs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_type      TEXT    NOT NULL,            -- 'collect' / 'normalize' / 'score' / 'full'
    week_start      TEXT,
    status          TEXT    NOT NULL,            -- 'success' / 'partial' / 'failed'
    records_input   INTEGER,
    records_output  INTEGER,
    errors_count    INTEGER NOT NULL DEFAULT 0,
    error_detail    TEXT,                        -- エラーサマリJSON
    started_at      TEXT    NOT NULL,
    finished_at     TEXT
);
```

---

## インデックス（パフォーマンス最適化）

```sql
-- 週次ランキング取得
CREATE INDEX idx_trend_scores_week ON trend_scores (week_start, rank_in_all);
CREATE INDEX idx_trend_scores_model_week ON trend_scores (model_id, week_start);

-- ソース別・機種別の指標検索
CREATE INDEX idx_source_metrics_model_week ON source_metrics (model_id, week_start);
CREATE INDEX idx_source_metrics_source_week ON source_metrics (source_id, week_start);

-- 別名検索
CREATE INDEX idx_aliases_text ON aliases (alias_text);
```

---

## ERD（概念図）

```
brands ──┐
         ├── models ──┬── source_metrics ──── sources
categories─┘           │       └──────────── batch_logs
                        └── trend_scores
                        └── aliases (brand または model に紐付く)
                        └── unclassified_queue
```
