// Portal-18-D verify: 3 portal home に「← 平山ポータルへ戻る」リンクが表示され href が正しいか確認
import { chromium } from 'playwright';
import { existsSync } from 'fs';
import { resolve } from 'path';

const AUTH = resolve(__dirname, '..', 'auth.json');
const HIRAYAMA_PORTAL_URL =
  'https://script.google.com/macros/s/AKfycbw20tWvhR5nnRzCiUAMybtfrebRg-BK-EgDamvZYt-clSwf4TK9FGTKNZRmsO3wj7QSiQ/exec';

const TARGETS = [
  {
    name: 'JREC-SF01 (staff UI @53)',
    url: 'https://script.google.com/macros/s/AKfycbyOtef10SuH7R1SaDVMBZS7L9yZIBYpEIVmNdS_fhz3hUtc1b0PSKvtzwRxQ6I43YObEA/exec',
  },
  {
    name: 'JYU-GAS (web-home @16)',
    url: 'https://script.google.com/macros/s/AKfycbxODNWJNcCJVQnDXHzzWck237hnUIIXR_Ilt8SS5P5zodfF2dnmKeqso8BL8hcinVEBrQ/exec?page=home',
  },
  {
    name: 'Wildboar (PROD home @42)',
    url: 'https://script.google.com/macros/s/AKfycby2r--yf4vkm1FywAfYsLDZC2J0a43ce6TKNE0NedQoaHtARUUPG4VVSJ-rWYKsuJbBzg/exec',
  },
];

(async () => {
  if (!existsSync(AUTH)) {
    console.error('[ERR] auth.json not found at ' + AUTH);
    process.exit(2);
  }
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ storageState: AUTH });
  const page = await ctx.newPage();
  const results: { name: string; visible: boolean; href: string | null; correctHref: boolean }[] = [];

  for (const t of TARGETS) {
    console.log('=== ' + t.name + ' ===');
    console.log('GOTO ' + t.url);
    try {
      await page.goto(t.url, { timeout: 60000, waitUntil: 'networkidle' });
      // GAS sandbox iframe を待つ
      await page.waitForTimeout(3000);
      // 全 frame から探索
      const frames = page.frames();
      console.log('  frames count: ' + frames.length);
      let found = null as null | { visible: boolean; href: string | null };
      for (const f of frames) {
        try {
          const url = f.url();
          const hasReturn = await f.evaluate(() => {
            const a = document.querySelector('a.portal-return-link');
            if (!a) return null;
            return { href: a.getAttribute('href'), text: a.textContent };
          }).catch(() => null);
          if (hasReturn) {
            console.log('  found in frame: ' + url.substring(0, 80) + ' href=' + hasReturn.href);
            found = { visible: true, href: hasReturn.href };
            break;
          }
        } catch {}
      }
      // Fallback: page 全体の HTML を取って文字列マッチ
      if (!found) {
        const html = await page.content().catch(() => '');
        const hasLink = html.includes('portal-return-link') && html.includes(HIRAYAMA_PORTAL_URL);
        if (hasLink) {
          console.log('  found via outer HTML content');
          found = { visible: true, href: HIRAYAMA_PORTAL_URL };
        } else {
          // Try inner frames via deeper HTML probe
          for (const f of frames) {
            try {
              const innerHtml = await f.evaluate(() => document.documentElement.outerHTML).catch(() => '');
              if (innerHtml && innerHtml.includes('portal-return-link') && innerHtml.includes(HIRAYAMA_PORTAL_URL)) {
                console.log('  found via inner HTML in frame: ' + f.url().substring(0, 80));
                found = { visible: true, href: HIRAYAMA_PORTAL_URL };
                break;
              }
            } catch {}
          }
        }
      }
      if (!found) {
        results.push({ name: t.name, visible: false, href: null, correctHref: false });
        console.log('  → link NOT FOUND');
        continue;
      }
      const correctHref = found.href === HIRAYAMA_PORTAL_URL;
      results.push({ name: t.name, visible: found.visible, href: found.href, correctHref });
      console.log('  visible=' + found.visible + ' href=' + found.href + ' correctHref=' + correctHref);
    } catch (e: any) {
      results.push({ name: t.name, visible: false, href: null, correctHref: false });
      console.log('  → goto failed: ' + (e && e.message ? e.message : e));
    }
  }

  await browser.close();

  console.log('\n=== RESULT ===');
  let allPass = true;
  for (const r of results) {
    const ok = r.visible && r.correctHref;
    if (!ok) allPass = false;
    console.log((ok ? 'PASS' : 'FAIL') + ' ' + r.name + ' visible=' + r.visible + ' correctHref=' + r.correctHref);
  }
  process.exit(allPass ? 0 : 1);
})();
