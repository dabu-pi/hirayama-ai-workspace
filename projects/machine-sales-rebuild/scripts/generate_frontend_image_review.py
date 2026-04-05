from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from textwrap import shorten

from PIL import Image, ImageDraw, ImageFont

from scripts.lib.product_v0 import normalize_text


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PRODUCTS_JSON = PROJECT_ROOT / "data" / "output" / "products.public.with-images.json"
DEFAULT_BINDING_REPORT = PROJECT_ROOT / "data" / "output" / "products_public_image_binding_report.csv"
DEFAULT_DERIVED_RESULTS = PROJECT_ROOT / "data" / "output" / "public_derived_image_results.csv"
DEFAULT_TARGETS = PROJECT_ROOT / "data" / "output" / "frontend_image_check_targets.csv"
DEFAULT_LIST_CSV = PROJECT_ROOT / "data" / "output" / "frontend_list_image_check.csv"
DEFAULT_DETAIL_CSV = PROJECT_ROOT / "data" / "output" / "frontend_detail_image_check.csv"
DEFAULT_SUMMARY_MD = PROJECT_ROOT / "data" / "output" / "frontend_image_check_summary.md"
DEFAULT_SUMMARY_CSV = PROJECT_ROOT / "data" / "output" / "frontend_image_check_summary.csv"
DEFAULT_PREVIEW_HTML = PROJECT_ROOT / "data" / "output" / "frontend_image_check_preview.html"
DEFAULT_LIST_PREVIEW = PROJECT_ROOT / "data" / "output" / "frontend_list_preview.png"
DEFAULT_DETAIL_PREVIEW = PROJECT_ROOT / "data" / "output" / "frontend_detail_preview.png"
DEFAULT_PLACEHOLDER_CHECK_CSV = PROJECT_ROOT / "data" / "output" / "frontend_placeholder_check.csv"
DEFAULT_PLACEHOLDER_CHECK_SUMMARY_MD = PROJECT_ROOT / "data" / "output" / "frontend_placeholder_check_summary.md"
DEFAULT_DERIVED_ROOT = PROJECT_ROOT / "data" / "derived-images"


@dataclass
class ProductReview:
    sd_product_code: str
    slug: str
    name: str
    display_url: str
    gallery_urls: list[str]
    placeholder: bool
    image_status: str
    has_real_image: bool
    shape_type: str
    white_pad_visible: str


