from __future__ import annotations

import argparse
from pathlib import Path

from scripts.lib.image_derivation import (
    DERIVED_EXT,
    DerivationFailure,
    aspect_bucket,
    build_derived_path,
    derive_image,
    load_manifest_jobs,
)
from scripts.lib.product_v0 import normalize_text, write_csv


DEFAULT_INPUT = Path("data/output/public_image_manifest.csv")
DEFAULT_OUTPUT_DIR = Path("data/derived-images/public-700x700")
DEFAULT_RESULTS_CSV = Path("data/output/public_derived_image_results.csv")
DEFAULT_FAILURES_CSV = Path("data/output/public_derived_image_failures.csv")
DEFAULT_MANIFEST_CSV = Path("data/output/public_derived_image_manifest.csv")
DEFAULT_SUMMARY_CSV = Path("data/output/public_derived_image_summary.csv")
DEFAULT_SUMMARY_MD = Path("data/output/public_derived_image_summary.md")
DEFAULT_VISUAL_CHECK_CSV = Path("data/output/public_derived_image_visual_check.csv")

RESULT_COLUMNS = [
    "sd_product_code",
    "slug",
    "image_seq",
    "source_path",
    "source_ext",
    "source_width",
    "source_height",
    "derived_path",
    "derived_ext",
    "derived_width",
    "derived_height",
    "background_mode",
    "transform_mode",
    "status",
    "notes",
]

FAILURE_COLUMNS = [
    "sd_product_code",
    "slug",
    "image_seq",
    "source_path",
    "failure_stage",
    "reason",
]

DERIVED_MANIFEST_COLUMNS = [
    "sd_product_code",
    "slug",
    "image_seq",
    "source_path",
    "derived_path",
    "derived_url_candidate",
    "is_primary_candidate",
    "file_ext",
    "width",
    "height",
    "notes",
]

SUMMARY_COLUMNS = [
    "metric",
    "value",
    "notes",
]

VISUAL_CHECK_COLUMNS = [
    "sd_product_code",
    "image_seq",
    "source_path",
    "derived_path",
    "check_reason",
]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Generate 700x700 derived images from public_image_manifest.csv.",
    )
    parser.add_argument("--input", default=str(DEFAULT_INPUT), help="Input manifest CSV path.")
    parser.add_argument(
        "--output-dir",
        default=str(DEFAULT_OUTPUT_DIR),
        help="Directory to save derived 700x700 images.",
    )
    parser.add_argument("--results-csv", default=str(DEFAULT_RESULTS_CSV), help="Result CSV path.")
    parser.add_argument("--failures-csv", default=str(DEFAULT_FAILURES_CSV), help="Failure CSV path.")
    parser.add_argument("--manifest-csv", default=str(DEFAULT_MANIFEST_CSV), help="Derived manifest CSV path.")
    parser.add_argument("--summary-csv", default=str(DEFAULT_SUMMARY_CSV), help="Summary CSV path.")
    parser.add_argument("--summary-md", default=str(DEFAULT_SUMMARY_MD), help="Summary markdown path.")
    parser.add_argument(
        "--visual-check-csv",
        default=str(DEFAULT_VISUAL_CHECK_CSV),
        help="Visual-check sample CSV path.",
    )
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing derived images.")
    parser.add_argument("--dry-run", action="store_true", help="Parse jobs without writing image files.")
    return parser


def generate_all(
    *,
    input_path: Path,
    output_dir: Path,
    overwrite: bool,
    dry_run: bool,
) -> tuple[list[dict[str, object]], list[dict[str, object]]]:
    jobs = load_manifest_jobs(input_path)
    results: list[dict[str, object]] = []
    failures: list[dict[str, object]] = []

    for job in jobs:
        try:
            result = derive_image(
                job=job,
                output_dir=output_dir,
                overwrite=overwrite,
                dry_run=dry_run,
            )
            results.append(result.as_row())
        except Exception as error:
            failures.append(
                DerivationFailure(
                    sd_product_code=job.sd_product_code,
                    slug=job.slug,
                    image_seq=job.image_seq,
                    source_path=job.source_path,
                    failure_stage="derive_image",
                    reason=str(error),
                ).as_row()
            )
    return results, failures


