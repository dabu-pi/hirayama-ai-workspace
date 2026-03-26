/**
 * clearInputSheet override for UI-less / standalone-safe execution.
 * This file is kept separate from setup_sheets.js to avoid re-encoding the
 * legacy GAS source file while we patch the runtime behavior.
 */

const JASSESS_SPREADSHEET_ID = '1sj6dYtkFbnk4fjLOk764f-w7KUUeGNVYcbMDOg26OXY';

function getJassessSpreadsheet_() {
  return SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById(JASSESS_SPREADSHEET_ID);
}

function tryGetUi_() {
  try {
    return SpreadsheetApp.getUi();
  } catch (error) {
    return null;
  }
}

function showOptionalAlert_(ui, title, message) {
  if (!ui) {
    Logger.log(message === undefined ? title : '[' + title + '] ' + message);
    return;
  }
  if (message === undefined) {
    ui.alert(title);
    return;
  }
  ui.alert(title, message, ui.ButtonSet.OK);
}

function getOverridePhase2SheetNames_() {
  if (typeof NS_SHEET_NAMES !== 'undefined') {
    return NS_SHEET_NAMES;
  }
  return {
    COMMON_INPUT: '共通_初期評価',
    NS_INPUT: '頚肩こり_初期評価',
  };
}

function getOverrideClearInputTargets_(ss) {
  const phase2Names = getOverridePhase2SheetNames_();

  const targets = [
    {
      sheet: ss.getSheetByName(SHEET_NAMES.INPUT),
      ranges: [
        'C3:C13',
        'C16:C23',
        'C28:C32',
        'C36:C38',
        'C42:C51',
        'C56:C64',
        'C69:C71', 'D69:D71', 'D73',
        'C76:C80',
        'C84:C87',
        'C91:C95',
        'C108',
      ],
    },
    {
      sheet: ss.getSheetByName(phase2Names.COMMON_INPUT),
      ranges: [
        'C3:C14',
        'C17:C20',
        'C23:C30',
        'C34:C35',
        'C38:C39',
        'C42:C47',
      ],
    },
    {
      sheet: ss.getSheetByName(phase2Names.NS_INPUT),
      ranges: [
        'C7:C11',
        'C15:C19',
        'C23:C26',
        'C29:C33',
        'C37:C41',
        'C44:C49',
        'C53:C56',
        'C59:C60',
        'C63:C70',
      ],
    },
  ];

  return targets.filter(target => target.sheet);
}

globalThis.clearInputSheet = function(options) {
  const opts = options || {};
  const ss = getJassessSpreadsheet_();
  const clearTargets = getOverrideClearInputTargets_(ss);
  const ui = tryGetUi_();

  if (!clearTargets.length) {
    showOptionalAlert_(ui, 'Error', 'Input sheet not found. Please rerun setupAllSheets().');
    return { ok: false, reason: 'missing_input_sheet', usedUi: !!ui };
  }

  if (!opts.skipConfirmation && ui) {
    const response = ui.alert(
      'Confirm',
      'Clear the input sheets? Phase 2 common/neck-shoulder inputs will also be reset. History will not be updated.',
      ui.ButtonSet.YES_NO
    );
    if (response !== ui.Button.YES) {
      return { ok: false, reason: 'cancelled', usedUi: true };
    }
  } else if (!ui) {
    Logger.log('[clearInputSheet] UI unavailable. Proceeding without confirmation.');
  }

  let clearedRanges = 0;
  clearTargets.forEach(target => {
    target.ranges.forEach(range => {
      target.sheet.getRange(range).clearContent();
      clearedRanges += 1;
    });
  });

  showOptionalAlert_(ui, 'Cleared. You can enter a new evaluation.');
  return { ok: true, usedUi: !!ui, clearedSheets: clearTargets.length, clearedRanges: clearedRanges };
};
