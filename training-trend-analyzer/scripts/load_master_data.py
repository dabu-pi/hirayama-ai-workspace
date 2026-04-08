"""
load_master_data.py — マスタデータ投入スクリプト

data/master/*.json を読み込んで DB に投入する。
冪等性あり（既存レコードは SKIP）。DB を壊しにくい設計。

使い方:
    python scripts/load_master_data.py
    python scripts/load_master_data.py --db-path data/db/trend.db
    python scripts/load_master_data.py --only brands
    python scripts/load_master_data.py --only categories
    python scripts/load_master_data.py --only models
    python scripts/load_master_data.py --only aliases
    python scripts/load_master_data.py --dry-run   # DBに書かず件数だけ表示
"""

import argparse
import io
import json
import sqlite3
import sys
from pathlib import Path

# Windows端末の文字化け対策
if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if sys.stderr.encoding != "utf-8":
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

MASTER_DIR = Path(__file__).parent.parent / "data" / "master"
DEFAULT_DB  = Path(__file__).parent.parent / "data" / "db" / "trend.db"


def load_json(path: Path) -> list:
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    # _comment / _version 等のメタ行を除去
    return [row for row in data if not any(k.startswith("_") for k in row.keys())]


def load_brands(conn: sqlite3.Connection, dry_run: bool) -> dict[str, int]:
    """brands.json を投入し、{canonical_name: id} を返す"""
    path = MASTER_DIR / "brands.json"
    if not path.exists():
        print(f"  [SKIP] {path} not found")
        return {}

    rows = load_json(path)
    inserted = skipped = 0
    brand_ids: dict[str, int] = {}

    for row in rows:
        name = row["canonical_name"]
        if not dry_run:
            try:
                conn.execute("""
                    INSERT INTO brands (name, name_ja, country, market_type, website_url, notes, is_active)
                    VALUES (?, ?, ?, ?, ?, ?, 1)
                """, (
                    name,
                    row.get("name_ja"),
                    row.get("country"),
                    row.get("market_type", "commercial"),
                    row.get("website_url"),
                    row.get("notes"),
                ))
                inserted += 1
            except sqlite3.IntegrityError:
                skipped += 1
            # ID を取得（既存・新規とも）
            cur = conn.execute("SELECT id FROM brands WHERE name = ?", (name,))
            row_db = cur.fetchone()
            if row_db:
                brand_ids[name] = row_db[0]
        else:
            inserted += 1

    print(f"  brands: inserted={inserted}, skipped={skipped} (total={len(rows)})")
    return brand_ids


def load_categories(conn: sqlite3.Connection, dry_run: bool) -> dict[str, int]:
    """categories.json を投入。parent は名前で紐付ける。"""
    path = MASTER_DIR / "categories.json"
    if not path.exists():
        print(f"  [SKIP] {path} not found")
        return {}

    rows = load_json(path)
    inserted = skipped = 0
    cat_ids: dict[str, int] = {}

    # 2パス: 1パス目は parent=null だけ挿入、2パス目は parent あり
    for pass_num in (1, 2):
        for row in rows:
            name = row["canonical_name"]
            parent_name = row.get("parent")

            if pass_num == 1 and parent_name is not None:
                continue
            if pass_num == 2 and parent_name is None:
                continue

            parent_id = cat_ids.get(parent_name) if parent_name else None

            if not dry_run:
                try:
                    conn.execute("""
                        INSERT INTO categories (name, name_ja, parent_id, use_type, notes)
                        VALUES (?, ?, ?, ?, ?)
                    """, (
                        name,
                        row.get("name_ja"),
                        parent_id,
                        row.get("use_type", "both"),
                        row.get("notes"),
                    ))
                    inserted += 1
                except sqlite3.IntegrityError:
                    skipped += 1
                cur = conn.execute("SELECT id FROM categories WHERE name = ?", (name,))
                row_db = cur.fetchone()
                if row_db:
                    cat_ids[name] = row_db[0]
            else:
                cat_ids[name] = -1
                inserted += 1

    print(f"  categories: inserted={inserted}, skipped={skipped} (total={len(rows)})")
    return cat_ids


