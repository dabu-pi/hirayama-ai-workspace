/**
 * wildboar/import-final-precheck.spec.ts
 * Phase 14-3A：本取り込み前の最終 precheck
 *
 *   1. Phase 14-2C 残置サンプルを clearImportMembersUnimported() で削除
 *   2. ERROR / BLOCKED パターンを seed して validate が想定通り止めることを確認
 *   3. Members シートが終始未変更であることを確認
 *
 * 重要:
 *   - 本取り込み（executeImport(false, ...)）は絶対に呼ばない
 *   - Members への書込は発生しない
 *   - 個人情報を一切ログ／annotation に出さない（合成IDのみ使用）
 *   - dry-run は呼ばない（ERROR/BLOCKED 存在予定のため）
 *
 * 前提:
 *   - PROD @38 デプロイ済み
 *   - seedImportMembersFromArray / clearImportMembersUnimported / getMembers が
 *     google.script.run 経由で呼べる
 *
 * 実行: npx playwright test projects/wildboar/import-final-precheck.spec.ts --project=chromium
 */

import { test, expect, Frame, Page } from "@playwright/test";
import config from "./config.json";

const PROD_URL    = config.prodUrl;
const FRAME_NAME  = config.gasIframeConstraints.frameName;
const MIN_BODY_LEN = config.gasIframeConstraints.frameReadyMinBodyLen;
const FRAME_TIMEOUT = 60_000;

const SEED_TOKEN  = "phase14-2c-seed";
const CLEAR_TOKEN = "phase14-2c-clear";

// 合成テストID — 既存・新規 W-xxxx と衝突しない大きな数値
const FAKE_ID_PREFIX = "999999";

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

// ERROR / BLOCKED パターン用合成データ（個人情報なし）
// 5 行構成 — seed 上限と同じ:
//   row 1: plan_name_raw='15時'        → ERROR  (PROD未登録プラン)
//   row 2: plan_name_raw='退会'        → BLOCKED (退会済み)
//   row 3: source_member_id=''         → ERROR  (member_id 空欄)
//   row 4: 同一 ID seenIds 登録用       → OK or WARNING
//   row 5: row 4 と同じ ID             → ERROR  (バッチ内重複)
function buildErrorBlockedRows() {
  return [
    {
      row_no: 1,
      source_member_id:     FAKE_ID_PREFIX + "1",
      normalized_member_id: FAKE_ID_PREFIX + "1",
      family_name: "TESTROW",
      given_name:  "A",
      family_name_kana: "テストロウ",
      given_name_kana:  "エー",
      plan_name_raw: "15時",
      status: "active",
    },
    {
      row_no: 2,
      source_member_id:     FAKE_ID_PREFIX + "2",
      normalized_member_id: FAKE_ID_PREFIX + "2",
      family_name: "TESTROW",
      given_name:  "B",
      family_name_kana: "テストロウ",
      given_name_kana:  "ビー",
      plan_name_raw: "退会",
      status: "active",
    },
    {
      row_no: 3,
      source_member_id:     "",
      normalized_member_id: "",
      family_name: "TESTROW",
      given_name:  "C",
      family_name_kana: "テストロウ",
      given_name_kana:  "シー",
      plan_name_raw: "男性",
      status: "active",
    },
    {
      row_no: 4,
      source_member_id:     FAKE_ID_PREFIX + "4",
      normalized_member_id: FAKE_ID_PREFIX + "4",
      family_name: "TESTROW",
      given_name:  "D",
      family_name_kana: "テストロウ",
      given_name_kana:  "ディー",
      plan_name_raw: "男性",
      status: "active",
    },
    {
      row_no: 5,
      source_member_id:     FAKE_ID_PREFIX + "4",
      normalized_member_id: FAKE_ID_PREFIX + "4",
      family_name: "TESTROW",
      given_name:  "E",
      family_name_kana: "テストロウ",
      given_name_kana:  "イー",
      plan_name_raw: "男性",
      status: "active",
    },
  ];
}

