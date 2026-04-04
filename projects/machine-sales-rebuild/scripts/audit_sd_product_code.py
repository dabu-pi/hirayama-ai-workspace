from __future__ import annotations

import argparse
import csv
from pathlib import Path

from scripts.lib.product_v0 import load_settings_registry, normalize_text
from scripts.lib.sd_product_code import validate_sd_product_code


DEFAULT_INPUT = Path("data/output/product_master_v0.full.csv")
DEFAULT_SEED_DIR = Path("data/seeds")
DEFAULT_OUTPUT = Path("data/output/sd_product_code_audit.csv")

AUDIT_COLUMNS = [
    "source_row_no",
    "internal_id",
    "sd_product_code",
    "product_name",
    "status",
    "issue_codes",
    "issue_messages",
    "parsed_store_legacy_code",
    "parsed_maker_legacy_code",
    "parsed_purchase_year_code",
    "parsed_serial_no",
    "parsed_part_legacy_code",
    "expected_store_code",
    "expected_maker_code",
    "expected_purchase_year_code",
    "expected_serial_no",
    "expected_part_code",
]


def load_product_rows(input_path: Path) -> list[dict[str, str]]:
    with input_path.open("r", encoding="utf-8-sig", newline="") as handle:
        return [dict(row) for row in csv.DictReader(handle)]


def build_audit_rows(rows: list[dict[str, str]], seed_dir: Path) -> list[dict[str, object]]:
    registry = load_settings_registry(seed_dir)
    audit_rows: list[dict[str, object]] = []

    for row in rows:
        expected_store_legacy_code = _lookup_legacy_code(
            registry,
            "store",
            normalize_text(row.get("store_code", "")),
        )
        expected_maker_legacy_code = _lookup_legacy_code(
            registry,
            "maker",
            normalize_text(row.get("maker_code", "")),
        )
        expected_part_legacy_code = _lookup_legacy_code(
            registry,
            "part",
            normalize_text(row.get("part_code", "")),
        )
        validation = validate_sd_product_code(
            sd_product_code=normalize_text(row.get("sd_product_code", "")),
            store_legacy_codes=registry.all_legacy_codes("store"),
            maker_legacy_codes=registry.all_legacy_codes("maker"),
            part_legacy_codes=registry.all_legacy_codes("part"),
            maker_legacy_code_map=registry.legacy_code_map("maker"),
            expected_store_legacy_code=expected_store_legacy_code,
            expected_maker_legacy_code=expected_maker_legacy_code,
            expected_purchase_year_code=normalize_text(row.get("purchase_year_code", "")),
            expected_serial_no=normalize_text(row.get("serial_no", "")),
            expected_part_legacy_code=expected_part_legacy_code,
            mode="lenient",
            allow_legacy_empty_part=True,
        )
        parsed = validation.parsed
        audit_rows.append(
            {
                "source_row_no": normalize_text(row.get("source_row_no", "")),
                "internal_id": normalize_text(row.get("internal_id", "")),
                "sd_product_code": normalize_text(row.get("sd_product_code", "")),
                "product_name": normalize_text(row.get("product_name", "")),
                "status": validation.status(),
                "issue_codes": " | ".join(issue.code for issue in validation.issues),
                "issue_messages": " | ".join(issue.message for issue in validation.issues),
                "parsed_store_legacy_code": parsed.store_legacy_code if parsed else "",
                "parsed_maker_legacy_code": parsed.maker_legacy_code if parsed else "",
                "parsed_purchase_year_code": parsed.purchase_year_code if parsed else "",
                "parsed_serial_no": parsed.serial_no_text if parsed else "",
                "parsed_part_legacy_code": parsed.part_legacy_code if parsed else "",
                "expected_store_code": expected_store_legacy_code,
                "expected_maker_code": expected_maker_legacy_code,
                "expected_purchase_year_code": normalize_text(row.get("purchase_year_code", "")),
                "expected_serial_no": normalize_text(row.get("serial_no", "")),
                "expected_part_code": expected_part_legacy_code,
            }
        )
    return audit_rows


def _lookup_legacy_code(registry, master_type: str, code: str) -> str:
    record = registry.by_type.get(master_type, {}).get(code)
    return record.legacy_code if record else ""


def write_audit_csv(output_path: Path, rows: list[dict[str, object]]) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=AUDIT_COLUMNS)
        writer.writeheader()
        for row in rows:
            writer.writerow({column: row.get(column, "") for column in AUDIT_COLUMNS})


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Audit sd_product_code parse/validate results for product_master v0 CSV.",
    )
    parser.add_argument("--input", default=str(DEFAULT_INPUT), help="Input product_master v0 CSV path.")
    parser.add_argument("--seed-dir", default=str(DEFAULT_SEED_DIR), help="Settings seed CSV directory.")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="Audit CSV output path.")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    rows = load_product_rows(Path(args.input))
    audit_rows = build_audit_rows(rows, Path(args.seed_dir))
    write_audit_csv(Path(args.output), audit_rows)
    status_counts: dict[str, int] = {}
    for audit_row in audit_rows:
        status = normalize_text(audit_row.get("status", ""))
        status_counts[status] = status_counts.get(status, 0) + 1
    print(f"rows={len(audit_rows)}")
    for status, count in sorted(status_counts.items()):
        print(f"{status}={count}")
    print(Path(args.output).as_posix())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
