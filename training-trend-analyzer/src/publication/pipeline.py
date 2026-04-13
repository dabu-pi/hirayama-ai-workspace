"""Thin orchestration helpers for the publication preparation pipeline."""

from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path

from scripts.build_publication_handoff import build_publication_handoff_files
from scripts.render_publish_markdown import load_publish_artifact, render_artifact_to_markdown
from src.publication.markdown_output import build_front_matter_data
from src.publication.output_paths import normalize_output_dir, publish_artifact_output_path

ROOT = Path(__file__).parent.parent.parent


class PublicationPipelineError(RuntimeError):
    """Pipeline failure that records which stage failed."""

    def __init__(self, stage: str, message: str):
        super().__init__(f"[{stage}] {message}")
        self.stage = stage


def _display_path(path: Path) -> str:
    for base in (Path.cwd(), ROOT.resolve()):
        try:
            return path.resolve().relative_to(base.resolve()).as_posix()
        except ValueError:
            continue
    return path.resolve().as_posix()


def _copy_if_needed(source_path: Path, *, output_dir: Path | None) -> Path:
    if output_dir is None:
        return source_path
    destination = output_dir / source_path.name
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source_path, destination)
    return destination


def run_batch_publication_artifact(
    *,
    week: str,
    compare_source_sets: bool,
    use_db: bool,
    only_commercial: bool,
    no_discontinued: bool,
    db_path: str | None = None,
    output_dir: str | Path | None = None,
) -> Path:
    command = [
        sys.executable,
        "scripts/run_batch.py",
        "--week",
        week,
        "--output-publish-artifact",
    ]
    if compare_source_sets:
        command.append("--compare-source-sets")
    if use_db:
        command.append("--use-db")
    if only_commercial:
        command.append("--only-commercial")
    if no_discontinued:
        command.append("--no-discontinued")
    if db_path:
        command.extend(["--db-path", db_path])

    result = subprocess.run(
        command,
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    if result.stdout:
        print(result.stdout, end="")
    if result.stderr:
        print(result.stderr, end="", file=sys.stderr)
    if result.returncode != 0:
        raise PublicationPipelineError("artifact", f"run_batch.py failed with exit code {result.returncode}")

    artifact_path = publish_artifact_output_path(week, compare_enabled=compare_source_sets)
    absolute_artifact_path = ROOT / artifact_path
    if not absolute_artifact_path.exists():
        raise PublicationPipelineError("artifact", f"Expected artifact not found: {absolute_artifact_path}")

    normalized_output_dir = normalize_output_dir(output_dir) if output_dir is not None else None
    return _copy_if_needed(absolute_artifact_path, output_dir=normalized_output_dir)


def render_publication_markdown(
    artifact_path: Path,
    *,
    output_dir: str | Path | None = None,
) -> tuple[dict, Path]:
    try:
        payload, _markdown_text, markdown_path = render_artifact_to_markdown(
            artifact_path,
            output_dir=output_dir,
        )
        return payload, markdown_path
    except ValueError as exc:
        raise PublicationPipelineError("markdown", str(exc)) from exc


def build_publication_handoff(
    artifact_path: Path,
    markdown_path: Path,
    *,
    output_dir: str | Path | None = None,
) -> tuple[Path, Path, dict]:
    try:
        manifest_path, latest_pointer_path, manifest, _latest = build_publication_handoff_files(
            artifact_path,
            markdown_path,
            output_dir=output_dir,
        )
        return manifest_path, latest_pointer_path, manifest
    except ValueError as exc:
        raise PublicationPipelineError("handoff", str(exc)) from exc


def run_publication_pipeline(
    *,
    week: str | None = None,
    compare_source_sets: bool = False,
    use_db: bool = False,
    only_commercial: bool = False,
    no_discontinued: bool = False,
    db_path: str | None = None,
    output_dir: str | Path | None = None,
    skip_handoff: bool = False,
    artifact_only: bool = False,
    from_artifact: str | Path | None = None,
) -> dict:
    normalized_output_dir = normalize_output_dir(output_dir) if output_dir is not None else None

    if from_artifact is not None:
        artifact_path = Path(from_artifact)
        try:
            artifact_payload = load_publish_artifact(artifact_path)
        except ValueError as exc:
            raise PublicationPipelineError("artifact", str(exc)) from exc
        if normalized_output_dir is not None:
            artifact_path = _copy_if_needed(artifact_path, output_dir=normalized_output_dir)
            try:
                artifact_payload = load_publish_artifact(artifact_path)
            except ValueError as exc:
                raise PublicationPipelineError("artifact", str(exc)) from exc
    else:
        if not week:
            raise PublicationPipelineError("pipeline", "--week is required unless --from-artifact is used")
        artifact_path = run_batch_publication_artifact(
            week=week,
            compare_source_sets=compare_source_sets,
            use_db=use_db,
            only_commercial=only_commercial,
            no_discontinued=no_discontinued,
            db_path=db_path,
            output_dir=normalized_output_dir,
        )
        try:
            artifact_payload = load_publish_artifact(artifact_path)
        except ValueError as exc:
            raise PublicationPipelineError("artifact", str(exc)) from exc

    metadata = build_front_matter_data(artifact_payload, artifact_path)
    result = {
        "content_kind": metadata["content_kind"],
        "publish_ready": artifact_payload["publish_ready"],
        "artifact_path": artifact_path,
        "markdown_path": None,
        "dated_manifest_path": None,
        "latest_pointer_path": None,
    }

    if artifact_only:
        return result

    artifact_payload, markdown_path = render_publication_markdown(
        artifact_path,
        output_dir=normalized_output_dir,
    )
    result["content_kind"] = build_front_matter_data(artifact_payload, artifact_path)["content_kind"]
    result["publish_ready"] = artifact_payload["publish_ready"]
    result["markdown_path"] = markdown_path

    if skip_handoff:
        return result

    dated_manifest_path, latest_pointer_path, manifest = build_publication_handoff(
        artifact_path,
        markdown_path,
        output_dir=normalized_output_dir,
    )
    result["content_kind"] = manifest["content_kind"]
    result["publish_ready"] = manifest["publish_ready"]
    result["dated_manifest_path"] = dated_manifest_path
    result["latest_pointer_path"] = latest_pointer_path
    return result


def print_pipeline_summary(result: dict) -> None:
    print(f"[PIPELINE] content_kind={result['content_kind']}")
    print(f"[PIPELINE] publish_ready={'yes' if result['publish_ready'] else 'no'}")
    print(f"[PIPELINE] artifact={_display_path(result['artifact_path'])}")
    if result.get("markdown_path") is not None:
        print(f"[PIPELINE] markdown={_display_path(result['markdown_path'])}")
    if result.get("dated_manifest_path") is not None:
        print(f"[PIPELINE] handoff={_display_path(result['dated_manifest_path'])}")
    if result.get("latest_pointer_path") is not None:
        print(f"[PIPELINE] latest={_display_path(result['latest_pointer_path'])}")
