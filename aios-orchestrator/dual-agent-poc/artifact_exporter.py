"""
artifact_exporter.py — 保存済み artifact をローカルファイルに書き出す (Phase 11)

設計方針:
  - 出力ディレクトリ外へのパス抜けを完全に防ぐ（path traversal 対策）
  - 同名ファイルが衝突した場合は連番サフィックスで回避（上書きデフォルト禁止）
  - filename 決定: explicit > inferred > safe-default の優先順位
  - 空 artifact（content が None または空白のみ）はスキップ
  - 単体 artifact_id 指定 export もサポート

使い方（orchestrator.py 経由）:
    python orchestrator.py artifact-export --conv-id <id> --output ./output/
    python orchestrator.py artifact-export --conv-id <id> --artifact-id <prefix> --output ./output/
    python orchestrator.py artifact-export --conv-id <id> --output ./output/ --dry-run

設計根拠:
  aios-orchestrator/dual-agent-poc/README_Phase11.md
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Optional


# ─── 言語 → 拡張子マッピング ────────────────────────────────────────────────
_LANG_TO_EXT: dict[str, str] = {
    "python":     ".py",
    "py":         ".py",
    "javascript": ".js",
    "js":         ".js",
    "typescript": ".ts",
    "ts":         ".ts",
    "rust":       ".rs",
    "go":         ".go",
    "java":       ".java",
    "c":          ".c",
    "cpp":        ".cpp",
    "c++":        ".cpp",
    "swift":      ".swift",
    "kotlin":     ".kt",
    "ruby":       ".rb",
    "php":        ".php",
    "sql":        ".sql",
    "r":          ".r",
    "bash":       ".sh",
    "sh":         ".sh",
    "shell":      ".sh",
    "zsh":        ".sh",
    "powershell": ".ps1",
    "ps1":        ".ps1",
    "json":       ".json",
    "yaml":       ".yaml",
    "yml":        ".yaml",
    "toml":       ".toml",
    "xml":        ".xml",
    "markdown":   ".md",
    "md":         ".md",
    "html":       ".html",
    "css":        ".css",
    "ini":        ".ini",
    "config":     ".conf",
    "text":       ".txt",
    "txt":        ".txt",
}

# artifact_type → 拡張子フォールバック
_TYPE_TO_EXT: dict[str, str] = {
    "code":     ".py",
    "shell":    ".sh",
    "json":     ".json",
    "markdown": ".md",
    "file":     ".txt",
}


# ─── filename 安全チェック ────────────────────────────────────────────────────

def is_safe_filename(name: str) -> bool:
    """
    filename が出力ディレクトリ配下に安全に書き出せるかチェックする。

    拒否条件:
      - 空文字 / 空白のみ
      - '..' を含む（パストラバーサル）
      - '/' または '\\' を含む（サブディレクトリ指定）
      - 制御文字を含む（\\x00–\\x1f, \\x7f）
      - 255 文字超

    Args:
        name: チェック対象のファイル名文字列

    Returns:
        True の場合は安全、False の場合は危険
    """
    if not name or not name.strip():
        return False
    if ".." in name:
        return False
    if "/" in name or "\\" in name:
        return False
    if len(name) > 255:
        return False
    if re.search(r"[\x00-\x1f\x7f]", name):
        return False
    return True


# ─── filename 決定ロジック ────────────────────────────────────────────────────

def _safe_default_filename(art: dict, index: int) -> str:
    """
    explicit / inferred filename が安全でない場合のデフォルトファイル名を返す。

    命名規則: artifact_t<turn_id>_<index><ext>
    turn_id と index はゼロ埋め 2 桁。

    Args:
        art:   artifact dict（turn_id, language, artifact_type を参照）
        index: artifact リスト内の連番（0 始まり）
    """
    lang = (art.get("language") or "").lower().strip()
    art_type = (art.get("artifact_type") or "code").lower()
    turn_id = art.get("turn_id") or 0

    ext = _LANG_TO_EXT.get(lang) or _TYPE_TO_EXT.get(art_type) or ".txt"
    return f"artifact_t{turn_id:02d}_{index:02d}{ext}"


def resolve_filename(art: dict, index: int) -> tuple[str, str]:
    """
    artifact のファイル名を決定して返す。

    優先順位:
      1. explicit filename (filename_source == 'explicit') かつ is_safe_filename()
      2. inferred filename (filename_source == 'inferred') かつ is_safe_filename()
      3. safe-default filename

    Args:
        art:   artifact dict
        index: artifact リスト内のインデックス（デフォルト命名に使用）

    Returns:
        (確定ファイル名, 採用ソース: 'explicit' | 'inferred' | 'default')
    """
    filename_source = art.get("filename_source") or "none"
    filename = (art.get("filename") or "").strip()

    if filename_source in ("explicit", "inferred") and filename:
        if is_safe_filename(filename):
            return filename, filename_source

    # フォールバック
    return _safe_default_filename(art, index), "default"


# ─── 衝突回避 ────────────────────────────────────────────────────────────────

def _resolve_unique_name(base_filename: str, used: set[str], output_dir: Path) -> str:
    """
    output_dir 内で衝突しない一意なファイル名を返す。

    衝突判定:
      - used セット（同一実行内で既に割り当て済み）に大文字小文字区別なしで含まれる
      - または output_dir 配下に同名ファイルが既に存在する

    衝突した場合はステム部に `_<n>` を付与して回避（n=2 から）。
    上書きはしない。

    Args:
        base_filename: 第一候補ファイル名
        used:          今回の export で既に確定したファイル名（lower）の集合
        output_dir:    書き出し先ディレクトリ

    Returns:
        衝突しない最終ファイル名
    """
    stem   = Path(base_filename).stem
    suffix = Path(base_filename).suffix

    candidate = base_filename
    n = 2
    while (
        candidate.lower() in used
        or (output_dir / candidate).exists()
    ):
        candidate = f"{stem}_{n}{suffix}"
        n += 1

    return candidate


# ─── パス安全確認 ────────────────────────────────────────────────────────────

def _safe_resolved_path(output_dir: Path, filename: str) -> Optional[Path]:
    """
    output_dir 配下に収まることを resolve() で検証した絶対パスを返す。

    resolve() + Path.is_relative_to() ベースのパストラバーサル二重チェック。
    Windows / Unix 両対応（バックスラッシュ差異を吸収）。
    output_dir 外に出る場合や例外が発生した場合は None を返す。

    Args:
        output_dir: 書き出し先ディレクトリ（絶対パス推奨）
        filename:   ファイル名（サブディレクトリを含まないこと）

    Returns:
        安全な絶対 Path、または None（危険な場合）
    """
    try:
        resolved_dir    = output_dir.resolve()
        resolved_target = (output_dir / filename).resolve()
        # Path.is_relative_to() は Python 3.9+ / セパレータ差異を吸収
        if not resolved_target.is_relative_to(resolved_dir):
            return None
        return resolved_target
    except Exception:
        return None


# ─── メイン export 関数 ──────────────────────────────────────────────────────

ExportResult = dict  # 型エイリアス


def export_artifacts(
    artifacts: list[dict],
    output_dir: str | Path,
    *,
    dry_run: bool = False,
    verbose: bool = True,
) -> list[ExportResult]:
    """
    artifact リストをローカルファイルに書き出す。

    各 artifact を filename 決定 → 衝突回避 → パス検証 → 書き出しの順で処理する。
    1 件でも失敗・スキップした場合も残りの処理は継続する（部分失敗許容）。

    Args:
        artifacts:  get_artifacts_by_conv() などで取得した artifact dict リスト
        output_dir: 書き出し先ディレクトリ（存在しない場合は自動作成）
        dry_run:    True の場合、ファイルを実際に書かず結果だけ返す
        verbose:    True の場合、各 artifact の処理結果を stdout に出力

    Returns:
        各 artifact の処理結果を含む ExportResult dict のリスト。
        各 dict のキー:
          artifact_id:     元の artifact UUID
          filename:        確定ファイル名（スキップ時は None の場合あり）
          path:            書き出し先の絶対パス文字列（スキップ/エラー時は None の場合あり）
          status:          'exported' | 'skipped' | 'error'
          reason:          詳細理由文字列
          filename_source: 'explicit' | 'inferred' | 'default'（エラー/スキップ時は省略）
          turn_id:         ターン番号（エラー/スキップ時は省略）
    """
    out_dir = Path(output_dir)

    if not dry_run:
        out_dir.mkdir(parents=True, exist_ok=True)

    results: list[ExportResult] = []
    used_names: set[str] = set()  # 同一 export 内の衝突検知（case-insensitive）

    for i, art in enumerate(artifacts):
        art_id  = art.get("artifact_id") or "unknown"
        content = art.get("content") or ""

        # ── 空コンテンツはスキップ ────────────────────────────────────────────
        if not content.strip():
            r: ExportResult = {
                "artifact_id": art_id,
                "filename":    None,
                "path":        None,
                "status":      "skipped",
                "reason":      "empty_content",
            }
            results.append(r)
            if verbose:
                print(f"  [SKIP] {art_id[:8]}...  empty content")
            continue

        # ── filename 決定 ─────────────────────────────────────────────────────
        base_filename, used_source = resolve_filename(art, i)

        # ── 衝突回避 ──────────────────────────────────────────────────────────
        final_filename = _resolve_unique_name(base_filename, used_names, out_dir)

        # ── パス安全確認（二重チェック） ──────────────────────────────────────
        safe_path = _safe_resolved_path(out_dir, final_filename)
        if safe_path is None:
            r = {
                "artifact_id": art_id,
                "filename":    final_filename,
                "path":        None,
                "status":      "skipped",
                "reason":      "unsafe_path",
            }
            results.append(r)
            if verbose:
                print(f"  [SKIP] {art_id[:8]}...  unsafe path detected: {final_filename}")
            continue

        # 使用済みとして記録
        used_names.add(final_filename.lower())

        turn_id = art.get("turn_id") or 0

        # ── dry-run ───────────────────────────────────────────────────────────
        if dry_run:
            r = {
                "artifact_id":     art_id,
                "filename":        final_filename,
                "path":            str(safe_path),
                "status":          "exported",
                "reason":          "dry_run",
                "filename_source": used_source,
                "turn_id":         turn_id,
            }
            results.append(r)
            if verbose:
                tag = "[E]" if used_source == "explicit" else ("[I]" if used_source == "inferred" else "[D]")
                print(f"  [DRY]  T{turn_id:02d}  {art_id[:8]}...  → {final_filename}  {tag}")
            continue

        # ── 実際に書き出す ────────────────────────────────────────────────────
        try:
            safe_path.write_text(content, encoding="utf-8")
            r = {
                "artifact_id":     art_id,
                "filename":        final_filename,
                "path":            str(safe_path),
                "status":          "exported",
                "reason":          "ok",
                "filename_source": used_source,
                "turn_id":         turn_id,
            }
            results.append(r)
            if verbose:
                tag = "[E]" if used_source == "explicit" else ("[I]" if used_source == "inferred" else "[D]")
                print(f"  [OK]   T{turn_id:02d}  {art_id[:8]}...  → {final_filename}  {tag}")
        except OSError as exc:
            r = {
                "artifact_id": art_id,
                "filename":    final_filename,
                "path":        str(safe_path),
                "status":      "error",
                "reason":      str(exc),
            }
            results.append(r)
            if verbose:
                print(f"  [ERR]  T{turn_id:02d}  {art_id[:8]}...  {exc}")

    return results
