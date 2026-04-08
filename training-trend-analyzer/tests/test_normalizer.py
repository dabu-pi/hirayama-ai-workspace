"""
test_normalizer.py — 正規化エンジンのテスト・検証ケース

実務上ありがちな表記ゆれパターンを網羅的にカバーする。

実行方法:
    cd training-trend-analyzer/
    python -m pytest tests/test_normalizer.py -v
    python tests/test_normalizer.py   # pytest なしでも動く
"""

import sys
import io
from pathlib import Path

# Windows 文字化け対策
if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

# プロジェクトルートを PATH に追加
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.normalizer.engine import NormalizerEngine
from src.normalizer.rules import normalize_text
from src.normalizer.types import MatchType, CertaintyLabel

MASTER_DIR = Path(__file__).parent.parent / "data" / "master"


# -------------------------------------------------------------------------
# テストフィクスチャ
# -------------------------------------------------------------------------

def get_engine() -> NormalizerEngine:
    return NormalizerEngine.from_master_dir(MASTER_DIR)


# -------------------------------------------------------------------------
# テストケース: rules.normalize_text（前処理）
# -------------------------------------------------------------------------

def test_rules_fullwidth_to_halfwidth():
    """全角英数 → 半角変換"""
    cases = [
        ("ＴＥＣＨＮＯＧＹＭ", "TECHNOGYM"),
        ("ｔｅｃｈｎｏｇｙｍ", "TECHNOGYM"),   # 全角小文字 → 半角大文字
        ("Ｔ５", "T5"),
        ("ＩＣ５", "IC5"),
    ]
    for raw, expected in cases:
        result, steps = normalize_text(raw)
        assert result == expected, f"FAIL: '{raw}' → '{result}' (expected '{expected}')"
        print(f"  OK [fullwidth] '{raw}' → '{result}'")


def test_rules_ascii_uppercase():
    """小文字 → 大文字変換（日本語は変えない）"""
    cases = [
        ("technogym", "TECHNOGYM"),
        ("life fitness", "LIFE FITNESS"),
        ("テクノジム run", "テクノジム RUN"),
    ]
    for raw, expected in cases:
        result, _ = normalize_text(raw)
        assert result == expected, f"FAIL: '{raw}' → '{result}'"
        print(f"  OK [uppercase] '{raw}' → '{result}'")


def test_rules_whitespace():
    """連続スペース・全角スペースの正規化"""
    cases = [
        ("TECHNOGYM  RUN",    "TECHNOGYM RUN"),
        ("LIFE　FITNESS",     "LIFE FITNESS"),   # 全角スペース
        (" TECHNOGYM ",       "TECHNOGYM"),
    ]
    for raw, expected in cases:
        result, _ = normalize_text(raw)
        assert result == expected, f"FAIL: '{raw}' → '{result}'"
        print(f"  OK [whitespace] '{raw}' → '{result}'")


# -------------------------------------------------------------------------
# テストケース: ブランド解決
# -------------------------------------------------------------------------

def test_brand_exact_canonical():
    """正規名称そのもの"""
    engine = get_engine()
    for raw in ["TECHNOGYM", "Life Fitness", "Concept2"]:
        r = engine.normalize_brand(raw)
        assert r.canonical_brand is not None, f"FAIL: '{raw}' → unresolved"
        assert not r.is_unresolved, f"FAIL: '{raw}' marked unresolved"
        print(f"  OK [brand exact] '{raw}' → '{r.canonical_brand}' ({r.certainty_label})")


def test_brand_japanese():
    """日本語表記"""
    engine = get_engine()
    cases = [
        ("テクノジム",    "TECHNOGYM"),
        ("ライフフィットネス", "Life Fitness"),
        ("コンセプト2",   "Concept2"),
        ("マトリックス",  "Matrix"),
    ]
    for raw, expected_brand in cases:
        r = engine.normalize_brand(raw)
        assert r.canonical_brand == expected_brand, \
            f"FAIL: '{raw}' → '{r.canonical_brand}' (expected '{expected_brand}')"
        print(f"  OK [brand ja] '{raw}' → '{r.canonical_brand}'")


