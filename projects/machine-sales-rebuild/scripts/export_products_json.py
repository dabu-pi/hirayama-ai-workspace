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
    write_csv,
)
from scripts.lib.public_image_manifest import build_image_objects, load_public_image_bindings


DEFAULT_INPUT = Path("data/samples/product_master_v0_sample.csv")
DEFAULT_SEED_DIR = Path("data/seeds")
DEFAULT_OUTPUT = Path("data/output/products.sample.json")
DEFAULT_SOURCE_MANIFEST = Path("data/output/public_image_manifest.csv")
DEFAULT_DERIVED_MANIFEST = Path("data/output/public_derived_image_manifest.csv")
DEFAULT_BINDING_REPORT = Path("data/output/products_public_image_binding_report.csv")
DEFAULT_BINDING_SUMMARY_CSV = Path("data/output/products_public_image_binding_summary.csv")
DEFAULT_BINDING_SUMMARY_MD = Path("data/output/products_public_image_binding_summary.md")
DEFAULT_FRONTEND_TARGETS_CSV = Path("data/output/frontend_image_check_targets.csv")
DEFAULT_DERIVED_RESULTS = Path("data/output/public_derived_image_results.csv")
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


def _build_gallery_fields(bindings: list[object]) -> tuple[str | None, list[str]]:
    if not bindings:
        return None, []
    gallery_urls = [binding.display_url for binding in bindings]
    main_binding = next((binding for binding in bindings if binding.is_primary_candidate), bindings[0])
    return main_binding.display_url, gallery_urls