def load_models(conn: sqlite3.Connection, brand_ids: dict, cat_ids: dict, dry_run: bool) -> dict[str, int]:
    """models.json を投入。brand / category は名前で紐付ける。"""
    path = MASTER_DIR / "models.json"
    if not path.exists():
        print(f"  [SKIP] {path} not found")
        return {}

    rows = load_json(path)
    inserted = skipped = errors = 0
    model_ids: dict[str, int] = {}

    for row in rows:
        name       = row["canonical_name"]
        brand_name = row.get("brand")
        cat_name   = row.get("category")

        brand_id = brand_ids.get(brand_name)
        cat_id   = cat_ids.get(cat_name)

        if brand_id is None:
            print(f"  [WARN] model '{name}': brand '{brand_name}' not found in DB → skip")
            errors += 1
            continue
        if cat_id is None:
            print(f"  [WARN] model '{name}': category '{cat_name}' not found in DB → skip")
            errors += 1
            continue

        if not dry_run:
            try:
                conn.execute("""
                    INSERT INTO models
                        (brand_id, category_id, name, model_number, use_type,
                         release_year, discontinued, notes, is_active)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
                """, (
                    brand_id,
                    cat_id,
                    name,
                    row.get("model_number"),
                    row.get("use_type", "commercial"),
                    row.get("release_year"),
                    1 if row.get("discontinued") else 0,
                    row.get("notes"),
                ))
                inserted += 1
            except sqlite3.IntegrityError:
                skipped += 1
            cur = conn.execute(
                "SELECT id FROM models WHERE brand_id = ? AND name = ?", (brand_id, name)
            )
            row_db = cur.fetchone()
            if row_db:
                model_ids[f"{brand_name}::{name}"] = row_db[0]
        else:
            inserted += 1

    print(f"  models: inserted={inserted}, skipped={skipped}, errors={errors} (total={len(rows)})")
    return model_ids


