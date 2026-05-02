/**
 * save-auth-from-chrome.ts
 * Chrome remote debugging (CDP) 経由でログイン済みセッションを auth.json に保存する
 *
 * 前提:
 *   Chrome が --remote-debugging-port=9222 で起動していること
 *   Chrome 上で Google ログイン + JREC-SF01 /dev のアクセスが完了していること
 *
 * 使用方法:
 *   npm run save-auth
 *   または: tsx scripts/save-auth-from-chrome.ts [--port 9222]
 */

import { chromium } from "@playwright/test";
import fs from "fs";
import path from "path";

const rootDir  = path.join(__dirname, "..");
const authFile = path.join(rootDir, "auth.json");
const gitignorePath = path.join(rootDir, ".gitignore");

// 引数パース
const args = process.argv.slice(2);
const portIdx = args.indexOf("--port");
const port = portIdx !== -1 ? args[portIdx + 1] : "9222";
const CDP_URL = `http://localhost:${port}`;

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  save-auth-from-chrome — Chrome CDP セッション保存");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`\n接続先: ${CDP_URL}`);

  // .gitignore に auth.json があるか先に確認
  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, "utf-8");
    if (!content.includes("auth.json")) {
      console.error("\n❌ .gitignore に auth.json が含まれていません。");
      console.error("   auth.json をコミットしないよう .gitignore に追加してから再実行してください。");
      process.exit(1);
    }
  }

  // Chrome CDP 接続
  let browser: Awaited<ReturnType<typeof chromium.connectOverCDP>>;
  try {
    browser = await chromium.connectOverCDP(CDP_URL, { timeout: 5000 });
    console.log("\n✅ Chrome に接続しました。");
  } catch (err) {
    console.error("\n❌ Chrome に接続できませんでした。");
    console.error(`   エラー: ${(err as Error).message.substring(0, 100)}`);
    console.error(`\n  Chrome が起動していない可能性があります。`);
    console.error(`  以下のコマンドで Chrome を起動してから再実行してください:\n`);
    console.error(`  PowerShell:`);
    console.error(`    Start-Process "chrome" "--remote-debugging-port=9222 --user-data-dir=\`"$(Get-Location)\\.chrome-profile\`""`);
    console.error(`\n  または (コマンドプロンプト / 環境依存):`);
    console.error(`    start chrome --remote-debugging-port=9222 --user-data-dir=.chrome-profile`);
    console.error(`\n  詳細: npm run setup-auth`);
    process.exit(1);
  }

  // コンテキスト取得
  const contexts = browser.contexts();
  if (contexts.length === 0) {
    console.error("\n❌ ブラウザコンテキストが見つかりません。");
    console.error("   Chrome で何かページを開いてから再実行してください。");
    await browser.close();
    process.exit(1);
  }

  const context = contexts[0];

  // 現在開いているページ一覧を表示
  const pages = context.pages();
  if (pages.length > 0) {
    console.log(`\n現在開いているページ (${pages.length}件):`);
    for (const page of pages.slice(0, 5)) {
      const url = page.url();
      const title = await page.title().catch(() => "");
      console.log(`  - ${title.substring(0, 40)} | ${url.substring(0, 80)}`);
    }
  }

  // Google ログイン状態の確認
  const googlePages = pages.filter(p =>
    p.url().includes("google.com") || p.url().includes("script.google.com")
  );
  if (googlePages.length === 0) {
    console.warn("\n⚠ Google 関連ページが開いていません。");
    console.warn("  Google にログインした状態で JREC-SF01 /dev を開いてから再実行を推奨します。");
    console.warn("  このまま続けると Google の認証情報が含まれない可能性があります。");
    console.warn("  10秒待ちます。中断する場合は Ctrl+C を押してください。");
    await new Promise(r => setTimeout(r, 10_000));
  }

  // storageState を保存
  console.log(`\n📥 storageState を保存中...`);
  try {
    await context.storageState({ path: authFile });
  } catch (err) {
    console.error(`\n❌ storageState の保存に失敗しました: ${(err as Error).message}`);
    await browser.close();
    process.exit(1);
  }

  // 保存確認
  const stat = fs.statSync(authFile);
  const sizeKb = (stat.size / 1024).toFixed(1);
  console.log(`\n✅ auth.json を保存しました`);
  console.log(`   場所: ${authFile}`);
  console.log(`   サイズ: ${sizeKb} KB`);

  // git status 確認（auth.json が tracked になっていないか）
  console.log(`\n🔍 git status 確認中...`);
  try {
    const { execSync } = await import("child_process");
    const status = execSync("git status --short auth.json", { cwd: rootDir, encoding: "utf-8" }).trim();
    if (status) {
      console.error(`\n❌ git が auth.json を検出しています: ${status}`);
      console.error("   auth.json を .gitignore に追加して git rm --cached auth.json を実行してください。");
    } else {
      console.log("✅ auth.json は git に追加されていません（.gitignore 有効）。");
    }
  } catch {
    // git コマンドが使えない環境はスキップ
  }

  // 切断（Chrome は閉じない）
  await browser.close();

  console.log(`
次のステップ:
  npm run test:jrec    ← smoke テストを実行して PASS を確認
`);
}

main().catch(e => {
  console.error("[save-auth] 予期しないエラー:", e.message);
  process.exit(1);
});
