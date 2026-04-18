import type { User } from "@supabase/supabase-js";
import { PUBLIC_BASE_URL } from "../config/publicUrl";
import { clearDevMockAuth, getDevMockAccount } from "./devMockAuth";
import {
  isMaskedExistingUserSignUp,
  mapLoginErrorFromSupabase,
  mapPasswordResetRequestErrorFromSupabase,
  mapPasswordUpdateErrorFromSupabase,
  mapRegisterErrorFromSupabase,
  type LoginErrorCode,
  type PasswordResetRequestErrorCode,
  type PasswordUpdateErrorCode,
  type RegisterErrorCode,
} from "./authErrorMapping";
import { getSupabaseClient } from "./supabase";

const FAVORITES_TABLE = "user_favorites";
const AUTH_REGISTER_PATH = "/register/?mode=login";
const MOBILE_AUTH_RETURN_TO_PATH = "/app/?native_shell=1";
const MOBILE_DEEP_LINK_SCHEME = "where2beach";
const MOBILE_DEEP_LINK_HOST = "open";
const MOCK_FAVORITES_KEY = "where2beach-dev-mock-favorites-v1";

export type AppAccount = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  nickname: string;
};

export type RegisterResult =
  | { ok: true; account: AppAccount; sessionReady: boolean }
  | { ok: false; code: RegisterErrorCode };

export type LoginResult =
  | { ok: true; account: AppAccount; sessionReady: boolean }
  | { ok: false; code: LoginErrorCode };

export type PasswordResetRequestResult =
  | { ok: true }
  | { ok: false; code: PasswordResetRequestErrorCode };

export type PasswordUpdateResult =
  | { ok: true; account: AppAccount }
  | { ok: false; code: PasswordUpdateErrorCode };

type FavoriteSyncErrorCode =
  | "missing_config"
  | "unauthorized"
  | "network"
  | "unknown";

export type FavoriteSyncResult =
  | { ok: true }
  | { ok: false; code: FavoriteSyncErrorCode };

type SignOutErrorCode = "missing_config" | "network" | "unknown";

export type SignOutResult =
  | { ok: true }
  | { ok: false; code: SignOutErrorCode };

type DeleteAccountErrorCode =
  | "missing_config"
  | "unauthorized"
  | "network"
  | "unknown";

export type DeleteAccountResult =
  | { ok: true }
  | { ok: false; code: DeleteAccountErrorCode };

type AppSessionErrorCode =
  | "missing_config"
  | "unauthorized"
  | "network"
  | "unknown";

export type AppSessionResult =
  | { ok: true }
  | { ok: false; code: AppSessionErrorCode };

