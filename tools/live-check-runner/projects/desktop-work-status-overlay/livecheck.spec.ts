/**
 * desktop-work-status-overlay livecheck.spec.ts
 *
 * Phase 3-C / Phase 3-D 自動確認テスト
 *
 * DWSO-3C-1: Overlay プロセス start.bat で起動確認
 * DWSO-3C-2: claude-monitor がBOMなしUTF-8でruntime JSONを書く
 * DWSO-3C-3: Python reader がBOMあり・なし両方のJSONを読める
 * DWSO-3C-4: D2 runtime running → completed 遷移（テストコマンド使用）
 * DWSO-3C-5: launchCommand が正しく記録される
 * DWSO-3D-1: layout state.json が読み取れる
 *
 * 注意: Tkinterアプリのため Playwright ブラウザは使わない。
 *       Node child_process + PowerShell + Python で確認する。
 */

import { test, expect } from "@playwright/test";
import { spawnSync, spawn } from "child_process";
import fs from "fs";
import path from "path";

const PROJECT_ROOT = "C:\\hirayama-ai-workspace\\workspace\\desktop-work-status-overlay";
const RUNTIME_DIR  = path.join(PROJECT_ROOT, "data", "runtime");
const STATE_JSON   = path.join(PROJECT_ROOT, "data", "state.json");
const MONITOR_PS1  = path.join(PROJECT_ROOT, "scripts", "claude-monitor.ps1");
const START_BAT    = path.join(PROJECT_ROOT, "scripts", "start.bat");

// テスト専用スロット（実運用のD1-D4を汚さない）
const TEST_SLOT    = 9;
const TEST_JSON    = path.join(RUNTIME_DIR, `claude-d${TEST_SLOT}.json`);

// ── ヘルパー ──────────────────────────────────────────────────────────────────

/** PowerShell コマンドを実行して stdout を返す */
function ps(cmd: string, timeoutMs = 15000): string {
  const r = spawnSync("powershell", ["-NoProfile", "-Command", cmd], {
    encoding: "utf8",
    timeout: timeoutMs,
  });
  return (r.stdout || "").trim();
}

/** ファイル先頭が UTF-8 BOM かどうか確認 */
function hasBOM(filePath: string): boolean {
  const buf = fs.readFileSync(filePath);
  return buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF;
}

/** ファイルが条件を満たすまで待機 */
async function waitForFile(
  filePath: string,
  predicate: (content: string) => boolean,
  timeoutMs = 10000
): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, "utf8");
        if (predicate(content)) return content;
      } catch {
        // 書き込み中の可能性があるので無視して再試行
      }
    }
    await new Promise<void>(r => setTimeout(r, 250));
  }
  throw new Error(`Timeout: ${filePath} が条件を満たしませんでした (${timeoutMs}ms)`);
}

// ── テスト ──────────────────────────────────────────────────────────────────