def test_brand_typo_variations():
    """表記ゆれ・タイポ"""
    engine = get_engine()
    cases = [
        ("TECHNO GYM",   "TECHNOGYM"),
        ("TECHNO-GYM",   "TECHNOGYM"),
        ("technogym",    "TECHNOGYM"),
        ("LIFEFITNESS",  "Life Fitness"),
        ("LIFE-FITNESS", "Life Fitness"),
        ("CONCEPT 2",    "Concept2"),
        ("C2",           "Concept2"),
        ("プレコア",      "Precor"),    # "プレコー"の表記ゆれ
    ]
    for raw, expected_brand in cases:
        r = engine.normalize_brand(raw)
        assert r.canonical_brand == expected_brand, \
            f"FAIL: '{raw}' → '{r.canonical_brand}' (expected '{expected_brand}')"
        print(f"  OK [brand typo] '{raw}' → '{r.canonical_brand}' (conf={r.brand_confidence})")


def test_brand_fullwidth_variations():
    """全角表記のブランド"""
    engine = get_engine()
    cases = [
        ("ＴＥＣＨＮＯＧＹＭ", "TECHNOGYM"),
        ("ｌｉｆｅ ｆｉｔｎｅｓｓ", "Life Fitness"),
    ]
    for raw, expected_brand in cases:
        r = engine.normalize_brand(raw)
        assert r.canonical_brand == expected_brand, \
            f"FAIL: '{raw}' → '{r.canonical_brand}'"
        print(f"  OK [brand fullwidth] '{raw}' → '{r.canonical_brand}'")


def test_brand_unresolved():
    """未知ブランドは UNRESOLVED で返す"""
    engine = get_engine()
    unknowns = ["XYZ FITNESS", "謎のブランド", "FAKE-BRAND-123"]
    for raw in unknowns:
        r = engine.normalize_brand(raw)
        assert r.is_unresolved, f"FAIL: '{raw}' should be unresolved but got '{r.canonical_brand}'"
        print(f"  OK [brand unresolved] '{raw}' → UNRESOLVED (reason: {r.unresolved_reason})")


# -------------------------------------------------------------------------
# テストケース: カテゴリ解決
# -------------------------------------------------------------------------

def test_category_japanese():
    """日本語カテゴリ名"""
    engine = get_engine()
    cases = [
        ("トレッドミル",       "treadmill"),
        ("ランニングマシン",    "treadmill"),
        ("クロストレーナー",   "elliptical"),
        ("エリプティカル",     "elliptical"),
        ("ローイングマシン",   "rowing"),
        ("スピンバイク",       "spin_bike"),
        ("ファンクショナルトレーナー", "functional_trainer"),
        ("スミスマシン",       "smith_machine"),
    ]
    for raw, expected_cat in cases:
        r = engine.normalize(raw)
        assert r.canonical_category == expected_cat, \
            f"FAIL: '{raw}' → '{r.canonical_category}' (expected '{expected_cat}')"
        print(f"  OK [category ja] '{raw}' → '{r.canonical_category}'")


def test_category_english():
    """英語カテゴリ名"""
    engine = get_engine()
    cases = [
        ("TREADMILL",  "treadmill"),
        ("ELLIPTICAL", "elliptical"),
        ("ROWING",     "rowing"),
    ]
    for raw, expected_cat in cases:
        r = engine.normalize(raw)
        assert r.canonical_category == expected_cat, \
            f"FAIL: '{raw}' → '{r.canonical_category}'"
        print(f"  OK [category en] '{raw}' → '{r.canonical_category}'")


# -------------------------------------------------------------------------
# テストケース: モデル解決
# -------------------------------------------------------------------------

def test_model_with_brand_prefix():
    """ブランド名付きモデル名"""
    engine = get_engine()
    cases = [
        ("TECHNOGYM RUN",       "TECHNOGYM",    "Run"),
        ("TECHNOGYM SKILLROW",  "TECHNOGYM",    "Skillrow"),
        ("LIFE FITNESS T5",     "Life Fitness", "T5"),
        ("MATRIX T75",          "Matrix",       "T75"),
        ("PRECOR TRM 445",      "Precor",       "TRM 445"),
        ("CONCEPT2 MODEL D",    "Concept2",     "Model D"),
    ]
    for raw, expected_brand, expected_model in cases:
        r = engine.normalize(raw)
        assert r.canonical_brand == expected_brand, \
            f"FAIL brand: '{raw}' → '{r.canonical_brand}'"
        assert r.canonical_model == expected_model, \
            f"FAIL model: '{raw}' → '{r.canonical_model}' (expected '{expected_model}')"
        print(f"  OK [model+brand] '{raw}' → brand='{r.canonical_brand}' model='{r.canonical_model}'")


