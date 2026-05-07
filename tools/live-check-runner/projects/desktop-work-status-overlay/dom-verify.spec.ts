/**
 * dom-verify.spec.ts — Phase 3-D(DOM)-1b fixture verification
 *
 * Tests domDetector.js in a real Chromium browser using local fixture pages.
 * The detector is injected via page.addScriptTag (not via the Chrome extension
 * mechanism) because content scripts require https:// URLs matching the manifest.
 * This verifies the detection logic in a real browser DOM context.
 *
 * Privacy contract tests confirm that sentinel text in fixture pages
 * does NOT leak into detection output.
 *
 * DWSO-3D1-F1: ChatGPT idle fixture → app=chatgpt, status=idle
 * DWSO-3D1-F2: ChatGPT responding fixture → app=chatgpt, status=responding
 * DWSO-3D1-F3: Claude idle fixture → app=claude, status=idle
 * DWSO-3D1-F4: Claude responding fixture → app=claude, status=responding
 * DWSO-3D1-P1: Privacy — sentinel NOT in chatgpt detection output
 * DWSO-3D1-P2: Privacy — sentinel NOT in claude detection output
 * DWSO-3D1-S1: source is always "dom_monitor"
 */

import { test, expect } from "@playwright/test";
import { readFileSync } from "fs";
import path from "path";

const PROJECT_ROOT = String.raw`C:\hirayama-ai-workspace\workspace\desktop-work-status-overlay`;
const DETECTOR_PATH = path.join(PROJECT_ROOT, "browser-extension", "content", "domDetector.js");
const FIXTURES_DIR  = path.join(PROJECT_ROOT, "tests", "fixtures", "dom-monitor");

const DETECTOR_JS = readFileSync(DETECTOR_PATH, "utf-8");

/** Open a fixture page, inject domDetector.js, run detection for the given urlHost. */
async function detectOnFixture(
  page: import("@playwright/test").Page,
  fixture: string,
  urlHost: string
) {
  const fixturePath = "file:///" + path.join(FIXTURES_DIR, fixture).replace(/\\/g, "/");
  await page.goto(fixturePath);
  await page.addScriptTag({ content: DETECTOR_JS });
  const result = await page.evaluate((host: string) => {
    const fn = (window as any).__dwso_detect;
    if (typeof fn !== "function") return null;
    return fn({ urlHost: host });
  }, urlHost);
  return result;
}

// ── Fixture detection tests ────────────────────────────────────────────────

test.describe("DWSO Phase 3-D(DOM)-1b: DOM Detector fixture verification", () => {

  test("DWSO-3D1-F1: ChatGPT idle → app=chatgpt, status=idle", async ({ page }) => {
    const r = await detectOnFixture(page, "chatgpt-idle.html", "chatgpt.com");
    expect(r).not.toBeNull();
    expect(r.app).toBe("chatgpt");
    expect(r.status).toBe("idle");
    expect(r.stopButtonVisible).toBe(false);
    expect(r.inputEnabled).toBe(true);
    expect(r.sendButtonEnabled).toBe(true);
    expect(r.source).toBe("dom_monitor");
    console.log("[DWSO-3D1-F1]", r.app, r.status, r.confidence);
  });

  test("DWSO-3D1-F2: ChatGPT responding → status=responding", async ({ page }) => {
    const r = await detectOnFixture(page, "chatgpt-responding.html", "chatgpt.com");
    expect(r).not.toBeNull();
    expect(r.app).toBe("chatgpt");
    expect(r.status).toBe("responding");
    expect(r.stopButtonVisible).toBe(true);
    expect(r.inputEnabled).toBe(false);
    expect(r.sendButtonEnabled).toBe(false);
    console.log("[DWSO-3D1-F2]", r.app, r.status, r.confidence);
  });

  test("DWSO-3D1-F3: Claude idle → app=claude, status=idle", async ({ page }) => {
    const r = await detectOnFixture(page, "claude-idle.html", "claude.ai");
    expect(r).not.toBeNull();
    expect(r.app).toBe("claude");
    expect(r.status).toBe("idle");
    expect(r.stopButtonVisible).toBe(false);
    expect(r.inputEnabled).toBe(true);
    expect(r.sendButtonEnabled).toBe(true);
    console.log("[DWSO-3D1-F3]", r.app, r.status, r.confidence);
  });

  test("DWSO-3D1-F4: Claude responding → status=responding", async ({ page }) => {
    const r = await detectOnFixture(page, "claude-responding.html", "claude.ai");
    expect(r).not.toBeNull();
    expect(r.app).toBe("claude");
    expect(r.status).toBe("responding");
    expect(r.stopButtonVisible).toBe(true);
    console.log("[DWSO-3D1-F4]", r.app, r.status, r.confidence);
  });

  // ── Privacy contract tests ──────────────────────────────────────────────

  test("DWSO-3D1-P1: Privacy — sentinel NOT in chatgpt detection output", async ({ page }) => {
    const r = await detectOnFixture(page, "chatgpt-idle.html", "chatgpt.com");
    const s = JSON.stringify(r);
    expect(s).not.toContain("FIXTURE_SENTINEL_SECRET");
    console.log("[DWSO-3D1-P1] chatgpt sentinel check PASS");
  });

  test("DWSO-3D1-P2: Privacy — sentinel NOT in claude detection output", async ({ page }) => {
    const r = await detectOnFixture(page, "claude-responding.html", "claude.ai");
    const s = JSON.stringify(r);
    expect(s).not.toContain("FIXTURE_SENTINEL_SECRET");
    console.log("[DWSO-3D1-P2] claude sentinel check PASS");
  });

  // ── Source field test ───────────────────────────────────────────────────

  test("DWSO-3D1-S1: source is always dom_monitor", async ({ page }) => {
    for (const [fixture, host] of [
      ["chatgpt-idle.html",      "chatgpt.com"],
      ["chatgpt-responding.html","chatgpt.com"],
      ["claude-idle.html",       "claude.ai"],
      ["claude-responding.html", "claude.ai"],
    ] as const) {
      const r = await detectOnFixture(page, fixture, host);
      expect(r?.source).toBe("dom_monitor");
    }
    console.log("[DWSO-3D1-S1] source=dom_monitor confirmed for all fixtures");
  });

});
