import { useEffect, useReducer } from "react";
import { subscribeToLanguage } from "./strings";

/**
 * Call inside any memoized component that renders STRINGS content.
 * Forces a re-render whenever the app language switches.
 */
export function useLanguageRefresh(): void {
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);
  useEffect(() => subscribeToLanguage(forceUpdate), []);
}
