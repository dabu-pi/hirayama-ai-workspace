/**
 * jbiz-portal12-verify.ts
 * Portal-12 JREC-SF01 chronic-pain / gym-referral KPI live connection の実機検証:
 *   1. ?action=setupPortal12 (TASK-PORTAL-12-001 done + Run_Log + probe)
 *   2. ?action=fetchSelfpayGymKpi (JSON 疎通)
 *   3. ?view=business&id=selfpay で Portal-12 セクション表示確認
 *   4. ?view=crosskpi で「Portal-12（live 接続）」紹介文 + 接続済表示確認
 *   5. 既存 view (home / businesses / runlog / tasks / kpi / roadmap) が壊れていない
 */
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const EXEC_URL =
  'https://script.google.com/macros/s/AKfycbw20tWvhR5nnRzCiUAMybtfrebRg-BK-EgDamvZYt-clSwf4TK9FGTKNZRmsO3wj7QSiQ/exec';
const authFile = path.join(process.cwd(), 'auth.json');
const TIMEOUT = 60_000;

interface Result {
  name: string;
  status: number | null;
  ok: boolean;
  detail: string;
}

const results: Result[] = [];

async function check(
  name: string,
  url: string,
  expectText: string[],
  opts?: { raw?: boolean }
): Promise<void> {
  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ storageState: authFile });
    const page = await ctx.newPage();
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    const status = res?.status() ?? null;
    const finalUrl = page.url();
    let bodyText = '';
    if (opts && opts.raw) {
      bodyText = await page.locator('body').innerText().catch(() => '');
    } else {
      try {
        const frame = page.frameLocator('iframe').first().frameLocator('iframe').first();
        bodyText = await frame.locator('body').innerText({ timeout: TIMEOUT });
      } catch {
        bodyText = await page.locator('body').innerText().catch(() => '');
      }
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
      (ok ? '✅ PASS' : '❌ FAIL') + '  [' + name + ']  HTTP ' + status + ' / ' + detail
    );
    if (!ok && opts?.raw) {
      console.log('   body (first 400 chars): ' + bodyText.substring(0, 400));
    }
  } finally {
    await browser.close();
  }
}

(async () => {
  if (!fs.existsSync(authFile)) {
    console.error('❌ auth.json not found. Run setup-auth first.');
    process.exit(2);
  }

  // 1. setupPortal12 実行（TASK-PORTAL-12-001 → done + Run_Log + probe）
  await check('action=setupPortal12', `${EXEC_URL}?action=setupPortal12`, [
    'Portal-12 セットアップ完了',
    'TASK-PORTAL-12-001',
    'task_update',
    'run_log',
  ]);

  // 2. JREC-SF01 KPI を JSON で取得（ContentService = raw body）
  await check(
    'action=fetchSelfpayGymKpi (JSON 疎通)',
    `${EXEC_URL}?action=fetchSelfpayGymKpi`,
    [
      '"state":',
      '"source_url":',
      '"fetched_at":',
      'gym_referral_candidate_count',
      'data_quality_warnings',
    ],
    { raw: true }
  );

  // 3. selfpay detail で Portal-12 セクション表示
  await check(
    'view=business&id=selfpay (Portal-12 セクション)',
    `${EXEC_URL}?view=business&id=selfpay`,
    [
      'Portal-12: JREC-SF01 ジム紹介 KPI',
      'ジム紹介候補',
      '紹介率（案内 / visit）',
      'データ品質警告',
      'gymReferralKpiSummary',
    ]
  );

  // 4. crosskpi で Portal-12 への導線 + 接続済表示
  await check(
    'view=crosskpi (Portal-12 導線 + 接続済表示)',
    `${EXEC_URL}?view=crosskpi`,
    [
      'Portal-12（live 接続）',
      '接続済（Portal-12）',
      '事業横断 KPI ダッシュボード',
    ]
  );

  // 5. 既存 view 回帰確認
  await check('view=home (回帰)', `${EXEC_URL}?view=home`, ['平山ビジネスポータル']);
  await check('view=businesses (回帰)', `${EXEC_URL}?view=businesses`, ['事業']);
  await check('view=business&id=insurance (回帰)', `${EXEC_URL}?view=business&id=insurance`, [
    '保険',
  ]);
  await check('view=runlog (回帰)', `${EXEC_URL}?view=runlog`, ['Run_Log']);
  await check('view=tasks (回帰)', `${EXEC_URL}?view=tasks`, ['Task_Queue']);
  await check('view=kpi (回帰)', `${EXEC_URL}?view=kpi`, ['KPI']);
  await check('view=roadmap (回帰)', `${EXEC_URL}?view=roadmap`, ['ロードマップ']);

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
