# C33 Empty Guard Fix

Date: 2026-03-25
Project: JASSESS-01

## Problem

- After `clearInputSheet()`, `C28`, `C31`, and `C32` can all be blank.
- The old `C33` formula treated `C28 <> "なし"` as mild.
- Because a blank cell is also "not equal to なし", `C33` could become `軽度` even when the neuro inputs were not entered yet.

## Root Cause

- The old formula had this final branch:
  - if `C28 <> "なし"` then `軽度`
- That branch correctly catches `片側` and `両側`, but it also catches blank.
- So the bug is an empty-input handling issue, not a normal-case scoring issue.

## Spec Decision

- If `C28`, `C31`, and `C32` are all blank, `C33` must stay blank.
- `C28=なし` and `C31=なし` and `C32=陰性` means `C33=なし`.
- `C28=片側` or `C28=両側` means `C33=軽度`.
- `C32=陽性（右）` or `C32=陽性（左）` means `C33=中等度`.
- `C31=あり` or `C32=両側陽性` means `C33=重度`.
- If the inputs are only partially filled and do not yet satisfy one of the explicit rules above, `C33` stays blank instead of guessing.

## Fix

- Replaced the direct literal formula with a formula assembled from the existing dropdown choices in `setup_sheets.js`.
- Added an explicit `COUNTA(C28,C31,C32)=0` guard.
- Changed the mild branch from a negative check (`<> "なし"`) to explicit positive values only:
  - `C28=片側`
  - `C28=両側`
- Changed the none branch to require all three explicit normal inputs:
  - `C28=なし`
  - `C31=なし`
  - `C32=陰性`

## Safe Contexts

- Safe after `clearInputSheet()` before any neuro inputs are entered.
- Safe for the known normal case used in `TC-J01`.
- Safe for partial entry because the sheet no longer auto-promotes blank neuro inputs to `軽度`.

## Reflection Note

- Because this fix changes `gas/setup_sheets.js`, the Apps Script project should be updated with `clasp push`.
- For an existing bound spreadsheet, run `refreshInputSheetC33Formula()` to rewrite only `C33`.
- Avoid running `setupAllSheets()` on a live sheet just to apply this one formula fix, because it rebuilds the input sheet.
- `clasp push` succeeded on 2026-03-25 in Codex.
- `clasp run refreshInputSheetC33Formula` was not available in this project context because the script is not configured as an API executable for that path.
- So the safe next step is: open the Apps Script editor and run `refreshInputSheetC33Formula()` once manually.
