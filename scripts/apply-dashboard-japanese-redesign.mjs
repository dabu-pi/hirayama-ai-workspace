#!/usr/bin/env node

import {
  batchUpdateSpreadsheet,
  getAuthorizedContext,
  getSheetValues,
  getSpreadsheetMetadata,
  parseArgs,
  updateSheetValues,
} from './lib-sheets.mjs';
import {
  CANONICAL_PROJECTS,
  IDEA_STAGE_VALUES,
  PRIORITY_LABEL_VALUES,
  PROJECT_HEADERS_V2,
  PROJECT_STAGE_VALUES,
  PROJECT_STATUS_VALUES,
  TASK_STATUS_VALUES,
  githubBlobUrl,
  githubTreeUrl,
  sheetUrl,
} from './aios-dashboard-v2.mjs';

const BACKUP_SUFFIX = 'backup_20260313_jp';
const PROJECT_WRITE_WIDTH = 18;
const DASHBOARD_WIDTH = 14;
const PROJECT_WRITE_ROWS = 120;
const DASHBOARD_WRITE_ROWS = 200;
const DASHBOARD_VISIBLE_ROWS = 26;
const DASHBOARD_HIDDEN_START = 26;
const CANONICAL_PATTERN = CANONICAL_PROJECTS.map((project) => project.project_id).join('|');

const PRODUCTION_STATUS = PROJECT_STATUS_VALUES[0] ?? '';
const ACTIVE_STATUS = PROJECT_STATUS_VALUES[1] ?? '';
const PARKED_STATUS = PROJECT_STATUS_VALUES[2] ?? '';
const CONCEPT_STATUS = PROJECT_STATUS_VALUES[3] ?? '';
const PARKED_IDEA_STAGE = IDEA_STAGE_VALUES[8] ?? IDEA_STAGE_VALUES.at(-2) ?? '';
const DONE_TASK_STATUS = TASK_STATUS_VALUES.at(-1) ?? '';

function blankRow(width) {
  return Array.from({ length: width }, () => '');
}

function padRows(rows, width, totalRows) {
  const padded = rows.map((row) => {
    const next = [...row];
    while (next.length < width) {
      next.push('');
    }
    return next.slice(0, width);
  });

  while (padded.length < totalRows) {
    padded.push(blankRow(width));
  }

  return padded;
}

function isNonEmptyRow(row) {
  return row.some((cell) => String(cell || '').trim() !== '');
}

function toIsoDate(value) {
  if (!value) {
    return '';
  }
  return String(value).slice(0, 10);
}

function normalizeProjectStatus(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return CONCEPT_STATUS;
  }
  const map = new Map([
    ['Run', PRODUCTION_STATUS],
    ['Stable', PRODUCTION_STATUS],
    ['Production', PRODUCTION_STATUS],
    ['In Progress', ACTIVE_STATUS],
    ['Build', ACTIVE_STATUS],
    ['Implementation', ACTIVE_STATUS],
    ['Hold', PARKED_STATUS],
    ['Waiting', PARKED_STATUS],
    ['Parked', PARKED_STATUS],
    ['Concept', CONCEPT_STATUS],
    ['Idea', CONCEPT_STATUS],
  ]);
  return map.get(raw) ?? raw;
}

function normalizeProjectStage(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '';
  }
  const map = new Map([
    ['Concept', PROJECT_STAGE_VALUES[0] ?? raw],
    ['Design', PROJECT_STAGE_VALUES[1] ?? raw],
    ['SPEC', PROJECT_STAGE_VALUES[2] ?? raw],
    ['Build', PROJECT_STAGE_VALUES[3] ?? raw],
    ['Implementation', PROJECT_STAGE_VALUES[3] ?? raw],
    ['Prototype', PROJECT_STAGE_VALUES[4] ?? raw],
    ['Test', PROJECT_STAGE_VALUES[5] ?? raw],
    ['Run', PROJECT_STAGE_VALUES[6] ?? raw],
    ['Stable', PROJECT_STAGE_VALUES[6] ?? raw],
  ]);
  return map.get(raw) ?? raw;
}

