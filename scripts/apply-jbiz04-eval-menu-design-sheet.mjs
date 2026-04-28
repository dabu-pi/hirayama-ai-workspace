#!/usr/bin/env node
/**
 * JBIZ-04: 「初回評価設計」シートを live スプレッドシートに新規作成
 *
 * 目的: 初回評価3メニューの内容を現場導線シートとして見える化する
 *       （価格表ではなく現場で使う設計表）
 *
 * 構成:
 *   上段 (Row 1-10)  : 共通設定（時間・価格・位置づけ・提供条件）
 *   中段 (Row 12-25) : 3メニュー比較表（腰痛 / 首肩こり / 膝）
 *   右側 (F-G列)     : 次提案の判定ルール表
 *   下段 (Row 27-31) : 20分版フロー表
 *   最下段 (Row 33-37): 対象外・注意欄
 *
 * Usage:
 *   node scripts/apply-jbiz04-eval-menu-design-sheet.mjs           # dry-run
 *   node scripts/apply-jbiz04-eval-menu-design-sheet.mjs --write   # live 反映
 */

import {
  batchUpdateSpreadsheet,
  getAuthorizedContext,
  getSpreadsheetMetadata,
  updateSheetValues,
} from './lib-sheets.mjs';

const LIVE_SHEET_ID = '1FnJdALwFSv48WiD6NWr0DzG78kwB692R2pFeiTcZlCc';
const SHEET_NAME    = '初回評価設計';

// ──────────────────────────────────────────────
// シート内容定義（A〜G列: 7列）
// 列割当: A=項目/パート, B=腰痛/内容, C=首肩こり/時間, D=膝/担当, E=区切り, F=判定状態, G=提案先
// ──────────────────────────────────────────────
const SHEET_ROWS = [
  /* 0  Row 1  */ ['初回評価設計 — 症状別 運動療法 初回評価（ブロック3）', '', '', '', '', '', ''],
  /* 1  Row 2  */ ['最終更新: 2026-03-23 / JBIZ-04', '', '', '', '', '', ''],
  /* 2  Row 3  */ ['', '', '', '', '', '', ''],

  // ── 共通設定 ──
  /* 3  Row 4  */ ['▼ 共通設定', '', '', '', '', '', ''],
  /* 4  Row 5  */ ['項目', '内容', '備考', '', '', '', ''],
  /* 5  Row 6  */ ['提供条件', '初回限定', '', '', '', '', ''],
  /* 6  Row 7  */ ['時間', '約30分', '', '', '', '', ''],
  /* 7  Row 8  */ ['通常価格', '3,300円', '', '', '', '', ''],
  /* 8  Row 9  */ ['ジム会員価格', '2,800円（仮）', '月会員コース設計確定後に正式確定（未確定項目 No.10）', '', '', '', ''],
  /* 9  Row 10 */ ['位置づけ', '導線商品 — 売上より次ステップへの誘導が目的', '次提案先: 慢性ケア手技50分 / 4回集中コース / ジム体験', '', '', '', ''],

  /* 10 Row 11 */ ['', '', '', '', '', '', ''],

  // ── 3メニュー比較表 + 次提案判定ルール ──
  /* 11 Row 12 */ ['▼ 3メニュー比較表', '', '', '', '', '▼ 次提案の判定ルール', ''],
  /* 12 Row 13 */ ['項目', '腰痛改善', '首肩こり改善', '膝改善', '', '状態', '提案先'],
  /* 13 Row 14 */ ['menu_id', 'SELF_EVAL_LOWBACK30', 'SELF_EVAL_NECKSHOULDER30', 'SELF_EVAL_KNEE30', '', '痛みや筋緊張が強い', '慢性ケア手技50分'],
  /* 14 Row 15 */ ['メニュー名', '腰痛改善 運動療法 初回評価', '首肩こり改善 運動療法 初回評価', '膝改善 運動療法 初回評価', '', '動きの癖が強く短期改善したい', '4回集中コース'],
  /* 15 Row 16 */ ['主訴', '慢性腰痛、繰り返す腰痛', '慢性的な首こり肩こり、デスクワーク負担', '階段や立ち上がりで膝が気になる', '', '自分で続けられそう', 'ジム体験'],
  /* 16 Row 17 */ ['主対象', '保険適用外、保険終了後も不安が残る人', '保険適用外、保険終了後も再発不安がある人', '保険適用外、保険終了後も不安がある人', '', 'ジム会員でフォーム再教育が必要', 'パーソナルトレーニング'],
  /* 17 Row 18 */ ['提案タイミング', '慢性化説明後 / 保険終了前後', '慢性化説明後 / 保険終了前後', '慢性化説明後 / 保険終了前後', '', '', ''],
  /* 18 Row 19 */ ['評価ポイント', '姿勢・股関節・体幹の使い方', '姿勢・胸椎・肩甲骨の動き', '立ち方・股関節・足部の使い方', '', '', ''],
  /* 19 Row 20 */ ['体験種目①', 'ヒップヒンジ（自重）✅採用確定', 'チンタック（壁版）✅採用確定', '⚠️ 仮（未試行）', '', '', ''],
  /* 20 Row 21 */ ['体験種目②', 'デッドバグ低負荷版（マット）✅採用', '肩甲骨リトラクション（壁版）✅採用確定', '⚠️ 仮（未試行）', '', '', ''],
  /* 21 Row 22 */ ['次提案先①', '慢性ケア手技50分', '慢性ケア手技50分', '慢性ケア手技50分', '', '', ''],
  /* 22 Row 23 */ ['次提案先②', '4回集中コース', '4回集中コース', '4回集中コース', '', '', ''],
  /* 23 Row 24 */ ['次提案先③', 'ジム体験', 'ジム体験', 'ジム体験', '', '', ''],
  /* 24 Row 25 */ ['確定状況', '仮（種目採用確定）', '仮（種目採用確定）', '仮（体験種目未確定）', '', '', ''],

  /* 25 Row 26 */ ['', '', '', '', '', '', ''],

  // ── 20分版フロー ──
  /* 26 Row 27 */ ['▼ 20分版フロー（基本パターン）', '', '', '', '', '', ''],
  /* 27 Row 28 */ ['パート', '時間', '内容', '担当', '', '', ''],
  /* 28 Row 29 */ ['導入・説明', '3分', '今日の施術と再発予防の関係を1〜2文で説明。本日体験する運動の目的を共有', '施術者', '', '', ''],
  /* 29 Row 30 */ ['運動体験', '14分', '症状別 基本2種目を各5〜7分で体験', '施術者 or ジムスタッフ', '', '', ''],
  /* 30 Row 31 */ ['まとめ・次提案', '3分', '「続けられそうですか？」と確認。希望があればジム案内（押し付けない）', '施術者', '', '', ''],

  /* 31 Row 32 */ ['', '', '', '', '', '', ''],

  // ── 対象外・注意 ──
  /* 32 Row 33 */ ['▼ 対象外・注意', '', '', '', '', '', ''],
  /* 33 Row 34 */ ['区分', '条件・内容', '対応', '', '', '', ''],
  /* 34 Row 35 */ ['対象外', '強い炎症・夜間痛・しびれ増悪・荷重困難のいずれかがある場合', '本メニュー対象外。医療受診を優先する', '', '', '', ''],
  /* 35 Row 36 */ ['注意', '初回限定メニューのため2回目以降は不可', '2回目以降は慢性ケア手技50分 or 4回集中コースへ移行', '', '', '', ''],
  /* 36 Row 37 */ ['注意（価格）', 'ジム会員価格2,800円は仮置き', '月会員コース設計確定後に正式更新が必要（未確定項目 No.10）', '', '', '', ''],
];

