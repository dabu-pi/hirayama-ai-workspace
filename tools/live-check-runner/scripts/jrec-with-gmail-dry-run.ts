/**
 * jrec-with-gmail-dry-run.ts
 *
 * Phase R-2C-gmail-no-spec-spam: standardized "Gmail-safe regression wrapper".
 *
 * Why this exists:
 *   The JREC-SF01 production reservation flow has notification_mode=gmail
 *   since R-2C-gmail-enable. Any test that submits a real reservation —
 *   notably `npm run test:jrec:reservation-admin` (LiveCheck太郎 fixture) —
 *   would dispatch 3 real Gmail messages to the clinic per run. We've been
 *   manually flipping notification_mode to dry_run before regressions and
 *   back to gmail after, since R-2C-gmail-enable. This wrapper makes that
 *   pattern a single command and removes the human step.
 *
 * What it does:
 *   1. Connect to Chrome over CDP (port 9222) and call
 *      runDebugNotificationConfigV1 to read the *current* notification_mode.
 *   2. If current is "gmail", call runSetNotificationModeV1("dry_run") to
 *      temporarily disable real sending. If current is "dry_run" or
 *      "disabled", record that and leave it (the wrapper is a no-op for
 *      mode handling in those cases).
 *   3. Spawn `npm run <scriptName>` as a subprocess; stream its stdout/stderr
 *      so the operator sees test progress as if they had run it directly.
 *   4. In a finally block (always — even on subprocess failure / wrapper
 *      exceptions), restore the original mode. If the original was "gmail",
 *      flip back via runSetNotificationModeV1("gmail").
 *   5. Run a smoke check (CONFIG_STATE + CRON_PRESERVED) via
 *      runDebugNotificationConfigV1 + listSlotsRegenTriggers. If either
 *      diverges from the expected post-state, surface HUMAN_ACTION_REQUIRED.
 *   6. Exit code = whichever of (subprocess, restore, smoke) failed first.
 *
 * Usage:
 *   npx tsx scripts/jrec-with-gmail-dry-run.ts <npm-script-name>
 *
 * Examples:
 *   npx tsx scripts/jrec-with-gmail-dry-run.ts test:jrec:reservation-admin
 *
 * Or via package.json:
 *   npm run test:jrec:reservation-admin:safe
 *
 * Pre-conditions:
 *   - Chrome CDP listening on http://localhost:9222
 *   - GAS web app reachable on /dev with auth.json (the wrapper doesn't use
 *     auth.json directly, but the spec it spawns usually does)
 *   - Apps Script helpers available: runDebugNotificationConfigV1,
 *     runSetNotificationModeV1, listSlotsRegenTriggers
 *
 * Failure modes the wrapper handles:
 *   - subprocess non-zero exit → still restores mode + runs smoke
 *   - mode restore fails → smoke runs anyway, both errors surfaced
 *   - smoke fails → exit non-zero, output explicit HUMAN_ACTION_REQUIRED
 *   - CDP unreachable → fail early without running the subprocess
 *
 * What this wrapper does NOT do:
 *   - It does not reset Reservation_Slots / Calendar / any other state
 *   - It does not delete test data; specs are responsible for their own cleanup
 *   - It does not deploy or push anything
 */
import { chromium, type Page, type FrameLocator } from "@playwright/test";
import { spawn } from "child_process";
import path from "path";

const DEV_URL =
  "https://script.google.com/macros/s/AKfycbzJWJAKCxStP82lfFl8eEHei98dWh7f6cgtEM33r3M5/dev?page=reservationAdmin";
const CDP_URL = "http://localhost:9222";
const TIMEOUT = 25_000;
const RPC_TIMEOUT = 40_000;

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

function header(text: string) {
  const bar = "═".repeat(63);
  console.log("\n" + bar);
  console.log("  " + text);
  console.log(bar);
}

