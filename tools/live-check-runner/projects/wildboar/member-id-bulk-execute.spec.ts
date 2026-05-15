/**
 * wildboar/member-id-bulk-execute.spec.ts
 * Phase 14-4D: 既存 65 名 会員番号一括補正 実行機能（PROD read-only validation のみ）
 *
 * **重要:**
 *   - 本 spec は admin-section の存在 / 実行ボタンの visibility / readiness 表示
 *     を read-only で検証するのみ。
 *   - **実行ボタンを click しない**（オーナーが手動で 1 回だけ押す運用）。
 *   - 安全のため page.on('dialog') を貼り、万が一 confirm() が出たら必ず dismiss する。
 *
 * 確認項目:
 *   W-MBE-1: ?page=member-id-bulk-preview に admin-section（一括実行）が DOM 存在
 *   W-MBE-2: readiness OK のとき、対象一覧 + 実行ボタンが visible（hidden ではない）
 *   W-MBE-3: readiness NG のとき、blocker_reasons が表示され、実行ボタンが hidden
 *   W-MBE-4: 「halt-on-failure」「自動 rollback はありません」等の警告文言が表示される
 *   W-MBE-5: 結果モーダル（成功 / 失敗）の DOM 構造が定義されている
 *   W-MBE-6: 実行ボタンは絶対に click しない（spec が touch しないことを assert）
 *
 * 実行コマンド:
 *   npx playwright test projects/wildboar/member-id-bulk-execute.spec.ts --project=chromium
 */

import { test, expect, Page, Frame } from "@playwright/test";
import config from "./config.json";

const PROD_URL      = config.prodUrl;
const FRAME_TIMEOUT = 60_000;
const FRAME_NAME    = config.gasIframeConstraints.frameName;
const MIN_BODY_LEN  = config.gasIframeConstraints.frameReadyMinBodyLen;

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
      } catch (_) { /* frame detached — retry */ }
    }
    await page.waitForTimeout(800);
  }
  return null;
}

function isKnownGasWarning(text: string): boolean {
  return (
    text.includes("Framing") ||
    text.includes("ERR_BLOCKED_BY_ORB") ||
    text.includes("csp.withgoogle.com") ||
    text.includes("googleusercontent.com")
  );
}

function attachErrorCollector(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", msg => {
    if (msg.type() === "error" && !isKnownGasWarning(msg.text())) {
      errors.push("[CONSOLE] " + msg.text().slice(0, 200));
    }
  });
  page.on("pageerror", err => {
    errors.push("[PAGEERR] " + String(err.message).slice(0, 200));
  });
  return errors;
}

// 安全装置: confirm/alert ダイアログは常に dismiss
function attachDialogDismissor(page: Page): { count: number } {
  const counter = { count: 0 };
  page.on("dialog", async (dlg) => {
    counter.count++;
    try { await dlg.dismiss(); } catch (_) {}
  });
  return counter;
}