const readMockFavoriteBeachIds = (accountId: string): string[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(`${MOCK_FAVORITES_KEY}:${accountId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter((value) => value.length > 0);
  } catch {
    return [];
  }
};

const writeMockFavoriteBeachIds = (accountId: string, ids: string[]): void => {
  if (typeof window === "undefined") return;
  const unique = Array.from(new Set(ids));
  window.localStorage.setItem(`${MOCK_FAVORITES_KEY}:${accountId}`, JSON.stringify(unique));
};

const clearMockFavoriteBeachIds = (accountId: string): void => {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(`${MOCK_FAVORITES_KEY}:${accountId}`);
};

const buildDeleteAccountEndpoints = (): string[] => {
  const endpoints = ["/api/account/delete"];
  if (typeof window === "undefined") return endpoints;

  const normalizedCurrentOrigin = window.location.origin.replace(/\/+$/, "");
  const normalizedPublicBase = PUBLIC_BASE_URL.replace(/\/+$/, "");
  if (normalizedCurrentOrigin !== normalizedPublicBase) {
    endpoints.push(`${normalizedPublicBase}/api/account/delete`);
  }
  return endpoints;
};

const buildAppSessionEndpoints = (): string[] => {
  const endpoints = ["/api/app-session"];
  if (typeof window === "undefined") return endpoints;

  const normalizedCurrentOrigin = window.location.origin.replace(/\/+$/, "");
  const normalizedPublicBase = PUBLIC_BASE_URL.replace(/\/+$/, "");
  if (normalizedCurrentOrigin !== normalizedPublicBase) {
    endpoints.push(`${normalizedPublicBase}/api/app-session`);
  }
  return endpoints;
};

const setClientAppAccessCookie = (): void => {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 30;
  document.cookie =
    `br_app_access=1; Max-Age=${maxAge}; Path=/app; SameSite=Lax; Secure`;
};

const readBooleanParam = (value: string | null): boolean | null => {
  if (value === null) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true") return true;
  if (normalized === "0" || normalized === "false") return false;
  return null;
};

const hasNativeShellFlag = (params: URLSearchParams): boolean => {
  const direct = readBooleanParam(params.get("native_shell"));
  if (direct !== null) return direct;
  const camelCase = readBooleanParam(params.get("nativeShell"));
  return camelCase === true;
};

const buildWebAuthEmailRedirectUrl = (): string => {
  if (typeof window !== "undefined") {
    const isLocalHost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1";
    if (isLocalHost) {
      return `${window.location.origin}${AUTH_REGISTER_PATH}`;
    }
  }
  return `${PUBLIC_BASE_URL}${AUTH_REGISTER_PATH}`;
};

const buildMobileAuthEmailRedirectUrl = (): string => {
  const registerParams = new URLSearchParams();
  registerParams.set("mode", "login");
  registerParams.set("native_shell", "1");
  registerParams.set("returnTo", MOBILE_AUTH_RETURN_TO_PATH);
  const registerPath = `/register/?${registerParams.toString()}`;
  const deepLinkParams = new URLSearchParams();
  deepLinkParams.set("path", registerPath);
  return `${MOBILE_DEEP_LINK_SCHEME}://${MOBILE_DEEP_LINK_HOST}?${deepLinkParams.toString()}`;
};

const isNativeShellAuthContext = (): boolean => {
  if (typeof window === "undefined") return false;
  const currentParams = new URLSearchParams(window.location.search);
  if (hasNativeShellFlag(currentParams)) return true;

  const returnToRaw = currentParams.get("returnTo");
  if (!returnToRaw) return false;
  try {
    const returnToUrl = new URL(returnToRaw, window.location.origin);
    return hasNativeShellFlag(returnToUrl.searchParams);
  } catch {
    return false;
  }
};

const buildAuthEmailRedirectUrl = (): string => {
  if (isNativeShellAuthContext()) return buildMobileAuthEmailRedirectUrl();
  return buildWebAuthEmailRedirectUrl();
};

const isMobileDeepLinkRedirect = (redirectUrl: string): boolean =>
  redirectUrl.startsWith(`${MOBILE_DEEP_LINK_SCHEME}://`);

const isRedirectUrlRejectedBySupabase = (message: string | undefined): boolean => {
  if (!message) return false;
  const normalized = message.trim().toLowerCase();
  return normalized.includes("redirect") && normalized.includes("not allowed");
};

const readUserMetadataString = (
  user: User,
  ...keys: string[]
): string => {
  const metadata = user.user_metadata as Record<string, unknown> | null;
  if (!metadata) return "";
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return "";
};

const readNicknameAvailability = (value: unknown): boolean | null => {
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    const first = value[0];
    if (typeof first === "boolean") return first;
    if (first && typeof first === "object" && "available" in first) {
      const maybeAvailable = (first as { available?: unknown }).available;
      return typeof maybeAvailable === "boolean" ? maybeAvailable : null;
    }
    return null;
  }
  if (value && typeof value === "object" && "available" in value) {
    const maybeAvailable = (value as { available?: unknown }).available;
    return typeof maybeAvailable === "boolean" ? maybeAvailable : null;
  }
  return null;
};

const toAccount = (user: User | null): AppAccount | null => {
  if (!user?.id || !user.email) return null;
  return {
    id: user.id,
    email: user.email,
    firstName: readUserMetadataString(user, "first_name", "firstName", "given_name"),
    lastName: readUserMetadataString(user, "last_name", "lastName", "family_name"),
    nickname: readUserMetadataString(user, "nickname", "user_name", "username"),
  };
};

const mapFavoriteError = (
  code: string | undefined,
  message: string | undefined,
): FavoriteSyncErrorCode => {
  const normalized = (message ?? "").toLowerCase();
  if (
    code === "PGRST301" ||
    code === "42501" ||
    normalized.includes("jwt") ||
    normalized.includes("permission denied") ||
    normalized.includes("not authenticated")
  ) {
    return "unauthorized";
  }
  if (normalized.includes("network")) return "network";
  return "unknown";
};

export const getCurrentAccount = async (): Promise<AppAccount | null> => {
  const mockAccount = getDevMockAccount();
  if (mockAccount) return mockAccount;
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return toAccount(data.user);
};

export const subscribeAccountChanges = (
  onChange: (account: AppAccount | null) => void,
): (() => void) => {
  const mockAccount = getDevMockAccount();
  if (mockAccount) {
    onChange(mockAccount);
    return () => {};
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    onChange(null);
    return () => {};
  }
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    onChange(toAccount(session?.user ?? null));
  });
  return () => data.subscription.unsubscribe();
};