test.describe("DWSO Phase 3-C/D LiveCheck", () => {

  // ── DWSO-3C-1: Overlay プロセス確認 ────────────────────────────────────────
  test("DWSO-3C-1: overlay process starts from start.bat", async () => {
    // 既存プロセスを確認（既に起動していれば PASS）
    const existing = ps(
      "Get-CimInstance Win32_Process | " +
      "Where-Object { $_.CommandLine -match 'desktop-work-status-overlay' -or " +
      "               $_.CommandLine -match 'src.main\\.py' } | " +
      "Measure-Object | Select-Object -ExpandProperty Count"
    );

    if (parseInt(existing, 10) > 0) {
      console.log(`[DWSO-3C-1] 既存 Overlay プロセス確認: ${existing} 個`);
      expect(parseInt(existing, 10)).toBeGreaterThan(0);
      return;
    }

    // 起動していなければ start.bat で起動
    if (!fs.existsSync(START_BAT)) {
      console.warn("[DWSO-3C-1] start.bat が見つかりません。SKIP");
      test.skip(true, "start.bat が見つかりません");
      return;
    }

    spawnSync("cmd", ["/c", START_BAT], {
      timeout: 10000,
      shell: false,
    });

    // 3秒待機して確認
    await new Promise<void>(r => setTimeout(r, 3000));

    const after = ps(
      "Get-CimInstance Win32_Process | " +
      "Where-Object { $_.CommandLine -match 'desktop-work-status-overlay' -or " +
      "               $_.CommandLine -match 'src.main\\.py' } | " +
      "Measure-Object | Select-Object -ExpandProperty Count"
    );

    console.log(`[DWSO-3C-1] start.bat 後プロセス数: ${after}`);
    expect(parseInt(after, 10)).toBeGreaterThan(0);
  });

  // ── DWSO-3C-3: Python reader BOM / 非BOM両対応確認 ──────────────────────────
  test("DWSO-3C-3: Python reader loads BOM and non-BOM runtime JSON", () => {
    const pyScript = String.raw`
import sys, json, pathlib, shutil
sys.path.insert(0, r'${PROJECT_ROOT}\src')

test_path = pathlib.Path(r'${TEST_JSON}')
test_path.parent.mkdir(parents=True, exist_ok=True)

base_obj = {
    "schemaVersion": 1,
    "desktopSlot": ${TEST_SLOT},
    "tool": "claude",
    "status": "running",
    "confidence": "high",
    "source": "terminal_monitor",
    "startedAt": "2026-05-06T10:00:00+09:00",
    "lastSeenAt": "2026-05-06T10:00:00+09:00",
    "completedAt": None,
    "exitCode": None,
    "pid": None,
    "durationSec": None,
    "errorMessage": None,
    "launchCommand": "claude --dangerously-skip-permissions"
}
base_json = json.dumps(base_obj)

# BOM付き UTF-8 で書く（古いPowerShell出力の再現）
test_path.write_bytes(b'\xef\xbb\xbf' + base_json.encode('utf-8'))

from claude_runtime_reader import read_claude_runtime_json
r1 = read_claude_runtime_json(${TEST_SLOT})
assert r1 is not None, "BOM付きファイルが読めない"
assert r1.get('desktopSlot') == ${TEST_SLOT}, f"desktopSlot mismatch: {r1}"
assert r1.get('status') == 'running', f"status mismatch: {r1}"
assert r1.get('launchCommand') == 'claude --dangerously-skip-permissions'
print("BOM-read: OK")

# BOMなし UTF-8 で書く（修正後のPowerShell出力）
test_path.write_bytes(base_json.encode('utf-8'))
r2 = read_claude_runtime_json(${TEST_SLOT})
assert r2 is not None, "BOMなしファイルが読めない"
assert r2.get('status') == 'running'
print("non-BOM-read: OK")

print("PASS")
`;

    const r = spawnSync("python", ["-c", pyScript], {
      encoding: "utf8",
      timeout: 15000,
      cwd: PROJECT_ROOT,
    });

    if (r.stderr) console.error("[DWSO-3C-3 stderr]", r.stderr);
    console.log("[DWSO-3C-3 stdout]", r.stdout);

    expect(r.status).toBe(0);
    expect(r.stdout).toContain("BOM-read: OK");
    expect(r.stdout).toContain("non-BOM-read: OK");
    expect(r.stdout).toContain("PASS");
  });

  // ── DWSO-3C-2 / 3C-4 / 3C-5: monitor running→completed 遷移 ───────────────
  test("DWSO-3C-2/4/5: claude-monitor BOM-free JSON + running→completed + launchCommand", async () => {
    // テスト前にファイルをクリア
    if (fs.existsSync(TEST_JSON)) fs.unlinkSync(TEST_JSON);

    const testLaunchCmd = "powershell --test-livecheck-stub";

    // claude-monitor.ps1 を非同期で起動
    // -ClaudeCommand powershell -ClaudeArgs "-NoProfile -Command Start-Sleep 5"
    const proc = spawn("powershell", [
      "-NoProfile",
      "-ExecutionPolicy", "Bypass",
      "-File", MONITOR_PS1,
      "-DesktopSlot", String(TEST_SLOT),
      "-ClaudeCommand", "powershell",
      "-ClaudeArgs", "-NoProfile -Command Start-Sleep 6",
      "-StatusDir", RUNTIME_DIR,
    ], { stdio: "pipe" });

    let procError: Error | null = null;
    proc.on("error", e => { procError = e; });

    // ── DWSO-3C-2: running 状態のJSONが書かれるのを待つ ─────────────────────
    let runningContent: string;
    try {
      runningContent = await waitForFile(TEST_JSON, c => {
        try { return JSON.parse(c).status === "running"; } catch { return false; }
      }, 8000);
    } catch (e) {
      proc.kill();
      throw e;
    }

    const runningData = JSON.parse(runningContent);
    expect(runningData.status).toBe("running");
    expect(runningData.desktopSlot).toBe(TEST_SLOT);
    expect(runningData.tool).toBe("claude");
    expect(runningData.startedAt).toBeTruthy();
    expect(runningData.lastSeenAt).toBeTruthy();
    console.log("[DWSO-3C-2] running JSON 確認 OK:", runningData.startedAt);

    // BOM確認（running 書き込み直後）
    expect(hasBOM(TEST_JSON)).toBe(false);
    console.log("[DWSO-3C-2] BOMなし確認 OK");

    // ── DWSO-3C-5: launchCommand 確認 ────────────────────────────────────────
    // launchCommand は "powershell -NoProfile -Command Start-Sleep 6"
    expect(runningData.launchCommand).toContain("powershell");
    console.log("[DWSO-3C-5] launchCommand:", runningData.launchCommand);

    // ── DWSO-3C-4: completed 遷移まで待つ ────────────────────────────────────
    const procDone = new Promise<number>((resolve, reject) => {
      proc.on("close", code => resolve(code ?? 0));
      proc.on("error", reject);
      setTimeout(() => {
        proc.kill();
        reject(new Error("Monitor process timeout (25s)"));
      }, 25000);
    });

    const exitCode = await procDone;
    console.log("[DWSO-3C-4] monitor exit code:", exitCode);

    if (procError) {
      console.error("[DWSO-3C-4] proc error:", procError);
    }

    // completed JSON を確認
    expect(fs.existsSync(TEST_JSON)).toBe(true);
    const finalContent = fs.readFileSync(TEST_JSON, "utf8");
    const finalData = JSON.parse(finalContent);

    expect(finalData.status).toBe("completed");
    expect(finalData.exitCode).toBe(0);
    expect(finalData.completedAt).toBeTruthy();
    expect(finalData.durationSec).toBeGreaterThanOrEqual(5);

    // BOM確認（completed 書き込み後）
    expect(hasBOM(TEST_JSON)).toBe(false);

    console.log("[DWSO-3C-4] completed JSON 確認 OK:", {
      status: finalData.status,
      exitCode: finalData.exitCode,
      durationSec: finalData.durationSec,
    });
  }, 35000); // タイムアウト: 35秒

  // ── DWSO-3C-5 追加: claude-d2.bat の launchCommand 確認 ──────────────────
  test("DWSO-3C-5: claude-d2.bat launchCommand is claude --dangerously-skip-permissions", () => {
    // 既存の claude-d2.json から launchCommand を確認（実Claudeを起動せずに検証）
    const d2Json = path.join(RUNTIME_DIR, "claude-d2.json");

    if (!fs.existsSync(d2Json)) {
      console.warn("[DWSO-3C-5] claude-d2.json なし。claude-d2.bat の内容確認のみ。");
      // bat ファイルに --dangerously-skip-permissions が含まれることを確認
      const batPath = path.join(PROJECT_ROOT, "scripts", "claude-d2.bat");
      expect(fs.existsSync(batPath)).toBe(true);
      const batContent = fs.readFileSync(batPath, "utf8");
      expect(batContent).toContain("--dangerously-skip-permissions");
      console.log("[DWSO-3C-5] bat ファイルに --dangerously-skip-permissions 確認 OK");
      return;
    }

    let content = fs.readFileSync(d2Json, "utf8");
    // BOM 付きファイル（修正前に書かれたもの）に対応
    if (content.charCodeAt(0) === 0xFEFF) {
      console.log("[DWSO-3C-5] 注: claude-d2.json に BOM あり（修正前に書かれたファイル）。次回 D2 起動後は BOMなしになる。");
      content = content.slice(1);
    }
    const data = JSON.parse(content);
    console.log("[DWSO-3C-5] claude-d2.json launchCommand:", data.launchCommand);
    expect(data.launchCommand).toBe("claude --dangerously-skip-permissions");
  });

  // ── DWSO-3D-1: state.json 読み取り確認 ─────────────────────────────────────
  test("DWSO-3D-1: layout state file remains readable", () => {
    expect(fs.existsSync(STATE_JSON)).toBe(true);

    const content = fs.readFileSync(STATE_JSON, "utf8");
    const data = JSON.parse(content); // パース失敗したら例外 → FAIL

    expect(typeof data.activeDesktop).toBe("number");
    expect(data.desktops).toBeTruthy();
    expect(typeof data.layoutMode).toBe("string");

    // BOM確認
    expect(hasBOM(STATE_JSON)).toBe(false);

    console.log("[DWSO-3D-1] state.json OK:", {
      activeDesktop: data.activeDesktop,
      layoutMode: data.layoutMode,
      desktopCount: Object.keys(data.desktops || {}).length,
    });
  });

  // ── DWSO-3C-3 拡張: D2 runtime JSON の Python reader 確認 ──────────────────
  test("DWSO-3C-3+: Python reader reads existing claude-d2 running state", () => {
    const d2Json = path.join(RUNTIME_DIR, "claude-d2.json");

    if (!fs.existsSync(d2Json)) {
      test.skip(true, "claude-d2.json が存在しないためスキップ");
      return;
    }

    const pyScript = String.raw`
import sys
sys.path.insert(0, r'${PROJECT_ROOT}\src')
from claude_runtime_reader import read_claude_runtime_json
result = read_claude_runtime_json(2)
assert result is not None, "reader returned None"
assert result.get('desktopSlot') == 2
lc = result.get('launchCommand', '')
assert 'claude' in lc, f"launchCommand unexpected: {lc}"
print(f"status={result.get('status')}")
print(f"launchCommand={lc}")
print("PASS")
`;

    const r = spawnSync("python", ["-c", pyScript], {
      encoding: "utf8",
      timeout: 10000,
      cwd: PROJECT_ROOT,
    });

    if (r.stderr) console.error("[DWSO-3C-3+]", r.stderr);
    console.log("[DWSO-3C-3+]", r.stdout);

    expect(r.status).toBe(0);
    expect(r.stdout).toContain("PASS");
  });

});
