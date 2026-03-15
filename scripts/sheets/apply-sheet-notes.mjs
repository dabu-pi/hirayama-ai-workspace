#!/usr/bin/env node

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  batchGetSheetValues,
  batchUpdateSpreadsheet,
  getAuthorizedContext,
  getSheetValues,
  getSpreadsheetMetadata,
  loadJson,
  parseArgs,
  updateSheetValues,
} from '../lib-sheets.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DEFAULT_COLORS = {
  title: '#D9EAF7',
  body: '#F7F7F7',
  border: '#B7B7B7',
};

function quoteSheetName(sheetName) {
  return `'${sheetName.replace(/'/g, "''")}'`;
}

function normalizeRange(range) {
  const match = range.match(/^(?:'([^']+)'|([^!]+))!(.+)$/);
  if (!match) {
    return { sheetName: '', cellRange: range };
  }
  const [, quotedSheet, plainSheet, cellRange] = match;
  return {
    sheetName: quotedSheet || plainSheet,
    cellRange,
  };
}

function columnToLetter(index) {
  let current = index + 1;
  let result = '';
  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }
  return result;
}

function hexToRgb(hex) {
  const normalized = hex.replace('#', '');
  return {
    red: parseInt(normalized.slice(0, 2), 16) / 255,
    green: parseInt(normalized.slice(2, 4), 16) / 255,
    blue: parseInt(normalized.slice(4, 6), 16) / 255,
  };
}

function gridRange(sheetId, startRow, endRow, startCol, endCol) {
  return {
    sheetId,
    startRowIndex: startRow,
    endRowIndex: endRow,
    startColumnIndex: startCol,
    endColumnIndex: endCol,
  };
}

function repeatFormatRequest(sheetId, startRow, endRow, startCol, endCol, options) {
  return {
    repeatCell: {
      range: gridRange(sheetId, startRow, endRow, startCol, endCol),
      cell: {
        userEnteredFormat: {
          backgroundColor: hexToRgb(options.background),
          horizontalAlignment: 'LEFT',
          verticalAlignment: 'TOP',
          wrapStrategy: 'WRAP',
          textFormat: {
            bold: Boolean(options.bold),
            fontSize: options.fontSize || 10,
          },
        },
      },
      fields: 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,wrapStrategy,textFormat)',
    },
  };
}

function borderRequest(sheetId, startRow, endRow, startCol, endCol, borderColor) {
  return {
    updateBorders: {
      range: gridRange(sheetId, startRow, endRow, startCol, endCol),
      top: { style: 'SOLID', width: 1, color: hexToRgb(borderColor) },
      bottom: { style: 'SOLID', width: 1, color: hexToRgb(borderColor) },
      left: { style: 'SOLID', width: 1, color: hexToRgb(borderColor) },
      right: { style: 'SOLID', width: 1, color: hexToRgb(borderColor) },
    },
  };
}

function widthRequest(sheetId, colIndex, pixelSize) {
  return {
    updateDimensionProperties: {
      range: {
        sheetId,
        dimension: 'COLUMNS',
        startIndex: colIndex,
        endIndex: colIndex + 1,
      },
      properties: { pixelSize },
      fields: 'pixelSize',
    },
  };
}

function addColumnsRequest(sheetId, currentCount, targetExclusiveColIndex) {
  if (targetExclusiveColIndex <= currentCount) {
    return null;
  }
  return {
    appendDimension: {
      sheetId,
      dimension: 'COLUMNS',
      length: targetExclusiveColIndex - currentCount,
    },
  };
}

function getUsedArea(rows) {
  let maxCol = 0;
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
      if (row[colIndex] !== '') {
        maxCol = Math.max(maxCol, colIndex + 1);
      }
    }
  }
  return { maxCol };
}

function findTextColumn(rows, text) {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
      if (row[colIndex] === text) {
        return colIndex;
      }
    }
  }
  return null;
}

function parseSheetNamesArg(rawValue) {
  if (!rawValue) {
    return null;
  }
  const names = rawValue
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return names.length > 0 ? new Set(names) : null;
}

function applyTemplate(value, context) {
  return value.replace(/\{\{([^}]+)\}\}/g, (_, key) => `${context[key.trim()] ?? ''}`);
}

function resolveNoteValues(note, templateContext) {
  return [
    [applyTemplate(note.title, templateContext)],
    ...(note.lines ?? []).map((line) => [applyTemplate(line, templateContext)]),
  ];
}

function resolveConfigPath(configPath) {
  return resolve(configPath);
}

function buildSheetMap(metadata) {
  return new Map((metadata.sheets ?? []).map((sheet) => [sheet.properties.title, sheet.properties]));
}

