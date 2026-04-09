"""
Integration-style compare CLI regression tests for run_batch.py.
"""

import csv
import io
import sys
from pathlib import Path

if sys.stdout.encoding != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

sys.path.insert(0, str(Path(__file__).parent.parent))

from scripts import run_batch
from src.collectors.mock import MockCollector

FIXTURE_PATH = Path(__file__).parent / "fixtures" / "compare_source_sets_cli_fixture.json"
FIXTURE_WEEK = "2026-04-13"


def _run_compare_cli(monkeypatch, capsys, tmp_path: Path, *extra_args: str) -> str:
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(
        run_batch,
        "MockCollector",
        lambda: MockCollector(mock_path=FIXTURE_PATH),
    )
    monkeypatch.setattr(
        sys,
        "argv",
        [
            "run_batch.py",
            "--week",
            FIXTURE_WEEK,
            "--compare-source-sets",
            *extra_args,
        ],
    )
    run_batch.main()
    captured = capsys.readouterr()
    return captured.out


def test_compare_cli_normal_output_uses_fixture(monkeypatch, capsys, tmp_path):
    output = _run_compare_cli(monkeypatch, capsys, tmp_path)

    assert "[COMPARE] source_sets=GT only / GT + GS / GT + GS + YT" in output
    assert "[COMPARE] significant rows:" not in output
    assert "=== Source Set Comparison 2026-04-13 ===" in output
    assert "Concept2" in output
    assert "TECHNOGYM" in output
    assert "Matrix" in output
    assert "Body-Solid" in output
    assert "Alpha" in output
    assert "Bravo" in output
    assert "Precor" in output
    assert "6 -> 6 -> 7" in output
    assert "7 -> 7 -> 6" in output
    assert "Total 7 models" in output


def test_compare_cli_significant_only_prints_stable_three_line_summary(monkeypatch, capsys, tmp_path):
    output = _run_compare_cli(monkeypatch, capsys, tmp_path, "--compare-only-significant")

    summary_lines = [
        line
        for line in output.splitlines()
        if line.startswith("[COMPARE] significant rows:")
        or line.startswith("[COMPARE] top drivers:")
        or line.startswith("[COMPARE] largest impact:")
    ]
    assert summary_lines == [
        "[COMPARE] significant rows: 6 / 7 | rank shifts: 2",
        "[COMPARE] top drivers: GS boost x3, GS downweight x3",
        "[COMPARE] largest impact: Concept2 SkiErg (GS downweight, 1.6)",
    ]
    assert "Body-Solid" not in output
    assert "Alpha" in output
    assert "Bravo" in output
    assert "Concept2" in output
    assert "TECHNOGYM" in output
    assert "Matrix" in output
    assert "Precor" in output
    assert "Total 6 models" in output


def test_compare_cli_output_csv_keeps_row_data_only(monkeypatch, capsys, tmp_path):
    output = _run_compare_cli(monkeypatch, capsys, tmp_path, "--compare-only-significant", "--output-csv")

    output_path = tmp_path / "data" / "output" / "ranking_compare_20260413.csv"
    assert output_path.exists()
    assert f"[CSV] {output_path.resolve()}" in output

    content = output_path.read_text(encoding="utf-8-sig")
    assert "[COMPARE]" not in content

    with output_path.open("r", encoding="utf-8-sig", newline="") as handle:
        rows = list(csv.DictReader(handle))

    assert len(rows) == 6
    assert [row["model"] for row in rows[:2]] == ["B-Two", "A-One"]
    assert {row["model"] for row in rows} == {"B-Two", "A-One", "SkiErg", "Run", "T75", "TRM 445"}
    assert "G4I" not in {row["model"] for row in rows}
