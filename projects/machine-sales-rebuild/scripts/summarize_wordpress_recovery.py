from __future__ import annotations

import argparse
import csv
from pathlib import Path

from scripts.lib.product_v0 import normalize_text, parse_number, write_csv


DEFAULT_TARGETS = Path("data/output/wordpress_recovery_public_targets.csv")
DEFAULT_RESULTS = Path("data/output/wordpress_recovery_public_results.csv")
DEFAULT_FAILURES = Path("data/output/wordpress_recovery_public_failures.csv")
DEFAULT_MANIFEST = Path("data/output/public_image_manifest.csv")
DEFAULT_SUMMARY_CSV = Path("data/output/wordpress_public_recovery_summary.csv")
DEFAULT_SUMMARY_MD = Path("data/output/wordpress_public_recovery_summary.md")

MANIFEST_COLUMNS = [
    "sd_product_code",
    "slug",
    "image_seq",
    "original_image_url",
    "saved_path",
    "file_ext",
    "source_type",
    "is_primary_candidate",
    "notes",
]

SUMMARY_COLUMNS = [
    "metric",
    "value",
    "notes",
]


def load_csv_rows(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return [dict(row) for row in csv.DictReader(handle)]


def build_manifest_rows(results: list[dict[str, str]]) -> list[dict[str, object]]:
    grouped: dict[tuple[str, str], list[dict[str, str]]] = {}
    for row in results:
        if not normalize_text(row.get("saved_path", "")):
            continue
        key = (
            normalize_text(row.get("sd_product_code", "")).upper(),
            normalize_text(row.get("slug", "")).lower(),
        )
        grouped.setdefault(key, []).append(row)

    manifest_rows: list[dict[str, object]] = []
    for (sd_product_code, slug), group_rows in sorted(grouped.items()):
        sorted_rows = sorted(group_rows, key=_image_sort_key)
        for index, row in enumerate(sorted_rows, start=1):
            manifest_rows.append(
                {
                    "sd_product_code": sd_product_code,
                    "slug": slug,
                    "image_seq": index,
                    "original_image_url": normalize_text(row.get("image_url", "")),
                    "saved_path": normalize_text(row.get("saved_path", "")),
                    "file_ext": normalize_text(row.get("file_ext", "")),
                    "source_type": normalize_text(row.get("source_type", "")),
                    "is_primary_candidate": "true" if index == 1 else "false",
                    "notes": normalize_text(row.get("notes", "")),
                }
            )
    return manifest_rows


def _image_sort_key(row: dict[str, str]) -> tuple[int, str]:
    image_url = normalize_text(row.get("image_url", ""))
    import re

    match = re.search(r"_(\d+)\.[A-Za-z0-9]+$", image_url)
    seq = int(match.group(1)) if match else 999
    return seq, image_url


def build_summary_rows(
    targets: list[dict[str, str]],
    results: list[dict[str, str]],
    failures: list[dict[str, str]],
) -> list[dict[str, object]]:
    target_codes = {
        normalize_text(row.get("sd_product_code", "")).upper()
        for row in targets
        if normalize_text(row.get("sd_product_code", ""))
    }
    success_codes = {
        normalize_text(row.get("sd_product_code", "")).upper()
        for row in results
        if normalize_text(row.get("saved_path", ""))
    }
    images_per_product: dict[str, int] = {}
    ext_counter: dict[str, int] = {}
    failure_counter: dict[str, int] = {}

    for row in results:
        if not normalize_text(row.get("saved_path", "")):
            continue
        code = normalize_text(row.get("sd_product_code", "")).upper()
        images_per_product[code] = images_per_product.get(code, 0) + 1
        ext = normalize_text(row.get("file_ext", "")).lower() or "(unknown)"
        ext_counter[ext] = ext_counter.get(ext, 0) + 1

    for row in failures:
        stage = normalize_text(row.get("failure_stage", "")) or "(unknown)"
        failure_counter[stage] = failure_counter.get(stage, 0) + 1

    image_count_distribution: dict[int, int] = {}
    for code in target_codes:
        image_count = images_per_product.get(code, 0)
        image_count_distribution[image_count] = image_count_distribution.get(image_count, 0) + 1

    summary_rows = [
        {"metric": "target_products", "value": len(target_codes), "notes": ""},
        {"metric": "success_products", "value": len(success_codes), "notes": ""},
        {"metric": "failed_products", "value": len(target_codes - success_codes), "notes": ""},
        {"metric": "saved_images", "value": sum(images_per_product.values()), "notes": ""},
        {"metric": "zero_image_products", "value": image_count_distribution.get(0, 0), "notes": ""},
    ]

    for image_count in sorted(image_count_distribution):
        summary_rows.append(
            {
                "metric": f"image_count_distribution_{image_count}",
                "value": image_count_distribution[image_count],
                "notes": f"products_with_{image_count}_images",
            }
        )

    for ext, count in sorted(ext_counter.items()):
        summary_rows.append(
            {
                "metric": f"file_ext_{ext}",
                "value": count,
                "notes": "saved_image_count",
            }
        )

    for stage, count in sorted(failure_counter.items()):
        summary_rows.append(
            {
                "metric": f"failure_stage_{stage}",
                "value": count,
                "notes": "failure_records",
            }
        )
    return summary_rows


def write_summary_markdown(
    path: Path,
    *,
    targets: list[dict[str, str]],
    results: list[dict[str, str]],
    failures: list[dict[str, str]],
) -> None:
    target_codes = {
        normalize_text(row.get("sd_product_code", "")).upper()
        for row in targets
        if normalize_text(row.get("sd_product_code", ""))
    }
    success_codes = {
        normalize_text(row.get("sd_product_code", "")).upper()
        for row in results
        if normalize_text(row.get("saved_path", ""))
    }
    failed_codes = sorted(target_codes - success_codes)
    images_per_product: dict[str, int] = {}
    ext_counter: dict[str, int] = {}

    for row in results:
        if not normalize_text(row.get("saved_path", "")):
            continue
        code = normalize_text(row.get("sd_product_code", "")).upper()
        images_per_product[code] = images_per_product.get(code, 0) + 1
        ext = normalize_text(row.get("file_ext", "")).lower() or "(unknown)"
        ext_counter[ext] = ext_counter.get(ext, 0) + 1

    lines = [
        "# 公開商品WordPress画像回収サマリー",
        "",
        f"- 対象商品数: {len(target_codes)}",
        f"- 成功商品数: {len(success_codes)}",
        f"- 失敗商品数: {len(failed_codes)}",
        f"- 保存画像総数: {sum(images_per_product.values())}",
        f"- 画像0枚商品数: {sum(1 for code in target_codes if images_per_product.get(code, 0) == 0)}",
        "",
        "## 拡張子分布",
        "",
    ]
    for ext, count in sorted(ext_counter.items()):
        lines.append(f"- {ext}: {count}")

    lines.extend(["", "## 失敗商品", ""])
    if failed_codes:
        for code in failed_codes:
            lines.append(f"- {code}")
    else:
        lines.append("- なし")

    if failures:
        lines.extend(["", "## 主な失敗レコード", ""])
        for row in failures[:20]:
            lines.append(
                f"- {normalize_text(row.get('sd_product_code', ''))}: "
                f"{normalize_text(row.get('failure_stage', ''))} / "
                f"{normalize_text(row.get('reason', ''))}"
            )

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Build manifest and summary files from WordPress public recovery results.",
    )
    parser.add_argument("--targets", default=str(DEFAULT_TARGETS), help="Public target CSV path.")
    parser.add_argument("--results", default=str(DEFAULT_RESULTS), help="Recovery results CSV path.")
    parser.add_argument("--failures", default=str(DEFAULT_FAILURES), help="Recovery failures CSV path.")
    parser.add_argument("--manifest", default=str(DEFAULT_MANIFEST), help="Manifest CSV output path.")
    parser.add_argument("--summary-csv", default=str(DEFAULT_SUMMARY_CSV), help="Summary CSV output path.")
    parser.add_argument("--summary-md", default=str(DEFAULT_SUMMARY_MD), help="Summary markdown output path.")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    targets = load_csv_rows(Path(args.targets))
    results = load_csv_rows(Path(args.results))
    failures = load_csv_rows(Path(args.failures))
    manifest_rows = build_manifest_rows(results)
    summary_rows = build_summary_rows(targets, results, failures)

    write_csv(Path(args.manifest), manifest_rows, MANIFEST_COLUMNS)
    write_csv(Path(args.summary_csv), summary_rows, SUMMARY_COLUMNS)
    write_summary_markdown(
        Path(args.summary_md),
        targets=targets,
        results=results,
        failures=failures,
    )
    success_products = {
        normalize_text(row.get("sd_product_code", "")).upper()
        for row in results
        if normalize_text(row.get("saved_path", ""))
    }
    print(f"targets={len(targets)}")
    print(f"success_products={len(success_products)}")
    print(f"manifest_rows={len(manifest_rows)}")
    print(Path(args.manifest).as_posix())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