def test_model_abbreviation():
    """型番の表記ゆれ（ハイフン・スペースなし）"""
    engine = get_engine()
    cases = [
        ("TRM445", "TRM 445"),
        ("SKIERG", "SkiErg"),
        ("SKI ERG", "SkiErg"),
    ]
    for raw, expected_model in cases:
        r = engine.normalize(raw)
        assert r.canonical_model == expected_model, \
            f"FAIL: '{raw}' → '{r.canonical_model}' (expected '{expected_model}')"
        print(f"  OK [model abbrev] '{raw}' → '{r.canonical_model}'")


# -------------------------------------------------------------------------
# テストケース: use_type 判定
# -------------------------------------------------------------------------

def test_use_type_commercial():
    """業務用マシンは commercial"""
    engine = get_engine()
    r = engine.normalize("TECHNOGYM RUN")
    assert r.use_type == "commercial", f"FAIL: use_type='{r.use_type}'"
    print(f"  OK [use_type] TECHNOGYM RUN → '{r.use_type}'")


def test_use_type_consumer():
    """家庭用ブランドは consumer"""
    engine = get_engine()
    r = engine.normalize("HORIZON FITNESS")
    assert r.use_type in ("consumer", "unknown"), f"FAIL: use_type='{r.use_type}'"
    print(f"  OK [use_type] HORIZON FITNESS → '{r.use_type}'")


# -------------------------------------------------------------------------
# テストケース: confidence / certainty_label
# -------------------------------------------------------------------------

def test_confidence_high_for_exact():
    """完全一致は HIGH"""
    engine = get_engine()
    r = engine.normalize_brand("TECHNOGYM")
    assert r.certainty_label == CertaintyLabel.HIGH, \
        f"FAIL: certainty='{r.certainty_label}'"
    print(f"  OK [confidence] TECHNOGYM → {r.confidence} ({r.certainty_label})")


def test_confidence_lower_for_abbreviation():
    """略称は信頼度が下がる"""
    engine = get_engine()
    r = engine.normalize_brand("C2")
    assert r.confidence is not None
    assert r.confidence < 1.0, f"FAIL: confidence should be < 1.0, got {r.confidence}"
    print(f"  OK [confidence abbrev] C2 → {r.confidence} ({r.certainty_label})")


# -------------------------------------------------------------------------
# まとめて実行
# -------------------------------------------------------------------------

ALL_TESTS = [
    ("前処理: 全角→半角",         test_rules_fullwidth_to_halfwidth),
    ("前処理: 大文字変換",         test_rules_ascii_uppercase),
    ("前処理: 空白正規化",         test_rules_whitespace),
    ("ブランド: 正規名称",         test_brand_exact_canonical),
    ("ブランド: 日本語",           test_brand_japanese),
    ("ブランド: 表記ゆれ・タイポ", test_brand_typo_variations),
    ("ブランド: 全角表記",         test_brand_fullwidth_variations),
    ("ブランド: 未解決",           test_brand_unresolved),
    ("カテゴリ: 日本語",           test_category_japanese),
    ("カテゴリ: 英語",             test_category_english),
    ("モデル: ブランド名付き",     test_model_with_brand_prefix),
    ("モデル: 略称・型番ゆれ",     test_model_abbreviation),
    ("use_type: 業務用",           test_use_type_commercial),
    ("use_type: 家庭用",           test_use_type_consumer),
    ("信頼度: 完全一致→HIGH",      test_confidence_high_for_exact),
    ("信頼度: 略称→lower",         test_confidence_lower_for_abbreviation),
]


def run_all():
    passed = 0
    failed = 0
    errors = []

    print("=" * 60)
    print("正規化エンジン 検証ケース")
    print("=" * 60)

    for name, fn in ALL_TESTS:
        print(f"\n[{name}]")
        try:
            fn()
            passed += 1
        except AssertionError as e:
            print(f"  FAIL: {e}")
            failed += 1
            errors.append((name, str(e)))
        except Exception as e:
            print(f"  ERROR: {e}")
            failed += 1
            errors.append((name, f"EXCEPTION: {e}"))

    print()
    print("=" * 60)
    print(f"結果: {passed} passed / {failed} failed")
    if errors:
        print("\n失敗一覧:")
        for name, msg in errors:
            print(f"  - [{name}] {msg}")
    print("=" * 60)
    return failed == 0


if __name__ == "__main__":
    success = run_all()
    sys.exit(0 if success else 1)
