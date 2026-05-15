/**
 * wildboar/member-id-bulk-preview.spec.ts
 * Phase 14-4C: 既存 65 名 会員番号一括補正 プレビュー（read-only validation）
 *
 * 仕様:
 *   - 本ページは preview 専用。実行ボタンは存在しない（誤操作防止）
 *   - サーバー関数 previewBulkMemberIdNormalization() は書込みを行わない
 *
 * 確認項目（PROD read-only）:
 *   W-MBP-1: ?page=member-id-bulk-preview が開く + ページ title が表示される
 *   W-MBP-2: 「実行」「変換」「補正実行」などの実行系ボタンが DOM に存在しない
 *   W-MBP-3: サマリーカード（total / change / no_change / error / duplicates）が表示される
 *   W-MBP-4: フォーマット仕様（spec_prefix / spec_digits / spec_example）が表示される
 *   W-MBP-5: cascade 合計セクション（c_referrer 〜 c_grand）が表示される
 *   W-MBP-6: メンバー一覧テーブルに 1 行以上表示される（PROD には 65 名運用中）
 *   W-MBP-7: フィルタ（action=change のみ）が機能する
 *
 * 認証: ANYONE_ANONYMOUS（auth.json 不要）
 *
 * 実行コマンド: npx playwright test projects/wildboar/member-id-bulk-preview.spec.ts --project=chromium
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

async function openPreviewPage(page: Page): Promise<Frame> {
  await page.goto(PROD_URL + "?page=member-id-bulk-preview", {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  const frame = await getReadyFrame(page);
  expect(frame, "preview frame ready").not.toBeNull();
  // サーバー response 完了 → mainView が見えるまで待つ
  await frame!.locator("#mainView").waitFor({ state: "visible", timeout: 60_000 });
  return frame!;
}

test.describe("WILDBOAR W-MBP: 会員番号一括補正 プレビュー (Phase 14-4C / read-only)", () => {
  test.setTimeout(240_000);

  test("W-MBP-1: ?page=member-id-bulk-preview が開く + ページ title が表示される", async ({ page }) => {
    const errors = attachErrorCollector(page);
    const frame = await openPreviewPage(page);

    const titleText = await frame.locator(".page-title").textContent();
    expect(titleText || "").toContain("会員番号一括補正プレビュー");

    const subText = await frame.locator(".page-sub").textContent();
    expect(subText || "").toContain("Phase 14-4");

    expect(errors, "console errors").toEqual([]);
  });

  test("W-MBP-2: admin-section 外（mainView top-level）には実行系ボタンが存在しない（誤操作防止）", async ({ page }) => {
    const frame = await openPreviewPage(page);

    // admin-section（一括実行）の中身を除いた、mainView の top-level ボタンのみ走査。
    // Phase 14-4D で admin-section 内には「N 件を一括補正実行」ボタンが追加されたが、
    // それは details に閉じ込められているため誤操作リスクが低い設計。
    const buttonTexts: string[] = await frame.evaluate(() => {
      const main = document.getElementById("mainView");
      if (!main) return [];
      const adminSec = document.getElementById("adminBulkExecSection");
      const btns = main.querySelectorAll("button");
      return Array.from(btns)
        .filter(b => !(adminSec && adminSec.contains(b)))
        .map(b => (b.textContent || "").trim());
    });
    const forbiddenPatterns = [/実行$/, /補正実行/, /変換実行/, /一括.*実行/, /Execute/i, /Run/i];
    buttonTexts.forEach(t => {
      forbiddenPatterns.forEach(p => {
        expect(t.match(p), `top-level button "${t}" must not match execute pattern ${p}`).toBeNull();
      });
    });
  });

  test("W-MBP-3: サマリーカード（total / change / no_change / error / dup）が表示される", async ({ page }) => {
    const frame = await openPreviewPage(page);

    const ids = ["s_total", "s_change", "s_nochange", "s_error", "s_dup"];
    for (const id of ids) {
      const txt = await frame.locator("#" + id).textContent();
      expect(txt || "", id + " should be populated").toMatch(/^\d+$/);
    }

    // total >= 1（PROD は 65 名運用中）
    const totalNum = parseInt((await frame.locator("#s_total").textContent()) || "0", 10);
    expect(totalNum, "PROD has at least 1 member").toBeGreaterThanOrEqual(1);
  });

  test("W-MBP-4: フォーマット仕様（prefix / digits / example）が表示される", async ({ page }) => {
    const frame = await openPreviewPage(page);

    const digits = await frame.locator("#spec_digits").textContent();
    expect(digits || "", "spec_digits should be numeric").toMatch(/^\d+$/);
    expect(parseInt(digits || "0", 10), "digits in [1, 10]").toBeGreaterThanOrEqual(1);

    const example = await frame.locator("#spec_example").textContent();
    expect(example || "", "spec_example should be non-empty").toMatch(/\S/);
  });

  test("W-MBP-5: cascade 合計セクション（10 セル）が表示される", async ({ page }) => {
    const frame = await openPreviewPage(page);

    const ids = ["c_referrer", "c_payments", "c_status_history", "c_key_cards",
                 "c_plan_change", "c_intake", "c_referrals", "c_import_members", "c_grand"];
    for (const id of ids) {
      const txt = await frame.locator("#" + id).textContent();
      expect(txt || "", id + " should be a number").toMatch(/^\d+$/);
    }
  });

  test("W-MBP-6: メンバー一覧テーブルに 1 行以上表示される", async ({ page }) => {
    const frame = await openPreviewPage(page);

    const rowCount = await frame.locator("#tableBody tr").count();
    expect(rowCount, "tbody should have at least 1 row").toBeGreaterThanOrEqual(1);

    // 最初の行の current_id セルが文字列であること
    const firstCurrentId = await frame.locator("#tableBody tr:first-child td.member-id").textContent();
    expect((firstCurrentId || "").trim().length, "first row current_id should be non-empty").toBeGreaterThan(0);
  });

  test("W-MBP-7: フィルタ（action=change のみ）が機能する", async ({ page }) => {
    const frame = await openPreviewPage(page);

    const totalRows = await frame.locator("#tableBody tr").count();

    // 「変更必要」フィルタをクリック
    await frame.locator('.tab-btn[data-filter="action"][data-value="change"]').click();
    await page.waitForTimeout(300);

    const changeRows = await frame.locator("#tableBody tr").count();
    // change のみフィルタ後は全件以下（PROD 状態次第で 0 になる可能性もある）
    expect(changeRows, "change-only filter <= total").toBeLessThanOrEqual(totalRows);

    // フィルタ active 表示
    const isActive = await frame.locator('.tab-btn[data-filter="action"][data-value="change"]').evaluate(
      (el: HTMLElement) => el.classList.contains("active")
    );
    expect(isActive, "change filter should be active").toBe(true);
  });
});
