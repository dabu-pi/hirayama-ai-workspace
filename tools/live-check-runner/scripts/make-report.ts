/**
 * make-report.ts
 * reports/results.json から Markdown レポートを生成する
 *
 * 将来実装予定。現在はスタブ。
 *
 * 使用方法（将来）:
 *   tsx scripts/make-report.ts --project jrec-sf01 --out reports/AI1_report.md
 */

import fs from "fs";
import path from "path";

const args       = process.argv.slice(2);
const resultsPath = path.join(__dirname, "..", "reports", "results.json");

if (!fs.existsSync(resultsPath)) {
  console.warn("[make-report] reports/results.json が見つかりません。先に npm test を実行してください。");
  process.exit(0);
}

const results = JSON.parse(fs.readFileSync(resultsPath, "utf-8"));
const suites  = results.suites ?? [];

let pass = 0;
let fail = 0;

function countTests(suite: { specs?: { tests?: { status?: string }[] }[]; suites?: unknown[] }): void {
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      if (test.status === "passed") pass++;
      else fail++;
    }
  }
  for (const child of suite.suites ?? []) {
    countTests(child as Parameters<typeof countTests>[0]);
  }
}

for (const suite of suites) countTests(suite);

const lines = [
  "# LiveCheck Report",
  "",
  `- PASS: ${pass}`,
  `- FAIL: ${fail}`,
  `- TOTAL: ${pass + fail}`,
  "",
  `> 生成日時: ${new Date().toISOString()}`,
  "",
  "詳細は `reports/html/` を確認してください。",
];

console.log(lines.join("\n"));

// TODO: --out 引数でファイル保存
// TODO: PROJECT_STATUS.md への自動反映
