import { expect, test } from "@playwright/test";
import {
  isMaskedExistingUserSignUp,
  mapLoginErrorFromSupabase,
  mapPasswordResetRequestErrorFromSupabase,
  mapPasswordUpdateErrorFromSupabase,
  mapRegisterErrorFromSupabase,
} from "../src/lib/authErrorMapping";
import {
  getAppSessionErrorMessage,
  getForgotPasswordErrorMessage,
  getLoginErrorMessage,
  getRegisterErrorMessage,
  getResetPasswordErrorMessage,
} from "../src/lib/authErrorCopy";
import { STRINGS } from "../src/i18n/it";

test.describe("auth error mapping", () => {
  test("maps register errors from Supabase payload", async () => {
    expect(
      mapRegisterErrorFromSupabase({
        message: "User already registered",
      }),
    ).toBe("email_exists");

    expect(
      mapRegisterErrorFromSupabase({
        message: "Nickname already in use.",
      }),
    ).toBe("nickname_exists");

    expect(
      mapRegisterErrorFromSupabase({
        message: "Error sending confirmation email",
      }),
    ).toBe("email_send_failed");

    expect(
      mapRegisterErrorFromSupabase({
        status: 429,
        message: "For security purposes, you can only request this later.",
      }),
    ).toBe("rate_limited");

    expect(
      mapRegisterErrorFromSupabase({
        code: "over_email_send_rate_limit",
        message: "Too many requests",
      }),
    ).toBe("rate_limited");

    expect(
      mapRegisterErrorFromSupabase({
        message: "Password should contain uppercase characters",
      }),
    ).toBe("weak_password");

    expect(
      mapRegisterErrorFromSupabase({
        message: "Unable to validate email address",
      }),
    ).toBe("invalid_email");

    expect(
      mapRegisterErrorFromSupabase({
        message: "TypeError: Failed to fetch",
      }),
    ).toBe("network");
  });

  test("maps login errors from Supabase payload", async () => {
    expect(
      mapLoginErrorFromSupabase({
        message: "Invalid login credentials",
      }),
    ).toBe("invalid_credentials");

    expect(
      mapLoginErrorFromSupabase({
        message: "Email not confirmed",
      }),
    ).toBe("email_not_confirmed");

    expect(
      mapLoginErrorFromSupabase({
        status: 429,
        message: "Too many requests",
      }),
    ).toBe("rate_limited");

    expect(
      mapLoginErrorFromSupabase({
        message: "Network request failed",
      }),
    ).toBe("network");
  });

  test("maps forgot-password errors from Supabase payload", async () => {
    expect(
      mapPasswordResetRequestErrorFromSupabase({
        message: "Error sending recovery email",
      }),
    ).toBe("email_send_failed");

    expect(
      mapPasswordResetRequestErrorFromSupabase({
        status: 429,
        message: "For security purposes",
      }),
    ).toBe("rate_limited");

    expect(
      mapPasswordResetRequestErrorFromSupabase({
        message: "Email address is invalid",
      }),
    ).toBe("invalid_email");

    expect(
      mapPasswordResetRequestErrorFromSupabase({
        message: "Failed to fetch",
      }),
    ).toBe("network");
  });

  test("maps password update errors from Supabase payload", async () => {
    expect(
      mapPasswordUpdateErrorFromSupabase({
        message: "Auth session missing",
      }),
    ).toBe("unauthorized");

    expect(
      mapPasswordUpdateErrorFromSupabase({
        status: 429,
        message: "Too many requests",
      }),
    ).toBe("rate_limited");

    expect(
      mapPasswordUpdateErrorFromSupabase({
        message: "Password should be at least 8 chars",
      }),
    ).toBe("weak_password");

    expect(
      mapPasswordUpdateErrorFromSupabase({
        message: "Network request failed",
      }),
    ).toBe("network");
  });

  test("detects masked existing-user sign-up payload", async () => {
    expect(
      isMaskedExistingUserSignUp({
        user: { identities: [] },
        session: null,
      }),
    ).toBeTruthy();

    expect(
      isMaskedExistingUserSignUp({
        user: { identities: [{ id: "identity-1" }] },
        session: null,
      }),
    ).toBeFalsy();
  });
});

