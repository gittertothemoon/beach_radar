const normalizeBaseUrl = (rawValue: string | undefined): string => {
  const fallback = "https://where2beach.com";
  if (!rawValue) return fallback;
  const trimmed = rawValue.trim();
  if (!trimmed) return fallback;
  return trimmed.replace(/\/$/, "");
};

const readAppAccessKey = (rawValue: string | undefined): string | null => {
  if (!rawValue) return null;
  const trimmed = rawValue.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readStringEnv = (rawValue: string | undefined): string | null => {
  if (!rawValue) return null;
  const trimmed = rawValue.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const readBooleanEnv = (rawValue: string | undefined, fallback = false): boolean => {
  if (!rawValue) return fallback;
  const normalized = rawValue.trim().toLowerCase();
  if (normalized === "1" || normalized === "true") return true;
  if (normalized === "0" || normalized === "false") return false;
  return fallback;
};

const readNumberEnv = (
  rawValue: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number => {
  if (!rawValue) return fallback;
  const numeric = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(numeric)) return fallback;
  if (numeric < min || numeric > max) return fallback;
  return numeric;
};

const IS_DEV_RUNTIME = typeof __DEV__ === "boolean" ? __DEV__ : false;

export const MOBILE_BASE_URL = normalizeBaseUrl(process.env.EXPO_PUBLIC_BASE_URL);
export const MOBILE_APP_ACCESS_KEY = readAppAccessKey(
  process.env.EXPO_PUBLIC_APP_ACCESS_KEY,
);
export const MOBILE_API_TIMEOUT_MS = readNumberEnv(
  process.env.EXPO_PUBLIC_API_TIMEOUT_MS,
  12000,
  3000,
  30000,
);
export const MOBILE_REPORT_ANYWHERE = readBooleanEnv(
  process.env.EXPO_PUBLIC_REPORT_ANYWHERE,
  false,
);
export const MOBILE_DEV_MOCK_AUTH = readBooleanEnv(
  IS_DEV_RUNTIME ? process.env.EXPO_PUBLIC_DEV_MOCK_AUTH : "0",
  false,
);
export const MOBILE_DEV_MOCK_EMAIL = readStringEnv(
  IS_DEV_RUNTIME ? process.env.EXPO_PUBLIC_DEV_MOCK_EMAIL : undefined,
);

export const MOBILE_API_BASE_URL = `${MOBILE_BASE_URL}/api`;

const mobileAppPathParams = new URLSearchParams();
mobileAppPathParams.set("native_shell", "1");
if (MOBILE_REPORT_ANYWHERE) {
  mobileAppPathParams.set("report_anywhere", "1");
}
if (MOBILE_DEV_MOCK_AUTH) {
  mobileAppPathParams.set("mock_auth", "1");
  if (MOBILE_DEV_MOCK_EMAIL) {
    mobileAppPathParams.set("mock_email", MOBILE_DEV_MOCK_EMAIL);
  }
}
const MOBILE_APP_PATH = `/app/${mobileAppPathParams.toString() ? `?${mobileAppPathParams.toString()}` : ""}`;

export const MOBILE_APP_URL = MOBILE_APP_ACCESS_KEY
  ? `${MOBILE_BASE_URL}/api/app-access?key=${encodeURIComponent(
      MOBILE_APP_ACCESS_KEY,
    )}&path=${encodeURIComponent(MOBILE_APP_PATH)}`
  : `${MOBILE_BASE_URL}${MOBILE_APP_PATH}`;

export const buildApiUrl = (
  endpoint: string,
  query?: Record<string, string | number | undefined | null>,
): string => {
  const normalized = endpoint.startsWith("/") ? endpoint.slice(1) : endpoint;
  const base = `${MOBILE_API_BASE_URL}/${normalized}`;
  if (!query) return base;

  const params: string[] = [];
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    params.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  }
  if (params.length === 0) return base;
  return `${base}?${params.join("&")}`;
};
