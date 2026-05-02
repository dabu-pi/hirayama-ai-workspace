import { defineConfig, devices } from "@playwright/test";
import fs from "fs";
import path from "path";

const reportsDir = path.join(__dirname, "reports");

// auth.json が存在する場合だけ storageState を使う
// auth.json がない場合は未認証状態で実行（smoke は skipIfLoginRequired で安全に skip する）
const authFile = path.join(__dirname, "auth.json");
const storageState = fs.existsSync(authFile) ? authFile : undefined;

if (storageState) {
  console.log("[playwright.config] ✅ auth.json を検出。storageState 有効。");
} else {
  console.log("[playwright.config] ⚠ auth.json が見つかりません。未認証モードで実行します。");
  console.log("[playwright.config]   GAS /dev テストは skip されます。");
  console.log("[playwright.config]   認証セットアップ手順: docs/GAS_LIVE_CHECK_NOTES.md");
}

export default defineConfig({
  testDir: "./projects",
  testMatch: "**/*.spec.ts",
  timeout: 30_000,
  retries: 0,
  workers: 1,

  reporter: [
    ["list"],
    ["html", { outputFolder: path.join(reportsDir, "html"), open: "never" }],
    ["json", { outputFile: path.join(reportsDir, "results.json") }],
  ],

  use: {
    headless: true,
    screenshot: "only-on-failure",
    video: "off",
    trace: "off",
    // auth.json があれば Google ログイン済みセッションを使う
    storageState,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 5"] },
      testMatch: "**/smoke.spec.ts",
    },
  ],
});