async function openPreviewPage(page: Page): Promise<Frame> {
  await page.goto(PROD_URL + "?page=member-id-bulk-preview", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  const frame = await getReadyFrame(page);
  expect(frame, "preview frame ready").not.toBeNull();
  await frame!.locator("#mainView").waitFor({ state: "visible", timeout: 60_000 });
  // readiness 取得後の admin-section 描画完了を少し待つ
  await frame!.locator("#adminBulkExecSection").waitFor({ state: "attached", timeout: 30_000 });
  // readiness の非同期完了を待つ（最大 30s）
  await frame!.waitForFunction(() => {
    const ready = document.getElementById("bulkExecReadyBlock");
    const block = document.getElementById("bulkBlockerBox");
    return (
      (ready && ready.style.display !== "none") ||
      (block && block.style.display !== "none")
    );
  }, null, { timeout: 30_000 }).catch(() => { /* タイムアウトしても test は続行 */ });
  return frame!;
}

test.describe("WILDBOAR W-MBE: 会員番号一括補正 実行 (Phase 14-4D / PROD read-only)", () => {
  test.setTimeout(240_000);

  test("W-MBE-1: admin-section（一括実行）が DOM 上に定義されている", async ({ page }) => {
    const dialogs = attachDialogDismissor(page);
    const errors = attachErrorCollector(page);
    const frame = await openPreviewPage(page);

    // admin-section が存在
    const exists = await frame.evaluate(() => !!document.getElementById("adminBulkExecSection"));
    expect(exists, "adminBulkExecSection should exist").toBe(true);

    // summary に「一括補正実行」「Phase 14-4D」を含む
    const summaryText = await frame.locator("#adminBulkExecSection summary").textContent();
    expect(summaryText || "").toContain("一括補正実行");
    expect(summaryText || "").toContain("Phase 14-4D");

    expect(dialogs.count, "no dialogs during this test").toBe(0);
    expect(errors, "console errors").toEqual([]);
  });

  test("W-MBE-2: 状況に応じて readyBlock or blockerBox のどちらかが表示される", async ({ page }) => {
    attachDialogDismissor(page);
    const frame = await openPreviewPage(page);

    // admin-section を開く
    await frame.locator("#adminBulkExecSection details").evaluate((el: HTMLDetailsElement) => { el.open = true; });

    const readyVisible = await frame.evaluate(() => {
      const el = document.getElementById("bulkExecReadyBlock");
      return el && el.style.display !== "none";
    });
    const blockVisible = await frame.evaluate(() => {
      const el = document.getElementById("bulkBlockerBox");
      return el && el.style.display !== "none";
    });

    // 必ずどちらか 1 つが表示されている (XOR)
    expect(readyVisible || blockVisible, "either ready or blocker visible").toBe(true);
    expect(readyVisible && blockVisible, "not both visible at same time").toBe(false);
  });

  test("W-MBE-3: readyBlock 表示時は実行ボタンが visible / blockerBox 表示時は hidden", async ({ page }) => {
    attachDialogDismissor(page);
    const frame = await openPreviewPage(page);
    await frame.locator("#adminBulkExecSection details").evaluate((el: HTMLDetailsElement) => { el.open = true; });

    const readyVisible = await frame.evaluate(() => {
      const el = document.getElementById("bulkExecReadyBlock");
      return el && el.style.display !== "none";
    });

    if (readyVisible) {
      // ボタンが見えていること（ただし click はしない）
      const btn = frame.locator("#bulkExecBtn");
      await expect(btn).toBeVisible();
      const btnText = await frame.locator("#bulkExecBtnLabel").textContent();
      expect(btnText || "", "button label includes 件数").toMatch(/^\d+\s*件/);
      // 対象一覧テーブルに 1 行以上
      const rowCount = await frame.locator("#bulkExecRows tr").count();
      expect(rowCount, "bulk exec target rows >= 1").toBeGreaterThanOrEqual(1);
    } else {
      // blocker のとき: ボタンが含まれる readyBlock 自体が hidden になっている → ボタンも非表示扱い
      const readyBlock = frame.locator("#bulkExecReadyBlock");
      await expect(readyBlock).toBeHidden();
      // blocker メッセージが表示されている
      const blockList = await frame.locator("#bulkBlockerList").textContent();
      expect((blockList || "").trim().length, "blocker list has text").toBeGreaterThan(0);
    }
  });

  test("W-MBE-4: admin-section 内に halt-on-failure / 自動 rollback なし 等の警告が表示される", async ({ page }) => {
    attachDialogDismissor(page);
    const frame = await openPreviewPage(page);
    await frame.locator("#adminBulkExecSection details").evaluate((el: HTMLDetailsElement) => { el.open = true; });

    const warnText = await frame.locator("#adminBulkExecSection .admin-warn-box").textContent();
    expect(warnText || "").toContain("halt-on-failure");
    expect(warnText || "", "should mention rollback").toMatch(/rollback|ロールバック/);
    expect(warnText || "", "should mention LockService or 並行書込").toMatch(/LockService|並行書込/);
  });

  test("W-MBE-5: 結果モーダル（成功・失敗パネル）が DOM 上に定義されている", async ({ page }) => {
    attachDialogDismissor(page);
    const frame = await openPreviewPage(page);

    const successExists = await frame.evaluate(() => !!document.getElementById("bulkResultSuccess"));
    const failedExists  = await frame.evaluate(() => !!document.getElementById("bulkResultFailed"));
    const overlayExists = await frame.evaluate(() => !!document.getElementById("bulkResultOverlay"));
    expect(successExists, "bulkResultSuccess should exist").toBe(true);
    expect(failedExists,  "bulkResultFailed should exist").toBe(true);
    expect(overlayExists, "bulkResultOverlay should exist").toBe(true);

    // 初期状態では overlay は hidden
    const overlayShown = await frame.evaluate(() => {
      const el = document.getElementById("bulkResultOverlay");
      if (!el) return false;
      return el.classList.contains("show");
    });
    expect(overlayShown, "overlay should NOT be shown initially").toBe(false);
  });

  test("W-MBE-6: 実行ボタンは clickしない（dialog が出ても dismiss する仕組み）", async ({ page }) => {
    const dialogs = attachDialogDismissor(page);
    const frame = await openPreviewPage(page);

    // テスト終了時点で dialog 発生件数が 0 件であること（spec が誤って click していない証跡）
    await page.waitForTimeout(2_000); // 各ハンドラのレース対策
    expect(dialogs.count, "no dialog should be triggered by this spec").toBe(0);
  });
});
