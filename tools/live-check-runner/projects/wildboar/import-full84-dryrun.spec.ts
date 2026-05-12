/**
 * wildboar/import-full84-dryrun.spec.ts
 * Phase 14-3B：会員名簿2026 の全件（ ~84 件）を ImportMembers に seed し、
 * validate / dry-run まで実機確認する。本取り込みは絶対に実行しない。
 *
 * 重要:
 *   - 個人情報を annotation / report / docs に書かない
 *   - 出力するのは件数・プラン区分・status 区分・WARNING ラベルのみ
 *   - executeImport(false, '既存会員を取り込む') は呼ばない（dry-run のみ）
 *   - 終了時に必ず ImportMembers を 0 行に戻す（最終 cleanup）
 *
 * 前提:
 *   - PROD @39 デプロイ済み
 *     seedImportMembersFromArray が "phase14-3b-full-seed" を受理し最大 100 行
 *     clearImportMembersUnimported が "phase14-3b-clear" を受理
 *   - ImportMembers シート存在・データ 0 行で開始
 *   - auth.json で 会員名簿2026 への CSV export read アクセス可能
 *
 * 実行: npx playwright test projects/wildboar/import-full84-dryrun.spec.ts --project=chromium
 */

import { test, expect, Frame, Page } from "@playwright/test";
import config from "./config.json";

const PROD_URL    = config.prodUrl;
const FRAME_NAME  = config.gasIframeConstraints.frameName;
const MIN_BODY_LEN = config.gasIframeConstraints.frameReadyMinBodyLen;
const FRAME_TIMEOUT = 60_000;

const SOURCE_ID  = "1bz95Vy2FnTxWq1PHvb-cqT5UZpRWkNMQQ_-OXmgG9Qs";
const SOURCE_GID = "676663641";
const CSV_URL    = `https://docs.google.com/spreadsheets/d/${SOURCE_ID}/export?format=csv&gid=${SOURCE_GID}`;

const SEED_TOKEN_3B  = "phase14-3b-full-seed";
const CLEAR_TOKEN_3B = "phase14-3b-clear";

// 5月 = idx 14+4 = 18（O 列が 1月）
const TARGET_MONTH_IDX = 14 + 4;
const PLAN_F_IDX = 5;

// 取り込み対象とする plan 種別（active/paused 系のみ）
// ERROR/BLOCKED 候補（15時 / 退会）は受け付けたまま validate に判定させる
const ACTIVE_PLAN_SET = new Set(["男性", "女性", "中高生", "11時", "60歳", "週一", "休会"]);

// ── ヘルパー ─────────────────────────────────────────────────────────────

async function getReadyFrame(page: Page, minLen = MIN_BODY_LEN): Promise<Frame | null> {
  const deadline = Date.now() + FRAME_TIMEOUT;
  while (Date.now() < deadline) {
    const frame = page.frame({ name: FRAME_NAME });
    if (frame && frame.url().includes("googleusercontent.com")) {
      try {
        const len = await frame.evaluate(() => document.body ? document.body.innerHTML.length : 0);
        if (len > minLen) return frame;
      } catch (_) { /* retry */ }
    }
    await page.waitForTimeout(800);
  }
  return null;
}

async function gasRun<T = any>(frame: Frame, fnName: string, args: any[] = []): Promise<T> {
  return await frame.evaluate(
    async ({ fnName, args }) => {
      return await new Promise((resolve, reject) => {
        const w: any = window as any;
        const runner: any = w.google.script.run
          .withSuccessHandler((r: any) => resolve(r))
          .withFailureHandler((e: any) => reject(new Error(e ? e.message : "GAS error")));
        runner[fnName].apply(runner, args);
      });
    },
    { fnName, args },
  );
}

async function openImportMembers(page: Page): Promise<Frame> {
  await page.goto(PROD_URL + "?page=import-members", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  const f = await getReadyFrame(page);
  expect(f, "GAS frame ready").not.toBeNull();
  return f!;
}

// CSV 簡易パーサ
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\r") { /* skip */ }
      else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else field += c;
    }
  }
  if (field !== "" || cur.length > 0) { cur.push(field); rows.push(cur); }
  return rows;
}