type Mode = "disabled" | "dry_run" | "gmail";
function asMode(s: unknown): Mode {
  const v = String(s || "").toLowerCase();
  if (v === "disabled" || v === "dry_run" || v === "gmail") return v;
  return "dry_run";
}

interface Outcome {
  preMode: Mode | "unknown";
  flippedTo: Mode | null; // null if no-op
  specExitCode: number | null;
  restoreOk: boolean | null; // null if no restore needed
  restoredMode: Mode | "unknown";
  smokeOk: boolean | null;
  smokeDetail: string;
}

async function runNpmSubprocess(scriptName: string, extraArgs: string[]): Promise<number> {
  return new Promise((resolve) => {
    // On Windows, npm is npm.cmd; child_process auto-resolves with shell:true
    const isWin = process.platform === "win32";
    const cmd = isWin ? "npm.cmd" : "npm";
    const args = ["run", scriptName].concat(extraArgs.length > 0 ? ["--"].concat(extraArgs) : []);
    console.log("[wrapper] spawning: " + cmd + " " + args.join(" "));
    const cwd = path.resolve(__dirname, "..");
    const child = spawn(cmd, args, { cwd, stdio: "inherit", shell: isWin });
    child.on("exit", (code) => resolve(typeof code === "number" ? code : 1));
    child.on("error", (err) => {
      console.error("[wrapper] subprocess error: " + (err.message || err));
      resolve(1);
    });
  });
}

