import { getSheetValues } from './lib-sheets.mjs';

export const SHEET_NAME = 'Task_Queue';
export const DEFAULT_RANGE = '1:200';
export const LIVE_HEADERS = [
  'Task',
  'Project',
  'Type',
  'Priority',
  'Status',
  'Assigned To',
  'Planned Date',
  'Done Date',
  'Dependency',
  'Score',
  'Notes',
];
export const REQUIRED_FIELDS = [
  ['Task', 0],
  ['Project', 1],
  ['Type', 2],
  ['Priority', 3],
  ['Status', 4],
];
export const KNOWN_CLEANUP_MISSING = ['Project', 'Type', 'Priority', 'Status'];

export function isLiveHeaderRow(row = []) {
  return LIVE_HEADERS.every((value, index) => row[index] === value);
}

export function findHeaderRowIndex(rows = []) {
  return rows.findIndex((row) => isLiveHeaderRow(row));
}

export function parseRangeStart(range) {
  const match = String(range || '').match(/^(\d+)/);
  return match ? Number(match[1]) : 1;
}

export function hasAnyValue(row = []) {
  return row.some((cell) => String(cell || '').trim() !== '');
}

export function findMissingRequiredFields(row = []) {
  return REQUIRED_FIELDS
    .filter(([, index]) => String(row[index] || '').trim() === '')
    .map(([label]) => label);
}

function matchesKnownCleanupMissing(missing = []) {
  if (missing.length !== KNOWN_CLEANUP_MISSING.length) {
    return false;
  }
  return KNOWN_CLEANUP_MISSING.every((label, index) => missing[index] === label);
}

export function isKnownCleanupCandidate(entry) {
  const taskValue = String(entry.row?.[0] || '').trim();
  const otherValues = (entry.row || []).slice(1).some((cell) => String(cell || '').trim() !== '');
  return taskValue !== '' && !otherValues && matchesKnownCleanupMissing(entry.missing);
}

export function formatTaskQueueRowRange(rowNumber) {
  const endColumn = String.fromCharCode('A'.charCodeAt(0) + LIVE_HEADERS.length - 1);
  return `${SHEET_NAME}!A${rowNumber}:${endColumn}${rowNumber}`;
}

export async function loadTaskQueueAnalysis({ context, range = DEFAULT_RANGE }) {
  const response = await getSheetValues({
    spreadsheetId: context.spreadsheetId,
    sheetName: SHEET_NAME,
    range,
    accessToken: context.accessToken,
  });

  const rows = response.values ?? [];
  if (rows.length === 0) {
    return {
      range,
      rows,
      findings: [],
      knownCleanupCandidate: null,
      headerIndex: -1,
    };
  }

  const headerIndex = findHeaderRowIndex(rows);
  if (headerIndex < 0) {
    throw new Error(`Task_Queue header row was not found inside ${SHEET_NAME}!${range}`);
  }

  const rangeStart = parseRangeStart(range);
  const findings = rows
    .slice(headerIndex + 1)
    .map((row, index) => {
      const rowNumber = rangeStart + headerIndex + index + 1;
      const missing = hasAnyValue(row) ? findMissingRequiredFields(row) : [];
      return {
        rowNumber,
        row,
        missing,
        knownCleanupCandidate: false,
      };
    })
    .filter((entry) => entry.missing.length > 0)
    .map((entry) => ({
      ...entry,
      knownCleanupCandidate: isKnownCleanupCandidate(entry),
    }));

  const knownCleanupCandidate = findings.length === 1 && findings[0].knownCleanupCandidate
    ? findings[0]
    : null;

  return {
    range,
    rows,
    findings,
    knownCleanupCandidate,
    headerIndex,
  };
}
