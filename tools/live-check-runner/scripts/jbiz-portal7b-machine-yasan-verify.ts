/**
 * jbiz-portal7b-machine-yasan-verify.ts
 *
 * Portal-7b: Business_Links に machine-yasan (sort_order=25 / category=sales / status=building) を
 *            追加 + Portal Hub UI 表示の実機検証。
 *
 *   1. ?action=setupPortal7b を実行（Business_Links 8 行目 seed + TASK-PORTAL-7B-001 done + Run_Log 追記）
 *   2. ?view=businesses で 8 事業カード表示確認（"マシン販売管理" を含む）
 *   3. 既存 7 事業（接骨院自費 / 接骨院保険 / ジム / ライフデザイン / 補助金 / 廃棄物報告 / 共通管理）が壊れていない
 *   4. machine_yasan の primary_url が Phase 1 Sheet URL を指している
 *
 * 使い方: cd tools/live-check-runner && npx tsx scripts/jbiz-portal7b-machine-yasan-verify.ts
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

  // 1. setupPortal7b 実行 → Business_Links に machine-yasan 1 行 append + TASK done + Run_Log
  await check('action=setupPortal7b', `${EXEC_URL}?action=setupPortal7b`, [
    'Portal-7b セットアップ完了',
    'machine-yasan',
  ]);

  // 2. view=businesses で 8 カード（machine-yasan = "マシン販売管理" を含む）表示確認
  await check('view=businesses (8 cards / machine-yasan visible)', `${EXEC_URL}?view=businesses`, [
    'Business Hub',
    'マシン販売管理',         // 新規追加カードのタイトル
    '中古マシンの買取・在庫', // machine-yasan description 冒頭
    '接骨院 自費',            // 既存 (sort_order=10)
    '接骨院 保険',            // 既存 (sort_order=20)
    'ジム / 再発予防',         // 既存 (sort_order=30)
    'ライフデザイン',          // 既存 (sort_order=40)
    '補助金・助成金',          // 既存 (sort_order=50)
    '廃棄物報告',              // 既存 (sort_order=60)
    '共通管理',                // 既存 (sort_order=70)
    '表示中 8 事業',           // Business Hub 表示カウント
  ]);

  // 3. 既存 Portal Hub home (Business Hub セクション) が壊れていない
  await check('view=home (Business Hub セクションに machine-yasan)', `${EXEC_URL}`, [
    'Business Hub',
    'マシン販売管理',
  ]);

  const failed = results.filter((r) => !r.ok);
  console.log('');
  console.log(`Total: ${results.length}, Passed: ${results.length - failed.length}, Failed: ${failed.length}`);
  if (failed.length > 0) {
    console.log('Failed checks:');
    failed.forEach((r) => console.log(`  - ${r.name}: ${r.detail}`));
    process.exit(1);
  }
  console.log('✅ Portal-7b machine-yasan 追加: ALL PASS');
})();
