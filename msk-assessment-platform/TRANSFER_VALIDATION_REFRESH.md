# Transfer Validation Refresh

Date: 2026-03-25
Project: JASSESS-01

## Problem

- In `setup_sheets.js`, the transfer section already defines different dropdown choices for `C84:C87`.
- On the live sheet, all four cells were using the same list:
  - `自立 / 見守り要 / 介助要 / 不可`
- That blocks the intended ADL assessment flow, especially the case that needs the row-specific options in `C85:C87`.

## Root Cause

- This is a live-sheet drift problem, not a source-definition problem.
- The code definition for section I was already correct.
- The live input sheet kept stale or copied validation rules, so `C85:C87` no longer matched the row-specific spec.

## Validation Spec

- `C84`: `自立 / 見守り要 / 介助要 / 不可`
- `C85`: `自立 / 軽度障害 / 中等度障害 / 著明障害`
- `C86`: `自立 / 可能（手すり要） / 困難 / 不可`
- `C87`: `自立 / 可能（支持要） / 困難 / 不可`

## Fix

- Added `getInputSheetTransferValidationSpecs_()` as the single source of truth for section I.
- Added `applyInputSheetTransferValidations_(sheet)` for validation-only reapplication.
- Added `refreshInputSheetTransferValidations()` for existing live sheets.
- `setupInputSheet()` now also reads the same transfer spec helper, so initial build and live refresh use the same definition.

## Reflection Note

- Use `clasp push` to send the GAS change.
- For an existing bound spreadsheet, run `refreshInputSheetTransferValidations()` once from the Apps Script editor.
- Avoid using `setupAllSheets()` just to fix `C84:C87`, because that rebuilds the input sheet.
- `clasp push` succeeded on 2026-03-25 in Codex.
- `clasp run refreshInputSheetTransferValidations` was not available in this project context because the script is not configured as an API executable for that path.
- So the safe next step is: open the Apps Script editor and run `refreshInputSheetTransferValidations()` once manually.
