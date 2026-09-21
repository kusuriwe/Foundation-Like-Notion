import path from "node:path"
import { defineConfig, devices } from "@playwright/test"

process.env.PLAYWRIGHT_BROWSERS_PATH ??= path.resolve(".cache/ms-playwright")

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      NODE_ENV: "development",
      HOST: "127.0.0.1",
      PORT: "3000",
      READER_CONFIG_PATH: "../../config/reader.example.yaml",
      READER_DATABASE_PATH: "../../.data/e2e-reader.sqlite",
      READER_PASSWORD_HASH:
        "$argon2id$v=19$m=19456,t=2,p=1$DIAneJJ2J9L/ElZjIv/VQw$ZiCSJATI7J1Yoj1is9BThdN0tD0xyg3a/S+P3hHL5ZE",
    },
  },
  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit-mobile", use: { ...devices["iPhone 15"] } },
  ],
})
