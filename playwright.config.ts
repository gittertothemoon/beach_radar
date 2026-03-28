import { defineConfig } from "@playwright/test";

const ENABLE_API_SERVER = process.env.PW_ENABLE_API_SERVER !== "0";

const API_WEB_SERVER = {
  command:
    "npm --prefix w2b-hero run sync:app-shell && SIGNUP_TEST_MODE=1 REPORTS_TEST_MODE=1 BEACH_ENRICH_TEST_MODE=1 CRON_SECRET=test-cron-secret APP_ACCESS_KEY=test-app-access-key npx vercel dev --listen 3000 --yes",
  url: "http://localhost:3000",
  reuseExistingServer: true,
  timeout: 120_000,
} as const;

const UI_WEB_SERVER = {
  command:
    "VITE_SUPABASE_URL=${VITE_SUPABASE_URL:-https://example.supabase.co} VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY:-test-anon-key} VITE_PUBLIC_BASE_URL=${VITE_PUBLIC_BASE_URL:-http://127.0.0.1:5173} npm run dev -- --host 127.0.0.1 --port 5173",
  url: "http://127.0.0.1:5173",
  reuseExistingServer: true,
  timeout: 120_000,
} as const;

export default defineConfig({
  fullyParallel: false,
  timeout: 30_000,
  expect: {
    timeout: 10_000
  },
  webServer: ENABLE_API_SERVER ? [API_WEB_SERVER, UI_WEB_SERVER] : [UI_WEB_SERVER],
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
        "business-request.api.spec.ts",
        "reports.api.spec.ts",
        "app.gating.spec.ts",
        "landing.business-request.spec.ts",
        "beach.enrich.api.spec.ts",
        "beach.enrich.logic.spec.ts"
      ],
      use: {
        baseURL: "http://localhost:3000"
      }
    },
    {
      name: "app-ui",
      testDir: "tests",
      testMatch: [
        "auth.logic.spec.ts",
        "app.auth.spec.ts",
        "app.auth.errors.spec.ts",
        "app.auth.resume.spec.ts",
        "app.account.spec.ts",
        "app.map.spec.ts",
        "app.beach-profile.spec.ts",
        "app.reports.spec.ts",
        "app.favorites.spec.ts"
      ],
      use: {
        baseURL: "http://127.0.0.1:5173"
      }
    }
  ]
});
