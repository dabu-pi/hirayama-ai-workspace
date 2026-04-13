from __future__ import annotations

import unittest

from scripts.lib.wordpress_image_recovery import choose_best_srcset_url, parse_product_page


class WordpressImageRecoveryTest(unittest.TestCase):
    def test_parse_product_page_prefers_gallery_images_and_reads_codes(self) -> None:
        html = """
        <html>
          <head>
            <meta property="og:image" content="../../wp-content/uploads//HYCY26924AT_1.jpg" />
          </head>
          <body>
            <table><tr><td>HYCY26924AT</td></tr></table>
            <input type="hidden" name="product-code" value="HYCY26924AT" />
            <img class="slider-main-img slider-main-img1" src="../../wp-content/uploads//HYCY26924AT_1.png" alt="" />
            <img class="slider-thumb-img slider-thumb-img2" src="../../wp-content/uploads//HYCY26924AT_2.png" alt="" />
          </body>
        </html>
        """

        parsed = parse_product_page(
            html,
            "https://machine-group.net/products/hycy26924at/",
            "HYCY26924AT",
        )

        self.assertEqual(parsed.product_code_in_page, "HYCY26924AT")
        self.assertEqual(parsed.hidden_product_code, "HYCY26924AT")
        self.assertEqual(
            [candidate.image_url for candidate in parsed.gallery_images],
            [
                "https://machine-group.net/wp-content/uploads/HYCY26924AT_1.png",
                "https://machine-group.net/wp-content/uploads/HYCY26924AT_2.png",
            ],
        )
        self.assertEqual(parsed.og_image_url, "https://machine-group.net/wp-content/uploads/HYCY26924AT_1.jpg")

    def test_choose_best_srcset_url_prefers_largest_width(self) -> None:
        srcset = (
            "../../wp-content/uploads/HYNT23899AT_1-300x300.jpg 300w, "
            "../../wp-content/uploads/HYNT23899AT_1.jpg 1200w"
        )

        self.assertEqual(
            choose_best_srcset_url(srcset, "https://machine-group.net/products/hynt23899at/"),
            "https://machine-group.net/wp-content/uploads/HYNT23899AT_1.jpg",
        )


if __name__ == "__main__":
    unittest.main()
