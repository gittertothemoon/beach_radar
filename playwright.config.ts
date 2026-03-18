import { defineConfig } from "@playwright/test";

export default defineConfig({
  fullyParallel: false,
  timeout: 30_000,
  expect: {
    timeout: 10_000
  },
  webServer: [
    {
      command:
        "npm --prefix w2b-hero run sync:app-shell && SIGNUP_TEST_MODE=1 REPORTS_TEST_MODE=1 APP_ACCESS_KEY=test-app-access-key npx vercel dev --listen 3000 --yes",
      url: "http://localhost:3000",
      reuseExistingServer: true,
      timeout: 120_000
    },
    {
      command: "npm run dev -- --host 127.0.0.1 --port 5173",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: true,
      timeout: 120_000
    }
  ],
  use: {
    trace: "off",
    screenshot: "off",
    video: "off"
  },
  projects: [
    {
      name: "api-and-routing",
      testDir: "tests",
      testMatch: [
        "reports.api.spec.ts",
        "app.gating.spec.ts"
      ],
      use: {
        baseURL: "http://localhost:3000"
      }
    },
    {
      name: "app-ui",
      testDir: "tests",
      testMatch: [
        "app.auth.spec.ts",
        "app.auth.resume.spec.ts",
        "app.map.spec.ts",
        "app.reports.spec.ts",
        "app.favorites.spec.ts"
      ],
      use: {
        baseURL: "http://127.0.0.1:5173"
      }
    }
  ]
});
