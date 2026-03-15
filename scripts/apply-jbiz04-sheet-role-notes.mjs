#!/usr/bin/env node

import {
  batchGetSheetValues,
  batchUpdateSpreadsheet,
  getAuthorizedContext,
  getSheetValues,
  getSpreadsheetMetadata,
  parseArgs,
  updateSheetValues,
} from './lib-sheets.mjs';

const SPREADSHEET_ID = '1FnJdALwFSv48WiD6NWr0DzG78kwB692R2pFeiTcZlCc';
const SCAN_RANGE = 'A1:Z40';
const ROLE_TITLE = 'このシートの役割';
const MEMO_TITLE_PREFIX = '更新メモ';

const SHEETS = [
  '全体ダッシュボード',
  'ロードマップ進捗',
  '保険・来院前提',
  '数値前提',
  '価格設定',
  'KPI目標',
  '未確定項目',
];

const ROLE_TEXT = new Map([
  ['全体ダッシュボード', [
    '管理表全体の進み具合を見るシートです。',
    '主要KPIと未確定項目の状態をひと目で確認します。',
    '次に確認するシートへ進む入口として使います。',
  ]],
  ['ロードマップ進捗', [
    '何をどの順番で確定するかを管理するシートです。',
    'フェーズごとの進捗と次の着手順を確認します。',
    '未着手と保留を見分けて優先順位を揃えます。',
  ]],
  ['保険・来院前提', [
    '保険来院の入口数字を置くシートです。',
    '保険実人数・延べ来院数・保険単価の基準をまとめます。',
    '数値前提へ渡す保険売上の起点として使います。',
  ]],
  ['数値前提', [
    '経営判断に使う前提数字を置くシートです。',
    '固定費と月次保険売上の基準値をまとめて見ます。',
    'KPI判断の共通土台として使います。',
  ]],
  ['価格設定', [
    '売る商品の一覧と価格を決めるシートです。',
    '主力手技と将来メニューの位置づけをここで揃えます。',
    'KPI逆算で使う主力手技価格の参照元です。',
  ]],
  ['KPI目標', [
    '月次目標と当月実績を見比べるシートです。',
    '月次総保険売上と自費売上の着地確認に使います。',
    '月末に実績セルを入力して達成率を確認します。',
  ]],
  ['未確定項目', [
    'まだ決め切れていない項目を一覧化するシートです。',
    '何を先に確定するかを整理します。',
    '価格・KPI・固定費の保留をまとめて管理します。',
  ]],
]);

const COLOR = {
  title: '#D9EAF7',
  body: '#F7F7F7',
  memoTitle: '#FCE5CD',
  memoBody: '#FFF9E6',
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

function borderRequest(sheetId, startRow, endRow, startCol, endCol) {
  return {
    updateBorders: {
      range: gridRange(sheetId, startRow, endRow, startCol, endCol),
      top: { style: 'SOLID', width: 1, color: hexToRgb(COLOR.border) },
      bottom: { style: 'SOLID', width: 1, color: hexToRgb(COLOR.border) },
      left: { style: 'SOLID', width: 1, color: hexToRgb(COLOR.border) },
      right: { style: 'SOLID', width: 1, color: hexToRgb(COLOR.border) },
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

function addColumnsRequest(sheetId, startIndex, endIndex) {
  return {
    appendDimension: {
      sheetId,
      dimension: 'COLUMNS',
      length: endIndex - startIndex,
    },
  };
}

function getUsedArea(rows) {
  let maxRow = 0;
  let maxCol = 0;

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
      const value = row[colIndex];
      if (value !== '') {
        maxRow = Math.max(maxRow, rowIndex + 1);
        maxCol = Math.max(maxCol, colIndex + 1);
      }
    }
  }

  return { maxRow, maxCol };
}

function findTextColumn(rows, matcher) {
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] ?? [];
    for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
      const value = row[colIndex];
      if (typeof value === 'string' && matcher(value)) {
        return colIndex;
      }
    }
  }
  return null;
}

