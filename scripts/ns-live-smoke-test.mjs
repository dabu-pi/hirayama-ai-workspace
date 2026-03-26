#!/usr/bin/env node

import {
  batchGetSheetValues,
  getAuthorizedContext,
  getSpreadsheetMetadata,
  parseArgs,
  updateSheetValues,
} from './lib-sheets.mjs';

const DEFAULT_SPREADSHEET_ID = '1sj6dYtkFbnk4fjLOk764f-w7KUUeGNVYcbMDOg26OXY';
const DEFAULT_SERVICE_ACCOUNT = 'C:/hirayama-ai-workspace/workspace/secrets/service_account.json';
const COMMON_SHEET = '\u5171\u901a_\u521d\u671f\u8a55\u4fa1';
const NS_SHEET = '\u981a\u80a9\u3053\u308a_\u521d\u671f\u8a55\u4fa1';

const COMMON_START_ROW = 3;
const COMMON_END_ROW = 48;
const NS_START_ROW = 3;
const NS_END_ROW = 70;

const COMMON_DEFAULTS = {
  C3: '',
  C4: '',
  C18: '',
  C20: '',
  C23: false,
  C24: false,
  C25: false,
  C26: false,
  C27: false,
  C28: false,
  C29: false,
  C30: false,
  C34: '',
  C35: '',
  C43: '',
  C45: '',
  C47: '',
};

const NS_DEFAULTS = {
  C7: false,
  C8: false,
  C9: false,
  C10: false,
  C11: false,
  C15: '\u306a\u3057',
  C16: '\u306a\u3057',
  C17: false,
  C18: false,
  C23: '\u981a\u90e8\u75db',
  C24: '\u4e00\u5074',
  C25: '',
  C26: '\u80a9\u304b\u3089\u3072\u3058',
  C29: '1\u301c2\u6642\u9593',
  C30: '1\u301c2\u6642\u9593',
  C31: '30\u5206\u672a\u6e80',
  C32: '',
  C33: '\u306a\u3057',
  C37: '\u306a\u3057',
  C38: '\u306a\u3057',
  C39: '\u5de6\u53f3\u5dee\u306a\u3057',
  C40: '\u306a\u3057',
  C41: '',
  C44: '\u6b63\u5e38',
  C45: '\u6b63\u5e38',
  C46: '\u6b63\u5e38',
  C47: '\u6b63\u5e38',
  C48: '\u6b63\u5e38',
  C49: '\u6b63\u5e38',
  C53: '\u6b63\u5e38',
  C54: '\u9670\u6027',
  C55: '\u554f\u984c\u306a\u3057',
  C56: '\u554f\u984c\u306a\u3057',
};

const PATTERNS = [
  {
    name: '\u981a\u9ac4\u75c7\u7591\u3044',
    expectedProfile: 'NS_MYELOPATHY',
    common: {
      C3: '2026-03-26',
      C4: 'NS-SMOKE-MYELO',
      C18: '2\u9031\u9593\u301c3\u304b\u6708',
      C20: '\u518d\u767a',
      C34: '6',
      C35: '7',
    },
    ns: {
      C15: '\u4e21\u5074',
      C17: true,
      C23: '\u981a\u90e8\u75db',
    },
  },
  {
    name: '\u8d64\u65d7',
    expectedProfile: 'NS_REDFLAG',
    common: {
      C3: '2026-03-26',
      C4: 'NS-SMOKE-RED',
      C18: '2\u9031\u9593\u301c3\u304b\u6708',
      C20: '\u518d\u767a',
      C34: '5',
      C35: '6',
    },
    ns: {
      C7: true,
      C23: '\u981a\u90e8\u75db',
    },
  },
  {
    name: '\u795e\u7d4c\u6839\u6027',
    expectedProfile: 'NS_RADICULOPATHY',
    common: {
      C3: '2026-03-26',
      C4: 'NS-SMOKE-RAD',
      C18: '2\u9031\u9593\u301c3\u304b\u6708',
      C20: '\u518d\u767a',
      C34: '8',
      C35: '9',
    },
    ns: {
      C15: '\u7247\u5074',
      C23: '\u4e0a\u80a2\u75db\u4e3b\u4f53',
    },
  },
  {
    name: '\u6162\u6027\u9ad8\u8ca0\u8377',
    expectedProfile: 'NS_CHRONIC_LIFE',
    common: {
      C3: '2026-03-26',
      C4: 'NS-SMOKE-CHL',
      C18: '3\u304b\u6708\u4ee5\u4e0a',
      C20: '\u518d\u767a',
      C34: '5',
      C35: '6',
    },
    ns: {
      C23: '\u80a9\u3053\u308a',
      C29: '7\u6642\u9593\u4ee5\u4e0a/\u65e5',
      C30: '5\u6642\u9593\u4ee5\u4e0a',
    },
  },
  {
    name: '\u6a19\u6e96',
    expectedProfile: 'NS_STANDARD',
    common: {
      C3: '2026-03-26',
      C4: 'NS-SMOKE-STD',
      C18: '2\u9031\u9593\u301c3\u304b\u6708',
      C20: '\u518d\u767a',
      C34: '3',
      C35: '4',
    },
    ns: {
      C23: '\u80a9\u3053\u308a',
    },
  },
];

