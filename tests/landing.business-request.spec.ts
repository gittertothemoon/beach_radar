import { expect, test } from "@playwright/test";

const LANDING_URL = "/landing/?from=app&src=account#business-request";

test.describe("landing business request form", () => {
  test("submits successfully and shows success feedback", async ({ page }) => {
    await page.route("**/api/business-request", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, already: false, notified: true }),
      });
    });

    await page.goto(LANDING_URL);
    await page.locator("[data-business-type]").selectOption("stabilimento");
    await page.locator("[data-business-company]").fill("Bagni Aurora");
    await page.locator("[data-business-city]").fill("Rimini");
    await page.locator("[data-business-contact]").fill("Mario Rossi");
    await page.locator("[data-business-role]").fill("Titolare");
    await page.locator("[data-business-email]").fill("mario.rossi@bagni-aurora.it");
    await page.locator("[data-business-phone]").fill("+39 333 1111111");
    await page.locator("[data-business-message]").fill("Vorrei informazioni sui lead partner.");
    await page.locator("[data-business-consent]").check();
    await page.locator("[data-business-submit]").click();

    await expect(page.locator("[data-business-feedback]")).toContainText(
      "Perfetto, richiesta inviata",
    );
  });

  test("handles backend rate limit error", async ({ page }) => {
    await page.route("**/api/business-request", async (route) => {
      await route.fulfill({
        status: 429,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "rate_limited", retry_after: 120 }),
      });
    });

    await page.goto(LANDING_URL);
    await page.locator("[data-business-type]").selectOption("hotel");
    await page.locator("[data-business-company]").fill("Hotel Mare Blu");
    await page.locator("[data-business-city]").fill("Riccione");
    await page.locator("[data-business-contact]").fill("Luca Bianchi");
    await page.locator("[data-business-role]").fill("Direttore");
    await page.locator("[data-business-email]").fill("luca.bianchi@hotelmareblu.it");
    await page.locator("[data-business-consent]").check();
    await page.locator("[data-business-submit]").click();

    await expect(page.locator("[data-business-feedback]")).toContainText(
      "Troppi tentativi ravvicinati",
    );
  });
});

test.describe("landing conversion safeguards", () => {
  test("has SEO metadata and no placeholder hash links", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => {
      pageErrors.push(String(error?.message || error));
    });

    await page.goto("/landing/");

    await expect(page.locator('meta[name="description"]')).toHaveCount(1);
    await expect(page.locator('meta[property="og:title"]')).toHaveCount(1);
    await expect(page.locator('meta[name="twitter:card"]')).toHaveCount(1);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    await expect(page.locator('a[href="#"]')).toHaveCount(0);

    await page.locator("#logo-text").click();
    await expect(pageErrors).toEqual([]);
  });

  test("store CTA scrolls and focuses the email input", async ({ page }) => {
    await page.goto("/landing/");

    await page.locator('[data-cta-id="waitlist_store_ios"]').click();
    await expect(page.locator("#landing-email-input")).toBeFocused();
  });

  test("does not request radar frames before section enters viewport", async ({ page }) => {
    const sequenceRequests: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (url.includes("/sequence/")) {
        sequenceRequests.push(url);
      }
    });

    await page.goto("/landing/");
    await page.waitForTimeout(1200);
    expect(sequenceRequests.length).toBe(0);

    await page.locator("#radar-sequence").scrollIntoViewIfNeeded();
    await page.waitForTimeout(2000);
    expect(sequenceRequests.length).toBeGreaterThan(0);
  });

  test("tracks core funnel analytics events", async ({ page }) => {
    const trackedEvents: string[] = [];

    await page.route("**/api/analytics", async (route) => {
      const payload = route.request().postDataJSON() as { eventName?: string };
      if (payload?.eventName) trackedEvents.push(payload.eventName);
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.route("**/api/signup", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, already: false }),
      });
    });

    await page.goto("/landing/?utm_source=test&utm_medium=e2e&utm_campaign=landing");
    await page.locator('[data-cta-id="nav_store_ios"]').click();
    await page.locator("#landing-email-input").fill("qa.landing@example.org");
    await page.locator("#landing-email-submit").click();
    await page.waitForTimeout(400);

    expect(trackedEvents).toContain("landing_view");
    expect(trackedEvents).toContain("cta_click");
    expect(trackedEvents).toContain("signup_submit");
    expect(trackedEvents).toContain("signup_success");
  });
});
