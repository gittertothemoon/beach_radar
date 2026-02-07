import type { User } from "@supabase/supabase-js";
import { PUBLIC_BASE_URL } from "../config/publicUrl";
import { getSupabaseClient } from "./supabase";

const FAVORITES_TABLE = "user_favorites";

export type AppAccount = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

type RegisterErrorCode =
  | "missing_config"
  | "email_exists"
  | "weak_password"
  | "invalid_email"
  | "network"
  | "unknown";

export type RegisterResult =
  | { ok: true; account: AppAccount; sessionReady: boolean }
  | { ok: false; code: RegisterErrorCode };

type LoginErrorCode =
  | "missing_config"
  | "invalid_credentials"
  | "network"
  | "unknown";

export type LoginResult =
  | { ok: true; account: AppAccount; sessionReady: boolean }
  | { ok: false; code: LoginErrorCode };

type PasswordResetRequestErrorCode =
  | "missing_config"
  | "invalid_email"
  | "network"
  | "unknown";

export type PasswordResetRequestResult =
  | { ok: true }
  | { ok: false; code: PasswordResetRequestErrorCode };

type PasswordUpdateErrorCode =
  | "missing_config"
  | "unauthorized"
  | "weak_password"
  | "network"
  | "unknown";

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

const toAccount = (user: User | null): AppAccount | null => {
  if (!user?.id || !user.email) return null;
  return {
    id: user.id,
    email: user.email,
    firstName: readUserMetadataString(user, "first_name", "firstName"),
    lastName: readUserMetadataString(user, "last_name", "lastName"),
  };
};

const mapRegisterError = (message: string | undefined): RegisterErrorCode => {
  const normalized = (message ?? "").toLowerCase();
  if (
    normalized.includes("already registered") ||
    normalized.includes("already been registered")
  ) {
    return "email_exists";
  }
  if (normalized.includes("password")) return "weak_password";
  if (normalized.includes("email")) return "invalid_email";
  if (normalized.includes("network")) return "network";
  return "unknown";
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

const mapLoginError = (message: string | undefined): LoginErrorCode => {
  const normalized = (message ?? "").toLowerCase();
  if (normalized.includes("invalid login credentials")) {
    return "invalid_credentials";
  }
  if (normalized.includes("network")) return "network";
  return "unknown";
};

const mapPasswordResetRequestError = (
  message: string | undefined,
): PasswordResetRequestErrorCode => {
  const normalized = (message ?? "").toLowerCase();
  if (normalized.includes("email")) return "invalid_email";
  if (normalized.includes("network")) return "network";
  return "unknown";
};

const mapPasswordUpdateError = (
  message: string | undefined,
): PasswordUpdateErrorCode => {
  const normalized = (message ?? "").toLowerCase();
  if (
    normalized.includes("auth session missing") ||
    normalized.includes("invalid token") ||
    normalized.includes("jwt") ||
    normalized.includes("token has expired")
  ) {
    return "unauthorized";
  }
  if (normalized.includes("password")) return "weak_password";
  if (normalized.includes("network")) return "network";
  return "unknown";
};

export const getCurrentAccount = async (): Promise<AppAccount | null> => {
  const supabase = getSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return toAccount(data.user);
};

export const subscribeAccountChanges = (
  onChange: (account: AppAccount | null) => void,
): (() => void) => {
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
  email: string;
  password: string;
}): Promise<RegisterResult> => {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return { ok: false, code: "missing_config" };
  }

  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    options: {
      data: {
        first_name: input.firstName.trim(),
        last_name: input.lastName.trim(),
      },
    },
  });

  if (error) {
    return { ok: false, code: mapRegisterError(error.message) };
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
    return { ok: false, code: mapLoginError(error.message) };
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

  return { ok: false, code: mapPasswordResetRequestError(error.message) };
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
    return { ok: false, code: mapPasswordUpdateError(error.message) };
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
