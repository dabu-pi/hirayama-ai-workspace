"""
db.py — DBコレクター

source_metrics テーブルから指標を読み込み RawMetric リストを返す。
import_csv.py で投入した実データを run_batch.py に供給する。
"""

import sqlite3
from datetime import date, timedelta
from pathlib import Path

from .base import BaseCollector, CollectResult, RawMetric


class DbCollector(BaseCollector):
    """
    SQLite の source_metrics テーブルから指標を収集するコレクター。

    Args:
        db_path: trend.db のパス
        no_discontinued: True の場合、廃番モデルを除外する
        only_commercial: True の場合、家庭用（consumer）ブランドを除外する
    """

    def __init__(
        self,
        db_path: Path,
        no_discontinued: bool = False,
        only_commercial: bool = False,
    ):
        super().__init__("db")
        self.db_path = db_path
        self.no_discontinued = no_discontinued
        self.only_commercial = only_commercial

    def collect(self, keywords: list[str], week_start: str) -> CollectResult:
        result = CollectResult(source_name="db")

        # 前週の月曜日を計算（value_prev 用）
        w = date.fromisoformat(week_start)
        prev_week = (w - timedelta(weeks=1)).isoformat()

        try:
            conn = sqlite3.connect(self.db_path)
            conn.row_factory = sqlite3.Row

            # 当週の指標 ---------------------------------------------------
            current_rows = self._fetch_week(conn, week_start)
            prev_rows    = self._fetch_week(conn, prev_week)
            conn.close()

            # 前週値を辞書化: {(brand, model, metric_type): value}
            prev_map: dict[tuple, float] = {}
            for r in prev_rows:
                key = (r["brand_name"], r["model_name"], r["metric_type"])
                prev_map[key] = r["value"]

            for r in current_rows:
                brand = r["brand_name"] or ""
                model = r["model_name"] or ""
                cat   = r["cat_name"]   or "unknown"

                key = (brand, model, r["metric_type"])
                metric = RawMetric(
                    source_name   = r["source_name"] or "db",
                    brand_name    = brand,
                    model_name    = model,
                    category_name = cat,
                    week_start    = week_start,
                    metric_type   = r["metric_type"],
                    value         = r["value"],
                    value_prev    = prev_map.get(key),
                    is_estimated  = bool(r["is_estimated"]),
                    raw_data      = r["raw_input"],
                )
                result.metrics.append(metric)

        except Exception as e:
            result.errors.append(str(e))

        return result

    def _fetch_week(self, conn: sqlite3.Connection, week_start: str) -> list:
        """指定週の source_metrics 行を取得する"""
        filters = ["sm.week_start = ?", "sm.review_status = 'ok'"]
        params: list = [week_start]

        if self.no_discontinued:
            filters.append("(mo.discontinued IS NULL OR mo.discontinued = 0)")
        if self.only_commercial:
            filters.append("(b.market_type IS NULL OR b.market_type != 'consumer')")

        where = " AND ".join(filters)
        sql = f"""
            SELECT
                sm.metric_type,
                sm.value,
                sm.is_estimated,
                sm.raw_input,
                COALESCE(b.name, '')  AS brand_name,
                COALESCE(mo.name, '') AS model_name,
                COALESCE(c.name, '')  AS cat_name,
                s.name                AS source_name
            FROM source_metrics sm
            LEFT JOIN brands     b  ON sm.brand_id  = b.id
            LEFT JOIN models     mo ON sm.model_id  = mo.id
            LEFT JOIN categories c  ON mo.category_id = c.id
            LEFT JOIN sources    s  ON sm.source_id = s.id
            WHERE {where}
        """
        return conn.execute(sql, params).fetchall()
