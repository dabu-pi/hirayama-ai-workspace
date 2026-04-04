from __future__ import annotations

import csv
import json
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Iterable


JST = timezone(timedelta(hours=9))
IMAGE_URL_PATTERN = re.compile(r"^https?://", re.IGNORECASE)

SETTINGS_COLUMNS = [
    "master_type",
    "code",
    "display_name",
    "legacy_value",
    "legacy_code",
    "aliases",
    "is_active",
    "sort_order",
    "site_label",
    "remarks",
]

PRODUCT_MASTER_COLUMNS = [
    "internal_id",
    "sd_product_code",
    "legacy_product_code",
    "serial_no",
    "product_name",
    "maker_code",
    "maker_name",
    "condition_code",
    "condition_label",
    "store_code",
    "store_name",
    "purchase_year",
    "purchase_year_code",
    "part_code",
    "part_label",
    "category_code",
    "category_label",
    "base_price_ex_tax",
    "discount_price_ex_tax",
    "sale_price_ex_tax",
    "cost_ex_tax",
    "shipping_fee_ex_tax",
    "stock_quantity",
    "publish_status",
    "featured_flag",
    "inquiry_enabled",
    "sold_out_flag",
    "description_text",
    "description_html",
    "search_keywords",
    "size_text",
    "weight_text",
    "source_image_urls_json",
    "source_image_count",
    "main_image_index",
    "main_source_image_url",
    "seo_slug",
    "seo_title",
    "seo_description",
    "purchase_date",
    "supplier_name",
    "sold_date",
    "sold_price_ex_tax",
    "sold_to",
    "legacy_wp_post_id",
    "legacy_wp_category_text",
    "legacy_base_export_flag",
    "source_sheet_name",
    "source_row_no",
    "remarks",
    "created_at",
    "updated_at",
    "code_validation_status",
    "code_validation_message",
    "code_validated_at",
]

SITE_OUTPUT_VIEW_COLUMNS = [
    "internal_id",
    "sd_product_code",
    "slug",
    "title",
    "summary_text",
    "description_text",
    "description_html",
    "maker_code",
    "maker_label",
    "store_code",
    "store_label",
    "condition_code",
    "condition_label",
    "part_code",
    "part_label",
    "category_code",
    "category_label",
    "display_price_ex_tax",
    "base_price_ex_tax",
    "discount_price_ex_tax",
    "shipping_fee_ex_tax",
    "price_label",
    "display_image_urls_json",
    "main_display_image_url",
    "source_image_urls_json",
    "display_image_size",
    "image_alt",
    "publish_status",
    "is_published",
    "featured_flag",
    "sold_out_flag",
    "inquiry_enabled",
    "search_text",
    "sort_updated_at",
    "sort_price_ex_tax",
    "seo_title",
    "seo_description",
    "canonical_path",
    "updated_at",
]

COMPETITOR_DATA_COLUMNS = [
    "competitor_record_id",
    "source_site",
    "fetched_at",
    "source_url",
    "product_name",
    "maker_name",
    "current_price_ex_tax",
    "maintenance_price_ex_tax",
    "category_name",
    "image_urls_json",
    "collect_status",
    "review_status",
    "linked_internal_id",
    "match_confidence",
    "memo",
]

QUOTATION_INPUT_STUB_COLUMNS = [
    "quote_id",
    "line_no",
    "item_source_type",
    "item_code",
    "item_name",
    "quantity",
    "unit_price_ex_tax",
    "discount_amount_ex_tax",
    "line_amount_ex_tax",
    "internal_id",
    "sd_product_code",
    "maker_name",
    "cost_ex_tax",
    "shipping_fee_ex_tax",
    "installation_fee_ex_tax",
    "tax_rate",
    "line_note",
    "validation_status",
    "validation_message",
]

QUOTATION_HISTORY_STUB_COLUMNS = [
    "quote_id",
    "customer_name",
    "quote_status",
    "subtotal_ex_tax",
    "tax_amount",
    "total_in_tax",
    "quoted_at",
    "deal_id",
    "source_spreadsheet_id",
    "source_sheet_name",
    "quote_sheet_url",
    "freee_partner_id",
    "freee_quotation_id",
    "gmail_message_id",
    "owner_name",
    "memo",
]

