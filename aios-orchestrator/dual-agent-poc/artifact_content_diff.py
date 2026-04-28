"""
artifact_content_diff.py — artifact ファイル内容の diff 比較 (Phase 20)

2 つの artifact export ディレクトリ内の実ファイルを比較し、
内容レベルの差分を人が読みやすいテキストレポートとして出力する。

設計方針:
  - manifest JSON から final_filename 情報を取得して artifact_id 単位で対応付けを行う
  - artifact_id で old/new を 1:1 対応させる（manifest-diff と同じ原則）
  - バイナリファイル（UTF-8 読み込み不可）は 'binary' としてスキップし安全に処理する
  - manifest がなくてもディレクトリ直接比較は行わない（artifact_id の対応が取れないため）
  - content_hash (SHA-256) で変更を検出し、変更があった場合のみ unified diff を生成する

使い方（orchestrator.py 経由）:
    python orchestrator.py content-diff \\
        --old-dir ./output/v1 \\
        --new-dir ./output/v2 \\
        [--context 3] \\
        [--report-output diff_report.txt] \\
        [--json] \\
        [--verbose] \\
        [--no-diff] \\
        [--fail-on-diff]

設計根拠:
  aios-orchestrator/dual-agent-poc/README_Phase20.md
"""

from __future__ import annotations

import difflib
import hashlib
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


# ─── ハッシュ計算 ─────────────────────────────────────────────────────────────

def hash_content(content: str) -> str:
    """UTF-8 エンコード後の SHA-256 ハッシュ（hex）を返す。"""
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


# ─── ファイル読み込み ─────────────────────────────────────────────────────────

def read_artifact_file(export_dir: Path, filename: str) -> Optional[str]:
    """
    export_dir 配下の filename を UTF-8 として読み込む。

    バイナリファイルや読み込み不可ファイルは None を返す（スキップ扱い）。
    ファイルが存在しない場合も None を返す。

    Args:
        export_dir: artifact export ディレクトリ
        filename:   manifest の final_filename に記録されたファイル名

    Returns:
        ファイル内容文字列 または None
    """
    path = export_dir / filename
    if not path.exists():
        return None
    try:
        return path.read_text(encoding="utf-8")
    except (UnicodeDecodeError, OSError):
        return None


# ─── unified diff ────────────────────────────────────────────────────────────

def content_diff(
    old_content: str,
    new_content: str,
    old_label: str = "old",
    new_label: str = "new",
    context: int = 3,
) -> str:
    """
    unified diff テキストを返す。差分なしの場合は空文字列。

    Args:
        old_content: 前回ファイル内容
        new_content: 今回ファイル内容
        old_label:   diff ヘッダーに表示する前回ラベル（通常はファイル名）
        new_label:   diff ヘッダーに表示する今回ラベル
        context:     前後のコンテキスト行数

    Returns:
        unified diff 文字列（差分なし → ''）
    """
    old_lines = old_content.splitlines(keepends=True)
    new_lines = new_content.splitlines(keepends=True)
    diff_lines = list(difflib.unified_diff(
        old_lines, new_lines,
        fromfile=old_label, tofile=new_label,
        n=context,
    ))
    return "".join(diff_lines)


def diff_stat(diff_text: str) -> tuple[int, int]:
    """
    diff_text から (added_lines, removed_lines) を返す。

    +/- で始まる行のうち +++/--- ヘッダー行を除いてカウントする。
    """
    added   = sum(1 for l in diff_text.splitlines() if l.startswith("+") and not l.startswith("+++"))
    removed = sum(1 for l in diff_text.splitlines() if l.startswith("-") and not l.startswith("---"))
    return added, removed


# ─── データクラス ──────────────────────────────────────────────────────────────

@dataclass
class ContentDiffEntry:
    """1 artifact ファイルの内容比較結果。"""
    artifact_id:   str
    old_filename:  Optional[str]   # old 側の final_filename（manifest より）
    new_filename:  Optional[str]   # new 側の final_filename（manifest より）
    category:      str             # 'same' | 'changed' | 'old_only' | 'new_only' | 'binary' | 'missing'
    old_hash:      Optional[str] = None
    new_hash:      Optional[str] = None
    old_size:      Optional[int] = None   # bytes (UTF-8 エンコード後)
    new_size:      Optional[int] = None
    diff_text:     Optional[str] = None   # unified diff（category == 'changed' のみ）
    added_lines:   int = 0
    removed_lines: int = 0
    note:          str = ""               # binary/missing 補足メッセージ


