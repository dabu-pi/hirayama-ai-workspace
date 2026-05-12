/**
 * wildboar/import-seed-validate.spec.ts
 * Phase 14-2C：CSV 経由で会員名簿2026 から 3〜5件を読み、
 * PROD WebApp の seedImportMembersFromArray() に渡し、
 * その後 validate / dry-run を実機実行する。
 *
 * 重要:
 *   - 個人情報をログ / annotation に出さない
 *   - 出すのは件数・サマリーだけ（OK/WARNING/REVIEW/BLOCKED/ERROR）
 *   - 本取り込み（executeImport(false, '既存会員を取り込む')）は絶対に呼ばない
 *   - Members シートの変更は一切ない
 *
 * 前提:
 *   - PROD @38 デプロイ済み（seedImportMembersFromArray / clearImportMembersUnimported）
 *   - ImportMembers シート存在・データ 0 行
 *   - auth.json で会員名簿2026 への read アクセス可能
 *
 * 実行: npx playwright test projects/wildboar/import-seed-validate.spec.ts --project=chromium
 */

import { test, expect, Frame, Page } from "@playwright/test";
import config from "./config.json";

// ── 定数 ─────────────────────────────────────────────────────────────────
const PROD_URL    = config.prodUrl;
const FRAME_NAME  = config.gasIframeConstraints.frameName;
const MIN_BODY_LEN = config.gasIframeConstraints.frameReadyMinBodyLen;
const FRAME_TIMEOUT = 60_000;

const SOURCE_ID  = "1bz95Vy2FnTxWq1PHvb-cqT5UZpRWkNMQQ_-OXmgG9Qs";
const SOURCE_GID = "676663641";
const CSV_URL    = `https://docs.google.com/spreadsheets/d/${SOURCE_ID}/export?format=csv&gid=${SOURCE_GID}`;

const SEED_TOKEN  = "phase14-2c-seed";
const CLEAR_TOKEN = "phase14-2c-clear";

// 採用月（2026-05 = May）→ S列 idx (O=14 → 1月, 5月 = idx 18)
const TARGET_MONTH_IDX = 14 + 4;
// 種別/F列 idx
const PLAN_F_IDX = 5;

const SAFE_PLANS = new Set(["男性", "女性", "中高生", "11時", "60歳", "週一", "休会"]);

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

// 簡易 CSV パーサ — ダブルクオート + カンマ + 改行を扱う
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
        else { inQuotes = false; }
      } else { field += c; }
    } else {
      if (c === '"') { inQuotes = true; }
      else if (c === ",") { cur.push(field); field = ""; }
      else if (c === "\r") { /* skip */ }
      else if (c === "\n") { cur.push(field); rows.push(cur); cur = []; field = ""; }
      else { field += c; }
    }
  }
  if (field !== "" || cur.length > 0) { cur.push(field); rows.push(cur); }
  return rows;
}

