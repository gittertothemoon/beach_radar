import { test, expect } from "@playwright/test";

if (process.env.CI === "true" && !process.env.BASE_URL) {
  throw new Error("BASE_URL is required in CI for waitlist smoke tests.");
}

const BASE_URL = (process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const WAITLIST_PATH = process.env.WAITLIST_PATH || "/waitlist/index.html";

function buildUrl(path: string) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_URL}${normalized}`;
}

test("waitlist page loads and shows core UI", async ({ page }) => {
  const response = await page.goto(buildUrl(WAITLIST_PATH));
  expect(response?.status()).toBe(200);

  await expect(page.locator("#waitlistForm")).toBeVisible();
  await expect(page.locator("#emailInput")).toBeVisible();
  await expect(page.locator("#t-btn")).toBeVisible();

  const privacyLink = page.locator("#privacyLink");
  await expect(privacyLink).toBeVisible();
  await expect(privacyLink).toHaveAttribute("href", "/privacy/");
});

test("privacy page reachable", async ({ page }) => {
  const response = await page.goto(buildUrl("/privacy/"));
  expect(response?.status()).toBe(200);
  await expect(page.locator("h1")).toHaveText(/privacy/i);
});

test("language toggle persists after reload", async ({ page }) => {
  await page.goto(buildUrl(WAITLIST_PATH));
  await page.evaluate(() => localStorage.clear());
  await page.reload();

  const langBtn = page.locator("#langBtn");
  const initialLang = await page.evaluate(() => document.documentElement.lang);
  await langBtn.click();

  const toggledLang = await page.evaluate(() => document.documentElement.lang);
  expect(toggledLang).not.toBe(initialLang);

  await page.reload();
  const persistedLang = await page.evaluate(() => document.documentElement.lang);
  expect(persistedLang).toBe(toggledLang);
});
