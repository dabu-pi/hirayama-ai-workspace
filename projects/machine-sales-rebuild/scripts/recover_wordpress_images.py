from __future__ import annotations

import argparse
import time
from pathlib import Path

from scripts.lib.product_v0 import write_csv
from scripts.lib.wordpress_image_recovery import (
    DEFAULT_USER_AGENT,
    FailureRecord,
    RecoveryImageResult,
    build_failure_row,
    build_results_row,
    ensure_output_path,
    fetch_url,
    iter_effective_candidates,
    load_targets_csv,
    note_code_consistency,
    parse_product_page,
    write_binary_file,
)


DEFAULT_INPUT = Path("data/output/wordpress_recovery_sample_targets.csv")
DEFAULT_OUTPUT_DIR = Path("data/raw-images/wordpress-recovery-sample")
DEFAULT_RESULTS_CSV = Path("data/output/wordpress_recovery_results.csv")
DEFAULT_FAILURES_CSV = Path("data/output/wordpress_recovery_failures.csv")

RESULT_COLUMNS = [
    "sd_product_code",
    "slug",
    "product_url",
    "page_fetch_status",
    "product_code_in_page",
    "hidden_product_code",
    "image_url",
    "image_http_status",
    "saved_path",
    "file_ext",
    "source_type",
    "notes",
]

FAILURE_COLUMNS = [
    "sd_product_code",
    "slug",
    "product_url",
    "failure_stage",
    "reason",
]