// ──────────────────────────────────────────────
// ユーティリティ
// ──────────────────────────────────────────────
function findSheetId(metadata, name) {
  const sheet = metadata.sheets?.find((s) => s.properties?.title === name);
  return sheet?.properties?.sheetId ?? null;
}

function colorRgb(r, g, b) {
  return { red: r / 255, green: g / 255, blue: b / 255 };
}

function gridRange(sheetId, startRow, endRow, startCol, endCol) {
  return { sheetId, startRowIndex: startRow, endRowIndex: endRow, startColumnIndex: startCol, endColumnIndex: endCol };
}

/** 行範囲に背景色 + textFormat を適用（フルリセット） */
function rowFormat(sheetId, startRow, endRow, startCol, endCol, format) {
  return {
    repeatCell: {
      range: gridRange(sheetId, startRow, endRow, startCol, endCol),
      cell: { userEnteredFormat: format },
      fields: 'userEnteredFormat(backgroundColor,textFormat)',
    },
  };
}

/** 背景色のみ適用（textFormat を維持） */
function bgOnly(sheetId, startRow, endRow, startCol, endCol, bgColor) {
  return {
    repeatCell: {
      range: gridRange(sheetId, startRow, endRow, startCol, endCol),
      cell: { userEnteredFormat: { backgroundColor: bgColor } },
      fields: 'userEnteredFormat(backgroundColor)',
    },
  };
}

/** テキスト折り返し設定（WRAP） */
function wrapAll(sheetId, rowCount) {
  return {
    repeatCell: {
      range: gridRange(sheetId, 0, rowCount, 0, 7),
      cell: { userEnteredFormat: { wrapStrategy: 'WRAP' } },
      fields: 'userEnteredFormat(wrapStrategy)',
    },
  };
}

