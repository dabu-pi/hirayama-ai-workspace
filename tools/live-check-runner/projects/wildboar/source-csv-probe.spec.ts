/**
 * wildboar/source-csv-probe.spec.ts
 * 会員名簿2026 の CSV export エンドポイントへ logged-in cookies で
 * GET できるかを probe する。
 *
 * 重要:
 *   - 取得した CSV の内容（個人情報）はログ / annotation に出さない
 *   - 出すのは: 行数・列数・先頭ヘッダーの「ヘッダー列の数」だけ
 *   - 書込みは一切しない
 *
 * 実行: npx playwright test projects/wildboar/source-csv-probe.spec.ts --project=chromium
 */

import { test, expect } from "@playwright/test";

const SOURCE_ID  = "1bz95Vy2FnTxWq1PHvb-cqT5UZpRWkNMQQ_-OXmgG9Qs";
const SOURCE_GID = "676663641";
const CSV_URL    = `https://docs.google.com/spreadsheets/d/${SOURCE_ID}/export?format=csv&gid=${SOURCE_GID}`;

test.describe("WILDBOAR W-CSV: 会員名簿2026 CSV export 取得可否", () => {
  test.setTimeout(60_000);

  test("W-CSV-1: 認証セッションで CSV export が取得できる", async ({ context, page }) => {
    // まず一度ダミーで Google Sheets を開いて cookies を warm-up（必要に応じて）
    await page.goto(`https://docs.google.com/spreadsheets/d/${SOURCE_ID}/edit?gid=${SOURCE_GID}`, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    expect(page.url().includes("accounts.google.com"), "no login redirect").toBe(false);

    const res = await context.request.get(CSV_URL);
    const status = res.status();
    const ct = res.headers()["content-type"] || "";

    test.info().annotations.push({
      type: "csv-export-meta",
      description: JSON.stringify({ status, contentType: ct.split(";")[0] }),
    });

    expect(status, "HTTP status").toBeLessThan(400);
    // text/csv または text/plain 系
    const text = await res.text();
    const lines = text.split(/\r?\n/).filter(l => l.length > 0);
    const headerCols = lines.length > 0 ? lines[0].split(",").length : 0;

    test.info().annotations.push({
      type: "csv-shape",
      description: JSON.stringify({ totalLines: lines.length, headerCols }),
    });

    // 期待: 少なくとも 5 行 / 10 列以上
    expect(lines.length, "CSV total rows").toBeGreaterThan(5);
    expect(headerCols, "CSV header columns").toBeGreaterThan(10);
  });
});
