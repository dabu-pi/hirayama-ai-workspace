from __future__ import annotations

import unittest

from scripts.lib.product_v0 import load_settings_registry
from scripts.lib.sd_product_code import parse_sd_product_code, validate_sd_product_code


class SdProductCodeTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.registry = load_settings_registry("data/seeds")

    def test_parse_valid_code(self) -> None:
        parsed = parse_sd_product_code(
            "OOCY16003LG",
            self.registry.all_legacy_codes("store"),
            self.registry.all_legacy_codes("maker"),
            self.registry.all_legacy_codes("part"),
            allow_legacy_empty_part=True,
        )

        self.assertEqual(parsed.store_legacy_code, "OO")
        self.assertEqual(parsed.maker_legacy_code, "CY")
        self.assertEqual(parsed.purchase_year_code, "16")
        self.assertEqual(parsed.serial_no_text, "003")
        self.assertEqual(parsed.serial_no, 3)
        self.assertEqual(parsed.part_legacy_code, "LG")
        self.assertEqual(parsed.describe(), "OO + CY + 16 + 003 + LG")

    def test_invalid_part_code_returns_error(self) -> None:
        result = validate_sd_product_code(
            "HYIC24909AT",
            store_legacy_codes=self.registry.all_legacy_codes("store"),
            maker_legacy_codes=self.registry.all_legacy_codes("maker"),
            part_legacy_codes=self.registry.all_legacy_codes("part"),
            maker_legacy_code_map=self.registry.legacy_code_map("maker"),
            expected_store_legacy_code="HY",
            expected_maker_legacy_code="IC",
            expected_purchase_year_code="24",
            expected_serial_no=909,
            expected_part_legacy_code="SH",
            mode="lenient",
            allow_legacy_empty_part=True,
        )

        self.assertFalse(result.is_valid)
        self.assertEqual(result.status(), "error")
        self.assertIn("Part code mismatch", " ".join(result.messages()))

    def test_unknown_maker_code_returns_error(self) -> None:
        result = validate_sd_product_code(
            "OOXX16003LG",
            store_legacy_codes=self.registry.all_legacy_codes("store"),
            maker_legacy_codes=self.registry.all_legacy_codes("maker"),
            part_legacy_codes=self.registry.all_legacy_codes("part"),
            maker_legacy_code_map=self.registry.legacy_code_map("maker"),
            mode="strict",
            allow_legacy_empty_part=True,
        )

        self.assertFalse(result.is_valid)
        self.assertEqual(result.status(), "error")
        self.assertIn("Unknown maker legacy code", " ".join(result.messages()))


if __name__ == "__main__":
    unittest.main()
