"""Run artifact -> markdown -> handoff publication preparation as one thin pipeline."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))

from src.publication.pipeline import (
    PublicationPipelineError,
    print_pipeline_summary,
    run_publication_pipeline,
)


def main() -> None:
    parser = argparse.ArgumentParser(description="Run publication preparation pipeline")
    parser.add_argument("--week")
    parser.add_argument("--use-db", action="store_true")
    parser.add_argument("--db-path")
    parser.add_argument("--only-commercial", action="store_true")
    parser.add_argument("--no-discontinued", action="store_true")
    parser.add_argument("--compare-source-sets", action="store_true")
    parser.add_argument("--output-dir")
    parser.add_argument("--skip-handoff", action="store_true")
    parser.add_argument("--artifact-only", action="store_true")
    parser.add_argument("--from-artifact")
    args = parser.parse_args()

    result = run_publication_pipeline(
        week=args.week,
        compare_source_sets=args.compare_source_sets,
        use_db=args.use_db,
        only_commercial=args.only_commercial,
        no_discontinued=args.no_discontinued,
        db_path=args.db_path,
        output_dir=args.output_dir,
        skip_handoff=args.skip_handoff,
        artifact_only=args.artifact_only,
        from_artifact=args.from_artifact,
    )
    print_pipeline_summary(result)


if __name__ == "__main__":
    try:
        main()
    except PublicationPipelineError as exc:
        print(f"[ERROR] {exc}", file=sys.stderr)
        raise SystemExit(1) from exc