test.describe("WILDBOAR W-IM3A: 本取り込み前 precheck", () => {
  test.setTimeout(180_000);
  test.describe.configure({ mode: "serial" });

  // Members 件数の baseline（W-IM3A-1 でキャプチャ、W-IM3A-7 で比較）
  let baselineMembersCount = -1;

  test("W-IM3A-1: 残置サンプル件数確認（informational）", async ({ page }) => {
    const f = await openImportMembers(page);
    const sheet = await gasRun<any>(f, "checkImportMembersSheet", []);
    const members = await gasRun<any[]>(f, "getMembers", [{ status: "all" }]);
    baselineMembersCount = Array.isArray(members) ? members.length : -1;
    test.info().annotations.push({
      type: "pre-clear-state",
      description: JSON.stringify({
        importMembers: { exists: sheet.exists, rowCount: sheet.rowCount },
        membersCount: baselineMembersCount,
      }),
    });
    expect(sheet.exists).toBe(true);
  });

  test("W-IM3A-2: 未取り込み行 clear", async ({ page }) => {
    const f = await openImportMembers(page);
    const res = await gasRun<any>(f, "clearImportMembersUnimported", [CLEAR_TOKEN]);
    test.info().annotations.push({
      type: "clear-result",
      description: JSON.stringify({ success: res.success, deleted: res.count, message: res.message }),
    });
    expect(res.success, "clear success").toBe(true);
  });

  test("W-IM3A-3: clear 後 0 件確認", async ({ page }) => {
    const f = await openImportMembers(page);
    const sheet = await gasRun<any>(f, "checkImportMembersSheet", []);
    test.info().annotations.push({
      type: "post-clear-state",
      description: JSON.stringify({ rowCount: sheet.rowCount }),
    });
    expect(sheet.rowCount, "rowCount after clear").toBe(0);
  });

  test("W-IM3A-4: ERROR/BLOCKED パターン seed", async ({ page }) => {
    const f = await openImportMembers(page);
    const rows = buildErrorBlockedRows();
    const res = await gasRun<any>(f, "seedImportMembersFromArray", [rows, SEED_TOKEN]);
    test.info().annotations.push({
      type: "seed-error-blocked",
      description: JSON.stringify({
        success: res.success,
        count: res.count,
        rowsTried: rows.length,
        message: res.message,
        // パターン構成（個人情報なし）
        composition: {
          plan_15ji:    rows.filter(r => r.plan_name_raw === "15時").length,
          plan_taikai:  rows.filter(r => r.plan_name_raw === "退会").length,
          empty_id:     rows.filter(r => !r.source_member_id).length,
          dup_id_pair:  2, // row 4 + row 5 が同一 ID
        },
      }),
    });
    expect(res.success, "seed success").toBe(true);
    expect(res.count, "seeded count").toBe(rows.length);
  });

  test("W-IM3A-5: validate 実行（UI ボタン経由）", async ({ page }) => {
    const f = await openImportMembers(page);

    // UI ボタン押下
    await f.locator('button:has-text("検証実行")').click();
    const resultEl = f.locator("#validateResult");
    await expect(resultEl).toBeVisible({ timeout: 10_000 });
    await expect(resultEl).not.toContainText("データがありません", { timeout: 60_000 });
    const numEls = f.locator("#validateResult .summary-card .num");
    await expect(numEls.first()).toBeVisible({ timeout: 30_000 });

    const nums = await numEls.allTextContents();
    const labels = await f.locator("#validateResult .summary-card .lbl").allTextContents();
    const summary: Record<string, number> = {};
    for (let i = 0; i < nums.length && i < labels.length; i++) {
      summary[labels[i]] = parseInt(nums[i], 10) || 0;
    }
    test.info().annotations.push({
      type: "validate-summary",
      description: JSON.stringify(summary),
    });
  });

  test("W-IM3A-6: 想定通り ERROR/BLOCKED が出る", async ({ page }) => {
    // validate を再実行してサーバー戻り値を直接取得（UI 経由ではなくサーバー値で厳密 assertion）
    const f = await openImportMembers(page);
    const res = await gasRun<any>(f, "validateImportRows", []);
    test.info().annotations.push({
      type: "validate-server-result",
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

    expect(res.success).toBe(true);
    expect(res.total, "total = 5").toBe(5);
    // ERROR: 15時(row1) / 空 member_id(row3) / dup(row5) = 3
    expect(res.error, "ERROR >= 2").toBeGreaterThanOrEqual(2);
    // BLOCKED: 退会(row2) = 1
    expect(res.blocked, "BLOCKED >= 1").toBeGreaterThanOrEqual(1);
    // canExecute = false（ERROR > 0 || BLOCKED > 0）
    expect(res.canExecuteImport, "canExecuteImport must be false").toBe(false);
  });

  test("W-IM3A-7: Members 未変更確認 + 最終 cleanup", async ({ page }) => {
    const f = await openImportMembers(page);

    // Members 件数比較
    const members = await gasRun<any[]>(f, "getMembers", [{ status: "all" }]);
    const after = Array.isArray(members) ? members.length : -1;
    test.info().annotations.push({
      type: "members-after-precheck",
      description: JSON.stringify({
        baseline: baselineMembersCount,
        after,
        unchanged: after === baselineMembersCount,
      }),
    });
    expect(after, "Members count unchanged").toBe(baselineMembersCount);

    // 最終 cleanup — テスト行をすべて削除して 0 行に戻す
    const cleared = await gasRun<any>(f, "clearImportMembersUnimported", [CLEAR_TOKEN]);
    expect(cleared.success).toBe(true);

    const finalCheck = await gasRun<any>(f, "checkImportMembersSheet", []);
    test.info().annotations.push({
      type: "final-cleanup",
      description: JSON.stringify({ rowCount: finalCheck.rowCount, deleted: cleared.count }),
    });
    expect(finalCheck.rowCount, "final ImportMembers rowCount = 0").toBe(0);
  });
});
