/**
 * jrec-sf01 admin-reservation-calendar-r2m.spec.ts
 *
 * Phase R-2M-admin-calendar (2026-05-21): 院長向け予約管理カレンダー表示の検証。
 *
 * 検証ポイント:
 *   - ?page=reservationAdmin が HTTP 200 + cal-section / cal-grid を含む
 *   - view-toggle に「📅 カレンダー」「📋 一覧」が並ぶ
 *   - 既存一覧 (#list-section) も DOM に残っている（破壊していないこと）
 *   - getReservationAdminCalendarData(today) が ok=true / 7 日 / 各日に slots + summary
 *   - 平日に slots.length=6 / 土曜 3 / 日曜 isClosed=true
 *   - slotEnd は slotStart + 45 min（R-2J 維持）
 *   - badges の構造（kind / label / reason 3 フィールド）
 *
 * READ-only: RPC は表示専用。Reservations / Slots / Calendar に書き込まない。
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

function ymd(d: Date): string {
  return d.getFullYear() + "-" +
    ("0" + (d.getMonth() + 1)).slice(-2) + "-" +
    ("0" + d.getDate()).slice(-2);
}

type CalRes = {
  ok: boolean;
  weekStart: string;
  weekEnd: string;
  today: string;
  capacity: number;
  days: Array<{
    date: string;
    dow: number;
    isToday: boolean;
    isPast: boolean;
    isClosed: boolean;
    slots: Array<{
      slotStart: string;
      slotEnd: string;
      status: string;
      displayStatus: string;
      remaining: number;
      capacity: number;
      reservations: Array<{
        reservationId: string;
        status: string;
        patientName: string;
        isFirstVisit: boolean;
        hasPhone: boolean;
        hasSymptoms: boolean;
        hasNotes: boolean;
        linkedPatientId: string;
        linkedVisitKey: string;
        badges: Array<{ kind: string; label: string; reason: string }>;
      }>;
    }>;
    summary: {
      total: number; available: number; reserved: number;
      blockedCalendar: number; blockedManual: number; fullyBooked: number;
      needsAttention: number; urgent: number;
    };
  }>;
};

test.describe(`JREC-SF01 R-2M-admin-calendar 予約管理カレンダー [auth: ${HAS_AUTH ? "あり" : "なし"}]`, () => {
  test.beforeEach(async ({ page }) => { page.setDefaultTimeout(LOAD_TIMEOUT); });

  test("AC-1: 予約管理ページが /dev で表示され cal-section / cal-grid が DOM に存在", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#cal-section").first().waitFor({ state: "attached", timeout: LOAD_TIMEOUT });
    await expect(frame.locator("#cal-grid").first()).toBeAttached();
    await expect(frame.locator("#view-cal-btn").first()).toBeVisible();
    await expect(frame.locator("#view-list-btn").first()).toBeVisible();
    // 既存一覧も破壊されていないこと
    await expect(frame.locator("#list-section").first()).toBeAttached();
    await expect(frame.locator("#res-list").first()).toBeAttached();
  });

  test("AC-2: getReservationAdminCalendarData(today) が ok=true / 7 日返却", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#cal-section").first().waitFor({ state: "attached", timeout: LOAD_TIMEOUT });
    const r = (await callRpc(frame, "getReservationAdminCalendarData", [ymd(new Date())])) as CalRes;
    expect(r.ok).toBe(true);
    expect(r.days).toBeDefined();
    expect(r.days.length).toBe(7);
  });

  test("AC-3: 各日に summary フィールド（total/available/reserved/urgent/needsAttention 等）が揃う", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#cal-section").first().waitFor({ state: "attached", timeout: LOAD_TIMEOUT });
    const r = (await callRpc(frame, "getReservationAdminCalendarData", [ymd(new Date())])) as CalRes;
    expect(r.ok).toBe(true);
    for (const d of r.days) {
      expect(typeof d.summary.total).toBe("number");
      expect(typeof d.summary.available).toBe("number");
      expect(typeof d.summary.reserved).toBe("number");
      expect(typeof d.summary.blockedCalendar).toBe("number");
      expect(typeof d.summary.blockedManual).toBe("number");
      expect(typeof d.summary.fullyBooked).toBe("number");
      expect(typeof d.summary.urgent).toBe("number");
      expect(typeof d.summary.needsAttention).toBe("number");
    }
  });

  test("AC-4: 平日 slots=6 / 土曜 slots=3 / 日曜 isClosed=true（R-2J 仕様維持）", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#cal-section").first().waitFor({ state: "attached", timeout: LOAD_TIMEOUT });
    // 来週（過去日影響を避ける）
    const next = new Date();
    next.setDate(next.getDate() + 7);
    const r = (await callRpc(frame, "getReservationAdminCalendarData", [ymd(next)])) as CalRes;
    expect(r.ok).toBe(true);
    for (const d of r.days) {
      if (d.dow === 0) {
        expect(d.isClosed, `${d.date} (日) は isClosed=true であるべき`).toBe(true);
      } else if (d.dow === 6) {
        // 土曜の slot 数は 3（午前のみ）
        expect(d.slots.length, `${d.date} (土) は 3 slots であるべき（R-2J 仕様）`).toBe(3);
      } else if (d.dow >= 1 && d.dow <= 5) {
        // 平日は 6 枠
        expect(d.slots.length, `${d.date} (dow=${d.dow}) は 6 slots であるべき（R-2J 仕様）`).toBe(6);
      }
    }
  });

  test("AC-5: slotEnd は slotStart + 45 min (R-2J 仕様維持)", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#cal-section").first().waitFor({ state: "attached", timeout: LOAD_TIMEOUT });
    const next = new Date();
    next.setDate(next.getDate() + 7);
    const r = (await callRpc(frame, "getReservationAdminCalendarData", [ymd(next)])) as CalRes;
    expect(r.ok).toBe(true);
    for (const d of r.days) {
      for (const sl of d.slots) {
        const [sH, sM] = sl.slotStart.split(":").map(n => parseInt(n, 10));
        const [eH, eM] = sl.slotEnd.split(":").map(n => parseInt(n, 10));
        const diff = (eH * 60 + eM) - (sH * 60 + sM);
        expect(diff, `${d.date} ${sl.slotStart}-${sl.slotEnd} は 45 分であるべき`).toBe(45);
      }
    }
  });

  test("AC-6: badges 構造（あれば kind/label/reason 3 フィールド）", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#cal-section").first().waitFor({ state: "attached", timeout: LOAD_TIMEOUT });
    const r = (await callRpc(frame, "getReservationAdminCalendarData", [ymd(new Date())])) as CalRes;
    expect(r.ok).toBe(true);
    for (const d of r.days) {
      for (const sl of d.slots) {
        for (const res of (sl.reservations || [])) {
          for (const b of (res.badges || [])) {
            expect(typeof b.kind, "badge.kind は string").toBe("string");
            expect(typeof b.label, "badge.label は string").toBe("string");
            expect(typeof b.reason, "badge.reason は string").toBe("string");
            expect(b.kind === "urgent" || b.kind === "attention" || b.kind === "info",
              "badge.kind は urgent/attention/info のいずれか").toBe(true);
          }
        }
      }
    }
  });

  test("AC-7: 既存 listReservationsForAdmin RPC が壊れていない（list view 維持確認）", async ({ page }) => {
    await page.goto(ADMIN_URL, { waitUntil: "domcontentloaded" });
    await handleAuthRedirect(page);
    const frame = gasAppFrame(page);
    await frame.locator("#cal-section").first().waitFor({ state: "attached", timeout: LOAD_TIMEOUT });
    const today = ymd(new Date());
    const r = (await callRpc(frame, "listReservationsForAdmin", [{ dateFrom: today, dateTo: today, status: "all", query: "" }])) as { ok: boolean; items: unknown[]; total: number };
    expect(r.ok).toBe(true);
    expect(Array.isArray(r.items)).toBe(true);
    expect(typeof r.total).toBe("number");
  });
});
