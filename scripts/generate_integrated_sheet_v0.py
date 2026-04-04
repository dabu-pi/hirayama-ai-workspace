from __future__ import annotations

import argparse
import csv
from pathlib import Path

from scripts.lib.product_v0 import TEMPLATE_TABLES


DEFAULT_OUTPUT_DIR = Path("data/templates/integrated-sheet-v0")


def generate_templates(output_dir: Path) -> list[Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    generated_files: list[Path] = []

    for filename, columns in TEMPLATE_TABLES.items():
        file_path = output_dir / filename
        with file_path.open("w", encoding="utf-8-sig", newline="") as handle:
            writer = csv.writer(handle)
            writer.writerow(columns)
        generated_files.append(file_path)

    return generated_files


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate local CSV templates for integrated-sheet-v0.",
    )
    parser.add_argument(
        "--output-dir",
        default=str(DEFAULT_OUTPUT_DIR),
        help="Directory to write CSV templates.",
    )
    return parser


def main() -> int:
    args = build_parser().parse_args()
    generated_files = generate_templates(Path(args.output_dir))
    for file_path in generated_files:
        print(file_path.as_posix())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
