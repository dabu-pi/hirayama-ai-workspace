from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path

from scripts.lib.product_v0 import (
    SettingsRegistry,
    build_search_text,
    infer_visibility_fields,
    load_settings_registry,
    normalize_text,
    now_jst_iso,
    parse_bool,
    parse_number,
    parse_source_image_json,
    slugify,
)


DEFAULT_INPUT = Path("data/samples/product_master_v0_sample.csv")
DEFAULT_SEED_DIR = Path("data/seeds")
DEFAULT_OUTPUT = Path("data/output/products.sample.json")
SCHEMA_VERSION = "1.0.0"


def _lookup_label(
    registry: SettingsRegistry,
    master_type: str,
    code: str,
    fallback_label: str,
) -> str:
    record = registry.by_type.get(master_type, {}).get(code)
    if record:
        return record.label
    return fallback_label or code or "未設定"


def _build_images(row: dict[str, str]) -> list[dict[str, object]]:
    source_urls = parse_source_image_json(row.get("source_image_urls_json", ""), max_images=10)
    main_index_raw = parse_number(row.get("main_image_index"))
    main_index = main_index_raw if main_index_raw and main_index_raw > 0 else 1

    images: list[dict[str, object]] = []
    for index, source_url in enumerate(source_urls, start=1):
        images.append(
            {
                "sourceUrl": source_url,
                "displayUrl": None,
                "width": 700,
                "height": 700,
                "alt": build_search_text(
                    row.get("product_name", ""),
                    row.get("maker_name", ""),
                    row.get("sd_product_code", ""),
                    f"画像{index}",
                ),
                "isMain": index == main_index,
                "sortOrder": index,
            }
        )
    return images


def _build_product(row: dict[str, str], registry: SettingsRegistry) -> dict[str, object]:
    slug = normalize_text(row.get("seo_slug", "")) or slugify(
        row.get("product_name", ""),
        row.get("sd_product_code", ""),
    )
    publish_status = normalize_text(row.get("publish_status", "")) or "public"
    condition_code = normalize_text(row.get("condition_code", "")) or "unknown"
    condition_label = _lookup_label(
        registry,
        "condition",
        condition_code,
        normalize_text(row.get("condition_label", "")),
    )
    is_published, sold_out_flag, inquiry_enabled = infer_visibility_fields(
        publish_status=publish_status,
        condition_code=condition_code,
        inquiry_enabled=parse_bool(row.get("inquiry_enabled", "")),
    )
    sale_price = parse_number(row.get("sale_price_ex_tax"))
    base_price = parse_number(row.get("base_price_ex_tax"))
    discount_price = parse_number(row.get("discount_price_ex_tax"))

    description_text = normalize_text(row.get("description_text", ""))
    summary = description_text[:80] if description_text else ""

    maker_code = normalize_text(row.get("maker_code", "")) or "UNREGISTERED_MAKER"
    store_code = normalize_text(row.get("store_code", "")) or "UNREGISTERED_STORE"
    category_code = normalize_text(row.get("category_code", "")) or "uncategorized"
    part_code = normalize_text(row.get("part_code", "")) or "UNREGISTERED_PART"

    return {
        "id": normalize_text(row.get("internal_id", "")),
        "sdProductCode": normalize_text(row.get("sd_product_code", "")),
        "slug": slug,
        "name": normalize_text(row.get("product_name", "")),
        "description": {
            "text": description_text,
            "html": normalize_text(row.get("description_html", "")),
            "summary": summary,
        },
        "maker": {
            "code": maker_code,
            "label": _lookup_label(
                registry,
                "maker",
                maker_code,
                normalize_text(row.get("maker_name", "")),
            ),
        },
        "store": {
            "code": store_code,
            "label": _lookup_label(
                registry,
                "store",
                store_code,
                normalize_text(row.get("store_name", "")),
            ),
        },
        "condition": {
            "code": condition_code,
            "label": condition_label,
            "isSoldOut": sold_out_flag,
        },
        "category": {
            "code": category_code,
            "label": _lookup_label(
                registry,
                "category",
                category_code,
                normalize_text(row.get("category_label", "")),
            ),
        },
        "part": {
            "code": part_code,
            "label": _lookup_label(
                registry,
                "part",
                part_code,
                normalize_text(row.get("part_label", "")),
            ),
        },
        "price": {
            "currency": "JPY",
            "taxMode": "EX_TAX",
            "basePrice": base_price,
            "salePrice": sale_price,
            "discountPrice": discount_price,
            "shippingFee": parse_number(row.get("shipping_fee_ex_tax")),
            "priceLabel": "売却済み" if sold_out_flag else None,
        },
        "images": _build_images(row),
        "visibility": {
            "status": publish_status,
            "isPublished": is_published,
            "isFeatured": parse_bool(row.get("featured_flag", "")),
            "inquiryEnabled": inquiry_enabled,
        },
        "seo": {
            "title": normalize_text(row.get("seo_title", ""))
            or build_search_text(
                row.get("product_name", ""),
                "| STRONG DEPOT",
            ),
            "description": normalize_text(row.get("seo_description", ""))
            or summary,
            "canonicalPath": f"/products/{slug}",
        },
        "searchText": build_search_text(
            row.get("product_name", ""),
            row.get("maker_name", ""),
            row.get("condition_label", ""),
            row.get("part_label", ""),
            row.get("category_label", ""),
            row.get("sd_product_code", ""),
            row.get("search_keywords", ""),
        ),
        "updatedAt": normalize_text(row.get("updated_at", "")),
    }


def load_product_rows(input_path: Path) -> list[dict[str, str]]:
    with input_path.open("r", encoding="utf-8-sig", newline="") as handle:
        return [dict(row) for row in csv.DictReader(handle)]


def export_products_json(
    input_path: Path,
    output_path: Path,
    seed_dir: Path,
) -> dict[str, object]:
    registry = load_settings_registry(seed_dir)
    rows = load_product_rows(input_path)
    payload = {
        "schemaVersion": SCHEMA_VERSION,
        "generatedAt": now_jst_iso(),
        "source": {
            "sheetName": input_path.stem,
            "system": "integrated-sheet-v0",
        },
        "products": [_build_product(row, registry) for row in rows],
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return payload


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Export product_master v0 CSV to products.json prototype.",
    )
    parser.add_argument("--input", default=str(DEFAULT_INPUT), help="Input product_master v0 CSV path.")
    parser.add_argument("--seed-dir", default=str(DEFAULT_SEED_DIR), help="Settings seed CSV directory.")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="Output products JSON path.")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    payload = export_products_json(
        input_path=Path(args.input),
        output_path=Path(args.output),
        seed_dir=Path(args.seed_dir),
    )
    print(f"products={len(payload['products'])}")
    print(Path(args.output).as_posix())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
