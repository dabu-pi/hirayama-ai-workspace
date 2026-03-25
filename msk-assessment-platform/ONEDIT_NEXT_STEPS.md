# JASSESS-01 onEdit Next Steps

Date: 2026-03-25
Project: JASSESS-01

## Apps Script Push

- Local GAS sources to reflect:
  - `logic_engine.js`
  - `setup_sheets.js`
  - `zz_clear_input_override.js`
- Local `clasp` binary: `C:\Users\pinsh\AppData\Roaming\npm\clasp.cmd`
- `clasp push` was completed on 2026-03-25 from `msk-assessment-platform/gas`.
- Reflected remote files:
  - `appsscript.json`
  - `logic_engine.js`
  - `setup_sheets.js`
  - `zz_clear_input_override.js`
- Next human step is trigger setup and one-case verification.

## Installable Trigger

Status on 2026-03-25:

- Confirmed 1 installable trigger for `onEdit`
- Confirmed:
  - Event source: `From spreadsheet`
  - Event type: `On edit`
  - Deployment: `Head`
  - Error rate: `0%`

## One-Case Verification

Status on 2026-03-25:

1. Ran `refreshInputSheetC33Formula()`.
2. Ran `clearInputSheet()`.
3. Entered one simple case: `TC-J01`.
4. Made the last input on a trigger cell.
5. Confirmed that `C95` updated automatically.
6. Confirmed that `C99:C106` also updated automatically.
7. Confirmed `C95` result:
   - `機能改善・運動療法開始 — 段階的なエクササイズと日常活動の再開を促進`

## Pre-Clinical Notes

- Start with one case only.
- The one-case check has passed.
- Next checks before 5-10 clinical cases:
  - `TC-EMPTY03`
  - optional extra confidence check on `C84:C87`
- `clearInputSheet()` is now safe in UI-less execution contexts.
- `saveToHistory()` is still intended for spreadsheet UI use.

## Multi-Cell Paste Check

Status on 2026-03-25:

- Confirmed auto-update after multi-cell paste into `C42:C51`
- Confirmed auto-update after multi-cell paste into `C56:C64`
- Practical result: the known pre-check risk did not reproduce for RMDQ / STarT ranges in the live sheet
- `C84:C87` can still be checked later if we want extra confidence before broader live use