function normalizeProjectPriority(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return PRIORITY_LABEL_VALUES[2] ?? '';
  }
  if (/^\d+$/.test(raw)) {
    const score = Number(raw);
    if (score <= 2) {
      return PRIORITY_LABEL_VALUES[0] ?? raw;
    }
    if (score <= 4) {
      return PRIORITY_LABEL_VALUES[1] ?? raw;
    }
    if (score <= 6) {
      return PRIORITY_LABEL_VALUES[2] ?? raw;
    }
    return PRIORITY_LABEL_VALUES[3] ?? raw;
  }
  const map = new Map([
    ['High', PRIORITY_LABEL_VALUES[1] ?? raw],
    ['Medium', PRIORITY_LABEL_VALUES[2] ?? raw],
    ['Low', PRIORITY_LABEL_VALUES[3] ?? raw],
  ]);
  return map.get(raw) ?? raw;
}

function parseProjectSeedRows(rows) {
  const header = rows[2] ?? [];
  if (header[0] !== 'project_id') {
    return [];
  }

  const isCurrentV2 = header.length >= 13 && header[7] !== undefined;
  const isLegacyV1 = header.includes('project_name');
  if (!isCurrentV2 && !isLegacyV1) {
    return [];
  }

  return rows.slice(3)
    .filter(isNonEmptyRow)
    .map((row) => {
      if (isLegacyV1) {
        return {
          project_id: String(row[0] || '').trim(),
          project_name: row[1] || '',
          status: normalizeProjectStatus(row[3]),
          stage: normalizeProjectStage(row[4]),
          priority: normalizeProjectPriority(row[5]),
          next_action: row[7] || '',
          last_updated: toIsoDate(row[6]),
          main_sheet_url: sheetUrl(row[12], row[11]),
          spec_url: '',
          folder_url: '',
          github_url: row[2] ? githubTreeUrl(row[2]) : '',
          local_path: row[10] || row[2] || '',
          notes: row[17] || row[9] || '',
        };
      }

      return {
        project_id: String(row[0] || '').trim(),
        project_name: row[1] || '',
        status: row[2] || '',
        stage: row[3] || '',
        priority: row[4] || '',
        next_action: row[5] || '',
        last_updated: row[6] || '',
        main_sheet_url: row[7] || '',
        spec_url: row[8] || '',
        folder_url: row[9] || '',
        github_url: row[10] || '',
        local_path: row[11] || '',
        notes: row[12] || '',
      };
    })
    .filter((row) => row.project_id);
}

function mergeProjectSeeds(...seedGroups) {
  const merged = new Map();
  for (const seedGroup of seedGroups) {
    for (const seed of seedGroup) {
      if (!seed?.project_id) {
        continue;
      }
      const previous = merged.get(seed.project_id) ?? {};
      merged.set(seed.project_id, {
        ...previous,
        ...seed,
        project_id: seed.project_id,
        project_name: seed.project_name || previous.project_name || '',
        status: seed.status || previous.status || '',
        stage: seed.stage || previous.stage || '',
        priority: seed.priority || previous.priority || '',
        next_action: seed.next_action || previous.next_action || '',
        last_updated: seed.last_updated || previous.last_updated || '',
        main_sheet_url: seed.main_sheet_url || previous.main_sheet_url || '',
        spec_url: seed.spec_url || previous.spec_url || '',
        folder_url: seed.folder_url || previous.folder_url || '',
        github_url: seed.github_url || previous.github_url || '',
        local_path: seed.local_path || previous.local_path || '',
        notes: seed.notes || previous.notes || '',
      });
    }
  }
  return merged;
}

