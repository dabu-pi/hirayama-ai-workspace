/**
 * jbiz-portal8-verify.ts
 * Portal-8 Business Detail KPI Pages の実機検証:
 *   1. ?action=setupPortal8 を実行（TASK-PORTAL-8-001 done + Run_Log 追記）
 *   2. ?view=business&id=<id> 全 7 事業の HTTP 200 確認
 *   3. selfpay 詳細に 月自費目標 / 達成率 等が表示される
 *   4. insurance 詳細に JYU-GAS / 未接続 が表示される
 *   5. ?view=businesses に「詳細を見る」リンクが現れる
 *   6. 既存 view (home/runlog/tasks/kpi/roadmap/businesses) が壊れていない
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

  // 1. setupPortal8 実行
  await check('action=setupPortal8', `${EXEC_URL}?action=setupPortal8`, [
    'Portal-8 セットアップ完了',
    'TASK-PORTAL-8-001',
  ]);

  // 2. selfpay 詳細
  await check('view=business&id=selfpay', `${EXEC_URL}?view=business&id=selfpay`, [
    '接骨院 自費',
    '月自費 +20万円',
    '月自費目標',
    '今月の自費売上',
    '達成率',
    '主力手技価格',
    '未接続',
    'ジム紹介数',
  ]);

  // 3. insurance 詳細
  await check('view=business&id=insurance', `${EXEC_URL}?view=business&id=insurance`, [
    '接骨院 保険',
    'JYU-GAS',
    '未接続',
    '請求件数',
    '請求額',
  ]);

  // 4. 他事業 skeleton
  await check('view=business&id=gym', `${EXEC_URL}?view=business&id=gym`, [
    'ジム',
    '再発予防',
  ]);
  await check('view=business&id=life_design', `${EXEC_URL}?view=business&id=life_design`, [
    'ライフデザイン',
  ]);
  await check('view=business&id=subsidy', `${EXEC_URL}?view=business&id=subsidy`, [
    '補助金',
  ]);
  await check('view=business&id=waste_report', `${EXEC_URL}?view=business&id=waste_report`, [
    '廃棄物報告',
  ]);
  await check('view=business&id=common', `${EXEC_URL}?view=business&id=common`, [
    '共通管理',
    'Run_Log 全件',
    'Task_Queue 全件',
    'KPI 詳細',
    'ロードマップ詳細',
  ]);

  // 5. Business Hub に「詳細を見る」が現れる
  await check('view=businesses (詳細を見る付き)', `${EXEC_URL}?view=businesses`, [
    'Business Hub',
    '詳細を見る',
    '接骨院 自費',
    '接骨院 保険',
  ]);

  // 6. 不正 id でも 200 + Business Hub への誘導
  await check('view=business (id 不正)', `${EXEC_URL}?view=business&id=does_not_exist`, [
    'Business_Links',
  ]);

  // 7. 既存 view の回帰
  await check('view=home (regression / Portal-8 ラベル)', EXEC_URL, [
    '平山ビジネスポータル',
    'Portal-8',
  ]);
  await check('view=runlog (regression)', `${EXEC_URL}?view=runlog`, [
    'Run_Log 全件',
    'Portal-8 セットアップ',
  ]);
  await check('view=tasks (regression)', `${EXEC_URL}?view=tasks`, [
    'Task_Queue 全件',
    'TASK-PORTAL-8-001',
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
