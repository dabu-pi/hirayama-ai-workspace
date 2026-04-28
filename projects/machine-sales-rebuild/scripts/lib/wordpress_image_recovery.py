from __future__ import annotations

import re
import time
from dataclasses import dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import urljoin, urlparse
from urllib.request import Request, urlopen

from scripts.lib.product_v0 import normalize_text


DEFAULT_USER_AGENT = "machine-sales-rebuild-wordpress-recovery/0.1"
PRODUCT_CODE_PATTERN = re.compile(r"\b[A-Z]{4}\d{5}[A-Z]{2}\b")


@dataclass(frozen=True)
class RecoveryTarget:
    sd_product_code: str
    slug: str
    product_url: str
    selection_reason: str = ""
    expected_image_count_guess: str = ""


@dataclass(frozen=True)
class ImageCandidate:
    image_url: str
    source_type: str
    file_ext: str
    sort_order: int


@dataclass(frozen=True)
class FetchResponse:
    url: str
    status_code: int
    content: bytes
    content_type: str

    def text(self) -> str:
        return self.content.decode("utf-8", errors="replace")


@dataclass(frozen=True)
class ParsedProductPage:
    product_code_in_page: str
    hidden_product_code: str
    gallery_images: list[ImageCandidate]
    og_image_url: str


@dataclass(frozen=True)
class RecoveryImageResult:
    image_url: str
    image_http_status: int
    saved_path: str
    file_ext: str
    source_type: str
    notes: str


@dataclass(frozen=True)
class FailureRecord:
    sd_product_code: str
    slug: str
    product_url: str
    failure_stage: str
    reason: str


class ProductPageParser(HTMLParser):
    def __init__(self, base_url: str) -> None:
        super().__init__(convert_charrefs=True)
        self.base_url = base_url
        self.hidden_product_code = ""
        self.og_image_url = ""
        self.image_candidates: list[ImageCandidate] = []
        self._seen_urls: set[str] = set()

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_map = {name: value or "" for name, value in attrs}
        if tag == "input":
            self._handle_input(attrs_map)
            return
        if tag == "meta":
            self._handle_meta(attrs_map)
            return
        if tag == "img":
            self._handle_img(attrs_map)

    def _handle_input(self, attrs_map: dict[str, str]) -> None:
        if normalize_text(attrs_map.get("name")) == "product-code":
            self.hidden_product_code = normalize_text(attrs_map.get("value", "")).upper()

    def _handle_meta(self, attrs_map: dict[str, str]) -> None:
        if normalize_text(attrs_map.get("property")) == "og:image":
            self.og_image_url = urljoin(self.base_url, attrs_map.get("content", ""))

    def _handle_img(self, attrs_map: dict[str, str]) -> None:
        class_names = set(normalize_text(attrs_map.get("class", "")).split())
        is_gallery = any(
            class_name.startswith("slider-main-img") or class_name.startswith("slider-thumb-img")
            for class_name in class_names
        )
        if not is_gallery:
            return

        src = urljoin(self.base_url, attrs_map.get("src", ""))
        srcset = normalize_text(attrs_map.get("srcset", ""))
        if srcset:
            best_srcset_url = choose_best_srcset_url(srcset, self.base_url)
            if best_srcset_url:
                self._append_candidate(best_srcset_url, "srcset")

        if src:
            self._append_candidate(src, "gallery")

    def _append_candidate(self, image_url: str, source_type: str) -> None:
        normalized_url = normalize_candidate_url(image_url)
        if not normalized_url or normalized_url in self._seen_urls:
            return
        self._seen_urls.add(normalized_url)
        self.image_candidates.append(
            ImageCandidate(
                image_url=normalized_url,
                source_type=source_type,
                file_ext=file_ext_from_url(normalized_url),
                sort_order=infer_sort_order_from_url(normalized_url),
            )
        )


def normalize_candidate_url(url: str) -> str:
    text = normalize_text(url)
    if not text:
        return ""
    return text.replace("/uploads//", "/uploads/")


def file_ext_from_url(url: str) -> str:
    suffix = Path(urlparse(url).path).suffix.lower()
    return suffix.lstrip(".")


def infer_sort_order_from_url(url: str) -> int:
    file_name = Path(urlparse(url).path).name
    match = re.search(r"_(\d+)\.[A-Za-z0-9]+$", file_name)
    if match:
        return int(match.group(1))
    return 999


def choose_best_srcset_url(srcset: str, base_url: str) -> str:
    best_width = -1
    best_url = ""
    for item in srcset.split(","):
        parts = normalize_text(item).split()
        if not parts:
            continue
        candidate_url = urljoin(base_url, parts[0])
        width = 0
        if len(parts) >= 2 and parts[1].endswith("w"):
            try:
                width = int(parts[1][:-1])
            except ValueError:
                width = 0
        if width >= best_width:
            best_width = width
            best_url = candidate_url
    return normalize_candidate_url(best_url)


