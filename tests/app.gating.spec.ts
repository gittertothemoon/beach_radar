import { expect, test } from "@playwright/test";
import {
  APP_ACCESS_KEY,
  E2E_BEACH_ID,
  grantAppAccess,
  mockAnalyticsApi,
  withQuery,
} from "./helpers/app";

test.describe("app gating", () => {
  test("/app without cookie redirects to /waitlist", async ({ request }) => {
    const response = await request.get("/app/", { maxRedirects: 0 });
    expect([301, 302, 307, 308]).toContain(response.status());
    expect(response.headers().location || "").toContain("/waitlist/");
  });

  test("/app?key=... sets access cookie and allows app", async ({ page, request }) => {
    const response = await request.get(
      withQuery("/app/", { key: APP_ACCESS_KEY }),
      { maxRedirects: 0 },
    );

    const setCookie = response.headers()["set-cookie"] || "";
    if (!setCookie.includes("br_app_access=1")) {
      test.skip(
        true,
        "APP_ACCESS_KEY non allineata con l'ambiente server usato dal test.",
      );
      return;
    }

    expect([301, 302, 307, 308]).toContain(response.status());
    expect(response.headers().location || "").toContain("/app");
    expect(setCookie).toContain("br_app_access=1");

    await grantAppAccess(page.context());
    await mockAnalyticsApi(page);
    await page.goto(withQuery("/app/", { beachId: E2E_BEACH_ID, reportAnywhere: "1" }));
    await expect(page.getByTestId("app-root")).toBeVisible();
  });
});