def build_derived_manifest(results: list[dict[str, object]]) -> list[dict[str, object]]:
    manifest_rows: list[dict[str, object]] = []
    for row in results:
        if normalize_text(row.get("status", "")) not in {"generated", "skipped_existing", "dry_run"}:
            continue
        sd_product_code = normalize_text(row.get("sd_product_code", "")).upper()
        derived_path = normalize_text(row.get("derived_path", ""))
        derived_name = Path(derived_path).name
        manifest_rows.append(
            {
                "sd_product_code": sd_product_code,
                "slug": normalize_text(row.get("slug", "")).lower(),
                "image_seq": row.get("image_seq", ""),
                "source_path": normalize_text(row.get("source_path", "")),
                "derived_path": derived_path,
                "derived_url_candidate": f"{sd_product_code}/{derived_name}",
                "is_primary_candidate": "true"
                if str(row.get("image_seq", "")) == "1"
                else "false",
                "file_ext": DERIVED_EXT,
                "width": row.get("derived_width", ""),
                "height": row.get("derived_height", ""),
                "notes": normalize_text(row.get("notes", "")),
            }
        )
    return manifest_rows


def build_summary_rows(
    results: list[dict[str, object]],
    failures: list[dict[str, object]],
) -> list[dict[str, object]]:
    success_rows = [
        row
        for row in results
        if normalize_text(row.get("status", "")) in {"generated", "skipped_existing", "dry_run"}
    ]
    success_products = {
        normalize_text(row.get("sd_product_code", "")).upper()
        for row in success_rows
        if normalize_text(row.get("sd_product_code", ""))
    }
    failed_products = {
        normalize_text(row.get("sd_product_code", "")).upper()
        for row in failures
        if normalize_text(row.get("sd_product_code", ""))
    }
    source_ext_counter: dict[str, int] = {}
    derived_ext_counter: dict[str, int] = {}
    aspect_counter: dict[str, int] = {}
    background_counter: dict[str, int] = {}
    product_image_counter: dict[str, int] = {}

    for row in success_rows:
        source_ext = normalize_text(row.get("source_ext", "")).lower() or "(unknown)"
        derived_ext = normalize_text(row.get("derived_ext", "")).lower() or "(unknown)"
        source_ext_counter[source_ext] = source_ext_counter.get(source_ext, 0) + 1
        derived_ext_counter[derived_ext] = derived_ext_counter.get(derived_ext, 0) + 1
        width = int(row.get("source_width", 0) or 0)
        height = int(row.get("source_height", 0) or 0)
        aspect = aspect_bucket(width, height)
        aspect_counter[aspect] = aspect_counter.get(aspect, 0) + 1
        background = normalize_text(row.get("background_mode", "")) or "(unknown)"
        background_counter[background] = background_counter.get(background, 0) + 1
        code = normalize_text(row.get("sd_product_code", "")).upper()
        product_image_counter[code] = product_image_counter.get(code, 0) + 1

    summary_rows: list[dict[str, object]] = [
        {"metric": "target_images", "value": len(results) + len(failures), "notes": ""},
        {"metric": "success_images", "value": len(success_rows), "notes": ""},
        {"metric": "failed_images", "value": len(failures), "notes": ""},
        {"metric": "success_products", "value": len(success_products), "notes": ""},
        {"metric": "failed_products", "value": len(failed_products), "notes": ""},
    ]

    for source_ext, count in sorted(source_ext_counter.items()):
        summary_rows.append(
            {"metric": f"source_ext_{source_ext}", "value": count, "notes": "successful_images"}
        )
    for derived_ext, count in sorted(derived_ext_counter.items()):
        summary_rows.append(
            {"metric": f"derived_ext_{derived_ext}", "value": count, "notes": "successful_images"}
        )
    for aspect, count in sorted(aspect_counter.items()):
        summary_rows.append(
            {"metric": f"aspect_{aspect}", "value": count, "notes": "successful_images"}
        )
    for background, count in sorted(background_counter.items()):
        summary_rows.append(
            {"metric": f"background_{background}", "value": count, "notes": "successful_images"}
        )
    distribution: dict[int, int] = {}
    for image_count in product_image_counter.values():
        distribution[image_count] = distribution.get(image_count, 0) + 1
    for image_count, count in sorted(distribution.items()):
        summary_rows.append(
            {
                "metric": f"product_image_count_{image_count}",
                "value": count,
                "notes": "products_with_image_count",
            }
        )
    return summary_rows


