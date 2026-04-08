"""
import_csv.py — CSVインポータ

data/import/*.csv を読み込み、正規化して source_metrics に投入する。
未解決行は unclassified_queue に保留。
レビューが必要な行は data/review/ にCSVで書き出す。

CSV仕様:
  必須列: collected_date, source_name, metric_type, metric_value
  任意列: raw_brand, raw_category, raw_name, region, note
  (raw_brand/raw_name/raw_category のどれか1つ以上が必要)

使い方:
    python scripts/import_csv.py --file data/import/sample_metrics.csv
    python scripts/import_csv.py --file data/import/sample_metrics.csv --dry-run
    python scripts/import_csv.py --file data/import/sample_metrics.csv --strict
    python scripts/import_csv.py --file data/import/sample_metrics.csv --skip-unresolved
    python scripts/import_csv.py --file data/import/sample_metrics.csv --only-commercial
"""

import argparse
import csv
import io
import json
import sqlite3
import sys
from datetime import datetime, date, timedelta
from pathlib import Path

if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if sys.stderr.encoding != "utf-8":
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

ROOT = Path(__file__).parent.parent
DEFAULT_DB   = ROOT / "data" / "db" / "trend.db"
MASTER_DIR   = ROOT / "data" / "master"
REVIEW_DIR   = ROOT / "data" / "review"

# src パッケージを PATH に追加
sys.path.insert(0, str(ROOT))

# 受け付ける metric_type の正規化マップ
METRIC_TYPE_MAP = {
    "search_volume":   "search_volume",
    "search":          "search_volume",
    "検索ボリューム":   "search_volume",
    "mention_count":   "mention_count",
    "mention":         "mention_count",
    "言及数":          "mention_count",
    "review_count":    "review_count",
    "review":          "review_count",
    "レビュー数":       "review_count",
    "avg_rating":      "avg_rating",
    "rating":          "avg_rating",
    "評価":            "avg_rating",
    "media_count":     "media_count",
    "media":           "media_count",
    "メディア掲載":     "media_count",
    "inquiry_count":   "inquiry_count",
    "inquiry":         "inquiry_count",
    "問い合わせ":       "inquiry_count",
}

REQUIRED_COLS  = {"collected_date", "source_name", "metric_type", "metric_value"}
OPTIONAL_COLS  = {"raw_brand", "raw_category", "raw_name", "region", "note",
                  "source_url", "country", "language"}


# -------------------------------------------------------------------------
# レビュー行を表すデータクラス
# -------------------------------------------------------------------------

class ReviewRow:
    """レビューが必要な1行"""
    def __init__(self, row_num: int, raw: dict, reason: str,
                 certainty_label: str = "unknown",
                 norm_brand: str = None, norm_model: str = None,
                 norm_category: str = None, use_type: str = "unknown"):
        self.row_num        = row_num
        self.raw            = raw
        self.reason         = reason
        self.certainty_label = certainty_label
        self.norm_brand     = norm_brand
        self.norm_model     = norm_model
        self.norm_category  = norm_category
        self.use_type       = use_type


# -------------------------------------------------------------------------
# バリデーション
# -------------------------------------------------------------------------

def _date_to_week_start(date_str: str) -> str:
    """
    YYYY-MM-DD を週の月曜日（ISO 8601 週初）に変換する。
    例: 2026-04-09 (木) → 2026-04-06 (月)
    """
    d = date.fromisoformat(date_str.strip())
    monday = d - timedelta(days=d.weekday())
    return monday.isoformat()


