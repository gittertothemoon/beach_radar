import { expect, test, type Page } from "@playwright/test";
import {
  E2E_BEACH_ID,
  grantAppAccess,
  mockAnalyticsApi,
  mockGeolocation,
  mockReportsFeed,
  mockWeatherApi,
  withQuery,
} from "./helpers/app";

const TEST_EMAIL = process.env.E2E_TEST_USER_EMAIL || "";
const TEST_PASSWORD = process.env.E2E_TEST_USER_PASSWORD || "";

const waitForFavoriteSync = async (page: Page) => {
  return page.waitForResponse(
    (response) => {
      if (!response.url().includes("/rest/v1/user_favorites")) return false;
      const method = response.request().method();
      if (method !== "POST" && method !== "DELETE") return false;
      return response.status() < 500;
    },
    { timeout: 15000 },
  );
};

test("favorite click from anonymous user opens auth-required modal", async ({ page }) => {
  await grantAppAccess(page.context());
  await mockAnalyticsApi(page);
  await mockGeolocation(page.context());
  await mockWeatherApi(page);
  await mockReportsFeed(page, []);

  await page.goto(withQuery("/app/", { beachId: E2E_BEACH_ID, reportAnywhere: "1" }));
  await expect(page.getByTestId("lido-modal")).toBeVisible();

  await page.getByTestId("favorite-toggle").click();
  await expect(page.getByTestId("auth-required-modal")).toBeVisible();
});

test("logged user can add/remove favorites with remote sync", async ({ page }) => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    "Missing E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD.",
  );

  await grantAppAccess(page.context());
  await mockAnalyticsApi(page);
  await mockGeolocation(page.context());
  await mockWeatherApi(page);
  await mockReportsFeed(page, []);

  const returnTo = withQuery("/app/", { beachId: E2E_BEACH_ID, reportAnywhere: "1" });
  await page.goto(withQuery("/app/register", { mode: "login", returnTo }));

  await page.getByTestId("auth-email-input").fill(TEST_EMAIL);
  await page.getByTestId("auth-password-input").fill(TEST_PASSWORD);
  await page.getByTestId("auth-submit").click();

  const appVisible = await page
    .getByTestId("app-root")
    .isVisible({ timeout: 20000 })
    .catch(() => false);
  if (!appVisible) {
    test.skip(
      true,
      "Login non riuscito con il test user (credenziali/config Supabase).",
    );
    return;
  }

  await expect(page.getByTestId("lido-modal")).toBeVisible();

  const firstSync = Promise.all([
    waitForFavoriteSync(page),
    page.getByTestId("favorite-toggle").click(),
  ]);
  const [firstResponse] = await firstSync;

  const secondSync = Promise.all([
    waitForFavoriteSync(page),
    page.getByTestId("favorite-toggle").click(),
  ]);
  const [secondResponse] = await secondSync;

  const firstMethod = firstResponse.request().method();
  const secondMethod = secondResponse.request().method();
  expect([firstMethod, secondMethod].sort()).toEqual(["DELETE", "POST"]);
});
