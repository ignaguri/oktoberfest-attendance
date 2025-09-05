import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  webServer: {
    command: 'bash -c "pnpm build && pnpm start -p 3000"',
    url: process.env.BASE_URL || "http://localhost:3008",
    reuseExistingServer: true,
    timeout: 180_000,
  },
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:3008",
    trace: "on-first-retry",
    video: "retain-on-failure",
    screenshot: "only-on-failure",
    permissions: ["notifications"],
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