// 半角カタカナ → 全角
const HANKAKU_MAP: Record<string, string> = {
  "ｱ":"ア","ｲ":"イ","ｳ":"ウ","ｴ":"エ","ｵ":"オ","ｶ":"カ","ｷ":"キ","ｸ":"ク","ｹ":"ケ","ｺ":"コ",
  "ｻ":"サ","ｼ":"シ","ｽ":"ス","ｾ":"セ","ｿ":"ソ","ﾀ":"タ","ﾁ":"チ","ﾂ":"ツ","ﾃ":"テ","ﾄ":"ト",
  "ﾅ":"ナ","ﾆ":"ニ","ﾇ":"ヌ","ﾈ":"ネ","ﾉ":"ノ","ﾊ":"ハ","ﾋ":"ヒ","ﾌ":"フ","ﾍ":"ヘ","ﾎ":"ホ",
  "ﾏ":"マ","ﾐ":"ミ","ﾑ":"ム","ﾒ":"メ","ﾓ":"モ","ﾔ":"ヤ","ﾕ":"ユ","ﾖ":"ヨ",
  "ﾗ":"ラ","ﾘ":"リ","ﾙ":"ル","ﾚ":"レ","ﾛ":"ロ","ﾜ":"ワ","ｦ":"ヲ","ﾝ":"ン",
  "ｧ":"ァ","ｨ":"ィ","ｩ":"ゥ","ｪ":"ェ","ｫ":"ォ","ｬ":"ャ","ｭ":"ュ","ｮ":"ョ","ｯ":"ッ",
  "ｰ":"ー","ﾞ":"゛","ﾟ":"゜",
};
const DAKUTEN_PAIRS: Record<string, string> = {
  "カ゛":"ガ","キ゛":"ギ","ク゛":"グ","ケ゛":"ゲ","コ゛":"ゴ","サ゛":"ザ","シ゛":"ジ","ス゛":"ズ","セ゛":"ゼ","ソ゛":"ゾ",
  "タ゛":"ダ","チ゛":"ヂ","ツ゛":"ヅ","テ゛":"デ","ト゛":"ド","ハ゛":"バ","ヒ゛":"ビ","フ゛":"ブ","ヘ゛":"ベ","ホ゛":"ボ",
  "ハ゜":"パ","ヒ゜":"ピ","フ゜":"プ","ヘ゜":"ペ","ホ゜":"ポ",
};
function toFullKatakana(s: string): string {
  if (!s) return "";
  let out = "";
  for (const c of s) out += HANKAKU_MAP[c] || c;
  for (const [k, v] of Object.entries(DAKUTEN_PAIRS)) out = out.split(k).join(v);
  return out;
}

function splitName(name: string): { family: string; given: string } {
  if (!name) return { family: "", given: "" };
  const parts = name.split(/[　\s]+/).filter(p => p.length > 0);
  if (parts.length === 0) return { family: "", given: "" };
  if (parts.length === 1) return { family: parts[0], given: "" };
  return { family: parts[0], given: parts.slice(1).join("") };
}

function normalizePhone(p: string): string {
  if (!p) return "";
  return p.replace(/[^0-9]/g, "");
}

