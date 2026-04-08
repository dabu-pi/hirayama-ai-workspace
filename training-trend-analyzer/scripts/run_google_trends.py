"""
Run the Google Trends collector and persist raw/observation/import artifacts.

Usage:
    python scripts/run_google_trends.py --mode mock
    python scripts/run_google_trends.py --mode live --seed-id concept2_skierg_model
    python scripts/run_google_trends.py --mode auto --max-seeds 2
    python scripts/run_google_trends.py --mode mock --import-db
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import sqlite3
import sys
from datetime import datetime
from pathlib import Path

if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
if sys.stderr.encoding != "utf-8":
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from scripts.import_csv import DEFAULT_DB, run_import
from src.collectors.google_trends import (
    DEFAULT_MOCK_FIXTURE,
    DEFAULT_SEED_CONFIG,
    GoogleTrendsCollector,
)

DEFAULT_OUTPUT_ROOT = ROOT / "data" / "collected" / "google_trends"


def _write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, ensure_ascii=False, indent=2)


def _write_csv(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if not rows:
        with open(path, "w", encoding="utf-8-sig", newline="") as handle:
            handle.write("")
        return

    fieldnames = list(rows[0].keys())
    with open(path, "w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def _import_ready_rows(import_rows: list[dict]) -> list[dict]:
    rows = []
    for row in import_rows:
        export_row = dict(row)
        export_row["collected_date"] = export_row.get("week_start", export_row["collected_date"])
        rows.append(export_row)
    return rows


def _replace_existing_source_metrics(db_path: Path, import_rows: list[dict]) -> int:
    conn = sqlite3.connect(db_path)
    deleted = 0
    try:
        for row in import_rows:
            sql = """
                DELETE FROM source_metrics
                WHERE id IN (
                    SELECT sm.id
                    FROM source_metrics sm
                    JOIN sources s ON sm.source_id = s.id
                    JOIN models m ON sm.model_id = m.id
                    JOIN brands b ON m.brand_id = b.id
                    WHERE s.name = ?
                      AND sm.metric_type = ?
                      AND sm.week_start = ?
                      AND b.name = ?
                      AND m.name = ?
                )
            """
            cur = conn.execute(
                sql,
                (
                    row["source_name"],
                    row["metric_type"],
                    row["week_start"],
                    row["raw_brand"],
                    row["raw_name"],
                ),
            )
            deleted += cur.rowcount or 0
        conn.commit()
    finally:
        conn.close()
    return deleted


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Run Google Trends collector. auto=prefer live then fallback to mock if live returns nothing."
    )
    parser.add_argument("--mode", choices=["auto", "live", "mock"], default="auto")
    parser.add_argument("--seed-config", default=str(DEFAULT_SEED_CONFIG))
    parser.add_argument("--fixture", default=str(DEFAULT_MOCK_FIXTURE))
    parser.add_argument("--seed-id", action="append", dest="seed_ids")
    parser.add_argument("--max-seeds", type=int)
    parser.add_argument("--output-root", default=str(DEFAULT_OUTPUT_ROOT))
    parser.add_argument("--db-path", default=str(DEFAULT_DB))
    parser.add_argument("--import-db", action="store_true")
    parser.add_argument("--dry-run-import", action="store_true")
    parser.add_argument("--replace-existing", action="store_true")
    parser.add_argument("--skip-unresolved", action="store_true")
    parser.add_argument("--only-commercial", action="store_true")
    args = parser.parse_args()

    collector = GoogleTrendsCollector(
        seed_config_path=Path(args.seed_config),
        mock_fixture_path=Path(args.fixture),
    )
    requested_seeds = collector.load_seeds()
    if args.seed_ids:
        requested_seeds = [seed for seed in requested_seeds if seed.seed_id in set(args.seed_ids)]
    if args.max_seeds is not None:
        requested_seeds = requested_seeds[: args.max_seeds]
    batch = collector.collect_bundle(
        mode=args.mode,
        seed_ids=args.seed_ids,
        max_seeds=args.max_seeds,
    )

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_root = Path(args.output_root)
    raw_path = output_root / "raw" / f"google_trends_{ts}.json"
    observations_path = output_root / "observations" / f"google_trends_{ts}.csv"
    import_path = output_root / "import" / f"google_trends_{ts}.csv"

    _write_json(
        raw_path,
        {
            "source_name": batch.source_name,
            "collected_at": batch.collected_at,
            "mode_requested": batch.mode_requested,
            "mode_used": batch.mode_used,
            "errors": batch.errors,
            "raw_payloads": batch.raw_payloads,
        },
    )
    _write_csv(observations_path, [obs.to_dict() for obs in batch.observations])
    _write_csv(import_path, _import_ready_rows(batch.import_rows))

    print(f"[COLLECT] mode_requested={batch.mode_requested} mode_used={batch.mode_used}")
    print(f"[COLLECT] observations={len(batch.observations)} import_rows={len(batch.import_rows)} errors={len(batch.errors)}")
    print(f"[COLLECT] seeds={len(requested_seeds)} geo={requested_seeds[0].geo if requested_seeds else 'n/a'} timeframe={requested_seeds[0].timeframe if requested_seeds else 'n/a'}")
    print(f"[ARTIFACT] raw={raw_path.resolve()}")
    print(f"[ARTIFACT] observations={observations_path.resolve()}")
    print(f"[ARTIFACT] import={import_path.resolve()}")

    successful_seed_ids = {payload["seed_id"] for payload in batch.raw_payloads}
    for seed in requested_seeds:
        seed_errors = [error for error in batch.errors if seed.seed_id in error]
        status = "ok" if seed.seed_id in successful_seed_ids and not seed_errors else "failed"
        print(
            f"[SEED] {seed.seed_id} status={status} mode={batch.mode_used} "
            f"queries={len(seed.queries)} target={seed.canonical_target or seed.label}"
        )
        for error in seed_errors:
            print(f"[SEED-WARN] {seed.seed_id}: {error}")

    if batch.errors:
        for error in batch.errors:
            print(f"[WARN] {error}")

    if args.import_db:
        if args.replace_existing and not args.dry_run_import:
            deleted = _replace_existing_source_metrics(Path(args.db_path), batch.import_rows)
            print(f"[IMPORT] replace_existing deleted_rows={deleted}")
        run_import(
            csv_path=import_path,
            db_path=Path(args.db_path),
            dry_run=args.dry_run_import,
            strict=False,
            skip_unresolved=args.skip_unresolved,
            only_commercial=args.only_commercial,
        )


if __name__ == "__main__":
    main()
