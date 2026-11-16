import { existsSync } from "node:fs";
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: ["tutor-markdown.spec.ts", "tutor-math-security.spec.ts"],
  outputDir: "../../../generated-artifacts/tutor-rendering",
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5199",
    // Service workers must not bypass the synthetic destination interception.
    serviceWorkers: "block",
  },
  projects: [
    {
      name: "chromium",
      use: {
        browserName: "chromium",
        launchOptions: {
          executablePath: process.env.CHROMIUM_PATH ||
            (existsSync("/repl/tools/bin/chromium") ? "/repl/tools/bin/chromium" : undefined),
          args: ["--no-sandbox"],
        },
      },
    },
    // Keep the cross-engine matrix focused on locally intercepted destinations.
    // Missing engines fail explicitly; use --project=chromium on unsupported hosts.
    { name: "firefox", grep: /@destinations/, use: { browserName: "firefox" } },
    { name: "webkit", grep: /@destinations/, use: { browserName: "webkit" } },
  ],
  webServer: {
    cwd: new URL("..", import.meta.url).pathname,
    command: "vite --config tests/vite.config.ts",
    url: "http://127.0.0.1:5199/tests/tutor-markdown.html",
    reuseExistingServer: false,
  },
});
