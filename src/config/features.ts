const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

const parseBooleanEnv = (value: string | undefined, fallback: boolean) => {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase();
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return fallback;
};

const parseNumberEnv = (
  value: string | undefined,
  fallback: number,
  min: number,
) => {
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min) return fallback;
  return parsed;
};

export const FEATURE_FLAGS = {
  useMockCrowd: parseBooleanEnv(import.meta.env.VITE_USE_MOCK_CROWD, false),
  forceRemoteReports: parseBooleanEnv(
    import.meta.env.VITE_FORCE_REMOTE_REPORTS,
    false,
  ),
  reportsPollMs: parseNumberEnv(import.meta.env.VITE_REPORTS_POLL_MS, 60_000, 5_000),
};