@dataclass
class ContentDiffResult:
    """export ディレクトリ間の内容比較全結果。"""
    old_dir: str
    new_dir: str
    entries: list[ContentDiffEntry] = field(default_factory=list)

    @property
    def has_diff(self) -> bool:
        return any(e.category not in ("same",) for e in self.entries)

    @property
    def changed(self) -> list[ContentDiffEntry]:
        return [e for e in self.entries if e.category == "changed"]

    @property
    def same(self) -> list[ContentDiffEntry]:
        return [e for e in self.entries if e.category == "same"]

    @property
    def new_only(self) -> list[ContentDiffEntry]:
        return [e for e in self.entries if e.category == "new_only"]

    @property
    def old_only(self) -> list[ContentDiffEntry]:
        return [e for e in self.entries if e.category == "old_only"]

    @property
    def skipped(self) -> list[ContentDiffEntry]:
        return [e for e in self.entries if e.category in ("binary", "missing")]


# ─── 比較コア ─────────────────────────────────────────────────────────────────

def _entries_by_id(manifest: dict) -> dict[str, dict]:
    """manifest dict から artifact_id → artifact entry dict のマップを返す。"""
    return {
        e["artifact_id"]: e
        for e in manifest.get("artifacts", [])
        if isinstance(e, dict) and "artifact_id" in e
    }


def _is_binary(export_dir: Path, filename: Optional[str], content: Optional[str]) -> bool:
    """ファイルが存在するが content が None（バイナリ/読み込み不可）の場合 True。"""
    return content is None and filename is not None and (export_dir / filename).exists()


def compare_export_dirs(
    old_dir: Path,
    new_dir: Path,
    old_manifest: dict,
    new_manifest: dict,
    *,
    context: int = 3,
) -> ContentDiffResult:
    """
    2 つの export ディレクトリ内の artifact ファイルを内容比較する。

    比較単位: artifact_id（manifest-diff と同じ方針）

    カテゴリ:
      same      両方に存在し、内容ハッシュが一致
      changed   両方に存在し、内容ハッシュが異なる（unified diff 生成）
      old_only  old 側にのみ存在する artifact
      new_only  new 側にのみ存在する artifact
      binary    バイナリ/UTF-8 読み込み不可（少なくとも片側）
      missing   manifest にはあるが実ファイルが両側とも不在

    Args:
        old_dir:      前回 export ディレクトリ
        new_dir:      今回 export ディレクトリ
        old_manifest: 前回 manifest dict（artifact_export_manifest.json の内容）
        new_manifest: 今回 manifest dict
        context:      unified diff のコンテキスト行数（デフォルト: 3）

    Returns:
        ContentDiffResult
    """
    result = ContentDiffResult(old_dir=str(old_dir.resolve()), new_dir=str(new_dir.resolve()))

    old_by_id = _entries_by_id(old_manifest)
    new_by_id = _entries_by_id(new_manifest)
    all_ids   = sorted(set(old_by_id) | set(new_by_id))

    for art_id in all_ids:
        in_old = art_id in old_by_id
        in_new = art_id in new_by_id

        if in_old and not in_new:
            # ── old_only ──────────────────────────────────────────────────
            old_fn  = old_by_id[art_id].get("final_filename")
            old_txt = read_artifact_file(old_dir, old_fn) if old_fn else None
            if _is_binary(old_dir, old_fn, old_txt):
                result.entries.append(ContentDiffEntry(
                    artifact_id=art_id, old_filename=old_fn, new_filename=None,
                    category="binary", note="binary or unreadable",
                ))
            else:
                result.entries.append(ContentDiffEntry(
                    artifact_id=art_id, old_filename=old_fn, new_filename=None,
                    category="old_only",
                    old_hash=hash_content(old_txt) if old_txt is not None else None,
                    old_size=len(old_txt.encode("utf-8")) if old_txt is not None else None,
                ))

        elif in_new and not in_old:
            # ── new_only ──────────────────────────────────────────────────
            new_fn  = new_by_id[art_id].get("final_filename")
            new_txt = read_artifact_file(new_dir, new_fn) if new_fn else None
            if _is_binary(new_dir, new_fn, new_txt):
                result.entries.append(ContentDiffEntry(
                    artifact_id=art_id, old_filename=None, new_filename=new_fn,
                    category="binary", note="binary or unreadable",
                ))
            else:
                result.entries.append(ContentDiffEntry(
                    artifact_id=art_id, old_filename=None, new_filename=new_fn,
                    category="new_only",
                    new_hash=hash_content(new_txt) if new_txt is not None else None,
                    new_size=len(new_txt.encode("utf-8")) if new_txt is not None else None,
                ))

        else:
            # ── 両方に存在 → same / changed / binary / missing ────────────
            old_fn  = old_by_id[art_id].get("final_filename")
            new_fn  = new_by_id[art_id].get("final_filename")
            old_txt = read_artifact_file(old_dir, old_fn) if old_fn else None
            new_txt = read_artifact_file(new_dir, new_fn) if new_fn else None

            # バイナリチェック（少なくとも片側がバイナリ）
            if _is_binary(old_dir, old_fn, old_txt) or _is_binary(new_dir, new_fn, new_txt):
                result.entries.append(ContentDiffEntry(
                    artifact_id=art_id, old_filename=old_fn, new_filename=new_fn,
                    category="binary", note="binary or unreadable (at least one side)",
                ))
                continue

            # ファイルが両方とも不在
            if old_txt is None and new_txt is None:
                result.entries.append(ContentDiffEntry(
                    artifact_id=art_id, old_filename=old_fn, new_filename=new_fn,
                    category="missing", note="both files not found on disk",
                ))
                continue

            # ハッシュ比較
            old_hash = hash_content(old_txt) if old_txt is not None else None
            new_hash = hash_content(new_txt) if new_txt is not None else None

            if old_hash == new_hash:
                result.entries.append(ContentDiffEntry(
                    artifact_id=art_id, old_filename=old_fn, new_filename=new_fn,
                    category="same",
                    old_hash=old_hash, new_hash=new_hash,
                    old_size=len(old_txt.encode("utf-8")) if old_txt is not None else 0,
                    new_size=len(new_txt.encode("utf-8")) if new_txt is not None else 0,
                ))
            else:
                diff = content_diff(
                    old_txt or "", new_txt or "",
                    old_label=old_fn or "old",
                    new_label=new_fn or "new",
                    context=context,
                )
                added, removed = diff_stat(diff)
                result.entries.append(ContentDiffEntry(
                    artifact_id=art_id, old_filename=old_fn, new_filename=new_fn,
                    category="changed",
                    old_hash=old_hash, new_hash=new_hash,
                    old_size=len(old_txt.encode("utf-8")) if old_txt is not None else 0,
                    new_size=len(new_txt.encode("utf-8")) if new_txt is not None else 0,
                    diff_text=diff,
                    added_lines=added,
                    removed_lines=removed,
                ))

    return result


