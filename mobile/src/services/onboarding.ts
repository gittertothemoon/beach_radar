import * as SecureStore from "expo-secure-store";

const ONBOARDING_COMPLETED_KEY = "where2beach.onboarding.completed.v1";
const ONBOARDING_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: ONBOARDING_COMPLETED_KEY,
};

const readOnboardingValue = async (): Promise<string | null> => {
  try {
    const value = await SecureStore.getItemAsync(
      ONBOARDING_COMPLETED_KEY,
      ONBOARDING_STORE_OPTIONS,
    );
    if (value != null) return value;
  } catch {
    // fallback path below
  }

  try {
    // Backward compatibility for any build that stored without explicit options.
    return await SecureStore.getItemAsync(ONBOARDING_COMPLETED_KEY);
  } catch {
    return null;
  }
};

export const hasCompletedOnboarding = async (): Promise<boolean> => {
  const value = await readOnboardingValue();
  return value === "1";
};

export const markOnboardingCompleted = async (): Promise<void> => {
  try {
    await SecureStore.setItemAsync(
      ONBOARDING_COMPLETED_KEY,
      "1",
      ONBOARDING_STORE_OPTIONS,
    );
  } catch {
    // Non bloccare l'esperienza utente se il secure store non e' disponibile.
    try {
      await SecureStore.setItemAsync(ONBOARDING_COMPLETED_KEY, "1");
    } catch {
      // Ignore fallback failure too.
    }
  }
};
