/**
 * wildboar/member-list-sort.spec.ts
 * Phase 14-4A: 会員一覧の並べ替え機能 + member-edit 緊急連絡先 warning 化 確認（read-only）
 *
 * 確認項目:
 *   W-MLS-1: ?page=member-list が開き、ソート可能列ヘッダが存在する
 *   W-MLS-2: デフォルトソート = 会員番号 ↑（昇順）/ sortInfo 表示
 *   W-MLS-3: 会員番号ヘッダクリックで降順切替（矢印 ▼）
 *   W-MLS-4: 氏名ヘッダクリックで「氏名（かな優先）↑」に切替
 *   W-MLS-5: status=active フィルタとソートが同時動作
 *   W-MLS-6: sessionStorage に並び順が保存される（同一タブ内の維持基盤）
 *   W-MLS-7: member-edit で緊急連絡先が ⚠ 推奨 表示 / required から外れている
 *
 * 認証: ANYONE_ANONYMOUS（auth.json 不要）
 *
 * データ安全:
 *   - 読み取りのみ。member-edit では 保存ボタンを押さない（フォーム要素の確認のみ）
 *   - sessionStorage への書き込みは UI 操作の副作用のみ（永続化されない）
 *
 * 実行コマンド: npx playwright test projects/wildboar/member-list-sort.spec.ts --project=chromium
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

// 会員一覧の tbody 行から member_id 配列を取得（フィルタ + ソート適用後の表示順）
async function getDisplayedMemberIds(frame: Frame): Promise<string[]> {
  return await frame.evaluate(() => {
    const cells = document.querySelectorAll("#tableBody tr td.member-id");
    return Array.from(cells).map(c => (c.textContent || "").trim());
  });
}

// 表示中の行数（フィルタ + ソート後）
async function getDisplayedRowCount(frame: Frame): Promise<number> {
  return await frame.evaluate(() => document.querySelectorAll("#tableBody tr").length);
}

// member_id 'W-0001' → 1 の数値化（テスト側で並び順検証に使用）
function memberIdNum(s: string): number {
  const m = String(s || "").match(/(\d+)/);
  return m ? parseInt(m[1], 10) : Number.POSITIVE_INFINITY;
}

async function waitForRows(frame: Frame, minRows: number = 1, timeoutMs: number = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const n = await getDisplayedRowCount(frame);
    if (n >= minRows) return;
    await frame.page().waitForTimeout(500);
  }
  throw new Error(`tbody rows did not reach ${minRows} within ${timeoutMs}ms`);
}

test.describe("WILDBOAR W-MLS: 会員一覧 並べ替え + member-edit 緊急連絡先 warning", () => {
  test.setTimeout(240_000);

  test("W-MLS-1: ?page=member-list が開き、ソート可能列ヘッダが存在する", async ({ page }) => {
    const errors = attachErrorCollector(page);
    const res = await page.goto(PROD_URL + "?page=member-list", {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    expect(res, "navigation response").not.toBeNull();
    expect(res!.status(), "HTTP status").toBeLessThan(400);

    const frame = await getReadyFrame(page);
    expect(frame, "GAS userHtmlFrame ready").not.toBeNull();

    await waitForRows(frame!, 1);

    // ソート可能列ヘッダ 6 列の存在
    const sortable = await frame!.evaluate(() => {
      const ths = document.querySelectorAll("th.sortable");
      return Array.from(ths).map(th => (th as HTMLElement).getAttribute("data-sort"));
    });
    expect(sortable, "sortable column data-sort attributes").toEqual(
      expect.arrayContaining(["member_id", "name", "kana", "plan", "status", "join_date"])
    );

    expect(errors, "console errors").toEqual([]);
  });

  test("W-MLS-2: デフォルトソートが会員番号 ↑（昇順）", async ({ page }) => {
    // sessionStorage は新規 page で空のため、初期表示は会員番号 asc 既定値
    await page.goto(PROD_URL + "?page=member-list", { waitUntil: "domcontentloaded", timeout: 60_000 });
    const frame = await getReadyFrame(page);
    expect(frame).not.toBeNull();
    await waitForRows(frame!, 1);

    // sortInfo の表示確認
    const infoText = await frame!.locator("#sortInfoLabel").textContent();
    expect(infoText || "", "sortInfo label").toContain("会員番号");
    expect(infoText || "").toContain("↑");

    // 会員番号 asc になっていることを表示順から検証
    const ids = await getDisplayedMemberIds(frame!);
    expect(ids.length, "displayed rows").toBeGreaterThan(0);
    const nums = ids.map(memberIdNum);
    for (let i = 1; i < nums.length; i++) {
      expect(nums[i], `id #${i} should be >= #${i - 1} (asc)`).toBeGreaterThanOrEqual(nums[i - 1]);
    }
  });

  test("W-MLS-3: 会員番号ヘッダクリックで降順切替（▼）", async ({ page }) => {
    await page.goto(PROD_URL + "?page=member-list", { waitUntil: "domcontentloaded", timeout: 60_000 });
    const frame = await getReadyFrame(page);
    expect(frame).not.toBeNull();
    await waitForRows(frame!, 1);

    await frame!.locator('th.sortable[data-sort="member_id"]').click();
    await page.waitForTimeout(300);

    const arrow = await frame!.locator('th.sortable[data-sort="member_id"] .sort-arrow').textContent();
    expect(arrow || "").toBe("▼");

    const ids = await getDisplayedMemberIds(frame!);
    const nums = ids.map(memberIdNum);
    for (let i = 1; i < nums.length; i++) {
      expect(nums[i], `id #${i} should be <= #${i - 1} (desc)`).toBeLessThanOrEqual(nums[i - 1]);
    }
  });

  test("W-MLS-4: 氏名ヘッダクリックで『氏名（かな優先）↑』に切替", async ({ page }) => {
    await page.goto(PROD_URL + "?page=member-list", { waitUntil: "domcontentloaded", timeout: 60_000 });
    const frame = await getReadyFrame(page);
    expect(frame).not.toBeNull();
    await waitForRows(frame!, 1);

    await frame!.locator('th.sortable[data-sort="name"]').click();
    await page.waitForTimeout(300);

    const infoText = await frame!.locator("#sortInfoLabel").textContent();
    expect(infoText || "").toContain("氏名");
    expect(infoText || "").toContain("↑");

    const arrow = await frame!.locator('th.sortable[data-sort="name"] .sort-arrow').textContent();
    expect(arrow || "").toBe("▲");
  });

  test("W-MLS-5: status=active フィルタ + ソート同時動作", async ({ page }) => {
    await page.goto(PROD_URL + "?page=member-list", { waitUntil: "domcontentloaded", timeout: 60_000 });
    const frame = await getReadyFrame(page);
    expect(frame).not.toBeNull();
    await waitForRows(frame!, 1);

    // 全件数 (active+paused+...) を記録
    const totalBefore = await getDisplayedRowCount(frame!);
    expect(totalBefore, "total rows before filter").toBeGreaterThan(0);

    // 利用中ボタンをクリック
    await frame!.locator('.tab-btn[data-filter="status"][data-value="active"]').click();
    await page.waitForTimeout(300);

    const filtered = await getDisplayedRowCount(frame!);
    expect(filtered, "filtered rows < total").toBeLessThanOrEqual(totalBefore);
    expect(filtered, "filtered rows > 0").toBeGreaterThan(0);

    // フィルタ後に会員番号 asc であること（デフォルト sort 維持）
    const ids = await getDisplayedMemberIds(frame!);
    const nums = ids.map(memberIdNum);
    for (let i = 1; i < nums.length; i++) {
      expect(nums[i], `filtered + sort asc: #${i} >= #${i - 1}`).toBeGreaterThanOrEqual(nums[i - 1]);
    }

    // ソート切替（会員番号 desc）してもフィルタは維持される
    await frame!.locator('th.sortable[data-sort="member_id"]').click();
    await page.waitForTimeout(300);
    const filtered2 = await getDisplayedRowCount(frame!);
    expect(filtered2, "row count unchanged after sort toggle").toBe(filtered);

    const idsDesc = await getDisplayedMemberIds(frame!);
    const numsDesc = idsDesc.map(memberIdNum);
    for (let i = 1; i < numsDesc.length; i++) {
      expect(numsDesc[i], `filtered + sort desc: #${i} <= #${i - 1}`).toBeLessThanOrEqual(numsDesc[i - 1]);
    }
  });

  test("W-MLS-6: sessionStorage に並び順が保存される（同一タブ内の維持基盤）", async ({ page }) => {
    await page.goto(PROD_URL + "?page=member-list", { waitUntil: "domcontentloaded", timeout: 60_000 });
    const frame = await getReadyFrame(page);
    expect(frame).not.toBeNull();
    await waitForRows(frame!, 1);

    // フリガナ列をクリック（kana asc）
    await frame!.locator('th.sortable[data-sort="kana"]').click();
    await page.waitForTimeout(500);

    // sessionStorage に保存されているか確認
    const stored = await frame!.evaluate(() => {
      try { return sessionStorage.getItem("wildboar-member-list-sort"); }
      catch (e) { return null; }
    });
    expect(stored, "sessionStorage sort state").not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.column, "stored sort column").toBe("kana");
    expect(parsed.direction, "stored sort direction").toBe("asc");
  });

  test("W-MLS-7: member-edit で緊急連絡先が ⚠ 推奨 / required から外れている（read-only）", async ({ page }) => {
    // 注: 65 件の取込会員のうち先頭 (会員番号 asc) の member-edit を開く
    // 保存ボタンは押さない。フォーム要素・属性のみ確認する。
    await page.goto(PROD_URL + "?page=member-list", { waitUntil: "domcontentloaded", timeout: 60_000 });
    const listFrame = await getReadyFrame(page);
    expect(listFrame).not.toBeNull();
    await waitForRows(listFrame!, 1);

    const firstId = await listFrame!.evaluate(() => {
      const c = document.querySelector("#tableBody tr td.member-id");
      return c ? (c.textContent || "").trim() : "";
    });
    expect(firstId, "first member_id in default asc").toMatch(/^\S+$/);

    // member-edit へ遷移
    await page.goto(PROD_URL + "?page=member-edit&memberId=" + encodeURIComponent(firstId), {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const editFrame = await getReadyFrame(page);
    expect(editFrame).not.toBeNull();

    // 緊急連絡先入力欄が見えるまで待つ
    await editFrame!.locator("#e_emergency_contact_name").waitFor({ state: "visible", timeout: 30_000 });

    // ラベルに「⚠ 推奨」が含まれていること（「※必須」ではない）
    const cardText = await editFrame!.locator(".card", { hasText: "緊急連絡先" }).first().textContent();
    expect(cardText || "", "緊急連絡先 card text").toContain("推奨");

    // emergency-warn 要素が DOM に存在する（空欄時に show する仕組み）
    const warnExists = await editFrame!.evaluate(() => !!document.getElementById("emergencyWarn"));
    expect(warnExists, "emergencyWarn element exists").toBe(true);

    // doSave 関数の中に emergency_contact_name が required[] に含まれていないこと（client-side warning 化の証跡）
    const saveSrc = await editFrame!.evaluate(() => {
      try { return typeof (window as any).doSave === "function" ? (window as any).doSave.toString() : ""; }
      catch (e) { return ""; }
    });
    expect(saveSrc.length, "doSave function source captured").toBeGreaterThan(100);
    // 真の required[] には emergency_contact_name が無い構成にしている
    const reqArrayMatch = saveSrc.match(/var\s+required\s*=\s*\[[\s\S]*?\];/);
    expect(reqArrayMatch, "required[] array found in doSave").not.toBeNull();
    expect(reqArrayMatch![0], "emergency_contact_name not in required[]").not.toContain("emergency_contact_name");
    expect(reqArrayMatch![0], "emergency_contact_phone not in required[]").not.toContain("emergency_contact_phone");
  });
});