def load_aliases(conn: sqlite3.Connection, brand_ids: dict, cat_ids: dict, model_ids: dict, dry_run: bool) -> None:
    """aliases.json を投入。brand / model の ID を名前で紐付ける。"""
    path = MASTER_DIR / "aliases.json"
    if not path.exists():
        print(f"  [SKIP] {path} not found")
        return

    rows = [
        row for row in load_json(path)
        if not row.get("alias_text", "").startswith("===")
    ]
    inserted = skipped = errors = 0

    for row in rows:
        alias = row.get("alias_text", "").strip()
        entity_type = row.get("entity_type")
        canonical   = row.get("canonical")
        brand_hint  = row.get("brand")
        confidence  = row.get("confidence", 1.0)
        source      = row.get("source", "manual")

        if not alias or not entity_type or not canonical:
            continue

        brand_id = None
        model_id = None

        if entity_type == "brand":
            brand_id = brand_ids.get(canonical)
            if brand_id is None:
                errors += 1
                continue
        elif entity_type == "category":
            if cat_ids.get(canonical) is None:
                errors += 1
                continue
        elif entity_type == "model":
            key = f"{brand_hint}::{canonical}" if brand_hint else canonical
            model_id = model_ids.get(key)
            if model_id is None:
                errors += 1
                continue
            if brand_hint:
                brand_id = brand_ids.get(brand_hint)

        if not dry_run:
            try:
                conn.execute("""
                    INSERT INTO aliases (alias_text, entity_type, brand_id, model_id, source, confidence)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (alias, entity_type, brand_id, model_id, source, confidence))
                inserted += 1
            except sqlite3.IntegrityError:
                skipped += 1
        else:
            inserted += 1

    print(f"  aliases: inserted={inserted}, skipped={skipped}, errors={errors} (total={len(rows)})")


def run(db_path: Path, only: str | None, dry_run: bool) -> None:
    if dry_run:
        print("[DRY RUN] DBへの書き込みは行いません\n")

    conn = None if dry_run else sqlite3.connect(db_path)
    if conn:
        conn.execute("PRAGMA foreign_keys = ON")

    # dry_run 用のダミー ID マップ（DB なしで件数カウントするため）
    dummy_brand_ids: dict[str, int] = {}
    dummy_cat_ids:   dict[str, int] = {}
    dummy_model_ids: dict[str, int] = {}

    if dry_run:
        # dry_run 時は master JSON から名前だけ読んで仮 ID を割り当てる
        for i, row in enumerate(load_json(MASTER_DIR / "brands.json") if (MASTER_DIR / "brands.json").exists() else []):
            dummy_brand_ids[row["canonical_name"]] = i + 1
        for i, row in enumerate(load_json(MASTER_DIR / "categories.json") if (MASTER_DIR / "categories.json").exists() else []):
            dummy_cat_ids[row["canonical_name"]] = i + 1
        for i, row in enumerate(load_json(MASTER_DIR / "models.json") if (MASTER_DIR / "models.json").exists() else []):
            dummy_model_ids[f"{row.get('brand')}::{row['canonical_name']}"] = i + 1

    try:
        # brands
        if only in (None, "brands"):
            brand_ids = load_brands(conn, dry_run) if not dry_run else (
                _count_dry("brands", MASTER_DIR / "brands.json") or dummy_brand_ids
            )
        else:
            brand_ids = dummy_brand_ids if dry_run else {}
            if conn:
                cur = conn.execute("SELECT name, id FROM brands")
                brand_ids = {r[0]: r[1] for r in cur.fetchall()}

        # categories
        if only in (None, "categories"):
            cat_ids = load_categories(conn, dry_run) if not dry_run else (
                _count_dry("categories", MASTER_DIR / "categories.json") or dummy_cat_ids
            )
        else:
            cat_ids = dummy_cat_ids if dry_run else {}
            if conn:
                cur = conn.execute("SELECT name, id FROM categories")
                cat_ids = {r[0]: r[1] for r in cur.fetchall()}

        # models
        if only in (None, "models"):
            _bids = brand_ids if brand_ids else (dummy_brand_ids if dry_run else {})
            _cids = cat_ids   if cat_ids   else (dummy_cat_ids   if dry_run else {})
            if not dry_run and not _bids and conn:
                cur = conn.execute("SELECT name, id FROM brands")
                _bids = {r[0]: r[1] for r in cur.fetchall()}
            if not dry_run and not _cids and conn:
                cur = conn.execute("SELECT name, id FROM categories")
                _cids = {r[0]: r[1] for r in cur.fetchall()}
            model_ids = load_models(conn, _bids, _cids, dry_run)
        else:
            model_ids = dummy_model_ids if dry_run else {}
            if conn:
                cur = conn.execute(
                    "SELECT b.name || '::' || m.name, m.id FROM models m JOIN brands b ON m.brand_id = b.id"
                )
                model_ids = {r[0]: r[1] for r in cur.fetchall()}

        # aliases
        if only in (None, "aliases"):
            _bids = brand_ids  if brand_ids  else (dummy_brand_ids  if dry_run else {})
            _cids = cat_ids    if cat_ids    else (dummy_cat_ids    if dry_run else {})
            _mids = model_ids  if model_ids  else (dummy_model_ids  if dry_run else {})
            if not dry_run and conn:
                if not _bids:
                    cur = conn.execute("SELECT name, id FROM brands")
                    _bids = {r[0]: r[1] for r in cur.fetchall()}
                if not _cids:
                    cur = conn.execute("SELECT name, id FROM categories")
                    _cids = {r[0]: r[1] for r in cur.fetchall()}
                if not _mids:
                    cur = conn.execute(
                        "SELECT b.name || '::' || m.name, m.id FROM models m JOIN brands b ON m.brand_id = b.id"
                    )
                    _mids = {r[0]: r[1] for r in cur.fetchall()}
            load_aliases(conn, _bids, _cids, _mids, dry_run)

        if conn:
            conn.commit()
        print("\n[OK] 完了")

    except Exception as e:
        if conn:
            conn.rollback()
        print(f"\n[ERROR] ロールバックしました: {e}", file=sys.stderr)
        raise
    finally:
        if conn:
            conn.close()


def _count_dry(table: str, path: Path) -> dict:
    """dry_run 用: JSON の件数だけ表示して空 dict を返す"""
    if not path.exists():
        return {}
    rows = load_json(path)
    print(f"  {table}: (dry_run) {len(rows)} rows would be processed")
    return {}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="マスタデータ投入スクリプト")
    parser.add_argument("--db-path", default=str(DEFAULT_DB), help="DB ファイルパス")
    parser.add_argument("--only", choices=["brands", "categories", "models", "aliases"],
                        help="特定テーブルのみ投入")
    parser.add_argument("--dry-run", action="store_true", help="件数表示のみ（DB書き込みなし）")
    args = parser.parse_args()

    run(Path(args.db_path), args.only, args.dry_run)
