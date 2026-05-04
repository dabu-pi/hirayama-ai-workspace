import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const EXEC_URL = 'https://script.google.com/macros/s/AKfycbxP9beCl8tZ4t41irDgFa-fg54KyDjt8-xM4ogefuwMaZ9Pmkx5-D7JvkLS_nn1G5utYA/exec';
const PATIENT_ID = 'P0001';
const authFile = path.join(process.cwd(), 'auth.json');
const TIMEOUT = 30_000;

(async () => {
  // ── home ──────────────────────────────────────────────────────
  {
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({ storageState: authFile });
    const page = await ctx.newPage();
    const res = await page.goto(EXEC_URL, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    const title = await page.title().catch(() => '');
    const ok = (res?.status() ?? 0) < 400 && title.includes('JREC');
    console.log((ok ? '✅ PASS' : '❌ FAIL') + '  [exec/home]   HTTP ' + res?.status() + ' / title="' + title + '"');
    await browser.close();
  }

  // ── patient-list ───────────────────────────────────────────────
  {
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({ storageState: authFile });
    const page = await ctx.newPage();
    const res = await page.goto(EXEC_URL + '?page=list', { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    // GAS がスプレッドシートからデータを読み込むのを待つ
    const frame = page.frameLocator('iframe').first().frameLocator('iframe').first();
    const hasRow = await frame.locator('table tr').nth(1).waitFor({ timeout: TIMEOUT }).then(() => true).catch(() => false);
    console.log((hasRow ? '✅ PASS' : '⚠️ WARN') + '  [exec/list]   HTTP ' + res?.status() + ' / table_row=' + hasRow);
    await browser.close();
  }

  // ── visitForm + AI補助セクション ───────────────────────────────
  {
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({ storageState: authFile });
    const page = await ctx.newPage();
    const res = await page.goto(EXEC_URL + '?page=visitForm&id=' + PATIENT_ID, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    const frame = page.frameLocator('iframe').first().frameLocator('iframe').first();

    // フォーム読み込み待ち（GAS SSR後にDOMが確定する）
    const formLoaded = await frame.locator('#chiefComplaint, #visitForm').first()
      .waitFor({ timeout: TIMEOUT }).then(() => true).catch(() => false);
    const hasCard   = await frame.locator('#aiAssistCard').isVisible({ timeout: 15000 }).catch(() => false);
    const hasDisc   = await frame.getByText('診断の確定ではありません', { exact: false }).isVisible({ timeout: 5000 }).catch(() => false);
    const hasBtn    = await frame.locator('#aiAssistBtn').isVisible({ timeout: 5000 }).catch(() => false);
    const isDisabled = hasBtn && await frame.locator('#aiAssistBtn').isDisabled().catch(() => false);

    console.log((formLoaded ? '✅ PASS' : '❌ FAIL') + '  [exec/visitForm]  フォーム読み込み');
    console.log((hasCard    ? '✅ PASS' : '❌ FAIL') + '  [exec/visitForm]  #aiAssistCard 存在');
    console.log((hasDisc    ? '✅ PASS' : '❌ FAIL') + '  [exec/visitForm]  免責文存在');
    console.log((isDisabled ? '✅ PASS' : '❌ FAIL') + '  [exec/visitForm]  #aiAssistBtn disabled');
    await browser.close();
  }

  // ── dailyCheckout ──────────────────────────────────────────────
  {
    const browser = await chromium.launch({ headless: true });
    const ctx = await browser.newContext({ storageState: authFile });
    const page = await ctx.newPage();
    const res = await page.goto(EXEC_URL + '?page=dailyCheckout', { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
    const frame = page.frameLocator('iframe').first().frameLocator('iframe').first();
    const ok = await frame.locator('#dateForm').waitFor({ timeout: TIMEOUT }).then(() => true).catch(() => false);
    console.log((ok ? '✅ PASS' : '❌ FAIL') + '  [exec/dailyCheckout]  #dateForm 描画');
    await browser.close();
  }
})();
