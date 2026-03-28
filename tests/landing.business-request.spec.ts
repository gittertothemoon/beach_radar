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
