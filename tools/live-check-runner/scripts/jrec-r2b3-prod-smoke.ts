/**
 * jrec-r2b3-prod-smoke.ts
 *
 * @76 production smoke: open prod /exec reservationAdmin via CDP, verify
 * R-2B-3 surface (act-new-patient button + np-modal-overlay container)
 * exists in the deployed page source.
 *
 * Connects to Chrome CDP 9222.
 */
import { chromium, type Page, type FrameLocator } from "@playwright/test";

const PROD_URL =
  "https://script.google.com/macros/s/AKfycbyOtef10SuH7R1SaDVMBZS7L9yZIBYpEIVmNdS_fhz3hUtc1b0PSKvtzwRxQ6I43YObEA/exec?page=reservationAdmin";
const CDP_URL = "http://localhost:9222";
const TIMEOUT = 25_000;

function gasAppFrame(page: Page): FrameLocator {
  return page.frameLocator("iframe").first().frameLocator("iframe").first();
}

async function main() {
  const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 5000 });
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  page.setDefaultTimeout(TIMEOUT);

  await page.goto(PROD_URL, { waitUntil: "domcontentloaded" });
  const frame = gasAppFrame(page);
  await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: TIMEOUT });

  // R-2B-3 が含まれていれば、画面 HTML に np-modal-overlay div が必ず存在する
  // （unlinked カードがない場合でも、モーダル DOM はページに焼き込まれている）
  const hasNpModal = await frame.locator("#np-modal-overlay").count();
  const npNameField = await frame.locator("#np-name").count();
  const npSubmitBtn = await frame.locator("#np-submit-btn").count();

  console.log("[prod-smoke] #np-modal-overlay count: " + hasNpModal);
  console.log("[prod-smoke] #np-name count: " + npNameField);
  console.log("[prod-smoke] #np-submit-btn count: " + npSubmitBtn);

  const ok = hasNpModal > 0 && npNameField > 0 && npSubmitBtn > 0;
  console.log(ok ? "\n✅ PASS — @76 prod に R-2B-3 UI が反映済み" : "\n❌ FAIL — R-2B-3 UI が prod に出ていない");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error("[prod-smoke] 例外: " + (e && e.message || e));
  process.exit(1);
});
