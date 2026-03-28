import { expect, test, type Page } from "@playwright/test";
import { grantAppAccess, mockAnalyticsApi, withQuery } from "./helpers/app";

const SUPABASE_AUTH_SIGNUP = "**/auth/v1/signup**";
const SUPABASE_AUTH_TOKEN = "**/auth/v1/token**";
const SUPABASE_AUTH_RECOVER = "**/auth/v1/recover**";
const APP_SESSION_API = "**/api/app-session";

type AuthErrorPayload = {
  status: number;
  message: string;
  errorCode?: string;
};

const mockAuthError = async (
  page: Page,
  urlPattern: string,
  payload: AuthErrorPayload,
) => {
  await page.route(urlPattern, async (route) => {
    await route.fulfill({
      status: payload.status,
      contentType: "application/json",
      body: JSON.stringify({
        code: payload.status,
        error_code: payload.errorCode ?? null,
        error: payload.message,
        error_description: payload.message,
        msg: payload.message,
      }),
    });
  });
};

const mockAuthNetworkFailure = async (page: Page, urlPattern: string) => {
  await page.route(urlPattern, async (route) => {
    await route.abort("failed");
  });
};

const buildAuthUser = (email: string) => {
  const nowIso = new Date().toISOString();
  const userId = "00000000-0000-4000-8000-000000000001";
  return {
    id: userId,
    aud: "authenticated",
    role: "authenticated",
    email,
    email_confirmed_at: nowIso,
    phone: "",
    confirmed_at: nowIso,
    last_sign_in_at: nowIso,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { first_name: "Mario", last_name: "Rossi", nickname: "mario.rossi" },
    identities: [
      {
        identity_id: "00000000-0000-4000-8000-000000000010",
        id: userId,
        user_id: userId,
        identity_data: { email },
        provider: "email",
        last_sign_in_at: nowIso,
        created_at: nowIso,
        updated_at: nowIso,
      },
    ],
    created_at: nowIso,
    updated_at: nowIso,
  };
};

const mockAuthLoginSuccess = async (page: Page, email: string) => {
  const user = buildAuthUser(email);
  const nowSec = Math.floor(Date.now() / 1000);
  await page.route(SUPABASE_AUTH_TOKEN, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        access_token: "fake.access.token",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: nowSec + 3600,
        refresh_token: "fake.refresh.token",
        user,
      }),
    });
  });
};

const fillRegisterForm = async (page: Page) => {
  await page.getByPlaceholder(/^Nome$/).fill("Mario");
  await page.getByPlaceholder(/^Cognome$/).fill("Rossi");
  await page.getByPlaceholder("es. onda_93").fill("mario.rossi");
  await page.getByTestId("auth-email-input").fill("mario.rossi@mailinator.com");
  await page.getByTestId("auth-password-input").fill("Password!123");
  await page.getByPlaceholder("Ripeti la password").fill("Password!123");
  await page
    .getByRole("checkbox", { name: /accetto.*(privacy|cookie)/i })
    .check();
};

const mockMaskedExistingSignup = async (page: Page, email: string) => {
  const nowIso = new Date().toISOString();
  await page.route(SUPABASE_AUTH_SIGNUP, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        user: {
          id: "00000000-0000-4000-8000-000000000099",
          aud: "authenticated",
          role: "authenticated",
          email,
          identities: [],
          created_at: nowIso,
          updated_at: nowIso,
        },
        session: null,
      }),
    });
  });
};

