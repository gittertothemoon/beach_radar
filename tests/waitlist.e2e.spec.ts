import { test, expect } from "@playwright/test";

const WAITLIST_PATH = process.env.WAITLIST_PATH || "/waitlist/index.html";
const QUERY =
  "?utm_source=poster&utm_medium=qr&utm_campaign=pilot_rimini_v1&poster=v1&city=rimini";
const WAITLIST_URL = `${WAITLIST_PATH}${QUERY}`;

function uniqueEmail() {
  return `wl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
}

async function readLocalStorage(page: { evaluate: any }) {
  return page.evaluate(() => {
    const out: Record<string, string | null> = {};
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key) out[key] = localStorage.getItem(key);
    }
    return out;
  });
}

test("submit flow persists joined state and avoids raw email storage", async ({ page }) => {
  await page.goto(WAITLIST_URL);

  const email = uniqueEmail();
  const input = page.locator("#emailInput");
  const button = page.locator("#t-btn");
  const status = page.locator("#statusMsg");

  await input.fill(email);
  await button.click();

  await expect(status).toHaveClass(/success/);
  await expect(input).toBeDisabled();
  await expect(button).toBeDisabled();

  const storage = await readLocalStorage(page);
  expect(storage["br_waitlist_joined_v1"]).toBe("1");

  const events = storage["br_events_v1"] || "";
  expect(events).not.toContain(email);
  expect(events).not.toContain("@");

  const meta = storage["br_waitlist_meta_v1"] || "";
  expect(meta).not.toContain(email);
  expect(meta).not.toContain("@");

  await page.reload();
  await expect(input).toBeDisabled();
  await expect(button).toBeDisabled();
});

test("language toggle persists across reload", async ({ page }) => {
  await page.goto(WAITLIST_URL);

  const langBtn = page.locator("#langBtn");
  const title = page.locator("#t-title");

  const initialTitle = await title.textContent();
  await langBtn.click();

  await expect(title).not.toHaveText(initialTitle || "");

  const storedLang = await page.evaluate(() => localStorage.getItem("br_lang_v1"));
  expect(storedLang).toBe("en");

  await page.reload();
  const langAfter = await page.evaluate(() => document.documentElement.lang);
  expect(langAfter).toBe("en");
});

test("network failure shows retry and keeps form enabled", async ({ page }) => {
  await page.goto(WAITLIST_URL);

  await page.route("**/api/waitlist", (route) => route.abort());

  const email = uniqueEmail();
  const input = page.locator("#emailInput");
  const button = page.locator("#t-btn");
  const status = page.locator("#statusMsg");

  await input.fill(email);
  await button.click();

  await expect(status).toHaveClass(/error/);
  await expect(page.locator("#retryBtn")).toBeVisible();
  await expect(input).toBeEnabled();
  await expect(button).toBeEnabled();

  const joined = await page.evaluate(() => localStorage.getItem("br_waitlist_joined_v1"));
  expect(joined).toBeNull();
});
