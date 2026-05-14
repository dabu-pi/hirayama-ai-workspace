// Portal-15 deploy verification:
//   1. trigger ?action=setupPortal15 (Task_Queue / Run_Log 反映)
//   2. fetch ?view=chronicpain and assert key sections render
//
// Auth: reuses tools/live-check-runner/auth.json (Playwright storageState).
// JBIZ WebApp is deployed as USER_ACCESSING (Google login required), not ANYONE_ANONYMOUS.

import { chromium } from 'playwright';
import { existsSync } from 'fs';
import { resolve } from 'path';

const BASE_EXEC =
  'https://script.google.com/macros/s/AKfycbw20tWvhR5nnRzCiUAMybtfrebRg-BK-EgDamvZYt-clSwf4TK9FGTKNZRmsO3wj7QSiQ/exec';

const AUTH_PATH = resolve(__dirname, '..', 'auth.json');

async function readInnerBody(page: any, timeoutMs = 25000): Promise<string> {
  // GAS WebApp renders into a 2-level iframe sandbox.
  let inner = '';
  try {
    const frame = page.frameLocator('iframe').first().frameLocator('iframe').first();
    inner = await frame.locator('body').innerText({ timeout: timeoutMs });
  } catch {
    // fall back to outer body
    inner = await page.locator('body').innerText({ timeout: timeoutMs }).catch(() => '');
  }
  return inner;
}

(async () => {
  if (!existsSync(AUTH_PATH)) {
    console.error(`auth.json not found at ${AUTH_PATH}`);
    process.exit(2);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ storageState: AUTH_PATH });
  const page = await context.newPage();

  let setupOk = false;
  let viewOk = false;

  try {
    // 1. setupPortal15
    console.log('=== setupPortal15 ===');
    const setupUrl = `${BASE_EXEC}?action=setupPortal15`;
    await page.goto(setupUrl, { timeout: 60000, waitUntil: 'domcontentloaded' });
    const setupFinal = page.url();
    const setupTitle = await page.title().catch(() => '');
    console.log(`final_url: ${setupFinal}`);
    console.log(`title: ${setupTitle}`);

    if (
      setupFinal.includes('accounts.google.com') ||
      setupFinal.includes('ServiceLogin') ||
      setupTitle.includes('Sign in')
    ) {
      console.log('AUTH EXPIRED: redirected to Google login');
    } else {
      const body = await readInnerBody(page);
      console.log(`body_len: ${body.length}`);
      const found = {
        portal15: body.includes('Portal-15'),
        setup_complete_label: body.includes('Portal-15 セットアップ完了'),
        status_ok: body.includes('"status": "ok"') || body.includes('"status":"ok"'),
        task_id: body.includes('TASK-PORTAL-15-001'),
      };
      console.log('found:', JSON.stringify(found));
      console.log('--- body snippet (first 1200) ---');
      console.log(body.substring(0, 1200));
      setupOk = found.portal15 && (found.status_ok || found.setup_complete_label);
    }

    // 2. view=chronicpain
    console.log('\n=== ?view=chronicpain ===');
    const viewUrl = `${BASE_EXEC}?view=chronicpain`;
    await page.goto(viewUrl, { timeout: 60000, waitUntil: 'domcontentloaded' });
    const viewFinal = page.url();
    const viewTitle = await page.title().catch(() => '');
    console.log(`final_url: ${viewFinal}`);
    console.log(`title: ${viewTitle}`);

    if (
      viewFinal.includes('accounts.google.com') ||
      viewFinal.includes('ServiceLogin') ||
      viewTitle.includes('Sign in')
    ) {
      console.log('AUTH EXPIRED: redirected to Google login');
    } else {
      const body = await readInnerBody(page);
      console.log(`body_len: ${body.length}`);
      const keywords = [
        '慢性疼痛',
        '自費転換ファネル',
        '+20万円',
        '症状別件数',
        '再発予防導線',
        '腰痛',
        '首こり',
        '肩こり',
      ];
      const hits: Record<string, boolean> = {};
      for (const k of keywords) hits[k] = body.includes(k);
      console.log('keyword_hits:', JSON.stringify(hits));
      console.log('--- body snippet (first 2200) ---');
      console.log(body.substring(0, 2200));
      viewOk = keywords.filter((k) => hits[k]).length >= 6;
    }
  } catch (err: any) {
    console.error('ERROR:', err && err.message ? err.message : err);
  } finally {
    await browser.close();
  }

  console.log('\n=== RESULT ===');
  console.log(`setupPortal15: ${setupOk ? 'PASS' : 'FAIL/SKIP'}`);
  console.log(`?view=chronicpain: ${viewOk ? 'PASS' : 'FAIL/SKIP'}`);
  process.exit(setupOk && viewOk ? 0 : 1);
})();
