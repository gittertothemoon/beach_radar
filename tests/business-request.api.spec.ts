import { expect, test } from "@playwright/test";

const BUSINESS_REQUEST_ENDPOINT = "/api/business-request";
const TEST_MODE_HEADERS = {
  "x-w2b-test-mode": "1",
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const readJson = async (response: APIResponse): Promise<Record<string, unknown> | null> => {
  try {
    const payload: unknown = await response.json();
    return isRecord(payload) ? payload : null;
  } catch {
    return null;
  }
};

const buildPayload = (suffix: string, overrides: Partial<Record<string, unknown>> = {}) => ({
  businessType: "stabilimento",
  companyName: `Bagni QA ${suffix}`,
  contactName: "Mario Rossi",
  role: "Titolare",
  email: `qa.business.${suffix}@example.org`,
  phone: "+39 333 0000000",
  city: "Rimini",
  message: "Vorrei info su partnership e lead locali.",
  lang: "it",
  hp: "",
  utm: {
    utm_source: "test",
    utm_medium: "playwright",
    utm_campaign: "business_request_api",
  },
  attribution: {
    src: "test_suite",
  },
  ...overrides,
});

test.describe("business request api", () => {
  test("PUT returns method_not_allowed", async ({ request }) => {
    const response = await request.put(BUSINESS_REQUEST_ENDPOINT, { data: {} });
    const body = await readJson(response);
    expect(response.status()).toBe(405);
    expect(body).toMatchObject({ ok: false, error: "method_not_allowed" });
    expect(response.headers()["allow"]).toContain("POST");
  });

  test("invalid payload returns 400", async ({ request }) => {
    const response = await request.post(BUSINESS_REQUEST_ENDPOINT, {
      headers: TEST_MODE_HEADERS,
      data: {
        businessType: "stabilimento",
        email: "not-an-email",
      },
    });
    const body = await readJson(response);
    if (response.status() === 500 && body?.error === "missing_env") {
      test.skip(true, "Supabase env non configurato.");
      return;
    }
    expect(response.status()).toBe(400);
    expect(body?.ok).toBe(false);
    expect(typeof body?.error).toBe("string");
  });

  test("honeypot request is accepted with spam-safe response", async ({ request }) => {
    const suffix = `${Date.now()}`;
    const response = await request.post(BUSINESS_REQUEST_ENDPOINT, {
      headers: TEST_MODE_HEADERS,
      data: buildPayload(suffix, {
        hp: "bot-filled-field",
      }),
    });
    const body = await readJson(response);
    if (response.status() === 500 && body?.error === "missing_env") {
      test.skip(true, "Supabase env non configurato.");
      return;
    }
    expect(response.status()).toBe(200);
    expect(body).toMatchObject({ ok: true, already: false, notified: false });
  });

  test("valid request then duplicate returns already=true", async ({ request }) => {
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const payload = buildPayload(suffix);

    const first = await request.post(BUSINESS_REQUEST_ENDPOINT, {
      headers: TEST_MODE_HEADERS,
      data: payload,
    });
    const firstBody = await readJson(first);
    if (first.status() === 500 && firstBody?.error === "missing_env") {
      test.skip(true, "Supabase env non configurato.");
      return;
    }
    expect(first.status()).toBe(200);
    expect(firstBody?.ok).toBe(true);
    expect(firstBody?.already).toBe(false);
    expect(typeof firstBody?.notified).toBe("boolean");

    const second = await request.post(BUSINESS_REQUEST_ENDPOINT, {
      headers: TEST_MODE_HEADERS,
      data: payload,
    });
    const secondBody = await readJson(second);
    expect(second.status()).toBe(200);
    expect(secondBody).toMatchObject({ ok: true, already: true });
    expect(typeof secondBody?.notified).toBe("boolean");
  });

  test("rate limit returns 429 + retry_after", async ({ request }) => {
    const ua = `where2beach-business-rate-test-${Date.now()}`;
    const headers = {
      ...TEST_MODE_HEADERS,
      "user-agent": ua,
      "x-w2b-test-rate-max": "1",
    };

    const first = await request.post(BUSINESS_REQUEST_ENDPOINT, {
      headers,
      data: buildPayload(`${Date.now()}_first`, {
        companyName: "Bagni Limiter First",
        email: `qa.rate.${Date.now()}_first@example.org`,
      }),
    });
    const firstBody = await readJson(first);
    if (first.status() === 500 && firstBody?.error === "missing_env") {
      test.skip(true, "Supabase env non configurato.");
      return;
    }
    expect(first.status()).toBe(200);

    const second = await request.post(BUSINESS_REQUEST_ENDPOINT, {
      headers,
      data: buildPayload(`${Date.now()}_second`, {
        companyName: "Bagni Limiter Second",
        email: `qa.rate.${Date.now()}_second@example.org`,
      }),
    });
    const secondBody = await readJson(second);
    expect(second.status()).toBe(429);
    expect(secondBody).toMatchObject({ ok: false, error: "rate_limited" });
    expect(typeof secondBody?.retry_after).toBe("number");
    expect(second.headers()["retry-after"]).toBeTruthy();
  });
});
