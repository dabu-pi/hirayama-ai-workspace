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
  let setup15BOk = false;

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

    // 1b. setupPortal15B (Portal-15-B 月次履歴 snapshot)
    console.log('\n=== setupPortal15B ===');
    const setup15BUrl = `${BASE_EXEC}?action=setupPortal15B`;
    await page.goto(setup15BUrl, { timeout: 60000, waitUntil: 'domcontentloaded' });
    const setup15BFinal = page.url();
    const setup15BTitle = await page.title().catch(() => '');
    console.log(`final_url: ${setup15BFinal}`);
    console.log(`title: ${setup15BTitle}`);

    if (
      setup15BFinal.includes('accounts.google.com') ||
      setup15BFinal.includes('ServiceLogin') ||
      setup15BTitle.includes('Sign in')
    ) {
      console.log('AUTH EXPIRED: redirected to Google login');
    } else {
      const body15B = await readInnerBody(page);
      console.log(`body_len: ${body15B.length}`);
      const found15B = {
        portal15B: body15B.includes('Portal-15-B'),
        setup_complete_label: body15B.includes('Portal-15-B セットアップ完了'),
        task_id: body15B.includes('TASK-PORTAL-15-B-001'),
        sheet_name: body15B.includes('JBIZ_ChronicPain_Monthly_History') || body15B.includes('"month"'),
        action_inserted_or_updated: body15B.includes('"inserted"') || body15B.includes('"updated"'),
      };
      console.log('found:', JSON.stringify(found15B));
      console.log('--- body snippet (first 1400) ---');
      console.log(body15B.substring(0, 1400));
      setup15BOk = found15B.portal15B && found15B.setup_complete_label && found15B.task_id;
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

      // Portal-16-D: §3 connected 判定
      const section3Connected =
        body.includes('Portal-16-D 接続済') ||
        (body.includes('chronicPainKpiSummary') && body.includes('endpoint (@51)')) ||
        body.includes('✅ 接続済:');
      const section3Unconnected =
        body.includes('未接続:') &&
        body.includes('chronicPainKpiSummary endpoint 未接続');
      console.log(`section3_connected: ${section3Connected}`);
      console.log(`section3_unconnected: ${section3Unconnected}`);

      // 「未接続」灰色カード（"—"）が § 3 ではなく § 1 慢性症状患者にのみ残るべき
      const section1HasMdash = body.includes('① 慢性症状患者') && body.includes('—');
      console.log(`section1_unconnected_card (expected true): ${section1HasMdash}`);

      // Portal-15-B: §2 に前月比カードが描画されているか
      const section2HasPrevMonth =
        body.includes('前月比 売上') &&
        body.includes('前月比 達成率') &&
        body.includes('前月比 自費来院') &&
        body.includes('前月比 再発予防未対応') &&
        body.includes('前月比 慢性疼痛延べ');
      // 初回 snapshot 直後は前月行がないので「履歴不足」表示か、
      // または前月行ありなら delta（+/−/±）表示
      const section2PrevMonthHandled =
        body.includes('履歴不足') ||
        body.includes('JBIZ_ChronicPain_Monthly_History シート由来') ||
        /[+−±]/.test(body);
      console.log(`section2_has_prev_month_cards: ${section2HasPrevMonth}`);
      console.log(`section2_prev_month_handled: ${section2PrevMonthHandled}`);

      console.log('--- body snippet (first 3500) ---');
      console.log(body.substring(0, 3500));

      const kwScore = keywords.filter((k) => hits[k]).length;
      viewOk = kwScore >= 6 && section3Connected && !section3Unconnected &&
               section2HasPrevMonth && section2PrevMonthHandled;
    }
  } catch (err: any) {
    console.error('ERROR:', err && err.message ? err.message : err);
  } finally {
    await browser.close();
  }

  console.log('\n=== RESULT ===');
  console.log(`setupPortal15:   ${setupOk ? 'PASS' : 'FAIL/SKIP'}`);
  console.log(`setupPortal15B:  ${setup15BOk ? 'PASS' : 'FAIL/SKIP'}`);
  console.log(`?view=chronicpain (sec2 prev-month + sec3 connected): ${viewOk ? 'PASS' : 'FAIL/SKIP'}`);
  process.exit(setupOk && setup15BOk && viewOk ? 0 : 1);
})();
