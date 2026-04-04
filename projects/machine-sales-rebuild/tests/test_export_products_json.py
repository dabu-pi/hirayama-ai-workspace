from __future__ import annotations

import json
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
        cls.output_json = cls.temp_dir / "products.sample.json"
        write_csv(cls.product_csv, result.rows, PRODUCT_MASTER_COLUMNS)

        cls.payload = export_products_json(
            input_path=cls.product_csv,
            output_path=cls.output_json,
            seed_dir=Path("data/seeds"),
        )

    def test_export_contains_schema_version_and_products(self) -> None:
        self.assertEqual(self.payload["schemaVersion"], "1.0.0")
        self.assertEqual(self.payload["source"]["system"], "integrated-sheet-v0")
        self.assertEqual(len(self.payload["products"]), 4)
        self.assertTrue(self.output_json.exists())

    def test_slug_and_main_image_contract(self) -> None:
        first_product = self.payload["products"][0]

        self.assertEqual(first_product["slug"], "oocy16003lg")
        self.assertEqual(first_product["images"][0]["sourceUrl"], "https://example.com/source-images/OOCY16003LG-1-original.jpg")
        self.assertIsNone(first_product["images"][0]["displayUrl"])
        self.assertTrue(first_product["images"][0]["isMain"])
        self.assertEqual(first_product["images"][0]["width"], 700)
        self.assertEqual(first_product["images"][0]["height"], 700)

    def test_no_image_product_outputs_empty_images(self) -> None:
        no_image_product = self.payload["products"][3]

        self.assertEqual(no_image_product["sdProductCode"], "SAOT25007CH")
        self.assertEqual(no_image_product["images"], [])
        self.assertEqual(no_image_product["visibility"]["status"], "private")
        self.assertFalse(no_image_product["visibility"]["isPublished"])

    def test_sold_product_visibility_and_price_label(self) -> None:
        sold_product = self.payload["products"][2]

        self.assertEqual(sold_product["visibility"]["status"], "sold_visible")
        self.assertTrue(sold_product["condition"]["isSoldOut"])
        self.assertEqual(sold_product["price"]["priceLabel"], "売却済み")


if __name__ == "__main__":
    unittest.main()
