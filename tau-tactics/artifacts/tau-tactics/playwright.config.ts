import { defineConfig } from "@playwright/test";

// An existing preview can be used without starting a duplicate server.
const baseURL = process.env.PLAYWRIGHT_BASE_URL || "http://127.0.0.1:4179";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  workers: 2,
  retries: 0,
  reporter: "list",
  outputDir: "../../generated-artifacts/playwright",
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH }
          : {},
      },
    },
    // Keep the existing suite Chromium-only; review regressions run on all engines.
    { name: "firefox", testMatch: /reviews\.spec\.ts/, use: { browserName: "firefox" } },
    { name: "webkit", testMatch: /reviews\.spec\.ts/, use: { browserName: "webkit" } },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: "PORT=4179 BASE_PATH=/ pnpm run dev",
    url: baseURL,
    reuseExistingServer: false,
  },
});
