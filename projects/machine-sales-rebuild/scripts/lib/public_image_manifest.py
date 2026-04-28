from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path

from scripts.lib.product_v0 import build_search_text, normalize_text


@dataclass(frozen=True)
class PublicImageBinding:
    sd_product_code: str
    slug: str
    image_seq: int
    display_url: str
    derived_path: str
    original_image_url: str
    source_ext: str
    derived_ext: str
    width: int
    height: int
    is_primary_candidate: bool
    notes: str

    @property
    def is_placeholder(self) -> bool:
        return "noimage" in self.original_image_url.casefold()


def _load_csv_rows(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return [dict(row) for row in csv.DictReader(handle)]


def load_public_image_bindings(
    *,
    derived_manifest_path: Path,
    source_manifest_path: Path | None = None,
    image_path_prefix: str = "public-700x700",
) -> dict[str, list[PublicImageBinding]]:
    source_lookup: dict[tuple[str, int], dict[str, str]] = {}
    if source_manifest_path and source_manifest_path.exists():
        for row in _load_csv_rows(source_manifest_path):
            code = normalize_text(row.get("sd_product_code", "")).upper()
            image_seq = int(normalize_text(row.get("image_seq", "")) or "0")
            source_lookup[(code, image_seq)] = row

    grouped: dict[str, list[PublicImageBinding]] = {}
    for row in _load_csv_rows(derived_manifest_path):
        code = normalize_text(row.get("sd_product_code", "")).upper()
        image_seq = int(normalize_text(row.get("image_seq", "")) or "0")
        source_row = source_lookup.get((code, image_seq), {})
        relative_candidate = normalize_text(row.get("derived_url_candidate", ""))
        if image_path_prefix:
            display_url = f"{image_path_prefix.strip('/')}/{relative_candidate}".strip("/")
        else:
            display_url = relative_candidate
        grouped.setdefault(code, []).append(
            PublicImageBinding(
                sd_product_code=code,
                slug=normalize_text(row.get("slug", "")).lower(),
                image_seq=image_seq,
                display_url=display_url,
                derived_path=normalize_text(row.get("derived_path", "")),
                original_image_url=normalize_text(source_row.get("original_image_url", "")),
                source_ext=normalize_text(source_row.get("file_ext", "")).lower(),
                derived_ext=normalize_text(row.get("file_ext", "")).lower(),
                width=int(normalize_text(row.get("width", "")) or "0"),
                height=int(normalize_text(row.get("height", "")) or "0"),
                is_primary_candidate=normalize_text(
                    row.get("is_primary_candidate", "")
                ).casefold()
                == "true",
                notes=normalize_text(row.get("notes", "")),
            )
        )

    for bindings in grouped.values():
        bindings.sort(key=lambda binding: (binding.image_seq, binding.display_url))
    return grouped


def build_image_objects(
    *,
    bindings: list[PublicImageBinding],
    product_name: str,
    maker_name: str,
    sd_product_code: str,
) -> list[dict[str, object]]:
    image_objects: list[dict[str, object]] = []
    main_seq = 1
    for binding in bindings:
        if binding.is_primary_candidate:
            main_seq = binding.image_seq
            break
    for binding in bindings:
        image_objects.append(
            {
                "sourceUrl": binding.original_image_url or None,
                "displayUrl": binding.display_url,
                "width": binding.width,
                "height": binding.height,
                "alt": build_search_text(
                    product_name,
                    maker_name,
                    sd_product_code,
                    f"画像{binding.image_seq}",
                ),
                "isMain": binding.image_seq == main_seq,
                "sortOrder": binding.image_seq,
                "imageStatus": "placeholder" if binding.is_placeholder else "ready",
                "hasRealImage": not binding.is_placeholder,
            }
        )
    return image_objects
