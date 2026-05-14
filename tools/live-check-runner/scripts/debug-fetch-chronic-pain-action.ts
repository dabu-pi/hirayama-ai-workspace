// Debug: call ?action=fetchChronicPainKpi via auth.json to inspect probe
import { chromium } from 'playwright';
import { existsSync } from 'fs';
import { resolve } from 'path';
const AUTH = resolve(__dirname, '..', 'auth.json');
const URL = 'https://script.google.com/macros/s/AKfycbw20tWvhR5nnRzCiUAMybtfrebRg-BK-EgDamvZYt-clSwf4TK9FGTKNZRmsO3wj7QSiQ/exec?action=fetchChronicPainKpi';
(async () => {
  if (!existsSync(AUTH)) { console.error('no auth'); process.exit(2); }
  const b = await chromium.launch({ headless: true });
  const ctx = await b.newContext({ storageState: AUTH });
  const p = await ctx.newPage();
  await p.goto(URL, { timeout: 60000, waitUntil: 'domcontentloaded' });
  const body = await p.locator('body').innerText({ timeout: 20000 }).catch(() => '');
  console.log(body.substring(0, 4000));
  await b.close();
})();
