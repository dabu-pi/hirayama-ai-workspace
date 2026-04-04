from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass(frozen=True)
class ParsedSdProductCode:
    raw_code: str
    store_legacy_code: str
    maker_legacy_code: str
    purchase_year_code: str
    serial_no_text: str
    part_legacy_code: str

    @property
    def serial_no(self) -> int | None:
        return int(self.serial_no_text) if self.serial_no_text.isdigit() else None

    def as_dict(self) -> dict[str, object]:
        return {
            "raw_code": self.raw_code,
            "store_legacy_code": self.store_legacy_code,
            "maker_legacy_code": self.maker_legacy_code,
            "purchase_year_code": self.purchase_year_code,
            "serial_no_text": self.serial_no_text,
            "serial_no": self.serial_no,
            "part_legacy_code": self.part_legacy_code,
        }

    def describe(self) -> str:
        return (
            f"{self.store_legacy_code} + {self.maker_legacy_code} + "
            f"{self.purchase_year_code} + {self.serial_no_text} + {self.part_legacy_code}"
        )


@dataclass(frozen=True)
class ValidationIssue:
    level: str
    code: str
    message: str


@dataclass
class SdProductCodeValidationResult:
    is_valid: bool
    parsed: ParsedSdProductCode | None
    issues: list[ValidationIssue] = field(default_factory=list)

    def messages(self) -> list[str]:
        return [issue.message for issue in self.issues]

    def status(self) -> str:
        if any(issue.level == "error" for issue in self.issues):
            return "error"
        if self.issues:
            return "warning"
        return "ok"


def parse_sd_product_code(
    sd_product_code: str,
    store_legacy_codes: list[str],
    maker_legacy_codes: list[str],
    part_legacy_codes: list[str],
    allow_legacy_empty_part: bool = False,
) -> ParsedSdProductCode:
    code = sd_product_code.strip().upper()
    if not code:
        raise ValueError("sd_product_code is empty.")
    if not re.fullmatch(r"[A-Za-z0-9]+", code):
        raise ValueError("sd_product_code must contain only half-width alphanumeric characters.")

    store_code = _match_prefix(code, store_legacy_codes)
    if not store_code:
        raise ValueError(f"Unknown store legacy code in {code}.")

    remainder = code[len(store_code) :]
    part_code = _match_suffix(remainder, [value for value in part_legacy_codes if value])
    if not part_code and allow_legacy_empty_part and "" in part_legacy_codes:
        part_code = ""
    elif not part_code:
        raise ValueError(f"Unknown part legacy code in {code}.")

    core = remainder[: -len(part_code)] if part_code else remainder
    if len(core) < 6:
        raise ValueError(f"Code body is too short after removing store/part: {code}.")

    serial_no_text = core[-3:]
    purchase_year_code = core[-5:-3]
    maker_code = core[:-5]

    if not re.fullmatch(r"\d{3}", serial_no_text):
        raise ValueError(f"Serial segment must be 3 digits: {serial_no_text}.")
    if not (purchase_year_code == "MD" or re.fullmatch(r"\d{2}", purchase_year_code)):
        raise ValueError(f"Year segment must be YY or MD: {purchase_year_code}.")
    if maker_code not in maker_legacy_codes:
        raise ValueError(f"Unknown maker legacy code in {code}: {maker_code}.")

    return ParsedSdProductCode(
        raw_code=code,
        store_legacy_code=store_code,
        maker_legacy_code=maker_code,
        purchase_year_code=purchase_year_code,
        serial_no_text=serial_no_text,
        part_legacy_code=part_code,
    )