function buildProjectsRows(seedMap) {
  const rows = [
    ['平山 AI OS - 案件マスター'],
    ['案件名・リンクの正本。canonical 4案件だけでなく、管理対象は Projects に残す。'],
    PROJECT_HEADERS_V2,
  ];

  const canonicalIds = new Set(CANONICAL_PROJECTS.map((project) => project.project_id));

  for (const project of CANONICAL_PROJECTS) {
    const seed = seedMap.get(project.project_id) ?? {};
    rows.push([
      project.project_id,
      project.project_name,
      seed.status || project.status,
      seed.stage || project.stage,
      seed.priority || project.priority,
      seed.next_action || '',
      seed.last_updated || '',
      sheetUrl(seed.main_sheet_url || project.main_sheet_url || project.main_sheet_id, project.main_sheet_name),
      seed.spec_url || githubBlobUrl(project.spec_path),
      seed.folder_url || project.folder_url || '',
      seed.github_url || githubTreeUrl(project.directory),
      seed.local_path || `workspace/${project.directory}`,
      seed.notes || project.notes,
    ]);
  }

  const extraRows = [...seedMap.values()]
    .filter((project) => !canonicalIds.has(project.project_id))
    .sort((left, right) => left.project_id.localeCompare(right.project_id, 'en'));

  for (const project of extraRows) {
    rows.push([
      project.project_id,
      project.project_name,
      project.status,
      project.stage,
      project.priority,
      project.next_action,
      project.last_updated,
      project.main_sheet_url,
      project.spec_url,
      project.folder_url,
      project.github_url,
      project.local_path,
      project.notes,
    ]);
  }

  return rows;
}

function projectIdFormula(rowNumber) {
  const index = rowNumber - 10;
  return `=IFERROR(INDEX(FILTER(Projects!$A$4:$A$200,Projects!$A$4:$A$200<>""),${index}),"")`;
}

function projectLookupFormula(rowNumber, columnIndex) {
  return `=IF($H${rowNumber}="","",IFNA(VLOOKUP($H${rowNumber},Projects!$A$4:$L$200,${columnIndex},FALSE),""))`;
}

function projectLinkFormula(rowNumber, columnIndex, label) {
  return `=IF($H${rowNumber}="","",IFNA(IF(VLOOKUP($H${rowNumber},Projects!$A$4:$I$200,${columnIndex},FALSE)="","未設定",HYPERLINK(VLOOKUP($H${rowNumber},Projects!$A$4:$I$200,${columnIndex},FALSE),"${label}")),"未設定"))`;
}

