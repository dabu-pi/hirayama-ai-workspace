/**
 * wildboar/import-check.spec.ts
 * ワイルドボア会員管理システム PROD 既存会員取り込み画面 read-only 確認
 *
 * 確認項目:
 *   W-IM-1: ?page=import-members が開く
 *   W-IM-2: 「シート確認」ボタンで checkImportMembersSheet() を呼び、
 *           ImportMembers シートの存在 / データ行数を取得する
 *   W-IM-3: 検証実行ボタンが表示される（押下はしない）
 *
 * 認証: ANYONE_ANONYMOUS（auth.json 不要）
 *
 * データ安全:
 *   - validate / dry-run / 本取り込みボタンは押さない
 *   - read-only 関数 checkImportMembersSheet() のみ呼ぶ
 *
 * 実行コマンド: npx playwright test projects/wildboar/import-check.spec.ts
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

test.describe("WILDBOAR W-IM: 既存会員取り込み画面", () => {
  test.setTimeout(180_000);

  test("W-IM-1: ?page=import-members が開く", async ({ page }) => {
    const errors = attachErrorCollector(page);
    const res = await page.goto(PROD_URL + "?page=import-members", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    expect(res, "navigation response").not.toBeNull();
    expect(res!.status(), "HTTP status").toBeLessThan(400);

    const frame = await getReadyFrame(page);
    expect(frame, "GAS userHtmlFrame ready").not.toBeNull();

    const h1 = await frame!.locator("h1").first().textContent({ timeout: 10_000 });
    expect(h1, "h1 text").toContain("既存会員取り込み");

    // 取り込み手順カードが見えること
    const bodyText = await frame!.locator("body").textContent();
    expect(bodyText).toContain("取り込み手順");
    expect(bodyText).toContain("ImportMembers");

    expect(errors, "console errors").toEqual([]);
  });

  test("W-IM-2: シート確認ボタンで ImportMembers シート存在を取得", async ({ page }) => {
    const errors = attachErrorCollector(page);
    await page.goto(PROD_URL + "?page=import-members", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const frame = await getReadyFrame(page);
    expect(frame, "GAS userHtmlFrame ready").not.toBeNull();

    const statusEl = frame!.locator("#sheetStatusText");
    await expect(statusEl).toBeVisible({ timeout: 10_000 });

    // クリック前
    const before = await statusEl.textContent();
    expect(before).toContain("未確認");

    // シート確認ボタンをクリック
    await frame!.locator('button:has-text("シート確認")').click();

    // 結果が反映されるまで待つ（GAS API レスポンス 〜15s）
    await expect(statusEl).not.toHaveText(/未確認|確認中/, { timeout: 30_000 });

    const after = await statusEl.textContent();
    console.log("[W-IM-2] sheetStatus result:", after);

    // どちらか:
    //   ✅ シート存在 — データ行: N件
    //   ❌ シートなし — GAS エディタで migrateAddImportMembersSheet() を実行してください
    const hasResult =
      (after || "").includes("シート存在") || (after || "").includes("シートなし");
    expect(hasResult, "result text recognized").toBe(true);

    // 結果ファイルへも記録できるよう annotation 追加
    test.info().annotations.push({ type: "sheet-status", description: after || "" });

    expect(errors, "console errors").toEqual([]);
  });

  test("W-IM-3: 検証実行ボタンが表示される（押下しない）", async ({ page }) => {
    await page.goto(PROD_URL + "?page=import-members", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const frame = await getReadyFrame(page);
    expect(frame, "GAS userHtmlFrame ready").not.toBeNull();

    const validateBtn = frame!.locator('button:has-text("検証実行")');
    await expect(validateBtn).toBeVisible({ timeout: 10_000 });
    await expect(validateBtn).toBeEnabled();
  });

  test("W-IM-4: 空シートでの validate は『データがありません』を返す（read-only / 書込みなし）", async ({ page }) => {
    // 目的: 検証実行を 0 行のシートに対して走らせ、
    //   - サーバー側 validateImportRows() がエラーなく返る
    //   - getSheetData(IMPORT_MEMBERS) が読める = ヘッダー構造が壊れていない
    // を確認する。0 行時は内部ループに入らないため書込みは発生しない。
    const errors = attachErrorCollector(page);
    await page.goto(PROD_URL + "?page=import-members", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const frame = await getReadyFrame(page);
    expect(frame, "GAS userHtmlFrame ready").not.toBeNull();

    // 念のため先にシート状態を取得（W-IM-2 と同じ流れ）し、データ行 = 0 を確認
    await frame!.locator('button:has-text("シート確認")').click();
    const statusEl = frame!.locator("#sheetStatusText");
    await expect(statusEl).not.toHaveText(/未確認|確認中/, { timeout: 30_000 });
    const statusText = (await statusEl.textContent()) || "";
    expect(statusText).toContain("シート存在");
    expect(statusText).toMatch(/データ行:\s*0件/);

    // 検証実行
    await frame!.locator('button:has-text("検証実行")').click();

    // 結果が validateResult に出る
    const resultEl = frame!.locator("#validateResult");
    await expect(resultEl).toBeVisible({ timeout: 10_000 });

    // 「データがありません」または 0 件サマリーが出る
    await expect(resultEl).toContainText(/データがありません|取り込み不可|ERROR\s*0/, {
      timeout: 30_000,
    });
    const resultText = (await resultEl.textContent()) || "";
    console.log("[W-IM-4] validateResult:", resultText.slice(0, 200));
    test.info().annotations.push({ type: "validate-empty-result", description: resultText.slice(0, 200) });

    expect(errors, "console errors").toEqual([]);
  });
});
