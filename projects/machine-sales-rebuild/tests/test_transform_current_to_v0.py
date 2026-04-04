from __future__ import annotations

import json
import unittest
from pathlib import Path

from scripts.lib.product_v0 import load_settings_registry
from scripts.transform_current_to_v0 import load_current_rows, transform_rows


class TransformCurrentToV0Test(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.registry = load_settings_registry(Path("data/seeds"))
        cls.rows = load_current_rows(
            Path("data/samples/current_product_master_input_sample.csv")
        )
        cls.result = transform_rows(
            cls.rows,
            cls.registry,
            source_sheet_name="current_product_master_input_sample",
            generated_at="2026-04-05T00:00:00+09:00",
        )

    def test_images_1_to_3_are_converted_to_source_image_urls_json(self) -> None:
        first_row = self.result.rows[0]
        image_urls = json.loads(first_row["source_image_urls_json"])

        self.assertEqual(
            image_urls,
            [
                "https://example.com/source-images/OOCY16003LG-1-original.jpg",
                "https://example.com/source-images/OOCY16003LG-2-original.jpg",
            ],
        )
        self.assertEqual(first_row["source_image_count"], 2)
        self.assertEqual(first_row["main_image_index"], 1)

    def test_sold_product_visibility_is_converted(self) -> None:
        sold_row = self.result.rows[2]

        self.assertEqual(sold_row["sd_product_code"], "OOB116001AT")
        self.assertEqual(sold_row["publish_status"], "sold_visible")
        self.assertFalse(sold_row["inquiry_enabled"])
        self.assertTrue(sold_row["sold_out_flag"])

    def test_private_product_visibility_is_converted(self) -> None:
        private_row = self.result.rows[3]

        self.assertEqual(private_row["sd_product_code"], "SAOT25007CH")
        self.assertEqual(private_row["publish_status"], "private")
        self.assertFalse(private_row["inquiry_enabled"])
        self.assertFalse(private_row["sold_out_flag"])

    def test_unregistered_maker_is_reported(self) -> None:
        issue_messages = [
            issue.message
            for issue in self.result.issues
            if issue.issue_code == "maker_unregistered"
        ]

        self.assertTrue(issue_messages)
        self.assertIn("謎メーカー", issue_messages[0])

    def test_zero_image_row_is_kept_and_warned(self) -> None:
        no_image_row = self.result.rows[3]
        image_missing_issues = [
            issue
            for issue in self.result.issues
            if issue.issue_code == "image_missing"
            and issue.sd_product_code == "SAOT25007CH"
        ]

        self.assertEqual(no_image_row["source_image_urls_json"], "[]")
        self.assertEqual(no_image_row["source_image_count"], 0)
        self.assertTrue(image_missing_issues)


if __name__ == "__main__":
    unittest.main()
