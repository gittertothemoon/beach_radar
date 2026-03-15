import { expect, test } from "@playwright/test";
import {
  appUiUrl,
  E2E_BEACH_ID,
  grantAppAccess,
  mockAnalyticsApi,
  mockGeolocation,
  mockWeatherApi,
} from "./helpers/app";

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

  await page.goto(appUiUrl({ beachId: E2E_BEACH_ID, reportAnywhere: "1" }));
  await expect(page.getByTestId("lido-modal")).toBeVisible();

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

  await page.goto(appUiUrl({ beachId: E2E_BEACH_ID, reportAnywhere: "1" }));
  await expect(page.getByTestId("lido-modal")).toBeVisible();

  await page.getByTestId("report-cta").click();
  await expect(page.getByTestId("report-modal")).toBeVisible();
  await page.getByTestId("report-level-2").click();
  await page.getByTestId("report-submit").click();

  await expect(page.getByTestId("report-error")).toBeVisible();
});