export const registerAccount = async (input: {
  firstName: string;
  lastName: string;
  nickname: string;
  email: string;
  password: string;
}): Promise<RegisterResult> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, code: "missing_config" };
  }

  const normalizedNickname = input.nickname.trim();
  if (normalizedNickname.length > 0) {
    const { data: nicknameAvailability, error: nicknameAvailabilityError } =
      await supabase.rpc("is_nickname_available", {
        nickname_input: normalizedNickname,
      });
    if (!nicknameAvailabilityError) {
      const available = readNicknameAvailability(nicknameAvailability);
      if (available === false) {
        return { ok: false, code: "nickname_exists" };
      }
    }
  }

  const email = input.email.trim().toLowerCase();
  const profileData = {
    first_name: input.firstName.trim(),
    last_name: input.lastName.trim(),
    nickname: normalizedNickname,
  };
  const preferredRedirectUrl = buildAuthEmailRedirectUrl();

  let { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      emailRedirectTo: preferredRedirectUrl,
      data: profileData,
    },
  });

  if (error && isMobileDeepLinkRedirect(preferredRedirectUrl)) {
    if (isRedirectUrlRejectedBySupabase(error.message)) {
      const fallbackRedirectUrl = buildWebAuthEmailRedirectUrl();
      console.warn(
        "Supabase rejected mobile auth redirect URL. Falling back to web auth redirect.",
      );
      ({ data, error } = await supabase.auth.signUp({
        email,
        password: input.password,
        options: {
          emailRedirectTo: fallbackRedirectUrl,
          data: profileData,
        },
      }));
    }
  }

  if (error) {
    return {
      ok: false,
      code: mapRegisterErrorFromSupabase({
        message: error.message,
        status: error.status,
        code: error.code,
      }),
    };
  }

  if (isMaskedExistingUserSignUp(data)) {
    // With email confirmations enabled, Supabase may mask "already registered"
    // by returning a user payload with no identities and no session.
    return { ok: false, code: "email_exists" };
  }

  const account = toAccount(data.user);
  if (!account) {
    return { ok: false, code: "unknown" };
  }

  return {
    ok: true,
    account,
    sessionReady: Boolean(data.session),
  };
};

export const loginAccount = async (input: {
  email: string;
  password: string;
}): Promise<LoginResult> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, code: "missing_config" };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email.trim().toLowerCase(),
    password: input.password,
  });

  if (error) {
    return {
      ok: false,
      code: mapLoginErrorFromSupabase({
        message: error.message,
        status: error.status,
        code: error.code,
      }),
    };
  }

  const account = toAccount(data.user);
  if (!account) {
    return { ok: false, code: "unknown" };
  }

  return {
    ok: true,
    account,
    sessionReady: Boolean(data.session),
  };
};

export const requestPasswordReset = async (input: {
  email: string;
  redirectTo: string;
}): Promise<PasswordResetRequestResult> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, code: "missing_config" };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(
    input.email.trim().toLowerCase(),
    { redirectTo: input.redirectTo },
  );
  if (!error) return { ok: true };

  return {
    ok: false,
    code: mapPasswordResetRequestErrorFromSupabase({
      message: error.message,
      status: error.status,
      code: error.code,
    }),
  };
};

export const updateAccountPassword = async (
  nextPassword: string,
): Promise<PasswordUpdateResult> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, code: "missing_config" };
  }

  const { data, error } = await supabase.auth.updateUser({
    password: nextPassword,
  });
  if (error) {
    return {
      ok: false,
      code: mapPasswordUpdateErrorFromSupabase({
        message: error.message,
        status: error.status,
        code: error.code,
      }),
    };
  }

  const account = toAccount(data.user);
  if (!account) {
    return { ok: false, code: "unknown" };
  }

  return { ok: true, account };
};

export const loadFavoriteBeachIds = async (
  accountId: string | null,
): Promise<string[]> => {
  if (!accountId) return [];
  const mockAccount = getDevMockAccount();
  if (mockAccount && accountId === mockAccount.id) {
    return readMockFavoriteBeachIds(accountId);
  }
  const supabase = getSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from(FAVORITES_TABLE)
    .select("beach_id")
    .eq("user_id", accountId);

  if (error || !Array.isArray(data)) return [];

  const ids = data
    .map((row) => (typeof row.beach_id === "string" ? row.beach_id : null))
    .filter((value): value is string => Boolean(value));
  return Array.from(new Set(ids));
};

export const setFavoriteBeach = async (
  accountId: string,
  beachId: string,
  shouldFavorite: boolean,
): Promise<FavoriteSyncResult> => {
  const mockAccount = getDevMockAccount();
  if (mockAccount && accountId === mockAccount.id) {
    const current = readMockFavoriteBeachIds(accountId);
    const next = shouldFavorite
      ? [...current, beachId]
      : current.filter((id) => id !== beachId);
    writeMockFavoriteBeachIds(accountId, next);
    return { ok: true };
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, code: "missing_config" };
  }

  if (shouldFavorite) {
    const { error } = await supabase
      .from(FAVORITES_TABLE)
      .upsert({ user_id: accountId, beach_id: beachId }, { onConflict: "user_id,beach_id" });

    if (error) {
      return { ok: false, code: mapFavoriteError(error.code, error.message) };
    }
    return { ok: true };
  }

  const { error } = await supabase
    .from(FAVORITES_TABLE)
    .delete()
    .eq("user_id", accountId)
    .eq("beach_id", beachId);

  if (error) {
    return { ok: false, code: mapFavoriteError(error.code, error.message) };
  }
  return { ok: true };
};