function buildDashboardRows({ spreadsheetId, projectsSheetId }) {
  const projectsUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${projectsSheetId}`;
  const rows = [
    ['平山 AI OS ダッシュボード'],
    ['', '', '', '', '', '', '', '', '', '', '', '=HYPERLINK("' + projectsUrl + '","Projects を開く")', '', ''],
    ['表示専用。案件名・リンクは Projects 正本を参照し、今日の優先順位は 優先度調整 を反映する。'],
    [''],
    ['総案件数', '', '本番運用中', '', '進行中', '', '未完了タスク', '', '保留アイデア数', ''],
    [
      '=COUNTA(Projects!A4:A200)',
      '',
      `=COUNTIF(Projects!C4:C200,"${PRODUCTION_STATUS}")`,
      '',
      `=COUNTIF(Projects!C4:C200,"${ACTIVE_STATUS}")`,
      '',
      `=COUNTIFS(Task_Queue!A4:A200,"<>",Task_Queue!J4:J200,"<>${DONE_TASK_STATUS}")`,
      '',
      `=COUNTIF(Ideas!E4:E200,"${PARKED_IDEA_STAGE}")`,
      '',
    ],
    [''],
    [''],
    ['今日の優先タスク', '', '', '', '', '', '', '案件の現況', '', '', '', '', '', ''],
    ['タスク', '案件', '状態', '最終優先度', '期限', '', '', 'project_id', '案件', '状態', '段階', '次アクション', '開く', 'SPEC'],
    ['=IFERROR(ARRAY_CONSTRAIN(SORT(FILTER({Task_Queue!B4:B,Task_Queue!D4:D,Task_Queue!J4:J,Task_Queue!I4:I,Task_Queue!L4:L},Task_Queue!A4:A<>"",Task_Queue!J4:J<>"' + DONE_TASK_STATUS + '"),4,FALSE,5,TRUE),5,5),"")', '', '', '', '', '', '', projectIdFormula(11), projectLookupFormula(11, 2), projectLookupFormula(11, 3), projectLookupFormula(11, 4), projectLookupFormula(11, 6), projectLinkFormula(11, 8, '開く'), projectLinkFormula(11, 9, 'SPEC')],
  ];

  for (let rowNumber = 12; rowNumber <= 20; rowNumber += 1) {
    rows.push(['', '', '', '', '', '', '', projectIdFormula(rowNumber), projectLookupFormula(rowNumber, 2), projectLookupFormula(rowNumber, 3), projectLookupFormula(rowNumber, 4), projectLookupFormula(rowNumber, 6), projectLinkFormula(rowNumber, 8, '開く'), projectLinkFormula(rowNumber, 9, 'SPEC')]);
  }

  rows.push(['最近の更新', '', '', '', '', '', '', '', '', '', '', '', '', '']);
  rows.push(['日時', '案件', '実行元', '内容', '結果', '次アクション', '', '', '', '', '', '', '', '']);
  rows.push([`=IFERROR(ARRAY_CONSTRAIN(QUERY(FILTER({Run_Log!B4:B,Run_Log!D4:D,Run_Log!C4:C,Run_Log!E4:E,Run_Log!F4:F,Run_Log!J4:J},Run_Log!B4:B<>"",REGEXMATCH(Run_Log!D4:D,"^(${CANONICAL_PATTERN})$")),"select Col1,Col2,Col3,Col4,Col5,Col6 order by Col1 desc",0),6,6),"")`, '', '', '', '', '', '', '', '', '', '', '', '', '']);

  while (rows.length < DASHBOARD_VISIBLE_ROWS) {
    rows.push(blankRow(DASHBOARD_WIDTH));
  }

  return rows;
}

function rgb(r, g, b) {
  return { red: r / 255, green: g / 255, blue: b / 255 };
}

function cellRange(sheetId, startRowIndex, endRowIndex, startColumnIndex, endColumnIndex) {
  return { sheetId, startRowIndex, endRowIndex, startColumnIndex, endColumnIndex };
}

function mergeRequests(sheetId) {
  const ranges = [
    cellRange(sheetId, 0, 1, 0, 14),
    cellRange(sheetId, 2, 3, 0, 14),
    cellRange(sheetId, 4, 5, 0, 2),
    cellRange(sheetId, 5, 6, 0, 2),
    cellRange(sheetId, 4, 5, 2, 4),
    cellRange(sheetId, 5, 6, 2, 4),
    cellRange(sheetId, 4, 5, 4, 6),
    cellRange(sheetId, 5, 6, 4, 6),
    cellRange(sheetId, 4, 5, 6, 8),
    cellRange(sheetId, 5, 6, 6, 8),
    cellRange(sheetId, 4, 5, 8, 10),
    cellRange(sheetId, 5, 6, 8, 10),
    cellRange(sheetId, 8, 9, 0, 5),
    cellRange(sheetId, 8, 9, 7, 14),
    cellRange(sheetId, 20, 21, 0, 6),
  ];
  return ranges.map((range) => ({
    mergeCells: {
      range,
      mergeType: 'MERGE_ALL',
    },
  }));
}

function dimensionRequests(sheetId) {
  const columnWidths = [180, 140, 98, 110, 108, 20, 20, 108, 220, 96, 108, 220, 80, 80];
  const rowHeights = [
    [0, 1, 42],
    [1, 2, 28],
    [2, 3, 46],
    [4, 5, 30],
    [5, 6, 42],
    [8, 9, 32],
    [9, 10, 34],
    [10, 20, 36],
    [20, 21, 32],
    [21, 22, 34],
    [22, 26, 42],
  ];

  const requests = columnWidths.map((pixelSize, index) => ({
    updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex: index, endIndex: index + 1 },
      properties: { pixelSize },
      fields: 'pixelSize',
    },
  }));

  for (const [startIndex, endIndex, pixelSize] of rowHeights) {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: 'ROWS', startIndex, endIndex },
        properties: { pixelSize, hiddenByUser: false },
        fields: 'pixelSize,hiddenByUser',
      },
    });
  }

  requests.push({
    updateDimensionProperties: {
      range: { sheetId, dimension: 'ROWS', startIndex: DASHBOARD_HIDDEN_START, endIndex: DASHBOARD_WRITE_ROWS },
      properties: { hiddenByUser: true },
      fields: 'hiddenByUser',
    },
  });

  return requests;
}

function repeatCell(range, userEnteredFormat, fields) {
  return {
    repeatCell: {
      range,
      cell: { userEnteredFormat },
      fields,
    },
  };
}

function borderStyle(color) {
  return { style: 'SOLID', color };
}

function formatRequests(sheetId) {
  const text = rgb(55, 65, 81);
  const white = rgb(255, 255, 255);
  const titleBlue = rgb(219, 234, 254);
  const panelBlue = rgb(239, 246, 255);
  const headerBlue = rgb(241, 245, 249);
  const paleGreen = rgb(220, 252, 231);
  const paleBlue = rgb(219, 234, 254);
  const paleYellow = rgb(254, 249, 195);
  const palePurple = rgb(243, 232, 255);
  const border = borderStyle(rgb(203, 213, 225));

  const requests = [
    repeatCell(
      cellRange(sheetId, 0, DASHBOARD_VISIBLE_ROWS, 0, 14),
      {
        backgroundColor: white,
        horizontalAlignment: 'LEFT',
        verticalAlignment: 'MIDDLE',
        wrapStrategy: 'WRAP',
        textFormat: {
          fontFamily: 'Noto Sans JP',
          fontSize: 10,
          foregroundColor: text,
        },
      },
      'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,wrapStrategy,textFormat)',
    ),
    repeatCell(
      cellRange(sheetId, 0, 1, 0, 14),
      {
        backgroundColor: titleBlue,
        horizontalAlignment: 'CENTER',
        verticalAlignment: 'MIDDLE',
        textFormat: {
          fontFamily: 'Noto Sans JP',
          fontSize: 16,
          bold: true,
          foregroundColor: text,
        },
      },
      'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)',
    ),
    repeatCell(
      cellRange(sheetId, 1, 2, 11, 14),
      {
        backgroundColor: white,
        horizontalAlignment: 'CENTER',
        verticalAlignment: 'MIDDLE',
        textFormat: {
          fontFamily: 'Noto Sans JP',
          fontSize: 10,
          bold: true,
          foregroundColor: text,
        },
      },
      'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)',
    ),
    repeatCell(
      cellRange(sheetId, 2, 3, 0, 14),
      {
        backgroundColor: panelBlue,
        horizontalAlignment: 'LEFT',
        verticalAlignment: 'MIDDLE',
        wrapStrategy: 'WRAP',
        textFormat: {
          fontFamily: 'Noto Sans JP',
          fontSize: 10,
          foregroundColor: text,
        },
      },
      'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,wrapStrategy,textFormat)',
    ),
    repeatCell(
      cellRange(sheetId, 4, 5, 0, 2),
      {
        backgroundColor: headerBlue,
        horizontalAlignment: 'CENTER',
        verticalAlignment: 'MIDDLE',
        textFormat: {
          fontFamily: 'Noto Sans JP',
          fontSize: 10,
          bold: true,
          foregroundColor: text,
        },
      },
      'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)',
    ),
    repeatCell(cellRange(sheetId, 4, 5, 2, 4), { backgroundColor: paleGreen, horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE', textFormat: { fontFamily: 'Noto Sans JP', fontSize: 10, bold: true, foregroundColor: text } }, 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)'),
    repeatCell(cellRange(sheetId, 4, 5, 4, 6), { backgroundColor: paleBlue, horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE', textFormat: { fontFamily: 'Noto Sans JP', fontSize: 10, bold: true, foregroundColor: text } }, 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)'),
    repeatCell(cellRange(sheetId, 4, 5, 6, 8), { backgroundColor: headerBlue, horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE', textFormat: { fontFamily: 'Noto Sans JP', fontSize: 10, bold: true, foregroundColor: text } }, 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)'),
    repeatCell(cellRange(sheetId, 4, 5, 8, 10), { backgroundColor: palePurple, horizontalAlignment: 'CENTER', verticalAlignment: 'MIDDLE', textFormat: { fontFamily: 'Noto Sans JP', fontSize: 10, bold: true, foregroundColor: text } }, 'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)'),
    repeatCell(
      cellRange(sheetId, 5, 6, 0, 10),
      {
        backgroundColor: white,
        horizontalAlignment: 'CENTER',
        verticalAlignment: 'MIDDLE',
        textFormat: {
          fontFamily: 'Noto Sans JP',
          fontSize: 16,
          bold: true,
          foregroundColor: text,
        },
      },
      'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)',
    ),
    repeatCell(
      cellRange(sheetId, 8, 9, 0, 14),
      {
        backgroundColor: panelBlue,
        horizontalAlignment: 'CENTER',
        verticalAlignment: 'MIDDLE',
        textFormat: {
          fontFamily: 'Noto Sans JP',
          fontSize: 11,
          bold: true,
          foregroundColor: text,
        },
      },
      'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)',
    ),
    repeatCell(
      cellRange(sheetId, 9, 10, 0, 14),
      {
        backgroundColor: headerBlue,
        horizontalAlignment: 'CENTER',
        verticalAlignment: 'MIDDLE',
        wrapStrategy: 'WRAP',
        textFormat: {
          fontFamily: 'Noto Sans JP',
          fontSize: 10,
          bold: true,
          foregroundColor: text,
        },
      },
      'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,wrapStrategy,textFormat)',
    ),
    repeatCell(
      cellRange(sheetId, 10, 20, 0, 14),
      {
        backgroundColor: white,
        verticalAlignment: 'MIDDLE',
        wrapStrategy: 'WRAP',
        textFormat: {
          fontFamily: 'Noto Sans JP',
          fontSize: 10,
          foregroundColor: text,
        },
      },
      'userEnteredFormat(backgroundColor,verticalAlignment,wrapStrategy,textFormat)',
    ),
    repeatCell(cellRange(sheetId, 10, 20, 3, 5), { horizontalAlignment: 'CENTER' }, 'userEnteredFormat.horizontalAlignment'),
    repeatCell(cellRange(sheetId, 10, 20, 7, 8), { horizontalAlignment: 'CENTER' }, 'userEnteredFormat.horizontalAlignment'),
    repeatCell(cellRange(sheetId, 10, 20, 9, 11), { horizontalAlignment: 'CENTER' }, 'userEnteredFormat.horizontalAlignment'),
    repeatCell(cellRange(sheetId, 10, 20, 12, 14), { horizontalAlignment: 'CENTER' }, 'userEnteredFormat.horizontalAlignment'),
    repeatCell(
      cellRange(sheetId, 20, 21, 0, 6),
      {
        backgroundColor: panelBlue,
        horizontalAlignment: 'CENTER',
        verticalAlignment: 'MIDDLE',
        textFormat: {
          fontFamily: 'Noto Sans JP',
          fontSize: 11,
          bold: true,
          foregroundColor: text,
        },
      },
      'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,textFormat)',
    ),
    repeatCell(
      cellRange(sheetId, 21, 22, 0, 6),
      {
        backgroundColor: headerBlue,
        horizontalAlignment: 'CENTER',
        verticalAlignment: 'MIDDLE',
        wrapStrategy: 'WRAP',
        textFormat: {
          fontFamily: 'Noto Sans JP',
          fontSize: 10,
          bold: true,
          foregroundColor: text,
        },
      },
      'userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,wrapStrategy,textFormat)',
    ),
    repeatCell(
      cellRange(sheetId, 22, 26, 0, 6),
      {
        backgroundColor: white,
        verticalAlignment: 'MIDDLE',
        wrapStrategy: 'WRAP',
        textFormat: {
          fontFamily: 'Noto Sans JP',
          fontSize: 10,
          foregroundColor: text,
        },
      },
      'userEnteredFormat(backgroundColor,verticalAlignment,wrapStrategy,textFormat)',
    ),
    {
      updateBorders: {
        range: cellRange(sheetId, 4, 6, 0, 10),
        top: border,
        bottom: border,
        left: border,
        right: border,
        innerHorizontal: border,
        innerVertical: border,
      },
    },
    {
      updateBorders: {
        range: cellRange(sheetId, 9, 20, 0, 5),
        top: border,
        bottom: border,
        left: border,
        right: border,
        innerHorizontal: border,
        innerVertical: border,
      },
    },
    {
      updateBorders: {
        range: cellRange(sheetId, 9, 20, 7, 14),
        top: border,
        bottom: border,
        left: border,
        right: border,
        innerHorizontal: border,
        innerVertical: border,
      },
    },
    {
      updateBorders: {
        range: cellRange(sheetId, 21, 26, 0, 6),
        top: border,
        bottom: border,
        left: border,
        right: border,
        innerHorizontal: border,
        innerVertical: border,
      },
    },
  ];

  const statusRules = [
    { text: PRODUCTION_STATUS, color: paleGreen },
    { text: ACTIVE_STATUS, color: paleBlue },
    { text: PARKED_STATUS, color: paleYellow },
    { text: CONCEPT_STATUS, color: palePurple },
  ].filter((rule) => rule.text);

  for (const rule of statusRules) {
    requests.push({
      addConditionalFormatRule: {
        index: 0,
        rule: {
          ranges: [cellRange(sheetId, 10, 20, 9, 10)],
          booleanRule: {
            condition: {
              type: 'TEXT_EQ',
              values: [{ userEnteredValue: rule.text }],
            },
            format: {
              backgroundColor: rule.color,
              textFormat: {
                bold: true,
                foregroundColor: text,
              },
            },
          },
        },
      },
    });
  }

  return requests;
}

async function fetchDashboardDecorations({ spreadsheetId, accessToken, dashboardSheetId }) {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets(properties(sheetId,title),charts(chartId),conditionalFormats)&includeGridData=false`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    return { charts: [], conditionalFormatCount: 0 };
  }

  const metadata = await response.json();
  const dashboard = (metadata.sheets || []).find((sheet) => sheet.properties?.sheetId === dashboardSheetId);
  return {
    charts: (dashboard?.charts || []).map((chart) => chart.chartId).filter((chartId) => chartId !== undefined),
    conditionalFormatCount: (dashboard?.conditionalFormats || []).length || 0,
  };
}

