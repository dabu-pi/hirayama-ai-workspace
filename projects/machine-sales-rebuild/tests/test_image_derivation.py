from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from scripts.lib.image_derivation import (
    DerivationJob,
    TARGET_SIZE,
    aspect_bucket,
    derive_image,
)


try:
    from PIL import Image
except ModuleNotFoundError:  # pragma: no cover - local env without pillow
    Image = None


@unittest.skipIf(Image is None, "Pillow is required for image derivation tests.")
class ImageDerivationTest(unittest.TestCase):
    def test_horizontal_image_is_padded_to_square_jpeg(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            base = Path(tmp_dir)
            source_path = base / "source.png"
            Image.new("RGB", (1200, 600), (10, 20, 30)).save(source_path)

            result = derive_image(
                job=DerivationJob(
                    sd_product_code="HYTEST0001AT",
                    slug="hytest0001at",
                    image_seq=1,
                    source_path=source_path.as_posix(),
                    source_ext="png",
                    source_type="gallery",
                    is_primary_candidate=True,
                    notes="",
                ),
                output_dir=base / "derived",
                overwrite=True,
                dry_run=False,
            )

            self.assertEqual(result.source_width, 1200)
            self.assertEqual(result.source_height, 600)
            self.assertEqual(result.derived_width, TARGET_SIZE)
            self.assertEqual(result.derived_height, TARGET_SIZE)
            self.assertEqual(result.background_mode, "white_pad")
            self.assertEqual(result.transform_mode, "contain_pad")
            self.assertEqual(result.derived_ext, "jpg")
            self.assertTrue(Path(result.derived_path).exists())

    def test_transparent_png_is_flattened_and_marked(self) -> None:
        with tempfile.TemporaryDirectory() as tmp_dir:
            base = Path(tmp_dir)
            source_path = base / "transparent.png"
            Image.new("RGBA", (500, 500), (255, 0, 0, 128)).save(source_path)

            result = derive_image(
                job=DerivationJob(
                    sd_product_code="HYTEST0002AT",
                    slug="hytest0002at",
                    image_seq=1,
                    source_path=source_path.as_posix(),
                    source_ext="png",
                    source_type="gallery",
                    is_primary_candidate=True,
                    notes="",
                ),
                output_dir=base / "derived",
                overwrite=True,
                dry_run=False,
            )

            self.assertIn("flattened_alpha", result.notes)
            self.assertEqual(result.derived_ext, "jpg")

    def test_aspect_bucket(self) -> None:
        self.assertEqual(aspect_bucket(400, 400), "square")
        self.assertEqual(aspect_bucket(800, 400), "horizontal")
        self.assertEqual(aspect_bucket(400, 800), "vertical")


if __name__ == "__main__":
    unittest.main()
