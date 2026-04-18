/**
 * Minimal Expo Push API helper.
 * Sends up to 100 messages per call (Expo batch limit).
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

export type PushMessage = {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: "default" | null;
  badge?: number;
};

export async function sendPushNotifications(
  messages: PushMessage[],
): Promise<void> {
  if (messages.length === 0) return;
  // Batch into groups of 100
  for (let i = 0; i < messages.length; i += 100) {
    const batch = messages.slice(i, i + 100);
    try {
      await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(batch),
      });
    } catch {
      // Non-fatal: push delivery is best-effort
    }
  }
}

export async function sendSinglePush(message: PushMessage): Promise<void> {
  return sendPushNotifications([message]);
}