# ─── テキストレポート ─────────────────────────────────────────────────────────

_SEP  = "─" * 70
_SEP2 = "  " + "─" * 40


def format_content_diff_report(
    result: ContentDiffResult,
    *,
    verbose: bool = False,
    show_diff: bool = True,
) -> str:
    """
    ContentDiffResult を human readable なテキストに整形して返す。

    Args:
        result:    compare_export_dirs() の戻り値
        verbose:   True の場合、same エントリも列挙する
        show_diff: True の場合、changed エントリの unified diff を表示する

    Returns:
        整形済み文字列（stdout への print / ファイル書き出し用）
    """
    lines: list[str] = []
    a = lines.append

    a(_SEP)
    a("Content Diff (Phase 20)")
    a(f"  old dir: {result.old_dir}")
    a(f"  new dir: {result.new_dir}")
    a(_SEP)
    a(f"  changed  : {len(result.changed):3d}")
    a(f"  new_only : {len(result.new_only):3d}")
    a(f"  old_only : {len(result.old_only):3d}")
    a(f"  same     : {len(result.same):3d}")
    a(f"  skipped  : {len(result.skipped):3d}")
    a(_SEP)

    if not result.has_diff:
        a("  差分なし — 全 artifact の内容が一致しています。")
        a(_SEP)
        return "\n".join(lines)

    # ── changed ───────────────────────────────────────────────────────────
    if result.changed:
        a("  [CHANGED]")
        for e in result.changed:
            fn_label = e.new_filename or e.old_filename or "-"
            a(f"    ~ {e.artifact_id[:8]}...  {fn_label}  +{e.added_lines}/-{e.removed_lines}")
            if show_diff and e.diff_text:
                for dl in e.diff_text.splitlines():
                    a(f"      {dl}")
                a("")
        if not show_diff:
            a("")

    # ── new_only ──────────────────────────────────────────────────────────
    if result.new_only:
        a("  [NEW ONLY]")
        for e in result.new_only:
            fn = e.new_filename or "-"
            sz = f"  {e.new_size} bytes" if e.new_size is not None else ""
            a(f"    + {e.artifact_id[:8]}...  {fn}{sz}")
        a("")

    # ── old_only ──────────────────────────────────────────────────────────
    if result.old_only:
        a("  [OLD ONLY]")
        for e in result.old_only:
            fn = e.old_filename or "-"
            sz = f"  {e.old_size} bytes" if e.old_size is not None else ""
            a(f"    - {e.artifact_id[:8]}...  {fn}{sz}")
        a("")

    # ── skipped ───────────────────────────────────────────────────────────
    if result.skipped:
        a("  [SKIPPED]")
        for e in result.skipped:
            fn = e.new_filename or e.old_filename or "-"
            a(f"    ? {e.artifact_id[:8]}...  {fn}  ({e.note})")
        a("")

    # ── same（verbose 時のみ）────────────────────────────────────────────
    if verbose and result.same:
        a("  [SAME]")
        for e in result.same:
            fn = e.new_filename or e.old_filename or "-"
            a(f"    = {e.artifact_id[:8]}...  {fn}")
        a("")

    a(_SEP)
    return "\n".join(lines)


