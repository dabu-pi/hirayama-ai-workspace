/**
 * wildboar/import-state-probe.spec.ts
 * Phase 14-3 緊急: ImportMembers / Members の現在状態を read-only で取得。
 * 個人情報は出さず、件数・status バケット・batchId のみ annotation する。
 */
import { test, expect, Frame, Page } from "@playwright/test";
import config from "./config.json";

const PROD_URL = config.prodUrl;
const FRAME_NAME = config.gasIframeConstraints.frameName;
const MIN_BODY_LEN = config.gasIframeConstraints.frameReadyMinBodyLen;

async function getReadyFrame(page: Page): Promise<Frame | null> {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const f = page.frame({ name: FRAME_NAME });
    if (f && f.url().includes("googleusercontent.com")) {
      try {
        const len = await f.evaluate(() => document.body ? document.body.innerHTML.length : 0);
        if (len > MIN_BODY_LEN) return f;
      } catch (_) { }
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
        w.google.script.run
          .withSuccessHandler((r: any) => resolve(r))
          .withFailureHandler((e: any) => reject(new Error(e ? e.message : "GAS error")))
          [fnName].apply(null, args);
      });
    },
    { fnName, args },
  );
}

test("W-PROBE: ImportMembers + Members + sample created_by/batchId", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto(PROD_URL + "?page=import-members", { waitUntil: "domcontentloaded" });
  const f = await getReadyFrame(page);
  expect(f).not.toBeNull();

  const sheet = await gasRun<any>(f!, "checkImportMembersSheet", []);
  const members = await gasRun<any[]>(f!, "getMembers", [{ status: "all" }]);

  const memberStatusBuckets: Record<string, number> = {};
  const memberDataTypeBuckets: Record<string, number> = {};
  for (const m of members as any[]) {
    memberStatusBuckets[String(m.status)] = (memberStatusBuckets[String(m.status)] || 0) + 1;
    memberDataTypeBuckets[String(m.member_data_type)] = (memberDataTypeBuckets[String(m.member_data_type)] || 0) + 1;
  }

  // 先頭 1 件の member_id だけ取り出し、その full record を getMemberById で取得
  // → created_by に "[import:IMP-...]" が入っていれば batchId 経由でトラッカブル
  let sampleHasImportTag = false;
  let sampleBatchId = "";
  if (members.length > 0) {
    const sampleId = String((members[0] as any).member_id || "");
    const full = await gasRun<any>(f!, "getMemberById", [sampleId]);
    const createdBy = String((full && full.created_by) || "");
    const m = createdBy.match(/\[import:(IMP-\d{8}-\d{3})\]/);
    if (m) {
      sampleHasImportTag = true;
      sampleBatchId = m[1];
    }
  }

  let importStatusBuckets: Record<string, number> = {};
  if (sheet.rowCount > 0) {
    const v = await gasRun<any>(f!, "validateImportRows", []);
    for (const r of (v.rows || [])) {
      const st = String(r.import_status || "");
      importStatusBuckets[st || "empty"] = (importStatusBuckets[st || "empty"] || 0) + 1;
    }
  }

  test.info().annotations.push({
    type: "PROBE",
    description: JSON.stringify({
      importMembers: { rowCount: sheet.rowCount, importStatusBuckets },
      members: {
        total: members.length,
        statusBuckets: memberStatusBuckets,
        dataType: memberDataTypeBuckets,
      },
      sample: { hasImportTag: sampleHasImportTag, batchId: sampleBatchId },
    }),
  });

  console.log("PROBE_RESULT:", JSON.stringify({
    importMembers: sheet.rowCount,
    members: members.length,
    sampleHasImportTag,
    sampleBatchId,
  }));
});
