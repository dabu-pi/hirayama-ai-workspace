/**
 * jrec-r2d-prod-smoke.ts
 *
 * Phase R-2D @81 production smoke.
 *
 * Read-only checks against prod /exec:
 *   - NAV_RENDERED:        staff nav is present on reservationAdmin /exec
 *   - PUBLIC_RES_BUTTON:   "🌐 公開予約ページ" tab exists with new-tab onclick
 *   - COPY_BUTTON:         "📋" small copy button exists
 *   - RES_ADMIN_INTACT:    既存 reservationAdmin tab が壊れていない
 *
 * Does NOT click the public-reservation button (would open a new tab and
 * pollute test state). Does NOT submit reservations (no Gmail dispatch).
 */
import { chromium, type Page, type FrameLocator } from "@playwright/test";

const PROD_URL =
  "https://script.google.com/macros/s/AKfycbyOtef10SuH7R1SaDVMBZS7L9yZIBYpEIVmNdS_fhz3hUtc1b0PSKvtzwRxQ6I43YObEA/exec?page=reservationAdmin";
const CDP_URL = "http://localhost:9222";
const TIMEOUT = 25_000;

interface Result { name: string; ok: boolean; detail: string; }
const results: Result[] = [];
function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log((ok ? "✅ PASS" : "❌ FAIL") + "  [" + name + "]  " + detail);
}
function gasAppFrame(page: Page): FrameLocator {
  return page.frameLocator("iframe").first().frameLocator("iframe").first();
}

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  jrec-r2d-prod-smoke — Phase R-2D @81 prod nav check");
  console.log("═══════════════════════════════════════════════════════════");

  const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 5000 });
  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  page.setDefaultTimeout(TIMEOUT);
  await page.goto(PROD_URL, { waitUntil: "domcontentloaded" });
  const frame = gasAppFrame(page);

  try {
    await frame.locator("nav.tab-nav").first().waitFor({ state: "visible", timeout: TIMEOUT });
    record("NAV_RENDERED", true, "nav.tab-nav visible on /exec reservationAdmin");
  } catch (e) {
    record("NAV_RENDERED", false, "nav not found: " + (e as Error).message);
    process.exit(1);
  }

  try {
    const btn = frame.locator("nav.tab-nav button.tab-public-reservation").first();
    const visible = await btn.isVisible({ timeout: 5000 }).catch(() => false);
    const text = visible ? (await btn.textContent().catch(() => "")) : "";
    const onclick = visible ? (await btn.getAttribute("onclick")) : null;
    const ok = visible && (text || "").includes("公開予約ページ") &&
      (onclick || "").includes("page=reservationPublic") &&
      (onclick || "").includes("window.open") &&
      (onclick || "").includes("_blank");
    record("PUBLIC_RES_BUTTON", ok, `visible=${visible} text='${(text || "").trim()}' onclick has page=reservationPublic+window.open+_blank=${ok}`);
  } catch (e) {
    record("PUBLIC_RES_BUTTON", false, "exception: " + (e as Error).message);
  }

  try {
    const copy = frame.locator("nav.tab-nav button.tab-public-reservation-copy").first();
    const visible = await copy.isVisible({ timeout: 5000 }).catch(() => false);
    const text = visible ? (await copy.textContent().catch(() => "")) : "";
    record("COPY_BUTTON", visible && (text || "").includes("📋"), `visible=${visible} text='${(text || "").trim()}'`);
  } catch (e) {
    record("COPY_BUTTON", false, "exception: " + (e as Error).message);
  }

  try {
    const admin = frame.locator("nav.tab-nav button[data-page='reservationAdmin']").first();
    const visible = await admin.isVisible({ timeout: 5000 }).catch(() => false);
    const text = visible ? (await admin.textContent().catch(() => "")) : "";
    record("RES_ADMIN_INTACT", visible && (text || "").includes("予約管理"), `visible=${visible} text='${(text || "").trim()}'`);
  } catch (e) {
    record("RES_ADMIN_INTACT", false, "exception: " + (e as Error).message);
  }

  console.log("\n═══════════════════════════════════════════════════════════");
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log(`  total=${results.length}  pass=${passed}  fail=${failed}`);
  if (failed > 0) {
    console.log("\n❌ FAIL");
    process.exit(1);
  }
  console.log("\n✅ ALL PASS — @81 prod nav has the R-2D public-reservation link");
  process.exit(0);
}

main().catch((e) => { console.error("[r2d-prod-smoke] 例外: " + (e?.message || e)); process.exit(1); });
