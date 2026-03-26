import { expect, test } from "@playwright/test";

type MockResponse = {
  statusCode: number;
  headers: Record<string, string>;
  body: unknown;
  setHeader: (key: string, value: string) => void;
  status: (code: number) => { json: (payload: unknown) => MockResponse };
  json: (payload: unknown) => MockResponse;
};

const createMockResponse = (): MockResponse => {
  const response: MockResponse = {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(key, value) {
      response.headers[key.toLowerCase()] = value;
    },
    status(code) {
      response.statusCode = code;
      return {
        json(payload) {
          response.body = payload;
          return response;
        },
      };
    },
    json(payload) {
      response.body = payload;
      return response;
    },
  };
  return response;
};

test.describe("beach enrich handlers", () => {
  test("run handler enforces authorization", async () => {
    process.env.BEACH_ENRICH_TEST_MODE = "1";
    process.env.CRON_SECRET = "test-cron-secret";

    const { default: runHandler } = await import("../api/_handlers/beach-enrich-run");
    const req = {
      method: "GET",
      headers: {},
      query: {},
    } as unknown;
    const res = createMockResponse();

    await runHandler(req as never, res as never);

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ ok: false, error: "unauthorized" });
  });

  test("run handler processes batch in test mode and profile handler reads it", async () => {
    process.env.BEACH_ENRICH_TEST_MODE = "1";
    process.env.CRON_SECRET = "test-cron-secret";

    const { default: runHandler } = await import("../api/_handlers/beach-enrich-run");
    const { default: profileHandler } = await import("../api/_handlers/beach-profile");

    const runReq = {
      method: "GET",
      headers: {
        authorization: "Bearer test-cron-secret",
      },
      query: {},
    } as unknown;
    const runRes = createMockResponse();

    await runHandler(runReq as never, runRes as never);

    expect(runRes.statusCode).toBe(200);
    expect(runRes.body).toMatchObject({ ok: true, mode: "test" });

    const profileReq = {
      method: "GET",
      headers: {},
      query: { beachId: "BR-RN-001" },
    } as unknown;
    const profileRes = createMockResponse();

    await profileHandler(profileReq as never, profileRes as never);

    expect(profileRes.statusCode).toBe(200);
    expect(profileRes.body).toMatchObject({ ok: true });
    const payload = profileRes.body as { profile?: { beachId?: string } | null };
    if (payload.profile) {
      expect(payload.profile.beachId).toBe("BR-RN-001");
    }
  });
});