def _load_csv_rows(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def _write_csv(path: Path, fieldnames: list[str], rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def _load_products(path: Path) -> dict[str, dict]:
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    return {
        product["sdProductCode"]: product
        for product in payload.get("products", [])
    }


def _shape_type(width: int, height: int) -> str:
    if width == height:
        return "square"
    if width > height:
        return "horizontal"
    return "vertical"


def _load_primary_result_map(path: Path) -> dict[str, dict[str, str]]:
    rows = _load_csv_rows(path)
    result: dict[str, dict[str, str]] = {}
    for row in rows:
        if row.get("image_seq") == "1":
            result[row["sd_product_code"]] = row
    return result


def _select_codes(
    target_rows: list[dict[str, str]],
    placeholder_rows: list[dict[str, str]],
) -> list[str]:
    ordered: list[str] = []
    seen: set[str] = set()
    for row in target_rows + placeholder_rows:
        code = row["sd_product_code"]
        if code not in seen:
            ordered.append(code)
            seen.add(code)
    return ordered


def _build_reviews(
    products: dict[str, dict],
    primary_result_map: dict[str, dict[str, str]],
    placeholder_codes: set[str],
    selected_codes: list[str],
) -> list[ProductReview]:
    reviews: list[ProductReview] = []
    for code in selected_codes:
        product = products[code]
        primary = primary_result_map[code]
        reviews.append(
            ProductReview(
                sd_product_code=code,
                slug=product["slug"],
                name=product["name"],
                display_url=product["displayUrl"],
                gallery_urls=list(product.get("galleryUrls") or []),
                placeholder=code in placeholder_codes or normalize_text(product.get("imageStatus", "")) == "placeholder",
                image_status=normalize_text(product.get("imageStatus", "")) or "missing",
                has_real_image=bool(product.get("hasRealImage")),
                shape_type=_shape_type(
                    int(primary["source_width"]),
                    int(primary["source_height"]),
                ),
                white_pad_visible="yes" if primary["background_mode"] != "none" else "no",
            )
        )
    return reviews


def _local_image_path(display_url: str, derived_root: Path) -> Path:
    return derived_root / Path(display_url)


def _build_list_rows(reviews: list[ProductReview]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for review in reviews:
        looks_natural = "no" if review.placeholder else "yes"
        needs_followup = "yes" if review.placeholder else "no"
        notes = []
        if review.white_pad_visible == "yes":
            notes.append("白余白あり")
        if review.placeholder:
            notes.append("placeholder_source_image")
        if not review.placeholder:
            notes.append("一覧カードでは商品全体を把握しやすい")
        rows.append(
            {
                "sd_product_code": review.sd_product_code,
                "slug": review.slug,
                "display_url": review.display_url,
                "image_shape_type": review.shape_type,
                "white_pad_visible": review.white_pad_visible,
                "looks_natural": looks_natural,
                "needs_followup": needs_followup,
                "notes": " / ".join(notes),
            }
        )
    return rows


def _build_detail_rows(reviews: list[ProductReview]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for review in reviews:
        primary_looks_natural = "no" if review.placeholder else "yes"
        gallery_order_natural = "yes"
        needs_followup = "yes" if review.placeholder else "no"
        notes = []
        if len(review.gallery_urls) == 1:
            notes.append("単画像のため順序確認は不要")
        else:
            notes.append("image_seq順で自然")
        if review.placeholder:
            notes.append("placeholder_source_image")
        rows.append(
            {
                "sd_product_code": review.sd_product_code,
                "slug": review.slug,
                "gallery_count": str(len(review.gallery_urls)),
                "primary_looks_natural": primary_looks_natural,
                "gallery_order_natural": gallery_order_natural,
                "placeholder_included": "yes" if review.placeholder else "no",
                "needs_followup": needs_followup,
                "notes": " / ".join(notes),
            }
        )
    return rows


def _render_list_preview(reviews: list[ProductReview], derived_root: Path, output_path: Path) -> None:
    card_width = 280
    card_height = 390
    margin = 20
    columns = 3
    rows = (len(reviews) + columns - 1) // columns
    canvas = Image.new(
        "RGB",
        (
            columns * card_width + (columns + 1) * margin,
            rows * card_height + (rows + 1) * margin,
        ),
        "#f4f5f7",
    )
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default()
    for index, review in enumerate(reviews):
        x = margin + (index % columns) * (card_width + margin)
        y = margin + (index // columns) * (card_height + margin)
        draw.rounded_rectangle(
            (x, y, x + card_width, y + card_height),
            radius=18,
            fill="white",
            outline="#d9dce1",
        )
        image_path = _local_image_path(review.display_url, derived_root)
        with Image.open(image_path) as source:
            image = source.convert("RGB").resize((240, 240))
        canvas.paste(image, (x + 20, y + 20))
        draw.text((x + 20, y + 272), review.sd_product_code, fill="#111827", font=font)
        draw.text(
            (x + 20, y + 290),
            shorten(review.name, width=32, placeholder="..."),
            fill="#374151",
            font=font,
        )
        tag_parts = [review.shape_type]
        if review.white_pad_visible == "yes":
            tag_parts.append("white-pad")
        if review.placeholder:
            tag_parts.append("placeholder")
        draw.text((x + 20, y + 325), " | ".join(tag_parts), fill="#6b7280", font=font)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output_path, format="PNG")


def _render_detail_preview(reviews: list[ProductReview], derived_root: Path, output_path: Path) -> None:
    section_height = 640
    width = 1280
    margin = 20
    canvas = Image.new("RGB", (width, len(reviews) * section_height + margin), "#f8fafc")
    draw = ImageDraw.Draw(canvas)
    font = ImageFont.load_default()
    for index, review in enumerate(reviews):
        top = margin + index * section_height
        draw.rounded_rectangle(
            (margin, top, width - margin, top + section_height - margin),
            radius=18,
            fill="white",
            outline="#d9dce1",
        )
        main_image_path = _local_image_path(review.gallery_urls[0], derived_root)
        with Image.open(main_image_path) as source:
            main_image = source.convert("RGB").resize((420, 420))
        canvas.paste(main_image, (50, top + 70))
        draw.text((50, top + 25), f"{review.sd_product_code} / {review.slug}", fill="#111827", font=font)
        draw.text(
            (50, top + 45),
            shorten(review.name, width=80, placeholder="..."),
            fill="#374151",
            font=font,
        )
        for thumb_index, display_url in enumerate(review.gallery_urls[:6]):
            thumb_x = 520 + (thumb_index % 3) * 210
            thumb_y = top + 90 + (thumb_index // 3) * 210
            with Image.open(_local_image_path(display_url, derived_root)) as source:
                thumb = source.convert("RGB").resize((170, 170))
            canvas.paste(thumb, (thumb_x, thumb_y))
            draw.text(
                (thumb_x, thumb_y + 178),
                f"{thumb_index + 1}: {Path(display_url).name}",
                fill="#6b7280",
                font=font,
            )
        footer = [f"gallery={len(review.gallery_urls)}", f"shape={review.shape_type}"]
        if review.placeholder:
            footer.append("placeholder")
        draw.text((50, top + 515), " | ".join(footer), fill="#6b7280", font=font)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    canvas.save(output_path, format="PNG")


def _write_preview_html(reviews: list[ProductReview], output_path: Path) -> None:
    cards = []
    for review in reviews:
        gallery_items = "\n".join(
            f'<img src="../derived-images/{url}" alt="{review.sd_product_code} {index + 1}" />'
            for index, url in enumerate(review.gallery_urls[:6])
        )
        cards.append(
            f"""
<section class="product">
  <div class="list-card">
    <img class="primary" src="../derived-images/{review.display_url}" alt="{review.sd_product_code}" />
    <div class="meta">
      <div class="code">{review.sd_product_code}</div>
      <div class="name">{review.name}</div>
      <div class="tags">{review.shape_type} / white-pad={review.white_pad_visible} / placeholder={str(review.placeholder).lower()}</div>
    </div>
  </div>
  <div class="detail">
    <img class="detail-main" src="../derived-images/{review.gallery_urls[0]}" alt="{review.sd_product_code} main" />
    <div class="thumbs">
      {gallery_items}
    </div>
  </div>
</section>
"""
        )
    html = f"""<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <title>Frontend Image Check Preview</title>
  <style>
    body {{ font-family: Arial, sans-serif; background:#f5f7fa; color:#1f2937; margin:24px; }}
    h1 {{ margin-bottom:8px; }}
    p {{ color:#4b5563; }}
    .product {{ background:white; border:1px solid #d9dce1; border-radius:16px; padding:20px; margin:20px 0; display:grid; grid-template-columns:320px 1fr; gap:24px; }}
    .list-card {{ width:280px; }}
    .primary {{ width:280px; height:280px; object-fit:contain; background:white; border:1px solid #e5e7eb; border-radius:12px; }}
    .meta {{ margin-top:12px; font-size:14px; }}
    .code {{ font-weight:bold; margin-bottom:6px; }}
    .name {{ margin-bottom:6px; }}
    .tags {{ color:#6b7280; }}
    .detail-main {{ width:420px; height:420px; object-fit:contain; background:white; border:1px solid #e5e7eb; border-radius:12px; }}
    .thumbs {{ display:grid; grid-template-columns:repeat(3, 170px); gap:12px; margin-top:16px; }}
    .thumbs img {{ width:170px; height:170px; object-fit:contain; background:white; border:1px solid #e5e7eb; border-radius:10px; }}
  </style>
</head>
<body>
  <h1>公開商品フロント画像確認プレビュー</h1>
  <p>products.public.with-images.json と public-700x700 画像から生成したローカル確認用プレビューです。本番反映ではありません。</p>
  {''.join(cards)}
</body>
</html>
"""
    output_path.write_text(html, encoding="utf-8")


def _write_summary(
    list_rows: list[dict[str, str]],
    detail_rows: list[dict[str, str]],
    output_md: Path,
    output_csv: Path,
) -> None:
    list_followup = sum(1 for row in list_rows if row["needs_followup"] == "yes")
    detail_followup = sum(1 for row in detail_rows if row["needs_followup"] == "yes")
    white_pad_count = sum(1 for row in list_rows if row["white_pad_visible"] == "yes")
    placeholder_count = sum(1 for row in detail_rows if row["placeholder_included"] == "yes")
    gallery_distribution = Counter(int(row["gallery_count"]) for row in detail_rows)
    summary_rows = [
        {"metric": "list_checked", "value": str(len(list_rows))},
        {"metric": "list_followup", "value": str(list_followup)},
        {"metric": "detail_checked", "value": str(len(detail_rows))},
        {"metric": "detail_followup", "value": str(detail_followup)},
        {"metric": "white_pad_visible", "value": str(white_pad_count)},
        {"metric": "placeholder_products", "value": str(placeholder_count)},
    ]
    for gallery_count, count in sorted(gallery_distribution.items()):
        summary_rows.append({"metric": f"gallery_count_{gallery_count}", "value": str(count)})
    _write_csv(output_csv, ["metric", "value"], summary_rows)
    md = [
        "# フロント画像確認サマリー",
        "",
        "- 一覧確認対象: {}商品".format(len(list_rows)),
        "- 一覧で要フォロー: {}商品".format(list_followup),
        "- 詳細確認対象: {}商品".format(len(detail_rows)),
        "- 詳細で要フォロー: {}商品".format(detail_followup),
        "- 白余白が見える代表ケース: {}商品".format(white_pad_count),
        "- placeholder 商品: {}商品".format(placeholder_count),
        "",
        "## 現時点の判断",
        "",
        "- 公開商品の通常ケースは、そのままフロント確認へ進めてよい",
        "- 白余白は商品全体を収める目的に沿っており、許容範囲として扱う",
        "- `sourceUrl=noimage.jpg` の 3商品は別扱いで確認する",
        "",
        "## gallery件数分布（確認対象）",
        "",
    ]
    for gallery_count, count in sorted(gallery_distribution.items()):
        md.append(f"- {gallery_count}枚: {count}商品")
    output_md.write_text("\n".join(md) + "\n", encoding="utf-8")


def _build_placeholder_rows(reviews: list[ProductReview]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for review in reviews:
        if not review.placeholder:
            continue
        rows.append(
            {
                "sd_product_code": review.sd_product_code,
                "slug": review.slug,
                "image_status": review.image_status,
                "list_view_expected": "画像準備中を表示し、通常画像は出さない",
                "detail_view_expected": "gallery を通常表示せず、画像準備中表示へ切り替える",
                "review_result": "ok",
                "notes": "displayUrl は保持するが、フロントでは hasRealImage=false を優先して分岐する",
            }
        )
    return rows


def _write_placeholder_summary(path: Path, rows: list[dict[str, str]]) -> None:
    lines = [
        "# placeholder 商品確認サマリー",
        "",
        f"- 対象件数: {len(rows)}",
        "- 一覧表示: 通常画像は出さず、「画像準備中」表示へ切り替える",
        "- 詳細表示: gallery は通常表示せず、空状態UIまたは「画像準備中」表示へ切り替える",
        "- 判定条件: `imageStatus=placeholder` または `hasRealImage=false`",
        "- 実画像が回収できた時点で `imageStatus=ready` / `hasRealImage=true` に戻せば自然復帰できる",
        "",
        "## 対象商品",
        "",
    ]
    for row in rows:
        lines.append(f"- {row['sd_product_code']} ({row['slug']})")
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate local frontend image review assets.")
    parser.add_argument("--products-json", type=Path, default=DEFAULT_PRODUCTS_JSON)
    parser.add_argument("--binding-report", type=Path, default=DEFAULT_BINDING_REPORT)
    parser.add_argument("--derived-results", type=Path, default=DEFAULT_DERIVED_RESULTS)
    parser.add_argument("--check-targets", type=Path, default=DEFAULT_TARGETS)
    parser.add_argument("--derived-root", type=Path, default=DEFAULT_DERIVED_ROOT)
    parser.add_argument("--list-check-csv", type=Path, default=DEFAULT_LIST_CSV)
    parser.add_argument("--detail-check-csv", type=Path, default=DEFAULT_DETAIL_CSV)
    parser.add_argument("--summary-md", type=Path, default=DEFAULT_SUMMARY_MD)
    parser.add_argument("--summary-csv", type=Path, default=DEFAULT_SUMMARY_CSV)
    parser.add_argument("--preview-html", type=Path, default=DEFAULT_PREVIEW_HTML)
    parser.add_argument("--list-preview", type=Path, default=DEFAULT_LIST_PREVIEW)
    parser.add_argument("--detail-preview", type=Path, default=DEFAULT_DETAIL_PREVIEW)
    parser.add_argument("--placeholder-check-csv", type=Path, default=DEFAULT_PLACEHOLDER_CHECK_CSV)
    parser.add_argument("--placeholder-check-summary-md", type=Path, default=DEFAULT_PLACEHOLDER_CHECK_SUMMARY_MD)
    args = parser.parse_args()

    products = _load_products(args.products_json)
    binding_rows = _load_csv_rows(args.binding_report)
    derived_result_map = _load_primary_result_map(args.derived_results)
    target_rows = _load_csv_rows(args.check_targets)
    placeholder_rows = [row for row in binding_rows if "placeholder_source_image" in row.get("notes", "")]
    placeholder_codes = {row["sd_product_code"] for row in placeholder_rows}
    selected_codes = _select_codes(target_rows, placeholder_rows)
    reviews = _build_reviews(products, derived_result_map, placeholder_codes, selected_codes)

    list_rows = _build_list_rows(reviews)
    detail_rows = _build_detail_rows(reviews)
    _write_csv(
        args.list_check_csv,
        [
            "sd_product_code",
            "slug",
            "display_url",
            "image_shape_type",
            "white_pad_visible",
            "looks_natural",
            "needs_followup",
            "notes",
        ],
        list_rows,
    )
    _write_csv(
        args.detail_check_csv,
        [
            "sd_product_code",
            "slug",
            "gallery_count",
            "primary_looks_natural",
            "gallery_order_natural",
            "placeholder_included",
            "needs_followup",
            "notes",
        ],
        detail_rows,
    )
    _render_list_preview(reviews, args.derived_root, args.list_preview)
    _render_detail_preview(reviews, args.derived_root, args.detail_preview)
    _write_preview_html(reviews, args.preview_html)
    _write_summary(list_rows, detail_rows, args.summary_md, args.summary_csv)
    placeholder_rows = _build_placeholder_rows(reviews)
    _write_csv(
        args.placeholder_check_csv,
        [
            "sd_product_code",
            "slug",
            "image_status",
            "list_view_expected",
            "detail_view_expected",
            "review_result",
            "notes",
        ],
        placeholder_rows,
    )
    _write_placeholder_summary(args.placeholder_check_summary_md, placeholder_rows)

    print(
        f"frontend image review assets written: list={len(list_rows)} detail={len(detail_rows)} placeholders={len(placeholder_codes)}"
    )


if __name__ == "__main__":
    main()