function cleanupRequests(sheetId, chartIds, conditionalFormatCount) {
  const requests = [];

  requests.push({
    unmergeCells: {
      range: cellRange(sheetId, 0, DASHBOARD_WRITE_ROWS, 0, 14),
    },
  });

  for (const chartId of chartIds) {
    requests.push({
      deleteEmbeddedObject: {
        objectId: chartId,
      },
    });
  }

  for (let index = conditionalFormatCount - 1; index >= 0; index -= 1) {
    requests.push({
      deleteConditionalFormatRule: {
        sheetId,
        index,
      },
    });
  }

  requests.push(
    {
      repeatCell: {
        range: cellRange(sheetId, 5, 6, 0, 10),
        cell: {
          userEnteredFormat: {
            numberFormat: {
              type: 'NUMBER',
              pattern: '0',
            },
          },
        },
        fields: 'userEnteredFormat.numberFormat',
      },
    },
    {
      repeatCell: {
        range: cellRange(sheetId, 10, 20, 4, 5),
        cell: {
          userEnteredFormat: {
            numberFormat: {
              type: 'DATE',
              pattern: 'yyyy-mm-dd',
            },
          },
        },
        fields: 'userEnteredFormat.numberFormat',
      },
    },
    {
      repeatCell: {
        range: cellRange(sheetId, 22, 26, 0, 1),
        cell: {
          userEnteredFormat: {
            numberFormat: {
              type: 'DATE_TIME',
              pattern: 'yyyy-mm-dd hh:mm:ss',
            },
          },
        },
        fields: 'userEnteredFormat.numberFormat',
      },
    },
  );

  return requests;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const context = await getAuthorizedContext(args);
  const isWrite = args.write === 'true';

  const metadata = await getSpreadsheetMetadata(context);
  const dashboardSheet = (metadata.sheets || []).find((sheet) => sheet.properties?.title === 'Dashboard');
  const projectsSheet = (metadata.sheets || []).find((sheet) => sheet.properties?.title === 'Projects');

  if (!dashboardSheet?.properties?.sheetId || !projectsSheet?.properties?.sheetId) {
    throw new Error('Dashboard or Projects sheet was not found.');
  }

  const [projectsData, projectsBackupData] = await Promise.all([
    getSheetValues({ spreadsheetId: context.spreadsheetId, sheetName: 'Projects', range: '1:300', accessToken: context.accessToken }),
    getSheetValues({ spreadsheetId: context.spreadsheetId, sheetName: `Projects_${BACKUP_SUFFIX}`, range: '1:300', accessToken: context.accessToken }).catch(() => ({ values: [] })),
  ]);

  const currentSeeds = parseProjectSeedRows(projectsData.values ?? []);
  const backupSeeds = parseProjectSeedRows(projectsBackupData.values ?? []);
  const seedMap = mergeProjectSeeds(backupSeeds, currentSeeds);
  const projectRows = buildProjectsRows(seedMap);
  const dashboardRows = buildDashboardRows({
    spreadsheetId: context.spreadsheetId,
    projectsSheetId: projectsSheet.properties.sheetId,
  });

  console.log('[INFO] Current Projects rows:', currentSeeds.length);
  console.log('[INFO] Backup Projects rows :', backupSeeds.length);
  console.log('[INFO] Final Projects rows  :', Math.max(projectRows.length - 3, 0));

  if (!isWrite) {
    console.log('[INFO] Dry run mode. Pass --write true to apply the dashboard polish.');
    return;
  }

  await Promise.all([
    updateSheetValues({
      spreadsheetId: context.spreadsheetId,
      sheetName: 'Projects',
      range: 'A1:R120',
      values: padRows(projectRows.map((row) => [...row, '', '', '', '', '']), PROJECT_WRITE_WIDTH, PROJECT_WRITE_ROWS),
      accessToken: context.accessToken,
    }),
    updateSheetValues({
      spreadsheetId: context.spreadsheetId,
      sheetName: 'Dashboard',
      range: 'A1:N200',
      values: padRows([
        ...dashboardRows,
        ...Array.from({ length: DASHBOARD_WRITE_ROWS - dashboardRows.length }, () => blankRow(DASHBOARD_WIDTH)),
      ], DASHBOARD_WIDTH, DASHBOARD_WRITE_ROWS),
      accessToken: context.accessToken,
    }),
  ]);

  const decorations = await fetchDashboardDecorations({
    spreadsheetId: context.spreadsheetId,
    accessToken: context.accessToken,
    dashboardSheetId: dashboardSheet.properties.sheetId,
  });

  await batchUpdateSpreadsheet({
    spreadsheetId: context.spreadsheetId,
    accessToken: context.accessToken,
    requests: [
      ...cleanupRequests(dashboardSheet.properties.sheetId, decorations.charts, decorations.conditionalFormatCount),
      ...dimensionRequests(dashboardSheet.properties.sheetId),
      ...mergeRequests(dashboardSheet.properties.sheetId),
      ...formatRequests(dashboardSheet.properties.sheetId),
    ],
  });

  console.log('[OK] Dashboard links, layout, palette, and Projects registry have been updated.');
}

main().catch((error) => {
  console.error(`[ERR] ${error.message}`);
  process.exit(1);
});
