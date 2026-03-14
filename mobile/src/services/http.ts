import { MOBILE_API_TIMEOUT_MS } from "../config/env";

type ApiErrorPayload = {
  error?: string;
  retry_after?: number;
};

export type ApiFetchErrorCode = "network" | "timeout" | "unavailable";

export type ApiFetchResult<T> =
  | { ok: true; data: T; status: number }
  | {
      ok: false;
      code: ApiFetchErrorCode;
      status?: number;
      error?: string;
      retryAfterSec?: number;
    };

const readJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return null;
  }
};

const parseErrorPayload = (payload: unknown): ApiErrorPayload => {
  if (!payload || typeof payload !== "object") return {};
  const next = payload as Record<string, unknown>;
  return {
    error: typeof next.error === "string" ? next.error : undefined,
    retry_after:
      typeof next.retry_after === "number" && Number.isFinite(next.retry_after)
        ? next.retry_after
        : undefined,
  };
};

export const apiFetchJson = async <T>(
  url: string,
  init: RequestInit = {},
): Promise<ApiFetchResult<T>> => {
  const timeoutController = new AbortController();
  const externalSignal = init.signal;
  let timeoutId: ReturnType<typeof setTimeout> | null = setTimeout(() => {
    timeoutController.abort();
  }, MOBILE_API_TIMEOUT_MS);

  const combinedController = new AbortController();
  const onAbort = () => combinedController.abort();
  if (externalSignal) {
    if (externalSignal.aborted) {
      combinedController.abort();
    } else {
      externalSignal.addEventListener("abort", onAbort);
    }
  }
  timeoutController.signal.addEventListener("abort", onAbort);

  try {
    const response = await fetch(url, {
      ...init,
      signal: combinedController.signal,
    });

    const payload = await readJson(response);
    if (!response.ok) {
      const parsedError = parseErrorPayload(payload);
      return {
        ok: false,
        code: "unavailable",
        status: response.status,
        error: parsedError.error,
        retryAfterSec: parsedError.retry_after,
      };
    }

    return {
      ok: true,
      data: payload as T,
      status: response.status,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      if (externalSignal?.aborted) {
        return { ok: false, code: "network" };
      }
      return { ok: false, code: "timeout" };
    }
    return { ok: false, code: "network" };
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (externalSignal) {
      externalSignal.removeEventListener("abort", onAbort);
    }
    timeoutController.signal.removeEventListener("abort", onAbort);
  }
};
