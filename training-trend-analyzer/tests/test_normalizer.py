"""
test_normalizer.py - normalization smoke tests

Run examples:
    python -m pytest tests/test_normalizer.py -v
    python tests/test_normalizer.py
"""

import io
import sys
from pathlib import Path

if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.normalizer.engine import NormalizerEngine
from src.normalizer.rules import normalize_text
from src.normalizer.types import CertaintyLabel

MASTER_DIR = Path(__file__).parent.parent / "data" / "master"


def get_engine() -> NormalizerEngine:
    return NormalizerEngine.from_master_dir(MASTER_DIR)


def test_rules_fullwidth_to_halfwidth():
    cases = [
        ("ＴＥＣＨＮＯＧＹＭ", "TECHNOGYM"),
        ("テクノジム", "テクノジム"),
        ("Ｔ５", "T5"),
        ("ＩＣ５", "IC5"),
    ]
    for raw, expected in cases:
        result, _ = normalize_text(raw)
        assert result == expected, f"FAIL: '{raw}' -> '{result}' (expected '{expected}')"


def test_rules_ascii_uppercase():
    cases = [
        ("technogym", "TECHNOGYM"),
        ("life fitness", "LIFE FITNESS"),
        ("テクノジム run", "テクノジム RUN"),
    ]
    for raw, expected in cases:
        result, _ = normalize_text(raw)
        assert result == expected, f"FAIL: '{raw}' -> '{result}'"


def test_rules_whitespace():
    cases = [
        ("TECHNOGYM  RUN", "TECHNOGYM RUN"),
        ("LIFE　FITNESS", "LIFE FITNESS"),
        (" TECHNOGYM ", "TECHNOGYM"),
    ]
    for raw, expected in cases:
        result, _ = normalize_text(raw)
        assert result == expected, f"FAIL: '{raw}' -> '{result}'"


def test_brand_exact_canonical():
    engine = get_engine()
    for raw in ["TECHNOGYM", "Life Fitness", "Concept2"]:
        r = engine.normalize_brand(raw)
        assert r.canonical_brand is not None
        assert not r.is_unresolved


def test_brand_japanese():
    engine = get_engine()
    cases = [
        ("テクノジム", "TECHNOGYM"),
        ("ライフフィットネス", "Life Fitness"),
        ("コンセプト2", "Concept2"),
        ("マトリックス", "Matrix"),
    ]
    for raw, expected_brand in cases:
        r = engine.normalize_brand(raw)
        assert r.canonical_brand == expected_brand


def test_brand_typo_variations():
    engine = get_engine()
    cases = [
        ("TECHNO GYM", "TECHNOGYM"),
        ("TECHNO-GYM", "TECHNOGYM"),
        ("technogym", "TECHNOGYM"),
        ("LIFEFITNESS", "Life Fitness"),
        ("LIFE-FITNESS", "Life Fitness"),
        ("CONCEPT 2", "Concept2"),
        ("C2", "Concept2"),
        ("プレコア", "Precor"),
    ]
    for raw, expected_brand in cases:
        r = engine.normalize_brand(raw)
        assert r.canonical_brand == expected_brand


def test_brand_fullwidth_variations():
    engine = get_engine()
    cases = [
        ("ＴＥＣＨＮＯＧＹＭ", "TECHNOGYM"),
        ("ＬＩＦＥ ＦＩＴＮＥＳＳ", "Life Fitness"),
    ]
    for raw, expected_brand in cases:
        r = engine.normalize_brand(raw)
        assert r.canonical_brand == expected_brand


def test_brand_unresolved():
    engine = get_engine()
    for raw in ["XYZ FITNESS", "謎ブランド", "FAKE-BRAND-123"]:
        r = engine.normalize_brand(raw)
        assert r.is_unresolved


def test_category_japanese():
    engine = get_engine()
    cases = [
        ("トレッドミル", "treadmill"),
        ("ランニングマシン", "treadmill"),
        ("クロストレーナー", "elliptical"),
        ("エリプティカル", "elliptical"),
        ("ローイングマシン", "rowing"),
        ("スピンバイク", "spin_bike"),
        ("ハックスクワット", "hack_squat"),
        ("ベルトスクワット", "belt_squat"),
        ("ファンクショナルトレーナー", "functional_trainer"),
        ("スミスマシン", "smith_machine"),
    ]
    for raw, expected_cat in cases:
        r = engine.normalize(raw)
        assert r.canonical_category == expected_cat


