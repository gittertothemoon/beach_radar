import { readPreferredLanguage, writePreferredLanguage } from "../lib/accountPreferences";
import { STRINGS as IT } from "./it";
import { STRINGS as EN } from "./en";

// Use IT's type as the canonical shape for all consumers.
// EN has the same structure but different string literals (as const), so we cast.
type Strings = typeof IT;
type Lang = "it" | "en";

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
let _current: Strings = readPreferredLanguage() === "en" ? (EN as unknown as Strings) : IT;
let _subscribers: Array<() => void> = [];

// Proxy so all existing `import { STRINGS }` work without changes.
// On language switch, property lookups transparently use the new backing object.
export const STRINGS: Strings = new Proxy({} as Strings, {
  get(_target, key: string) {
    return (_current as Record<string, unknown>)[key];
  },
});

export function applyLanguage(lang: Lang): void {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  _current = lang === "en" ? (EN as unknown as Strings) : IT;
  writePreferredLanguage(lang);
  _subscribers.forEach((fn) => fn());
}

export function subscribeToLanguage(fn: () => void): () => void {
  _subscribers.push(fn);
  return () => {
    _subscribers = _subscribers.filter((s) => s !== fn);
  };
}

export function getCurrentLanguage(): Lang {
  return readPreferredLanguage();
}
