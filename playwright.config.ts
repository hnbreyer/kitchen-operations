import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";
const databaseUrl = `file:${fileURLToPath(new URL("./prisma/test.db", import.meta.url))}`;
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: false,
  timeout: 60000,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command:
      "node scripts/test-db.mjs --prepare-only && npm run build && npm start -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    env: {
      DATABASE_URL: databaseUrl,
      BUSINESS_TIMEZONE: "America/Sao_Paulo",
      PLAYWRIGHT_TEST_SERVER: "1",
    },
    timeout: 180000,
  },
});
