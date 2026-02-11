import { expect, test } from "@playwright/test";
import {
  E2E_BEACH_ID,
  grantAppAccess,
  mockAnalyticsApi,
  mockGeolocation,
  mockWeatherApi,
  withQuery,
} from "./helpers/app";

test("report submit happy path", async ({ page }) => {
  await grantAppAccess(page.context());
  await mockAnalyticsApi(page);
  await mockGeolocation(page.context());
  await mockWeatherApi(page);

  let postCount = 0;
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

  await page.goto(withQuery("/app/", { beachId: E2E_BEACH_ID, reportAnywhere: "1" }));
  await expect(page.getByTestId("lido-modal")).toBeVisible();

  await page.getByTestId("report-cta").click();
  await expect(page.getByTestId("report-modal")).toBeVisible();
  await page.getByTestId("report-level-2").click();

  await expect.poll(() => postCount).toBe(1);
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

  await page.goto(withQuery("/app/", { beachId: E2E_BEACH_ID, reportAnywhere: "1" }));
  await expect(page.getByTestId("lido-modal")).toBeVisible();

  await page.getByTestId("report-cta").click();
  await expect(page.getByTestId("report-modal")).toBeVisible();
  await page.getByTestId("report-level-2").click();

  await expect(page.getByTestId("report-error")).toBeVisible();
});
