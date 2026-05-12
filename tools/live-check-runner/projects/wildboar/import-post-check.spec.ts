/**
 * wildboar/import-post-check.spec.ts
 * Phase 14-3C-Prep：本取り込み後の確認 spec ドラフト
 *
 * 役割:
 *   Phase 14-3 本取り込み実施 *後* に走らせる検証 spec。
 *   本 Phase 14-3C-Prep 時点では一部のテストは pre-import baseline 値が取れる
 *   だけで、imported / member detail / AuditLog の確認は本取り込み後にしか
 *   検証できないため、対応するテストは `test.skip(true, ...)` で明示的に
 *   skip する。
 *
 * 重要:
 *   - 個人情報を annotation / report / docs に書かない
 *   - 本取り込み（executeImport(false, '既存会員を取り込む')）は呼ばない
 *   - 本 spec は read-only。Members / ImportMembers を変更しない
 *
 * 想定される使い方:
 *   1. Phase 14-3 で本取り込みを実行（別 spec / 別プロンプト・明示許可後）
 *   2. その直後に本 spec を走らせ、SKIP していたテストを enabled にして実行
 *
 * 実行: npx playwright test projects/wildboar/import-post-check.spec.ts --project=chromium
 */

import { test, expect, Frame, Page } from "@playwright/test";
import config from "./config.json";

const PROD_URL    = config.prodUrl;
const FRAME_NAME  = config.gasIframeConstraints.frameName;
const MIN_BODY_LEN = config.gasIframeConstraints.frameReadyMinBodyLen;
const FRAME_TIMEOUT = 60_000;

// 本取り込み実施フラグ。Phase 14-3 で本取り込みを実行したらこれを true にしてから
// spec を走らせる（または別の env から取る）。
//
// 既定: false（本取り込み未実施として、imported 系テストを skip）
const IMPORT_EXECUTED = false;

