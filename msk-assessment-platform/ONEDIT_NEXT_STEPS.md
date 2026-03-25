# JASSESS-01 onEdit Next Steps

Date: 2026-03-25
Project: JASSESS-01

## Apps Script Push

- Local GAS sources to reflect:
  - `logic_engine.js`
  - `setup_sheets.js`
  - `zz_clear_input_override.js`
- This environment could not run `clasp` directly because the `clasp` command was not installed.
- When `clasp` is available, run the push from `msk-assessment-platform/gas`.

## Installable Trigger

1. Open the Apps Script editor bound to JASSESS-01.
2. Open Triggers.
3. Add a new trigger for `onEdit`.
4. Select:
   - Event source: `From spreadsheet`
   - Event type: `On edit`
   - Deployment: `Head`

## One-Case Verification

1. Run `clearInputSheet()`.
2. Enter `C3` and `C4`.
3. Input one simple case such as `TC-J01` or `TC-J10`.
4. Make the last input on a trigger cell.
5. Confirm that `C95` updates automatically.
6. Confirm that `C99:C106` also updates automatically.
7. If needed, run `runLogicAll()` once and confirm the result matches the onEdit result.

## Pre-Clinical Notes

- Start with one case only.
- Move to 5-10 clinical cases only after the one-case check passes.
- `clearInputSheet()` is now safe in UI-less execution contexts.
- `saveToHistory()` is still intended for spreadsheet UI use.