def write_summary_markdown(path: Path, summary_rows: list[dict[str, object]]) -> None:
    lookup = {str(row["metric"]): row for row in summary_rows}
    lines = [
        "# 公開商品700x700派生画像サマリー",
        "",
        f"- 生成対象画像総数: {lookup.get('target_images', {}).get('value', 0)}",
        f"- 生成成功枚数: {lookup.get('success_images', {}).get('value', 0)}",
        f"- 生成失敗枚数: {lookup.get('failed_images', {}).get('value', 0)}",
        f"- 商品単位成功数: {lookup.get('success_products', {}).get('value', 0)}",
        f"- 商品単位失敗数: {lookup.get('failed_products', {}).get('value', 0)}",
        "",
        "## アスペクト比カテゴリ",
        "",
    ]
    for metric in ("aspect_horizontal", "aspect_vertical", "aspect_square"):
        if metric in lookup:
            lines.append(f"- {metric.replace('aspect_', '')}: {lookup[metric]['value']}")

    lines.extend(["", "## 背景モード", ""])
    for metric in ("background_none", "background_white_pad"):
        if metric in lookup:
            lines.append(f"- {metric.replace('background_', '')}: {lookup[metric]['value']}")

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def build_visual_check_rows(results: list[dict[str, object]]) -> list[dict[str, object]]:
    success_rows = [
        row
        for row in results
        if normalize_text(row.get("status", "")) in {"generated", "skipped_existing", "dry_run"}
    ]
    reasons = [
        ("horizontal", lambda row: aspect_bucket(int(row.get("source_width", 0) or 0), int(row.get("source_height", 0) or 0)) == "horizontal"),
        ("vertical", lambda row: aspect_bucket(int(row.get("source_width", 0) or 0), int(row.get("source_height", 0) or 0)) == "vertical"),
        ("square", lambda row: aspect_bucket(int(row.get("source_width", 0) or 0), int(row.get("source_height", 0) or 0)) == "square"),
        ("png_source", lambda row: normalize_text(row.get("source_ext", "")).lower() == "png"),
        ("jpg_source", lambda row: normalize_text(row.get("source_ext", "")).lower() == "jpg"),
        ("single_image_product", lambda row: str(row.get("image_seq", "")) == "1"),
        ("multi_image_product", lambda row: str(row.get("image_seq", "")) in {"2", "3", "4", "5", "6", "7"}),
        ("white_padding", lambda row: normalize_text(row.get("background_mode", "")) == "white_pad"),
    ]

    selected: list[dict[str, object]] = []
    seen_keys: set[tuple[str, str]] = set()
    for reason, predicate in reasons:
        for row in success_rows:
            key = (
                normalize_text(row.get("sd_product_code", "")),
                str(row.get("image_seq", "")),
            )
            if key in seen_keys:
                continue
            if predicate(row):
                selected.append(
                    {
                        "sd_product_code": normalize_text(row.get("sd_product_code", "")),
                        "image_seq": row.get("image_seq", ""),
                        "source_path": normalize_text(row.get("source_path", "")),
                        "derived_path": normalize_text(row.get("derived_path", "")),
                        "check_reason": reason,
                    }
                )
                seen_keys.add(key)
                break
        if len(selected) >= 12:
            break
    return selected


def main() -> int:
    args = build_parser().parse_args()
    results, failures = generate_all(
        input_path=Path(args.input),
        output_dir=Path(args.output_dir),
        overwrite=bool(args.overwrite),
        dry_run=bool(args.dry_run),
    )
    derived_manifest_rows = build_derived_manifest(results)
    summary_rows = build_summary_rows(results, failures)
    visual_check_rows = build_visual_check_rows(results)

    write_csv(Path(args.results_csv), results, RESULT_COLUMNS)
    write_csv(Path(args.failures_csv), failures, FAILURE_COLUMNS)
    write_csv(Path(args.manifest_csv), derived_manifest_rows, DERIVED_MANIFEST_COLUMNS)
    write_csv(Path(args.summary_csv), summary_rows, SUMMARY_COLUMNS)
    write_summary_markdown(Path(args.summary_md), summary_rows)
    write_csv(Path(args.visual_check_csv), visual_check_rows, VISUAL_CHECK_COLUMNS)

    success_rows = [
        row
        for row in results
        if normalize_text(row.get("status", "")) in {"generated", "skipped_existing", "dry_run"}
    ]
    success_products = {
        normalize_text(row.get("sd_product_code", "")).upper()
        for row in success_rows
        if normalize_text(row.get("sd_product_code", ""))
    }
    print(f"target_images={len(results) + len(failures)}")
    print(f"success_images={len(success_rows)}")
    print(f"failed_images={len(failures)}")
    print(f"success_products={len(success_products)}")
    print(Path(args.results_csv).as_posix())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
