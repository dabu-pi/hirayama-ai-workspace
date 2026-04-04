from __future__ import annotations

import argparse
import csv
import json
from dataclasses import dataclass, field
from pathlib import Path

from scripts.lib.product_v0 import (
    PRODUCT_MASTER_COLUMNS,
    SettingsRegistry,
    build_search_text,
    derive_purchase_year_code,
    infer_publish_status,
    infer_visibility_fields,
    load_settings_registry,
    make_internal_id,
    normalize_text,
    now_jst_iso,
    parse_bool,
    parse_date,
    parse_number,
    parse_source_images,
    slugify,
    write_csv,
)
from scripts.lib.sd_product_code import validate_sd_product_code


DEFAULT_INPUT = Path("data/samples/current_product_master_input_sample.csv")
DEFAULT_OUTPUT = Path("data/samples/product_master_v0_sample.csv")
DEFAULT_SEED_DIR = Path("data/seeds")
DEFAULT_LOG = Path("data/output/transform_current_to_v0.log")
DEFAULT_ERROR_CSV = Path("data/output/transform_current_to_v0_errors.csv")
DEFAULT_UNMAPPED_JSON = Path("data/output/transform_current_to_v0_unmapped.json")

CURRENT_COLUMNS_USED = {
    "通し番号",
    "メーカー名",
    "商品名",
    "定価（税抜き）",
    "商品説明",
    "状態",
    "店舗",
    "仕入れ年",
    "鍛える部位",
    "トレーニングマシンの種類",
    "サイズ",
    "重量",
    "検索キーワード",
    "公開状態",
    "新規自動生成商品コード",
    "画像1",
    "画像2",
    "画像3",
    "BASEで販売しない場合は「いいえ」を入力",
    "トップページ掲載",
    "値引き後の価格（税抜き）",
    "仕入年月日",
    "仕入先",
    "原価",
    "送料",
    "売値計算式",
    "数",
    "販売年月日",
    "売却価格",
    "販売先",
    "Wordpress用csv.post_id",
    "Wordpress用csv.tax_products-category",
    "Wordpress用csv.post_name",
}


@dataclass
class TransformIssue:
    row_no: int
    level: str
    issue_code: str
    message: str
    sd_product_code: str = ""

    def as_row(self) -> dict[str, object]:
        return {
            "row_no": self.row_no,
            "level": self.level,
            "issue_code": self.issue_code,
            "message": self.message,
            "sd_product_code": self.sd_product_code,
        }


@dataclass
class TransformResult:
    rows: list[dict[str, object]] = field(default_factory=list)
    issues: list[TransformIssue] = field(default_factory=list)
    unmapped_columns: dict[str, int] = field(default_factory=dict)


def _resolve_master(
    registry: SettingsRegistry,
    master_type: str,
    raw_value: str,
    fallback_code: str,
) -> tuple[str, str, str, str]:
    source_value = normalize_text(raw_value)
    record = registry.find(master_type, source_value)
    if record:
        return record.code, record.label, record.legacy_code, ""
    if not source_value:
        return fallback_code, "未設定", "", f"{master_type} is empty."
    return (
        fallback_code,
        source_value,
        "",
        f"{master_type} is not registered: {source_value}.",
    )


def _build_code_validation(
    row: dict[str, str],
    output_row: dict[str, object],
    registry: SettingsRegistry,
) -> tuple[str, str]:
    sd_product_code = normalize_text(output_row.get("sd_product_code", ""))
    validation = validate_sd_product_code(
        sd_product_code=sd_product_code,
        store_legacy_codes=registry.all_legacy_codes("store"),
        maker_legacy_codes=registry.all_legacy_codes("maker"),
        part_legacy_codes=registry.all_legacy_codes("part"),
        maker_legacy_code_map=registry.legacy_code_map("maker"),
        expected_store_legacy_code=normalize_text(output_row.get("store_legacy_code", "")),
        expected_maker_legacy_code=normalize_text(output_row.get("maker_legacy_code", "")),
        expected_purchase_year_code=normalize_text(
            output_row.get("purchase_year_code", "")
        ),
        expected_serial_no=output_row.get("serial_no", ""),
        expected_part_legacy_code=normalize_text(output_row.get("part_legacy_code", "")),
        mode="lenient",
        allow_legacy_empty_part=True,
    )
    status = validation.status()
    message = " | ".join(validation.messages())
    if not sd_product_code:
        status = "error"
        message = "sd_product_code is empty."
    return status, message


def _number_or_empty(value: str) -> int | float | str:
    parsed = parse_number(value)
    return parsed if parsed is not None else ""


def _number_or_default(value: str, default_value: int | float) -> int | float:
    parsed = parse_number(value)
    return parsed if parsed is not None else default_value