def validate_row(row: dict, row_num: int) -> tuple[bool, str]:
    """行を検証。(is_valid, error_message) を返す"""
    # 必須列チェック
    for col in REQUIRED_COLS:
        if not row.get(col, "").strip():
            return False, f"必須列 '{col}' が空"

    # metric_value が数値か
    try:
        float(row["metric_value"])
    except ValueError:
        return False, f"metric_value が数値でない: '{row['metric_value']}'"

    # collected_date が日付形式か
    try:
        date.fromisoformat(row["collected_date"].strip())
    except ValueError:
        return False, f"collected_date の形式が不正: '{row['collected_date']}'"

    # raw_brand / raw_name / raw_category のどれかが必要
    has_target = any(row.get(k, "").strip() for k in ("raw_brand", "raw_name", "raw_category"))
    if not has_target:
        return False, "raw_brand / raw_name / raw_category がすべて空"

    return True, ""


def normalize_metric_type(raw: str) -> tuple[str | None, str]:
    """metric_type を正規化。(正規化後, reason) を返す"""
    key = raw.strip().lower()
    normalized = METRIC_TYPE_MAP.get(key)
    if normalized:
        return normalized, ""
    return None, f"未知の metric_type: '{raw}'"


# -------------------------------------------------------------------------
# DBアクセスヘルパー
# -------------------------------------------------------------------------

def _get_or_create_source(conn: sqlite3.Connection, source_name: str) -> int:
    """sources テーブルから source_id を取得。なければ自動登録。"""
    row = conn.execute("SELECT id FROM sources WHERE name = ?", (source_name,)).fetchone()
    if row:
        return row[0]
    conn.execute(
        "INSERT INTO sources (name, source_type, region, notes) VALUES (?, 'manual', 'jp', 'CSV手動取込')",
        (source_name,)
    )
    return conn.execute("SELECT last_insert_rowid()").fetchone()[0]


def _get_model_id(conn: sqlite3.Connection, brand: str, model: str) -> int | None:
    row = conn.execute(
        "SELECT m.id FROM models m JOIN brands b ON m.brand_id = b.id WHERE b.name = ? AND m.name = ?",
        (brand, model)
    ).fetchone()
    return row[0] if row else None


def _get_brand_id(conn: sqlite3.Connection, brand: str) -> int | None:
    row = conn.execute("SELECT id FROM brands WHERE name = ?", (brand,)).fetchone()
    return row[0] if row else None


def _is_discontinued(conn: sqlite3.Connection, model_id: int) -> bool:
    row = conn.execute("SELECT discontinued FROM models WHERE id = ?", (model_id,)).fetchone()
    return bool(row and row[0])


def _check_duplicate(conn: sqlite3.Connection, source_id: int, model_id: int | None,
                     brand_id: int | None, week_start: str, metric_type: str) -> bool:
    """既存レコードとの重複チェック"""
    row = conn.execute(
        """SELECT id FROM source_metrics
           WHERE source_id = ? AND metric_type = ? AND week_start = ?
             AND (model_id IS ? OR (model_id IS NULL AND ? IS NULL))
             AND (brand_id IS ? OR (brand_id IS NULL AND ? IS NULL))""",
        (source_id, metric_type, week_start,
         model_id, model_id, brand_id, brand_id)
    ).fetchone()
    return row is not None


# -------------------------------------------------------------------------
# メイン: インポート処理
# -------------------------------------------------------------------------

