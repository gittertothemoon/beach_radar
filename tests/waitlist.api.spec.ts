import { test, expect } from "@playwright/test";

const WAITLIST_ENDPOINT = "/api/waitlist";

function uniqueEmail() {
  return `wl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}@example.com`;
}

function buildPayload(email: string) {
  return {
    email,
    lang: "it",
    ts: new Date().toISOString(),
    project: "beach_radar",
    version: "waitlist_v1",
    page: "http://example.test/waitlist",
    referrer: "",
    tz: "UTC",
    device: {
      w: 1200,
      h: 800,
      dpr: 1,
      ua: "Playwright"
    },
    utm: {
      utm_source: "poster",
      utm_medium: "qr",
      utm_campaign: "pilot_rimini_v1"
    },
    attribution: {
      poster: "v1",
      city: "rimini"
    }
  };
}

test("GET /api/waitlist returns method_not_allowed", async ({ request }) => {
  const response = await request.get(WAITLIST_ENDPOINT);
  expect(response.status()).toBe(405);
  const body = await response.json();
  expect(body).toMatchObject({ ok: false, error: "method_not_allowed" });
});

test("POST invalid email returns error", async ({ request }) => {
  const response = await request.post(WAITLIST_ENDPOINT, {
    data: buildPayload("not-an-email")
  });
  expect(response.status()).toBe(400);
  const body = await response.json();
  expect(body).toMatchObject({ ok: false, error: "invalid_email" });
});

test("POST valid email returns ok", async ({ request }) => {
  const email = uniqueEmail();
  const response = await request.post(WAITLIST_ENDPOINT, {
    data: buildPayload(email)
  });
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.ok).toBe(true);
});

test("POST same email returns already true", async ({ request }) => {
  const email = uniqueEmail();
  const first = await request.post(WAITLIST_ENDPOINT, {
    data: buildPayload(email)
  });
  expect(first.status()).toBe(200);
  const firstBody = await first.json();
  expect(firstBody.ok).toBe(true);

  const second = await request.post(WAITLIST_ENDPOINT, {
    data: buildPayload(email)
  });
  expect(second.status()).toBe(200);
  const secondBody = await second.json();
  expect(secondBody.ok).toBe(true);
  expect(secondBody.already).toBe(true);
});

test("POST with honeypot returns spam true", async ({ request }) => {
  const email = uniqueEmail();
  const response = await request.post(WAITLIST_ENDPOINT, {
    data: {
      ...buildPayload(email),
      hp: "filled"
    }
  });
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body).toMatchObject({ ok: true, spam: true });
});