async function getReadyFrame(page: Page, minLen = MIN_BODY_LEN): Promise<Frame | null> {
  const deadline = Date.now() + FRAME_TIMEOUT;
  while (Date.now() < deadline) {
    const frame = page.frame({ name: FRAME_NAME });
    if (frame && frame.url().includes("googleusercontent.com")) {
      try {
        const len = await frame.evaluate(() =>
          document.body ? document.body.innerHTML.length : 0
        );
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

async function openPage(page: Page, slug: string): Promise<Frame> {
  await page.goto(PROD_URL + slug, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  const f = await getReadyFrame(page);
  expect(f, `GAS frame ready for ${slug}`).not.toBeNull();
  return f!;
}

// ── テスト本体 ───────────────────────────────────────────────────────────

test.describe("WILDBOAR W-IM3C: post-import 検証", () => {
  test.setTimeout(180_000);
  test.describe.configure({ mode: "serial" });

  // baseline（pre-import）件数。Phase 14-3C-Prep 時点では 0 のはず。
  let baselineMembersCount = -1;
  let baselineActiveCount = -1;
  let baselinePausedCount = -1;

  test("W-IM3C-1: member-list が開く（read-only）", async ({ page }) => {
    const f = await openPage(page, "?page=member-list");
    const body = await f.locator("body").textContent({ timeout: 10_000 });
    test.info().annotations.push({
      type: "member-list-open",
      description: JSON.stringify({ bodyLen: (body || "").length }),
    });
    // 致命エラー文字列が出ていないこと
    expect(body).not.toContain("Exception");
    expect(body).not.toContain("ScriptError");
  });

  test("W-IM3C-2: Members 件数が取り込み分だけ増えた", async ({ page }) => {
    const f = await openPage(page, "?page=home");
    const members = await gasRun<any[]>(f, "getMembers", [{ status: "all" }]);
    baselineMembersCount = Array.isArray(members) ? members.length : -1;
    baselineActiveCount  = members.filter((m: any) => m.status === "active").length;
    baselinePausedCount  = members.filter((m: any) => m.status === "paused").length;

    test.info().annotations.push({
      type: "members-count",
      description: JSON.stringify({
        importExecuted: IMPORT_EXECUTED,
        total:  baselineMembersCount,
        active: baselineActiveCount,
        paused: baselinePausedCount,
      }),
    });

    if (!IMPORT_EXECUTED) {
      test.skip(true, "本取り込み未実施のため imported 件数は確認不可。pre-import baseline のみ記録した。");
      return;
    }

    // 本取り込み後の期待値: Phase 14-3 取込予定 65 件以上が追加されている
    // Phase 14-3 実行時に確定する数値に合わせて調整する
    expect(baselineMembersCount, "Members count after import").toBeGreaterThanOrEqual(65);
  });

  test("W-IM3C-3: 取り込み代表会員の member-detail が開く", async ({ page }) => {
    if (!IMPORT_EXECUTED) {
      test.skip(true, "本取り込み未実施のため member-detail サンプル選択不可。");
      return;
    }
    // 取り込まれた会員の member_id 一つを選び member-detail を開く
    const f1 = await openPage(page, "?page=home");
    const members = await gasRun<any[]>(f1, "getMembers", [{ status: "active" }]);
    expect(Array.isArray(members) && members.length > 0).toBe(true);
    const sampleId = String((members[0] as any).member_id);

    const f2 = await openPage(page, "?page=member-detail&id=" + encodeURIComponent(sampleId));
    const body = await f2.locator("body").textContent({ timeout: 10_000 });
    expect(body).not.toContain("Exception");
    expect(body).not.toContain("ScriptError");
    test.info().annotations.push({
      type: "member-detail-open",
      description: JSON.stringify({ bodyLen: (body || "").length }),
    });
  });

  test("W-IM3C-4: active 会員の status / plan 表示確認", async ({ page }) => {
    if (!IMPORT_EXECUTED) {
      test.skip(true, "本取り込み未実施のため active 件数 assertion 不可。");
      return;
    }
    const f = await openPage(page, "?page=home");
    const members = await gasRun<any[]>(f, "getMembers", [{ status: "active" }]);
    const planSet = new Set(members.map((m: any) => String(m.plan_id || "")));
    test.info().annotations.push({
      type: "active-members",
      description: JSON.stringify({
        count: members.length,
        distinctPlanIds: planSet.size,
      }),
    });
    // Phase 14-3 実行後の期待値（active 概ね 51 件想定）
    expect(members.length, "active count").toBeGreaterThanOrEqual(40);
  });

  test("W-IM3C-5: paused 会員が休会扱いで表示される", async ({ page }) => {
    if (!IMPORT_EXECUTED) {
      test.skip(true, "本取り込み未実施のため paused 件数 assertion 不可。");
      return;
    }
    const f = await openPage(page, "?page=home");
    const members = await gasRun<any[]>(f, "getMembers", [{ status: "paused" }]);
    test.info().annotations.push({
      type: "paused-members",
      description: JSON.stringify({ count: members.length }),
    });
    // Phase 14-3B baseline では 14 件想定
    expect(members.length, "paused count").toBeGreaterThanOrEqual(10);
  });

  test("W-IM3C-6: monthly-dashboard が開く（read-only）", async ({ page }) => {
    const f = await openPage(page, "?page=monthly-dashboard");
    const body = await f.locator("body").textContent({ timeout: 10_000 });
    test.info().annotations.push({
      type: "monthly-dashboard-open",
      description: JSON.stringify({ bodyLen: (body || "").length }),
    });
    expect(body).not.toContain("Exception");
    expect(body).not.toContain("ScriptError");
  });

  test("W-IM3C-7: billing dashboard / payment-list が開く（read-only）", async ({ page }) => {
    // PROD WebApp の billing 系は ?page=billing
    const f = await openPage(page, "?page=billing");
    const body = await f.locator("body").textContent({ timeout: 10_000 });
    test.info().annotations.push({
      type: "billing-open",
      description: JSON.stringify({ bodyLen: (body || "").length }),
    });
    expect(body).not.toContain("Exception");
    expect(body).not.toContain("ScriptError");
  });

  test("W-IM3C-8: smoke 主要導線（既存 smoke.spec.ts に委譲）", async () => {
    // 本 spec の責任範囲外。本取り込み後は別途
    //   npm run test:wildboar:prod   (smoke.spec.ts 全件)
    // を回す。
    test.skip(true, "smoke は既存 smoke.spec.ts で実施。本取り込み後に別途実行する。");
  });

  test("W-IM3C-9: ImportMembers に imported 情報が記録される", async ({ page }) => {
    if (!IMPORT_EXECUTED) {
      test.skip(true, "本取り込み未実施のため imported_member_id / imported_at は空。");
      return;
    }
    const f = await openPage(page, "?page=import-members");
    const validate = await gasRun<any>(f, "validateImportRows", []);
    let importedRows = 0;
    let importedIdRows = 0;
    let importedAtRows = 0;
    let batchIdRows = 0;
    for (const r of (validate.rows || [])) {
      if (String(r.import_status || "") === "imported") importedRows++;
      if (String(r.imported_member_id || "") !== "") importedIdRows++;
      if (String(r.imported_at || "") !== "") importedAtRows++;
      if (String(r.import_batch_id || "") !== "") batchIdRows++;
    }
    test.info().annotations.push({
      type: "import-members-imported-flags",
      description: JSON.stringify({
        importedRows, importedIdRows, importedAtRows, batchIdRows,
      }),
    });
    expect(importedRows, "imported rows > 0").toBeGreaterThan(0);
    expect(importedRows, "imported_id rows == imported rows").toBe(importedIdRows);
  });

  test("W-IM3C-10: AuditLogs に MEMBER_IMPORT が記録される", async () => {
    if (!IMPORT_EXECUTED) {
      test.skip(true, "本取り込み未実施のため AuditLogs に MEMBER_IMPORT は存在しない。");
      return;
    }
    // AuditLogs を直接読む read-only API がなければ、本テストは
    // GAS 側の getAuditLogs / 同等エンドポイント追加後に有効化する。
    test.skip(true, "AuditLogs read API は未配備。Phase 14-3C 実行時にメソッド追加または手動確認。");
  });
});
