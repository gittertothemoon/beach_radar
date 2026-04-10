const STORAGE_KEY = "where2beach-active-badge-v1";

export type ActiveBadge = {
  code: string;
  icon: string;
  name: string;
};

export function loadActiveBadge(): ActiveBadge | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      typeof (parsed as Record<string, unknown>).code === "string" &&
      typeof (parsed as Record<string, unknown>).icon === "string" &&
      typeof (parsed as Record<string, unknown>).name === "string"
    ) {
      return parsed as ActiveBadge;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveActiveBadge(badge: ActiveBadge): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(badge));
  } catch {
    // ignore
  }
}

export function clearActiveBadge(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