def run_import(
    csv_path: Path,
    db_path: Path,
    dry_run: bool,
    strict: bool,
    skip_unresolved: bool,
    only_commercial: bool,
) -> None:
    from src.normalizer.engine import NormalizerEngine

    print(f"[IMPORT] {csv_path.name}")
    print(f"  dry_run={dry_run}  strict={strict}  skip_unresolved={skip_unresolved}  only_commercial={only_commercial}")

    # 正規化エンジン構築
    engine = NormalizerEngine.from_master_dir(MASTER_DIR)

    # バッチID
    now = datetime.now()
    batch_id = f"{now.strftime('%Y%m%d_%H%M%S')}_{csv_path.stem}"

    # 週の月曜日→week_startを収集日から計算
    # CSV読み込み
    with open(csv_path, encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    # カラム存在チェック
    if not rows:
        print("[WARN] CSVが空です")
        return

    header = set(rows[0].keys())
    missing = REQUIRED_COLS - header
    if missing:
        print(f"[ERROR] 必須列が不足: {missing}", file=sys.stderr)
        sys.exit(1)

    unknown_cols = header - REQUIRED_COLS - OPTIONAL_COLS
    if unknown_cols:
        print(f"[WARN] 未定義の列（無視します）: {unknown_cols}")

    # --- カウンター ---
    cnt_total = len(rows)
    cnt_ok = cnt_review = cnt_skipped = cnt_error = 0
    review_rows: list[ReviewRow] = []

    # DB接続（dry_runの場合は後でロールバック）
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA foreign_keys = ON")

    try:
        # バッチレコード挿入（dry_runも記録してロールバック）
        conn.execute(
            """INSERT INTO import_batches (batch_id, file_name, is_dry_run)
               VALUES (?, ?, ?)""",
            (batch_id, csv_path.name, 1 if dry_run else 0)
        )
        batch_db_id = conn.execute("SELECT last_insert_rowid()").fetchone()[0]

        for row_num, row in enumerate(rows, start=2):  # ヘッダを1行目とするため2始まり
            # --- 1. バリデーション ---
            is_valid, err_msg = validate_row(row, row_num)
            if not is_valid:
                cnt_error += 1
                print(f"  [行{row_num}] ERROR: {err_msg}")
                if strict:
                    raise ValueError(f"strict モードで行{row_num}がエラー: {err_msg}")
                continue

            # --- 2. metric_type 正規化 ---
            norm_metric, metric_err = normalize_metric_type(row["metric_type"])
            if not norm_metric:
                cnt_error += 1
                print(f"  [行{row_num}] ERROR: {metric_err}")
                if strict:
                    raise ValueError(metric_err)
                continue

            # --- 3. week_start 計算 ---
            week_start = _date_to_week_start(row["collected_date"])

            # --- 4. 正規化エンジンに通す ---
            # raw_name が「ブランド名 + モデル名」の複合形なら raw_name を優先する。
            # raw_name が空の場合のみ raw_brand を使う。
            # raw_brand と raw_name を単純連結するとブランドが重複するケースがあるため。
            raw_name  = row.get("raw_name", "").strip()
            raw_brand = row.get("raw_brand", "").strip()
            raw_cat   = row.get("raw_category", "").strip()
            if raw_name:
                raw_text = raw_name
            elif raw_brand:
                raw_text = raw_brand
            else:
                raw_text = raw_cat

            # raw_brand を hint として渡す（raw_name だけではブランドが解決できない場合の補完）
            # 例: raw_name="TRM445" raw_brand="Precor" → Precor のヒントを渡してモデル解決精度を上げる
            brand_hint_raw = raw_brand if raw_brand and raw_text != raw_brand else None
            norm = engine.normalize(raw_text, hint_brand=brand_hint_raw)

            # --- 5. use_type フィルタ ---
            if only_commercial and norm.use_type == "consumer":
                cnt_skipped += 1
                review_rows.append(ReviewRow(
                    row_num, row,
                    reason="家庭用ブランド（--only-commercial で除外）",
                    certainty_label=norm.certainty_label,
                    norm_brand=norm.canonical_brand,
                    use_type=norm.use_type,
                ))
                print(f"  [行{row_num}] SKIP: 家庭用 ({norm.canonical_brand})")
                continue

            # --- 6. unresolved 判定 ---
            is_review = False
            review_reason = None

            if norm.is_unresolved:
                is_review = True
                review_reason = norm.unresolved_reason or "正規化不能"
            elif norm.certainty_label in ("low", "unknown"):
                is_review = True
                review_reason = f"信頼度 {norm.certainty_label}（{norm.confidence}）"
            elif norm.canonical_brand and _get_brand_id(conn, norm.canonical_brand) is None:
                is_review = True
                review_reason = f"ブランド '{norm.canonical_brand}' がDBに未登録"

            if is_review:
                if skip_unresolved:
                    cnt_skipped += 1
                    print(f"  [行{row_num}] SKIP(unresolved): {review_reason}")
                else:
                    cnt_review += 1
                    review_rows.append(ReviewRow(
                        row_num, row, review_reason,
                        certainty_label=str(norm.certainty_label),
                        norm_brand=norm.canonical_brand,
                        norm_model=norm.canonical_model,
                        norm_category=norm.canonical_category,
                        use_type=norm.use_type,
                    ))
                    # unclassified_queue に登録
                    if not dry_run:
                        source_id_for_queue = _get_or_create_source(conn, row.get("source_name", "unknown"))
                        conn.execute("""
                            INSERT INTO unclassified_queue
                                (raw_text, source_id, context, status,
                                 import_batch_id, raw_brand, raw_category, raw_name,
                                 certainty_label, unresolved_reason,
                                 metric_type, metric_value, week_start, file_row_num)
                            VALUES (?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            raw_text,
                            source_id_for_queue,
                            str(csv_path),
                            batch_db_id,
                            row.get("raw_brand", ""),
                            row.get("raw_category", ""),
                            row.get("raw_name", ""),
                            str(norm.certainty_label),
                            review_reason,
                            norm_metric,
                            float(row["metric_value"]),
                            week_start,
                            row_num,
                        ))
                    print(f"  [行{row_num}] REVIEW: {review_reason}")
                continue

            # --- 7. model_id / brand_id 取得 ---
            model_id = None
            brand_id = _get_brand_id(conn, norm.canonical_brand) if norm.canonical_brand else None

            if norm.canonical_brand and norm.canonical_model:
                model_id = _get_model_id(conn, norm.canonical_brand, norm.canonical_model)

            # discontinued チェック
            if model_id and _is_discontinued(conn, model_id):
                cnt_review += 1
                review_rows.append(ReviewRow(
                    row_num, row,
                    reason=f"廃番モデル: {norm.canonical_brand} {norm.canonical_model}",
                    certainty_label=str(norm.certainty_label),
                    norm_brand=norm.canonical_brand,
                    norm_model=norm.canonical_model,
                ))
                print(f"  [行{row_num}] REVIEW(discontinued): {norm.canonical_brand} {norm.canonical_model}")
                if not dry_run:
                    conn.execute("""
                        INSERT INTO unclassified_queue
                            (raw_text, status, import_batch_id, raw_brand, raw_name,
                             unresolved_reason, metric_type, metric_value, week_start, file_row_num)
                        VALUES (?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        raw_text, batch_db_id,
                        row.get("raw_brand", ""), row.get("raw_name", ""),
                        f"廃番モデル: {norm.canonical_model}",
                        norm_metric, float(row["metric_value"]), week_start, row_num,
                    ))
                continue

            # --- 8. source_id 取得 ---
            source_name_raw = row.get("source_name", "").strip().lower()
            source_id = _get_or_create_source(conn, source_name_raw)

            # --- 9. 重複チェック ---
            if not dry_run and _check_duplicate(conn, source_id, model_id, brand_id, week_start, norm_metric):
                cnt_skipped += 1
                print(f"  [行{row_num}] SKIP(重複): {norm.canonical_brand} {norm.canonical_model} {week_start} {norm_metric}")
                continue

            # --- 10. source_metrics 投入 ---
            raw_input_json = json.dumps(dict(row), ensure_ascii=False)
            if not dry_run:
                conn.execute("""
                    INSERT OR IGNORE INTO source_metrics
                        (source_id, model_id, brand_id, week_start, metric_type,
                         value, is_estimated, raw_data,
                         import_batch_id, raw_input, imported_at, review_status)
                    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, datetime('now'), 'ok')
                """, (
                    source_id,
                    model_id,
                    brand_id,
                    week_start,
                    norm_metric,
                    float(row["metric_value"]),
                    raw_input_json,
                    batch_db_id,
                    raw_input_json,
                ))

            brand_label = norm.canonical_brand or "(brand?)"
            model_label = norm.canonical_model or "(model?)"
            cnt_ok += 1
            print(f"  [行{row_num}] OK: {brand_label} / {model_label} | {norm_metric}={row['metric_value']} | {week_start}")

        # --- バッチレコード更新 ---
        conn.execute("""
            UPDATE import_batches
            SET rows_total=?, rows_ok=?, rows_review=?, rows_skipped=?, rows_error=?
            WHERE id=?
        """, (cnt_total, cnt_ok, cnt_review, cnt_skipped, cnt_error, batch_db_id))

        if dry_run:
            conn.rollback()
            print(f"\n[DRY RUN] ロールバック済み")
        else:
            conn.commit()

    except Exception as e:
        conn.rollback()
        print(f"\n[ERROR] ロールバック: {e}", file=sys.stderr)
        raise
    finally:
        conn.close()

    # --- レビューCSV書き出し ---
    if review_rows:
        _write_review_csv(review_rows, csv_path, batch_id, dry_run)

    # --- サマリー ---
    mode = "[DRY RUN]" if dry_run else "[IMPORT]"
    print(f"\n{mode} 完了: batch_id={batch_id}")
    print(f"  合計={cnt_total}  OK={cnt_ok}  レビュー={cnt_review}  スキップ={cnt_skipped}  エラー={cnt_error}")
    if review_rows:
        print(f"  → data/review/{batch_id}_review.csv に {len(review_rows)} 件保存")


def _write_review_csv(review_rows: list[ReviewRow], src_path: Path,
                      batch_id: str, dry_run: bool) -> None:
    REVIEW_DIR.mkdir(parents=True, exist_ok=True)
    out_path = REVIEW_DIR / f"{batch_id}_review.csv"

    fieldnames = [
        "file_row_num", "review_reason", "certainty_label", "use_type",
        "norm_brand", "norm_model", "norm_category",
        "collected_date", "source_name", "raw_brand", "raw_category",
        "raw_name", "metric_type", "metric_value", "region", "note",
        "action",
    ]
    with open(out_path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for rv in review_rows:
            out = {
                "file_row_num":    rv.row_num,
                "review_reason":   rv.reason,
                "certainty_label": rv.certainty_label,
                "use_type":        rv.use_type,
                "norm_brand":      rv.norm_brand or "",
                "norm_model":      rv.norm_model or "",
                "norm_category":   rv.norm_category or "",
                "action":          "",  # 人が記入: ok / ignore / remap:BRAND::MODEL
            }
            out.update(rv.raw)
            writer.writerow(out)

    if not dry_run:
        print(f"  [REVIEW CSV] {out_path}")


# -------------------------------------------------------------------------
# CLI
# -------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="CSVインポータ — source_metrics 投入")
    parser.add_argument("--file",             required=True,          help="取り込むCSVファイルパス")
    parser.add_argument("--db-path",          default=str(DEFAULT_DB),help="DBパス")
    parser.add_argument("--dry-run",          action="store_true",    help="DBに書かず投入件数のみ確認")
    parser.add_argument("--strict",           action="store_true",    help="エラー行で即停止")
    parser.add_argument("--skip-unresolved",  action="store_true",    help="未解決行をキューに入れず完全スキップ")
    parser.add_argument("--only-commercial",  action="store_true",    help="家庭用（consumer）ブランドを除外")
    args = parser.parse_args()

    run_import(
        csv_path=Path(args.file),
        db_path=Path(args.db_path),
        dry_run=args.dry_run,
        strict=args.strict,
        skip_unresolved=args.skip_unresolved,
        only_commercial=args.only_commercial,
    )
