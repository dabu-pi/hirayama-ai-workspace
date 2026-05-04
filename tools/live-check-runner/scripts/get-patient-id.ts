import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const configRaw = fs.readFileSync(path.join(process.cwd(), 'projects/jrec-sf01/config.json'), 'utf-8');
const config = JSON.parse(configRaw) as { devUrl: string };
const authFile = path.join(process.cwd(), 'auth.json');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: authFile });
  const page = await ctx.newPage();
  await page.goto(config.devUrl + '?page=list', { waitUntil: 'domcontentloaded', timeout: 25000 });

  const frame = page.frameLocator('iframe').first().frameLocator('iframe').first();

  // patient-list.html: td.pid に患者IDが表示される
  const pids = await frame.locator('td.pid').allTextContents().catch(() => [] as string[]);
  if (pids.length > 0) {
    // 最初の患者IDのみ出力（個人情報は含まない）
    console.log('PATIENT_ID_FOUND:' + pids[0].trim());
  } else {
    // フォールバック: onclick 内の id= 引数からID抽出
    const btns = await frame.locator('button[onclick*="detail&id="]').first().getAttribute('onclick').catch(() => '');
    const m = btns ? btns.match(/id=([^'"\s]+)/) : null;
    if (m) {
      console.log('PATIENT_ID_FOUND:' + m[1]);
    } else {
      console.log('PATIENT_ID_NOT_FOUND');
    }
  }
  await browser.close();
})();