ARCHIVE_STUB_COLUMNS = [
    "archive_id",
    "spreadsheet_name",
    "sheet_name",
    "current_judgement",
    "archive_reason",
    "replacement_doc_or_sheet",
    "checked_at",
    "spreadsheet_id",
    "sheet_gid",
    "owner",
    "last_seen_updated_at",
    "risk_note",
    "memo",
]

TEMPLATE_TABLES = {
    "product_master.csv": PRODUCT_MASTER_COLUMNS,
    "settings_store.csv": SETTINGS_COLUMNS,
    "settings_maker.csv": SETTINGS_COLUMNS,
    "settings_part.csv": SETTINGS_COLUMNS,
    "settings_condition.csv": SETTINGS_COLUMNS,
    "settings_category.csv": SETTINGS_COLUMNS,
    "site_output_view.csv": SITE_OUTPUT_VIEW_COLUMNS,
    "competitor_data.csv": COMPETITOR_DATA_COLUMNS,
    "quotation_input_stub.csv": QUOTATION_INPUT_STUB_COLUMNS,
    "quotation_history_stub.csv": QUOTATION_HISTORY_STUB_COLUMNS,
    "archive_stub.csv": ARCHIVE_STUB_COLUMNS,
}


@dataclass(frozen=True)
class MasterRecord:
    master_type: str
    code: str
    display_name: str
    legacy_value: str = ""
    legacy_code: str = ""
    aliases: tuple[str, ...] = field(default_factory=tuple)
    is_active: bool = True
    sort_order: int = 0
    site_label: str = ""
    remarks: str = ""

    @property
    def label(self) -> str:
        return self.site_label or self.display_name or self.code


@dataclass
class SettingsRegistry:
    by_type: dict[str, dict[str, MasterRecord]] = field(default_factory=dict)
    by_legacy_value: dict[str, dict[str, MasterRecord]] = field(default_factory=dict)
    by_legacy_code: dict[str, dict[str, list[MasterRecord]]] = field(default_factory=dict)

    def add(self, record: MasterRecord) -> None:
        self.by_type.setdefault(record.master_type, {})[record.code] = record

        if record.legacy_value:
            self.by_legacy_value.setdefault(record.master_type, {})[
                normalize_key(record.legacy_value)
            ] = record

        if record.display_name:
            self.by_legacy_value.setdefault(record.master_type, {})[
                normalize_key(record.display_name)
            ] = record

        for alias in record.aliases:
            self.by_legacy_value.setdefault(record.master_type, {})[
                normalize_key(alias)
            ] = record

        legacy_code_key = record.legacy_code or ""
        self.by_legacy_code.setdefault(record.master_type, {}).setdefault(
            legacy_code_key.upper(), []
        ).append(record)

    def find(self, master_type: str, value: str) -> MasterRecord | None:
        key = normalize_key(value)
        if not key:
            return None
        return (
            self.by_type.get(master_type, {}).get(value)
            or self.by_type.get(master_type, {}).get(key)
            or self.by_legacy_value.get(master_type, {}).get(key)
        )

    def all_legacy_codes(self, master_type: str) -> list[str]:
        return sorted(
            self.by_legacy_code.get(master_type, {}).keys(),
            key=lambda value: (-len(value), value),
        )

    def legacy_code_map(self, master_type: str) -> dict[str, list[str]]:
        return {
            legacy_code: [record.code for record in records]
            for legacy_code, records in self.by_legacy_code.get(master_type, {}).items()
        }


def normalize_text(value: object) -> str:
    if value is None:
        return ""
    return unicodedata.normalize("NFKC", str(value)).strip()


def normalize_key(value: object) -> str:
    return normalize_text(value).casefold()


def parse_bool(value: object) -> bool:
    text = normalize_text(value).casefold()
    return text in {"1", "true", "yes", "y", "on", "はい", "公開", "トップ", "掲載", "true"}


def parse_number(value: object) -> int | None:
    text = normalize_text(value)
    if not text:
        return None
    text = text.replace(",", "")
    try:
        return int(float(text))
    except ValueError:
        return None


def parse_date(value: object) -> str:
    text = normalize_text(value)
    if not text:
        return ""
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(text, fmt).date().isoformat()
        except ValueError:
            continue
    return text


def now_jst_iso() -> str:
    return datetime.now(JST).replace(microsecond=0).isoformat()


