/**
 * collect-screenshots.ts
 * 全ページのスクリーンショットを収集して reports/screenshots/ に保存する
 *
 * 将来実装予定。現在はスタブ。
 *
 * 使用方法（将来）:
 *   tsx scripts/collect-screenshots.ts --project jrec-sf01
 */

import path from "path";

const args   = process.argv.slice(2);
function getArg(name: string): string | undefined {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 ? args[idx + 1] : undefined;
}

const project = getArg("project");

if (!project) {
  console.error("Usage: tsx scripts/collect-screenshots.ts --project <name>");
  process.exit(1);
}

const outputDir = path.join(__dirname, "..", "reports", "screenshots", project);
console.log(`[collect-screenshots] project: ${project}`);
console.log(`[collect-screenshots] output: ${outputDir}`);
console.log("[collect-screenshots] ⚠ まだ実装中です。将来的に全ページを headless で巡回してスクリーンショットを保存します。");

// TODO: config.json からページリストを読む
// TODO: playwright で各ページにアクセスしてスクリーンショットを保存
// TODO: 認証済みセッション（storageState）の読み込み