def transform_rows(
    rows: list[dict[str, str]],
    registry: SettingsRegistry,
    *,
    source_sheet_name: str,
    generated_at: str,
) -> TransformResult:
    result = TransformResult()
    input_columns = set(rows[0].keys()) if rows else set()
    result.unmapped_columns = {
        column: 0 for column in sorted(input_columns - CURRENT_COLUMNS_USED)
    }

    for row_index, current_row in enumerate(rows, start=2):
        for column_name in result.unmapped_columns:
            if normalize_text(current_row.get(column_name, "")):
                result.unmapped_columns[column_name] += 1

        maker_code, maker_name, maker_legacy_code, maker_issue = _resolve_master(
            registry,
            "maker",
            current_row.get("メーカー名", ""),
            "UNREGISTERED_MAKER",
        )
        store_code, store_name, store_legacy_code, store_issue = _resolve_master(
            registry,
            "store",
            current_row.get("店舗", ""),
            "UNREGISTERED_STORE",
        )
        part_code, part_label, part_legacy_code, part_issue = _resolve_master(
            registry,
            "part",
            current_row.get("鍛える部位", ""),
            "UNREGISTERED_PART",
        )
        condition_code, condition_label, _, condition_issue = _resolve_master(
            registry,
            "condition",
            current_row.get("状態", ""),
            "unknown",
        )
        category_code, category_label, _, category_issue = _resolve_master(
            registry,
            "category",
            current_row.get("トレーニングマシンの種類", ""),
            "uncategorized",
        )

        source_images = parse_source_images(current_row, max_images=10)
        source_image_count = len(source_images)
        main_image_index = 1 if source_image_count else ""
        main_source_image_url = source_images[0] if source_images else ""

        base_price = parse_number(current_row.get("定価（税抜き）"))
        discount_price = parse_number(current_row.get("値引き後の価格（税抜き）"))
        sale_price = discount_price if discount_price is not None else base_price

        publish_status = infer_publish_status(
            current_row.get("公開状態", ""),
            condition_code,
        )
        is_published, sold_out_flag, inquiry_enabled = infer_visibility_fields(
            publish_status,
            condition_code,
            inquiry_enabled=True,
        )

        serial_no = parse_number(current_row.get("通し番号"))
        purchase_year = normalize_text(current_row.get("仕入れ年", ""))
        purchase_year_code = derive_purchase_year_code(purchase_year)
        sd_product_code = normalize_text(current_row.get("新規自動生成商品コード", ""))

        output_row: dict[str, object] = {
            "internal_id": make_internal_id(row_index - 1),
            "sd_product_code": sd_product_code,
            "legacy_product_code": "",
            "serial_no": serial_no if serial_no is not None else "",
            "product_name": normalize_text(current_row.get("商品名", "")),
            "maker_code": maker_code,
            "maker_name": maker_name,
            "condition_code": condition_code,
            "condition_label": condition_label,
            "store_code": store_code,
            "store_name": store_name,
            "purchase_year": purchase_year,
            "purchase_year_code": purchase_year_code,
            "part_code": part_code,
            "part_label": part_label,
            "category_code": category_code,
            "category_label": category_label,
            "base_price_ex_tax": base_price if base_price is not None else "",
            "discount_price_ex_tax": (
                discount_price if discount_price is not None else ""
            ),
            "sale_price_ex_tax": sale_price if sale_price is not None else "",
            "cost_ex_tax": _number_or_empty(current_row.get("原価", "")),
            "shipping_fee_ex_tax": _number_or_empty(current_row.get("送料", "")),
            "stock_quantity": _number_or_default(current_row.get("数", ""), 1),
            "publish_status": publish_status,
            "featured_flag": parse_bool(current_row.get("トップページ掲載")),
            "inquiry_enabled": inquiry_enabled,
            "sold_out_flag": sold_out_flag,
            "description_text": normalize_text(current_row.get("商品説明", "")),
            "description_html": normalize_text(current_row.get("商品説明", "")),
            "search_keywords": normalize_text(current_row.get("検索キーワード", "")),
            "size_text": normalize_text(current_row.get("サイズ", "")),
            "weight_text": normalize_text(current_row.get("重量", "")),
            "source_image_urls_json": json.dumps(source_images, ensure_ascii=False),
            "source_image_count": source_image_count,
            "main_image_index": main_image_index,
            "main_source_image_url": main_source_image_url,
            "seo_slug": slugify(
                normalize_text(current_row.get("Wordpress用csv.post_name", "")),
                sd_product_code,
            ),
            "seo_title": "",
            "seo_description": "",
            "purchase_date": parse_date(current_row.get("仕入年月日", "")),
            "supplier_name": normalize_text(current_row.get("仕入先", "")),
            "sold_date": parse_date(current_row.get("販売年月日", "")),
            "sold_price_ex_tax": _number_or_empty(current_row.get("売却価格", "")),
            "sold_to": normalize_text(current_row.get("販売先", "")),
            "legacy_wp_post_id": normalize_text(
                current_row.get("Wordpress用csv.post_id", "")
            )
            or (
                str(serial_no + 2000)
                if serial_no is not None
                else ""
            ),
            "legacy_wp_category_text": normalize_text(
                current_row.get("Wordpress用csv.tax_products-category", "")
            ),
            "legacy_base_export_flag": normalize_text(
                current_row.get("BASEで販売しない場合は「いいえ」を入力", "")
            ),
            "source_sheet_name": source_sheet_name,
            "source_row_no": row_index,
            "remarks": normalize_text(current_row.get("売値計算式", "")),
            "created_at": generated_at,
            "updated_at": generated_at,
            "code_validated_at": generated_at,
            "store_legacy_code": store_legacy_code,
            "maker_legacy_code": maker_legacy_code,
            "part_legacy_code": part_legacy_code,
        }

        code_status, code_message = _build_code_validation(
            current_row,
            output_row,
            registry,
        )
        output_row["code_validation_status"] = code_status
        output_row["code_validation_message"] = code_message

        del output_row["store_legacy_code"]
        del output_row["maker_legacy_code"]
        del output_row["part_legacy_code"]

        result.rows.append(output_row)

        for issue_code, message in (
            ("maker_unregistered", maker_issue),
            ("store_unregistered", store_issue),
            ("part_unregistered", part_issue),
            ("condition_unregistered", condition_issue),
            ("category_unregistered", category_issue),
        ):
            if message:
                result.issues.append(
                    TransformIssue(
                        row_no=row_index,
                        level="warning",
                        issue_code=issue_code,
                        message=message,
                        sd_product_code=sd_product_code,
                    )
                )

        if source_image_count == 0:
            result.issues.append(
                TransformIssue(
                    row_no=row_index,
                    level="warning",
                    issue_code="image_missing",
                    message="No source image URLs found in 画像1〜3.",
                    sd_product_code=sd_product_code,
                )
            )

        if code_status != "ok":
            result.issues.append(
                TransformIssue(
                    row_no=row_index,
                    level=code_status,
                    issue_code="sd_product_code_validation",
                    message=code_message,
                    sd_product_code=sd_product_code,
                )
            )

    return result


