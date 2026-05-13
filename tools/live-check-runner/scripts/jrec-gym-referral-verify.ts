/**
 * jrec-gym-referral-verify.ts
 * TASK-JREC-1C-001: gym_referral フラグ群追加の実機検証
 *   1. ?action=migrateGymReferral を実行 → JSON 確認
 *   2. ?action=gymReferralKpiSummary を JSON 取得（migration 後）
 *   3. ?page=visitForm を開いて gym セクション存在確認
 *   4. ?page=home / ?page=list が壊れていないか確認
 */
import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const EXEC_URL =
  'https://script.google.com/macros/s/AKfycbz0EqGZOXWrKokzFN2x4SMo17cJojaHnWvmR2FAHXyQ1OLIdnWGwBSHIyylDAMqb8oACA/exec';
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
  opts?: { useIframe?: boolean; raw?: boolean; useHtml?: boolean }
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
    } else if (opts && opts.useHtml) {
      // iframe 内の HTML 全体を文字列で取得（display:none も含む / details 折りたたみ対応）
      try {
        const frame = page.frameLocator('iframe').first().frameLocator('iframe').first();
        bodyText = await frame.locator('html').innerHTML({ timeout: TIMEOUT });
      } catch {
        bodyText = await page.content().catch(() => '');
      }
    } else {
      const useIframe = opts ? opts.useIframe !== false : true;
      if (useIframe) {
        try {
          const frame = page.frameLocator('iframe').first().frameLocator('iframe').first();
          bodyText = await frame.locator('body').innerText({ timeout: TIMEOUT });
        } catch {
          bodyText = await page.locator('body').innerText().catch(() => '');
        }
      } else {
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
      (ok ? '✅ PASS' : '❌ FAIL') +
        '  [' + name + ']  HTTP ' + status + ' / ' + detail
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

  // 1. migration を実行（idempotent / Sheets 列追加）
  await check(
    'action=migrateGymReferral',
    `${EXEC_URL}?action=migrateGymReferral`,
    ['TASK-JREC-1C-001 gym_referral migration', '"ok": true', '"sheet": "SelfPayChart"']
  );

  // 2. KPI summary JSON（ContentService 出力 = raw body）
  await check(
    'action=gymReferralKpiSummary (current month)',
    `${EXEC_URL}?action=gymReferralKpiSummary`,
    ['"ok": true', 'selfpay_visit_count', 'gym_referral_candidate_count', 'gym_joined_count'],
    { raw: true }
  );

  // 3. ping
  await check('page=ping', `${EXEC_URL}?page=ping`, ['JREC-SF01 ping OK', 'doGet is running']);

  // 4. home view
  await check('page=home (regression)', `${EXEC_URL}?page=home`, [], { useIframe: true });

  // 5. patient list
  await check('page=list (regression)', `${EXEC_URL}?page=list`, [], { useIframe: true });

  // 6. visit-form (gym セクション存在確認 — details 折りたたみ内も含めて innerHTML で検査)
  await check(
    'page=visitForm&id=P0001 (gym セクション / HTML)',
    `${EXEC_URL}?page=visitForm&id=P0001`,
    [
      'gymReferralSection',
      'ジム・再発予防への誘導',
      'gymReferralCandidate',
      'gymReferralRecommended',
      'gymTrialProposed',
      'gymTrialBooked',
      'gymJoined',
      'gymReferralStatus',
      'gymReferralReason',
      'gymReferralNextAction',
      'gymReferralNote'
    ],
    { useHtml: true }
  );

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
