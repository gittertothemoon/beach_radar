import { defineConfig } from "@playwright/test";

const baseURL = process.env.BASE_URL || "http://localhost:3000";

export default defineConfig({
  testDir: "tests",
  fullyParallel: true,
  timeout: 30_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL,
    trace: "off",
    screenshot: "off",
    video: "off"
  }
});