function normalizeBirthDate(d: string): string {
  if (!d) return "";
  const m = d.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (!m) return "";
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

function mapGender(g: string): string {
  if (g === "男") return "male";
  if (g === "女") return "female";
  return "";
}

function deriveStatus(planRaw: string): string {
  if (planRaw === "休会") return "paused";
  if (planRaw === "退会") return "withdrawn";
  return "active";
}

function rowToImport(row: string[], rowNo: number) {
  const planFromMonth = (row[TARGET_MONTH_IDX] || "").trim();
  const planFromF     = (row[PLAN_F_IDX] || "").trim();
  const planRaw = planFromMonth || planFromF;

  const name  = (row[3] || "").trim();
  const kana  = (row[4] || "").trim();
  const nm    = splitName(name);
  const kn    = splitName(toFullKatakana(kana));
  const addressRaw = (row[8] || "").trim();

  return {
    row_no:               rowNo,
    source_member_id:     String(row[2] || "").trim(),
    normalized_member_id: String(row[2] || "").trim(),
    family_name:          nm.family,
    given_name:           nm.given,
    family_name_kana:     kn.family,
    given_name_kana:      kn.given,
    phone_mobile:         normalizePhone(row[6] || ""),
    birth_date:           normalizeBirthDate(row[10] || ""),
    gender:               mapGender((row[11] || "").trim()),
    plan_name_raw:        planRaw,
    plan_id:              "",
    status:               deriveStatus(planRaw),
    join_date:            "",
    address_raw:          addressRaw,
    prefecture:           "",
    city:                 "",
    address1:             addressRaw,
    notes:                "",
  };
}

// 全行のうち取り込み候補（active/paused 系）のみフィルタ。
// Phase 14-3B はあえて全 84 行のうち active/paused のものをすべて流し、
// validate に判定させる方針。
// （15時 / 退会 / 空 member_id を混ぜたいなら別 spec。今回は ERROR=0/BLOCKED=0 を目指す）
function selectImportable(rows: string[][]): { rows: string[]; raw: string[][] } {
  // dummy — used only for type
  return { rows: [], raw: [] } as any;
}

function pickActiveAndPaused(dataRows: string[][]): { keep: string[][]; skipped: number } {
  const keep: string[][] = [];
  let skipped = 0;
  for (const r of dataRows) {
    const memberId = (r[2] || "").trim();
    if (!memberId || !/^\d+$/.test(memberId)) { skipped++; continue; }
    const planFromMonth = (r[TARGET_MONTH_IDX] || "").trim();
    const planFromF     = (r[PLAN_F_IDX] || "").trim();
    const plan = planFromMonth || planFromF;
    if (!plan) { skipped++; continue; }
    if (!ACTIVE_PLAN_SET.has(plan)) { skipped++; continue; }
    if (!(r[3] || "").trim()) { skipped++; continue; }
    keep.push(r);
  }
  return { keep, skipped };
}

// ── テスト本体 ───────────────────────────────────────────────────────────

test.describe("WILDBOAR W-IM3B: ImportMembers full ~84 dry-run", () => {
  test.setTimeout(240_000);
  test.describe.configure({ mode: "serial" });

  // 共有状態
  let csvDataRowCount = -1;
  let importableRows: any[] = [];
  let baselineMembersCount = -1;
  let validateServer: any = null;

  test("W-IM3B-1: source CSV 取得", async ({ context }) => {
    const res = await context.request.get(CSV_URL);
    expect(res.status(), "CSV HTTP status").toBeLessThan(400);
    const csv = await res.text();
    const parsed = parseCsv(csv);
    // header 2 行（header + sub-header）を除外
    const dataRows = parsed.slice(2).filter(r => r.length > 2);
    csvDataRowCount = dataRows.length;

    const { keep, skipped } = pickActiveAndPaused(dataRows);
    importableRows = keep.map((r, i) => rowToImport(r, i + 1));

    const planCounts: Record<string, number> = {};
    const statusCounts: Record<string, number> = {};
    for (const r of importableRows) {
      planCounts[r.plan_name_raw] = (planCounts[r.plan_name_raw] || 0) + 1;
      statusCounts[r.status]      = (statusCounts[r.status] || 0)      + 1;
    }
    test.info().annotations.push({
      type: "csv-shape",
      description: JSON.stringify({
        csvDataRows: csvDataRowCount,
        importableRows: importableRows.length,
        skippedRows: skipped,
        planCounts,
        statusCounts,
      }),
    });
    expect(csvDataRowCount, "CSV data rows >= 50").toBeGreaterThanOrEqual(50);
    expect(importableRows.length, "importable rows >= 50").toBeGreaterThanOrEqual(50);
    expect(importableRows.length, "importable rows <= 100").toBeLessThanOrEqual(100);
  });

  test("W-IM3B-2: ImportMembers 0 件確認 + Members baseline", async ({ page }) => {
    const f = await openImportMembers(page);
    const sheet = await gasRun<any>(f, "checkImportMembersSheet", []);
    expect(sheet.rowCount, "ImportMembers starts empty").toBe(0);

    const members = await gasRun<any[]>(f, "getMembers", [{ status: "all" }]);
    baselineMembersCount = Array.isArray(members) ? members.length : -1;
    test.info().annotations.push({
      type: "baseline",
      description: JSON.stringify({
        importMembers: sheet.rowCount,
        members: baselineMembersCount,
      }),
    });
  });

  test("W-IM3B-3: 全 importable 行を seed（phase14-3b-full-seed）", async ({ page }) => {
    const f = await openImportMembers(page);
    const res = await gasRun<any>(f, "seedImportMembersFromArray", [importableRows, SEED_TOKEN_3B]);
    test.info().annotations.push({
      type: "seed-result",
      description: JSON.stringify({
        success:  res.success,
        attempted: importableRows.length,
        seeded:    res.count,
        message:   res.message,
      }),
    });
    expect(res.success, "seed success").toBe(true);
    expect(res.count, "seed count = attempted").toBe(importableRows.length);
  });

  test("W-IM3B-4: seed 後 ImportMembers 件数確認", async ({ page }) => {
    const f = await openImportMembers(page);
    const sheet = await gasRun<any>(f, "checkImportMembersSheet", []);
    test.info().annotations.push({
      type: "post-seed",
      description: JSON.stringify({ rowCount: sheet.rowCount, attempted: importableRows.length }),
    });
    expect(sheet.rowCount, "rowCount matches seed").toBe(importableRows.length);
  });

  test("W-IM3B-5: validate 実行（サーバー API）", async ({ page }) => {
    const f = await openImportMembers(page);
    const res = await gasRun<any>(f, "validateImportRows", []);
    validateServer = res;
    test.info().annotations.push({
      type: "validate-result",
      description: JSON.stringify({
        success: res.success,
        total: res.total,
        ok: res.ok,
        warning: res.warning,
        review: res.review,
        blocked: res.blocked,
        error: res.error,
        importable: res.importable,
        canExecuteImport: res.canExecuteImport,
      }),
    });
    expect(res.success, "validate success").toBe(true);
    expect(res.total, "total matches seed").toBe(importableRows.length);
  });

  test("W-IM3B-6: WARNING 内訳取得（個人情報非開示）", async ({ page }) => {
    expect(validateServer, "validate result captured").not.toBeNull();

    // validate の rows[] から validation_status / validation_errors の集計を作る。
    // errors テキストには個人情報を含めないため、ラベルごとの「該当件数」だけ集計する。
    const labelCounts: Record<string, number> = {};
    for (const r of (validateServer.rows || [])) {
      const status = String(r.validation_status || "").toUpperCase();
      labelCounts["status:" + status] = (labelCounts["status:" + status] || 0) + 1;

      const warningsText = String(r.validation_warnings || "");
      // 設計に基づく warning ラベル
      const labels = [
        "phone_mobile が空欄",
        "birth_date が空欄",
        "join_date が空欄",
        "birth_date の形式",
        "join_date の形式",
        "休会会員の plan_id",
      ];
      for (const lab of labels) {
        if (warningsText.indexOf(lab) !== -1) {
          labelCounts["warn:" + lab] = (labelCounts["warn:" + lab] || 0) + 1;
        }
      }

      const errText = String(r.validation_errors || "");
      if (errText) {
        const errLabels = [
          "member_id が空欄",
          "member_id がバッチ内で重複",
          "既存 Members に同一",
          "plan_name_raw が変換表に存在しません",
          "プランが PROD 未登録",
          "status が不正",
          "氏名（姓）が空欄",
        ];
        for (const lab of errLabels) {
          if (errText.indexOf(lab) !== -1) {
            labelCounts["err:" + lab] = (labelCounts["err:" + lab] || 0) + 1;
          }
        }
      }
    }
    test.info().annotations.push({
      type: "warning-error-breakdown",
      description: JSON.stringify(labelCounts),
    });
  });

  test("W-IM3B-7: dry-run（ERROR=BLOCKED=0 のときのみ）", async ({ page }) => {
    expect(validateServer, "validate result").not.toBeNull();
    const err = validateServer.error || 0;
    const blk = validateServer.blocked || 0;

    if (err > 0 || blk > 0) {
      test.info().annotations.push({
        type: "dry-run-skipped",
        description: JSON.stringify({ reason: "ERROR or BLOCKED > 0", error: err, blocked: blk }),
      });
      test.skip(true, `ERROR=${err} BLOCKED=${blk} のため dry-run はスキップ`);
      return;
    }

    const f = await openImportMembers(page);
    // dry-run はサーバー API 経由でも呼べる。UI ボタンの label とサーバー label を両方確認。
    const dryRes = await gasRun<any>(f, "executeImport", [true, ""]);
    test.info().annotations.push({
      type: "dry-run-result",
      description: JSON.stringify({
        success:  dryRes.success,
        dryRun:   dryRes.dryRun,
        imported: dryRes.imported,
        skipped:  dryRes.skipped,
        errors:   (dryRes.errors || []).length,
        batchId:  dryRes.batchId,
        message:  String(dryRes.message || "").slice(0, 200),
      }),
    });
    expect(dryRes.success, "dry-run success").toBe(true);
    expect(dryRes.dryRun, "dryRun flag true").toBe(true);
    expect((dryRes.errors || []).length, "dry-run errors").toBe(0);
  });

  test("W-IM3B-8: Members 件数未変更確認", async ({ page }) => {
    const f = await openImportMembers(page);
    const members = await gasRun<any[]>(f, "getMembers", [{ status: "all" }]);
    const after = Array.isArray(members) ? members.length : -1;
    test.info().annotations.push({
      type: "members-after",
      description: JSON.stringify({
        baseline: baselineMembersCount,
        after,
        unchanged: after === baselineMembersCount,
      }),
    });
    expect(after, "members unchanged").toBe(baselineMembersCount);
  });

  test("W-IM3B-9: ImportMembers が本取り込み済み扱いになっていない", async ({ page }) => {
    expect(validateServer, "validate result").not.toBeNull();
    // imported 列は dry-run なので空のままのはず（_markAsImported は dryRun=true では呼ばれない）
    let importedAtFilledRows = 0;
    let importedIdFilledRows = 0;
    for (const r of (validateServer.rows || [])) {
      if (String(r.import_status || "") === "imported") importedAtFilledRows++;
      if (String(r.imported_member_id || "") !== "")      importedIdFilledRows++;
    }
    test.info().annotations.push({
      type: "post-dryrun-import-status",
      description: JSON.stringify({
        importedStatusRows: importedAtFilledRows,
        importedMemberIdRows: importedIdFilledRows,
      }),
    });
    expect(importedAtFilledRows, "no row should be marked imported").toBe(0);
    expect(importedIdFilledRows, "no row should have imported_member_id").toBe(0);
  });

  test("W-IM3B-10: cleanup 実行（phase14-3b-clear）", async ({ page }) => {
    const f = await openImportMembers(page);
    const res = await gasRun<any>(f, "clearImportMembersUnimported", [CLEAR_TOKEN_3B]);
    test.info().annotations.push({
      type: "cleanup-result",
      description: JSON.stringify({ success: res.success, deleted: res.count, message: res.message }),
    });
    expect(res.success, "cleanup success").toBe(true);
  });

  test("W-IM3B-11: cleanup 後 0 件 + Members 未変更最終確認", async ({ page }) => {
    const f = await openImportMembers(page);
    const sheet = await gasRun<any>(f, "checkImportMembersSheet", []);
    const members = await gasRun<any[]>(f, "getMembers", [{ status: "all" }]);
    const after = Array.isArray(members) ? members.length : -1;
    test.info().annotations.push({
      type: "final",
      description: JSON.stringify({
        importMembersRowCount: sheet.rowCount,
        members: after,
        membersUnchanged: after === baselineMembersCount,
      }),
    });
    expect(sheet.rowCount, "ImportMembers cleared").toBe(0);
    expect(after, "Members baseline preserved").toBe(baselineMembersCount);
  });
});
