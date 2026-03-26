export type RegisterErrorCode =
  | "missing_config"
  | "email_exists"
  | "nickname_exists"
  | "weak_password"
  | "invalid_email"
  | "email_send_failed"
  | "rate_limited"
  | "network"
  | "unknown";

export type LoginErrorCode =
  | "missing_config"
  | "invalid_credentials"
  | "email_not_confirmed"
  | "rate_limited"
  | "network"
  | "unknown";

export type PasswordResetRequestErrorCode =
  | "missing_config"
  | "invalid_email"
  | "email_send_failed"
  | "rate_limited"
  | "network"
  | "unknown";

export type PasswordUpdateErrorCode =
  | "missing_config"
  | "unauthorized"
  | "weak_password"
  | "rate_limited"
  | "network"
  | "unknown";

type SupabaseAuthErrorInput = {
  message?: string;
  status?: number;
  code?: string | null;
};

const normalize = (value: string | undefined): string => (value ?? "").toLowerCase();

const isRateLimited = (input: SupabaseAuthErrorInput): boolean => {
  const normalizedCode = normalize(input.code ?? undefined);
  const normalizedMessage = normalize(input.message);
  return (
    input.status === 429 ||
    normalizedCode.includes("rate_limit") ||
    normalizedCode.includes("too_many") ||
    normalizedMessage.includes("rate limit") ||
    normalizedMessage.includes("too many requests") ||
    normalizedMessage.includes("security purposes")
  );
};

const isNetworkError = (message: string | undefined): boolean => {
  const normalized = normalize(message);
  return (
    normalized.includes("network") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("fetch failed") ||
    normalized.includes("network request failed")
  );
};

export const mapRegisterErrorFromSupabase = (
  input: SupabaseAuthErrorInput,
): RegisterErrorCode => {
  const normalized = normalize(input.message);
  if (
    normalized.includes("already registered") ||
    normalized.includes("already been registered")
  ) {
    return "email_exists";
  }
  if (
    normalized.includes("nickname already in use") ||
    normalized.includes("nickname already taken") ||
    (normalized.includes("duplicate") && normalized.includes("nickname"))
  ) {
    return "nickname_exists";
  }
  if (
    normalized.includes("error sending confirmation email") ||
    normalized.includes("confirmation email")
  ) {
    return "email_send_failed";
  }
  if (isRateLimited(input)) return "rate_limited";
  if (normalized.includes("password")) return "weak_password";
  if (normalized.includes("email")) return "invalid_email";
  if (isNetworkError(input.message)) return "network";
  return "unknown";
};

export const mapLoginErrorFromSupabase = (
  input: SupabaseAuthErrorInput,
): LoginErrorCode => {
  const normalized = normalize(input.message);
  if (normalized.includes("invalid login credentials")) {
    return "invalid_credentials";
  }
  if (normalized.includes("email not confirmed")) {
    return "email_not_confirmed";
  }
  if (isRateLimited(input)) return "rate_limited";
  if (isNetworkError(input.message)) return "network";
  return "unknown";
};

export const mapPasswordResetRequestErrorFromSupabase = (
  input: SupabaseAuthErrorInput,
): PasswordResetRequestErrorCode => {
  const normalized = normalize(input.message);
  if (
    normalized.includes("error sending") &&
    (normalized.includes("email") || normalized.includes("otp"))
  ) {
    return "email_send_failed";
  }
  if (isRateLimited(input)) return "rate_limited";
  if (normalized.includes("email")) return "invalid_email";
  if (isNetworkError(input.message)) return "network";
  return "unknown";
};

export const mapPasswordUpdateErrorFromSupabase = (
  input: SupabaseAuthErrorInput,
): PasswordUpdateErrorCode => {
  const normalized = normalize(input.message);
  if (
    normalized.includes("auth session missing") ||
    normalized.includes("invalid token") ||
    normalized.includes("jwt") ||
    normalized.includes("token has expired")
  ) {
    return "unauthorized";
  }
  if (isRateLimited(input)) return "rate_limited";
  if (normalized.includes("password")) return "weak_password";
  if (isNetworkError(input.message)) return "network";
  return "unknown";
};

export const isMaskedExistingUserSignUp = (data: {
  user?: { identities?: unknown[] | null } | null;
  session?: unknown | null;
}): boolean =>
  Array.isArray(data.user?.identities) &&
  data.user.identities.length === 0 &&
  !data.session;
