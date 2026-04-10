"""Generate the publication dashboard xlsx from the local CSV views.

This script intentionally uses only the Python standard library so it can run in
the project uv environment without adding spreadsheet dependencies.
"""

from __future__ import annotations

import csv
import zipfile
from pathlib import Path
from xml.sax.saxutils import escape


BASE = Path(__file__).resolve().parent
OUTPUT = BASE / "publication_weekly_view.xlsx"
SHEETS = [
    ("週次概要", BASE / "Weekly_Overview.csv"),
    ("充足確認", BASE / "Coverage_Check.csv"),
    ("公開履歴", BASE / "Release_Log.csv"),
]


def col_name(n: int) -> str:
    name = ""
    while n:
        n, rem = divmod(n - 1, 26)
        name = chr(65 + rem) + name
    return name


def cell_xml(value: str, row: int, col: int, *, header: bool = False) -> str:
    ref = f"{col_name(col)}{row}"
    style = ' s="1"' if header else ""
    return f'<c r="{ref}" t="inlineStr"{style}><is><t>{escape(value)}</t></is></c>'


def sheet_xml(rows: list[list[str]]) -> str:
    max_col = max((len(row) for row in rows), default=1)
    max_row = max(len(rows), 1)
    dimension = f"A1:{col_name(max_col)}{max_row}"
    body = []
    for row_index, row in enumerate(rows, start=1):
        cells = "".join(
            cell_xml(str(value), row_index, col_index, header=(row_index == 1))
            for col_index, value in enumerate(row, start=1)
        )
        body.append(f'<row r="{row_index}">{cells}</row>')
    return f'''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <dimension ref="{dimension}"/>
  <sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <sheetData>{''.join(body)}</sheetData>
  <autoFilter ref="{dimension}"/>
</worksheet>'''


def read_rows(path: Path) -> list[list[str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as csv_file:
        return list(csv.reader(csv_file))


def build_xlsx(rows_by_sheet: list[tuple[str, list[list[str]]]]) -> None:
    content_types = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
''' + "".join(
        f'  <Override PartName="/xl/worksheets/sheet{i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>\n'
        for i in range(1, len(rows_by_sheet) + 1)
    ) + "</Types>"

    root_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>'''

    workbook = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
''' + "".join(
        f'    <sheet name="{escape(name)}" sheetId="{i}" r:id="rId{i}"/>\n'
        for i, (name, _) in enumerate(rows_by_sheet, start=1)
    ) + """  </sheets>
</workbook>"""

    workbook_rels = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
''' + "".join(
        f'  <Relationship Id="rId{i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet{i}.xml"/>\n'
        for i in range(1, len(rows_by_sheet) + 1)
    ) + f'  <Relationship Id="rId{len(rows_by_sheet) + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>\n</Relationships>'

    styles = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="1"><fill><patternFill patternType="none"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>
</styleSheet>'''

    with zipfile.ZipFile(OUTPUT, "w", zipfile.ZIP_DEFLATED) as workbook_zip:
        workbook_zip.writestr("[Content_Types].xml", content_types)
        workbook_zip.writestr("_rels/.rels", root_rels)
        workbook_zip.writestr("xl/workbook.xml", workbook)
        workbook_zip.writestr("xl/_rels/workbook.xml.rels", workbook_rels)
        workbook_zip.writestr("xl/styles.xml", styles)
        for index, (_, rows) in enumerate(rows_by_sheet, start=1):
            workbook_zip.writestr(f"xl/worksheets/sheet{index}.xml", sheet_xml(rows))


def main() -> None:
    rows_by_sheet = [(name, read_rows(path)) for name, path in SHEETS]
    build_xlsx(rows_by_sheet)
    print(OUTPUT)


if __name__ == "__main__":
    main()
