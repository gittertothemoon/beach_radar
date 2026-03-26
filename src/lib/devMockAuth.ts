export type DevMockAccount = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  nickname: string;
};

const DEV_MOCK_AUTH_SESSION_KEY = "where2beach-dev-mock-auth-v1";
const DEV_MOCK_AUTH_EMAIL_KEY = "where2beach-dev-mock-auth-email-v1";
const DEV_MOCK_AUTH_FIRST_NAME_KEY = "where2beach-dev-mock-auth-first-name-v1";
const DEV_MOCK_AUTH_LAST_NAME_KEY = "where2beach-dev-mock-auth-last-name-v1";
const DEV_MOCK_AUTH_NICKNAME_KEY = "where2beach-dev-mock-auth-nickname-v1";

const DEFAULT_MOCK_ACCOUNT: DevMockAccount = {
  id: "mock-dev-user",
  email: "dev.mock@where2beach.local",
  firstName: "Dev",
  lastName: "User",
  nickname: "DevUser",
};

const parseBooleanFlag = (value: string | null): boolean | null => {
  if (value === null) return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "1" || normalized === "true") return true;
  if (normalized === "0" || normalized === "false") return false;
  return null;
};

const readQueryBooleanFlag = (
  searchParams: URLSearchParams,
  ...keys: string[]
): boolean | null => {
  for (const key of keys) {
    const parsed = parseBooleanFlag(searchParams.get(key));
    if (parsed !== null) return parsed;
  }
  return null;
};

const readQueryString = (
  searchParams: URLSearchParams,
  ...keys: string[]
): string | null => {
  for (const key of keys) {
    const value = searchParams.get(key);
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
};

const isPrivateIpv4Host = (host: string): boolean => {
  const match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!match) return false;
  const octets = match.slice(1).map((item) => Number.parseInt(item, 10));
  if (octets.some((value) => !Number.isFinite(value) || value < 0 || value > 255)) {
    return false;
  }

  const [a, b] = octets;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 192 && b === 168) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  return false;
};

const isLocalDevHost = (hostname: string): boolean => {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === "localhost" || normalized === "::1") return true;
  if (normalized.endsWith(".local")) return true;
  return isPrivateIpv4Host(normalized);
};

const sanitizeName = (value: string | null, fallback: string): string => {
  if (!value) return fallback;
  const normalized = value
    .replace(/[^\p{L}\p{N}\s.'-]/gu, "")
    .trim()
    .slice(0, 40);
  return normalized.length > 0 ? normalized : fallback;
};

const sanitizeEmail = (value: string | null, fallback: string): string => {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (!normalized.includes("@") || normalized.length > 120) return fallback;
  return normalized;
};

const sanitizeNickname = (value: string | null, fallback: string): string => {
  if (!value) return fallback;
  const normalized = value
    .replace(/[^A-Za-z0-9._-]/g, "")
    .trim()
    .slice(0, 24);
  if (normalized.length < 3) return fallback;
  return normalized;
};

const clearStoredMockAuth = (): void => {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(DEV_MOCK_AUTH_SESSION_KEY);
  window.sessionStorage.removeItem(DEV_MOCK_AUTH_EMAIL_KEY);
  window.sessionStorage.removeItem(DEV_MOCK_AUTH_FIRST_NAME_KEY);
  window.sessionStorage.removeItem(DEV_MOCK_AUTH_LAST_NAME_KEY);
  window.sessionStorage.removeItem(DEV_MOCK_AUTH_NICKNAME_KEY);
};

export const clearDevMockAuth = (): void => {
  clearStoredMockAuth();
};

export const getDevMockAccount = (): DevMockAccount | null => {
  if (typeof window === "undefined") return null;
  if (!isLocalDevHost(window.location.hostname)) return null;

  const searchParams = new URLSearchParams(window.location.search);
  const queryEnabled = readQueryBooleanFlag(
    searchParams,
    "mock_auth",
    "mockAuth",
    "dev_mock_auth",
    "devMockAuth",
  );

  if (queryEnabled === true) {
    window.sessionStorage.setItem(DEV_MOCK_AUTH_SESSION_KEY, "1");
  } else if (queryEnabled === false) {
    clearStoredMockAuth();
    return null;
  }

  if (window.sessionStorage.getItem(DEV_MOCK_AUTH_SESSION_KEY) !== "1") {
    return null;
  }

  const queryEmail = readQueryString(searchParams, "mock_email", "mockEmail");
  const queryFirstName = readQueryString(
    searchParams,
    "mock_first_name",
    "mockFirstName",
  );
  const queryLastName = readQueryString(
    searchParams,
    "mock_last_name",
    "mockLastName",
  );
  const queryNickname = readQueryString(
    searchParams,
    "mock_nickname",
    "mockNickname",
  );

  const email = sanitizeEmail(
    queryEmail ?? window.sessionStorage.getItem(DEV_MOCK_AUTH_EMAIL_KEY),
    DEFAULT_MOCK_ACCOUNT.email,
  );
  const firstName = sanitizeName(
    queryFirstName ?? window.sessionStorage.getItem(DEV_MOCK_AUTH_FIRST_NAME_KEY),
    DEFAULT_MOCK_ACCOUNT.firstName,
  );
  const lastName = sanitizeName(
    queryLastName ?? window.sessionStorage.getItem(DEV_MOCK_AUTH_LAST_NAME_KEY),
    DEFAULT_MOCK_ACCOUNT.lastName,
  );
  const nickname = sanitizeNickname(
    queryNickname ?? window.sessionStorage.getItem(DEV_MOCK_AUTH_NICKNAME_KEY),
    DEFAULT_MOCK_ACCOUNT.nickname,
  );

  window.sessionStorage.setItem(DEV_MOCK_AUTH_EMAIL_KEY, email);
  window.sessionStorage.setItem(DEV_MOCK_AUTH_FIRST_NAME_KEY, firstName);
  window.sessionStorage.setItem(DEV_MOCK_AUTH_LAST_NAME_KEY, lastName);
  window.sessionStorage.setItem(DEV_MOCK_AUTH_NICKNAME_KEY, nickname);

  return {
    id: DEFAULT_MOCK_ACCOUNT.id,
    email,
    firstName,
    lastName,
    nickname,
  };
};

export const isDevMockAuthEnabled = (): boolean => getDevMockAccount() !== null;