function findRoleAnchor(rows) {
  return findTextColumn(rows, (value) => value === ROLE_TITLE);
}

function findMemoAnchor(rows) {
  return findTextColumn(rows, (value) => value.startsWith(MEMO_TITLE_PREFIX));
}

function buildRoleValues(lines) {
  return [[ROLE_TITLE], ...lines.map((line) => [line])];
}

function buildMemoValues(currentB16Value) {
  return [
    ['更新メモ（保険売上参照整理 / 2026-03-15）'],
    ['総保険売上単価の現行正本 = 保険・来院前提!B16'],
    ['月次総保険売上の試算元 = 保険・来院前提!B18'],
    ['数値前提への受け渡し先 = 数値前提!B21'],
    ['KPI目標の当月実績入力セル = KPI目標!D5'],
    ['旧 C17 は旧セル参照'],
    ['今後は B16 / B18 / B21 / D5 ベースで読む'],
    [[`現時点の整理値 = 保険・来院前提!B16 = ${currentB16Value || '未入力'}`]].flat(),
  ];
}

function sheetMap(metadata) {
  return new Map((metadata.sheets ?? []).map((sheet) => [sheet.properties.title, sheet.properties]));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const shouldWrite = args.write === 'true';
  const context = await getAuthorizedContext({
    ...args,
    'spreadsheet-id': args['spreadsheet-id'] || SPREADSHEET_ID,
  });

  const metadata = await getSpreadsheetMetadata({
    spreadsheetId: context.spreadsheetId,
    accessToken: context.accessToken,
  });
  const propsBySheet = sheetMap(metadata);

  const scanRanges = SHEETS.map((sheetName) => `${quoteSheetName(sheetName)}!${SCAN_RANGE}`);

  const [batch, insuranceB16] = await Promise.all([
    batchGetSheetValues({
      spreadsheetId: context.spreadsheetId,
      ranges: scanRanges,
      accessToken: context.accessToken,
      valueRenderOption: 'FORMATTED_VALUE',
    }),
    getSheetValues({
      spreadsheetId: context.spreadsheetId,
      sheetName: '保険・来院前提',
      range: 'B16:B16',
      accessToken: context.accessToken,
      valueRenderOption: 'FORMATTED_VALUE',
    }),
  ]);

  const valuesBySheet = new Map();
  const currentB16Value = insuranceB16.values?.[0]?.[0] ?? '';
  for (const valueRange of batch.valueRanges ?? []) {
    const { sheetName, cellRange } = normalizeRange(valueRange.range);
    if (cellRange === 'B16:B16') continue;
    valuesBySheet.set(sheetName, valueRange.values ?? []);
  }

  const layouts = SHEETS.map((sheetName) => {
    const rows = valuesBySheet.get(sheetName) ?? [];
    const props = propsBySheet.get(sheetName);
    if (!props) {
      throw new Error(`Sheet not found: ${sheetName}`);
    }

    const used = getUsedArea(rows);
    const existingRoleAnchor = findRoleAnchor(rows);
    const roleAnchorCol = existingRoleAnchor ?? Math.max(8, used.maxCol + 1);
    const existingMemoAnchor = sheetName === '保険・来院前提' ? findMemoAnchor(rows) : null;
    const memoAnchorCol = existingMemoAnchor ?? roleAnchorCol;

    return {
      sheetName,
      sheetId: props.sheetId,
      columnCount: props.gridProperties?.columnCount ?? 26,
      maxUsedCol: used.maxCol,
      roleAnchorCol,
      memoAnchorCol,
    };
  });

  const requests = [];
  const verificationRanges = [];

  for (const layout of layouts) {
    const neededCol = layout.sheetName === '保険・来院前提'
      ? Math.max(layout.roleAnchorCol, layout.memoAnchorCol)
      : layout.roleAnchorCol;
    if (neededCol >= layout.columnCount) {
      requests.push(addColumnsRequest(layout.sheetId, layout.columnCount, neededCol + 1));
    }

    requests.push(
      widthRequest(layout.sheetId, layout.roleAnchorCol, layout.sheetName === '保険・来院前提' ? 360 : 300),
      repeatFormatRequest(layout.sheetId, 1, 2, layout.roleAnchorCol, layout.roleAnchorCol + 1, {
        background: COLOR.title,
        bold: true,
        fontSize: 11,
      }),
      repeatFormatRequest(layout.sheetId, 2, 5, layout.roleAnchorCol, layout.roleAnchorCol + 1, {
        background: COLOR.body,
        fontSize: 10,
      }),
      borderRequest(layout.sheetId, 1, 5, layout.roleAnchorCol, layout.roleAnchorCol + 1),
    );

    const roleCol = columnToLetter(layout.roleAnchorCol);
    verificationRanges.push(`${quoteSheetName(layout.sheetName)}!${roleCol}2:${roleCol}5`);

    if (layout.sheetName === '保険・来院前提') {
      requests.push(
        widthRequest(layout.sheetId, layout.memoAnchorCol, 360),
        repeatFormatRequest(layout.sheetId, 7, 8, layout.memoAnchorCol, layout.memoAnchorCol + 1, {
          background: COLOR.memoTitle,
          bold: true,
          fontSize: 11,
        }),
        repeatFormatRequest(layout.sheetId, 8, 15, layout.memoAnchorCol, layout.memoAnchorCol + 1, {
          background: COLOR.memoBody,
          fontSize: 10,
        }),
        borderRequest(layout.sheetId, 7, 15, layout.memoAnchorCol, layout.memoAnchorCol + 1),
      );
      const memoCol = columnToLetter(layout.memoAnchorCol);
      verificationRanges.push(`${quoteSheetName(layout.sheetName)}!${memoCol}8:${memoCol}15`);
    }
  }

  if (shouldWrite) {
    if (requests.length > 0) {
      await batchUpdateSpreadsheet({
        spreadsheetId: context.spreadsheetId,
        accessToken: context.accessToken,
        requests,
      });
    }

    for (const layout of layouts) {
      const roleCol = columnToLetter(layout.roleAnchorCol);
      await updateSheetValues({
        spreadsheetId: context.spreadsheetId,
        sheetName: layout.sheetName,
        range: `${roleCol}2:${roleCol}5`,
        values: buildRoleValues(ROLE_TEXT.get(layout.sheetName) ?? []),
        accessToken: context.accessToken,
      });

      if (layout.sheetName === '保険・来院前提') {
        const memoCol = columnToLetter(layout.memoAnchorCol);
        await updateSheetValues({
          spreadsheetId: context.spreadsheetId,
          sheetName: layout.sheetName,
          range: `${memoCol}8:${memoCol}15`,
          values: buildMemoValues(currentB16Value),
          accessToken: context.accessToken,
        });
      }
    }
  }

  const verification = await batchGetSheetValues({
    spreadsheetId: context.spreadsheetId,
    ranges: verificationRanges,
    accessToken: context.accessToken,
    valueRenderOption: 'FORMATTED_VALUE',
  });

  console.log(JSON.stringify({
    spreadsheetId: context.spreadsheetId,
    mode: shouldWrite ? 'write' : 'dry-run',
    layouts: layouts.map((layout) => ({
      sheetName: layout.sheetName,
      maxUsedCol: layout.maxUsedCol ? columnToLetter(layout.maxUsedCol - 1) : null,
      roleAnchor: `${columnToLetter(layout.roleAnchorCol)}2:${columnToLetter(layout.roleAnchorCol)}5`,
      memoAnchor: layout.sheetName === '保険・来院前提'
        ? `${columnToLetter(layout.memoAnchorCol)}8:${columnToLetter(layout.memoAnchorCol)}15`
        : null,
    })),
    currentB16Value,
    verification: verification.valueRanges ?? [],
  }, null, 2));
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
