# clearInputSheet UI Context Fix

Date: 2026-03-25
Project: JASSESS-01

## Root Cause

`clearInputSheet()` assumed both `SpreadsheetApp.getUi()` and
`SpreadsheetApp.getActiveSpreadsheet()` were always available.

That is valid in normal spreadsheet UI use, but fragile in UI-less execution
contexts such as Apps Script editor runs or standalone-style execution.
In those contexts the old function could fail before the clear logic ran.

## Fix Method

The fix keeps normal spreadsheet UX, but removes the hard dependency on UI.

- Spreadsheet resolution now falls back to the known JASSESS-01 spreadsheet ID.
- UI access now goes through a safe wrapper.
- When UI exists, confirm and completion alerts are still shown.
- When UI does not exist, the function skips confirmation and logs instead.
- The function now returns a small result object for non-UI execution.

## Safer Execution Contexts

- Spreadsheet UI manual execution
- Apps Script editor execution without spreadsheet UI
- execution where active spreadsheet is unavailable but the script can open the known spreadsheet ID

## Notes

- `saveToHistory()` is still UI-oriented and should be run from spreadsheet UI.
- This fix is limited to `clearInputSheet()` because that was the known blocker for the next phase.
