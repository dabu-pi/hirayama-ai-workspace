import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const EXEC_URL =
  'https://script.google.com/macros/s/AKfycbw20tWvhR5nnRzCiUAMybtfrebRg-BK-EgDamvZYt-clSwf4TK9FGTKNZRmsO3wj7QSiQ/exec';
const authFile = path.join(process.cwd(), 'auth.json');
const TIMEOUT = 45_000;

interface CheckResult {
  name: string;
  status: number | null;
  ok: boolean;
  detail: string;
}

const results: CheckResult[] = [];

async function check(name: string, url: string, expectText: string[]): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ storageState: authFile });
    const page = await ctx.newPage();
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    const status = res?.status() ?? null;
    const finalUrl = page.url();
    // iframe sandbox 内が GAS のレンダリング先
    const frame = page.frameLocator('iframe').first().frameLocator('iframe').first();
    let bodyText = '';
    try {
      bodyText = await frame.locator('body').innerText({ timeout: TIMEOUT });
    } catch {
      // フォールバック: トップフレームから取得
      bodyText = await page.locator('body').innerText().catch(() => '');
    }
    const missing = expectText.filter((s) => !bodyText.includes(s));
    const isSigninPage =
      finalUrl.includes('accounts.google.com') || (await page.title()).includes('Sign in');
    const ok = !isSigninPage && (status === null || status < 400) && missing.length === 0;
    const detail = isSigninPage
      ? 'auth.json 期限切れ (Sign-in)'
      : missing.length > 0
      ? 'missing: ' + missing.join(', ')
      : 'OK';
    results.push({ name, status, ok, detail });
    console.log(
      (ok ? '✅ PASS' : '❌ FAIL') +
        '  [' +
        name +
        ']  HTTP ' +
        status +
        ' / ' +
        detail
    );
  } finally {
    await browser.close();
  }
}

(async () => {
  if (!fs.existsSync(authFile)) {
    console.error('❌ auth.json not found. Run setup-auth first.');
    process.exit(2);
  }

  // 1. setupPortal6 (Run_Log 追記 + TASK-PORTAL-6-001 → done)
  await check('action=setupPortal6', `${EXEC_URL}?action=setupPortal6`, [
    'Portal-6 セットアップ完了',
  ]);

  // 2. Home view (Portal-6 セットアップリンクが存在する)
  await check('view=home (default)', EXEC_URL, [
    '平山ビジネスポータル',
    'Portal-6 セットアップ',
  ]);

  // 3. Run_Log 全件 view
  await check('view=runlog', `${EXEC_URL}?view=runlog`, [
    'Run_Log 全件',
    'Portal-6 セットアップ',
  ]);

  // 4. Task_Queue 全件 view
  await check('view=tasks', `${EXEC_URL}?view=tasks`, [
    'Task_Queue 全件',
    'TASK-PORTAL-6-001',
  ]);

  // 5. KPI 詳細 view
  await check('view=kpi', `${EXEC_URL}?view=kpi`, ['KPI 詳細']);

  // 6. ロードマップ詳細 view
  await check('view=roadmap', `${EXEC_URL}?view=roadmap`, ['ロードマップ詳細']);

  const fail = results.filter((r) => !r.ok).length;
  const total = results.length;
  console.log('\n=== SUMMARY ===');
  console.log(`PASS: ${total - fail} / ${total}`);
  if (fail > 0) {
    console.log('FAILED:');
    results.filter((r) => !r.ok).forEach((r) => console.log(`  - ${r.name}: ${r.detail}`));
    process.exit(1);
  }
})();
