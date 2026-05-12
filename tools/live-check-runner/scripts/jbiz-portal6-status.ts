/**
 * jbiz-portal6-status.ts
 * setupPortal6 の JSON 結果と view=tasks の TASK-PORTAL-6-001 行を実機確認する。
 */
import { chromium } from '@playwright/test';
import path from 'path';

const EXEC_URL =
  'https://script.google.com/macros/s/AKfycbw20tWvhR5nnRzCiUAMybtfrebRg-BK-EgDamvZYt-clSwf4TK9FGTKNZRmsO3wj7QSiQ/exec';
const authFile = path.join(process.cwd(), 'auth.json');
const TIMEOUT = 45_000;

async function fetch(url: string, selector: string): Promise<string> {
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ storageState: authFile });
    const page = await ctx.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    const frame = page.frameLocator('iframe').first().frameLocator('iframe').first();
    try {
      return await frame.locator(selector).innerText({ timeout: TIMEOUT });
    } catch {
      return await page.locator(selector).innerText({ timeout: TIMEOUT });
    }
  } finally {
    await browser.close();
  }
}

(async () => {
  console.log('=== setupPortal6 JSON (idempotent re-run) ===');
  const setupBody = await fetch(`${EXEC_URL}?action=setupPortal6`, 'body');
  console.log(setupBody.substring(0, 1200));

  console.log('\n=== view=tasks body (抜粋 TASK-PORTAL-6-001 周辺) ===');
  const tasksBody = await fetch(`${EXEC_URL}?view=tasks`, 'body');
  const idx = tasksBody.indexOf('TASK-PORTAL-6-001');
  if (idx < 0) {
    console.log('TASK-PORTAL-6-001 が見つかりません');
  } else {
    const start = Math.max(0, idx - 200);
    const end = Math.min(tasksBody.length, idx + 200);
    console.log(tasksBody.substring(start, end));
  }

  console.log('\n=== view=runlog body (Portal-6 行付近) ===');
  const runlogBody = await fetch(`${EXEC_URL}?view=runlog`, 'body');
  const ridx = runlogBody.indexOf('Portal-6');
  if (ridx < 0) {
    console.log('Portal-6 行が見つかりません');
  } else {
    const start = Math.max(0, ridx - 100);
    const end = Math.min(runlogBody.length, ridx + 400);
    console.log(runlogBody.substring(start, end));
  }
})();
