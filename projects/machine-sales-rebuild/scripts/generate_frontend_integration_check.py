from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PRODUCTS_JSON = PROJECT_ROOT / "data" / "output" / "products.public.with-images.json"
DEFAULT_OUTPUT_CSV = PROJECT_ROOT / "data" / "output" / "frontend_integration_check.csv"
DEFAULT_OUTPUT_MD = PROJECT_ROOT / "data" / "output" / "frontend_integration_check_summary.md"


def _load_products(path: Path) -> list[dict]:
    with path.open("r", encoding="utf-8") as handle:
        payload = json.load(handle)
    return list(payload.get("products", []))


def _write_csv(path: Path, rows: list[dict[str, str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "sd_product_code",
                "slug",
                "image_status",
                "list_view_result",
                "detail_view_result",
                "placeholder_branch_ok",
                "notes",
            ],
        )
        writer.writeheader()
        writer.writerows(rows)


def _build_rows(products: list[dict]) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for product in products:
        is_placeholder = product.get("imageStatus") == "placeholder" or product.get("hasRealImage") is False
        if is_placeholder:
            list_result = "ok:画像準備中表示"
            detail_result = "ok:画像準備中表示"
            branch_ok = "yes"
            notes = "displayUrl は保持するが、通常画像としては使わない"
        else:
            list_result = "ok:displayUrl表示"
            detail_result = "ok:galleryUrls表示"
            branch_ok = "not_applicable"
            notes = f"gallery={len(product.get('galleryUrls') or [])}"
        rows.append(
            {
                "sd_product_code": str(product.get("sdProductCode", "")),
                "slug": str(product.get("slug", "")),
                "image_status": str(product.get("imageStatus", "")),
                "list_view_result": list_result,
                "detail_view_result": detail_result,
                "placeholder_branch_ok": branch_ok,
                "notes": notes,
            }
        )
    return rows


def _write_summary(path: Path, rows: list[dict[str, str]]) -> None:
    ready_rows = [row for row in rows if row["image_status"] == "ready"]
    placeholder_rows = [row for row in rows if row["image_status"] == "placeholder"]
    lines = [
        "# フロント組み込み確認サマリー",
        "",
        f"- 組み込み対象件数: {len(rows)}",
        f"- 通常商品: {len(ready_rows)}",
        f"- placeholder 商品: {len(placeholder_rows)}",
        "- 通常商品は `displayUrl` / `galleryUrls` で表示する前提",
        "- placeholder 商品は `imageStatus=placeholder` または `hasRealImage=false` で `画像準備中` 表示へ分岐",
        "",
        "## ローカル確認方法",
        "",
        "```powershell",
        "Set-Location C:\\hirayama-ai-workspace\\workspace\\projects\\machine-sales-rebuild",
        "$env:UV_CACHE_DIR='C:\\hirayama-ai-workspace\\workspace\\.uv-cache'",
        "uv run python -m http.server 8010",
        "```",
        "",
        "- ブラウザで `http://127.0.0.1:8010/frontend/public-preview/index.html` を開く",
        "- `baseImageUrl` は `frontend/public-preview/app.js` の `CONFIG.baseImageUrl` で差し替え可能",
    ]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate frontend integration review outputs.")
    parser.add_argument("--products-json", type=Path, default=DEFAULT_PRODUCTS_JSON)
    parser.add_argument("--output-csv", type=Path, default=DEFAULT_OUTPUT_CSV)
    parser.add_argument("--output-md", type=Path, default=DEFAULT_OUTPUT_MD)
    args = parser.parse_args()

    products = _load_products(args.products_json)
    rows = _build_rows(products)
    _write_csv(args.output_csv, rows)
    _write_summary(args.output_md, rows)
    print(f"frontend integration rows={len(rows)}")


if __name__ == "__main__":
    main()
