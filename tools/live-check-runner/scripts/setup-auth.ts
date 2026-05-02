/**
 * setup-auth.ts
 * Google 認証済みセッション（auth.json）の作成ガイド
 *
 * このスクリプトは手順を表示するだけです。
 * 実際のログイン操作は人間が行います。
 *
 * 使用方法:
 *   tsx scripts/setup-auth.ts
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const rootDir  = path.join(__dirname, "..");
const authFile = path.join(rootDir, "auth.json");

console.log("═══════════════════════════════════════════════════════════");
console.log("  JREC-SF01 LiveCheck — Google 認証セットアップ");
console.log("═══════════════════════════════════════════════════════════");

// 既存の auth.json を確認
if (fs.existsSync(authFile)) {
  const stat = fs.statSync(authFile);
  const ageDays = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60 * 24);
  console.log(`\n✅ auth.json が見つかりました`);
  console.log(`   最終更新: ${stat.mtime.toLocaleString("ja-JP")}`);
  console.log(`   経過日数: ${ageDays.toFixed(1)} 日`);
  if (ageDays > 14) {
    console.log(`\n⚠ セッションが古い可能性があります（${ageDays.toFixed(0)}日経過）。`);
    console.log(`   再作成を推奨します。`);
  } else {
    console.log(`\n   セッションは有効な可能性があります。`);
    console.log(`   npm run test:jrec を実行して確認してください。`);
    process.exit(0);
  }
} else {
  console.log("\n⚠ auth.json が見つかりません。新規作成が必要です。");
}

console.log(`
═══════════════════════════════════════════════════════════
  手順: Google ログイン済みセッションを auth.json に保存
═══════════════════════════════════════════════════════════

Step 1: 以下のコマンドを実行してください（Playwright codegen）

  cd C:\\hirayama-ai-workspace\\workspace\\tools\\live-check-runner
  npx playwright codegen --save-storage=auth.json https://accounts.google.com

Step 2: ブラウザが開いたら Google アカウントでログインしてください

  - JREC-SF01 スプレッドシートのオーナーアカウントでログインすること
  - ログインが完了したらブラウザウィンドウを閉じてください
  - auth.json が自動的に保存されます

Step 3: 以下を確認してください

  a) auth.json が作成されたこと
     ls auth.json

  b) auth.json が git に追加されていないこと（gitignore 確認）
     git status

  c) GAS /dev にアクセスできるか確認
     npx playwright codegen --load-storage=auth.json \\
       "https://script.google.com/macros/s/AKfycbzJWJAKCxStP82lfFl8eEHei98dWh7f6cgtEM33r3M5/dev"

Step 4: smoke テストを再実行

  npm run test:jrec

═══════════════════════════════════════════════════════════
  注意事項
═══════════════════════════════════════════════════════════

  ⚠ auth.json には Google セッションが含まれます。
  ⚠ Git コミットは絶対にしないでください。
  ⚠ .gitignore に auth.json が含まれていることを確認してください。
  ⚠ セッションの有効期限は約 1〜2 週間です。期限切れの場合は再作成してください。
`);

// gitignore に auth.json が含まれているか確認
const gitignorePath = path.join(rootDir, ".gitignore");
if (fs.existsSync(gitignorePath)) {
  const gitignoreContent = fs.readFileSync(gitignorePath, "utf-8");
  if (gitignoreContent.includes("auth.json")) {
    console.log("✅ .gitignore に auth.json が含まれています（安全）。");
  } else {
    console.error("❌ .gitignore に auth.json が含まれていません！");
    console.error("   すぐに .gitignore に auth.json を追加してください。");
    process.exit(1);
  }
}

console.log("\n上記の手順を実行してから npm run test:jrec を再実行してください。");