def test_category_english():
    engine = get_engine()
    cases = [
        ("TREADMILL", "treadmill"),
        ("ELLIPTICAL", "elliptical"),
        ("ROWING", "rowing"),
        ("LEG PRESS", "leg_press"),
        ("HACK SQUAT", "hack_squat"),
        ("BELT SQUAT", "belt_squat"),
        ("STAIR CLIMBER", "stair_climber"),
    ]
    for raw, expected_cat in cases:
        r = engine.normalize(raw)
        assert r.canonical_category == expected_cat


def test_model_with_brand_prefix():
    engine = get_engine()
    cases = [
        ("TECHNOGYM RUN", "TECHNOGYM", "Run"),
        ("TECHNOGYM SKILLROW", "TECHNOGYM", "Skillrow"),
        ("LIFE FITNESS T5", "Life Fitness", "T5"),
        ("MATRIX T75", "Matrix", "T75"),
        ("PRECOR TRM 445", "Precor", "TRM 445"),
        ("CONCEPT2 MODEL D", "Concept2", "Model D"),
    ]
    for raw, expected_brand, expected_model in cases:
        r = engine.normalize(raw)
        assert r.canonical_brand == expected_brand
        assert r.canonical_model == expected_model


def test_model_abbreviation():
    engine = get_engine()
    cases = [
        ("TRM445", "TRM 445"),
        ("SKIERG", "SkiErg"),
        ("SKI ERG", "SkiErg"),
    ]
    for raw, expected_model in cases:
        r = engine.normalize(raw)
        assert r.canonical_model == expected_model


def test_model_with_brand_hint():
    engine = get_engine()
    r = engine.normalize("SKI ERG", hint_brand="C2")
    assert r.canonical_brand == "Concept2"
    assert r.canonical_model == "SkiErg"


def test_use_type_commercial():
    engine = get_engine()
    r = engine.normalize("TECHNOGYM RUN")
    assert r.use_type == "commercial"


def test_use_type_consumer():
    engine = get_engine()
    r = engine.normalize("HORIZON FITNESS")
    assert r.use_type in ("consumer", "unknown")


def test_confidence_high_for_exact():
    engine = get_engine()
    r = engine.normalize_brand("TECHNOGYM")
    assert r.certainty_label == CertaintyLabel.HIGH


def test_confidence_lower_for_abbreviation():
    engine = get_engine()
    r = engine.normalize_brand("C2")
    assert r.confidence is not None
    assert r.confidence < 1.0


ALL_TESTS = [
    ("rules fullwidth", test_rules_fullwidth_to_halfwidth),
    ("rules uppercase", test_rules_ascii_uppercase),
    ("rules whitespace", test_rules_whitespace),
    ("brand exact", test_brand_exact_canonical),
    ("brand japanese", test_brand_japanese),
    ("brand typo", test_brand_typo_variations),
    ("brand fullwidth", test_brand_fullwidth_variations),
    ("brand unresolved", test_brand_unresolved),
    ("category japanese", test_category_japanese),
    ("category english", test_category_english),
    ("model with brand", test_model_with_brand_prefix),
    ("model abbreviation", test_model_abbreviation),
    ("model with hint", test_model_with_brand_hint),
    ("use_type commercial", test_use_type_commercial),
    ("use_type consumer", test_use_type_consumer),
    ("confidence exact", test_confidence_high_for_exact),
    ("confidence abbreviation", test_confidence_lower_for_abbreviation),
]


def run_all():
    passed = 0
    failed = 0
    errors = []

    print("=" * 60)
    print("Normalizer test suite")
    print("=" * 60)

    for name, fn in ALL_TESTS:
        print(f"\n[{name}]")
        try:
            fn()
            passed += 1
        except AssertionError as exc:
            print(f"  FAIL: {exc}")
            failed += 1
            errors.append((name, str(exc)))
        except Exception as exc:
            print(f"  ERROR: {exc}")
            failed += 1
            errors.append((name, f"EXCEPTION: {exc}"))

    print()
    print("=" * 60)
    print(f"Summary: {passed} passed / {failed} failed")
    if errors:
        print("\nFailures:")
        for name, msg in errors:
            print(f"  - [{name}] {msg}")
    print("=" * 60)
    return failed == 0


if __name__ == "__main__":
    raise SystemExit(0 if run_all() else 1)
