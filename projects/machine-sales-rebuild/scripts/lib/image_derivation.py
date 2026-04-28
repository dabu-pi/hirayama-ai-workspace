from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path

from scripts.lib.product_v0 import normalize_text


TARGET_SIZE = 700
BACKGROUND_COLOR_RGB = (255, 255, 255)
DERIVED_EXT = "jpg"
DERIVED_FORMAT = "JPEG"
JPEG_QUALITY = 90
OUTPUT_SUBDIR = "public-700x700"


@dataclass(frozen=True)
class DerivationJob:
    sd_product_code: str
    slug: str
    image_seq: int
    source_path: str
    source_ext: str
    source_type: str
    is_primary_candidate: bool
    notes: str


@dataclass(frozen=True)
class DerivationResult:
    sd_product_code: str
    slug: str
    image_seq: int
    source_path: str
    source_ext: str
    source_width: int
    source_height: int
    derived_path: str
    derived_ext: str
    derived_width: int
    derived_height: int
    background_mode: str
    transform_mode: str
    status: str
    notes: str

    def as_row(self) -> dict[str, object]:
        return {
            "sd_product_code": self.sd_product_code,
            "slug": self.slug,
            "image_seq": self.image_seq,
            "source_path": self.source_path,
            "source_ext": self.source_ext,
            "source_width": self.source_width,
            "source_height": self.source_height,
            "derived_path": self.derived_path,
            "derived_ext": self.derived_ext,
            "derived_width": self.derived_width,
            "derived_height": self.derived_height,
            "background_mode": self.background_mode,
            "transform_mode": self.transform_mode,
            "status": self.status,
            "notes": self.notes,
        }


@dataclass(frozen=True)
class DerivationFailure:
    sd_product_code: str
    slug: str
    image_seq: int
    source_path: str
    failure_stage: str
    reason: str

    def as_row(self) -> dict[str, object]:
        return {
            "sd_product_code": self.sd_product_code,
            "slug": self.slug,
            "image_seq": self.image_seq,
            "source_path": self.source_path,
            "failure_stage": self.failure_stage,
            "reason": self.reason,
        }


def load_manifest_jobs(path: Path) -> list[DerivationJob]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        jobs: list[DerivationJob] = []
        for row in reader:
            image_seq_text = normalize_text(row.get("image_seq", ""))
            jobs.append(
                DerivationJob(
                    sd_product_code=normalize_text(row.get("sd_product_code", "")).upper(),
                    slug=normalize_text(row.get("slug", "")).lower(),
                    image_seq=int(image_seq_text or "0"),
                    source_path=normalize_text(row.get("saved_path", "")),
                    source_ext=normalize_text(row.get("file_ext", "")).lower(),
                    source_type=normalize_text(row.get("source_type", "")),
                    is_primary_candidate=normalize_text(
                        row.get("is_primary_candidate", "")
                    ).casefold()
                    == "true",
                    notes=normalize_text(row.get("notes", "")),
                )
            )
        return jobs


def build_derived_path(base_output_dir: Path, job: DerivationJob) -> Path:
    product_dir = base_output_dir / job.sd_product_code
    file_name = f"{job.sd_product_code}-{job.image_seq:02d}-700x700.{DERIVED_EXT}"
    return product_dir / file_name


def ensure_pillow() -> tuple[object, object]:
    try:
        from PIL import Image, ImageOps  # type: ignore
    except ModuleNotFoundError as error:
        raise RuntimeError(
            "Pillow is required for image derivation. Run via `uv run --with pillow ...`."
        ) from error
    return Image, ImageOps


def _open_image_with_orientation(source_path: Path) -> tuple[object, int, int]:
    Image, ImageOps = ensure_pillow()
    image = Image.open(source_path)
    image = ImageOps.exif_transpose(image)
    source_width, source_height = image.size
    return image, source_width, source_height


def derive_image(
    *,
    job: DerivationJob,
    output_dir: Path,
    overwrite: bool,
    dry_run: bool,
) -> DerivationResult:
    Image, _ImageOps = ensure_pillow()
    source_path = Path(job.source_path)
    derived_path = build_derived_path(output_dir, job)

    image, source_width, source_height = _open_image_with_orientation(source_path)
    if source_width <= 0 or source_height <= 0:
        raise ValueError("Source image has invalid dimensions.")

    # Normalize transparency onto white so the derived output can be unified as JPEG.
    if image.mode not in {"RGB", "RGBA"}:
        image = image.convert("RGBA" if "transparency" in image.info else "RGB")
    if image.mode == "RGBA":
        background = Image.new("RGBA", image.size, BACKGROUND_COLOR_RGB + (255,))
        background.alpha_composite(image)
        image = background.convert("RGB")
        source_mode_note = "flattened_alpha"
    else:
        image = image.convert("RGB")
        source_mode_note = ""

    scale = min(TARGET_SIZE / source_width, TARGET_SIZE / source_height)
    resized_width = max(1, round(source_width * scale))
    resized_height = max(1, round(source_height * scale))
    resized = image.resize((resized_width, resized_height), Image.Resampling.LANCZOS)

    derived = Image.new("RGB", (TARGET_SIZE, TARGET_SIZE), BACKGROUND_COLOR_RGB)
    offset_x = (TARGET_SIZE - resized_width) // 2
    offset_y = (TARGET_SIZE - resized_height) // 2
    derived.paste(resized, (offset_x, offset_y))

    has_padding = resized_width != TARGET_SIZE or resized_height != TARGET_SIZE
    background_mode = "white_pad" if has_padding else "none"
    transform_mode = "contain_pad" if has_padding else "contain_square"
    notes = source_mode_note

    if not dry_run:
        derived_path.parent.mkdir(parents=True, exist_ok=True)
        if overwrite or not derived_path.exists():
            derived.save(
                derived_path,
                DERIVED_FORMAT,
                quality=JPEG_QUALITY,
                optimize=True,
                progressive=True,
            )
            status = "generated"
        else:
            status = "skipped_existing"
    else:
        status = "dry_run"

    return DerivationResult(
        sd_product_code=job.sd_product_code,
        slug=job.slug,
        image_seq=job.image_seq,
        source_path=source_path.as_posix(),
        source_ext=job.source_ext,
        source_width=source_width,
        source_height=source_height,
        derived_path=derived_path.as_posix(),
        derived_ext=DERIVED_EXT,
        derived_width=TARGET_SIZE,
        derived_height=TARGET_SIZE,
        background_mode=background_mode,
        transform_mode=transform_mode,
        status=status,
        notes=notes,
    )


def aspect_bucket(width: int, height: int) -> str:
    if width == height:
        return "square"
    if width > height:
        return "horizontal"
    return "vertical"
