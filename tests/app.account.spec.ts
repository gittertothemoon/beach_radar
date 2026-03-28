import { expect, test, type Page } from "@playwright/test";
import {
  appUiUrl,
  grantAppAccess,
  mockAnalyticsApi,
  mockGeolocation,
  mockReportsFeed,
  mockWeatherApi,
} from "./helpers/app";

const ACCOUNT_PREFS_STORAGE_KEY = "w2b-account-prefs-v1";

const openProfileSettings = async (page: Page) => {
  await page.getByRole("button", { name: /mostra elenco spiagge/i }).click();
  await page.getByTestId("bottom-nav-profile").click();
  await expect(page.getByText("Preferenze")).toBeVisible();
};

test.describe("account settings panel", () => {
  test("business CTA opens dedicated landing section on web", async ({ page }) => {
    await grantAppAccess(page.context());
    await mockAnalyticsApi(page);
    await mockGeolocation(page.context());
    await mockWeatherApi(page);
    await mockReportsFeed(page, []);

    await page.goto(appUiUrl({ reportAnywhere: "1" }));
    await openProfileSettings(page);

    await page.getByTestId("settings-business-cta").click();
    await page.waitForURL(/\/landing\/\?.*#business-request/);
    await expect(page).toHaveURL(/src=account/);
  });

  test("business CTA opens an external landing page in native shell", async ({ page }) => {
    await grantAppAccess(page.context());
    await mockAnalyticsApi(page);
    await mockGeolocation(page.context());
    await mockWeatherApi(page);
    await mockReportsFeed(page, []);

    await page.goto(appUiUrl({ reportAnywhere: "1", native_shell: "1" }));
    await openProfileSettings(page);

    const popupPromise = page.waitForEvent("popup");
    await page.getByTestId("settings-business-cta").click();
    const popup = await popupPromise;

    await expect(popup).toHaveURL(/\/landing\/\?.*#business-request/);
    await expect(popup).toHaveURL(/src=account/);
    await expect(page).toHaveURL(/\/app\/\?.*native_shell=1/);
  });

  test("language and interests preferences are persisted in localStorage", async ({
    page,
  }) => {
    await grantAppAccess(page.context());
    await mockAnalyticsApi(page);
    await mockGeolocation(page.context());
    await mockWeatherApi(page);
    await mockReportsFeed(page, []);

    await page.goto(appUiUrl({ reportAnywhere: "1" }));
    await openProfileSettings(page);

    await page.getByTestId("settings-language-row").click();
    await page.getByTestId("settings-language-en").click();

    await page.getByTestId("settings-interests-row").click();
    await page.getByTestId("settings-interest-surf").click();
    await page.getByTestId("settings-interest-food").click();

    const stored = await page.evaluate((storageKey) => {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }, ACCOUNT_PREFS_STORAGE_KEY);

    expect(stored).toBeTruthy();
    expect(stored?.language).toBe("en");
    expect(Array.isArray(stored?.interests)).toBe(true);
    expect(stored?.interests).toContain("surf");
    expect(stored?.interests).toContain("food");

    await page.getByTestId("settings-saved-row").click();
    await expect(page.getByTestId("settings-saved-row")).toBeHidden();
  });
});
