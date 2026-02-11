import { expect, test } from "@playwright/test";
import {
  E2E_BEACH_ID,
  grantAppAccess,
  mockAnalyticsApi,
  mockGeolocation,
  mockReportsFeed,
  mockWeatherApi,
  withQuery,
} from "./helpers/app";

test("app map loads and opens deterministic beach modal", async ({ page }) => {
  await grantAppAccess(page.context());
  await mockAnalyticsApi(page);
  await mockGeolocation(page.context());
  await mockWeatherApi(page);
  await mockReportsFeed(page, []);

  await page.goto(withQuery("/app/", { beachId: E2E_BEACH_ID, reportAnywhere: "1" }));

  await expect(page.getByTestId("app-root")).toBeVisible();
  await expect(page.getByTestId("map-container")).toBeVisible();
  await expect(page.getByTestId("search-input")).toBeVisible();
  await expect(page.getByTestId("bottom-sheet")).toBeVisible();
  await expect(page.getByTestId("lido-modal")).toBeVisible();
  await expect(page.getByTestId("lido-weather")).toBeVisible();
});
