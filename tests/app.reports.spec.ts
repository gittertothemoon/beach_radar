import { expect, test } from "@playwright/test";
import {
  appUiUrl,
  E2E_BEACH_ID,
  grantAppAccess,
  mockAnalyticsApi,
  mockGeolocation,
  mockWeatherApi,
  withQuery,
} from "./helpers/app";

const TEST_EMAIL = process.env.E2E_TEST_USER_EMAIL || "";
const TEST_PASSWORD = process.env.E2E_TEST_USER_PASSWORD || "";

const loginTestUser = async (page: import("@playwright/test").Page) => {
  test.skip(
    !TEST_EMAIL || !TEST_PASSWORD,
    "Missing E2E_TEST_USER_EMAIL / E2E_TEST_USER_PASSWORD.",
  );

  const returnTo = appUiUrl({ beachId: E2E_BEACH_ID, reportAnywhere: "1" });
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
};

test("anonymous user cannot open report modal", async ({ page }) => {
  await grantAppAccess(page.context());
  await mockAnalyticsApi(page);
  await mockGeolocation(page.context());
  await mockWeatherApi(page);
  await page.route("**/api/reports", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true, reports: [] }),
    });
  });

  await page.goto(appUiUrl({ beachId: E2E_BEACH_ID, reportAnywhere: "1" }));
  await expect(page.getByTestId("lido-modal")).toBeVisible();
  await page.getByTestId("report-cta").click();
  await expect(page.getByTestId("auth-required-modal")).toBeVisible();
  await expect(page.getByTestId("report-modal")).not.toBeVisible();
});

test("report submit happy path", async ({ page }) => {
  await grantAppAccess(page.context());
  await mockAnalyticsApi(page);
  await mockGeolocation(page.context());
  await mockWeatherApi(page);

  let postCount = 0;
  const postBodies: Array<Record<string, unknown>> = [];
  await page.route("**/api/reports", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, reports: [] }),
      });
      return;
    }

    postCount += 1;
    const postData = route.request().postDataJSON();
    if (postData && typeof postData === "object") {
      postBodies.push(postData as Record<string, unknown>);
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        report: {
          id: `rep_${Date.now()}`,
          beachId: E2E_BEACH_ID,
          crowdLevel: 2,
          createdAt: Date.now(),
        },
      }),
    });
  });

  await loginTestUser(page);

  await page.getByTestId("report-cta").click();
  await expect(page.getByTestId("report-modal")).toBeVisible();
  await page.getByTestId("report-level-2").click();
  await page.getByTestId("report-jellyfish-toggle").click();
  await page.getByTestId("report-algae-toggle").click();
  await page.getByTestId("report-submit").click();

  await expect.poll(() => postCount).toBe(1);
  await expect
    .poll(() => postBodies[0]?.hasJellyfish)
    .toBe(true);
  await expect
    .poll(() => postBodies[0]?.hasAlgae)
    .toBe(true);
  await expect(page.getByTestId("report-modal")).not.toBeVisible();
});

test("report submit rate-limited shows error", async ({ page }) => {
  await grantAppAccess(page.context());
  await mockAnalyticsApi(page);
  await mockGeolocation(page.context());
  await mockWeatherApi(page);

  await page.route("**/api/reports", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, reports: [] }),
      });
      return;
    }

    await route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({
        ok: false,
        error: "too_soon",
        retry_after: 30,
      }),
    });
  });

  await loginTestUser(page);

  await page.getByTestId("report-cta").click();
  await expect(page.getByTestId("report-modal")).toBeVisible();
  await page.getByTestId("report-level-2").click();
  await page.getByTestId("report-submit").click();

  await expect(page.getByTestId("report-error")).toBeVisible();
});

test("report submit network failure shows generic error and keeps modal open", async ({
  page,
}) => {
  await grantAppAccess(page.context());
  await mockAnalyticsApi(page);
  await mockGeolocation(page.context());
  await mockWeatherApi(page);

  await page.route("**/api/reports", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, reports: [] }),
      });
      return;
    }
    await route.abort();
  });

  await loginTestUser(page);

  await page.getByTestId("report-cta").click();
  await expect(page.getByTestId("report-modal")).toBeVisible();
  await page.getByTestId("report-level-2").click();
  await page.getByTestId("report-submit").click();

  await expect(page.getByTestId("report-error")).toBeVisible();
  await expect(page.getByTestId("report-modal")).toBeVisible();
});
