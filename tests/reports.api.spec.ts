import { test, expect, type APIResponse } from "@playwright/test";

const REPORTS_ENDPOINT = "/api/reports";

function uniqueSuffix() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function buildPayload(overrides?: Partial<Record<string, unknown>>) {
  return {
    beachId: `beach_${uniqueSuffix()}`,
    crowdLevel: 2,
    reporterHash: `rep_${uniqueSuffix()}`,
    attribution: {
      v: 1,
      src: "app",
      utm_source: "test",
      utm_medium: "automation",
      utm_campaign: "reports_api",
      first_seen_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
      ignored_field: "should_be_dropped",
    },
    ...overrides,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function readJson(response: APIResponse): Promise<Record<string, unknown> | null> {
  try {
    const payload: unknown = await response.json();
    return isRecord(payload) ? payload : null;
  } catch {
    return null;
  }
}

function asReportsArray(payload: Record<string, unknown> | null): Record<string, unknown>[] {
  const reports = payload?.reports;
  if (!Array.isArray(reports)) return [];
  return reports.filter((item): item is Record<string, unknown> => isRecord(item));
}

test.describe("reports api", () => {
  test("PUT /api/reports returns method_not_allowed", async ({ request }) => {
    const response = await request.put(REPORTS_ENDPOINT, { data: {} });
    expect(response.status()).toBe(405);
    const body = await readJson(response);
    expect(body).toMatchObject({ ok: false, error: "method_not_allowed" });
    expect(response.headers()["allow"]).toContain("GET");
    expect(response.headers()["allow"]).toContain("POST");
  });

  test("POST invalid payload returns validation error", async ({ request }) => {
    const response = await request.post(REPORTS_ENDPOINT, {
      data: buildPayload({
        crowdLevel: 9,
      }),
    });
    const body = await readJson(response);
    if (response.status() === 500 && body?.error === "missing_env") {
      test.skip(true, "REPORTS_TEST_MODE missing and Supabase env not configured.");
      return;
    }
    expect(response.status()).toBe(400);
    expect(body).toMatchObject({ ok: false, error: "invalid_crowd_level" });
  });

  test("POST valid report then GET returns that report", async ({ request }) => {
    const payload = buildPayload();
    const post = await request.post(REPORTS_ENDPOINT, { data: payload });
    const postBody = await readJson(post);
    if (post.status() === 500 && postBody?.error === "missing_env") {
      test.skip(true, "REPORTS_TEST_MODE missing and Supabase env not configured.");
      return;
    }

    expect(post.status()).toBe(200);
    expect(postBody?.ok).toBe(true);
    const created = isRecord(postBody?.report) ? postBody?.report : null;
    expect(created).not.toBeNull();
    if (!created) return;
    expect(created.beachId).toBe(payload.beachId);
    expect(created.crowdLevel).toBe(payload.crowdLevel);
    expect(typeof created.createdAt).toBe("number");
    expect(created.createdAt).toBeGreaterThan(0);

    const attribution = isRecord(created.attribution) ? created.attribution : null;
    expect(attribution).not.toBeNull();
    if (!attribution) return;
    expect(attribution.src).toBe("app");
    expect(attribution.utm_campaign).toBe("reports_api");
    expect(attribution.ignored_field).toBeUndefined();

    const get = await request.get(REPORTS_ENDPOINT);
    const getBody = await readJson(get);
    expect(get.status()).toBe(200);
    expect(getBody?.ok).toBe(true);
    const reports = asReportsArray(getBody);

    const found = reports.find((item) => item.id === created.id);
    expect(found).toBeTruthy();
    expect(found?.beachId).toBe(payload.beachId);
    expect(found?.crowdLevel).toBe(payload.crowdLevel);
  });

  test("POST duplicate report within rate window returns too_soon + retry_after", async ({
    request,
  }) => {
    const payload = buildPayload();
    const first = await request.post(REPORTS_ENDPOINT, { data: payload });
    const firstBody = await readJson(first);
    if (first.status() === 500 && firstBody?.error === "missing_env") {
      test.skip(true, "REPORTS_TEST_MODE missing and Supabase env not configured.");
      return;
    }
    expect(first.status()).toBe(200);

    const second = await request.post(REPORTS_ENDPOINT, { data: payload });
    const secondBody = await readJson(second);
    expect(second.status()).toBe(429);
    expect(secondBody).toMatchObject({ ok: false, error: "too_soon" });
    expect(typeof secondBody?.retry_after).toBe("number");
    expect((secondBody?.retry_after as number) > 0).toBe(true);
    expect(second.headers()["retry-after"]).toBeTruthy();
  });
});
