from __future__ import annotations

import argparse
import csv
from dataclasses import dataclass
from pathlib import Path

from scripts.lib.product_v0 import normalize_text, write_csv


DEFAULT_INPUT = Path("data/output/product_master_v0.full.csv")
DEFAULT_OUTPUT = Path("data/output/wordpress_recovery_public_targets.csv")
SITE_BASE_URL = "https://machine-group.net"
TARGET_COLUMNS = [
    "sd_product_code",
    "slug",
    "product_url",
    "public_status",
    "notes",
]


@dataclass(frozen=True)
class PublicTargetRow:
    sd_product_code: str
    slug: str
    product_url: str
    public_status: str
    notes: str

    def as_row(self) -> dict[str, str]:
        return {
            "sd_product_code": self.sd_product_code,
            "slug": self.slug,
            "product_url": self.product_url,
            "public_status": self.public_status,
            "notes": self.notes,
        }


def load_product_master_rows(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return [dict(row) for row in csv.DictReader(handle)]


def derive_public_targets(rows: list[dict[str, str]]) -> list[PublicTargetRow]:
    targets: list[PublicTargetRow] = []
    slug_counts: dict[str, int] = {}

    public_rows = [
        row
        for row in rows
        if normalize_text(row.get("publish_status", "")) == "public"
        and normalize_text(row.get("sold_out_flag", "")).casefold() != "true"
    ]

    for row in public_rows:
        sd_product_code = normalize_text(row.get("sd_product_code", "")).upper()
        derived_slug = sd_product_code.lower()
        stored_slug = normalize_text(row.get("seo_slug", "")).lower()
        slug = derived_slug

        notes: list[str] = []
        if stored_slug and stored_slug != derived_slug:
            notes.append(f"seo_slug_differs={stored_slug}")
        if not sd_product_code:
            notes.append("sd_product_code_missing")

        slug_counts[slug] = slug_counts.get(slug, 0) + 1
        targets.append(
            PublicTargetRow(
                sd_product_code=sd_product_code,
                slug=slug,
                product_url=f"{SITE_BASE_URL}/products/{slug}/",
                public_status="public",
                notes=" | ".join(notes),
            )
        )

    deduped_targets: list[PublicTargetRow] = []
    for target in targets:
        notes = [value for value in [target.notes] if value]
        if slug_counts.get(target.slug, 0) > 1:
            notes.append("duplicate_slug")
        deduped_targets.append(
            PublicTargetRow(
                sd_product_code=target.sd_product_code,
                slug=target.slug,
                product_url=target.product_url,
                public_status=target.public_status,
                notes=" | ".join(notes),
            )
        )
    return deduped_targets


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Prepare public-only WordPress recovery targets from product_master v0.",
    )
    parser.add_argument("--input", default=str(DEFAULT_INPUT), help="Input product_master_v0 CSV path.")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="Output target CSV path.")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    rows = load_product_master_rows(Path(args.input))
    targets = derive_public_targets(rows)
    write_csv(Path(args.output), [target.as_row() for target in targets], TARGET_COLUMNS)
    duplicate_count = sum(1 for target in targets if "duplicate_slug" in target.notes)
    mismatch_count = sum(1 for target in targets if "seo_slug_differs" in target.notes)
    print(f"targets={len(targets)}")
    print(f"duplicate_slugs={duplicate_count}")
    print(f"slug_mismatches={mismatch_count}")
    print(Path(args.output).as_posix())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
