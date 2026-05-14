// Debug: call ?action=fetchChronicPainSymptomKpi (individual fetcher, no fetchAll)
import { chromium } from 'playwright';
import { existsSync } from 'fs';
import { resolve } from 'path';
const AUTH = resolve(__dirname, '..', 'auth.json');
const BASE = 'https://script.google.com/macros/s/AKfycbw20tWvhR5nnRzCiUAMybtfrebRg-BK-EgDamvZYt-clSwf4TK9FGTKNZRmsO3wj7QSiQ/exec';
(async () => {
  if (!existsSync(AUTH)) { console.error('no auth'); process.exit(2); }
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ storageState: AUTH });
  const p = await ctx.newPage();
  for (const action of ['fetchChronicPainSymptomKpi', 'fetchSelfpayInitialContinuationKpi', 'fetchSelfpayGymKpi']) {
    console.log('=== ' + action + ' ===');
    await p.goto(`${BASE}?action=${action}`, { timeout: 60000, waitUntil: 'domcontentloaded' });
    const body = await p.locator('body').innerText({ timeout: 20000 }).catch(() => '');
    console.log(body.substring(0, 1200));
    console.log('---');
  }
  await b.close();
})();
