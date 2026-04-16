"""
artifact_manifest_diff.py — manifest JSON 同士の差分を比較する (Phase 18)

2 つの artifact_export_manifest.json を比較して、
added / removed / changed / unchanged を判定して返す。

設計方針:
  - 比較単位: artifact_id（同一 conv_id の再 export を想定）
  - changed 判定対象: final_filename / filename_source / collision_resolved
    （同じ artifact_id でも export のたびに変わりうる項目を監視する）
  - DB や conv_id へのアクセスは行わず、manifest ファイル同士で完結する
  - 軽量・human readable な要約を優先する

比較結果カテゴリ:
  unchanged  同じ artifact_id が両方にあり、比較対象フィールドが全て同一
  changed    同じ artifact_id が両方にあり、1 項目以上が異なる
  added      今回の manifest にのみ存在する（前回にない）
  removed    前回の manifest にのみ存在する（今回にない）

使い方（orchestrator.py 経由）:
    python orchestrator.py manifest-diff \
        --old-manifest ./data/export_v1/artifact_export_manifest.json \
        --new-manifest ./data/export_v2/artifact_export_manifest.json

設計根拠:
  aios-orchestrator/dual-agent-poc/README_Phase18.md
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional


# ─── changed 判定対象フィールド ───────────────────────────────────────────────
DIFF_FIELDS: tuple[str, ...] = (
    "final_filename",
    "filename_source",
    "collision_resolved",
    "requested_filename",
    "language",
    "status",
)


# ─── データクラス ──────────────────────────────────────────────────────────────

@dataclass
class ArtifactDiff:
    """1 artifact の差分情報。"""
    artifact_id:  str
    category:     str   # 'unchanged' | 'changed' | 'added' | 'removed'
    old_entry:    Optional[dict] = None
    new_entry:    Optional[dict] = None
    changed_fields: dict = field(default_factory=dict)
    # changed_fields: {field_name: {"old": ..., "new": ...}}


@dataclass
class ManifestDiffResult:
    """manifest 比較の全結果。"""
    old_path:         str
    new_path:         str
    old_conv_id:      str
    new_conv_id:      str
    old_timestamp:    str
    new_timestamp:    str
    unchanged:        list[ArtifactDiff] = field(default_factory=list)
    changed:          list[ArtifactDiff] = field(default_factory=list)
    added:            list[ArtifactDiff] = field(default_factory=list)
    removed:          list[ArtifactDiff] = field(default_factory=list)

    @property
    def total_old(self) -> int:
        return len(self.unchanged) + len(self.changed) + len(self.removed)

    @property
    def total_new(self) -> int:
        return len(self.unchanged) + len(self.changed) + len(self.added)

    @property
    def has_diff(self) -> bool:
        return bool(self.changed or self.added or self.removed)


# ─── manifest 読み込み ────────────────────────────────────────────────────────

class ManifestLoadError(Exception):
    """manifest の読み込み・バリデーションに失敗した場合に送出する。"""


def load_manifest(path: str | Path) -> dict:
    """
    manifest JSON を読み込んでバリデーションする。

    必須キー: conv_id / export_timestamp / artifacts
    artifacts の各エントリに artifact_id が必須。

    Args:
        path: manifest JSON ファイルのパス

    Returns:
        manifest dict

    Raises:
        ManifestLoadError: ファイル不在 / JSON 不正 / 必須キー欠落
    """
    p = Path(path)
    if not p.exists():
        raise ManifestLoadError(f"manifest ファイルが見つかりません: {p}")

    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise ManifestLoadError(f"JSON パースエラー: {p}  ({exc})") from exc

    if not isinstance(data, dict):
        raise ManifestLoadError(f"manifest のルートがオブジェクトでありません: {p}")

    for key in ("conv_id", "export_timestamp", "artifacts"):
        if key not in data:
            raise ManifestLoadError(f"必須キー '{key}' が manifest に存在しません: {p}")

    if not isinstance(data["artifacts"], list):
        raise ManifestLoadError(f"'artifacts' がリストでありません: {p}")

    for i, entry in enumerate(data["artifacts"]):
        if not isinstance(entry, dict) or "artifact_id" not in entry:
            raise ManifestLoadError(
                f"artifacts[{i}] に 'artifact_id' がありません: {p}"
            )

    return data


# ─── diff コア ────────────────────────────────────────────────────────────────

def compare_manifests(
    old_manifest: dict | str | Path,
    new_manifest: dict | str | Path,
) -> ManifestDiffResult:
    """
    2 つの manifest を比較して ManifestDiffResult を返す。

    比較単位は artifact_id。
    changed 判定は DIFF_FIELDS のいずれかが old/new で異なる場合。

    Args:
        old_manifest: 前回 manifest（dict または ファイルパス）
        new_manifest: 今回 manifest（dict または ファイルパス）

    Returns:
        ManifestDiffResult

    Raises:
        ManifestLoadError: ファイルパスが渡された場合にロード失敗
    """
    # ── ロード ─────────────────────────────────────────────────────────────
    if not isinstance(old_manifest, dict):
        old_manifest = load_manifest(old_manifest)
    if not isinstance(new_manifest, dict):
        new_manifest = load_manifest(new_manifest)

    old_path = old_manifest.get("_path", "")
    new_path = new_manifest.get("_path", "")

    result = ManifestDiffResult(
        old_path      = str(old_path),
        new_path      = str(new_path),
        old_conv_id   = old_manifest.get("conv_id", ""),
        new_conv_id   = new_manifest.get("conv_id", ""),
        old_timestamp = old_manifest.get("export_timestamp", ""),
        new_timestamp = new_manifest.get("export_timestamp", ""),
    )

    # ── artifact_id → entry の辞書を作る ──────────────────────────────────
    old_by_id: dict[str, dict] = {
        e["artifact_id"]: e for e in old_manifest.get("artifacts", [])
    }
    new_by_id: dict[str, dict] = {
        e["artifact_id"]: e for e in new_manifest.get("artifacts", [])
    }

    all_ids = sorted(set(old_by_id) | set(new_by_id))

    for art_id in all_ids:
        in_old = art_id in old_by_id
        in_new = art_id in new_by_id

        if in_old and not in_new:
            # removed
            result.removed.append(ArtifactDiff(
                artifact_id = art_id,
                category    = "removed",
                old_entry   = old_by_id[art_id],
            ))

        elif in_new and not in_old:
            # added
            result.added.append(ArtifactDiff(
                artifact_id = art_id,
                category    = "added",
                new_entry   = new_by_id[art_id],
            ))

        else:
            # 両方にある → changed or unchanged
            old_e = old_by_id[art_id]
            new_e = new_by_id[art_id]
            diffs: dict = {}
            for f in DIFF_FIELDS:
                ov = old_e.get(f)
                nv = new_e.get(f)
                if ov != nv:
                    diffs[f] = {"old": ov, "new": nv}

            if diffs:
                result.changed.append(ArtifactDiff(
                    artifact_id    = art_id,
                    category       = "changed",
                    old_entry      = old_e,
                    new_entry      = new_e,
                    changed_fields = diffs,
                ))
            else:
                result.unchanged.append(ArtifactDiff(
                    artifact_id = art_id,
                    category    = "unchanged",
                    old_entry   = old_e,
                    new_entry   = new_e,
                ))

    return result


# ─── ロード + 比較 のショートカット ──────────────────────────────────────────

def diff_manifests(
    old_path: str | Path,
    new_path: str | Path,
) -> ManifestDiffResult:
    """
    manifest ファイルパスを受け取り、ロード + 比較 + ManifestDiffResult を返す。

    ロード時にパスを _path として manifest dict に付与し、
    ManifestDiffResult に引き継ぐ。

    Args:
        old_path: 前回 manifest ファイルパス
        new_path: 今回 manifest ファイルパス

    Returns:
        ManifestDiffResult

    Raises:
        ManifestLoadError: ロード失敗時
    """
    old = load_manifest(old_path)
    old["_path"] = str(Path(old_path).resolve())
    new = load_manifest(new_path)
    new["_path"] = str(Path(new_path).resolve())
    return compare_manifests(old, new)


# ─── 表示ヘルパー ──────────────────────────────────────────────────────────────

_SEP  = "─" * 70
_SEP2 = "  " + "─" * 40


def format_diff_report(result: ManifestDiffResult, *, verbose: bool = False) -> str:
    """
    ManifestDiffResult を human readable なテキストに整形して返す。

    Args:
        result:  compare_manifests() / diff_manifests() の戻り値
        verbose: True の場合、unchanged エントリも列挙する

    Returns:
        整形済み文字列（印刷 or print に渡す用）
    """
    lines: list[str] = []
    a = lines.append

    a(_SEP)
    a("Manifest Diff")
    a(f"  old: {result.old_path}")
    a(f"  new: {result.new_path}")
    if result.old_conv_id != result.new_conv_id:
        a(f"  [WARN] conv_id が異なります: {result.old_conv_id!r} → {result.new_conv_id!r}")
    else:
        a(f"  conv_id   : {result.new_conv_id}")
    a(f"  old ts    : {result.old_timestamp}")
    a(f"  new ts    : {result.new_timestamp}")
    a(_SEP)

    # ── サマリー ──────────────────────────────────────────────────────────
    a(f"  added    : {len(result.added):3d}")
    a(f"  removed  : {len(result.removed):3d}")
    a(f"  changed  : {len(result.changed):3d}")
    a(f"  unchanged: {len(result.unchanged):3d}")
    a(_SEP)

    if not result.has_diff:
        a("  差分なし — 前回から変化ありません。")
        a(_SEP)
        return "\n".join(lines)

    # ── added ─────────────────────────────────────────────────────────────
    if result.added:
        a("  [ADDED]")
        for d in result.added:
            e = d.new_entry or {}
            fn  = e.get("final_filename") or "-"
            src = e.get("filename_source") or "-"
            t   = e.get("turn_no", "?")
            a(f"    + T{t:02}  {d.artifact_id[:8]}...  {fn}  [{src[0].upper()}]")
        a("")

    # ── removed ───────────────────────────────────────────────────────────
    if result.removed:
        a("  [REMOVED]")
        for d in result.removed:
            e = d.old_entry or {}
            fn  = e.get("final_filename") or "-"
            src = e.get("filename_source") or "-"
            t   = e.get("turn_no", "?")
            a(f"    - T{t:02}  {d.artifact_id[:8]}...  {fn}  [{src[0].upper()}]")
        a("")

    # ── changed ───────────────────────────────────────────────────────────
    if result.changed:
        a("  [CHANGED]")
        for d in result.changed:
            e_new = d.new_entry or {}
            fn    = e_new.get("final_filename") or "-"
            t     = e_new.get("turn_no", "?")
            a(f"    ~ T{t:02}  {d.artifact_id[:8]}...  {fn}")
            for fname, vals in d.changed_fields.items():
                a(f"        {fname}: {vals['old']!r}  →  {vals['new']!r}")
        a("")

    # ── unchanged（verbose 時のみ）────────────────────────────────────────
    if verbose and result.unchanged:
        a("  [UNCHANGED]")
        for d in result.unchanged:
            e = d.old_entry or {}
            fn = e.get("final_filename") or "-"
            t  = e.get("turn_no", "?")
            a(f"    = T{t:02}  {d.artifact_id[:8]}...  {fn}")
        a("")

    a(_SEP)
    return "\n".join(lines)


def print_diff_report(result: ManifestDiffResult, *, verbose: bool = False) -> None:
    """ManifestDiffResult を stdout に出力する。"""
    print(format_diff_report(result, verbose=verbose))
