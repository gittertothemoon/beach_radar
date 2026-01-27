const DEFAULT_PUBLIC_BASE_URL = "https://beachradar.it";

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, "");

const readBaseUrlFromEnv = () => {
  const raw = import.meta.env.VITE_PUBLIC_BASE_URL?.trim();
  if (!raw) return DEFAULT_PUBLIC_BASE_URL;
  return normalizeBaseUrl(raw);
};

export const PUBLIC_BASE_URL = readBaseUrlFromEnv();

export const PUBLIC_HOSTNAME = (() => {
  try {
    return new URL(PUBLIC_BASE_URL).hostname;
  } catch {
    return new URL(DEFAULT_PUBLIC_BASE_URL).hostname;
  }
})();
