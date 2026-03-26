import { expect, test } from "@playwright/test";
import {
  appUiUrl,
  E2E_BEACH_ID,
  grantAppAccess,
  mockAnalyticsApi,
  mockBeachProfileApi,
  mockGeolocation,
  mockReportsFeed,
  mockWeatherApi,
} from "./helpers/app";

test("app lido modal shows verified profile metadata when available", async ({ page }) => {
  await grantAppAccess(page.context());
  await mockAnalyticsApi(page);
  await mockGeolocation(page.context());
  await mockWeatherApi(page);
  await mockReportsFeed(page, []);
  await mockBeachProfileApi(page, {
    beachId: E2E_BEACH_ID,
    hours: "09:00 - 19:00",
    services: ["Ombrelloni", "Lettini", "Bar"],
    phone: "+39 0541 123456",
    website: "https://example-lido.it",
    priceBand: "mid",
    confidence: 0.91,
    verifiedAt: "2026-03-25T12:30:00.000Z",
    status: "published",
    sources: [
      {
        label: "Sito ufficiale",
        url: "https://example-lido.it",
        sourceType: "official",
      },
      {
        label: "Google Maps",
        url: "https://maps.google.com/?q=example",
        sourceType: "google",
      },
    ],
  });

  await page.goto(appUiUrl({ beachId: E2E_BEACH_ID, reportAnywhere: "1" }));

  const modal = page.getByTestId("lido-modal");
  await expect(modal).toBeVisible();
  await expect(modal).toContainText("Dati verificati");
  await expect(modal).toContainText("Ultima verifica");
  await expect(modal).toContainText("Sito ufficiale");
});
