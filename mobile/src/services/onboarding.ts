import * as SecureStore from "expo-secure-store";

const ONBOARDING_COMPLETED_KEY = "where2beach.onboarding.completed.v1";

export const hasCompletedOnboarding = async (): Promise<boolean> => {
  try {
    const value = await SecureStore.getItemAsync(ONBOARDING_COMPLETED_KEY);
    return value === "1";
  } catch {
    return false;
  }
};

export const markOnboardingCompleted = async (): Promise<void> => {
  try {
    await SecureStore.setItemAsync(ONBOARDING_COMPLETED_KEY, "1", {
      keychainService: ONBOARDING_COMPLETED_KEY,
    });
  } catch {
    // Non bloccare l'esperienza utente se il secure store non e' disponibile.
  }
};
