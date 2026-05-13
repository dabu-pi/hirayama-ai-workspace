/**
 * jbiz-portal9-verify.ts
 * Portal-9 Cross-Business KPI Dashboard の実機検証:
 *   1. ?action=setupPortal9 (TASK-PORTAL-9-001 done + Run_Log)
 *   2. ?view=crosskpi 表示確認
 *   3. 経営判断カード / 接続状況テーブル / 未接続 KPI / 優先対応リスト 表示確認
 *   4. Home / Navigation に「横断KPI」が現れる
 *   5. 既存 view (home/businesses/business/runlog/tasks/kpi/roadmap) が壊れていない
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

  // 1. setupPortal9 実行
  await check('action=setupPortal9', `${EXEC_URL}?action=setupPortal9`, [
    'Portal-9 セットアップ完了',
    'TASK-PORTAL-9-001',
  ]);

  // 2. view=crosskpi 表示
  await check('view=crosskpi (横断 KPI 画面)', `${EXEC_URL}?view=crosskpi`, [
    '事業横断 KPI ダッシュボード',
    '経営判断カード',
    '月自費目標',
    '今月の自費売上',
    '達成率',
    '事業別 KPI 接続状況',
    '接骨院 自費',
    '接骨院 保険',
    'ジム / 再発予防',
    '一部接続',
    '未接続あり',
    '未接続',
    '主な未接続 KPI',
    'ジム紹介数',
    'JREC-SF01 gym_referral',
    '優先対応リスト',
    '事業詳細ページへ',
  ]);

  // 3. Home / Navigation に「横断KPI」が現れる
  await check('view=home (横断KPI リンク)', EXEC_URL, [
    '平山ビジネスポータル',
    '横断KPI',
    'Portal-9',
  ]);

  // 4. 既存 view の回帰
  await check('view=businesses (regression)', `${EXEC_URL}?view=businesses`, [
    'Business Hub',
    '接骨院 自費',
    '詳細を見る',
  ]);
  await check('view=business&id=selfpay (regression)', `${EXEC_URL}?view=business&id=selfpay`, [
    '接骨院 自費',
    '月自費 +20万円',
  ]);
  await check('view=business&id=insurance (regression)', `${EXEC_URL}?view=business&id=insurance`, [
    '接骨院 保険',
    'JYU-GAS',
  ]);
  await check('view=runlog (regression)', `${EXEC_URL}?view=runlog`, [
    'Run_Log 全件',
    'Portal-9 セットアップ',
  ]);
  await check('view=tasks (regression)', `${EXEC_URL}?view=tasks`, [
    'Task_Queue 全件',
    'TASK-PORTAL-9-001',
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
