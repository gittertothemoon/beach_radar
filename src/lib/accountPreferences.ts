export type PreferredLanguage = "it" | "en";

export const ACCOUNT_PREFS_STORAGE_KEY = "w2b-account-prefs-v1";

export const INTEREST_OPTIONS = [
  { id: "family", label: "Famiglie" },
  { id: "surf", label: "Surf e sport" },
  { id: "relax", label: "Relax" },
  { id: "food", label: "Food & drink" },
  { id: "events", label: "Eventi" },
] as const;

export type InterestId = (typeof INTEREST_OPTIONS)[number]["id"];

type StoredPreferences = {
  language?: unknown;
  interests?: unknown;
};

const isBrowser = () => typeof window !== "undefined";

const parseInterest = (value: unknown): InterestId | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (INTEREST_OPTIONS.some((option) => option.id === normalized)) {
    return normalized as InterestId;
  }
  return null;
};

const parseLanguage = (value: unknown): PreferredLanguage => {
  if (typeof value === "string" && value.trim().toLowerCase() === "en") {
    return "en";
  }
  return "it";
};

const readRaw = (): StoredPreferences => {
  if (!isBrowser()) return {};
  try {
    const raw = window.localStorage.getItem(ACCOUNT_PREFS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredPreferences;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

const writeRaw = (payload: StoredPreferences): void => {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(ACCOUNT_PREFS_STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Storage may be unavailable in privacy mode.
  }
};

export const readPreferredLanguage = (): PreferredLanguage => {
  const raw = readRaw();
  return parseLanguage(raw.language);
};

export const writePreferredLanguage = (language: PreferredLanguage): void => {
  const raw = readRaw();
  writeRaw({
    ...raw,
    language,
  });
};

export const readInterests = (): InterestId[] => {
  const raw = readRaw();
  if (!Array.isArray(raw.interests)) return [];
  const deduped = new Set<InterestId>();
  for (const entry of raw.interests) {
    const parsed = parseInterest(entry);
    if (parsed) deduped.add(parsed);
  }
  return Array.from(deduped);
};

export const writeInterests = (interests: InterestId[]): void => {
  const deduped = Array.from(
    new Set(
      interests
        .map((entry) => parseInterest(entry))
        .filter((entry): entry is InterestId => entry !== null),
    ),
  );
  const raw = readRaw();
  writeRaw({
    ...raw,
    interests: deduped,
  });
};