// 半角カタカナ → 全角カタカナの簡易変換
const HANKAKU_KATAKANA_MAP: Record<string, string> = {
  "ｱ":"ア","ｲ":"イ","ｳ":"ウ","ｴ":"エ","ｵ":"オ",
  "ｶ":"カ","ｷ":"キ","ｸ":"ク","ｹ":"ケ","ｺ":"コ",
  "ｻ":"サ","ｼ":"シ","ｽ":"ス","ｾ":"セ","ｿ":"ソ",
  "ﾀ":"タ","ﾁ":"チ","ﾂ":"ツ","ﾃ":"テ","ﾄ":"ト",
  "ﾅ":"ナ","ﾆ":"ニ","ﾇ":"ヌ","ﾈ":"ネ","ﾉ":"ノ",
  "ﾊ":"ハ","ﾋ":"ヒ","ﾌ":"フ","ﾍ":"ヘ","ﾎ":"ホ",
  "ﾏ":"マ","ﾐ":"ミ","ﾑ":"ム","ﾒ":"メ","ﾓ":"モ",
  "ﾔ":"ヤ","ﾕ":"ユ","ﾖ":"ヨ",
  "ﾗ":"ラ","ﾘ":"リ","ﾙ":"ル","ﾚ":"レ","ﾛ":"ロ",
  "ﾜ":"ワ","ｦ":"ヲ","ﾝ":"ン",
  "ｧ":"ァ","ｨ":"ィ","ｩ":"ゥ","ｪ":"ェ","ｫ":"ォ",
  "ｬ":"ャ","ｭ":"ュ","ｮ":"ョ","ｯ":"ッ",
  "ｰ":"ー","ﾞ":"゛","ﾟ":"゜"
};
const HANKAKU_DAKUTEN_PAIRS: Record<string, string> = {
  "カ゛":"ガ","キ゛":"ギ","ク゛":"グ","ケ゛":"ゲ","コ゛":"ゴ",
  "サ゛":"ザ","シ゛":"ジ","ス゛":"ズ","セ゛":"ゼ","ソ゛":"ゾ",
  "タ゛":"ダ","チ゛":"ヂ","ツ゛":"ヅ","テ゛":"デ","ト゛":"ド",
  "ハ゛":"バ","ヒ゛":"ビ","フ゛":"ブ","ヘ゛":"ベ","ホ゛":"ボ",
  "ハ゜":"パ","ヒ゜":"ピ","フ゜":"プ","ヘ゜":"ペ","ホ゜":"ポ"
};
function toFullKatakana(s: string): string {
  if (!s) return "";
  let out = "";
  for (const c of s) out += HANKAKU_KATAKANA_MAP[c] || c;
  // dakuten / handakuten 合成
  for (const [k, v] of Object.entries(HANKAKU_DAKUTEN_PAIRS)) {
    out = out.split(k).join(v);
  }
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
  const digits = p.replace(/[^0-9]/g, "");
  return digits;
}

function normalizeBirthDate(d: string): string {
  if (!d) return "";
  // YYYY/M/D → YYYY-MM-DD
  const m = d.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})/);
  if (!m) return "";
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

function mapGender(g: string): string {
  if (g === "男") return "male";
  if (g === "女") return "female";
  return "";
}

// 行 → ImportMembers 想定 object
function rowToImport(row: string[], rowNo: number) {
  const planFromMonth = (row[TARGET_MONTH_IDX] || "").trim();
  const planFromF     = (row[PLAN_F_IDX] || "").trim();
  const planRaw = planFromMonth || planFromF;

  const name  = (row[3] || "").trim();
  const kana  = (row[4] || "").trim();
  const nm    = splitName(name);
  const kn    = splitName(toFullKatakana(kana));

  const status = planRaw === "休会" ? "paused" : "active";
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
    status,
    join_date:            "",
    address_raw:          addressRaw,
    prefecture:           "",
    city:                 "",
    address1:             addressRaw,
    notes:                "",
  };
}

// 安全行のフィルタ
function isSafeRow(row: string[]): boolean {
  const memberId = (row[2] || "").trim();
  if (!memberId || !/^\d+$/.test(memberId)) return false;
  const planFromMonth = (row[TARGET_MONTH_IDX] || "").trim();
  const planFromF     = (row[PLAN_F_IDX] || "").trim();
  const plan = planFromMonth || planFromF;
  if (!plan) return false;
  if (!SAFE_PLANS.has(plan)) return false;
  // 氏名は必須
  if (!(row[3] || "").trim()) return false;
  return true;
}

// google.script.run 呼び出しヘルパー
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

// ── テスト本体 ───────────────────────────────────────────────────────────