test.describe("auth error copy", () => {
  test("returns clear register copy for every error code", async () => {
    expect(getRegisterErrorMessage("missing_config")).toBe(STRINGS.account.createMissingConfig);
    expect(getRegisterErrorMessage("email_exists")).toBe(STRINGS.account.emailAlreadyRegistered);
    expect(getRegisterErrorMessage("nickname_exists")).toBe(STRINGS.account.nicknameAlreadyInUse);
    expect(getRegisterErrorMessage("weak_password")).toBe(STRINGS.account.weakPassword);
    expect(getRegisterErrorMessage("invalid_email")).toBe(STRINGS.account.invalidEmail);
    expect(getRegisterErrorMessage("email_send_failed")).toBe(STRINGS.account.emailDeliveryFailed);
    expect(getRegisterErrorMessage("rate_limited")).toBe(STRINGS.account.emailRateLimited);
    expect(getRegisterErrorMessage("network")).toBe(STRINGS.account.createNetworkFailed);
    expect(getRegisterErrorMessage("unknown")).toBe(STRINGS.account.createFailed);
  });

  test("returns clear login copy for every error code", async () => {
    expect(getLoginErrorMessage("missing_config")).toBe(STRINGS.account.createMissingConfig);
    expect(getLoginErrorMessage("invalid_credentials")).toBe(STRINGS.account.invalidCredentials);
    expect(getLoginErrorMessage("email_not_confirmed")).toBe(STRINGS.account.emailConfirmationRequired);
    expect(getLoginErrorMessage("rate_limited")).toBe(STRINGS.account.loginRateLimited);
    expect(getLoginErrorMessage("network")).toBe(STRINGS.account.loginNetworkFailed);
    expect(getLoginErrorMessage("unknown")).toBe(STRINGS.account.loginFailed);
  });

  test("returns clear forgot-password copy for every error code", async () => {
    expect(getForgotPasswordErrorMessage("missing_config")).toBe(STRINGS.account.createMissingConfig);
    expect(getForgotPasswordErrorMessage("invalid_email")).toBe(STRINGS.account.invalidEmail);
    expect(getForgotPasswordErrorMessage("email_send_failed")).toBe(STRINGS.account.emailDeliveryFailed);
    expect(getForgotPasswordErrorMessage("rate_limited")).toBe(STRINGS.account.emailRateLimited);
    expect(getForgotPasswordErrorMessage("network")).toBe(
      STRINGS.account.resetPasswordRequestNetworkFailed,
    );
    expect(getForgotPasswordErrorMessage("unknown")).toBe(STRINGS.account.resetPasswordRequestFailed);
  });

  test("returns clear reset-password copy for every error code", async () => {
    expect(getResetPasswordErrorMessage("missing_config")).toBe(STRINGS.account.createMissingConfig);
    expect(getResetPasswordErrorMessage("unauthorized")).toBe(STRINGS.account.resetPasswordInvalidLink);
    expect(getResetPasswordErrorMessage("weak_password")).toBe(STRINGS.account.weakPassword);
    expect(getResetPasswordErrorMessage("rate_limited")).toBe(STRINGS.account.resetPasswordRateLimited);
    expect(getResetPasswordErrorMessage("network")).toBe(STRINGS.account.resetPasswordNetworkFailed);
    expect(getResetPasswordErrorMessage("unknown")).toBe(STRINGS.account.resetPasswordFailed);
  });

  test("returns clear app-session copy for every error code", async () => {
    expect(getAppSessionErrorMessage("missing_config")).toBe(STRINGS.account.appAccessSessionMissingConfig);
    expect(getAppSessionErrorMessage("unauthorized")).toBe(STRINGS.account.appAccessSessionUnauthorized);
    expect(getAppSessionErrorMessage("network")).toBe(STRINGS.account.appAccessSessionNetworkFailed);
    expect(getAppSessionErrorMessage("unknown")).toBe(STRINGS.account.appAccessSessionFailed);
  });
});
