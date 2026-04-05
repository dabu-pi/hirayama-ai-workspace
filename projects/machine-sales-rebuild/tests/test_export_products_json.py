from __future__ import annotations

import csv
import tempfile
import unittest
from pathlib import Path

from scripts.export_products_json import export_products_json
from scripts.lib.product_v0 import PRODUCT_MASTER_COLUMNS, load_settings_registry, write_csv
from scripts.transform_current_to_v0 import load_current_rows, transform_rows


class ExportProductsJsonTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        registry = load_settings_registry(Path("data/seeds"))
        result = transform_rows(
            load_current_rows(Path("data/samples/current_product_master_input_sample.csv")),
            registry,
            source_sheet_name="current_product_master_input_sample",
            generated_at="2026-04-05T00:00:00+09:00",
        )

        temp_dir_context = tempfile.TemporaryDirectory(dir=Path("data/output"))
        cls.addClassCleanup(temp_dir_context.cleanup)
        cls.temp_dir = Path(temp_dir_context.name)

        cls.product_csv = cls.temp_dir / "product_master_v0_sample.csv"
        cls.output_json = cls.temp_dir / "products.public.with-images.json"
        cls.public_image_manifest_csv = cls.temp_dir / "public_image_manifest.csv"
        cls.public_derived_image_manifest_csv = cls.temp_dir / "public_derived_image_manifest.csv"
        cls.binding_report_csv = cls.temp_dir / "binding_report.csv"
        cls.binding_summary_csv = cls.temp_dir / "binding_summary.csv"
        cls.binding_summary_md = cls.temp_dir / "binding_summary.md"
        cls.frontend_targets_csv = cls.temp_dir / "frontend_targets.csv"
        cls.derived_results_csv = cls.temp_dir / "public_derived_image_results.csv"

        write_csv(cls.product_csv, result.rows, PRODUCT_MASTER_COLUMNS)
        write_csv(
            cls.public_image_manifest_csv,
            [
                {
                    "sd_product_code": "OOCY16003LG",
                    "slug": "oocy16003lg",
                    "image_seq": 1,
                    "original_image_url": "https://example.com/source-images/OOCY16003LG-1-original.jpg",
                    "saved_path": "data/raw-images/wordpress-public/OOCY16003LG/OOCY16003LG_1.jpg",
                    "file_ext": "jpg",
                    "source_type": "gallery",
                    "is_primary_candidate": "true",
                    "notes": "",
                },
                {
                    "sd_product_code": "OOCY16003LG",
                    "slug": "oocy16003lg",
                    "image_seq": 2,
                    "original_image_url": "https://example.com/source-images/OOCY16003LG-2-original.jpg",
                    "saved_path": "data/raw-images/wordpress-public/OOCY16003LG/OOCY16003LG_2.jpg",
                    "file_ext": "jpg",
                    "source_type": "gallery",
                    "is_primary_candidate": "false",
                    "notes": "",
                },
                {
                    "sd_product_code": "HYIC24909AT",
                    "slug": "hyic24909at",
                    "image_seq": 1,
                    "original_image_url": "https://example.com/source-images/HYIC24909AT-1-original.jpg",
                    "saved_path": "data/raw-images/wordpress-public/HYIC24909AT/HYIC24909AT_1.png",
                    "file_ext": "png",
                    "source_type": "gallery",
                    "is_primary_candidate": "true",
                    "notes": "",
                },
            ],
            [
                "sd_product_code",
                "slug",
                "image_seq",
                "original_image_url",
                "saved_path",
                "file_ext",
                "source_type",
                "is_primary_candidate",
                "notes",
            ],
        )
        write_csv(
            cls.public_derived_image_manifest_csv,
            [
                {
                    "sd_product_code": "OOCY16003LG",
                    "slug": "oocy16003lg",
                    "image_seq": 1,
                    "source_path": "data/raw-images/wordpress-public/OOCY16003LG/OOCY16003LG_1.jpg",
                    "derived_path": "data/derived-images/public-700x700/OOCY16003LG/OOCY16003LG-01-700x700.jpg",
                    "derived_url_candidate": "OOCY16003LG/OOCY16003LG-01-700x700.jpg",
                    "is_primary_candidate": "true",
                    "file_ext": "jpg",
                    "width": 700,
                    "height": 700,
                    "notes": "",
                },
                {
                    "sd_product_code": "OOCY16003LG",
                    "slug": "oocy16003lg",
                    "image_seq": 2,
                    "source_path": "data/raw-images/wordpress-public/OOCY16003LG/OOCY16003LG_2.jpg",
                    "derived_path": "data/derived-images/public-700x700/OOCY16003LG/OOCY16003LG-02-700x700.jpg",
                    "derived_url_candidate": "OOCY16003LG/OOCY16003LG-02-700x700.jpg",
                    "is_primary_candidate": "false",
                    "file_ext": "jpg",
                    "width": 700,
                    "height": 700,
                    "notes": "",
                },
                {
                    "sd_product_code": "HYIC24909AT",
                    "slug": "hyic24909at",
                    "image_seq": 1,
                    "source_path": "data/raw-images/wordpress-public/HYIC24909AT/HYIC24909AT_1.png",
                    "derived_path": "data/derived-images/public-700x700/HYIC24909AT/HYIC24909AT-01-700x700.jpg",
                    "derived_url_candidate": "HYIC24909AT/HYIC24909AT-01-700x700.jpg",
                    "is_primary_candidate": "true",
                    "file_ext": "jpg",
                    "width": 700,
                    "height": 700,
                    "notes": "",
                },
            ],
            [
                "sd_product_code",
                "slug",
                "image_seq",
                "source_path",
                "derived_path",
                "derived_url_candidate",
                "is_primary_candidate",
                "file_ext",
                "width",
                "height",
                "notes",
            ],
        )
        write_csv(
            cls.derived_results_csv,
            [
                {
                    "sd_product_code": "HYIC24909AT",
                    "slug": "hyic24909at",
                    "image_seq": 1,
                    "source_path": "data/raw-images/wordpress-public/HYIC24909AT/HYIC24909AT_1.png",
                    "source_ext": "png",
                    "source_width": 500,
                    "source_height": 500,
                    "derived_path": "data/derived-images/public-700x700/HYIC24909AT/HYIC24909AT-01-700x700.jpg",
                    "derived_ext": "jpg",
                    "derived_width": 700,
                    "derived_height": 700,
                    "background_mode": "none",
                    "transform_mode": "contain_square",
                    "status": "generated",
                    "notes": "",
                }
            ],
            [
                "sd_product_code",
                "slug",
                "image_seq",
                "source_path",
                "source_ext",
                "source_width",
                "source_height",
                "derived_path",
                "derived_ext",
                "derived_width",
                "derived_height",
                "background_mode",
                "transform_mode",
                "status",
                "notes",
            ],
        )

        cls.payload = export_products_json(
            input_path=cls.product_csv,
            output_path=cls.output_json,
            seed_dir=Path("data/seeds"),
            source_manifest_path=cls.public_image_manifest_csv,
            derived_manifest_path=cls.public_derived_image_manifest_csv,
            image_path_prefix="public-700x700",
            public_only=True,
            binding_report_path=cls.binding_report_csv,
            binding_summary_csv_path=cls.binding_summary_csv,
            binding_summary_md_path=cls.binding_summary_md,
            frontend_check_targets_path=cls.frontend_targets_csv,
            derived_results_path=cls.derived_results_csv,
        )

    def test_export_contains_schema_version_and_public_products(self) -> None:
        self.assertEqual(self.payload["schemaVersion"], "1.0.0")
        self.assertEqual(self.payload["source"]["system"], "integrated-sheet-v0")
        self.assertEqual(len(self.payload["products"]), 2)
        self.assertTrue(self.output_json.exists())

    def test_display_url_and_gallery_urls_are_bound(self) -> None:
        first_product = self.payload["products"][0]

        self.assertEqual(first_product["slug"], "oocy16003lg")
        self.assertEqual(
            first_product["displayUrl"],
            "public-700x700/OOCY16003LG/OOCY16003LG-01-700x700.jpg",
        )
        self.assertEqual(
            first_product["galleryUrls"],
            [
                "public-700x700/OOCY16003LG/OOCY16003LG-01-700x700.jpg",
                "public-700x700/OOCY16003LG/OOCY16003LG-02-700x700.jpg",
            ],
        )
        self.assertEqual(
            first_product["images"][0]["sourceUrl"],
            "https://example.com/source-images/OOCY16003LG-1-original.jpg",
        )
        self.assertEqual(
            first_product["images"][0]["displayUrl"],
            "public-700x700/OOCY16003LG/OOCY16003LG-01-700x700.jpg",
        )
        self.assertTrue(first_product["images"][0]["isMain"])

    def test_private_and_sold_products_are_excluded_in_public_only_mode(self) -> None:
        product_codes = [product["sdProductCode"] for product in self.payload["products"]]

        self.assertNotIn("SAOT25007CH", product_codes)
        self.assertNotIn("OOB116001AT", product_codes)

    def test_binding_report_summary_and_frontend_targets_are_generated(self) -> None:
        with self.binding_report_csv.open("r", encoding="utf-8-sig", newline="") as handle:
            report_rows = list(csv.DictReader(handle))

        self.assertEqual(len(report_rows), 2)
        self.assertEqual(report_rows[0]["primary_image_found"], "true")
        self.assertEqual(report_rows[0]["gallery_image_count"], "2")
        self.assertTrue(self.binding_summary_csv.exists())
        self.assertTrue(self.binding_summary_md.exists())
        self.assertTrue(self.frontend_targets_csv.exists())


if __name__ == "__main__":
    unittest.main()
