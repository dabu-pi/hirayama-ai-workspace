/**
 * jrec-r2e-clinic-phone-display-smoke.ts
 *
 * Phase R-2E: temporarily set Settings.clinic_phone to a clearly-fake
 * placeholder, verify the public reservation page renders the phone
 * banner + tel: link correctly, then revert the value to empty.
 *
 * The placeholder used here is "000-TEST-R2E" — not a real phone number
 * and obviously identifiable as a test artifact. The script ALWAYS reverts
 * to empty in a try/finally, so production state ends back at "no phone
 * displayed" regardless of pass/fail.
 *
 * Run while notification_mode=gmail is LIVE — safe (no reservation submit).
 */
import { chromium, type Page, type FrameLocator } from "@playwright/test";

const DEV_URL =
  "https://script.google.com/macros/s/AKfycbzJWJAKCxStP82lfFl8eEHei98dWh7f6cgtEM33r3M5/dev?page=reservationAdmin";
const PUBLIC_URL =
  "https://script.google.com/macros/s/AKfycbzJWJAKCxStP82lfFl8eEHei98dWh7f6cgtEM33r3M5/dev?page=reservationPublic";
const CDP_URL = "http://localhost:9222";
const TIMEOUT = 25_000;
const RPC_TIMEOUT = 40_000;
const PLACEHOLDER = "000-TEST-R2E";

interface Result { name: string; ok: boolean; detail: string; }
const results: Result[] = [];
function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log((ok ? "✅ PASS" : "❌ FAIL") + "  [" + name + "]  " + detail);
}
function gasAppFrame(page: Page): FrameLocator {
  return page.frameLocator("iframe").first().frameLocator("iframe").first();
}
async function callRpc(frame: FrameLocator, fn: string, args: unknown[]): Promise<unknown> {
  return await frame.locator("body").first().evaluate(
    (_el: Element, payload: { fn: string; args: unknown[] }) => {
      return new Promise((resolve, reject) => {
        const g = (window as unknown as { google?: { script?: { run?: Record<string, unknown> } } }).google;
        if (!g?.script?.run) { reject(new Error("google.script.run not available")); return; }
        const runner = g.script.run as Record<string, unknown>;
        const ws = (runner["withSuccessHandler"] as (h: (r: unknown) => void) => unknown)((r) => resolve(r));
        const wf = ((ws as Record<string, unknown>)["withFailureHandler"] as (h: (e: { message?: string }) => void) => unknown)((e) => reject(new Error("RPC failure: " + (e?.message || ""))));
        const fnRef = (wf as Record<string, unknown>)[payload.fn] as (...a: unknown[]) => unknown;
        if (typeof fnRef !== "function") { reject(new Error("RPC not found: " + payload.fn)); return; }
        fnRef.apply(null, payload.args);
      });
    },
    { fn, args }
  );
}
function timeoutAfter<T>(ms: number, msg: string): Promise<T> {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(msg)), ms));
}
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  jrec-r2e-clinic-phone-display-smoke");
  console.log("  ⚠ 一時的に clinic_phone を fake 値 'PLACEHOLDER' に設定 → 表示確認 → 必ず空に戻す");
  console.log("═══════════════════════════════════════════════════════════");

  const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 5000 });
  const ctx = browser.contexts()[0];
  const adminPage = await ctx.newPage();
  adminPage.setDefaultTimeout(TIMEOUT);
  await adminPage.goto(DEV_URL, { waitUntil: "domcontentloaded" });
  const adminFrame = gasAppFrame(adminPage);
  await adminFrame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: TIMEOUT });

  try {
    // 1. Set placeholder
    const setRes = (await Promise.race([
      callRpc(adminFrame, "runSetClinicPhoneV1", [PLACEHOLDER]),
      timeoutAfter(RPC_TIMEOUT, "set timeout"),
    ])) as { ok: boolean; length: number; previousLength: number };
    record("SET_PLACEHOLDER", !!setRes?.ok && setRes.length === PLACEHOLDER.length, `prevLen=${setRes?.previousLength} newLen=${setRes?.length}`);

    // 2. Open public page in a separate tab + verify display
    const publicPage = await ctx.newPage();
    publicPage.setDefaultTimeout(TIMEOUT);
    await publicPage.goto(PUBLIC_URL, { waitUntil: "domcontentloaded" });
    const publicFrame = gasAppFrame(publicPage);
    await publicFrame.locator("header.header").first().waitFor({ state: "visible", timeout: TIMEOUT });

    // Wait for loadWeek RPC to complete (slot-btn or week-empty-banner appears)
    await Promise.race([
      publicFrame.locator(".slot-btn").first().waitFor({ state: "visible", timeout: TIMEOUT }),
      publicFrame.locator("#week-empty-banner").first().waitFor({ state: "visible", timeout: TIMEOUT }),
      publicFrame.locator(".col-empty").first().waitFor({ state: "visible", timeout: TIMEOUT }),
    ]).catch(() => {});
    // small grace period for applyClinicPhone() to finish DOM updates
    await sleep(500);

    try {
      // 公開ページ側で #header-phone は表示後 style.display = "" になる
      await publicFrame.locator("#header-phone").first().waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
      const headerPhoneWrap = publicFrame.locator("#header-phone");
      const visible = await headerPhoneWrap.isVisible({ timeout: 3000 }).catch(() => false);
      const phoneText = visible ? (await publicFrame.locator("#header-phone-text").textContent().catch(() => "")) : "";
      const link = visible ? (await publicFrame.locator("#header-phone-link").getAttribute("href")) : null;
      const expectedTelDigits = PLACEHOLDER.replace(/[^0-9+]/g, "");
      const linkOk = link === "tel:" + expectedTelDigits;
      record(
        "HEADER_PHONE_DISPLAY",
        visible && phoneText === PLACEHOLDER && linkOk,
        `visible=${visible} text='${phoneText}' tel='${link}' expected=tel:${expectedTelDigits}`
      );
    } catch (e) {
      record("HEADER_PHONE_DISPLAY", false, "exception: " + (e as Error).message);
    }

    try {
      const successText = publicFrame.locator("#success-phone-text");
      const txt = await successText.textContent().catch(() => "");
      record("STEP3_PHONE_TEXT", txt === PLACEHOLDER, `text='${txt}'`);
    } catch (e) {
      record("STEP3_PHONE_TEXT", false, "exception: " + (e as Error).message);
    }

    await publicPage.close().catch(() => {});

  } finally {
    // ALWAYS revert to empty
    try {
      const revert = (await Promise.race([
        callRpc(adminFrame, "runSetClinicPhoneV1", [""]),
        timeoutAfter(RPC_TIMEOUT, "revert timeout"),
      ])) as { ok: boolean; length: number };
      record("REVERT_TO_EMPTY", !!revert?.ok && revert.length === 0, `length=${revert?.length}`);
    } catch (e) {
      record("REVERT_TO_EMPTY", false, "exception: " + (e as Error).message + " — production state UNCERTAIN, check Settings.clinic_phone manually!");
    }
  }

  console.log("\n═══════════════════════════════════════════════════════════");
  const passed = results.filter((r) => r.ok).length;
  const failed = results.length - passed;
  console.log(`  total=${results.length}  pass=${passed}  fail=${failed}`);
  if (failed > 0) {
    console.log("\n❌ FAIL — verify Settings.clinic_phone is reverted to empty before proceeding");
    process.exit(1);
  }
  console.log("\n✅ ALL PASS — display works with placeholder, reverted to empty in finally");
  process.exit(0);
}

main().catch((e) => { console.error("[smoke] 例外: " + (e?.message || e)); process.exit(1); });
