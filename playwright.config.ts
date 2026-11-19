import { defineConfig } from "@playwright/test";

const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "TestVeloAdmin2026!";
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  "test-session-secret-velo-pulse-minimum-32-chars";

const inheritedEnv = Object.fromEntries(
  Object.entries(process.env).filter(
    (entry): entry is [string, string] => typeof entry[1] === "string",
  ),
);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "desktop-chromium",
      use: {
        browserName: "chromium",
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "iphone-15",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      },
    },
  ],
  webServer: {
    command: `node node_modules/next/dist/bin/next start -p ${PORT} -H 127.0.0.1`,
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 120 * 1000,
    env: {
      ...inheritedEnv,
      ADMIN_PASSWORD,
      SESSION_SECRET,
      NEXT_PUBLIC_APP_URL: BASE_URL,
      DATABASE_URL:
        process.env.E2E_USE_DB === "1" ? (process.env.DATABASE_URL ?? "") : "",
      BLOB_READ_WRITE_TOKEN:
        process.env.E2E_USE_DB === "1"
          ? (process.env.BLOB_READ_WRITE_TOKEN ?? "")
          : "",
    },
  },
});
