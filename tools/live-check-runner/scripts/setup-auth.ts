/**
 * setup-auth.ts
 * Google 認証済みセッション（auth.json）の作成ガイドを表示する
 *
 * ⚠ playwright codegen でのGoogleログインは使わない（Googleにブロックされる）
 *
 * 採用方式: Chrome remote debugging (CDP) + 手動ログイン
 *
 * 使用方法:
 *   npm run setup-auth
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";

const rootDir      = path.join(__dirname, "..");
const authFile     = path.join(rootDir, "auth.json");
const profileDir   = path.join(rootDir, ".chrome-profile");
const gitignorePath = path.join(rootDir, ".gitignore");

console.log("═══════════════════════════════════════════════════════════");
console.log("  LiveCheck — Google 認証セットアップガイド");
console.log("═══════════════════════════════════════════════════════════");

// .gitignore チェック
if (fs.existsSync(gitignorePath)) {
  const content = fs.readFileSync(gitignorePath, "utf-8");
  const required = ["auth.json", ".chrome-profile"];
  for (const entry of required) {
    if (!content.includes(entry)) {
      console.error(`\n❌ .gitignore に "${entry}" が含まれていません。`);
      console.error("   先に .gitignore を更新してください。");
      process.exit(1);
    }
  }
  console.log("✅ .gitignore チェック OK（auth.json / .chrome-profile 除外済み）");
}

// 既存 auth.json の状態確認
if (fs.existsSync(authFile)) {
  const stat = fs.statSync(authFile);
  const ageDays = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60 * 24);
  console.log(`\n✅ auth.json が存在します`);
  console.log(`   最終更新: ${stat.mtime.toLocaleString("ja-JP")}`);
  console.log(`   経過日数: ${ageDays.toFixed(1)} 日`);
  if (ageDays <= 14) {
    console.log("\n   有効な可能性があります。npm run test:jrec で確認してください。");
    process.exit(0);
  }
  console.log("⚠  セッションが古い可能性があります。再作成を推奨します。");
} else {
  console.log("\n⚠ auth.json がありません。以下の手順で作成してください。");
}

// 専用 Chrome プロファイルの存在確認
const hasProfile = fs.existsSync(profileDir);

console.log(`
═══════════════════════════════════════════════════════════
  Google認証の取得方法（Chrome remote debugging 方式）
═══════════════════════════════════════════════════════════

【なぜこの方式？】
  Playwright の codegen ブラウザは Google に「安全でない可能性があるアプリ」
  として検出されブロックされます。
  通常の Chrome を --remote-debugging-port で起動すれば、
  ユーザーが手動ログインでき、そのセッションをそのまま保存できます。

─────────────────────────────────────────────────────────
  Step 1: 専用 Chrome を起動する
─────────────────────────────────────────────────────────

  PowerShell（コピーして実行）:

  Start-Process "chrome" @("--remote-debugging-port=9222", \`
    "--user-data-dir=${profileDir.replace(/\\/g, "\\\\")}") \`
    -PassThru

  ※ Chrome が既に起動している場合は一度すべて閉じてから実行してください。
  ※ 別ターミナルで実行し、そのまま開けておいてください。

─────────────────────────────────────────────────────────
  Step 2: Chrome でログイン操作
─────────────────────────────────────────────────────────

  開いた Chrome で以下を順番に実施:

  1. https://accounts.google.com にアクセス
  2. JREC-SF01 スプレッドシートのオーナーアカウントでログイン
  3. 以下の URL を開いて権限確認ページを突破する:
     https://script.google.com/macros/s/AKfycbzJWJAKCxStP82lfFl8eEHei98dWh7f6cgtEM33r3M5/dev
  4. JREC-SF01 の画面が表示されることを確認

─────────────────────────────────────────────────────────
  Step 3: auth.json を保存する（別ターミナルで実行）
─────────────────────────────────────────────────────────

  cd C:\\hirayama-ai-workspace\\workspace\\tools\\live-check-runner
  npm run save-auth

  ※ Step 2 の Chrome を閉じないでください。
  ※ save-auth は Chrome の現在のセッションを auth.json に書き出します。

─────────────────────────────────────────────────────────
  Step 4: smoke テスト実行
─────────────────────────────────────────────────────────

  npm run test:jrec

  auth.json が有効なら smoke が PASS になります。

═══════════════════════════════════════════════════════════
  注意事項
═══════════════════════════════════════════════════════════

  ⚠ auth.json / .chrome-profile は絶対に Git コミットしない
  ⚠ セッション有効期限: 約 1〜2 週間（期限切れ時は Step 1〜3 を再実行）
  ⚠ Chrome でログアウトすると auth.json が無効になる
  ⚠ 複数アカウントで作業する場合は auth-{account}.json で管理する
`);

// Chrome の存在確認（Windows）
if (process.platform === "win32") {
  const chromePaths = [
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  ];
  const found = chromePaths.find(p => fs.existsSync(p));
  if (found) {
    console.log(`\n Chrome の場所: ${found}`);
    console.log(`\n  PowerShell で以下をコピーして実行:\n`);
    console.log(`  Start-Process "${found}" @("--remote-debugging-port=9222", "--user-data-dir=${profileDir}") -PassThru`);
  } else {
    console.log("\n⚠ Chrome が標準パスで見つかりませんでした。");
    console.log("  Chrome のインストール場所を確認してフルパスで指定してください。");
  }
}