def run_recovery(
    *,
    input_path: Path,
    output_dir: Path,
    results_csv_path: Path,
    failures_csv_path: Path,
    timeout_seconds: float,
    sleep_seconds: float,
    retry_count: int,
    allow_og_fallback: bool,
    max_images_per_product: int,
    request_interval_seconds: float,
) -> tuple[list[dict[str, object]], list[dict[str, object]]]:
    targets = load_targets_csv(input_path)
    results: list[dict[str, object]] = []
    failures: list[dict[str, object]] = []

    for target_index, target in enumerate(targets):
        if target_index > 0:
            time.sleep(request_interval_seconds)

        try:
            page_response = fetch_url(
                target.product_url,
                timeout_seconds=timeout_seconds,
                user_agent=DEFAULT_USER_AGENT,
                retry_count=retry_count,
                sleep_seconds=sleep_seconds,
            )
        except Exception as error:
            failures.append(
                build_failure_row(
                    FailureRecord(
                        sd_product_code=target.sd_product_code,
                        slug=target.slug,
                        product_url=target.product_url,
                        failure_stage="page_fetch",
                        reason=str(error),
                    )
                )
            )
            continue

        parsed_page = parse_product_page(
            page_response.text(),
            target.product_url,
            target.sd_product_code,
        )
        code_note = note_code_consistency(target, parsed_page)
        candidates = list(
            iter_effective_candidates(
                parsed_page,
                allow_og_fallback=allow_og_fallback,
            )
        )[:max_images_per_product]

        if not candidates:
            failures.append(
                build_failure_row(
                    FailureRecord(
                        sd_product_code=target.sd_product_code,
                        slug=target.slug,
                        product_url=target.product_url,
                        failure_stage="image_extract",
                        reason="No gallery images found in page HTML.",
                    )
                )
            )
            continue

        for candidate in candidates:
            time.sleep(request_interval_seconds)
            try:
                image_response = fetch_url(
                    candidate.image_url,
                    timeout_seconds=timeout_seconds,
                    user_agent=DEFAULT_USER_AGENT,
                    retry_count=retry_count,
                    sleep_seconds=sleep_seconds,
                )
            except Exception as error:
                failures.append(
                    build_failure_row(
                        FailureRecord(
                            sd_product_code=target.sd_product_code,
                            slug=target.slug,
                            product_url=target.product_url,
                            failure_stage="image_fetch",
                            reason=f"{candidate.image_url}: {error}",
                        )
                    )
                )
                continue

            saved_path = ""
            notes = code_note
            if image_response.status_code == 200:
                output_path = ensure_output_path(
                    output_dir,
                    target.sd_product_code,
                    candidate.image_url,
                )
                write_binary_file(output_path, image_response.content)
                saved_path = output_path.as_posix()
            else:
                notes = " | ".join(
                    value for value in [code_note, f"http_status={image_response.status_code}"] if value
                )

            image_result = RecoveryImageResult(
                image_url=candidate.image_url,
                image_http_status=image_response.status_code,
                saved_path=saved_path,
                file_ext=candidate.file_ext,
                source_type=candidate.source_type,
                notes=notes,
            )
            results.append(
                build_results_row(
                    target=target,
                    page_fetch_status=page_response.status_code,
                    parsed_page=parsed_page,
                    image_result=image_result,
                )
            )

            if image_response.status_code != 200:
                failures.append(
                    build_failure_row(
                        FailureRecord(
                            sd_product_code=target.sd_product_code,
                            slug=target.slug,
                            product_url=target.product_url,
                            failure_stage="image_save",
                            reason=f"{candidate.image_url} returned {image_response.status_code}.",
                        )
                    )
                )

    write_csv(results_csv_path, results, RESULT_COLUMNS)
    write_csv(failures_csv_path, failures, FAILURE_COLUMNS)
    return results, failures


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Recover a small sample of WordPress product images from machine-group.net.",
    )
    parser.add_argument("--input", default=str(DEFAULT_INPUT), help="Recovery target CSV path.")
    parser.add_argument(
        "--output-dir",
        default=str(DEFAULT_OUTPUT_DIR),
        help="Directory to save downloaded sample images.",
    )
    parser.add_argument(
        "--results-csv",
        default=str(DEFAULT_RESULTS_CSV),
        help="CSV path for per-image recovery results.",
    )
    parser.add_argument(
        "--failures-csv",
        default=str(DEFAULT_FAILURES_CSV),
        help="CSV path for failure records.",
    )
    parser.add_argument("--timeout-seconds", type=float, default=20.0, help="HTTP timeout seconds.")
    parser.add_argument("--sleep-seconds", type=float, default=0.5, help="Sleep between requests.")
    parser.add_argument("--retry-count", type=int, default=1, help="Retry count for each HTTP request.")
    parser.add_argument(
        "--max-images-per-product",
        type=int,
        default=10,
        help="Maximum images to download per product page.",
    )
    parser.add_argument(
        "--request-interval-seconds",
        type=float,
        default=0.3,
        help="Minimum interval between HTTP requests.",
    )
    parser.add_argument(
        "--disable-og-fallback",
        action="store_true",
        help="Disable og:image fallback when gallery images are not found.",
    )
    return parser


def _count_unique_products(rows: list[dict[str, object]]) -> int:
    return len({str(row.get("sd_product_code", "")) for row in rows if row.get("sd_product_code")})


def main() -> int:
    args = build_parser().parse_args()
    targets = load_targets_csv(Path(args.input))
    results, failures = run_recovery(
        input_path=Path(args.input),
        output_dir=Path(args.output_dir),
        results_csv_path=Path(args.results_csv),
        failures_csv_path=Path(args.failures_csv),
        timeout_seconds=float(args.timeout_seconds),
        sleep_seconds=float(args.sleep_seconds),
        retry_count=int(args.retry_count),
        allow_og_fallback=not args.disable_og_fallback,
        max_images_per_product=int(args.max_images_per_product),
        request_interval_seconds=float(args.request_interval_seconds),
    )
    print(f"targets={len(targets)}")
    print(f"success_products={_count_unique_products(results)}")
    print(f"downloaded_images={len([row for row in results if row.get('saved_path')])}")
    print(f"failures={len(failures)}")
    print(Path(args.results_csv).as_posix())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
