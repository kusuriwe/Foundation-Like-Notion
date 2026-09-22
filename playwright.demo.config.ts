import path from "node:path"
import { defineConfig, devices } from "@playwright/test"

process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.resolve(".cache/ms-playwright")

const demoUrl = "http://127.0.0.1:4173/Foundation-Like-Notion/"

export default defineConfig({
  testDir: "./e2e-demo",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: demoUrl,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run demo:build && npm run demo:preview",
    url: demoUrl,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit-mobile", use: { ...devices["iPhone 15"] } },
  ],
})