def _build_product(
    row: dict[str, str],
    registry: SettingsRegistry,
    *,
    image_bindings: list[object] | None = None,
) -> dict[str, object]:
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
    sd_product_code = normalize_text(row.get("sd_product_code", ""))
    bindings = image_bindings or []

    if bindings:
        display_url, gallery_urls = _build_gallery_fields(bindings)
        images = build_image_objects(
            bindings=bindings,
            product_name=normalize_text(row.get("product_name", "")),
            maker_name=normalize_text(row.get("maker_name", "")),
            sd_product_code=sd_product_code,
        )
    else:
        display_url = None
        gallery_urls = []
        images = _build_images(row)

    return {
        "id": normalize_text(row.get("internal_id", "")),
        "sdProductCode": sd_product_code,
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
        "displayUrl": display_url,
        "galleryUrls": gallery_urls,
        "images": images,
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


def _load_csv_rows(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return [dict(row) for row in csv.DictReader(handle)]


def _is_public_row(row: dict[str, str]) -> bool:
    return normalize_text(row.get("publish_status", "")) == "public" and not parse_bool(
        row.get("sold_out_flag", "")
    )


def _build_binding_report_rows(
    rows: list[dict[str, str]],
    image_binding_map: dict[str, list[object]],
) -> list[dict[str, object]]:
    report_rows: list[dict[str, object]] = []
    for row in rows:
        code = normalize_text(row.get("sd_product_code", "")).upper()
        bindings = image_binding_map.get(code, [])
        display_url, gallery_urls = _build_gallery_fields(bindings)
        notes: list[str] = []
        if _is_public_row(row) and not bindings:
            notes.append("public_product_missing_manifest")
        if bindings and any("noimage" in normalize_text(binding.original_image_url).casefold() for binding in bindings):
            notes.append("placeholder_source_image")
        report_rows.append(
            {
                "sd_product_code": code,
                "slug": normalize_text(row.get("seo_slug", "")).lower(),
                "publish_status": normalize_text(row.get("publish_status", "")),
                "sold_out_flag": normalize_text(row.get("sold_out_flag", "")),
                "primary_image_found": "true" if display_url else "false",
                "gallery_image_count": len(gallery_urls),
                "display_url": display_url or "",
                "notes": " | ".join(notes),
            }
        )
    return report_rows


def _build_binding_summary_rows(report_rows: list[dict[str, object]]) -> list[dict[str, object]]:
    public_rows = [
        row
        for row in report_rows
        if normalize_text(row.get("publish_status", "")) == "public"
        and normalize_text(row.get("sold_out_flag", "")).casefold() != "true"
    ]
    display_present = sum(1 for row in public_rows if row.get("primary_image_found") == "true")
    gallery_zero = sum(1 for row in public_rows if int(row.get("gallery_image_count", 0) or 0) == 0)
    distribution: dict[int, int] = {}
    for row in public_rows:
        count = int(row.get("gallery_image_count", 0) or 0)
        distribution[count] = distribution.get(count, 0) + 1
    rows = [
        {"metric": "public_products", "value": len(public_rows), "notes": ""},
        {"metric": "display_url_present", "value": display_present, "notes": ""},
        {"metric": "display_url_missing", "value": len(public_rows) - display_present, "notes": ""},
        {"metric": "gallery_zero_products", "value": gallery_zero, "notes": ""},
        {
            "metric": "placeholder_source_products",
            "value": sum(1 for row in public_rows if "placeholder_source_image" in normalize_text(row.get("notes", ""))),
            "notes": "",
        },
    ]
    for gallery_count, product_count in sorted(distribution.items()):
        rows.append(
            {
                "metric": f"gallery_count_{gallery_count}",
                "value": product_count,
                "notes": "public_products",
            }
        )
    return rows


def _write_binding_summary_markdown(path: Path, summary_rows: list[dict[str, object]]) -> None:
    lookup = {str(row["metric"]): row for row in summary_rows}
    lines = [
        "# products.json 画像バインディングサマリー",
        "",
        f"- 公開商品件数: {lookup.get('public_products', {}).get('value', 0)}",
        f"- displayUrl あり件数: {lookup.get('display_url_present', {}).get('value', 0)}",
        f"- displayUrl なし件数: {lookup.get('display_url_missing', {}).get('value', 0)}",
        f"- galleryUrls 0件の商品数: {lookup.get('gallery_zero_products', {}).get('value', 0)}",
        f"- sourceUrl が noimage プレースホルダの商品数: {lookup.get('placeholder_source_products', {}).get('value', 0)}",
        "",
        "## gallery 件数分布",
        "",
    ]
    for row in summary_rows:
        metric = str(row["metric"])
        if metric.startswith("gallery_count_"):
            lines.append(f"- {metric.replace('gallery_count_', '')}枚: {row['value']}商品")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _build_frontend_check_targets(
    *,
    report_rows: list[dict[str, object]],
    derived_results_path: Path | None,
) -> list[dict[str, object]]:
    candidates_by_code = {
        normalize_text(str(row.get("sd_product_code", ""))).upper(): row
        for row in report_rows
        if row.get("display_url")
    }
    derived_rows = _load_csv_rows(derived_results_path) if derived_results_path and derived_results_path.exists() else []
    targets: list[dict[str, object]] = []
    seen_codes: set[str] = set()

    def append_from_report(predicate, reason: str) -> None:
        for row in report_rows:
            code = normalize_text(str(row.get("sd_product_code", ""))).upper()
            if code in seen_codes:
                continue
            if predicate(row):
                targets.append(
                    {
                        "sd_product_code": code,
                        "slug": normalize_text(str(row.get("slug", ""))).lower(),
                        "display_url": normalize_text(str(row.get("display_url", ""))),
                        "gallery_count": row.get("gallery_image_count", 0),
                        "check_reason": reason,
                    }
                )
                seen_codes.add(code)
                break

    def append_from_derived(predicate, reason: str) -> None:
        for row in derived_rows:
            code = normalize_text(row.get("sd_product_code", "")).upper()
            if code in seen_codes or code not in candidates_by_code:
                continue
            try:
                source_width = int(normalize_text(row.get("source_width", "")) or "0")
                source_height = int(normalize_text(row.get("source_height", "")) or "0")
            except ValueError:
                source_width = 0
                source_height = 0
            if predicate(row, source_width, source_height):
                report_row = candidates_by_code[code]
                targets.append(
                    {
                        "sd_product_code": code,
                        "slug": normalize_text(str(report_row.get("slug", ""))).lower(),
                        "display_url": normalize_text(str(report_row.get("display_url", ""))),
                        "gallery_count": report_row.get("gallery_image_count", 0),
                        "check_reason": reason,
                    }
                )
                seen_codes.add(code)
                break

    append_from_derived(
        lambda row, width, height: normalize_text(row.get("background_mode", "")) == "white_pad"
        and width > height,
        "white_padding_horizontal",
    )
    append_from_derived(
        lambda row, width, height: normalize_text(row.get("background_mode", "")) == "white_pad"
        and height > width,
        "white_padding_vertical",
    )
    append_from_derived(
        lambda row, _width, _height: normalize_text(row.get("source_ext", "")) == "png",
        "png_source",
    )
    append_from_report(lambda row: int(row.get("gallery_image_count", 0) or 0) >= 5, "rich_gallery")
    append_from_report(lambda row: int(row.get("gallery_image_count", 0) or 0) == 1, "single_image")
    append_from_report(lambda row: int(row.get("gallery_image_count", 0) or 0) == 2, "two_image_product")
    append_from_report(lambda row: int(row.get("gallery_image_count", 0) or 0) == 3, "three_image_product")
    return targets


def export_products_json(
    input_path: Path,
    output_path: Path,
    seed_dir: Path,
    *,
    source_manifest_path: Path | None = None,
    derived_manifest_path: Path | None = None,
    image_path_prefix: str = "public-700x700",
    public_only: bool = False,
    binding_report_path: Path | None = None,
    binding_summary_csv_path: Path | None = None,
    binding_summary_md_path: Path | None = None,
    frontend_check_targets_path: Path | None = None,
    derived_results_path: Path | None = None,
) -> dict[str, object]:
    registry = load_settings_registry(seed_dir)
    rows = load_product_rows(input_path)
    if public_only:
        rows = [row for row in rows if _is_public_row(row)]

    image_binding_map: dict[str, list[object]] = {}
    if derived_manifest_path and derived_manifest_path.exists():
        image_binding_map = load_public_image_bindings(
            derived_manifest_path=derived_manifest_path,
            source_manifest_path=source_manifest_path if source_manifest_path and source_manifest_path.exists() else None,
            image_path_prefix=image_path_prefix,
        )

    payload = {
        "schemaVersion": SCHEMA_VERSION,
        "generatedAt": now_jst_iso(),
        "source": {
            "sheetName": input_path.stem,
            "system": "integrated-sheet-v0",
        },
        "products": [
            _build_product(
                row,
                registry,
                image_bindings=image_binding_map.get(normalize_text(row.get("sd_product_code", "")).upper(), []),
            )
            for row in rows
        ],
    }
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    if binding_report_path:
        report_rows = _build_binding_report_rows(rows, image_binding_map)
        write_csv(
            binding_report_path,
            report_rows,
            [
                "sd_product_code",
                "slug",
                "publish_status",
                "sold_out_flag",
                "primary_image_found",
                "gallery_image_count",
                "display_url",
                "notes",
            ],
        )
        if binding_summary_csv_path:
            summary_rows = _build_binding_summary_rows(report_rows)
            write_csv(binding_summary_csv_path, summary_rows, ["metric", "value", "notes"])
            if binding_summary_md_path:
                _write_binding_summary_markdown(binding_summary_md_path, summary_rows)
        if frontend_check_targets_path:
            frontend_rows = _build_frontend_check_targets(
                report_rows=report_rows,
                derived_results_path=derived_results_path,
            )
            write_csv(
                frontend_check_targets_path,
                frontend_rows,
                ["sd_product_code", "slug", "display_url", "gallery_count", "check_reason"],
            )
    return payload


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Export product_master v0 CSV to products.json prototype.",
    )
    parser.add_argument("--input", default=str(DEFAULT_INPUT), help="Input product_master v0 CSV path.")
    parser.add_argument("--seed-dir", default=str(DEFAULT_SEED_DIR), help="Settings seed CSV directory.")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="Output products JSON path.")
    parser.add_argument("--source-manifest", default=str(DEFAULT_SOURCE_MANIFEST), help="Recovered source image manifest CSV path.")
    parser.add_argument("--derived-manifest", default=str(DEFAULT_DERIVED_MANIFEST), help="Derived image manifest CSV path.")
    parser.add_argument("--image-path-prefix", default="public-700x700", help="Path prefix to prepend to derived_url_candidate.")
    parser.add_argument("--public-only", action="store_true", help="Export public non-sold products only.")
    parser.add_argument("--binding-report", default=str(DEFAULT_BINDING_REPORT), help="Binding report CSV path.")
    parser.add_argument("--binding-summary-csv", default=str(DEFAULT_BINDING_SUMMARY_CSV), help="Binding summary CSV path.")
    parser.add_argument("--binding-summary-md", default=str(DEFAULT_BINDING_SUMMARY_MD), help="Binding summary markdown path.")
    parser.add_argument("--frontend-check-targets", default=str(DEFAULT_FRONTEND_TARGETS_CSV), help="Frontend image check target CSV path.")
    parser.add_argument("--derived-results", default=str(DEFAULT_DERIVED_RESULTS), help="Derived image results CSV path.")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    payload = export_products_json(
        input_path=Path(args.input),
        output_path=Path(args.output),
        seed_dir=Path(args.seed_dir),
        source_manifest_path=Path(args.source_manifest),
        derived_manifest_path=Path(args.derived_manifest),
        image_path_prefix=normalize_text(args.image_path_prefix),
        public_only=bool(args.public_only),
        binding_report_path=Path(args.binding_report),
        binding_summary_csv_path=Path(args.binding_summary_csv),
        binding_summary_md_path=Path(args.binding_summary_md),
        frontend_check_targets_path=Path(args.frontend_check_targets),
        derived_results_path=Path(args.derived_results),
    )
    print(f"products={len(payload['products'])}")
    print(Path(args.output).as_posix())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
