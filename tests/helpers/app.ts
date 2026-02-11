import type { BrowserContext, Page, Route } from "@playwright/test";

const BASE_URL = (process.env.BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");

export const APP_ACCESS_KEY = process.env.APP_ACCESS_KEY || "test-app-access-key";
export const E2E_BEACH_ID = process.env.E2E_APP_BEACH_ID || "BR-RN-001";

export const withQuery = (path: string, params: Record<string, string>) => {
  const query = new URLSearchParams(params);
  return `${path}?${query.toString()}`;
};

export const grantAppAccess = async (context: BrowserContext) => {
  await context.addCookies([
    {
      name: "br_app_access",
      value: "1",
      url: `${BASE_URL}/app/`,
      path: "/app",
    },
  ]);
};

export const mockWeatherApi = async (page: Page) => {
  await page.route("**/api/weather?*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        fetchedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
        timezone: "Europe/Rome",
        current: {
          ts: Math.floor(Date.now() / 1000),
          temperatureC: 27,
          windKmh: 14,
          rainProbability: 15,
          weatherCode: 0,
          isDay: true,
        },
        nextHours: [
          {
            ts: Math.floor(Date.now() / 1000) + 3600,
            temperatureC: 28,
            rainProbability: 5,
            weatherCode: 1,
          },
        ],
      }),
    });
  });
};

export const mockReportsFeed = async (page: Page, reports: unknown[] = []) => {
  await page.route("**/api/reports", async (route: Route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, reports }),
      });
      return;
    }
    await route.fallback();
  });
};

export const mockAnalyticsApi = async (page: Page) => {
  await page.route("**/api/analytics", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
};

export const mockGeolocation = async (
  context: BrowserContext,
  coords = { latitude: 44.07624, longitude: 12.57605 },
) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({
    latitude: coords.latitude,
    longitude: coords.longitude,
    accuracy: 25,
  });
};