test.describe("auth error handling ui", () => {
  test.beforeEach(async ({ page }) => {
    await grantAppAccess(page.context());
    await mockAnalyticsApi(page);
  });

  test("register shows clear message for email already registered", async ({ page }) => {
    await mockAuthError(page, SUPABASE_AUTH_SIGNUP, {
      status: 400,
      message: "User already registered",
    });
    await page.goto(withQuery("/app/register", { returnTo: "/app/" }));
    await fillRegisterForm(page);
    await page.getByTestId("auth-submit").click();
    await expect(page.getByText("Questa email risulta già registrata.")).toBeVisible();
  });

  test("register shows clear message for nickname already used", async ({ page }) => {
    await mockAuthError(page, SUPABASE_AUTH_SIGNUP, {
      status: 400,
      message: "Nickname already in use.",
    });
    await page.goto(withQuery("/app/register", { returnTo: "/app/" }));
    await fillRegisterForm(page);
    await page.getByTestId("auth-submit").click();
    await expect(page.getByText("Questo nickname è già in uso. Scegline un altro.")).toBeVisible();
  });

  test("register handles Supabase masked-existing-user response", async ({ page }) => {
    await mockMaskedExistingSignup(page, "mario.rossi@example.com");
    await page.goto(withQuery("/app/register", { returnTo: "/app/" }));
    await fillRegisterForm(page);
    await page.getByTestId("auth-submit").click();
    await expect(page.getByText("Questa email risulta già registrata.")).toBeVisible();
  });

  test("register shows clear message for signup rate limit", async ({ page }) => {
    await mockAuthError(page, SUPABASE_AUTH_SIGNUP, {
      status: 429,
      message: "For security purposes, you can only request this after 60 seconds.",
      errorCode: "over_email_send_rate_limit",
    });
    await page.goto(withQuery("/app/register", { returnTo: "/app/" }));
    await fillRegisterForm(page);
    await page.getByTestId("auth-submit").click();
    await expect(page.getByText("Hai fatto troppi tentativi in poco tempo. Aspetta qualche minuto e riprova.")).toBeVisible();
  });

  test("register shows clear message for email delivery failure", async ({ page }) => {
    await mockAuthError(page, SUPABASE_AUTH_SIGNUP, {
      status: 500,
      message: "Error sending confirmation email",
    });
    await page.goto(withQuery("/app/register", { returnTo: "/app/" }));
    await fillRegisterForm(page);
    await page.getByTestId("auth-submit").click();
    await expect(page.getByText("Non riesco a inviare l'email di conferma in questo momento. Riprova tra poco.")).toBeVisible();
  });

  test("register shows clear message for network error", async ({ page }) => {
    await mockAuthNetworkFailure(page, SUPABASE_AUTH_SIGNUP);
    await page.goto(withQuery("/app/register", { returnTo: "/app/" }));
    await fillRegisterForm(page);
    await page.getByTestId("auth-submit").click();
    await expect(page.getByText("Connessione assente o instabile. Verifica la rete e riprova la registrazione.")).toBeVisible();
  });

  test("login shows clear message for invalid credentials", async ({ page }) => {
    await mockAuthError(page, SUPABASE_AUTH_TOKEN, {
      status: 400,
      message: "Invalid login credentials",
    });
    await page.goto(withQuery("/app/register", { mode: "login", returnTo: "/app/" }));
    await page.getByTestId("auth-email-input").fill("mario.rossi@example.com");
    await page.getByTestId("auth-password-input").fill("Password!123");
    await page.getByTestId("auth-submit").click();
    await expect(page.getByText("Email o password non corrette. Ricontrolla e riprova.")).toBeVisible();
  });

  test("login shows clear message for email-not-confirmed", async ({ page }) => {
    await mockAuthError(page, SUPABASE_AUTH_TOKEN, {
      status: 400,
      message: "Email not confirmed",
    });
    await page.goto(withQuery("/app/register", { mode: "login", returnTo: "/app/" }));
    await page.getByTestId("auth-email-input").fill("mario.rossi@example.com");
    await page.getByTestId("auth-password-input").fill("Password!123");
    await page.getByTestId("auth-submit").click();
    await expect(page.getByText("Controlla la mail e conferma il tuo account. Poi torna qui e accedi. Se non la trovi, guarda anche in Spam.")).toBeVisible();
  });

  test("login shows clear message for login rate limit", async ({ page }) => {
    await mockAuthError(page, SUPABASE_AUTH_TOKEN, {
      status: 429,
      message: "Too many requests",
      errorCode: "over_request_rate_limit",
    });
    await page.goto(withQuery("/app/register", { mode: "login", returnTo: "/app/" }));
    await page.getByTestId("auth-email-input").fill("mario.rossi@example.com");
    await page.getByTestId("auth-password-input").fill("Password!123");
    await page.getByTestId("auth-submit").click();
    await expect(page.getByText("Hai fatto troppi tentativi di accesso. Aspetta qualche minuto prima di riprovare.")).toBeVisible();
  });

  test("login shows clear message for network error", async ({ page }) => {
    await mockAuthNetworkFailure(page, SUPABASE_AUTH_TOKEN);
    await page.goto(withQuery("/app/register", { mode: "login", returnTo: "/app/" }));
    await page.getByTestId("auth-email-input").fill("mario.rossi@example.com");
    await page.getByTestId("auth-password-input").fill("Password!123");
    await page.getByTestId("auth-submit").click();
    await expect(page.getByText("Connessione assente o instabile. Verifica la rete e riprova l'accesso.")).toBeVisible();
  });

  test("forgot password shows clear message for rate limit", async ({ page }) => {
    await mockAuthError(page, SUPABASE_AUTH_RECOVER, {
      status: 429,
      message: "For security purposes, you can only request this after 60 seconds.",
    });
    await page.goto(withQuery("/app/register", { mode: "forgot", returnTo: "/app/" }));
    await page.getByTestId("auth-email-input").fill("mario.rossi@example.com");
    await page.getByTestId("auth-submit").click();
    await expect(page.getByText("Hai fatto troppi tentativi in poco tempo. Aspetta qualche minuto e riprova.")).toBeVisible();
  });

  test("forgot password shows clear message for email delivery failure", async ({ page }) => {
    await mockAuthError(page, SUPABASE_AUTH_RECOVER, {
      status: 500,
      message: "Error sending recovery email",
    });
    await page.goto(withQuery("/app/register", { mode: "forgot", returnTo: "/app/" }));
    await page.getByTestId("auth-email-input").fill("mario.rossi@example.com");
    await page.getByTestId("auth-submit").click();
    await expect(page.getByText("Non riesco a inviare l'email di conferma in questo momento. Riprova tra poco.")).toBeVisible();
  });

  test("forgot password shows clear message for network error", async ({ page }) => {
    await mockAuthNetworkFailure(page, SUPABASE_AUTH_RECOVER);
    await page.goto(withQuery("/app/register", { mode: "forgot", returnTo: "/app/" }));
    await page.getByTestId("auth-email-input").fill("mario.rossi@example.com");
    await page.getByTestId("auth-submit").click();
    await expect(page.getByText("Connessione assente o instabile. Verifica la rete e riprova l'invio del link.")).toBeVisible();
  });

  test("reset password without valid session shows invalid-link message", async ({ page }) => {
    await page.goto(withQuery("/app/register", { mode: "reset", returnTo: "/app/" }));
    await page.getByTestId("auth-password-input").fill("Password!123");
    await page.getByPlaceholder("Ripeti la password").fill("Password!123");
    await page.getByTestId("auth-submit").click();
    await expect(page.getByText("Questo link non è valido o è scaduto. Richiedi un nuovo link di reset.")).toBeVisible();
  });

  test("login success + app-session unauthorized shows clear session-expired message", async ({ page }) => {
    await mockAuthLoginSuccess(page, "mario.rossi@example.com");
    await page.route(APP_SESSION_API, async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ ok: false, error: "unauthorized" }),
      });
    });

    await page.goto(withQuery("/app/register", { mode: "login", returnTo: "/app/" }));
    await page.getByTestId("auth-email-input").fill("mario.rossi@example.com");
    await page.getByTestId("auth-password-input").fill("Password!123");
    await page.getByTestId("auth-submit").click();
    await expect(page.getByText("Sessione non valida o scaduta. Accedi di nuovo per continuare.")).toBeVisible();
  });

  test("login success + app-session network failure still opens app via fallback", async ({ page }) => {
    await mockAuthLoginSuccess(page, "mario.rossi@example.com");
    await page.route(APP_SESSION_API, async (route) => {
      await route.abort("failed");
    });

    await page.goto(withQuery("/app/register", { mode: "login", returnTo: "/app/" }));
    await page.getByTestId("auth-email-input").fill("mario.rossi@example.com");
    await page.getByTestId("auth-password-input").fill("Password!123");
    await page.getByTestId("auth-submit").click();
    await expect(page.getByTestId("app-root")).toBeVisible();
  });
});