# ─── JSON シリアライズ ────────────────────────────────────────────────────────

def result_to_json_dict(result: ContentDiffResult) -> dict:
    """
    ContentDiffResult を JSON シリアライズ可能な dict に変換する。

    CI スクリプトから参照しやすいよう has_diff / summary を最上位に置く。
    diff_text は changed エントリにのみ含める（それ以外は省略）。
    """
    def _entry_dict(e: ContentDiffEntry) -> dict:
        d: dict = {
            "artifact_id":   e.artifact_id,
            "old_filename":  e.old_filename,
            "new_filename":  e.new_filename,
            "category":      e.category,
            "old_hash":      e.old_hash,
            "new_hash":      e.new_hash,
            "old_size":      e.old_size,
            "new_size":      e.new_size,
            "added_lines":   e.added_lines,
            "removed_lines": e.removed_lines,
        }
        if e.note:
            d["note"] = e.note
        if e.diff_text:
            d["diff_text"] = e.diff_text
        return d

    return {
        "old_dir":  result.old_dir,
        "new_dir":  result.new_dir,
        "has_diff": result.has_diff,
        "summary": {
            "changed":  len(result.changed),
            "new_only": len(result.new_only),
            "old_only": len(result.old_only),
            "same":     len(result.same),
            "skipped":  len(result.skipped),
        },
        "changed":  [_entry_dict(e) for e in result.changed],
        "new_only": [_entry_dict(e) for e in result.new_only],
        "old_only": [_entry_dict(e) for e in result.old_only],
        "same":     [_entry_dict(e) for e in result.same],
        "skipped":  [_entry_dict(e) for e in result.skipped],
    }


# ─── レポートファイル書き出し ─────────────────────────────────────────────────

def write_content_diff_report(
    result: ContentDiffResult,
    path: str | Path,
    *,
    fmt: str = "text",
    verbose: bool = False,
    show_diff: bool = True,
) -> Path:
    """
    ContentDiffResult をファイルに書き出す。

    親ディレクトリが存在しない場合は自動作成する。
    既存ファイルは上書きする（CI での再実行を想定）。

    Args:
        result:    compare_export_dirs() の戻り値
        path:      書き出し先ファイルパス
        fmt:       'text' または 'json'（デフォルト: 'text'）
        verbose:   text 形式で same エントリも含める
        show_diff: text 形式で unified diff を表示する

    Returns:
        書き出したファイルの絶対 Path

    Raises:
        ValueError: fmt が 'text' / 'json' 以外
        OSError:    ファイル書き込み失敗
    """
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)

    if fmt == "text":
        content = format_content_diff_report(result, verbose=verbose, show_diff=show_diff)
        p.write_text(content, encoding="utf-8")
    elif fmt == "json":
        data = result_to_json_dict(result)
        p.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    else:
        raise ValueError(f"fmt は 'text' または 'json' を指定してください: {fmt!r}")

    return p.resolve()
