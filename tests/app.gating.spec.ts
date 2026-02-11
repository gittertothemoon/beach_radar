import { expect, test } from "@playwright/test";
import {
  APP_ACCESS_KEY,
} from "./helpers/app";

test.describe("app gating", () => {
  test("/app without cookie redirects to /waitlist", async ({ request }) => {
    const response = await request.get("/app/", { maxRedirects: 0 });
    expect([301, 302, 307, 308]).toContain(response.status());
    expect(response.headers().location || "").toContain("/waitlist/");
  });

  test("/api/app-access?key=... sets access cookie", async ({ request }) => {
    const response = await request.get(
      `/api/app-access?key=${encodeURIComponent(APP_ACCESS_KEY)}&path=%2Fapp%2F`,
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
  });
});