def make_internal_id(row_no: int) -> str:
    return f"P{row_no:07d}"


def derive_purchase_year_code(purchase_year: str) -> str:
    text = normalize_text(purchase_year)
    if not text:
        return ""
    if text.upper() == "MD":
        return "MD"
    match = re.search(r"(\d{2})$", text)
    return match.group(1) if match else text


def slugify(value: str, fallback: str) -> str:
    source = normalize_text(value) or normalize_text(fallback)
    ascii_text = unicodedata.normalize("NFKD", source).encode("ascii", "ignore").decode("ascii")
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", ascii_text).strip("-").lower()
    if slug:
        return slug
    fallback_text = normalize_text(fallback).lower()
    return re.sub(r"[^a-z0-9]+", "-", fallback_text).strip("-") or "product"


def is_probable_image_url(value: object) -> bool:
    return bool(IMAGE_URL_PATTERN.match(normalize_text(value)))


def parse_source_images(row: dict[str, str], max_images: int = 10) -> list[str]:
    urls: list[str] = []
    for column_name in ("画像1", "画像2", "画像3"):
        url = normalize_text(row.get(column_name, ""))
        if url and is_probable_image_url(url):
            urls.append(url)
    return urls[:max_images]


def collect_suspicious_image_values(row: dict[str, str]) -> list[tuple[str, str]]:
    suspicious_values: list[tuple[str, str]] = []
    for column_name in ("画像1", "画像2", "画像3"):
        value = normalize_text(row.get(column_name, ""))
        if value and not is_probable_image_url(value):
            suspicious_values.append((column_name, value))
    return suspicious_values


def parse_source_image_json(raw_json: str, max_images: int = 10) -> list[str]:
    text = normalize_text(raw_json)
    if not text:
        return []
    try:
        value = json.loads(text)
    except json.JSONDecodeError:
        return []
    if not isinstance(value, list):
        return []
    return [normalize_text(item) for item in value if normalize_text(item)][:max_images]


def build_search_text(*parts: object) -> str:
    values = [normalize_text(part) for part in parts if normalize_text(part)]
    return " ".join(values)


def infer_publish_status(raw_publish_status: str, condition_code: str) -> str:
    text = normalize_text(raw_publish_status)
    if text in {"非公開", "private"}:
        return "private"
    if text in {"下書き", "draft"}:
        return "draft"
    if condition_code == "sold":
        return "sold_visible"
    return "public"


def infer_visibility_fields(
    publish_status: str,
    condition_code: str,
    inquiry_enabled: bool,
) -> tuple[bool, bool, bool]:
    sold_out_flag = condition_code == "sold"
    is_published = publish_status in {"public", "sold_visible"}
    effective_inquiry_enabled = inquiry_enabled and not sold_out_flag and is_published
    return is_published, sold_out_flag, effective_inquiry_enabled


def load_settings_registry(seed_dir: str | Path) -> SettingsRegistry:
    registry = SettingsRegistry()
    seed_path = Path(seed_dir)
    for master_type in ("store", "maker", "part", "condition", "category"):
        file_path = seed_path / f"settings_{master_type}.csv"
        if not file_path.exists():
            continue
        with file_path.open("r", encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            for row in reader:
                aliases = tuple(
                    normalize_text(alias)
                    for alias in normalize_text(row.get("aliases", "")).split("|")
                    if normalize_text(alias)
                )
                registry.add(
                    MasterRecord(
                        master_type=normalize_text(row.get("master_type", master_type))
                        or master_type,
                        code=normalize_text(row.get("code", "")),
                        display_name=normalize_text(row.get("display_name", "")),
                        legacy_value=normalize_text(row.get("legacy_value", "")),
                        legacy_code=normalize_text(row.get("legacy_code", "")),
                        aliases=aliases,
                        is_active=parse_bool(row.get("is_active", "true")),
                        sort_order=parse_number(row.get("sort_order")) or 0,
                        site_label=normalize_text(row.get("site_label", "")),
                        remarks=normalize_text(row.get("remarks", "")),
                    )
                )
    return registry


def write_csv(path: str | Path, rows: Iterable[dict[str, object]], columns: list[str]) -> None:
    output_path = Path(path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=columns)
        writer.writeheader()
        for row in rows:
            writer.writerow({column: row.get(column, "") for column in columns})