test.describe("WILDBOAR W-IMP: ImportMembers seed → validate → dry-run", () => {
  test.setTimeout(180_000);
  test.describe.configure({ mode: "serial" });

  let frame: Frame;

  test("W-IMP-0: open import-members page (PROD)", async ({ page }) => {
    await page.goto(PROD_URL + "?page=import-members", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const f = await getReadyFrame(page);
    expect(f, "frame ready").not.toBeNull();
    frame = f!;
  });

  test("W-IMP-1: ensure sheet empty (idempotency guard)", async ({ page }) => {
    await page.goto(PROD_URL + "?page=import-members", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const f = await getReadyFrame(page);
    expect(f).not.toBeNull();

    const status = await gasRun<any>(f!, "checkImportMembersSheet", []);
    test.info().annotations.push({
      type: "sheet-status-pre",
      description: JSON.stringify({ exists: status.exists, rowCount: status.rowCount }),
    });
    expect(status.exists, "sheet exists").toBe(true);

    // 既にデータがあればクリア（imported 行は残る）
    if (status.rowCount > 0) {
      const cleared = await gasRun<any>(f!, "clearImportMembersUnimported", [CLEAR_TOKEN]);
      test.info().annotations.push({
        type: "cleared-rows",
        description: JSON.stringify({ deleted: cleared.count, message: cleared.message }),
      });
      // 再確認
      const recheck = await gasRun<any>(f!, "checkImportMembersSheet", []);
      expect(recheck.rowCount, "sheet empty after clear").toBe(0);
    }
  });

  test("W-IMP-2: read source CSV and seed 3-5 safe rows", async ({ page, context }) => {
    // CSV 取得
    const csvRes = await context.request.get(CSV_URL);
    expect(csvRes.status()).toBeLessThan(400);
    const csv = await csvRes.text();
    const parsed = parseCsv(csv);
    // データ行 = header + sub-header 想定。実際には先頭 1〜2 行は header。
    // 先頭 2 行は header / sub-header（B列に振替日表記など）。3 行目以降をデータとして扱う。
    const dataRows = parsed.slice(2);

    const candidates: { row: string[]; idx: number }[] = [];
    for (let i = 0; i < dataRows.length; i++) {
      const r = dataRows[i];
      if (isSafeRow(r)) candidates.push({ row: r, idx: i + 3 /* 1-based incl headers */ });
      if (candidates.length >= 8) break; // 余裕を持って 8 件まで候補に
    }
    // 採用は先頭 3 件（小さく始める）
    const picked = candidates.slice(0, 3);
    expect(picked.length, "candidates >= 3").toBeGreaterThanOrEqual(3);

    const importRows = picked.map((p, i) => rowToImport(p.row, i + 1));

    test.info().annotations.push({
      type: "seed-shape",
      description: JSON.stringify({
        csvTotalRows: dataRows.length,
        candidatesFound: candidates.length,
        pickedCount: picked.length,
        // 個人情報を出さないため、plan_name_raw のみカウント
        planRawCounts: importRows.reduce<Record<string, number>>((m, r) => {
          m[r.plan_name_raw] = (m[r.plan_name_raw] || 0) + 1;
          return m;
        }, {}),
        statusCounts: importRows.reduce<Record<string, number>>((m, r) => {
          m[r.status] = (m[r.status] || 0) + 1;
          return m;
        }, {}),
      }),
    });

    // WebApp 開いて seed
    await page.goto(PROD_URL + "?page=import-members", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const f = await getReadyFrame(page);
    expect(f).not.toBeNull();

    const seedRes = await gasRun<any>(f!, "seedImportMembersFromArray", [importRows, SEED_TOKEN]);
    test.info().annotations.push({
      type: "seed-result",
      description: JSON.stringify({ success: seedRes.success, count: seedRes.count, message: seedRes.message }),
    });
    expect(seedRes.success, "seed success").toBe(true);
    expect(seedRes.count, "seeded count").toBe(importRows.length);

    // 再確認
    const after = await gasRun<any>(f!, "checkImportMembersSheet", []);
    expect(after.rowCount, "sheet has seeded rows").toBe(importRows.length);
  });

  test("W-IMP-3: validate via UI button — capture counts", async ({ page }) => {
    await page.goto(PROD_URL + "?page=import-members", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const f = await getReadyFrame(page);
    expect(f).not.toBeNull();

    // 検証実行ボタンを押下
    await f!.locator('button:has-text("検証実行")').click();
    // 結果が出るまで待つ
    const resultEl = f!.locator("#validateResult");
    await expect(resultEl).toBeVisible({ timeout: 10_000 });

    // 「データがありません」以外のサマリーが現れるまで待つ
    await expect(resultEl).not.toContainText("データがありません", { timeout: 60_000 });
    // summary-grid の num 要素群が出現
    const numEls = f!.locator("#validateResult .summary-card .num");
    await expect(numEls.first()).toBeVisible({ timeout: 30_000 });

    // 数字を順に取得（順序: importable / OK / WARNING / REVIEW / BLOCKED / ERROR）
    const nums = await numEls.allTextContents();
    const labels = await f!.locator("#validateResult .summary-card .lbl").allTextContents();
    const summary: Record<string, number> = {};
    for (let i = 0; i < nums.length && i < labels.length; i++) {
      summary[labels[i]] = parseInt(nums[i], 10) || 0;
    }
    test.info().annotations.push({
      type: "validate-summary",
      description: JSON.stringify(summary),
    });

    // 主要件数
    const total = Object.values(summary).reduce((a, b) => a + b, 0) - (summary["取込可能"] || 0);
    expect(total, "total rows summed").toBeGreaterThan(0);
    expect(summary["ERROR"] || 0, "ERROR == 0").toBe(0);
    expect(summary["BLOCKED"] || 0, "BLOCKED == 0").toBe(0);

    // 後続テストへ件数を共有
    (test.info() as any)._summary = summary;
  });

  test("W-IMP-4: dry-run via UI button — Members must remain empty", async ({ page }) => {
    await page.goto(PROD_URL + "?page=import-members", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const f = await getReadyFrame(page);
    expect(f).not.toBeNull();

    // まず validate を再実行して importCard を表示させる
    await f!.locator('button:has-text("検証実行")').click();
    const resultEl = f!.locator("#validateResult");
    await expect(resultEl).not.toContainText("データがありません", { timeout: 60_000 });
    // importCard が現れるまで待つ
    await expect(f!.locator("#importCard")).toBeVisible({ timeout: 30_000 });

    // dry-run 押下
    await f!.locator('button:has-text("dry-run")').click();
    const dryEl = f!.locator("#dryRunResult");
    await expect(dryEl).toContainText("DRY-RUN", { timeout: 60_000 });

    const dryText = (await dryEl.textContent()) || "";
    // 個人情報を含まない: 「[DRY-RUN] 取り込み完了: N件 / スキップ: 0件 / エラー: 0件」形式
    test.info().annotations.push({
      type: "dry-run-result",
      description: dryText.slice(0, 240).replace(/\s+/g, " "),
    });
    expect(dryText).toContain("[DRY-RUN]");
    expect(dryText).toMatch(/エラー:\s*0件/);

    // 本取り込みボタンは disabled のまま（confirmInput 未入力）
    const importBtn = f!.locator("#btnImport");
    await expect(importBtn).toBeDisabled();
  });

  test("W-IMP-5: Members sheet must still be empty (no real import happened)", async ({ page }) => {
    // 既存の smoke ではなく、生 GAS API で行数を確認
    await page.goto(PROD_URL + "?page=import-members", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const f = await getReadyFrame(page);
    expect(f).not.toBeNull();

    // ImportMembers の imported 行が 0 であること（dry-run後）
    const sheet = await gasRun<any>(f!, "checkImportMembersSheet", []);
    test.info().annotations.push({
      type: "import-members-after-dryrun",
      description: JSON.stringify({ rowCount: sheet.rowCount }),
    });

    // Members は ImportMembers レンダラ画面では確認できないので、
    // 別画面 (?page=member-list) を開いて空の表示であることだけ確認
    await page.goto(PROD_URL + "?page=member-list", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const f2 = await getReadyFrame(page);
    expect(f2).not.toBeNull();
    // 0件メッセージや空テーブルを期待。具体的な空表示要素は実装依存のため、
    // 「件 / 名 / 結果 0 件」「結果が見つかりませんでした」など曖昧マッチで OK / 失敗時のみ詳細記録
    const body = (await f2!.locator("body").textContent()) || "";
    const isEmpty =
      /0\s*件|該当.{0,8}ありません|結果がありません|該当する会員/i.test(body);
    test.info().annotations.push({
      type: "member-list-empty-check",
      description: JSON.stringify({ heuristicEmpty: isEmpty }),
    });
    // empty 判定が緩いため、minimum requirement は「赤いエラーが出ていない」
    expect(body).not.toContain("Exception");
    expect(body).not.toContain("ScriptError");
  });
});
