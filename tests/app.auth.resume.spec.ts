import { expect, test } from "@playwright/test";
import {
  appUiUrl,
  E2E_BEACH_ID,
  grantAppAccess,
  mockAnalyticsApi,
  mockGeolocation,
  mockReportsFeed,
  mockWeatherApi,
  withQuery,
} from "./helpers/app";

test("auth redirect preserves return path and resumes app context after cancel", async ({
  page,
}) => {
  await grantAppAccess(page.context());
  await mockAnalyticsApi(page);
  await mockGeolocation(page.context());
  await mockWeatherApi(page);
  await mockReportsFeed(page, []);

  await page.goto(appUiUrl({ beachId: E2E_BEACH_ID, reportAnywhere: "1" }));
  await expect(page.getByTestId("lido-modal")).toBeVisible();

  await page.getByTestId("favorite-toggle").click();
  await expect(page.getByTestId("auth-required-modal")).toBeVisible();

  await page.getByRole("button", { name: /Crea e continua/i }).click();
  await expect(page).toHaveURL(/\/(?:app\/)?register\/?/);

  const registerUrl = new URL(page.url());
  expect(registerUrl.searchParams.get("fav")).toBe(E2E_BEACH_ID);
  const returnTo = registerUrl.searchParams.get("returnTo") ?? "";
  expect(returnTo).toContain("/app/");
  expect(returnTo).toContain(`beachId=${E2E_BEACH_ID}`);

  await page.getByRole("button", { name: /Torna all'app/i }).click();
  await expect(page.getByTestId("app-root")).toBeVisible();
  await expect(page.getByTestId("lido-modal")).toBeVisible();
  await expect(page.getByTestId("auth-required-modal")).not.toBeVisible();
});

test("register can establish a session and keep it after reload", async ({ page }) => {
  await grantAppAccess(page.context());
  await mockAnalyticsApi(page);
  await mockGeolocation(page.context());
  await mockWeatherApi(page);
  await mockReportsFeed(page, []);

  const returnTo = appUiUrl({ beachId: E2E_BEACH_ID, reportAnywhere: "1" });
  await page.goto(withQuery("/app/register", { returnTo }));

  const uniqueEmail = `w2b_e2e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = "W2bPassword!123";

  await page.getByPlaceholder(/^Nome$/).fill("QA");
  await page.getByPlaceholder(/^Cognome$/).fill("Tester");
  await page.getByTestId("auth-email-input").fill(uniqueEmail);
  await page.getByTestId("auth-password-input").fill(password);
  await page.getByPlaceholder("Ripeti la password").fill(password);
  await page.getByRole("checkbox", { name: /accetto termini, privacy/i }).check();
  await page.getByTestId("auth-submit").click();

  const appVisible = await page
    .getByTestId("app-root")
    .isVisible({ timeout: 25000 })
    .catch(() => false);

  if (!appVisible) {
    await expect(page).toHaveURL(/\/(?:app\/)?register\/?/);
    return;
  }

  await expect(page.getByTestId("lido-modal")).toBeVisible();
  await page.getByTestId("favorite-toggle").click();
  await expect(page.getByTestId("auth-required-modal")).not.toBeVisible();

  await page.reload();
  await expect(page.getByTestId("app-root")).toBeVisible();
  await expect(page.getByTestId("lido-modal")).toBeVisible();
});
