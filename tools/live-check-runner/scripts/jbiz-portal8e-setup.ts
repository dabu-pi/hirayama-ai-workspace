/**
 * jbiz-portal8e-setup.ts
 * Portal-8E: Dashboard_Minimum_KPI の固定値→数式化 実行・検証
 *
 * 1. ?action=setupPortal8E を実行（B14 SUMPRODUCT / B15 exported_at 数式化 / B16 Portal フェーズ追加）
 * 2. 実行結果 JSON から b14_formula / b15_formula / b16_value を確認
 * 3. Home 表示で「Portal フェーズ」「JREC-SF01 最終同期」「データ品質警告」を確認
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
  ok: boolean;
  detail: string;
  bodyText?: string;
}

const results: Result[] = [];

async function check(name: string, url: string, expectText: string[], captureBody = false): Promise<string> {
  const browser = await chromium.launch({ headless: true });
  let bodyText = '';
  try {
    const ctx = await browser.newContext({ storageState: authFile });
    const page = await ctx.newPage();
    const res = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    const status = res?.status() ?? null;
    const finalUrl = page.url();
    const frame = page.frameLocator('iframe').first().frameLocator('iframe').first();
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
    results.push({ name, ok, detail, bodyText: captureBody ? bodyText.substring(0, 1000) : undefined });
    console.log(
      (ok ? '✅ PASS' : '❌ FAIL') +
        '  [' + name + ']  HTTP ' + status + ' / ' + detail
    );
  } finally {
    await browser.close();
  }
  return bodyText;
}

(async () => {
  if (!fs.existsSync(authFile)) {
    console.error('❌ auth.json not found. Run setup-auth first.');
    process.exit(2);
  }

  console.log('=== Portal-8E: setupPortal8E 実行 + 検証 ===\n');

  // 1. setupPortal8E 実行
  const setupBody = await check(
    'action=setupPortal8E',
    `${EXEC_URL}?action=setupPortal8E`,
    ['Portal-8E セットアップ完了'],
    true
  );

  // JSON 結果を抽出して確認
  const jsonMatch = setupBody.match(/\{[\s\S]*"status"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      console.log('\n  setupPortal8E 返却 JSON:');
      console.log('  b14_formula:', parsed.b14_formula ? '✅ 数式あり' : '❌ 数式なし');
      console.log('  b15_formula:', parsed.b15_formula ? '✅ 数式あり' : '❌ 数式なし');
      console.log('  b16_value:  ', parsed.b16_value ?? '(未取得)');
      console.log('  run_log:    ', JSON.stringify(parsed.run_log));
      if (parsed.b14_formula) console.log('  b14:', parsed.b14_formula.substring(0, 80) + '...');
      if (parsed.b15_formula) console.log('  b15:', parsed.b15_formula.substring(0, 80) + '...');
    } catch {
      console.log('  JSON parse 失敗 / 生テキスト:', setupBody.substring(0, 300));
    }
  } else {
    console.log('  setupBody preview:', setupBody.substring(0, 500));
  }

  // 2. Home 表示確認（固定値 3 点が除去されていること）
  console.log('\n--- Home 表示確認 ---');
  const homeBody = await check(
    'view=home (Portal-8E 後)',
    EXEC_URL,
    ['平山ビジネスポータル', 'Portal フェーズ', 'JREC-SF01 最終同期', 'データ品質警告'],
    true
  );

  // 旧固定値が残っていないか確認
  const oldPhaseLabel = 'Portal-9 (2026-05-13)';
  const oldStagingDate = '2026-05-12 21:50';
  const oldWarnCount   = 'データ品質警告\n1 件';  // この文字列は実際の表示に依存

  if (homeBody.includes(oldPhaseLabel)) {
    console.log('⚠️  WARNING: Home に旧 Portal フェーズラベル残存:', oldPhaseLabel);
  } else {
    console.log('✅ 旧 Portal フェーズラベル (Portal-9) は Home に存在しない');
  }

  if (homeBody.includes(oldStagingDate)) {
    console.log('⚠️  WARNING: Home に旧 Staging 日時残存:', oldStagingDate);
  } else {
    console.log('✅ 旧 Staging 固定日時 (2026-05-12 21:50) は Home に存在しない');
  }

  // Portal @31 が表示されているか
  if (homeBody.includes('Portal @31') || homeBody.includes('Portal @30')) {
    console.log('✅ Portal @31 / @30 ラベルが Home に表示されている');
  } else {
    console.log('ℹ️  Portal @31/@30 ラベルの確認: 表示テキスト中に未検出 (B16 反映待ちの可能性あり)');
  }

  // 3. selfpay 詳細確認
  console.log('\n--- selfpay 詳細確認 ---');
  await check(
    'view=business&id=selfpay (Portal-8E 後)',
    `${EXEC_URL}?view=business&id=selfpay`,
    ['JREC-SF01 最終同期', 'データ品質警告']
  );

  // サマリ
  const fail = results.filter((r) => !r.ok).length;
  const total = results.length;
  console.log('\n=== SUMMARY ===');
  console.log(`PASS: ${total - fail} / ${total}`);
  if (fail > 0) {
    console.log('FAILED:');
    results.filter((r) => !r.ok).forEach((r) => console.log(`  - ${r.name}: ${r.detail}`));
    process.exit(1);
  }
  console.log('\n✅ Portal-8E setup 検証完了');
})();