/** 列幅設定リクエスト */
function colWidth(sheetId, startIndex, endIndex, pixelSize) {
  return {
    updateDimensionProperties: {
      range: { sheetId, dimension: 'COLUMNS', startIndex, endIndex },
      properties: { pixelSize },
      fields: 'pixelSize',
    },
  };
}

// ──────────────────────────────────────────────
// main
// ──────────────────────────────────────────────
async function main() {
  const isDryRun = !process.argv.includes('--write');
  const ctx = await getAuthorizedContext();

  console.log(`[INFO] Mode: ${isDryRun ? 'DRY-RUN (pass --write to apply)' : 'WRITE'}`);
  console.log(`[INFO] Target: ${LIVE_SHEET_ID}`);
  console.log(`[INFO] Sheet: ${SHEET_NAME}`);

  const metadata = await getSpreadsheetMetadata({
    spreadsheetId: LIVE_SHEET_ID,
    accessToken: ctx.accessToken,
  });

  let sheetId = findSheetId(metadata, SHEET_NAME);
  const sheetExists = sheetId !== null;
  console.log(`[INFO] Sheet exists: ${sheetExists}${sheetExists ? ` (sheetId=${sheetId})` : ''}`);

  if (isDryRun) {
    console.log('\n[DRY-RUN] 書き込み内容プレビュー:');
    SHEET_ROWS.forEach((row, i) => {
      if (row.some(Boolean)) {
        console.log(`  Row ${i + 1}: ${row.filter(Boolean).join(' | ')}`);
      }
    });
    console.log(`\n[DRY-RUN] 合計 ${SHEET_ROWS.length}行 / 7列。No changes applied. Pass --write to execute.`);
    return;
  }

  // ── Step 1: シートが無ければ追加 ──
  if (!sheetExists) {
    console.log(`\n[INFO] Adding sheet: ${SHEET_NAME}`);
    const addResp = await batchUpdateSpreadsheet({
      spreadsheetId: LIVE_SHEET_ID,
      accessToken: ctx.accessToken,
      requests: [{
        addSheet: {
          properties: {
            title: SHEET_NAME,
            gridProperties: { rowCount: 50, columnCount: 7 },
          },
        },
      }],
    });
    sheetId = addResp.replies?.[0]?.addSheet?.properties?.sheetId;
    console.log(`  [OK] Sheet added (sheetId=${sheetId})`);
  } else {
    console.log(`\n[INFO] Sheet already exists. Overwriting content.`);
  }

  // ── Step 2: 内容を書き込む ──
  console.log(`\n[INFO] Writing ${SHEET_ROWS.length} rows to A1:G${SHEET_ROWS.length}...`);
  await updateSheetValues({
    spreadsheetId: LIVE_SHEET_ID,
    accessToken: ctx.accessToken,
    sheetName: SHEET_NAME,
    range: `A1:G${SHEET_ROWS.length}`,
    values: SHEET_ROWS,
  });
  console.log(`  [OK] Content written`);

  // ── Step 3: 書式を設定 ──
  console.log(`\n[INFO] Applying formatting...`);

  // カラーパレット
  const C_TITLE_BG     = colorRgb( 60, 120, 190);  // 濃い青（タイトル）
  const C_TITLE_FG     = { red: 1, green: 1, blue: 1 };  // 白文字
  const C_SECTION      = colorRgb(180, 210, 240);  // 薄い青（セクション見出し）
  const C_TABLE_HDR    = colorRgb(200, 200, 200);  // グレー（テーブルヘッダー）
  const C_LOWBACK      = colorRgb(255, 243, 224);  // 薄いオレンジ（腰痛列）
  const C_NECKSHOULDER = colorRgb(224, 245, 224);  // 薄い緑（首肩こり列）
  const C_KNEE         = colorRgb(235, 224, 245);  // 薄い紫（膝列）
  const C_JUDGE_BG     = colorRgb(212, 240, 212);  // 薄い緑（判定ルールデータ）
  const C_JUDGE_HDR    = colorRgb(160, 220, 160);  // やや濃い緑（判定ルールヘッダー）
  const C_CAUTION_OUT  = colorRgb(255, 220, 220);  // 薄いピンク（対象外）
  const C_CAUTION_NOTE = colorRgb(255, 250, 210);  // 薄い黄色（注意）

  const formatRequests = [
    // ① テキスト折り返し（全セル）
    wrapAll(sheetId, SHEET_ROWS.length),

    // ② タイトル行 (idx 0): 濃い青 + 白太字
    rowFormat(sheetId, 0, 1, 0, 7, {
      backgroundColor: C_TITLE_BG,
      textFormat: { bold: true, foregroundColor: C_TITLE_FG },
    }),

    // ③ セクションヘッダー (idx 3, 11, 26, 32): 薄い青 + 太字
    ...[3, 11, 26, 32].map((r) =>
      rowFormat(sheetId, r, r + 1, 0, 7, {
        backgroundColor: C_SECTION,
        textFormat: { bold: true },
      })),

    // ④ テーブルヘッダー (idx 4, 27, 33): グレー + 太字
    ...[4, 27, 33].map((r) =>
      rowFormat(sheetId, r, r + 1, 0, 7, {
        backgroundColor: C_TABLE_HDR,
        textFormat: { bold: true },
      })),

    // ⑤ 比較表ヘッダー行 (idx 12): A列のみグレー太字
    rowFormat(sheetId, 12, 13, 0, 1, {
      backgroundColor: C_TABLE_HDR,
      textFormat: { bold: true },
    }),

    // ⑥ 比較表 カラム着色（背景のみ / rows 12-24 = idx 12-24）
    bgOnly(sheetId, 12, 25, 1, 2, C_LOWBACK),      // 腰痛列 B
    bgOnly(sheetId, 12, 25, 2, 3, C_NECKSHOULDER), // 首肩こり列 C
    bgOnly(sheetId, 12, 25, 3, 4, C_KNEE),         // 膝列 D

    // ⑦ 比較表ヘッダー行 (idx 12): B/C/D 列を太字 + 各列色に再確定
    rowFormat(sheetId, 12, 13, 1, 2, { backgroundColor: C_LOWBACK,      textFormat: { bold: true } }),
    rowFormat(sheetId, 12, 13, 2, 3, { backgroundColor: C_NECKSHOULDER, textFormat: { bold: true } }),
    rowFormat(sheetId, 12, 13, 3, 4, { backgroundColor: C_KNEE,         textFormat: { bold: true } }),

    // ⑧ 判定ルールデータ (idx 13-16, F-G列): 薄い緑
    bgOnly(sheetId, 13, 17, 5, 7, C_JUDGE_BG),

    // ⑨ 判定ルールヘッダー (idx 12, F-G): やや濃い緑 + 太字
    rowFormat(sheetId, 12, 13, 5, 7, { backgroundColor: C_JUDGE_HDR, textFormat: { bold: true } }),

    // ⑩ 対象外行 (idx 34): 薄いピンク
    bgOnly(sheetId, 34, 35, 0, 7, C_CAUTION_OUT),

    // ⑪ 注意行 (idx 35-36): 薄い黄色
    bgOnly(sheetId, 35, 37, 0, 7, C_CAUTION_NOTE),
  ];

  await batchUpdateSpreadsheet({
    spreadsheetId: LIVE_SHEET_ID,
    accessToken: ctx.accessToken,
    requests: formatRequests,
  });
  console.log(`  [OK] Formatting applied`);

  // ── Step 4: 列幅を設定 ──
  console.log(`\n[INFO] Setting column widths...`);
  await batchUpdateSpreadsheet({
    spreadsheetId: LIVE_SHEET_ID,
    accessToken: ctx.accessToken,
    requests: [
      colWidth(sheetId, 0, 1, 180), // A: 項目名
      colWidth(sheetId, 1, 2, 240), // B: 腰痛改善
      colWidth(sheetId, 2, 3, 240), // C: 首肩こり改善
      colWidth(sheetId, 3, 4, 240), // D: 膝改善
      colWidth(sheetId, 4, 5,  20), // E: 区切り
      colWidth(sheetId, 5, 6, 220), // F: 判定ルール 状態
      colWidth(sheetId, 6, 7, 200), // G: 判定ルール 提案先
    ],
  });
  console.log(`  [OK] Column widths set`);

  // ── Step 5: 完了サマリー ──
  console.log('\n[DONE] 反映完了:');
  console.log(`  シート名: ${SHEET_NAME}`);
  console.log(`  sheetId: ${sheetId}`);
  console.log(`  行数: ${SHEET_ROWS.length}行 × 7列`);
  console.log('  構成:');
  console.log('    Row 1-10:  タイトル・共通設定（時間/価格/位置づけ）');
  console.log('    Row 12-25: 3メニュー比較表（腰痛✅/首肩こり✅/膝⚠️仮）+ 右列に次提案判定ルール');
  console.log('    Row 27-31: 20分版フロー表（導入3分/運動体験14分/まとめ3分）');
  console.log('    Row 33-37: 対象外・注意欄');
  console.log('  未確定で仮表示のまま:');
  console.log('    - 膝の体験種目①② → ⚠️ 仮（未試行）');
  console.log('    - ジム会員価格 → 2,800円（仮）（未確定項目 No.10）');
}

main().catch((err) => {
  console.error('[ERROR]', err.message);
  process.exit(1);
});
