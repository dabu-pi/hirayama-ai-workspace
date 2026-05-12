/**
 * wildboar/import-execute65.spec.ts
 * Phase 14-3：会員名簿2026 の対象 65 件を PROD Members に本取り込みする実行 spec。
 *
 * 重要:
 *   - 個人情報を annotation / report / docs に書かない
 *   - 出力するのは件数・プラン区分・status 区分・エラー種別のみ
 *   - 本取り込みは W-IM3C-EX-6 で executeImport(false, '既存会員を取り込む') を 1 回だけ呼ぶ
 *   - 二重実行防止のため以下の guard を行う:
 *       1. ImportMembers に imported 行があれば execute をスキップして post-check のみ
 *       2. Members 側に取り込み対象 member_id と同じ id がある場合は execute 中止
 *       3. validate.canExecuteImport === false なら execute 中止
 *       4. dry-run errors > 0 なら execute 中止
 *
 * 前提:
 *   - PROD @40 以降がデプロイ済み
 *   - Phase 14-3B / 14-3B-I1 / 14-3C-Prep CLOSED
 *   - Phase 14-3B dry-run と同じ 65 件 (active/paused) が対象
 *   - seedImportMembersFromArray は "phase14-3b-full-seed" を受理（最大 100 行）
 *   - clearImportMembersUnimported は "phase14-3b-clear" を受理
 *   - IMPORT_CONFIRM_TEXT = "既存会員を取り込む"
 *
 * 実行:
 *   npx playwright test projects/wildboar/import-execute65.spec.ts --project=chromium
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

const SEED_TOKEN  = "phase14-3b-full-seed";
const IMPORT_CONFIRM_TEXT = "既存会員を取り込む";

// 5月 = idx 14+4 = 18（O 列が 1月）
const TARGET_MONTH_IDX = 14 + 4;
const PLAN_F_IDX = 5;

const ACTIVE_PLAN_SET = new Set(["男性", "女性", "中高生", "11時", "60歳", "週一", "休会"]);

const EXPECTED_IMPORT_COUNT = 65;

// ── ヘルパー（import-full84-dryrun と同等） ─────────────────────────────

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

function pickActiveAndPaused(dataRows: string[][]): string[][] {
  const keep: string[][] = [];
  for (const r of dataRows) {
    const memberId = (r[2] || "").trim();
    if (!memberId || !/^\d+$/.test(memberId)) continue;
    const planFromMonth = (r[TARGET_MONTH_IDX] || "").trim();
    const planFromF     = (r[PLAN_F_IDX] || "").trim();
    const plan = planFromMonth || planFromF;
    if (!plan) continue;
    if (!ACTIVE_PLAN_SET.has(plan)) continue;
    if (!(r[3] || "").trim()) continue;
    keep.push(r);
  }
  return keep;
}

// ── テスト本体 ───────────────────────────────────────────────────────────

test.describe("WILDBOAR W-IM3C-EX: ImportMembers 本取り込み（65 件 → Members）", () => {
  test.setTimeout(300_000);
  test.describe.configure({ mode: "serial" });

  // 共有状態
  let importableRows: any[] = [];
  let baselineMembersCount = -1;
  let alreadyImported = false; // guard 1 検出
  let executeResult: any = null;

  test("W-IM3C-EX-1: source CSV 取得 + 対象 65 件抽出", async ({ context }) => {
    const res = await context.request.get(CSV_URL);
    expect(res.status(), "CSV HTTP status").toBeLessThan(400);
    const csv = await res.text();
    const parsed = parseCsv(csv);
    const dataRows = parsed.slice(2).filter(r => r.length > 2);
    const keep = pickActiveAndPaused(dataRows);
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
        csvDataRows: dataRows.length,
        importableRows: importableRows.length,
        skippedRows: dataRows.length - importableRows.length,
        planCounts,
        statusCounts,
      }),
    });
    expect(importableRows.length, "importable rows == 65").toBe(EXPECTED_IMPORT_COUNT);
  });

  test("W-IM3C-EX-2: ImportMembers 0 件確認 + Members baseline + guard-1 判定", async ({ page }) => {
    const f = await openImportMembers(page);
    const sheet = await gasRun<any>(f, "checkImportMembersSheet", []);
    const members = await gasRun<any[]>(f, "getMembers", [{ status: "all" }]);
    baselineMembersCount = Array.isArray(members) ? members.length : -1;

    test.info().annotations.push({
      type: "preflight",
      description: JSON.stringify({
        importMembersRows: sheet.rowCount,
        membersBaseline: baselineMembersCount,
      }),
    });

    // 既に imported 行が ImportMembers に存在する場合 → 既に本取り込み済み
    // guard-1: validate を呼んで imported 行の有無を確認する
    if (sheet.rowCount > 0) {
      const v = await gasRun<any>(f, "validateImportRows", []);
      let importedRows = 0;
      for (const r of (v.rows || [])) {
        if (String(r.import_status || "") === "imported") importedRows++;
      }
      test.info().annotations.push({
        type: "guard-1-check",
        description: JSON.stringify({
          importMembersRows: sheet.rowCount,
          importedRows,
        }),
      });
      if (importedRows > 0) {
        alreadyImported = true;
        test.info().annotations.push({
          type: "guard-1-tripped",
          description: "ImportMembers に imported 行を検出。execute をスキップして post-check のみ。",
        });
        return;
      }
      // imported 行はないが残置あり → 異常
      throw new Error(`ImportMembers に ${sheet.rowCount} 件の非 imported 行が残置されています。事前 cleanup を実施してください。`);
    }

    expect(sheet.rowCount, "ImportMembers starts empty").toBe(0);
  });

  test("W-IM3C-EX-3: 65 件 seed（guard-1 未トリップ時のみ）", async ({ page }) => {
    if (alreadyImported) {
      test.skip(true, "guard-1: 既に本取り込み済み。seed スキップ。");
      return;
    }
    const f = await openImportMembers(page);
    const res = await gasRun<any>(f, "seedImportMembersFromArray", [importableRows, SEED_TOKEN]);
    test.info().annotations.push({
      type: "seed-result",
      description: JSON.stringify({
        success:   res.success,
        attempted: importableRows.length,
        seeded:    res.count,
      }),
    });
    expect(res.success, "seed success").toBe(true);
    expect(res.count, "seed count").toBe(EXPECTED_IMPORT_COUNT);
  });

  test("W-IM3C-EX-4: validate / ERROR=0 / BLOCKED=0 / importable=65", async ({ page }) => {
    if (alreadyImported) {
      test.skip(true, "guard-1: 既に本取り込み済み。validate スキップ。");
      return;
    }
    const f = await openImportMembers(page);
    const v = await gasRun<any>(f, "validateImportRows", []);
    test.info().annotations.push({
      type: "validate-result",
      description: JSON.stringify({
        success:          v.success,
        total:            v.total,
        ok:               v.ok,
        warning:          v.warning,
        review:           v.review,
        blocked:          v.blocked,
        error:            v.error,
        importable:       v.importable,
        canExecuteImport: v.canExecuteImport,
      }),
    });
    expect(v.success, "validate success").toBe(true);
    expect(v.total, "total == 65").toBe(EXPECTED_IMPORT_COUNT);
    expect(v.error || 0, "ERROR == 0").toBe(0);
    expect(v.blocked || 0, "BLOCKED == 0").toBe(0);
    expect(v.importable, "importable == 65").toBe(EXPECTED_IMPORT_COUNT);
    expect(v.canExecuteImport, "canExecuteImport == true").toBe(true);
  });

  test("W-IM3C-EX-5: dry-run / errors=0", async ({ page }) => {
    if (alreadyImported) {
      test.skip(true, "guard-1: 既に本取り込み済み。dry-run スキップ。");
      return;
    }
    const f = await openImportMembers(page);
    const dry = await gasRun<any>(f, "executeImport", [true, ""]);
    test.info().annotations.push({
      type: "dry-run-result",
      description: JSON.stringify({
        success:  dry.success,
        dryRun:   dry.dryRun,
        imported: dry.imported,
        skipped:  dry.skipped,
        errors:   (dry.errors || []).length,
      }),
    });
    expect(dry.success, "dry-run success").toBe(true);
    expect(dry.dryRun, "dryRun=true").toBe(true);
    expect(dry.imported, "dry-run imported == 65").toBe(EXPECTED_IMPORT_COUNT);
    expect((dry.errors || []).length, "dry-run errors").toBe(0);
  });

  test("W-IM3C-EX-6: 本取り込み executeImport(false, '既存会員を取り込む')", async ({ page }) => {
    if (alreadyImported) {
      test.skip(true, "guard-1: 既に本取り込み済み。execute スキップ。");
      return;
    }
    // guard-2: Members 側に取り込み対象 member_id と同じ id があるか直前再確認
    const f = await openImportMembers(page);
    const members = await gasRun<any[]>(f, "getMembers", [{ status: "all" }]);
    const existingIds = new Set((members || []).map((m: any) => String(m.member_id || "").trim()));
    const collisions: string[] = [];
    for (const r of importableRows) {
      const id = String(r.normalized_member_id || "").trim();
      if (id && existingIds.has(id)) collisions.push(id);
    }
    test.info().annotations.push({
      type: "guard-2-check",
      description: JSON.stringify({
        baselineMembers: members.length,
        collisionCount:  collisions.length,
      }),
    });
    if (collisions.length > 0) {
      throw new Error(`guard-2: Members に同一 member_id が ${collisions.length} 件存在します。execute 中止。`);
    }

    // execute（1 回のみ）
    const f2 = await openImportMembers(page);
    const result = await gasRun<any>(f2, "executeImport", [false, IMPORT_CONFIRM_TEXT]);
    executeResult = result;
    test.info().annotations.push({
      type: "execute-result",
      description: JSON.stringify({
        success:  result.success,
        dryRun:   result.dryRun,
        batchId:  result.batchId,
        imported: result.imported,
        skipped:  result.skipped,
        errors:   (result.errors || []).length,
      }),
    });
    expect(result.success, "execute success").toBe(true);
    expect(result.dryRun, "dryRun=false").toBe(false);
    expect((result.errors || []).length, "execute errors").toBe(0);
  });

  test("W-IM3C-EX-7: result imported=65 / skipped=0 / errors=0", async () => {
    if (alreadyImported) {
      test.skip(true, "guard-1: 既に本取り込み済み。result 検証スキップ。");
      return;
    }
    expect(executeResult, "execute result captured").not.toBeNull();
    expect(executeResult.imported, "imported == 65").toBe(EXPECTED_IMPORT_COUNT);
    expect(executeResult.skipped, "skipped == 0").toBe(0);
    expect((executeResult.errors || []).length, "errors length == 0").toBe(0);
    expect(String(executeResult.batchId || ""), "batchId not empty").not.toBe("");
  });

  test("W-IM3C-EX-8: ImportMembers が imported 状態になっている", async ({ page }) => {
    // 注意: validateImportRows() の戻り値（_buildRowResult）には
    // imported_member_id / imported_at / import_batch_id フィールドが含まれない
    // （API 表層に出ないだけで _markAsImported は実シートに 4 フィールドすべて書く）。
    // ここでは import_status === 'imported' のみを公式 API で確認する。
    // imported_* の実書込み確認は、Members 側の created_by に
    // '[import:<batchId>]' タグがあることで間接的に検証する（EX-9 内）。
    const f = await openImportMembers(page);
    const v = await gasRun<any>(f, "validateImportRows", []);
    let importedRows = 0;
    for (const r of (v.rows || [])) {
      if (String(r.import_status || "") === "imported") importedRows++;
    }
    test.info().annotations.push({
      type: "imported-flags",
      description: JSON.stringify({
        importedRows,
        note: "validateImportRows() does not surface imported_member_id/imported_at/import_batch_id; checked indirectly via Members.created_by in EX-9",
      }),
    });
    expect(importedRows, "imported rows == 65").toBe(EXPECTED_IMPORT_COUNT);
  });

  test("W-IM3C-EX-9: Members が 65 件増えている + サンプル 1 件で import batch tag 確認", async ({ page }) => {
    const f = await openImportMembers(page);
    const members = await gasRun<any[]>(f, "getMembers", [{ status: "all" }]);
    const after = Array.isArray(members) ? members.length : -1;
    const activeCount = members.filter((m: any) => m.status === "active").length;
    const pausedCount = members.filter((m: any) => m.status === "paused").length;

    // 注意: getMembers() は created_by を projection しないため
    // 全件タグ確認は不可。サンプル 1 件を getMemberById でフルレコード取得して
    // created_by に '[import:' タグが入っていることを確認する。
    let sampleMemberId = "";
    let sampleCreatedBy = "";
    let sampleHasImportTag = false;

    // ImportMembers の imported 行から 1 件サンプル取得
    const f2 = await openImportMembers(page);
    const v = await gasRun<any>(f2, "validateImportRows", []);
    for (const r of (v.rows || [])) {
      if (String(r.import_status || "") === "imported" && r.normalized_member_id) {
        sampleMemberId = String(r.normalized_member_id);
        break;
      }
    }
    if (sampleMemberId) {
      const full = await gasRun<any>(f2, "getMemberById", [sampleMemberId]);
      sampleCreatedBy = String((full && full.created_by) || "");
      sampleHasImportTag = sampleCreatedBy.indexOf("[import:") !== -1;
    }

    test.info().annotations.push({
      type: "members-after",
      description: JSON.stringify({
        baseline:    baselineMembersCount,
        after,
        delta:       after - baselineMembersCount,
        activeCount,
        pausedCount,
        sampleMemberIdProvided: sampleMemberId !== "",
        sampleHasImportTag,
        // sampleCreatedBy は個人情報を含む可能性は低いが operator のみ。タグ有無のみ記録。
        alreadyImported,
      }),
    });

    if (alreadyImported) {
      expect(after, "members already >= 65").toBeGreaterThanOrEqual(EXPECTED_IMPORT_COUNT);
    } else {
      expect(after - baselineMembersCount, "delta == 65").toBe(EXPECTED_IMPORT_COUNT);
    }
    expect(sampleHasImportTag, "sample member.created_by contains [import: tag").toBe(true);
  });

  test("W-IM3C-EX-10: member-list が開く（read-only）", async ({ page }) => {
    await page.goto(PROD_URL + "?page=member-list", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const f = await getReadyFrame(page);
    expect(f, "member-list frame ready").not.toBeNull();
    const body = await f!.locator("body").textContent({ timeout: 10_000 });
    test.info().annotations.push({
      type: "member-list-open",
      description: JSON.stringify({ bodyLen: (body || "").length }),
    });
    expect(body || "").not.toContain("Exception");
    expect(body || "").not.toContain("ScriptError");
  });
});
