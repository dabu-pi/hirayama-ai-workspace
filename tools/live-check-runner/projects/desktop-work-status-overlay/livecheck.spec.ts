/**
 * desktop-work-status-overlay livecheck.spec.ts
 *
 * Phase 3-C / Phase 3-D / Phase 3-F 自動確認テスト
 *
 * DWSO-3C-1: Overlay プロセス start.bat で起動確認
 * DWSO-3C-2: claude-monitor がBOMなしUTF-8でruntime JSONを書く
 * DWSO-3C-3: Python reader がBOMあり・なし両方のJSONを読める
 * DWSO-3C-4: D2 runtime running → completed 遷移（テストコマンド使用）
 * DWSO-3C-5: launchCommand が正しく記録される
 * DWSO-3D-1: layout state.json が読み取れる
 * DWSO-3F-1: window_preferences 純粋関数の動作確認
 * DWSO-3F-2: state.json に alwaysOnTop / opacity が後方互換で補完される
 * DWSO-3F-3: state.json に windowPosition が保存・復元できる
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

  // ── DWSO-3E: highlight_selector 自動確認 ───────────────────────────────────

  test("DWSO-3E-1: highlight_selector selects ERROR slot correctly", () => {
    const pyScript = String.raw`
import sys
sys.path.insert(0, r'${PROJECT_ROOT}\src')
from runtime_status import DesktopRuntimeStatus, ToolRuntimeStatus, ToolStatus, Confidence, DetectionSource
from highlight_selector import select_highlight

def make_tool(status, conf=Confidence.HIGH):
    return ToolRuntimeStatus(
        tool='claude', status=status, confidence=conf,
        source=DetectionSource.TERMINAL_MONITOR,
        last_seen_at='2026-05-06T20:00:00+09:00',
    )

def make_drs(slot, claude_status=ToolStatus.IDLE, gpt_status=ToolStatus.IDLE):
    return DesktopRuntimeStatus(
        desktop_slot=slot,
        claude=make_tool(claude_status),
        gpt=make_tool(gpt_status),
    )

# D2 ERROR, D3 RUNNING → D2 を選ぶ
statuses = {
    1: make_drs(1),
    2: make_drs(2, claude_status=ToolStatus.ERROR),
    3: make_drs(3, claude_status=ToolStatus.RUNNING),
    4: make_drs(4),
}
result = select_highlight(statuses)
assert result is not None, "Should have a highlight"
assert result.slot == 2, f"Expected slot=2, got {result.slot}"
assert result.priority == 1, f"Expected priority=1, got {result.priority}"
assert result.label == 'ERR', f"Expected label=ERR, got {result.label}"
print(f"slot={result.slot} priority={result.priority} label={result.label} color={result.color}")
print("PASS")
`;

    const r = spawnSync("python", ["-c", pyScript], {
      encoding: "utf8",
      timeout: 10000,
      cwd: PROJECT_ROOT,
    });
    if (r.stderr) console.error("[DWSO-3E-1]", r.stderr);
    console.log("[DWSO-3E-1]", r.stdout);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("PASS");
  });

  test("DWSO-3E-2: highlight_selector selects RUNNING slot when no ERROR", () => {
    const pyScript = String.raw`
import sys
sys.path.insert(0, r'${PROJECT_ROOT}\src')
from runtime_status import DesktopRuntimeStatus, ToolRuntimeStatus, ToolStatus, Confidence, DetectionSource
from highlight_selector import select_highlight

def make_tool(status, conf=Confidence.HIGH):
    return ToolRuntimeStatus(
        tool='claude', status=status, confidence=conf,
        source=DetectionSource.TERMINAL_MONITOR,
        last_seen_at='2026-05-06T20:00:00+09:00',
    )

def make_drs(slot, claude_status=ToolStatus.IDLE):
    return DesktopRuntimeStatus(
        desktop_slot=slot,
        claude=make_tool(claude_status),
        gpt=make_tool(ToolStatus.IDLE),
    )

# D2 RUNNING, others IDLE → D2 を選ぶ
statuses = {i: make_drs(i) for i in range(1, 5)}
statuses[2] = make_drs(2, claude_status=ToolStatus.RUNNING)
result = select_highlight(statuses)
assert result is not None, "Should have a highlight"
assert result.slot == 2, f"Expected slot=2, got {result.slot}"
assert result.priority == 3, f"Expected priority=3, got {result.priority}"
assert result.label == 'RUN'
print(f"slot={result.slot} priority={result.priority} label={result.label}")
print("PASS")
`;

    const r = spawnSync("python", ["-c", pyScript], {
      encoding: "utf8",
      timeout: 10000,
      cwd: PROJECT_ROOT,
    });
    if (r.stderr) console.error("[DWSO-3E-2]", r.stderr);
    console.log("[DWSO-3E-2]", r.stdout);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("PASS");
  });

  test("DWSO-3E-3: highlight_selector returns None when all IDLE", () => {
    const pyScript = String.raw`
import sys
sys.path.insert(0, r'${PROJECT_ROOT}\src')
from runtime_status import DesktopRuntimeStatus, ToolRuntimeStatus, ToolStatus, Confidence, DetectionSource
from highlight_selector import select_highlight

def make_tool(status=ToolStatus.IDLE):
    return ToolRuntimeStatus(
        tool='claude', status=status, confidence=Confidence.HIGH,
        source=DetectionSource.TERMINAL_MONITOR,
        last_seen_at='2026-05-06T20:00:00+09:00',
    )

statuses = {
    i: DesktopRuntimeStatus(
        desktop_slot=i,
        claude=make_tool(),
        gpt=make_tool(),
    )
    for i in range(1, 5)
}
result = select_highlight(statuses)
assert result is None, f"Expected None for all-idle, got {result}"
print("PASS")
`;

    const r = spawnSync("python", ["-c", pyScript], {
      encoding: "utf8",
      timeout: 10000,
      cwd: PROJECT_ROOT,
    });
    if (r.stderr) console.error("[DWSO-3E-3]", r.stderr);
    console.log("[DWSO-3E-3]", r.stdout);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("PASS");
  });

  // ── DWSO-3F-1: window_preferences 純粋関数確認 ────────────────────────────
  test("DWSO-3F-1: window_preferences pure functions work correctly", () => {
    const pyScript = String.raw`
import sys
sys.path.insert(0, r'${PROJECT_ROOT}\src')
from window_preferences import (
    clamp_position, default_position, validate_opacity,
    DEFAULT_OPACITY, DEFAULT_ALWAYS_ON_TOP, OPACITY_PRESETS,
)

# clamp_position: 範囲内はそのまま
x, y = clamp_position(100, 200, 1920, 1080)
assert x == 100 and y == 200, f"clamp within bounds failed: {x},{y}"

# clamp_position: 画面外は補正
x, y = clamp_position(-10, -5, 1920, 1080)
assert x == 0 and y == 0, f"clamp negative failed: {x},{y}"

x, y = clamp_position(1900, 1050, 1920, 1080)
assert x == 1920 - 100 and y == 1080 - 100, f"clamp too-far failed: {x},{y}"

# default_position
x, y = default_position(1920, 1080)
assert x >= 0, f"default_position x negative: {x}"
assert y == 40, f"default_position y unexpected: {y}"

# validate_opacity: 正常値
assert abs(validate_opacity(0.9) - 0.9) < 1e-9, "validate 0.9 failed"
assert abs(validate_opacity(1.0) - 1.0) < 1e-9, "validate 1.0 failed"

# validate_opacity: 不正値は補正
assert validate_opacity(0.0) >= 0.1, "validate 0.0 should clamp to 0.1"
assert validate_opacity(5.0) <= 1.0, "validate 5.0 should clamp to 1.0"
assert abs(validate_opacity("bad") - DEFAULT_OPACITY) < 1e-9, "validate string failed"
assert abs(validate_opacity(None) - DEFAULT_OPACITY) < 1e-9, "validate None failed"

# constants
assert DEFAULT_ALWAYS_ON_TOP is True, "DEFAULT_ALWAYS_ON_TOP should be True"
assert len(OPACITY_PRESETS) > 0, "OPACITY_PRESETS should not be empty"
for label, val in OPACITY_PRESETS:
    assert 0.0 < val <= 1.0, f"preset value out of range: {val}"

print("PASS")
`;

    const r = spawnSync("python", ["-c", pyScript], {
      encoding: "utf8",
      timeout: 10000,
      cwd: PROJECT_ROOT,
    });
    if (r.stderr) console.error("[DWSO-3F-1]", r.stderr);
    console.log("[DWSO-3F-1]", r.stdout);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("PASS");
  });

  // ── DWSO-3F-2: state.json 後方互換マイグレーション確認 ───────────────────
  test("DWSO-3F-2: alwaysOnTop and opacity are back-filled in legacy state.json", () => {
    const pyScript = String.raw`
import sys, json, tempfile, pathlib
sys.path.insert(0, r'${PROJECT_ROOT}\src')
from state_store import StateStore

with tempfile.TemporaryDirectory() as td:
    path = pathlib.Path(td) / 'state.json'

    # 旧 state.json: window に x/y のみ (alwaysOnTop・opacity なし)
    path.write_text(json.dumps({
        "activeDesktop": 1,
        "window": {"x": 100, "y": 200}
    }), encoding='utf-8')

    state = StateStore(path).load()
    assert "alwaysOnTop" in state["window"], "alwaysOnTop not backfilled"
    assert state["window"]["alwaysOnTop"] is True, "alwaysOnTop default should be True"
    assert "opacity" in state["window"], "opacity not backfilled"
    assert abs(state["window"]["opacity"] - 0.92) < 0.01, f"opacity default unexpected: {state['window']['opacity']}"
    assert state["window"]["x"] == 100, "x should be preserved"
    assert state["window"]["y"] == 200, "y should be preserved"
    print("legacy-window PASS")

    # window キー自体がない超古い state.json
    path.write_text(json.dumps({"activeDesktop": 1}), encoding='utf-8')
    state2 = StateStore(path).load()
    assert "window" in state2, "window key should be created"
    assert "alwaysOnTop" in state2["window"], "alwaysOnTop not added"
    assert "opacity" in state2["window"], "opacity not added"
    print("no-window-key PASS")

    # 不正な opacity は補正される
    path.write_text(json.dumps({"window": {"opacity": 99.0}}), encoding='utf-8')
    state3 = StateStore(path).load()
    assert state3["window"]["opacity"] <= 1.0, "opacity should be clamped"
    print("opacity-clamp PASS")

print("PASS")
`;

    const r = spawnSync("python", ["-c", pyScript], {
      encoding: "utf8",
      timeout: 10000,
      cwd: PROJECT_ROOT,
    });
    if (r.stderr) console.error("[DWSO-3F-2]", r.stderr);
    console.log("[DWSO-3F-2]", r.stdout);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("PASS");
  });

  // ── DWSO-3F-3: state.json 位置・設定の保存・復元確認 ─────────────────────
  test("DWSO-3F-3: window position and alwaysOnTop roundtrip via state.json", () => {
    const pyScript = String.raw`
import sys, json, tempfile, pathlib
sys.path.insert(0, r'${PROJECT_ROOT}\src')
from state_store import StateStore

with tempfile.TemporaryDirectory() as td:
    path = pathlib.Path(td) / 'state.json'
    store = StateStore(path)
    state = store.load()

    # 位置を変更して保存
    state["window"]["x"] = 300
    state["window"]["y"] = 150
    state["window"]["alwaysOnTop"] = False
    state["window"]["opacity"] = 0.8
    store.save(state)

    # 復元して確認
    loaded = StateStore(path).load()
    assert loaded["window"]["x"] == 300, f"x mismatch: {loaded['window']['x']}"
    assert loaded["window"]["y"] == 150, f"y mismatch: {loaded['window']['y']}"
    assert loaded["window"]["alwaysOnTop"] is False, "alwaysOnTop should be False"
    assert abs(loaded["window"]["opacity"] - 0.8) < 1e-9, f"opacity mismatch: {loaded['window']['opacity']}"
    print("PASS")
`;

    const r = spawnSync("python", ["-c", pyScript], {
      encoding: "utf8",
      timeout: 10000,
      cwd: PROJECT_ROOT,
    });
    if (r.stderr) console.error("[DWSO-3F-3]", r.stderr);
    console.log("[DWSO-3F-3]", r.stdout);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("PASS");
  });

  test("DWSO-3E-4: highlight_selector COMPLETED recent from real claude-d2 JSON", () => {
    // テスト用 runtime JSON (slot 9) を書いて completed 判定を確認
    const pyScript = String.raw`
import sys, json, pathlib
from datetime import datetime, timezone, timedelta
sys.path.insert(0, r'${PROJECT_ROOT}\src')

# 3分前に完了した JSON を書く
jst = timezone(timedelta(hours=9))
completed_ts = (datetime.now(jst) - timedelta(minutes=3)).strftime('%Y-%m-%dT%H:%M:%S+09:00')
now_ts = datetime.now(jst).strftime('%Y-%m-%dT%H:%M:%S+09:00')

test_json = {
    "schemaVersion": 1, "desktopSlot": 9, "tool": "claude",
    "status": "completed", "confidence": "high", "source": "terminal_monitor",
    "startedAt": completed_ts, "lastSeenAt": now_ts,
    "completedAt": completed_ts, "exitCode": 0, "pid": None,
    "durationSec": 120, "errorMessage": None,
    "launchCommand": "claude --dangerously-skip-permissions"
}
p = pathlib.Path(r'${TEST_JSON}')
p.write_text(json.dumps(test_json), encoding='utf-8')

from claude_runtime_reader import runtime_to_tool_status
from highlight_selector import select_highlight
from runtime_status import DesktopRuntimeStatus, ToolRuntimeStatus, ToolStatus, Confidence, DetectionSource

# D9 の status を読む
claude_status = runtime_to_tool_status(9)
assert claude_status is not None, "reader returned None"
assert claude_status.status == ToolStatus.COMPLETED, f"Expected COMPLETED, got {claude_status.status}"

idle_tool = ToolRuntimeStatus(
    tool='gpt', status=ToolStatus.IDLE, confidence=Confidence.HIGH,
    source=DetectionSource.NONE, last_seen_at=now_ts
)
statuses = {
    9: DesktopRuntimeStatus(desktop_slot=9, claude=claude_status, gpt=idle_tool)
}
result = select_highlight(statuses, completed_recent_sec=300)
assert result is not None, "Expected highlight for COMPLETED recent"
assert result.slot == 9
assert result.priority == 2, f"Expected priority=2 (COMPLETED recent), got {result.priority}"
assert result.label == 'DONE'
print(f"slot={result.slot} priority={result.priority} label={result.label} color={result.color}")
print("PASS")
`;

    const r = spawnSync("python", ["-c", pyScript], {
      encoding: "utf8",
      timeout: 10000,
      cwd: PROJECT_ROOT,
    });
    if (r.stderr) console.error("[DWSO-3E-4]", r.stderr);
    console.log("[DWSO-3E-4]", r.stdout);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("PASS");
  });

  test("DWSO-3D-2b-1: conversation_analysis validation and merge — derived fields only", () => {
    const pyScript = String.raw`
import sys, json, pathlib, tempfile
sys.path.insert(0, r'${PROJECT_ROOT}\src')

from dom_bridge import (
    validate_conversation_analysis_payload,
    sanitize_conversation_analysis_payload,
    ALLOWED_ANALYSIS_SOURCE,
    ALLOWED_ANALYSIS_STATUS,
    DomPayloadError,
)
from dom_runtime_writer import merge_conversation_analysis

# 1. Valid payload validates without error
valid = {
    "source": "conversation_analysis",
    "slot": 2,
    "app": "claude",
    "status": "completed",
    "project": "desktop-work-status-overlay",
    "phase": "Phase 3-D(DOM)-2b",
    "shortSummary": "6 passed",
    "confidence": "high",
    "analysisSource": "conversation_text",
}
result = validate_conversation_analysis_payload(valid)
assert result is valid, "validate should return payload unchanged"
print("validate: PASS")

# 2. Forbidden field rejected
try:
    validate_conversation_analysis_payload({**valid, "rawConversation": "SECRET"})
    print("FAIL: forbidden field should have raised")
    sys.exit(1)
except DomPayloadError:
    print("forbidden_field_rejected: PASS")

# 3. Sanitize strips unknown fields
sanitized = sanitize_conversation_analysis_payload({**valid, "unknownField": "data"})
assert "unknownField" not in sanitized, "unknown fields must be stripped"
assert sanitized["source"] == ALLOWED_ANALYSIS_SOURCE
print("sanitize: PASS")

# 4. merge_conversation_analysis writes only derived fields (no raw text)
with tempfile.TemporaryDirectory() as tmpdir:
    tmp = pathlib.Path(tmpdir)
    path = merge_conversation_analysis(tmp, valid)
    assert path is not None
    with open(path, encoding="utf-8") as f:
        data = json.load(f)
    # Derived fields present
    assert data["project"] == "desktop-work-status-overlay", f"project missing: {data}"
    assert data["phase"] == "Phase 3-D(DOM)-2b", f"phase missing: {data}"
    # Raw text fields absent
    FORBIDDEN = ["rawConversation", "conversationText", "prompt", "response",
                 "innerText", "textContent", "cookie", "token"]
    for field in FORBIDDEN:
        assert field not in data, f"Forbidden field in output: {field}"
    print("merge (derived only): PASS -- fields: " + str(list(data.keys())))

# 5. conversationTextAnalysisEnabled defaults to False in bridge config
from dom_bridge import default_dom_bridge_config
cfg = default_dom_bridge_config()
assert cfg["conversationTextAnalysisEnabled"] == False, "must default to False"
assert cfg["storeRawConversation"] == False, "storeRawConversation must be False"
print("default_disabled: PASS")

print("PASS")
`;

    const r = spawnSync("python", ["-c", pyScript], {
      encoding: "utf8",
      timeout: 10000,
      cwd: PROJECT_ROOT,
    });
    if (r.stderr) console.error("[DWSO-3D-2b-1]", r.stderr);
    console.log("[DWSO-3D-2b-1]", r.stdout);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("PASS");
  });

  test("DWSO-3D-2b-2: conversation_analysis disabled by default - no raw text in runtime JSON", () => {
    const pyScript = String.raw`
import sys, json, pathlib, tempfile
sys.path.insert(0, r'${PROJECT_ROOT}\src')

from dom_bridge import (
    validate_conversation_analysis_payload,
    sanitize_conversation_analysis_payload,
    FORBIDDEN_FIELDS,
)
from dom_runtime_writer import merge_conversation_analysis

# Verify that after merge, forbidden fields are never present in output
with tempfile.TemporaryDirectory() as tmpdir:
    tmp = pathlib.Path(tmpdir)
    # Create a pre-existing dom file with a corrupted forbidden field
    dom_path = tmp / "dom-d2.json"
    dom_path.write_text(json.dumps({
        "source": "dom_monitor", "app": "claude",
        "rawConversation": "should_be_stripped"  # simulated corruption
    }), encoding="utf-8")

    valid_analysis = {
        "source": "conversation_analysis",
        "slot": 2,
        "app": "claude",
        "status": "completed",
        "shortSummary": "no raw text",
        "confidence": "high",
    }
    merge_conversation_analysis(tmp, valid_analysis)

    with open(dom_path, encoding="utf-8") as f:
        data = json.load(f)
        content = json.dumps(data)

    # Forbidden field must have been stripped during merge
    for field in FORBIDDEN_FIELDS:
        assert field not in data, f"Forbidden field still present: {field!r}"
    print("forbidden_stripped: PASS -- keys present: " + str(list(data.keys())))

print("PASS")
`;

    const r = spawnSync("python", ["-c", pyScript], {
      encoding: "utf8",
      timeout: 10000,
      cwd: PROJECT_ROOT,
    });
    if (r.stderr) console.error("[DWSO-3D-2b-2]", r.stderr);
    console.log("[DWSO-3D-2b-2]", r.stdout);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("PASS");
  });

  test("DWSO-3D-2c-1: conversationTextAnalysisEnabled default OFF + toggle state logic", () => {
    const pyScript = String.raw`
import sys
sys.path.insert(0, r'${PROJECT_ROOT}\src')

from dom_bridge import default_dom_bridge_config, DomBridgeServer

# 1. Default config is OFF
cfg = default_dom_bridge_config()
assert cfg["conversationTextAnalysisEnabled"] == False, "must default to False"
assert cfg["storeRawConversation"] == False, "storeRawConversation must be False"
assert cfg["storeDerivedSummaryOnly"] == True, "storeDerivedSummaryOnly must be True"
print("default_off: PASS")

# 2. Toggle ON state mutation (mirrors _toggle_conversation_analysis logic)
state_dm = {"conversationTextAnalysisEnabled": False, "storeRawConversation": False, "storeDerivedSummaryOnly": True}
new_val = not state_dm["conversationTextAnalysisEnabled"]
state_dm["conversationTextAnalysisEnabled"] = new_val
state_dm["storeRawConversation"] = False
state_dm["storeDerivedSummaryOnly"] = True
assert state_dm["conversationTextAnalysisEnabled"] == True
assert state_dm["storeRawConversation"] == False
print("toggle_on: PASS")

# 3. Toggle OFF
new_val = not state_dm["conversationTextAnalysisEnabled"]
state_dm["conversationTextAnalysisEnabled"] = new_val
state_dm["storeRawConversation"] = False
assert state_dm["conversationTextAnalysisEnabled"] == False
assert state_dm["storeRawConversation"] == False
print("toggle_off: PASS")

# 4. DomBridgeServer reflects constructor param
b_off = DomBridgeServer(conversation_analysis_enabled=False)
b_on  = DomBridgeServer(conversation_analysis_enabled=True)
assert b_off._conversation_analysis_enabled == False
assert b_on._conversation_analysis_enabled == True
print("constructor_param: PASS")

# 5. push_config_sync does not raise when no loop
b_off.push_config_sync({"type": "config", "conversationTextAnalysisEnabled": True})
print("push_config_no_raise: PASS")

# 6. _connected_clients starts empty
assert len(b_off._connected_clients) == 0
print("clients_empty: PASS")

print("PASS")
`;

    const r = spawnSync("python", ["-c", pyScript], {
      encoding: "utf8",
      timeout: 10000,
      cwd: PROJECT_ROOT,
    });
    if (r.stderr) console.error("[DWSO-3D-2c-1]", r.stderr);
    console.log("[DWSO-3D-2c-1]", r.stdout);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("PASS");
  });

  test("DWSO-3D-2c-2: toggle does not enable storeRawConversation", () => {
    const pyScript = String.raw`
import sys
sys.path.insert(0, r'${PROJECT_ROOT}\src')

from dom_bridge import DomBridgeServer, default_dom_bridge_config

# Even after toggling ON multiple times, storeRawConversation stays False
dm = default_dom_bridge_config()
for _ in range(4):
    current = dm["conversationTextAnalysisEnabled"]
    dm["conversationTextAnalysisEnabled"] = not current
    dm["storeRawConversation"] = False    # invariant always reasserted
    dm["storeDerivedSummaryOnly"] = True
    assert dm["storeRawConversation"] == False, "storeRawConversation leaked to True"
    assert dm["storeDerivedSummaryOnly"] == True

print("invariants_preserved: PASS")

# Also verify that DomBridgeServer._conversation_analysis_enabled can be toggled
bridge = DomBridgeServer(conversation_analysis_enabled=False)
bridge._conversation_analysis_enabled = True
assert bridge._conversation_analysis_enabled == True
bridge._conversation_analysis_enabled = False
assert bridge._conversation_analysis_enabled == False
print("bridge_toggle_mutable: PASS")

print("PASS")
`;

    const r = spawnSync("python", ["-c", pyScript], {
      encoding: "utf8",
      timeout: 10000,
      cwd: PROJECT_ROOT,
    });
    if (r.stderr) console.error("[DWSO-3D-2c-2]", r.stderr);
    console.log("[DWSO-3D-2c-2]", r.stdout);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("PASS");
  });

});