function groupNotes(notes) {
  const groups = new Map();
  for (const note of notes) {
    const groupKey = `${note.sheetName}::${note.columnKey || 'default'}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey).push(note);
  }
  return groups;
}

function buildTemplateRefs(config) {
  const refs = [];
  for (const [key, ref] of Object.entries(config.valueRefs ?? {})) {
    refs.push({ key, ...ref });
  }
  return refs;
}

async function readTemplateContext({ spreadsheetId, accessToken, config }) {
  const templateRefs = buildTemplateRefs(config);
  const context = {};
  await Promise.all(templateRefs.map(async (ref) => {
    const response = await getSheetValues({
      spreadsheetId,
      sheetName: ref.sheetName,
      range: ref.range,
      accessToken,
      valueRenderOption: ref.valueRenderOption || 'FORMATTED_VALUE',
    });
    context[ref.key] = response.values?.[0]?.[0] ?? '';
  }));
  return context;
}

function resolveGroupLayouts({ notes, rowsBySheet, sheetPropsByName, config }) {
  const groups = groupNotes(notes);
  const layouts = [];
  const groupedBySheet = new Map();

  for (const [groupKey, groupNotesList] of groups.entries()) {
    const sheetName = groupNotesList[0].sheetName;
    if (!groupedBySheet.has(sheetName)) {
      groupedBySheet.set(sheetName, []);
    }
    groupedBySheet.get(sheetName).push({ groupKey, notes: groupNotesList });
  }

  for (const [sheetName, sheetGroups] of groupedBySheet.entries()) {
    const rows = rowsBySheet.get(sheetName) ?? [];
    const props = sheetPropsByName.get(sheetName);
    if (!props) {
      throw new Error(`Sheet not found: ${sheetName}`);
    }

    const used = getUsedArea(rows);
    const occupiedCols = new Set();
    for (const group of sheetGroups) {
      for (const note of group.notes) {
        const existingCol = findTextColumn(rows, note.title);
        if (existingCol !== null) {
          occupiedCols.add(existingCol);
        }
      }
    }

    let nextFreeCol = Math.max(config.defaultMinColumn ?? 8, used.maxCol + 1);
    const assignedCols = new Set(occupiedCols);

    for (const group of sheetGroups) {
      let anchorCol = null;
      for (const note of group.notes) {
        const existingCol = findTextColumn(rows, note.title);
        if (existingCol !== null) {
          anchorCol = existingCol;
          break;
        }
      }

      if (anchorCol === null) {
        const minCol = Math.max(...group.notes.map((note) => note.minColumn ?? config.defaultMinColumn ?? 8));
        nextFreeCol = Math.max(nextFreeCol, minCol);
        while (assignedCols.has(nextFreeCol)) {
          nextFreeCol += 1;
        }
        anchorCol = nextFreeCol;
        assignedCols.add(anchorCol);
        nextFreeCol = anchorCol + 1;
      }

      layouts.push(...group.notes.map((note) => ({
        ...note,
        sheetId: props.sheetId,
        sheetName,
        columnCount: props.gridProperties?.columnCount ?? 26,
        maxUsedCol: used.maxCol,
        anchorCol,
      })));
    }
  }

  return layouts;
}

function buildFormatRequests(layouts, config) {
  const requests = [];
  const groupedBySheetCol = new Map();

  for (const layout of layouts) {
    const key = `${layout.sheetId}:${layout.anchorCol}`;
    if (!groupedBySheetCol.has(key)) {
      groupedBySheetCol.set(key, []);
    }
    groupedBySheetCol.get(key).push(layout);
  }

  for (const [, items] of groupedBySheetCol.entries()) {
    const first = items[0];
    const maxWidth = Math.max(...items.map((item) => item.width ?? config.defaultWidth ?? 300));
    const maxRequiredCol = first.anchorCol + 1;
    const appendRequest = addColumnsRequest(first.sheetId, first.columnCount, maxRequiredCol);
    if (appendRequest) {
      requests.push(appendRequest);
    }
    requests.push(widthRequest(first.sheetId, first.anchorCol, maxWidth));
  }

  for (const layout of layouts) {
    const titleBg = layout.titleBackground || config.colors?.title || DEFAULT_COLORS.title;
    const bodyBg = layout.bodyBackground || config.colors?.body || DEFAULT_COLORS.body;
    const borderColor = config.colors?.border || DEFAULT_COLORS.border;
    const titleStartRow = layout.startRow - 1;
    const bodyStartRow = layout.startRow;
    const bodyEndRow = layout.startRow + (layout.lines?.length ?? 0);

    requests.push(
      repeatFormatRequest(layout.sheetId, titleStartRow, titleStartRow + 1, layout.anchorCol, layout.anchorCol + 1, {
        background: titleBg,
        bold: true,
        fontSize: layout.titleFontSize || 11,
      }),
      repeatFormatRequest(layout.sheetId, bodyStartRow, bodyEndRow, layout.anchorCol, layout.anchorCol + 1, {
        background: bodyBg,
        fontSize: layout.bodyFontSize || 10,
      }),
      borderRequest(layout.sheetId, titleStartRow, bodyEndRow, layout.anchorCol, layout.anchorCol + 1, borderColor),
    );
  }

  return requests;
}

async function applyNotes({ context, config, notes, templateContext, shouldWrite }) {
  const metadata = await getSpreadsheetMetadata({
    spreadsheetId: context.spreadsheetId,
    accessToken: context.accessToken,
  });
  const sheetPropsByName = buildSheetMap(metadata);
  const scanRange = config.scanRange || 'A1:Z40';
  const scanRanges = [...new Set(notes.map((note) => `${quoteSheetName(note.sheetName)}!${scanRange}`))];
  const scanned = await batchGetSheetValues({
    spreadsheetId: context.spreadsheetId,
    ranges: scanRanges,
    accessToken: context.accessToken,
    valueRenderOption: 'FORMATTED_VALUE',
  });

  const rowsBySheet = new Map();
  for (const valueRange of scanned.valueRanges ?? []) {
    const { sheetName } = normalizeRange(valueRange.range);
    rowsBySheet.set(sheetName, valueRange.values ?? []);
  }

  const layouts = resolveGroupLayouts({
    notes,
    rowsBySheet,
    sheetPropsByName,
    config,
  });

  const requests = buildFormatRequests(layouts, config);

  if (shouldWrite && requests.length > 0) {
    await batchUpdateSpreadsheet({
      spreadsheetId: context.spreadsheetId,
      accessToken: context.accessToken,
      requests,
    });
  }

  if (shouldWrite) {
    for (const layout of layouts) {
      const colLetter = columnToLetter(layout.anchorCol);
      const endRow = layout.startRow + (layout.lines?.length ?? 0);
      await updateSheetValues({
        spreadsheetId: context.spreadsheetId,
        sheetName: layout.sheetName,
        range: `${colLetter}${layout.startRow}:${colLetter}${endRow}`,
        values: resolveNoteValues(layout, templateContext),
        accessToken: context.accessToken,
      });
    }
  }

  const verificationRanges = layouts.map((layout) => {
    const colLetter = columnToLetter(layout.anchorCol);
    const endRow = layout.startRow + (layout.lines?.length ?? 0);
    return `${quoteSheetName(layout.sheetName)}!${colLetter}${layout.startRow}:${colLetter}${endRow}`;
  });

  const verification = await batchGetSheetValues({
    spreadsheetId: context.spreadsheetId,
    ranges: verificationRanges,
    accessToken: context.accessToken,
    valueRenderOption: 'FORMATTED_VALUE',
  });

  return {
    layouts: layouts.map((layout) => {
      const colLetter = columnToLetter(layout.anchorCol);
      const endRow = layout.startRow + (layout.lines?.length ?? 0);
      return {
        noteId: layout.id,
        sheetName: layout.sheetName,
        maxUsedCol: layout.maxUsedCol ? columnToLetter(layout.maxUsedCol - 1) : null,
        range: `${colLetter}${layout.startRow}:${colLetter}${endRow}`,
      };
    }),
    verification: verification.valueRanges ?? [],
  };
}

export async function runConfiguredSheetNotes({ argv = process.argv.slice(2), configPath } = {}) {
  if (!configPath) {
    throw new Error('Config path is required.');
  }

  const args = parseArgs(argv);
  const resolvedConfigPath = resolveConfigPath(configPath);
  const config = loadJson(resolvedConfigPath);
  const shouldWrite = args.write === 'true';
  const targetSheetNames = parseSheetNamesArg(args['sheet-names']);
  const notes = (config.notes ?? []).filter((note) => !targetSheetNames || targetSheetNames.has(note.sheetName));

  if (notes.length === 0) {
    throw new Error('No target notes matched the requested sheets.');
  }

  const context = await getAuthorizedContext({
    ...args,
    'spreadsheet-id': args['spreadsheet-id'] || config.spreadsheetId,
  });
  const templateContext = await readTemplateContext({
    spreadsheetId: context.spreadsheetId,
    accessToken: context.accessToken,
    config,
  });

  const result = await applyNotes({
    context,
    config,
    notes,
    templateContext,
    shouldWrite,
  });

  console.log(JSON.stringify({
    configPath: resolvedConfigPath,
    spreadsheetId: context.spreadsheetId,
    mode: shouldWrite ? 'write' : 'dry-run',
    targetSheets: targetSheetNames ? Array.from(targetSheetNames) : null,
    templateContext,
    layouts: result.layouts,
    verification: result.verification,
  }, null, 2));
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  const args = parseArgs(process.argv.slice(2));
  const configPath = args.config ? resolve(__dirname, '..', '..', args.config) : null;
  runConfiguredSheetNotes({ argv: process.argv.slice(2), configPath }).catch((error) => {
    console.error(`[ERR] ${error.message}`);
    process.exit(1);
  });
}
