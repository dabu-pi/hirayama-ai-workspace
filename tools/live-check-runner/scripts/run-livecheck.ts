/**
 * run-livecheck.ts
 * LiveCheck CLI エントリポイント
 *
 * 使用方法:
 *   npm run livecheck -- --project jrec-sf01 --suite smoke
 *   npm run livecheck -- --project training-platform --suite smoke
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

// ── 引数パース ──────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const project = getArg("project");
const suite   = getArg("suite") ?? "smoke";

if (!project) {
  console.error("Usage: npm run livecheck -- --project <name> [--suite <suite>]");
  console.error("  --project: jrec-sf01 | training-platform | subsidy-grants");
  console.error("  --suite:   smoke (default)");
  process.exit(1);
}

// ── config 読み込み ────────────────────────────────────────
const rootDir    = path.join(__dirname, "..");
const configPath = path.join(rootDir, "projects", project, "config.json");

if (!fs.existsSync(configPath)) {
  console.error(`[livecheck] config not found: ${configPath}`);
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(configPath, "utf-8")) as {
  name: string;
  type: string;
  devUrl?: string;
  localUrl?: string;
  prodUrl?: string;
  notes?: string[];
};

console.log("─────────────────────────────────────────────");
console.log(`[livecheck] project : ${config.name}`);
console.log(`[livecheck] type    : ${config.type}`);
console.log(`[livecheck] suite   : ${suite}`);
if (config.devUrl)   console.log(`[livecheck] devUrl  : ${config.devUrl}`);
if (config.localUrl) console.log(`[livecheck] local   : ${config.localUrl}`);
if (config.notes?.length) {
  console.log("[livecheck] notes:");
  config.notes.forEach((n) => console.log(`  - ${n}`));
}
console.log("─────────────────────────────────────────────");

// ── spec ファイルの存在確認 ────────────────────────────────
const specFile = path.join(rootDir, "projects", project, `${suite}.spec.ts`);
if (!fs.existsSync(specFile)) {
  console.warn(`[livecheck] spec not found: ${specFile}`);
  console.warn("[livecheck] ⚠ spec ファイルがまだ実装されていません。");
  process.exit(0);
}

// ── playwright test 呼び出し ───────────────────────────────
const cmd = `npx playwright test ${specFile} --project=chromium`;
console.log(`[livecheck] running: ${cmd}`);

try {
  execSync(cmd, { stdio: "inherit", cwd: rootDir });
  console.log("[livecheck] ✅ 完了");
} catch {
  console.error("[livecheck] ❌ テスト失敗 — reports/ を確認してください");
  process.exit(1);
}