def validate_sd_product_code(
    sd_product_code: str,
    *,
    store_legacy_codes: list[str],
    maker_legacy_codes: list[str],
    part_legacy_codes: list[str],
    maker_legacy_code_map: dict[str, list[str]] | None = None,
    expected_store_legacy_code: str = "",
    expected_maker_legacy_code: str = "",
    expected_purchase_year_code: str = "",
    expected_serial_no: int | str | None = None,
    expected_part_legacy_code: str = "",
    mode: str = "strict",
    allow_legacy_empty_part: bool = False,
) -> SdProductCodeValidationResult:
    issues: list[ValidationIssue] = []
    parsed: ParsedSdProductCode | None = None

    try:
        parsed = parse_sd_product_code(
            sd_product_code=sd_product_code,
            store_legacy_codes=store_legacy_codes,
            maker_legacy_codes=maker_legacy_codes,
            part_legacy_codes=part_legacy_codes,
            allow_legacy_empty_part=allow_legacy_empty_part,
        )
    except ValueError as exc:
        return SdProductCodeValidationResult(
            is_valid=False,
            parsed=None,
            issues=[
                ValidationIssue(
                    level="error",
                    code="parse_error",
                    message=str(exc),
                )
            ],
        )

    expected_store_legacy_code = expected_store_legacy_code.upper()
    expected_maker_legacy_code = expected_maker_legacy_code.upper()
    expected_purchase_year_code = expected_purchase_year_code.upper()
    expected_part_legacy_code = expected_part_legacy_code.upper()

    if expected_store_legacy_code and parsed.store_legacy_code != expected_store_legacy_code:
        issues.append(
            ValidationIssue(
                level="error",
                code="store_mismatch",
                message=(
                    f"Store code mismatch: expected {expected_store_legacy_code}, "
                    f"got {parsed.store_legacy_code}."
                ),
            )
        )

    if expected_maker_legacy_code and parsed.maker_legacy_code != expected_maker_legacy_code:
        issues.append(
            ValidationIssue(
                level="error",
                code="maker_mismatch",
                message=(
                    f"Maker code mismatch: expected {expected_maker_legacy_code}, "
                    f"got {parsed.maker_legacy_code}."
                ),
            )
        )

    if expected_purchase_year_code and parsed.purchase_year_code != expected_purchase_year_code:
        issues.append(
            ValidationIssue(
                level="error",
                code="purchase_year_mismatch",
                message=(
                    f"Purchase year mismatch: expected {expected_purchase_year_code}, "
                    f"got {parsed.purchase_year_code}."
                ),
            )
        )

    if expected_serial_no not in (None, ""):
        expected_serial_text = str(expected_serial_no).zfill(3)
        if parsed.serial_no_text != expected_serial_text:
            issues.append(
                ValidationIssue(
                    level="error",
                    code="serial_no_mismatch",
                    message=(
                        f"Serial number mismatch: expected {expected_serial_text}, "
                        f"got {parsed.serial_no_text}."
                    ),
                )
            )

    if expected_part_legacy_code != "" and parsed.part_legacy_code != expected_part_legacy_code:
        issues.append(
            ValidationIssue(
                level="error",
                code="part_mismatch",
                message=(
                    f"Part code mismatch: expected {expected_part_legacy_code}, "
                    f"got {parsed.part_legacy_code}."
                ),
            )
        )

    if (
        maker_legacy_code_map
        and len(maker_legacy_code_map.get(parsed.maker_legacy_code, [])) > 1
    ):
        level = "warning" if mode == "lenient" else "error"
        issues.append(
            ValidationIssue(
                level=level,
                code="maker_legacy_code_ambiguous",
                message=(
                    f"Maker legacy code {parsed.maker_legacy_code} is shared by "
                    f"{maker_legacy_code_map[parsed.maker_legacy_code]}."
                ),
            )
        )

    if parsed.part_legacy_code == "" and allow_legacy_empty_part:
        issues.append(
            ValidationIssue(
                level="warning",
                code="legacy_empty_part_code",
                message="Legacy empty part code detected. Existing code is accepted, but new numbering should use a non-empty part code.",
            )
        )

    is_valid = not any(issue.level == "error" for issue in issues)
    return SdProductCodeValidationResult(is_valid=is_valid, parsed=parsed, issues=issues)


def _match_prefix(value: str, candidates: list[str]) -> str:
    for candidate in sorted(
        {candidate for candidate in candidates if candidate},
        key=lambda item: (-len(item), item),
    ):
        if value.startswith(candidate):
            return candidate
    return ""


def _match_suffix(value: str, candidates: list[str]) -> str:
    for candidate in sorted(
        {candidate for candidate in candidates if candidate},
        key=lambda item: (-len(item), item),
    ):
        if value.endswith(candidate):
            return candidate
    return ""
