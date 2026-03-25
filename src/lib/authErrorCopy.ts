import { STRINGS } from "../i18n/it";
import type {
  LoginErrorCode,
  PasswordResetRequestErrorCode,
  PasswordUpdateErrorCode,
  RegisterErrorCode,
} from "./authErrorMapping";

type AppSessionErrorCode =
  | "missing_config"
  | "unauthorized"
  | "network"
  | "unknown";

export const getRegisterErrorMessage = (code: RegisterErrorCode): string => {
  switch (code) {
    case "missing_config":
      return STRINGS.account.createMissingConfig;
    case "email_exists":
      return STRINGS.account.emailAlreadyRegistered;
    case "weak_password":
      return STRINGS.account.weakPassword;
    case "invalid_email":
      return STRINGS.account.invalidEmail;
    case "email_send_failed":
      return STRINGS.account.emailDeliveryFailed;
    case "rate_limited":
      return STRINGS.account.emailRateLimited;
    case "network":
      return STRINGS.account.createNetworkFailed;
    case "unknown":
      return STRINGS.account.createFailed;
  }
};

export const getLoginErrorMessage = (code: LoginErrorCode): string => {
  switch (code) {
    case "missing_config":
      return STRINGS.account.createMissingConfig;
    case "invalid_credentials":
      return STRINGS.account.invalidCredentials;
    case "email_not_confirmed":
      return STRINGS.account.emailConfirmationRequired;
    case "rate_limited":
      return STRINGS.account.loginRateLimited;
    case "network":
      return STRINGS.account.loginNetworkFailed;
    case "unknown":
      return STRINGS.account.loginFailed;
  }
};

export const getForgotPasswordErrorMessage = (
  code: PasswordResetRequestErrorCode,
): string => {
  switch (code) {
    case "missing_config":
      return STRINGS.account.createMissingConfig;
    case "invalid_email":
      return STRINGS.account.invalidEmail;
    case "email_send_failed":
      return STRINGS.account.emailDeliveryFailed;
    case "rate_limited":
      return STRINGS.account.emailRateLimited;
    case "network":
      return STRINGS.account.resetPasswordRequestNetworkFailed;
    case "unknown":
      return STRINGS.account.resetPasswordRequestFailed;
  }
};

export const getResetPasswordErrorMessage = (
  code: PasswordUpdateErrorCode,
): string => {
  switch (code) {
    case "missing_config":
      return STRINGS.account.createMissingConfig;
    case "unauthorized":
      return STRINGS.account.resetPasswordInvalidLink;
    case "weak_password":
      return STRINGS.account.weakPassword;
    case "rate_limited":
      return STRINGS.account.resetPasswordRateLimited;
    case "network":
      return STRINGS.account.resetPasswordNetworkFailed;
    case "unknown":
      return STRINGS.account.resetPasswordFailed;
  }
};

export const getAppSessionErrorMessage = (code: AppSessionErrorCode): string => {
  switch (code) {
    case "missing_config":
      return STRINGS.account.appAccessSessionMissingConfig;
    case "unauthorized":
      return STRINGS.account.appAccessSessionUnauthorized;
    case "network":
      return STRINGS.account.appAccessSessionNetworkFailed;
    case "unknown":
      return STRINGS.account.appAccessSessionFailed;
  }
};
