"""
rules.py — テキスト前処理ルール

raw テキストを正規化エンジンに渡す前に行う変換。
ここに追加するルールは「変換の根拠が明確なもの」に限定する。
曖昧な変換はしない。
"""

import re
import unicodedata


# 除去・正規化対象の記号パターン
_STRIP_PATTERN = re.compile(r"[\u3000\s\t　]+")  # 全角スペース・タブ類


def normalize_text(text: str) -> tuple[str, list[str]]:
    """
    テキストを正規化し、（変換後テキスト, 適用したステップのリスト）を返す。

    処理順序:
    1. 全角英数・記号を半角に変換
    2. 大文字統一（ASCII部分のみ）
    3. 連続スペースを単一スペースに
    4. 前後トリム
    """
    steps: list[str] = []
    original = text

    # 1. 全角 → 半角（NFKC 正規化）
    normalized = unicodedata.normalize("NFKC", text)
    if normalized != text:
        steps.append("fullwidth_to_halfwidth")
    text = normalized

    # 2. ASCII 部分を大文字に
    uppercased = _ascii_upper(text)
    if uppercased != text:
        steps.append("ascii_uppercase")
    text = uppercased

    # 3. 連続スペース → 単一スペース
    collapsed = _STRIP_PATTERN.sub(" ", text).strip()
    if collapsed != text:
        steps.append("whitespace_collapse")
    text = collapsed

    return text, steps


def _ascii_upper(text: str) -> str:
    """ASCII文字のみを大文字にする（日本語部分はそのまま）"""
    result = []
    for ch in text:
        if ord(ch) < 128:
            result.append(ch.upper())
        else:
            result.append(ch)
    return "".join(result)


def strip_brand_prefix(text: str, brand_name: str) -> str:
    """
    テキストの先頭からブランド名プレフィックスを除去する。
    "TECHNOGYM RUN" → "RUN"
    """
    prefix = brand_name.upper() + " "
    if text.upper().startswith(prefix):
        return text[len(prefix):].strip()
    return text


def split_brand_model(text: str, known_brands: list[str]) -> tuple[str | None, str]:
    """
    "BRAND MODEL" 形式のテキストをブランドとモデルに分割する。
    known_brands は正規化済み（UPPERCASE）のブランド名リスト。

    Returns: (brand_hint, remaining_text)
    """
    text_upper = text.upper()
    for brand in sorted(known_brands, key=len, reverse=True):
        brand_upper = brand.upper()
        if text_upper.startswith(brand_upper + " "):
            remaining = text[len(brand):].strip()
            return brand, remaining
        if text_upper == brand_upper:
            return brand, ""
    return None, text
