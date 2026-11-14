import { defineConfig } from "@playwright/test";
import { existsSync } from "node:fs";

// Replit's Nix-provided Chromium includes the required system libraries.
// Other hosts use Playwright's installed browser unless explicitly overridden.
const executablePath = process.env.GUEST_CHROMIUM_EXECUTABLE
  ?? (existsSync("/repl/tools/bin/chromium") ? "/repl/tools/bin/chromium" : undefined);

export default defineConfig({
  testDir: "./src/guest-regression",
  testMatch: "*.spec.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  outputDir: "../generated-artifacts/guest-regression",
  use: {
    headless: true,
    viewport: { width: 1360, height: 900 },
    // Harness-only: optional portable override for hosts where the downloaded
    // Playwright Chromium cannot load system libraries (e.g. Nix/Replit).
    launchOptions: executablePath ? { executablePath } : {},
  },
});