function normalizeRangeKey(value) {
  return String(value || '').replace(/^'(.+)'!/, '$1!');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildBlankColumnRange(startRow, endRow) {
  return Array.from({ length: endRow - startRow + 1 }, () => ['']);
}

function toRangeA1(startRow, endRow) {
  return `C${startRow}:C${endRow}`;
}

function cloneRows(rows) {
  return rows.map((row) => [row?.[0] ?? '']);
}

function applyA1Values(rows, startRow, valuesByA1) {
  const next = cloneRows(rows);
  Object.entries(valuesByA1).forEach(([a1, value]) => {
    const rowNumber = Number(a1.replace(/^C/, ''));
    const index = rowNumber - startRow;
    if (index < 0 || index >= next.length) {
      throw new Error(`Cell out of supported range: ${a1}`);
    }
    next[index][0] = value;
  });
  return next;
}

function getPatternByName(name) {
  const direct = PATTERNS.find((pattern) => pattern.name === name);
  if (direct) {
    return direct;
  }
  return PATTERNS.find((pattern) => pattern.expectedProfile === name);
}

function buildPatternColumns(pattern) {
  const commonBase = applyA1Values(
    buildBlankColumnRange(COMMON_START_ROW, COMMON_END_ROW),
    COMMON_START_ROW,
    COMMON_DEFAULTS,
  );
  const nsBase = applyA1Values(
    buildBlankColumnRange(NS_START_ROW, NS_END_ROW),
    NS_START_ROW,
    NS_DEFAULTS,
  );

  return {
    common: applyA1Values(commonBase, COMMON_START_ROW, pattern.common || {}),
    ns: applyA1Values(nsBase, NS_START_ROW, pattern.ns || {}),
  };
}

async function readRanges(context, ranges, valueRenderOption = 'FORMULA') {
  const batch = await batchGetSheetValues({
    spreadsheetId: context.spreadsheetId,
    accessToken: context.accessToken,
    ranges,
    valueRenderOption,
  });
  const map = new Map((batch.valueRanges || []).map((item) => [normalizeRangeKey(item.range), item.values || []]));
  return ranges.map((range) => cloneRows(map.get(range) || []));
}

async function writeColumnRange(context, sheetName, startRow, endRow, rows) {
  await updateSheetValues({
    spreadsheetId: context.spreadsheetId,
    accessToken: context.accessToken,
    sheetName,
    range: toRangeA1(startRow, endRow),
    values: rows,
  });
}

async function collectOutputs(context) {
  const ranges = [
    `${NS_SHEET}!C59:C60`,
    `${NS_SHEET}!C63:C70`,
  ];
  const [top, comments] = await readRanges(context, ranges, 'FORMATTED_VALUE');
  const commentValues = comments.map((row) => row[0] || '');
  return {
    c59: top[0]?.[0] || '',
    c60: top[1]?.[0] || '',
    comments: commentValues,
  };
}

async function runPattern(context, pattern, waitMs) {
  const commonRange = `${COMMON_SHEET}!${toRangeA1(COMMON_START_ROW, COMMON_END_ROW)}`;
  const nsRange = `${NS_SHEET}!${toRangeA1(NS_START_ROW, NS_END_ROW)}`;
  const [commonSnapshot, nsSnapshot] = await readRanges(context, [commonRange, nsRange], 'FORMULA');
  const nextValues = buildPatternColumns(pattern);

  try {
    await writeColumnRange(context, COMMON_SHEET, COMMON_START_ROW, COMMON_END_ROW, nextValues.common);
    await writeColumnRange(context, NS_SHEET, NS_START_ROW, NS_END_ROW, nextValues.ns);
    await sleep(waitMs);
    const outputs = await collectOutputs(context);
    return {
      caseName: pattern.name,
      expectedProfile: pattern.expectedProfile,
      c59: outputs.c59,
      c60: outputs.c60,
      comments: outputs.comments,
    };
  } finally {
    await writeColumnRange(context, COMMON_SHEET, COMMON_START_ROW, COMMON_END_ROW, commonSnapshot);
    await writeColumnRange(context, NS_SHEET, NS_START_ROW, NS_END_ROW, nsSnapshot);
    await sleep(500);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const spreadsheetId = args['spreadsheet-id'] || DEFAULT_SPREADSHEET_ID;
  const serviceAccountPath = args['service-account'] || DEFAULT_SERVICE_ACCOUNT;
  const patternArg = args.pattern || 'all';
  const waitMs = Number(args.wait || 2500);
  const jsonMode = args.json === 'true';

  const context = await getAuthorizedContext({
    'spreadsheet-id': spreadsheetId,
    'service-account': serviceAccountPath,
  });

  const metadata = await getSpreadsheetMetadata({
    spreadsheetId,
    accessToken: context.accessToken,
    fields: 'properties.title,sheets(properties(title,index))',
  });
  const availableSheets = (metadata.sheets || []).map((sheet) => sheet.properties?.title).filter(Boolean);
  for (const requiredSheet of [COMMON_SHEET, NS_SHEET]) {
    if (!availableSheets.includes(requiredSheet)) {
      throw new Error(`Sheet not found: ${requiredSheet}`);
    }
  }

  const patterns = patternArg === 'all'
    ? PATTERNS
    : [getPatternByName(patternArg)].filter(Boolean);

  if (patterns.length === 0) {
    throw new Error(`Unknown pattern: ${patternArg}`);
  }

  const results = [];
  for (const pattern of patterns) {
    results.push(await runPattern(context, pattern, waitMs));
  }

  const report = {
    spreadsheetId,
    spreadsheetTitle: metadata.properties?.title || '(unknown)',
    patterns: results,
  };

  if (jsonMode) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`Spreadsheet: ${report.spreadsheetTitle}`);
  results.forEach((result) => {
    console.log(`Case: ${result.caseName}`);
    console.log(`- Expected profile: ${result.expectedProfile}`);
    console.log(`- C59: ${result.c59}`);
    console.log(`- C60: ${result.c60}`);
    result.comments.forEach((comment, index) => {
      console.log(`- C${63 + index}: ${comment}`);
    });
    console.log('');
  });
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
