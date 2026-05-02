import { defineConfig, devices } from "@playwright/test";
import path from "path";

const reportsDir = path.join(__dirname, "reports");

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
    // スクリーンショット保存先
    screenshotPath: (testInfo) =>
      path.join(
        reportsDir,
        "screenshots",
        testInfo.project.name,
        `${testInfo.titlePath.join("__").replace(/\s+/g, "_")}.png`
      ),
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

  // GAS /dev はログイン済みブラウザが必要な場合があるため、
  // storageState を設定して認証セッションを再利用できる構造にしている
  // 実際の認証設定は projects/*/config.json の storageStatePath を参照する
});
