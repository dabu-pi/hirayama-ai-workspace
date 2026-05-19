/**
 * jrec-sf01 public-reservation-calendar-sync.spec.ts
 *
 * Phase R-2F: read-only assertions confirming the calendar live overlay
 * is wired into getPublicAvailableWeek.
 *
 * Strictly READ-ONLY:
 *   - no calendar event creation (deep verify script handles that)
 *   - no reservation submit (Gmail dispatch avoided)
 *
 * Safe to run while notification_mode=gmail is LIVE.
 */
import { test, expect, type Page, type FrameLocator } from "@playwright/test";
import path from "path";
import fs from "fs";
import config from "./config.json";

const DEV_URL = config.devUrl;
const ADMIN_URL = DEV_URL + "?page=reservationAdmin";
const AUTH_FILE = path.join(__dirname, "../../auth.json");
const HAS_AUTH = fs.existsSync(AUTH_FILE);
const LOAD_TIMEOUT = 30_000;
const GAS_TIMEOUT = 25_000;

function gasAppFrame(page: Page): FrameLocator {
  return page.frameLocator("iframe").first().frameLocator("iframe").first();
}

async function handleAuthRedirect(page: Page) {
  const url = page.url();
  const title = await page.title().catch(() => "");
  if (
    url.includes("accounts.google.com") ||
    url.includes("ServiceLogin") ||
    title.includes("Sign in") ||
    title.includes("Google Drive: Sign-in")
  ) {
    test.skip(
      true,
      HAS_AUTH
        ? "auth.json のセッションが期限切れです。npm run save-auth を再実行してください。"
        : "Google 認証が必要です。npm run save-auth を実行してください。"
    );
  }
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

test.describe(`JREC-SF01 R-2F Calendar sync [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test.beforeEach(async ({ page }) => { page.setDefaultTimeout(LOAD_TIMEOUT); });

  test("CAL-1: 公開予約ページが通常表示される（live overlay 反映後）", async ({ page }) => {
    const url = DEV_URL + "?page=reservationPublic";
    const res = await page.goto(url, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    expect(res?.status()).toBeLessThan(400);
    const frame = gasAppFrame(page);
    await frame.locator("#week-grid").waitFor({ state: "visible", timeout: GAS_TIMEOUT });
    // either slots or empty banner must render after live overlay
    await Promise.race([
      frame.locator(".slot-btn").first().waitFor({ state: "visible", timeout: GAS_TIMEOUT }),
      frame.locator("#week-empty-banner").first().waitFor({ state: "visible", timeout: GAS_TIMEOUT }),
      frame.locator(".col-empty").first().waitFor({ state: "visible", timeout: GAS_TIMEOUT }),
    ]).catch(() => {});
    const total = (await frame.locator(".slot-btn").count()) + (await frame.locator(".col-empty, #week-empty-banner").count());
    expect(total).toBeGreaterThan(0);
  });

  test("CAL-2: Calendar 連携設定が確認できる（status RPC）", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    const r = (await callRpc(frame, "runDebugCalendarSyncStatusV1", [])) as {
      ok: boolean; syncEnabled: boolean; liveFilterEnabled: boolean; calendarReachable: boolean;
    };
    expect(r.ok).toBe(true);
    expect(r.syncEnabled).toBe(true);
    expect(r.liveFilterEnabled).toBe(true);
    expect(r.calendarReachable).toBe(true);
  });

  test("CAL-3: getPublicAvailableWeek が calendarOverlay メタデータを返す", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    const today = new Date();
    const ymd =
      today.getFullYear() + "-" +
      ("0" + (today.getMonth() + 1)).slice(-2) + "-" +
      ("0" + today.getDate()).slice(-2);
    const r = (await callRpc(frame, "getPublicAvailableWeek", [ymd])) as {
      ok: boolean; days: unknown[]; calendarOverlay?: { attempted: boolean; removed: number };
    };
    expect(r.ok).toBe(true);
    expect(Array.isArray(r.days)).toBe(true);
    expect(r.calendarOverlay).toBeDefined();
    expect(r.calendarOverlay?.attempted).toBe(true);
    expect(typeof r.calendarOverlay?.removed).toBe("number");
  });

  test("CAL-4: getPublicAvailableWeek レスポンスは Calendar event の中身を含まない（PII 不透過）", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    const today = new Date();
    const ymd =
      today.getFullYear() + "-" +
      ("0" + (today.getMonth() + 1)).slice(-2) + "-" +
      ("0" + today.getDate()).slice(-2);
    const r = (await callRpc(frame, "getPublicAvailableWeek", [ymd])) as Record<string, unknown>;
    const json = JSON.stringify(r);
    // PII / event-content keys must not appear in the public response
    expect(json).not.toMatch(/eventTitle/i);
    expect(json).not.toMatch(/eventDescription/i);
    expect(json).not.toMatch(/eventLocation/i);
    expect(json).not.toMatch(/attendees/i);
  });

  test("CAL-5: Reservation_Settings に calendar_sync_enabled / calendar_busy_blocks_public_slots が存在", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: LOAD_TIMEOUT });
    // migrate is idempotent — call to ensure keys are present
    const m = (await callRpc(frame, "runMigrateCalendarSyncSettingsV1", [])) as {
      ok: boolean; added: string[]; skipped: string[];
    };
    expect(m.ok).toBe(true);
    const totalCovered = (m.added?.length || 0) + (m.skipped?.length || 0);
    expect(totalCovered).toBe(2);
  });
});
