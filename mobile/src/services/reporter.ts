import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

const REPORTER_SEED_KEY = "where2beach.reporter.seed.v1";

const bytesToHex = (bytes: Uint8Array): string => {
  let hex = "";
  for (const value of bytes) {
    hex += value.toString(16).padStart(2, "0");
  }
  return hex;
};

const getOrCreateSeed = async (): Promise<string> => {
  const existing = await SecureStore.getItemAsync(REPORTER_SEED_KEY);
  if (existing && existing.trim().length > 0) return existing;

  const randomBytes = Crypto.getRandomBytes(24);
  const seed = bytesToHex(randomBytes);
  await SecureStore.setItemAsync(REPORTER_SEED_KEY, seed, {
    keychainService: REPORTER_SEED_KEY,
  });
  return seed;
};

export const getReporterHash = async (): Promise<string> => {
  const seed = await getOrCreateSeed();
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `where2beach-mobile:${seed}`,
  );
  return `sha256:${digest}`;
};