def load_current_rows(input_path: Path) -> list[dict[str, str]]:
    with input_path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        return [dict(row) for row in reader]


def write_transform_log(log_path: Path, result: TransformResult) -> None:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        f"rows={len(result.rows)}",
        f"issues={len(result.issues)}",
        "",
    ]
    for issue in result.issues:
        lines.append(
            f"[{issue.level}] row={issue.row_no} code={issue.sd_product_code} "
            f"{issue.issue_code}: {issue.message}"
        )
    log_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_unmapped_report(path: Path, unmapped_columns: dict[str, int]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "unmappedColumns": [
            {"column": column, "nonEmptyCount": count}
            for column, count in unmapped_columns.items()
        ]
    }
    path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def run_transform(
    input_path: Path,
    output_path: Path,
    seed_dir: Path,
    log_path: Path,
    error_csv_path: Path,
    unmapped_json_path: Path,
) -> TransformResult:
    rows = load_current_rows(input_path)
    registry = load_settings_registry(seed_dir)
    result = transform_rows(
        rows,
        registry,
        source_sheet_name=input_path.stem,
        generated_at=now_jst_iso(),
    )
    write_csv(output_path, result.rows, PRODUCT_MASTER_COLUMNS)
    write_csv(
        error_csv_path,
        [issue.as_row() for issue in result.issues],
        ["row_no", "level", "issue_code", "message", "sd_product_code"],
    )
    write_transform_log(log_path, result)
    write_unmapped_report(unmapped_json_path, result.unmapped_columns)
    return result


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Transform current product master CSV to product_master v0 prototype.",
    )
    parser.add_argument("--input", default=str(DEFAULT_INPUT), help="Current product CSV path.")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT), help="Output product_master v0 CSV path.")
    parser.add_argument("--seed-dir", default=str(DEFAULT_SEED_DIR), help="Settings seed CSV directory.")
    parser.add_argument("--log", default=str(DEFAULT_LOG), help="Transform log output path.")
    parser.add_argument(
        "--error-csv",
        default=str(DEFAULT_ERROR_CSV),
        help="Error/warning row CSV output path.",
    )
    parser.add_argument(
        "--unmapped-json",
        default=str(DEFAULT_UNMAPPED_JSON),
        help="Unmapped current-column report path.",
    )
    return parser


def main() -> int:
    args = build_parser().parse_args()
    result = run_transform(
        input_path=Path(args.input),
        output_path=Path(args.output),
        seed_dir=Path(args.seed_dir),
        log_path=Path(args.log),
        error_csv_path=Path(args.error_csv),
        unmapped_json_path=Path(args.unmapped_json),
    )
    print(f"rows={len(result.rows)}")
    print(f"issues={len(result.issues)}")
    print(Path(args.output).as_posix())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