export const signOutAccount = async (): Promise<SignOutResult> => {
  if (getDevMockAccount()) {
    clearDevMockAuth();
    return { ok: true };
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, code: "missing_config" };
  }

  const { error } = await supabase.auth.signOut();
  if (!error) return { ok: true };

  const normalized = error.message.toLowerCase();
  if (normalized.includes("network")) {
    return { ok: false, code: "network" };
  }
  return { ok: false, code: "unknown" };
};

export const deleteCurrentAccount = async (): Promise<DeleteAccountResult> => {
  const mockAccount = getDevMockAccount();
  if (mockAccount) {
    clearMockFavoriteBeachIds(mockAccount.id);
    clearDevMockAuth();
    return { ok: true };
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, code: "missing_config" };
  }

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) {
    return { ok: false, code: "unauthorized" };
  }

  const endpoints = buildDeleteAccountEndpoints();
  let sawNetworkFailure = false;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
        },
      });

      if (response.ok) {
        return { ok: true };
      }
      if (response.status === 401) {
        return { ok: false, code: "unauthorized" };
      }
      if (response.status === 404 || response.status === 405) {
        continue;
      }
      return { ok: false, code: "unknown" };
    } catch {
      sawNetworkFailure = true;
    }
  }

  if (sawNetworkFailure) {
    return { ok: false, code: "network" };
  }
  return { ok: false, code: "unknown" };
};

export type OAuthProvider = "google" | "apple" | "facebook";

export type OAuthSignInResult =
  | { ok: true }
  | { ok: false; code: "missing_config" | "unknown" };

export type CompleteOAuthProfileResult =
  | { ok: true; account: AppAccount }
  | { ok: false; code: "missing_config" | "nickname_exists" | "network" | "unknown" };

export const isOAuthProfileComplete = (account: AppAccount): boolean =>
  account.nickname.trim().length > 0;

export const signInWithOAuth = async (
  provider: OAuthProvider,
): Promise<OAuthSignInResult> => {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, code: "missing_config" };
  const redirectTo = buildAuthEmailRedirectUrl();
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo },
  });
  if (error) return { ok: false, code: "unknown" };
  return { ok: true };
};

export const completeOAuthProfile = async (input: {
  nickname: string;
  firstName: string;
  lastName: string;
}): Promise<CompleteOAuthProfileResult> => {
  const supabase = getSupabaseClient();
  if (!supabase) return { ok: false, code: "missing_config" };

  const normalizedNickname = input.nickname.trim();
  if (normalizedNickname.length > 0) {
    const { data: nicknameAvailability, error: nicknameAvailabilityError } =
      await supabase.rpc("is_nickname_available", {
        nickname_input: normalizedNickname,
      });
    if (!nicknameAvailabilityError) {
      const available = readNicknameAvailability(nicknameAvailability);
      if (available === false) return { ok: false, code: "nickname_exists" };
    }
  }

  const { data, error } = await supabase.auth.updateUser({
    data: {
      nickname: normalizedNickname,
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
    },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("network")) return { ok: false, code: "network" };
    return { ok: false, code: "unknown" };
  }

  const account = toAccount(data.user);
  if (!account) return { ok: false, code: "unknown" };
  return { ok: true, account };
};

export const subscribeAuthSignIn = (
  onSignIn: (account: AppAccount) => void,
): (() => void) => {
  const supabase = getSupabaseClient();
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    if (event !== "SIGNED_IN" || !session?.user) return;
    const account = toAccount(session.user);
    if (account) onSignIn(account);
  });
  return () => data.subscription.unsubscribe();
};

export const ensureAppSession = async (): Promise<AppSessionResult> => {
  if (getDevMockAccount()) {
    return { ok: true };
  }
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, code: "missing_config" };
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    return { ok: false, code: "unauthorized" };
  }

  const endpoints = buildAppSessionEndpoints();
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
      });

      if (response.ok) {
        return { ok: true };
      }

      if (response.status === 401 || response.status === 403) {
        return { ok: false, code: "unauthorized" };
      }
    } catch {
      continue;
    }
  }

  // Fallback for deployments where the dedicated endpoint is unavailable:
  // user is already authenticated with Supabase, so we can safely unlock /app.
  if (typeof window !== "undefined") {
    setClientAppAccessCookie();
    return { ok: true };
  }

  return { ok: false, code: "network" };
};
