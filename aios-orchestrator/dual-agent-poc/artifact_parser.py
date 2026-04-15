"""
artifact_parser.py — Executor 出力から artifact 候補を抽出する (Phase 6 / Phase 10)

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

filename 明示指定（Phase 10）:
  コードブロック直前 3 行またはブロック先頭 1 行に以下の記法があれば、
  その filename を推定 filename より優先して使用する。
    // filename: foo.py      （JS / TS / Java スタイル）
    # filename: foo.py       （Python / bash スタイル）
    -- filename: schema.sql  （SQL スタイル）
    filename: config.yaml    （プレーン）
  明示 filename が安全でない場合（パストラバーサル等）は推定にフォールバックする。

設計根拠:
  aios-orchestrator/dual-agent-poc/README_Phase6.md
  aios-orchestrator/dual-agent-poc/README_Phase10.md
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

# ─── 無効 language タグのフィルタ ────────────────────────────────────────────
# 以下のタグは artifact 候補から除外する（false positive 対策 / Phase 7）:
#   - 数字のみ（行番号誤認: "1", "123" 等）
#   - 空白を含む（2語以上: "python code" 等）
# 正当な 1 文字タグ（"c", "r" 等）は許可する。
_INVALID_LANG_RE = re.compile(r"^\d+$")


def _is_valid_lang(lang: str) -> bool:
    """
    language タグが有効かを判定する。

    False を返す場合はその artifact をスキップする。
    空文字（`` ``` `` のみ）は有効（language 未指定として扱う）。
    """
    if not lang:
        return True  # 言語未指定は有効
    if _INVALID_LANG_RE.match(lang):
        return False  # 数字のみ → 行番号の誤認
    if " " in lang or "\t" in lang:
        return False  # スペースを含む → 言語タグではない
    return True


# ─── filename 明示指定パーサー（Phase 10）────────────────────────────────────
# 認識する記法（行全体を 1 行として扱う）:
#   // filename: foo.py      JS / TS / Java スタイル
#   # filename: foo.py       Python / bash スタイル
#   -- filename: schema.sql  SQL スタイル
#   filename: config.yaml    プレーン
_FILENAME_ANNOTATION_RE = re.compile(
    r"^\s*"                         # 行頭の空白
    r"(?://|#|--|\*|/\*)?"          # オプション: コメントプレフィックス
    r"\s*"                          # 空白
    r"filename\s*:\s*"              # "filename:" キーワード（大文字小文字無視）
    r"([^\s/\\:*?\"<>|\r\n]+)"      # キャプチャ: ファイル名本体（パス区切り・制御文字除外）
    r"\s*$",                        # 末尾空白
    re.IGNORECASE,
)

# 安全でない filename を弾くためのチェック
_UNSAFE_FILENAME_RE = re.compile(
    r"\.\."           # パストラバーサル (..)
    r"|[/\\]"         # パス区切り
    r"|[\x00-\x1f]"  # 制御文字
)


def _extract_explicit_filename(pre_lines: list[str], first_body_line: str) -> Optional[str]:
    """
    コードブロック直前の行リストとブロック先頭行から filename 指定を探す。

    検索順序:
      1. pre_lines を後ろから順に（直前行を優先）
      2. first_body_line（ブロック先頭行）

    見つかった場合: 正規化済みのファイル名文字列を返す
    見つからない / 不正な場合: None を返す
    """
    candidates: list[str] = list(reversed(pre_lines)) + [first_body_line]
    for line in candidates:
        m = _FILENAME_ANNOTATION_RE.match(line)
        if m:
            raw = m.group(1).strip()
            sanitized = _sanitize_filename(raw)
            if sanitized:
                return sanitized
    return None


def _sanitize_filename(raw: str) -> Optional[str]:
    """
    filename 文字列を安全に正規化する。

    拒否ルール:
      - 空文字 / 空白のみ
      - `..` を含む（パストラバーサル）
      - `/` または `\\` を含む（パス区切り）
      - 制御文字を含む
      - 255 文字超

    通過ルール:
      - 拡張子なし（Dockerfile, Makefile 等）は許可
      - 先頭・末尾の空白は除去する

    Returns:
        正規化済み文字列 or None（不正な場合）
    """
    name = raw.strip()
    if not name:
        return None
    if len(name) > 255:
        return None
    if _UNSAFE_FILENAME_RE.search(name):
        return None
    return name


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
            "artifact_type":    str,        # 'code' | 'shell' | 'json' | 'file' | 'markdown'
            "language":         str,        # フェンス言語タグ（'python', 'sql', '', ...）
            "filename":         str | None, # 明示 filename（優先） or 推定 filename
            "filename_source":  str,        # 'explicit' | 'inferred' | 'none'
            "body":             str,        # コードブロック本文
        }
    """
    results = []
    seen_bodies: set[str] = set()  # 同一内容の重複を除外

    # 行単位リスト（直前行抽出に使用）
    content_lines = content.splitlines()

    for idx, match in enumerate(_FENCED_CODE_RE.finditer(content)):
        lang = (match.group(2) or "").strip()
        body = match.group(3).rstrip()  # 末尾の空白行を除去

        # 無効 language タグをスキップ（数字のみ / スペース含む）
        if not _is_valid_lang(lang):
            continue

        # 空ブロックを除外
        if not body.strip():
            continue

        # 完全重複を除外（同一メッセージ内で同じコードが 2 回出てきた場合）
        body_key = body.strip()
        if body_key in seen_bodies:
            continue
        seen_bodies.add(body_key)

        artifact_type = _lang_to_type(lang)

        # ── filename 決定（Phase 10）────────────────────────────────────────
        # 1. コードブロック開始位置より前の行リストを取得（最大 3 行）
        block_start_pos  = match.start()
        pre_text         = content[:block_start_pos]
        pre_lines        = pre_text.splitlines()
        pre_lines_tail   = pre_lines[-3:] if len(pre_lines) >= 3 else pre_lines

        # 2. コードブロック本文の先頭行
        body_lines       = body.splitlines()
        first_body_line  = body_lines[0] if body_lines else ""

        # 3. 明示指定を探す
        explicit_fname = _extract_explicit_filename(pre_lines_tail, first_body_line)

        if explicit_fname:
            filename        = explicit_fname
            filename_source = "explicit"
        else:
            inferred        = _infer_filename(lang, idx)
            filename        = inferred
            filename_source = "inferred" if inferred else "none"

        results.append({
            "artifact_type":   artifact_type,
            "language":        lang,
            "filename":        filename,
            "filename_source": filename_source,
            "body":            body,
        })

    return results
