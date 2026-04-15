"""
artifact_parser.py — Executor 出力から artifact 候補を抽出する (Phase 6)

Markdown のフェンスコードブロック（``` ... ```）を解析して、
artifact の候補リストを返す。1 メッセージに複数ブロックがあっても対応する。

設計方針:
  - 抽出のみ行い、DB 保存は行わない（orchestrator.py 側が保存する）
  - 空ブロックは除外する（言語行だけで本文なし、またはスペースのみ）
  - 言語情報を保持して artifact_type / language を決定する
  - インデントされたコードブロック（4 スペース / タブ）は対象外
    （構造が複雑で誤検知が多いため）

対象とする artifact:
  - Markdown フェンスコードブロック (``` 言語 ... ```)
    * 言語未指定 (```) → type='code', language=''
  - 言語 → artifact_type マッピング:
    * python / py / javascript / js / typescript / ts /
      rust / go / java / c / cpp / swift / kotlin / ruby / php → 'code'
    * bash / sh / shell / zsh / powershell → 'shell'
    * sql → 'code' (language='sql')
    * json → 'json'
    * yaml / yml / toml / ini / xml / config → 'file'
    * markdown / md → 'markdown'
    * その他 / 未指定 → 'code'

設計根拠: aios-orchestrator/dual-agent-poc/README_Phase6.md
"""

from __future__ import annotations

import re
from typing import Optional


# ─── 言語 → artifact_type マッピング ─────────────────────────────────────────
_LANG_TO_TYPE: dict[str, str] = {
    # コード系
    "python":     "code",
    "py":         "code",
    "javascript": "code",
    "js":         "code",
    "typescript": "code",
    "ts":         "code",
    "rust":       "code",
    "go":         "code",
    "java":       "code",
    "c":          "code",
    "cpp":        "code",
    "c++":        "code",
    "swift":      "code",
    "kotlin":     "code",
    "ruby":       "code",
    "php":        "code",
    "sql":        "code",
    "r":          "code",
    "scala":      "code",
    "haskell":    "code",
    "elixir":     "code",
    # シェル系
    "bash":       "shell",
    "sh":         "shell",
    "shell":      "shell",
    "zsh":        "shell",
    "powershell": "shell",
    "ps1":        "shell",
    "cmd":        "shell",
    # データ形式
    "json":       "json",
    # 設定ファイル系
    "yaml":       "file",
    "yml":        "file",
    "toml":       "file",
    "ini":        "file",
    "xml":        "file",
    "html":       "file",
    "css":        "file",
    "dockerfile": "file",
    # Markdown
    "markdown":   "markdown",
    "md":         "markdown",
}

# ─── フェンスコードブロックの正規表現 ─────────────────────────────────────────
# グループ:
#   1: バッククォート数（3以上）
#   2: 言語タグ（空文字 or 言語名、前後スペース可）
#   3: コードブロック本文
_FENCED_CODE_RE = re.compile(
    r"(?m)^(`{3,})\s*([\w+\-\.]*)\s*\n(.*?)^\1\s*$",
    re.DOTALL | re.MULTILINE,
)


def _lang_to_type(lang: str) -> str:
    """言語名 → artifact_type 文字列に変換する。未登録なら 'code' を返す。"""
    return _LANG_TO_TYPE.get(lang.lower().strip(), "code")


def _infer_filename(lang: str, index: int) -> Optional[str]:
    """言語からデフォルトファイル名を推定する（任意）。"""
    ext_map = {
        "python": "py", "py": "py",
        "javascript": "js", "js": "js",
        "typescript": "ts", "ts": "ts",
        "rust": "rs", "go": "go", "java": "java",
        "c": "c", "cpp": "cpp", "c++": "cpp",
        "sql": "sql", "bash": "sh", "sh": "sh",
        "shell": "sh", "zsh": "sh",
        "json": "json", "yaml": "yaml", "yml": "yml",
        "toml": "toml", "xml": "xml", "html": "html",
        "css": "css", "markdown": "md", "md": "md",
        "dockerfile": "Dockerfile",
    }
    lang_lower = lang.lower().strip()
    ext = ext_map.get(lang_lower)
    if ext == "Dockerfile":
        return "Dockerfile"
    if ext:
        suffix = f"_{index}" if index > 0 else ""
        return f"artifact{suffix}.{ext}"
    return None


def parse_artifacts(content: str) -> list[dict]:
    """
    Executor 出力のテキストから artifact 候補を抽出して返す。

    Args:
        content: Executor の発言全文

    Returns:
        以下の dict のリスト（空ブロックは除外）:
        {
            "artifact_type": str,   # 'code' | 'shell' | 'json' | 'file' | 'markdown'
            "language":      str,   # フェンス言語タグ（'python', 'sql', '', ...）
            "filename":      str | None,  # 推定ファイル名（任意）
            "body":          str,   # コードブロック本文
        }
    """
    results = []
    seen_bodies: set[str] = set()  # 同一内容の重複を除外

    for idx, match in enumerate(_FENCED_CODE_RE.finditer(content)):
        lang = (match.group(2) or "").strip()
        body = match.group(3).rstrip()  # 末尾の空白行を除去

        # 空ブロックを除外
        if not body.strip():
            continue

        # 完全重複を除外（同一メッセージ内で同じコードが 2 回出てきた場合）
        body_key = body.strip()
        if body_key in seen_bodies:
            continue
        seen_bodies.add(body_key)

        artifact_type = _lang_to_type(lang)
        filename = _infer_filename(lang, idx)

        results.append({
            "artifact_type": artifact_type,
            "language":      lang,
            "filename":      filename,
            "body":          body,
        })

    return results
