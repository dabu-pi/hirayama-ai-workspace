from __future__ import annotations

import unittest

from scripts.prepare_wordpress_public_targets import derive_public_targets


class PrepareWordpressPublicTargetsTest(unittest.TestCase):
    def test_only_public_non_sold_rows_become_targets(self) -> None:
        rows = [
            {
                "sd_product_code": "HYEL15009AT",
                "publish_status": "public",
                "sold_out_flag": "False",
                "seo_slug": "hyel15009at",
            },
            {
                "sd_product_code": "HYEL15010AT",
                "publish_status": "private",
                "sold_out_flag": "False",
                "seo_slug": "hyel15010at",
            },
            {
                "sd_product_code": "HYEL15011AT",
                "publish_status": "public",
                "sold_out_flag": "True",
                "seo_slug": "hyel15011at",
            },
        ]

        targets = derive_public_targets(rows)

        self.assertEqual(len(targets), 1)
        self.assertEqual(targets[0].sd_product_code, "HYEL15009AT")
        self.assertEqual(targets[0].slug, "hyel15009at")
        self.assertEqual(targets[0].product_url, "https://machine-group.net/products/hyel15009at/")

    def test_slug_note_is_added_when_stored_slug_differs(self) -> None:
        rows = [
            {
                "sd_product_code": "HYEL15009AT",
                "publish_status": "public",
                "sold_out_flag": "False",
                "seo_slug": "custom-slug",
            }
        ]

        targets = derive_public_targets(rows)

        self.assertIn("seo_slug_differs=custom-slug", targets[0].notes)


if __name__ == "__main__":
    unittest.main()
