/**
 * jrec-r2c-trigger-auth-prompt.ts
 *
 * R-2C-B helper: bring Apps Script editor to the foreground inside the
 * CDP-attached Chrome and try to trigger the script.scriptapp re-auth
 * dialog for the deploying user.
 *
 * Why we need this:
 *   - appsscript.json gained `script.scriptapp` scope and was clasp-pushed.
 *   - Existing user auth grant does NOT include the new scope.
 *   - Running ScriptApp.getProjectTriggers/newTrigger/deleteTrigger throws
 *     a permission error in the webapp until the user re-authorizes.
 *
 * What this script attempts (best-effort, Apps Script UI may resist
 * deterministic automation):
 *   1. Connect via CDP to Chrome on port 9222.
 *   2. Find or open the Apps Script editor tab for the JREC scriptId.
 *   3. Wait for the file tree to load.
 *   4. Print clear human-readable instructions on what to do if the
 *      auth dialog does NOT appear automatically:
 *        - Select function `listSlotsRegenTriggers` from the dropdown
 *        - Click Run
 *        - Click Allow / 承認 in the dialog that opens
 *   5. Listen for any new tab containing accounts.google.com (the
 *      OAuth consent screen pops in a new window in Apps Script flow).
 *
 * This script does NOT automate clicking inside Apps Script editor — the
 * Apps Script SPA does not expose stable selectors and trying to click
 * specific buttons is fragile. The script's job is to *position* the user
 * in front of the correct tab and watch for completion.
 */
import { chromium, type Page } from "@playwright/test";

const CDP_URL = "http://localhost:9222";
const SCRIPT_ID = "1-1opRkAFbFQz96Uqlgy3sWjgAs_PKS_1Eg9Pz7_6geTFztHx_5APSj2G";
const EDITOR_URL = `https://script.google.com/home/projects/${SCRIPT_ID}/edit`;

async function main() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  R-2C-B: Apps Script 再認可フロー支援スクリプト");
  console.log("═══════════════════════════════════════════════════════════");

  const browser = await chromium.connectOverCDP(CDP_URL, { timeout: 5000 });
  const ctx = browser.contexts()[0];

  // Find or open the editor tab
  let editorPage: Page | null = null;
  for (const p of ctx.pages()) {
    if (p.url().includes(`script.google.com/home/projects/${SCRIPT_ID}`)) {
      editorPage = p;
      break;
    }
  }
  if (!editorPage) {
    console.log("\n→ Apps Script エディタを新規タブで開きます…");
    editorPage = await ctx.newPage();
    await editorPage.goto(EDITOR_URL, { waitUntil: "domcontentloaded" });
  } else {
    console.log("\n→ 既存の Apps Script エディタタブを再利用します。");
    await editorPage.bringToFront();
  }

  // Wait for the file tree (best-effort; selectors may rot)
  try {
    await editorPage.waitForSelector('text="JREC_SF01_Reservation"', { timeout: 15_000 });
    console.log("✅ ファイル一覧に JREC_SF01_Reservation が表示されています。");
  } catch {
    console.log("⚠  ファイル一覧の検出はスキップします（UI 検出失敗）。");
  }

  console.log("\n―――― 院長への依頼（最小手順）――――――――――――――");
  console.log("1. 上で開いた Apps Script エディタの上部 関数選択ドロップダウンで");
  console.log("   `listSlotsRegenTriggers` を選択");
  console.log("2. ▶ Run（実行）ボタンをクリック");
  console.log("3. 「Authorization required / 承認が必要」ダイアログが出たら");
  console.log("   Continue / 続行 → アカウント選択 → Allow / 許可 をクリック");
  console.log("4. Apps Script 実行ログに `count=...` 行が出れば成功");
  console.log("―――――――――――――――――――――――――――");

  // Watch for new tabs (OAuth consent typically opens in a new window/tab)
  console.log("\n→ アカウント認可画面の出現を 5 分間待機します…");
  const oauthTab = await Promise.race([
    new Promise<Page | null>((resolve) => {
      ctx.on("page", async (p) => {
        try {
          await p.waitForLoadState("domcontentloaded", { timeout: 30_000 });
          const url = p.url();
          if (url.includes("accounts.google.com") || url.includes("oauthchooseaccount")) {
            console.log("\n🔑 OAuth 画面が開きました: " + url.substring(0, 100));
            resolve(p);
          }
        } catch {}
      });
    }),
    new Promise<Page | null>((resolve) => setTimeout(() => resolve(null), 5 * 60 * 1000)),
  ]);

  if (oauthTab) {
    console.log("\n✅ OAuth 画面の出現を検出しました。");
    console.log("   院長は Allow / 許可 をクリックしてください。");
    console.log("   クリック後はこのスクリプトを終了し、Claude の deep verify を再実行してください。");
  } else {
    console.log("\n⏰ 5 分間 OAuth 画面の検出はありませんでした。");
    console.log("   既に Run 実行済 + 承認済の可能性があります。");
    console.log("   `npx tsx scripts/jrec-r2c-deep-verify.ts` を実行して状態確認してください。");
  }

  console.log("\nこのスクリプトはブラウザを閉じずに終了します。");
  process.exit(0);
}

main().catch((e) => {
  console.error("[trigger-auth-prompt] 例外: " + (e && e.message || e));
  process.exit(1);
});
