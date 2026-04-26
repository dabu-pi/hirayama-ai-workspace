"""
export_diff_reporter.py — manifest diff 結果をファイルに書き出す (Phase 19)

CI 連携向けに export 差分レポートを自動生成する。
manifest-diff の結果（ManifestDiffResult）を受け取り、
指定されたパスにテキストまたは JSON 形式で書き出す。

用途:
  - CI パイプラインで artifact-export を 2 回実行し、manifest を比較して差分をレポートファイルに保存
  - --fail-on-diff と組み合わせて差分があれば CI を fail させる
  - レポートファイルを CI アーティファクトとして保存・共有する

使い方（orchestrator.py 経由）:
    # テキストレポートをファイルに保存
    python orchestrator.py manifest-diff \\
        --old-manifest old.json \\
        --new-manifest new.json \\
        --report-output diff_report.txt

    # JSON レポートをファイルに保存
    python orchestrator.py manifest-diff \\
        --old-manifest old.json \\
        --new-manifest new.json \\
        --json \\
        --report-output diff_report.json

    # CI ゲート: 差分があれば exit 1
    python orchestrator.py manifest-diff \\
        --old-manifest old.json \\
        --new-manifest new.json \\
        --fail-on-diff

    # 組み合わせ（ファイル保存 + CI ゲート）
    python orchestrator.py manifest-diff \\
        --old-manifest old.json \\
        --new-manifest new.json \\
        --report-output diff_report.txt \\
        --fail-on-diff

設計根拠:
  aios-orchestrator/dual-agent-poc/README_Phase19.md
"""

from __future__ import annotations

import json
from pathlib import Path

from artifact_manifest_diff import ManifestDiffResult, format_diff_report


# ─── JSON シリアライズ ────────────────────────────────────────────────────────

def _result_to_json_dict(result: ManifestDiffResult) -> dict:
    """
    ManifestDiffResult を JSON シリアライズ可能な dict に変換する。

    orchestrator.py の command_manifest_diff と同じ構造を出力する。
    has_diff フィールドを追加して CI スクリプトから参照しやすくする。

    Args:
        result: compare_manifests() / diff_manifests() の戻り値

    Returns:
        JSON シリアライズ可能な dict
    """
    def _entry_to_dict(d) -> dict:
        return {
            "artifact_id":    d.artifact_id,
            "category":       d.category,
            "changed_fields": d.changed_fields,
            "old_filename":   (d.old_entry or {}).get("final_filename"),
            "new_filename":   (d.new_entry or {}).get("final_filename"),
        }

    return {
        "old_path":      result.old_path,
        "new_path":      result.new_path,
        "conv_id":       result.new_conv_id,
        "old_timestamp": result.old_timestamp,
        "new_timestamp": result.new_timestamp,
        "has_diff":      result.has_diff,
        "summary": {
            "added":     len(result.added),
            "removed":   len(result.removed),
            "changed":   len(result.changed),
            "unchanged": len(result.unchanged),
        },
        "added":     [_entry_to_dict(d) for d in result.added],
        "removed":   [_entry_to_dict(d) for d in result.removed],
        "changed":   [_entry_to_dict(d) for d in result.changed],
        "unchanged": [_entry_to_dict(d) for d in result.unchanged],
    }


# ─── レポートファイル書き出し ─────────────────────────────────────────────────

def write_diff_report(
    result: ManifestDiffResult,
    path: str | Path,
    *,
    fmt: str = "text",
    verbose: bool = False,
) -> Path:
    """
    ManifestDiffResult をファイルに書き出す（Phase 19）。

    親ディレクトリが存在しない場合は自動作成する。
    既存ファイルは上書きする（CI での再実行を想定）。

    Args:
        result:  compare_manifests() / diff_manifests() の戻り値
        path:    書き出し先ファイルパス
        fmt:     'text' または 'json'（デフォルト: 'text'）
        verbose: text 形式の場合、unchanged エントリも含める（デフォルト: False）

    Returns:
        書き出したファイルの絶対 Path

    Raises:
        ValueError: fmt が 'text' / 'json' 以外
        OSError:    ファイル書き込み失敗
    """
    p = Path(path)
    p.parent.mkdir(parents=True, exist_ok=True)

    if fmt == "text":
        content = format_diff_report(result, verbose=verbose)
        p.write_text(content, encoding="utf-8")
    elif fmt == "json":
        data = _result_to_json_dict(result)
        p.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    else:
        raise ValueError(f"fmt は 'text' または 'json' を指定してください: {fmt!r}")

    return p.resolve()
