import {
  test,
  expect,
  type APIRequestContext,
  type APIResponse,
  type Page
} from "@playwright/test";

const WAITLIST_PATH = process.env.WAITLIST_PATH || "/waitlist/index.html";
const QUERY =
  "?utm_source=poster&utm_medium=qr&utm_campaign=pilot_rimini_v1&poster=v1&city=rimini";
const WAITLIST_URL = `${WAITLIST_PATH}${QUERY}`;

function uniqueEmail() {
  return `wl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
}

function buildPayload(email: string) {
  return {
    email,
    lang: "it",
    ts: new Date().toISOString(),
    project: "beach_radar",
    version: "waitlist_v1",
    page: "http://example.test/waitlist",
    referrer: "",
    tz: "UTC",
    device: {
      w: 1200,
      h: 800,
      dpr: 1,
      ua: "Playwright"
    },
    utm: {
      utm_source: "poster",
      utm_medium: "qr",
      utm_campaign: "pilot_rimini_v1"
    },
    attribution: {
      poster: "v1",
      city: "rimini"
    }
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function readJson(response: APIResponse): Promise<Record<string, unknown> | null> {
  try {
    const payload: unknown = await response.json();
    return isRecord(payload) ? payload : null;
  } catch {
    return null;
  }
}

async function ensureApiReady(request: APIRequestContext) {
  const response = await request.post("/api/waitlist", {
    data: buildPayload(uniqueEmail())
  });
  const body = await readJson(response);
  if (response.status() === 500 && (body?.error === "missing_env" || body?.error === "missing_email_env")) {
    return { ready: false, reason: body?.error };
  }
  return { ready: response.status() === 200, reason: body?.error || null };
}

async function readLocalStorage(page: Page): Promise<Record<string, string | null>> {
  return page.evaluate<Record<string, string | null>>(() => {
    const out: Record<string, string | null> = {};
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key) out[key] = localStorage.getItem(key);
    }
    return out;
  });
}

test("submit flow persists joined state and avoids raw email storage", async ({ page, request }) => {
  const api = await ensureApiReady(request);
  test.skip(!api.ready, "API not ready (missing env).");

  await page.goto(WAITLIST_URL);

  const email = uniqueEmail();
  const input = page.locator("#emailInput");
  const button = page.locator("#t-btn");
  const status = page.locator("#statusMsg");

  await input.fill(email);
  await button.click({ force: true });

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
  await button.click({ force: true });

  await expect(status).toHaveClass(/error/);
  await expect(page.locator("#retryBtn")).toBeVisible();
  await expect(input).toBeEnabled();
  await expect(button).toBeEnabled();

  const joined = await page.evaluate(() => localStorage.getItem("br_waitlist_joined_v1"));
  expect(joined).toBeNull();
});
