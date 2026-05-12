/**
 * jbiz-portal7-verify.ts
 * Portal-7 Business Hub の実機検証:
 *   1. ?action=setupPortal7 を実行（Business_Links seed + TASK-PORTAL-7-001 done + Run_Log 追記）
 *   2. ?view=businesses が表示される
 *   3. Home に Business Hub セクションが現れる
 *   4. 各事業カードが表示される
 *   5. URL 未設定事業が「準備中」表示
 *   6. 既存 view が壊れていない
 */
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const EXEC_URL =
  'https://script.google.com/macros/s/AKfycbw20tWvhR5nnRzCiUAMybtfrebRg-BK-EgDamvZYt-clSwf4TK9FGTKNZRmsO3wj7QSiQ/exec';
const authFile = path.join(process.cwd(), 'auth.json');
const TIMEOUT = 45_000;

interface Result {
  name: string;
  status: number | null;
  ok: boolean;
  detail: string;
}

const results: Result[] = [];

async function check(name: string, url: string, expectText: string[]): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ storageState: authFile });
    const page = await ctx.newPage();
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    const status = res?.status() ?? null;
    const finalUrl = page.url();
    const frame = page.frameLocator('iframe').first().frameLocator('iframe').first();
    let bodyText = '';
    try {
      bodyText = await frame.locator('body').innerText({ timeout: TIMEOUT });
    } catch {
      bodyText = await page.locator('body').innerText().catch(() => '');
    }
    const isSignin =
      finalUrl.includes('accounts.google.com') || (await page.title()).includes('Sign in');
    const missing = expectText.filter((s) => !bodyText.includes(s));
    const ok = !isSignin && (status === null || status < 400) && missing.length === 0;
    const detail = isSignin
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

  // 1. setupPortal7 を実行（Business_Links 作成 + TASK-PORTAL-7-001 → done）
  await check('action=setupPortal7', `${EXEC_URL}?action=setupPortal7`, [
    'Portal-7 セットアップ完了',
    'TASK-PORTAL-7-001',
  ]);

  // 2. view=businesses
  await check('view=businesses', `${EXEC_URL}?view=businesses`, [
    'Business Hub',
    '接骨院 自費',
    '接骨院 保険',
    'ジム / 再発予防',
    'ライフデザイン',
    '補助金・助成金',
    '廃棄物報告',
    '共通管理',
    '準備中',
  ]);

  // 3. Home に Business Hub セクション + Portal-7 ラベル
  await check('view=home (Business Hub 組込み)', EXEC_URL, [
    '平山ビジネスポータル',
    '各事業へ (Business Hub)',
    'Portal-7',
  ]);

  // 4. 既存 view が壊れていないこと
  await check('view=runlog (regression)', `${EXEC_URL}?view=runlog`, [
    'Run_Log 全件',
    'Portal-7 セットアップ',
  ]);
  await check('view=tasks (regression)', `${EXEC_URL}?view=tasks`, [
    'Task_Queue 全件',
    'TASK-PORTAL-7-001',
  ]);
  await check('view=kpi (regression)', `${EXEC_URL}?view=kpi`, ['KPI 詳細']);
  await check('view=roadmap (regression)', `${EXEC_URL}?view=roadmap`, ['ロードマップ詳細']);

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
