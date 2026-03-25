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

globalThis.clearInputSheet = function(options) {
  const opts = options || {};
  const ss = getJassessSpreadsheet_();
  const sheet = ss.getSheetByName(SHEET_NAMES.INPUT);
  const ui = tryGetUi_();

  if (!sheet) {
    showOptionalAlert_(ui, 'Error', 'Input sheet not found. Please rerun setupAllSheets().');
    return { ok: false, reason: 'missing_input_sheet', usedUi: !!ui };
  }

  if (!opts.skipConfirmation && ui) {
    const response = ui.alert('Confirm', 'Clear the input sheet? History will not be updated.', ui.ButtonSet.YES_NO);
    if (response !== ui.Button.YES) {
      return { ok: false, reason: 'cancelled', usedUi: true };
    }
  } else if (!ui) {
    Logger.log('[clearInputSheet] UI unavailable. Proceeding without confirmation.');
  }

  const clearRanges = [
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
  ];

  clearRanges.forEach(range => {
    sheet.getRange(range).clearContent();
  });

  showOptionalAlert_(ui, 'Cleared. You can enter a new evaluation.');
  return { ok: true, usedUi: !!ui, clearedRanges: clearRanges.length };
};
