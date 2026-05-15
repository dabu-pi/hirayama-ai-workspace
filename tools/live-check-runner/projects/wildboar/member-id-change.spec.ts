/**
 * wildboar/member-id-change.spec.ts
 * Phase 14-4B (2026-05-15 update): 会員番号修正機能 read-only バリデーション確認
 *
 * 仕様（運用に合わせた更新）:
 *   - 入力は数字のみ（^\d+$）/ アルファベットは NG
 *   - 保存形式は Settings.member_id_digits 桁のゼロ埋め（例: 4 桁 → `0001`）
 *   - 重複は数値として比較（既存 `1` と新規 `0001` は同一扱い）
 *   - 変更理由は不要（入力欄なし / 任意）
 *
 * 確認項目（PROD read-only）:
 *   W-MIC-1: 取込会員の ?page=member-detail に admin-section 「会員番号修正」が表示される
 *   W-MIC-2: 「会員番号を修正する」ボタン押下でダイアログが開く
 *   W-MIC-3: 新 ID 入力欄 + プレースホルダー=数字 / ヒント="数字のみ" / 理由欄は存在しない
 *   W-MIC-4: 空欄で「影響範囲を確認」→ ローカル/サーバーで「新しい会員番号を入力してください」
 *   W-MIC-5: アルファベット入り `abc` → サーバー response で「形式が不正」
 *   W-MIC-6: 既存会員と数値が重複する番号 → 「既に使用」 or 同値 → 「現在と同じ」
 *   W-MIC-7: 桁数超過（例: digits=4 で `99999`）→ 「形式が不正」
 *
 * 実書き込みテストは含まれない（PROD 本番データ変更禁止のため）。
 * 実書き込み確認はオーナーが手動で 1 件のみ実施する。
 *
 * 認証: ANYONE_ANONYMOUS（auth.json 不要）
 *
 * 実行コマンド: npx playwright test projects/wildboar/member-id-change.spec.ts --project=chromium
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

async function pickTwoMemberIds(page: Page): Promise<{ first: string; second: string }> {
  await page.goto(PROD_URL + "?page=member-list", { waitUntil: "domcontentloaded", timeout: 60_000 });
  const frame = await getReadyFrame(page);
  expect(frame, "member-list frame").not.toBeNull();
  const ids: string[] = await (async () => {
    const deadline = Date.now() + 30_000;
    while (Date.now() < deadline) {
      const got: string[] = await frame!.evaluate(() => {
        const cells = document.querySelectorAll("#tableBody tr td.member-id");
        return Array.from(cells).map(c => (c.textContent || "").trim()).filter(Boolean);
      });
      if (got.length >= 2) return got;
      await frame!.page().waitForTimeout(500);
    }
    return [];
  })();
  expect(ids.length, "member-list rows").toBeGreaterThanOrEqual(2);
  return { first: ids[0], second: ids[1] };
}

async function openMemberDetail(page: Page, memberId: string): Promise<Frame> {
  await page.goto(PROD_URL + "?page=member-detail&memberId=" + encodeURIComponent(memberId), {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  const frame = await getReadyFrame(page);
  expect(frame, "member-detail frame for " + memberId).not.toBeNull();
  await frame!.locator("#d_memberId").waitFor({ state: "visible", timeout: 30_000 });
  return frame!;
}

async function openMidDialog(frame: Frame): Promise<void> {
  await frame.locator("#adminMemberIdChangeSection").waitFor({ state: "visible", timeout: 30_000 });
  await frame.locator("#adminMemberIdChangeSection details").evaluate((el: HTMLDetailsElement) => { el.open = true; });
  await frame.locator("#btnOpenMidDialog").click();
  await frame.locator("#midOverlay.show").waitFor({ state: "attached", timeout: 10_000 });
}

// member_id 文字列から数値を抽出（重複チェックでの突合用）
function extractMemberIdNumber(s: string): number | null {
  const m = String(s || "").match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

test.describe("WILDBOAR W-MIC: 会員番号修正 read-only validation (2026-05-15 update)", () => {
  test.setTimeout(240_000);

  test("W-MIC-1: member-detail に会員番号修正 admin-section が表示される", async ({ page }) => {
    const errors = attachErrorCollector(page);
    const { first } = await pickTwoMemberIds(page);
    const frame = await openMemberDetail(page, first);

    const section = frame.locator("#adminMemberIdChangeSection");
    await expect(section).toBeVisible({ timeout: 30_000 });

    const summaryText = await section.locator("summary").textContent();
    expect(summaryText || "").toContain("会員番号修正");

    const labelText = await frame.locator("#midCurrentIdLabel").textContent();
    expect((labelText || "").trim()).toBe(first);

    expect(errors, "console errors").toEqual([]);
  });

  test("W-MIC-2: ボタン押下でダイアログが開く", async ({ page }) => {
    const { first } = await pickTwoMemberIds(page);
    const frame = await openMemberDetail(page, first);
    await openMidDialog(frame);

    const overlay = frame.locator("#midOverlay");
    await expect(overlay).toHaveClass(/show/, { timeout: 5_000 });

    const title = await frame.locator("#midDialogTitle").textContent();
    expect(title || "").toContain("会員番号修正");
  });

  test("W-MIC-3: 入力欄=数字 / ヒントに4桁・数字・0001 が含まれる / 理由欄は存在しない / 成功・失敗パネルが DOM 上に存在", async ({ page }) => {
    const { first } = await pickTwoMemberIds(page);
    const frame = await openMemberDetail(page, first);
    await openMidDialog(frame);

    await expect(frame.locator("#mid_newId")).toBeVisible();

    const placeholder = await frame.locator("#mid_newId").getAttribute("placeholder");
    expect(placeholder || "", "placeholder should be digits-only").toMatch(/^\d+$/);

    const inputMode = await frame.locator("#mid_newId").getAttribute("inputmode");
    expect(inputMode || "").toBe("numeric");

    const hintText = await frame.locator("#mid_hint").textContent();
    expect(hintText || "", "hint should mention 数字 / 4桁").toContain("数字");
    expect(hintText || "", "hint should show example 0001").toContain("0001");

    // 理由欄は廃止されているため、要素が存在しないこと
    const reasonExists = await frame.evaluate(() => !!document.getElementById("mid_reason"));
    expect(reasonExists, "mid_reason should NOT exist").toBe(false);

    // 成功パネル / 失敗パネルが DOM 上に定義されていること（実書き込みなしでも構造を検証）
    const successPanelExists = await frame.evaluate(() => !!document.getElementById("mid_step3_success"));
    const failedPanelExists  = await frame.evaluate(() => !!document.getElementById("mid_step3_failed"));
    expect(successPanelExists, "mid_step3_success panel should exist").toBe(true);
    expect(failedPanelExists,  "mid_step3_failed panel should exist").toBe(true);

    const oldIdShown = await frame.locator("#mid_oldId").textContent();
    expect((oldIdShown || "").trim()).toBe(first);
  });

  test("W-MIC-4: 新 ID 空欄 → step1 で「新しい会員番号」エラー", async ({ page }) => {
    const { first } = await pickTwoMemberIds(page);
    const frame = await openMemberDetail(page, first);
    await openMidDialog(frame);

    await frame.locator("#mid_newId").fill("");
    await frame.locator("#mid_previewBtn").click();

    const errBox = frame.locator("#mid_step1Errors");
    await expect(errBox).toBeVisible({ timeout: 10_000 });
    const errText = await errBox.textContent();
    expect(errText || "").toContain("新しい会員番号を入力してください");
  });

  test("W-MIC-5: アルファベット入り `abc` → サーバー response で「形式が不正」", async ({ page }) => {
    const { first } = await pickTwoMemberIds(page);
    const frame = await openMemberDetail(page, first);
    await openMidDialog(frame);

    await frame.locator("#mid_newId").fill("abc");
    await frame.locator("#mid_previewBtn").click();

    const errBox = frame.locator("#mid_step1Errors");
    await expect(errBox).toBeVisible({ timeout: 30_000 });
    const errText = await errBox.textContent();
    expect(errText || "").toContain("形式が不正");
  });

  test("W-MIC-6: 既存の別会員と数値重複 → 「既に使用」 / 同値 → 「現在と同じ」", async ({ page }) => {
    const { first, second } = await pickTwoMemberIds(page);
    const frame = await openMemberDetail(page, first);
    await openMidDialog(frame);

    // PROD 状態に依存して 2 通りの分岐をテスト:
    //   (A) 数値重複: second の数値部分を抽出 → first を そこへ変更しようとして「既に使用」
    //   (B) PROD に 2 件目の数値が抽出できない場合: first の数値部分をそのまま入力して「現在と同じ」
    const secondNum = extractMemberIdNumber(second);
    const firstNum  = extractMemberIdNumber(first);
    if (secondNum !== null && firstNum !== secondNum) {
      // (A) 数値重複テスト
      await frame.locator("#mid_newId").fill(String(secondNum));
      await frame.locator("#mid_previewBtn").click();
      const errBox = frame.locator("#mid_step1Errors");
      await expect(errBox).toBeVisible({ timeout: 30_000 });
      const errText = await errBox.textContent() || "";
      expect(errText).toContain("既に使用されています");
    } else if (firstNum !== null) {
      // (B) 同値テスト
      await frame.locator("#mid_newId").fill(String(firstNum));
      await frame.locator("#mid_previewBtn").click();
      const errBox = frame.locator("#mid_step1Errors");
      await expect(errBox).toBeVisible({ timeout: 30_000 });
      const errText = await errBox.textContent() || "";
      expect(errText).toContain("現在と同じ");
    } else {
      throw new Error("PROD data lacks numeric member_ids — W-MIC-6 cannot run");
    }
  });

  test("W-MIC-7: 桁数超過（digits=4 で `99999`）→ 「形式が不正」", async ({ page }) => {
    const { first } = await pickTwoMemberIds(page);
    const frame = await openMemberDetail(page, first);
    await openMidDialog(frame);

    await frame.locator("#mid_newId").fill("99999");
    await frame.locator("#mid_previewBtn").click();

    const errBox = frame.locator("#mid_step1Errors");
    await expect(errBox).toBeVisible({ timeout: 30_000 });
    const errText = await errBox.textContent();
    expect(errText || "").toContain("形式が不正");
  });
});