async function main() {
  const scriptName = process.argv[2];
  const extraArgs = process.argv.slice(3);

  if (!scriptName) {
    console.error("usage: npx tsx scripts/jrec-with-gmail-dry-run.ts <npm-script-name> [extra args...]");
    console.error("example: npx tsx scripts/jrec-with-gmail-dry-run.ts test:jrec:reservation-admin");
    process.exit(2);
  }

  header("jrec-with-gmail-dry-run — safe regression wrapper");
  console.log("  target script: npm run " + scriptName + (extraArgs.length ? " -- " + extraArgs.join(" ") : ""));
  console.log("  guard:         notification_mode → dry_run during spec, gmail after");

  // Connect to CDP. If this fails, abort before running anything.
  let browser;
  try {
    browser = await chromium.connectOverCDP(CDP_URL, { timeout: 5000 });
  } catch (err) {
    console.error("\n❌ CDP に接続できません (port 9222): " + (err as Error).message);
    console.error("   Chrome を --remote-debugging-port=9222 で起動してから再実行してください。");
    console.error("   wrapper は本番 mode を変更していないため、production は安全な状態です。");
    process.exit(1);
  }

  const ctx = browser.contexts()[0];
  const page = await ctx.newPage();
  page.setDefaultTimeout(TIMEOUT);
  await page.goto(DEV_URL, { waitUntil: "domcontentloaded" });
  const frame = gasAppFrame(page);
  await frame.locator(".filter-bar").first().waitFor({ state: "visible", timeout: TIMEOUT });

  const outcome: Outcome = {
    preMode: "unknown",
    flippedTo: null,
    specExitCode: null,
    restoreOk: null,
    restoredMode: "unknown",
    smokeOk: null,
    smokeDetail: ""
  };

  // ── STEP 1: read current mode ─────────────────────────────
  header("STEP 1: read current notification_mode");
  try {
    const cfg = (await Promise.race([
      callRpc(frame, "runDebugNotificationConfigV1", []),
      timeoutAfter(RPC_TIMEOUT, "config timeout"),
    ])) as { ok: boolean; mode: string; recipient: string };
    if (!cfg?.ok) throw new Error("runDebugNotificationConfigV1 returned !ok");
    outcome.preMode = asMode(cfg.mode);
    console.log("[wrapper] current mode: " + outcome.preMode + " (recipient='" + (cfg.recipient || "") + "')");
  } catch (err) {
    console.error("[wrapper] STEP 1 FAIL: " + (err as Error).message);
    console.error("   wrapper は subprocess を実行せずに終了します。production の mode は無変更です。");
    await browser.close().catch(() => {});
    process.exit(1);
  }

  // ── STEP 2: flip to dry_run if needed ─────────────────────
  if (outcome.preMode === "gmail") {
    header("STEP 2: flip notification_mode → dry_run");
    try {
      const r = (await Promise.race([
        callRpc(frame, "runSetNotificationModeV1", ["dry_run"]),
        timeoutAfter(RPC_TIMEOUT, "set dry_run timeout"),
      ])) as { ok: boolean; mode: string; previousMode: string };
      if (!r?.ok || asMode(r.mode) !== "dry_run") {
        throw new Error("flip to dry_run did not stick (mode=" + r?.mode + ")");
      }
      outcome.flippedTo = "dry_run";
      console.log("[wrapper] mode flipped: " + r.previousMode + " → " + r.mode);
    } catch (err) {
      console.error("[wrapper] STEP 2 FAIL: " + (err as Error).message);
      console.error("   subprocess を実行せずに終了します。最後の状態を確認してください。");
      await browser.close().catch(() => {});
      process.exit(1);
    }
  } else {
    header("STEP 2: skip flip (no-op)");
    console.log("[wrapper] current mode '" + outcome.preMode + "' is already safe; no flip needed");
  }

  // ── STEP 3: run subprocess ────────────────────────────────
  header("STEP 3: run subprocess (mode=" + (outcome.flippedTo || outcome.preMode) + ")");
  try {
    outcome.specExitCode = await runNpmSubprocess(scriptName, extraArgs);
    console.log("[wrapper] subprocess exit code: " + outcome.specExitCode);
  } catch (err) {
    outcome.specExitCode = 1;
    console.error("[wrapper] subprocess exception: " + (err as Error).message);
  }

  // ── STEP 4: restore mode (always) ─────────────────────────
  if (outcome.flippedTo) {
    header("STEP 4: restore notification_mode → " + outcome.preMode);
    try {
      const r = (await Promise.race([
        callRpc(frame, "runSetNotificationModeV1", [outcome.preMode]),
        timeoutAfter(RPC_TIMEOUT, "restore mode timeout"),
      ])) as { ok: boolean; mode: string; previousMode: string };
      outcome.restoreOk = !!r?.ok && asMode(r.mode) === outcome.preMode;
      outcome.restoredMode = asMode(r?.mode);
      console.log("[wrapper] restore: " + r?.previousMode + " → " + r?.mode + " (ok=" + outcome.restoreOk + ")");
    } catch (err) {
      outcome.restoreOk = false;
      console.error("[wrapper] STEP 4 FAIL: " + (err as Error).message);
    }
  } else {
    outcome.restoreOk = true; // nothing to restore
    outcome.restoredMode = outcome.preMode === "unknown" ? "unknown" : outcome.preMode;
    console.log("[wrapper] no restore needed (no flip occurred)");
  }

  // ── STEP 5: smoke (mode + cron) ───────────────────────────
  header("STEP 5: smoke — mode + cron count");
  try {
    const cfg = (await Promise.race([
      callRpc(frame, "runDebugNotificationConfigV1", []),
      timeoutAfter(RPC_TIMEOUT, "smoke config timeout"),
    ])) as { ok: boolean; mode: string; recipient: string };
    const triggers = (await Promise.race([
      callRpc(frame, "listSlotsRegenTriggers", []),
      timeoutAfter(RPC_TIMEOUT, "smoke triggers timeout"),
    ])) as { ok: boolean; count: number };

    const modeOk = !!cfg?.ok && asMode(cfg.mode) === outcome.preMode;
    const cronOk = !!triggers?.ok && triggers.count === 1;
    outcome.smokeOk = modeOk && cronOk;
    outcome.smokeDetail = "mode=" + cfg?.mode + " (target=" + outcome.preMode + ") / cron count=" + triggers?.count + " (target=1)";
    console.log("[wrapper] smoke: " + outcome.smokeDetail + " → " + (outcome.smokeOk ? "OK" : "MISMATCH"));
  } catch (err) {
    outcome.smokeOk = false;
    outcome.smokeDetail = "exception: " + (err as Error).message;
    console.error("[wrapper] STEP 5 FAIL: " + outcome.smokeDetail);
  }

  await browser.close().catch(() => {});

  // ── Summary ───────────────────────────────────────────────
  header("Summary");
  console.log("  pre mode:        " + outcome.preMode);
  console.log("  flipped to:      " + (outcome.flippedTo || "(no-op)"));
  console.log("  spec exit code:  " + outcome.specExitCode);
  console.log("  restore ok:      " + outcome.restoreOk);
  console.log("  restored mode:   " + outcome.restoredMode);
  console.log("  smoke ok:        " + outcome.smokeOk);
  console.log("  smoke detail:    " + outcome.smokeDetail);

  // Determine exit code: 0 only if spec passed AND restore ok AND smoke ok.
  // If spec failed but restore + smoke ok, exit with spec's code (typically 1).
  // If restore or smoke failed, surface as HUMAN_ACTION_REQUIRED and exit 1.
  const specOk = outcome.specExitCode === 0;
  const allOk = specOk && outcome.restoreOk === true && outcome.smokeOk === true;

  if (allOk) {
    console.log("\n✅ ALL OK — spec PASS, mode restored to " + outcome.preMode + ", cron count=1 preserved.");
    process.exit(0);
  }

  if (specOk && outcome.restoreOk === true && outcome.smokeOk === false) {
    console.error("\n❌ SMOKE FAILED after restore. Spec passed but post-state diverged.");
    console.error("   HUMAN_ACTION_REQUIRED:");
    console.error("     URL:    https://script.google.com/d/1-1opRkAFbFQz96Uqlgy3sWjgAs_PKS_1Eg9Pz7_6geTFztHx_5APSj2G/edit");
    console.error("     ファイル: JREC_SF01_Reservation.gs");
    console.error("     関数:    runDebugNotificationConfigV1 / listSlotsRegenTriggers / runSetNotificationModeV1");
    console.error("     期待:    mode=" + outcome.preMode + " / cron count=1");
    console.error("     判断:    npx tsx scripts/jrec-r2c-gmail-prod-smoke.ts が PASS すること");
    process.exit(1);
  }

  if (outcome.restoreOk === false) {
    console.error("\n❌ RESTORE FAILED. Current mode may still be 'dry_run'.");
    console.error("   HUMAN_ACTION_REQUIRED:");
    console.error("     URL:    https://script.google.com/d/1-1opRkAFbFQz96Uqlgy3sWjgAs_PKS_1Eg9Pz7_6geTFztHx_5APSj2G/edit");
    console.error("     ファイル: JREC_SF01_Reservation.gs");
    console.error("     関数:    runSetNotificationModeV1");
    console.error("     入力:    引数欄に \"" + outcome.preMode + "\"");
    console.error("     期待:    実行ログに [runSetNotificationModeV1] notification_mode: ... -> " + outcome.preMode);
    console.error("     判断:    npx tsx scripts/jrec-r2c-gmail-prod-smoke.ts で mode=" + outcome.preMode + " 確認");
    process.exit(1);
  }

  // spec failed but restore+smoke succeeded → forward spec's failure
  console.error("\n❌ Spec FAILED (mode + cron preserved correctly).");
  process.exit(outcome.specExitCode || 1);
}

main().catch((e) => {
  console.error("[wrapper] 予期しない例外: " + (e?.message || e));
  console.error("   production の最終 mode は未確認です。手動で確認してください:");
  console.error("     npx tsx scripts/jrec-r2c-gmail-prod-smoke.ts");
  process.exit(1);
});
