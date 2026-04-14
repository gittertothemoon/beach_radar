import * as SecureStore from "expo-secure-store";

const BUNDLE_ID = "com.where2beach.mobile";
const ITUNES_LOOKUP_URL = `https://itunes.apple.com/lookup?bundleId=${BUNDLE_ID}`;
const APP_STORE_URL = "https://apps.apple.com/app/id6760668956";
const DISMISSED_KEY = "where2beach.update.dismissed.v1";
const FETCH_TIMEOUT_MS = 8000;

// Version embedded at bundle time from app.json
// eslint-disable-next-line @typescript-eslint/no-require-imports
const CURRENT_VERSION: string = (require("../../app.json") as { expo: { version: string } }).expo.version;

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na !== nb) return na - nb;
  }
  return 0;
}

async function getDismissedVersion(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(DISMISSED_KEY);
  } catch {
    return null;
  }
}

async function setDismissedVersion(version: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(DISMISSED_KEY, version);
  } catch {
    // Non bloccare l'esperienza utente se SecureStore non è disponibile.
  }
}

export type UpdateCheckResult =
  | { hasUpdate: false }
  | { hasUpdate: true; storeVersion: string; storeUrl: string };

export async function checkForUpdate(): Promise<UpdateCheckResult> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => { controller.abort(); }, FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(ITUNES_LOOKUP_URL, { signal: controller.signal });
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) return { hasUpdate: false };

    const data = (await res.json()) as {
      resultCount: number;
      results: Array<{ version: string }>;
    };
    const storeVersion = data.results?.[0]?.version;
    if (!storeVersion) return { hasUpdate: false };
    if (compareVersions(storeVersion, CURRENT_VERSION) <= 0) return { hasUpdate: false };

    const dismissed = await getDismissedVersion();
    if (dismissed === storeVersion) return { hasUpdate: false };

    return { hasUpdate: true, storeVersion, storeUrl: APP_STORE_URL };
  } catch {
    return { hasUpdate: false };
  }
}

export const dismissUpdate = (version: string): Promise<void> =>
  setDismissedVersion(version);
