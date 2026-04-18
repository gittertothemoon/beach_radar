/**
 * Background task fired when the user enters or exits a beach geofence region.
 * On ENTER: schedules a local "you're near a beach" notification if we haven't
 * already notified for this beach in the last COOLDOWN_MS.
 */
import * as TaskManager from "expo-task-manager";
import * as Location from "expo-location";
import * as Notifications from "expo-notifications";

export const NEARBY_BEACH_TASK = "W2B_NEARBY_BEACH";

// Don't re-notify for the same beach within 4 hours
const COOLDOWN_MS = 4 * 60 * 60 * 1000;
const lastNotifiedAt: Record<string, number> = {};

const MESSAGES = [
  (name: string) => `Sei vicino a ${name} 🏖️ Com'è la situazione oggi?`,
  (name: string) => `${name} è qui vicino! Aggiungi una segnalazione e aiuta gli altri 🌊`,
  (name: string) => `Stai passando vicino a ${name}. La mappa ha bisogno di te! 👀`,
  (name: string) => `Ehi! Sei a due passi da ${name}. Folla o deserta? 🏄`,
];

TaskManager.defineTask(
  NEARBY_BEACH_TASK,
  async ({ data, error }: TaskManager.TaskManagerTaskBody<{ eventType: Location.GeofencingEventType; region: Location.LocationRegion }>) => {
    if (error) return;
    const { eventType, region } = data;
    if (eventType !== Location.GeofencingEventType.Enter) return;

    const beachId = region.identifier ?? "unknown";
    const beachName = (region as Location.LocationRegion & { _name?: string })._name ?? "questa spiaggia";

    const now = Date.now();
    if (lastNotifiedAt[beachId] && now - lastNotifiedAt[beachId] < COOLDOWN_MS) return;
    lastNotifiedAt[beachId] = now;

    const msgFn = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
    await Notifications.scheduleNotificationAsync({
      content: {
        title: "Where2Beach",
        body: msgFn(beachName),
        data: { beachId, type: "nearby_beach" },
      },
      trigger: null, // fire immediately
    });
  },
);
