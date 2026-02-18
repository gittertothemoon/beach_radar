const REPORTER_KEY = "where2beach-reporter-v1";

const randomHex = (length: number) => {
  const bytes = new Uint8Array(length / 2);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
};

export const getReporterHash = (): string => {
  const existing = localStorage.getItem(REPORTER_KEY);
  if (existing) return existing;
  const hash = randomHex(16);
  localStorage.setItem(REPORTER_KEY, hash);
  return hash;
};