def parse_product_page(html_text: str, base_url: str, target_code: str = "") -> ParsedProductPage:
    parser = ProductPageParser(base_url)
    parser.feed(html_text)
    parser.close()

    seen_codes: list[str] = []
    for code in PRODUCT_CODE_PATTERN.findall(html_text.upper()):
        if code not in seen_codes:
            seen_codes.append(code)

    normalized_target = normalize_text(target_code).upper()
    product_code_in_page = ""
    if normalized_target and normalized_target in seen_codes:
        product_code_in_page = normalized_target
    elif seen_codes:
        product_code_in_page = seen_codes[0]

    gallery_images = sorted(
        parser.image_candidates,
        key=lambda candidate: (candidate.sort_order, candidate.image_url),
    )
    return ParsedProductPage(
        product_code_in_page=product_code_in_page,
        hidden_product_code=parser.hidden_product_code,
        gallery_images=gallery_images,
        og_image_url=parser.og_image_url,
    )


def fetch_url(
    url: str,
    *,
    timeout_seconds: float,
    user_agent: str,
    retry_count: int,
    sleep_seconds: float,
) -> FetchResponse:
    last_error: Exception | None = None
    for attempt in range(retry_count + 1):
        if attempt > 0:
            time.sleep(sleep_seconds)
        request = Request(url, headers={"User-Agent": user_agent})
        try:
            with urlopen(request, timeout=timeout_seconds) as response:
                status_code = int(getattr(response, "status", 200))
                content_type = normalize_text(response.headers.get_content_type())
                return FetchResponse(
                    url=url,
                    status_code=status_code,
                    content=response.read(),
                    content_type=content_type,
                )
        except HTTPError as error:
            if attempt >= retry_count:
                return FetchResponse(
                    url=url,
                    status_code=error.code,
                    content=error.read(),
                    content_type=normalize_text(error.headers.get_content_type() if error.headers else ""),
                )
            last_error = error
        except URLError as error:
            last_error = error
            if attempt >= retry_count:
                raise
    if last_error:
        raise last_error
    raise RuntimeError(f"Failed to fetch URL: {url}")


def load_targets_csv(path: Path) -> list[RecoveryTarget]:
    import csv

    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        return [
            RecoveryTarget(
                sd_product_code=normalize_text(row.get("sd_product_code", "")).upper(),
                slug=normalize_text(row.get("slug", "")).lower(),
                product_url=normalize_text(row.get("product_url", "")),
                selection_reason=normalize_text(row.get("selection_reason", "")),
                expected_image_count_guess=normalize_text(row.get("expected_image_count_guess", "")),
            )
            for row in reader
        ]


def note_code_consistency(target: RecoveryTarget, parsed_page: ParsedProductPage) -> str:
    notes: list[str] = []
    if parsed_page.product_code_in_page and parsed_page.product_code_in_page != target.sd_product_code:
        notes.append(f"product_code_in_page_mismatch={parsed_page.product_code_in_page}")
    if parsed_page.hidden_product_code and parsed_page.hidden_product_code != target.sd_product_code:
        notes.append(f"hidden_product_code_mismatch={parsed_page.hidden_product_code}")
    if not parsed_page.gallery_images:
        notes.append("gallery_images_not_found")
    return " | ".join(notes)


def ensure_output_path(output_dir: Path, sd_product_code: str, image_url: str) -> Path:
    product_dir = output_dir / sd_product_code
    product_dir.mkdir(parents=True, exist_ok=True)
    file_name = Path(urlparse(image_url).path).name
    return product_dir / file_name


def write_binary_file(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(content)


def build_results_row(
    *,
    target: RecoveryTarget,
    page_fetch_status: int,
    parsed_page: ParsedProductPage,
    image_result: RecoveryImageResult,
) -> dict[str, object]:
    return {
        "sd_product_code": target.sd_product_code,
        "slug": target.slug,
        "product_url": target.product_url,
        "page_fetch_status": page_fetch_status,
        "product_code_in_page": parsed_page.product_code_in_page,
        "hidden_product_code": parsed_page.hidden_product_code,
        "image_url": image_result.image_url,
        "image_http_status": image_result.image_http_status,
        "saved_path": image_result.saved_path,
        "file_ext": image_result.file_ext,
        "source_type": image_result.source_type,
        "notes": image_result.notes,
    }


def build_failure_row(failure: FailureRecord) -> dict[str, object]:
    return {
        "sd_product_code": failure.sd_product_code,
        "slug": failure.slug,
        "product_url": failure.product_url,
        "failure_stage": failure.failure_stage,
        "reason": failure.reason,
    }


def iter_effective_candidates(
    parsed_page: ParsedProductPage,
    *,
    allow_og_fallback: bool,
) -> Iterable[ImageCandidate]:
    if parsed_page.gallery_images:
        return parsed_page.gallery_images
    if allow_og_fallback and parsed_page.og_image_url:
        return [
            ImageCandidate(
                image_url=normalize_candidate_url(parsed_page.og_image_url),
                source_type="fallback_og_image",
                file_ext=file_ext_from_url(parsed_page.og_image_url),
                sort_order=999,
            )
        ]
    return []
